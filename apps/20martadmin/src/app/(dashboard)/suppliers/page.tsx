import { listSuppliers, supplierListQuery } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Pagination, Panel } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';
import { SuppliersClient } from './SuppliersClient';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('suppliers.view')) return <AccessDenied permission="suppliers.view" />;
  const parsed = supplierListQuery.safeParse(searchParams);
  const data = await listSuppliers(parsed.success ? parsed.data : supplierListQuery.parse({}));
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Suppliers" description="Vendors 20Mart buys stock from. Suppliers are not sellers on the site and are not warehouses." />
      <FilterBar placeholder="Search name, contact or GSTIN…" selects={[{ name: 'status', label: 'All statuses', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }] }]} />
      <Panel>
        <SuppliersClient items={JSON.parse(JSON.stringify(data.items))} canManage={ctx.permissions.has('suppliers.manage')} />
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/suppliers" params={searchParams} />
      </Panel>
    </div>
  );
}
