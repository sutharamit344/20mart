import { adminRoute } from '@20mart/server/next';
import { listProductDemand } from '@20mart/server';

export const dynamic = 'force-dynamic';

/** Product demand list from the daily aggregates (IST days). Aggregate data only — no customer details. */
export const GET = adminRoute('analytics.view', async ({ req }) => listProductDemand(Object.fromEntries(req.nextUrl.searchParams.entries())));
