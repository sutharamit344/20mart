'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { ColumnChart, type Point } from '../../../../../components/charts';
import { formatINR, Panel, StatusBadge } from '../../../../../components/ui';
import {
  API,
  BASE,
  CoverageBar,
  CoverageNotice,
  DayRangePicker,
  dayLabel,
  DEF,
  duration,
  ErrorState,
  Hint,
  inr,
  Metric,
  MetricGroup,
  num,
  pct,
  pick,
  Segmented,
  Skeleton,
  useApiData,
  useQueryState,
  type DetailResponse,
} from '../shared';

type Day = DetailResponse['daily'][number];
type TrendKey = 'units' | 'revenue' | 'estLost' | 'views' | 'cartAdds' | 'stockout';

const TRENDS: { value: TrendKey; label: string; estimate?: boolean }[] = [
  { value: 'units', label: 'Units sold' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'estLost', label: 'Est. lost', estimate: true },
  { value: 'views', label: 'Views' },
  { value: 'cartAdds', label: 'Cart adds' },
  { value: 'stockout', label: 'Stockout' },
];

const missingNote = (d: Day) => (d.status === 'not_aggregated' ? 'Not aggregated yet' : d.status === 'not_listed' ? 'Not listed on this day' : 'Not tracked (before event tracking began)');

/** One point per day; days without data are marked missing, never drawn as 0. */
function trendPoints(daily: Day[], key: TrendKey): Point[] {
  return daily.map((d) => {
    const v =
      key === 'units' ? d.actual?.unitsSold
      : key === 'revenue' ? d.actual?.revenuePaise
      : key === 'estLost' ? d.estimated?.lostRevenuePaise
      : key === 'views' ? d.demand?.views
      : key === 'cartAdds' ? d.demand?.cartAddUnits
      : d.availability?.stockoutMinutes;
    const label = d.day;
    if (v === null || v === undefined) return { label, value: 0, missing: true, note: missingNote(d) };
    const money = key === 'revenue' || key === 'estLost';
    return {
      label,
      value: key === 'stockout' ? Math.round((v / 60) * 10) / 10 : v,
      display: money ? formatINR(v) : key === 'stockout' ? `${Math.round(v / 6) / 10} h without stock` : v.toLocaleString('en-IN'),
      note: d.eventCoverage === 'PARTIAL' && key !== 'units' && key !== 'revenue' && key !== 'stockout' ? 'Partly tracked day' : undefined,
    };
  });
}

const hourPoints = (h: number[]) => h.map((v, i) => ({ label: `${String(i).padStart(2, '0')}h`, value: v, display: v.toLocaleString('en-IN'), note: `${String(i).padStart(2, '0')}:00–${String(i).padStart(2, '0')}:59 IST` }));

