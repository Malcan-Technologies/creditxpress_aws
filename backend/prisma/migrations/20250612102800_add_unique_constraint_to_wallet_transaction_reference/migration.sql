/*
  Warnings:

  - A unique constraint covering the columns `[reference]` on the table `wallet_transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_reference_key" ON "wallet_transactions"("reference");
