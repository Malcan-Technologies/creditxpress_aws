import { Router, Response } from "express";
import { PrismaClient, WalletTransactionStatus } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Get user's wallet data
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user!.userId;

		// Get or create wallet for user
		let wallet = await prisma.wallet.findUnique({
			where: { userId },
			include: {
				transactions: {
					orderBy: { createdAt: "desc" },
					take: 10,
				},
			},
		});

		if (!wallet) {
			// Create wallet if it doesn't exist
			wallet = await prisma.wallet.create({
				data: {
					userId,
					balance: 0,
					availableForWithdrawal: 0,
					totalDeposits: 0,
					totalWithdrawals: 0,
				},
				include: {
					transactions: {
						orderBy: { createdAt: "desc" },
						take: 10,
					},
				},
			});
		}

		// Get user's bank connection status
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				bankName: true,
				accountNumber: true,
			},
		});

		// Get loan summary
		const loans = await prisma.loan.findMany({
			where: { userId },
			include: {
				repayments: true,
			},
		});

		const loanSummary = {
			totalOutstanding: loans.reduce(
				(sum, loan) => sum + loan.outstandingBalance,
				0
			),
			totalBorrowed: loans.reduce(
				(sum, loan) => sum + loan.principalAmount,
				0
			),
			totalRepaid: loans.reduce((sum, loan) => {
				const repaidAmount = loan.repayments
					.filter((r) => r.status === "COMPLETED")
					.reduce(
						(repaidSum, repayment) => repaidSum + repayment.amount,
						0
					);
				return sum + repaidAmount;
			}, 0),
			nextPaymentDue:
				loans
					.filter(
						(loan) =>
							loan.nextPaymentDue && loan.status === "ACTIVE"
					)
					.sort(
						(a, b) =>
							new Date(a.nextPaymentDue!).getTime() -
							new Date(b.nextPaymentDue!).getTime()
					)[0]?.nextPaymentDue || null,
			nextPaymentAmount:
				loans
					.filter(
						(loan) =>
							loan.nextPaymentDue && loan.status === "ACTIVE"
					)
					.sort(
						(a, b) =>
							new Date(a.nextPaymentDue!).getTime() -
							new Date(b.nextPaymentDue!).getTime()
					)[0]?.monthlyPayment || 0,
		};

		// Calculate total disbursed from loan disbursement transactions
		const totalDisbursed = await prisma.walletTransaction.aggregate({
			where: {
				userId,
				type: "LOAN_DISBURSEMENT",
				status: "APPROVED",
			},
			_sum: {
				amount: true,
			},
		});

		const walletData = {
			balance: wallet.balance,
			availableForWithdrawal: wallet.availableForWithdrawal,
			totalDeposits: wallet.totalDeposits,
			totalWithdrawals: wallet.totalWithdrawals,
			totalDisbursed: totalDisbursed._sum.amount || 0,
			pendingTransactions: wallet.transactions.filter(
				(t) => t.status === WalletTransactionStatus.PENDING
			).length,
			bankConnected: !!(user?.bankName && user?.accountNumber),
			bankName: user?.bankName,
			accountNumber: user?.accountNumber,
			loanSummary,
		};

		res.json(walletData);
		return;
	} catch (error) {
		console.error("Error fetching wallet data:", error);
		res.status(500).json({ error: "Internal server error" });
		return;
	}
});

// Get wallet transactions
router.get(
	"/transactions",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;
			const skip = (page - 1) * limit;

			const transactions = await prisma.walletTransaction.findMany({
				where: { userId },
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				include: {
					loan: {
						include: {
							application: {
								include: {
									product: true,
								},
							},
						},
					},
				},
			});

			const total = await prisma.walletTransaction.count({
				where: { userId },
			});

			res.json({
				transactions,
				pagination: {
					page,
					limit,
					total,
					pages: Math.ceil(total / limit),
				},
			});
			return;
		} catch (error) {
			console.error("Error fetching transactions:", error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	}
);

