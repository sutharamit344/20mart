import React from 'react';
import Link from 'next/link';
import { ArrowRight, Flame } from 'lucide-react';
import type { StorefrontProduct } from '@20mart/shared';
import { ProductGrid } from '../StoreProductCard';

/** "Steal deals" promo block: soft cream panel with an orange accent instead of a saturated orange band. */
export function DealsShowcase({ products }: { products: StorefrontProduct[] }) {
  if (!products.length) return null;
  return (
    <section className="mx-auto max-w-7xl sm:px-6" aria-labelledby="deals-title">
      <div className="border-y border-brand-orange-200/60 bg-brand-cream px-4 py-5 sm:rounded-2xl sm:border sm:p-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-brand-orange-700">
              <Flame className="h-3.5 w-3.5" aria-hidden /> Today&apos;s steal deals
            </p>
            <h2 id="deals-title" className="text-base font-semibold text-ink sm:text-lg">
              Under ₹50 everyday essentials
            </h2>
          </div>
          <Link
            href="/deals"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-orange-700 hover:text-brand-orange-800 focus:outline-none focus-visible:underline"
          >
            View all deals <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <ProductGrid products={products} className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 min-[960px]:grid-cols-5" />
      </div>
    </section>
  );
}
