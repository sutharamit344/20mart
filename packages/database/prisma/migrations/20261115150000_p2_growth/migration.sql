-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('APPLIED', 'REVERSED');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('PROMOTION', 'FILL_YOUR_CART');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WELCOME', 'ORDER_CONFIRMATION', 'PAYMENT_CONFIRMATION', 'ORDER_STATUS', 'ORDER_CANCELLED', 'COUPON_ISSUED', 'CAMPAIGN_ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'SKIPPED');

-- DropForeignKey
ALTER TABLE "CouponRule" DROP CONSTRAINT "CouponRule_couponId_fkey";

-- DropIndex
DROP INDEX "CouponRedemption_couponId_idx";

-- DropIndex
DROP INDEX "CouponRedemption_userId_idx";

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "couponCode" TEXT;

-- AlterTable
ALTER TABLE "Coupon" DROP COLUMN "source",
DROP COLUMN "validUntil",
ADD COLUMN     "autoIssueOnSignup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "maxDiscountPaise" INTEGER,
ADD COLUMN     "perCustomerLimit" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "requiresGrant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "isActive" SET DEFAULT false;

-- AlterTable
ALTER TABLE "CouponRedemption" DROP COLUMN "savedPaise",
ADD COLUMN     "discountPaise" INTEGER NOT NULL,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "status" "RedemptionStatus" NOT NULL DEFAULT 'APPLIED';

-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN     "emailOrderUpdates" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "couponId" TEXT;

-- AlterTable
ALTER TABLE "ServiceablePincode" ADD COLUMN     "zoneId" TEXT;

-- DropTable
DROP TABLE "CouponRule";

-- CreateTable
CREATE TABLE "CouponProduct" (
    "couponId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "CouponProduct_pkey" PRIMARY KEY ("couponId","productId")
);

-- CreateTable
CREATE TABLE "CouponCategory" (
    "couponId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "CouponCategory_pkey" PRIMARY KEY ("couponId","categoryId")
);

-- CreateTable
CREATE TABLE "CouponGrant" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "campaignId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL DEFAULT 'PROMOTION',
    "description" TEXT,
    "bannerTitle" TEXT,
    "bannerSubtitle" TEXT,
    "bannerImageUrl" TEXT,
    "bannerImageKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "showOnHomepage" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "couponId" TEXT,
    "maxQtyPerItem" INTEGER NOT NULL DEFAULT 10,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignProduct" (
    "campaignId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CampaignProduct_pkey" PRIMARY KEY ("campaignId","productId")
);

-- CreateTable
CREATE TABLE "CampaignParticipant" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignCartItem" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignFavorite" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deliveryFeePaise" INTEGER,
    "estimateHours" INTEGER,
    "minOrderPaise" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CouponProduct_productId_idx" ON "CouponProduct"("productId");

-- CreateIndex
CREATE INDEX "CouponCategory_categoryId_idx" ON "CouponCategory"("categoryId");

-- CreateIndex
CREATE INDEX "CouponGrant_userId_idx" ON "CouponGrant"("userId");

-- CreateIndex
CREATE INDEX "CouponGrant_campaignId_idx" ON "CouponGrant"("campaignId");

-- CreateIndex
CREATE INDEX "CouponGrant_issuedAt_idx" ON "CouponGrant"("issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CouponGrant_couponId_userId_key" ON "CouponGrant"("couponId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE INDEX "Campaign_isActive_startsAt_endsAt_idx" ON "Campaign"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Campaign_type_idx" ON "Campaign"("type");

-- CreateIndex
CREATE INDEX "CampaignProduct_productId_idx" ON "CampaignProduct"("productId");

-- CreateIndex
CREATE INDEX "CampaignParticipant_userId_idx" ON "CampaignParticipant"("userId");

-- CreateIndex
CREATE INDEX "CampaignParticipant_joinedAt_idx" ON "CampaignParticipant"("joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignParticipant_campaignId_userId_key" ON "CampaignParticipant"("campaignId", "userId");

-- CreateIndex
CREATE INDEX "CampaignCartItem_campaignId_productId_idx" ON "CampaignCartItem"("campaignId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCartItem_campaignId_userId_productId_key" ON "CampaignCartItem"("campaignId", "userId", "productId");

-- CreateIndex
CREATE INDEX "CampaignFavorite_campaignId_productId_idx" ON "CampaignFavorite"("campaignId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignFavorite_campaignId_userId_productId_key" ON "CampaignFavorite"("campaignId", "userId", "productId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_providerMessageId_key" ON "EmailMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "EmailMessage_status_createdAt_idx" ON "EmailMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailMessage_userId_idx" ON "EmailMessage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryZone_name_key" ON "DeliveryZone"("name");

-- CreateIndex
CREATE INDEX "Coupon_isActive_startsAt_idx" ON "Coupon"("isActive", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_status_idx" ON "CouponRedemption"("couponId", "status");

-- CreateIndex
CREATE INDEX "CouponRedemption_userId_couponId_idx" ON "CouponRedemption"("userId", "couponId");

-- CreateIndex
CREATE INDEX "CouponRedemption_redeemedAt_idx" ON "CouponRedemption"("redeemedAt");

-- CreateIndex
CREATE INDEX "ServiceablePincode_zoneId_idx" ON "ServiceablePincode"("zoneId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceablePincode" ADD CONSTRAINT "ServiceablePincode_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCategory" ADD CONSTRAINT "CouponCategory_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCategory" ADD CONSTRAINT "CouponCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponGrant" ADD CONSTRAINT "CouponGrant_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponGrant" ADD CONSTRAINT "CouponGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponGrant" ADD CONSTRAINT "CouponGrant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignProduct" ADD CONSTRAINT "CampaignProduct_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignProduct" ADD CONSTRAINT "CampaignProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignParticipant" ADD CONSTRAINT "CampaignParticipant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignParticipant" ADD CONSTRAINT "CampaignParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCartItem" ADD CONSTRAINT "CampaignCartItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCartItem" ADD CONSTRAINT "CampaignCartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCartItem" ADD CONSTRAINT "CampaignCartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFavorite" ADD CONSTRAINT "CampaignFavorite_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFavorite" ADD CONSTRAINT "CampaignFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFavorite" ADD CONSTRAINT "CampaignFavorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written integrity rules (P2)
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_value_check" CHECK ("discountValue" > 0 AND ("discountType" <> 'PERCENT' OR "discountValue" <= 10000));
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_limits_check" CHECK ("perCustomerLimit" >= 1 AND ("usageLimit" IS NULL OR "usageLimit" >= 1) AND "usedCount" >= 0 AND ("usageLimit" IS NULL OR "usedCount" <= "usageLimit"));
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_money_check" CHECK ("minOrderValuePaise" >= 0 AND ("maxDiscountPaise" IS NULL OR "maxDiscountPaise" > 0));
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_window_check" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt");
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_code_upper_check" CHECK ("code" = upper("code"));
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_discount_check" CHECK ("discountPaise" > 0);
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_window_check" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt");
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_maxqty_check" CHECK ("maxQtyPerItem" BETWEEN 1 AND 99);
ALTER TABLE "CampaignCartItem" ADD CONSTRAINT "CampaignCartItem_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_money_check" CHECK (("deliveryFeePaise" IS NULL OR "deliveryFeePaise" >= 0) AND ("minOrderPaise" IS NULL OR "minOrderPaise" >= 0) AND ("estimateHours" IS NULL OR "estimateHours" > 0));
