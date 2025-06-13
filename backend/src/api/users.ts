import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API endpoints for managing logged-in user's data
 */

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 phoneNumber:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                 email:
 *                   type: string
 *                 dateOfBirth:
 *                   type: string
 *                   format: date-time
 *                 address1:
 *                   type: string
 *                 address2:
 *                   type: string
 *                 city:
 *                   type: string
 *                 state:
 *                   type: string
 *                 postalCode:
 *                   type: string
 *                 employmentStatus:
 *                   type: string
 *                 employerName:
 *                   type: string
 *                 monthlyIncome:
 *                   type: string
 *                 bankName:
 *                   type: string
 *                 accountNumber:
 *                   type: string
 *                 isOnboardingComplete:
 *                   type: boolean
 *                 onboardingStep:
 *                   type: number
 *                 kycStatus:
 *                   type: string
 *                 lastLoginAt:
 *                   type: string
 *                   format: date-time
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - No token provided
 *       403:
 *         description: Forbidden - Invalid token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get(
	"/me",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					phoneNumber: true,
					fullName: true,
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
					isOnboardingComplete: true,
					onboardingStep: true,
					kycStatus: true,
					lastLoginAt: true,
					createdAt: true,
					updatedAt: true,
					role: true,
				},
			});

			if (!user) {
				return res.status(404).json({ message: "User not found" });
			}

			return res.json(user);
		} catch (error) {
			console.error("Error fetching user data:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/users/me:
 *   put:
 *     summary: Update current user information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
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
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               address1:
 *                 type: string
 *               address2:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               employmentStatus:
 *                 type: string
 *               employerName:
 *                 type: string
 *               monthlyIncome:
 *                 type: string
 *               bankName:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: User information updated successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put(
	"/me",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			// Convert date string to Date object if present
			let updateData = { ...req.body };
			if (updateData.dateOfBirth) {
				updateData.dateOfBirth = new Date(updateData.dateOfBirth);
			}

			// Ensure kycStatus is a boolean if provided
			if (updateData.kycStatus !== undefined) {
				updateData.kycStatus = Boolean(updateData.kycStatus);
			}

			const updatedUser = await prisma.user.update({
				where: { id: userId },
				data: updateData,
				select: {
					id: true,
					phoneNumber: true,
					fullName: true,
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
					isOnboardingComplete: true,
					onboardingStep: true,
					kycStatus: true,
					lastLoginAt: true,
					createdAt: true,
					updatedAt: true,
					role: true,
				},
			});

			return res.json(updatedUser);
		} catch (error) {
			console.error("Error updating user data:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

// Get or create wallet for a user
router.get(
	"/me/wallet",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user?.userId;

			if (!userId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			console.log("Getting or creating wallet for user:", userId);

			// First, try to find existing wallet
			let wallet = await prisma.wallet.findUnique({
				where: { userId },
			});

			// If wallet doesn't exist, create it
			if (!wallet) {
				console.log("Wallet not found, creating new wallet");
				wallet = await prisma.wallet.create({
					data: {
						userId,
						balance: 0,
						availableForWithdrawal: 0,
						totalDeposits: 0,
						totalWithdrawals: 0,
					},
				});
				console.log("New wallet created:", wallet.id);
			} else {
				console.log("Existing wallet found:", wallet.id);
			}

			// Get wallet transactions
			const transactions = await prisma.walletTransaction.findMany({
				where: { userId },
				orderBy: { createdAt: "desc" },
				take: 10,
			});

			return res.status(200).json({
				message: "Wallet retrieved successfully",
				data: {
					wallet,
					transactions,
				},
			});
		} catch (error) {
			console.error("Error getting wallet:", error);
			return res
				.status(500)
				.json({
					message: "Internal server error",
					error: error.message,
				});
		}
	}
);

export default router;
