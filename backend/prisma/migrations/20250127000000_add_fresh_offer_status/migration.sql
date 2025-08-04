-- CreateEnum
-- Add PENDING_FRESH_OFFER to possible loan application statuses

-- Add fresh offer fields to LoanApplication table
ALTER TABLE "loan_applications" ADD COLUMN "freshOfferAmount" DECIMAL(10,2);
ALTER TABLE "loan_applications" ADD COLUMN "freshOfferTerm" INTEGER;
ALTER TABLE "loan_applications" ADD COLUMN "freshOfferInterestRate" DECIMAL(5,2);
ALTER TABLE "loan_applications" ADD COLUMN "freshOfferMonthlyRepayment" DECIMAL(10,2);
ALTER TABLE "loan_applications" ADD COLUMN "freshOfferNetDisbursement" DECIMAL(10,2);
ALTER TABLE "loan_applications" ADD COLUMN "freshOfferNotes" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "freshOfferSubmittedAt" TIMESTAMP(3);
ALTER TABLE "loan_applications" ADD COLUMN "freshOfferSubmittedBy" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "originalOfferAmount" DECIMAL(10,2);
ALTER TABLE "loan_applications" ADD COLUMN "originalOfferTerm" INTEGER;
ALTER TABLE "loan_applications" ADD COLUMN "originalOfferInterestRate" DECIMAL(5,2);
ALTER TABLE "loan_applications" ADD COLUMN "originalOfferMonthlyRepayment" DECIMAL(10,2);
ALTER TABLE "loan_applications" ADD COLUMN "originalOfferNetDisbursement" DECIMAL(10,2);