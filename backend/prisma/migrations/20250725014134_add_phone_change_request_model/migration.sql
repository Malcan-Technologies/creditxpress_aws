-- CreateTable
CREATE TABLE "phone_change_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentPhone" TEXT NOT NULL,
    "newPhone" TEXT NOT NULL,
    "currentVerified" BOOLEAN NOT NULL DEFAULT false,
    "newVerified" BOOLEAN NOT NULL DEFAULT false,
    "changeToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "phone_change_requests_changeToken_key" ON "phone_change_requests"("changeToken");

-- CreateIndex
CREATE INDEX "phone_change_requests_userId_idx" ON "phone_change_requests"("userId");

-- CreateIndex
CREATE INDEX "phone_change_requests_changeToken_idx" ON "phone_change_requests"("changeToken");

-- CreateIndex
CREATE INDEX "phone_change_requests_expiresAt_idx" ON "phone_change_requests"("expiresAt");

-- AddForeignKey
ALTER TABLE "phone_change_requests" ADD CONSTRAINT "phone_change_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
