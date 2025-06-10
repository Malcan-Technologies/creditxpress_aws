import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";

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
 *     summary: Get user's active loans
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's active loans
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
					in: ["ACTIVE", "OVERDUE"], // Only loans that can be repaid
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
					where: {
						status: "COMPLETED",
					},
					orderBy: {
						paidAt: "desc",
					},
					take: 5, // Last 5 repayments
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		// Calculate additional loan information
		const loansWithDetails = loans.map((loan) => {
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

			return {
				...loan,
				totalRepaid,
				progressPercentage: Math.round(progressPercentage * 100) / 100,
				canRepay: loan.outstandingBalance > 0,
			};
		});

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

export default router;
