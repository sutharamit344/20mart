import { adminRoute } from '@20mart/server/next';
import { initiateRefund } from '@20mart/server';

export const POST = adminRoute('orders.refund', async ({ admin, params }) => initiateRefund(admin, params.id));
