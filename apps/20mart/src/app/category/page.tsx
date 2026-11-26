import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Breadcrumb, resolveImageSrc } from '@20mart/ui';
import { ArrowRight } from 'lucide-react';
import { getCategories } from '../../lib/catalog';
import { getCategoryTheme } from '../../lib/category-theme';

export const metadata: Metadata = {
  alternates: { canonical: '/category' },
  title: 'Shop by category – 20Mart',
  description: 'Home, kitchen, stationery and daily-use essentials at everyday prices.',
};
export const revalidate = 60;

export default async function CategoryListingPage() {
  const categories = await getCategories().catch(() => []);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 sm:py-6">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Categories' }]} />

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink sm:text-xl">Shop by category</h1>
          <p className="mt-0.5 text-xs text-ink-500">Everyday home, kitchen, stationery and daily-use essentials</p>
        </div>
        <Link
          href="/shop"
          className="inline-flex shrink-0 items-center gap-1 rounded-md text-sm font-semibold text-brand-orange-700 hover:text-brand-orange-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
        >
          All products <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {categories.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-sm text-ink-500">
          Categories are being set up. Please check back soon.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => {
            const theme = getCategoryTheme(category.slug);
            const Icon = theme.icon;
            return (
              <li key={category.id}>
                <Link
                  href={`/category/${category.slug}`}
                  className="group flex h-full items-center gap-4 rounded-2xl border border-line-subtle bg-surface p-4 transition-[border-color,box-shadow] hover:border-line hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
                >
                  <span
                    className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl sm:h-16 sm:w-16"
                    style={{ backgroundColor: theme.bg }}
                  >
                    {category.imageUrl ? (
                      <Image src={resolveImageSrc(category.imageUrl)} alt="" fill sizes="64px" className="object-contain p-1.5" />
                    ) : (
                      <Icon className="h-7 w-7" style={{ color: theme.iconColor }} aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-ink">{category.name}</span>
                    <span className="block text-2xs font-medium text-ink-500">
                      {category.productCount} item{category.productCount === 1 ? '' : 's'}
                    </span>
                    {category.description && <span className="mt-1 line-clamp-2 block text-xs text-ink-500">{category.description}</span>}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-700" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
