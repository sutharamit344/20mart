import { adminRoute } from '@20mart/server/next';
import { getAbandonedCartSummary } from '@20mart/server';

export const dynamic = 'force-dynamic';

/** Carts abandoned right now (configurable inactivity threshold). Aggregate only — no customer details. */
export const GET = adminRoute('analytics.view', async () => getAbandonedCartSummary());
