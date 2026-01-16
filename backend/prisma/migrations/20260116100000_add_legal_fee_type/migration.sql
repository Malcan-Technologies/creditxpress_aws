-- CreateEnum
CREATE TYPE "LegalFeeType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "legalFeeType" "LegalFeeType" NOT NULL DEFAULT 'FIXED';
ALTER TABLE "products" ADD COLUMN "legalFeeValue" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Migrate existing data: Set legalFeeType and legalFeeValue based on existing fields
-- If legalFeeFixed > 0, use FIXED type with that value
-- Otherwise, use PERCENTAGE type with legalFee value
UPDATE "products"
SET 
  "legalFeeType" = CASE 
    WHEN "legalFeeFixed" > 0 THEN 'FIXED'::"LegalFeeType"
    ELSE 'PERCENTAGE'::"LegalFeeType"
  END,
  "legalFeeValue" = CASE 
    WHEN "legalFeeFixed" > 0 THEN "legalFeeFixed"
    ELSE "legalFee"
  END;
