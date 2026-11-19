-- ROLLBACK for migration 20261118090000_analytics_foundation (analytics Phase A).
--
-- ONLY run this if the release is abandoned and the analytics data may be destroyed.
-- It is normally NOT needed: the migration is additive, and the previous application code
-- (main) works unchanged with these tables present (verified in the rehearsal). Rolling back
-- the application deployment alone is the standard rollback.
--
-- Running it permanently deletes every analytics event, session, setting and job record.
-- Take a Neon branch/snapshot first. Existing store data (orders, products, customers, ...)
-- is not touched: nothing outside these four tables references them.
--
-- The migration's history row is removed in the same transaction, so Prisma sees it as not applied
-- and a later `prisma migrate deploy` re-applies it cleanly (verified in the rehearsal).
-- NOTE: `prisma migrate resolve --rolled-back` does NOT work here — it only accepts FAILED
-- migrations (error P3012 for a successfully applied one).

BEGIN;
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261118090000_analytics_foundation';
DROP TABLE IF EXISTS "AnalyticsEvent";
DROP TABLE IF EXISTS "AnalyticsSession";
DROP TABLE IF EXISTS "AnalyticsSettings";
DROP TABLE IF EXISTS "AnalyticsJobRun";
DROP TYPE IF EXISTS "AnalyticsEventName";
DROP TYPE IF EXISTS "AnalyticsEventCategory";
DROP TYPE IF EXISTS "AnalyticsEventSource";

-- Optional: remove the permission added by the release's access-control sync. Harmless to keep:
-- the previous code ignores permission keys it does not know.
-- DELETE FROM "RolePermission" WHERE "permissionId" IN (SELECT id FROM "Permission" WHERE key = 'analytics.manage');
-- DELETE FROM "Permission" WHERE key = 'analytics.manage';
COMMIT;
