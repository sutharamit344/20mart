'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal } from '@20mart/ui';
import { Pencil, Plus } from 'lucide-react';
import { api, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { inputCls, labelCls, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead, textareaCls } from '../../../components/ui';

interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  gstin: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  notes: string | null;
  _count: { purchaseOrders: number };
}

const FIELDS = ['name', 'contactPerson', 'phone', 'email', 'address', 'city', 'state', 'pinCode', 'gstin', 'status', 'notes'] as const;
type Form = Record<(typeof FIELDS)[number], string>;

function SupplierModal({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [f, setF] = useState<Form>(Object.fromEntries(FIELDS.map((k) => [k, supplier ? String(supplier[k] ?? '') : k === 'status' ? 'ACTIVE' : ''])) as Form);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const input = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className={labelCls}>{label}</label>
      <input className={inputCls} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
      {errors[k] && <p className="mt-0.5 text-2xs text-danger">{errors[k][0]}</p>}
    </div>
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api(supplier ? `/api/admin/suppliers/${supplier.id}` : '/api/admin/suppliers', { method: supplier ? 'PATCH' : 'POST', body: f });
      showToast(supplier ? 'Supplier updated' : 'Supplier added');
      onClose();
      router.refresh();
    } catch (err) {
      setErrors((err as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {});
      showToast(errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal isOpen onClose={onClose} title={supplier ? 'Edit supplier' : 'New supplier'} maxWidth="lg">
      <form onSubmit={submit} className="space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {input('name', 'Name *', { required: true, maxLength: 120 })}
          {input('contactPerson', 'Contact person')}
          {input('phone', 'Phone', { inputMode: 'tel' })}
          {input('email', 'Email', { type: 'email' })}
        </div>
        {input('address', 'Address')}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {input('city', 'City')}
          {input('state', 'State')}
          {input('pinCode', 'PIN code', { inputMode: 'numeric', maxLength: 6 })}
          {input('gstin', 'GSTIN (optional)', { maxLength: 15 })}
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive (no new purchase orders)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea className={textareaCls} rows={2} maxLength={1000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" variant="brand" isLoading={saving}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function SuppliersClient({ items, canManage }: { items: Supplier[]; canManage: boolean }) {
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  return (
    <>
      {canManage && (
        <div className="flex justify-end p-3 border-b border-line-subtle">
          <Button size="sm" variant="brand" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditing('new')}>
            Add supplier
          </Button>
        </div>
      )}
      <Table minWidth={760}>
        <THead>
          <Th>Supplier</Th>
          <Th>Contact</Th>
          <Th>Location</Th>
          <Th>GSTIN</Th>
          <Th className="text-right">POs</Th>
          <Th>Status</Th>
          <Th />
        </THead>
        <TBody>
          {items.length === 0 && <TableEmpty colSpan={7} title="No suppliers yet" description="Add the vendors you buy stock from." />}
          {items.map((s) => (
            <tr key={s.id}>
              <Td className="font-semibold text-ink">{s.name}</Td>
              <Td>
                <p>{s.contactPerson ?? '—'}</p>
                <p className="text-2xs text-ink-400">{[s.phone, s.email].filter(Boolean).join(' · ')}</p>
              </Td>
              <Td>{[s.city, s.state, s.pinCode].filter(Boolean).join(', ') || '—'}</Td>
              <Td className="font-mono text-2xs">{s.gstin ?? '—'}</Td>
              <Td className="text-right">{s._count.purchaseOrders}</Td>
              <Td>
                <StatusBadge status={s.status} />
              </Td>
              <Td className="text-right">
                {canManage && (
                  <button type="button" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)} className="p-1 text-ink-400 hover:text-ink-700">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>
      {editing && <SupplierModal supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
