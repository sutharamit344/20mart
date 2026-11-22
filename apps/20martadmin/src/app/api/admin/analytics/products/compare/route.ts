import { adminRoute } from '@20mart/server/next';
import { compareProductDemand } from '@20mart/server';

export const dynamic = 'force-dynamic';

/** Side-by-side demand for 2–4 products (?ids=a,b,c) over the same IST day range. */
export const GET = adminRoute('analytics.view', async ({ req }) => compareProductDemand(Object.fromEntries(req.nextUrl.searchParams.entries())));
