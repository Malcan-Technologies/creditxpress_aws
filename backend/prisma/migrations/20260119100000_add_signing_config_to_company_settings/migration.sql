-- Add signing configuration fields to company_settings
-- These fields are used for digital signature attestation in loan agreements

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN "signUrl" TEXT;
ALTER TABLE "company_settings" ADD COLUMN "serverPublicIp" TEXT;
