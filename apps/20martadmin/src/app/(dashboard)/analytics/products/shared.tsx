'use client';

/**
 * Shared pieces for the Product demand analytics screens (C3).
 * Data rules carried into the UI:
 *  - `null` means "no data" and is shown as "—", never as 0.
 *  - Actual sales (green) and the lost-revenue ESTIMATE (amber) are always shown apart.
 *  - All days are IST calendar days ('YYYY-MM-DD'), passed to the API as-is.
 */
import React, { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Info, Loader2 } from 'lucide-react';
import type { compareProductDemand, getProductDemandDetail, listProductDemand } from '@20mart/server';
import { api, ApiError, errMsg } from '../../../../lib/api';
import { istDateTime } from '../../../../lib/datetime';
import { formatINR, inputCls } from '../../../../components/ui';

/** API payload types after JSON (Dates arrive as strings). */
type Json<T> = T extends Date ? string : T extends (infer U)[] ? Json<U>[] : T extends object ? { [K in keyof T]: Json<T[K]> } : T;
export type ListResponse = Json<Awaited<ReturnType<typeof listProductDemand>>>;
export type DetailResponse = Json<Awaited<ReturnType<typeof getProductDemandDetail>>>;
export type CompareResponse = Json<Awaited<ReturnType<typeof compareProductDemand>>>;
export type Coverage = ListResponse['coverage'];
export type Summary = ListResponse['items'][number];

export const BASE = '/analytics/products';
export const API = '/api/admin/analytics/products';

/* ───────────────────────────── metric definitions (tooltips) ───────────────────────────── */

export const DEF = {
  revenue: 'Gross item-line revenue from orders placed in the range, before order-level coupons. Cancelled, failed and unpaid online orders are excluded.',
  orders: 'Orders placed in the range that contain the product (cancelled, failed and unpaid online orders excluded).',
  units: 'Units in those orders.',
  estLost: 'ESTIMATE, not revenue: units shoppers tried to add while the product was out of stock × the price at that moment. An upper bound — shoppers may buy later or buy something else.',
  oos: 'Out-of-stock add attempts recorded by the server (repeat attempts by the same cart on the same day count once).',
  availability: 'Share of the time the product had sellable stock at any active warehouse (available − reserved − safety stock > 0).',
  views: 'Product page views by visitors who accepted analytics cookies — a lower bound.',
  viewerDays: 'Sum of daily unique viewers (one visitor on 3 days counts 3).',
  coverage: 'Views, cart and out-of-stock events exist only from the day tracking started. NONE = no event data; PARTIAL = some days tracked; FULL = all days tracked. Sales and stock history are complete either way.',
} as const;

/* ───────────────────────────── formatting ───────────────────────────── */

const NoData = () => (
  <span className="text-ink-400" title="No data (not tracked or not aggregated) — not zero">
    —
  </span>
);
export const num = (v: number | null | undefined) => (v === null || v === undefined ? <NoData /> : v.toLocaleString('en-IN'));
export const inr = (v: number | null | undefined) => (v === null || v === undefined ? <NoData /> : formatINR(v));
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? <NoData /> : `${v.toFixed(v % 1 ? 1 : 0)}%`);
export const duration = (min: number | null | undefined) => {
  if (min === null || min === undefined) return <NoData />;
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h >= 48 ? `${Math.round(h / 24)}d` : m ? `${h}h ${m}m` : `${h}h`;
};
/** 'YYYY-MM-DD' (already an IST day) → "21 Nov 2026". */
export const dayLabel = (d: string | null | undefined, year = true) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) }) : '—';

export function Hint({ text }: { text: string }) {
  return (
    <span className="inline-flex align-middle text-ink-400 hover:text-ink-600" title={text} aria-label={text} role="img">
      <Info className="h-3 w-3" aria-hidden />
    </span>
  );
}

/* ───────────────────────────── data fetching ───────────────────────────── */

/**
 * Fetch once per URL (null = don't fetch). Keeps the previous data while the next request loads
 * and ignores out-of-order responses, so quick filter changes never show stale results.
 */
export function useApiData<T>(url: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string | null; retryable: boolean; loading: boolean }>({ data: null, error: null, retryable: false, loading: !!url });
  const seq = useRef(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!url) {
      setState({ data: null, error: null, retryable: false, loading: false });
      return;
    }
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null, retryable: false }));
    api<T>(url)
      .then((data) => id === seq.current && setState({ data, error: null, retryable: false, loading: false }))
      .catch((e) => id === seq.current && setState((s) => ({ ...s, error: errMsg(e), retryable: isRetryable(e), loading: false })));
  }, [url, retry]);
  return { ...state, reload: () => setRetry((n) => n + 1) };
}

