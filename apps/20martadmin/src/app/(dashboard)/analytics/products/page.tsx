import { addDays, categoryOptions, istDayOf } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader } from '../../../../components/ui';
import { AnalyticsTabs } from '../AnalyticsTabs';
import { ProductDemandClient } from './ProductDemandClient';

export const dynamic = 'force-dynamic';

export default async function ProductDemandPage() {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('analytics.view')) return <AccessDenied permission="analytics.view" />;
  const categories = await categoryOptions();
  return (
    <div className="space-y-3">
      <PageHeader title="Analytics" description="Product demand · daily aggregates · IST days" />
      <AnalyticsTabs active="products" />
      <ProductDemandClient maxDay={addDays(istDayOf(new Date()), -1)} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
