'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, GitCompare, Loader2, Search, X } from 'lucide-react';
import { Panel, StatusBadge } from '../../../../components/ui';
import {
  API,
  BASE,
  CoverageBadge,
  CoverageBar,
  CoverageNotice,
  DayRangePicker,
  DEF,
  ErrorState,
  Hint,
  inr,
  Metric,
  MetricGroup,
  num,
  pct,
  pick,
  Skeleton,
  useApiData,
  useQueryState,
  type ListResponse,
  type Summary,
} from './shared';

const LIST_KEYS = ['from', 'to', 'q', 'categoryId', 'availability', 'activity', 'sort', 'dir', 'page', 'pageSize'] as const;
const EXPORT_KEYS = ['from', 'to', 'q', 'categoryId', 'availability', 'activity', 'sort', 'dir'] as const;
const MAX_COMPARE = 4;

const AVAILABILITY = [
  { value: 'had_stockout', label: 'Had a stockout' },
  { value: 'out_at_close', label: 'Out of stock at end' },
  { value: 'never_stocked', label: 'Never stocked' },
];
const ACTIVITY = [
  { value: 'with_sales', label: 'With sales' },
  { value: 'no_sales', label: 'No sales' },
  { value: 'with_lost_demand', label: 'With lost demand' },
];

