-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY', 'COD', 'MANUAL');

-- CreateEnum
CREATE TYPE "InventoryHold" AS ENUM ('RESERVED', 'COMMITTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CONVERTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PACKED';
ALTER TYPE "OrderStatus" ADD VALUE 'READY_FOR_DISPATCH';
ALTER TYPE "OrderStatus" ADD VALUE 'FAILED';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'ONLINE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_variantId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_addressId_fkey";

-- DropIndex
DROP INDEX "Cart_userId_idx";

-- DropIndex
DROP INDEX "Order_status_idx";

-- DropIndex
DROP INDEX "Order_userId_idx";

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'IN',
ADD COLUMN     "landmark" TEXT;

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "pricePaise",
ADD COLUMN     "addedPricePaise" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryEstimate" TEXT,
ADD COLUMN     "idempotencyKey" TEXT NOT NULL,
ADD COLUMN     "inventoryHold" "InventoryHold" NOT NULL DEFAULT 'RESERVED',
ADD COLUMN     "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "shipCity" TEXT NOT NULL,
ADD COLUMN     "shipCountry" TEXT NOT NULL DEFAULT 'IN',
ADD COLUMN     "shipLandmark" TEXT,
ADD COLUMN     "shipLine1" TEXT NOT NULL,
ADD COLUMN     "shipLine2" TEXT,
ADD COLUMN     "shipName" TEXT NOT NULL,
ADD COLUMN     "shipPhone" TEXT NOT NULL,
ADD COLUMN     "shipPincode" TEXT NOT NULL,
ADD COLUMN     "shipState" TEXT NOT NULL,
ADD COLUMN     "taxPaise" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "addressId" DROP NOT NULL,
ALTER COLUMN "paymentMethod" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "imageUrl",
DROP COLUMN "name",
DROP COLUMN "pricePaise",
ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "inventoryId" TEXT NOT NULL,
ADD COLUMN     "mrpPaise" INTEGER NOT NULL,
ADD COLUMN     "productImage" TEXT,
ADD COLUMN     "productName" TEXT NOT NULL,
ADD COLUMN     "productSku" TEXT NOT NULL,
ADD COLUMN     "totalPricePaise" INTEGER NOT NULL,
ADD COLUMN     "unitPricePaise" INTEGER NOT NULL,
ADD COLUMN     "variantName" TEXT,
ALTER COLUMN "quantity" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "gatewayRef",
DROP COLUMN "transactionId",
ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "capturedAt" TIMESTAMP(3),
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "provider" "PaymentProvider" NOT NULL,
ADD COLUMN     "providerOrderId" TEXT,
ADD COLUMN     "providerPaymentId" TEXT;

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerRefundId" TEXT,
    "reference" TEXT,
    "reason" TEXT NOT NULL,
    "failureReason" TEXT,
    "initiatedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "changedByAdminId" TEXT,
    "changedByUserId" TEXT,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderNote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "adminId" TEXT,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "codEnabled" BOOLEAN NOT NULL DEFAULT false,
    "onlinePaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deliveryFeePaise" INTEGER NOT NULL DEFAULT 4000,
    "freeDeliveryThresholdPaise" INTEGER NOT NULL DEFAULT 19900,
    "minOrderPaise" INTEGER NOT NULL DEFAULT 9900,
    "defaultEstimateHours" INTEGER NOT NULL DEFAULT 24,
    "operatingHoursStart" TEXT NOT NULL DEFAULT '09:00',
    "operatingHoursEnd" TEXT NOT NULL DEFAULT '21:00',
    "reservationMinutes" INTEGER NOT NULL DEFAULT 20,
    "maxQtyPerLine" INTEGER NOT NULL DEFAULT 10,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceablePincode" (
    "id" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "isServiceable" BOOLEAN NOT NULL DEFAULT true,
    "area" TEXT,
    "city" TEXT,
    "deliveryFeePaise" INTEGER,
    "estimateHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceablePincode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_eventId_key" ON "PaymentEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderNote_orderId_createdAt_idx" ON "OrderNote"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "WishlistItem_productId_idx" ON "WishlistItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_userId_productId_key" ON "WishlistItem"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceablePincode_pincode_key" ON "ServiceablePincode"("pincode");

-- CreateIndex
CREATE INDEX "ServiceablePincode_isServiceable_idx" ON "ServiceablePincode"("isServiceable");

-- CreateIndex
CREATE INDEX "Cart_userId_status_idx" ON "Cart"("userId", "status");

-- CreateIndex
CREATE INDEX "Cart_updatedAt_idx" ON "Cart"("updatedAt");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "Order_shipPincode_idx" ON "Order"("shipPincode");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key" ON "Order"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerOrderId_key" ON "Payment"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_changedByAdminId_fkey" FOREIGN KEY ("changedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────
-- Hand-written P1 constraints and search indexes
-- ─────────────────────────────────────────────────────────────────────

-- Trigram indexes so case-insensitive substring search (ILIKE) stays fast.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Product_sku_trgm_idx" ON "Product" USING GIN ("sku" gin_trgm_ops);
CREATE INDEX "ProductVariant_sku_trgm_idx" ON "ProductVariant" USING GIN ("sku" gin_trgm_ops);
CREATE INDEX "Brand_name_trgm_idx" ON "Brand" USING GIN ("name" gin_trgm_ops);

-- One active cart per customer; one line per product (no variant) / per variant.
CREATE UNIQUE INDEX "Cart_one_active_per_user_key" ON "Cart" ("userId") WHERE "status" = 'ACTIVE' AND "userId" IS NOT NULL;
CREATE UNIQUE INDEX "CartItem_product_no_variant_key" ON "CartItem" ("cartId", "productId") WHERE "variantId" IS NULL;
CREATE UNIQUE INDEX "CartItem_variant_key" ON "CartItem" ("cartId", "variantId") WHERE "variantId" IS NOT NULL;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_check" CHECK ("quantity" > 0 AND "addedPricePaise" >= 0);

-- At most one default address per customer.
CREATE UNIQUE INDEX "Address_one_default_per_user_key" ON "Address" ("userId") WHERE "isDefault";

-- Money integrity (integer paise).
ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_check" CHECK (
  "subtotalPaise" >= 0 AND "deliveryChargePaise" >= 0 AND "discountPaise" >= 0 AND "taxPaise" >= 0 AND "totalPaise" >= 0
  AND "totalPaise" = "subtotalPaise" + "deliveryChargePaise" + "taxPaise" - "discountPaise"
);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_amounts_check" CHECK (
  "quantity" > 0 AND "unitPricePaise" > 0 AND "totalPricePaise" = "unitPricePaise" * "quantity"
);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_check" CHECK ("amountPaise" >= 0);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_check" CHECK ("amountPaise" > 0);
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_values_check" CHECK (
  "deliveryFeePaise" >= 0 AND "freeDeliveryThresholdPaise" >= 0 AND "minOrderPaise" >= 0
  AND "defaultEstimateHours" > 0 AND "reservationMinutes" BETWEEN 5 AND 1440 AND "maxQtyPerLine" BETWEEN 1 AND 100
);
ALTER TABLE "ServiceablePincode" ADD CONSTRAINT "ServiceablePincode_format_check" CHECK ("pincode" ~ '^[1-9][0-9]{5}$');
