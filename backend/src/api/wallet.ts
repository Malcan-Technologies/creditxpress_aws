import { Router, Response } from "express";
import { PrismaClient, WalletTransactionStatus } from "@prisma/client";
import { authenticateAndVerifyPhone, AuthRequest } from "../middleware/auth";
import { TimeUtils } from "../lib/precisionUtils";

const router = Router();
const prisma = new PrismaClient();

// Helper function to update repayment status based on all payments (Hybrid Approach)
async function updateRepaymentStatusFromTransactions(loanId: string, tx: any) {
	console.log(
		`Updating repayment status for loan ${loanId} based on transactions`
	);

	// Get all repayments for this loan, ordered by due date
	const repayments = await tx.loanRepayment.findMany({
		where: { loanId: loanId },
		orderBy: { dueDate: "asc" },
	});

	// Get all approved payment transactions
	const actualPayments = await tx.walletTransaction.findMany({
		where: {
			loanId: loanId,
			type: "LOAN_REPAYMENT",
			status: "APPROVED",
		},
		orderBy: { processedAt: "asc" },
	});

	// Calculate total payments made
	const totalPaymentsMade = actualPayments.reduce(
		(total: number, payment: any) => {
			return total + Math.abs(payment.amount);
		},
		0
	);

	console.log(`Total payments made: ${totalPaymentsMade}`);

	const mostRecentPayment = actualPayments[actualPayments.length - 1];
	const mostRecentPaymentDate =
		mostRecentPayment?.processedAt || mostRecentPayment?.createdAt;

	// Process payment allocation at loan level ONCE to avoid double allocation
	let paymentAllocated = false;
	if (totalPaymentsMade > 0) {
		try {
			const { LateFeeProcessor } = await import(
				"../lib/lateFeeProcessor"
			);
			console.log(`💰 Processing payment allocation for loan ${loanId}, total payments: ${totalPaymentsMade}`);
			
			// Check if payment allocation has already been done for this total amount
			// by comparing the sum of actualAmount in repayments with totalPaymentsMade
			const currentAllocatedAmount = repayments.reduce((sum: number, rep: any) => {
				return sum + (rep.actualAmount || 0);
			}, 0);

			console.log(`Current allocated amount: ${currentAllocatedAmount}, Total payments: ${totalPaymentsMade}`);

			// Only re-allocate if there's a significant difference (more than 1 cent)
			if (Math.abs(totalPaymentsMade - currentAllocatedAmount) > 0.01) {
				console.log(`Re-allocating payments due to difference: ${Math.abs(totalPaymentsMade - currentAllocatedAmount)}`);
				
				// Reset all repayment allocation data before re-allocating
				for (const repayment of repayments) {
					await tx.loanRepayment.update({
						where: { id: repayment.id },
						data: {
							actualAmount: null,
							principalPaid: 0,
							lateFeesPaid: 0,
							status: 'PENDING',
							paidAt: null,
							paymentType: null,
							daysEarly: null,
							daysLate: null
						}
					});
				}

				const allocationResult = await LateFeeProcessor.handlePaymentAllocation(
					loanId,
					totalPaymentsMade,
					new Date(mostRecentPaymentDate || new Date()),
					tx
				);

				console.log(`✅ Payment allocation completed for loan ${loanId}:`, {
					lateFeesPaid: allocationResult.lateFeesPaid,
					principalPaid: allocationResult.principalPaid,
					remainingPayment: allocationResult.remainingPayment
				});

				paymentAllocated = true;
			} else {
				console.log(`Payment allocation already up to date for loan ${loanId}`);
				paymentAllocated = true; // Skip fallback logic
			}
		} catch (error) {
			console.error(`Error in payment allocation for loan ${loanId}:`, error);
			// Continue with fallback logic below
		}
	}

	// If payment allocation failed, fall back to simple chronological allocation
	if (!paymentAllocated) {
		let remainingPayments = totalPaymentsMade;

		for (const repayment of repayments) {
			if (remainingPayments <= 0) {
				// No payments left - mark as PENDING
				await tx.loanRepayment.update({
					where: { id: repayment.id },
					data: {
						status: "PENDING",
						actualAmount: null,
						paidAt: null,
						paymentType: null,
						daysEarly: null,
						daysLate: null,
					},
				});
			} else {
				const dueDate = new Date(repayment.dueDate);
				const paidDate = new Date(mostRecentPaymentDate || new Date());
				const paymentTypeInfo = TimeUtils.paymentType(paidDate, dueDate);

				const daysEarly = paymentTypeInfo.daysEarly;
				const daysLate = paymentTypeInfo.daysLate;

				const wasCompleted = repayment.status === "COMPLETED";

				if (!wasCompleted) {
					// Simple allocation: apply payment up to repayment amount
					const paymentForThisRepayment = Math.min(remainingPayments, repayment.amount);
					
					let repaymentStatus = "PARTIAL";
					let paymentType = "PARTIAL";

					if (paymentForThisRepayment >= repayment.amount) {
						// Check if there are any existing unpaid late fees for this repayment
						const unpaidLateFees = Math.max(0, Math.round(((repayment.lateFeeAmount || 0) - (repayment.lateFeesPaid || 0)) * 100) / 100);

						if (unpaidLateFees <= 0) {
							// Principal fully paid and no late fees - can mark as COMPLETED
							repaymentStatus = "COMPLETED";
							paymentType = paymentTypeInfo.paymentType;
						}
					}

					// Set actualAmount to the payment amount for this repayment (not additive)
					const updateData: any = {
						status: repaymentStatus,
						paidAt: mostRecentPaymentDate,
						paymentType: paymentType,
						daysEarly: daysEarly,
						daysLate: daysLate,
						actualAmount: paymentForThisRepayment, // Set directly, not additive
					};

					await tx.loanRepayment.update({
						where: { id: repayment.id },
						data: updateData,
					});

					remainingPayments -= paymentForThisRepayment;
					console.log(`💰 Fallback allocation for repayment ${repayment.id}: ${paymentForThisRepayment}`);
				} else {
					// Already completed - preserve existing actualAmount
					const existingAmount = repayment.actualAmount || repayment.amount;
					console.log(`✅ Repayment ${repayment.id} already COMPLETED with actualAmount: ${existingAmount}`);
				}
			}
		}
	}
}

