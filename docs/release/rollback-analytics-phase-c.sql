-- ROLLBACK for migration 20261121174444_analytics_product_daily (analytics Phase C: product demand).
--
-- ONLY run this if the Phase C release is abandoned and the product demand aggregates may be destroyed.
-- It is normally NOT needed: the migration is additive and the previous application code (main)
-- works unchanged with these objects present. Rolling back the application deployment (Vercel
-- Instant Rollback) is the standard rollback.
--
-- ORDER: roll back / redeploy the application code FIRST. The Phase C code reads these tables
-- (admin Product demand pages, nightly maintenance); with them gone those pages would error.
--
-- Effect:
--   - drops ProductDailyAnalytics and InventoryDailySnapshot (derived data only — every row can be
--     rebuilt from orders, stock movements and analytics events by re-running the backfill);
--   - removes AnalyticsSettings."trackingStartedAt" and the AnalyticsCoverage type;
--   - deletes the 'product-daily' job records, so a later re-apply + backfill rebuilds every day
--     (otherwise catch-up would treat those days as already done and leave the new tables empty);
--   - deletes the migration's history row, so `prisma migrate deploy` can re-apply it cleanly.
-- Store data (orders, products, inventory, stock movements, customers, analytics events) is NOT touched.
--
-- NOTE: `prisma migrate resolve --rolled-back` does NOT work for a successfully applied migration
-- (error P3012), which is why the history row is removed here.
-- Take a Neon backup branch first.

BEGIN;
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261121174444_analytics_product_daily';
DELETE FROM "AnalyticsJobRun" WHERE job = 'product-daily';
DROP TABLE IF EXISTS "ProductDailyAnalytics";
DROP TABLE IF EXISTS "InventoryDailySnapshot";
ALTER TABLE "AnalyticsSettings" DROP COLUMN IF EXISTS "trackingStartedAt";
DROP TYPE IF EXISTS "AnalyticsCoverage";
COMMIT;
