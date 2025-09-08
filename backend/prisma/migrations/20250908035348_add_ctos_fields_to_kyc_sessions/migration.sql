-- AlterTable
ALTER TABLE "kyc_sessions" ADD COLUMN     "ctosData" JSONB,
ADD COLUMN     "ctosExpiredAt" TIMESTAMP(3),
ADD COLUMN     "ctosOnboardingId" TEXT,
ADD COLUMN     "ctosOnboardingUrl" TEXT,
ADD COLUMN     "ctosResult" INTEGER,
ADD COLUMN     "ctosStatus" INTEGER;

-- CreateIndex
CREATE INDEX "kyc_sessions_ctosOnboardingId_idx" ON "kyc_sessions"("ctosOnboardingId");
