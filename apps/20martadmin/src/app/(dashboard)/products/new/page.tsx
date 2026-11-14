import { brandOptions, categoryOptions, listPricePoints } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied } from '../../../../components/ui';
import { ProductEditor } from '../ProductEditor';

export default async function NewProductPage() {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('products.create')) return <AccessDenied permission="products.create" />;
  const [categories, brands, pricePoints] = await Promise.all([categoryOptions(), brandOptions(), listPricePoints()]);
  const can = (p: string) => ctx.permissions.has(p);
  return (
    <ProductEditor
      product={null}
      categories={categories}
      brands={brands}
      pricePoints={pricePoints}
      perms={{ create: true, update: can('products.update'), remove: can('products.delete'), upload: can('media.upload'), inventory: can('inventory.view') }}
    />
  );
}
