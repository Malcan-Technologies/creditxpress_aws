-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "repaymentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileUrl" TEXT,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'Kredit.my',
    "companyAddress" TEXT NOT NULL DEFAULT 'Kuala Lumpur, Malaysia',
    "companyRegNo" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "footerNote" TEXT,
    "taxLabel" TEXT NOT NULL DEFAULT 'SST 6%',
    "companyLogo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_repaymentId_key" ON "payment_receipts"("repaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_receiptNumber_key" ON "payment_receipts"("receiptNumber");

-- CreateIndex
CREATE INDEX "payment_receipts_receiptNumber_idx" ON "payment_receipts"("receiptNumber");

-- CreateIndex
CREATE INDEX "payment_receipts_generatedAt_idx" ON "payment_receipts"("generatedAt");

-- CreateIndex
CREATE INDEX "payment_receipts_repaymentId_idx" ON "payment_receipts"("repaymentId");

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_repaymentId_fkey" FOREIGN KEY ("repaymentId") REFERENCES "loan_repayments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
