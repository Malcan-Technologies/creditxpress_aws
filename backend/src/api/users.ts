import { Router, RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { authenticateAndVerifyPhone } from "../middleware/auth";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { validatePhoneNumber, normalizePhoneNumber } from "../lib/phoneUtils";
import { OTPUtils, OTPType } from "../lib/otpUtils";
import whatsappService from "../lib/whatsappService";
import crypto from "crypto";
import { getS3ObjectStream } from "../lib/storage";

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
 *                 serviceLength:
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
	authenticateAndVerifyPhone,
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
					serviceLength: true,
					bankName: true,
					accountNumber: true,
					isOnboardingComplete: true,
					onboardingStep: true,
					kycStatus: true,
					lastLoginAt: true,
					createdAt: true,
					updatedAt: true,
					role: true,
				// IC/Passport Information
				icNumber: true,
				icType: true,
				// Education Information
				educationLevel: true,
				// Demographics
				race: true,
				gender: true,
				occupation: true,
				// Emergency Contact Information
				emergencyContactName: true,
				emergencyContactPhone: true,
				emergencyContactRelationship: true,
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
 *               serviceLength:
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
	authenticateAndVerifyPhone,
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

			// Validate and normalize phone number if provided
			if (updateData.phoneNumber) {
				console.log("Validating phone number:", updateData.phoneNumber);
				
				const phoneValidation = validatePhoneNumber(updateData.phoneNumber, {
					requireMobile: false, // Allow both mobile and landline for profile update
					allowLandline: true
				});

				if (!phoneValidation.isValid) {
					console.log("Phone validation failed:", phoneValidation.error);
					return res.status(400).json({ 
						message: phoneValidation.error || "Invalid phone number format" 
					});
				}

				// Normalize phone number to E.164 format (with + prefix) for database storage
				const normalizedPhone = normalizePhoneNumber(updateData.phoneNumber);
				console.log("Normalized phone number:", normalizedPhone);
				updateData.phoneNumber = normalizedPhone;

				// Check if another user already has this phone number
				const existingUser = await prisma.user.findFirst({
					where: { 
						phoneNumber: normalizedPhone,
						NOT: { id: userId } // Exclude current user
					}
				});

				console.log("Existing user check result:", existingUser ? "Found duplicate" : "No duplicate found");

				if (existingUser) {
					console.log("Returning duplicate phone number error");
					return res.status(400).json({ 
						message: "This phone number is already registered to another account" 
					});
				}
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
					serviceLength: true,
					bankName: true,
					accountNumber: true,
					isOnboardingComplete: true,
					onboardingStep: true,
					kycStatus: true,
					lastLoginAt: true,
					createdAt: true,
					updatedAt: true,
				role: true,
				// IC/Passport Information
				icNumber: true,
				icType: true,
				// Education Information
				educationLevel: true,
				// Demographics
				race: true,
				gender: true,
				occupation: true,
				// Emergency Contact Information
				emergencyContactName: true,
				emergencyContactPhone: true,
				emergencyContactRelationship: true,
			},
		});

		return res.json(updatedUser);
		} catch (error) {
			console.error("Error updating user data:", error);
			console.error("Error details:", {
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : "No stack trace",
				code: (error as any)?.code,
				meta: (error as any)?.meta
			});
			return res.status(500).json({ message: "Failed to update user data" });
		}
	}
);

/**
 * @swagger
 * /api/users/me/password:
 *   put:
 *     summary: Change user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password for verification
 *               newPassword:
 *                 type: string
 *                 description: New password to set
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input or password requirements not met
 *       401:
 *         description: Unauthorized or current password incorrect
 *       500:
 *         description: Server error
 */