export function ProductDemandClient({ maxDay, categories }: { maxDay: string; categories: { id: string; name: string }[] }) {
  const { params, set } = useQueryState();
  const qs = pick(params, LIST_KEYS);
  const { data, error, retryable, loading, reload } = useApiData<ListResponse>(`${API}${qs ? `?${qs}` : ''}`);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());

  // Debounced search box → URL.
  const [q, setQ] = useState(params.get('q') ?? '');
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') !== q.trim()) set({ q: q.trim() || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const sort = params.get('sort') ?? 'revenue';
  const dir = params.get('dir') ?? 'desc';
  const toggleSort = (key: string) => set(sort === key ? { sort: key, dir: dir === 'desc' ? 'asc' : 'desc' } : { sort: key, dir: key === 'name' ? 'asc' : 'desc' });
  const hasFilters = ['q', 'categoryId', 'availability', 'activity'].some((k) => params.get(k));
  const range = pick(params, ['from', 'to']);

  const toggle = (s: Summary) =>
    setSelected((m) => {
      const next = new Map(m);
      if (next.has(s.productId)) next.delete(s.productId);
      else if (next.size < MAX_COMPARE) next.set(s.productId, s.name);
      return next;
    });
  const compareHref = `${BASE}/compare?${pick(params, ['from', 'to'], { ids: [...selected.keys()].join(',') })}`;

  return (
    <div className="space-y-3">
      <DayRangePicker maxDay={maxDay} from={data?.coverage.from} to={data?.coverage.to} />

      {error && <ErrorState message={error} onRetry={retryable ? reload : undefined} />}
      {!data && loading && <Skeleton rows={3} />}

      {data && (
        <>
          <CoverageBar coverage={data.coverage} />
          <CoverageNotice coverage={data.coverage} />
          <Kpis data={data} />
        </>
      )}

      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            Products {data && <span className="text-2xs font-semibold text-ink-400">{data.total.toLocaleString('en-IN')}</span>}
            {loading && data && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" aria-label="Updating" />}
          </span>
        }
        actions={
          <div className="flex items-center gap-1.5">
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Map())} className="h-7 rounded-lg px-2 text-2xs font-semibold text-ink-500 hover:bg-surface-muted">
                Clear selection
              </button>
            )}
            {selected.size >= 2 ? (
              <Link href={compareHref} className="inline-flex h-7 items-center gap-1 rounded-lg bg-brand-green px-2.5 text-2xs font-bold text-white hover:bg-brand-green-hover">
                <GitCompare className="h-3.5 w-3.5" /> Compare {selected.size}
              </Link>
            ) : (
              <span className="hidden text-2xs text-ink-400 sm:inline" title="Tick 2–4 products to compare">
                Select 2–4 to compare
              </span>
            )}
            <ExportButton query={pick(params, EXPORT_KEYS)} disabled={!data || data.total === 0} />
          </div>
        }
      >
        <div className="flex flex-col gap-2 border-b border-line-subtle p-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or SKU…"
              aria-label="Search products by name or SKU"
              maxLength={100}
              className="h-9 w-full rounded-lg border border-line bg-surface-page pl-9 pr-3 text-xs text-ink placeholder:text-ink-400 focus:border-brand-green focus:bg-surface focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Select label="Category" name="categoryId" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            <Select label="Availability" name="availability" options={AVAILABILITY} />
            <Select label="Activity" name="activity" options={ACTIVITY} />
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  set({ q: null, categoryId: null, availability: null, activity: null });
                }}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-ink-500 hover:bg-surface-muted"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-ink-600 sm:min-w-[680px]" aria-busy={loading}>
            <thead className="border-b border-line-subtle bg-surface-page/80 text-2xs font-semibold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="w-8 px-3 py-2">
                  <span className="sr-only">Select for comparison</span>
                </th>
                <SortTh k="name" label="Product" sort={sort} dir={dir} onSort={toggleSort} className="text-left" />
                <SortTh k="orders" label="Orders" sort={sort} dir={dir} onSort={toggleSort} hint={DEF.orders} />
                <SortTh k="unitsSold" label="Units" sort={sort} dir={dir} onSort={toggleSort} hint={DEF.units} />
                <SortTh k="revenue" label="Revenue" sort={sort} dir={dir} onSort={toggleSort} hint={DEF.revenue} />
                <SortTh k="estLostRevenue" label="Est. lost" sort={sort} dir={dir} onSort={toggleSort} hint={DEF.estLost} estimate />
                <SortTh k="outOfStockUnits" label="OOS" sort={sort} dir={dir} onSort={toggleSort} hint={`Out-of-stock attempts. ${DEF.oos} Sorted by units refused.`} estimate />
                <SortTh k="availability" label="Availability" sort={sort} dir={dir} onSort={toggleSort} hint={DEF.availability} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {data?.items.map((s) => (
                <Row key={s.productId} s={s} range={range} checked={selected.has(s.productId)} disabled={!selected.has(s.productId) && selected.size >= MAX_COMPARE} onToggle={() => toggle(s)} />
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <p className="text-sm font-bold text-ink-800">{data.coverage.aggregatedDays === 0 ? 'No aggregated data for this range' : hasFilters ? 'No products match these filters' : 'No products in this range'}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {data.coverage.aggregatedDays === 0 ? 'Daily aggregation runs at 03:00 IST; choose a range with aggregated days.' : hasFilters ? 'Try clearing a filter or widening the date range.' : 'Products appear once they are listed on an aggregated day.'}
                    </p>
                  </td>
                </tr>
              )}
              {!data && loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-ink-400">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-label="Loading products" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data && data.total > 0 && <Pager page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={(p) => set({ page: p > 1 ? String(p) : null }, true)} />}
      </Panel>
    </div>
  );
}

