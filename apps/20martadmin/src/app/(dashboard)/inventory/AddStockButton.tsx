'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal } from '@20mart/ui';
import { Plus } from 'lucide-react';
import { api, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { inputCls, labelCls } from '../../../components/ui';

export interface WarehouseOption {
  id: string;
  name: string;
  code: string;
  status: string;
}
export interface SkuPick {
  productId: string;
  variantId: string | null;
  label: string;
  sku: string;
}

/** Search products and resolve to a stock-keeping unit (variant when the product has variants). */
export function SkuSearch({ onPick, autoFocus }: { onPick: (s: SkuPick) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SkuPick[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api<{ items: { id: string; name: string; sku: string }[] }>(`/api/admin/products?q=${encodeURIComponent(q.trim())}&pageSize=6`);
        const expanded = await Promise.all(
          r.items.map(async (p) => {
            const d = await api<{ variants: { id: string; name: string; sku: string; status: string }[] }>(`/api/admin/products/${p.id}`).catch(() => ({ variants: [] }));
            const vs = d.variants.filter((v) => v.status === 'ACTIVE');
            return vs.length
              ? vs.map((v) => ({ productId: p.id, variantId: v.id, label: `${p.name} · ${v.name}`, sku: v.sku }))
              : [{ productId: p.id, variantId: null, label: p.name, sku: p.sku }];
          })
        );
        setResults(expanded.flat());
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-1">
      <input className={inputCls} placeholder="Search product name or SKU…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus} />
      {loading && <p className="text-2xs text-ink-400">Searching…</p>}
      {results.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-line-subtle divide-y divide-line-subtle">
          {results.map((r) => (
            <li key={`${r.productId}:${r.variantId ?? ''}`}>
              <button
                type="button"
                className="w-full text-left px-2.5 py-1.5 hover:bg-brand-orange-50"
                onClick={() => {
                  onPick(r);
                  setQ('');
                  setResults([]);
                }}
              >
                <span className="font-semibold text-ink">{r.label}</span> <span className="font-mono text-2xs text-ink-400">{r.sku}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Record stock for an item at a warehouse where it may not be stocked yet. */
export function AddStockButton({ warehouses, defaultWarehouseId }: { warehouses: WarehouseOption[]; defaultWarehouseId?: string }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ?? warehouses.find((w) => w.status !== 'INACTIVE')?.id ?? '');
  const [sku, setSku] = useState<SkuPick | null>(null);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSku(null);
    setQty('');
    setReason('');
    setReference('');
    setError(null);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku) return setError('Choose a product');
    setSaving(true);
    setError(null);
    try {
      await api('/api/admin/inventory/adjust', {
        body: { warehouseId, productId: sku.productId, variantId: sku.variantId, type: 'STOCK_IN', quantity: Number(qty), reason, reference },
      });
      showToast('Stock recorded and logged');
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  if (!warehouses.length) return null;
  return (
    <>
      <Button size="sm" variant="brand" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setOpen(true)}>
        Add stock
      </Button>
      {open && (
        <Modal isOpen onClose={() => setOpen(false)} title="Add stock at a warehouse" maxWidth="md">
          <form onSubmit={submit} className="space-y-3 text-xs">
            <p className="rounded-lg bg-surface-page p-2 text-ink-600">
              For goods from a supplier, prefer receiving them on a purchase order. Use this for opening stock or stock found during a count.
            </p>
            {error && <p className="rounded-lg bg-danger-soft p-2 text-danger">{error}</p>}
            <div>
              <label className={labelCls}>Warehouse *</label>
              <select className={inputCls} required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                {warehouses
                  .filter((w) => w.status !== 'INACTIVE')
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} · {w.name} ({w.status.toLowerCase()})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Product *</label>
              {sku ? (
                <div className="flex items-center justify-between rounded-lg border border-line p-2">
                  <span>
                    <b>{sku.label}</b> <span className="font-mono text-2xs text-ink-400">{sku.sku}</span>
                  </span>
                  <button type="button" className="text-2xs font-semibold text-brand-orange-600" onClick={() => setSku(null)}>
                    Change
                  </button>
                </div>
              ) : (
                <SkuSearch onPick={setSku} autoFocus />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Quantity *</label>
                <input className={inputCls} inputMode="numeric" required value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div>
                <label className={labelCls}>Reference</label>
                <input className={inputCls} maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Reason *</label>
              <input className={inputCls} required minLength={3} maxLength={300} placeholder="e.g. Opening stock count" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="brand" size="sm" isLoading={saving} disabled={!sku || !qty || Number(qty) < 1 || reason.trim().length < 3}>
                Record stock
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
