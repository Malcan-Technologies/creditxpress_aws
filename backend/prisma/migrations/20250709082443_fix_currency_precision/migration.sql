-- Fix currency precision for floating point columns
-- Change from DOUBLE PRECISION to DECIMAL(15,2) for currency fields

-- Fix loans table outstandingBalance column
ALTER TABLE "loans" ALTER COLUMN "outstandingBalance" TYPE DECIMAL(15,2);

-- Fix loan_repayments table currency columns  
ALTER TABLE "loan_repayments" ALTER COLUMN "principalPaid" TYPE DECIMAL(15,2);
ALTER TABLE "loan_repayments" ALTER COLUMN "lateFeeAmount" TYPE DECIMAL(15,2);
ALTER TABLE "loan_repayments" ALTER COLUMN "lateFeesPaid" TYPE DECIMAL(15,2);

-- Also fix other currency columns in loan_repayments for consistency
ALTER TABLE "loan_repayments" ALTER COLUMN "amount" TYPE DECIMAL(15,2);
ALTER TABLE "loan_repayments" ALTER COLUMN "principalAmount" TYPE DECIMAL(15,2); 
ALTER TABLE "loan_repayments" ALTER COLUMN "interestAmount" TYPE DECIMAL(15,2);
ALTER TABLE "loan_repayments" ALTER COLUMN "scheduledAmount" TYPE DECIMAL(15,2);
ALTER TABLE "loan_repayments" ALTER COLUMN "actualAmount" TYPE DECIMAL(15,2);

-- Fix other currency columns in loans table for consistency
ALTER TABLE "loans" ALTER COLUMN "principalAmount" TYPE DECIMAL(15,2);
ALTER TABLE "loans" ALTER COLUMN "totalAmount" TYPE DECIMAL(15,2);
ALTER TABLE "loans" ALTER COLUMN "monthlyPayment" TYPE DECIMAL(15,2);

-- Fix wallet related currency columns
ALTER TABLE "wallets" ALTER COLUMN "balance" TYPE DECIMAL(15,2);
ALTER TABLE "wallets" ALTER COLUMN "availableForWithdrawal" TYPE DECIMAL(15,2);
ALTER TABLE "wallets" ALTER COLUMN "totalDeposits" TYPE DECIMAL(15,2);
ALTER TABLE "wallets" ALTER COLUMN "totalWithdrawals" TYPE DECIMAL(15,2);

ALTER TABLE "wallet_transactions" ALTER COLUMN "amount" TYPE DECIMAL(15,2);

-- Fix product currency columns
ALTER TABLE "products" ALTER COLUMN "minAmount" TYPE DECIMAL(15,2);
ALTER TABLE "products" ALTER COLUMN "maxAmount" TYPE DECIMAL(15,2);
ALTER TABLE "products" ALTER COLUMN "lateFeeRate" TYPE DECIMAL(15,2);
ALTER TABLE "products" ALTER COLUMN "lateFeeFixedAmount" TYPE DECIMAL(15,2);
ALTER TABLE "products" ALTER COLUMN "originationFee" TYPE DECIMAL(15,2);
ALTER TABLE "products" ALTER COLUMN "legalFee" TYPE DECIMAL(15,2);
ALTER TABLE "products" ALTER COLUMN "applicationFee" TYPE DECIMAL(15,2);
ALTER TABLE "products" ALTER COLUMN "interestRate" TYPE DECIMAL(15,2);

-- Fix loan application currency columns
ALTER TABLE "loan_applications" ALTER COLUMN "amount" TYPE DECIMAL(15,2);
ALTER TABLE "loan_applications" ALTER COLUMN "applicationFee" TYPE DECIMAL(15,2);
ALTER TABLE "loan_applications" ALTER COLUMN "interestRate" TYPE DECIMAL(15,2);
ALTER TABLE "loan_applications" ALTER COLUMN "lateFee" TYPE DECIMAL(15,2);
ALTER TABLE "loan_applications" ALTER COLUMN "legalFee" TYPE DECIMAL(15,2);
ALTER TABLE "loan_applications" ALTER COLUMN "monthlyRepayment" TYPE DECIMAL(15,2);
ALTER TABLE "loan_applications" ALTER COLUMN "netDisbursement" TYPE DECIMAL(15,2);
ALTER TABLE "loan_applications" ALTER COLUMN "originationFee" TYPE DECIMAL(15,2);

-- Fix late fees table currency columns
ALTER TABLE "late_fees" ALTER COLUMN "totalAccruedFees" TYPE DECIMAL(15,2);

-- Fix late fee processing logs currency columns
ALTER TABLE "late_fee_processing_logs" ALTER COLUMN "totalFeeAmount" TYPE DECIMAL(15,2);