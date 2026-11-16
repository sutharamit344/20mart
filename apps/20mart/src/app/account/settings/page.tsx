'use client';

import React, { useEffect, useState } from 'react';
import { Bell, Loader2, Mail } from 'lucide-react';
import { AccountLayout } from '../../../components/AccountLayout';
import { storeApi, useStore } from '../../../lib/store';

interface Prefs {
  emailOrderUpdates: boolean;
  marketingOptIn: boolean;
}

/** Real, saved preferences. 20Mart sends email only — no SMS or WhatsApp. */
export default function EmailPreferencesPage() {
  const { showToast } = useStore();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState<keyof Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    storeApi<Prefs>('/api/account/notification-preferences')
      .then(setPrefs)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load preferences'));
  }, []);

  const toggle = async (key: keyof Prefs, value: boolean) => {
    setSaving(key);
    try {
      setPrefs(await storeApi<Prefs>('/api/account/notification-preferences', { method: 'PATCH', body: { [key]: value } }));
      showToast('Preference saved');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(null);
    }
  };

  const rows: { key: keyof Prefs; title: string; text: string }[] = [
    { key: 'emailOrderUpdates', title: 'Order emails', text: 'Order received, payment received, dispatch, delivery and cancellation emails.' },
    { key: 'marketingOptIn', title: 'Offers & announcements', text: 'Coupons and campaign announcements by email. You can turn this off at any time.' },
  ];

  return (
    <AccountLayout title="Email preferences" subtitle="Choose which emails we send you." activeKey="settings">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <Mail className="h-4 w-4 text-[#FF7A00]" />
          <h2 className="text-sm font-bold text-gray-900">Email</h2>
        </div>
        {error && <p role="alert" className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
        {!prefs && !error && (
          <p className="flex items-center gap-2 py-6 text-xs text-gray-400" aria-busy="true">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        )}
        {prefs && (
          <ul className="divide-y divide-gray-50">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-3 py-3">
                <label htmlFor={`pref-${r.key}`} className="min-w-0 cursor-pointer">
                  <span className="block text-xs sm:text-sm font-bold text-gray-800">{r.title}</span>
                  <span className="block text-[11px] text-gray-500">{r.text}</span>
                </label>
                <span className="flex items-center gap-2">
                  {saving === r.key && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
                  <input
                    id={`pref-${r.key}`}
                    type="checkbox"
                    checked={prefs[r.key]}
                    disabled={saving !== null}
                    onChange={(e) => toggle(r.key, e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded-sm text-[#0B5D3B] focus:ring-[#0B5D3B]"
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-gray-50 p-2 text-[11px] text-gray-500">
          <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          In-app notifications for your orders are always kept in your notification centre. Account emails (like your welcome email) are always sent.
        </p>
      </div>
    </AccountLayout>
  );
}
