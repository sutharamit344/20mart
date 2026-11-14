import Link from 'next/link';
import { Package, CheckCircle2, FolderTree, BadgeCheck, Boxes, AlertTriangle, XCircle, Plus, ArrowRight } from 'lucide-react';
import { getDashboardStats } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Panel, StatCard, StatusBadge } from '../../components/ui';

export default async function DashboardPage() {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('dashboard.view')) return <AccessDenied permission="dashboard.view" />;
  const s = await getDashboardStats();
  const can = (p: string) => ctx.permissions.has(p);
  const n = (v: number) => v.toLocaleString('en-IN');

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={`Welcome back, ${ctx.admin.name.split(' ')[0]}`}
        description="Live catalog and stock overview for 20Mart."
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
