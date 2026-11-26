'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2, Plus, Search, X } from 'lucide-react';
import { ColumnChart, type Point } from '../../../../../components/charts';
import { formatINR, Panel } from '../../../../../components/ui';
import { api } from '../../../../../lib/api';
import {
  API,
  BASE,
  CoverageBadge,
  CoverageBar,
  CoverageNotice,
  DayRangePicker,
  DEF,
  duration,
  ErrorState,
  Hint,
  inr,
  num,
  pct,
  pick,
  Segmented,
  Skeleton,
  useApiData,
  useQueryState,
  type CompareResponse,
  type ListResponse,
  type Summary,
} from '../shared';

const MAX = 4;
type SeriesKey = keyof CompareResponse['products'][number]['series'];
const SERIES: { value: SeriesKey; label: string; money?: boolean; estimate?: boolean }[] = [
  { value: 'unitsSold', label: 'Units sold' },
  { value: 'revenuePaise', label: 'Revenue', money: true },
  { value: 'estLostRevenuePaise', label: 'Est. lost', money: true, estimate: true },
  { value: 'views', label: 'Views' },
  { value: 'cartAddUnits', label: 'Cart adds' },
  { value: 'stockoutMinutes', label: 'Stockout min' },
];

type Row = { label: string; hint?: string; get: (s: Summary) => React.ReactNode };
const GROUPS: { title: string; tone: string; rows: Row[] }[] = [
  {
    title: 'Actual sales',
    tone: 'text-brand-green',
    rows: [
      { label: 'Orders', hint: DEF.orders, get: (s) => num(s.actual.orders) },
      { label: 'Units sold', hint: DEF.units, get: (s) => num(s.actual.unitsSold) },
      { label: 'Gross revenue', hint: DEF.revenue, get: (s) => inr(s.actual.revenuePaise) },
      { label: 'Cancelled units', get: (s) => num(s.actual.cancelledUnits) },
    ],
  },
  {
    title: 'Estimated lost demand (not revenue)',
    tone: 'text-amber-700',
    rows: [
      { label: 'Est. lost revenue', hint: DEF.estLost, get: (s) => inr(s.estimated.lostRevenuePaise) },
      { label: 'OOS attempts', hint: DEF.oos, get: (s) => num(s.estimated.outOfStockAttempts) },
      { label: 'Units refused', get: (s) => num(s.estimated.outOfStockUnits) },
    ],
  },
  {
    title: 'Shopper demand',
    tone: 'text-gray-700',
    rows: [
      { label: 'Views', hint: DEF.views, get: (s) => num(s.demand.views) },
      { label: 'Cart adds (units)', get: (s) => num(s.demand.cartAddUnits) },
      { label: 'Wishlist adds', get: (s) => num(s.demand.wishlistAdds) },
    ],
  },
  {
    title: 'Availability',
    tone: 'text-gray-700',
    rows: [
      { label: 'Availability', hint: DEF.availability, get: (s) => pct(s.availability.availabilityPct) },
      { label: 'Time without stock', get: (s) => duration(s.availability.stockoutMinutes) },
      { label: 'Days with a stockout', get: (s) => num(s.availability.stockoutDays) },
      { label: 'Event coverage', hint: DEF.coverage, get: (s) => <CoverageBadge value={s.eventCoverage} /> },
    ],
  },
];

