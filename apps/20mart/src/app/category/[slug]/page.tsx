import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { CatalogListing } from '../../../components/catalog/CatalogListing';
import { getCategories, getCategory } from '../../../lib/catalog';
import { getCategoryTheme } from '../../../lib/category-theme';

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    return (await getCategories()).map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const category = await getCategory(params.slug).catch(() => null);
  if (!category) return { title: 'Category not found – 20Mart' };
  return {
    title: category.seoTitle || `${category.name} essentials – 20Mart`,
    description: category.seoDescription || category.description || `Shop affordable ${category.name.toLowerCase()} essentials at 20Mart.`,
  };
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const category = await getCategory(params.slug).catch(() => null);
  if (!category) notFound();
  const theme = getCategoryTheme(category.slug);
  const Icon = theme.icon;
  const sub = typeof searchParams.sub === 'string' ? category.children.find((c) => c.slug === searchParams.sub) : undefined;

  return (
    <CatalogListing
      searchParams={searchParams}
      fixed={{ category: sub?.slug ?? category.slug }}
      showCategoryFilter={false}
      title={sub ? `${category.name} · ${sub.name}` : category.name}
      breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Categories', href: '/category' }, { label: category.name }]}
      emptyAction={{ href: '/category', label: 'Browse other categories' }}
      banner={
        <div className="space-y-2.5 mb-3.5 sm:mb-4">
          <div
            className="relative overflow-hidden rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs border border-gray-100"
            style={{ background: `linear-gradient(135deg, ${theme.bg} 0%, #FFFFFF 100%)` }}
          >
            <div className="space-y-1 min-w-0">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/80 text-xs font-bold text-gray-700">
                <Sparkles className="w-3.5 h-3.5 text-[#FF7A00]" />
                <span>{category.productCount} products</span>
              </div>
              <p className="text-xs text-gray-600 max-w-md">
                {category.description || `Everyday ${category.name.toLowerCase()} essentials at great value.`}
              </p>
            </div>
            <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-xl overflow-hidden bg-white/70 p-1.5 shadow-xs border border-white flex items-center justify-center">
              {category.imageUrl ? (
                <Image src={category.imageUrl} alt="" fill sizes="80px" className="object-contain p-1" />
              ) : (
                <Icon className="h-8 w-8" style={{ color: theme.iconColor }} />
              )}
            </div>
          </div>
          {category.children.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              <Link
                href={`/category/${category.slug}`}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${!sub ? 'border-[#FF7A00] bg-orange-50 text-[#FF7A00]' : 'border-gray-200 bg-white text-gray-600'}`}
              >
                All
              </Link>
              {category.children.map((c) => (
                <Link
                  key={c.id}
                  href={`/category/${category.slug}?sub=${c.slug}`}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${sub?.id === c.id ? 'border-[#FF7A00] bg-orange-50 text-[#FF7A00]' : 'border-gray-200 bg-white text-gray-600'}`}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}
