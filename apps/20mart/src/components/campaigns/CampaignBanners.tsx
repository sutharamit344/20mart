'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShoppingBasket, Sparkles } from 'lucide-react';
import { resolveImageSrc } from '@20mart/ui';

export interface HomeCampaign {
  id: string;
  name: string;
  slug: string;
  type: 'PROMOTION' | 'FILL_YOUR_CART';
  bannerTitle: string | null;
  bannerSubtitle: string | null;
  bannerImageUrl: string | null;
  startsAt: string | Date;
  endsAt: string | Date | null;
  coupon: { title: string; code: string | null } | null;
}

/** Live campaign banners. Pages are cached briefly, so dates are re-checked here: expired campaigns are hidden immediately. */
export function CampaignBanners({ campaigns }: { campaigns: HomeCampaign[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const live = campaigns.filter((c) => {
    const t = now ?? 0;
    if (!now) return true; // server render: server already filtered to live campaigns
    return new Date(c.startsAt).getTime() <= t && (!c.endsAt || new Date(c.endsAt).getTime() > t);
  });
  if (!live.length) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6" aria-label="Current campaigns">
      <div className={`grid gap-3 ${live.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {live.map((c) => {
          const fyc = c.type === 'FILL_YOUR_CART';
          return (
            <Link
              key={c.id}
              href={`/campaigns/${c.slug}`}
              className={`group flex min-h-[120px] items-stretch overflow-hidden rounded-2xl border transition-shadow hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 ${fyc ? 'border-brand-orange-200/60 bg-brand-cream' : 'border-brand-green/15 bg-brand-green-50'}`}
            >
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-4 sm:p-5">
                <span className={`inline-flex w-fit items-center gap-1 text-2xs font-semibold uppercase tracking-wide ${fyc ? 'text-brand-orange-700' : 'text-brand-green'}`}>
                  {fyc ? <ShoppingBasket className="h-3.5 w-3.5" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
                  {fyc ? 'Fill your cart' : 'Offer'}
                </span>
                <p className="text-base font-semibold leading-snug text-ink sm:text-lg">{c.bannerTitle || c.name}</p>
                {c.bannerSubtitle && <p className="line-clamp-2 text-xs text-ink-600 sm:text-sm">{c.bannerSubtitle}</p>}
                {c.coupon?.code && (
                  <p className="text-xs text-ink-600">
                    Use code{' '}
                    <span className="rounded-md border border-dashed border-line-strong bg-surface px-1.5 py-0.5 font-mono text-2xs font-semibold text-ink">
                      {c.coupon.code}
                    </span>
                  </p>
                )}
                <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-orange-700">
                  {fyc ? 'Start your list' : 'Shop now'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              {c.bannerImageUrl && (
                <div className="relative w-[36%] max-w-[220px] shrink-0 bg-surface-sunken">
                  {/* eslint-disable-next-line @next/next/no-img-element -- banner URLs come from admin uploads on any storage host */}
                  <img src={resolveImageSrc(c.bannerImageUrl)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
