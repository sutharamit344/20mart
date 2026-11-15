import { customerRoute } from '@20mart/server/next';
import { checkServiceability } from '@20mart/server';

export const dynamic = 'force-dynamic';

export const GET = customerRoute({ auth: 'optional', rateLimit: { key: 'pincode', limit: 30, windowMs: 60_000 } }, async ({ req }) =>
  checkServiceability(req.nextUrl.searchParams.get('pincode') ?? '')
);
