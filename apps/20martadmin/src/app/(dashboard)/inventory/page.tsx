import { AlertTriangle, Boxes, XCircle, Layers } from 'lucide-react';
import { inventoryListQuery, inventoryStats, listInventory } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Pagination, Panel, StatCard } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';
import { InventoryTable } from './InventoryTable';

export default async function InventoryPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('inventory.view')) return <AccessDenied permission="inventory.view" />;
  const parsed = inventoryListQuery.safeParse(searchParams);
  const query = parsed.success ? parsed.data : inventoryListQuery.parse({});
  const [data, stats] = await Promise.all([listInventory(query), inventoryStats()]);
  const n = (v: number) => v.toLocaleString('en-IN');

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Inventory" description="Every stock change is recorded with who, when and why. Stock can never go negative." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <StatCard label="Units on hand" value={n(stats.totalUnits)} icon={<Boxes className="w-4 h-4" />} tone="green" />
        <StatCard label="Stock-keeping rows" value={n(stats.stockRows)} hint="Products & variants" icon={<Layers className="w-4 h-4" />} />
        <StatCard label="Low stock" value={n(stats.lowStock)} icon={<AlertTriangle className="w-4 h-4" />} tone="amber" href="/inventory?stock=low" />
        <StatCard label="Out of stock" value={n(stats.outOfStock)} icon={<XCircle className="w-4 h-4" />} tone="red" href="/inventory?stock=out" />
      </div>
      <FilterBar
        placeholder="Search product, variant or SKU…"
        selects={[{ name: 'stock', label: 'All stock levels', options: [{ value: 'out', label: 'Out of stock' }, { value: 'low', label: 'Low stock' }, { value: 'in', label: 'Healthy' }] }]}
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
