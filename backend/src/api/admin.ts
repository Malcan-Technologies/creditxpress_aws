import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authenticateToken } from "../middleware/auth";

interface AuthRequest extends Request {
	user?: {
		userId: string;
		role: string;
	};
}

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to check if user is admin
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

// Admin login endpoint
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
			{ expiresIn: "7d" }
		);

		console.log("Admin login successful:", phoneNumber);

		// Return tokens and user data
		res.json({
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
		res.status(500).json({ error: "Internal server error" });
	}
});

// Get dashboard stats (admin only)
router.get(
	"/dashboard",
	authenticateToken,
	isAdmin,
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

// Get all users (protected admin route)
router.get(
	"/users",
	authenticateToken,
	isAdmin,
	async (req: AuthRequest, res: Response) => {
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
	}
);

export default router;
