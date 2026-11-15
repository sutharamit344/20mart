'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { SavedAddress } from '@20mart/shared';
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { AccountLayout } from '../../../components/AccountLayout';
import { AddressForm } from '../../../components/AddressForm';
import { storeApi, useStore } from '../../../lib/store';

export default function AddressBookPage() {
  const { showToast } = useStore();
  const [items, setItems] = useState<SavedAddress[] | null>(null);
  const [editing, setEditing] = useState<SavedAddress | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await storeApi<{ items: SavedAddress[] }>('/api/account/addresses')).items);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load addresses');
      setItems([]);
    }
  }, [showToast]);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      showToast(ok);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  return (
    <AccountLayout title="My Addresses" subtitle="Saved delivery addresses. Past orders keep their own copy." activeKey="addresses">
      {editing ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-xs">
          <h2 className="mb-2.5 text-sm font-bold text-gray-900">{editing === 'new' ? 'Add address' : 'Edit address'}</h2>
          <AddressForm
            address={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              showToast('Address saved');
              void load();
            }}
          />
        </div>
      ) : items === null ? (
        <div className="flex items-center justify-center py-12 text-xs text-gray-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
              <MapPin className="mx-auto mb-2 h-7 w-7 text-gray-300" />
              <p className="text-sm font-bold text-gray-900">No saved addresses</p>
            </div>
          )}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {items.map((a) => (
              <li key={a.id} className={`rounded-2xl border bg-white p-3 text-xs shadow-xs ${a.isDefault ? 'border-[#FF7A00]/50' : 'border-gray-100'} ${busy === a.id ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-900">{a.name}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-500">{a.type}</span>
                  {a.isDefault && <span className="text-[9px] font-bold uppercase text-[#0B5D3B]">Default</span>}
                </div>
                <p className="mt-1 leading-relaxed text-gray-600">
                  {a.addressLine1}
                  {a.addressLine2 ? `, ${a.addressLine2}` : ''}
                  {a.landmark ? `, near ${a.landmark}` : ''}, {a.city}, {a.state} – {a.pincode}
                </p>
                <p className="text-gray-500">+91 {a.phone}</p>
                <div className="mt-2 flex items-center gap-3 border-t border-gray-100 pt-2 font-semibold">
                  <button type="button" onClick={() => setEditing(a)} className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  {!a.isDefault && (
                    <button type="button" disabled={!!busy} onClick={() => act(a.id, () => storeApi(`/api/account/addresses/${a.id}/default`, { body: {} }), 'Default address updated')} className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900">
                      <Star className="h-3 w-3" /> Make default
                    </button>
                  )}
                  <button type="button" disabled={!!busy} onClick={() => act(a.id, () => storeApi(`/api/account/addresses/${a.id}`, { method: 'DELETE' }), 'Address removed')} className="ml-auto inline-flex items-center gap-1 text-red-600">
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setEditing('new')} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#FF7A00] px-4 text-xs font-bold text-white">
            <Plus className="h-3.5 w-3.5" /> Add new address
          </button>
        </div>
      )}
    </AccountLayout>
  );
}