function Kpis({ data }: { data: ListResponse }) {
  const t = data.totals;
  return (
    <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
      <MetricGroup title="Actual sales" tone="green" note="From orders. Cancelled, failed and unpaid online orders excluded.">
        <Metric label="Orders" value={num(t.actual.orders)} hint={DEF.orders} tone="green" />
        <Metric label="Units sold" value={num(t.actual.unitsSold)} hint={DEF.units} tone="green" />
        <Metric label="Gross revenue" value={inr(t.actual.revenuePaise)} hint={DEF.revenue} tone="green" />
      </MetricGroup>
      <MetricGroup title="Estimated lost demand (not revenue)" tone="amber" note="Never added to revenue. — = not tracked in this range.">
        <Metric label="Est. lost revenue" value={inr(t.estimated.lostRevenuePaise)} hint={DEF.estLost} tone="amber" />
        <Metric label="OOS" value={num(t.estimated.outOfStockAttempts)} hint={DEF.oos} tone="amber" />
        <Metric label="Units refused" value={num(t.estimated.outOfStockUnits)} tone="amber" />
      </MetricGroup>
      <MetricGroup title="Availability" tone="neutral" note={`${data.total.toLocaleString('en-IN')} product(s) matching the filters.`}>
        <Metric label="Availability" value={pct(t.availability.availabilityPct)} hint={DEF.availability} tone={t.availability.availabilityPct !== null && t.availability.availabilityPct < 90 ? 'red' : 'neutral'} />
        <Metric label="Stockout hours" value={num(Math.round(t.availability.stockoutMinutes / 60))} />
        <Metric label="Products" value={num(data.total)} />
      </MetricGroup>
    </div>
  );
}

function Row({ s, range, checked, disabled, onToggle }: { s: Summary; range: string; checked: boolean; disabled: boolean; onToggle: () => void }) {
  const a = s.availability;
  return (
    <tr className={`hover:bg-surface-muted/60 ${checked ? 'bg-success-soft' : ''}`}>
      <td className="px-3 py-2">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} aria-label={`Select ${s.name} for comparison`} className="h-3.5 w-3.5 accent-brand-green" />
      </td>
      <td className="max-w-[200px] px-3 py-2 xl:max-w-[280px]">
        <Link href={`${BASE}/${s.productId}${range ? `?${range}` : ''}`} className="block truncate font-bold text-ink hover:text-brand-green hover:underline">
          {s.name}
        </Link>
        <p className="flex items-center gap-1.5 truncate text-2xs text-ink-400">
          <span className="font-mono">{s.sku}</span>
          {s.category && <span>· {s.category.name}</span>}
          {s.status !== 'ACTIVE' && <StatusBadge status={s.status} />}
          {s.eventCoverage !== 'FULL' && <CoverageBadge value={s.eventCoverage} title={`Event coverage for this product: ${s.eventCoverage}. ${DEF.coverage}`} />}
        </p>
        {/* Phones: key figures inline (the full columns appear from 640px). */}
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-2xs tabular-nums text-ink-500 sm:hidden">
          <span>{num(s.actual.unitsSold)} units</span>
          <span className="font-bold text-brand-green">{inr(s.actual.revenuePaise)}</span>
          <span className="text-warning">est. lost {inr(s.estimated.lostRevenuePaise)}</span>
          <span className={a.availabilityPct !== null && a.availabilityPct < 90 ? 'font-bold text-danger' : ''}>avail. {pct(a.availabilityPct)}</span>
        </p>
      </td>
      <td className="hidden px-2 py-2 text-right sm:table-cell tabular-nums">{num(s.actual.orders)}</td>
      <td className="hidden px-2 py-2 text-right sm:table-cell tabular-nums">{num(s.actual.unitsSold)}</td>
      <td className="hidden px-2 py-2 text-right sm:table-cell font-bold tabular-nums text-brand-green">{inr(s.actual.revenuePaise)}</td>
      <td className="hidden px-2 py-2 text-right sm:table-cell tabular-nums text-warning">{inr(s.estimated.lostRevenuePaise)}</td>
      <td className="hidden px-2 py-2 text-right sm:table-cell tabular-nums text-warning">
        {num(s.estimated.outOfStockAttempts)}
        {s.estimated.outOfStockUnits ? <span className="block text-2xs text-ink-400">{s.estimated.outOfStockUnits} units</span> : null}
      </td>
      <td className="hidden px-2 py-2 text-right sm:table-cell">
        <span className={`font-bold tabular-nums ${a.availabilityPct !== null && a.availabilityPct < 90 ? 'text-danger' : 'text-ink-800'}`}>{pct(a.availabilityPct)}</span>
        <span className="mt-0.5 flex justify-end gap-1">
          {a.unstockedDays === s.daysWithData && s.daysWithData > 0 ? (
            <StatusBadge status="INACTIVE" label="Not stocked" />
          ) : a.inStockAtClose === false ? (
            <StatusBadge status="OUT" label="Out at end" />
          ) : a.stockoutDays > 0 ? (
            <span className="text-2xs text-ink-400">{a.stockoutDays} day{a.stockoutDays === 1 ? '' : 's'} with stockout</span>
          ) : null}
        </span>
      </td>
    </tr>
  );
}

