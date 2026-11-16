import 'server-only';
import type { Metadata } from 'next';
import { env } from '@20mart/server';
import type { StorefrontProductDetail } from '@20mart/shared';

/**
 * SEO helpers: absolute URLs from APP_URL and schema.org JSON-LD built ONLY from real catalog data.
 * No ratings, reviews or offers that do not exist are ever emitted.
 */
export const SITE_NAME = '20Mart';
export const SITE_TAGLINE = 'Your Everyday Value Market';
export const DEFAULT_DESCRIPTION =
  'Useful household products, affordable prices, everyday convenience. Buy kitchenware, cleaning supplies and home essentials with fast doorstep delivery in Ahmedabad.';
export const DEFAULT_OG_IMAGE = { url: '/logo/20mart-logo-white-bg.jpg', width: 1810, height: 840, alt: '20Mart – Your Everyday Value Market' };

export const siteOrigin = () => new URL(env().APP_URL).origin;
export const absoluteUrl = (path = '/') => new URL(path, siteOrigin()).toString();

/** schema.org Offer prices are decimal strings in the currency unit (₹), from integer paise. */
export const rupees = (paise: number) => (paise / 100).toFixed(2);

const AVAILABILITY = { IN_STOCK: 'https://schema.org/InStock', LOW: 'https://schema.org/LimitedAvailability', OUT: 'https://schema.org/OutOfStock' } as const;

/** Page metadata with canonical URL and Open Graph/Twitter defaults filled in. */
export function pageMetadata(opts: { title: string; description?: string | null; path: string; images?: { url: string; alt?: string }[]; noindex?: boolean }): Metadata {
  const description = opts.description || DEFAULT_DESCRIPTION;
  const images = opts.images?.length ? opts.images : [DEFAULT_OG_IMAGE];
  return {
    title: opts.title,
    description,
    alternates: { canonical: opts.path },
    openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_IN', url: opts.path, title: opts.title, description, images },
    twitter: { card: 'summary_large_image', title: opts.title, description, images: images.map((i) => i.url) },
    ...(opts.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': absoluteUrl('/#organization'),
    name: SITE_NAME,
    url: absoluteUrl('/'),
    logo: absoluteUrl(DEFAULT_OG_IMAGE.url),
    slogan: SITE_TAGLINE,
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    name: SITE_NAME,
    url: absoluteUrl('/'),
    inLanguage: 'en-IN',
    publisher: { '@id': absoluteUrl('/#organization') },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl('/search')}?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

/** Product + Offer(s) from live data. Variants become an AggregateOffer over their real prices. */
export function productJsonLd(p: StorefrontProductDetail) {
  const url = absoluteUrl(`/product/${p.slug}`);
  const seller = { '@id': absoluteUrl('/#organization') };
  const offers =
    p.variants.length > 0
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'INR',
          lowPrice: rupees(Math.min(...p.variants.map((v) => v.sellingPricePaise))),
          highPrice: rupees(Math.max(...p.variants.map((v) => v.sellingPricePaise))),
          offerCount: p.variants.length,
          availability: AVAILABILITY[p.variants.some((v) => v.stockState !== 'OUT') ? 'IN_STOCK' : 'OUT'],
          url,
          seller,
        }
      : {
          '@type': 'Offer',
          priceCurrency: 'INR',
          price: rupees(p.sellingPricePaise),
          availability: AVAILABILITY[p.stockState],
          itemCondition: 'https://schema.org/NewCondition',
          url,
          seller,
        };
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: p.name,
    sku: p.sku,
    url,
    ...(p.images.length ? { image: p.images.map((i) => (i.url.startsWith('http') ? i.url : absoluteUrl(i.url))) } : {}),
    ...(p.shortDescription || p.description ? { description: (p.shortDescription || p.description || '').slice(0, 5000) } : {}),
    ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand.name } } : {}),
    category: p.category.name,
    offers,
  };
}
