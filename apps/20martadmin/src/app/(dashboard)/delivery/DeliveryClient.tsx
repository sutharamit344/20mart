'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@20mart/ui';
import { paiseToRupeeInput, parseRupeesToPaise } from '@20mart/shared';
import { Trash2 } from 'lucide-react';
import { api, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { inputCls, labelCls, Panel, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead, textareaCls } from '../../../components/ui';

interface Settings {
  deliveryEnabled: boolean;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  deliveryFeePaise: number;
  freeDeliveryThresholdPaise: number;
  minOrderPaise: number;
  defaultEstimateHours: number;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  reservationMinutes: number;
  maxQtyPerLine: number;
}

export function DeliverySettingsForm({ initial, onlineConfigured }: { initial: Settings; onlineConfigured: boolean }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [s, setS] = useState(initial);
  const [money, setMoney] = useState({
    deliveryFeePaise: paiseToRupeeInput(initial.deliveryFeePaise),
    freeDeliveryThresholdPaise: paiseToRupeeInput(initial.freeDeliveryThresholdPaise),
    minOrderPaise: paiseToRupeeInput(initial.minOrderPaise),
  });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = Object.fromEntries(Object.entries(money).map(([k, v]) => [k, parseRupeesToPaise(v || '0')]));
    if (Object.values(m).some((v) => v === null)) return showToast('Enter valid rupee amounts');
    setSaving(true);
    try {
      await api('/api/admin/delivery/settings', { method: 'PATCH', body: { ...s, ...m } });
      showToast('Settings saved');
      router.refresh();
    } catch (err) {
      showToast(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (k: 'deliveryEnabled' | 'codEnabled' | 'onlinePaymentEnabled', label: string, hint: string, disabled = false) => (
    <label className={`flex items-start gap-2.5 rounded-lg border border-gray-200 p-2.5 ${disabled ? 'opacity-60' : ''}`}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0B5D3B]" disabled={disabled} checked={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.checked })} />
      <span>
        <span className="block text-xs font-semibold text-gray-900">{label}</span>
        <span className="text-[11px] text-gray-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <Panel title="Delivery & payment settings" bodyClassName="p-3 sm:p-4">
      <form onSubmit={save} className="space-y-3 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {toggle('deliveryEnabled', 'Accept orders for delivery', 'Turn off to pause all new orders.')}
          {toggle('codEnabled', 'Cash on delivery', 'Customers pay when the order arrives.')}
          {toggle(
            'onlinePaymentEnabled',
            'Online payment (Razorpay)',
            onlineConfigured ? 'UPI, cards and net banking.' : 'Pending: Razorpay keys are not configured on the server.',
            !onlineConfigured
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              ['deliveryFeePaise', 'Delivery fee (₹)'],
              ['freeDeliveryThresholdPaise', 'Free delivery from (₹)'],
              ['minOrderPaise', 'Minimum order (₹)'],
            ] as const
          ).map(([k, l]) => (
            <div key={k}>
              <label className={labelCls}>{l}</label>
              <input className={inputCls} inputMode="decimal" value={money[k]} onChange={(e) => setMoney({ ...money, [k]: e.target.value })} />
            </div>
          ))}
          <div>
            <label className={labelCls}>Default delivery estimate (hours)</label>
            <input className={inputCls} type="number" min={1} value={s.defaultEstimateHours} onChange={(e) => setS({ ...s, defaultEstimateHours: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Opens (IST)</label>
            <input className={inputCls} type="time" value={s.operatingHoursStart} onChange={(e) => setS({ ...s, operatingHoursStart: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Closes (IST)</label>
            <input className={inputCls} type="time" value={s.operatingHoursEnd} onChange={(e) => setS({ ...s, operatingHoursEnd: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Online payment window (min)</label>
            <input className={inputCls} type="number" min={5} max={1440} value={s.reservationMinutes} onChange={(e) => setS({ ...s, reservationMinutes: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Max quantity per item</label>
            <input className={inputCls} type="number" min={1} max={100} value={s.maxQtyPerLine} onChange={(e) => setS({ ...s, maxQtyPerLine: Number(e.target.value) })} />
          </div>
        </div>
        <p className="text-[11px] text-gray-500">
          Delivery estimates shown to customers come only from these hours. Set 24 or less only where you can actually deliver within a day.
        </p>
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="brand" isLoading={saving}>
            Save settings
          </Button>
        </div>
      </form>
    </Panel>
  );
}

interface Pin {
  id: string;
  pincode: string;
  isServiceable: boolean;
  area: string | null;
  city: string | null;
  deliveryFeePaise: number | null;
  estimateHours: number | null;
}

export function PincodeManager({ items, total, q }: { items: Pin[]; total: number; q: string }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [bulk, setBulk] = useState('');
  const [city, setCity] = useState('Ahmedabad');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(q);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      showToast(ok);
      router.refresh();
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const pins = bulk.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);

  return (
    <Panel title={`Delivery PIN codes (${total})`} bodyClassName="">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-gray-100 p-3 sm:p-4 text-xs">
        <div className="md:col-span-2">
          <label className={labelCls}>Add or update PIN codes (comma or newline separated)</label>
          <textarea className={textareaCls} rows={2} placeholder="380015, 380054, 380059" value={bulk} onChange={(e) => setBulk(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div>
            <label className={labelCls}>City</label>
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="brand" isLoading={busy} disabled={!pins.length} onClick={() => run(() => api('/api/admin/delivery/pincodes/bulk', { body: { pincodes: pins, isServiceable: true, city } }), `${pins.length} PIN code(s) marked serviceable`).then(() => setBulk(''))}>
              Serviceable
            </Button>
            <Button size="sm" variant="outline" isLoading={busy} disabled={!pins.length} onClick={() => run(() => api('/api/admin/delivery/pincodes/bulk', { body: { pincodes: pins, isServiceable: false, city } }), `${pins.length} PIN code(s) blocked`).then(() => setBulk(''))}>
              Not serviceable
            </Button>
          </div>
        </div>
      </div>
      <form
        className="flex gap-2 px-3 sm:px-4 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          router.replace(search ? `/delivery?q=${encodeURIComponent(search)}` : '/delivery');
        }}
      >
        <input className={inputCls} placeholder="Search PIN or area…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="submit" size="sm" variant="outline">
          Search
        </Button>
      </form>
      <Table minWidth={560}>
        <THead>
          <Th>PIN</Th>
          <Th>Area</Th>
          <Th>Status</Th>
          <Th className="text-right">Fee override</Th>
          <Th className="text-right">Estimate</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {items.length === 0 && <TableEmpty colSpan={6} title="No PIN codes configured" description="Customers cannot order until at least one serviceable PIN code is added." />}
          {items.map((p) => (
            <tr key={p.id}>
              <Td className="font-mono font-bold text-gray-900">{p.pincode}</Td>
              <Td>{[p.area, p.city].filter(Boolean).join(', ') || <span className="text-gray-300">—</span>}</Td>
              <Td>
                <StatusBadge status={p.isServiceable ? 'ACTIVE' : 'OUT'} label={p.isServiceable ? 'Serviceable' : 'Blocked'} />
              </Td>
              <Td className="text-right">{p.deliveryFeePaise !== null ? `₹${paiseToRupeeInput(p.deliveryFeePaise)}` : <span className="text-gray-300">default</span>}</Td>
              <Td className="text-right">{p.estimateHours ? `${p.estimateHours}h` : <span className="text-gray-300">default</span>}</Td>
              <Td className="text-right whitespace-nowrap">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => api('/api/admin/delivery/pincodes', { body: { pincode: p.pincode, isServiceable: !p.isServiceable, area: p.area, city: p.city } }), 'PIN code updated')}
                  className="mr-1 rounded px-1.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100"
                >
                  {p.isServiceable ? 'Block' : 'Allow'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Remove ${p.pincode}`}
                  onClick={() => run(() => api(`/api/admin/delivery/pincodes/${p.pincode}`, { method: 'DELETE' }), 'PIN code removed')}
                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>
    </Panel>
  );
}
