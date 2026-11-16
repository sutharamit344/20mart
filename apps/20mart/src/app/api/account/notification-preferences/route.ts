import { customerRoute } from '@20mart/server/next';
import { getNotificationPreferences, updateNotificationPreferences } from '@20mart/server';

export const dynamic = 'force-dynamic';

export const GET = customerRoute({ auth: 'required' }, async ({ customer }) => getNotificationPreferences(customer!.id));
export const PATCH = customerRoute({ auth: 'required', rateLimit: { key: 'notif-prefs', limit: 20, windowMs: 60_000 } }, async ({ req, customer }) =>
  updateNotificationPreferences(customer!.id, await req.json().catch(() => ({})))
);
