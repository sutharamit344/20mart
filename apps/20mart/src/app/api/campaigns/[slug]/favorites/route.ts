import { customerRoute } from '@20mart/server/next';
import { setCampaignFavorite } from '@20mart/server';

export const dynamic = 'force-dynamic';

export const PUT = customerRoute({ auth: 'required', rateLimit: { key: 'campaign-fav', limit: 120, windowMs: 60_000 } }, async ({ req, customer, params }) =>
  setCampaignFavorite(customer!.id, params.slug, await req.json().catch(() => ({})))
);
