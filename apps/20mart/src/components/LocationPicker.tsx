'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Crosshair, Loader2, MapPin, X, XCircle } from 'lucide-react';
import { formatPaise } from '@20mart/shared';
import { useLocation, type Serviceability } from '../lib/location';
import { storeApi, StoreApiError, useStore } from '../lib/store';

/** Status line for a checked PIN code. Never shows an estimate unless the server returned one. */
export function ServiceabilityNote({ s, compact = false }: { s: Serviceability; compact?: boolean }) {
  if (s.serviceable) {
    return (
      <div className={`flex items-start gap-2 rounded-xl bg-emerald-50 text-emerald-800 ${compact ? 'p-2 text-[11px]' : 'p-3 text-xs'}`}>
        <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
        <div>
          <p className="font-bold">We deliver to {[s.area, s.pincode].filter(Boolean).join(', ')}</p>
          {s.estimateText && <p className="mt-0.5">{s.estimateText}.</p>}
          {!compact && <p className="mt-0.5 text-emerald-700">Delivery fee {s.feePaise ? formatPaise(s.feePaise) : 'free'} (free on larger orders).</p>}
        </div>
      </div>
    );
  }
  return (
    <div className={`flex items-start gap-2 rounded-xl bg-red-50 text-red-700 ${compact ? 'p-2 text-[11px]' : 'p-3 text-xs'}`}>
      <XCircle className="w-4 h-4 shrink-0 mt-px" />
      <p className="font-semibold">{s.reason ?? 'We do not deliver here yet'}</p>
    </div>
  );
}

function InterestForm({ pincode }: { pincode: string }) {
  const { user } = useStore();
  const [email, setEmail] = useState(user?.email ?? '');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  if (state === 'done') return <p className="text-xs font-semibold text-emerald-700">Thanks! We will email you when we start delivering to {pincode}.</p>;
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('busy');
        setError(null);
        try {
          await storeApi('/api/delivery/interest', { body: { pincode, email } });
          setState('done');
        } catch (err) {
          setError(err instanceof StoreApiError ? err.message : 'Could not save. Please try again.');
          setState('idle');
        }
      }}
    >
      <p className="text-xs text-gray-600">Want 20Mart in your area? Leave your email and we will let you know when delivery starts.</p>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
        />
        <button type="submit" disabled={state === 'busy'} className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
          {state === 'busy' ? '…' : 'Notify me'}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </form>
  );
}

export const LocationPicker: React.FC = () => {
  const { pincode, serviceability, gpsAvailable, setPincode, locateMe, closePicker } = useLocation();
  const [value, setValue] = useState(pincode ?? '');
  const [busy, setBusy] = useState<'pin' | 'gps' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Serviceability | null>(serviceability);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePicker();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePicker]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[1-9]\d{5}$/.test(value)) {
      setError('Enter a valid 6-digit PIN code');
      return;
    }
    setBusy('pin');
    setError(null);
    try {
      setResult(await setPincode(value));
    } catch (err) {
      setError(err instanceof StoreApiError ? err.message : 'Could not check this PIN code');
    } finally {
      setBusy(null);
    }
  };

  const gps = async () => {
    setBusy('gps');
    setError(null);
    const msg = await locateMe();
    setBusy(null);
    if (msg) setError(msg);
    else closePicker();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={closePicker}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loc-title"
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="loc-title" className="flex items-center gap-2 text-base font-black text-gray-900">
            <MapPin className="w-4 h-4 text-brand-orange" /> Choose delivery location
          </h2>
          <button type="button" onClick={closePicker} aria-label="Close" className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {gpsAvailable && (
          <button
            type="button"
            onClick={gps}
            disabled={busy !== null}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-brand-orange px-4 py-2.5 text-sm font-bold text-brand-orange hover:bg-orange-50 disabled:opacity-60"
          >
            {busy === 'gps' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
            Use my current location
          </button>
        )}

        <form onSubmit={submit} className="space-y-2">
          <label htmlFor="loc-pin" className="block text-xs font-bold text-gray-600">
            {gpsAvailable ? 'Or enter your PIN code' : 'Enter your delivery PIN code'}
          </label>
          <div className="flex gap-2">
            <input
              id="loc-pin"
              ref={inputRef}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="e.g. 380015"
              className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
            />
            <button type="submit" disabled={busy !== null} className="rounded-xl bg-gradient-to-r from-brand-orange to-[#FF5500] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {busy === 'pin' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
            </button>
          </div>
        </form>

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        {result && !error && <ServiceabilityNote s={result} />}
        {result && !result.serviceable && result.code !== 'INVALID' && result.code !== 'DISABLED' && <InterestForm pincode={result.pincode} />}
        {result?.serviceable && (
          <button type="button" onClick={closePicker} className="w-full rounded-xl bg-brand-green px-4 py-2.5 text-sm font-bold text-white">
            Continue shopping
          </button>
        )}
      </div>
    </div>
  );
};

/** Compact "Delivering to …" trigger used in the header bars. */
export const LocationButton: React.FC<{ tone?: 'dark' | 'light'; className?: string }> = ({ tone = 'dark', className = '' }) => {
  const { ready, label, serviceability, openPicker } = useLocation();
  const off = serviceability && !serviceability.serviceable;
  return (
    <button type="button" onClick={openPicker} className={`flex items-center gap-1.5 min-w-0 cursor-pointer ${className}`} aria-label="Change delivery location">
      <MapPin className={`w-3.5 h-3.5 shrink-0 ${tone === 'dark' ? 'text-brand-orange-300' : 'text-brand-orange'}`} />
      <span className={`shrink-0 ${tone === 'dark' ? 'text-white/75' : 'text-ink-600'}`}>{label ? 'Delivering to' : 'Deliver to'}</span>
      <span className={`truncate font-semibold ${tone === 'dark' ? 'text-white' : 'text-ink'} hover:underline`}>
        {!ready ? '…' : label ?? 'Select location'}
      </span>
      {off && <span className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold ${tone === 'dark' ? 'bg-red-500/90 text-white' : 'bg-red-50 text-red-600'}`}>Not serviceable</span>}
    </button>
  );
};
