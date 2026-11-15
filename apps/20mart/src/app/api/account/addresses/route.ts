import { customerRoute } from '@20mart/server/next';
import { createAddress, listAddresses } from '@20mart/server';
import { json } from '@20mart/server/next';

export const dynamic = 'force-dynamic';

export const GET = customerRoute({ auth: 'required' }, async ({ customer }) => ({ items: await listAddresses(customer!.id) }));
export const POST = customerRoute({ auth: 'required', rateLimit: { key: 'address', limit: 30, windowMs: 60_000 } }, async ({ req, customer }) =>
  json(await createAddress(customer!.id, await req.json().catch(() => ({}))), 201)
);
