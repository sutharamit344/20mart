import { adminRoute } from '@20mart/server/next';
import { getProductDemandDetail } from '@20mart/server';

export const dynamic = 'force-dynamic';

/** One product's demand, sales, availability and per-warehouse stockout history over an IST day range. */
export const GET = adminRoute('analytics.view', async ({ req, params }) =>
  getProductDemandDetail(params.id ?? '', Object.fromEntries(req.nextUrl.searchParams.entries()))
);
