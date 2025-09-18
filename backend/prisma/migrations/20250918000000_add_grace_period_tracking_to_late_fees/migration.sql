-- Add grace period tracking fields to late_fees table
ALTER TABLE "late_fees" ADD COLUMN "gracePeriodDays" INTEGER;
ALTER TABLE "late_fees" ADD COLUMN "gracePeriodRepayments" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "late_fees" ADD COLUMN "totalGracePeriodFees" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Create index for grace period repayments
CREATE INDEX "late_fees_gracePeriodRepayments_idx" ON "late_fees"("gracePeriodRepayments");
