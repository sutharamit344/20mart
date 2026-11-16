import { adminRoute } from '@20mart/server/next';
import { listEmailLog } from '@20mart/server';

export const GET = adminRoute('notifications.view', async ({ req }) => listEmailLog(Object.fromEntries(req.nextUrl.searchParams)));
