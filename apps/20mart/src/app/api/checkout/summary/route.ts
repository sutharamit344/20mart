import { customerRoute } from '@20mart/server/next';
import { getCheckoutSummary } from '@20mart/server';

export const dynamic = 'force-dynamic';

export const GET = customerRoute({ auth: 'required' }, async ({ req, customer }) => getCheckoutSummary(customer!.id, req.nextUrl.searchParams.get('addressId'), { req, userId: customer!.id }));
