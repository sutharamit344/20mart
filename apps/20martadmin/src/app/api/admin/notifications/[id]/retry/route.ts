import { adminRoute } from '@20mart/server/next';
import { retryEmail } from '@20mart/server';

export const POST = adminRoute('notifications.manage', async ({ admin, params }) => retryEmail(admin, params.id));
