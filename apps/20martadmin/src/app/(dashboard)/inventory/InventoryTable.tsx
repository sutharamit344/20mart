'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Drawer, Modal, resolveImageSrc } from '@20mart/ui';
import { History, Package, SlidersHorizontal } from 'lucide-react';
import { api, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { inputCls, labelCls, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead } from '../../../components/ui';
import { IconBtn } from '../categories/CategoriesTable';

export interface InventoryRow {
  id: string;
  availableQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  safetyStock: number;
  sellable: number;
  warehouse: { id: string; name: string; code: string; status: string };
  state: 'IN_STOCK' | 'LOW' | 'OUT';
  updatedAt: string;
  product: { id: string; name: string; sku: string; status: string; imageUrl: string | null };
  variant: { id: string; name: string; sku: string; status: string } | null;
  _count: { movements: number };
}

type AdjustType = 'INITIAL_STOCK' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';

export function InventoryTable({ items, perms }: { items: InventoryRow[]; perms: { adjust: boolean; update: boolean } }) {
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null);
  const [history, setHistory] = useState<InventoryRow | null>(null);

  return (
    <>
      <Table minWidth={900}>
        <THead>
          <Th>Item</Th>
          <Th>Warehouse</Th>
          <Th className="text-right">On hand</Th>
          <Th className="text-right">Reserved</Th>
          <Th className="text-right">Sellable</Th>
          <Th className="text-right">Safety</Th>
          <Th className="text-right">Low at</Th>
          <Th>State</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {items.length === 0 && <TableEmpty colSpan={9} title="Nothing to show" description="No stock rows match these filters." />}
          {items.map((i) => (
            <tr key={i.id} className="hover:bg-gray-50/60">
              <Td>
                <Link href={`/products/${i.product.id}`} className="flex items-center gap-2.5 min-w-0 group">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-white">
                    {i.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveImageSrc(i.product.imageUrl)} alt="" className="h-full w-full object-contain" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <Package className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 max-w-[16rem]">
                    <p className="truncate font-semibold text-gray-900 group-hover:text-[#E66E00]">
                      {i.product.name}
                      {i.variant && <span className="font-normal text-gray-500"> · {i.variant.name}</span>}
                    </p>
                    <p className="truncate font-mono text-[10px] text-gray-400">
                      {i.variant?.sku ?? i.product.sku}
                      {i.product.status !== 'ACTIVE' && ` · ${i.product.status.toLowerCase()}`}
                    </p>
                  </div>
                </Link>
              </Td>
              <Td>
                <span className="font-mono text-[11px] font-semibold text-gray-700">{i.warehouse.code}</span>
                {i.warehouse.status !== 'ACTIVE' && <span className="ml-1"><StatusBadge status={i.warehouse.status} /></span>}
              </Td>
              <Td className="text-right font-semibold text-gray-900">{i.availableQuantity}</Td>
              <Td className="text-right text-gray-500">{i.reservedQuantity}</Td>
              <Td className="text-right font-bold text-gray-900" >{i.sellable}</Td>
              <Td className="text-right">
                <LevelCell row={i} field="safetyStock" canEdit={perms.update} />
              </Td>
              <Td className="text-right">
                <LevelCell row={i} field="lowStockThreshold" canEdit={perms.update} />
              </Td>
              <Td>
                <StatusBadge status={i.state} />
              </Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-0.5">
                  {perms.adjust && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" leftIcon={<SlidersHorizontal className="w-3 h-3" />} onClick={() => setAdjusting(i)}>
                      Adjust
                    </Button>
                  )}
                  <IconBtn label="Stock history" onClick={() => setHistory(i)}>
                    <History className="w-3.5 h-3.5" />
                  </IconBtn>
                </div>
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>
      {adjusting && <AdjustModal row={adjusting} onClose={() => setAdjusting(null)} />}
      <HistoryDrawer row={history} onClose={() => setHistory(null)} />
    </>
  );
}

/** Inline editor for the low-stock threshold or the safety stock held back from sale. */
function LevelCell({ row, field, canEdit }: { row: InventoryRow; field: 'lowStockThreshold' | 'safetyStock'; canEdit: boolean }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const current = row[field];
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  if (!canEdit) return <span className="text-gray-600">{current}</span>;
  const commit = async () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n === current) {
      setValue(String(current));
      return;
    }
    setSaving(true);
    try {
      await api(`/api/admin/inventory/${row.id}/threshold`, { method: 'PATCH', body: { [field]: n } });
      showToast(field === 'safetyStock' ? 'Safety stock updated' : 'Threshold updated');
      router.refresh();
    } catch (e) {
      showToast(errMsg(e));
      setValue(String(current));
    } finally {
      setSaving(false);
    }
  };
  return (
    <input
      aria-label={field === 'safetyStock' ? 'Safety stock' : 'Low-stock threshold'}
      inputMode="numeric"
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="h-7 w-16 rounded border border-gray-200 px-1.5 text-right text-xs focus:border-[#0B5D3B] focus:outline-none"
    />
  );
}

const TYPE_LABELS: Record<AdjustType, { label: string; hint: string }> = {
  INITIAL_STOCK: { label: 'Initial stock', hint: 'First stock count for a new item' },
  STOCK_IN: { label: 'Stock in', hint: 'Received units (e.g. supplier delivery)' },
  STOCK_OUT: { label: 'Stock out', hint: 'Damaged, expired, lost or removed units' },
  ADJUSTMENT: { label: 'Correction', hint: 'Set the exact on-hand count after a physical check' },
};

