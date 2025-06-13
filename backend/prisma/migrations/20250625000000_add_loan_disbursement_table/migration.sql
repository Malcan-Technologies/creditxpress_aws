-- CreateTable
CREATE TABLE "loan_disbursements" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "bankName" TEXT,
  "bankAccountNumber" TEXT,
  "disbursedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disbursedBy" TEXT NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "loan_disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_disbursements_applicationId_key" ON "loan_disbursements"("applicationId");

-- AddForeignKey
ALTER TABLE "loan_disbursements" ADD CONSTRAINT "loan_disbursements_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE; 