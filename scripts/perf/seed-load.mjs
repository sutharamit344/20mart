#!/usr/bin/env node
/**
 * Synthetic LOAD data for performance measurement — scratch databases only.
 *
 *   DATABASE_URL=postgresql://.../twentymart_p3_scratch node scripts/perf/seed-load.mjs [--products 5000] [--users 5000] [--orders 30000]
 *
 * Refuses to run unless the database name contains "scratch" or "perf". Rows are tagged
 * (SKU prefix "LOAD-", emails @load.invalid) and must never be loaded into dev/staging/production.
 */
import { arg, parseDbUrl, psql } from '../db/lib.mjs';

const conn = parseDbUrl(process.env.DATABASE_URL);
if (!/(scratch|perf)/.test(conn.database)) {
  console.error(`Refusing: "${conn.database}" is not a scratch/perf database`);
  process.exit(1);
}
const products = Number(arg('products', 5000));
const users = Number(arg('users', 5000));
const orders = Number(arg('orders', 30000));

const sql = `
BEGIN;
-- Products spread over the existing active categories/brands; price <= MRP; ~85% in stock.
WITH cats AS (SELECT id, row_number() OVER (ORDER BY id) - 1 AS n FROM "Category" WHERE "status" = 'ACTIVE'),
     brands AS (SELECT id, row_number() OVER (ORDER BY id) - 1 AS n FROM "Brand" WHERE "status" = 'ACTIVE'),
     nc AS (SELECT count(*) AS c FROM cats), nb AS (SELECT greatest(count(*),1) AS c FROM brands),
     src AS (
       SELECT g,
              (ARRAY['Steel','Plastic','Glass','Bamboo','Cotton','Ceramic','Silicone','Microfiber'])[1 + g % 8] || ' ' ||
              (ARRAY['Bottle','Container','Scrubber','Brush','Mop','Organizer','Basket','Hanger','Peeler','Towel','Jar','Tray'])[1 + (g / 8) % 12] || ' ' || g AS name,
              (2000 + (g % 40) * 500) AS price
         FROM generate_series(1, ${products}) g)
INSERT INTO "Product" ("id","name","slug","sku","shortDescription","categoryId","brandId","sellingPricePaise","mrpPaise","status","isFeatured","publishedAt","createdAt","updatedAt")
SELECT gen_random_uuid(), s.name, 'load-' || s.g, 'LOAD-' || lpad(s.g::text, 6, '0'),
       'Everyday household essential ' || s.g,
       (SELECT id FROM cats WHERE n = s.g % (SELECT c FROM nc)),
       (SELECT id FROM brands WHERE n = s.g % (SELECT c FROM nb)),
       s.price, s.price + (s.g % 5) * 500, 'ACTIVE', s.g % 50 = 0,
       now() - (s.g || ' minutes')::interval, now() - (s.g || ' minutes')::interval, now()
  FROM src s;

-- Synthetic load data lives in one ACTIVE scratch warehouse (P4: stock is per warehouse).
INSERT INTO "Warehouse" ("id","name","code","status","addressLine1","city","state","pinCode","updatedAt")
VALUES (gen_random_uuid(), 'Load test location', 'LOAD-WH', 'ACTIVE', 'Synthetic', 'Ahmedabad', 'Gujarat', '380015', now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Inventory" ("id","warehouseId","productId","availableQuantity","reservedQuantity","lowStockThreshold","createdAt","updatedAt")
SELECT gen_random_uuid(), (SELECT id FROM "Warehouse" WHERE "code" = 'LOAD-WH'), p.id,
       CASE WHEN abs(hashtext(p.id::text)) % 100 < 85 THEN 20 + abs(hashtext(p.sku)) % 200 ELSE 0 END, 0, 10, now(), now()
  FROM "Product" p WHERE p."sku" LIKE 'LOAD-%';

-- One primary image per product, reusing an existing uploaded image (if any) so cards render images.
INSERT INTO "ProductImage" ("id","productId","url","altText","sortOrder","isPrimary","createdAt","updatedAt")
SELECT gen_random_uuid(), p.id, (SELECT "url" FROM "ProductImage" WHERE "productId" NOT IN (SELECT id FROM "Product" WHERE "sku" LIKE 'LOAD-%') ORDER BY "createdAt" LIMIT 1), p."name", 0, true, now(), now()
  FROM "Product" p WHERE p."sku" LIKE 'LOAD-%' AND EXISTS (SELECT 1 FROM "ProductImage");

INSERT INTO "User" ("id","name","email","emailVerified","googleSubjectId","status","createdAt","updatedAt")
SELECT gen_random_uuid(), 'Load User ' || g, 'load' || g || '@load.invalid', now(), 'load-sub-' || g, 'ACTIVE', now() - (g || ' hours')::interval, now()
  FROM generate_series(1, ${users}) g;
INSERT INTO "CustomerProfile" ("id","userId","updatedAt")
SELECT gen_random_uuid(), u.id, now() FROM "User" u WHERE u."email" LIKE '%@load.invalid';

-- Orders: delivered/paid history over ~90 days with 1-3 items each; totals are internally consistent.
CREATE TEMP TABLE lu AS SELECT id, row_number() OVER (ORDER BY id) AS n FROM "User" WHERE "email" LIKE '%@load.invalid';
CREATE TEMP TABLE lp AS SELECT p.id, p."name", p."sku", p."sellingPricePaise" AS price, p."mrpPaise" AS mrp, i.id AS inv, row_number() OVER (ORDER BY p.id) AS n
  FROM "Product" p JOIN "Inventory" i ON i."productId" = p.id AND i."variantId" IS NULL WHERE p."sku" LIKE 'LOAD-%';
CREATE TEMP TABLE lo AS
SELECT gen_random_uuid()::text AS id, g,
       'ZM' || to_char(now() - ((g % 90) || ' days')::interval, 'YYMMDD') || '-' || upper(substr(md5(g::text), 1, 6)) AS num,
       (SELECT id FROM lu WHERE n = 1 + g % ${users}) AS uid,
       now() - ((g % 90) || ' days')::interval - ((g % 1440) || ' minutes')::interval AS at,
       1 + g % 3 AS lines,
       (ARRAY['DELIVERED','DELIVERED','DELIVERED','CONFIRMED','OUT_FOR_DELIVERY','CANCELLED'])[1 + g % 6]::"OrderStatus" AS st
  FROM generate_series(1, ${orders}) g;
CREATE TEMP TABLE li AS
SELECT o.id AS oid, p.*, 1 + (o.g + k) % 3 AS qty
  FROM lo o CROSS JOIN LATERAL generate_series(1, o.lines) k
  JOIN lp p ON p.n = 1 + ((o.g * 7 + k * 131) % (SELECT count(*) FROM lp));

INSERT INTO "Order" ("id","orderNumber","userId","shipName","shipPhone","shipLine1","shipCity","shipState","shipPincode","status",
                     "subtotalPaise","deliveryChargePaise","discountPaise","taxPaise","totalPaise","paymentMethod","paymentStatus","inventoryHold",
                     "idempotencyKey","createdAt","updatedAt","deliveredAt")
SELECT o.id, o.num, o.uid, 'Load Customer', '9000000000', 'Load street ' || o.g, 'Ahmedabad', 'Gujarat', '3800' || lpad((o.g % 60)::text, 2, '0'), o.st,
       s.sub, CASE WHEN s.sub >= 19900 THEN 0 ELSE 2500 END, 0, 0, s.sub + CASE WHEN s.sub >= 19900 THEN 0 ELSE 2500 END,
       CASE WHEN o.g % 2 = 0 THEN 'ONLINE' ELSE 'CASH_ON_DELIVERY' END::"PaymentMethod",
       CASE WHEN o.st = 'CANCELLED' THEN 'FAILED' ELSE 'PAID' END::"PaymentStatus",
       CASE WHEN o.st = 'CANCELLED' THEN 'RELEASED' ELSE 'COMMITTED' END::"InventoryHold",
       gen_random_uuid()::text, o.at, o.at, CASE WHEN o.st = 'DELIVERED' THEN o.at + interval '6 hours' END
  FROM lo o JOIN (SELECT oid, sum(price * qty) AS sub FROM li GROUP BY oid) s ON s.oid = o.id;

INSERT INTO "OrderItem" ("id","orderId","productId","inventoryId","productName","productSku","quantity","unitPricePaise","mrpPaise","totalPricePaise")
SELECT gen_random_uuid(), li.oid, li.id, li.inv, li."name", li."sku", li.qty, li.price, li.mrp, li.price * li.qty FROM li;

INSERT INTO "Payment" ("id","orderId","provider","paymentMethod","amountPaise","status","attempt","createdAt","updatedAt","capturedAt")
SELECT gen_random_uuid(), o.id, CASE WHEN o."paymentMethod" = 'ONLINE' THEN 'RAZORPAY' ELSE 'COD' END::"PaymentProvider", o."paymentMethod", o."totalPaise",
       CASE WHEN o."paymentStatus" = 'PAID' THEN 'PAID' ELSE 'FAILED' END::"PaymentStatus", 1, o."createdAt", o."createdAt",
       CASE WHEN o."paymentStatus" = 'PAID' THEN o."createdAt" END
  FROM "Order" o JOIN lo ON lo.id = o.id;

INSERT INTO "OrderStatusHistory" ("id","orderId","toStatus","actor","createdAt")
SELECT gen_random_uuid(), o.id, o."status", 'system', o."createdAt" FROM "Order" o JOIN lo ON lo.id = o.id;
COMMIT;
ANALYZE;
`;

const started = Date.now();
psql(conn, sql);
const count = (t, w = '') => psql(conn, `SELECT count(*) FROM "${t}" ${w}`);
console.log(
  JSON.stringify(
    { ok: true, database: conn.database, ms: Date.now() - started, products: count('Product'), users: count('User'), orders: count('Order'), orderItems: count('OrderItem') },
    null,
    2
  )
);