/**
 * Worth retrying: network failures, server errors (5xx), timeouts and rate limits.
 * Validation errors (e.g. an invalid date range) and permission errors are not — retrying returns the same answer.
 */
export function isRetryable(e: unknown) {
  if (!(e instanceof ApiError)) return true;
  return e.status >= 500 || e.status === 408 || e.status === 429;
}

/** Update the URL query (router.replace, no scroll). `page` resets unless set explicitly. */
export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (updates: Record<string, string | null | undefined>, keepPage = false) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) (v ? sp.set(k, v) : sp.delete(k));
    if (!keepPage && !('page' in updates)) sp.delete('page');
    const qs = sp.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { params, set, pending };
}

/** Only the parameters an API accepts (unknown keys are rejected by the server). */
export function pick(params: URLSearchParams, keys: readonly string[], extra: Record<string, string> = {}) {
  const sp = new URLSearchParams();
  for (const k of keys) {
    const v = params.get(k);
    if (v) sp.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) sp.set(k, v);
  return sp.toString();
}

/* ───────────────────────────── range picker (IST days) ───────────────────────────── */

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const PRESETS = [7, 30, 90] as const;

/**
 * Finished IST days only: `maxDay` is yesterday (IST), computed on the server.
 * Without from/to in the URL the API uses the last 30 days.
 */
export function DayRangePicker({ maxDay, from, to }: { maxDay: string; from?: string; to?: string }) {
  const { params, set, pending } = useQueryState();
  const urlFrom = params.get('from') ?? '';
  const urlTo = params.get('to') ?? '';
  const effFrom = urlFrom || from || addDays(maxDay, -29);
  const effTo = urlTo || to || maxDay;
  const active = effTo === maxDay ? PRESETS.find((n) => addDays(maxDay, -(n - 1)) === effFrom) : undefined;
  const [custom, setCustom] = useState(!active);
  const [f, setF] = useState(effFrom);
  const [t, setT] = useState(effTo);
  useEffect(() => {
    setF(effFrom);
    setT(effTo);
  }, [effFrom, effTo]);
  const invalid = !f || !t || f > t || t > maxDay;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap rounded-lg border border-line bg-surface p-0.5" role="radiogroup" aria-label="Date range (IST)">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={!custom && active === n}
            onClick={() => {
              setCustom(false);
              set({ from: n === 30 ? null : addDays(maxDay, -(n - 1)), to: null });
            }}
            className={`h-7 rounded-md px-2.5 text-2xs font-bold ${!custom && active === n ? 'bg-brand-green text-white' : 'text-ink-600 hover:bg-surface-muted'}`}
          >
            Last {n} days
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={custom || !active}
          onClick={() => setCustom(true)}
          className={`h-7 rounded-md px-2.5 text-2xs font-bold ${custom || !active ? 'bg-brand-green text-white' : 'text-ink-600 hover:bg-surface-muted'}`}
        >
          Custom
        </button>
      </div>
      {(custom || !active) && (
        <form
          className="flex flex-wrap items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!invalid) set({ from: f, to: t });
          }}
        >
          <input type="date" aria-label="From (IST)" className={`${inputCls.replace('w-full ', '')} h-8 w-36`} value={f} max={maxDay} onChange={(e) => setF(e.target.value)} />
          <span className="text-2xs text-ink-400">to</span>
          <input type="date" aria-label="To (IST)" className={`${inputCls.replace('w-full ', '')} h-8 w-36`} value={t} max={maxDay} onChange={(e) => setT(e.target.value)} />
          <button type="submit" disabled={invalid} className="h-8 rounded-lg border border-line bg-surface px-2.5 text-2xs font-bold text-ink-700 hover:bg-surface-muted disabled:opacity-40">
            Apply
          </button>
        </form>
      )}
      <span className="text-2xs text-ink-500">
        {dayLabel(effFrom)} – {dayLabel(effTo)} <span className="text-ink-400">(IST, up to yesterday)</span>
      </span>
      {pending && <Loader2 className="h-4 w-4 animate-spin text-ink-400" aria-label="Loading" />}
    </div>
  );
}

/* ───────────────────────────── coverage ───────────────────────────── */

const covTone: Record<string, string> = {
  FULL: 'bg-success-soft text-success ring-success-line',
  PARTIAL: 'bg-warning-soft text-warning ring-warning-line',
  NONE: 'bg-surface-muted text-ink-600 ring-line',
};