router.put(
	"/me/password",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const { currentPassword, newPassword } = req.body;

			// Validate required fields
			if (!currentPassword || !newPassword) {
				return res.status(400).json({ 
					message: "Current password and new password are required" 
				});
			}

            // Validate new password: whitespace-only check
            if (typeof newPassword !== "string" || newPassword.trim().length === 0) {
                return res.status(400).json({ message: "New password cannot be empty or only spaces" });
            }

            // Validate new password strength (minimum 8 characters)
            if (newPassword.length < 8) {
                return res.status(400).json({ 
                    message: "New password must be at least 8 characters long" 
                });
            }

            // Require at least 1 uppercase letter and 1 special character
            const hasUppercase = /[A-Z]/.test(newPassword);
            const hasSpecialChar = /[^A-Za-z0-9]/.test(newPassword);
            if (!hasUppercase || !hasSpecialChar) {
                return res.status(400).json({
                    message: "New password must include at least 1 uppercase letter and 1 special character",
                });
            }

            // Disallow any whitespace characters in new password
            if (/\s/.test(newPassword)) {
                return res.status(400).json({ message: "New password cannot contain spaces" });
            }

			// Get current user with password
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					password: true,
				},
			});

			if (!user) {
				return res.status(404).json({ message: "User not found" });
			}

			// Import bcrypt for password operations
			const bcrypt = require("bcryptjs");

			// Verify current password
			const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
			if (!isCurrentPasswordValid) {
				return res.status(401).json({ message: "Current password is incorrect" });
			}

			// Hash new password using the same method as in User.create()
			const hashedNewPassword = await bcrypt.hash(newPassword, 10);

			// Update password in database
			await prisma.user.update({
				where: { id: userId },
				data: {
					password: hashedNewPassword,
				},
			});

			return res.json({
				message: "Password changed successfully",
			});
		} catch (error) {
			console.error("Error changing password:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/users/me/documents:
 *   get:
 *     summary: Get all documents for the current user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   type:
 *                     type: string
 *                   status:
 *                     type: string
 *                   fileUrl:
 *                     type: string
 *                   applicationId:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                   application:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       product:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           code:
 *                             type: string
 *       401:
 *         description: Unauthorized - No token provided
 *       500:
 *         description: Server error
 */
router.get(
	"/me/documents",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			// Optional query parameter to filter by status (e.g., ?status=APPROVED for reuse)
			const statusFilter = req.query.status as string | undefined;

			const whereClause: any = { userId };
			if (statusFilter) {
				whereClause.status = statusFilter;
			}

			const documents = await prisma.userDocument.findMany({
				where: whereClause,
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
				orderBy: { createdAt: "desc" },
			});

			return res.json(documents);
		} catch (error) {
			console.error("Error fetching user documents:", error);
			return res.status(500).json({ message: "Failed to fetch documents" });
		}
	}
);

/**
 * @swagger
 * /api/users/me/documents/{documentId}:
 *   get:
 *     summary: Get a specific document file for the current user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The document ID
 *     responses:
 *       200:
 *         description: Document file stream
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.get(
	"/me/documents/:documentId",
	authenticateAndVerifyPhone,
	(async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user?.userId;
			const { documentId } = req.params;

			if (!userId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			// Get the document and verify it belongs to the user
			const document = await prisma.userDocument.findFirst({
				where: {
					id: documentId,
					userId: userId,
				},
			});

			if (!document) {
				return res.status(404).json({ message: "Document not found" });
			}

			// Stream file from S3
			try {
				const { stream, contentType, contentLength } = await getS3ObjectStream(document.fileUrl);
				
				// Set appropriate headers
				res.setHeader("Content-Type", contentType);
				if (contentLength) {
					res.setHeader("Content-Length", contentLength);
				}
				
				// Extract filename from S3 key for Content-Disposition
				const filename = document.fileUrl.split('/').pop() || 'document';
				res.setHeader(
					"Content-Disposition",
					`inline; filename="${filename}"`
				);

				// Stream the file
				stream.pipe(res);
				
				// Handle stream errors
				stream.on("error", (error) => {
					console.error("Error streaming file from S3:", error);
					if (!res.headersSent) {
						res.status(500).json({ message: "Error streaming file" });
					}
				});
			} catch (s3Error) {
				console.error("Error fetching from S3:", s3Error);
				return res.status(404).json({ message: "File not found in storage" });
			}

			return res;
		} catch (error) {
			console.error("Error serving user document:", error);
			if (!res.headersSent) {
				return res.status(500).json({ message: "Internal server error" });
			}
			return res;
		}
	}) as RequestHandler
);

// Get or create wallet for a user
router.get(
	"/me/wallet",
	authenticateAndVerifyPhone,
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

/**
 * @swagger
 * /api/users/me/phone/change-request:
 *   post:
 *     summary: Request phone number change
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPhoneNumber
 *             properties:
 *               newPhoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Phone change request initiated
 *       400:
 *         description: Invalid phone number or already in use
 *       500:
 *         description: Server error
 */
