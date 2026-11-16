import Link from 'next/link';
import { ShoppingBag, Clock, IndianRupee, Users, Package, CheckCircle2, FolderTree, BadgeCheck, Boxes, AlertTriangle, XCircle, Plus, ArrowRight } from 'lucide-react';
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
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={`Welcome back, ${ctx.admin.name.split(' ')[0]}`}
        description="Live orders, catalog and stock overview for 20Mart."
        actions={
          <>
            {can('inventory.view') && (
              <Link href="/inventory?stock=low" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                <Boxes className="w-3.5 h-3.5" /> Stock alerts
              </Link>
            )}
            {can('products.create') && (
              <Link href="/products/new" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#FF7A00] px-3 text-xs font-semibold text-white hover:bg-[#E66E00]">
                <Plus className="w-3.5 h-3.5" /> Add product
              </Link>
            )}
          </>
        }
      />

      {os && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <StatCard label="Paid revenue" value={formatINR(os.paidRevenuePaise)} hint={`${n(os.paidOrders)} paid orders`} icon={<IndianRupee className="w-4 h-4" />} tone="green" />
            <StatCard label="Total orders" value={n(os.totalOrders)} icon={<ShoppingBag className="w-4 h-4" />} href="/orders" />
            <StatCard label="Pending" value={n(os.pending)} hint="Awaiting confirmation/payment" icon={<Clock className="w-4 h-4" />} tone="amber" href="/orders?status=PENDING" />
            <StatCard label="Customers" value={n(os.totalCustomers)} icon={<Users className="w-4 h-4" />} tone="blue" href="/customers" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <StatCard label="Confirmed" value={n(os.confirmed)} href="/orders?status=CONFIRMED" />
            <StatCard label="In fulfilment" value={n(os.processing)} tone="orange" />
            <StatCard label="Delivered" value={n(os.delivered)} tone="green" href="/orders?status=DELIVERED" />
            <StatCard label="Cancelled / failed" value={n(os.cancelled)} tone="red" href="/orders?status=CANCELLED" />
          </div>
        </>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <StatCard label="Total products" value={n(s.totalProducts)} hint={`${n(s.draftProducts)} in draft`} icon={<Package className="w-4 h-4" />} href="/products" />
        <StatCard label="Active products" value={n(s.activeProducts)} hint="Visible on storefront" icon={<CheckCircle2 className="w-4 h-4" />} tone="green" href="/products?status=ACTIVE" />
        <StatCard label="Categories" value={n(s.totalCategories)} icon={<FolderTree className="w-4 h-4" />} tone="blue" href="/categories" />
        <StatCard label="Brands" value={n(s.totalBrands)} icon={<BadgeCheck className="w-4 h-4" />} tone="orange" href="/brands" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
        <StatCard label="Units on hand" value={n(s.totalInventoryUnits)} hint="All warehouses" icon={<Boxes className="w-4 h-4" />} tone="green" href="/inventory" />
        <StatCard label="Reserved" value={n(s.reservedUnits)} hint="Held for open orders" />
        <StatCard label="Sellable" value={n(s.sellableUnits)} hint="After reservations & safety stock" tone="blue" />
        <StatCard label="Low stock" value={n(s.lowStock)} hint="Stock rows at/below threshold" icon={<AlertTriangle className="w-4 h-4" />} tone="amber" href="/inventory?stock=low" />
        <StatCard label="Out of stock" value={n(s.outOfStock)} hint="Stock rows not sellable" icon={<XCircle className="w-4 h-4" />} tone="red" href="/inventory?stock=out" />
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
              <Link key={l} href={href} className="rounded-lg bg-gray-50 p-2.5 hover:bg-gray-100">
                <p className="text-[10px] text-gray-500">{l}</p>
                <p className="text-base font-bold text-gray-900">{v}</p>
                {h && <p className="text-[10px] text-gray-400">{h}</p>}
              </Link>
            ))}
          </div>
          {ops.ordersByWarehouse.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="text-[10px] uppercase text-gray-500">
                  <tr>
                    <th className="py-1.5">Fulfilment warehouse</th>
                    <th className="py-1.5 text-right">Orders</th>
                    <th className="py-1.5 text-right">Open</th>
                    <th className="py-1.5 text-right">Paid value</th>
                    <th className="py-1.5 text-right">Awaiting payment</th>
                    <th className="py-1.5 text-right">Cancelled / failed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ops.ordersByWarehouse.map((r) => (
                    <tr key={r.code ?? 'none'}>
                      <td className="py-1.5 font-semibold">{r.code ? `${r.code} · ${r.name}` : 'Not recorded'}</td>
                      <td className="text-right">{n(r.orders)}</td>
                      <td className="text-right">{n(r.open)}</td>
                      <td className="text-right text-emerald-700 font-semibold">{formatINR(r.paidPaise)}</td>
                      <td className="text-right text-amber-700">{formatINR(r.pendingPaise)}</td>
                      <td className="text-right text-red-600">{n(r.cancelled)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[10px] text-gray-400">Paid value counts only captured payments. Awaiting payment and cancelled orders are not revenue.</p>
            </div>
          )}
          {ops.movements30d.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ops.movements30d.map((m) => (
                <span key={m.type} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                  {m.type.replace(/_/g, ' ').toLowerCase()}: {n(m.count)} ({m.units > 0 ? '+' : ''}
                  {n(m.units)})
                </span>
              ))}
            </div>
          )}
        </Panel>
      )}

      {os && os.recent.length > 0 && (
        <Panel title="Recent orders" actions={<Link href="/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-[#E66E00] hover:underline">View all <ArrowRight className="w-3 h-3" /></Link>}>
          <ul className="divide-y divide-gray-100">
            {os.recent.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-bold text-gray-900">{o.orderNumber}</p>
                    <p className="truncate text-[10px] text-gray-400">{o.shipName} · {o.createdAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-gray-800">{formatINR(o.totalPaise)}</span>
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
            <Link href="/inventory?stock=low" className="inline-flex items-center gap-1 text-xs font-semibold text-[#E66E00] hover:underline">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          ) : null
        }
      >
        {s.lowStockItems.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-gray-500">All active products are above their low-stock threshold.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {s.lowStockItems.map((i) => (
              <li key={i.inventoryId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-900">
                    {i.name}
                    {i.variantName ? <span className="text-gray-500"> · {i.variantName}</span> : null}
                  </p>
                  <p className="font-mono text-[10px] text-gray-400">{i.sku}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-gray-700">{i.sellable} left</span>
                  <StatusBadge status={i.sellable <= 0 ? 'OUT' : 'LOW'} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
