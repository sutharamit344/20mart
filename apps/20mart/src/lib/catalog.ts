import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  getPublicCategory,
  getPublicProduct,
  getRelatedProducts,
  listPublicBrands,
  listPublicCategories,
  listPopularProducts,
  listPublicPricePoints,
  listPublicProducts,
  type PublicProductQuery,
} from '@20mart/server';

/**
 * Storefront data access. Reads are cached for a short window and refreshed
 * on demand by the admin (POST /api/revalidate). Catalog pages therefore stay
 * statically renderable (ISR) instead of hitting the DB on every request.
 */
const REVALIDATE = 60;

export const getCategories = unstable_cache(async () => listPublicCategories(), ['public-categories'], {
  revalidate: REVALIDATE,
  tags: ['catalog'],
});

export const getCategory = unstable_cache(async (slug: string) => getPublicCategory(slug), ['public-category'], {
  revalidate: REVALIDATE,
  tags: ['catalog'],
});

export const getProducts = unstable_cache(
  async (query: PublicProductQuery) => listPublicProducts(query),
  ['public-products'],
  { revalidate: REVALIDATE, tags: ['catalog'] }
);

export const getProduct = unstable_cache(async (slug: string) => getPublicProduct(slug), ['public-product'], {
  revalidate: REVALIDATE,
  tags: ['catalog'],
});

export const getRelated = unstable_cache(
  async (productId: string, categorySlug: string) => getRelatedProducts(productId, categorySlug, 5),
  ['public-related'],
  { revalidate: REVALIDATE, tags: ['catalog'] }
);

export const getBrands = unstable_cache(async () => listPublicBrands(), ['public-brands'], { revalidate: REVALIDATE, tags: ['catalog'] });
export const getPricePoints = unstable_cache(async () => listPublicPricePoints(), ['public-price-points'], { revalidate: REVALIDATE, tags: ['catalog'] });
export const getPopular = unstable_cache(async (limit: number) => listPopularProducts(limit), ['public-popular'], { revalidate: 300, tags: ['catalog'] });

/** Header categories; never let a DB outage break every page. */
export async function getHeaderCategories() {
  try {
    return (await getCategories()).map((c) => ({ name: c.name, slug: c.slug }));
  } catch (e) {
    console.error('[catalog] categories unavailable:', (e as Error).message);
    return [];
  }
}
