import { customerRoute } from '@20mart/server/next';
import { addItem } from '@20mart/server';
const owner = (c: { id: string } | null, g: string | null) => (c ? { userId: c.id } : g ? { guestToken: g } : null);

/** Add to cart. Guests get a cart cookie on their first add. Price always comes from the database. */
export const POST = customerRoute(
  { auth: 'optional', rateLimit: { key: 'cart-add', limit: 60, windowMs: 60_000 } },
  async ({ req, customer, guestToken, setGuestToken }) => {
    const { cart, newGuestToken } = await addItem(owner(customer, guestToken), await req.json().catch(() => ({})));
    if (newGuestToken) setGuestToken(newGuestToken);
    return cart;
  }
);
