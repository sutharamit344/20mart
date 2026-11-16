import { adminRoute } from '@20mart/server/next';
import { getAnalytics } from '@20mart/server';

export const GET = adminRoute('analytics.view', async ({ req }) => getAnalytics(Object.fromEntries(req.nextUrl.searchParams)));
