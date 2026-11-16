import { categoryListQuery, categoryOptions, listCategories } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Pagination, Panel } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';
import { CategoriesTable } from './CategoriesTable';

export default async function CategoriesPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('categories.view')) return <AccessDenied permission="categories.view" />;
  const parsed = categoryListQuery.safeParse(searchParams);
  const query = parsed.success ? parsed.data : categoryListQuery.parse({});
  const [data, options] = await Promise.all([listCategories(query), categoryOptions()]);
  const can = (p: string) => ctx.permissions.has(p);

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Categories" description="Organise the catalog. Disabled categories and their products are hidden from the storefront." />
      <FilterBar
        placeholder="Search categories…"
        selects={[{ name: 'status', label: 'All statuses', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Disabled' }] }]}
      />
      <Panel>
        <CategoriesTable
          items={data.items.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() }))}
          parents={options.filter((o) => !o.parentId).map((o) => ({ id: o.id, name: o.name }))}
          perms={{
            create: can('categories.create'),
            update: can('categories.update'),
            remove: can('categories.delete'),
            upload: can('media.upload') && can('categories.update'),
          }}
          reorderable={!query.q && !query.status && query.page === 1}
        />
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/categories" params={searchParams} />
      </Panel>
    </div>
  );
}