// Create deposit transaction
router.post(
	"/deposit",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const { amount, description } = req.body;

			if (!amount || amount <= 0) {
				return res.status(400).json({ error: "Invalid amount" });
			}

			// Get or create wallet
			let wallet = await prisma.wallet.findUnique({
				where: { userId },
			});

			if (!wallet) {
				wallet = await prisma.wallet.create({
					data: {
						userId,
						balance: 0,
						availableForWithdrawal: 0,
						totalDeposits: 0,
						totalWithdrawals: 0,
					},
				});
			}

			// Create transaction
			const transaction = await prisma.walletTransaction.create({
				data: {
					userId,
					walletId: wallet.id,
					type: "DEPOSIT",
					amount: parseFloat(amount),
					status: WalletTransactionStatus.PENDING,
					description: description || "Bank transfer deposit",
					reference: `DEP-${Date.now()}`,
				},
			});

			res.status(201).json(transaction);
			return;
		} catch (error) {
			console.error("Error creating deposit:", error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	}
);

// Create withdrawal transaction
router.post(
	"/withdraw",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const { amount, bankAccount, description } = req.body;

			if (!amount || amount <= 0) {
				return res.status(400).json({ error: "Invalid amount" });
			}

			if (!bankAccount) {
				return res
					.status(400)
					.json({ error: "Bank account is required" });
			}

			// Get wallet
			const wallet = await prisma.wallet.findUnique({
				where: { userId },
			});

			if (!wallet) {
				return res.status(404).json({ error: "Wallet not found" });
			}

			if (wallet.availableForWithdrawal < parseFloat(amount)) {
				return res.status(400).json({ error: "Insufficient funds" });
			}

			// Create transaction with bank account info in metadata
			const transaction = await prisma.walletTransaction.create({
				data: {
					userId,
					walletId: wallet.id,
					type: "WITHDRAWAL",
					amount: -parseFloat(amount),
					status: WalletTransactionStatus.PENDING,
					description: description || `Withdrawal to ${bankAccount}`,
					reference: `WD-${Date.now()}`,
					metadata: {
						bankAccount: bankAccount,
						withdrawalMethod: "BANK_TRANSFER",
					},
				},
			});

			res.status(201).json(transaction);
			return;
		} catch (error) {
			console.error("Error creating withdrawal:", error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	}
);

// Create loan repayment transaction
router.post(
	"/repay-loan",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const { loanId, amount, paymentMethod, description } = req.body;

			if (!loanId || !amount || amount <= 0) {
				return res
					.status(400)
					.json({ error: "Invalid loan ID or amount" });
			}

			if (
				!paymentMethod ||
				!["WALLET_BALANCE", "FRESH_FUNDS"].includes(paymentMethod)
			) {
				return res.status(400).json({
					error: "Invalid payment method. Must be WALLET_BALANCE or FRESH_FUNDS",
				});
			}

			// Get loan
			const loan = await prisma.loan.findFirst({
				where: {
					id: loanId,
					userId,
					status: {
						in: ["ACTIVE", "OVERDUE"],
					},
				},
			});

			if (!loan) {
				return res.status(404).json({ error: "Active loan not found" });
			}

			// Validate repayment amount doesn't exceed outstanding balance
			if (parseFloat(amount) > loan.outstandingBalance) {
				return res.status(400).json({
					error: "Repayment amount cannot exceed outstanding balance",
					outstandingBalance: loan.outstandingBalance,
				});
			}

			// Get wallet
			const wallet = await prisma.wallet.findUnique({
				where: { userId },
			});

			if (!wallet) {
				return res.status(404).json({ error: "Wallet not found" });
			}

			// For wallet balance payments, check sufficient funds
			if (paymentMethod === "WALLET_BALANCE") {
				if (wallet.availableForWithdrawal < parseFloat(amount)) {
					return res.status(400).json({
						error: "Insufficient wallet balance",
						availableBalance: wallet.availableForWithdrawal,
					});
				}
			}

			// Create transaction with payment method metadata
			const transaction = await prisma.walletTransaction.create({
				data: {
					userId,
					walletId: wallet.id,
					loanId,
					type: "LOAN_REPAYMENT",
					amount: -parseFloat(amount),
					status:
						paymentMethod === "WALLET_BALANCE"
							? WalletTransactionStatus.APPROVED // Auto-approve wallet balance payments
							: WalletTransactionStatus.PENDING, // Fresh funds need approval
					description:
						description ||
						`Loan repayment for loan ${loanId} via ${paymentMethod}`,
					reference: `REP-${Date.now()}`,
					metadata: {
						paymentMethod,
						loanId,
						outstandingBalance: loan.outstandingBalance,
					},
				},
			});

			// If using wallet balance, immediately process the repayment
			if (paymentMethod === "WALLET_BALANCE") {
				await prisma.$transaction(async (tx) => {
					// Update wallet balance
					const newBalance = wallet.balance - parseFloat(amount);
					const newAvailable = Math.max(0, newBalance);

					await tx.wallet.update({
						where: { id: wallet.id },
						data: {
							balance: newBalance,
							availableForWithdrawal: newAvailable,
							totalWithdrawals:
								wallet.totalWithdrawals + parseFloat(amount),
						},
					});

					// Update loan balance
					const newOutstanding = Math.max(
						0,
						loan.outstandingBalance - parseFloat(amount)
					);

					await tx.loan.update({
						where: { id: loanId },
						data: {
							outstandingBalance: newOutstanding,
							status:
								newOutstanding === 0 ? "PAID_OFF" : loan.status,
						},
					});

					// Create loan repayment record
					await tx.loanRepayment.create({
						data: {
							loanId,
							amount: parseFloat(amount),
							principalAmount: parseFloat(amount), // Simplified calculation
							interestAmount: 0,
							status: "COMPLETED",
							dueDate: new Date(),
							paidAt: new Date(),
						},
					});

					// Update transaction to processed
					await tx.walletTransaction.update({
						where: { id: transaction.id },
						data: {
							processedAt: new Date(),
						},
					});
				});
			}

			res.status(201).json({
				...transaction,
				message:
					paymentMethod === "WALLET_BALANCE"
						? "Loan repayment processed successfully"
						: "Loan repayment request submitted. Awaiting fund transfer confirmation.",
			});
			return;
		} catch (error) {
			console.error("Error creating loan repayment:", error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	}
);

