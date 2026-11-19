import { customerRoute } from '@20mart/server/next';
import { customerCancelOrder } from '@20mart/server';

export const POST = customerRoute({ auth: 'required', rateLimit: { key: 'cancel', limit: 10, windowMs: 60_000 } }, async ({ req, params, customer }) =>
  customerCancelOrder(customer!.id, params.orderNumber, await req.json().catch(() => ({})), { req, userId: customer!.id })
);
