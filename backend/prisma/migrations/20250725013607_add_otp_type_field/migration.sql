-- AlterTable
ALTER TABLE "phone_verifications" ADD COLUMN     "otpType" TEXT NOT NULL DEFAULT 'PHONE_VERIFICATION';

-- CreateIndex
CREATE INDEX "phone_verifications_phoneNumber_otpType_idx" ON "phone_verifications"("phoneNumber", "otpType");