function AdjustModal({ row, onClose }: { row: InventoryRow; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const firstTime = row._count.movements === 0;
  const [type, setType] = useState<AdjustType>(firstTime ? 'INITIAL_STOCK' : 'STOCK_IN');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = Number(qty);
  const validQty = qty !== '' && Number.isInteger(n) && (type === 'ADJUSTMENT' ? n >= 0 : n > 0);
  const resulting =
    !validQty ? null : type === 'ADJUSTMENT' ? n : type === 'STOCK_OUT' ? row.availableQuantity - n : row.availableQuantity + n;
  const wouldGoNegative = resulting !== null && resulting < row.reservedQuantity;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validQty || wouldGoNegative) return;
    setSaving(true);
    setError(null);
    try {
      const body = type === 'ADJUSTMENT' ? { type, newQuantity: n, reason, reference } : { type, quantity: n, reason, reference };
      await api(`/api/admin/inventory/${row.id}/adjust`, { body });
      showToast('Stock updated and logged');
      onClose();
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Adjust stock" maxWidth="md">
      <form onSubmit={submit} className="space-y-3 text-xs">
        <div className="rounded-lg bg-gray-50 p-2.5">
          <p className="font-semibold text-gray-900">
            {row.product.name}
            {row.variant && <span className="font-normal text-gray-500"> · {row.variant.name}</span>}
          </p>
          <p className="mt-0.5 text-gray-500">Warehouse <b className="text-gray-900">{row.warehouse.code}</b> · {row.warehouse.name}</p>
          <p className="mt-0.5 text-gray-500">
            On hand <b className="text-gray-900">{row.availableQuantity}</b> · reserved {row.reservedQuantity}
          </p>
        </div>
        {error && <p className="rounded-lg bg-red-50 p-2 text-red-700">{error}</p>}
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Adjustment type">
          {(Object.keys(TYPE_LABELS) as AdjustType[])
            .filter((t) => (t === 'INITIAL_STOCK' ? firstTime : true))
            .map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={`rounded-lg border p-2 text-left transition-colors ${type === t ? 'border-[#0B5D3B] bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <span className="block font-semibold text-gray-900">{TYPE_LABELS[t].label}</span>
                <span className="block text-[10px] text-gray-500">{TYPE_LABELS[t].hint}</span>
              </button>
            ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{type === 'ADJUSTMENT' ? 'Counted quantity *' : 'Quantity *'}</label>
            <input className={inputCls} inputMode="numeric" required value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} autoFocus />
          </div>
          <div>
            <label className={labelCls}>Reference</label>
            <input className={inputCls} maxLength={100} placeholder="PO / invoice no." value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Reason *</label>
          <input className={inputCls} required minLength={3} maxLength={300} placeholder="e.g. Delivery from Ahmedabad supplier" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {resulting !== null && (
          <p className={`rounded-lg p-2 ${wouldGoNegative ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
            {wouldGoNegative ? `Not allowed: stock would drop below ${row.reservedQuantity}.` : `New on-hand quantity: ${row.availableQuantity} → ${resulting}`}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" size="sm" isLoading={saving} disabled={!validQty || wouldGoNegative || reason.trim().length < 3}>
            Save adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface Movement {
  id: string;
  movementType: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  reference: string | null;
  createdAt: string;
  performedBy: { name: string; username: string } | null;
}

function HistoryDrawer({ row, onClose }: { row: InventoryRow | null; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Movement[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [row?.id]);

  useEffect(() => {
    if (!row) return;
    let cancelled = false;
    setData(null);
    setError(null);
    api<{ items: Movement[]; total: number }>(`/api/admin/inventory/${row.id}/history?page=${page}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(errMsg(e)));
    return () => {
      cancelled = true;
    };
  }, [row, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <Drawer isOpen={!!row} onClose={onClose} position="right" title="Stock history">
      {row && (
        <div className="space-y-3 text-xs">
          <p className="font-semibold text-gray-900">
            {row.product.name}
            {row.variant && <span className="font-normal text-gray-500"> · {row.variant.name}</span>}
          </p>
          {error && <p className="rounded bg-red-50 p-2 text-red-700">{error}</p>}
          {!data && !error && <p className="py-6 text-center text-gray-400">Loading…</p>}
          {data && data.items.length === 0 && <p className="py-6 text-center text-gray-500">No stock movements yet.</p>}
          <ul className="space-y-2">
            {data?.items.map((m) => (
              <li key={m.id} className="rounded-lg border border-gray-100 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={m.movementType} label={m.movementType.replace(/_/g, ' ').toLowerCase()} />
                  <span className={`font-bold ${m.quantity >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {m.quantity > 0 ? '+' : ''}
                    {m.quantity}
                  </span>
                </div>
                <p className="mt-1 text-gray-600">
                  {m.previousQuantity} → <b>{m.newQuantity}</b> · {m.reason}
                  {m.reference && <span className="text-gray-400"> · Ref {m.reference}</span>}
                </p>
                <p className="mt-0.5 text-[10px] text-gray-400">
                  {new Date(m.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {m.performedBy?.name ?? 'System'}
                </p>
              </li>
            ))}
          </ul>
          {data && pages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Newer
              </Button>
              <span className="text-gray-500">
                {page} / {pages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Older
              </Button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
