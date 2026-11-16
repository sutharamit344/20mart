import { customerRoute } from '@20mart/server/next';
import { listCustomerCoupons } from '@20mart/server';

export const dynamic = 'force-dynamic';

export const GET = customerRoute({ auth: 'required' }, async ({ customer }) => listCustomerCoupons(customer!.id));
