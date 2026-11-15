'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@20mart/ui';
import { INDIAN_STATE_NAMES, type SavedAddress } from '@20mart/shared';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { StoreApiError, storeApi } from '../lib/store';

const field =
  'w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/15 focus:outline-none';
const label = 'block text-[11px] font-bold text-gray-700 mb-1';

interface Serviceability {
  serviceable: boolean;
  reason?: string;
  estimateText: string | null;
}

/** Create or edit a saved address. Validation is repeated on the server (Indian phone / PIN / state). */
export function AddressForm({
  address,
  onSaved,
  onCancel,
}: {
  address?: SavedAddress | null;
  onSaved: (a: SavedAddress) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState({
    name: address?.name ?? '',
    phone: address?.phone ?? '',
    addressLine1: address?.addressLine1 ?? '',
    addressLine2: address?.addressLine2 ?? '',
    landmark: address?.landmark ?? '',
    city: address?.city ?? 'Ahmedabad',
    state: address?.state ?? 'Gujarat',
    pincode: address?.pincode ?? '',
    type: (address?.type as 'Home' | 'Work' | 'Other') ?? 'Home',
    isDefault: address?.isDefault ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [service, setService] = useState<Serviceability | 'checking' | null>(null);

  // Live PIN code serviceability (debounced).
  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(form.pincode)) {
      setService(null);
      return;
    }
    setService('checking');
    const t = setTimeout(() => {
      storeApi<Serviceability>(`/api/delivery/check?pincode=${form.pincode}`)
        .then(setService)
        .catch(() => setService(null));
    }, 350);
    return () => clearTimeout(t);
  }, [form.pincode]);

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      const saved = address
        ? await storeApi<SavedAddress>(`/api/account/addresses/${address.id}`, { method: 'PATCH', body: form })
        : await storeApi<SavedAddress>('/api/account/addresses', { body: form });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save address');
      if (err instanceof StoreApiError) setErrors(err.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  const fe = (k: string) => errors[k]?.[0] && <p className="mt-0.5 text-[11px] font-medium text-red-600">{errors[k][0]}</p>;

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-2.5 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="af-name" className={label}>Full name *</label>
          <input id="af-name" className={field} autoComplete="name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
          {fe('name')}
        </div>
        <div>
          <label htmlFor="af-phone" className={label}>Mobile number *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">+91</span>
            <input
              id="af-phone"
              className={`${field} pl-11`}
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              required
              value={form.phone}
              onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))}
            />
          </div>
          {fe('phone')}
        </div>
      </div>
      <div>
        <label htmlFor="af-l1" className={label}>House / flat, building, street *</label>
        <input id="af-l1" className={field} autoComplete="address-line1" required value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} />
        {fe('addressLine1')}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="af-l2" className={label}>Area / locality</label>
          <input id="af-l2" className={field} autoComplete="address-line2" value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} />
        </div>
        <div>
          <label htmlFor="af-lm" className={label}>Landmark</label>
          <input id="af-lm" className={field} value={form.landmark} onChange={(e) => set('landmark', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="af-pin" className={label}>PIN code *</label>
          <input
            id="af-pin"
            className={field}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            required
            value={form.pincode}
            onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))}
          />
          {fe('pincode')}
        </div>
        <div>
          <label htmlFor="af-city" className={label}>City *</label>
          <input id="af-city" className={field} autoComplete="address-level2" required value={form.city} onChange={(e) => set('city', e.target.value)} />
          {fe('city')}
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="af-state" className={label}>State *</label>
          <select id="af-state" className={field} value={form.state} onChange={(e) => set('state', e.target.value)}>
            {INDIAN_STATE_NAMES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {fe('state')}
        </div>
      </div>
      {service && (
        <p className={`flex items-center gap-1.5 text-[11px] font-semibold ${service === 'checking' ? 'text-gray-400' : service.serviceable ? 'text-emerald-700' : 'text-red-600'}`} aria-live="polite">
          {service === 'checking' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking delivery…
            </>
          ) : service.serviceable ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" /> We deliver here · {service.estimateText}
            </>
          ) : (
            <>
              <XCircle className="h-3.5 w-3.5" /> {service.reason} — you can still save this address.
            </>
          )}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {(['Home', 'Work', 'Other'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => set('type', t)}
            aria-pressed={form.type === t}
            className={`h-8 rounded-full border px-3 text-xs font-semibold ${form.type === t ? 'border-[#FF7A00] bg-orange-50 text-[#E66E00]' : 'border-gray-200 text-gray-600'}`}
          >
            {t}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-700">
          <input type="checkbox" className="h-4 w-4 accent-[#FF7A00]" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
          Make default
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="brand" size="sm" isLoading={saving}>
          {address ? 'Save address' : 'Add address'}
        </Button>
      </div>
    </form>
  );
}
