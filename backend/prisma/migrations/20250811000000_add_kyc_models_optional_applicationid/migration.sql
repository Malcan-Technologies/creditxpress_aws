-- Add KYC models with optional applicationId; safe for existing DBs

-- Create kyc_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS "kyc_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ocrData" JSONB,
    "faceMatchScore" DOUBLE PRECISION,
    "livenessScore" DOUBLE PRECISION,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "kyc_sessions_pkey" PRIMARY KEY ("id")
);

-- Ensure applicationId is nullable (in case table existed with NOT NULL)
ALTER TABLE IF EXISTS "kyc_sessions" ALTER COLUMN "applicationId" DROP NOT NULL;

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS "kyc_sessions_userId_idx" ON "kyc_sessions" ("userId");
CREATE INDEX IF NOT EXISTS "kyc_sessions_applicationId_idx" ON "kyc_sessions" ("applicationId");

-- Add foreign keys if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'kyc_sessions_userId_fkey'
    ) THEN
        ALTER TABLE "kyc_sessions"
        ADD CONSTRAINT "kyc_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'kyc_sessions_applicationId_fkey'
    ) THEN
        ALTER TABLE "kyc_sessions"
        ADD CONSTRAINT "kyc_sessions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- Create kyc_documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS "kyc_documents" (
    "id" TEXT NOT NULL,
    "kycId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- Index for kyc_documents
CREATE INDEX IF NOT EXISTS "kyc_documents_kycId_idx" ON "kyc_documents" ("kycId");

-- Add foreign key for kyc_documents if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'kyc_documents_kycId_fkey'
    ) THEN
        ALTER TABLE "kyc_documents"
        ADD CONSTRAINT "kyc_documents_kycId_fkey" FOREIGN KEY ("kycId") REFERENCES "kyc_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;


