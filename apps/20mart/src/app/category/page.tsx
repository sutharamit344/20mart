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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Categories' }]} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Shop by Category</h1>
          <p className="text-xs text-gray-500 mt-0.5">Everyday home, kitchen, stationery and daily-use essentials</p>
        </div>
        <Link href="/shop" className="text-xs font-bold text-[#FF7A00] hover:underline flex items-center gap-1">
          <span>View All Products</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {categories.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          Categories are being set up. Please check back soon.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {categories.map((category) => {
            const theme = getCategoryTheme(category.slug);
            const Icon = theme.icon;
            return (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="group relative flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-orange-200 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FFF6E9] text-[10px] sm:text-[11px] font-bold text-[#FF7A00]">
                      {category.productCount} item{category.productCount === 1 ? '' : 's'}
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-[#0B5D3B] transition-colors">{category.name}</h2>
                    {category.description && <p className="text-xs text-gray-500 line-clamp-2">{category.description}</p>}
                  </div>
                  <div
                    className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-2xl p-2 flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: theme.bg }}
                  >
                    {category.imageUrl ? (
                      <Image src={resolveImageSrc(category.imageUrl)} alt="" fill sizes="80px" className="object-contain p-1.5 group-hover:scale-110 transition-transform duration-300" />
                    ) : (
                      <Icon className="h-8 w-8" style={{ color: theme.iconColor }} />
                    )}
                  </div>
                </div>
                <div className="mt-3.5 flex items-center justify-between text-xs font-bold text-[#FF7A00] group-hover:translate-x-0.5 transition-transform">
                  <span>Browse</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

    </div>
  );
}
