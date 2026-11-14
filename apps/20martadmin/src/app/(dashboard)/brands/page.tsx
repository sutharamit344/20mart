import { brandListQuery, listBrands } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Pagination, Panel } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';
import { BrandsTable } from './BrandsTable';

export default async function BrandsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('brands.view')) return <AccessDenied permission="brands.view" />;
  const parsed = brandListQuery.safeParse(searchParams);
  const query = parsed.success ? parsed.data : brandListQuery.parse({});
  const data = await listBrands(query);
  const can = (p: string) => ctx.permissions.has(p);

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Brands"
        description="Original manufacturer brands. Brand is optional on products — leave it empty for unbranded items."
      />
      <FilterBar
        placeholder="Search brands…"
        selects={[{ name: 'status', label: 'All statuses', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Disabled' }] }]}
      />
      <Panel>
        <BrandsTable
          items={data.items.map((b) => ({ ...b, updatedAt: b.updatedAt.toISOString() }))}
          perms={{ create: can('brands.create'), update: can('brands.update'), remove: can('brands.delete'), upload: can('media.upload') && can('brands.update') }}
        />
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/brands" params={searchParams} />
      </Panel>
    </div>
  );
}
