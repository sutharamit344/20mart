import { notFound } from 'next/navigation';
import { prisma } from '@20mart/database';
import { AppError, env, getCampaign, getCampaignAnalytics } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, formatINR, PageHeader, Panel, StatCard, StatusBadge } from '../../../../components/ui';
import { BarList, ColumnChart } from '../../../../components/charts';
import { CampaignForm } from '../CampaignForm';
import { CampaignActions } from './CampaignActions';

export const dynamic = 'force-dynamic';

const STATE_TONE: Record<string, string> = { LIVE: 'ACTIVE', SCHEDULED: 'LOW', ENDED: 'ARCHIVED', INACTIVE: 'INACTIVE' };

export default async function CampaignDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('campaigns.view')) return <AccessDenied permission="campaigns.view" />;
  let c: Awaited<ReturnType<typeof getCampaign>>;
  try {
    c = await getCampaign(params.id);
  } catch (e) {
    if (e instanceof AppError || (e as Error).name === 'ZodError') notFound();
    throw e;
  }
  const [a, coupons] = await Promise.all([
    getCampaignAnalytics(c.id),
    prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, code: true, title: true, isActive: true } }),
  ]);
  const fyc = c.type === 'FILL_YOUR_CART';
  const canEdit = ctx.permissions.has('campaigns.update');
  const storefront = env().APP_URL.replace(/\/$/, '');
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title={c.name}
        description={`${fyc ? 'Fill Your Cart' : 'Promotion'} · /campaigns/${c.slug}`}
        actions={
          <>
            <StatusBadge status={STATE_TONE[c.state]} label={c.state.charAt(0) + c.state.slice(1).toLowerCase()} />
            {c.state === 'LIVE' && (
              <a href={`${storefront}/campaigns/${c.slug}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-green hover:underline">
                View on storefront ↗
              </a>
            )}
            <CampaignActions
              id={c.id}
              isActive={c.isActive}
              live={c.state === 'LIVE'}
              canUpdate={canEdit}
              canAnnounce={canEdit && ctx.permissions.has('notifications.manage')}
              canDelete={ctx.permissions.has('campaigns.delete') && c._count.participants === 0 && c._count.grants === 0}
            />
          </>
        }
      />

      {fyc ? (
        <section aria-labelledby="demand-h" className="space-y-2">
          <h2 id="demand-h" className="text-xs font-bold uppercase tracking-wider text-warning">Pre-launch demand — interest, not sales</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <StatCard label="Participants" value={a.demand.participants} hint="Signed-in customers who joined" />
            <StatCard label="Saved carts" value={a.demand.savedCarts} hint={`${a.demand.savedUnits} units wanted`} />
            <StatCard label="Estimated interest" value={formatINR(a.demand.estimatedInterestPaise)} hint="Saved carts at today's prices — not revenue" tone="amber" />
            <StatCard label="Coupons distributed / redeemed" value={`${a.coupons.distributed} / ${a.coupons.redeemed}`} hint="Issued on join vs used on orders" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <Panel title="Joins per day" bodyClassName="p-3">
              <ColumnChart ariaLabel="Campaign joins per day" valueLabel="Joins" points={a.demand.joinsByDay.map((d) => ({ label: d.day, value: d.joins, display: `${d.joins} joined` }))} />
            </Panel>
            <Panel title="Most-added products (units)" bodyClassName="p-3">
              <BarList valueLabel="Units saved" points={a.demand.mostAdded.map((p) => ({ label: p.name, value: p.units, note: `${p.customers} customer(s) · ${formatINR(p.valuePaise)} interest` }))} empty="No saved items yet" />
            </Panel>
            <Panel title="Most-favourited products" bodyClassName="p-3">
              <BarList valueLabel="Favourites" points={a.demand.mostFavorited.map((p) => ({ label: p.name, value: p.favorites }))} empty="No favourites yet" />
            </Panel>
            <Panel title="Demand by category & price point" bodyClassName="p-3 space-y-4">
              <BarList valueLabel="Units by category" points={a.demand.byCategory.map((x) => ({ label: x.category, value: x.units, note: `${x.customers} customer(s) · ${formatINR(x.valuePaise)}` }))} empty="No saved items yet" />
              <BarList valueLabel="Units by price point" points={a.demand.byPricePoint.map((x) => ({ label: formatINR(x.pricePaise), value: x.units, note: `${x.customers} customer(s)` }))} empty="No saved items yet" />
            </Panel>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="sales-h" className="space-y-2">
        <h2 id="sales-h" className="text-xs font-bold uppercase tracking-wider text-ink-500">Sales during the campaign (paid orders only)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <StatCard label="Paid orders with campaign coupon" value={a.sales.couponPaidOrders} hint={c.coupon ? c.coupon.code : 'No coupon attached'} />
          <StatCard label="Their paid revenue" value={formatINR(a.sales.couponPaidRevenuePaise)} hint={`Discount ${formatINR(a.sales.couponDiscountPaise)}`} tone="green" />
          <StatCard label="Campaign products sold" value={a.sales.campaignProductUnitsSold} hint="Units in paid orders, campaign window" />
          <StatCard label="Campaign product revenue" value={formatINR(a.sales.campaignProductRevenuePaise)} hint="Item totals in paid orders" />
        </div>
      </section>

      <Panel title="Campaign settings" bodyClassName="p-4">
        <CampaignForm
          initial={{
            id: c.id,
            name: c.name,
            slug: c.slug,
            type: c.type,
            description: c.description,
            bannerTitle: c.bannerTitle,
            bannerSubtitle: c.bannerSubtitle,
            bannerImageUrl: c.bannerImageUrl,
            isActive: c.isActive,
            showOnHomepage: c.showOnHomepage,
            startsAt: c.startsAt.toISOString(),
            endsAt: c.endsAt?.toISOString() ?? null,
            couponId: c.couponId,
            maxQtyPerItem: c.maxQtyPerItem,
            displayOrder: c.displayOrder,
            products: c.products.map((p) => p.product),
          }}
          coupons={coupons}
          canEdit={canEdit}
          canUpload={canEdit && ctx.permissions.has('media.upload')}
          hasParticipants={c._count.participants > 0}
        />
      </Panel>
    </div>
  );
}
