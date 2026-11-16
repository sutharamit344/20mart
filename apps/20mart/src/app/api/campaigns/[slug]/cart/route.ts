import { customerRoute } from '@20mart/server/next';
import { getMyCampaignCart, setCampaignCartItem } from '@20mart/server';

export const dynamic = 'force-dynamic';

/** Fill Your Cart saved campaign cart — separate from the shopping cart; reserves no stock. */
export const GET = customerRoute({ auth: 'required' }, async ({ customer, params }) => getMyCampaignCart(customer!.id, params.slug));
export const PUT = customerRoute({ auth: 'required', rateLimit: { key: 'campaign-cart', limit: 120, windowMs: 60_000 } }, async ({ req, customer, params }) =>
  setCampaignCartItem(customer!.id, params.slug, await req.json().catch(() => ({})))
);
