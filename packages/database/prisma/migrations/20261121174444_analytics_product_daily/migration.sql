-- CreateEnum
CREATE TYPE "AnalyticsCoverage" AS ENUM ('NONE', 'PARTIAL', 'FULL');

-- AlterTable
ALTER TABLE "AnalyticsSettings" ADD COLUMN     "trackingStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProductDailyAnalytics" (
    "day" DATE NOT NULL,
    "productId" TEXT NOT NULL,
    "categoryId" TEXT,
    "eventCoverage" "AnalyticsCoverage" NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "uniqueViewers" INTEGER NOT NULL DEFAULT 0,
    "unavailableViews" INTEGER NOT NULL DEFAULT 0,
    "cartAddUnits" INTEGER NOT NULL DEFAULT 0,
    "cartAddEvents" INTEGER NOT NULL DEFAULT 0,
    "cartRemoveUnits" INTEGER NOT NULL DEFAULT 0,
    "wishlistAdds" INTEGER NOT NULL DEFAULT 0,
    "outOfStockAttempts" INTEGER NOT NULL DEFAULT 0,
    "outOfStockUnits" INTEGER NOT NULL DEFAULT 0,
    "estLostRevenuePaise" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "unitsSold" INTEGER NOT NULL DEFAULT 0,
    "revenuePaise" INTEGER NOT NULL DEFAULT 0,
    "cancelledUnits" INTEGER NOT NULL DEFAULT 0,
    "failedDeliveryUnits" INTEGER NOT NULL DEFAULT 0,
    "cartAddUnitsByHour" INTEGER[],
    "unitsSoldByHour" INTEGER[],
    "stockoutMinutes" INTEGER NOT NULL DEFAULT 0,
    "activeStockRows" INTEGER NOT NULL DEFAULT 0,
    "inStockAtClose" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductDailyAnalytics_pkey" PRIMARY KEY ("day","productId")
);

-- CreateTable
CREATE TABLE "InventoryDailySnapshot" (
    "day" DATE NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "warehouseActive" BOOLEAN NOT NULL,
    "openingAvailable" INTEGER NOT NULL,
    "openingReserved" INTEGER NOT NULL,
    "closingAvailable" INTEGER NOT NULL,
    "closingReserved" INTEGER NOT NULL,
    "safetyStock" INTEGER NOT NULL,
    "closingSellable" INTEGER NOT NULL,
    "movements" INTEGER NOT NULL DEFAULT 0,
    "trackedMinutes" INTEGER NOT NULL,
    "stockoutMinutes" INTEGER NOT NULL DEFAULT 0,
    "longestStockoutMinutes" INTEGER NOT NULL DEFAULT 0,
    "stockouts" INTEGER NOT NULL DEFAULT 0,
    "consistent" BOOLEAN NOT NULL DEFAULT true,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryDailySnapshot_pkey" PRIMARY KEY ("day","inventoryId")
);

-- CreateIndex
CREATE INDEX "ProductDailyAnalytics_productId_day_idx" ON "ProductDailyAnalytics"("productId", "day");

-- CreateIndex
CREATE INDEX "ProductDailyAnalytics_categoryId_day_idx" ON "ProductDailyAnalytics"("categoryId", "day");

-- CreateIndex
CREATE INDEX "InventoryDailySnapshot_productId_day_idx" ON "InventoryDailySnapshot"("productId", "day");

-- CreateIndex
CREATE INDEX "InventoryDailySnapshot_warehouseId_day_idx" ON "InventoryDailySnapshot"("warehouseId", "day");
