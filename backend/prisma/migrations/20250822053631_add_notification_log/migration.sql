-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FRESH_OFFER';
ALTER TYPE "NotificationType" ADD VALUE 'FRESH_OFFER_RESPONSE';

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "freshOfferAmount" DOUBLE PRECISION,
ADD COLUMN     "freshOfferInterestRate" DOUBLE PRECISION,
ADD COLUMN     "freshOfferMonthlyRepayment" DOUBLE PRECISION,
ADD COLUMN     "freshOfferNetDisbursement" DOUBLE PRECISION,
ADD COLUMN     "freshOfferNotes" TEXT,
ADD COLUMN     "freshOfferSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "freshOfferSubmittedBy" TEXT,
ADD COLUMN     "freshOfferTerm" INTEGER,
ADD COLUMN     "originalOfferAmount" DOUBLE PRECISION,
ADD COLUMN     "originalOfferInterestRate" DOUBLE PRECISION,
ADD COLUMN     "originalOfferMonthlyRepayment" DOUBLE PRECISION,
ADD COLUMN     "originalOfferNetDisbursement" DOUBLE PRECISION,
ADD COLUMN     "originalOfferTerm" INTEGER;

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "notificationKey" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "notificationType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_logs_notificationKey_idx" ON "notification_logs"("notificationKey");

-- CreateIndex
CREATE INDEX "notification_logs_createdAt_idx" ON "notification_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notification_logs_notificationType_idx" ON "notification_logs"("notificationType");
