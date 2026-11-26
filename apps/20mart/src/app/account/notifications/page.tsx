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
        <p className="text-xs text-ink-500" aria-live="polite">
          {data ? `${data.unread} unread` : ''}
        </p>
        <div className="flex items-center gap-2">
          <Link href="/account/settings" className="text-2xs font-bold text-brand-green hover:underline">
            Email preferences
          </Link>
          <button
            type="button"
            disabled={!data?.unread || busy}
            onClick={() => mark({ all: true })}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-2xs font-bold text-ink-700 hover:bg-surface-muted disabled:opacity-40"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger">{error}</p>}
      {!data && !error && (
        <p className="flex items-center gap-2 py-10 text-xs text-ink-400" aria-busy="true">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}
      {data && data.items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
          <Bell className="mx-auto h-6 w-6 text-ink-400" />
          <p className="mt-2 text-sm font-bold text-ink">You&apos;re all caught up</p>
        </div>
      )}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-line-subtle overflow-hidden rounded-2xl border border-line-subtle bg-surface ">
          {data.items.map((n) => {
            const unread = !n.readAt;
            const inner = (
              <div className="flex gap-2.5 p-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-brand-orange' : 'bg-transparent'}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs ${unread ? 'font-bold text-ink' : 'font-semibold text-ink-700'}`}>
                    {n.title}
                    {unread && <span className="sr-only"> (unread)</span>}
                  </p>
                  <p className="mt-0.5 text-2xs text-ink-600">{n.body}</p>
                  <p className="mt-0.5 text-2xs text-ink-400">{when(n.createdAt)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id} className={unread ? 'bg-brand-orange-50/40' : ''}>
                {n.link ? (
                  <Link href={n.link} onClick={() => unread && void mark({ ids: [n.id] })} className="block hover:bg-surface-muted">
                    {inner}
                  </Link>
                ) : (
                  <button type="button" className="block w-full text-left hover:bg-surface-muted" onClick={() => unread && void mark({ ids: [n.id] })}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {data && data.total > data.pageSize && (
        <div className="mt-3 flex items-center justify-between text-2xs">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="font-bold text-brand-green disabled:opacity-40">
            ← Newer
          </button>
          <span className="text-ink-400">
            Page {data.page} of {Math.ceil(data.total / data.pageSize)}
          </span>
          <button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)} className="font-bold text-brand-green disabled:opacity-40">
            Older →
          </button>
        </div>
      )}
    </AccountLayout>
  );
}
