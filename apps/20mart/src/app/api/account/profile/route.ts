import { customerRoute } from '@20mart/server/next';
import { getProfile, updateProfile } from '@20mart/server';

export const dynamic = 'force-dynamic';

export const GET = customerRoute({ auth: 'required' }, async ({ customer }) => getProfile(customer!.id));
export const PATCH = customerRoute({ auth: 'required', rateLimit: { key: 'profile', limit: 20, windowMs: 60_000 } }, async ({ req, customer }) =>
  updateProfile(customer!.id, await req.json().catch(() => ({})))
);
