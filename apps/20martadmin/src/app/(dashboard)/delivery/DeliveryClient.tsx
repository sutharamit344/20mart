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
    <label className={`flex items-start gap-2.5 rounded-lg border border-line p-2.5 ${disabled ? 'opacity-60' : ''}`}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-green" disabled={disabled} checked={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.checked })} />
      <span>
        <span className="block text-xs font-semibold text-ink">{label}</span>
        <span className="text-2xs text-ink-500">{hint}</span>
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
        <p className="text-2xs text-ink-500">
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
  zone?: { id: string; name: string } | null;
}

export interface Zone {
  id: string;
  name: string;
  isActive: boolean;
  deliveryFeePaise: number | null;
  estimateHours: number | null;
  minOrderPaise: number | null;
  pincodeCount: number;
}

export function PincodeManager({ items, total, q, zones }: { items: Pin[]; total: number; q: string; zones: Zone[] }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [bulk, setBulk] = useState('');
  const [city, setCity] = useState('Ahmedabad');
  const [zoneId, setZoneId] = useState('');
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-line-subtle p-3 sm:p-4 text-xs">
        <div className="md:col-span-2">
          <label className={labelCls}>Add or update PIN codes (comma or newline separated)</label>
          <textarea className={textareaCls} rows={2} placeholder="380015, 380054, 380059" value={bulk} onChange={(e) => setBulk(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div>
            <label className={labelCls}>City</label>
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Zone</label>
            <select className={inputCls} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">No delivery area (not deliverable)</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="brand" isLoading={busy} disabled={!pins.length} onClick={() => run(() => api('/api/admin/delivery/pincodes/bulk', { body: { pincodes: pins, isServiceable: true, city, zoneId: zoneId || null } }), `${pins.length} PIN code(s) marked serviceable`).then(() => setBulk(''))}>
              Serviceable
            </Button>
            <Button size="sm" variant="outline" isLoading={busy} disabled={!pins.length} onClick={() => run(() => api('/api/admin/delivery/pincodes/bulk', { body: { pincodes: pins, isServiceable: false, city, zoneId: zoneId || null } }), `${pins.length} PIN code(s) blocked`).then(() => setBulk(''))}>
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
          <Th>Zone</Th>
          <Th>Status</Th>
          <Th className="text-right">Fee override</Th>
          <Th className="text-right">Estimate</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {items.length === 0 && <TableEmpty colSpan={7} title="No PIN codes configured" description="Customers cannot order until at least one serviceable PIN code is added." />}
          {items.map((p) => (
            <tr key={p.id}>
              <Td className="font-mono font-bold text-ink">{p.pincode}</Td>
              <Td>{[p.area, p.city].filter(Boolean).join(', ') || <span className="text-ink-400">—</span>}</Td>
              <Td>
                <select
                  aria-label={`Zone for ${p.pincode}`}
                  className="h-7 rounded-md border border-line bg-surface px-1.5 text-2xs"
                  value={p.zone?.id ?? ''}
                  disabled={busy}
                  onChange={(e) => run(() => api('/api/admin/delivery/pincodes', { body: { pincode: p.pincode, isServiceable: p.isServiceable, area: p.area, city: p.city, deliveryFeePaise: p.deliveryFeePaise, estimateHours: p.estimateHours, zoneId: e.target.value || null } }), 'Zone updated')}
                >
                  <option value="">— none —</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </Td>
              <Td>
                <StatusBadge status={p.isServiceable ? 'ACTIVE' : 'OUT'} label={p.isServiceable ? 'Serviceable' : 'Blocked'} />
              </Td>
              <Td className="text-right">{p.deliveryFeePaise !== null ? `₹${paiseToRupeeInput(p.deliveryFeePaise)}` : <span className="text-ink-400">default</span>}</Td>
              <Td className="text-right">{p.estimateHours ? `${p.estimateHours}h` : <span className="text-ink-400">default</span>}</Td>
              <Td className="text-right whitespace-nowrap">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => api('/api/admin/delivery/pincodes', { body: { pincode: p.pincode, isServiceable: !p.isServiceable, area: p.area, city: p.city, deliveryFeePaise: p.deliveryFeePaise, estimateHours: p.estimateHours } }), 'PIN code updated')}
                  className="mr-1 rounded px-1.5 py-1 text-2xs font-semibold text-ink-600 hover:bg-surface-muted"
                >
                  {p.isServiceable ? 'Block' : 'Allow'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Remove ${p.pincode}`}
                  onClick={() => run(() => api(`/api/admin/delivery/pincodes/${p.pincode}`, { method: 'DELETE' }), 'PIN code removed')}
                  className="rounded p-1.5 text-ink-400 hover:bg-danger-soft hover:text-danger"
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

export function ZoneManager({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Zone | 'new' | null>(null);
  const [f, setF] = useState({ name: '', isActive: true, fee: '', hours: '', min: '' });
  const open = (z: Zone | 'new') => {
    setEdit(z);
    setF(
      z === 'new'
        ? { name: '', isActive: true, fee: '', hours: '', min: '' }
        : { name: z.name, isActive: z.isActive, fee: z.deliveryFeePaise != null ? paiseToRupeeInput(z.deliveryFeePaise) : '', hours: z.estimateHours ? String(z.estimateHours) : '', min: z.minOrderPaise != null ? paiseToRupeeInput(z.minOrderPaise) : '' }
    );
  };
  const save = async () => {
    const fee = f.fee ? parseRupeesToPaise(f.fee) : null;
    const min = f.min ? parseRupeesToPaise(f.min) : null;
    if ((f.fee && fee == null) || (f.min && min == null)) return showToast('Enter amounts in rupees');
    const body = { name: f.name, isActive: f.isActive, deliveryFeePaise: fee, minOrderPaise: min, estimateHours: f.hours ? Number(f.hours) : null };
    setBusy(true);
    try {
      if (edit === 'new') await api('/api/admin/delivery/zones', { body });
      else if (edit) await api(`/api/admin/delivery/zones/${edit.id}`, { method: 'PATCH', body });
      showToast('Zone saved');
      setEdit(null);
      router.refresh();
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (z: Zone) => {
    if (!window.confirm(`Delete zone ${z.name}? Its ${z.pincodeCount} PIN code(s) become undeliverable until assigned to another area, and warehouse mappings to it are removed.`)) return;
    setBusy(true);
    try {
      await api(`/api/admin/delivery/zones/${z.id}`, { method: 'DELETE' });
      showToast('Zone deleted');
      router.refresh();
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const dflt = <span className="text-ink-400">default</span>;
  return (
    <Panel
      title={`Delivery zones (${zones.length})`}
      actions={
        <Button size="sm" variant="outline" onClick={() => open('new')}>
          Add zone
        </Button>
      }
    >
      <p className="px-4 pt-2 text-2xs text-ink-500">
        A zone groups PIN codes with a shared fee, estimate and minimum order. A PIN&apos;s own override wins over its zone; pausing a zone stops orders to all its PINs.
      </p>
      {edit && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 border-b border-line-subtle p-3 text-xs items-end">
          <div className="col-span-2">
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Fee (₹)</label>
            <input className={inputCls} inputMode="decimal" placeholder="default" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Estimate (hours)</label>
            <input className={inputCls} type="number" min={1} placeholder="default" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Min order (₹)</label>
            <input className={inputCls} inputMode="decimal" placeholder="default" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />
          </div>
          <label className="flex h-9 items-center gap-1.5 font-semibold">
            <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Active
          </label>
          <div className="col-span-2 md:col-span-6 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button size="sm" variant="brand" isLoading={busy} disabled={f.name.trim().length < 2} onClick={save}>
              Save zone
            </Button>
          </div>
        </div>
      )}
      <Table minWidth={560}>
        <THead>
          <Th>Zone</Th>
          <Th className="text-right">PINs</Th>
          <Th className="text-right">Fee</Th>
          <Th className="text-right">Estimate</Th>
          <Th className="text-right">Min order</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {zones.length === 0 && <TableEmpty colSpan={7} title="No delivery areas" description="Create an area, assign PIN codes to it, then map a warehouse to it on the Warehouses page. PIN codes without an area cannot be delivered to." />}
          {zones.map((z) => (
            <tr key={z.id}>
              <Td className="font-semibold text-ink">{z.name}</Td>
              <Td className="text-right tabular-nums">{z.pincodeCount}</Td>
              <Td className="text-right">{z.deliveryFeePaise != null ? `₹${paiseToRupeeInput(z.deliveryFeePaise)}` : dflt}</Td>
              <Td className="text-right">{z.estimateHours ? `${z.estimateHours}h` : dflt}</Td>
              <Td className="text-right">{z.minOrderPaise != null ? `₹${paiseToRupeeInput(z.minOrderPaise)}` : dflt}</Td>
              <Td>
                <StatusBadge status={z.isActive ? 'ACTIVE' : 'OUT'} label={z.isActive ? 'Active' : 'Paused'} />
              </Td>
              <Td className="text-right whitespace-nowrap">
                <button type="button" disabled={busy} onClick={() => open(z)} className="mr-1 rounded px-1.5 py-1 text-2xs font-semibold text-ink-600 hover:bg-surface-muted">
                  Edit
                </button>
                <button type="button" disabled={busy} aria-label={`Delete zone ${z.name}`} onClick={() => remove(z)} className="rounded p-1.5 text-ink-400 hover:bg-danger-soft hover:text-danger">
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
