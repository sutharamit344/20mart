import { customerRoute } from '@20mart/server/next';
import { getCustomerOrder } from '@20mart/server';

export const dynamic = 'force-dynamic';

export const GET = customerRoute({ auth: 'required' }, async ({ params, customer }) => getCustomerOrder(customer!.id, params.orderNumber));
