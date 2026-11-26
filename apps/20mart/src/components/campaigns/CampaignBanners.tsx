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
      <div className={`grid gap-2.5 sm:gap-3 ${live.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {live.map((c) => {
          const fyc = c.type === 'FILL_YOUR_CART';
          return (
            <Link
              key={c.id}
              href={`/campaigns/${c.slug}`}
              className={`group relative flex min-h-[112px] items-center overflow-hidden rounded-2xl border p-4 shadow-xs transition hover:shadow-md ${fyc ? 'border-amber-200 bg-gradient-to-br from-[#FFF4D6] to-[#FFE7B0]' : 'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white'}`}
            >
              <div className="relative z-10 max-w-[70%] space-y-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${fyc ? 'bg-gray-900 text-amber-300' : 'bg-brand-green text-white'}`}>
                  {fyc ? <ShoppingBasket className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                  {fyc ? 'Fill your cart' : 'Offer'}
                </span>
                <p className="text-base sm:text-lg font-black leading-tight text-gray-900">{c.bannerTitle || c.name}</p>
                {c.bannerSubtitle && <p className="text-[11px] sm:text-xs text-gray-700 line-clamp-2">{c.bannerSubtitle}</p>}
                {c.coupon?.code && (
                  <p className="text-[11px] font-bold text-brand-green">
                    Use code <span className="font-mono">{c.coupon.code}</span>
                  </p>
                )}
                <span className="inline-flex items-center gap-1 pt-0.5 text-[11px] font-bold text-[#C25D00]">
                  {fyc ? 'Start your list' : 'Shop now'} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              {c.bannerImageUrl && (
                <div className="absolute inset-y-0 right-0 w-[38%]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- banner URLs come from admin uploads on any storage host */}
                  <img src={resolveImageSrc(c.bannerImageUrl)} alt="" loading="lazy" className="h-full w-full object-cover" />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
