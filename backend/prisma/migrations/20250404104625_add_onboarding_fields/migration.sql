-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isOnboardingComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kycStatus" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0;
