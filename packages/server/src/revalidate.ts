import { env } from './env';

/**
 * Ask the storefront to drop cached catalog pages after an admin change.
 * Fire-and-forget: storefront pages also revalidate on a short timer.
 */
export function notifyStorefront(paths: string[] = ['/']) {
  const { APP_URL, REVALIDATE_SECRET, NODE_ENV } = env();
  if (!REVALIDATE_SECRET || NODE_ENV === 'test') return;
  void fetch(`${APP_URL.replace(/\/$/, '')}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-revalidate-secret': REVALIDATE_SECRET },
    body: JSON.stringify({ paths }),
    cache: 'no-store',
  }).catch(() => undefined);
}
