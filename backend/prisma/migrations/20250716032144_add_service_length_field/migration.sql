/*
  Warnings:

  - You are about to alter the column `totalFeeAmount` on the `late_fee_processing_logs` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `totalAccruedFees` on the `late_fees` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `amount` on the `loan_applications` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `applicationFee` on the `loan_applications` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `interestRate` on the `loan_applications` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `lateFee` on the `loan_applications` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `legalFee` on the `loan_applications` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `monthlyRepayment` on the `loan_applications` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `netDisbursement` on the `loan_applications` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `originationFee` on the `loan_applications` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `amount` on the `loan_repayments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `principalAmount` on the `loan_repayments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `interestAmount` on the `loan_repayments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `actualAmount` on the `loan_repayments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `scheduledAmount` on the `loan_repayments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `lateFeeAmount` on the `loan_repayments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `lateFeesPaid` on the `loan_repayments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `principalPaid` on the `loan_repayments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `principalAmount` on the `loans` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `outstandingBalance` on the `loans` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `monthlyPayment` on the `loans` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `totalAmount` on the `loans` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `minAmount` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `maxAmount` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `interestRate` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `originationFee` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `legalFee` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `applicationFee` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `lateFeeFixedAmount` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `lateFeeRate` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `amount` on the `wallet_transactions` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `balance` on the `wallets` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `availableForWithdrawal` on the `wallets` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `totalDeposits` on the `wallets` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.
  - You are about to alter the column `totalWithdrawals` on the `wallets` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `DoublePrecision`.

*/
-- AlterTable
ALTER TABLE "late_fee_processing_logs" ALTER COLUMN "totalFeeAmount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "late_fees" ALTER COLUMN "totalAccruedFees" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "loan_applications" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "applicationFee" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "interestRate" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "lateFee" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "legalFee" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "monthlyRepayment" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "netDisbursement" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "originationFee" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "loan_repayments" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "principalAmount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "interestAmount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "actualAmount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "scheduledAmount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "lateFeeAmount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "lateFeesPaid" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "principalPaid" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "loans" ALTER COLUMN "principalAmount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "outstandingBalance" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "monthlyPayment" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalAmount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "minAmount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "maxAmount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "interestRate" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "originationFee" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "legalFee" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "applicationFee" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "lateFeeFixedAmount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "lateFeeRate" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "serviceLength" TEXT;

-- AlterTable
ALTER TABLE "wallet_transactions" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "wallets" ALTER COLUMN "balance" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "availableForWithdrawal" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalDeposits" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalWithdrawals" SET DATA TYPE DOUBLE PRECISION;
