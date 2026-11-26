import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/** Storefront section title pattern (design-system §3): title, optional subtitle, optional "See all" link. */
export function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel = 'See all',
  id,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  id?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold text-ink sm:text-lg">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 rounded-md text-sm font-semibold text-brand-orange-700 hover:text-brand-orange-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
        >
          {linkLabel} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
