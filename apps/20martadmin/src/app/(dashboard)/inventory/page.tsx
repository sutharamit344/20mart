import Link from 'next/link';
import { AlertTriangle, Boxes, Lock, ShoppingCart, XCircle } from 'lucide-react';
import { inventoryListQuery, inventoryStats, listInventory, warehouseOptions } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Pagination, Panel, StatCard } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';
import { InventoryTable } from './InventoryTable';
import { AddStockButton } from './AddStockButton';

export default async function InventoryPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('inventory.view')) return <AccessDenied permission="inventory.view" />;
  const parsed = inventoryListQuery.safeParse(searchParams);
  const query = parsed.success ? parsed.data : inventoryListQuery.parse({});
  const [data, stats, warehouses] = await Promise.all([listInventory(query), inventoryStats(query.warehouseId), warehouseOptions()]);
  const n = (v: number) => v.toLocaleString('en-IN');
  const scope = query.warehouseId ? warehouses.find((w) => w.id === query.warehouseId)?.code : 'all warehouses';

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Inventory"
        description="Stock per warehouse. Sellable = on hand − reserved − safety stock. Every change is recorded with who, when and why."
        actions={
          <>
            <Link href="/inventory/movements" className="text-xs font-semibold text-[#E66E00] hover:underline">
              Movement history →
            </Link>
            {ctx.permissions.has('inventory.adjust') && <AddStockButton warehouses={warehouses} defaultWarehouseId={query.warehouseId} />}
          </>
        }
      />
      {warehouses.length === 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          No warehouses yet. <Link href="/warehouses" className="font-bold underline">Add your fulfilment location</Link> before recording stock.
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <StatCard label="Units on hand" value={n(stats.totalUnits)} hint={scope} icon={<Boxes className="w-4 h-4" />} tone="green" />
        <StatCard label="Reserved" value={n(stats.reservedUnits)} hint="Held for unpaid / unconfirmed orders" icon={<Lock className="w-4 h-4" />} />
        <StatCard label="Sellable" value={n(stats.sellableUnits)} hint="After reservations & safety stock" icon={<ShoppingCart className="w-4 h-4" />} tone="blue" />
        <StatCard label="Low stock" value={n(stats.lowStock)} icon={<AlertTriangle className="w-4 h-4" />} tone="amber" href="/inventory?stock=low" />
        <StatCard label="Out of stock" value={n(stats.outOfStock)} icon={<XCircle className="w-4 h-4" />} tone="red" href="/inventory?stock=out" />
      </div>
      <FilterBar
        placeholder="Search product, variant or SKU…"
        selects={[
          { name: 'warehouseId', label: 'All warehouses', options: warehouses.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` })) },
          { name: 'stock', label: 'All stock levels', options: [{ value: 'out', label: 'Out of stock' }, { value: 'low', label: 'Low stock' }, { value: 'in', label: 'Healthy' }] },
        ]}
      />
      <Panel>
        <InventoryTable
          items={data.items.map((i) => ({ ...i, updatedAt: i.updatedAt.toISOString() }))}
          perms={{ adjust: ctx.permissions.has('inventory.adjust'), update: ctx.permissions.has('inventory.update') }}
        />
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/inventory" params={searchParams} />
      </Panel>
    </div>
  );
}