export function CoverageBadge({ value, title }: { value: string; title?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-2xs font-bold ring-1 ring-inset ${covTone[value] ?? covTone.NONE}`} title={title ?? DEF.coverage}>
      {value}
    </span>
  );
}

/** Coverage summary: event coverage, tracking start and days not aggregated yet. */
export function CoverageBar({ coverage }: { coverage: Coverage }) {
  const missing = coverage.missingDays;
  const shown = missing.slice(0, 6);
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-2xs text-ink-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4" aria-label="Data coverage">
      <span className="inline-flex items-center gap-1.5">
        Event data <CoverageBadge value={coverage.eventCoverage} /> <Hint text={DEF.coverage} />
        <span className="text-ink-400">
          {coverage.eventDays.FULL} full · {coverage.eventDays.PARTIAL} partial · {coverage.eventDays.NONE} untracked day{coverage.eventDays.NONE === 1 ? '' : 's'}
        </span>
      </span>
      <span>
        Tracking since{' '}
        <b className="font-semibold text-ink-800">{coverage.trackingStartedAt ? `${istDateTime(coverage.trackingStartedAt)} IST` : 'not started (no events yet)'}</b>
      </span>
      <span>
        Aggregated <b className="font-semibold text-ink-800">{coverage.aggregatedDays}</b> of {coverage.days} day{coverage.days === 1 ? '' : 's'}
      </span>
      {missing.length > 0 && (
        <span className="text-warning" role="note">
          Not aggregated yet (no data, not zero): {shown.map((d) => dayLabel(d, false)).join(', ')}
          {missing.length > shown.length ? ` +${missing.length - shown.length} more` : ''}
        </span>
      )}
    </div>
  );
}

/** Notice for ranges where shopper-event metrics are partly or wholly unavailable. */
export function CoverageNotice({ coverage }: { coverage: Coverage }) {
  if (coverage.eventCoverage === 'FULL' && !coverage.missingDays.length) return null;
  const msgs: string[] = [];
  if (coverage.aggregatedDays === 0) msgs.push('No day in this range has been aggregated yet, so nothing can be shown. Aggregation runs nightly at 03:00 IST.');
  else if (coverage.eventCoverage === 'NONE')
    msgs.push(`Shopper-event tracking ${coverage.firstTrackedDay ? `began on ${dayLabel(coverage.firstTrackedDay)}` : 'has not started yet'}: views, cart and lost-demand figures show — (no data). Sales and stock are complete.`);
  else if (coverage.eventCoverage === 'PARTIAL') msgs.push(`Event figures cover only the tracked part of this range (from ${dayLabel(coverage.firstTrackedDay)}). Sales and stock cover the whole range.`);
  if (coverage.missingDays.length && coverage.aggregatedDays > 0) msgs.push(`${coverage.missingDays.length} day(s) are not aggregated yet and are excluded.`);
  return (
    <p role="note" className="rounded-lg bg-warning-soft px-3 py-2 text-2xs font-medium text-warning">
      {msgs.join(' ')}
    </p>
  );
}

/* ───────────────────────────── small layout pieces ───────────────────────────── */

export function Metric({ label, value, hint, tone = 'neutral' }: { label: string; value: React.ReactNode; hint?: string; tone?: 'neutral' | 'green' | 'amber' | 'red' }) {
  const toneCls = { neutral: 'text-ink', green: 'text-brand-green', amber: 'text-warning', red: 'text-danger' }[tone];
  return (
    <div className="min-w-0 rounded-lg bg-surface-page px-2.5 py-2">
      <p className="flex items-start gap-1 text-2xs font-semibold leading-tight text-ink-500">
        {label} {hint && <Hint text={hint} />}
      </p>
      <p className={`mt-0.5 text-base font-bold leading-tight tabular-nums ${toneCls}`}>{value}</p>
    </div>
  );
}

export function MetricGroup({ title, tone, note, children }: { title: string; tone: 'green' | 'amber' | 'neutral'; note?: string; children: React.ReactNode }) {
  const border = { green: 'border-l-brand-green', amber: 'border-l-warning', neutral: 'border-l-line-strong' }[tone];
  return (
    <section className={`rounded-xl border border-l-4 border-line bg-surface p-2.5  ${border}`} aria-label={title}>
      <h2 className="mb-1.5 text-2xs font-bold uppercase tracking-wider text-ink-500">{title}</h2>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">{children}</div>
      {note && <p className="mt-1.5 text-2xs text-ink-400">{note}</p>}
    </section>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded-md border border-danger-line bg-surface px-2 py-1 text-2xs font-bold text-danger hover:bg-danger-soft">
          Retry
        </button>
      )}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 rounded-xl bg-surface-muted" />
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-line bg-surface p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-6 rounded-md px-2 text-2xs font-bold ${value === o.value ? 'bg-ink text-white' : 'text-ink-600 hover:bg-surface-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
