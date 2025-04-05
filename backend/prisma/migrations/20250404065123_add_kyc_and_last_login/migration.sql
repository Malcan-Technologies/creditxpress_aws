-- AlterTable
ALTER TABLE "users" ADD COLUMN     "kycStatus" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);