function SortTh({ k, label, sort, dir, onSort, hint, estimate, className = 'text-right' }: { k: string; label: string; sort: string; dir: string; onSort: (k: string) => void; hint?: string; estimate?: boolean; className?: string }) {
  const active = sort === k;
  return (
    <th className={`whitespace-nowrap py-2 ${k === 'name' ? 'px-3' : 'hidden px-2 sm:table-cell'} ${className}`} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <span className={`inline-flex items-center gap-1 ${estimate ? 'text-warning' : ''}`}>
        <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-0.5 uppercase hover:text-ink ${active ? 'text-ink' : ''}`}>
          {label}
          {active && (dir === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
        </button>
        {hint && <Hint text={hint} />}
      </span>
    </th>
  );
}

function Select({ label, name, options }: { label: string; name: string; options: { value: string; label: string }[] }) {
  const { params, set } = useQueryState();
  return (
    <select
      aria-label={label}
      value={params.get(name) ?? ''}
      onChange={(e) => set({ [name]: e.target.value || null })}
      className="h-9 min-w-0 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink-700 focus:border-brand-green focus:outline-none sm:w-auto"
    >
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Pager({ page, totalPages, total, pageSize, onPage }: { page: number; totalPages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const btn = 'inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-2xs font-semibold border-line bg-surface hover:bg-surface-muted disabled:border-line-subtle disabled:text-ink-400 disabled:hover:bg-surface';
  const from = (page - 1) * pageSize + 1;
  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-line-subtle px-4 py-2.5 text-2xs text-ink-500 sm:flex-row">
      <span>
        {page > totalPages ? 'Past the last page' : `${from}–${Math.min(total, page * pageSize)} of ${total.toLocaleString('en-IN')}`}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(Math.min(page - 1, totalPages))} aria-label="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="px-2 font-semibold text-ink-700">
          {page} / {Math.max(1, totalPages)}
        </span>
        <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Downloads the CSV for the current filters and range; shows the server's message on 400/429. */
export function ExportButton({ query, disabled }: { query: string; disabled?: boolean }) {
  const [state, setState] = useState<{ busy: boolean; msg: string | null; ok: boolean }>({ busy: false, msg: null, ok: true });
  const run = async () => {
    setState({ busy: true, msg: null, ok: true });
    try {
      const res = await fetch(`${API}/export${query ? `?${query}` : ''}`, { credentials: 'same-origin', cache: 'no-store' });
      if (res.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? (res.status === 429 ? 'Too many exports. Please wait a few minutes.' : 'Export failed'));
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'product-demand.csv';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState({ busy: false, msg: `Downloaded ${name}`, ok: true });
    } catch (e) {
      setState({ busy: false, msg: e instanceof Error ? e.message : 'Export failed', ok: false });
    }
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={disabled || state.busy}
        title="Download the filtered list (all pages, up to 5,000 products) as CSV. Empty cells mean no data."
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-2xs font-bold text-ink-700 hover:bg-surface-muted disabled:opacity-40"
      >
        {state.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} CSV
      </button>
      <span role="status" aria-live="polite" className={`max-w-[220px] truncate text-2xs font-semibold ${state.ok ? 'text-success' : 'text-danger'}`} title={state.msg ?? undefined}>
        {state.msg}
      </span>
    </span>
  );
}
