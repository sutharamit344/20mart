import type { MetadataRoute } from 'next';

/** The admin portal must never be crawled or indexed (also enforced by X-Robots-Tag + meta robots). */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
