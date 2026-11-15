import { customerRoute } from '@20mart/server/next';
import { retryPayment } from '@20mart/server';

export const POST = customerRoute({ auth: 'required', rateLimit: { key: 'pay-retry', limit: 10, windowMs: 60_000 } }, async ({ params, customer }) =>
  retryPayment(customer!.id, params.orderNumber)
);
