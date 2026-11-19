import Link from 'next/link';
import { Package, Plus, Star, Upload } from 'lucide-react';
import { brandOptions, categoryOptions, listPricePoints, listProducts, productListQuery } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, formatINR, PageHeader, Pagination, Panel, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';
import { ProductRowActions } from './ProductRowActions';
import { resolveImageSrc } from '@20mart/ui';

export default async function ProductsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('products.view')) return <AccessDenied permission="products.view" />;
  const parsed = productListQuery.safeParse(searchParams);
  const query = parsed.success ? parsed.data : productListQuery.parse({});
  const [data, cats, brands, pricePoints] = await Promise.all([listProducts(query), categoryOptions(), brandOptions(), listPricePoints()]);
  const can = (p: string) => ctx.permissions.has(p);

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Products"
        description="Catalog, pricing, images and publishing. Stock is managed in Inventory."
        actions={
          can('products.create') ? (
            <div className="flex items-center gap-2">
              {can('products.update') && can('media.upload') && can('inventory.adjust') && (
                <Link href="/products/import" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  <Upload className="w-3.5 h-3.5" /> Bulk import
                </Link>
              )}
              <Link href="/products/new" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#FF7A00] px-3 text-xs font-semibold text-white hover:bg-[#E66E00]">
                <Plus className="w-3.5 h-3.5" /> Add product
              </Link>
            </div>
          ) : null
        }
      />
      <FilterBar
        placeholder="Search name or SKU…"
        selects={[
          { name: 'categoryId', label: 'All categories', options: cats.map((c) => ({ value: c.id, label: c.name })) },
          { name: 'brandId', label: 'All brands', options: brands.map((b) => ({ value: b.id, label: b.name })) },
          {
            name: 'status',
            label: 'Any status',
            options: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })),
          },
          { name: 'pricePointId', label: 'Any price point', options: pricePoints.map((p) => ({ value: p.id, label: p.label })) },
          { name: 'stock', label: 'Any stock', options: [{ value: 'in', label: 'In stock' }, { value: 'low', label: 'Low stock' }, { value: 'out', label: 'Out of stock' }] },
          { name: 'featured', label: 'Featured?', options: [{ value: 'yes', label: 'Featured' }, { value: 'no', label: 'Not featured' }] },
        ]}
      />
      <Panel>
        <Table minWidth={860}>
          <THead>
            <Th>Product</Th>
            <Th>Category</Th>
            <Th>Brand</Th>
            <Th className="text-right">Price</Th>
            <Th className="text-right">Stock</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </THead>
          <TBody>
            {data.items.length === 0 && (
              <TableEmpty
                colSpan={7}
                title="No products match"
                description={query.q || query.status || query.categoryId ? 'Try clearing filters.' : 'Create your first product to get started.'}
              />
            )}
            {data.items.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/60">
                <Td>
                  <Link href={`/products/${p.id}`} className="flex items-center gap-2.5 min-w-0 group">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-white">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={resolveImageSrc(p.image.url)} alt="" className="h-full w-full object-contain" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 max-w-[16rem]">
                      <p className="truncate font-semibold text-gray-900 group-hover:text-[#E66E00]">
                        {p.name}
                        {p.isFeatured && <Star className="ml-1 inline w-3 h-3 fill-[#FF7A00] text-[#FF7A00]" aria-label="Featured" />}
                      </p>
                      <p className="truncate font-mono text-[10px] text-gray-400">
                        {p.sku}
                        {p._count.variants > 0 && ` · ${p._count.variants} variant${p._count.variants > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </Link>
                </Td>
                <Td className="whitespace-nowrap">{p.category.name}</Td>
                <Td className="whitespace-nowrap">{p.brand?.name ?? <span className="text-gray-300">—</span>}</Td>
                <Td className="text-right whitespace-nowrap">
                  <span className="font-bold text-gray-900">{formatINR(p.sellingPricePaise)}</span>
                  {p.mrpPaise > p.sellingPricePaise && <span className="ml-1 text-[10px] text-gray-400 line-through">{formatINR(p.mrpPaise)}</span>}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <span className="mr-1.5 font-semibold text-gray-800">{p.stock.sellable}</span>
                  <StatusBadge status={p.stock.state} />
                </Td>
                <Td>
                  <StatusBadge status={p.status} />
                </Td>
                <Td className="text-right">
                  <ProductRowActions
                    id={p.id}
                    status={p.status}
                    perms={{ update: can('products.update'), remove: can('products.delete') }}
                  />
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/products" params={searchParams} />
      </Panel>
    </div>
  );
}
