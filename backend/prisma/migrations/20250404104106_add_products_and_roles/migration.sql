/*
  Warnings:

  - You are about to drop the column `accountNumber` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `bankName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `employerName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `employmentStatus` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `isOnboardingComplete` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `kycStatus` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastLoginAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `monthlyIncome` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `onboardingStep` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `postalCode` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "accountNumber",
DROP COLUMN "bankName",
DROP COLUMN "employerName",
DROP COLUMN "employmentStatus",
DROP COLUMN "isOnboardingComplete",
DROP COLUMN "kycStatus",
DROP COLUMN "lastLoginAt",
DROP COLUMN "monthlyIncome",
DROP COLUMN "onboardingStep",
DROP COLUMN "postalCode",
ADD COLUMN     "country" TEXT,
ADD COLUMN     "idExpiry" TIMESTAMP(3),
ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "idType" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER',
ADD COLUMN     "zipCode" TEXT;

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minAmount" DOUBLE PRECISION NOT NULL,
    "maxAmount" DOUBLE PRECISION NOT NULL,
    "repaymentTerms" JSONB NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "eligibility" JSONB[],
    "lateFee" DOUBLE PRECISION NOT NULL,
    "originationFee" DOUBLE PRECISION NOT NULL,
    "legalFee" DOUBLE PRECISION NOT NULL,
    "applicationFee" DOUBLE PRECISION NOT NULL,
    "requiredDocuments" JSONB[],
    "features" JSONB[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "term" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
