import { adminRoute } from '@20mart/server/next';
import { announceCampaign } from '@20mart/server';

/** Sends in-app notifications to all customers and queues email for marketing opt-ins. */
export const POST = adminRoute(['campaigns.update', 'notifications.manage'], async ({ admin, params }) => announceCampaign(admin, params.id));
