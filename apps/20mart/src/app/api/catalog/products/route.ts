import { NextResponse, type NextRequest } from 'next/server';
import { getPublicProductsByIds, listPublicProducts } from '@20mart/server';
import { errorResponse } from '@20mart/server/next';

/**
 * Public product cards.
 *   ?ids=a,b,c   → hydrate specific products (wishlist / cart), order preserved
 *   otherwise    → paginated listing (same filters as /shop)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const ids = sp.get('ids');
    const body = ids
      ? { items: await getPublicProductsByIds(ids.split(',').slice(0, 60)) }
      : await listPublicProducts(Object.fromEntries(sp.entries()));
    return NextResponse.json(body, { headers: { 'cache-control': 'public, max-age=30, s-maxage=60' } });
  } catch (err) {
    return errorResponse(err);
  }
}
