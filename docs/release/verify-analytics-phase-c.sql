-- READ-ONLY verification queries for the analytics Phase C release (product demand).
-- Every statement is a SELECT. Run in the Neon SQL editor (production branch) or psql.
-- Section A: before AND after the migration (business data must be identical).
-- Section B: after the migration.   Section C: after the backfill / first nightly run.

/* ───────────── A. Business data fingerprint (run before and after; results must match) ───────────── */
SELECT 'Order' AS t, count(*) AS rows, md5(string_agg(id || status::text || "totalPaise", ',' ORDER BY id)) AS fp FROM "Order"
UNION ALL SELECT 'OrderItem', count(*), md5(string_agg(id || quantity || "totalPricePaise", ',' ORDER BY id)) FROM "OrderItem"
UNION ALL SELECT 'Product', count(*), md5(string_agg(id || status::text || "sellingPricePaise", ',' ORDER BY id)) FROM "Product"
UNION ALL SELECT 'Inventory', count(*), md5(string_agg(id || "availableQuantity" || "reservedQuantity", ',' ORDER BY id)) FROM "Inventory"
UNION ALL SELECT 'StockMovement', count(*), md5(string_agg(id, ',' ORDER BY id)) FROM "StockMovement"
UNION ALL SELECT 'AnalyticsEvent', count(*), NULL FROM "AnalyticsEvent"
UNION ALL SELECT 'User', count(*), NULL FROM "User";

/* ───────────── B. Migration applied ───────────── */
-- B1. History row: finished_at set, rolled_back_at NULL, logs NULL.
SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count, logs IS NULL AS no_errors
  FROM "_prisma_migrations" WHERE migration_name = '20261121174444_analytics_product_daily';

-- B2. Objects exist (expect: both tables, the enum with 3 values, the new nullable column).
SELECT to_regclass('"ProductDailyAnalytics"') AS product_daily, to_regclass('"InventoryDailySnapshot"') AS inventory_snapshot;
SELECT enum_range(NULL::"AnalyticsCoverage") AS coverage_values;
SELECT column_name, data_type, is_nullable FROM information_schema.columns
 WHERE table_name = 'AnalyticsSettings' AND column_name = 'trackingStartedAt';

-- B3. Indexes (expect 6: two primary keys + four secondary indexes).
SELECT tablename, indexname FROM pg_indexes
 WHERE tablename IN ('ProductDailyAnalytics', 'InventoryDailySnapshot') ORDER BY tablename, indexname;

-- B4. New tables start empty (before any aggregation).
SELECT (SELECT count(*) FROM "ProductDailyAnalytics") AS product_rows, (SELECT count(*) FROM "InventoryDailySnapshot") AS snapshot_rows;

/* ───────────── C. Aggregation ───────────── */
-- C1. Job runs: every day 'done', none 'failed' (a failed day shows its error).
SELECT status, count(*) AS days, min(day) AS first_day, max(day) AS last_day
  FROM "AnalyticsJobRun" WHERE job = 'product-daily' GROUP BY status;
SELECT day, status, left(error, 200) AS error FROM "AnalyticsJobRun"
 WHERE job = 'product-daily' AND (status <> 'done' OR error IS NOT NULL) ORDER BY day;

-- C2. Tracking start is persisted and equals the first recorded event (or is earlier if old events were purged).
SELECT s."trackingStartedAt",
       (s."trackingStartedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS tracking_started_ist,
       (SELECT min("occurredAt") FROM "AnalyticsEvent") AS first_event_now
  FROM "AnalyticsSettings" s;

-- C3. Coverage per day: NONE before tracking, PARTIAL on the first tracked day, FULL afterwards.
SELECT day, "eventCoverage", count(*) AS products, sum("unitsSold") AS units, sum("revenuePaise") AS revenue_paise,
       sum("estLostRevenuePaise") AS est_lost_paise
  FROM "ProductDailyAnalytics" GROUP BY day, "eventCoverage" ORDER BY day;

-- C4. No events counted on untracked days (expect 0).
SELECT count(*) AS invented_event_rows FROM "ProductDailyAnalytics"
 WHERE "eventCoverage" = 'NONE'
   AND (views + "cartAddUnits" + "wishlistAdds" + "outOfStockAttempts" + "estLostRevenuePaise") > 0;

-- C5. Actual sales reconcile with orders per IST day (expect diff_units = 0 and diff_revenue = 0 on every
--     aggregated day). Same completed-sale rule as the aggregation. Orders changed after their day was
--     aggregated (outside the 3-day refresh) can differ until a forced backfill of that day.
WITH src AS (
  SELECT ((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date AS day,
         sum(oi.quantity) AS units, sum(oi."totalPricePaise") AS revenue
    FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
   WHERE o.status NOT IN ('CANCELLED', 'FAILED', 'REFUNDED')
     AND (o."paymentMethod" = 'CASH_ON_DELIVERY' OR o."paymentStatus" NOT IN ('PENDING', 'FAILED'))
   GROUP BY 1
), agg AS (
  SELECT day, sum("unitsSold") AS units, sum("revenuePaise") AS revenue FROM "ProductDailyAnalytics" GROUP BY day
)
SELECT j.day, coalesce(a.units, 0) AS agg_units, coalesce(s.units, 0) AS order_units,
       coalesce(a.units, 0) - coalesce(s.units, 0) AS diff_units,
       coalesce(a.revenue, 0) - coalesce(s.revenue, 0) AS diff_revenue
  FROM "AnalyticsJobRun" j
  LEFT JOIN agg a ON a.day = j.day
  LEFT JOIN src s ON s.day = j.day
 WHERE j.job = 'product-daily' AND j.status = 'done'
 ORDER BY j.day;

-- C6. Stock replay consistency (rows where history did not add up; expect 0 or a short, explainable list).
SELECT day, count(*) AS inconsistent_rows FROM "InventoryDailySnapshot" WHERE NOT consistent GROUP BY day ORDER BY day;

-- C7. Per-warehouse snapshots exist for paused warehouses too (warehouseActive = false rows are expected if any warehouse is paused).
SELECT "warehouseActive", count(*) AS rows, count(DISTINCT "warehouseId") AS warehouses FROM "InventoryDailySnapshot" GROUP BY 1;

-- C8. Product exports are audited (after an admin downloads a CSV).
SELECT "createdAt", "adminName", left(details, 120) AS details FROM "AdminAuditLog"
 WHERE action = 'analytics.product_demand.export' ORDER BY "createdAt" DESC LIMIT 5;