export function CompareClient({ maxDay }: { maxDay: string }) {
  const { params, set } = useQueryState();
  const ids = useMemo(() => [...new Set((params.get('ids') ?? '').split(',').map((x) => x.trim()).filter(Boolean))].slice(0, MAX), [params]);
  const range = pick(params, ['from', 'to']);
  const ready = ids.length >= 2;
  const { data, error, retryable, loading, reload } = useApiData<CompareResponse>(ready ? `${API}/compare?${pick(params, ['from', 'to'], { ids: ids.join(',') })}` : null);
  const [metric, setMetric] = useState<SeriesKey>('unitsSold');
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) setNames((n) => ({ ...n, ...Object.fromEntries(data.products.map((p) => [p.product.id, p.product.name])) }));
  }, [data]);

  const setIds = (next: string[]) => set({ ids: next.length ? next.join(',') : null });
  const products = data?.products.filter((p) => ids.includes(p.product.id)) ?? [];
  const m = SERIES.find((s) => s.value === metric)!;
  const sharedMax = Math.max(0, ...products.flatMap((p) => p.series[metric].filter((v): v is number => v !== null)));

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Link href={`${BASE}${range ? `?${range}` : ''}`} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-gray-500 hover:text-gray-800">
          <ChevronLeft className="h-3.5 w-3.5" /> All products
        </Link>
        <h1 className="text-lg font-extrabold leading-tight text-gray-900 sm:text-xl">Compare products</h1>
        <p className="text-[11px] text-gray-500">2–4 products over the same IST days. Missing data shows as —, never as 0.</p>
      </div>

      <DayRangePicker maxDay={maxDay} from={data?.coverage.from} to={data?.coverage.to} />

      <Panel bodyClassName="p-2.5 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Selected products">
          {ids.map((id) => (
            <span key={id} className="inline-flex max-w-[260px] items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-2.5 pr-1 text-[11px] font-semibold text-gray-800">
              <span className="truncate">{names[id] ?? 'Loading…'}</span>
              <button type="button" onClick={() => setIds(ids.filter((x) => x !== id))} aria-label={`Remove ${names[id] ?? 'product'}`} className="rounded-full p-0.5 hover:bg-gray-200">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {ids.length === 0 && <span className="text-[11px] text-gray-400">No products selected.</span>}
        </div>
        {ids.length < MAX && (
          <AddProduct
            range={range}
            exclude={ids}
            onAdd={(s) => {
              setNames((n) => ({ ...n, [s.productId]: s.name }));
              setIds([...ids, s.productId]);
            }}
          />
        )}
      </Panel>

      {!ready && <p className="rounded-lg bg-gray-50 px-3 py-6 text-center text-xs text-gray-500">Add {2 - ids.length} more product{2 - ids.length === 1 ? '' : 's'} to compare (up to {MAX}).</p>}
      {ready && error && <ErrorState message={error} onRetry={retryable ? reload : undefined} />}
      {ready && !data && loading && <Skeleton rows={3} />}

      {ready && data && products.length >= 2 && (
        <>
          <CoverageBar coverage={data.coverage} />
          <CoverageNotice coverage={data.coverage} />

          <Panel title={<span className="inline-flex items-center gap-2">Side by side {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" aria-label="Updating" />}</span>}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600" style={{ minWidth: 200 + products.length * 140 }}>
                <thead className="border-b border-gray-100 bg-gray-50/80 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Metric</th>
                    {products.map((p) => (
                      <th key={p.product.id} className="px-3 py-2 text-right normal-case">
                        <Link href={`${BASE}/${p.product.id}${range ? `?${range}` : ''}`} className="block truncate text-[11px] font-bold text-gray-900 hover:underline" title={p.product.name}>
                          {p.product.name}
                        </Link>
                        <span className="font-mono text-[10px] font-normal text-gray-400">{p.product.sku}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                {GROUPS.map((g) => (
                  <tbody key={g.title} className="divide-y divide-gray-50">
                    <tr className="bg-gray-50/50">
                      <th colSpan={products.length + 1} className={`px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider ${g.tone}`}>
                        {g.title}
                      </th>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r.label}>
                        <td className="whitespace-nowrap px-3 py-1.5 text-gray-500">
                          {r.label} {r.hint && <Hint text={r.hint} />}
                        </td>
                        {products.map((p) => (
                          <td key={p.product.id} className="px-3 py-1.5 text-right font-semibold tabular-nums text-gray-900">
                            {r.get(p.summary)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </Panel>

          <Panel title="Daily trend (same scale)" bodyClassName="p-3">
            <div className="mb-2">
              <Segmented label="Compared metric" value={metric} onChange={setMetric} options={SERIES.map((s) => ({ value: s.value, label: s.label }))} />
            </div>
            {m.estimate && <p className="mb-2 text-[10px] font-semibold text-amber-700">Estimate, not revenue. Untracked days show as no data.</p>}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {products.map((p) => (
                <div key={p.product.id} className="min-w-0">
                  <p className="truncate text-[11px] font-bold text-gray-800" title={p.product.name}>
                    {p.product.name}
                  </p>
                  <ColumnChart
                    key={metric}
                    ariaLabel={`${m.label} per day — ${p.product.name}`}
                    valueLabel={m.label}
                    tickFormat={m.money ? 'inr' : 'number'}
                    height={140}
                    max={sharedMax}
                    zeroLabel="All zero in this range"
                    points={data.days.map((d, i): Point => {
                      const v = p.series[metric][i];
                      return v === null ? { label: d, value: 0, missing: true, note: 'No data for this day' } : { label: d, value: v, display: m.money ? formatINR(v) : v.toLocaleString('en-IN') };
                    })}
                  />
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

/** Search the demand list (analytics.view only) to add a product. */
function AddProduct({ range, exclude, onAdd }: { range: string; exclude: string[]; onAdd: (s: Summary) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const sp = new URLSearchParams(range);
        sp.set('q', term);
        sp.set('pageSize', '8');
        sp.set('sort', 'name');
        sp.set('dir', 'asc');
        const r = await api<ListResponse>(`${API}?${sp.toString()}`);
        if (live) setResults(r.items);
      } catch {
        if (live) setResults([]);
      } finally {
        if (live) setLoading(false);
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, range]);
  return (
    <div className="relative max-w-md">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
      <input
        className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-8 text-xs placeholder:text-gray-400 focus:border-brand-green focus:outline-none"
        placeholder="Add a product: search name or SKU…"
        aria-label="Search a product to add to the comparison"
        value={q}
        maxLength={100}
        onChange={(e) => setQ(e.target.value)}
      />
      {loading && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-gray-400" />}
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-100 bg-white text-xs shadow-md">
          {results.map((r) => (
            <li key={r.productId}>
              <button
                type="button"
                disabled={exclude.includes(r.productId)}
                onClick={() => {
                  onAdd(r);
                  setQ('');
                  setResults([]);
                }}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-gray-50 disabled:opacity-40"
              >
                <span className="min-w-0 truncate font-semibold text-gray-800">{r.name}</span>
                <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] text-gray-400">
                  {r.sku} <Plus className="h-3 w-3" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !loading && results.length === 0 && <p className="mt-1 text-[10px] text-gray-400">No product with data in this range matches.</p>}
    </div>
  );
}
