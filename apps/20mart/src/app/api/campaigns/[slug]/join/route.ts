import { customerRoute } from '@20mart/server/next';
import { joinCampaign } from '@20mart/server';

export const dynamic = 'force-dynamic';

export const POST = customerRoute({ auth: 'required', rateLimit: { key: 'campaign-join', limit: 20, windowMs: 60_000 } }, async ({ customer, params }) =>
  joinCampaign(customer!.id, params.slug)
);