// Helper function to update payment schedule after payment (Hybrid Approach)
async function updatePaymentScheduleAfterPayment(
	loanId: string,
	paymentAmount: number,
	tx: any
) {
	console.log(`💰 Processing payment of ${paymentAmount} for loan ${loanId}`);

	// Update repayment status based on all transactions (preserves individual payment history)
	await updateRepaymentStatusFromTransactions(loanId, tx);

	// Calculate new outstanding balance based on actual transactions
	const newOutstandingBalance = await calculateOutstandingBalance(loanId, tx);

	// Calculate next payment due
	const nextPaymentDue = await calculateNextPaymentDue(loanId, tx);

	// Status is handled in calculateOutstandingBalance function

	await tx.loan.update({
		where: { id: loanId },
		data: {
			nextPaymentDue: nextPaymentDue,
		},
	});

	console.log(
		`Updated loan ${loanId}: outstanding ${newOutstandingBalance}, nextPaymentDue ${nextPaymentDue}`
	);
}

// Helper function to calculate outstanding balance based on actual transactions
export async function calculateOutstandingBalance(loanId: string, tx: any) {
	// Import SafeMath utilities for precise calculations
	const { SafeMath } = require("../lib/precisionUtils");
	
	// Get the loan to get the total amount and current status
	const loan = await tx.loan.findUnique({
		where: { id: loanId },
	});

	if (!loan) {
		throw new Error(`Loan ${loanId} not found`);
	}

	// Get total unpaid late fees for this loan using new schema
	const unpaidLateFees = await tx.$queryRawUnsafe(
		`
		SELECT COALESCE(SUM(lr."lateFeeAmount" - COALESCE(lr."lateFeesPaid", 0)), 0) as total_unpaid_late_fees
		FROM loan_repayments lr
		WHERE lr."loanId" = $1 AND lr."lateFeeAmount" > 0
	`,
		loanId
	);
	const totalUnpaidLateFees = SafeMath.round(SafeMath.toNumber(
		unpaidLateFees[0]?.total_unpaid_late_fees || 0
	));

	console.log(`Calculating outstanding balance for loan ${loanId}:`);
	console.log(`Original loan amount: ${loan.totalAmount}`);
	console.log(`Unpaid late fees: ${totalUnpaidLateFees}`);

	// Calculate total principal paid (excluding late fees) from loan repayments for accurate outstanding balance
	const principalPaidResult = await tx.$queryRawUnsafe(
		`
		SELECT COALESCE(SUM(lr."principalPaid"), 0) as total_principal_paid
		FROM loan_repayments lr
		WHERE lr."loanId" = $1
		`,
		loanId
	);
	const totalPrincipalPaid = SafeMath.toNumber(principalPaidResult[0]?.total_principal_paid || 0);

	console.log(`Total principal paid: ${totalPrincipalPaid}`);

	// Outstanding balance = Original loan amount + Unpaid late fees - Principal paid
	// This is more accurate than using wallet transactions since it separates principal from late fee payments
	const totalAmountOwed = SafeMath.add(SafeMath.toNumber(loan.totalAmount), totalUnpaidLateFees);
	const outstandingBalance = SafeMath.subtract(totalAmountOwed, totalPrincipalPaid);
	const finalOutstandingBalance = Math.max(0, outstandingBalance);

	console.log(`Outstanding balance: ${finalOutstandingBalance}`);

	// Check if loan should be marked as PENDING_DISCHARGE
	if ((loan.status === "ACTIVE" || loan.status === "DEFAULT") && finalOutstandingBalance === 0) {
		console.log(
			`🎯 Loan ${loanId} fully paid - updating status to PENDING_DISCHARGE and clearing default flags`
		);
		
		// Check if we're clearing default flags to create audit trail
		const clearingDefaultFlags = loan.defaultRiskFlaggedAt || loan.defaultedAt || loan.status === "DEFAULT";
		
		await tx.loan.update({
			where: { id: loanId },
			data: {
				status: "PENDING_DISCHARGE",
				outstandingBalance: finalOutstandingBalance,
				// Clear default flags when loan is fully paid
				defaultRiskFlaggedAt: null,
				defaultedAt: null,
			},
		});

		// Create audit trail entry if we cleared default flags
		if (clearingDefaultFlags) {
			await tx.loanDefaultLog.create({
				data: {
					loanId: loanId,
					eventType: 'RECOVERED',
					daysOverdue: 0,
					outstandingAmount: 0,
					totalLateFees: 0,
					noticeType: 'FULL_PAYMENT_RECOVERY',
					processedAt: new Date(),
					metadata: {
						clearedVia: 'FULL_LOAN_PAYMENT',
						previousStatus: loan.status,
						previousDefaultRiskFlaggedAt: loan.defaultRiskFlaggedAt,
						previousDefaultedAt: loan.defaultedAt,
						newStatus: 'PENDING_DISCHARGE',
						reason: 'Loan fully paid - moved to pending discharge'
					}
				}
			});

			// Also create audit trail entry in LoanApplicationHistory
			const loanWithApp = await tx.loan.findUnique({
				where: { id: loanId },
				select: { applicationId: true }
			});
			
			if (loanWithApp?.applicationId) {
				await tx.loanApplicationHistory.create({
					data: {
						applicationId: loanWithApp.applicationId,
						previousStatus: loan.status,
						newStatus: 'PENDING_DISCHARGE',
						changedBy: 'SYSTEM',
						changeReason: 'Default flags cleared after full loan payment',
						notes: 'Loan fully paid - default risk and default flags cleared, moved to pending discharge.',
						metadata: {
							clearedVia: 'FULL_LOAN_PAYMENT',
							previousDefaultRiskFlaggedAt: loan.defaultRiskFlaggedAt,
							previousDefaultedAt: loan.defaultedAt,
							finalOutstandingBalance: finalOutstandingBalance
						}
					}
				});
			}
			
			console.log(`✅ Default flags cleared for loan ${loanId} via full payment - audit trail created`);
		}
	} else {
		// Just update the outstanding balance
		await tx.loan.update({
			where: { id: loanId },
			data: { outstandingBalance: finalOutstandingBalance },
		});
	}

	return finalOutstandingBalance;
}

