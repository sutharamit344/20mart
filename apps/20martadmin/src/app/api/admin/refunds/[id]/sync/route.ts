import { adminRoute } from '@20mart/server/next';
import { syncRefund } from '@20mart/server';

export const POST = adminRoute('orders.refund', async ({ admin, params }) => syncRefund(admin, params.id));
