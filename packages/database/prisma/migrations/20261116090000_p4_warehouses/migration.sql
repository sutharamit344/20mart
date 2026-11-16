-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('WAREHOUSE', 'FULFILLMENT_CENTER', 'STORAGE', 'SUPPLIER_DISPATCH');

-- CreateEnum
CREATE TYPE "WarehouseStatus" AS ENUM ('SETUP', 'ACTIVE', 'PAUSED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- AlterEnum


ALTER TYPE "StockMovementType" ADD VALUE 'PURCHASE_RECEIPT';
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_IN';

-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "safetyStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryFailureReason" TEXT,
ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ADD COLUMN     "fulfillmentWarehouseId" TEXT;

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "WarehouseType" NOT NULL DEFAULT 'WAREHOUSE',
    "status" "WarehouseStatus" NOT NULL DEFAULT 'SETUP',
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "pinCode" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "contactName" TEXT,
    "contactNumber" TEXT,
    "dailyOrderCapacity" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseDeliveryZone" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "deliveryFeePaise" INTEGER,
    "estimateHours" INTEGER,
    "cutoffTime" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseDeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryInterest" (
    "id" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pinCode" TEXT,
    "gstin" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "expectedDate" TIMESTAMP(3),
    "notes" TEXT,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "orderedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "quantityRejected" INTEGER NOT NULL DEFAULT 0,
    "unitCostPaise" INTEGER NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "receivedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptItem" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "quantityAccepted" INTEGER NOT NULL,
    "quantityRejected" INTEGER NOT NULL DEFAULT 0,
    "discrepancyNote" TEXT,

    CONSTRAINT "GoodsReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "Warehouse_status_idx" ON "Warehouse"("status");

-- CreateIndex
CREATE INDEX "WarehouseDeliveryZone_zoneId_isActive_priority_idx" ON "WarehouseDeliveryZone"("zoneId", "isActive", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseDeliveryZone_warehouseId_zoneId_key" ON "WarehouseDeliveryZone"("warehouseId", "zoneId");

-- CreateIndex
CREATE INDEX "DeliveryInterest_createdAt_idx" ON "DeliveryInterest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryInterest_pincode_email_key" ON "DeliveryInterest"("pincode", "email");

-- CreateIndex
CREATE INDEX "Supplier_status_name_idx" ON "Supplier"("status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_createdAt_idx" ON "PurchaseOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_warehouseId_idx" ON "PurchaseOrder"("warehouseId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_productId_idx" ON "PurchaseOrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_receiptNumber_key" ON "GoodsReceipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_idempotencyKey_key" ON "GoodsReceipt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GoodsReceipt_purchaseOrderId_createdAt_idx" ON "GoodsReceipt"("purchaseOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "GoodsReceiptItem_goodsReceiptId_idx" ON "GoodsReceiptItem"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "GoodsReceiptItem_purchaseOrderItemId_idx" ON "GoodsReceiptItem"("purchaseOrderItemId");

-- CreateIndex
CREATE INDEX "Inventory_warehouseId_idx" ON "Inventory"("warehouseId");

-- CreateIndex
CREATE INDEX "Order_fulfillmentWarehouseId_createdAt_idx" ON "Order"("fulfillmentWarehouseId", "createdAt");

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_fulfillmentWarehouseId_fkey" FOREIGN KEY ("fulfillmentWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseDeliveryZone" ADD CONSTRAINT "WarehouseDeliveryZone_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseDeliveryZone" ADD CONSTRAINT "WarehouseDeliveryZone_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DeliveryZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ───────────── P4 data migration (non-destructive) ─────────────
-- Existing stock rows predate warehouses. Attach them to ONE placeholder location in SETUP
-- status so no stock or movement history is lost. SETUP locations never serve customers:
-- an admin must enter the real address, activate it and map it to delivery areas first.
INSERT INTO "Warehouse" ("id", "name", "code", "type", "status", "addressLine1", "city", "state", "country", "pinCode", "notes", "updatedAt")
SELECT gen_random_uuid()::text, 'Primary location (needs setup)', 'PRIMARY', 'WAREHOUSE', 'SETUP',
       'Address not configured', 'Not configured', 'Not configured', 'IN', '000000',
       'Created automatically by the P4 migration to hold stock recorded before warehouses existed. Update its details before activating it.',
       (now() AT TIME ZONE 'UTC')
 WHERE EXISTS (SELECT 1 FROM "Inventory");

UPDATE "Inventory" SET "warehouseId" = (SELECT "id" FROM "Warehouse" WHERE "code" = 'PRIMARY') WHERE "warehouseId" IS NULL;
ALTER TABLE "Inventory" ALTER COLUMN "warehouseId" SET NOT NULL;

-- Historical orders were fulfilled from that same stock.
UPDATE "Order" o SET "fulfillmentWarehouseId" = (
  SELECT i."warehouseId" FROM "OrderItem" oi JOIN "Inventory" i ON i."id" = oi."inventoryId" WHERE oi."orderId" = o."id" LIMIT 1)
 WHERE o."fulfillmentWarehouseId" IS NULL;

-- One stock row per (warehouse, product) and per (warehouse, variant).
DROP INDEX IF EXISTS "Inventory_product_no_variant_key";
DROP INDEX IF EXISTS "Inventory_variant_key";
CREATE UNIQUE INDEX "Inventory_wh_product_no_variant_key" ON "Inventory" ("warehouseId", "productId") WHERE "variantId" IS NULL;
CREATE UNIQUE INDEX "Inventory_wh_variant_key" ON "Inventory" ("warehouseId", "variantId") WHERE "variantId" IS NOT NULL;

ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_safety_check" CHECK ("safetyStock" >= 0);
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_capacity_check" CHECK ("dailyOrderCapacity" IS NULL OR "dailyOrderCapacity" > 0);
ALTER TABLE "WarehouseDeliveryZone"
  ADD CONSTRAINT "WarehouseDeliveryZone_values_check"
  CHECK ("priority" >= 0 AND ("deliveryFeePaise" IS NULL OR "deliveryFeePaise" >= 0) AND ("estimateHours" IS NULL OR "estimateHours" > 0));
ALTER TABLE "PurchaseOrderItem"
  ADD CONSTRAINT "PurchaseOrderItem_quantities_check"
  CHECK ("quantityOrdered" > 0 AND "quantityReceived" >= 0 AND "quantityRejected" >= 0
         AND "quantityReceived" + "quantityRejected" <= "quantityOrdered" AND "unitCostPaise" >= 0);
ALTER TABLE "GoodsReceiptItem"
  ADD CONSTRAINT "GoodsReceiptItem_quantities_check" CHECK ("quantityAccepted" >= 0 AND "quantityRejected" >= 0 AND "quantityAccepted" + "quantityRejected" > 0);
-- One line per product/variant on a purchase order.
CREATE UNIQUE INDEX "PurchaseOrderItem_po_product_no_variant_key" ON "PurchaseOrderItem" ("purchaseOrderId", "productId") WHERE "variantId" IS NULL;
CREATE UNIQUE INDEX "PurchaseOrderItem_po_variant_key" ON "PurchaseOrderItem" ("purchaseOrderId", "variantId") WHERE "variantId" IS NOT NULL;
