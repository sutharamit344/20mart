import { addDays, istDayOf } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied } from '../../../../../components/ui';
import { AnalyticsTabs } from '../../AnalyticsTabs';
import { ProductDetailClient } from './ProductDetailClient';

export const dynamic = 'force-dynamic';

export default async function ProductDemandDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('analytics.view')) return <AccessDenied permission="analytics.view" />;
  return (
    <div className="space-y-3">
      <AnalyticsTabs active="products" />
      <ProductDetailClient id={id} maxDay={addDays(istDayOf(new Date()), -1)} />
    </div>
  );
}