router.post(
	"/me/phone/change-request",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const { newPhoneNumber } = req.body;

			if (!newPhoneNumber) {
				return res.status(400).json({ message: "New phone number is required" });
			}

			// Get current user
			const currentUser = await prisma.user.findUnique({
				where: { id: userId },
				select: { phoneNumber: true }
			});

			if (!currentUser) {
				return res.status(404).json({ message: "User not found" });
			}

			// Validate new phone number format
			const phoneValidation = validatePhoneNumber(newPhoneNumber, {
				requireMobile: false,
				allowLandline: true
			});

			if (!phoneValidation.isValid) {
				return res.status(400).json({ 
					message: phoneValidation.error || "Invalid phone number format" 
				});
			}

			// Normalize new phone number
			const normalizedNewPhone = normalizePhoneNumber(newPhoneNumber);

			// Check if new phone is different from current
			if (normalizedNewPhone === currentUser.phoneNumber) {
				return res.status(400).json({ message: "New phone number must be different from current" });
			}

			// Check if new phone number is already in use
			const existingUser = await prisma.user.findFirst({
				where: { phoneNumber: normalizedNewPhone }
			});

			if (existingUser) {
				return res.status(400).json({ message: "Phone number is already in use" });
			}

			// Check rate limiting for new phone
			const rateLimitCheck = await OTPUtils.canRequestNewOTPWithType(
				normalizedNewPhone, 
				OTPType.PHONE_CHANGE_NEW
			);

			if (!rateLimitCheck.canRequest) {
				return res.status(429).json({ 
					message: rateLimitCheck.error || `Please wait ${rateLimitCheck.waitTime} seconds before requesting a new code`,
					waitTime: rateLimitCheck.waitTime
				});
			}

			// Generate change token
			const changeToken = crypto.randomBytes(32).toString('hex');
			const changeTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

			// Clean up any existing phone change requests for this user
			await prisma.phoneChangeRequest.deleteMany({
				where: { userId }
			});

			// Create new phone change request (skip current phone verification)
			await prisma.phoneChangeRequest.create({
				data: {
					userId,
					currentPhone: currentUser.phoneNumber,
					newPhone: normalizedNewPhone,
					currentVerified: true, // Skip current phone verification since user is already authenticated
					changeToken,
					expiresAt: changeTokenExpiry
				}
			});

			// Send OTP directly to new phone for verification
			const otpResult = await OTPUtils.createOTPWithType(
				userId, 
				normalizedNewPhone, 
				OTPType.PHONE_CHANGE_NEW
			);

			if (otpResult.success) {
				try {
					await whatsappService.sendOTP({
						to: normalizedNewPhone,
						otp: otpResult.otp!,
					});
					console.log(`Phone change OTP sent to new phone: ${normalizedNewPhone}`);
				} catch (whatsappError) {
					console.error("Error sending phone change OTP:", whatsappError);
				}
			}

			return res.json({
				message: "Phone change request initiated. Please verify your new phone number.",
				changeToken,
				newPhone: normalizedNewPhone
			});

		} catch (error) {
			console.error("Error in phone change request:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/users/me/phone/verify-current:
 *   post:
 *     summary: Verify current phone for phone change
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - changeToken
 *               - otp
 *             properties:
 *               changeToken:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Current phone verified, OTP sent to new phone
 *       400:
 *         description: Invalid token or OTP
 *       500:
 *         description: Server error
 */
router.post(
	"/me/phone/verify-current",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const { changeToken, otp } = req.body;

			if (!changeToken || !otp) {
				return res.status(400).json({ message: "Change token and OTP are required" });
			}

			// Find valid phone change request
			const changeRequest = await prisma.phoneChangeRequest.findFirst({
				where: {
					userId,
					changeToken,
					expiresAt: { gt: new Date() },
					currentVerified: true
				}
			});

			if (!changeRequest) {
				return res.status(400).json({ message: "Invalid or expired change token" });
			}

			// Verify OTP for current phone
			const otpResult = await OTPUtils.validateOTPWithType(
				changeRequest.currentPhone, 
				otp, 
				OTPType.PHONE_CHANGE_CURRENT
			);

			if (!otpResult.success) {
				return res.status(400).json({ message: otpResult.error });
			}

			// Mark current phone as verified
			await prisma.phoneChangeRequest.update({
				where: { id: changeRequest.id },
				data: { currentVerified: true }
			});

			// Send OTP to new phone
			const newOtpResult = await OTPUtils.createOTPWithType(
				userId, 
				changeRequest.newPhone, 
				OTPType.PHONE_CHANGE_NEW
			);

			if (newOtpResult.success) {
				try {
					await whatsappService.sendOTP({
						to: changeRequest.newPhone,
						otp: newOtpResult.otp!,
					});
					console.log(`Phone change OTP sent to new phone: ${changeRequest.newPhone}`);
				} catch (whatsappError) {
					console.error("Error sending OTP to new phone:", whatsappError);
				}
			}

			return res.json({
				message: "Current phone verified. Please verify your new phone number.",
				newPhone: changeRequest.newPhone
			});

		} catch (error) {
			console.error("Error verifying current phone:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/users/me/phone/verify-new:
 *   post:
 *     summary: Verify new phone and complete phone change
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - changeToken
 *               - otp
 *             properties:
 *               changeToken:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Phone number changed successfully
 *       400:
 *         description: Invalid token or OTP
 *       500:
 *         description: Server error
 */
router.post(
	"/me/phone/verify-new",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const { changeToken, otp } = req.body;

			if (!changeToken || !otp) {
				return res.status(400).json({ message: "Change token and OTP are required" });
			}

			// Find valid phone change request with both verifications completed
			const changeRequest = await prisma.phoneChangeRequest.findFirst({
				where: {
					userId,
					changeToken,
					expiresAt: { gt: new Date() },
					currentVerified: true,
					newVerified: false
				}
			});

			if (!changeRequest) {
				return res.status(400).json({ message: "Invalid change token or current phone not verified" });
			}

			// Verify OTP for new phone
			const otpResult = await OTPUtils.validateOTPWithType(
				changeRequest.newPhone, 
				otp, 
				OTPType.PHONE_CHANGE_NEW
			);

			if (!otpResult.success) {
				return res.status(400).json({ message: otpResult.error });
			}

			// Double-check that new phone is still available
			const existingUser = await prisma.user.findFirst({
				where: { 
					phoneNumber: changeRequest.newPhone,
					id: { not: userId }
				}
			});

			if (existingUser) {
				return res.status(400).json({ message: "Phone number is no longer available" });
			}

			// Perform the phone change in a transaction
			await prisma.$transaction(async (tx) => {
				// Update user's phone number
				await tx.user.update({
					where: { id: userId },
					data: {
						phoneNumber: changeRequest.newPhone,
						phoneVerified: true // Mark new phone as verified
					}
				});

				// Mark change request as completed
				await tx.phoneChangeRequest.update({
					where: { id: changeRequest.id },
					data: { newVerified: true }
				});

				// Clean up all phone change requests for this user
				await tx.phoneChangeRequest.deleteMany({
					where: { userId }
				});

				// Invalidate all existing OTPs for both old and new phone numbers
				await tx.phoneVerification.updateMany({
					where: {
						OR: [
							{ phoneNumber: changeRequest.currentPhone },
							{ phoneNumber: changeRequest.newPhone }
						],
						verified: false
					},
					data: { verified: true }
				});
			});

			return res.json({
				message: "Phone number changed successfully",
				newPhoneNumber: changeRequest.newPhone
			});

		} catch (error) {
			console.error("Error completing phone change:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

export default router;
