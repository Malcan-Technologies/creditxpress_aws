import { Router } from "express";
import { User } from "../models/User";
import {
	generateTokens,
	verifyRefreshToken,
	authenticateToken,
	AuthRequest,
} from "../middleware/auth";
import { prisma } from "../lib/prisma";
import * as bcrypt from "bcryptjs";
import { validatePhoneNumber, normalizePhoneNumber } from "../lib/phoneUtils";
import { OTPUtils, OTPType } from "../lib/otpUtils";
import whatsappService from "../lib/whatsappService";
import crypto from "crypto";
import { loginRateLimiter } from "../middleware/rateLimiter";
import { generateLoginToken, validateLoginToken } from "../middleware/loginToken";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: API endpoints for managing user authentication
 */

/**
 * @swagger
 * /api/auth/login-token:
 *   get:
 *     summary: Get a one-time login token required for login
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Login token generated successfully
 *         headers:
 *           X-Login-Token:
 *             description: One-time login token (also in response body)
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 loginToken:
 *                   type: string
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.get("/login-token", generateLoginToken as any, (_req, res): void => {
	const token = res.locals.loginToken;
	if (token) {
		res.json({
			loginToken: token,
			message: "Login token generated successfully",
		});
		return;
	}
	res.status(500).json({ message: "Failed to generate login token" });
});

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
router.post("/login", loginRateLimiter, validateLoginToken as any, async (req, res) => {
	try {
		const { phoneNumber, password } = req.body;

		// Enhanced validation: Check if phoneNumber and password are strings
		if (!phoneNumber || typeof phoneNumber !== 'string') {
			return res.status(400).json({ 
				message: "Phone number is required and must be a string" 
			});
		}

		if (!password || typeof password !== 'string') {
			return res.status(400).json({ 
				message: "Password is required and must be a string" 
			});
		}

		// Enforce max length limits to prevent DoS attacks
		if (phoneNumber.length > 20) {
			return res.status(400).json({ 
				message: "Invalid phone number format" 
			});
		}

		if (password.length > 128) {
			return res.status(400).json({ 
				message: "Invalid password" 
			});
		}

		// Validate phone number format
		const phoneValidation = validatePhoneNumber(phoneNumber, {
			requireMobile: false, // Allow both mobile and landline for login
			allowLandline: true
		});

		if (!phoneValidation.isValid) {
			return res.status(400).json({ 
				message: phoneValidation.error || "Invalid phone number format" 
			});
		}

		// Normalize phone number for database lookup
		const normalizedPhone = normalizePhoneNumber(phoneNumber);

		// Try to find user by normalized phone number first (E.164 format with +)
		let user = await User.findByPhoneNumber(normalizedPhone);
		
		// If not found and normalized phone starts with +, try without + prefix
		// This handles cases where phone numbers might be stored without + in database
		if (!user && normalizedPhone.startsWith('+')) {
			const phoneWithoutPlus = normalizedPhone.substring(1);
			user = await User.findByPhoneNumber(phoneWithoutPlus);
		}
		
		// If still not found and input didn't start with +, try with + prefix
		// This handles cases where phone numbers might be stored with + in database
		if (!user && !phoneNumber.startsWith('+')) {
			const phoneWithPlus = '+' + phoneNumber;
			user = await User.findByPhoneNumber(phoneWithPlus);
		}

		if (!user) {
			return res.status(401).json({ message: "Invalid credentials" });
		}

		// Check password
		const isValidPassword = await user.comparePassword(password);

		if (!isValidPassword) {
			return res.status(401).json({ message: "Invalid credentials" });
		}

		// Check if phone is verified
		const userWithVerification = await prisma.user.findUnique({
			where: { id: user.id },
			select: { phoneVerified: true }
		});

		if (!userWithVerification?.phoneVerified) {
			// Automatically send OTP for phone verification
			try {
				// Check rate limiting first
				const rateLimitCheck = await OTPUtils.canRequestNewOTP(normalizedPhone);
				if (rateLimitCheck.canRequest) {
					// Generate and send OTP
					const otpResult = await OTPUtils.createOTP(user.id, normalizedPhone);
					if (otpResult.success) {
						// Send OTP via WhatsApp
						const whatsappResult = await whatsappService.sendOTP({
							to: normalizedPhone,
							otp: otpResult.otp!,
						});
						
						if (!whatsappResult.success) {
							console.error("WhatsApp OTP send failed during login:", whatsappResult.error);
						}
					}
				}
			} catch (error) {
				console.error("Failed to send OTP during login:", error);
				// Continue anyway, user can request resend
			}

			return res.status(403).json({ 
				message: "Please verify your phone number before logging in. We've sent a verification code to your WhatsApp.",
				requiresPhoneVerification: true,
				phoneNumber: user.phoneNumber,
				userId: user.id
			});
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

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user and send OTP verification
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
 *                 example: "securepassword"
 *     responses:
 *       201:
 *         description: User created successfully, OTP sent for verification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 phoneNumber:
 *                   type: string
 *                 otpSent:
 *                   type: boolean
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: User already exists or invalid phone number
 *       500:
 *         description: Server error
 */
