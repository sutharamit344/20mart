import { customerRoute } from '@20mart/server/next';
import { clearCart, getCart } from '@20mart/server';
import { locationFrom } from '../../../lib/location-server';

export const dynamic = 'force-dynamic';
const owner = (c: { id: string } | null, g: string | null) => (c ? { userId: c.id } : g ? { guestToken: g } : null);

export const GET = customerRoute({ auth: 'optional' }, async ({ req, customer, guestToken }) => getCart(owner(customer, guestToken), locationFrom(req)));
export const DELETE = customerRoute({ auth: 'optional' }, async ({ req, customer, guestToken }) => clearCart(owner(customer, guestToken), locationFrom(req)));
