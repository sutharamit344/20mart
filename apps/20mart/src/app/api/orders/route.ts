import { customerRoute } from '@20mart/server/next';
import { listCustomerOrders, placeOrder } from '@20mart/server';
import { json } from '@20mart/server/next';

export const dynamic = 'force-dynamic';

export const GET = customerRoute({ auth: 'required' }, async ({ req, customer }) => {
  const page = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get('page')) || 1));
  return listCustomerOrders(customer!.id, page, 10);
});
/** Place an order. The body carries only the address, method and an idempotency key — never amounts. */
export const POST = customerRoute({ auth: 'required', rateLimit: { key: 'place-order', limit: 5, windowMs: 60_000 } }, async ({ req, customer }) =>
  json(await placeOrder(customer!.id, await req.json().catch(() => ({}))), 201)
);
