'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@20mart/ui';
import { parseRupeesToPaise } from '@20mart/shared';
import { Trash2 } from 'lucide-react';
import { api, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { formatINR, inputCls, labelCls, Panel, textareaCls } from '../../../components/ui';
import { SkuSearch, type SkuPick } from '../inventory/AddStockButton';

interface Line extends SkuPick {
  quantity: string;
  unitCost: string;
}
interface Existing {
  id: string;
  supplierId: string;
  warehouseId: string;
  expectedDate: string;
  notes: string;
  items: Line[];
}

export function PoEditor({
  suppliers,
  warehouses,
  existing,
}: {
  suppliers: { id: string; name: string }[];
  warehouses: { id: string; name: string; code: string; status: string }[];
  existing?: Existing;
}) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [supplierId, setSupplierId] = useState(existing?.supplierId ?? '');
  const [warehouseId, setWarehouseId] = useState(existing?.warehouseId ?? warehouses[0]?.id ?? '');
  const [expectedDate, setExpectedDate] = useState(existing?.expectedDate ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [lines, setLines] = useState<Line[]>(existing?.items ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = (s: SkuPick) => {
    if (lines.some((l) => l.productId === s.productId && l.variantId === s.variantId)) return showToast('Already on this order');
    setLines([...lines, { ...s, quantity: '1', unitCost: '' }]);
  };
  const upd = (i: number, k: 'quantity' | 'unitCost', v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const total = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (parseRupeesToPaise(l.unitCost || '0') ?? 0), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const items = lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: Number(l.quantity), unitCostPaise: parseRupeesToPaise(l.unitCost || '') }));
    if (items.some((i) => i.unitCostPaise === null || !Number.isInteger(i.quantity) || i.quantity < 1)) return setError('Enter a quantity and a unit cost for every line');
    setSaving(true);
    try {
      const body = { supplierId, warehouseId, expectedDate, notes, items };
      const r = await api<{ id: string }>(existing ? `/api/admin/purchase-orders/${existing.id}` : '/api/admin/purchase-orders', { method: existing ? 'PATCH' : 'POST', body });
      showToast(existing ? 'Draft updated' : 'Purchase order saved as draft');
      if (existing) router.refresh();
      else router.push(`/purchase-orders/${r.id}`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  if (!suppliers.length || !warehouses.length) {
    return (
      <Panel bodyClassName="p-4 text-xs text-warning bg-warning-soft rounded-xl">
        {!suppliers.length ? 'Add an active supplier first. ' : ''}
        {!warehouses.length ? 'Add a warehouse to receive the goods into first.' : ''}
      </Panel>
    );
  }

  return (
    <Panel title={existing ? 'Edit draft' : undefined} bodyClassName="p-3 sm:p-4">
      <form onSubmit={submit} className="space-y-3 text-xs">
        {error && <p className="rounded-lg bg-danger-soft p-2 text-danger">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Supplier *</label>
            <select className={inputCls} required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Select…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Receiving warehouse *</label>
            <select className={inputCls} required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Expected delivery</label>
            <input type="date" className={inputCls} value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Add products</label>
          <SkuSearch onPick={add} />
        </div>
        {lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead className="text-2xs uppercase text-ink-500">
                <tr>
                  <th className="py-1.5">Item</th>
                  <th className="py-1.5 w-24">Qty</th>
                  <th className="py-1.5 w-32">Unit cost (₹)</th>
                  <th className="py-1.5 w-24 text-right">Line total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {lines.map((l, i) => (
                  <tr key={`${l.productId}:${l.variantId ?? ''}`}>
                    <td className="py-1.5">
                      <p className="font-semibold text-ink">{l.label}</p>
                      <p className="font-mono text-2xs text-ink-400">{l.sku}</p>
                    </td>
                    <td>
                      <input className={inputCls} inputMode="numeric" value={l.quantity} onChange={(e) => upd(i, 'quantity', e.target.value.replace(/\D/g, ''))} />
                    </td>
                    <td>
                      <input className={inputCls} inputMode="decimal" value={l.unitCost} onChange={(e) => upd(i, 'unitCost', e.target.value)} />
                    </td>
                    <td className="text-right">{formatINR((Number(l.quantity) || 0) * (parseRupeesToPaise(l.unitCost || '0') ?? 0))}</td>
                    <td className="text-right">
                      <button type="button" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="p-1 text-ink-400 hover:text-danger">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-right font-bold text-ink">Total {formatINR(total)}</p>
          </div>
        )}
        <div>
          <label className={labelCls}>Notes</label>
          <textarea className={textareaCls} rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="brand" isLoading={saving} disabled={!lines.length || !supplierId}>
            {existing ? 'Save draft' : 'Save as draft'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