// Sign up
router.post("/signup", async (req, res) => {
	try {
		const { phoneNumber, password } = req.body;

        // Validate password: disallow empty or whitespace-only
        if (!password || typeof password !== "string" || password.trim().length === 0) {
            return res.status(400).json({
                message: "Password cannot be empty or only spaces",
            });
        }

        // Optional: enforce minimum length (aligns with frontend and reset-password)
        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long",
            });
        }

        // Require at least 1 uppercase letter and 1 special character
        const hasUppercase = /[A-Z]/.test(password);
        const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
        if (!hasUppercase || !hasSpecialChar) {
            return res.status(400).json({
                message: "Password must include at least 1 uppercase letter and 1 special character",
            });
        }

        // Disallow any whitespace characters in password
        if (/\s/.test(password)) {
            return res.status(400).json({
                message: "Password cannot contain spaces",
            });
        }

		// Validate phone number format
		const phoneValidation = validatePhoneNumber(phoneNumber, {
			requireMobile: true, // Require mobile numbers for signup
			allowLandline: false
		});

		if (!phoneValidation.isValid) {
			return res.status(400).json({ 
				message: phoneValidation.error || "Invalid phone number format" 
			});
		}

		// Normalize phone number for database storage
		const normalizedPhone = normalizePhoneNumber(phoneNumber);

		// Check if user already exists
		const existingUser = await User.findByPhoneNumber(normalizedPhone);
		if (existingUser) {
			return res.status(400).json({ 
				message: "This phone number is already registered. Please use a different number or try logging in instead." 
			});
		}

		// Create new user with normalized phone number (phone not verified yet)
		const user = await User.create({ 
			phoneNumber: normalizedPhone, 
			password 
		});

		// Generate and send OTP
		const otpResult = await OTPUtils.createOTP(user.id, normalizedPhone);
		if (!otpResult.success) {
			// If OTP creation fails, we should clean up the user
			await prisma.user.delete({ where: { id: user.id } });
			return res.status(500).json({ 
				message: "Failed to send verification code. Please try again." 
			});
		}

		// Send OTP via WhatsApp
		const whatsappResult = await whatsappService.sendOTP({
			to: normalizedPhone,
			otp: otpResult.otp!,
		});

		if (!whatsappResult.success) {
			console.error("WhatsApp OTP send failed:", whatsappResult.error);
			// Still return success to user, but log the error
			// In production, you might want to fallback to SMS or email
		}

		return res.status(201).json({
			message: "Account created successfully. Please verify your phone number with the OTP sent via WhatsApp.",
			userId: user.id,
			phoneNumber: normalizedPhone,
			otpSent: whatsappResult.success,
			expiresAt: otpResult.expiresAt,
		});
	} catch (error) {
		console.error("Signup error:", error);
		return res.status(500).json({ message: "Error creating user" });
	}
});

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and complete phone number verification
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - otp
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Phone number verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 phoneNumber:
 *                   type: string
 *                 isOnboardingComplete:
 *                   type: boolean
 *                 onboardingStep:
 *                   type: number
 *       400:
 *         description: Invalid or expired OTP
 *       500:
 *         description: Server error
 */
