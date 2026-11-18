-- Phase A analytics foundation. Purely additive: new enums, tables and indexes only; no existing table is altered.

-- CreateEnum
CREATE TYPE "AnalyticsEventName" AS ENUM ('APP_OPENED', 'HOME_VIEWED', 'CATEGORY_VIEWED', 'PRODUCT_VIEWED', 'PRODUCT_SEARCHED', 'CART_ITEM_ADDED', 'CART_ITEM_REMOVED', 'CART_VIEWED', 'CHECKOUT_STARTED', 'PURCHASE_COMPLETED', 'PRODUCT_UNAVAILABLE_VIEWED', 'OUT_OF_STOCK_ADD_ATTEMPT', 'WISHLIST_ADDED', 'DELIVERY_CHECKED', 'COUPON_APPLIED', 'ORDER_CANCELLED', 'REFUND_PROCESSED');

-- CreateEnum
CREATE TYPE "AnalyticsEventCategory" AS ENUM ('BEHAVIORAL', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "AnalyticsEventSource" AS ENUM ('CLIENT', 'SERVER');

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" UUID NOT NULL,
    "name" "AnalyticsEventName" NOT NULL,
    "category" "AnalyticsEventCategory" NOT NULL,
    "source" "AnalyticsEventSource" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "categoryId" TEXT,
    "cartId" TEXT,
    "orderId" TEXT,
    "warehouseId" TEXT,
    "zoneId" TEXT,
    "pincode" TEXT,
    "quantity" INTEGER,
    "unitPricePaise" INTEGER,
    "searchTerm" TEXT,
    "resultCount" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSession" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "landingPath" TEXT,
    "referrerHost" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "deviceType" TEXT,
    "eventCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "behavioralRetentionDays" INTEGER NOT NULL DEFAULT 180,
    "operationalRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "cartAbandonmentHours" INTEGER NOT NULL DEFAULT 24,
    "sessionIdleMinutes" INTEGER NOT NULL DEFAULT 30,
    "consentVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsJobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "rows" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AnalyticsJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_occurredAt_idx" ON "AnalyticsEvent"("name", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_productId_occurredAt_idx" ON "AnalyticsEvent"("productId", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_category_occurredAt_idx" ON "AnalyticsEvent"("category", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_visitorId_idx" ON "AnalyticsEvent"("visitorId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsSession_visitorId_idx" ON "AnalyticsSession"("visitorId");

-- CreateIndex
CREATE INDEX "AnalyticsSession_userId_idx" ON "AnalyticsSession"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsSession_startedAt_idx" ON "AnalyticsSession"("startedAt");

-- CreateIndex
CREATE INDEX "AnalyticsSession_lastSeenAt_idx" ON "AnalyticsSession"("lastSeenAt");

-- CreateIndex
CREATE INDEX "AnalyticsJobRun_status_idx" ON "AnalyticsJobRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsJobRun_job_day_key" ON "AnalyticsJobRun"("job", "day");

