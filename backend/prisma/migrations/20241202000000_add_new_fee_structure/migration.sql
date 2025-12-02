-- AlterTable
ALTER TABLE "products" ADD COLUMN "stampingFee" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "legalFeeFixed" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN "stampingFee" DOUBLE PRECISION;
ALTER TABLE "loan_applications" ADD COLUMN "legalFeeFixed" DOUBLE PRECISION;
ALTER TABLE "loan_applications" ADD COLUMN "freshOfferStampingFee" DOUBLE PRECISION;
ALTER TABLE "loan_applications" ADD COLUMN "freshOfferLegalFeeFixed" DOUBLE PRECISION;