router.post("/verify-otp", async (req, res) => {
	try {
		const { phoneNumber, otp } = req.body;

		if (!phoneNumber || !otp) {
			return res.status(400).json({ 
				message: "Phone number and OTP are required" 
			});
		}

		// Validate phone number format
		const phoneValidation = validatePhoneNumber(phoneNumber, {
			requireMobile: true,
			allowLandline: false
		});

		if (!phoneValidation.isValid) {
			return res.status(400).json({ 
				message: phoneValidation.error || "Invalid phone number format" 
			});
		}

		// Normalize phone number
		const normalizedPhone = normalizePhoneNumber(phoneNumber);

		// Validate OTP
		const otpResult = await OTPUtils.validateOTP(normalizedPhone, otp);
		
		if (!otpResult.success) {
			return res.status(400).json({ 
				message: otpResult.error || "Invalid OTP" 
			});
		}

		// Get the verified user
		const user = await User.findById(otpResult.userId!);
		if (!user) {
			return res.status(404).json({ 
				message: "User not found" 
			});
		}

	// Generate tokens for the verified user
	const { accessToken, refreshToken } = generateTokens(user);

	// Save refresh token
	await user.updateRefreshToken(refreshToken);

	// Get user's role for admin verification
	const userWithRole = await prisma.user.findUnique({
		where: { id: user.id },
		select: { role: true }
	});

	return res.json({
		message: "Phone number verified successfully",
		accessToken,
		refreshToken,
		userId: user.id,
		phoneNumber: user.phoneNumber,
		isOnboardingComplete: user.isOnboardingComplete,
		onboardingStep: user.onboardingStep,
		role: userWithRole?.role || "USER", // Include role for admin verification
	});
	} catch (error) {
		console.error("OTP verification error:", error);
		return res.status(500).json({ message: "Error verifying OTP" });
	}
});

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     summary: Resend OTP verification code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 otpSent:
 *                   type: boolean
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid phone number or rate limit exceeded
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post("/resend-otp", async (req, res) => {
	try {
		const { phoneNumber } = req.body;

		if (!phoneNumber) {
			return res.status(400).json({ 
				message: "Phone number is required" 
			});
		}

		// Validate phone number format
		const phoneValidation = validatePhoneNumber(phoneNumber, {
			requireMobile: true,
			allowLandline: false
		});

		if (!phoneValidation.isValid) {
			return res.status(400).json({ 
				message: phoneValidation.error || "Invalid phone number format" 
			});
		}

		// Normalize phone number
		const normalizedPhone = normalizePhoneNumber(phoneNumber);

		// Check if user exists and is not verified
		const user = await User.findByPhoneNumber(normalizedPhone);
		if (!user) {
			return res.status(404).json({ 
				message: "User not found. Please register first." 
			});
		}

		// Check if user is already verified
		const userWithVerification = await prisma.user.findUnique({
			where: { id: user.id },
			select: { phoneVerified: true }
		});

		if (userWithVerification?.phoneVerified) {
			return res.status(400).json({ 
				message: "Phone number is already verified" 
			});
		}

		// Check rate limiting
		const rateLimitCheck = await OTPUtils.canRequestNewOTP(normalizedPhone);
		if (!rateLimitCheck.canRequest) {
			return res.status(400).json({ 
				message: rateLimitCheck.waitTime 
					? `Please wait ${rateLimitCheck.waitTime} seconds before requesting a new OTP`
					: "Rate limit exceeded. Please try again later."
			});
		}

		// Generate and send new OTP
		const otpResult = await OTPUtils.createOTP(user.id, normalizedPhone);
		if (!otpResult.success) {
			return res.status(500).json({ 
				message: "Failed to generate verification code. Please try again." 
			});
		}

		// Send OTP via WhatsApp
		const whatsappResult = await whatsappService.sendOTP({
			to: normalizedPhone,
			otp: otpResult.otp!,
		});

		if (!whatsappResult.success) {
			console.error("WhatsApp OTP resend failed:", whatsappResult.error);
			// Still return success to user, but log the error
		}

		return res.json({
			message: "Verification code sent successfully via WhatsApp",
			otpSent: whatsappResult.success,
			expiresAt: otpResult.expiresAt,
		});
	} catch (error) {
		console.error("OTP resend error:", error);
		return res.status(500).json({ message: "Error resending OTP" });
	}
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout a user and invalidate their refresh token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 *       401:
 *         description: User not authenticated
 *       500:
 *         description: Server error
 */
// Logout
router.post("/logout", authenticateToken, async (req: AuthRequest, res) => {
	try {
		if (!req.user?.userId) {
			return res.status(401).json({ message: "User not authenticated" });
		}
		const user = await User.findById(req.user.userId);
		if (user) {
			await user.updateRefreshToken(null);
		}
		return res.json({ message: "Logged out successfully" });
	} catch (error) {
		return res.status(500).json({ message: "Error logging out" });
	}
});

/**
 * @swagger
 * /api/auth/test-bcrypt:
 *   get:
 *     summary: Test bcrypt functionality
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Bcrypt test results
 */
router.get("/test-bcrypt", async (_req, res) => {
	try {
		// Generate a test password hash
		const testPassword = "test123";
		console.log("Testing bcrypt with password:", testPassword);

		// Test direct hashing
		let error = null;
		let hashResult = null;
		let compareResult = null;

		try {
			console.log("Attempting to hash password...");
			const hashedPassword = await bcrypt.hash(testPassword, 10);
			hashResult = { success: true, hash: hashedPassword };

			console.log("Attempting to compare password...");
			const isMatch = await bcrypt.compare(testPassword, hashedPassword);
			compareResult = { success: true, isMatch };
		} catch (e) {
			error = {
				message: e instanceof Error ? e.message : "Unknown error",
				stack: e instanceof Error ? e.stack : undefined,
			};
			console.error("Bcrypt test error:", error);
		}

		return res.json({
			message: "Bcrypt test completed",
			error,
			hashResult,
			compareResult,
			nodeVersion: process.version,
			bcryptVersion: require("bcryptjs/package.json").version,
		});
	} catch (error) {
		console.error("Test bcrypt error:", error);
		return res.status(500).json({ message: "Error testing bcrypt" });
	}
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Initialize password reset flow with OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *     responses:
 *       200:
 *         description: Password reset OTP sent successfully
 *       400:
 *         description: Invalid phone number
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Server error
 */
router.post("/forgot-password", async (req, res) => {
	try {
		const { phoneNumber } = req.body;

		// Validate phone number format
		const phoneValidation = validatePhoneNumber(phoneNumber, {
			requireMobile: false,
			allowLandline: true
		});

		if (!phoneValidation.isValid) {
			return res.status(400).json({ 
				message: phoneValidation.error || "Invalid phone number format" 
			});
		}

		// Normalize phone number
		const normalizedPhone = normalizePhoneNumber(phoneNumber);

		// Check rate limiting for password reset OTPs
		const rateLimitCheck = await OTPUtils.canRequestNewOTPWithType(
			normalizedPhone, 
			OTPType.PASSWORD_RESET
		);

		if (!rateLimitCheck.canRequest) {
			return res.status(429).json({ 
				message: rateLimitCheck.error || `Please wait ${rateLimitCheck.waitTime} seconds before requesting a new reset code`,
				waitTime: rateLimitCheck.waitTime
			});
		}

		// Find user by phone number (same logic as login)
		let user = await User.findByPhoneNumber(normalizedPhone);
		
		if (!user && normalizedPhone.startsWith('+')) {
			const phoneWithoutPlus = normalizedPhone.substring(1);
			user = await User.findByPhoneNumber(phoneWithoutPlus);
		}
		
		if (!user && !phoneNumber.startsWith('+')) {
			const phoneWithPlus = '+' + phoneNumber;
			user = await User.findByPhoneNumber(phoneWithPlus);
		}

		// Always return success to prevent user enumeration attacks
		// But only send OTP if user exists
		if (user) {
			// Generate and send password reset OTP
			const otpResult = await OTPUtils.createOTPWithType(
				user.id, 
				normalizedPhone, 
				OTPType.PASSWORD_RESET
			);

			if (otpResult.success) {
				// Send OTP via WhatsApp
				try {
					await whatsappService.sendOTP({
						to: normalizedPhone,
						otp: otpResult.otp!,
					});
					console.log(`Password reset OTP sent to ${normalizedPhone}`);
				} catch (whatsappError) {
					console.error("Error sending password reset OTP via WhatsApp:", whatsappError);
					// Continue without failing - user can still request resend
				}
			}
		}

		// Always return success response to prevent user enumeration
		return res.json({
			message: "If this phone number is registered, you will receive a password reset code via WhatsApp"
		});

	} catch (error) {
		console.error("Error in forgot-password:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
});

/**
 * @swagger
 * /api/auth/verify-reset-otp:
 *   post:
 *     summary: Verify password reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - otp
 *             properties:
 *               phoneNumber:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP or phone number
 *       500:
 *         description: Server error
 */
router.post("/verify-reset-otp", async (req, res) => {
	try {
		const { phoneNumber, otp } = req.body;

		if (!phoneNumber || !otp) {
			return res.status(400).json({ message: "Phone number and OTP are required" });
		}

		// Validate phone number format
		const phoneValidation = validatePhoneNumber(phoneNumber, {
			requireMobile: false,
			allowLandline: true
		});

		if (!phoneValidation.isValid) {
			return res.status(400).json({ 
				message: phoneValidation.error || "Invalid phone number format" 
			});
		}

		// Normalize phone number
		const normalizedPhone = normalizePhoneNumber(phoneNumber);

		// Validate the password reset OTP
		const otpResult = await OTPUtils.validateOTPWithType(
			normalizedPhone, 
			otp, 
			OTPType.PASSWORD_RESET
		);

		if (!otpResult.success) {
			return res.status(400).json({ message: otpResult.error });
		}

		// Generate a temporary reset token for the password reset step
		const resetToken = crypto.randomBytes(32).toString('hex');
		const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

		// Store reset token in user record
		await prisma.user.update({
			where: { id: otpResult.userId },
			data: {
				// We'll need to add these fields to the User model
				resetToken,
				resetTokenExpiry
			}
		});

		return res.json({
			message: "OTP verified successfully",
			resetToken,
			userId: otpResult.userId
		});

	} catch (error) {
		console.error("Error in verify-reset-otp:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with verified token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resetToken
 *               - newPassword
 *             properties:
 *               resetToken:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid token or password
 *       500:
 *         description: Server error
 */
router.post("/reset-password", async (req, res) => {
	try {
		const { resetToken, newPassword } = req.body;

		if (!resetToken || !newPassword) {
			return res.status(400).json({ message: "Reset token and new password are required" });
		}

        // Disallow whitespace-only passwords
        if (typeof newPassword !== "string" || newPassword.trim().length === 0) {
            return res.status(400).json({ message: "Password cannot be empty or only spaces" });
        }

        // Validate password strength
		if (newPassword.length < 8) {
			return res.status(400).json({ message: "Password must be at least 8 characters long" });
		}

		// Find user with valid reset token
		const user = await prisma.user.findFirst({
			where: {
				resetToken,
				resetTokenExpiry: {
					gt: new Date() // Token not expired
				}
			}
		});

		if (!user) {
			return res.status(400).json({ message: "Invalid or expired reset token" });
		}

		// Hash new password
		const hashedPassword = await bcrypt.hash(newPassword, 10);

		// Update password and clear reset token
		await prisma.user.update({
			where: { id: user.id },
			data: {
				password: hashedPassword,
				resetToken: null,
				resetTokenExpiry: null
			}
		});

		// Invalidate all existing password reset OTPs for this user
		await prisma.phoneVerification.updateMany({
			where: {
				userId: user.id,
				otpType: OTPType.PASSWORD_RESET,
				verified: false
			},
			data: {
				verified: true
			}
		});

		return res.json({ message: "Password reset successfully" });

	} catch (error) {
		console.error("Error in reset-password:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
});

export default router;
