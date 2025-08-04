-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "calculationMethod" TEXT,
ADD COLUMN     "customDueDate" INTEGER,
ADD COLUMN     "prorationCutoffDate" INTEGER,
ADD COLUMN     "scheduleType" TEXT;
