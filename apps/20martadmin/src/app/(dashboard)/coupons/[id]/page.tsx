import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@20mart/database';
import { AppError, getCoupon } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, formatINR, PageHeader, Panel, StatCard, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead } from '../../../../components/ui';
import { CouponForm } from '../CouponForm';
import { couponState } from '../coupon-state';
import { CouponActions } from './CouponActions';

export const dynamic = 'force-dynamic';

const when = (d: Date) => d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

export default async function CouponDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('coupons.view')) return <AccessDenied permission="coupons.view" />;
  let c: Awaited<ReturnType<typeof getCoupon>>;
  try {
    c = await getCoupon(params.id);
  } catch (e) {
    if (e instanceof AppError || (e as Error).name === 'ZodError') notFound();
    throw e;
  }
  const categories = await prisma.category.findMany({ orderBy: { displayOrder: 'asc' }, select: { id: true, name: true } });
  const s = couponState(c);
  const canEdit = ctx.permissions.has('coupons.update');
  const canSeeOrders = ctx.permissions.has('orders.view');
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title={c.code}
        description={c.title}
        actions={
          <>
            <StatusBadge status={s.status} label={s.label} />
            <CouponActions id={c.id} isActive={c.isActive} canUpdate={canEdit} canDelete={ctx.permissions.has('coupons.delete') && c.redemptions.length === 0} />
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard label="Issued to customers" value={c.stats.issued} hint="Distributed — not the same as used" />
        <StatCard label="Redeemed (orders)" value={`${c.stats.redeemed}${c.usageLimit != null ? ` / ${c.usageLimit}` : ''}`} hint="Placed orders that used it" tone="green" />
        <StatCard label="Reversed" value={c.stats.reversed} hint="Cancelled / failed orders" />
        <StatCard label="Discount given" value={formatINR(c.stats.discountGivenPaise)} hint="On non-reversed redemptions" tone="orange" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 sm:gap-4">
        <Panel title="Settings" className="xl:col-span-3" bodyClassName="p-4">
          <CouponForm
            initial={{
              id: c.id,
              code: c.code,
              title: c.title,
              description: c.description,
              discountType: c.discountType,
              discountValue: c.discountValue,
              maxDiscountPaise: c.maxDiscountPaise,
              minOrderValuePaise: c.minOrderValuePaise,
              startsAt: c.startsAt.toISOString(),
              endsAt: c.endsAt?.toISOString() ?? null,
              isActive: c.isActive,
              usageLimit: c.usageLimit,
              perCustomerLimit: c.perCustomerLimit,
              requiresGrant: c.requiresGrant,
              autoIssueOnSignup: c.autoIssueOnSignup,
              products: c.products.map((p) => p.product),
              categoryIds: c.categories.map((x) => x.category.id),
            }}
            categories={categories}
            canEdit={canEdit}
            used={c.stats.redeemed + c.stats.reversed > 0}
          />
        </Panel>
        <div className="xl:col-span-2 space-y-3 sm:space-y-4">
          {c.campaigns.length > 0 && (
            <Panel title="Used by campaigns" bodyClassName="p-3 text-xs space-y-1">
              {c.campaigns.map((x) => (
                <Link key={x.id} href={`/campaigns/${x.id}`} className="block font-semibold text-[#0B5D3B] hover:underline">
                  {x.name}
                </Link>
              ))}
            </Panel>
          )}
          <Panel title="Recent redemptions">
            <Table minWidth={420}>
              <THead>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th className="text-right">Discount</Th>
                <Th>Status</Th>
              </THead>
              <TBody>
                {c.redemptions.length === 0 && <TableEmpty colSpan={4} title="Not redeemed yet" description="Orders that use this coupon appear here." />}
                {c.redemptions.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      {canSeeOrders ? (
                        <Link href={`/orders/${r.order.id}`} className="font-mono text-[11px] font-bold hover:text-[#E66E00]">
                          {r.order.orderNumber}
                        </Link>
                      ) : (
                        <span className="font-mono text-[11px]">{r.order.orderNumber}</span>
                      )}
                      <p className="text-[10px] text-gray-400">{when(r.redeemedAt)}</p>
                    </Td>
                    <Td className="max-w-[10rem] truncate">{r.user.name ?? r.user.email}</Td>
                    <Td className="text-right tabular-nums">{formatINR(r.discountPaise)}</Td>
                    <Td>
                      <StatusBadge status={r.status === 'APPLIED' ? 'ACTIVE' : 'INACTIVE'} label={r.status === 'APPLIED' ? 'Applied' : 'Reversed'} />
                    </Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          </Panel>
        </div>
      </div>
    </div>
  );
}