// Helper function to calculate next payment due based on actual payments
async function calculateNextPaymentDue(loanId: string, tx: any) {
	// Get all repayments for this loan, ordered by due date
	const repayments = await tx.loanRepayment.findMany({
		where: { loanId: loanId },
		orderBy: { dueDate: "asc" },
	});

	// Get total payments made
	const actualPayments = await tx.walletTransaction.findMany({
		where: {
			loanId: loanId,
			type: "LOAN_REPAYMENT",
			status: "APPROVED",
		},
	});

	const totalPaymentsMade = actualPayments.reduce(
		(total: number, payment: any) => {
			return total + Math.abs(payment.amount);
		},
		0
	);

	// Apply payments to repayments in chronological order to find next due
	let remainingPayments = totalPaymentsMade;

	for (const repayment of repayments) {
		// Calculate total amount due for this repayment using new schema
		const lateFeeAmount = Math.max(0, (repayment.lateFeeAmount || 0) - (repayment.lateFeesPaid || 0));
		const totalAmountDue = repayment.amount + lateFeeAmount;

		if (remainingPayments <= 0) {
			// This repayment hasn't been paid yet
			return repayment.dueDate;
		}

		if (remainingPayments >= totalAmountDue) {
			// This repayment is fully covered (including late fees)
			remainingPayments -= totalAmountDue;
		} else {
			// This repayment is partially covered, so it's the next due
			return repayment.dueDate;
		}
	}

	// All repayments are covered
	return null;
}

