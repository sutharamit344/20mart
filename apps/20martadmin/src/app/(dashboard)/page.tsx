import Link from 'next/link';
import { ShoppingBag, Clock, IndianRupee, Users, Package, CheckCircle2, Boxes, AlertTriangle, XCircle, Plus, ArrowRight } from 'lucide-react';
import { getDashboardStats, getOperationsStats, getOrderStats, orderStatusLabel } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, formatINR, PageHeader, Panel, StatCard, StatusBadge } from '../../components/ui';

export default async function DashboardPage() {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('dashboard.view')) return <AccessDenied permission="dashboard.view" />;
  const can = (p: string) => ctx.permissions.has(p);
  const [s, os, ops] = await Promise.all([
    getDashboardStats(),
    can('orders.view') ? getOrderStats() : Promise.resolve(null),
    can('warehouses.view') || can('purchasing.view') ? getOperationsStats() : Promise.resolve(null),
  ]);
  const n = (v: number) => v.toLocaleString('en-IN');

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Welcome back, ${ctx.admin.name.split(' ')[0]}`}
        description="Live orders, catalog and stock overview for 20Mart."
        actions={
          <>
            {can('inventory.view') && (
              <Link href="/inventory?stock=low" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-semibold text-ink-700 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40">
                <Boxes className="w-3.5 h-3.5" /> Stock alerts
              </Link>
            )}
            {can('products.create') && (
              <Link href="/products/new" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-orange px-3 text-xs font-semibold text-white hover:bg-brand-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 focus-visible:ring-offset-1">
                <Plus className="w-3.5 h-3.5" /> Add product
              </Link>
            )}
          </>
        }
      />

      {os && (
        <section aria-labelledby="kpi-orders" className="space-y-2">
          <h2 id="kpi-orders" className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Orders</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            <StatCard label="Paid revenue" value={formatINR(os.paidRevenuePaise)} hint={`${n(os.paidOrders)} paid orders`} icon={<IndianRupee className="w-4 h-4" />} tone="green" />
            <StatCard label="Total orders" value={n(os.totalOrders)} icon={<ShoppingBag className="w-4 h-4" />} href="/orders" />
            <StatCard label="Pending" value={n(os.pending)} hint="Awaiting confirmation/payment" icon={<Clock className="w-4 h-4" />} tone="amber" href="/orders?status=PENDING" />
            <StatCard label="Customers" value={n(os.totalCustomers)} icon={<Users className="w-4 h-4" />} tone="blue" href="/customers" />
          </div>
          <MetricStrip
            items={[
              { label: 'Confirmed', value: n(os.confirmed), href: '/orders?status=CONFIRMED' },
              { label: 'In fulfilment', value: n(os.processing), tone: 'text-brand-orange-600' },
              { label: 'Delivered', value: n(os.delivered), tone: 'text-success', href: '/orders?status=DELIVERED' },
              { label: 'Cancelled / failed', value: n(os.cancelled), tone: 'text-danger', href: '/orders?status=CANCELLED' },
            ]}
          />
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section aria-labelledby="kpi-catalog" className="space-y-2">
          <h2 id="kpi-catalog" className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Catalog</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <StatCard label="Total products" value={n(s.totalProducts)} hint={`${n(s.draftProducts)} in draft`} icon={<Package className="w-4 h-4" />} href="/products" />
            <StatCard label="Active products" value={n(s.activeProducts)} hint="Visible on storefront" icon={<CheckCircle2 className="w-4 h-4" />} tone="green" href="/products?status=ACTIVE" />
          </div>
          <MetricStrip
            items={[
              { label: 'Categories', value: n(s.totalCategories), href: '/categories' },
              { label: 'Brands', value: n(s.totalBrands), href: '/brands' },
            ]}
          />
        </section>

        <section aria-labelledby="kpi-stock" className="space-y-2">
          <h2 id="kpi-stock" className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Stock</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <StatCard label="Low stock" value={n(s.lowStock)} hint="Stock rows at/below threshold" icon={<AlertTriangle className="w-4 h-4" />} tone="amber" href="/inventory?stock=low" />
            <StatCard label="Out of stock" value={n(s.outOfStock)} hint="Stock rows not sellable" icon={<XCircle className="w-4 h-4" />} tone="red" href="/inventory?stock=out" />
          </div>
          <MetricStrip
            items={[
              { label: 'Units on hand', value: n(s.totalInventoryUnits), hint: 'All warehouses', href: '/inventory' },
              { label: 'Reserved', value: n(s.reservedUnits), hint: 'Held for open orders' },
              { label: 'Sellable', value: n(s.sellableUnits), hint: 'After reservations & safety stock' },
            ]}
          />
        </section>
      </div>

      {ops && (
        <Panel title="Operations (last 30 days)" bodyClassName="p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            {[
              ['Active warehouses', `${ops.warehouses.active}`, ops.warehouses.setup || ops.warehouses.paused ? `${ops.warehouses.setup} in setup · ${ops.warehouses.paused} paused` : '', '/warehouses'],
              ['Delivery areas live', `${ops.activeDeliveryAreas}`, 'Active area with an active warehouse', '/delivery'],
              ['Open purchase orders', `${ops.procurement.openPurchaseOrders}`, '', '/purchase-orders'],
              ['Goods receipts', `${ops.procurement.receipts30d}`, `${n(ops.procurement.unitsReceived30d)} units in · ${n(ops.procurement.unitsRejected30d)} rejected`, '/purchase-orders'],
              ['Manual stock changes', `${ops.manualAdjustments30d}`, 'Initial, in, out, corrections', '/inventory/movements?type=ADJUSTMENT'],
              ['Pre-launch interest', `${ops.deliveryInterest}`, 'People, not sales', '/delivery'],
            ].map(([l, v, h, href]) => (
              <Link key={l} href={href} className="rounded-lg bg-surface-page p-2.5 hover:bg-surface-muted">
                <p className="text-2xs text-ink-500">{l}</p>
                <p className="text-base font-bold tabular-nums text-ink">{v}</p>
                {h && <p className="text-2xs text-ink-400">{h}</p>}
              </Link>
            ))}
          </div>
          {ops.ordersByWarehouse.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="text-2xs uppercase text-ink-500">
                  <tr>
                    <th className="py-1.5">Fulfilment warehouse</th>
                    <th className="py-1.5 text-right">Orders</th>
                    <th className="py-1.5 text-right">Open</th>
                    <th className="py-1.5 text-right">Paid value</th>
                    <th className="py-1.5 text-right">Awaiting payment</th>
                    <th className="py-1.5 text-right">Cancelled / failed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {ops.ordersByWarehouse.map((r) => (
                    <tr key={r.code ?? 'none'}>
                      <td className="py-1.5 font-semibold">{r.code ? `${r.code} · ${r.name}` : 'Not recorded'}</td>
                      <td className="text-right tabular-nums">{n(r.orders)}</td>
                      <td className="text-right tabular-nums">{n(r.open)}</td>
                      <td className="text-right text-success font-semibold">{formatINR(r.paidPaise)}</td>
                      <td className="text-right text-warning">{formatINR(r.pendingPaise)}</td>
                      <td className="text-right text-danger">{n(r.cancelled)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-2xs text-ink-400">Paid value counts only captured payments. Awaiting payment and cancelled orders are not revenue.</p>
            </div>
          )}
          {ops.movements30d.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ops.movements30d.map((m) => (
                <span key={m.type} className="rounded-full bg-surface-muted px-2 py-0.5 text-2xs text-ink-600">
                  {m.type.replace(/_/g, ' ').toLowerCase()}: {n(m.count)} ({m.units > 0 ? '+' : ''}
                  {n(m.units)})
                </span>
              ))}
            </div>
          )}
        </Panel>
      )}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      {os && os.recent.length > 0 && (
        <Panel title="Recent orders" actions={<Link href="/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-orange-600 hover:underline">View all <ArrowRight className="w-3 h-3" /></Link>}>
          <ul className="divide-y divide-line-subtle">
            {os.recent.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-muted">
                  <div className="min-w-0">
                    <p className="font-mono text-2xs font-bold text-ink">{o.orderNumber}</p>
                    <p className="truncate text-2xs text-ink-400">{o.shipName} · {o.createdAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold tabular-nums text-ink-800">{formatINR(o.totalPaise)}</span>
                    <StatusBadge status={o.status === 'DELIVERED' ? 'ACTIVE' : o.status === 'CANCELLED' || o.status === 'FAILED' ? 'OUT' : 'FEATURED'} label={orderStatusLabel(o.status)} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Needs restocking"
        actions={
          can('inventory.view') ? (
            <Link href="/inventory?stock=low" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-orange-600 hover:underline">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          ) : null
        }
      >
        {s.lowStockItems.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-ink-500">All active products are above their low-stock threshold.</p>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {s.lowStockItems.map((i) => (
              <li key={i.inventoryId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">
                    {i.name}
                    {i.variantName ? <span className="text-ink-500"> · {i.variantName}</span> : null}
                  </p>
                  <p className="font-mono text-2xs text-ink-400">{i.sku}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-ink-700">{i.sellable} left</span>
                  <StatusBadge status={i.sellable <= 0 ? 'OUT' : 'LOW'} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      </div>
    </div>
  );
}

/** Compact secondary metrics in one bordered strip (keeps the dashboard scannable). */
function MetricStrip({ items }: { items: { label: string; value: string; hint?: string; href?: string; tone?: string }[] }) {
  return (
    <div className={`grid gap-px overflow-hidden rounded-2xl border border-line-subtle bg-line-subtle shadow-card ${items.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : items.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {items.map((m) => {
        const body = (
          <>
            <p className="truncate text-2xs text-ink-500">{m.label}</p>
            <p className={`text-base font-bold tabular-nums ${m.tone ?? 'text-ink'}`}>{m.value}</p>
            {m.hint && <p className="truncate text-2xs text-ink-400">{m.hint}</p>}
          </>
        );
        return m.href ? (
          <Link key={m.label} href={m.href} className="min-w-0 bg-surface px-3 py-2.5 transition-colors hover:bg-surface-page focus:outline-none focus-visible:bg-surface-page">
            {body}
          </Link>
        ) : (
          <div key={m.label} className="min-w-0 bg-surface px-3 py-2.5">
            {body}
          </div>
        );
      })}
    </div>
  );
}
