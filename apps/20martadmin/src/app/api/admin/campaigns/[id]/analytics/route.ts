import { adminRoute } from '@20mart/server/next';
import { getCampaignAnalytics } from '@20mart/server';

export const GET = adminRoute('campaigns.view', async ({ params }) => getCampaignAnalytics(params.id));
