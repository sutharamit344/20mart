import { prisma } from '@20mart/database';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Panel } from '../../../../components/ui';
import { CouponForm, EMPTY_COUPON } from '../CouponForm';

export default async function NewCouponPage() {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('coupons.create')) return <AccessDenied permission="coupons.create" />;
  const categories = await prisma.category.findMany({ orderBy: { displayOrder: 'asc' }, select: { id: true, name: true } });
  return (
    <div className="space-y-3 sm:space-y-4 max-w-3xl">
      <PageHeader title="New coupon" description="Values are stored in paise; the discount is always computed on the server." />
      <Panel bodyClassName="p-4">
        <CouponForm initial={EMPTY_COUPON} categories={categories} canEdit used={false} />
      </Panel>
    </div>
  );
}
