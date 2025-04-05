import { Router } from "express";
import { User } from "../models/User";
import {
	generateTokens,
	verifyRefreshToken,
	authenticateToken,
	AuthRequest,
} from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with phone number and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - password
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *               password:
 *                 type: string
 *                 example: "admin123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 phoneNumber:
 *                   type: string
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 isOnboardingComplete:
 *                   type: boolean
 *                 onboardingStep:
 *                   type: number
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post("/login", async (req, res) => {
	try {
		const { phoneNumber, password } = req.body;

		console.log("Login attempt:", { phoneNumber });

		// Find user
		const user = await User.findByPhoneNumber(phoneNumber);
		if (!user) {
			console.log("User not found:", { phoneNumber });
			return res.status(401).json({ message: "Invalid credentials" });
		}

		// Check password
		const isValidPassword = await user.comparePassword(password);
		console.log("Password check:", { isValid: isValidPassword });

		if (!isValidPassword) {
			console.log("Invalid password for user:", { phoneNumber });
			return res.status(401).json({ message: "Invalid credentials" });
		}

		// Update last login time
		await prisma.user.update({
			where: { id: user.id },
			data: {
				lastLoginAt: new Date(),
			},
		});

		// Generate tokens
		const { accessToken, refreshToken } = generateTokens(user);

		// Save refresh token
		await user.updateRefreshToken(refreshToken);

		console.log("Login successful:", {
			userId: user.id,
			phoneNumber: user.phoneNumber,
		});

		return res.json({
			userId: user.id,
			phoneNumber: user.phoneNumber,
			accessToken,
			refreshToken,
			isOnboardingComplete: user.isOnboardingComplete,
			onboardingStep: user.onboardingStep,
			message: "Login successful",
		});
	} catch (error) {
		console.error("Login error:", error);
		return res.status(500).json({ message: "Error logging in" });
	}
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Auth]
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
 *                 isOnboardingComplete:
 *                   type: boolean
 *                 onboardingStep:
 *                   type: number
 *       401:
 *         description: Invalid refresh token
 *       500:
 *         description: Server error
 */
router.post("/refresh", async (req, res) => {
	try {
		const { refreshToken } = req.body;

		if (!refreshToken) {
			return res.status(401).json({ message: "Refresh token required" });
		}

		// Verify refresh token
		const decoded = verifyRefreshToken(refreshToken);
		if (!decoded) {
			return res.status(403).json({ message: "Invalid refresh token" });
		}

		// Find user
		const user = await User.findById(decoded.userId);
		if (!user || user.refreshToken !== refreshToken) {
			return res.status(403).json({ message: "Invalid refresh token" });
		}

		// Generate new tokens
		const { accessToken, refreshToken: newRefreshToken } =
			generateTokens(user);

		// Update refresh token
		await user.updateRefreshToken(newRefreshToken);

		return res.json({
			accessToken,
			refreshToken: newRefreshToken,
			isOnboardingComplete: user.isOnboardingComplete,
			onboardingStep: user.onboardingStep,
		});
	} catch (error) {
		return res.status(500).json({ message: "Error refreshing token" });
	}
});

// Sign up
router.post("/signup", async (req, res) => {
	try {
		const { phoneNumber, password } = req.body;

		// Check if user already exists
		const existingUser = await User.findByPhoneNumber(phoneNumber);
		if (existingUser) {
			return res.status(400).json({ message: "User already exists" });
		}

		// Create new user
		const user = await User.create({ phoneNumber, password });

		// Generate tokens
		const { accessToken, refreshToken } = generateTokens(user);

		// Save refresh token
		await user.updateRefreshToken(refreshToken);

		return res.status(201).json({
			message: "User created successfully",
			accessToken,
			refreshToken,
			isOnboardingComplete: user.isOnboardingComplete,
			onboardingStep: user.onboardingStep,
		});
	} catch (error) {
		return res.status(500).json({ message: "Error creating user" });
	}
});

// Logout
router.post("/logout", authenticateToken, async (req: AuthRequest, res) => {
	try {
		if (!req.user?.phoneNumber) {
			return res.status(401).json({ message: "User not authenticated" });
		}
		const user = await User.findByPhoneNumber(req.user.phoneNumber);
		if (user) {
			await user.updateRefreshToken(null);
		}
		return res.json({ message: "Logged out successfully" });
	} catch (error) {
		return res.status(500).json({ message: "Error logging out" });
	}
});

export default router;
