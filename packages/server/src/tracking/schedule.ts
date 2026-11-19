import { after } from 'next/server';
import { logger } from '../observability';

/**
 * Run analytics work AFTER the response has been sent, so it can never slow down or fail a
 * cart/checkout/payment/order request.
 *
 * Inside a Next.js request, `after()` defers the task until the response is finished. Outside a
 * request (tests, cron scripts, maintenance) the task starts immediately in the background and is
 * tracked so tests can wait for it with `settleAnalytics()`. Failures are always swallowed.
 */
const pending = new Set<Promise<void>>();

export function runAfterResponse(task: () => Promise<unknown>) {
  const run = async () => {
    try {
      await task();
    } catch (err) {
      logger.warn('analytics.deferred_failed', { category: 'app', error: (err as Error)?.message?.slice(0, 200) });
    }
  };
  try {
    after(run);
    return;
  } catch {
    // Not inside a request scope: fall through to an in-process background task.
  }
  const p: Promise<void> = run().finally(() => pending.delete(p));
  pending.add(p);
}

/** Wait for analytics work started outside a request (test hook; also used before shutdown). */
export async function settleAnalytics() {
  while (pending.size) await Promise.all([...pending]);
}
