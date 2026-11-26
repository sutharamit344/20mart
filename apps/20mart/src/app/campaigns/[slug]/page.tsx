import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb, resolveImageSrc } from '@20mart/ui';
import { formatPaise } from '@20mart/shared';
import { getPublicCampaign } from '@20mart/server';
import { Info, Tag } from 'lucide-react';
import { ProductGrid } from '../../../components/StoreProductCard';
import { FillYourCart } from '../../../components/campaigns/FillYourCart';

// Always rendered on request: a campaign that ends or is switched off disappears immediately.
export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const c = await getPublicCampaign(params.slug);
  if (!c) return { title: 'Campaign not found' };
  return { title: `${c.bannerTitle || c.name} | 20Mart`, description: c.bannerSubtitle ?? c.description ?? undefined };
}

const date = (d: Date) => d.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });

export default async function CampaignPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const c = await getPublicCampaign(params.slug);
  if (!c) notFound();
  const fyc = c.type === 'FILL_YOUR_CART';
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2.5 pb-10 sm:pt-3.5 space-y-4">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: c.name }]} />
      <header className={`relative overflow-hidden rounded-2xl border p-4 sm:p-6 ${fyc ? 'border-amber-200 bg-gradient-to-br from-[#FFF4D6] to-[#FFE7B0]' : 'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white'}`}>
        <div className="relative z-10 max-w-2xl space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">{c.bannerTitle || c.name}</h1>
          {c.bannerSubtitle && <p className="text-sm text-gray-700">{c.bannerSubtitle}</p>}
          {c.description && <p className="whitespace-pre-line text-xs text-gray-600">{c.description}</p>}
          <p className="text-[11px] text-gray-500">{c.endsAt ? `Ends ${date(c.endsAt)}` : `Started ${date(c.startsAt)}`}</p>
          {c.coupon && (
            <p className="inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-gray-800">
              <Tag className="h-3.5 w-3.5 text-brand-green" />
              {c.coupon.title}
              {c.coupon.code && (
                <>
                  — use code <span className="font-mono font-black text-brand-green">{c.coupon.code}</span>
                </>
              )}
              {c.coupon.minOrderValuePaise > 0 && <span className="text-gray-500">(orders of {formatPaise(c.coupon.minOrderValuePaise)}+)</span>}
              {!c.coupon.code && c.coupon.issuedOnJoin && <span className="text-gray-500">· added to your account when you join</span>}
            </p>
          )}
        </div>
        {c.bannerImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- banner URLs come from admin uploads on any storage host
          <img src={resolveImageSrc(c.bannerImageUrl)} alt="" className="absolute inset-y-0 right-0 hidden h-full w-1/3 object-cover sm:block" />
        )}
      </header>

      {fyc ? (
        <>
          <p className="flex items-start gap-2 rounded-xl border border-gray-100 bg-white p-3 text-[11px] text-gray-600">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-green" />
            Fill your cart with what you&apos;d like to buy. This is a wish list for launch — nothing is charged, ordered or reserved, and it is separate from your shopping cart.
          </p>
          <FillYourCart slug={c.slug} products={c.products} maxQty={c.maxQtyPerItem} />
        </>
      ) : c.products.length ? (
        <ProductGrid products={c.products} priorityCount={4} />
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-xs text-gray-500">Products for this campaign are coming soon.</p>
      )}
    </div>
  );
}
