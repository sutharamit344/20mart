'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@20mart/ui';
import { paiseToRupeeInput, parseRupeesToPaise } from '@20mart/shared';
import { MapPin, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { api, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { formatINR, inputCls, labelCls, Panel, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead, textareaCls } from '../../../components/ui';

type Status = 'SETUP' | 'ACTIVE' | 'PAUSED' | 'INACTIVE';
interface Mapping {
  id: string;
  priority: number;
  deliveryFeePaise: number | null;
  estimateHours: number | null;
  cutoffTime: string | null;
  isActive: boolean;
  zone: { id: string; name: string; isActive: boolean };
}
interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  type: string;
  status: Status;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  latitude: string | null;
  longitude: string | null;
  contactName: string | null;
  contactNumber: string | null;
  dailyOrderCapacity: number | null;
  notes: string | null;
  deliveryZones: Mapping[];
  stock: { onHand: number; reserved: number; sellable: number; skus: number; outOfStock: number };
  openOrders: number;
}
interface Zone {
  id: string;
  name: string;
  isActive: boolean;
  pincodeCount: number;
}

const TYPES = [
  ['WAREHOUSE', 'Warehouse'],
  ['FULFILLMENT_CENTER', 'Fulfilment centre'],
  ['STORAGE', 'Storage location'],
  ['SUPPLIER_DISPATCH', 'Approved supplier dispatch'],
] as const;

const EMPTY = {
  name: '',
  code: '',
  type: 'WAREHOUSE',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: 'IN',
  pinCode: '',
  latitude: '',
  longitude: '',
  contactName: '',
  contactNumber: '',
  dailyOrderCapacity: '',
  notes: '',
};
type Form = typeof EMPTY;

function WarehouseForm({ initial, id, onDone }: { initial: Form; id: string | null; onDone: () => void }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [f, setF] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api(id ? `/api/admin/warehouses/${id}` : '/api/admin/warehouses', { method: id ? 'PATCH' : 'POST', body: f });
      showToast(id ? 'Warehouse updated' : 'Warehouse created (status: Setup)');
      onDone();
      router.refresh();
    } catch (err) {
      setErrors((err as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {});
      showToast(errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  const field = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className={labelCls} htmlFor={`wh-${k}`}>
        {label}
      </label>
      <input id={`wh-${k}`} className={inputCls} value={f[k]} onChange={set(k)} {...props} />
      {errors[k] && <p className="mt-0.5 text-[10px] text-red-600">{errors[k][0]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-3 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {field('name', 'Name *', { required: true, maxLength: 80 })}
        {field('code', 'Code * (e.g. AMD-01)', { required: true, maxLength: 20 })}
        <div>
          <label className={labelCls} htmlFor="wh-type">
            Type
          </label>
          <select id="wh-type" className={inputCls} value={f.type} onChange={set('type')}>
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field('addressLine1', 'Address line 1 *', { required: true })}
        {field('addressLine2', 'Address line 2')}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {field('city', 'City *', { required: true })}
        {field('state', 'State *', { required: true })}
        {field('pinCode', 'PIN code *', { required: true, inputMode: 'numeric', maxLength: 6 })}
        {field('country', 'Country', { maxLength: 2 })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {field('latitude', 'Latitude', { inputMode: 'decimal' })}
        {field('longitude', 'Longitude', { inputMode: 'decimal' })}
        {field('contactName', 'Contact person')}
        {field('contactNumber', 'Contact number', { inputMode: 'tel' })}
        {field('dailyOrderCapacity', 'Max orders / day', { inputMode: 'numeric' })}
      </div>
      <div>
        <label className={labelCls} htmlFor="wh-notes">
          Notes
        </label>
        <textarea id="wh-notes" className={textareaCls} rows={2} value={f.notes} onChange={set('notes')} maxLength={500} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Saving…' : id ? 'Save changes' : 'Create warehouse'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function MappingForm({ warehouseId, zones, existing, onDone }: { warehouseId: string; zones: Zone[]; existing?: Mapping; onDone: () => void }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [m, setM] = useState({
    zoneId: existing?.zone.id ?? '',
    priority: String(existing?.priority ?? 1),
    fee: existing?.deliveryFeePaise != null ? paiseToRupeeInput(existing.deliveryFeePaise) : '',
    estimateHours: existing?.estimateHours != null ? String(existing.estimateHours) : '',
    cutoffTime: existing?.cutoffTime ?? '',
    isActive: existing?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fee = m.fee.trim() === '' ? null : parseRupeesToPaise(m.fee);
    if (m.fee.trim() !== '' && fee === null) return showToast('Enter a valid fee in rupees');
    setSaving(true);
    try {
      await api(`/api/admin/warehouses/${warehouseId}/zones`, {
        body: { zoneId: m.zoneId, priority: m.priority, deliveryFeePaise: fee, estimateHours: m.estimateHours, cutoffTime: m.cutoffTime, isActive: m.isActive },
      });
      showToast('Delivery area saved');
      onDone();
      router.refresh();
    } catch (err) {
      showToast(errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-7 gap-2 items-end text-xs p-3 bg-gray-50 rounded-lg">
      <div className="col-span-2">
        <label className={labelCls}>Delivery area</label>
        <select className={inputCls} required value={m.zoneId} disabled={!!existing} onChange={(e) => setM({ ...m, zoneId: e.target.value })}>
          <option value="">Select…</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name} ({z.pincodeCount} PIN{z.pincodeCount === 1 ? '' : 's'}){z.isActive ? '' : ' — paused'}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} title="Lower = tried first">
          Priority
        </label>
        <input className={inputCls} inputMode="numeric" value={m.priority} onChange={(e) => setM({ ...m, priority: e.target.value })} />
      </div>
      <div>
        <label className={labelCls}>Fee override ₹</label>
        <input className={inputCls} placeholder="area default" value={m.fee} onChange={(e) => setM({ ...m, fee: e.target.value })} />
      </div>
      <div>
        <label className={labelCls}>Estimate (hours)</label>
        <input className={inputCls} placeholder="area default" inputMode="numeric" value={m.estimateHours} onChange={(e) => setM({ ...m, estimateHours: e.target.value })} />
      </div>
      <div>
        <label className={labelCls}>Order cut-off</label>
        <input className={inputCls} type="time" value={m.cutoffTime} onChange={(e) => setM({ ...m, cutoffTime: e.target.value })} />
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-[11px] font-semibold">
          <input type="checkbox" className="accent-[#0B5D3B]" checked={m.isActive} onChange={(e) => setM({ ...m, isActive: e.target.checked })} /> Active
        </label>
        <Button type="submit" size="sm" disabled={saving}>
          Save
        </Button>
        <button type="button" className="text-[11px] text-gray-500" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const NEXT_ACTIONS: Record<Status, { to: Status; label: string; danger?: boolean }[]> = {
  SETUP: [{ to: 'ACTIVE', label: 'Activate' }, { to: 'INACTIVE', label: 'Deactivate', danger: true }],
  ACTIVE: [{ to: 'PAUSED', label: 'Pause new orders' }, { to: 'INACTIVE', label: 'Deactivate', danger: true }],
  PAUSED: [{ to: 'ACTIVE', label: 'Resume' }, { to: 'INACTIVE', label: 'Deactivate', danger: true }],
  INACTIVE: [{ to: 'SETUP', label: 'Reopen (setup)' }],
};

function WarehouseCard({ w, zones, perms }: { w: WarehouseRow; zones: Zone[]; perms: { manage: boolean; mapZones: boolean } }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [mapping, setMapping] = useState<Mapping | 'new' | null>(null);
  const n = (v: number) => v.toLocaleString('en-IN');

  const setStatus = async (to: Status, danger?: boolean) => {
    if (danger && !confirm(`Deactivate ${w.code}? It will stop serving customers. Stock and history are kept.`)) return;
    try {
      await api(`/api/admin/warehouses/${w.id}/status`, { body: { status: to } });
      showToast(`${w.code} is now ${to.toLowerCase()}`);
      router.refresh();
    } catch (err) {
      showToast(errMsg(err));
    }
  };
  const removeMapping = async (m: Mapping) => {
    if (!confirm(`Stop serving ${m.zone.name} from ${w.code}?`)) return;
    try {
      await api(`/api/admin/warehouses/${w.id}/zones/${m.id}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      showToast(errMsg(err));
    }
  };
  const unmapped = zones.filter((z) => !w.deliveryZones.some((m) => m.zone.id === z.id));

  return (
    <Panel
      title={
        <span className="flex flex-wrap items-center gap-2">
          {w.name} <span className="font-mono text-[11px] text-gray-500">{w.code}</span> <StatusBadge status={w.status} />
        </span>
      }
      actions={
        perms.manage && !editing ? (
          <div className="flex flex-wrap gap-1.5">
            {NEXT_ACTIONS[w.status].map((a) => (
              <button
                key={a.to}
                type="button"
                onClick={() => setStatus(a.to, a.danger)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ${a.danger ? 'text-red-600 ring-red-200 hover:bg-red-50' : 'text-[#0B5D3B] ring-emerald-200 hover:bg-emerald-50'}`}
              >
                {a.label}
              </button>
            ))}
            <button type="button" onClick={() => setEditing(true)} className="rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ring-gray-200 hover:bg-gray-50 inline-flex items-center gap-1">
              <Pencil className="w-3 h-3" /> Edit
            </button>
          </div>
        ) : null
      }
      bodyClassName="p-3 sm:p-4 space-y-3"
    >
      {editing ? (
        <WarehouseForm
          id={w.id}
          initial={Object.fromEntries(Object.keys(EMPTY).map((k) => [k, String((w as unknown as Record<string, unknown>)[k] ?? '')])) as Form}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          {w.status === 'SETUP' && (
            <p className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
              Setup: this location does not serve customers yet. Check its address, add stock, map delivery areas, then activate it.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1 text-gray-600">
              <p className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 mt-px shrink-0" />
                <span>
                  {w.addressLine1}
                  {w.addressLine2 ? `, ${w.addressLine2}` : ''}, {w.city}, {w.state} {w.pinCode}
                </span>
              </p>
              {(w.contactName || w.contactNumber) && (
                <p className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {[w.contactName, w.contactNumber].filter(Boolean).join(' · ')}
                </p>
              )}
              <p>
                {TYPES.find((t) => t[0] === w.type)?.[1]}
                {w.dailyOrderCapacity ? ` · up to ${w.dailyOrderCapacity} orders/day` : ''}
              </p>
            </div>
            <div className="md:col-span-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                ['On hand', n(w.stock.onHand)],
                ['Reserved', n(w.stock.reserved)],
                ['Sellable', n(w.stock.sellable)],
                ['Out of stock', `${n(w.stock.outOfStock)} / ${n(w.stock.skus)}`],
                ['Open orders', n(w.openOrders)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-gray-50 p-2">
                  <p className="text-[10px] text-gray-500">{l}</p>
                  <p className="text-sm font-bold text-gray-900">{v}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 text-[11px] font-semibold">
            <Link className="text-[#E66E00] hover:underline" href={`/inventory?warehouseId=${w.id}`}>
              View stock →
            </Link>
            <Link className="text-[#E66E00] hover:underline" href={`/orders?warehouseId=${w.id}`}>
              Orders →
            </Link>
          </div>
        </>
      )}

      <div className="rounded-lg border border-gray-100">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-800">Delivery areas served</p>
          {perms.mapZones && mapping === null && unmapped.length > 0 && (
            <button type="button" onClick={() => setMapping('new')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E66E00]">
              <Plus className="w-3 h-3" /> Add area
            </button>
          )}
        </div>
        {mapping && (
          <MappingForm warehouseId={w.id} zones={mapping === 'new' ? unmapped : zones} existing={mapping === 'new' ? undefined : mapping} onDone={() => setMapping(null)} />
        )}
        <Table minWidth={560}>
          <THead>
            <Th>Area</Th>
            <Th>Priority</Th>
            <Th>Fee</Th>
            <Th>Estimate</Th>
            <Th>Cut-off</Th>
            <Th>Status</Th>
            <Th />
          </THead>
          <TBody>
            {w.deliveryZones.length === 0 ? (
              <TableEmpty colSpan={7} title="Not mapped to any delivery area" description="Customers cannot be served from this location until an area is mapped." />
            ) : (
              w.deliveryZones.map((m) => (
                <tr key={m.id}>
                  <Td className="font-semibold text-gray-900">{m.zone.name}</Td>
                  <Td>{m.priority}</Td>
                  <Td>{m.deliveryFeePaise != null ? formatINR(m.deliveryFeePaise) : <span className="text-gray-400">area default</span>}</Td>
                  <Td>{m.estimateHours != null ? `${m.estimateHours} h` : <span className="text-gray-400">area default</span>}</Td>
                  <Td>{m.cutoffTime ?? '—'}</Td>
                  <Td>
                    <StatusBadge status={m.isActive && m.zone.isActive ? 'ACTIVE' : 'INACTIVE'} label={!m.zone.isActive ? 'Area paused' : m.isActive ? 'Active' : 'Off'} />
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {perms.mapZones && (
                      <>
                        <button type="button" aria-label="Edit mapping" onClick={() => setMapping(m)} className="p-1 text-gray-400 hover:text-gray-700">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" aria-label="Remove mapping" onClick={() => removeMapping(m)} className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </Panel>
  );
}

export function WarehousesClient({ warehouses, zones, perms }: { warehouses: WarehouseRow[]; zones: Zone[]; perms: { manage: boolean; mapZones: boolean } }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-3">
      {perms.manage &&
        (creating ? (
          <Panel title="New warehouse" bodyClassName="p-3 sm:p-4">
            <WarehouseForm id={null} initial={EMPTY} onDone={() => setCreating(false)} />
          </Panel>
        ) : (
          <div className="flex justify-end">
            <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreating(true)}>
              Add warehouse
            </Button>
          </div>
        ))}
      {zones.length === 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          No delivery areas yet. Create one under <Link href="/delivery" className="font-bold underline">Delivery &amp; Payments</Link> and assign PIN codes to it, then map it here.
        </p>
      )}
      {warehouses.length === 0 ? (
        <Panel bodyClassName="p-8 text-center text-xs text-gray-500">No warehouses yet. Add your real fulfilment location to start serving customers.</Panel>
      ) : (
        warehouses.map((w) => <WarehouseCard key={w.id} w={w} zones={zones} perms={perms} />)
      )}
    </div>
  );
}
