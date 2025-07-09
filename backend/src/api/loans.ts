import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { TimeUtils } from "../lib/precisionUtils";

const router = Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   name: Loans
 *   description: API endpoints for managing user loans
 */

/**
 * @swagger
 * /api/loans:
 *   get:
 *     summary: Get user's loans
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's loans (active, pending discharge, and discharged)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 loans:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       principalAmount:
 *                         type: number
 *                       outstandingBalance:
 *                         type: number
 *                       interestRate:
 *                         type: number
 *                       term:
 *                         type: integer
 *                       monthlyPayment:
 *                         type: number
 *                       nextPaymentDue:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                       disbursedAt:
 *                         type: string
 *                         format: date-time
 *                       application:
 *                         type: object
 *                         properties:
 *                           product:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               code:
 *                                 type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user!.userId;

		const loans = await prisma.loan.findMany({
			where: {
				userId,
				status: {
					in: [
						"ACTIVE",
						"OVERDUE",
						"PENDING_DISCHARGE",
						"DISCHARGED",
					], // Include all loan statuses for dashboard
				},
			},
			include: {
				application: {
					include: {
						product: {
							select: {
								name: true,
								code: true,
							},
						},
					},
				},
				repayments: {
					orderBy: {
						dueDate: "asc",
					},
					// Include all repayments for chart calculation
					select: {
						id: true,
						amount: true,
						status: true,
						dueDate: true,
						paidAt: true,
						createdAt: true,
						actualAmount: true,
						paymentType: true,
						installmentNumber: true,
						lateFeeAmount: true,
						lateFeesPaid: true,
						principalPaid: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		// Ensure outstanding balances are accurate by recalculating them for all active loans
		// This ensures single source of truth even if there were any inconsistencies
		for (const loan of loans.filter(
			(l) => l.status === "ACTIVE" || l.status === "OVERDUE" || l.status === "PENDING_DISCHARGE"
		)) {
			await prisma.$transaction(async (tx) => {
				// Import the calculation function from wallet API
				const { calculateOutstandingBalance } = await import(
					"./wallet"
				);
				await calculateOutstandingBalance(loan.id, tx);
			});
		}

		// Calculate additional loan information including late fees
		const loansWithDetails = await Promise.all(
			loans.map(async (loan) => {
				const totalRepaid = loan.repayments.reduce(
					(sum, repayment) => sum + repayment.amount,
					0
				);

				const progressPercentage =
					loan.principalAmount > 0
						? ((loan.principalAmount - loan.outstandingBalance) /
								loan.principalAmount) *
						  100
						: 0;

				// Calculate next payment amount considering advance payments and late fees
				let nextPaymentInfo = {
					amount: loan.monthlyPayment,
					isOverdue: false,
					includesLateFees: false,
					description: "Monthly Payment",
					dueDate: loan.nextPaymentDue,
				};

				// Get overdue repayments and late fee information
				let overdueInfo = {
					hasOverduePayments: false,
					totalOverdueAmount: 0,
					totalLateFees: 0,
					overdueRepayments: [] as any[],
				};

				try {
					// Get all pending/partial repayments that are overdue using raw query
					const today = TimeUtils.malaysiaStartOfDay();

					const overdueRepaymentsQuery = `
						SELECT 
							lr.*,
							COALESCE(lr."lateFeeAmount" - lr."lateFeesPaid", 0) as total_late_fees,
							COALESCE(lr."principalPaid", 0) as principal_paid
						FROM loan_repayments lr
						WHERE lr."loanId" = $1
						  AND lr.status IN ('PENDING', 'PARTIAL')
						  AND lr."dueDate" < $2
						ORDER BY lr."dueDate" ASC
					`;

					const overdueRepayments = (await prisma.$queryRawUnsafe(
						overdueRepaymentsQuery,
						loan.id,
						today
					)) as any[];

					if (overdueRepayments.length > 0) {
						console.log(
							`🔍 DEBUG: Overdue repayments for loan ${loan.id}:`,
							overdueRepayments.map((r) => ({
								id: r.id,
								amount: r.amount,
								actualAmount: r.actualAmount,
								status: r.status,
								dueDate: r.dueDate,
								total_late_fees: r.total_late_fees,
							}))
						);

						// Only set hasOverduePayments = true if late fees have been processed
						// Check if any repayment has lateFeeAmount > 0 (late fees have been calculated)
						const hasProcessedLateFees = overdueRepayments.some(r => 
							(r.lateFeeAmount || 0) > 0
						);
						overdueInfo.hasOverduePayments = hasProcessedLateFees;

						// Calculate total overdue amount and late fees
						for (const repayment of overdueRepayments) {
							// Use principalPaid instead of actualAmount for correct calculation
							// actualAmount includes late fees paid, so it's not suitable for calculating remaining scheduled amount
							const principalPaid = repayment.principal_paid || 0;
							const outstandingAmount = Math.max(
								0,
								repayment.amount - principalPaid
							);

							const totalLateFees =
								Number(repayment.total_late_fees) || 0;

							overdueInfo.totalOverdueAmount += outstandingAmount;
							overdueInfo.totalLateFees += totalLateFees;

							overdueInfo.overdueRepayments.push({
								id: repayment.id,
								amount: repayment.amount,
								outstandingAmount,
								totalLateFees,
								totalAmountDue:
									outstandingAmount + totalLateFees,
								dueDate: repayment.dueDate,
								daysOverdue: TimeUtils.daysOverdue(new Date(repayment.dueDate)),
								// Add breakdown of late fees for better frontend tracking
								lateFeeAmount: Number(repayment.lateFeeAmount) || 0,
								lateFeesPaid: Number(repayment.lateFeesPaid) || 0,
							});
						}
					}
				} catch (error) {
					console.error(
						`Error calculating late fees for loan ${loan.id}:`,
						error
					);
					// Continue without late fee info if there's an error
				}

				// Calculate next payment amount based on current situation
				try {
					if (overdueInfo.hasOverduePayments) {
						// If loan has overdue payments, next payment is total overdue + late fees
						nextPaymentInfo = {
							amount:
								overdueInfo.totalOverdueAmount +
								overdueInfo.totalLateFees,
							isOverdue: true,
							includesLateFees: overdueInfo.totalLateFees > 0,
							description:
								overdueInfo.totalLateFees > 0
									? "Overdue Amount + Late Fees"
									: "Overdue Amount",
							dueDate: loan.nextPaymentDue,
						};
					} else if (
						loan.status === "ACTIVE" &&
						loan.nextPaymentDue
					) {
						// Get next pending repayment to calculate balance payment
						const nextRepayment =
							await prisma.loanRepayment.findFirst({
								where: {
									loanId: loan.id,
									status: { in: ["PENDING", "PARTIAL"] },
									dueDate: { gte: new Date() },
								},
								orderBy: { dueDate: "asc" },
							});

						if (nextRepayment) {
							// Calculate remaining balance for next payment using principalPaid
							const principalPaid = nextRepayment.principalPaid || 0;
							const remainingBalance = Math.max(
								0,
								nextRepayment.amount - principalPaid
							);

							// Check for late fees on this specific repayment
							const lateFeeAmount = Math.max(0, 
								nextRepayment.lateFeeAmount - nextRepayment.lateFeesPaid
							);

							nextPaymentInfo = {
								amount: remainingBalance + lateFeeAmount,
								isOverdue: false,
								includesLateFees: lateFeeAmount > 0,
								description:
									lateFeeAmount > 0
										? "Next Payment + Late Fees"
										: "Next Payment",
								dueDate: nextRepayment.dueDate,
							};
						}
					}
				} catch (error) {
					console.error(
						`Error calculating next payment info for loan ${loan.id}:`,
						error
					);
					// Continue with default next payment info if there's an error
				}

				return {
					...loan,
					totalRepaid,
					progressPercentage:
						Math.round(progressPercentage * 100) / 100,
					canRepay: loan.outstandingBalance > 0,
					overdueInfo,
					nextPaymentInfo,
				};
			})
		);

		res.json({ loans: loansWithDetails });
		return;
	} catch (error) {
		console.error("Error fetching loans:", error);
		res.status(500).json({ error: "Internal server error" });
		return;
	}
});

/**
 * @swagger
 * /api/loans/{id}:
 *   get:
 *     summary: Get specific loan details
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *     responses:
 *       200:
 *         description: Loan details
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.get(
	"/:id",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const { id } = req.params;

			const loan = await prisma.loan.findFirst({
				where: {
					id,
					userId,
				},
				include: {
					application: {
						include: {
							product: true,
						},
					},
					repayments: {
						orderBy: {
							createdAt: "desc",
						},
					},
					walletTransactions: {
						where: {
							type: "LOAN_REPAYMENT",
						},
						orderBy: {
							createdAt: "desc",
						},
					},
				},
			});

			if (!loan) {
				return res.status(404).json({ error: "Loan not found" });
			}

			const totalRepaid = loan.repayments
				.filter((r) => r.status === "COMPLETED")
				.reduce((sum, repayment) => sum + repayment.amount, 0);

			const progressPercentage =
				loan.principalAmount > 0
					? ((loan.principalAmount - loan.outstandingBalance) /
							loan.principalAmount) *
					  100
					: 0;

			const loanWithDetails = {
				...loan,
				totalRepaid,
				progressPercentage: Math.round(progressPercentage * 100) / 100,
				canRepay: loan.outstandingBalance > 0,
			};

			res.json(loanWithDetails);
			return;
		} catch (error) {
			console.error("Error fetching loan details:", error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	}
);

/**
 * @swagger
 * /api/loans/{id}/repayments:
 *   get:
 *     summary: Get loan repayment history
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *     responses:
 *       200:
 *         description: Loan repayment history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 repayments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       principalAmount:
 *                         type: number
 *                       interestAmount:
 *                         type: number
 *                       status:
 *                         type: string
 *                       dueDate:
 *                         type: string
 *                         format: date-time
 *                       paidAt:
 *                         type: string
 *                         format: date-time
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.get(
	"/:id/repayments",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const { id } = req.params;

			// First verify the loan belongs to the user
			const loan = await prisma.loan.findFirst({
				where: {
					id,
					userId,
				},
			});

			if (!loan) {
				return res.status(404).json({ error: "Loan not found" });
			}

			// Get repayment history
			const repayments = await prisma.loanRepayment.findMany({
				where: {
					loanId: id,
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			res.json({ repayments });
			return;
		} catch (error) {
			console.error("Error fetching loan repayments:", error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	}
);

/**
 * @swagger
 * /api/loans/{id}/transactions:
 *   get:
 *     summary: Get loan payment transactions from wallet
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *     responses:
 *       200:
 *         description: Loan payment transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 walletTransactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       type:
 *                         type: string
 *                       status:
 *                         type: string
 *                       description:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.get(
	"/:id/transactions",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const { id } = req.params;

			// First verify the loan belongs to the user
			const loan = await prisma.loan.findFirst({
				where: {
					id,
					userId,
				},
			});

			if (!loan) {
				return res.status(404).json({ error: "Loan not found" });
			}

			// Get wallet transactions related to this loan
			const walletTransactions = await prisma.walletTransaction.findMany({
				where: {
					userId,
					loanId: id,
					type: "LOAN_REPAYMENT",
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			res.json({ walletTransactions });
			return;
		} catch (error) {
			console.error("Error fetching loan transactions:", error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	}
);

/**
 * @swagger
 * /api/loans/{id}/late-fees:
 *   get:
 *     summary: Get late fee information for a loan
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *     responses:
 *       200:
 *         description: Late fee information for the loan
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.get(
	"/:id/late-fees",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const { id } = req.params;

			// First verify the loan belongs to the user
			const loan = await prisma.loan.findFirst({
				where: {
					id,
					userId,
				},
			});

			if (!loan) {
				return res.status(404).json({ error: "Loan not found" });
			}

			// Get all overdue repayments with late fees
			const today = TimeUtils.malaysiaStartOfDay();

			const overdueRepaymentsQuery = `
				SELECT 
					lr.id,
					lr.amount,
					lr."actualAmount",
					lr."dueDate",
					lr.status,
					lr."installmentNumber",
					COALESCE(lr."lateFeeAmount" - lr."lateFeesPaid", 0) as total_late_fees,
					CASE WHEN lr."lateFeeAmount" > 0 THEN 1 ELSE 0 END as late_fee_entries,
					lr."updatedAt" as latest_calculation_date
				FROM loan_repayments lr
				WHERE lr."loanId" = $1
				  AND lr.status IN ('PENDING', 'PARTIAL')
				  AND lr."dueDate" < $2
				ORDER BY lr."dueDate" ASC
			`;

			const overdueRepayments = (await prisma.$queryRawUnsafe(
				overdueRepaymentsQuery,
				id,
				today
			)) as any[];

			// Calculate detailed information for each overdue repayment
			const detailedOverdueInfo = overdueRepayments.map((repayment) => {
				const outstandingAmount = repayment.actualAmount
					? Math.max(0, repayment.amount - repayment.actualAmount)
					: repayment.amount;

				const totalLateFees = Number(repayment.total_late_fees) || 0;
				const totalAmountDue = outstandingAmount + totalLateFees;

				const daysOverdue = TimeUtils.daysOverdue(new Date(repayment.dueDate));

				return {
					repaymentId: repayment.id,
					installmentNumber: repayment.installmentNumber,
					originalAmount: repayment.amount,
					outstandingAmount,
					totalLateFees,
					totalAmountDue,
					dueDate: repayment.dueDate,
					daysOverdue,
					status: repayment.status,
					lateFeeEntries: Number(repayment.late_fee_entries),
					latestCalculationDate: repayment.latest_calculation_date,
				};
			});

			// Calculate summary
			const summary = {
				totalOverdueAmount: detailedOverdueInfo.reduce(
					(sum, item) => sum + item.outstandingAmount,
					0
				),
				totalLateFees: detailedOverdueInfo.reduce(
					(sum, item) => sum + item.totalLateFees,
					0
				),
				totalAmountDue: detailedOverdueInfo.reduce(
					(sum, item) => sum + item.totalAmountDue,
					0
				),
				overdueRepaymentCount: detailedOverdueInfo.length,
				hasOverduePayments: detailedOverdueInfo.length > 0,
			};

			res.json({
				summary,
				overdueRepayments: detailedOverdueInfo,
			});
			return;
		} catch (error) {
			console.error("Error fetching late fee information:", error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	}
);

export default router;
