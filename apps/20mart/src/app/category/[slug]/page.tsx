import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { resolveImageSrc } from '@20mart/ui';
import { CatalogListing } from '../../../components/catalog/CatalogListing';
import { getCategories, getCategory } from '../../../lib/catalog';
import { getCategoryTheme } from '../../../lib/category-theme';
import { breadcrumbJsonLd, pageMetadata } from '../../../lib/seo';
import { JsonLd } from '../../../components/JsonLd';
import { TrackView } from '../../../components/TrackView';

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    return (await getCategories()).map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const category = await getCategory(params.slug).catch(() => null);
  if (!category) return { title: 'Category not found – 20Mart' };
  return pageMetadata({
    title: category.seoTitle || `${category.name} essentials – 20Mart`,
    description: category.seoDescription || category.description || `Shop affordable ${category.name.toLowerCase()} essentials at 20Mart.`,
    // Sort/filter/page parameters are views of the same listing; only the category itself is canonical.
    path: `/category/${category.slug}`,
    images: category.imageUrl ? [{ url: category.imageUrl, alt: category.name }] : undefined,
  });
}

export default async function CategoryDetailPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, searchParams] = await Promise.all([paramsPromise, searchParamsPromise]);
  const category = await getCategory(params.slug).catch(() => null);
  if (!category) notFound();
  const theme = getCategoryTheme(category.slug);
  const Icon = theme.icon;
  const sub = typeof searchParams.sub === 'string' ? category.children.find((c) => c.slug === searchParams.sub) : undefined;

  return (
    <>
    <JsonLd
      data={breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Categories', path: '/category' },
        { name: category.name, path: `/category/${category.slug}` },
      ])}
    />
    <TrackView name="CATEGORY_VIEWED" categoryId={sub?.id ?? category.id} />
    <CatalogListing
      searchParams={searchParams}
      fixed={{ category: sub?.slug ?? category.slug }}
      showCategoryFilter={false}
      title={sub ? `${category.name} · ${sub.name}` : category.name}
      breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Categories', href: '/category' }, { label: category.name }]}
      emptyAction={{ href: '/category', label: 'Browse other categories' }}
      banner={
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-4 rounded-2xl border border-line-subtle bg-surface p-4 sm:p-5">
            <div
              className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl sm:h-16 sm:w-16"
              style={{ backgroundColor: theme.bg }}
            >
              {category.imageUrl ? (
                <Image src={resolveImageSrc(category.imageUrl)} alt="" fill sizes="64px" className="object-contain p-1.5" />
              ) : (
                <Icon className="h-7 w-7" style={{ color: theme.iconColor }} aria-hidden />
              )}
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">
                {category.productCount} product{category.productCount === 1 ? '' : 's'}
              </p>
              <p className="max-w-xl text-sm text-ink-600">
                {category.description || `Everyday ${category.name.toLowerCase()} essentials at great value.`}
              </p>
            </div>
          </div>
          {category.children.length > 0 && (
            <nav aria-label={`${category.name} subcategories`} className="-mx-4 sm:mx-0">
              <ul className="flex gap-2 overflow-x-auto px-4 scrollbar-none sm:flex-wrap sm:px-0">
                {[{ id: '', slug: '', name: 'All' }, ...category.children].map((c) => {
                  const on = c.id ? sub?.id === c.id : !sub;
                  return (
                    <li key={c.id || 'all'} className="shrink-0">
                      <Link
                        href={c.slug ? `/category/${category.slug}?sub=${c.slug}` : `/category/${category.slug}`}
                        aria-current={on ? 'page' : undefined}
                        className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 ${on ? 'border-brand-green/30 bg-brand-green-50 text-brand-green' : 'border-line bg-surface text-ink-600 hover:border-line-strong hover:text-ink'}`}
                      >
                        {c.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </div>
      }
    />
    </>
  );
}
