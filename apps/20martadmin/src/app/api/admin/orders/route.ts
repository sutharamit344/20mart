import { adminRoute } from '@20mart/server/next';
import { listAdminOrders } from '@20mart/server';

export const GET = adminRoute('orders.view', async ({ req }) => listAdminOrders(Object.fromEntries(req.nextUrl.searchParams)));