// Get user's wallet data
router.get("/", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
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

		// Calculate total principal repaid (excluding late fees) from loan repayments
		const totalPrincipalRepaid = await prisma.$queryRawUnsafe(
			`
			SELECT COALESCE(SUM(lr."principalPaid"), 0) as total_principal_paid
			FROM loan_repayments lr
			JOIN loans l ON lr."loanId" = l.id
			WHERE l."userId" = $1
			`,
			userId
		);

		const totalRepaidAmount = parseFloat((totalPrincipalRepaid as any)[0]?.total_principal_paid || 0);

		// Calculate next payment due and amount considering prepayments
		let nextPaymentDue = null;
		let nextPaymentAmount = 0;

		for (const loan of loans.filter((loan) => loan.status === "ACTIVE")) {
			// Get all repayments for this loan, ordered by due date
			const repayments = await prisma.loanRepayment.findMany({
				where: { loanId: loan.id },
				orderBy: { dueDate: "asc" },
			});

			// Get total payments made for this loan
			const actualPayments = await prisma.walletTransaction.findMany({
				where: {
					loanId: loan.id,
					type: "LOAN_REPAYMENT",
					status: "APPROVED",
				},
			});

			const totalPaymentsMade = actualPayments.reduce(
				(total: number, payment: any) => {
					return total + Math.abs(payment.amount);
				},
				0
			);

			// Apply payments to repayments in chronological order to find next due
			let remainingPayments = totalPaymentsMade;

			for (const repayment of repayments) {
				if (remainingPayments <= 0) {
					// This repayment hasn't been paid yet - it's the next due
					if (
						!nextPaymentDue ||
						new Date(repayment.dueDate) < new Date(nextPaymentDue)
					) {
						nextPaymentDue = repayment.dueDate;
						nextPaymentAmount = repayment.amount;
					}
					break;
				}

				if (remainingPayments >= repayment.amount) {
					// This repayment is fully covered
					remainingPayments -= repayment.amount;
				} else {
					// This repayment is partially covered - remaining amount is next due
					const remainingAmount =
						repayment.amount - remainingPayments;
					if (
						!nextPaymentDue ||
						new Date(repayment.dueDate) < new Date(nextPaymentDue)
					) {
						nextPaymentDue = repayment.dueDate;
						nextPaymentAmount = remainingAmount;
					}
					break;
				}
			}
		}

		// Calculate total outstanding as loan amounts + late fees minus all payments made
		// This ensures consistency with individual loan outstanding calculations
		const totalBorrowed = loans.reduce(
			(sum, loan) => sum + (loan.totalAmount || loan.principalAmount),
			0
		);
		
		// Get total unpaid late fees across all user's loans
		const totalUnpaidLateFees = await prisma.$queryRawUnsafe(
			`
			SELECT COALESCE(SUM(lr."lateFeeAmount" - COALESCE(lr."lateFeesPaid", 0)), 0) as total_unpaid_late_fees
			FROM loan_repayments lr
			JOIN loans l ON lr."loanId" = l.id
			WHERE l."userId" = $1 AND lr."lateFeeAmount" > 0
			`,
			userId
		);
		
		const unpaidLateFees = parseFloat((totalUnpaidLateFees as any)[0]?.total_unpaid_late_fees || 0);
		
		// Total outstanding = borrowed amount + unpaid late fees - principal paid
		const totalOutstanding = Math.max(0, totalBorrowed + unpaidLateFees - totalRepaidAmount);

		const loanSummary = {
			totalOutstanding,
			totalBorrowed,
			totalRepaid: totalRepaidAmount,
			nextPaymentDue,
			nextPaymentAmount,
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
	authenticateAndVerifyPhone,
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
	authenticateAndVerifyPhone,
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
	authenticateAndVerifyPhone,
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
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const { loanId, amount, paymentMethod, description, reference } = req.body;

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
						in: ["ACTIVE", "OVERDUE", "DEFAULT"], // Allow DEFAULT loans to make payments
					},
				},
			});

			if (!loan) {
				return res.status(404).json({ error: "Loan not found or not eligible for payments" });
			}

					// Import SafeMath utilities for precise calculations
		const { SafeMath } = await import("../lib/precisionUtils");
		
		// Convert to number but preserve exact decimal precision (don't round user input)
		const paymentAmount = SafeMath.toNumber(amount);

			// Validate repayment amount doesn't exceed outstanding balance
			if (paymentAmount > loan.outstandingBalance) {
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
				if (wallet.availableForWithdrawal < paymentAmount) {
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
					amount: -paymentAmount, // Negative for outgoing payment
					status:
						paymentMethod === "WALLET_BALANCE"
							? WalletTransactionStatus.APPROVED // Auto-approve wallet balance payments
							: WalletTransactionStatus.PENDING, // Fresh funds need approval
					description:
						description ||
						`Loan repayment for loan ${loanId} via ${paymentMethod}`,
					reference: reference || `REP-${Date.now()}`,
									metadata: {
					paymentMethod,
					loanId,
					outstandingBalance: loan.outstandingBalance,
					originalAmount: paymentAmount, // Store exact amount as entered by user
				},
				},
			});

			// If using wallet balance, immediately process the repayment
			if (paymentMethod === "WALLET_BALANCE") {
				await prisma.$transaction(async (tx) => {
					// Update wallet balance
					const newBalance = wallet.balance - paymentAmount;
					const newAvailable = Math.max(0, newBalance);

					await tx.wallet.update({
						where: { id: wallet.id },
						data: {
							balance: newBalance,
							availableForWithdrawal: newAvailable,
							totalWithdrawals:
								wallet.totalWithdrawals + paymentAmount,
						},
					});

					// Update loan repayments schedule properly
					await updatePaymentScheduleAfterPayment(
						loanId,
						paymentAmount,
						tx
					);

					// Update transaction to processed
					await tx.walletTransaction.update({
						where: { id: transaction.id },
						data: {
							processedAt: new Date(),
						},
					});

					// Create notification for successful payment
					await tx.notification.create({
						data: {
							userId,
							title: "Payment Processed",
							message: `Your loan repayment of ${formatCurrency(
								paymentAmount
							)} has been processed successfully.`,
							type: "SYSTEM",
							priority: "HIGH",
							metadata: {
								transactionId: transaction.id,
								loanId,
								amount: paymentAmount,
								paymentMethod,
							},
						},
					});
				});
			} else {
				// For fresh funds, create notification about pending approval
				await prisma.notification.create({
					data: {
						userId,
						title: "Payment Submitted",
						message: `Your loan repayment of ${formatCurrency(
							paymentAmount
						)} has been submitted and is awaiting approval.`,
						type: "SYSTEM",
						priority: "HIGH",
						metadata: {
							transactionId: transaction.id,
							loanId,
							amount: paymentAmount,
							paymentMethod,
						},
					},
				});
			}

			// Helper function to format currency
			function formatCurrency(amount: number): string {
				return `RM ${new Intl.NumberFormat("en-MY", {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				}).format(amount)}`;
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
	authenticateAndVerifyPhone,
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

					// If it's a loan repayment, update loan repayments schedule
					if (
						transaction.type === "LOAN_REPAYMENT" &&
						transaction.loan
					) {
						const paymentAmount = Math.abs(transaction.amount);
						await updatePaymentScheduleAfterPayment(
							transaction.loanId!,
							paymentAmount,
							tx
						);
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
