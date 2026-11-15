import { customerRoute } from '@20mart/server/next';
import { clearCart, getCart } from '@20mart/server';

export const dynamic = 'force-dynamic';
const owner = (c: { id: string } | null, g: string | null) => (c ? { userId: c.id } : g ? { guestToken: g } : null);

export const GET = customerRoute({ auth: 'optional' }, async ({ customer, guestToken }) => getCart(owner(customer, guestToken)));
export const DELETE = customerRoute({ auth: 'optional' }, async ({ customer, guestToken }) => clearCart(owner(customer, guestToken)));
