/*
  Warnings:

  - A unique constraint covering the columns `[urlLink]` on the table `loan_applications` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "acceptTerms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "appStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "applicationFee" DOUBLE PRECISION,
ADD COLUMN     "interestRate" DOUBLE PRECISION,
ADD COLUMN     "lateFee" DOUBLE PRECISION,
ADD COLUMN     "legalFee" DOUBLE PRECISION,
ADD COLUMN     "monthlyRepayment" DOUBLE PRECISION,
ADD COLUMN     "netDisbursement" DOUBLE PRECISION,
ADD COLUMN     "originationFee" DOUBLE PRECISION,
ADD COLUMN     "paidAppFee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "urlLink" TEXT,
ALTER COLUMN "status" SET DEFAULT 'INCOMPLETE';

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_urlLink_key" ON "loan_applications"("urlLink");
