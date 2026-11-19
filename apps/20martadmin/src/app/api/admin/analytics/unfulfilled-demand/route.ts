import { adminRoute, parseQuery } from '@20mart/server/next';
import { demandQuery, getUnfulfilledDemand } from '@20mart/server';

export const dynamic = 'force-dynamic';

/** Unfulfilled demand and estimated lost revenue (server-recorded events only). Aggregate — no customer details. */
export const GET = adminRoute('analytics.view', async ({ req }) => getUnfulfilledDemand(parseQuery(req, demandQuery)));
