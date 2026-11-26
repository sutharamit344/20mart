'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@20mart/ui';
import { PackageCheck } from 'lucide-react';
import { api, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { formatINR, inputCls, labelCls, Panel, Table, TBody, Td, Th, THead, textareaCls } from '../../../components/ui';

interface PoItem {
  id: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityRejected: number;
  unitCostPaise: number;
  product: { name: string; sku: string };
  variant: { name: string; sku: string } | null;
}
interface Receipt {
  id: string;
  receiptNumber: string;
  notes: string | null;
  createdAt: string;
  receivedBy: { name: string } | null;
  items: { id: string; quantityAccepted: number; quantityRejected: number; discrepancyNote: string | null; purchaseOrderItem: { product: { name: string }; variant: { name: string } | null } }[];
}
interface Po {
  id: string;
  poNumber: string;
  status: 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED';
  totalPaise: number;
  notes: string | null;
  expectedDate: string | null;
  orderedAt: string | null;
  createdAt: string;
  createdBy: { name: string } | null;
  supplier: { name: string; phone: string | null; email: string | null; gstin: string | null };
  warehouse: { code: string; name: string };
  items: PoItem[];
  receipts: Receipt[];
}

const fmt = (d: string) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
const outstanding = (i: PoItem) => i.quantityOrdered - i.quantityReceived - i.quantityRejected;

function ReceiveForm({ po, onDone }: { po: Po; onDone: () => void }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const open = po.items.filter((i) => outstanding(i) > 0);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [rows, setRows] = useState<Record<string, { accepted: string; rejected: string; note: string }>>(
    Object.fromEntries(open.map((i) => [i.id, { accepted: String(outstanding(i)), rejected: '0', note: '' }]))
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upd = (id: string, k: 'accepted' | 'rejected' | 'note', v: string) => setRows({ ...rows, [id]: { ...rows[id], [k]: v } });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const items = open
      .map((i) => ({ purchaseOrderItemId: i.id, quantityAccepted: Number(rows[i.id].accepted || 0), quantityRejected: Number(rows[i.id].rejected || 0), discrepancyNote: rows[i.id].note }))
      .filter((i) => i.quantityAccepted + i.quantityRejected > 0);
    if (!items.length) return setError('Enter what was received');
    const accepted = items.reduce((a, i) => a + i.quantityAccepted, 0);
    if (!confirm(`Confirm receipt? ${accepted} unit(s) will be added to ${po.warehouse.code} stock. This cannot be undone (only corrected with a stock adjustment).`)) return;
    setSaving(true);
    try {
      const r = await api<{ receiptNumber: string; duplicate: boolean }>(`/api/admin/purchase-orders/${po.id}/receive`, { body: { idempotencyKey: key, notes, items } });
      showToast(r.duplicate ? `Already recorded as ${r.receiptNumber}` : `Goods received (${r.receiptNumber})`);
      setKey(crypto.randomUUID());
      onDone();
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 text-xs">
      <p className="rounded-lg bg-success-soft p-2 text-success">
        Count what physically arrived. Only accepted units are added to <b>{po.warehouse.code}</b>; rejected units are recorded as discrepancies and never stocked.
      </p>
      {error && <p className="rounded-lg bg-danger-soft p-2 text-danger">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead className="text-2xs uppercase text-ink-500">
            <tr>
              <th className="py-1.5">Item</th>
              <th className="py-1.5 w-20 text-right">Outstanding</th>
              <th className="py-1.5 w-24">Accepted</th>
              <th className="py-1.5 w-24">Rejected</th>
              <th className="py-1.5">Discrepancy note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {open.map((i) => (
              <tr key={i.id}>
                <td className="py-1.5 pr-2">
                  <p className="font-semibold text-ink">
                    {i.product.name}
                    {i.variant && <span className="font-normal text-ink-500"> · {i.variant.name}</span>}
                  </p>
                </td>
                <td className="text-right pr-2">{outstanding(i)}</td>
                <td className="pr-2">
                  <input aria-label="Accepted" className={inputCls} inputMode="numeric" value={rows[i.id].accepted} onChange={(e) => upd(i.id, 'accepted', e.target.value.replace(/\D/g, ''))} />
                </td>
                <td className="pr-2">
                  <input aria-label="Rejected" className={inputCls} inputMode="numeric" value={rows[i.id].rejected} onChange={(e) => upd(i.id, 'rejected', e.target.value.replace(/\D/g, ''))} />
                </td>
                <td>
                  <input
                    aria-label="Discrepancy note"
                    className={inputCls}
                    maxLength={300}
                    placeholder={Number(rows[i.id].rejected) > 0 ? 'Required: damaged, wrong item…' : 'Optional'}
                    value={rows[i.id].note}
                    onChange={(e) => upd(i.id, 'note', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <label className={labelCls}>Receipt notes (invoice / challan no.)</label>
        <textarea className={textareaCls} rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" variant="brand" isLoading={saving}>
          Confirm received goods
        </Button>
      </div>
    </form>
  );
}

export function PoDetail({ po, perms }: { po: Po; perms: { manage: boolean; receive: boolean } }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [receiving, setReceiving] = useState(false);
  const canReceive = perms.receive && (po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED');

  const setStatus = async (status: 'ORDERED' | 'CANCELLED' | 'CLOSED', confirmText: string) => {
    const reason = status === 'ORDERED' ? null : prompt(`${confirmText}\n\nReason (optional):`);
    if (status !== 'ORDERED' && reason === null) return;
    if (status === 'ORDERED' && !confirm(confirmText)) return;
    try {
      await api(`/api/admin/purchase-orders/${po.id}/status`, { body: { status, reason } });
      showToast('Purchase order updated');
      router.refresh();
    } catch (err) {
      showToast(errMsg(err));
    }
  };

  return (
    <div className="space-y-3">
      <Panel
        title="Order"
        actions={
          perms.manage ? (
            <div className="flex flex-wrap gap-1.5">
              {po.status === 'DRAFT' && (
                <Button size="sm" variant="brand" onClick={() => setStatus('ORDERED', 'Mark as ordered (sent to supplier)? Stock does not change until goods are received.')}>
                  Mark as ordered
                </Button>
              )}
              {(po.status === 'DRAFT' || po.status === 'ORDERED') && (
                <Button size="sm" variant="outline" onClick={() => setStatus('CANCELLED', 'Cancel this purchase order?')}>
                  Cancel PO
                </Button>
              )}
              {(po.status === 'PARTIALLY_RECEIVED' || po.status === 'RECEIVED' || po.status === 'ORDERED') && (
                <Button size="sm" variant="outline" onClick={() => setStatus('CLOSED', 'Close this purchase order? Any outstanding quantity will no longer be expected.')}>
                  Close PO
                </Button>
              )}
            </div>
          ) : null
        }
        bodyClassName="p-3 sm:p-4 space-y-3"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-2xs text-ink-500">Supplier</p>
            <p className="font-semibold">{po.supplier.name}</p>
            <p className="text-2xs text-ink-400">{[po.supplier.phone, po.supplier.gstin].filter(Boolean).join(' · ')}</p>
          </div>
          <div>
            <p className="text-2xs text-ink-500">Receive at</p>
            <p className="font-semibold">
              {po.warehouse.code} · {po.warehouse.name}
            </p>
          </div>
          <div>
            <p className="text-2xs text-ink-500">Expected</p>
            <p className="font-semibold">{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('en-IN') : '—'}</p>
          </div>
          <div>
            <p className="text-2xs text-ink-500">Created</p>
            <p className="font-semibold">{fmt(po.createdAt)}</p>
            <p className="text-2xs text-ink-400">{po.createdBy?.name ?? ''}</p>
          </div>
        </div>
        {po.notes && <p className="rounded-lg bg-surface-page p-2 text-xs text-ink-600">{po.notes}</p>}
        <Table minWidth={640}>
          <THead>
            <Th>Item</Th>
            <Th className="text-right">Ordered</Th>
            <Th className="text-right">Received</Th>
            <Th className="text-right">Rejected</Th>
            <Th className="text-right">Outstanding</Th>
            <Th className="text-right">Unit cost</Th>
            <Th className="text-right">Total</Th>
          </THead>
          <TBody>
            {po.items.map((i) => (
              <tr key={i.id}>
                <Td>
                  <p className="font-semibold text-ink">
                    {i.product.name}
                    {i.variant && <span className="font-normal text-ink-500"> · {i.variant.name}</span>}
                  </p>
                  <p className="font-mono text-2xs text-ink-400">{i.variant?.sku ?? i.product.sku}</p>
                </Td>
                <Td className="text-right">{i.quantityOrdered}</Td>
                <Td className="text-right text-success font-semibold">{i.quantityReceived}</Td>
                <Td className="text-right text-danger">{i.quantityRejected || '—'}</Td>
                <Td className="text-right font-bold">{po.status === 'CLOSED' || po.status === 'CANCELLED' ? '—' : outstanding(i)}</Td>
                <Td className="text-right">{formatINR(i.unitCostPaise)}</Td>
                <Td className="text-right">{formatINR(i.unitCostPaise * i.quantityOrdered)}</Td>
              </tr>
            ))}
          </TBody>
        </Table>
        <p className="text-right text-xs font-bold text-ink">Order value {formatINR(po.totalPaise)}</p>
      </Panel>

      {canReceive && (
        <Panel title="Receive goods" bodyClassName="p-3 sm:p-4">
          {receiving ? (
            <ReceiveForm po={po} onDone={() => setReceiving(false)} />
          ) : (
            <Button size="sm" variant="brand" leftIcon={<PackageCheck className="w-3.5 h-3.5" />} onClick={() => setReceiving(true)}>
              Record a delivery
            </Button>
          )}
        </Panel>
      )}

      <Panel title={`Goods receipts (${po.receipts.length})`} bodyClassName="p-3 sm:p-4">
        {po.receipts.length === 0 ? (
          <p className="text-xs text-ink-500">Nothing received yet.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {po.receipts.map((r) => (
              <li key={r.id} className="rounded-lg border border-line-subtle p-2.5">
                <p className="font-semibold text-ink">
                  <span className="font-mono">{r.receiptNumber}</span> · {fmt(r.createdAt)} · {r.receivedBy?.name ?? '—'}
                </p>
                <ul className="mt-1 space-y-0.5 text-ink-600">
                  {r.items.map((it) => (
                    <li key={it.id}>
                      {it.purchaseOrderItem.product.name}
                      {it.purchaseOrderItem.variant ? ` · ${it.purchaseOrderItem.variant.name}` : ''}: <b className="text-success">+{it.quantityAccepted}</b>
                      {it.quantityRejected > 0 && (
                        <span className="text-danger">
                          {' '}
                          · {it.quantityRejected} rejected ({it.discrepancyNote})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {r.notes && <p className="mt-1 text-2xs text-ink-500">{r.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
