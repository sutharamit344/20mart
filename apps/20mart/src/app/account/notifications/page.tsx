'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { AccountLayout } from '../../../components/AccountLayout';
import { storeApi } from '../../../lib/store';

interface Item {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
interface Page {
  items: Item[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
}

const when = (d: string) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

export default function NotificationsPage() {
  const [data, setData] = useState<Page | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (p: number) => {
    try {
      setData(await storeApi<Page>(`/api/account/notifications?page=${p}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notifications');
    }
  }, []);
  useEffect(() => {
    void load(page);
  }, [load, page]);

  const mark = async (body: { all: true } | { ids: string[] }) => {
    setBusy(true);
    try {
      await storeApi('/api/account/notifications', { method: 'PATCH', body });
      await load(page);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountLayout title="Notifications" subtitle="Order updates, coupons and announcements.">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500" aria-live="polite">
          {data ? `${data.unread} unread` : ''}
        </p>
        <div className="flex items-center gap-2">
          <Link href="/account/settings" className="text-[11px] font-bold text-[#0B5D3B] hover:underline">
            Email preferences
          </Link>
          <button
            type="button"
            disabled={!data?.unread || busy}
            onClick={() => mark({ all: true })}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-[11px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
      {!data && !error && (
        <p className="flex items-center gap-2 py-10 text-xs text-gray-400" aria-busy="true">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}
      {data && data.items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center">
          <Bell className="mx-auto h-6 w-6 text-gray-300" />
          <p className="mt-2 text-sm font-bold text-gray-900">You&apos;re all caught up</p>
        </div>
      )}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs">
          {data.items.map((n) => {
            const unread = !n.readAt;
            const inner = (
              <div className="flex gap-2.5 p-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-[#FF7A00]' : 'bg-transparent'}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs ${unread ? 'font-black text-gray-900' : 'font-semibold text-gray-700'}`}>
                    {n.title}
                    {unread && <span className="sr-only"> (unread)</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-600">{n.body}</p>
                  <p className="mt-0.5 text-[10px] text-gray-400">{when(n.createdAt)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id} className={unread ? 'bg-orange-50/40' : ''}>
                {n.link ? (
                  <Link href={n.link} onClick={() => unread && void mark({ ids: [n.id] })} className="block hover:bg-gray-50">
                    {inner}
                  </Link>
                ) : (
                  <button type="button" className="block w-full text-left hover:bg-gray-50" onClick={() => unread && void mark({ ids: [n.id] })}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {data && data.total > data.pageSize && (
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="font-bold text-[#0B5D3B] disabled:opacity-40">
            ← Newer
          </button>
          <span className="text-gray-400">
            Page {data.page} of {Math.ceil(data.total / data.pageSize)}
          </span>
          <button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)} className="font-bold text-[#0B5D3B] disabled:opacity-40">
            Older →
          </button>
        </div>
      )}
    </AccountLayout>
  );
}
