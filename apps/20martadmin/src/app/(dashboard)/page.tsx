import Link from 'next/link';
import { ShoppingBag, Clock, IndianRupee, Users, Package, CheckCircle2, FolderTree, BadgeCheck, Boxes, AlertTriangle, XCircle, Plus, ArrowRight } from 'lucide-react';
import { getDashboardStats, getOrderStats, orderStatusLabel } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, formatINR, PageHeader, Panel, StatCard, StatusBadge } from '../../components/ui';

export default async function DashboardPage() {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('dashboard.view')) return <AccessDenied permission="dashboard.view" />;
  const can = (p: string) => ctx.permissions.has(p);
  const [s, os] = await Promise.all([getDashboardStats(), can('orders.view') ? getOrderStats() : Promise.resolve(null)]);
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

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="Units in stock" value={n(s.totalInventoryUnits)} hint="Across all SKUs" icon={<Boxes className="w-4 h-4" />} tone="green" href="/inventory" />
        <StatCard label="Low stock" value={n(s.lowStock)} hint="At or below threshold" icon={<AlertTriangle className="w-4 h-4" />} tone="amber" href="/inventory?stock=low" />
        <StatCard label="Out of stock" value={n(s.outOfStock)} hint="Not purchasable" icon={<XCircle className="w-4 h-4" />} tone="red" href="/inventory?stock=out" />
      </div>

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
