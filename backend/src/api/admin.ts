import express, {
	Request,
	Response,
	NextFunction,
	RequestHandler,
} from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authenticateToken } from "../middleware/auth";
import { AuthRequest } from "../middleware/auth";
import lateFeeRoutes from "./admin/late-fees";
import { LateFeeProcessor } from "../lib/lateFeeProcessor";
import { CronScheduler } from "../lib/cronScheduler";
/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: API endpoints for Admin dashboard
 */

const router = express.Router();
const prisma = new PrismaClient();

// Register sub-routes
router.use("/late-fees", lateFeeRoutes);

// Helper function to create a loan disbursement record
async function createLoanDisbursementRecord(
	prismaTransaction: any,
	applicationId: string,
	referenceNumber: string,
	amount: number | null,
	adminUserId: string | undefined,
	bankName?: string | null,
	bankAccountNumber?: string | null,
	notes?: string
) {
	if (!amount) {
		throw new Error(
			"Cannot create disbursement record: Amount is required"
		);
	}

	console.log("Creating loan disbursement record with", {
		applicationId,
		referenceNumber,
		amount,
		adminUserId,
	});

	return await prismaTransaction.loanDisbursement.create({
		data: {
			applicationId,
			referenceNumber,
			amount,
			bankName: bankName || "Not provided",
			bankAccountNumber: bankAccountNumber || "Not provided",
			disbursedBy: adminUserId || "SYSTEM",
			notes: notes || "",
			status: "COMPLETED",
			disbursedAt: new Date(),
		},
	});
}

// Helper function to track application status changes
export async function trackApplicationStatusChange(
	prismaTransaction: any,
	applicationId: string,
	previousStatus: string | null,
	newStatus: string,
	changedBy: string | undefined,
	changeReason: string = "Status update",
	notes: string | null = null,
	metadata: any = {}
) {
	console.log(
		`Tracking status change for application ${applicationId}: ${previousStatus} -> ${newStatus}`
	);

	try {
		// Check if the loanApplicationHistory model exists in Prisma
		if (!prismaTransaction.loanApplicationHistory) {
			console.warn(
				"LoanApplicationHistory model not available. Status change not tracked."
			);
			return null;
		}

		const historyEntry =
			await prismaTransaction.loanApplicationHistory.create({
				data: {
					applicationId,
					previousStatus,
					newStatus,
					changedBy: changedBy || "SYSTEM",
					changeReason,
					notes: notes || "",
					metadata: {
						...metadata,
						timestamp: new Date().toISOString(),
					},
				},
			});

		console.log(`Created history entry: ${historyEntry.id}`);
		return historyEntry;
	} catch (error) {
		console.error("Failed to create history entry:", error);
		// Don't throw, allow the main transaction to continue
		return null;
	}
}

