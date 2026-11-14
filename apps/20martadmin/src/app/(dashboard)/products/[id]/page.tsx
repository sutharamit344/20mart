import { notFound } from 'next/navigation';
import { AppError, brandOptions, categoryOptions, getProductForAdmin, listPricePoints } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied } from '../../../../components/ui';
import { ProductEditor } from '../ProductEditor';

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('products.view')) return <AccessDenied permission="products.view" />;
  const product = await getProductForAdmin(params.id).catch((e) => {
    if (e instanceof AppError && (e.status === 404 || e.status === 400)) return null;
    // Zod validation of a malformed id also means "not found" here.
    if ((e as Error)?.name === 'ZodError') return null;
    throw e;
  });
  if (!product) notFound();
  const [categories, brands, pricePoints] = await Promise.all([categoryOptions(), brandOptions(), listPricePoints()]);
  const can = (p: string) => ctx.permissions.has(p);
  return (
    <ProductEditor
      product={product}
      categories={categories}
      brands={brands}
      pricePoints={pricePoints}
      perms={{ create: can('products.create'), update: can('products.update'), remove: can('products.delete'), upload: can('media.upload'), inventory: can('inventory.view') }}
    />
  );
}
