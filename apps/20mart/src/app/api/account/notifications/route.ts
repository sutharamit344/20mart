import { customerRoute } from '@20mart/server/next';
import { listNotifications, markNotificationsRead } from '@20mart/server';

export const dynamic = 'force-dynamic';

export const GET = customerRoute({ auth: 'required' }, async ({ req, customer }) => {
  const page = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('page')) || 1));
  return listNotifications(customer!.id, page, 20);
});
/** Mark own notifications read: { all: true } or { ids: [...] }. */
export const PATCH = customerRoute({ auth: 'required', rateLimit: { key: 'notif-read', limit: 60, windowMs: 60_000 } }, async ({ req, customer }) =>
  markNotificationsRead(customer!.id, await req.json().catch(() => ({})))
);
