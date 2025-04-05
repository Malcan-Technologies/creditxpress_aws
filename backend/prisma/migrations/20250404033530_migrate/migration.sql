-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "refreshToken" TEXT,
    "fullName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "email" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "employmentStatus" TEXT,
    "employerName" TEXT,
    "monthlyIncome" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "isOnboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");
