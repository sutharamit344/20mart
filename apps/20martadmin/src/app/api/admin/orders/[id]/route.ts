import { adminRoute } from '@20mart/server/next';
import { getAdminOrder } from '@20mart/server';

export const GET = adminRoute('orders.view', async ({ params }) => getAdminOrder(params.id));
