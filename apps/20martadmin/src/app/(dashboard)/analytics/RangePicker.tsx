'use client';

import React, { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { inputCls } from '../../../components/ui';

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

/** Date range filter (IST days). Lives in one row above everything it scopes. */
export function RangePicker({ range, from, to }: { range: string; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const go = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) v ? sp.set(k, v) : sp.delete(k);
    start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap rounded-lg border border-line bg-surface p-0.5" role="radiogroup" aria-label="Date range">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={range === p.value}
            onClick={() => (p.value === 'custom' ? go({ range: 'custom', from: f, to: t }) : go({ range: p.value, from: '', to: '' }))}
            className={`h-7 rounded-md px-2.5 text-2xs font-bold ${range === p.value ? 'bg-brand-green text-white' : 'text-ink-600 hover:bg-surface-muted'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {range === 'custom' && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            go({ range: 'custom', from: f, to: t });
          }}
        >
          <input type="date" aria-label="From" className={`${inputCls} h-8 w-36`} value={f} onChange={(e) => setF(e.target.value)} />
          <span className="text-2xs text-ink-400">to</span>
          <input type="date" aria-label="To" className={`${inputCls} h-8 w-36`} value={t} onChange={(e) => setT(e.target.value)} />
          <button type="submit" className="h-8 rounded-lg border border-line bg-surface px-2.5 text-2xs font-bold text-ink-700 hover:bg-surface-muted">
            Apply
          </button>
        </form>
      )}
      {pending && <Loader2 className="h-4 w-4 animate-spin text-ink-400" aria-label="Loading" />}
    </div>
  );
}
