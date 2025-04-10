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
			const [totalUsers, totalApplications, recentApplications] =
				await Promise.all([
					prisma.user.count(),
					prisma.loanApplication.count(),
					prisma.loanApplication.findMany({
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
					}),
				]);

			// For now, use the same value for totalLoans as totalApplications
			const totalLoans = totalApplications;
			// Mock total loan amount (you can implement real calculation later)
			const totalLoanAmount = 1000000;

			res.json({
				totalUsers,
				totalApplications,
				totalLoans,
				totalLoanAmount,
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

export default router;