// Middleware to check if user is admin
// @ts-ignore
const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const authReq = req as AuthRequest;
		const user = await prisma.user.findUnique({
			where: { id: authReq.user?.userId },
		});

		if (!user || user.role !== "ADMIN") {
			return res
				.status(403)
				.json({ message: "Access denied. Admin only." });
		}

		next();
	} catch (error) {
		console.error("Error checking admin status:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

// Routes

/**
 * @swagger
 * /api/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLogin'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 role:
 *                   type: string
 *                   enum: [ADMIN]
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     phoneNumber:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
// Admin login endpoint
// @ts-ignore
router.post("/login", async (req: Request, res: Response) => {
	try {
		console.log("Admin login attempt:", req.body);
		const { phoneNumber, password } = req.body;

		// Find user by phone number
		const user = await prisma.user.findUnique({
			where: { phoneNumber },
		});

		if (!user) {
			console.log("User not found:", phoneNumber);
			return res.status(401).json({ error: "Invalid credentials" });
		}

		// Check if user is an admin
		if (user.role !== "ADMIN") {
			console.log("Non-admin login attempt:", phoneNumber);
			return res
				.status(403)
				.json({ error: "Access denied. Admin privileges required." });
		}

		// Verify password
		const validPassword = await bcrypt.compare(password, user.password);
		if (!validPassword) {
			console.log("Invalid password for:", phoneNumber);
			return res.status(401).json({ error: "Invalid credentials" });
		}

		// Generate tokens
		const accessToken = jwt.sign(
			{ userId: user.id, role: user.role },
			process.env.JWT_SECRET!,
			{ expiresIn: "1d" }
		);

		const refreshToken = jwt.sign(
			{ userId: user.id, role: user.role },
			process.env.JWT_REFRESH_SECRET!,
			{ expiresIn: "90d" }
		);

		console.log("Admin login successful:", phoneNumber);

		// Return tokens and user data
		return res.json({
			accessToken,
			refreshToken,
			role: user.role,
			user: {
				id: user.id,
				phoneNumber: user.phoneNumber,
				fullName: user.fullName,
				email: user.email,
			},
		});
	} catch (error) {
		console.error("Admin login error:", error);
		return res.status(500).json({ error: "Internal server error" });
	}
});

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardStats'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
// Get dashboard stats (admin only)
// @ts-ignore
router.get(
	"/dashboard",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			// Get all users count
			const totalUsers = await prisma.user.count();

			// Get applications that need review (status = PENDING_APPROVAL)
			const pendingReviewApplications =
				await prisma.loanApplication.count({
					where: {
						status: "PENDING_APPROVAL",
					},
				});

			// Get approved loans count (status = APPROVED only, not including ACTIVE)
			const approvedLoans = await prisma.loanApplication.count({
				where: {
					status: "APPROVED",
				},
			});

			// Get pending disbursement count (applications that are approved but not yet disbursed)
			const pendingDisbursementCount = await prisma.loanApplication.count(
				{
					where: {
						status: "PENDING_DISBURSEMENT",
					},
				}
			);

			// Get disbursed loans count (status = DISBURSED only)
			const disbursedLoans = await prisma.loanApplication.count({
				where: {
					status: "ACTIVE",
				},
			});

			// Get total applications count (excluding INCOMPLETE applications)
			const totalApplications = await prisma.loanApplication.count({
				where: {
					status: {
						not: "INCOMPLETE",
					},
				},
			});

			// Get total loan value (TLV) - sum of totalAmount from active loans
			const activeLoanDetails = await prisma.loan.findMany({
				where: {
					status: "ACTIVE",
				},
				select: {
					totalAmount: true,
					principalAmount: true,
				},
			});

			// Calculate total loan value (amount borrowers need to pay back including interest)
			const totalLoanValue = activeLoanDetails.reduce((sum, loan) => {
				return sum + (loan.totalAmount || 0);
			}, 0);

			// Get total repayments made from wallet transactions to calculate current loan value
			const totalRepaymentsMade =
				await prisma.walletTransaction.aggregate({
					_sum: {
						amount: true,
					},
					where: {
						type: "LOAN_REPAYMENT",
						status: "APPROVED",
					},
				});

			// Calculate current loan value (Total Loan Value - Repayments Made)
			const currentLoanValue =
				Math.round(
					(totalLoanValue -
						Math.abs(totalRepaymentsMade._sum.amount || 0)) *
						100
				) / 100;

			// Get total disbursed amount from loan_disbursement table
			const totalDisbursedAmount =
				await prisma.loanDisbursement.aggregate({
					_sum: {
						amount: true,
					},
					where: {
						status: "COMPLETED",
					},
				});

			// Get total principal amount from loans to calculate fees collected
			const totalPrincipalAmount = await prisma.loan.aggregate({
				_sum: {
					principalAmount: true,
				},
				where: {
					status: {
						in: ["ACTIVE", "PENDING_DISCHARGE", "DISCHARGED"],
					},
				},
			});

			// Calculate total fees collected (Principal - Disbursed)
			const totalFeesCollected =
				Math.round(
					((totalPrincipalAmount._sum.principalAmount || 0) -
						(totalDisbursedAmount._sum.amount || 0)) *
						100
				) / 100;

			// Get total repayments from wallet_transactions (actual cash collected)
			const totalRepaymentsResult =
				await prisma.walletTransaction.aggregate({
					_sum: {
						amount: true,
					},
					where: {
						type: "LOAN_REPAYMENT",
						status: "APPROVED",
					},
				});

			const totalRepayments =
				Math.round(
					Math.abs(totalRepaymentsResult._sum.amount || 0) * 100
				) / 100;

			// Get recent applications
			const recentApplications = await prisma.loanApplication.findMany({
				take: 5,
				orderBy: {
					createdAt: "desc",
				},
				include: {
					user: {
						select: {
							fullName: true,
							email: true,
						},
					},
				},
			});

			res.json({
				totalUsers,
				totalApplications,
				pendingReviewApplications,
				approvedLoans,
				pendingDisbursementCount,
				disbursedLoans,
				totalDisbursedAmount: totalDisbursedAmount._sum.amount || 0,
				totalLoanValue,
				currentLoanValue,
				totalFeesCollected,
				totalRepayments,
				recentApplications,
			});
		} catch (error) {
			console.error("Error fetching dashboard stats:", error);
			res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/admin/monthly-stats:
 *   get:
 *     summary: Get monthly statistics for dashboard charts
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monthly statistics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 monthlyStats:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: string
 *                       applications:
 *                         type: number
 *                       approvals:
 *                         type: number
 *                       disbursements:
 *                         type: number
 *                       revenue:
 *                         type: number
 *                       disbursement_amount:
 *                         type: number
 *                       disbursement_count:
 *                         type: number
 *                       users:
 *                         type: number
 *                       kyc_users:
 *                         type: number
 *                       actual_repayments:
 *                         type: number
 *                       scheduled_repayments:
 *                         type: number
 *                       total_loan_value:
 *                         type: number
 *                       current_loan_value:
 *                         type: number
 *                       repayment_count:
 *                         type: number
 *                       scheduled_count:
 *                         type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
// Get monthly statistics (admin only)
// @ts-ignore
router.get(
	"/monthly-stats",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			// Get the last 6 months of data
			const sixMonthsAgo = new Date();
			sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

			// Get monthly application counts
			const monthlyApplications = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', "createdAt") as month,
					COUNT(*) as applications,
					COUNT(CASE WHEN status IN ('APPROVED', 'ACTIVE', 'PENDING_DISBURSEMENT') THEN 1 END) as approvals,
					COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as disbursements
				FROM "loan_applications"
				WHERE "createdAt" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', "createdAt")
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				applications: bigint;
				approvals: bigint;
				disbursements: bigint;
			}>;

			// Get monthly user registrations and KYC completions
			const monthlyUsers = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', "createdAt") as month,
					COUNT(*) as users,
					COUNT(CASE WHEN "kycStatus" = true THEN 1 END) as kyc_users
				FROM "users"
				WHERE "createdAt" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', "createdAt")
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				users: bigint;
				kyc_users: bigint;
			}>;

			// Get monthly disbursement amounts and counts using loan_disbursement table
			const monthlyDisbursements = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', ld."disbursedAt") as month,
					ROUND(SUM(COALESCE(ld.amount, 0))::numeric, 2) as total_amount,
					COUNT(*) as disbursement_count
				FROM "loan_disbursements" ld
				WHERE ld.status = 'COMPLETED' 
				AND ld."disbursedAt" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', ld."disbursedAt")
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				total_amount: number;
				disbursement_count: bigint;
			}>;

			// Get monthly actual repayments from wallet_transactions (actual cash collected)
			const monthlyRepayments = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', wt."processedAt") as month,
					ROUND(SUM(ABS(COALESCE(wt.amount, 0)))::numeric, 2) as actual_repayments,
					COUNT(*) as repayment_count
				FROM "wallet_transactions" wt
				WHERE wt.type = 'LOAN_REPAYMENT' 
				AND wt.status = 'APPROVED'
				AND wt."processedAt" IS NOT NULL
				AND wt."processedAt" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', wt."processedAt")
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				actual_repayments: number;
				repayment_count: bigint;
			}>;

			// Get monthly scheduled repayments using scheduledAmount from loan_repayments
			const monthlyScheduledRepayments = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', lr."dueDate") as month,
					ROUND(SUM(COALESCE(lr."scheduledAmount", lr.amount))::numeric, 2) as scheduled_repayments,
					COUNT(*) as scheduled_count
				FROM "loan_repayments" lr
				WHERE lr."dueDate" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', lr."dueDate")
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				scheduled_repayments: number;
				scheduled_count: bigint;
			}>;

			// Get monthly TLV using totalAmount from loans table
			const monthlyTLV = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', l."createdAt") as month,
					ROUND(SUM(COALESCE(l."totalAmount", l."principalAmount"))::numeric, 2) as total_loan_value
				FROM "loans" l
				WHERE l.status IN ('ACTIVE', 'PENDING_DISCHARGE', 'DISCHARGED')
				AND l."createdAt" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', l."createdAt")
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				total_loan_value: number;
			}>;

			// Calculate current loan value by deducting repayments from total loan value
			// We need to calculate cumulative values for each month
			let cumulativeTLV = 0;
			let cumulativeRepayments = 0;

			const monthlyCurrentLoanValue = monthlyApplications.map((stat) => {
				const monthKey = stat.month.toISOString();

				// Add new loans for this month
				const tlvData = monthlyTLV.find(
					(t) => t.month.toISOString() === monthKey
				);
				if (tlvData) {
					cumulativeTLV += tlvData.total_loan_value;
				}

				// Add repayments made in this month
				const repaymentsData = monthlyRepayments.find(
					(r) => r.month.toISOString() === monthKey
				);
				if (repaymentsData) {
					cumulativeRepayments += repaymentsData.actual_repayments;
				}

				// Current loan value = Total loans issued - Total repayments made
				const currentLoanValue = Math.max(
					0,
					cumulativeTLV - cumulativeRepayments
				);

				return {
					month: stat.month,
					current_loan_value:
						Math.round(currentLoanValue * 100) / 100,
				};
			});

			// Create a map for easy lookup
			const userMap = new Map(
				monthlyUsers.map((u) => [
					u.month.toISOString(),
					{ users: Number(u.users), kyc_users: Number(u.kyc_users) },
				])
			);
			const disbursementMap = new Map(
				monthlyDisbursements.map((d) => [
					d.month.toISOString(),
					{
						total_amount: d.total_amount || 0,
						disbursement_count: Number(d.disbursement_count),
					},
				])
			);
			const repaymentsMap = new Map(
				monthlyRepayments.map((r) => [
					r.month.toISOString(),
					{
						actual_repayments: Number(r.actual_repayments) || 0,
						repayment_count: Number(r.repayment_count),
					},
				])
			);
			const scheduledRepaymentsMap = new Map(
				monthlyScheduledRepayments.map((s) => [
					s.month.toISOString(),
					{
						scheduled_repayments:
							Number(s.scheduled_repayments) || 0,
						scheduled_count: Number(s.scheduled_count),
					},
				])
			);
			const tlvMap = new Map(
				monthlyTLV.map((t) => [
					t.month.toISOString(),
					{
						total_loan_value: Number(t.total_loan_value) || 0,
					},
				])
			);
			const currentLoanValueMap = new Map(
				monthlyCurrentLoanValue.map((c) => [
					c.month.toISOString(),
					{
						current_loan_value: Number(c.current_loan_value) || 0,
					},
				])
			);

			// Format the data for the frontend
			const monthlyStats = monthlyApplications.map((stat) => {
				const monthKey = stat.month.toISOString();
				const disbursementData = disbursementMap.get(monthKey) || {
					total_amount: 0,
					disbursement_count: 0,
				};
				const userData = userMap.get(monthKey) || {
					users: 0,
					kyc_users: 0,
				};
				const repaymentsData = repaymentsMap.get(monthKey) || {
					actual_repayments: 0,
					repayment_count: 0,
				};
				const scheduledRepaymentsData = scheduledRepaymentsMap.get(
					monthKey
				) || {
					scheduled_repayments: 0,
					scheduled_count: 0,
				};
				const tlvData = tlvMap.get(monthKey) || {
					total_loan_value: 0,
				};
				const currentLoanValueData = currentLoanValueMap.get(
					monthKey
				) || {
					current_loan_value: 0,
				};

				return {
					month: stat.month.toLocaleDateString("en-US", {
						month: "short",
					}),
					applications: Number(stat.applications),
					approvals: Number(stat.approvals),
					disbursements: Number(stat.disbursements),
					revenue:
						Math.round(repaymentsData.actual_repayments * 100) /
						100, // Use actual repayments from wallet transactions
					disbursement_amount: disbursementData.total_amount,
					disbursement_count: disbursementData.disbursement_count,
					users: userData.users,
					kyc_users: userData.kyc_users,
					actual_repayments:
						Math.round(repaymentsData.actual_repayments * 100) /
						100,
					scheduled_repayments:
						Math.round(
							scheduledRepaymentsData.scheduled_repayments * 100
						) / 100,
					total_loan_value:
						Math.round(tlvData.total_loan_value * 100) / 100,
					current_loan_value:
						Math.round(
							currentLoanValueData.current_loan_value * 100
						) / 100,
					repayment_count: repaymentsData.repayment_count,
					scheduled_count: scheduledRepaymentsData.scheduled_count,
				};
			});

			// Fill in missing months with zero values
			const result = [];
			const now = new Date();
			for (let i = 5; i >= 0; i--) {
				const targetMonth = new Date(
					now.getFullYear(),
					now.getMonth() - i,
					1
				);
				const monthStr = targetMonth.toLocaleDateString("en-US", {
					month: "short",
				});

				const existingStat = monthlyStats.find(
					(s) => s.month === monthStr
				);
				if (existingStat) {
					result.push(existingStat);
				} else {
					result.push({
						month: monthStr,
						applications: 0,
						approvals: 0,
						disbursements: 0,
						revenue: 0,
						disbursement_amount: 0,
						disbursement_count: 0,
						users: 0,
						kyc_users: 0,
						actual_repayments: 0,
						scheduled_repayments: 0,
						total_loan_value: 0,
						current_loan_value: 0,
						repayment_count: 0,
						scheduled_count: 0,
					});
				}
			}

			res.json({ monthlyStats: result });
		} catch (error) {
			console.error("Error fetching monthly stats:", error);
			res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
// Get all users (protected admin route)
// @ts-ignore
router.get("/users", authenticateToken, async (req: Request, res: Response) => {
	try {
		const users = await prisma.user.findMany({
			select: {
				id: true,
				fullName: true,
				email: true,
				phoneNumber: true,
				role: true,
				createdAt: true,
				lastLoginAt: true,
			},
		});

		res.json(users);
	} catch (error) {
		console.error("Get users error:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get a specific user by ID (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
// Get specific user by ID (protected admin route)
router.get(
	"/users/:id",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;

			// Check if user exists
			const user = await prisma.user.findUnique({
				where: { id },
				select: {
					id: true,
					fullName: true,
					email: true,
					phoneNumber: true,
					role: true,
					createdAt: true,
					updatedAt: true,
					dateOfBirth: true,
					address1: true,
					address2: true,
					city: true,
					state: true,
					zipCode: true,
					employmentStatus: true,
					employerName: true,
					monthlyIncome: true,
					bankName: true,
					accountNumber: true,
					onboardingStep: true,
					kycStatus: true,
					lastLoginAt: true,
				},
			});

			if (!user) {
				return res.status(404).json({ error: "User not found" });
			}

			return res.json(user);
		} catch (error) {
			console.error("Get user by ID error:", error);
			return res.status(500).json({ error: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Update a user (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN]
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
// Update user (protected admin route)
// @ts-ignore
router.put(
	"/users/:id",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const updateData = req.body;

			// Check if user exists
			const existingUser = await prisma.user.findUnique({
				where: { id },
			});

			if (!existingUser) {
				return res.status(404).json({ error: "User not found" });
			}

			// Update user
			const updatedUser = await prisma.user.update({
				where: { id },
				data: updateData,
				select: {
					id: true,
					fullName: true,
					email: true,
					phoneNumber: true,
					role: true,
					createdAt: true,
				},
			});

			res.json(updatedUser);
		} catch (error) {
			console.error("Update user error:", error);
			res.status(500).json({ error: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete a user (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
// Delete user (protected admin route)
// @ts-ignore
router.delete(
	"/users/:id",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;

			// Check if user exists
			const existingUser = await prisma.user.findUnique({
				where: { id },
			});

			if (!existingUser) {
				return res.status(404).json({ error: "User not found" });
			}

			// Delete user
			await prisma.user.delete({
				where: { id },
			});

			res.json({ message: "User deleted successfully" });
		} catch (error) {
			console.error("Delete user error:", error);
			res.status(500).json({ error: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/admin/refresh:
 *   post:
 *     summary: Refresh admin access token
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Invalid refresh token
 *       500:
 *         description: Server error
 */
// @ts-ignore
router.post("/refresh", async (req: Request, res: Response) => {
	try {
		const { refreshToken } = req.body;

		if (!refreshToken) {
			return res.status(400).json({ error: "Refresh token is required" });
		}

		// Verify refresh token
		const decoded = jwt.verify(
			refreshToken,
			process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key"
		) as { userId: string; role?: string };

		// Get user
		const user = await prisma.user.findUnique({
			where: { id: decoded.userId },
		});

		if (!user) {
			return res.status(401).json({ error: "Invalid refresh token" });
		}

		// Check if user is admin
		if (user.role !== "ADMIN") {
			return res
				.status(403)
				.json({ error: "Access denied. Admin privileges required." });
		}

		// Generate new tokens
		const accessToken = jwt.sign(
			{ userId: user.id, role: user.role },
			process.env.JWT_SECRET || "your-secret-key",
			{ expiresIn: "15m" }
		);

		const newRefreshToken = jwt.sign(
			{ userId: user.id, role: user.role },
			process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key",
			{ expiresIn: "90d" }
		);

		res.json({
			accessToken,
			refreshToken: newRefreshToken,
		});
	} catch (error) {
		console.error("Admin token refresh error:", error);
		res.status(401).json({ error: "Invalid refresh token" });
	}
});

/**
 * @swagger
 * /api/admin/logout:
 *   post:
 *     summary: Logout admin user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: The refresh token to invalidate
 *     responses:
 *       200:
 *         description: Successfully logged out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
// @ts-ignore
router.post(
	"/logout",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const { refreshToken } = req.body;

			if (!refreshToken) {
				return res
					.status(400)
					.json({ error: "Refresh token is required" });
			}

			// In a real implementation, you would:
			// 1. Add the token to a blacklist
			// 2. Or remove it from a token store
			// 3. Or set it as expired in a database

			// For now, we'll just acknowledge the logout
			// This is where you'd add your token invalidation logic in the future

			// Note: The frontend should still remove the tokens from localStorage/cookies

			return res.status(200).json({ message: "Successfully logged out" });
		} catch (error) {
			console.error("Admin logout error:", error);
			return res.status(500).json({ error: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/admin/me:
 *   get:
 *     summary: Get admin profile information
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin user profile information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                 phoneNumber:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                   enum: [ADMIN]
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin
 *       500:
 *         description: Server error
 */
router.get(
	"/me",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			if (!req.user?.userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			// Get user by ID
			const user = await prisma.user.findUnique({
				where: { id: req.user.userId },
				select: {
					id: true,
					fullName: true,
					phoneNumber: true,
					email: true,
					role: true,
				},
			});

			if (!user) {
				return res.status(404).json({ error: "User not found" });
			}

			// Ensure the user is an admin
			if (user.role !== "ADMIN") {
				return res.status(403).json({
					error: "Access denied. Admin privileges required.",
				});
			}

			return res.json(user);
		} catch (error) {
			console.error("Admin profile error:", error);
			return res.status(500).json({ error: "Server error" });
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/counts:
 *   get:
 *     summary: Get counts of loan applications by status (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Counts of loan applications by status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 INCOMPLETE:
 *                   type: number
 *                 PENDING_APP_FEE:
 *                   type: number
 *                 PENDING_KYC:
 *                   type: number
 *                 PENDING_APPROVAL:
 *                   type: number
 *                 APPROVED:
 *                   type: number
 *                 PENDING_SIGNATURE:
 *                   type: number
 *                 PENDING_DISBURSEMENT:
 *                   type: number
 *                 ACTIVE:
 *                   type: number
 *                 WITHDRAWN:
 *                   type: number
 *                 REJECTED:
 *                   type: number
 *                 total:
 *                   type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
// Get counts of loan applications by status (admin only)
// @ts-ignore
router.get(
	"/applications/counts",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			console.log("Fetching application counts for admin");

			// Define all possible statuses
			const statusList = [
				"INCOMPLETE",
				"PENDING_APP_FEE",
				"PENDING_KYC",
				"PENDING_APPROVAL",
				"APPROVED",
				"PENDING_ATTESTATION",
				"PENDING_SIGNATURE",
				"PENDING_DISBURSEMENT",
				"ACTIVE",
				"WITHDRAWN",
				"REJECTED",
			];

			// Create an object to store counts
			const counts: Record<string, number> = {};

			// Initialize all statuses with 0 count
			statusList.forEach((status) => {
				counts[status] = 0;
			});

			// Get total applications count
			const total = await prisma.loanApplication.count();

			// Log all application statuses to debug
			const allApps = await prisma.loanApplication.findMany({
				select: {
					id: true,
					status: true,
				},
			});
			console.log(
				"All applications with statuses:",
				JSON.stringify(allApps)
			);

			// Get counts for each status directly for logging
			for (const status of statusList) {
				const count = await prisma.loanApplication.count({
					where: { status },
				});
				console.log(`Count for status ${status}: ${count}`);
				counts[status] = count;
			}

			// Add total count
			counts.total = total;

			console.log(
				`Found ${total} total applications with status counts:`,
				counts
			);
			return res.json(counts);
		} catch (error) {
			console.error("Error fetching application counts:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/admin/applications:
 *   get:
 *     summary: Get all loan applications (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of loan applications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LoanApplication'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
// Get all loan applications (admin only)
// @ts-ignore
router.get(
	"/applications",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			console.log("Fetching all applications for admin");

			const applications = await prisma.loanApplication.findMany({
				orderBy: {
					createdAt: "desc",
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							phoneNumber: true,
							email: true,
							bankName: true,
							accountNumber: true,
						},
					},
					product: {
						select: {
							id: true,
							name: true,
							code: true,
						},
					},
					documents: {
						select: {
							id: true,
							type: true,
							status: true,
							fileUrl: true,
							createdAt: true,
						},
					},
				},
			});

			console.log(`Found ${applications.length} applications`);
			return res.json(applications);
		} catch (error) {
			console.error("Error fetching applications:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/live-attestations:
 *   get:
 *     summary: Get all live video call attestation requests
 *     tags: [Admin - Applications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of live attestation requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LoanApplication'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
// Get all live video call attestation requests (admin endpoint)
router.get(
	"/applications/live-attestations",
	authenticateToken,
	async (_req: AuthRequest, res: Response) => {
		try {
			console.log("Admin fetching live attestation requests");

			const applications = await prisma.loanApplication.findMany({
				where: {
					status: "PENDING_ATTESTATION",
					attestationType: "MEETING",
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							phoneNumber: true,
						},
					},
					product: {
						select: {
							id: true,
							name: true,
							code: true,
						},
					},
				},
				orderBy: [
					{
						attestationCompleted: "asc", // Pending first
					},
					{
						updatedAt: "desc", // Most recent requests first within each group
					},
				],
			});

			console.log(
				`Found ${applications.length} live attestation requests`
			);
			return res.json(applications);
		} catch (error) {
			console.error("Error fetching live attestation requests:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/{id}/complete-live-attestation:
 *   post:
 *     summary: Complete live video call attestation for an application
 *     tags: [Admin - Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Admin notes about the live call
 *               meetingCompletedAt:
 *                 type: string
 *                 format: date-time
 *                 description: When the meeting was completed
 *     responses:
 *       200:
 *         description: Live attestation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       400:
 *         description: Invalid request or application not in correct status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
// Complete live video call attestation (admin endpoint)
router.post(
	"/applications/:id/complete-live-attestation",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { notes, meetingCompletedAt } = req.body;
			const adminUserId = req.user?.userId;

			console.log(
				`Admin ${adminUserId} completing live attestation for application ${id}`
			);

			// Get the application to check current status
			const application = await prisma.loanApplication.findUnique({
				where: { id },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							phoneNumber: true,
						},
					},
					product: true,
				},
			});

			if (!application) {
				return res
					.status(404)
					.json({ message: "Application not found" });
			}

			// Validate current status and attestation type
			if (application.status !== "PENDING_ATTESTATION") {
				return res.status(400).json({
					message: `Application must be in PENDING_ATTESTATION status. Current status: ${application.status}`,
				});
			}

			if (application.attestationType !== "MEETING") {
				return res.status(400).json({
					message: `Application must have MEETING attestation type. Current type: ${application.attestationType}`,
				});
			}

			// Update the application to complete the live attestation
			const updatedApplication = await prisma.loanApplication.update({
				where: { id },
				data: {
					attestationCompleted: true,
					attestationDate: new Date(),
					attestationNotes:
						notes || "Live video call completed by admin",
					meetingCompletedAt: meetingCompletedAt
						? new Date(meetingCompletedAt)
						: new Date(),
					status: "PENDING_SIGNATURE", // Move to next step
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							phoneNumber: true,
							email: true,
						},
					},
					product: {
						select: {
							id: true,
							name: true,
							code: true,
						},
					},
				},
			});

			// Track the status change in history
			await trackApplicationStatusChange(
				prisma,
				id,
				"PENDING_ATTESTATION",
				"PENDING_SIGNATURE",
				adminUserId,
				"Live video call attestation completed by admin",
				notes || "Live video call attestation completed by admin",
				{
					attestationType: "MEETING",
					completedBy: adminUserId,
					completedAt: new Date().toISOString(),
					meetingCompletedAt:
						meetingCompletedAt || new Date().toISOString(),
				}
			);

			console.log(
				`Live attestation completed successfully for application ${id} by admin ${adminUserId}`
			);
			return res.json(updatedApplication);
		} catch (error) {
			console.error("Error completing live attestation:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/{id}:
 *   get:
 *     summary: Get a specific loan application (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan application ID
 *     responses:
 *       200:
 *         description: Loan application details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
// Get a specific loan application (admin only)
// @ts-ignore
router.get(
	"/applications/:id",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			console.log(`Fetching application details for ID: ${id}`);

			// Check if we're looking up by urlLink instead of ID
			let application = null;

			// First try to find by ID
			application = await prisma.loanApplication.findUnique({
				where: { id },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							phoneNumber: true,
							email: true,
							dateOfBirth: true,
							employmentStatus: true,
							employerName: true,
							monthlyIncome: true,
							bankName: true,
							accountNumber: true,
						},
					},
					product: {
						select: {
							id: true,
							name: true,
							code: true,
							minAmount: true,
							maxAmount: true,
							description: true,
							interestRate: true,
							repaymentTerms: true,
						},
					},
					documents: {
						select: {
							id: true,
							type: true,
							status: true,
							fileUrl: true,
							createdAt: true,
							updatedAt: true,
						},
						orderBy: {
							createdAt: "desc",
						},
					},
				},
			});

			// If not found by ID, try to find by urlLink
			if (!application) {
				application = await prisma.loanApplication.findUnique({
					where: { urlLink: id },
					include: {
						user: {
							select: {
								id: true,
								fullName: true,
								phoneNumber: true,
								email: true,
								dateOfBirth: true,
								employmentStatus: true,
								employerName: true,
								monthlyIncome: true,
								bankName: true,
								accountNumber: true,
							},
						},
						product: {
							select: {
								id: true,
								name: true,
								code: true,
								minAmount: true,
								maxAmount: true,
								description: true,
								interestRate: true,
								repaymentTerms: true,
							},
						},
						documents: {
							select: {
								id: true,
								type: true,
								status: true,
								fileUrl: true,
								createdAt: true,
								updatedAt: true,
							},
							orderBy: {
								createdAt: "desc",
							},
						},
					},
				});
			}

			if (!application) {
				console.log(`Application not found for ID or URL: ${id}`);
				return res
					.status(404)
					.json({ message: "Application not found" });
			}

			console.log(
				`Found application with ${application.documents.length} documents`
			);
			return res.json(application);
		} catch (error) {
			console.error("Error fetching application:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/{id}/status:
 *   patch:
 *     summary: Update loan application status (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [INCOMPLETE, PENDING_APP_FEE, PENDING_KYC, PENDING_APPROVAL, APPROVED, DISBURSED, REJECTED, WITHDRAWN]
 *     responses:
 *       200:
 *         description: Application status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       400:
 *         description: Invalid status value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
// Update loan application status (admin only)
// @ts-ignore
router.patch(
	"/applications/:id/status",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { status, notes, referenceNumber } = req.body;
			const adminUserId = req.user?.userId;

			const validStatuses = [
				"INCOMPLETE",
				"PENDING_APP_FEE",
				"PENDING_KYC",
				"PENDING_APPROVAL",
				"APPROVED",
				"PENDING_ATTESTATION",
				"PENDING_SIGNATURE",
				"PENDING_DISBURSEMENT",
				"ACTIVE",
				"REJECTED",
				"WITHDRAWN",
			];

			if (!validStatuses.includes(status)) {
				return res
					.status(400)
					.json({ message: "Invalid status value" });
			}

			// Auto-convert APPROVED to PENDING_ATTESTATION for better workflow
			let finalStatus = status;
			if (status === "APPROVED") {
				finalStatus = "PENDING_ATTESTATION";
				console.log(
					"Auto-converting APPROVED status to PENDING_ATTESTATION"
				);
			}

			// Special handling for DISBURSED status
			if (finalStatus === "DISBURSED" || finalStatus === "ACTIVE") {
				console.log("Processing loan activation with disbursement");

				// Use provided reference number or generate one as fallback
				const disbursementReference =
					referenceNumber || `DISB-${Date.now()}`;
				console.log("Using reference number:", disbursementReference);

				// Validate reference number
				if (!disbursementReference) {
					return res
						.status(400)
						.json({ message: "Reference number is required" });
				}

				// Get the application to check if it exists and verify current state
				const application = await prisma.loanApplication.findUnique({
					where: { id },
					include: {
						user: true,
						loan: true,
					},
				});

				if (!application) {
					return res
						.status(404)
						.json({ message: "Application not found" });
				}

				// Check if already disbursed
				const existingDisbursement =
					await prisma.loanDisbursement.findUnique({
						where: { applicationId: id },
					});

				if (existingDisbursement) {
					return res.status(400).json({
						message: "This application has already been disbursed",
						disbursementDetails: existingDisbursement,
					});
				}

				// Handle disbursement as a transaction
				try {
					console.log(
						"Starting disbursement transaction via status update"
					);
					const result = await prisma.$transaction(
						async (prismaTransaction) => {
							// Update the application status to DISBURSED
							console.log(
								"Updating application status to ACTIVE"
							);
							const updatedApplication =
								await prismaTransaction.loanApplication.update({
									where: { id },
									data: {
										status: "ACTIVE",
									},
									include: {
										user: {
											select: {
												id: true,
												fullName: true,
												email: true,
												phoneNumber: true,
											},
										},
										product: true,
									},
								});

							// If there's an associated loan, update its status
							let updatedLoan = null;
							if (application.loan) {
								console.log(
									"Updating existing loan status to ACTIVE"
								);
								updatedLoan =
									await prismaTransaction.loan.update({
										where: { applicationId: id },
										data: {
											status: "ACTIVE",
											disbursedAt: new Date(),
										},
									});
							} else {
								// Create a new loan record since it doesn't exist
								console.log(
									"Creating new loan record for disbursement"
								);
								try {
									// Ensure we have all required values
									if (!application.amount) {
										throw new Error(
											"Cannot create loan: Amount is required"
										);
									}

									// Calculate total amount directly from principal and interest
									const principal = application.amount;
									const interestRate =
										application.interestRate || 0;
									const term = application.term || 12;
									const totalInterest =
										Math.round(
											principal *
												(interestRate / 100) *
												term *
												100
										) / 100;
									const totalAmount =
										Math.round(
											(principal + totalInterest) * 100
										) / 100;
									updatedLoan =
										await prismaTransaction.loan.create({
											data: {
												userId: application.userId,
												applicationId: application.id,
												principalAmount:
													application.amount,
												totalAmount: totalAmount,
												outstandingBalance: totalAmount,
												interestRate:
													application.interestRate ||
													0,
												term: application.term || 12,
												monthlyPayment:
													application.monthlyRepayment ||
													application.amount / 12,
												status: "ACTIVE",
												disbursedAt: new Date(),
											},
										});
									console.log(
										"Loan record created successfully"
									);
								} catch (loanError) {
									console.error(
										"Failed to create loan record:",
										loanError
									);
									throw new Error(
										`Failed to create loan record: ${loanError.message}`
									);
								}
							}

							// Create the loan disbursement record
							const disbursementAmount =
								application.netDisbursement ||
								application.amount ||
								0;
							const disbursement =
								await createLoanDisbursementRecord(
									prismaTransaction,
									id,
									disbursementReference,
									disbursementAmount,
									adminUserId,
									application.user.bankName,
									application.user.accountNumber,
									notes
								);

							// Create a wallet transaction record if possible
							let walletTransaction = null;
							try {
								console.log(
									"Creating wallet transaction record"
								);

								// Check if user exists in the application
								if (!application.user) {
									console.error(
										"User not found in application"
									);
									throw new Error(
										"User not found in application"
									);
								}

								// Debug user info
								console.log("Status update - User info:", {
									userId: application.userId,
									userName: application.user.fullName,
									bankName:
										application.user.bankName || "Not set",
									accountNumber:
										application.user.accountNumber ||
										"Not set",
								});

								// Get wallet for the user
								const wallet =
									await prismaTransaction.wallet.findUnique({
										where: { userId: application.userId },
									});

								if (!wallet) {
									console.log(
										"No wallet found for user, creating one"
									);

									// Create a wallet if it doesn't exist
									const newWallet =
										await prismaTransaction.wallet.create({
											data: {
												userId: application.userId,
												balance: 0,
												availableForWithdrawal: 0,
												totalDeposits: 0,
												totalWithdrawals: 0,
											},
										});

									console.log(
										"New wallet created:",
										newWallet.id
									);

									// Create a transaction record for the disbursement
									walletTransaction =
										await prismaTransaction.walletTransaction.create(
											{
												data: {
													userId: application.userId,
													walletId: newWallet.id,
													type: "LOAN_DISBURSEMENT",
													amount: disbursementAmount,
													description: `Loan disbursement - Ref: ${disbursementReference}`,
													reference:
														disbursementReference,
													status: "APPROVED",
													processedAt: new Date(),
													metadata: {
														disbursedBy:
															adminUserId,
														notes: notes || "",
														bankName:
															application.user
																.bankName,
														bankAccountNumber:
															application.user
																.accountNumber,
														applicationId: id,
													},
												},
											}
										);
								} else {
									console.log("Wallet found:", wallet.id);

									// Create a transaction record for the disbursement
									walletTransaction =
										await prismaTransaction.walletTransaction.create(
											{
												data: {
													userId: application.userId,
													walletId: wallet.id,
													type: "LOAN_DISBURSEMENT",
													amount: disbursementAmount,
													description: `Loan disbursement - Ref: ${disbursementReference}`,
													reference:
														disbursementReference,
													status: "APPROVED",
													processedAt: new Date(),
													metadata: {
														disbursedBy:
															adminUserId,
														notes: notes || "",
														bankName:
															application.user
																.bankName,
														bankAccountNumber:
															application.user
																.accountNumber,
														applicationId: id,
													},
												},
											}
										);
								}

								console.log(
									"Status endpoint - Wallet transaction created successfully"
								);
							} catch (walletError) {
								console.error(
									"Status endpoint - Could not create wallet transaction record:",
									walletError
								);
								// Continue without creating wallet transaction
							}

							// Create a notification for the user
							let notification = null;
							try {
								console.log("Creating notification for user");
								notification =
									await prismaTransaction.notification.create(
										{
											data: {
												userId: application.userId,
												title: "Loan Activated",
												message: `Your loan of ${disbursementAmount} has been disbursed to your bank account and is now active. Reference: ${disbursementReference}`,
												type: "SYSTEM",
												priority: "HIGH",
												metadata: {
													loanAmount:
														application.amount,
													referenceNumber:
														disbursementReference,
													notes: notes || "",
													disbursedBy: adminUserId,
													disbursedAt:
														new Date().toISOString(),
												},
											},
										}
									);
							} catch (notificationError) {
								console.error(
									"Could not create notification:",
									notificationError
								);
								// Continue without creating notification
							}

							// Track the status change in history
							await trackApplicationStatusChange(
								prismaTransaction,
								id,
								application.status,
								"ACTIVE",
								adminUserId,
								"Loan disbursement",
								notes,
								{
									referenceNumber: disbursementReference,
									amount: disbursementAmount,
									disbursedBy: adminUserId,
									disbursedAt: new Date().toISOString(),
								}
							);

							console.log(
								"Disbursement transaction completed successfully"
							);
							return {
								application: updatedApplication,
								loan: updatedLoan,
								disbursement,
								walletTransaction,
								notification,
								disbursementDetails: {
									referenceNumber: disbursementReference,
									amount: disbursementAmount,
									bankName: application.user.bankName,
									bankAccountNumber:
										application.user.accountNumber,
									disbursedBy: adminUserId,
									disbursedAt: new Date().toISOString(),
									notes: notes || "",
								},
							};
						}
					);

					console.log("Disbursement completed successfully");
					return res.status(200).json({
						message: "Loan successfully disbursed and activated",
						data: result,
					});
				} catch (transactionError) {
					console.error(
						"Transaction error during disbursement:",
						transactionError
					);
					return res.status(500).json({
						message: "Error during disbursement transaction",
						error: transactionError.message,
					});
				}
			} else {
				// Regular status update (non-disbursement)
				console.log(
					`Processing regular status update to ${finalStatus}`
				);

				const application = await prisma.loanApplication.update({
					where: { id },
					data: { status: finalStatus },
					include: {
						user: {
							select: {
								id: true,
								fullName: true,
								phoneNumber: true,
								email: true,
								dateOfBirth: true,
								address1: true,
								address2: true,
								city: true,
								state: true,
								zipCode: true,
								employmentStatus: true,
								employerName: true,
								monthlyIncome: true,
								bankName: true,
								accountNumber: true,
							},
						},
						product: {
							select: {
								id: true,
								name: true,
								code: true,
								description: true,
								interestRate: true,
								repaymentTerms: true,
							},
						},
						documents: {
							select: {
								id: true,
								type: true,
								status: true,
								fileUrl: true,
								createdAt: true,
								updatedAt: true,
							},
						},
					},
				});

				// Track the status change in history
				await trackApplicationStatusChange(
					prisma,
					id,
					application.status,
					finalStatus,
					adminUserId,
					status === "APPROVED"
						? "Auto-converted from APPROVED to PENDING_ATTESTATION"
						: "Admin status update",
					notes ||
						(status === "APPROVED"
							? "Automatically moved to attestation stage after approval"
							: ""),
					{
						updatedBy: adminUserId,
						updatedAt: new Date().toISOString(),
						originalStatus: status,
						finalStatus: finalStatus,
					}
				);

				// Create notification for the user about status change
				try {
					console.log("Creating notification for status update");
					await prisma.notification.create({
						data: {
							userId: application.user.id,
							title: "Application Status Updated",
							message: `Your loan application status has been updated to ${finalStatus}`,
							type: "SYSTEM",
							priority: "HIGH",
							metadata: {
								applicationId: id,
								previousStatus: application.status,
								newStatus: finalStatus,
								notes: notes || "",
								updatedBy: adminUserId,
								updatedAt: new Date().toISOString(),
								originalStatus: status,
							},
						},
					});
				} catch (err) {
					console.log("Could not create notification:", err);
				}

				return res.json(application);
			}
		} catch (error) {
			console.error("Error updating application status:", error);
			if (error.code === "P2025") {
				return res
					.status(404)
					.json({ message: "Application not found" });
			}
			return res.status(500).json({
				message: "Internal server error",
				error: error.message || "Unknown error",
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/documents/{id}/status:
 *   patch:
 *     summary: Update document status (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The document ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, REJECTED]
 *     responses:
 *       200:
 *         description: Document status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       400:
 *         description: Invalid status value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
// Update document status (admin only)
router.patch(
	"/documents/:id/status",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { status } = req.body;

			const validStatuses = ["PENDING", "APPROVED", "REJECTED"];

			if (!validStatuses.includes(status)) {
				return res
					.status(400)
					.json({ message: "Invalid status value" });
			}

			const document = await prisma.userDocument.update({
				where: { id },
				data: { status },
			});

			// TODO: Send notification to user about document status change

			return res.json(document);
		} catch (error) {
			console.error("Error updating document status:", error);
			if (error.code === "P2025") {
				return res.status(404).json({ message: "Document not found" });
			}
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/admin/loans:
 *   get:
 *     summary: Get all approved and disbursed loan applications
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved loans
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LoanApplication'
 *       401:
 *         description: Unauthorized, token is invalid or missing
 *       403:
 *         description: Forbidden, user is not an admin
 *       500:
 *         description: Server error
 */
router.get(
	"/loans",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			// Get user data from database to check role instead of relying on req.user.role
			const user = await prisma.user.findUnique({
				where: { id: req.user?.userId },
				select: { role: true },
			});

			if (!user || user.role !== "ADMIN") {
				return res.status(403).json({
					success: false,
					message: "Forbidden. User is not an admin.",
				});
			}

			const loans = await prisma.loan.findMany({
				where: {
					status: {
						in: ["ACTIVE", "PENDING_DISCHARGE", "DISCHARGED"],
					},
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							phoneNumber: true,
							email: true,
						},
					},
					application: {
						include: {
							product: {
								select: {
									id: true,
									name: true,
									code: true,
								},
							},
							user: {
								select: {
									id: true,
									fullName: true,
									email: true,
									phoneNumber: true,
									employmentStatus: true,
									employerName: true,
									monthlyIncome: true,
									bankName: true,
									accountNumber: true,
								},
							},
						},
					},
					repayments: {
						select: {
							id: true,
							amount: true,
							principalAmount: true,
							interestAmount: true,
							status: true,
							dueDate: true,
							paidAt: true,
							createdAt: true,
						},
						orderBy: {
							dueDate: "desc",
						},
						take: 5, // Just for summary - full data loaded on repayments tab
					},
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			return res.status(200).json({
				success: true,
				data: loans,
			});
		} catch (error) {
			console.error("Error fetching loans:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to fetch loans",
				error: (error as Error).message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/{id}/disburse:
 *   post:
 *     summary: Disburse a loan application (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - notes
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Additional notes about the disbursement
 *     responses:
 *       200:
 *         description: Loan successfully disbursed
 *       400:
 *         description: Invalid request or missing notes
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
// Disburse a loan application (admin only)
// @ts-ignore
router.post(
	"/applications/:id/disburse",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			console.log(
				"Disbursement request received for application:",
				req.params.id
			);
			const { id } = req.params;
			const { notes, referenceNumber } = req.body;
			const adminUserId = req.user?.userId;

			// Use provided reference number or generate one as fallback
			const disbursementReference =
				referenceNumber || `DISB-${Date.now()}`;

			console.log("Request body:", {
				referenceNumber: disbursementReference,
				notes,
				adminUserId,
			});

			// Validate reference number
			if (!disbursementReference) {
				return res
					.status(400)
					.json({ message: "Reference number is required" });
			}

			// Get the application to verify it exists and is in PENDING_DISBURSEMENT state
			console.log("Fetching loan application details");
			const application = await prisma.loanApplication.findUnique({
				where: { id },
				include: {
					user: true,
					product: true,
					loan: true,
				},
			});

			if (!application) {
				console.log("Application not found:", id);
				return res
					.status(404)
					.json({ message: "Application not found" });
			}

			console.log("Application found:", {
				id: application.id,
				status: application.status,
				amount: application.amount,
			});

			// Check if the application has already been disbursed
			const existingDisbursement =
				await prisma.loanDisbursement.findUnique({
					where: { applicationId: id },
				});

			if (existingDisbursement) {
				console.log("Application already has a disbursement record");
				return res.status(400).json({
					message: "This application has already been disbursed",
					disbursementDetails: existingDisbursement,
				});
			}

			// Allow disbursement if status is PENDING_DISBURSEMENT or APPROVED for flexibility
			if (
				application.status !== "PENDING_DISBURSEMENT" &&
				application.status !== "APPROVED"
			) {
				console.log(
					`Invalid application status: ${application.status}`
				);
				return res.status(400).json({
					message: `Application is in ${application.status} status. Only applications in PENDING_DISBURSEMENT or APPROVED status can be disbursed.`,
				});
			}

			try {
				// Process the disbursement in a transaction to ensure consistency
				const result = await prisma.$transaction(
					async (prismaTransaction) => {
						// Update application status to ACTIVE
						console.log("Updating application status to ACTIVE");
						const updatedApplication =
							await prismaTransaction.loanApplication.update({
								where: { id },
								data: {
									status: "ACTIVE",
								},
							});

						// Create or update loan record
						let updatedLoan = null;
						if (application.loan) {
							console.log(
								"Updating existing loan status to ACTIVE"
							);
							updatedLoan = await prismaTransaction.loan.update({
								where: { applicationId: id },
								data: {
									status: "ACTIVE",
									disbursedAt: new Date(),
								},
							});
						} else {
							// Create a new loan record since it doesn't exist
							console.log(
								"Creating new loan record for disbursement"
							);
							try {
								// Ensure we have all required values
								if (!application.amount) {
									throw new Error(
										"Cannot create loan: Amount is required"
									);
								}

								// Calculate total amount directly from principal and interest
								const principal = application.amount;
								const interestRate =
									application.interestRate || 0;
								const term = application.term || 12;
								const totalInterest =
									Math.round(
										principal *
											(interestRate / 100) *
											term *
											100
									) / 100;
								const totalAmount =
									Math.round(
										(principal + totalInterest) * 100
									) / 100;

								updatedLoan =
									await prismaTransaction.loan.create({
										data: {
											userId: application.userId,
											applicationId: application.id,
											principalAmount: application.amount,
											totalAmount: totalAmount,
											outstandingBalance: totalAmount,
											interestRate:
												application.interestRate || 0,
											term: application.term || 12,
											monthlyPayment:
												application.monthlyRepayment ||
												application.amount / 12,
											status: "ACTIVE",
											disbursedAt: new Date(),
										},
									});
								console.log("Loan record created successfully");
							} catch (loanError) {
								console.error(
									"Failed to create loan record:",
									loanError
								);
								throw new Error(
									`Failed to create loan record: ${loanError.message}`
								);
							}
						}

						// Create the loan disbursement record
						const disbursementAmount =
							application.netDisbursement ||
							application.amount ||
							0;
						const disbursement = await createLoanDisbursementRecord(
							prismaTransaction,
							id,
							disbursementReference,
							disbursementAmount,
							adminUserId,
							application.user.bankName,
							application.user.accountNumber,
							notes
						);

						// Auto-generate payment schedule when loan is disbursed
						console.log(
							`Auto-generating payment schedule for loan ${updatedLoan.id}`
						);
						await generatePaymentScheduleInTransaction(
							updatedLoan.id,
							prismaTransaction
						);

						// Create a wallet transaction record if possible
						let walletTransaction = null;
						try {
							// Check if user has a wallet
							console.log(
								"Checking for existing wallet for user:",
								application.userId
							);
							const wallet =
								await prismaTransaction.wallet.findUnique({
									where: { userId: application.userId },
								});

							// Log for audit purposes
							console.log("Loan disbursement processing for:", {
								userId: application.userId,
								userName: application.user.fullName,
								bankName:
									application.user.bankName || "Not set",
								accountNumber:
									application.user.accountNumber || "Not set",
							});

							if (!wallet) {
								console.log(
									"No wallet found for user, creating one"
								);

								// Create a wallet if it doesn't exist
								const newWallet =
									await prismaTransaction.wallet.create({
										data: {
											userId: application.userId,
											balance: 0,
											availableForWithdrawal: 0,
											totalDeposits: 0,
											totalWithdrawals: 0,
										},
									});

								console.log(
									"New wallet created:",
									newWallet.id
								);

								// Create a transaction record for the disbursement
								walletTransaction =
									await prismaTransaction.walletTransaction.create(
										{
											data: {
												userId: application.userId,
												walletId: newWallet.id,
												type: "LOAN_DISBURSEMENT",
												amount: disbursementAmount,
												description: `Loan disbursement - Ref: ${disbursementReference}`,
												reference:
													disbursementReference,
												status: "APPROVED",
												processedAt: new Date(),
												metadata: {
													disbursedBy: adminUserId,
													notes: notes || "",
													bankName:
														application.user
															.bankName,
													bankAccountNumber:
														application.user
															.accountNumber,
													applicationId: id,
												},
											},
										}
									);
							} else {
								console.log("Wallet found:", wallet.id);

								// Create a transaction record for the disbursement
								walletTransaction =
									await prismaTransaction.walletTransaction.create(
										{
											data: {
												userId: application.userId,
												walletId: wallet.id,
												type: "LOAN_DISBURSEMENT",
												amount: disbursementAmount,
												description: `Loan disbursement - Ref: ${disbursementReference}`,
												reference:
													disbursementReference,
												status: "APPROVED",
												processedAt: new Date(),
												metadata: {
													disbursedBy: adminUserId,
													notes: notes || "",
													bankName:
														application.user
															.bankName,
													bankAccountNumber:
														application.user
															.accountNumber,
													applicationId: id,
												},
											},
										}
									);
							}

							console.log(
								"Status endpoint - Wallet transaction created successfully"
							);
						} catch (walletError) {
							console.error(
								"Status endpoint - Could not create wallet transaction record:",
								walletError
							);
							// Continue without creating wallet transaction
						}

						// Create a notification for the user
						let notification = null;
						try {
							console.log("Creating notification for user");
							notification =
								await prismaTransaction.notification.create({
									data: {
										userId: application.userId,
										title: "Loan Activated",
										message: `Your loan of ${disbursementAmount} has been disbursed to your bank account and is now active. Reference: ${disbursementReference}`,
										type: "SYSTEM",
										priority: "HIGH",
										metadata: {
											loanAmount: application.amount,
											disbursementAmount:
												disbursementAmount,
											referenceNumber:
												disbursementReference,
											notes: notes || "",
											disbursedBy: adminUserId,
											disbursedAt:
												new Date().toISOString(),
										},
									},
								});

							// Track the status change in history
							await trackApplicationStatusChange(
								prismaTransaction,
								id,
								application.status,
								"ACTIVE",
								adminUserId,
								"Loan disbursement",
								notes,
								{
									referenceNumber: disbursementReference,
									amount: disbursementAmount,
									disbursedBy: adminUserId,
									disbursedAt: new Date().toISOString(),
								}
							);

							console.log(
								"Disbursement transaction completed successfully"
							);
							return {
								application: updatedApplication,
								loan: updatedLoan,
								disbursement,
								walletTransaction,
								notification,
								disbursementDetails: {
									referenceNumber: disbursementReference,
									amount: disbursementAmount,
									bankName: application.user.bankName,
									bankAccountNumber:
										application.user.accountNumber,
									disbursedBy: adminUserId,
									disbursedAt: new Date().toISOString(),
									notes: notes || "",
								},
							};
						} catch (notificationError) {
							console.error(
								"Could not create notification:",
								notificationError
							);
							// Continue without creating notification

							// Track the status change in history even if notification fails
							await trackApplicationStatusChange(
								prismaTransaction,
								id,
								application.status,
								"ACTIVE",
								adminUserId,
								"Loan disbursement",
								notes,
								{
									referenceNumber: disbursementReference,
									amount: disbursementAmount,
									disbursedBy: adminUserId,
									disbursedAt: new Date().toISOString(),
								}
							);

							console.log(
								"Disbursement transaction completed successfully"
							);
							return {
								application: updatedApplication,
								loan: updatedLoan,
								disbursement,
								walletTransaction,
								notification: null,
								disbursementDetails: {
									referenceNumber: disbursementReference,
									amount: disbursementAmount,
									bankName: application.user.bankName,
									bankAccountNumber:
										application.user.accountNumber,
									disbursedBy: adminUserId,
									disbursedAt: new Date().toISOString(),
									notes: notes || "",
								},
							};
						}
					}
				);

				console.log("Disbursement completed successfully");
				return res.status(200).json({
					message: "Loan successfully disbursed and activated",
					data: result,
				});
			} catch (transactionError) {
				console.error(
					"Transaction error during disbursement:",
					transactionError
				);
				return res.status(500).json({
					message: "Error during disbursement transaction",
					error: transactionError.message,
				});
			}
		} catch (error) {
			console.error("Error disbursing loan:", error);
			return res.status(500).json({
				message: "Internal server error",
				error: error.message || "Unknown error",
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/ensure-wallets:
 *   post:
 *     summary: Create wallets for all users if they don't exist (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallets created or verified for all users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.post(
	"/ensure-wallets",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			console.log("Creating wallets for all users if they don't exist");

			// Get all users
			const users = await prisma.user.findMany({
				select: {
					id: true,
					fullName: true,
					wallet: {
						select: {
							id: true,
						},
					},
				},
			});

			console.log(`Found ${users.length} users`);

			const results = {
				existing: 0,
				created: 0,
				failed: 0,
				details: [] as any[],
			};

			// Create wallets for users who don't have one
			for (const user of users) {
				try {
					if (user.wallet) {
						console.log(
							`User ${user.id} already has wallet ${user.wallet.id}`
						);
						results.existing++;
						results.details.push({
							userId: user.id,
							status: "existing",
							walletId: user.wallet.id,
						});
					} else {
						console.log(
							`Creating wallet for user ${user.id} (${
								user.fullName || "Unknown"
							})`
						);
						const wallet = await prisma.wallet.create({
							data: {
								userId: user.id,
								balance: 0,
								availableForWithdrawal: 0,
								totalDeposits: 0,
								totalWithdrawals: 0,
							},
						});
						console.log(
							`Created wallet ${wallet.id} for user ${user.id}`
						);
						results.created++;
						results.details.push({
							userId: user.id,
							status: "created",
							walletId: wallet.id,
						});
					}
				} catch (error) {
					console.error(
						`Error creating wallet for user ${user.id}:`,
						error
					);
					results.failed++;
					results.details.push({
						userId: user.id,
						status: "failed",
						error: error.message,
					});
				}
			}

			return res.status(200).json({
				message: `Wallets verified for all users: ${results.existing} existing, ${results.created} created, ${results.failed} failed`,
				data: results,
			});
		} catch (error) {
			console.error("Error ensuring wallets:", error);
			return res.status(500).json({
				message: "Internal server error",
				error: error.message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/{id}/history:
 *   get:
 *     summary: Get loan application status history (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan application ID
 *     responses:
 *       200:
 *         description: Application history timeline
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
// Get application history timeline (admin only)
router.get(
	"/applications/:id/history",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			console.log(`Fetching history for application: ${id}`);

			// First check if the application exists
			const application = await prisma.loanApplication.findUnique({
				where: { id },
				select: {
					id: true,
					status: true,
					createdAt: true,
					updatedAt: true,
				},
			});

			if (!application) {
				return res
					.status(404)
					.json({ message: "Application not found" });
			}

			// Get the application history
			const history = await prisma.loanApplicationHistory.findMany({
				where: { applicationId: id },
				orderBy: { createdAt: "desc" },
			});

			// Include the creation event as the first history entry
			const timeline = [
				...history,
				{
					id: "initial",
					applicationId: id,
					previousStatus: null,
					newStatus: "INCOMPLETE", // Initial status
					changedBy: "SYSTEM",
					changeReason: "Application created",
					notes: null,
					metadata: null,
					createdAt: application.createdAt,
				},
			];

			// Sort by created date, oldest first
			timeline.sort(
				(a, b) =>
					new Date(a.createdAt).getTime() -
					new Date(b.createdAt).getTime()
			);

			return res.status(200).json({
				applicationId: id,
				currentStatus: application.status,
				timeline,
			});
		} catch (error) {
			console.error(`Error fetching application history: ${error}`);
			return res.status(500).json({
				message: "Error fetching application history",
				error: error.message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/notifications:
 *   get:
 *     summary: Get all notifications (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [SYSTEM, MARKETING]
 *         description: Filter by notification type
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH]
 *         description: Filter by priority
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *     responses:
 *       200:
 *         description: List of all notifications
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.get(
	"/notifications",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 50;
			const type = req.query.type as string;
			const priority = req.query.priority as string;
			const isRead = req.query.isRead as string;

			// Build where clause for filtering
			const where: any = {};

			if (type && ["SYSTEM", "MARKETING"].includes(type)) {
				where.type = type;
			}

			if (priority && ["LOW", "MEDIUM", "HIGH"].includes(priority)) {
				where.priority = priority;
			}

			if (isRead !== undefined) {
				where.isRead = isRead === "true";
			}

			// Get notifications with user information
			const [notifications, total] = await Promise.all([
				prisma.notification.findMany({
					where,
					include: {
						user: {
							select: {
								id: true,
								fullName: true,
								email: true,
								phoneNumber: true,
							},
						},
					},
					orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
					skip: (page - 1) * limit,
					take: limit,
				}),
				prisma.notification.count({ where }),
			]);

			return res.json({
				notifications,
				pagination: {
					total,
					page,
					limit,
					totalPages: Math.ceil(total / limit),
				},
			});
		} catch (error) {
			console.error("Error fetching admin notifications:", error);
			return res.status(500).json({
				message: "Failed to fetch notifications",
				error: error.message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/notification-templates:
 *   get:
 *     summary: Get all notification templates (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notification templates
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create notification template (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - title
 *               - message
 *               - type
 *             properties:
 *               code:
 *                 type: string
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [SYSTEM, MARKETING]
 *     responses:
 *       201:
 *         description: Template created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.get(
	"/notification-templates",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			const templates = await prisma.notificationTemplate.findMany({
				orderBy: { createdAt: "desc" },
			});
			return res.json(templates);
		} catch (error) {
			console.error("Error fetching notification templates:", error);
			return res.status(500).json({
				message: "Failed to fetch notification templates",
				error: error.message,
			});
		}
	}
);

router.post(
	"/notification-templates",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { code, title, message, type } = req.body;

			const template = await prisma.notificationTemplate.create({
				data: { code, title, message, type },
			});

			return res.status(201).json(template);
		} catch (error) {
			console.error("Error creating notification template:", error);
			return res.status(500).json({
				message: "Failed to create notification template",
				error: error.message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/notification-templates/{id}:
 *   put:
 *     summary: Update notification template (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [SYSTEM, MARKETING]
 *     responses:
 *       200:
 *         description: Template updated successfully
 *       404:
 *         description: Template not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete notification template (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template deleted successfully
 *       404:
 *         description: Template not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.put(
	"/notification-templates/:id",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { code, title, message, type } = req.body;

			const template = await prisma.notificationTemplate.update({
				where: { id },
				data: { code, title, message, type },
			});

			return res.json(template);
		} catch (error) {
			console.error("Error updating notification template:", error);
			if (error.code === "P2025") {
				return res.status(404).json({ message: "Template not found" });
			}
			return res.status(500).json({
				message: "Failed to update notification template",
				error: error.message,
			});
		}
	}
);

router.delete(
	"/notification-templates/:id",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;

			await prisma.notificationTemplate.delete({
				where: { id },
			});

			return res.json({ message: "Template deleted successfully" });
		} catch (error) {
			console.error("Error deleting notification template:", error);
			if (error.code === "P2025") {
				return res.status(404).json({ message: "Template not found" });
			}
			return res.status(500).json({
				message: "Failed to delete notification template",
				error: error.message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/notification-groups:
 *   get:
 *     summary: Get all notification groups (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notification groups
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create notification group (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - filters
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               filters:
 *                 type: object
 *     responses:
 *       201:
 *         description: Group created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.get(
	"/notification-groups",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			const groups = await prisma.notificationGroup.findMany({
				orderBy: { createdAt: "desc" },
			});
			return res.json(groups);
		} catch (error) {
			console.error("Error fetching notification groups:", error);
			return res.status(500).json({
				message: "Failed to fetch notification groups",
				error: error.message,
			});
		}
	}
);

router.post(
	"/notification-groups",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { name, description, filters } = req.body;

			const group = await prisma.notificationGroup.create({
				data: { name, description, filters },
			});

			return res.status(201).json(group);
		} catch (error) {
			console.error("Error creating notification group:", error);
			return res.status(500).json({
				message: "Failed to create notification group",
				error: error.message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/notification-groups/{id}:
 *   put:
 *     summary: Update notification group (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               filters:
 *                 type: object
 *     responses:
 *       200:
 *         description: Group updated successfully
 *       404:
 *         description: Group not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete notification group (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Group deleted successfully
 *       404:
 *         description: Group not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.put(
	"/notification-groups/:id",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { name, description, filters } = req.body;

			const group = await prisma.notificationGroup.update({
				where: { id },
				data: { name, description, filters },
			});

			return res.json(group);
		} catch (error) {
			console.error("Error updating notification group:", error);
			if (error.code === "P2025") {
				return res.status(404).json({ message: "Group not found" });
			}
			return res.status(500).json({
				message: "Failed to update notification group",
				error: error.message,
			});
		}
	}
);

router.delete(
	"/notification-groups/:id",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;

			await prisma.notificationGroup.delete({
				where: { id },
			});

			return res.json({ message: "Group deleted successfully" });
		} catch (error) {
			console.error("Error deleting notification group:", error);
			if (error.code === "P2025") {
				return res.status(404).json({ message: "Group not found" });
			}
			return res.status(500).json({
				message: "Failed to delete notification group",
				error: error.message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/send-notification:
 *   post:
 *     summary: Send notification to users (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - message
 *               - type
 *               - priority
 *               - recipientType
 *             properties:
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [SYSTEM, MARKETING]
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *               link:
 *                 type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *               recipientType:
 *                 type: string
 *                 enum: [all, specific, group]
 *               selectedUsers:
 *                 type: array
 *                 items:
 *                   type: string
 *               selectedGroup:
 *                 type: string
 *               templateId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.post(
	"/send-notification",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const {
				title,
				message,
				type,
				priority,
				link,
				expiresAt,
				recipientType,
				selectedUsers,
				selectedGroup,
				templateId,
			} = req.body;

			let targetUsers: string[] = [];

			// Determine target users based on recipient type
			if (recipientType === "all") {
				const users = await prisma.user.findMany({
					select: { id: true },
				});
				targetUsers = users.map((user) => user.id);
			} else if (
				recipientType === "specific" &&
				selectedUsers?.length > 0
			) {
				targetUsers = selectedUsers;
			} else if (recipientType === "group" && selectedGroup) {
				const group = await prisma.notificationGroup.findUnique({
					where: { id: selectedGroup },
				});
				if (group) {
					const users = await prisma.user.findMany({
						where: group.filters as any,
						select: { id: true },
					});
					targetUsers = users.map((user) => user.id);
				}
			}

			if (targetUsers.length === 0) {
				return res.status(400).json({
					message: "No target users found for the specified criteria",
				});
			}

			// Create notifications for all target users
			const notifications = targetUsers.map((userId) => ({
				userId,
				templateId: templateId || null,
				type,
				title,
				message,
				priority,
				link: link || null,
				expiresAt: expiresAt ? new Date(expiresAt) : null,
			}));

			await prisma.notification.createMany({
				data: notifications,
			});

			return res.json({
				message: "Notification sent successfully",
				recipientCount: targetUsers.length,
			});
		} catch (error) {
			console.error("Error sending notification:", error);
			return res.status(500).json({
				message: "Failed to send notification",
				error: error.message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of users to return
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.get(
	"/users",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const limit = parseInt(req.query.limit as string) || 100;

			const users = await prisma.user.findMany({
				select: {
					id: true,
					fullName: true,
					email: true,
					phoneNumber: true,
				},
				take: limit,
				orderBy: { createdAt: "desc" },
			});

			return res.json(users);
		} catch (error) {
			console.error("Error fetching users:", error);
			return res.status(500).json({
				message: "Failed to fetch users",
				error: error.message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/disbursements:
 *   get:
 *     summary: Get all loan disbursements (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of disbursements to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of disbursements to skip
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by disbursement status
 *     responses:
 *       200:
 *         description: List of disbursements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       applicationId:
 *                         type: string
 *                       referenceNumber:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       bankName:
 *                         type: string
 *                       bankAccountNumber:
 *                         type: string
 *                       disbursedAt:
 *                         type: string
 *                         format: date-time
 *                       disbursedBy:
 *                         type: string
 *                       notes:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       application:
 *                         type: object
 *                 total:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.get(
	"/disbursements",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const limit = parseInt(req.query.limit as string) || 50;
			const offset = parseInt(req.query.offset as string) || 0;
			const status = req.query.status as string;

			// Build where clause
			const where: any = {};
			if (status) {
				where.status = status;
			}

			// Get total count
			const total = await prisma.loanDisbursement.count({ where });

			// Get disbursements with related data
			const disbursements = await prisma.loanDisbursement.findMany({
				where,
				include: {
					application: {
						include: {
							user: {
								select: {
									id: true,
									fullName: true,
									email: true,
									phoneNumber: true,
								},
							},
							product: {
								select: {
									id: true,
									name: true,
									code: true,
								},
							},
							loan: {
								select: {
									id: true,
									status: true,
								},
							},
						},
					},
				},
				orderBy: { disbursedAt: "desc" },
				take: limit,
				skip: offset,
			});

			return res.json({
				success: true,
				data: disbursements,
				total,
				limit,
				offset,
			});
		} catch (error) {
			console.error("Error fetching disbursements:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to fetch disbursements",
				error: error.message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/loans/{id}/repayments:
 *   get:
 *     summary: Get loan repayment schedule and history (admin only)
 *     tags: [Admin]
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
 *         description: Loan repayment data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.get(
	"/loans/:id/repayments",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;

			// Get loan with repayments
			const loan = await prisma.loan.findUnique({
				where: { id },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							phoneNumber: true,
						},
					},
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
					},
				},
			});

			if (!loan) {
				return res.status(404).json({
					success: false,
					message: "Loan not found",
				});
			}

			// Generate payment schedule if no repayments exist
			if (loan.repayments.length === 0 && loan.status === "ACTIVE") {
				await generatePaymentSchedule(loan.id);

				// Refetch loan with generated repayments
				const updatedLoan = await prisma.loan.findUnique({
					where: { id },
					include: {
						user: {
							select: {
								id: true,
								fullName: true,
								email: true,
								phoneNumber: true,
							},
						},
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
						},
					},
				});

				return res.json({
					success: true,
					data: updatedLoan,
				});
			}

			// Apply prepayment adjustments to the schedule
			const adjustedLoan = await applyPrepaymentAdjustments(loan);

			// Debug logging
			console.log(`Admin API - Loan ${loan.id} repayments response:`);
			console.log(`  • Original repayments: ${loan.repayments.length}`);
			console.log(
				`  • Adjusted repayments: ${adjustedLoan.repayments.length}`
			);
			console.log(`  • Total paid: ${adjustedLoan.totalPaid || 0}`);

			if (adjustedLoan.repayments.length > 0) {
				console.log(
					`  • First payment: ${adjustedLoan.repayments[0].dueDate}`
				);
				console.log(
					`  • Last payment: ${
						adjustedLoan.repayments[
							adjustedLoan.repayments.length - 1
						].dueDate
					}`
				);
			}

			return res.json({
				success: true,
				data: adjustedLoan,
			});
		} catch (error) {
			console.error("Error fetching loan repayments:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to fetch loan repayments",
				error: error.message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/repayments/pending:
 *   get:
 *     summary: Get pending repayment requests (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending repayment requests
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.get(
	"/repayments/pending",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			// Get pending wallet transactions for loan repayments
			const pendingRepayments = await prisma.walletTransaction.findMany({
				where: {
					type: "LOAN_REPAYMENT",
					status: "PENDING",
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							phoneNumber: true,
						},
					},
					loan: {
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
						},
					},
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			return res.json({
				success: true,
				data: pendingRepayments,
			});
		} catch (error) {
			console.error("Error fetching pending repayments:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to fetch pending repayments",
				error: error.message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/repayments/{id}/approve:
 *   post:
 *     summary: Approve a pending repayment (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Admin notes for the approval
 *     responses:
 *       200:
 *         description: Repayment approved successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Server error
 */
router.post(
	"/repayments/:id/approve",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { notes } = req.body;
			const adminUserId = req.user?.userId;

			// Get the pending transaction
			const transaction = await prisma.walletTransaction.findUnique({
				where: { id },
				include: {
					loan: true,
					user: true,
				},
			});

			if (!transaction) {
				return res.status(404).json({
					success: false,
					message: "Transaction not found",
				});
			}

			if (transaction.status !== "PENDING") {
				return res.status(400).json({
					success: false,
					message: "Transaction is not pending approval",
				});
			}

			if (transaction.type !== "LOAN_REPAYMENT") {
				return res.status(400).json({
					success: false,
					message: "Transaction is not a loan repayment",
				});
			}

			// Process the repayment in a transaction
			const result = await prisma.$transaction(async (tx) => {
				// Get the actual payment amount (stored as positive in metadata) and round to 2 decimal places
				const paymentAmount =
					Math.round(
						((transaction.metadata as any)?.originalAmount ||
							Math.abs(transaction.amount)) * 100
					) / 100;

				// Update transaction status
				const updatedTransaction = await tx.walletTransaction.update({
					where: { id },
					data: {
						status: "APPROVED",
						processedAt: new Date(),
						metadata: {
							...((transaction.metadata as object) || {}),
							approvedBy: adminUserId,
							approvedAt: new Date().toISOString(),
							adminNotes: notes || "",
						},
					},
				});

				// Update loan balance and payment schedule
				const loan = transaction.loan;
				if (loan) {
					// Update the payment schedule to mark repayments as completed
					// This function already updates the loan record with correct values
					const scheduleUpdate =
						await updatePaymentScheduleAfterPayment(
							loan.id,
							paymentAmount,
							tx
						);

					console.log(`Payment approved for loan ${loan.id}:`);
					console.log(`  • Payment amount: ${paymentAmount}`);
					console.log(
						`  • Principal paid: ${
							scheduleUpdate?.totalPrincipalPaid || 0
						}`
					);
					console.log(
						`  • New outstanding: ${
							scheduleUpdate?.newOutstandingBalance || 0
						}`
					);
					console.log(
						`  • Next payment due: ${
							scheduleUpdate?.nextPaymentDue || "None"
						}`
					);

					// Create notification for user
					await tx.notification.create({
						data: {
							userId: transaction.userId,
							title: "Payment Approved",
							message: `Your loan repayment of KES ${paymentAmount.toFixed(
								0
							)} has been approved and processed successfully.`,
							type: "SYSTEM",
							priority: "MEDIUM",
							metadata: {
								transactionId: id,
								loanId: loan.id,
								amount: paymentAmount,
								newOutstandingBalance:
									scheduleUpdate?.newOutstandingBalance || 0,
								processedBy: adminUserId,
								adminNotes: notes || "",
							},
						},
					});

					return { updatedTransaction, scheduleUpdate };
				}

				return { updatedTransaction, scheduleUpdate: null };
			});

			return res.json({
				success: true,
				message: "Repayment approved successfully",
				data: result,
			});
		} catch (error) {
			console.error("Error approving repayment:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to approve repayment",
				error: error.message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/repayments/{id}/reject:
 *   post:
 *     summary: Reject a pending repayment (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejection
 *               notes:
 *                 type: string
 *                 description: Additional admin notes
 *     responses:
 *       200:
 *         description: Repayment rejected successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Server error
 */
router.post(
	"/repayments/:id/reject",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { reason, notes } = req.body;
			const adminUserId = req.user?.userId;

			if (!reason) {
				return res.status(400).json({
					success: false,
					message: "Rejection reason is required",
				});
			}

			// Get the pending transaction
			const transaction = await prisma.walletTransaction.findUnique({
				where: { id },
				include: {
					user: true,
				},
			});

			if (!transaction) {
				return res.status(404).json({
					success: false,
					message: "Transaction not found",
				});
			}

			if (transaction.status !== "PENDING") {
				return res.status(400).json({
					success: false,
					message: "Transaction is not pending approval",
				});
			}

			// Reject the transaction
			const result = await prisma.$transaction(async (tx) => {
				// Get the actual payment amount (stored as positive in metadata) and round to 2 decimal places
				const paymentAmount =
					Math.round(
						((transaction.metadata as any)?.originalAmount ||
							Math.abs(transaction.amount)) * 100
					) / 100;

				// Update transaction status
				const updatedTransaction = await tx.walletTransaction.update({
					where: { id },
					data: {
						status: "REJECTED",
						processedAt: new Date(),
						metadata: {
							...((transaction.metadata as object) || {}),
							rejectedBy: adminUserId,
							rejectedAt: new Date().toISOString(),
							rejectionReason: reason,
							adminNotes: notes || "",
						},
					},
				});

				// Create notification for user
				await tx.notification.create({
					data: {
						userId: transaction.userId,
						title: "Payment Rejected",
						message: `Your loan repayment of KES ${paymentAmount.toFixed(
							0
						)} has been rejected. Reason: ${reason}`,
						type: "SYSTEM",
						priority: "HIGH",
						metadata: {
							transactionId: id,
							rejectionReason: reason,
							adminNotes: notes || "",
							rejectedBy: adminUserId,
							amount: paymentAmount,
						},
					},
				});

				return { updatedTransaction };
			});

			return res.json({
				success: true,
				message: "Repayment rejected successfully",
				data: result,
			});
		} catch (error) {
			console.error("Error rejecting repayment:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to reject repayment",
				error: error.message,
			});
		}
	}
);

// Enhanced helper functions for robust payment schedule tracking

// Transaction-aware version for use during loan disbursement
async function generatePaymentScheduleInTransaction(loanId: string, tx: any) {
	const loan = await tx.loan.findUnique({
		where: { id: loanId },
	});

	if (!loan || !loan.disbursedAt) {
		throw new Error("Loan not found or not disbursed");
	}

	// Clear any existing schedule first
	await tx.loanRepayment.deleteMany({
		where: { loanId: loan.id },
	});

	const repayments = [];

	// Flat rate calculation: (Principal + Total Interest) / Term
	const monthlyInterestRate = loan.interestRate / 100;
	const totalInterest =
		Math.round(
			loan.principalAmount * monthlyInterestRate * loan.term * 100
		) / 100;
	const monthlyPayment =
		Math.round(((loan.principalAmount + totalInterest) / loan.term) * 100) /
		100;

	// Calculate interest and principal portions for flat rate
	const monthlyInterestAmount =
		Math.round((totalInterest / loan.term) * 100) / 100;
	const monthlyPrincipalAmount =
		Math.round((loan.principalAmount / loan.term) * 100) / 100;

	console.log(`Generating payment schedule for loan ${loanId}:`);
	console.log(
		`Principal: ${loan.principalAmount}, Interest Rate: ${loan.interestRate}%, Term: ${loan.term} months`
	);
	console.log(
		`Total Interest: ${totalInterest}, Monthly Payment: ${monthlyPayment}`
	);

	for (let month = 1; month <= loan.term; month++) {
		// Set due date to end of day exactly 1 month from disbursement
		// Use UTC date manipulation to avoid timezone issues
		const disbursementDate = new Date(loan.disbursedAt);

		// Create due date by adding months using UTC methods
		// Set to 15:59:59 UTC so it becomes 23:59:59 Malaysia time (GMT+8)
		const dueDate = new Date(
			Date.UTC(
				disbursementDate.getUTCFullYear(),
				disbursementDate.getUTCMonth() + month,
				disbursementDate.getUTCDate(),
				15,
				59,
				59,
				999
			)
		);

		repayments.push({
			loanId: loan.id,
			amount: monthlyPayment,
			principalAmount: monthlyPrincipalAmount,
			interestAmount: monthlyInterestAmount,
			status: "PENDING",
			dueDate: dueDate,
			installmentNumber: month,
			scheduledAmount: monthlyPayment,
		});
	}

	// Create all repayment records
	await tx.loanRepayment.createMany({
		data: repayments,
	});

	// Update loan with next payment due date and correct monthly payment
	if (repayments.length > 0) {
		await tx.loan.update({
			where: { id: loanId },
			data: {
				monthlyPayment: monthlyPayment,
				nextPaymentDue: repayments[0].dueDate,
			},
		});
	}

	console.log(`Created ${repayments.length} payment records`);
	return repayments;
}

async function generatePaymentSchedule(loanId: string) {
	const loan = await prisma.loan.findUnique({
		where: { id: loanId },
	});

	if (!loan || !loan.disbursedAt) {
		throw new Error("Loan not found or not disbursed");
	}

	// Clear any existing schedule first
	await prisma.loanRepayment.deleteMany({
		where: { loanId: loan.id },
	});

	const repayments = [];

	// Flat rate calculation: (Principal + Total Interest) / Term
	// Total Interest = Principal * Monthly Interest Rate * Term
	const monthlyInterestRate = loan.interestRate / 100; // Monthly interest rate (e.g., 1.5% = 0.015)
	const totalInterest =
		Math.round(
			loan.principalAmount * monthlyInterestRate * loan.term * 100
		) / 100;
	const monthlyPayment =
		Math.round(((loan.principalAmount + totalInterest) / loan.term) * 100) /
		100;

	// Calculate interest and principal portions for flat rate
	const monthlyInterestAmount =
		Math.round((totalInterest / loan.term) * 100) / 100;
	const monthlyPrincipalAmount =
		Math.round((loan.principalAmount / loan.term) * 100) / 100;

	console.log(`Generating payment schedule for loan ${loanId}:`);
	console.log(
		`Principal: ${loan.principalAmount}, Interest Rate: ${loan.interestRate}%, Term: ${loan.term} months`
	);
	console.log(
		`Total Interest: ${totalInterest}, Monthly Payment: ${monthlyPayment}`
	);

	for (let month = 1; month <= loan.term; month++) {
		// Set due date to end of day exactly 1 month from disbursement
		// Use UTC date manipulation to avoid timezone issues
		const disbursementDate = new Date(loan.disbursedAt);

		// Create due date by adding months using UTC methods
		// Set to 15:59:59 UTC so it becomes 23:59:59 Malaysia time (GMT+8)
		const dueDate = new Date(
			Date.UTC(
				disbursementDate.getUTCFullYear(),
				disbursementDate.getUTCMonth() + month,
				disbursementDate.getUTCDate(),
				15,
				59,
				59,
				999
			)
		);

		repayments.push({
			loanId: loan.id,
			amount: monthlyPayment,
			principalAmount: monthlyPrincipalAmount,
			interestAmount: monthlyInterestAmount,
			status: "PENDING",
			dueDate: dueDate,
			installmentNumber: month,
			scheduledAmount: monthlyPayment,
		});
	}

	// Create all repayment records
	await prisma.loanRepayment.createMany({
		data: repayments,
	});

	// Update loan with next payment due date and correct monthly payment
	if (repayments.length > 0) {
		await prisma.loan.update({
			where: { id: loanId },
			data: {
				monthlyPayment: monthlyPayment, // Update with correct flat rate calculation
				nextPaymentDue: repayments[0].dueDate,
			},
		});
	}

	console.log(`Created ${repayments.length} payment records`);
	return repayments;
}

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

	// Apply payments to repayments chronologically to determine status
	let remainingPayments = totalPaymentsMade;
	const mostRecentPayment = actualPayments[actualPayments.length - 1];
	const mostRecentPaymentDate =
		mostRecentPayment?.processedAt || mostRecentPayment?.createdAt;

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
		} else if (remainingPayments >= repayment.amount) {
			// Fully covered by payments
			const dueDate = new Date(repayment.dueDate);
			const paidDate = new Date(mostRecentPaymentDate || new Date());
			const daysDiff = Math.ceil(
				(paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
			);

			const daysEarly = daysDiff < 0 ? Math.abs(daysDiff) : 0;
			const daysLate = daysDiff > 0 ? daysDiff : 0;

			// Check if repayment status is changing from non-COMPLETED to COMPLETED
			const wasCompleted = repayment.status === "COMPLETED";

			// Handle late fees first to determine total amount paid
			let totalAmountPaidForThisRepayment = repayment.amount;
			let lateFeesPaid = 0;

			if (!wasCompleted) {
				// New completion - handle late fees and calculate total amount
				try {
					const lateFeeResult =
						await LateFeeProcessor.handleRepaymentCleared(
							repayment.id,
							remainingPayments, // Amount available for this repayment
							paidDate,
							tx
						);

					lateFeesPaid = lateFeeResult.lateFeesPaid;
					totalAmountPaidForThisRepayment =
						repayment.amount + lateFeesPaid;

					console.log(
						`💰 Late fee handling for repayment ${repayment.id}:`,
						{
							lateFeesPaid: lateFeeResult.lateFeesPaid,
							lateFeesWaived: lateFeeResult.lateFeesWaived,
							totalLateFees: lateFeeResult.totalLateFees,
							totalAmountPaidForThisRepayment,
						}
					);
				} catch (error) {
					console.error(
						`Error handling late fees for repayment ${repayment.id}:`,
						error
					);
					// Don't fail the payment processing due to late fee errors
				}

				await tx.loanRepayment.update({
					where: { id: repayment.id },
					data: {
						status: "COMPLETED",
						actualAmount: totalAmountPaidForThisRepayment, // Total amount including late fees
						paidAt: mostRecentPaymentDate,
						paymentType:
							daysEarly > 0
								? "EARLY"
								: daysLate > 0
								? "LATE"
								: "ON_TIME",
						daysEarly: daysEarly,
						daysLate: daysLate,
					},
				});

				console.log(`✅ Marked repayment ${repayment.id} as COMPLETED`);
			} else {
				// Already completed - preserve existing actualAmount (which includes late fees)
				totalAmountPaidForThisRepayment =
					repayment.actualAmount || repayment.amount;
				console.log(
					`✅ Repayment ${repayment.id} already COMPLETED with actualAmount: ${totalAmountPaidForThisRepayment}`
				);
			}

			remainingPayments -= totalAmountPaidForThisRepayment;
		} else {
			// Partially covered
			const dueDate = new Date(repayment.dueDate);
			const paidDate = new Date(mostRecentPaymentDate || new Date());
			const daysDiff = Math.ceil(
				(paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
			);

			const daysEarly = daysDiff < 0 ? Math.abs(daysDiff) : 0;
			const daysLate = daysDiff > 0 ? daysDiff : 0;

			await tx.loanRepayment.update({
				where: { id: repayment.id },
				data: {
					status: "PENDING", // Still pending since not fully paid
					actualAmount: remainingPayments, // Amount actually paid towards this repayment
					paidAt: mostRecentPaymentDate,
					paymentType: "PARTIAL",
					daysEarly: daysEarly,
					daysLate: daysLate,
				},
			});

			console.log(
				`💰 Marked repayment ${repayment.id} as PARTIAL: ${remainingPayments} of ${repayment.amount}`
			);
			remainingPayments = 0; // All remaining payments applied to this repayment
		}
	}
}

async function updatePaymentScheduleAfterPayment(
	loanId: string,
	paymentAmount: number,
	tx: any
) {
	console.log(
		`Updating payment schedule for loan ${loanId}, payment amount: ${paymentAmount}`
	);

	// Update repayment status based on all transactions (preserves individual payment history)
	await updateRepaymentStatusFromTransactions(loanId, tx);

	// Calculate outstanding balance based on actual transaction data
	const newOutstandingBalance = await calculateOutstandingBalance(loanId, tx);

	// Update next payment due date
	const nextPaymentDue = await calculateNextPaymentDue(loanId, tx);

	// Update next payment due (status is already handled in calculateOutstandingBalance)
	await tx.loan.update({
		where: { id: loanId },
		data: {
			nextPaymentDue: nextPaymentDue,
		},
	});

	console.log(
		`Updated loan ${loanId}: outstanding ${newOutstandingBalance}, nextPaymentDue ${nextPaymentDue}`
	);

	return {
		totalPrincipalPaid: paymentAmount, // Just this payment amount
		newOutstandingBalance,
		nextPaymentDue: nextPaymentDue,
	};
}

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
		// Get late fees for this repayment
		const lateFees = await tx.$queryRawUnsafe(
			`
			SELECT COALESCE(SUM("feeAmount"), 0) as total_late_fees
			FROM late_fees 
			WHERE "loanRepaymentId" = $1 AND status = 'ACTIVE'
		`,
			repayment.id
		);
		const totalLateFees = Number(lateFees[0]?.total_late_fees || 0);
		const totalAmountDue = repayment.amount + totalLateFees;

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

async function calculateOutstandingBalance(loanId: string, tx: any) {
	// Get the loan to get the total amount and current status
	const loan = await tx.loan.findUnique({
		where: { id: loanId },
	});

	if (!loan) {
		throw new Error(`Loan ${loanId} not found`);
	}

	// Get all APPROVED wallet transactions for this loan (actual payments made)
	const actualPayments = await tx.walletTransaction.findMany({
		where: {
			loanId: loanId,
			type: "LOAN_REPAYMENT",
			status: "APPROVED",
		},
	});

	// Get total unpaid late fees for this loan
	const unpaidLateFees = await tx.$queryRawUnsafe(
		`
		SELECT COALESCE(SUM(lf."feeAmount"), 0) as total_unpaid_late_fees
		FROM late_fees lf
		JOIN loan_repayments lr ON lf."loanRepaymentId" = lr.id
		WHERE lr."loanId" = $1 AND lf.status = 'ACTIVE'
	`,
		loanId
	);
	const totalUnpaidLateFees = Number(
		unpaidLateFees[0]?.total_unpaid_late_fees || 0
	);

	console.log(`Calculating outstanding balance for loan ${loanId}:`);
	console.log(`Original loan amount: ${loan.totalAmount}`);
	console.log(`Unpaid late fees: ${totalUnpaidLateFees}`);

	// Calculate total actual payments made (sum of all approved payment transactions)
	const totalPaymentsMade = actualPayments.reduce(
		(total: number, payment: any) => {
			// Payment amounts are stored as negative, so we take absolute value
			const paymentAmount = Math.abs(payment.amount);
			console.log(`Payment transaction ${payment.id}: ${paymentAmount}`);
			return total + paymentAmount;
		},
		0
	);

	console.log(`Total payments made: ${totalPaymentsMade}`);

	// Outstanding balance = Original loan amount + Unpaid late fees - Total actual payments made
	const totalAmountOwed = loan.totalAmount + totalUnpaidLateFees;
	const outstandingBalance =
		Math.round((totalAmountOwed - totalPaymentsMade) * 100) / 100;
	const finalOutstandingBalance = Math.max(0, outstandingBalance);

	console.log(`Outstanding balance: ${finalOutstandingBalance}`);

	// Check if loan should be marked as PENDING_DISCHARGE
	if (loan.status === "ACTIVE" && finalOutstandingBalance === 0) {
		console.log(
			`🎯 Loan ${loanId} fully paid - updating status to PENDING_DISCHARGE`
		);
		await tx.loan.update({
			where: { id: loanId },
			data: {
				status: "PENDING_DISCHARGE",
				outstandingBalance: finalOutstandingBalance,
			},
		});
	} else {
		// Just update the outstanding balance
		await tx.loan.update({
			where: { id: loanId },
			data: { outstandingBalance: finalOutstandingBalance },
		});
	}

	return finalOutstandingBalance;
}

async function syncLoanBalances() {
	// Function to recalculate and sync all loan outstanding balances
	const loans = await prisma.loan.findMany({
		where: {
			status: {
				in: ["ACTIVE", "OVERDUE"],
			},
		},
	});

	console.log(`Syncing balances for ${loans.length} loans...`);

	for (const loan of loans) {
		await prisma.$transaction(async (tx) => {
			// Sync repayment schedule with actual payments first
			await syncRepaymentScheduleWithActualPayments(loan.id, tx);

			// calculateOutstandingBalance now handles status changes automatically
			const correctOutstandingBalance = await calculateOutstandingBalance(
				loan.id,
				tx
			);
			const correctNextPaymentDue = await calculateNextPaymentDue(
				loan.id,
				tx
			);

			// Update next payment due (status is already handled in calculateOutstandingBalance)
			await tx.loan.update({
				where: { id: loan.id },
				data: {
					nextPaymentDue: correctNextPaymentDue,
				},
			});

			console.log(
				`Updated loan ${loan.id}: outstanding ${correctOutstandingBalance}, nextPaymentDue ${correctNextPaymentDue}`
			);
		});
	}

	console.log("Loan balance sync completed");
}

/**
 * @swagger
 * /api/admin/loans/sync-balances:
 *   post:
 *     summary: Sync all loan balances with actual payment transactions (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loan balances synced successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.post(
	"/loans/sync-balances",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			await syncLoanBalances();

			return res.json({
				success: true,
				message: "Loan balances synced successfully",
			});
		} catch (error) {
			console.error("Error syncing loan balances:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to sync loan balances",
				error: error.message,
			});
		}
	}
);

// Function to apply prepayment adjustments to the payment schedule
async function applyPrepaymentAdjustments(loan: any) {
	// Get all payments made for this loan from wallet_transactions
	const payments = await prisma.walletTransaction.findMany({
		where: {
			loanId: loan.id,
			type: "LOAN_REPAYMENT",
			status: "APPROVED",
		},
		orderBy: {
			createdAt: "asc",
		},
	});

	// Calculate total amount paid (use absolute value since wallet transactions are negative for debits)
	const totalPaid = payments.reduce(
		(sum, payment) => sum + Math.abs(payment.amount),
		0
	);

	console.log(`Applying prepayment adjustments for loan ${loan.id}:`);
	console.log(`Total paid: ${totalPaid}`);
	console.log(`Original repayments count: ${loan.repayments.length}`);
	console.log(`Wallet payments found: ${payments.length}`);

	// Debug: Log payment details
	payments.forEach((payment, idx) => {
		console.log(
			`Payment ${idx + 1}: ${Math.abs(payment.amount)} on ${
				payment.createdAt
			} (${payment.reference})`
		);
	});

	// Debug: Log repayment details
	loan.repayments.forEach((repayment: any, idx: number) => {
		console.log(
			`Repayment ${idx + 1}: ${repayment.amount} due ${
				repayment.dueDate
			} status ${repayment.status}`
		);
	});

	// Enhanced repayments with payment dates from wallet transactions
	// Sort payments chronologically to process them in order
	const sortedPayments = payments.sort(
		(a, b) =>
			new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
	);

	// Sort repayments by due date to match payments chronologically
	const sortedRepayments = [...loan.repayments].sort(
		(a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
	);

	console.log(
		`Processing ${sortedPayments.length} payments for ${sortedRepayments.length} repayments`
	);

	// NEW ALGORITHM: Allocate payments chronologically across repayments
	// This properly handles cases where one payment covers multiple repayments
	let remainingPaymentAmount = totalPaid;
	let currentPaymentIndex = 0;

	const enhancedRepayments = sortedRepayments.map((repayment: any) => {
		console.log(
			`Processing repayment ${repayment.id} (${repayment.amount}, status: ${repayment.status})`
		);

		// Only assign payment information to COMPLETED repayments
		if (repayment.status !== "COMPLETED") {
			console.log(
				`Skipping payment allocation for ${repayment.status} repayment`
			);
			return {
				...repayment,
				actualPaymentDate: repayment.paidAt,
				contributingPayments: [],
				totalContributingAmount: 0,
			};
		}

		const contributingPayments = [];
		let repaymentAmountNeeded = repayment.amount;
		let totalContributingAmount = 0;

		console.log(`Remaining payment amount: ${remainingPaymentAmount}`);

		// If there's no remaining payment amount, this repayment hasn't been paid
		if (remainingPaymentAmount <= 0) {
			return {
				...repayment,
				actualPaymentDate: repayment.paidAt,
				contributingPayments: [],
				totalContributingAmount: 0,
			};
		}

		// Allocate payments to this COMPLETED repayment until it's fully covered or we run out of payments
		while (
			repaymentAmountNeeded > 0 &&
			remainingPaymentAmount > 0 &&
			currentPaymentIndex < sortedPayments.length
		) {
			const currentPayment = sortedPayments[currentPaymentIndex];
			const paymentAmount = Math.abs(currentPayment.amount);

			console.log(`Using payment ${currentPayment.id}: ${paymentAmount}`);

			// Determine how much of this payment applies to this repayment
			const amountToApply = Math.min(
				paymentAmount,
				repaymentAmountNeeded,
				remainingPaymentAmount
			);

			// Add this payment as contributing (even if partial)
			contributingPayments.push({
				...currentPayment,
				appliedAmount: amountToApply, // Track how much of this payment was applied
			});

			totalContributingAmount += amountToApply;
			repaymentAmountNeeded -= amountToApply;
			remainingPaymentAmount -= amountToApply;

			console.log(
				`Applied ${amountToApply} to repayment ${repayment.id}`
			);
			console.log(
				`Remaining needed for repayment: ${repaymentAmountNeeded}`
			);
			console.log(
				`Remaining total payment amount: ${remainingPaymentAmount}`
			);

			// If we've used up this entire payment, move to the next one
			if (amountToApply >= paymentAmount) {
				currentPaymentIndex++;
			} else {
				// If we only used part of this payment, we'll continue with it for the next repayment
				// But we need to track that we've used part of it
				break;
			}
		}

		// If we found contributing payments, use them
		if (contributingPayments.length > 0) {
			console.log(
				`Matched repayment ${repayment.id} (${repayment.amount}) with ${contributingPayments.length} payments totaling ${totalContributingAmount}`
			);

			return {
				...repayment,
				actualPaymentDate: contributingPayments[0].createdAt,
				contributingPayments: contributingPayments.map((p) => ({
					id: p.id,
					amount: Math.abs(p.appliedAmount || p.amount), // Always use positive values
					createdAt: p.createdAt,
					reference: p.reference,
					description: p.description,
				})),
				totalContributingAmount: Math.abs(totalContributingAmount), // Ensure positive
			};
		}

		return {
			...repayment,
			actualPaymentDate: repayment.paidAt,
			contributingPayments: [],
			totalContributingAmount: 0,
		};
	});

	if (totalPaid === 0) {
		// No payments made, return original schedule with enhanced payment dates
		return {
			...loan,
			repayments: enhancedRepayments,
		};
	}

	// Get pending repayments only for prepayment calculation
	const pendingRepayments = enhancedRepayments
		.filter((r: any) => r.status === "PENDING")
		.sort(
			(a: any, b: any) =>
				new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
		);

	// Get completed/prepaid repayments
	const nonPendingRepayments = enhancedRepayments.filter(
		(r: any) => r.status !== "PENDING"
	);

	// Calculate how much should be deducted from future payments
	let remainingPrepayment = totalPaid;
	const adjustedRepayments = [];

	// Process each pending payment in chronological order
	for (const repayment of pendingRepayments) {
		if (remainingPrepayment <= 0) {
			// No more prepayment to apply, keep original amount
			adjustedRepayments.push({
				...repayment,
				adjustedAmount: repayment.amount,
				prepaymentApplied: 0,
			});
		} else if (remainingPrepayment >= repayment.amount) {
			// Prepayment covers this entire payment - show as fully covered
			adjustedRepayments.push({
				...repayment,
				adjustedAmount: 0,
				prepaymentApplied: repayment.amount,
				// Don't change status here - database should have correct status
			});

			remainingPrepayment -= repayment.amount;
		} else {
			// Prepayment partially covers this payment
			adjustedRepayments.push({
				...repayment,
				adjustedAmount: repayment.amount - remainingPrepayment,
				prepaymentApplied: remainingPrepayment,
			});
			remainingPrepayment = 0;
		}
	}

	// Combine all repayments and sort by installment number
	const allRepayments = [...nonPendingRepayments, ...adjustedRepayments].sort(
		(a: any, b: any) =>
			(a.installmentNumber || 0) - (b.installmentNumber || 0)
	);

	console.log(`Final repayments count: ${allRepayments.length}`);

	// Return loan with adjusted repayments
	return {
		...loan,
		repayments: allRepayments,
		totalPaid,
		remainingPrepayment,
	};
}

/**
 * @swagger
 * /api/admin/loans/{id}/transactions:
 *   get:
 *     summary: Get wallet transactions for a specific loan (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan ID
 *     responses:
 *       200:
 *         description: Wallet transactions for the loan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
// Get wallet transactions for a specific loan (admin only)
// @ts-ignore
router.get(
	"/loans/:id/transactions",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			console.log(`Fetching wallet transactions for loan ID: ${id}`);

			// First verify the loan exists
			const loan = await prisma.loan.findUnique({
				where: { id },
			});

			if (!loan) {
				return res.status(404).json({
					success: false,
					message: "Loan not found",
				});
			}

			// Get all wallet transactions related to this loan
			const transactions = await prisma.walletTransaction.findMany({
				where: {
					loanId: id,
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			console.log(
				`Found ${transactions.length} transactions for loan ${id}`
			);

			return res.json({
				success: true,
				data: transactions,
			});
		} catch (error) {
			console.error("Error fetching wallet transactions:", error);
			return res.status(500).json({
				success: false,
				message: "Internal server error",
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/loans/sync-balances:
 *   post:
 *     summary: Sync all loan outstanding balances (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loan balances synced successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.post(
	"/loans/sync-balances",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			await syncLoanBalances();

			res.json({
				success: true,
				message: "Loan balances synced successfully",
			});
		} catch (error) {
			console.error("Error syncing loan balances:", error);
			res.status(500).json({
				success: false,
				message: "Failed to sync loan balances",
				error: error.message,
			});
		}
	}
);

async function syncRepaymentScheduleWithActualPayments(
	loanId: string,
	tx: any
) {
	// Get all approved payment transactions for this loan
	const actualPayments = await tx.walletTransaction.findMany({
		where: {
			loanId: loanId,
			type: "LOAN_REPAYMENT",
			status: "APPROVED",
		},
		orderBy: {
			processedAt: "asc", // Process payments in chronological order
		},
	});

	// Get all repayments for this loan, ordered by due date
	const repayments = await tx.loanRepayment.findMany({
		where: {
			loanId: loanId,
		},
		orderBy: {
			dueDate: "asc",
		},
	});

	console.log(`Syncing repayment schedule for loan ${loanId}:`);
	console.log(`Found ${actualPayments.length} actual payments`);
	console.log(`Found ${repayments.length} scheduled repayments`);

	// Calculate total payments made
	const totalPaymentsMade = actualPayments.reduce(
		(total: number, payment: any) => {
			return total + Math.abs(payment.amount);
		},
		0
	);

	console.log(`Total payments made: ${totalPaymentsMade}`);

	// Apply payments to repayments in chronological order
	let remainingPayments = totalPaymentsMade;

	// Get the most recent payment date for timing calculations
	const mostRecentPayment = actualPayments[actualPayments.length - 1];
	const mostRecentPaymentDate =
		mostRecentPayment?.processedAt ||
		mostRecentPayment?.createdAt ||
		new Date();

	for (const repayment of repayments) {
		if (remainingPayments <= 0) {
			// No more payments to apply - ensure this repayment is marked as PENDING
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
			continue;
		}

		const amountToApply = Math.min(remainingPayments, repayment.amount);

		// Calculate if payment was early or late based on most recent payment
		const dueDate = new Date(repayment.dueDate);
		const paidDate = new Date(mostRecentPaymentDate);
		const daysDiff = Math.ceil(
			(paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
		);

		const daysEarly = daysDiff < 0 ? Math.abs(daysDiff) : 0;
		const daysLate = daysDiff > 0 ? daysDiff : 0;

		if (amountToApply >= repayment.amount) {
			// Full payment
			await tx.loanRepayment.update({
				where: { id: repayment.id },
				data: {
					status: "COMPLETED",
					actualAmount: repayment.amount,
					paidAt: mostRecentPaymentDate,
					paymentType:
						daysEarly > 0
							? "EARLY"
							: daysLate > 0
							? "LATE"
							: "ON_TIME",
					daysEarly: daysEarly,
					daysLate: daysLate,
				},
			});

			console.log(
				`✅ Fully paid repayment ${repayment.id}: ${repayment.amount}`
			);
			remainingPayments -= repayment.amount;
		} else {
			// Partial payment
			await tx.loanRepayment.update({
				where: { id: repayment.id },
				data: {
					status: "PENDING", // Still pending since not fully paid
					actualAmount: amountToApply,
					paidAt: mostRecentPaymentDate,
					paymentType: "PARTIAL",
					daysEarly: daysEarly,
					daysLate: daysLate,
				},
			});

			console.log(
				`💰 Partial payment on repayment ${repayment.id}: ${amountToApply} of ${repayment.amount}`
			);
			remainingPayments -= amountToApply;
		}
	}

	console.log(
		`Sync completed. Total payments processed: ${totalPaymentsMade}`
	);
	return totalPaymentsMade;
}

/**
 * @swagger
 * /api/admin/loans/{id}/request-discharge:
 *   post:
 *     summary: Request loan discharge (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for requesting discharge
 *     responses:
 *       200:
 *         description: Discharge request submitted successfully
 *       400:
 *         description: Invalid request or loan cannot be discharged
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.post(
	"/loans/:id/request-discharge",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { reason } = req.body;

			if (!reason || reason.trim().length === 0) {
				return res.status(400).json({
					success: false,
					message: "Reason for discharge is required",
				});
			}

			// Check if loan exists and is eligible for discharge
			const loan = await prisma.loan.findUnique({
				where: { id },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
						},
					},
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
				},
			});

			if (!loan) {
				return res.status(404).json({
					success: false,
					message: "Loan not found",
				});
			}

			// Check if loan is eligible for discharge
			if (loan.status === "DISCHARGED") {
				return res.status(400).json({
					success: false,
					message: "Loan is already discharged",
				});
			}

			if (loan.status === "PENDING_DISCHARGE") {
				return res.status(400).json({
					success: false,
					message: "Loan discharge is already pending approval",
				});
			}

			if (loan.status !== "ACTIVE") {
				return res.status(400).json({
					success: false,
					message: "Only active loans can be discharged",
				});
			}

			// Check if loan has outstanding balance
			if (loan.outstandingBalance > 0) {
				return res.status(400).json({
					success: false,
					message: `Loan still has outstanding balance of ${loan.outstandingBalance}. Cannot discharge until fully paid.`,
				});
			}

			// Update loan status to PENDING_DISCHARGE
			const updatedLoan = await prisma.loan.update({
				where: { id },
				data: {
					status: "PENDING_DISCHARGE",
					updatedAt: new Date(),
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
						},
					},
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
				},
			});

			// Log the discharge request
			console.log(
				`Loan discharge requested for loan ${id} by admin ${req.user?.userId}`
			);
			console.log(`Reason: ${reason}`);

			return res.json({
				success: true,
				message: "Loan discharge request submitted successfully",
				data: updatedLoan,
			});
		} catch (error) {
			console.error("Error requesting loan discharge:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to request loan discharge",
				error: (error as Error).message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/loans/{id}/approve-discharge:
 *   post:
 *     summary: Approve loan discharge (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan ID
 *     requestBody:
 *       required: false
 *     responses:
 *       200:
 *         description: Loan discharged successfully
 *       400:
 *         description: Invalid request or loan cannot be discharged
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.post(
	"/loans/:id/approve-discharge",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;

			// Check if loan exists and is pending discharge
			const loan = await prisma.loan.findUnique({
				where: { id },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
						},
					},
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
				},
			});

			if (!loan) {
				return res.status(404).json({
					success: false,
					message: "Loan not found",
				});
			}

			if (loan.status !== "PENDING_DISCHARGE") {
				return res.status(400).json({
					success: false,
					message: "Loan is not pending discharge approval",
				});
			}

			// Final check for outstanding balance
			if (loan.outstandingBalance > 0) {
				return res.status(400).json({
					success: false,
					message: `Cannot discharge loan with outstanding balance of ${loan.outstandingBalance}`,
				});
			}

			// Approve discharge
			const updatedLoan = await prisma.loan.update({
				where: { id },
				data: {
					status: "DISCHARGED",
					dischargedAt: new Date(),
					updatedAt: new Date(),
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
						},
					},
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
				},
			});

			// Log the discharge approval
			console.log(`Loan ${id} discharged by admin ${req.user?.userId}`);

			return res.json({
				success: true,
				message: "Loan discharged successfully",
				data: updatedLoan,
			});
		} catch (error) {
			console.error("Error approving loan discharge:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to approve loan discharge",
				error: (error as Error).message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/loans/{id}/reject-discharge:
 *   post:
 *     summary: Reject loan discharge request (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejecting the discharge
 *     responses:
 *       200:
 *         description: Discharge request rejected successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.post(
	"/loans/:id/reject-discharge",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { reason } = req.body;

			if (!reason || reason.trim().length === 0) {
				return res.status(400).json({
					success: false,
					message: "Reason for rejection is required",
				});
			}

			// Check if loan exists and is pending discharge
			const loan = await prisma.loan.findUnique({
				where: { id },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
						},
					},
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
				},
			});

			if (!loan) {
				return res.status(404).json({
					success: false,
					message: "Loan not found",
				});
			}

			if (loan.status !== "PENDING_DISCHARGE") {
				return res.status(400).json({
					success: false,
					message: "Loan is not pending discharge approval",
				});
			}

			// Reject discharge - return to ACTIVE status
			const updatedLoan = await prisma.loan.update({
				where: { id },
				data: {
					status: "ACTIVE",
					updatedAt: new Date(),
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
						},
					},
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
				},
			});

			// Log the discharge rejection
			console.log(
				`Loan discharge rejected for loan ${id} by admin ${req.user?.userId}`
			);
			console.log(`Reason: ${reason}`);

			return res.json({
				success: true,
				message: "Discharge request rejected successfully",
				data: updatedLoan,
			});
		} catch (error) {
			console.error("Error rejecting loan discharge:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to reject loan discharge",
				error: (error as Error).message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/loans/{id}:
 *   get:
 *     summary: Get individual loan details (admin only)
 *     tags: [Admin]
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
 *         description: Loan details retrieved successfully
 *       404:
 *         description: Loan not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.get(
	"/loans/:id",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;

			const loan = await prisma.loan.findUnique({
				where: { id },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							phoneNumber: true,
						},
					},
					application: {
						select: {
							amount: true,
							term: true,
						},
					},
				},
			});

			if (!loan) {
				return res.status(404).json({
					success: false,
					message: "Loan not found",
				});
			}

			return res.json({
				success: true,
				loan,
			});
		} catch (error) {
			console.error("Error fetching loan details:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to fetch loan details",
				error: (error as Error).message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/loans/{id}/repayments:
 *   get:
 *     summary: Get loan repayments (admin only)
 *     tags: [Admin]
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
 *         description: Loan repayments retrieved successfully
 *       404:
 *         description: Loan not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.get(
	"/loans/:id/repayments",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;

			// First check if loan exists
			const loan = await prisma.loan.findUnique({
				where: { id },
			});

			if (!loan) {
				return res.status(404).json({
					success: false,
					message: "Loan not found",
				});
			}

			const repayments = await prisma.loanRepayment.findMany({
				where: { loanId: id },
				orderBy: { dueDate: "asc" },
			});

			return res.json({
				success: true,
				repayments,
			});
		} catch (error) {
			console.error("Error fetching loan repayments:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to fetch loan repayments",
				error: (error as Error).message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/loans/pending-discharge:
 *   get:
 *     summary: Get loans pending discharge approval (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of loans pending discharge
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.get(
	"/loans/pending-discharge",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			const pendingDischargeLoans = await prisma.loan.findMany({
				where: {
					status: "PENDING_DISCHARGE",
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							phoneNumber: true,
						},
					},
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
						select: {
							id: true,
							amount: true,
							status: true,
							dueDate: true,
							paidAt: true,
						},
						orderBy: {
							dueDate: "asc",
						},
					},
				},
				orderBy: {
					updatedAt: "desc",
				},
			});

			return res.json({
				success: true,
				data: pendingDischargeLoans,
			});
		} catch (error) {
			console.error("Error fetching pending discharge loans:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to fetch pending discharge loans",
				error: (error as Error).message,
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/{id}/complete-attestation:
 *   post:
 *     summary: Mark attestation as completed and move to next stage (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               attestationType:
 *                 type: string
 *                 enum: [IMMEDIATE, MEETING]
 *               attestationNotes:
 *                 type: string
 *               attestationVideoWatched:
 *                 type: boolean
 *               attestationTermsAccepted:
 *                 type: boolean
 *               meetingCompletedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Attestation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       400:
 *         description: Invalid request or application not in correct status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
// Complete attestation and move to next stage (admin only)
router.post(
	"/applications/:id/complete-attestation",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const {
				attestationType,
				attestationNotes,
				attestationVideoWatched,
				attestationTermsAccepted,
				meetingCompletedAt,
			} = req.body;
			const adminUserId = req.user?.userId;

			console.log(
				`Processing attestation completion for application ${id}`
			);

			// Get the application to check current status
			const application = await prisma.loanApplication.findUnique({
				where: { id },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							phoneNumber: true,
						},
					},
					product: true,
				},
			});

			if (!application) {
				return res
					.status(404)
					.json({ message: "Application not found" });
			}

			// Validate current status
			if (application.status !== "PENDING_ATTESTATION") {
				return res.status(400).json({
					message: `Application must be in PENDING_ATTESTATION status. Current status: ${application.status}`,
				});
			}

			// Validate attestation data based on type
			if (attestationType === "IMMEDIATE") {
				if (!attestationVideoWatched || !attestationTermsAccepted) {
					return res.status(400).json({
						message:
							"For immediate attestation, video must be watched and terms must be accepted",
					});
				}
			} else if (attestationType === "MEETING") {
				if (!meetingCompletedAt) {
					return res.status(400).json({
						message:
							"For meeting attestation, meeting completion date is required",
					});
				}
			} else {
				return res.status(400).json({
					message:
						"Invalid attestation type. Must be IMMEDIATE or MEETING",
				});
			}

			// Update the application with attestation completion
			const updatedApplication = await prisma.loanApplication.update({
				where: { id },
				data: {
					status: "PENDING_SIGNATURE",
					attestationType,
					attestationCompleted: true,
					attestationDate: new Date(),
					attestationNotes: attestationNotes || null,
					attestationVideoWatched:
						attestationType === "IMMEDIATE"
							? attestationVideoWatched
							: false,
					attestationTermsAccepted:
						attestationType === "IMMEDIATE"
							? attestationTermsAccepted
							: true,
					meetingCompletedAt:
						attestationType === "MEETING"
							? new Date(meetingCompletedAt)
							: null,
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							phoneNumber: true,
							email: true,
						},
					},
					product: {
						select: {
							id: true,
							name: true,
							code: true,
						},
					},
				},
			});

			// Track the status change in history
			await trackApplicationStatusChange(
				prisma,
				id,
				"PENDING_ATTESTATION",
				"PENDING_SIGNATURE",
				adminUserId,
				"Attestation completed",
				attestationNotes ||
					`${attestationType} attestation completed successfully`,
				{
					attestationType,
					attestationVideoWatched:
						attestationType === "IMMEDIATE"
							? attestationVideoWatched
							: false,
					attestationTermsAccepted:
						attestationType === "IMMEDIATE"
							? attestationTermsAccepted
							: true,
					meetingCompletedAt:
						attestationType === "MEETING"
							? meetingCompletedAt
							: null,
					completedBy: adminUserId,
					completedAt: new Date().toISOString(),
				}
			);

			console.log(
				`Attestation completed successfully for application ${id}`
			);
			return res.json(updatedApplication);
		} catch (error) {
			console.error("Error completing attestation:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

// Add these new endpoints for cron management
router.get(
	"/cron/status",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			const scheduler = CronScheduler.getInstance();
			const status = scheduler.getStatus();

			res.json({
				success: true,
				jobs: status,
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Error getting cron status:", error);
			res.status(500).json({
				success: false,
				error: "Failed to get cron status",
			});
		}
	}
);

router.post(
	"/cron/trigger-late-fees",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			const scheduler = CronScheduler.getInstance();
			await scheduler.triggerLateFeeProcessing();

			res.json({
				success: true,
				message: "Late fee processing triggered successfully",
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Error triggering late fee processing:", error);
			res.status(500).json({
				success: false,
				error: "Failed to trigger late fee processing",
				details:
					error instanceof Error ? error.message : "Unknown error",
			});
		}
	}
);

export default router;
