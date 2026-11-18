import { prisma } from '@20mart/database';
import { getAnalyticsSettings } from './settings';

/**
 * Analytics retention. Deliberately separate from security/operational log retention
 * (sessions, login attempts and audit logs are handled by runMaintenance with their own rules).
 *
 *  - BEHAVIORAL events and analytics sessions: deleted after behavioralRetentionDays.
 *  - OPERATIONAL events: identity (user/visitor/session) is removed after behavioralRetentionDays,
 *    and the anonymous rows are deleted after operationalRetentionDays.
 *  - Daily aggregates (later phases) contain no identity and are kept indefinitely.
 * Every statement works in bounded batches so a backlog never holds long locks.
 */
const BATCH = 5000;
const MAX_BATCHES = 20;
const DAY = 86_400_000;
/** Bound Date parameter $1 as UTC wall time (columns are timestamp(3) in UTC; Prisma binds timestamptz). */
const CUTOFF = `($1::timestamptz AT TIME ZONE 'UTC')`;

async function batched(sql: string, cutoff: Date) {
  let total = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const n = await prisma.$executeRawUnsafe(sql, cutoff);
    total += n;
    if (n < BATCH) break;
  }
  return total;
}

export async function purgeAnalytics(now = new Date()) {
  const s = await getAnalyticsSettings({ fresh: true });
  const behavioralCutoff = new Date(now.getTime() - s.behavioralRetentionDays * DAY);
  const operationalCutoff = new Date(now.getTime() - Math.max(s.operationalRetentionDays, s.behavioralRetentionDays) * DAY);
  // SQL text is constant; only the cutoff timestamp is a parameter. Rows past operational retention are
  // deleted before anonymising, so they are not rewritten just to be removed.
  return {
    behavioralEventsDeleted: await batched(
      `DELETE FROM "AnalyticsEvent" WHERE "id" IN (SELECT "id" FROM "AnalyticsEvent" WHERE "category" = 'BEHAVIORAL' AND "occurredAt" < ${CUTOFF} LIMIT ${BATCH})`,
      behavioralCutoff
    ),
    operationalEventsDeleted: await batched(
      `DELETE FROM "AnalyticsEvent" WHERE "id" IN (SELECT "id" FROM "AnalyticsEvent" WHERE "category" = 'OPERATIONAL' AND "occurredAt" < ${CUTOFF} LIMIT ${BATCH})`,
      operationalCutoff
    ),
    operationalEventsAnonymised: await batched(
      `UPDATE "AnalyticsEvent" SET "userId" = NULL, "visitorId" = NULL, "sessionId" = NULL
        WHERE "id" IN (SELECT "id" FROM "AnalyticsEvent" WHERE "category" = 'OPERATIONAL' AND "occurredAt" < ${CUTOFF}
                          AND ("userId" IS NOT NULL OR "visitorId" IS NOT NULL OR "sessionId" IS NOT NULL) LIMIT ${BATCH})`,
      behavioralCutoff
    ),
    sessionsDeleted: await batched(
      `DELETE FROM "AnalyticsSession" WHERE "id" IN (SELECT "id" FROM "AnalyticsSession" WHERE "lastSeenAt" < ${CUTOFF} LIMIT ${BATCH})`,
      behavioralCutoff
    ),
  };
}