export function ProductDetailClient({ id, maxDay }: { id: string; maxDay: string }) {
  const { params } = useQueryState();
  const range = pick(params, ['from', 'to']);
  const { data, error, retryable, loading, reload } = useApiData<DetailResponse>(`${API}/${encodeURIComponent(id)}${range ? `?${range}` : ''}`);
  const [trend, setTrend] = useState<TrendKey>('units');

  const back = (
    <Link href={`${BASE}${range ? `?${range}` : ''}`} className="inline-flex items-center gap-0.5 text-2xs font-semibold text-ink-500 hover:text-ink-800">
      <ChevronLeft className="h-3.5 w-3.5" /> All products
    </Link>
  );

  if (error && !data) {
    return (
      <div className="space-y-3">
        {back}
        <DayRangePicker maxDay={maxDay} />
        <ErrorState message={error} onRetry={retryable ? reload : undefined} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-3">
        {back}
        <Skeleton rows={4} />
      </div>
    );
  }

  const { product: p, summary: s, coverage } = data;
  const missingDays = data.daily.filter((d) => d.status !== 'ok').length;
  return (
    <div className="space-y-3" aria-busy={loading}>
      <div className="space-y-1">
        {back}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-extrabold leading-tight text-ink sm:text-xl">{p.name}</h1>
          {p.status !== 'ACTIVE' && <StatusBadge status={p.status} />}
        </div>
        <p className="text-2xs text-ink-500">
          <span className="font-mono">{p.sku}</span>
          {p.category && <> · {p.category.name}</>} · listed from {dayLabel(p.listedFromDay)}
        </p>
      </div>

      <DayRangePicker maxDay={maxDay} from={coverage.from} to={coverage.to} />
      {error && <ErrorState message={error} onRetry={retryable ? reload : undefined} />}
      <CoverageBar coverage={coverage} />
      <CoverageNotice coverage={coverage} />

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <MetricGroup title="Actual sales" tone="green" note="Gross item-line revenue before order coupons.">
          <Metric label="Orders" value={num(s.actual.orders)} hint={DEF.orders} tone="green" />
          <Metric label="Units sold" value={num(s.actual.unitsSold)} hint={DEF.units} tone="green" />
          <Metric label="Gross revenue" value={inr(s.actual.revenuePaise)} hint={DEF.revenue} tone="green" />
          <Metric label="Cancelled units" value={num(s.actual.cancelledUnits)} />
          <Metric label="Failed delivery units" value={num(s.actual.failedDeliveryUnits)} />
          <Metric label="Days with data" value={num(s.daysWithData)} />
        </MetricGroup>
        <MetricGroup title="Estimated lost demand (not revenue)" tone="amber" note="Never added to revenue. — = not tracked in this range.">
          <Metric label="Est. lost revenue" value={inr(s.estimated.lostRevenuePaise)} hint={DEF.estLost} tone="amber" />
          <Metric label="OOS attempts" value={num(s.estimated.outOfStockAttempts)} hint={DEF.oos} tone="amber" />
          <Metric label="Units refused" value={num(s.estimated.outOfStockUnits)} tone="amber" />
          <Metric label="Unavailable views" value={num(s.demand.unavailableViews)} hint="Views of the product page while it could not be bought (consented visitors)." />
        </MetricGroup>
        <MetricGroup title="Shopper demand" tone="neutral" note="Consented visitors for views; cart and wishlist from all shoppers.">
          <Metric label="Views" value={num(s.demand.views)} hint={DEF.views} />
          <Metric label="Viewer-days" value={num(s.demand.viewerDays)} hint={DEF.viewerDays} />
          <Metric label="Cart adds (units)" value={num(s.demand.cartAddUnits)} />
          <Metric label="Cart removes (units)" value={num(s.demand.cartRemoveUnits)} />
          <Metric label="Wishlist adds" value={num(s.demand.wishlistAdds)} />
        </MetricGroup>
        <MetricGroup title="Availability (active warehouses)" tone="neutral">
          <Metric label="Availability" value={pct(s.availability.availabilityPct)} hint={DEF.availability} tone={s.availability.availabilityPct !== null && s.availability.availabilityPct < 90 ? 'red' : 'neutral'} />
          <Metric label="Time without stock" value={duration(s.availability.stockoutMinutes)} />
          <Metric label="Days with a stockout" value={num(s.availability.stockoutDays)} />
          <Metric label="Days not stocked" value={num(s.availability.unstockedDays)} hint="Days with no stock row at any active warehouse." />
          <Metric label="At end of range" value={s.availability.inStockAtClose === null ? num(null) : s.availability.inStockAtClose ? 'In stock' : 'Out of stock'} tone={s.availability.inStockAtClose === false ? 'red' : 'neutral'} />
        </MetricGroup>
      </div>

      <Panel title="Daily trend" bodyClassName="p-3">
        <div className="mb-2">
          <Segmented label="Daily metric" value={trend} onChange={setTrend} options={TRENDS.map((t) => ({ value: t.value, label: t.label }))} />
        </div>
        <ColumnChart
          key={trend}
          ariaLabel={`${TRENDS.find((t) => t.value === trend)!.label} per day`}
          valueLabel={trend === 'stockout' ? 'Hours without stock' : TRENDS.find((t) => t.value === trend)!.label}
          tickFormat={trend === 'revenue' || trend === 'estLost' ? 'inr' : 'number'}
          points={trendPoints(data.daily, trend)}
          zeroLabel="All zero in this range"
        />
        <p className="mt-1 text-2xs text-ink-400">
          {trend === 'estLost' ? 'Estimate, not revenue. ' : ''}Dashed marks = no data ({missingDays} day{missingDays === 1 ? '' : 's'}: not aggregated, not listed{trend === 'estLost' || trend === 'views' || trend === 'cartAdds' ? ', or not tracked' : ''}).
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title={<span className="inline-flex items-center gap-1">Units sold by hour (IST) <Hint text="Hour the order was placed." /></span>} bodyClassName="p-3">
          {data.hourly.unitsSold ? <ColumnChart ariaLabel="Units sold by hour of day" valueLabel="Units" points={hourPoints(data.hourly.unitsSold)} height={150} zeroLabel="No sales in this range" /> : <NoDataBox text="No aggregated days in this range." />}
        </Panel>
        <Panel title={<span className="inline-flex items-center gap-1">Cart adds by hour (IST) <Hint text="Units added to carts; tracked days only." /></span>} bodyClassName="p-3">
          {data.hourly.cartAddUnits ? <ColumnChart ariaLabel="Cart adds by hour of day" valueLabel="Units" points={hourPoints(data.hourly.cartAddUnits)} height={150} zeroLabel="No cart adds in this range" /> : <NoDataBox text="No tracked days in this range — cart activity is not available." />}
        </Panel>
      </div>

      <Warehouses rows={data.warehouses} />
    </div>
  );
}

