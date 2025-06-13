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
/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: API endpoints for Admin dashboard
 */

const router = express.Router();
const prisma = new PrismaClient();

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
async function trackApplicationStatusChange(
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
		res.status(500).json({ message: "Internal server error" });
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

			// Get approved loans count (status = APPROVED or DISBURSED)
			const approvedLoans = await prisma.loanApplication.count({
				where: {
					status: {
						in: ["APPROVED", "ACTIVE"],
					},
				},
			});

			// Get disbursed loans count (status = DISBURSED only)
			const disbursedLoans = await prisma.loanApplication.count({
				where: {
					status: "ACTIVE",
				},
			});

			// Get total disbursed amount (sum loan amounts where status = DISBURSED)
			const disbursedLoanDetails = await prisma.loanApplication.findMany({
				where: {
					status: "ACTIVE",
				},
				select: {
					amount: true,
				},
			});

			// Calculate total disbursed amount
			const totalDisbursedAmount = disbursedLoanDetails.reduce(
				(sum, loan) => {
					return sum + (loan.amount || 0);
				},
				0
			);

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
				pendingReviewApplications,
				approvedLoans,
				disbursedLoans,
				totalDisbursedAmount,
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

			// Get monthly disbursement amounts and counts for revenue calculation
			const monthlyDisbursements = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', la."createdAt") as month,
					SUM(COALESCE(la.amount, 0)) as total_amount,
					COUNT(*) as disbursement_count
				FROM "loan_applications" la
				WHERE la.status = 'ACTIVE' 
				AND la."createdAt" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', la."createdAt")
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				total_amount: number;
				disbursement_count: bigint;
			}>;

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

				return {
					month: stat.month.toLocaleDateString("en-US", {
						month: "short",
					}),
					applications: Number(stat.applications),
					approvals: Number(stat.approvals),
					disbursements: Number(stat.disbursements),
					revenue: disbursementData.total_amount * 0.05, // Assuming 5% fee
					disbursement_amount: disbursementData.total_amount,
					disbursement_count: disbursementData.disbursement_count,
					users: userData.users,
					kyc_users: userData.kyc_users,
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

			// Special handling for DISBURSED status
			if (status === "DISBURSED" || status === "ACTIVE") {
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

									updatedLoan =
										await prismaTransaction.loan.create({
											data: {
												userId: application.userId,
												applicationId: application.id,
												principalAmount:
													application.amount,
												outstandingBalance:
													application.amount,
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
							const disbursement =
								await createLoanDisbursementRecord(
									prismaTransaction,
									id,
									disbursementReference,
									application.amount || 0,
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
													amount:
														application.amount || 0,
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
													amount:
														application.amount || 0,
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
												message: `Your loan of ${application.amount} has been disbursed to your bank account and is now active. Reference: ${disbursementReference}`,
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
									amount: application.amount,
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
									amount: application.amount,
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
				console.log(`Processing regular status update to ${status}`);

				const application = await prisma.loanApplication.update({
					where: { id },
					data: { status },
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
					status,
					adminUserId,
					"Admin status update",
					notes,
					{
						updatedBy: adminUserId,
						updatedAt: new Date().toISOString(),
					}
				);

				// Create notification for the user about status change
				try {
					console.log("Creating notification for status update");
					await prisma.notification.create({
						data: {
							userId: application.user.id,
							title: "Application Status Updated",
							message: `Your loan application status has been updated to ${status}`,
							type: "SYSTEM",
							priority: "HIGH",
							metadata: {
								applicationId: id,
								previousStatus: application.status,
								newStatus: status,
								notes: notes || "",
								updatedBy: adminUserId,
								updatedAt: new Date().toISOString(),
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

			const loans = await prisma.loanApplication.findMany({
				where: {
					status: {
						in: ["APPROVED", "ACTIVE"],
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
					product: true,
					documents: true,
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

								updatedLoan =
									await prismaTransaction.loan.create({
										data: {
											userId: application.userId,
											applicationId: application.id,
											principalAmount: application.amount,
											outstandingBalance:
												application.amount,
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
						const disbursement = await createLoanDisbursementRecord(
							prismaTransaction,
							id,
							disbursementReference,
							application.amount || 0,
							adminUserId,
							application.user.bankName,
							application.user.accountNumber,
							notes
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
												amount: application.amount || 0,
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
												amount: application.amount || 0,
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
										message: `Your loan of ${application.amount} has been disbursed to your bank account and is now active. Reference: ${disbursementReference}`,
										type: "SYSTEM",
										priority: "HIGH",
										metadata: {
											loanAmount: application.amount,
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
									amount: application.amount,
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
									amount: application.amount,
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
									amount: application.amount,
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
									amount: application.amount,
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
	async (req: AuthRequest, res: Response) => {
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
	async (req: AuthRequest, res: Response) => {
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

export default router;
