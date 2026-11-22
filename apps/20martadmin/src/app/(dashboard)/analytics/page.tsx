import { AppError, getAnalytics } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, formatINR, PageHeader, Panel, StatCard } from '../../../components/ui';
import { BarList, ColumnChart } from '../../../components/charts';
import { RangePicker } from './RangePicker';
import { AnalyticsTabs } from './AnalyticsTabs';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('analytics.view')) return <AccessDenied permission="analytics.view" />;
  let report: Awaited<ReturnType<typeof getAnalytics>>;
  let error: string | null = null;
  try {
    report = await getAnalytics(searchParams);
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
    error = e.message;
    report = await getAnalytics({ range: '30d' });
  }
  const r = report;
  const { sales, orders, customers, coupons, interest } = r;
  const email = r.email;
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Analytics" description={`Real data only · ${r.range.label} (IST)`} />
      <AnalyticsTabs active="overview" />
      <RangePicker range={r.range.range} from={r.range.fromDate} to={r.range.toDate} />
      {error && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-900">{error} — showing the last 30 days.</p>}

      <section aria-labelledby="sales-h" className="space-y-2">
        <h2 id="sales-h" className="text-xs font-bold uppercase tracking-wider text-gray-500">Sales (payment received)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <StatCard label="Net revenue" value={formatINR(sales.netRevenuePaise)} hint="Paid orders minus confirmed refunds" tone="green" />
          <StatCard label="Paid revenue (gross)" value={formatINR(sales.grossPaidRevenuePaise)} hint={`${sales.paidOrders} paid order${sales.paidOrders === 1 ? '' : 's'}`} />
          <StatCard label="Refunded" value={formatINR(sales.refundedPaise)} hint={`${sales.refundsProcessed} refund(s) confirmed by provider`} tone={sales.refundedPaise ? 'red' : 'neutral'} />
          <StatCard label="Average paid order" value={formatINR(sales.averageOrderValuePaise)} hint={`Coupon discount on paid orders ${formatINR(sales.discountOnPaidOrdersPaise)}`} />
        </div>
        <Panel title="Paid revenue per day" bodyClassName="p-3">
          <ColumnChart
            ariaLabel="Paid revenue per day"
            valueLabel="Paid revenue"
            tickFormat="inr"
            points={r.series.map((d) => ({ label: d.day, value: d.revenuePaise, display: formatINR(d.revenuePaise), note: `${d.orders} paid order${d.orders === 1 ? '' : 's'}` }))}
          />
        </Panel>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <Panel title="Orders placed" bodyClassName="p-3">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['Placed', orders.placed],
              ['Awaiting confirmation / payment', orders.awaiting],
              ['Delivered', orders.delivered],
              ['Cancelled', orders.cancelled],
              ['Payment failed / expired', orders.failed],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-gray-50 p-2">
                <dt className="text-[10px] text-gray-500">{k}</dt>
                <dd className="text-base font-black tabular-nums text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[10px] text-gray-400">All orders placed in the range, paid or not. Only paid orders count as revenue.</p>
        </Panel>
        <Panel title="Top products (paid units)" bodyClassName="p-3">
          <BarList valueLabel="Units sold" points={r.topProducts.map((p) => ({ label: p.name, value: p.units, note: formatINR(p.revenuePaise) }))} empty="No paid orders in this range" />
        </Panel>
        <Panel title="Revenue by category" bodyClassName="p-3">
          <BarList valueLabel="Item revenue" points={r.byCategory.map((c) => ({ label: c.category, value: c.revenuePaise, display: formatINR(c.revenuePaise), note: `${c.units} units` }))} empty="No paid orders in this range" />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <Panel title="Customers" bodyClassName="p-3 grid grid-cols-2 gap-2 text-xs">
          {[
            ['New sign-ups', customers.newCustomers],
            ['All customers', customers.totalCustomers],
            ['Paying customers', customers.buyers],
            ['Repeat buyers', customers.repeatBuyers],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-lg bg-gray-50 p-2">
              <p className="text-[10px] text-gray-500">{k}</p>
              <p className="text-base font-black tabular-nums text-gray-900">{v}</p>
            </div>
          ))}
        </Panel>
        <Panel title="Coupons" bodyClassName="p-3 space-y-2 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-[10px] text-gray-500">Distributed</p>
              <p className="text-base font-black tabular-nums">{coupons.distributed}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-[10px] text-gray-500">Redeemed</p>
              <p className="text-base font-black tabular-nums">{coupons.redeemed}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-[10px] text-gray-500">Discount</p>
              <p className="text-base font-black tabular-nums">{formatINR(coupons.discountGivenPaise)}</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400">Distributed = issued to accounts. Redeemed = used on an order that was not cancelled.</p>
          <BarList valueLabel="Redemptions" points={coupons.top.map((c) => ({ label: c.code, value: c.redeemed, note: `${formatINR(c.discountPaise)} discount` }))} empty="No redemptions in this range" />
        </Panel>
        <Panel title="Pre-launch interest (not sales)" bodyClassName="p-3 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-amber-50 p-2">
              <p className="text-[10px] text-amber-800">Fill Your Cart joins</p>
              <p className="text-base font-black tabular-nums">{interest.fycJoins}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2">
              <p className="text-[10px] text-amber-800">Saved carts updated</p>
              <p className="text-base font-black tabular-nums">{interest.savedCarts}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2">
              <p className="text-[10px] text-amber-800">Units wanted</p>
              <p className="text-base font-black tabular-nums">{interest.savedUnits}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2">
              <p className="text-[10px] text-amber-800">Estimated interest</p>
              <p className="text-base font-black tabular-nums">{formatINR(interest.estimatedInterestPaise)}</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400">Saved campaign carts at today&apos;s prices. Nothing was ordered or paid — never added to revenue.</p>
        </Panel>
      </div>

      <Panel title="Email (this range)" bodyClassName="p-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {['SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'SKIPPED', 'QUEUED'].map((s) => (
            <span key={s} className="rounded-lg bg-gray-50 px-2.5 py-1.5">
              <span className="text-[10px] text-gray-500">{s.charAt(0) + s.slice(1).toLowerCase()}</span> <b className="tabular-nums">{email[s] ?? 0}</b>
            </span>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-gray-400">Sent = accepted by the email provider. Delivered/bounced come only from verified provider webhooks.</p>
      </Panel>
    </div>
  );
}