function NoDataBox({ text }: { text: string }) {
  return <p className="flex h-[150px] items-center justify-center rounded-lg bg-surface-page text-center text-2xs text-ink-400">{text}</p>;
}

function Warehouses({ rows }: { rows: DetailResponse['warehouses'] }) {
  return (
    <Panel title={<span className="inline-flex items-center gap-1">Stock by warehouse <Hint text="Each stock row (product or variant × warehouse), including paused warehouses. Availability per row; history replayed from stock movements." /></span>}>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-ink-400">No stock rows tracked in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs text-ink-600">
            <thead className="border-b border-line-subtle bg-surface-page/80 text-2xs font-semibold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2 text-right">Availability</th>
                <th className="px-3 py-2 text-right">Without stock</th>
                <th className="px-3 py-2 text-right">Stockouts</th>
                <th className="px-3 py-2 text-right">Longest</th>
                <th className="px-3 py-2 text-right" title="At the end of the last tracked day">
                  Closing avail. / reserved / sellable
                </th>
                <th className="px-3 py-2">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {rows.map((w) => (
                <tr key={w.inventoryId} className={w.warehouse.active ? '' : 'bg-surface-page/60'}>
                  <td className="px-3 py-2 align-top">
                    <p className="flex items-center gap-1.5 font-bold text-ink">
                      {w.warehouse.name}
                      {!w.warehouse.active && <StatusBadge status="INACTIVE" label="Paused" />}
                    </p>
                    <p className="text-2xs text-ink-400">
                      {w.warehouse.code && <span className="font-mono">{w.warehouse.code}</span>}
                      {w.variant && <> · {w.variant.name ?? w.variant.sku}</>} · {w.daysTracked} day{w.daysTracked === 1 ? '' : 's'}
                    </p>
                    {w.inconsistentDays > 0 && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-2xs font-semibold text-warning" title="Stock history on these days produced impossible quantities (incomplete movement history); figures may be approximate.">
                        <AlertTriangle className="h-3 w-3" /> {w.inconsistentDays} day(s) with incomplete history
                      </p>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right align-top font-bold tabular-nums ${w.availabilityPct !== null && w.availabilityPct < 90 ? 'text-danger' : 'text-ink-800'}`}>{pct(w.availabilityPct)}</td>
                  <td className="px-3 py-2 text-right align-top tabular-nums">{duration(w.stockoutMinutes)}</td>
                  <td className="px-3 py-2 text-right align-top tabular-nums">{num(w.stockouts)}</td>
                  <td className="px-3 py-2 text-right align-top tabular-nums">{duration(w.longestStockoutMinutes)}</td>
                  <td className="px-3 py-2 text-right align-top tabular-nums">
                    {w.closing.available} / {w.closing.reserved} / <b className={w.closing.sellable > 0 ? 'text-ink' : 'text-danger'}>{w.closing.sellable}</b>
                    <span className="block text-2xs text-ink-400">{dayLabel(w.closing.day, false)}</span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <details>
                      <summary className="cursor-pointer select-none text-2xs font-semibold text-ink-500 hover:text-ink-800">Daily</summary>
                      <div className="mt-1 max-h-56 overflow-auto rounded-lg border border-line-subtle">
                        <table className="w-full text-2xs">
                          <thead className="bg-surface-page text-ink-500">
                            <tr>
                              <th className="px-1.5 py-1 text-left">Day</th>
                              <th className="px-1.5 py-1 text-right">Open→close</th>
                              <th className="px-1.5 py-1 text-right">Sellable</th>
                              <th className="px-1.5 py-1 text-right">No stock</th>
                            </tr>
                          </thead>
                          <tbody>
                            {w.daily.map((d) => (
                              <tr key={d.day} className="border-t border-line-subtle">
                                <td className="whitespace-nowrap px-1.5 py-0.5">
                                  {dayLabel(d.day, false)}
                                  {!d.warehouseActive && <span className="text-ink-400"> (paused)</span>}
                                  {!d.consistent && <span className="text-warning" title="Incomplete movement history"> !</span>}
                                </td>
                                <td className="px-1.5 py-0.5 text-right tabular-nums">
                                  {d.openingAvailable}→{d.closingAvailable}
                                </td>
                                <td className="px-1.5 py-0.5 text-right tabular-nums">{d.closingSellable}</td>
                                <td className={`px-1.5 py-0.5 text-right tabular-nums ${d.stockoutMinutes ? 'font-bold text-danger' : ''}`}>{d.stockoutMinutes ? duration(d.stockoutMinutes) : '0'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