// Process pending transaction (admin/system use)
router.patch(
	"/transactions/:id/process",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { status } = req.body; // "APPROVED" or "REJECTED"

			if (!["APPROVED", "REJECTED"].includes(status)) {
				return res.status(400).json({ error: "Invalid status" });
			}

			const transaction = await prisma.walletTransaction.findUnique({
				where: { id },
				include: { wallet: true, loan: true },
			});

			if (!transaction) {
				return res.status(404).json({ error: "Transaction not found" });
			}

			if (transaction.status !== WalletTransactionStatus.PENDING) {
				return res
					.status(400)
					.json({ error: "Transaction is not pending" });
			}

			// Update transaction status
			const updatedTransaction = await prisma.$transaction(async (tx) => {
				// Update transaction
				const updated = await tx.walletTransaction.update({
					where: { id },
					data: {
						status: status as WalletTransactionStatus,
						processedAt: new Date(),
					},
				});

				if (status === "APPROVED") {
					// Update wallet balance
					const newBalance =
						transaction.wallet.balance + transaction.amount;
					const newAvailable = Math.max(0, newBalance); // Ensure non-negative

					await tx.wallet.update({
						where: { id: transaction.walletId },
						data: {
							balance: newBalance,
							availableForWithdrawal: newAvailable,
							totalDeposits:
								transaction.amount > 0
									? transaction.wallet.totalDeposits +
									  transaction.amount
									: transaction.wallet.totalDeposits,
							totalWithdrawals:
								transaction.amount < 0
									? transaction.wallet.totalWithdrawals +
									  Math.abs(transaction.amount)
									: transaction.wallet.totalWithdrawals,
						},
					});

					// If it's a loan repayment, update loan balance
					if (
						transaction.type === "LOAN_REPAYMENT" &&
						transaction.loan
					) {
						const newOutstanding = Math.max(
							0,
							transaction.loan.outstandingBalance +
								transaction.amount
						);

						await tx.loan.update({
							where: { id: transaction.loanId! },
							data: {
								outstandingBalance: newOutstanding,
								status:
									newOutstanding === 0
										? "PAID_OFF"
										: "ACTIVE",
							},
						});

						// Create loan repayment record
						await tx.loanRepayment.create({
							data: {
								loanId: transaction.loanId!,
								amount: Math.abs(transaction.amount),
								principalAmount: Math.abs(transaction.amount), // Simplified - in real app, calculate interest vs principal
								interestAmount: 0,
								status: "COMPLETED",
								dueDate: new Date(),
								paidAt: new Date(),
							},
						});
					}
				}

				return updated;
			});

			res.json(updatedTransaction);
			return;
		} catch (error) {
			console.error("Error processing transaction:", error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	}
);

export default router;
