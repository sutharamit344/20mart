import type { MetadataRoute } from 'next';
import { absoluteUrl, siteOrigin } from '../lib/seo';

/** Crawlers may index the catalog; private, transactional and API routes are excluded. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/account', '/checkout', '/cart', '/wishlist', '/auth', '/order-success', '/order-confirmation', '/search', '/api/', '/coupons'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteOrigin(),
  };
}
