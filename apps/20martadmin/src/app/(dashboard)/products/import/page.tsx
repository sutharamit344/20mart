import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { categoryOptions, listPricePoints, warehouseOptions } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader } from '../../../../components/ui';
import { BulkImport } from './BulkImport';

/** Every step of the import goes through the normal admin APIs, so it needs all of their permissions. */
const NEEDED = ['products.view', 'products.create', 'products.update', 'media.upload', 'inventory.adjust'] as const;

export default async function ProductImportPage() {
  const ctx = await requireAdminPage();
  const missing = NEEDED.find((p) => !ctx.permissions.has(p));
  if (missing) return <AccessDenied permission={missing} />;
  const [categories, warehouses, pricePoints] = await Promise.all([categoryOptions(), warehouseOptions(), listPricePoints()]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Bulk import products"
        description="Create products with images and opening stock from a spreadsheet and an images folder."
        actions={
          <Link href="/products" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink-700 hover:bg-surface-muted">
            <ArrowLeft className="w-3.5 h-3.5" /> Products
          </Link>
        }
      />
      <BulkImport
        categories={categories.map((c) => ({ id: c.id, name: c.name, active: c.status === 'ACTIVE', parentName: categories.find((p) => p.id === c.parentId)?.name ?? null }))}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code, status: w.status }))}
        pricePoints={pricePoints.map((p) => ({ id: p.id, amountPaise: p.amountPaise, isActive: p.isActive }))}
      />
    </div>
  );
}
