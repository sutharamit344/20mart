import type { MetadataRoute } from 'next';
import { captureException, listSitemapEntries } from '@20mart/server';
import { absoluteUrl } from '../lib/seo';

// Regenerated at most hourly (and on admin revalidation); never blocks on a DB outage.
export const revalidate = 3600;

const STATIC_PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/shop', priority: 0.9, changeFrequency: 'daily' },
  { path: '/category', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/deals', priority: 0.8, changeFrequency: 'daily' },
  { path: '/about', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/faqs', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/shipping-policy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/returns-policy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({ url: absoluteUrl(p.path), changeFrequency: p.changeFrequency, priority: p.priority }));
  try {
    const { products, categories, campaigns } = await listSitemapEntries();
    return [
      ...pages,
      ...categories.map((c) => ({ url: absoluteUrl(`/category/${c.slug}`), lastModified: c.updatedAt, changeFrequency: 'weekly' as const, priority: 0.8 })),
      ...campaigns.map((c) => ({ url: absoluteUrl(`/campaigns/${c.slug}`), lastModified: c.updatedAt, changeFrequency: 'daily' as const, priority: 0.6 })),
      ...products.map((p) => ({ url: absoluteUrl(`/product/${p.slug}`), lastModified: p.updatedAt, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ];
  } catch (e) {
    captureException(e, 'db.sitemap_failed', { category: 'db' });
    return pages;
  }
}
