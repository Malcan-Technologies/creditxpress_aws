-- AlterTable
ALTER TABLE "credit_reports" ADD COLUMN IF NOT EXISTS "litigationIndex" TEXT,
ADD COLUMN IF NOT EXISTS "hasDataError" BOOLEAN;

