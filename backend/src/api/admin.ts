import express, {
	Request,
	Response,
	RequestHandler,
} from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import { authenticateToken } from "../middleware/auth";
import { AuthRequest } from "../middleware/auth";
import { requireAdminOrAttestor } from "../lib/permissions";
import { uploadToS3Organized, getS3ObjectStream, deleteFromS3, S3_FOLDERS } from "../lib/storage";
import { adminLoginRateLimiter } from "../middleware/rateLimiter";
import { generateLoginToken, validateLoginToken } from "../middleware/loginToken";
import lateFeeRoutes from "./admin/late-fees";
import mtsaAdminRoutes from "./admin/mtsa";
import kycAdminRoutes from "./admin/kyc";
import internalSignersRoutes from "./admin/internal-signers";
import companySettingsRoutes from "./companySettings";
import { jwtConfig, signingConfig, docusealConfig, serverConfig, ctosConfig } from "../lib/config";
import receiptsRoutes from "./receipts";
import earlySettlementRoutes from "./admin/early-settlement";
import cronRoutes from "./admin/cron";
import pdfLettersRoutes from "./admin/pdf-letters";
import lampiranARoutes from "./admin/lampiran-a";
import accessLogsRoutes from "./admin/access-logs";
import documentLogsRoutes from "./admin/document-logs";
import whatsappService from "../lib/whatsappService";
import { processCSVFile } from "../lib/csvProcessor";
import ReceiptService from "../lib/receiptService";
import { emailService } from "../lib/emailService";

import { CronScheduler } from "../lib/cronScheduler";
import { createLoanOnPendingSignature } from "../lib/loanCreationUtils";
import { TimeUtils } from "../lib/precisionUtils";

// Helper function to get late fee grace period settings from database
async function getLateFeeGraceSettings(prismaClient: any = prisma) {
	try {
		const settings = await prismaClient.systemSettings.findMany({
			where: {
				key: {
					in: ['ENABLE_LATE_FEE_GRACE_PERIOD', 'LATE_FEE_GRACE_DAYS']
				},
				isActive: true
			}
		});

		const enableGraceSetting = settings.find((s: any) => s.key === 'ENABLE_LATE_FEE_GRACE_PERIOD');
		const graceDaysSetting = settings.find((s: any) => s.key === 'LATE_FEE_GRACE_DAYS');

		const isGraceEnabled = enableGraceSetting ? JSON.parse(enableGraceSetting.value) : true;
		const graceDays = graceDaysSetting ? JSON.parse(graceDaysSetting.value) : 3;

		// If grace period is disabled, return 0 days
		return isGraceEnabled ? graceDays : 0;
	} catch (error) {
		console.error('Error fetching late fee grace settings:', error);
		// Default fallback: 3 days grace period
		return 3;
	}
}


// Helper function to clear default flags if loan is no longer overdue
async function clearDefaultFlagsIfNeeded(loanId: string, adminUserId: string) {
	try {
		// Get loan with current repayments to check if still overdue
		const loan = await prisma.loan.findUnique({
			where: { id: loanId },
			include: {
				repayments: {
					where: {
						status: { in: ['PENDING', 'PARTIAL'] }
					}
				},
				application: {
					select: {
						id: true
					}
				}
			}
		});

		if (!loan) {
			console.log(`Loan ${loanId} not found for default flag clearing`);
			return;
		}

		// Skip if loan is already in a terminal or settlement state - don't revert to ACTIVE
		if (loan.status === 'PENDING_DISCHARGE' || loan.status === 'PENDING_EARLY_SETTLEMENT' || loan.status === 'DISCHARGED') {
			console.log(`Loan ${loanId} is in status ${loan.status} - skipping default flag clearing (preserving settlement state)`);
			return;
		}

		// Check if loan has any default flags set
		const hasDefaultFlags = loan.defaultRiskFlaggedAt || loan.defaultedAt || loan.status === 'DEFAULT';
		console.log(`🔍 Checking loan ${loanId} for default flag clearing:`);
		console.log(`  • Current status: ${loan.status}`);
		console.log(`  • Default risk flagged: ${loan.defaultRiskFlaggedAt}`);
		console.log(`  • Defaulted at: ${loan.defaultedAt}`);
		console.log(`  • Has default flags: ${hasDefaultFlags}`);
		console.log(`  • Pending/Partial repayments found: ${loan.repayments.length}`);
		
		if (!hasDefaultFlags) {
			console.log(`Loan ${loanId} has no default flags to clear`);
			return;
		}

		// Check if loan still has overdue payments (considering grace period)
		const today = new Date();
		const gracePeriodDays = await getLateFeeGraceSettings();
		
		const overdueRepayments = loan.repayments.filter(repayment => {
			const dueDate = new Date(repayment.dueDate);
			const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
			const isOverdue = daysOverdue > gracePeriodDays;
			
			console.log(`  📅 Repayment ${repayment.id}: due ${dueDate.toISOString().split('T')[0]}, ${daysOverdue} days overdue, status: ${repayment.status}, beyond grace: ${isOverdue}`);
			
			// Only consider truly overdue (beyond grace period)
			return isOverdue;
		});
		
		console.log(`  🎯 Found ${overdueRepayments.length} repayments beyond grace period (${gracePeriodDays} days)`);

		if (overdueRepayments.length === 0) {
			// No more overdue payments - clear default flags and restore to ACTIVE
			console.log(`Clearing default flags for loan ${loanId} - no overdue payments remaining (grace period: ${gracePeriodDays} days)`);
			
			await prisma.$transaction(async (tx) => {
				// Update loan to clear default flags and set status to ACTIVE
				await tx.loan.update({
					where: { id: loanId },
					data: {
						status: 'ACTIVE',
						defaultRiskFlaggedAt: null,
						defaultedAt: null,
						updatedAt: new Date()
					}
				});

				// Create audit trail entry in LoanDefaultLog
				await tx.loanDefaultLog.create({
					data: {
						loanId: loanId,
						eventType: 'RECOVERED',
						daysOverdue: 0,
						outstandingAmount: 0,
						totalLateFees: 0,
						noticeType: 'RECOVERY_NOTICE',
						processedAt: new Date(),
						metadata: {
							clearedVia: 'ADMIN_PAYMENT_APPROVAL',
							overdueRepaymentsRemaining: 0,
							adminUserId,
							previousStatus: loan.status,
							previousDefaultRiskFlaggedAt: loan.defaultRiskFlaggedAt,
							previousDefaultedAt: loan.defaultedAt,
							reason: 'Payment approved - no overdue payments remaining'
						}
					}
				});

				// Create audit trail entry in LoanApplicationHistory for main audit trail
				if (loan.application?.id) {
					await tx.loanApplicationHistory.create({
						data: {
							applicationId: loan.application.id,
							previousStatus: loan.status,
							newStatus: 'ACTIVE',
							changedBy: adminUserId,
							changeReason: 'Default flags cleared after payment approval',
							notes: 'Payment approved - no overdue payments remaining. Default risk and default flags cleared.',
							metadata: {
								clearedVia: 'ADMIN_PAYMENT_APPROVAL',
								previousDefaultRiskFlaggedAt: loan.defaultRiskFlaggedAt,
								previousDefaultedAt: loan.defaultedAt,
								overdueRepaymentsRemaining: 0
							}
						}
					});
				}

				console.log(`✅ Default flags cleared for loan ${loanId} - restored to ACTIVE status`);
			});
		} else {
			console.log(`Loan ${loanId} still has ${overdueRepayments.length} overdue payment(s) beyond grace period (${gracePeriodDays} days) - keeping default flags`);
		}
	} catch (error) {
		console.error(`Error clearing default flags for loan ${loanId}:`, error);
	}
}

// Helper function to format date for WhatsApp notification
function formatDateForWhatsApp(date: Date): string {
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'Asia/Kuala_Lumpur'
	});
}

// Helper function to get first repayment date for a loan
async function getFirstRepaymentDate(loanId: string, prismaTransaction: any): Promise<Date | null> {
	try {
		const firstRepayment = await prismaTransaction.loanRepayment.findFirst({
			where: { loanId },
			orderBy: { dueDate: 'asc' }
		});
		return firstRepayment?.dueDate || null;
	} catch (error) {
		console.error('Error getting first repayment date:', error);
		return null;
	}
}

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: API endpoints for Admin dashboard
 */

/**
 * Format PKI error messages for better user experience
 */
function formatPKIErrorMessage(rawError: string): {
	userMessage: string;
	technicalDetails: string;
	errorCode: string;
} {
	const errorLower = rawError.toLowerCase();
	
	// MTSA-specific errors
	if (errorLower.includes('invalid pin') || errorLower.includes('wrong pin') || errorLower.includes('pin.*incorrect')) {
		return {
			userMessage: 'The PIN you entered is incorrect. Please check your PIN and try again.',
			technicalDetails: rawError,
			errorCode: 'INVALID_PIN'
		};
	}
	
	if (errorLower.includes('invalid otp') || errorLower.includes('otp.*invalid') || errorLower.includes('otp.*expired')) {
		return {
			userMessage: 'The OTP is invalid or has expired. Please request a new OTP and try again.',
			technicalDetails: rawError,
			errorCode: 'INVALID_OTP'
		};
	}
	
	if (errorLower.includes('certificate not found') || errorLower.includes('cert not found')) {
		return {
			userMessage: 'Digital certificate not found. Please ensure you have a valid certificate enrolled.',
			technicalDetails: rawError,
			errorCode: 'CERTIFICATE_NOT_FOUND'
		};
	}
	
	if (errorLower.includes('certificate.*expired') || errorLower.includes('cert.*expired')) {
		return {
			userMessage: 'Your digital certificate has expired. Please renew your certificate and try again.',
			technicalDetails: rawError,
			errorCode: 'CERTIFICATE_EXPIRED'
		};
	}
	
	if (errorLower.includes('invalid page number')) {
		return {
			userMessage: 'Document signing failed due to page configuration error. Please contact support.',
			technicalDetails: rawError,
			errorCode: 'INVALID_PAGE_NUMBER'
		};
	}
	
	if (errorLower.includes('pdf.*corrupt') || errorLower.includes('invalid.*pdf')) {
		return {
			userMessage: 'The document appears to be corrupted. Please try again or contact support.',
			technicalDetails: rawError,
			errorCode: 'CORRUPT_PDF'
		};
	}
	
	if (errorLower.includes('network') || errorLower.includes('connection') || errorLower.includes('timeout')) {
		return {
			userMessage: 'Network connection issue. Please check your internet connection and try again.',
			technicalDetails: rawError,
			errorCode: 'NETWORK_ERROR'
		};
	}
	
	if (errorLower.includes('mtsa.*failed') || errorLower.includes('signing.*failed')) {
		return {
			userMessage: 'Digital signing service is currently unavailable. Please try again in a few moments.',
			technicalDetails: rawError,
			errorCode: 'SIGNING_SERVICE_ERROR'
		};
	}
	
	// Generic MTSA status code errors
	if (rawError.includes('(001)') || rawError.includes('statusCode: 001')) {
		return {
			userMessage: 'Authentication failed. Please check your credentials and try again.',
			technicalDetails: rawError,
			errorCode: 'AUTH_FAILED'
		};
	}
	
	if (rawError.includes('(002)') || rawError.includes('statusCode: 002')) {
		return {
			userMessage: 'Invalid request format. Please contact support if this issue persists.',
			technicalDetails: rawError,
			errorCode: 'INVALID_REQUEST'
		};
	}
	
	// Default fallback
	return {
		userMessage: 'An unexpected error occurred during digital signing. Please try again or contact support if the issue persists.',
		technicalDetails: rawError,
		errorCode: 'UNKNOWN_ERROR'
	};
}

const router = express.Router();

// Register sub-routes
router.use("/late-fees", lateFeeRoutes);
router.use("/mtsa", mtsaAdminRoutes);
router.use("/kyc", kycAdminRoutes);
router.use("/internal-signers", internalSignersRoutes);
router.use("/company-settings", companySettingsRoutes);
router.use("/receipts", receiptsRoutes);
router.use("/early-settlement", earlySettlementRoutes);
router.use("/cron", cronRoutes);
router.use("/loans", pdfLettersRoutes);
router.use("/loans", lampiranARoutes);
router.use("/access-logs", accessLogsRoutes);
router.use("/document-logs", documentLogsRoutes);

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

// Helper function to track loan status changes using the application history table
export async function trackLoanStatusChange(
	prismaTransaction: any,
	loanId: string,
	previousStatus: string | null,
	newStatus: string,
	changedBy: string | undefined,
	changeReason: string = "Loan status update",
	notes: string | null = null,
	metadata: any = {}
) {
	console.log(
		`Tracking loan status change for loan ${loanId}: ${previousStatus} -> ${newStatus}`
	);

	try {
		// Get the loan's application ID to link to the audit trail
		const loan = await prismaTransaction.loan.findUnique({
			where: { id: loanId },
			select: { applicationId: true },
		});

		if (!loan || !loan.applicationId) {
			console.warn(`Loan ${loanId} not found or missing application ID. Status change not tracked.`);
			return null;
		}

		// Check if the loanApplicationHistory model exists in Prisma
		if (!prismaTransaction.loanApplicationHistory) {
			console.warn(
				"LoanApplicationHistory model not available. Loan status change not tracked."
			);
			return null;
		}

		const historyEntry = await prismaTransaction.loanApplicationHistory.create({
			data: {
				applicationId: loan.applicationId,
				previousStatus,
				newStatus,
				changedBy: changedBy || "SYSTEM",
				changeReason,
				notes: notes || "",
				metadata: {
					...metadata,
					loanId,
					isLoanStatusChange: true,
					timestamp: new Date().toISOString(),
				},
			},
		});

		console.log(`Created loan status history entry: ${historyEntry.id}`);
		return historyEntry;
	} catch (error) {
		console.error("Failed to create loan status history entry:", error);
		// Don't throw, allow the main transaction to continue
		return null;
	}
}

// Import permissions system
import { requireAdmin } from '../lib/permissions';

// Middleware to check if user is admin (legacy compatibility)
// @ts-ignore
const isAdmin = requireAdmin;

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
 *                   enum: [ADMIN, ATTESTOR]
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
 *         description: Access denied, admin or attestor privileges required
 *       500:
 *         description: Server error
 */
// Admin login token endpoint
router.get("/login-token", generateLoginToken as any, ((_req: Request, res: Response): void => {
	const token = res.locals.loginToken;
	if (token) {
		res.json({
			loginToken: token,
			message: "Login token generated successfully",
		});
		return;
	}
	res.status(500).json({ error: "Failed to generate login token" });
}) as any);

// Admin login endpoint
// @ts-ignore
router.post("/login", adminLoginRateLimiter, validateLoginToken as any, async (req: Request, res: Response) => {
	try {
		console.log("Admin login attempt:", req.body);
		const { phoneNumber, password } = req.body;

		// Enhanced validation: Check if phoneNumber and password are strings
		if (!phoneNumber || typeof phoneNumber !== 'string') {
			return res.status(400).json({ 
				error: "Phone number is required and must be a string" 
			});
		}

		if (!password || typeof password !== 'string') {
			return res.status(400).json({ 
				error: "Password is required and must be a string" 
			});
		}

		// Enforce max length limits to prevent DoS attacks
		if (phoneNumber.length > 20) {
			return res.status(400).json({ 
				error: "Invalid phone number format" 
			});
		}

		if (password.length > 128) {
			return res.status(400).json({ 
				error: "Invalid password" 
			});
		}

		// Validate and normalize phone number
		const { validatePhoneNumber, normalizePhoneNumber } = require("../lib/phoneUtils");
		
		const phoneValidation = validatePhoneNumber(phoneNumber, {
			requireMobile: false, // Allow both mobile and landline for admin login
			allowLandline: true
		});

		if (!phoneValidation.isValid) {
			console.log("Invalid phone number format:", phoneNumber);
			return res.status(400).json({ 
				error: phoneValidation.error || "Invalid phone number format" 
			});
		}

		// Normalize phone number for database lookup
		const normalizedPhone = normalizePhoneNumber(phoneNumber);
		console.log("Normalized phone number:", normalizedPhone);

		// Try to find user by normalized phone number first (E.164 format with +)
		let user = await prisma.user.findUnique({
			where: { phoneNumber: normalizedPhone },
		});
		
		// If not found and normalized phone starts with +, try without + prefix
		// This handles cases where phone numbers might be stored without + in database
		if (!user && normalizedPhone.startsWith('+')) {
			const phoneWithoutPlus = normalizedPhone.substring(1);
			console.log("Trying without + prefix:", phoneWithoutPlus);
			user = await prisma.user.findUnique({
				where: { phoneNumber: phoneWithoutPlus },
			});
		}
		
		// If still not found and input didn't start with +, try with + prefix
		// This handles cases where phone numbers might be stored with + in database
		if (!user && !phoneNumber.startsWith('+')) {
			const phoneWithPlus = '+' + phoneNumber;
			console.log("Trying with + prefix:", phoneWithPlus);
			user = await prisma.user.findUnique({
				where: { phoneNumber: phoneWithPlus },
			});
		}

		if (!user) {
			console.log("User not found after trying all formats");
			return res.status(401).json({ error: "Invalid credentials" });
		}

		// Check if user has admin panel access (ADMIN or ATTESTOR)
		if (user.role !== "ADMIN" && user.role !== "ATTESTOR") {
			console.log("Non-admin login attempt:", phoneNumber, "role:", user.role);
			return res
				.status(403)
				.json({ error: "Access denied. Admin or Attestor privileges required." });
		}

	// Verify password
	const validPassword = await bcrypt.compare(password, user.password);
	if (!validPassword) {
		console.log("Invalid password for:", phoneNumber);
		return res.status(401).json({ error: "Invalid credentials" });
	}

	// ALWAYS require OTP verification for admin logins (2FA security)
	console.log("Admin password verified, sending OTP for 2FA verification");
	
	try {
		// Import OTP utilities
		const { OTPUtils } = require("../lib/otpUtils");
		const whatsappService = require("../lib/whatsappService").default;
		
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
					console.error("WhatsApp OTP send failed during admin login:", whatsappResult.error);
				} else {
					console.log("OTP sent successfully to admin:", normalizedPhone);
				}
			}
		}
	} catch (error) {
		console.error("Failed to send OTP during admin login:", error);
		// Continue anyway, user can request resend
	}

	// Return 403 to trigger OTP verification flow
	return res.status(403).json({ 
		message: "Please verify your phone number to complete admin login. We've sent a verification code to your WhatsApp.",
		requiresPhoneVerification: true,
		phoneNumber: user.phoneNumber,
		userId: user.id
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
// Get dashboard stats (admin and attestor)
// @ts-ignore
router.get(
	"/dashboard",
	authenticateToken,
	requireAdminOrAttestor as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const userRole = req.user?.role;

			// ATTESTOR users only need limited data for live attestations and signatures
			if (userRole === "ATTESTOR") {
				// Get pending signature count (applications waiting for signature)
				const pendingSignatureCount = await prisma.loanApplication.count({
					where: {
						status: "PENDING_SIGNATURE",
					},
				});

				// Get live attestation requests count
				const liveAttestationsCount = await prisma.loanApplication.count({
					where: {
						status: "PENDING_ATTESTATION",
						attestationType: "MEETING",
						attestationCompleted: false,
					},
				});

				// Return minimal data for ATTESTOR users
				return res.json({
					// Only data needed for Quick Actions
					PENDING_SIGNATURE: pendingSignatureCount,
					LIVE_ATTESTATIONS: liveAttestationsCount,
					// Keep legacy fields that might be expected by frontend
					totalUsers: 0,
					totalApplications: 0,
					pendingReviewApplications: 0,
					approvedLoans: 0,
					pendingDisbursementCount: 0,
					disbursedLoans: 0,
					totalDisbursedAmount: 0,
					totalLoanValue: 0,
					currentLoanValue: 0,
					totalFeesCollected: 0,
					totalLateFeesCollected: 0,
					totalRepayments: 0,
					recentApplications: [],
					portfolioOverview: {},
					repaymentPerformance: {},
					revenueMetrics: {},
					userInsights: {},
					operationalKPIs: {}
				});
			}

			// ADMIN users get full dashboard data
			// Get all users count
			const totalUsers = await prisma.user.count();

			// Get applications that need review (status = PENDING_APPROVAL or COLLATERAL_REVIEW)
			const pendingReviewApplications =
				await prisma.loanApplication.count({
					where: {
						status: {
							in: ["PENDING_APPROVAL", "COLLATERAL_REVIEW"],
						},
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

			// Get potential default loans count (loans flagged as default risk but not yet defaulted)
			const potentialDefaultLoansCount = await prisma.loan.count({
				where: {
					defaultRiskFlaggedAt: { not: null },
					defaultedAt: null,
					status: { not: "DEFAULT" }
				}
			});

			// Get defaulted loans count (loans with DEFAULT status or defaultedAt flag)
			const defaultedLoansCount = await prisma.loan.count({
				where: {
					OR: [
						{ status: "DEFAULT" },
						{ defaultedAt: { not: null } }
					]
				}
			});

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

			// Calculate total late fees collected (actual late fees paid)
			const totalLateFeesCollectedResult = await prisma.loanRepayment.aggregate({
				_sum: {
					lateFeesPaid: true,
				},
			});

			const totalLateFeesCollected = Math.round(
				(totalLateFeesCollectedResult._sum.lateFeesPaid || 0) * 100
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

					// 🔹 1. LOAN PORTFOLIO OVERVIEW METRICS
		// Industry standard: Include loans with outstanding balances (ACTIVE, OVERDUE, DEFAULT)
		// Exclude: PENDING_DISCHARGE (paid, awaiting admin), PENDING_EARLY_SETTLEMENT (being settled), DISCHARGED (closed)
		const OUTSTANDING_LOAN_STATUSES = ['ACTIVE', 'OVERDUE', 'DEFAULT'];
		
		const activeLoansCount = await prisma.loan.count({
			where: {
				status: {
					in: OUTSTANDING_LOAN_STATUSES
				}
			}
		});

		const totalLoansIssued = await prisma.loan.count();

		// Get total exposure (sum of outstanding balances from loans with outstanding amounts)
		// outstandingBalance = totalAmount + unpaidLateFees - principalPaid
		// This represents the total amount still owed including principal, interest, and late fees
		const totalExposureResult = await prisma.$queryRaw`
			SELECT 
				ROUND(COALESCE(SUM(l."outstandingBalance"), 0)::numeric, 2) as total_exposure
			FROM "loans" l 
			WHERE l.status IN ('ACTIVE', 'OVERDUE', 'DEFAULT')
		` as Array<{total_exposure: number}>;

		const totalExposure = Number(totalExposureResult[0]?.total_exposure) || 0;

		// Get accrued interest (unpaid interest from scheduled repayments on outstanding loans)
		// Uses interestAmount field which represents the actual interest portion of each repayment
		const accruedInterest = await prisma.$queryRaw`
			SELECT 
				ROUND(COALESCE(SUM(lr."interestAmount"), 0)::numeric, 2) as accrued_interest
			FROM "loan_repayments" lr
			JOIN "loans" l ON lr."loanId" = l.id
			WHERE l.status IN ('ACTIVE', 'OVERDUE', 'DEFAULT')
			AND lr."paidAt" IS NULL
		` as Array<{accrued_interest: number}>;

		const accruedInterestValue = Number(accruedInterest[0]?.accrued_interest) || 0;

		// Active Loan Book = Total exposure minus accrued interest (outstanding principal + late fees)
		// This represents the principal amount still owed by borrowers
		const activeLoanBook = Math.max(0, totalExposure - accruedInterestValue);

		// Total Value with Interest = Total Exposure (includes principal + interest + late fees)
		const totalValueWithInterest = totalExposure;
		
		const averageLoanSize = await prisma.loan.aggregate({
			_avg: {
				principalAmount: true,
			},
			where: {
				status: {
					in: ['ACTIVE', 'DISCHARGED', 'PENDING_DISCHARGE']
				}
			}
		});

		const averageLoanTerm = await prisma.loan.aggregate({
			_avg: {
				term: true,
			},
			where: {
				status: {
					in: ['ACTIVE', 'DISCHARGED', 'PENDING_DISCHARGE']
				}
			}
		});

		// 🔹 2. REPAYMENT & PERFORMANCE METRICS
		// Apply 3-day grace period (consistent with late fee processor)
		const GRACE_PERIOD_DAYS = 3;
		
		// Only count repayments that are due (past grace period or paid)
		const totalDueRepayments = await prisma.$queryRaw`
			SELECT COUNT(*) as count
			FROM "loan_repayments" lr
			WHERE lr."dueDate" <= CURRENT_DATE - INTERVAL '${GRACE_PERIOD_DAYS} days'
			OR lr."paidAt" IS NOT NULL
		` as Array<{count: bigint}>;

		// Count on-time payments (paid within grace period after due date)
		const paidOnTimeRepayments = await prisma.$queryRaw`
			SELECT COUNT(*) as count
			FROM "loan_repayments" lr
			WHERE lr."paidAt" IS NOT NULL
			AND lr."paidAt" <= lr."dueDate" + INTERVAL '${GRACE_PERIOD_DAYS} days'
		` as Array<{count: bigint}>;

		const totalDueCount = Number(totalDueRepayments[0]?.count || 0);
		const paidOnTimeCount = Number(paidOnTimeRepayments[0]?.count || 0);

		const repaymentRate = totalDueCount > 0 
			? (paidOnTimeCount / totalDueCount) * 100 
			: 0;

		// Delinquency rate - using loan status instead of hardcoded days
		// The system already sets loan status to 'OVERDUE' when past grace period,
		// and 'DEFAULT' based on the DEFAULT_RISK_DAYS + DEFAULT_REMEDY_DAYS settings
		// This is more accurate as it respects the configured thresholds
		
		// Count loans that are overdue (past grace period but not yet defaulted)
		const overdueLoansCount = await prisma.loan.count({
			where: {
				status: 'OVERDUE'
			}
		});
		
		// Count loans that have been flagged for default risk but not yet defaulted
		const defaultRiskLoansCount = await prisma.loan.count({
			where: {
				defaultRiskFlaggedAt: { not: null },
				defaultedAt: null,
				status: { in: ['ACTIVE', 'OVERDUE'] }
			}
		});
		
		// Count loans that have fully defaulted (reuse defaultedLoansCount from earlier query)
		// Note: defaultedLoansCount is already defined above in the dashboard metrics section
		
		// Delinquency rate = (OVERDUE + DEFAULT loans) / Total outstanding loans
		// This represents loans that are past the grace period
		const totalDelinquentLoans = overdueLoansCount + defaultedLoansCount;
		const delinquencyRate30 = activeLoansCount > 0 ? (totalDelinquentLoans / activeLoansCount) * 100 : 0;
		
		// Default risk rate = Loans flagged for default risk / Total outstanding loans
		// These are loans that have triggered the DEFAULT_RISK_DAYS threshold
		const delinquencyRate60 = activeLoansCount > 0 ? (defaultRiskLoansCount / activeLoansCount) * 100 : 0;
		
		// Actual default rate for this metric (same as delinquencyRate90 historically)
		const delinquencyRate90 = activeLoansCount > 0 ? (defaultedLoansCount / activeLoansCount) * 100 : 0;

		// Default rate (loans in DEFAULT status)
		// Industry standard: default rate = defaulted loans / total loans ever issued
		const defaultRate = totalLoansIssued > 0 ? (defaultedLoansCount / totalLoansIssued) * 100 : 0;

		// Collections in last 30 days
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		
		const collectionsLast30Days = await prisma.walletTransaction.aggregate({
			_sum: {
				amount: true
			},
			where: {
				type: 'LOAN_REPAYMENT',
				status: 'APPROVED',
				processedAt: {
					gte: thirtyDaysAgo
				}
			}
		});

		// Upcoming payments due (next 7 and 30 days)
		const sevenDaysFromNow = new Date();
		sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
		
		const thirtyDaysFromNow = new Date();
		thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

		const upcomingPayments7Days = await prisma.loanRepayment.aggregate({
			_sum: {
				amount: true
			},
			_count: true,
			where: {
				dueDate: {
					gte: new Date(),
					lte: sevenDaysFromNow
				},
				paidAt: null,
				loan: {
					status: 'ACTIVE'
				}
			}
		});

		const upcomingPayments30Days = await prisma.loanRepayment.aggregate({
			_sum: {
				amount: true
			},
			_count: true,
			where: {
				dueDate: {
					gte: new Date(),
					lte: thirtyDaysFromNow
				},
				paidAt: null,
				loan: {
					status: 'ACTIVE'
				}
			}
		});

		// Late payments (overdue right now - includes all outstanding loan statuses)
		const latePayments = await prisma.loanRepayment.aggregate({
			_sum: {
				scheduledAmount: true
			},
			_count: true,
			where: {
				dueDate: {
					lt: new Date()
				},
				paidAt: null,
				loan: {
					status: { in: ['ACTIVE', 'OVERDUE', 'DEFAULT'] }
				}
			}
		});

		// 🔹 3. REVENUE & INTEREST METRICS
		// Get total interest earned from repayments
		// Interest paid = MIN(interestAmount, actualAmount - lateFeesPaid)
		// This follows payment allocation priority: Late Fees → Interest → Principal
		// Include both COMPLETED and PARTIAL repayments since actualAmount reflects actual payments
		const totalInterestEarned = await prisma.$queryRaw`
			SELECT 
				ROUND(COALESCE(SUM(
					GREATEST(0, LEAST(
						lr."interestAmount",
						COALESCE(lr."actualAmount", 0) - COALESCE(lr."lateFeesPaid", 0)
					))
				), 0)::numeric, 2) as total_interest
			FROM "loan_repayments" lr
			WHERE lr.status IN ('COMPLETED', 'PARTIAL')
			AND lr."actualAmount" > 0
		` as Array<{total_interest: number}>;

		// Get total fees earned (upfront fees from disbursed loans)
		const totalFeesEarned = await prisma.$queryRaw`
			SELECT 
				ROUND(SUM(
					COALESCE(la."applicationFee", 0) + 
					COALESCE(la."originationFee", 0) + 
					COALESCE(la."legalFee", 0) +
					COALESCE(la."stampingFee", 0) +
					COALESCE(la."legalFeeFixed", 0)
				)::numeric, 2) as total_fees
			FROM "loan_applications" la
			WHERE la.status IN ('ACTIVE', 'DISBURSED', 'PENDING_DISCHARGE', 'DISCHARGED')
		` as Array<{total_fees: number}>;

		// Calculate ACTUAL portfolio yield based on real collections vs disbursements
		// This gives realized return, not expected/theoretical return
		const totalFees = Number(totalFeesEarned[0]?.total_fees) || 0;
		const penaltyFees = totalLateFeesCollected || 0;
		
		// Get actual interest collected (from paid repayments)
		const actualInterestCollected = Number(totalInterestEarned[0]?.total_interest) || 0;
		
		// Get total principal disbursed (all loans ever issued)
		const totalDisbursedPrincipal = await prisma.$queryRaw`
			SELECT ROUND(COALESCE(SUM(l."principalAmount"), 0)::numeric, 2) as total_principal
			FROM "loans" l
		` as Array<{total_principal: number}>;
		const totalPrincipalDisbursed = Number(totalDisbursedPrincipal[0]?.total_principal) || 0;
		
		// Get weighted average age of the portfolio in months
		// This tells us how long the money has been working
		const portfolioAgeResult = await prisma.$queryRaw`
			SELECT 
				ROUND(
					EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MIN(l."disbursedAt"))) / (30 * 24 * 60 * 60)
				, 2) as portfolio_age_months
			FROM "loans" l
			WHERE l."disbursedAt" IS NOT NULL
		` as Array<{portfolio_age_months: number}>;
		const portfolioAgeMonths = Math.max(1, Number(portfolioAgeResult[0]?.portfolio_age_months) || 1);
		
		// Actual Portfolio Yield = (Total Revenue / Total Principal Disbursed) * (12 / Portfolio Age) * 100
		// Total Revenue = Interest Collected + Fees Collected + Late Fees Collected
		let portfolioYield = 0;
		if (totalPrincipalDisbursed > 0) {
			const totalRevenue = actualInterestCollected + totalFees + penaltyFees;
			// Annualized yield = (Total Revenue / Principal) * (12 / Age in Months) * 100
			portfolioYield = (totalRevenue / totalPrincipalDisbursed) * (12 / portfolioAgeMonths) * 100;
		}

		const averageInterestRate = portfolioYield;

		// 🔹 4. USER & ACCOUNT INSIGHTS
		const totalBorrowers = await prisma.user.count({
			where: {
				loans: {
					some: {}
				}
			}
		});

		const newBorrowersThisMonth = await prisma.user.count({
			where: {
				createdAt: {
					gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
				},
				loans: {
					some: {}
				}
			}
		});

		// Repeat borrowers (users with more than one loan) - use raw query for count
		const repeatBorrowersQuery = await prisma.$queryRaw`
			SELECT COUNT(*) as count
			FROM "users" u
			WHERE (
				SELECT COUNT(*)
				FROM "loans" l
				WHERE l."userId" = u.id
			) > 1
		` as Array<{count: bigint}>;

		const repeatBorrowers = Number(repeatBorrowersQuery[0]?.count || 0);

		const repeatBorrowersRate = totalBorrowers > 0 ? (repeatBorrowers / totalBorrowers) * 100 : 0;

		// Top borrowers by exposure (outstanding balance)
		const topBorrowersByExposure = await prisma.user.findMany({
			select: {
				id: true,
				fullName: true,
				email: true,
				loans: {
					select: {
						outstandingBalance: true
					},
					where: {
						status: 'ACTIVE'
					}
				}
			},
			where: {
				loans: {
					some: {
						status: 'ACTIVE'
					}
				}
			},
			take: 10
		});

		// Calculate total exposure per borrower and sort
		const topBorrowersWithExposure = topBorrowersByExposure
			.map(borrower => ({
				...borrower,
				totalExposure: borrower.loans.reduce((sum, loan) => sum + loan.outstandingBalance, 0)
			}))
			.sort((a, b) => b.totalExposure - a.totalExposure)
			.slice(0, 10);

		// 🔹 5. OPERATIONAL KPIs
		// Application approval ratio (approved vs completed applications only, excluding pending)
		const approvedApplicationsCount = await prisma.loanApplication.count({
			where: {
				status: {
					in: ['APPROVED', 'ACTIVE', 'PENDING_DISBURSEMENT']
				}
			}
		});

		const rejectedApplicationsCount = await prisma.loanApplication.count({
			where: {
				status: 'REJECTED'
			}
		});

		const completedApplicationsCount = approvedApplicationsCount + rejectedApplicationsCount;

		const applicationApprovalRatio = completedApplicationsCount > 0 
			? (approvedApplicationsCount / completedApplicationsCount) * 100 
			: 0;

		// Average loan approval time (from application to approval)
		// Average decision time (from PENDING_APPROVAL to approval/rejection decision)
		const decisionTimes = await prisma.$queryRaw`
			SELECT 
				AVG(EXTRACT(EPOCH FROM (approved_rejected."createdAt" - pending_approval."createdAt")) / 60) as avg_decision_minutes
			FROM "loan_application_history" pending_approval
			JOIN "loan_application_history" approved_rejected 
				ON pending_approval."applicationId" = approved_rejected."applicationId"
			WHERE pending_approval."newStatus" = 'PENDING_APPROVAL'
			AND approved_rejected."newStatus" IN ('APPROVED', 'REJECTED', 'PENDING_ATTESTATION', 'COLLATERAL_REVIEW')
			AND approved_rejected."createdAt" > pending_approval."createdAt"
		` as Array<{avg_decision_minutes: number}>;

		// Average disbursement time (from PENDING_DISBURSEMENT to actual disbursement)
		const disbursementTimes = await prisma.$queryRaw`
			SELECT 
				AVG(EXTRACT(EPOCH FROM (ld."disbursedAt" - pending_disbursement."createdAt")) / 60) as avg_disbursement_minutes
			FROM "loan_application_history" pending_disbursement
			JOIN "loan_disbursements" ld ON pending_disbursement."applicationId" = ld."applicationId"
			WHERE pending_disbursement."newStatus" = 'PENDING_DISBURSEMENT'
			AND ld.status = 'COMPLETED'
			AND ld."disbursedAt" IS NOT NULL
		` as Array<{avg_disbursement_minutes: number}>;

		// Get total applications count
		const totalApplicationsCount = await prisma.loanApplication.count();

	// Get stamping workflow counts
	const pendingStampedAgreements = await prisma.loanApplication.count({
		where: {
			status: "PENDING_STAMPING"
		}
	});

	const completedStampedAgreements = await prisma.loan.count({
		where: {
			pkiStampCertificateUrl: { not: null }
		}
	});

	// Count disbursements without payment slips
	const disbursementsWithoutSlips = await prisma.loanDisbursement.count({
		where: {
			paymentSlipUrl: null
		}
	});

		res.json({
		// Legacy KPIs (keep for backward compatibility)
			totalUsers,
			totalApplications,
			pendingReviewApplications,
			approvedLoans,
			pendingDisbursementCount,
			disbursedLoans,
			potentialDefaultLoansCount,
			defaultedLoansCount,
			pendingStampedAgreements,
			completedStampedAgreements,
			disbursementsWithoutSlips,
			totalDisbursedAmount: totalDisbursedAmount._sum.amount || 0,
			totalLoanValue,
			currentLoanValue,
			totalFeesCollected,
			totalLateFeesCollected,
			totalRepayments,
			recentApplications,

			// 🔹 NEW INDUSTRY-STANDARD LOAN PORTFOLIO KPIs
			// 1. Portfolio Overview
			portfolioOverview: {
				activeLoanBook: activeLoanBook, // Outstanding principal (total exposure - accrued interest)
				numberOfActiveLoans: activeLoansCount,
				totalRepaidAmount: totalRepayments,
				averageLoanSize: averageLoanSize._avg.principalAmount || 0,
				averageLoanTerm: averageLoanTerm._avg.term || 0,
				totalValueWithInterest: totalValueWithInterest, // Total exposure (principal + interest + late fees)
				accruedInterest: accruedInterestValue, // Unpaid interest from scheduled repayments
			},

			// 2. Repayment & Performance
			repaymentPerformance: {
				repaymentRate: Math.round(repaymentRate * 100) / 100,
				delinquencyRate30Days: Math.round(delinquencyRate30 * 100) / 100, // Overdue + Default rate (uses system settings)
				delinquencyRate60Days: Math.round(delinquencyRate60 * 100) / 100, // Default risk rate (flagged but not defaulted)
				delinquencyRate90Days: Math.round(delinquencyRate90 * 100) / 100, // Active default rate (DEFAULT / outstanding)
				defaultRate: Math.round(defaultRate * 100) / 100, // Historical default rate (DEFAULT / total ever issued)
				collectionsLast30Days: Math.abs(collectionsLast30Days._sum.amount || 0),
				upcomingPaymentsDue7Days: {
					amount: upcomingPayments7Days._sum.amount || 0,
					count: upcomingPayments7Days._count || 0
				},
				upcomingPaymentsDue30Days: {
					amount: upcomingPayments30Days._sum.amount || 0,
					count: upcomingPayments30Days._count || 0
				},
				latePayments: {
					amount: latePayments._sum.scheduledAmount || 0,
					count: latePayments._count || 0
				}
			},

			// 3. Revenue & Interest
			revenueMetrics: {
				totalInterestEarned: totalInterestEarned[0]?.total_interest || 0,
				averageInterestRate: averageInterestRate,
				totalFeesEarned: totalFees,
				penaltyFeesCollected: totalLateFeesCollected,
			},

			// 4. User & Account Insights
			userInsights: {
				totalBorrowers,
				newBorrowersThisMonth,
				repeatBorrowersPercentage: Math.round(repeatBorrowersRate * 100) / 100,
				topBorrowersByExposure: topBorrowersWithExposure,
			},

			// 5. Operational KPIs
			operationalKPIs: {
				loanApprovalTime: decisionTimes[0]?.avg_decision_minutes || 0,
				disbursementTime: disbursementTimes[0]?.avg_disbursement_minutes || 0,
				applicationApprovalRatio: Math.round(applicationApprovalRatio * 100) / 100,
				totalApplications: totalApplicationsCount,
			}
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
// Get monthly statistics (admin and attestor)
// @ts-ignore
router.get(
	"/monthly-stats",
	authenticateToken,
	requireAdminOrAttestor as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const userRole = req.user?.role;

			// ATTESTOR users get minimal empty data since they don't need charts
			if (userRole === "ATTESTOR") {
				return res.json({
					monthlyStats: []
				});
			}

			// ADMIN users get full monthly statistics
			// Get the last 6 months of data
			// Use Malaysia timezone (UTC+8) by adding 8 hours to UTC timestamps
			const sixMonthsAgo = new Date();
			sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

			// Get monthly application counts (adding 8 hours to convert UTC to MYT)
			const monthlyApplications = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', "createdAt" + INTERVAL '8 hours') as month,
					COUNT(*) as applications,
					COUNT(CASE WHEN status IN ('APPROVED', 'ACTIVE', 'PENDING_DISBURSEMENT') THEN 1 END) as approvals,
					COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as disbursements
				FROM "loan_applications"
				WHERE "createdAt" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', "createdAt" + INTERVAL '8 hours')
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
					DATE_TRUNC('month', "createdAt" + INTERVAL '8 hours') as month,
					COUNT(*) as users,
					COUNT(CASE WHEN "kycStatus" = true THEN 1 END) as kyc_users
				FROM "users"
				WHERE "createdAt" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', "createdAt" + INTERVAL '8 hours')
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				users: bigint;
				kyc_users: bigint;
			}>;

			// Get monthly disbursement amounts and counts using loan_disbursement table
			const monthlyDisbursements = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', ld."disbursedAt" + INTERVAL '8 hours') as month,
					ROUND(SUM(COALESCE(ld.amount, 0))::numeric, 2) as total_amount,
					COUNT(*) as disbursement_count
				FROM "loan_disbursements" ld
				WHERE ld.status = 'COMPLETED' 
				AND ld."disbursedAt" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', ld."disbursedAt" + INTERVAL '8 hours')
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				total_amount: number;
				disbursement_count: bigint;
			}>;

			// Get monthly actual repayments from wallet_transactions (actual cash collected)
			const monthlyRepayments = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', wt."processedAt" + INTERVAL '8 hours') as month,
					ROUND(SUM(ABS(COALESCE(wt.amount, 0)))::numeric, 2) as actual_repayments,
					COUNT(*) as repayment_count
				FROM "wallet_transactions" wt
				WHERE wt.type = 'LOAN_REPAYMENT' 
				AND wt.status = 'APPROVED'
				AND wt."processedAt" IS NOT NULL
				AND wt."processedAt" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', wt."processedAt" + INTERVAL '8 hours')
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				actual_repayments: number;
				repayment_count: bigint;
			}>;

			// Get monthly fees earned from disbursed applications (origination, legal, etc.)
			const monthlyOriginationFees = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', la."updatedAt" + INTERVAL '8 hours') as month,
					ROUND(SUM(
						COALESCE(la."applicationFee", 0) + 
						COALESCE(la."originationFee", 0) + 
						COALESCE(la."legalFee", 0) +
						COALESCE(la."stampingFee", 0) +
						COALESCE(la."legalFeeFixed", 0)
					)::numeric, 2) as origination_fees
				FROM "loan_applications" la
				WHERE la.status IN ('ACTIVE', 'DISBURSED', 'PENDING_DISCHARGE', 'DISCHARGED')
				AND la."updatedAt" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', la."updatedAt" + INTERVAL '8 hours')
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				origination_fees: number;
			}>;

			// Get monthly late fees (penalty fees) collected from repayments
			const monthlyLateFees = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', lr."paidAt" + INTERVAL '8 hours') as month,
					ROUND(COALESCE(SUM(lr."lateFeesPaid"), 0)::numeric, 2) as late_fees
				FROM "loan_repayments" lr
				WHERE lr."lateFeesPaid" > 0
				AND lr."paidAt" IS NOT NULL
				AND lr."paidAt" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', lr."paidAt" + INTERVAL '8 hours')
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				late_fees: number;
			}>;

			// Get monthly accrued interest (cumulative unpaid interest as of each month-end)
			const monthlyAccruedInterest = [];
			const currentMonth = new Date();
			
			for (let i = 5; i >= 0; i--) {
				const targetMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
				const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
				
				// Calculate total accrued interest as of this month-end using interestAmount field
				// (all unpaid repayments that were due on or before this month-end)
				// Include ACTIVE, OVERDUE, DEFAULT - exclude DISCHARGED, PENDING_DISCHARGE, PENDING_EARLY_SETTLEMENT
				const accruedResult = await prisma.$queryRaw`
					SELECT 
						ROUND(COALESCE(SUM(lr."interestAmount"), 0)::numeric, 2) as accrued_interest
					FROM "loan_repayments" lr
					JOIN "loans" l ON lr."loanId" = l.id
					WHERE l.status IN ('ACTIVE', 'OVERDUE', 'DEFAULT')
					AND lr."paidAt" IS NULL
					AND lr."dueDate" <= ${monthEnd}
				` as Array<{accrued_interest: number}>;
				
				monthlyAccruedInterest.push({
					month: targetMonth,
					accrued_interest: Number(accruedResult[0]?.accrued_interest) || 0
				});
			}

			// Get monthly scheduled repayments using scheduledAmount from loan_repayments
			const monthlyScheduledRepayments = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', lr."dueDate" + INTERVAL '8 hours') as month,
					ROUND(SUM(COALESCE(lr."scheduledAmount", lr.amount))::numeric, 2) as scheduled_repayments,
					COUNT(*) as scheduled_count
				FROM "loan_repayments" lr
				WHERE lr."dueDate" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', lr."dueDate" + INTERVAL '8 hours')
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				scheduled_repayments: number;
				scheduled_count: bigint;
			}>;

			// Get monthly TLV using totalAmount from loans table
			const monthlyTLV = (await prisma.$queryRaw`
				SELECT 
					DATE_TRUNC('month', l."createdAt" + INTERVAL '8 hours') as month,
					ROUND(SUM(COALESCE(l."totalAmount", l."principalAmount"))::numeric, 2) as total_loan_value
				FROM "loans" l
				WHERE l.status IN ('ACTIVE', 'PENDING_DISCHARGE', 'DISCHARGED')
				AND l."createdAt" >= ${sixMonthsAgo}
				GROUP BY DATE_TRUNC('month', l."createdAt" + INTERVAL '8 hours')
				ORDER BY month ASC
			`) as Array<{
				month: Date;
				total_loan_value: number;
			}>;

			// Calculate monthly current loan value using actual outstanding balances
			// Include loans with outstanding amounts (ACTIVE, OVERDUE, DEFAULT)
			// Exclude: PENDING_DISCHARGE (paid), PENDING_EARLY_SETTLEMENT (being settled), DISCHARGED (closed)
			const actualCurrentLoanValue = await prisma.loan.aggregate({
				_sum: {
					outstandingBalance: true,
				},
				where: {
					status: {
						in: ["ACTIVE", "OVERDUE", "DEFAULT"],
					},
				},
			});

			const monthlyBaselineLoanValue = actualCurrentLoanValue._sum.outstandingBalance || 0;

			// Calculate actual monthly current loan values using historical data
			// For each month, calculate what the outstanding balance was at month-end
			const monthlyCurrentLoanValue = [];
			
			for (let i = 5; i >= 0; i--) {
				const targetMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
				const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
				
				if (i === 0) {
					// Current month uses actual current value
					monthlyCurrentLoanValue.push({
						month: targetMonth,
						current_loan_value: Math.round(monthlyBaselineLoanValue * 100) / 100,
					});
				} else {
					// For historical months, calculate based on:
					// Current outstanding + repayments made since month-end - disbursements since month-end
					const repaymentsSinceMonthEnd = await prisma.$queryRaw`
						SELECT ROUND(COALESCE(SUM(ABS(wt.amount)), 0)::numeric, 2) as total_repayments
						FROM "wallet_transactions" wt
						WHERE wt.type = 'LOAN_REPAYMENT' 
						AND wt.status = 'APPROVED'
						AND wt."processedAt" > ${monthEnd}
					` as Array<{total_repayments: number}>;
					
					const disbursementsSinceMonthEnd = await prisma.$queryRaw`
						SELECT ROUND(COALESCE(SUM(ld.amount), 0)::numeric, 2) as total_disbursements
						FROM "loan_disbursements" ld
						WHERE ld.status = 'COMPLETED'
						AND ld."disbursedAt" > ${monthEnd}
					` as Array<{total_disbursements: number}>;
					
					const repayments = Number(repaymentsSinceMonthEnd[0]?.total_repayments) || 0;
					const disbursements = Number(disbursementsSinceMonthEnd[0]?.total_disbursements) || 0;
					
					// Historical value = current + repayments made since then - new loans disbursed since then
					const historicalValue = Math.max(0, monthlyBaselineLoanValue + repayments - disbursements);
					
					monthlyCurrentLoanValue.push({
						month: targetMonth,
						current_loan_value: Math.round(historicalValue * 100) / 100,
					});
				}
			}

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
			// Create maps for origination fees and late fees, then combine
			const originationFeesMap = new Map(
				monthlyOriginationFees.map((f) => [
					f.month.toISOString(),
					Number(f.origination_fees) || 0,
				])
			);
			const lateFeesMap = new Map(
				monthlyLateFees.map((f) => [
					f.month.toISOString(),
					Number(f.late_fees) || 0,
				])
			);
			// Combined fees map (origination + late fees)
			const allMonthKeys = new Set([...originationFeesMap.keys(), ...lateFeesMap.keys()]);
			const feesMap = new Map(
				Array.from(allMonthKeys).map((monthKey) => [
					monthKey,
					{
						fees_earned: (originationFeesMap.get(monthKey) || 0) + (lateFeesMap.get(monthKey) || 0),
					},
				])
			);
			const accruedInterestMap = new Map(
				monthlyAccruedInterest.map((a) => [
					a.month.toISOString(),
					{
						accrued_interest: Number(a.accrued_interest) || 0,
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

			// Build maps from applications data for lookup
			const applicationMap = new Map(
				monthlyApplications.map((a) => [
					a.month.toISOString(),
					{
						applications: Number(a.applications),
						approvals: Number(a.approvals),
						disbursements: Number(a.disbursements),
					},
				])
			);

			// Get current values directly (same as dashboard calculation)
			const currentOutstandingBalance = await prisma.loan.aggregate({
				_sum: { outstandingBalance: true },
				where: { status: { in: ["ACTIVE", "OVERDUE", "DEFAULT"] } },
			});
			const currentAccruedInterestQuery = await prisma.$queryRaw`
				SELECT ROUND(COALESCE(SUM(lr."interestAmount"), 0)::numeric, 2) as accrued_interest
				FROM "loan_repayments" lr
				JOIN "loans" l ON lr."loanId" = l.id
				WHERE l.status IN ('ACTIVE', 'OVERDUE', 'DEFAULT')
				AND lr."paidAt" IS NULL
			` as Array<{accrued_interest: number}>;
			
			const currentLoanValueActual = currentOutstandingBalance._sum.outstandingBalance || 0;
			const currentAccruedInterestValue = Number(currentAccruedInterestQuery[0]?.accrued_interest) || 0;

			// Build result by iterating through all 6 months
			// This ensures we show data even if there were no applications in a month
			const result = [];
			const now = new Date();
			
			for (let i = 5; i >= 0; i--) {
				// Generate month start date in MYT (add 8 hours offset consideration)
				const targetMonth = new Date(
					now.getFullYear(),
					now.getMonth() - i,
					1
				);
				const monthStr = targetMonth.toLocaleDateString("en-US", {
					month: "short",
				});
				
				// Generate the ISO key that matches the database DATE_TRUNC result
				// DATE_TRUNC('month', ... + INTERVAL '8 hours') returns first day of month at 00:00:00 UTC
				const monthKeyDate = new Date(Date.UTC(
					targetMonth.getFullYear(),
					targetMonth.getMonth(),
					1, 0, 0, 0, 0
				));
				const monthKey = monthKeyDate.toISOString();
				
				// Lookup data from all maps
				const applicationData = applicationMap.get(monthKey) || {
					applications: 0,
					approvals: 0,
					disbursements: 0,
				};
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
				const scheduledRepaymentsData = scheduledRepaymentsMap.get(monthKey) || {
					scheduled_repayments: 0,
					scheduled_count: 0,
				};
				const tlvData = tlvMap.get(monthKey) || {
					total_loan_value: 0,
				};
				const currentLoanValueData = currentLoanValueMap.get(monthKey) || {
					current_loan_value: 0,
				};
				const feesData = feesMap.get(monthKey) || {
					fees_earned: 0,
				};
				const accruedInterestData = accruedInterestMap.get(monthKey) || {
					accrued_interest: 0,
				};
				
				// For current month (i === 0), use actual current values
				const isCurrentMonth = i === 0;
				
				result.push({
					month: monthStr,
					applications: applicationData.applications,
					approvals: applicationData.approvals,
					disbursements: applicationData.disbursements,
					revenue: Math.round(repaymentsData.actual_repayments * 0.15 * 100) / 100,
					fees_earned: feesData.fees_earned,
					accrued_interest: isCurrentMonth 
						? Math.round(currentAccruedInterestValue * 100) / 100 
						: accruedInterestData.accrued_interest,
					disbursement_amount: disbursementData.total_amount,
					disbursement_count: disbursementData.disbursement_count,
					users: userData.users,
					kyc_users: userData.kyc_users,
					actual_repayments: Math.round(repaymentsData.actual_repayments * 100) / 100,
					scheduled_repayments: Math.round(scheduledRepaymentsData.scheduled_repayments * 100) / 100,
					total_loan_value: Math.round(tlvData.total_loan_value * 100) / 100,
					current_loan_value: isCurrentMonth 
						? Math.round(currentLoanValueActual * 100) / 100 
						: Math.round(currentLoanValueData.current_loan_value * 100) / 100,
					repayment_count: repaymentsData.repayment_count,
					scheduled_count: scheduledRepaymentsData.scheduled_count,
				});
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
 * /api/admin/daily-stats:
 *   get:
 *     summary: Get daily statistics for dashboard charts (last 30 days)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daily statistics data for the last 30 days
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dailyStats:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
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
// Get daily statistics (admin and attestor)
// @ts-ignore
router.get(
	"/daily-stats",
	authenticateToken,
	requireAdminOrAttestor as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const userRole = req.user?.role;

			// ATTESTOR users get minimal empty data since they don't need charts
			if (userRole === "ATTESTOR") {
				return res.json({
					dailyStats: []
				});
			}

			// ADMIN users get full daily statistics
			// Get the last 30 days of data (including today)
			// Use Malaysia timezone (UTC+8) for consistent date handling
			// Since DB stores UTC, we add 8 hours to convert to MYT before extracting date
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

			// Get daily application counts (adding 8 hours to convert UTC to MYT)
			const dailyApplications = (await prisma.$queryRaw`
				SELECT 
					DATE("createdAt" + INTERVAL '8 hours') as date,
					COUNT(*) as applications,
					COUNT(CASE WHEN status IN ('APPROVED', 'ACTIVE', 'PENDING_DISBURSEMENT') THEN 1 END) as approvals,
					COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as disbursements
				FROM "loan_applications"
				WHERE "createdAt" >= ${thirtyDaysAgo}
				GROUP BY DATE("createdAt" + INTERVAL '8 hours')
				ORDER BY date ASC
			`) as Array<{
				date: Date;
				applications: bigint;
				approvals: bigint;
				disbursements: bigint;
			}>;

			// Get daily user registrations and KYC completions
			const dailyUsers = (await prisma.$queryRaw`
				SELECT 
					DATE("createdAt" + INTERVAL '8 hours') as date,
					COUNT(*) as users,
					COUNT(CASE WHEN "kycStatus" = true THEN 1 END) as kyc_users
				FROM "users"
				WHERE "createdAt" >= ${thirtyDaysAgo}
				GROUP BY DATE("createdAt" + INTERVAL '8 hours')
				ORDER BY date ASC
			`) as Array<{
				date: Date;
				users: bigint;
				kyc_users: bigint;
			}>;

			// Get daily disbursement amounts and counts using loan_disbursement table
			const dailyDisbursements = (await prisma.$queryRaw`
				SELECT 
					DATE(ld."disbursedAt" + INTERVAL '8 hours') as date,
					ROUND(SUM(COALESCE(ld.amount, 0))::numeric, 2) as total_amount,
					COUNT(*) as disbursement_count
				FROM "loan_disbursements" ld
				WHERE ld.status = 'COMPLETED' 
				AND ld."disbursedAt" >= ${thirtyDaysAgo}
				GROUP BY DATE(ld."disbursedAt" + INTERVAL '8 hours')
				ORDER BY date ASC
			`) as Array<{
				date: Date;
				total_amount: number;
				disbursement_count: bigint;
			}>;

			// Get daily actual repayments from wallet_transactions (actual cash collected)
			const dailyRepayments = (await prisma.$queryRaw`
				SELECT 
					DATE(wt."processedAt" + INTERVAL '8 hours') as date,
					ROUND(SUM(ABS(COALESCE(wt.amount, 0)))::numeric, 2) as actual_repayments,
					COUNT(*) as repayment_count
				FROM "wallet_transactions" wt
				WHERE wt.type = 'LOAN_REPAYMENT' 
				AND wt.status = 'APPROVED'
				AND wt."processedAt" IS NOT NULL
				AND wt."processedAt" >= ${thirtyDaysAgo}
				GROUP BY DATE(wt."processedAt" + INTERVAL '8 hours')
				ORDER BY date ASC
			`) as Array<{
				date: Date;
				actual_repayments: number;
				repayment_count: bigint;
			}>;

			// Get daily fees earned from disbursed applications (origination, legal, etc.)
			const dailyOriginationFees = (await prisma.$queryRaw`
				SELECT 
					DATE(la."updatedAt" + INTERVAL '8 hours') as date,
					ROUND(SUM(
						COALESCE(la."applicationFee", 0) + 
						COALESCE(la."originationFee", 0) + 
						COALESCE(la."legalFee", 0) +
						COALESCE(la."stampingFee", 0) +
						COALESCE(la."legalFeeFixed", 0)
					)::numeric, 2) as origination_fees
				FROM "loan_applications" la
				WHERE la.status IN ('ACTIVE', 'DISBURSED', 'PENDING_DISCHARGE', 'DISCHARGED')
				AND la."updatedAt" >= ${thirtyDaysAgo}
				GROUP BY DATE(la."updatedAt" + INTERVAL '8 hours')
				ORDER BY date ASC
			`) as Array<{
				date: Date;
				origination_fees: number;
			}>;

			// Get daily late fees (penalty fees) collected from repayments
			const dailyLateFees = (await prisma.$queryRaw`
				SELECT 
					DATE(lr."paidAt" + INTERVAL '8 hours') as date,
					ROUND(COALESCE(SUM(lr."lateFeesPaid"), 0)::numeric, 2) as late_fees
				FROM "loan_repayments" lr
				WHERE lr."lateFeesPaid" > 0
				AND lr."paidAt" IS NOT NULL
				AND lr."paidAt" >= ${thirtyDaysAgo}
				GROUP BY DATE(lr."paidAt" + INTERVAL '8 hours')
				ORDER BY date ASC
			`) as Array<{
				date: Date;
				late_fees: number;
			}>;

			// Get daily accrued interest (cumulative unpaid interest as of each date)
			// This calculates the total accrued interest for each day in the last 30 days using interestAmount field
			const dailyAccruedInterest = [];
			
			// Use Malaysia timezone for date iteration (UTC+8)
			const nowUTC = new Date();
			for (let i = 29; i >= 0; i--) {
				const targetDate = new Date(nowUTC);
				targetDate.setDate(nowUTC.getDate() - i);
				// Set to end of day in MYT (which is 16:00 UTC = midnight MYT next day)
				targetDate.setUTCHours(16, 0, 0, 0);
				
				// Calculate total accrued interest as of this date using interestAmount field
				// (all unpaid repayments that were due on or before this date)
				// Include ACTIVE, OVERDUE, DEFAULT - exclude DISCHARGED, PENDING_DISCHARGE, PENDING_EARLY_SETTLEMENT
				const accruedResult = await prisma.$queryRaw`
					SELECT 
						ROUND(COALESCE(SUM(lr."interestAmount"), 0)::numeric, 2) as accrued_interest
					FROM "loan_repayments" lr
					JOIN "loans" l ON lr."loanId" = l.id
					WHERE l.status IN ('ACTIVE', 'OVERDUE', 'DEFAULT')
					AND lr."paidAt" IS NULL
					AND lr."dueDate" <= ${targetDate}
				` as Array<{accrued_interest: number}>;
				
				dailyAccruedInterest.push({
					date: targetDate,
					accrued_interest: Number(accruedResult[0]?.accrued_interest) || 0
				});
			}

			// Get daily scheduled repayments using scheduledAmount from loan_repayments
			const dailyScheduledRepayments = (await prisma.$queryRaw`
				SELECT 
					DATE(lr."dueDate" + INTERVAL '8 hours') as date,
					ROUND(SUM(COALESCE(lr."scheduledAmount", lr.amount))::numeric, 2) as scheduled_repayments,
					COUNT(*) as scheduled_count
				FROM "loan_repayments" lr
				WHERE lr."dueDate" >= ${thirtyDaysAgo}
				GROUP BY DATE(lr."dueDate" + INTERVAL '8 hours')
				ORDER BY date ASC
			`) as Array<{
				date: Date;
				scheduled_repayments: number;
				scheduled_count: bigint;
			}>;

			// Get daily TLV using totalAmount from loans table
			const dailyTLV = (await prisma.$queryRaw`
				SELECT 
					DATE(l."createdAt" + INTERVAL '8 hours') as date,
					ROUND(SUM(COALESCE(l."totalAmount", l."principalAmount"))::numeric, 2) as total_loan_value
				FROM "loans" l
				WHERE l.status IN ('ACTIVE', 'PENDING_DISCHARGE', 'DISCHARGED')
				AND l."createdAt" >= ${thirtyDaysAgo}
				GROUP BY DATE(l."createdAt" + INTERVAL '8 hours')
				ORDER BY date ASC
			`) as Array<{
				date: Date;
				total_loan_value: number;
			}>;

			// Calculate daily current loan value using actual outstanding balances
			// Include loans with outstanding amounts (ACTIVE, OVERDUE, DEFAULT)
			// Exclude: PENDING_DISCHARGE (paid), PENDING_EARLY_SETTLEMENT (being settled), DISCHARGED (closed)
			const actualCurrentLoanValue = await prisma.loan.aggregate({
				_sum: {
					outstandingBalance: true,
				},
				where: {
					status: {
						in: ["ACTIVE", "OVERDUE", "DEFAULT"],
					},
				},
			});

			// Start with actual current loan value and work day by day
			let baselineLoanValue = actualCurrentLoanValue._sum.outstandingBalance || 0;

			// Calculate daily changes for the 30-day period using actual transaction data
			const dailyCurrentLoanValue = [];
			
			for (let i = 29; i >= 0; i--) {
				const targetDate = new Date(nowUTC);
				targetDate.setDate(nowUTC.getDate() - i);
				// Set to end of day in MYT (16:00 UTC = midnight MYT next day)
				targetDate.setUTCHours(16, 0, 0, 0);

				let dailyValue;
				if (i === 0) {
					// Today should show the actual current loan value
					dailyValue = baselineLoanValue;
				} else {
					// For historical days, calculate based on:
					// Current outstanding + repayments made since that date - disbursements since that date
					const repaymentsSinceDate = await prisma.$queryRaw`
						SELECT ROUND(COALESCE(SUM(ABS(wt.amount)), 0)::numeric, 2) as total_repayments
						FROM "wallet_transactions" wt
						WHERE wt.type = 'LOAN_REPAYMENT' 
						AND wt.status = 'APPROVED'
						AND wt."processedAt" > ${targetDate}
					` as Array<{total_repayments: number}>;
					
					const disbursementsSinceDate = await prisma.$queryRaw`
						SELECT ROUND(COALESCE(SUM(ld.amount), 0)::numeric, 2) as total_disbursements
						FROM "loan_disbursements" ld
						WHERE ld.status = 'COMPLETED'
						AND ld."disbursedAt" > ${targetDate}
					` as Array<{total_disbursements: number}>;
					
					const repayments = Number(repaymentsSinceDate[0]?.total_repayments) || 0;
					const disbursements = Number(disbursementsSinceDate[0]?.total_disbursements) || 0;
					
					// Historical value = current + repayments made since then - new loans disbursed since then
					dailyValue = Math.max(0, baselineLoanValue + repayments - disbursements);
				}

				dailyCurrentLoanValue.push({
					date: targetDate,
					current_loan_value: Math.round(dailyValue * 100) / 100,
				});
			}

			// Create a map for easy lookup
			const userMap = new Map(
				dailyUsers.map((u) => [
					u.date.toISOString().split('T')[0],
					{ users: Number(u.users), kyc_users: Number(u.kyc_users) },
				])
			);
			const disbursementMap = new Map(
				dailyDisbursements.map((d) => [
					d.date.toISOString().split('T')[0],
					{
						total_amount: d.total_amount || 0,
						disbursement_count: Number(d.disbursement_count),
					},
				])
			);
			const repaymentsMap = new Map(
				dailyRepayments.map((r) => [
					r.date.toISOString().split('T')[0],
					{
						actual_repayments: Number(r.actual_repayments) || 0,
						repayment_count: Number(r.repayment_count),
					},
				])
			);
			// Create maps for origination fees and late fees, then combine
			const originationFeesMap = new Map(
				dailyOriginationFees.map((f) => [
					f.date.toISOString().split('T')[0],
					Number(f.origination_fees) || 0,
				])
			);
			const lateFeesMap = new Map(
				dailyLateFees.map((f) => [
					f.date.toISOString().split('T')[0],
					Number(f.late_fees) || 0,
				])
			);
			// Combined fees map (origination + late fees)
			const allDateKeys = new Set([...originationFeesMap.keys(), ...lateFeesMap.keys()]);
			const feesMap = new Map(
				Array.from(allDateKeys).map((dateKey) => [
					dateKey,
					{
						fees_earned: (originationFeesMap.get(dateKey) || 0) + (lateFeesMap.get(dateKey) || 0),
					},
				])
			);
			const accruedInterestMap = new Map(
				dailyAccruedInterest.map((a) => [
					a.date.toISOString().split('T')[0],
					{
						accrued_interest: Number(a.accrued_interest) || 0,
					},
				])
			);
			const scheduledRepaymentsMap = new Map(
				dailyScheduledRepayments.map((s) => [
					s.date.toISOString().split('T')[0],
					{
						scheduled_repayments:
							Number(s.scheduled_repayments) || 0,
						scheduled_count: Number(s.scheduled_count),
					},
				])
			);
			const tlvMap = new Map(
				dailyTLV.map((t) => [
					t.date.toISOString().split('T')[0],
					{
						total_loan_value: Number(t.total_loan_value) || 0,
					},
				])
			);
			const currentLoanValueMap = new Map(
				dailyCurrentLoanValue.map((c) => [
					c.date.toISOString().split('T')[0],
					{
						current_loan_value: Number(c.current_loan_value) || 0,
					},
				])
			);

			// Format the data for the frontend
			// Create a comprehensive map of all data first
			const applicationMap = new Map(
				dailyApplications.map((a) => [
					a.date.toISOString().split('T')[0],
					{
						applications: Number(a.applications),
						approvals: Number(a.approvals),
						disbursements: Number(a.disbursements),
					},
				])
			);

			// Get current values directly (same as dashboard calculation) for today's data
			const currentOutstandingBalance = await prisma.loan.aggregate({
				_sum: { outstandingBalance: true },
				where: { status: { in: ["ACTIVE", "OVERDUE", "DEFAULT"] } },
			});
			const currentAccruedInterestResult = await prisma.$queryRaw`
				SELECT ROUND(COALESCE(SUM(lr."interestAmount"), 0)::numeric, 2) as accrued_interest
				FROM "loan_repayments" lr
				JOIN "loans" l ON lr."loanId" = l.id
				WHERE l.status IN ('ACTIVE', 'OVERDUE', 'DEFAULT')
				AND lr."paidAt" IS NULL
			` as Array<{accrued_interest: number}>;
			
			const todayCurrentLoanValue = currentOutstandingBalance._sum.outstandingBalance || 0;
			const todayAccruedInterest = Number(currentAccruedInterestResult[0]?.accrued_interest) || 0;
			
			// Generate today's date key in Malaysia timezone (YYYY-MM-DD)
			// MYT is UTC+8, so add 8 hours to current UTC time
			const nowForKey = new Date(Date.now() + 8 * 60 * 60 * 1000);
			const todayDateKey = nowForKey.toISOString().split('T')[0];

			// Pre-generate all 30 days and format data
			const dailyStats = [];
			for (let i = 29; i >= 0; i--) {
				// Generate date key in MYT
				const targetDateForKey = new Date(Date.now() + 8 * 60 * 60 * 1000);
				targetDateForKey.setDate(targetDateForKey.getDate() - i);
				const dateKey = targetDateForKey.toISOString().split('T')[0];
				
				const applicationData = applicationMap.get(dateKey) || {
					applications: 0,
					approvals: 0,
					disbursements: 0,
				};
				const disbursementData = disbursementMap.get(dateKey) || {
					total_amount: 0,
					disbursement_count: 0,
				};
				const userData = userMap.get(dateKey) || {
					users: 0,
					kyc_users: 0,
				};
				const repaymentsData = repaymentsMap.get(dateKey) || {
					actual_repayments: 0,
					repayment_count: 0,
				};
				const scheduledRepaymentsData = scheduledRepaymentsMap.get(
					dateKey
				) || {
					scheduled_repayments: 0,
					scheduled_count: 0,
				};
				const tlvData = tlvMap.get(dateKey) || {
					total_loan_value: 0,
				};
				const currentLoanValueData = currentLoanValueMap.get(
					dateKey
				) || {
					current_loan_value: 0,
				};
				const feesData = feesMap.get(dateKey) || {
					fees_earned: 0,
				};
				const accruedInterestData = accruedInterestMap.get(dateKey) || {
					accrued_interest: 0,
				};

				// For today, use actual current values to match dashboard cards exactly
				const isToday = dateKey === todayDateKey;
				
				dailyStats.push({
					date: dateKey,
					applications: applicationData.applications,
					approvals: applicationData.approvals,
					disbursements: applicationData.disbursements,
					revenue: Math.round(repaymentsData.actual_repayments * 0.15 * 100) / 100,
					fees_earned: feesData.fees_earned,
					accrued_interest: isToday 
						? Math.round(todayAccruedInterest * 100) / 100 
						: accruedInterestData.accrued_interest,
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
					current_loan_value: isToday 
						? Math.round(todayCurrentLoanValue * 100) / 100 
						: Math.round(currentLoanValueData.current_loan_value * 100) / 100,
					repayment_count: repaymentsData.repayment_count,
					scheduled_count: scheduledRepaymentsData.scheduled_count,
				});
			}

			res.json({ dailyStats: dailyStats });
		} catch (error) {
			console.error("Error fetching daily stats:", error);
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
				icNumber: true,
				icType: true,
				kycStatus: true,
				isOnboardingComplete: true,
				city: true,
				state: true,
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
 * /api/admin/users:
 *   post:
 *     summary: Create a new user (admin only)
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
 *               - phoneNumber
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN, ATTESTOR]
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input or user already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
// Create new user (protected admin route)
router.post(
	"/users",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { fullName, email, phoneNumber, password, role } = req.body;

			// Validate required fields
			if (!phoneNumber || !password) {
				return res.status(400).json({ error: "Phone number and password are required" });
			}

			// Validate password
			if (password.length < 8) {
				return res.status(400).json({ error: "Password must be at least 8 characters long" });
			}

			// Import phone utilities
			const { validatePhoneNumber, normalizePhoneNumber } = require("../lib/phoneUtils");
			
			// Validate phone number format
			const phoneValidation = validatePhoneNumber(phoneNumber, {
				requireMobile: false,
				allowLandline: true
			});

			if (!phoneValidation.isValid) {
				return res.status(400).json({ 
					error: phoneValidation.error || "Invalid phone number format" 
				});
			}

			// Normalize phone number
			const normalizedPhone = normalizePhoneNumber(phoneNumber);

			// Check if user already exists
			const existingUser = await prisma.user.findFirst({
				where: { phoneNumber: normalizedPhone }
			});

			if (existingUser) {
				return res.status(400).json({ 
					error: "A user with this phone number already exists" 
				});
			}

			// Check if email is already taken (if provided)
			if (email) {
				const existingEmail = await prisma.user.findFirst({
					where: { email }
				});

				if (existingEmail) {
					return res.status(400).json({ 
						error: "A user with this email already exists" 
					});
				}
			}

			// Hash password
			const bcrypt = require("bcryptjs");
			const hashedPassword = await bcrypt.hash(password, 10);

			// Create user with phone verified (admin-created users skip OTP verification)
			const newUser = await prisma.user.create({
				data: {
					fullName: fullName || null,
					email: email || null,
					phoneNumber: normalizedPhone,
					password: hashedPassword,
					role: role || "USER",
					phoneVerified: true, // Admin-created users are auto-verified
				},
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

			return res.status(201).json(newUser);
		} catch (error) {
			console.error("Create user error:", error);
			return res.status(500).json({ error: "Internal server error" });
		}
	}
);

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
					country: true,
					employmentStatus: true,
					employerName: true,
					monthlyIncome: true,
					serviceLength: true,
					occupation: true,
					bankName: true,
					accountNumber: true,
					onboardingStep: true,
					isOnboardingComplete: true,
					kycStatus: true,
					lastLoginAt: true,
					phoneVerified: true,
					// IC/Passport Information
					icNumber: true,
					icType: true,
					idNumber: true,
					idType: true,
					nationality: true,
					// Demographics
					race: true,
					gender: true,
					educationLevel: true,
					// Emergency Contact
					emergencyContactName: true,
					emergencyContactPhone: true,
					emergencyContactRelationship: true,
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

			// Validate and normalize phone number if provided
			if (updateData.phoneNumber) {
				const { validatePhoneNumber, normalizePhoneNumber } = require("../lib/phoneUtils");
				
				const phoneValidation = validatePhoneNumber(updateData.phoneNumber, {
					requireMobile: false, // Allow both mobile and landline for admin user update
					allowLandline: true
				});

				if (!phoneValidation.isValid) {
					return res.status(400).json({ 
						error: phoneValidation.error || "Invalid phone number format" 
					});
				}

				// Normalize phone number to E.164 format (with + prefix) for database storage
				const normalizedPhone = normalizePhoneNumber(updateData.phoneNumber);
				updateData.phoneNumber = normalizedPhone;

				// Check if another user already has this phone number
				const existingUserWithPhone = await prisma.user.findFirst({
					where: { 
						phoneNumber: normalizedPhone,
						NOT: { id } // Exclude current user
					}
				});

				if (existingUserWithPhone) {
					return res.status(400).json({ 
						error: "This phone number is already registered to another account" 
					});
				}
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
					icNumber: true,
					idNumber: true,
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
			jwtConfig.refreshSecret
		) as { userId: string; role?: string };

		// Get user
		const user = await prisma.user.findUnique({
			where: { id: decoded.userId },
		});

		if (!user) {
			return res.status(401).json({ error: "Invalid refresh token" });
		}

		// Check if user has admin panel access (ADMIN or ATTESTOR)
		if (user.role !== "ADMIN" && user.role !== "ATTESTOR") {
			return res
				.status(403)
				.json({ error: "Access denied. Admin or Attestor privileges required." });
		}

		// Generate new tokens
		const accessToken = jwt.sign(
			{ userId: user.id, role: user.role },
			jwtConfig.secret,
			{ expiresIn: "15m" }
		);

		const newRefreshToken = jwt.sign(
			{ userId: user.id, role: user.role },
			jwtConfig.refreshSecret,
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
 *                   enum: [ADMIN, ATTESTOR]
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin or attestor
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
					icNumber: true,
				},
			});

			if (!user) {
				return res.status(404).json({ error: "User not found" });
			}

			// Ensure the user has admin panel access (ADMIN or ATTESTOR)
			if (user.role !== "ADMIN" && user.role !== "ATTESTOR") {
				return res.status(403).json({
					error: "Access denied. Admin or Attestor privileges required.",
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
 * /api/admin/me:
 *   put:
 *     summary: Update admin profile information
 *     tags: [Admin]
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
 *               phoneNumber:
 *                 type: string
 *               icNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Admin profile updated successfully
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
 *                 icNumber:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin
 *       500:
 *         description: Server error
 */
router.put(
	"/me",
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			if (!req.user?.userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			// Get current user to verify admin role
			const currentUser = await prisma.user.findUnique({
				where: { id: req.user.userId },
				select: { role: true }
			});

			if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "ATTESTOR")) {
				return res.status(403).json({
					error: "Access denied. Admin or Attestor privileges required.",
				});
			}

			const updateData = req.body;

			// Validate IC number if provided
			if (updateData.icNumber) {
				const icNumber = updateData.icNumber.trim();
				if (icNumber.length < 6) {
					return res.status(400).json({ 
						error: "IC number is too short" 
					});
				}
			}

			// Validate and normalize phone number if provided
			if (updateData.phoneNumber) {
				const { validatePhoneNumber, normalizePhoneNumber } = require("../lib/phoneUtils");
				
				const phoneValidation = validatePhoneNumber(updateData.phoneNumber, {
					requireMobile: false,
					allowLandline: true
				});

				if (!phoneValidation.isValid) {
					return res.status(400).json({ 
						error: phoneValidation.error || "Invalid phone number format" 
					});
				}

				const normalizedPhone = normalizePhoneNumber(updateData.phoneNumber);
				updateData.phoneNumber = normalizedPhone;

				// Check if another user already has this phone number
				const existingUserWithPhone = await prisma.user.findFirst({
					where: { 
						phoneNumber: normalizedPhone,
						NOT: { id: req.user.userId }
					}
				});

				if (existingUserWithPhone) {
					return res.status(400).json({ 
						error: "This phone number is already registered to another account" 
					});
				}
			}

			// Update admin user profile
			const updatedUser = await prisma.user.update({
				where: { id: req.user.userId },
				data: updateData,
				select: {
					id: true,
					fullName: true,
					phoneNumber: true,
					email: true,
					role: true,
					icNumber: true,
				},
			});

			return res.json(updatedUser);
		} catch (error) {
			console.error("Admin profile update error:", error);
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
// Get counts of loan applications by status (admin and attestor)
// @ts-ignore
router.get(
	"/applications/counts",
	authenticateToken,
	requireAdminOrAttestor as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const userRole = req.user?.role;

			// ATTESTOR users only need specific counts for their work
			if (userRole === "ATTESTOR") {
				// Get pending witness signature count (ATTESTOR can act on these)
				// Only count applications with PENDING_SIGNING_COMPANY_WITNESS status and check signatory status within that
				const pendingWitnessSignatureCount = await prisma.loanApplication.count({
					where: {
						status: "PENDING_SIGNING_COMPANY_WITNESS",
						loan: {
							signatories: {
								some: {
									signatoryType: "WITNESS",
									status: {
										in: ["PENDING", "PENDING_PKI_SIGNING"]
									}
								}
							}
						}
					}
				});

				// Get pending company signature count (ATTESTOR can see but not act on these)
				// Only count applications with PENDING_SIGNING_COMPANY_WITNESS status and check signatory status within that
				const pendingCompanySignatureCount = await prisma.loanApplication.count({
					where: {
						status: "PENDING_SIGNING_COMPANY_WITNESS",
						loan: {
							signatories: {
								some: {
									signatoryType: "COMPANY",
									status: {
										in: ["PENDING", "PENDING_PKI_SIGNING"]
									}
								}
							}
						}
					}
				});

				// Get live attestation count
				const liveAttestationCount = await prisma.loanApplication.count({
					where: {
						status: "PENDING_ATTESTATION",
						attestationType: "MEETING",
						attestationCompleted: false,
					},
				});

				// Return counts for ATTESTOR (including company signatures for visibility)
				return res.json({
					PENDING_WITNESS_SIGNATURE: pendingWitnessSignatureCount,
					PENDING_COMPANY_SIGNATURE: pendingCompanySignatureCount, // Visible but not actionable
					PENDING_ATTESTATION: liveAttestationCount,
					LIVE_ATTESTATIONS: liveAttestationCount, // Alias for compatibility
					// Set all other counts to 0
					INCOMPLETE: 0,
					PENDING_APP_FEE: 0,
					PENDING_KYC: 0,
					PENDING_APPROVAL: 0,
					APPROVED: 0,
					PENDING_FRESH_OFFER: 0,
					PENDING_DISBURSEMENT: 0,
					COLLATERAL_REVIEW: 0,
					ACTIVE: 0,
					WITHDRAWN: 0,
					REJECTED: 0,
					PENDING_SIGNATURE: 0,
					total: pendingWitnessSignatureCount + liveAttestationCount,
				});
			}

			// ADMIN users get full application counts
			// Define all possible statuses
			const statusList = [
				"INCOMPLETE",
				"PENDING_APP_FEE",
				"PENDING_PROFILE_CONFIRMATION",
				"PENDING_KYC",
				"PENDING_KYC_VERIFICATION",
				"PENDING_CERTIFICATE_OTP",
				"PENDING_APPROVAL",
				"APPROVED",
				"PENDING_FRESH_OFFER",
				"PENDING_ATTESTATION",
				"PENDING_SIGNATURE",
				"PENDING_PKI_SIGNING",
				"PENDING_SIGNING_COMPANY_WITNESS",
				"PENDING_SIGNING_OTP_DS",
				"PENDING_DISBURSEMENT",
				"COLLATERAL_REVIEW",
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

			// Get counts for each status
			for (const status of statusList) {
				const count = await prisma.loanApplication.count({
					where: { status },
				});
				counts[status] = count;
			}

			// Get specific counts for company vs witness signatures
			// Only count applications with PENDING_SIGNING_COMPANY_WITNESS status and check signatory status within that
			const pendingCompanySignatureCount = await prisma.loanApplication.count({
				where: {
					status: "PENDING_SIGNING_COMPANY_WITNESS",
					loan: {
						signatories: {
							some: {
								signatoryType: "COMPANY",
								status: {
									in: ["PENDING", "PENDING_PKI_SIGNING"]
								}
							}
						}
					}
				}
			});

			const pendingWitnessSignatureCount = await prisma.loanApplication.count({
				where: {
					status: "PENDING_SIGNING_COMPANY_WITNESS",
					loan: {
						signatories: {
							some: {
								signatoryType: "WITNESS",
								status: {
									in: ["PENDING", "PENDING_PKI_SIGNING"]
								}
							}
						}
					}
				}
			});

			// Add these specific counts
			counts.PENDING_COMPANY_SIGNATURE = pendingCompanySignatureCount;
			counts.PENDING_WITNESS_SIGNATURE = pendingWitnessSignatureCount;

			// Add total count
			counts.total = total;

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
// Get all loan applications (admin and attestor)
// @ts-ignore
router.get(
	"/applications",
	authenticateToken,
	requireAdminOrAttestor as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const userRole = req.user?.role;
			console.log(`Fetching applications for ${userRole}`);

			// ATTESTOR users only see signing-related applications
			const whereCondition = userRole === "ATTESTOR" 
				? {
					status: {
						in: [
							"PENDING_SIGNING_COMPANY_WITNESS",
							"PENDING_SIGNATURE", 
							"PENDING_PKI_SIGNING",
							"PENDING_SIGNING_OTP_DS"
						]
					}
				}
				: {}; // ADMIN sees all applications

			const applications = await prisma.loanApplication.findMany({
				where: whereCondition,
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
							icNumber: true,
							idNumber: true,
							bankName: true,
							accountNumber: true,
							// Address fields
							address1: true,
							address2: true,
							city: true,
							state: true,
							zipCode: true,
							country: true,
							// Employment and education fields
							employmentStatus: true,
							employerName: true,
							monthlyIncome: true,
							serviceLength: true,
							educationLevel: true,
							nationality: true,
							// Emergency contact
							emergencyContactName: true,
							emergencyContactPhone: true,
							emergencyContactRelationship: true,
							// Demographics
							race: true,
							gender: true,
							occupation: true,
						},
					},
					product: {
						select: {
							id: true,
							name: true,
							code: true,
							requiredDocuments: true,
							collateralRequired: true,
							// Late fee fields
							lateFeeRate: true,
							lateFeeFixedAmount: true,
							lateFeeFrequencyDays: true,
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
					loan: {
						select: {
							id: true,
							status: true,
							agreementStatus: true,
							pkiStampCertificateUrl: true,
							signatories: {
								select: {
									id: true,
									signatoryType: true,
									name: true,
									email: true,
									status: true,
									signedAt: true,
								},
							},
						},
					},
					disbursement: {
						select: {
							id: true,
							referenceNumber: true,
							amount: true,
							bankName: true,
							bankAccountNumber: true,
							disbursedAt: true,
							disbursedBy: true,
							notes: true,
							status: true,
							paymentSlipUrl: true,
						},
					},
				},
			});

			console.log(`Found ${applications.length} applications`);
			
			// Fetch late fee grace period from system settings
			const lateFeeGraceDays = await getLateFeeGraceSettings(prisma);
			
			return res.json({
				success: true,
				data: applications,
				systemSettings: {
					lateFeeGraceDays: lateFeeGraceDays
				}
			});
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
	requireAdminOrAttestor,
	async (_req: AuthRequest, res: Response) => {
		try {
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
	requireAdminOrAttestor,
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

		// Process the status change in a transaction to ensure loan creation
		const updatedApplication = await prisma.$transaction(async (tx) => {
			// Update the application to complete the live attestation
			const updated = await tx.loanApplication.update({
			where: { id },
			data: {
				attestationCompleted: true,
				attestationDate: new Date(),
				attestationNotes:
					notes || "Live video call completed by admin",
				attestationTermsAccepted: true, // Mark terms as accepted for live attestation
				meetingCompletedAt: meetingCompletedAt
					? new Date(meetingCompletedAt)
					: new Date(),
				status: "CERT_CHECK", // Move to cert-check page (same as instant attestation)
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

			// Create loan and repayment schedule
			try {
				const { createLoanOnPendingSignature } = require('../lib/loanCreationUtils');
				await createLoanOnPendingSignature(id, tx);
				console.log(`Loan and repayment schedule created for application ${id} during live attestation completion`);
			} catch (error) {
				console.error(`Failed to create loan for application ${id}:`, error);
				// Don't fail the transaction, just log the error
			}

			return updated;
		});

		// Track the status change in history
		await trackApplicationStatusChange(
			prisma,
			id,
			"PENDING_ATTESTATION",
			"CERT_CHECK",
			adminUserId,
			"Live video call attestation completed by admin",
			notes || "Live video call attestation completed by admin - proceeding to certificate check",
			{
				attestationType: "MEETING",
				attestationTermsAccepted: true,
				completedBy: adminUserId,
				completedAt: new Date().toISOString(),
				meetingCompletedAt:
					meetingCompletedAt || new Date().toISOString(),
			}
		);

		// Send WhatsApp notification for attestation completion
		try {
			const userPhoneNumber = updatedApplication.user?.phoneNumber;
			const userFullName = updatedApplication.user?.fullName || "Customer";
			const productName = updatedApplication.product?.name || "Loan";
			const loanAmount = updatedApplication.amount?.toString() || "0";

			if (userPhoneNumber) {
				// Import whatsappService at the top of this file if not already imported
				const whatsappService = require('../lib/whatsappService').default;
				
				// Send WhatsApp notification asynchronously (don't block the response)
				whatsappService.sendAttestationCompleteNotification({
					to: userPhoneNumber,
					fullName: userFullName,
					productName: productName,
					amount: loanAmount,
				}).catch((error: any) => {
					console.error("Failed to send attestation complete WhatsApp notification:", error);
				});
			}
		} catch (error) {
			console.error("Error preparing attestation complete WhatsApp notification:", error);
		}

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
							// Address fields
							address1: true,
							address2: true,
							city: true,
							state: true,
							zipCode: true,
							country: true,
							// Education and employment fields
							educationLevel: true,
							serviceLength: true,
							nationality: true,
							icNumber: true,
							idNumber: true,
							// Emergency contact
							emergencyContactName: true,
							emergencyContactPhone: true,
							emergencyContactRelationship: true,
							// Demographics
							race: true,
							gender: true,
							occupation: true,
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
							requiredDocuments: true,
							collateralRequired: true,
							lateFeeRate: true,
							lateFeeFixedAmount: true,
							lateFeeFrequencyDays: true,
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
					history: {
						select: {
							id: true,
							applicationId: true,
							previousStatus: true,
							newStatus: true,
							changedBy: true,
							changeReason: true,
							notes: true,
							metadata: true,
							createdAt: true,
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
								// Address fields
								address1: true,
								address2: true,
								city: true,
								state: true,
								zipCode: true,
								country: true,
								// Education and employment fields
								educationLevel: true,
								serviceLength: true,
								nationality: true,
								icNumber: true,
								idNumber: true,
								// Emergency contact
								emergencyContactName: true,
								emergencyContactPhone: true,
								emergencyContactRelationship: true,
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
								requiredDocuments: true,
								collateralRequired: true,
								lateFeeRate: true,
								lateFeeFixedAmount: true,
								lateFeeFrequencyDays: true,
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
						history: {
							select: {
								id: true,
								applicationId: true,
								previousStatus: true,
								newStatus: true,
								changedBy: true,
								changeReason: true,
								notes: true,
								metadata: true,
								createdAt: true,
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
			const { status, notes, referenceNumber, currentStatus } = req.body;
			const adminUserId = req.user?.userId;

			const validStatuses = [
				"INCOMPLETE",
				"PENDING_APP_FEE",
				"PENDING_KYC",
				"PENDING_APPROVAL",
				"APPROVED",
				"PENDING_FRESH_OFFER",
				"PENDING_ATTESTATION",
				"CERT_CHECK",
				"PENDING_PKI_SIGNING",
				"PENDING_SIGNING_OTP",
				"PENDING_SIGNATURE",
				"PENDING_DISBURSEMENT",
				"COLLATERAL_REVIEW",
				"ACTIVE",
				"REJECTED",
				"WITHDRAWN",
			];

			// First, get the current application state to validate
			const currentApplication = await prisma.loanApplication.findUnique({
				where: { id },
				include: {
					loan: true,
					disbursement: true,
				},
			});

			if (!currentApplication) {
				return res.status(404).json({ message: "Application not found" });
			}

			// Check if the loan is already disbursed/active - prevent any status changes
			if (currentApplication.status === "ACTIVE" || currentApplication.loan?.status === "ACTIVE" || currentApplication.disbursement) {
				return res.status(409).json({
					error: "LOAN_ALREADY_DISBURSED",
					message: "This loan has already been disbursed and cannot be modified. Please refresh your page to see the current status.",
					currentStatus: currentApplication.status,
					disbursedAt: currentApplication.disbursement?.disbursedAt || currentApplication.loan?.disbursedAt,
					disbursedBy: currentApplication.disbursement?.disbursedBy,
				});
			}

			// Optimistic locking: Check if the current status matches what the frontend expects
			if (currentStatus && currentApplication.status !== currentStatus) {
				return res.status(409).json({
					error: "STATUS_CONFLICT",
					message: "The application status has been changed by another admin. Please refresh your page to see the current status.",
					expectedStatus: currentStatus,
					actualStatus: currentApplication.status,
					lastUpdated: currentApplication.updatedAt,
				});
			}

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
						product: true,
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
									const interestRate = application.product.interestRate; // Use product's interest rate, not application's
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
																	// Get current calculation settings to store with loan
								const calculationSettings = await getLoanCalculationSettings(prismaTransaction);
								
									updatedLoan =
										await prismaTransaction.loan.create({
											data: {
												userId: application.userId,
												applicationId: application.id,
												principalAmount:
													application.amount,
												totalAmount: totalAmount,
												outstandingBalance: totalAmount,
											interestRate: application.product.interestRate, // Use product's interest rate
												term: application.term || 12,
												monthlyPayment:
													application.monthlyRepayment ||
													application.amount / 12,
												status: "ACTIVE",
												disbursedAt: new Date(),
											// Store calculation method used at time of disbursement
											calculationMethod: calculationSettings.calculationMethod,
											scheduleType: calculationSettings.scheduleType,
											customDueDate: calculationSettings.customDueDate,
											prorationCutoffDate: calculationSettings.prorationCutoffDate,
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
												message: `Your loan of RM ${new Intl.NumberFormat("en-MY", {
													minimumFractionDigits: 2,
													maximumFractionDigits: 2,
												}).format(disbursementAmount)} has been disbursed to your bank account and is now active. Reference: ${disbursementReference}`,
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
							const disbursementNotes = (notes && notes.trim()) 
								? `${notes.trim()} | Disbursed Amount: RM ${disbursementAmount.toFixed(2)}`
								: `Disbursed Amount: RM ${disbursementAmount.toFixed(2)}`;

							await trackApplicationStatusChange(
								prismaTransaction,
								id,
								application.status,
								"ACTIVE",
								adminUserId,
								"Loan disbursement",
								disbursementNotes,
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

							// Send WhatsApp notification for loan disbursement (Status Update Endpoint)
							try {
								console.log("Sending WhatsApp disbursement notification (status update)");
								
								// Get first repayment date
								const firstRepaymentDate = await getFirstRepaymentDate(updatedLoan.id, prismaTransaction);
								
								if (firstRepaymentDate && application.user.phoneNumber && application.user.fullName) {
									const whatsappResult = await whatsappService.sendLoanDisbursementNotification({
										to: application.user.phoneNumber,
										fullName: application.user.fullName,
										amount: `${disbursementAmount.toFixed(2)}`,
										productName: application.product.name,
										firstRepaymentDate: formatDateForWhatsApp(firstRepaymentDate)
									});
									
									if (whatsappResult.success) {
										console.log("WhatsApp disbursement notification sent successfully:", whatsappResult.messageId);
									} else {
										console.error("WhatsApp disbursement notification failed:", whatsappResult.error);
									}
								} else {
									console.log("Skipping WhatsApp notification - missing required data:", {
										hasFirstRepaymentDate: !!firstRepaymentDate,
										hasPhoneNumber: !!application.user.phoneNumber,
										hasFullName: !!application.user.fullName
									});
								}
							} catch (whatsappError) {
								console.error("Error sending WhatsApp disbursement notification:", whatsappError);
								// Continue without failing the disbursement
							}
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

				// Get the current application to track the previous status
				const currentApplication = await prisma.loanApplication.findUnique({
					where: { id },
					select: { status: true }
				});

				if (!currentApplication) {
					return res.status(404).json({ message: "Application not found" });
				}

				const previousStatus = currentApplication.status;

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
					previousStatus,
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

				// Send WhatsApp notification for loan approval (PENDING_ATTESTATION status)
				if (finalStatus === "PENDING_ATTESTATION" && application.user.phoneNumber) {
					try {
						console.log("Sending WhatsApp loan approval notification");
						const whatsappResult = await whatsappService.sendLoanApprovalNotification({
							to: application.user.phoneNumber,
							fullName: application.user.fullName || 'Valued Customer',
							productName: application.product.name,
							amount: application.amount ? application.amount.toFixed(2) : '0.00'
						});
						
						if (whatsappResult.success) {
							console.log(`WhatsApp loan approval notification sent successfully to ${application.user.phoneNumber}. Message ID: ${whatsappResult.messageId}`);
						} else {
							console.error(`Failed to send WhatsApp loan approval notification: ${whatsappResult.error}`);
						}
					} catch (whatsappError) {
						console.error("Error sending WhatsApp loan approval notification:", whatsappError);
					}
				}

				// Send WhatsApp notification for loan rejection (REJECTED status)
				if (finalStatus === "REJECTED" && application.user.phoneNumber) {
					try {
						console.log("Sending WhatsApp loan rejection notification");
						const whatsappResult = await whatsappService.sendLoanRejectionNotification({
							to: application.user.phoneNumber,
							fullName: application.user.fullName || 'Valued Customer',
							productName: application.product.name
						});
						
						if (whatsappResult.success) {
							console.log(`WhatsApp loan rejection notification sent successfully to ${application.user.phoneNumber}. Message ID: ${whatsappResult.messageId}`);
						} else {
							console.error(`Failed to send WhatsApp loan rejection notification: ${whatsappResult.error}`);
						}
					} catch (whatsappError) {
						console.error("Error sending WhatsApp loan rejection notification:", whatsappError);
					}
				}

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
 * /api/admin/applications/{id}/fresh-offer:
 *   post:
 *     summary: Submit a fresh offer for a loan application (admin only)
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
 *               - amount
 *               - term
 *               - interestRate
 *               - monthlyRepayment
 *               - netDisbursement
 *               - originationFee
 *               - legalFee
 *               - applicationFee
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Fresh offer amount
 *               term:
 *                 type: integer
 *                 description: Fresh offer term in months
 *               interestRate:
 *                 type: number
 *                 description: Fresh offer interest rate
 *               monthlyRepayment:
 *                 type: number
 *                 description: Fresh offer monthly repayment
 *               netDisbursement:
 *                 type: number
 *                 description: Fresh offer net disbursement amount
 *               originationFee:
 *                 type: number
 *                 description: Fresh offer origination fee amount
 *               legalFee:
 *                 type: number
 *                 description: Fresh offer legal fee amount
 *               applicationFee:
 *                 type: number
 *                 description: Fresh offer application fee amount
 *               notes:
 *                 type: string
 *                 description: Admin notes for the fresh offer
 *     responses:
 *       200:
 *         description: Fresh offer submitted successfully
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
// Submit fresh offer for loan application (admin only)
// @ts-ignore
router.post(
	"/applications/:id/fresh-offer",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { amount, term, interestRate, monthlyRepayment, netDisbursement, stampingFee, legalFeeFixed, originationFee, legalFee, applicationFee, productId, notes } = req.body;
			const adminUserId = req.user?.userId;

			// Validate required fields - support both old and new fee structure
			const hasNewFees = stampingFee !== undefined && legalFeeFixed !== undefined;
			const hasOldFees = originationFee !== undefined && legalFee !== undefined && applicationFee !== undefined;
			
			if (!amount || !term || !interestRate || !monthlyRepayment || !netDisbursement || (!hasNewFees && !hasOldFees)) {
				return res.status(400).json({ 
					message: "All offer fields are required: amount, term, interestRate, monthlyRepayment, netDisbursement, and either (stampingFee, legalFeeFixed) or (originationFee, legalFee, applicationFee)" 
				});
			}

			// Get the current application
			const currentApplication = await prisma.loanApplication.findUnique({
				where: { id },
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

			if (!currentApplication) {
				return res.status(404).json({ message: "Application not found" });
			}

			// Check if application is in PENDING_APPROVAL status
			if (currentApplication.status !== "PENDING_APPROVAL") {
				return res.status(400).json({ 
					message: `Fresh offers can only be submitted for applications in PENDING_APPROVAL status. Current status: ${currentApplication.status}` 
				});
			}

			// Store original offer values if not already stored
			const originalOfferAmount = currentApplication.originalOfferAmount || currentApplication.amount;
			const originalOfferTerm = currentApplication.originalOfferTerm || currentApplication.term;
			const originalOfferInterestRate = currentApplication.originalOfferInterestRate || currentApplication.interestRate;
			const originalOfferMonthlyRepayment = currentApplication.originalOfferMonthlyRepayment || currentApplication.monthlyRepayment;
			const originalOfferNetDisbursement = currentApplication.originalOfferNetDisbursement || currentApplication.netDisbursement;

			// Update application with fresh offer
			const updateData: any = {
				status: "PENDING_FRESH_OFFER",
				freshOfferAmount: amount,
				freshOfferTerm: term,
				freshOfferInterestRate: interestRate,
				freshOfferMonthlyRepayment: monthlyRepayment,
				freshOfferNetDisbursement: netDisbursement,
				freshOfferNotes: notes,
				freshOfferSubmittedAt: new Date(),
				freshOfferSubmittedBy: adminUserId,
				// Store original offer if not already stored
				originalOfferAmount: originalOfferAmount,
				originalOfferTerm: originalOfferTerm,
				originalOfferInterestRate: originalOfferInterestRate,
				originalOfferMonthlyRepayment: originalOfferMonthlyRepayment,
				originalOfferNetDisbursement: originalOfferNetDisbursement,
			};
			
			// Add new fee structure if provided, otherwise use old fees
			if (hasNewFees) {
				updateData.freshOfferStampingFee = stampingFee;
				updateData.freshOfferLegalFeeFixed = legalFeeFixed;
				// Set old fees to 0 for clarity
				updateData.freshOfferOriginationFee = 0;
				updateData.freshOfferLegalFee = 0;
				updateData.freshOfferApplicationFee = 0;
			} else {
				updateData.freshOfferOriginationFee = originationFee;
				updateData.freshOfferLegalFee = legalFee;
				updateData.freshOfferApplicationFee = applicationFee;
				// Set new fees to 0 for clarity
				updateData.freshOfferStampingFee = 0;
				updateData.freshOfferLegalFeeFixed = 0;
			}

			// Update productId if provided
			if (productId) {
				updateData.productId = productId;
			}

			const updatedApplication = await prisma.loanApplication.update({
				where: { id },
				data: updateData,
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
			const freshOfferMetadata: any = {
				amount,
				term,
				interestRate,
				monthlyRepayment,
				netDisbursement,
			};
			
			// Add fee data based on structure used
			if (hasNewFees) {
				freshOfferMetadata.stampingFee = stampingFee;
				freshOfferMetadata.legalFeeFixed = legalFeeFixed;
			} else {
				freshOfferMetadata.originationFee = originationFee;
				freshOfferMetadata.legalFee = legalFee;
				freshOfferMetadata.applicationFee = applicationFee;
			}
			
			await trackApplicationStatusChange(
				prisma,
				id,
				"PENDING_APPROVAL",
				"PENDING_FRESH_OFFER",
				adminUserId,
				"Fresh offer submitted",
				notes || "Admin submitted a fresh offer with revised terms",
				{
					freshOffer: freshOfferMetadata,
					originalOffer: {
						amount: originalOfferAmount,
						term: originalOfferTerm,
						interestRate: originalOfferInterestRate,
						monthlyRepayment: originalOfferMonthlyRepayment,
						netDisbursement: originalOfferNetDisbursement,
					},
					submittedBy: adminUserId,
					submittedAt: new Date().toISOString(),
				}
			);

			// Create notification for the user about fresh offer
			try {
				await prisma.notification.create({
					data: {
						userId: updatedApplication.user.id,
						title: "New Loan Offer Available",
						message: `We have a new loan offer for you! Amount: RM${amount.toFixed(2)}, Term: ${term} months. Please review and respond.`,
						type: "FRESH_OFFER",
						priority: "HIGH",
						metadata: {
							applicationId: id,
							freshOffer: {
								amount,
								term,
								interestRate,
								monthlyRepayment,
								netDisbursement,
								originationFee,
								legalFee,
								applicationFee,
							},
							originalOffer: {
								amount: originalOfferAmount,
								term: originalOfferTerm,
								interestRate: originalOfferInterestRate,
								monthlyRepayment: originalOfferMonthlyRepayment,
								netDisbursement: originalOfferNetDisbursement,
							},
							submittedBy: adminUserId,
							submittedAt: new Date().toISOString(),
							notes: notes || "",
						},
					},
				});
			} catch (notificationError) {
				console.error("Could not create fresh offer notification:", notificationError);
			}

			// Send WhatsApp notification for revised loan offer
			try {
				if (updatedApplication.user.phoneNumber && updatedApplication.user.fullName) {
					const whatsappResult = await whatsappService.sendRevisedLoanOfferNotification({
						to: updatedApplication.user.phoneNumber,
						fullName: updatedApplication.user.fullName
					});

					if (whatsappResult.success) {
						console.log(`WhatsApp revised offer notification sent to ${updatedApplication.user.phoneNumber}`);
					} else {
						console.log(`WhatsApp revised offer notification failed: ${whatsappResult.error}`);
					}
				} else {
					console.log("No phone number available for WhatsApp revised offer notification");
				}
			} catch (whatsappError) {
				console.error("Could not send WhatsApp revised offer notification:", whatsappError);
			}

			console.log(`Fresh offer submitted for application ${id} by admin ${adminUserId}`);
			return res.json(updatedApplication);

		} catch (error) {
			console.error("Error submitting fresh offer:", error);
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

			// First fetch the document to get current status and applicationId
			const existingDocument = await prisma.userDocument.findUnique({
				where: { id },
				select: {
					id: true,
					type: true,
					status: true,
					applicationId: true,
					fileUrl: true,
				},
			});

			if (!existingDocument) {
				return res.status(404).json({ message: "Document not found" });
			}

			const previousStatus = existingDocument.status;

			// Update document and create audit trail in a transaction
			const document = await prisma.$transaction(async (tx) => {
				// Update document status
				const updatedDoc = await tx.userDocument.update({
					where: { id },
					data: { status },
				});

				// Create audit trail entry if there's an applicationId
				if (existingDocument.applicationId) {
					const actionType = status === "APPROVED" ? "DOCUMENT_APPROVED" : 
									   status === "REJECTED" ? "DOCUMENT_REJECTED" : 
									   "DOCUMENT_STATUS_CHANGED";
					
					await tx.loanApplicationHistory.create({
						data: {
							applicationId: existingDocument.applicationId,
							previousStatus: null,
							newStatus: actionType,
							changedBy: req.user?.userId || "ADMIN",
							changeReason: `ADMIN_${actionType}`,
							notes: `Admin ${status.toLowerCase()} document: ${existingDocument.type} (${existingDocument.fileUrl?.split('/').pop() || 'unknown'})`,
							metadata: {
								documentId: id,
								documentType: existingDocument.type,
								previousDocumentStatus: previousStatus,
								newDocumentStatus: status,
								fileName: existingDocument.fileUrl?.split('/').pop() || null,
							},
						},
					});
				}

				return updatedDoc;
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
 * /api/admin/applications/{applicationId}/documents:
 *   post:
 *     summary: Upload documents for a loan application (admin only)
 *     tags: [Admin - Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan application ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: The document file (PDF, JPG, or PNG)
 *               documentType:
 *                 type: string
 *                 description: The type/category of the document
 *     responses:
 *       200:
 *         description: Document uploaded successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
// Upload document for application (admin only)
router.post(
	"/applications/:applicationId/documents",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	(req, res, next) => {
		// Dynamic import of multer config - use memory storage for S3 upload
		const upload = multer({
			storage: (multer as any).memoryStorage(),
			fileFilter: (_req: any, file: any, cb: any) => {
				const allowedMimeTypes = [
					'application/pdf',
					'image/jpeg',
					'image/jpg', 
					'image/png',
				];
				if (allowedMimeTypes.includes(file.mimetype) || 
					file.originalname.toLowerCase().match(/\.(pdf|jpg|jpeg|png)$/)) {
					cb(null, true);
				} else {
					cb(new Error('Only PDF, JPG, and PNG files are allowed'), false);
				}
			},
			limits: { fileSize: 50 * 1024 * 1024 } // 50MB
		});
		upload.single('document')(req, res, next);
	},
	async (req: AuthRequest, res: Response) => {
		try {
			const { applicationId } = req.params;
			const { documentType } = req.body;
			const file = (req as any).file as Express.Multer.File;

			if (!file) {
				return res.status(400).json({ message: "No file uploaded" });
			}

			if (!documentType) {
				return res.status(400).json({ message: "Document type is required" });
			}

			// Check if application exists
			const application = await prisma.loanApplication.findUnique({
				where: { id: applicationId },
				select: { id: true, userId: true },
			});

			if (!application) {
				return res.status(404).json({ message: "Application not found" });
			}

			// Upload to S3
			const uploadResult = await uploadToS3Organized(
				file.buffer,
				file.originalname,
				file.mimetype,
				{
					folder: S3_FOLDERS.DOCUMENTS,
					subFolder: documentType.toLowerCase().replace(/\s+/g, '-'),
					userId: application.userId,
				}
			);

			if (!uploadResult.success || !uploadResult.key) {
				return res.status(500).json({ 
					message: "Failed to upload document to storage",
					error: uploadResult.error 
				});
			}

			// Create document record and audit trail entry in a transaction
			const document = await prisma.$transaction(async (tx) => {
				const doc = await tx.userDocument.create({
					data: {
						userId: application.userId,
						applicationId: applicationId,
						type: documentType,
						fileUrl: uploadResult.key!, // Already validated above
						status: "PENDING",
					},
				});

				// Add audit trail entry
				await tx.loanApplicationHistory.create({
					data: {
						applicationId: applicationId,
						previousStatus: null,
						newStatus: "DOCUMENT_UPLOADED",
						changedBy: req.user?.userId || "ADMIN",
						changeReason: "ADMIN_DOCUMENT_UPLOAD",
						notes: `Admin uploaded document: ${documentType} (${file.originalname})`,
						metadata: {
							documentId: doc.id,
							documentType: documentType,
							fileName: file.originalname,
							fileSize: file.size,
							action: "UPLOAD",
							timestamp: new Date().toISOString(),
						},
					},
				});

				return doc;
			});

			console.log(`Admin ${req.user?.userId} uploaded document ${document.id} for application ${applicationId}`);

			return res.json({
				success: true,
				message: "Document uploaded successfully",
				document: {
					id: document.id,
					type: document.type,
					status: document.status,
					fileUrl: document.fileUrl,
					createdAt: document.createdAt,
				},
			});
		} catch (error: any) {
			console.error("Error uploading document:", error);
			return res.status(500).json({ 
				message: "Internal server error",
				error: error.message 
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/{applicationId}/documents/{documentId}:
 *   delete:
 *     summary: Delete a document from an application (admin only)
 *     tags: [Admin - Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan application ID
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The document ID to delete
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
// Delete document from application (admin only)
router.delete(
	"/applications/:applicationId/documents/:documentId",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { applicationId, documentId } = req.params;

			// Find the document
			const document = await prisma.userDocument.findFirst({
				where: {
					id: documentId,
					applicationId: applicationId,
				},
			});

			if (!document) {
				return res.status(404).json({ message: "Document not found" });
			}

			// Delete from S3 if we have a file URL
			if (document.fileUrl) {
				try {
					await deleteFromS3(document.fileUrl);
				} catch (s3Error) {
					console.error("Error deleting from S3:", s3Error);
					// Continue with database deletion even if S3 fails
				}
			}

			// Delete the document record and add audit trail in a transaction
			await prisma.$transaction(async (tx) => {
				// Delete the document
				await tx.userDocument.delete({
					where: { id: documentId },
				});

				// Add audit trail entry
				await tx.loanApplicationHistory.create({
					data: {
						applicationId: applicationId,
						previousStatus: null,
						newStatus: "DOCUMENT_DELETED",
						changedBy: req.user?.userId || "ADMIN",
						changeReason: "ADMIN_DOCUMENT_DELETE",
						notes: `Admin deleted document: ${document.type} (${document.fileUrl?.split('/').pop() || 'unknown'})`,
						metadata: {
							documentId: documentId,
							documentType: document.type,
							fileName: document.fileUrl?.split('/').pop() || null,
							action: "DELETE",
							timestamp: new Date().toISOString(),
						},
					},
				});
			});

			console.log(`Admin ${req.user?.userId} deleted document ${documentId} from application ${applicationId}`);

			return res.json({
				success: true,
				message: "Document deleted successfully",
			});
		} catch (error: any) {
			console.error("Error deleting document:", error);
			return res.status(500).json({ 
				message: "Internal server error",
				error: error.message 
			});
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
						in: ["ACTIVE", "PENDING_DISCHARGE", "PENDING_EARLY_SETTLEMENT", "DISCHARGED", "DEFAULT"],
					},
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							phoneNumber: true,
							email: true,
							// Address fields
							address1: true,
							address2: true,
							city: true,
							state: true,
							zipCode: true,
							country: true,
							// Additional fields
							icNumber: true,
							idNumber: true,
							nationality: true,
							educationLevel: true,
							employmentStatus: true,
							employerName: true,
							serviceLength: true,
							monthlyIncome: true,
							bankName: true,
							accountNumber: true,
							// Emergency contact fields
							emergencyContactName: true,
							emergencyContactPhone: true,
							emergencyContactRelationship: true,
							// Demographics
							race: true,
							gender: true,
							occupation: true,
						},
					},
					application: {
						select: {
							id: true,
							amount: true,
							purpose: true,
							status: true,
							// Fee fields for financial breakdown
							stampingFee: true,
							legalFeeFixed: true,
							legalFee: true,
							originationFee: true,
							applicationFee: true,
							netDisbursement: true,
							interestRate: true,
							monthlyRepayment: true,
							product: {
								select: {
									id: true,
									name: true,
									code: true,
									// Late fee fields
									lateFeeRate: true,
									lateFeeFixedAmount: true,
									lateFeeFrequencyDays: true,
									// Document requirements
									requiredDocuments: true,
									collateralRequired: true,
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
									// Address fields
									address1: true,
									address2: true,
									city: true,
									state: true,
									zipCode: true,
									country: true,
									// Education and employment fields
									educationLevel: true,
									serviceLength: true,
									nationality: true,
									icNumber: true,
									idNumber: true,
									// Emergency contact fields
									emergencyContactName: true,
									emergencyContactPhone: true,
									emergencyContactRelationship: true,
									// Demographics
									race: true,
									gender: true,
									occupation: true,
								},
							},
							// Documents associated with this application
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
					},
					repayments: {
						include: {
							receipts: true,
						},
						orderBy: {
							dueDate: "asc",
						},
					},
					lateFee: {
						select: {
							gracePeriodDays: true,
							gracePeriodRepayments: true,
							totalGracePeriodFees: true,
							totalAccruedFees: true,
							status: true,
						},
					},
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			// Enhanced loans with overdue information using grace period data from late_fees table
			const loansWithOverdueInfo = await Promise.all(
				loans.map(async (loan) => {
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

						// Use grace period from late_fees table if available, otherwise fall back to settings
						const gracePeriodDays = loan.lateFee?.gracePeriodDays ?? await getLateFeeGraceSettings();

						// Get ALL overdue repayments (not filtered by grace period)
						// Grace period affects charging, not the calculation of days overdue
						const overdueRepaymentsQuery = `
							SELECT 
								lr.*,
								COALESCE(lr."lateFeeAmount" - lr."lateFeesPaid", 0) as total_late_fees,
								COALESCE(lr."principalPaid", 0) as principal_paid,
								CASE 
									WHEN lr."dueDate" < $2 THEN 
										EXTRACT(DAY FROM ($2 - lr."dueDate"))
									ELSE 0 
								END as actual_days_overdue,
								CASE 
									WHEN lr."dueDate" < $2 AND EXTRACT(DAY FROM ($2 - lr."dueDate")) <= $3 THEN true
									ELSE false 
								END as is_in_grace_period
							FROM loan_repayments lr
							WHERE lr."loanId" = $1
							  AND lr.status IN ('PENDING', 'PARTIAL')
							  AND lr."dueDate" < $2
							ORDER BY lr."dueDate" ASC
						`;

						const overdueRepayments = (await prisma.$queryRawUnsafe(
							overdueRepaymentsQuery,
							loan.id,
							today,
							gracePeriodDays
						)) as any[];

						if (overdueRepayments.length > 0) {
							console.log(
								`🔍 DEBUG: Admin - Overdue repayments for loan ${loan.id}:`,
								overdueRepayments.map((r) => ({
									id: r.id,
									amount: r.amount,
									actualAmount: r.actualAmount,
									status: r.status,
									dueDate: r.dueDate,
									total_late_fees: r.total_late_fees,
									actualDaysOverdue: r.actual_days_overdue,
									isInGracePeriod: r.is_in_grace_period,
									databaseDaysLate: r.daysLate || 0,
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

								// Use actual calculated days overdue (not affected by grace period)
								const actualDaysOverdue = Number(repayment.actual_days_overdue) || 0;
								const isInGracePeriod = repayment.is_in_grace_period || false;

								overdueInfo.overdueRepayments.push({
									id: repayment.id,
									amount: repayment.amount,
									outstandingAmount,
									totalLateFees,
									totalAmountDue:
										outstandingAmount + totalLateFees,
									dueDate: repayment.dueDate,
									// Always show actual days overdue (not affected by grace period)
									daysOverdue: actualDaysOverdue,
									isInGracePeriod: isInGracePeriod, // Add grace period status
									// Add breakdown of late fees for better frontend tracking
									lateFeeAmount: Number(repayment.lateFeeAmount) || 0,
									lateFeesPaid: Number(repayment.lateFeesPaid) || 0,
									installmentNumber: repayment.installmentNumber,
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

					// Debug logging
					console.log(`🔍 DEBUG Admin: Loan ${loan.id.substring(0, 8)} overdueInfo:`, {
						hasOverduePayments: overdueInfo.hasOverduePayments,
						totalOverdueAmount: overdueInfo.totalOverdueAmount,
						totalLateFees: overdueInfo.totalLateFees,
						overdueRepaymentsCount: overdueInfo.overdueRepayments.length
					});

					// Get early settlement info from loan application history for settled/discharged loans
					let earlySettlementInfo = null;
					if (loan.status === 'DISCHARGED' || loan.status === 'PENDING_DISCHARGE' || loan.status === 'PENDING_EARLY_SETTLEMENT') {
						try {
							const settlementHistory = await prisma.loanApplicationHistory.findFirst({
								where: {
									applicationId: loan.applicationId,
									metadata: {
										path: ['kind'],
										equals: 'EARLY_SETTLEMENT_APPROVAL'
									}
								},
								orderBy: {
									createdAt: 'desc'
								}
							});

							// Also check for admin-approved early settlements
							const adminSettlementHistory = !settlementHistory ? await prisma.loanApplicationHistory.findFirst({
								where: {
									applicationId: loan.applicationId,
									metadata: {
										path: ['kind'],
										equals: 'EARLY_SETTLEMENT_APPROVAL_ADMIN'
									}
								},
								orderBy: {
									createdAt: 'desc'
								}
							}) : null;

							const historyRecord = settlementHistory || adminSettlementHistory;
							
							if (historyRecord && historyRecord.metadata) {
								const metadata = historyRecord.metadata as any;
								const settlementDetails = metadata.settlementDetails || metadata;
								earlySettlementInfo = {
									totalSettlement: settlementDetails.totalSettlement || null,
									discountAmount: settlementDetails.discountAmount || settlementDetails.interestSaved || null,
									feeAmount: settlementDetails.earlySettlementFee || settlementDetails.feeAmount || null,
									netSavings: settlementDetails.netSavings || null,
									approvedAt: metadata.approvedAt || historyRecord.createdAt,
								};
							}
						} catch (error) {
							console.error(`Error fetching early settlement info for loan ${loan.id}:`, error);
						}
					}

					return {
						...loan,
						overdueInfo,
						// Add grace period information from late_fees table
						gracePeriodInfo: loan.lateFee ? {
							gracePeriodDays: loan.lateFee.gracePeriodDays,
							gracePeriodRepayments: loan.lateFee.gracePeriodRepayments,
							totalGracePeriodFees: loan.lateFee.totalGracePeriodFees,
							totalAccruedFees: loan.lateFee.totalAccruedFees,
							status: loan.lateFee.status,
						} : null,
						// Add early settlement info for settled/discharged loans
						earlySettlementInfo,
					};
				})
			);

			// Fetch current system settings for loan calculation methods
			const systemSettings = await getLoanCalculationSettings(prisma);
			
			// Fetch late fee grace period from system settings
			const lateFeeGraceDays = await getLateFeeGraceSettings(prisma);

			return res.status(200).json({
				success: true,
				data: loansWithOverdueInfo,
				systemSettings: {
					calculationMethod: systemSettings.calculationMethod,
					scheduleType: systemSettings.scheduleType,
					customDueDate: systemSettings.customDueDate,
					prorationCutoffDate: systemSettings.prorationCutoffDate,
					lateFeeGraceDays: lateFeeGraceDays
				}
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

		// Validate that stamp certificate has been uploaded
		if (application.loan && !application.loan.pkiStampCertificateUrl) {
			console.log('Stamp certificate not uploaded for loan:', application.loan.id);
			return res.status(400).json({
				message: "Stamp certificate must be uploaded before disbursement. Please upload the stamp certificate in the application stamping tab first."
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
								"Updating existing loan status to ACTIVE and setting disbursement date"
							);
							updatedLoan = await prismaTransaction.loan.update({
								where: { applicationId: id },
								data: {
									status: "ACTIVE",
									disbursedAt: new Date(),
								},
							});

							// Calculate and set nextPaymentDue after loan becomes ACTIVE
							const nextPaymentDue = await calculateNextPaymentDue(application.loan.id, prismaTransaction);
							await prismaTransaction.loan.update({
								where: { id: application.loan.id },
								data: {
									nextPaymentDue: nextPaymentDue,
								},
							});
							console.log(`Set nextPaymentDue for loan ${application.loan.id}: ${nextPaymentDue}`);
						} else {
							// Create a new loan record since it doesn't exist (fallback case)
							console.log(
								"Creating new loan record for disbursement (fallback)"
							);
							try {
								// This should rarely happen now since loans are created during PENDING_SIGNATURE
								// But keeping as fallback for robustness
								
								// Ensure we have all required values
								if (!application.amount) {
									throw new Error(
										"Cannot create loan: Amount is required"
									);
								}

								// Calculate total amount directly from principal and interest
								const principal = application.amount;
								const interestRate = application.product.interestRate; // Use product's interest rate, not application's
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

								// Get current calculation settings to store with loan
								const calculationSettings = await getLoanCalculationSettings(prismaTransaction);

								updatedLoan =
									await prismaTransaction.loan.create({
										data: {
											userId: application.userId,
											applicationId: application.id,
											principalAmount: application.amount,
											totalAmount: totalAmount,
											outstandingBalance: totalAmount,
											interestRate: application.product.interestRate, // Use product's interest rate
											term: application.term || 12,
											monthlyPayment:
												application.monthlyRepayment ||
												application.amount / 12,
											status: "ACTIVE",
											disbursedAt: new Date(),
											// Store calculation method used at time of disbursement
											calculationMethod: calculationSettings.calculationMethod,
											scheduleType: calculationSettings.scheduleType,
											customDueDate: calculationSettings.customDueDate,
											prorationCutoffDate: calculationSettings.prorationCutoffDate,
										},
									});
								console.log("Loan record created successfully (fallback)");
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

						// Payment schedule dates are already calculated correctly during loan creation
						// No need to recalculate during disbursement
						console.log(
							`Payment schedule for loan ${updatedLoan.id} already calculated during loan creation - no recalculation needed`
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
										message: `Your loan of RM ${new Intl.NumberFormat("en-MY", {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										}).format(disbursementAmount)} has been disbursed to your bank account and is now active. Reference: ${disbursementReference}`,
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
							const disbursementNotes = (notes && notes.trim()) 
								? `${notes.trim()} | Disbursed Amount: RM ${disbursementAmount.toFixed(2)}`
								: `Disbursed Amount: RM ${disbursementAmount.toFixed(2)}`;

							await trackApplicationStatusChange(
								prismaTransaction,
								id,
								application.status,
								"ACTIVE",
								adminUserId,
								"Loan disbursement",
								disbursementNotes,
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

							// Send WhatsApp notification for loan disbursement (Dedicated Disbursement Endpoint)
							try {
								console.log("Sending WhatsApp disbursement notification (disbursement endpoint)");
								
								// Get first repayment date
								const firstRepaymentDate = await getFirstRepaymentDate(updatedLoan.id, prismaTransaction);
								
								if (firstRepaymentDate && application.user.phoneNumber && application.user.fullName) {
									const whatsappResult = await whatsappService.sendLoanDisbursementNotification({
										to: application.user.phoneNumber,
										fullName: application.user.fullName,
										amount: `${disbursementAmount.toFixed(2)}`,
										productName: application.product.name,
										firstRepaymentDate: formatDateForWhatsApp(firstRepaymentDate)
									});
									
									if (whatsappResult.success) {
										console.log("WhatsApp disbursement notification sent successfully:", whatsappResult.messageId);
									} else {
										console.error("WhatsApp disbursement notification failed:", whatsappResult.error);
									}
								} else {
									console.log("Skipping WhatsApp notification - missing required data:", {
										hasFirstRepaymentDate: !!firstRepaymentDate,
										hasPhoneNumber: !!application.user.phoneNumber,
										hasFullName: !!application.user.fullName
									});
								}
							} catch (whatsappError) {
								console.error("Error sending WhatsApp disbursement notification:", whatsappError);
								// Continue without failing the disbursement
							}
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

			// Fetch admin users for disbursedBy field
			const adminUserIds = [...new Set(disbursements.map(d => d.disbursedBy))];
			const adminUsers = await prisma.user.findMany({
				where: {
					id: {
						in: adminUserIds
					}
				},
				select: {
					id: true,
					fullName: true,
					email: true,
				}
			});

			// Create a map of admin users
			const adminUserMap = new Map(adminUsers.map(u => [u.id, u]));

			// Enhance disbursements with admin user info
			const enhancedDisbursements = disbursements.map(d => ({
				...d,
				disbursedByUser: adminUserMap.get(d.disbursedBy) || null
			}));

			return res.json({
				success: true,
				data: enhancedDisbursements,
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
			const { raw } = req.query; // Add query parameter to get raw database values

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
						include: {
							receipts: true,
						},
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
							include: {
								receipts: true,
							},
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

			// For admin interface, default to showing raw database values
			// Only apply adjustments if explicitly requested
			const shouldApplyAdjustments = raw !== "true"; // Default to raw=true for admin

			let responseData = loan;
			
			if (shouldApplyAdjustments) {
				// Apply prepayment adjustments to the schedule (legacy behavior)
				responseData = await applyPrepaymentAdjustments(loan);
				
				// Debug logging
				console.log(`Admin API - Loan ${loan.id} repayments response (adjusted):`);
				console.log(`  • Original repayments: ${loan.repayments.length}`);
				console.log(`  • Adjusted repayments: ${responseData.repayments.length}`);
				console.log(`  • Total paid: ${(responseData as any).totalPaid || 0}`);
			} else {
				// Return raw database values (preferred for admin interface)
				console.log(`Admin API - Loan ${loan.id} repayments response (raw database values):`);
				console.log(`  • Raw repayments: ${loan.repayments.length}`);
				
				// Calculate totalPaid from wallet transactions for summary (without modifying repayments)
				const payments = await prisma.walletTransaction.findMany({
					where: {
						loanId: loan.id,
						type: "LOAN_REPAYMENT",
						status: "APPROVED",
					},
				});
				
				const totalPaid = payments.reduce(
					(sum, payment) => sum + Math.abs(payment.amount),
					0
				);
				
				responseData = {
					...loan,
					totalPaid,
				} as any;
			}

			return res.json({
				success: true,
				data: responseData,
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
 * /api/admin/repayments:
 *   get:
 *     summary: Get all repayment requests with status filter (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, all]
 *         description: Filter by payment status (default is 'all')
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: List of repayment requests
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.get(
	"/repayments",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { status = 'all', limit = 100 } = req.query;
			
			// Build where clause based on status filter
			const whereClause: any = {
				type: "LOAN_REPAYMENT",
			};
			
			if (status && status !== 'all') {
				whereClause.status = status;
			}

			// Get wallet transactions for loan repayments with status filter
			const repayments = await prisma.walletTransaction.findMany({
				where: whereClause,
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
				take: parseInt(limit as string, 10),
			});

			return res.json({
				success: true,
				data: repayments,
			});
		} catch (error) {
			console.error("Error fetching repayments:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to fetch repayments",
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

			// Check if this is an early settlement request
			const isEarlySettlement = (transaction.metadata as any)?.kind === 'EARLY_SETTLEMENT';

			// Process the repayment in a transaction
			const result = await prisma.$transaction(async (tx) => {
				// Import SafeMath utilities for precise calculations
				const { SafeMath } = await import("../lib/precisionUtils");
				
				// Get the actual payment amount (stored as positive in metadata) - preserve exact user input
				const paymentAmount = SafeMath.toNumber(
					(transaction.metadata as any)?.originalAmount ||
					Math.abs(transaction.amount)
				);

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
					if (isEarlySettlement) {
						// Handle early settlement: use the same logic as early-settlement.ts
						const quote = (transaction.metadata as any)?.quote;
						
						// First, get all repayments that will be cancelled and store their original statuses
						const repaymentsToCancel = await tx.loanRepayment.findMany({
							where: {
								loanId: loan.id,
								status: { in: ['PENDING', 'PARTIAL'] }
							},
							select: {
								id: true,
								status: true,
								actualAmount: true,
								principalPaid: true,
								lateFeesPaid: true
							}
						});

						// Store original repayment statuses in transaction metadata for potential reversion
						const originalRepaymentStatuses = repaymentsToCancel.map(r => ({
							id: r.id,
							originalStatus: r.status,
							originalActualAmount: r.actualAmount,
							originalPrincipalPaid: r.principalPaid,
							originalLateFeesPaid: r.lateFeesPaid
						}));
						
						// Create a consolidated early settlement repayment record
						const earlySettlementRepayment = await tx.loanRepayment.create({
							data: {
								loanId: loan.id,
								amount: SafeMath.toNumber(quote?.totalSettlement || paymentAmount),
								principalAmount: SafeMath.toNumber(quote?.remainingPrincipal || 0),
								interestAmount: SafeMath.toNumber((quote?.remainingInterest || 0) - (quote?.discountAmount || 0)),
								lateFeeAmount: SafeMath.toNumber(quote?.lateFeesAmount || 0),
								status: 'COMPLETED',
								dueDate: new Date(),
								paidAt: new Date(),
								actualAmount: SafeMath.toNumber(quote?.totalSettlement || paymentAmount),
								principalPaid: SafeMath.toNumber(quote?.remainingPrincipal || 0),
								lateFeesPaid: SafeMath.toNumber(quote?.lateFeesAmount || 0),
								paymentType: 'EARLY_SETTLEMENT',
								installmentNumber: null,
								createdAt: new Date(),
								updatedAt: new Date()
							}
						});

						// Mark all remaining repayments as CANCELLED and mark their late fees as paid
						// (since late fees are included in the early settlement amount)
						for (const repayment of repaymentsToCancel) {
							// Get the full repayment to access lateFeeAmount
							const fullRepayment = await tx.loanRepayment.findUnique({
								where: { id: repayment.id },
								select: { lateFeeAmount: true }
							});
							
							await tx.loanRepayment.update({
								where: { id: repayment.id },
								data: {
									status: 'CANCELLED',
									// Mark late fees as fully paid since they're included in early settlement
									lateFeesPaid: fullRepayment?.lateFeeAmount || 0,
									updatedAt: new Date()
								}
							});
						}

						// Update transaction metadata to include original repayment statuses for reversion
						await tx.walletTransaction.update({
							where: { id },
							data: {
								metadata: {
									...((transaction.metadata as object) || {}),
									originalRepaymentStatuses,
									earlySettlementRepaymentId: earlySettlementRepayment.id
								}
							}
						});

						// Update loan status to PENDING_DISCHARGE, set outstanding balance to 0, and clear default flags
						const updatedLoan = await tx.loan.update({
							where: { id: loan.id },
							data: {
								status: 'PENDING_DISCHARGE',
								outstandingBalance: 0,
								// Clear default flags since loan is now settled
								defaultRiskFlaggedAt: null,
								defaultedAt: null,
								updatedAt: new Date()
							},
							include: {
								application: {
									select: {
										id: true
									}
								}
							}
						});

						// Create audit trail entry for early settlement approval (admin payments page)
						if (updatedLoan.applicationId) {
							const formatCurrency = (amount: number): string => {
								return new Intl.NumberFormat('en-MY', {
									style: 'currency',
									currency: 'MYR'
								}).format(amount);
							};

							await tx.loanApplicationHistory.create({
								data: {
									applicationId: updatedLoan.applicationId,
									previousStatus: 'PENDING_EARLY_SETTLEMENT',
									newStatus: 'PENDING_DISCHARGE',
									changedBy: adminUserId || 'SYSTEM',
									changeReason: 'Early Settlement Approved (Admin Payments)',
									notes: `Early settlement approved via admin payments page. Settlement amount: ${formatCurrency(SafeMath.toNumber(quote?.totalSettlement || paymentAmount))}. Interest discount: ${formatCurrency(SafeMath.toNumber(quote?.discountAmount || 0))}. Early settlement fee: ${formatCurrency(SafeMath.toNumber(quote?.feeAmount || 0))}.${notes ? ` Admin notes: ${notes}` : ''}`,
									metadata: {
										kind: 'EARLY_SETTLEMENT_APPROVAL_ADMIN',
										transactionId: id,
										settlementDetails: {
											totalSettlement: SafeMath.toNumber(quote?.totalSettlement || paymentAmount),
											remainingPrincipal: SafeMath.toNumber(quote?.remainingPrincipal || 0),
											remainingInterest: SafeMath.toNumber(quote?.remainingInterest || 0),
											discountAmount: SafeMath.toNumber(quote?.discountAmount || 0),
											earlySettlementFee: SafeMath.toNumber(quote?.feeAmount || 0),
											lateFeesAmount: SafeMath.toNumber(quote?.lateFeesAmount || 0),
											interestSaved: SafeMath.toNumber(quote?.discountAmount || 0),
											netSavings: SafeMath.toNumber((quote?.discountAmount || 0) - (quote?.feeAmount || 0))
										},
										approvedBy: adminUserId || 'SYSTEM',
										approvedAt: new Date().toISOString(),
										approvedVia: 'ADMIN_PAYMENTS_PAGE'
									}
								}
							});
						}

						return { updatedTransaction, scheduleUpdate: { newOutstandingBalance: 0, nextPaymentDue: null, totalPrincipalPaid: 0 }, earlySettlementRepayment };
					} else {
						// Regular repayment processing
						const scheduleUpdate =
							await updatePaymentScheduleAfterPayment(
								loan.id,
								paymentAmount,
								tx
							);
						return { updatedTransaction, scheduleUpdate };
					}
				}

				return { updatedTransaction, scheduleUpdate: null };
			});

			// Check if we need to clear default flags after payment
			if (result.scheduleUpdate && transaction.loan) {
				const paymentAmount = Math.abs(transaction.amount);
				console.log(`Payment approved for loan ${transaction.loan.id}:`);
				console.log(`  • Payment amount: RM ${paymentAmount}`);
				console.log(`  • New outstanding: ${result.scheduleUpdate.newOutstandingBalance || 0}`);
				
				if (isEarlySettlement) {
					console.log(`  • Early settlement processed - loan status changed to PENDING_DISCHARGE`);
				}

				// Clear default flags if loan is no longer overdue after payment
				await clearDefaultFlagsIfNeeded(transaction.loan.id, adminUserId || 'SYSTEM');
			}

			// Create notification for user (outside transaction to avoid rollback issues)
			if (transaction.loan) {
				const paymentAmount = Math.abs(transaction.amount);
				const notificationTitle = isEarlySettlement ? "Early Settlement Approved" : "Payment Approved";
				const notificationMessage = isEarlySettlement 
					? `Your early settlement request of RM ${new Intl.NumberFormat("en-MY", {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					}).format(paymentAmount)} has been approved. Your loan is now pending discharge.`
					: `Your loan repayment of RM ${new Intl.NumberFormat("en-MY", {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					}).format(paymentAmount)} has been approved and processed successfully.`;

				await prisma.notification.create({
					data: {
						userId: transaction.userId,
						title: notificationTitle,
						message: notificationMessage,
						type: "SYSTEM",
						priority: "HIGH",
						metadata: {
							transactionId: id,
							loanId: transaction.loan.id,
							amount: paymentAmount,
							newOutstandingBalance: result.scheduleUpdate?.newOutstandingBalance || 0,
							processedBy: adminUserId,
							adminNotes: notes || "",
							isEarlySettlement: isEarlySettlement,
						},
					},
				});
			}



			// Generate receipt for this payment transaction
			try {
				if (result.scheduleUpdate && transaction.loanId) {
					// Check if receipt already exists for this specific transaction
					const existingReceipt = await prisma.paymentReceipt.findFirst({
						where: {
							metadata: {
								path: ['transactionId'],
								equals: transaction.id
							}
						}
					});

					if (!existingReceipt) {
						// Find the repayment that was just affected by this payment
						// Get all repayments to debug which one should be used
						const allRepayments = await prisma.loanRepayment.findMany({
							where: { loanId: transaction.loanId },
							orderBy: { dueDate: 'asc' }
						});
						
						console.log(`🧾 Receipt generation - All repayments for loan ${transaction.loanId}:`);
						allRepayments.forEach((r, i) => {
							console.log(`  ${i + 1}. Installment ${r.installmentNumber || 'N/A'}: ${r.status}, actualAmount: ${r.actualAmount || 0}, amount: ${r.amount}, paidAt: ${r.paidAt}`);
						});

						// IMPROVED: Find the most recent repayment that was affected by payments
						// Strategy: Find the repayment that was last modified or has the latest payment activity
						
						let affectedRepayment = null;
						
						console.log(`🧾 Finding repayment for receipt generation...`);
						
						// Special case: For early settlement, use the early settlement repayment record
						if (isEarlySettlement && result.earlySettlementRepayment) {
							affectedRepayment = result.earlySettlementRepayment;
							console.log(`🧾 ✅ Using early settlement repayment record for receipt: ${affectedRepayment.id}`);
						} else {
							// Strategy 1: Look for PARTIAL repayments first (these are currently being paid)
							affectedRepayment = allRepayments.find(r => r.status === 'PARTIAL');
							if (affectedRepayment) {
								console.log(`🧾 ✅ Found PARTIAL repayment: Installment ${affectedRepayment.installmentNumber}`);
							}
						}
						
						// Strategy 2: If no PARTIAL, find the most recently completed repayment
						// This is more reliable than time-based matching
						if (!affectedRepayment) {
							const completedRepayments = allRepayments.filter(r => r.status === 'COMPLETED' && (r.actualAmount || 0) > 0);
							
							if (completedRepayments.length > 0) {
								// Sort by: 1) updatedAt (most recent update), 2) paidAt (most recent payment), 3) installmentNumber (latest installment)
								affectedRepayment = completedRepayments.sort((a, b) => {
									// First compare updatedAt
									const aUpdated = new Date(a.updatedAt).getTime();
									const bUpdated = new Date(b.updatedAt).getTime();
									if (aUpdated !== bUpdated) return bUpdated - aUpdated;
									
									// Then compare paidAt
									if (a.paidAt && b.paidAt) {
										const aPaid = new Date(a.paidAt).getTime();
										const bPaid = new Date(b.paidAt).getTime();
										if (aPaid !== bPaid) return bPaid - aPaid;
									}
									
									// Finally compare installment number (higher = more recent)
									return (b.installmentNumber || 0) - (a.installmentNumber || 0);
								})[0];
								
								console.log(`🧾 ✅ Found most recent COMPLETED repayment: Installment ${affectedRepayment.installmentNumber}, updatedAt: ${affectedRepayment.updatedAt}`);
							}
						}
						
						// Strategy 3: If still no match, get the first PENDING repayment (next in line)
						if (!affectedRepayment) {
							affectedRepayment = allRepayments.find(r => r.status === 'PENDING');
							if (affectedRepayment) {
								console.log(`🧾 ⚠️ Using next PENDING repayment: Installment ${affectedRepayment.installmentNumber}`);
							}
						}
						
						// Strategy 4: Final fallback - most recent repayment by installment number
						if (!affectedRepayment && allRepayments.length > 0) {
							affectedRepayment = allRepayments.sort((a, b) => (b.installmentNumber || 0) - (a.installmentNumber || 0))[0];
							console.log(`🧾 ⚠️ Using latest installment fallback: Installment ${affectedRepayment.installmentNumber}`);
						}

						if (affectedRepayment) {
							console.log(`🧾 Generating receipt for repayment: ${affectedRepayment.id}, transaction: ${transaction.id}, isEarlySettlement: ${isEarlySettlement}`);
							const receiptResult = await ReceiptService.generateReceipt({
								repaymentId: affectedRepayment.id,
								generatedBy: adminUserId || 'admin',
								paymentMethod: (transaction.metadata as any)?.paymentMethod || (isEarlySettlement ? 'Early Settlement' : 'Online Payment'),
								reference: transaction.reference || transaction.id,
								actualPaymentAmount: Math.abs(transaction.amount),
								transactionId: transaction.id // Add transaction ID to prevent duplicates
							});
							
							console.log(`🧾 ✅ Receipt generated for transaction ${transaction.id}: ${receiptResult.receiptNumber} (repayment: ${affectedRepayment.id})`);
						} else {
							console.log(`🧾 ❌ No affected repayment found for receipt generation (transaction: ${transaction.id})`);
						}
					} else {
						console.log(`Receipt already exists for transaction ${transaction.id}`);
					}
				}
			} catch (receiptError) {
				console.error("Error in receipt generation process:", receiptError);
			}

			// Send WhatsApp notification AFTER receipt generation
			if (transaction.user.phoneNumber && result.scheduleUpdate) {
				try {
					// Get the actual payment amount from the transaction result
					const approvedAmount = (transaction.metadata as any)?.originalAmount || Math.abs(transaction.amount);
					
					const loanWithProduct = await prisma.loan.findUnique({
						where: { id: transaction.loanId! },
						include: {
							application: {
								include: {
									product: true
								}
							}
						}
					});

					if (loanWithProduct) {
						// Calculate completed payments
						const completedPayments = await prisma.loanRepayment.count({
							where: {
								loanId: transaction.loanId!,
								status: 'COMPLETED'
							}
						});

						// Get total payments from loan term
						const totalScheduledPayments = loanWithProduct.term || loanWithProduct.application.term || 12;

						// Calculate next payment amount
						let nextPaymentAmount = 0;
						const nextPayment = await prisma.loanRepayment.findFirst({
							where: {
								loanId: transaction.loanId!,
								status: { in: ['PENDING', 'PARTIAL'] }
							},
							orderBy: {
								dueDate: 'asc'
							}
						});

						if (nextPayment) {
							const scheduledAmount = nextPayment.scheduledAmount || nextPayment.amount;
							const lateFeeAmount = nextPayment.lateFeeAmount || 0;
							const paidAmount = nextPayment.actualAmount || 0;

							if (nextPayment.status === 'PARTIAL') {
								// Next payment = (scheduled amount + late fees) - amount already paid
								const remainingAmount = (scheduledAmount + lateFeeAmount) - paidAmount;
								nextPaymentAmount = Math.max(remainingAmount, 0);
							}
						}
						
						// Format next due date
						const nextDueDate = result.scheduleUpdate.nextPaymentDue 
							? formatDateForWhatsApp(new Date(result.scheduleUpdate.nextPaymentDue))
							: 'To be determined';

						// Find the newly generated receipt for this transaction
						let receiptUrl: string | undefined;
						try {
							const receipt = await prisma.paymentReceipt.findFirst({
								where: {
									metadata: {
										path: ['transactionId'],
										equals: transaction.id
									}
								}
							});
							
							if (receipt) {
								receiptUrl = receipt.id; // Just pass the receipt ID
								console.log(`🔗 Found receipt for WhatsApp notification: ${receipt.id}`);
							} else {
								console.log(`🔗 No receipt found for transaction: ${transaction.id}`);
							}
						} catch (receiptError) {
							console.error("Error getting receipt for WhatsApp notification:", receiptError);
						}

						const whatsappResult = await whatsappService.sendPaymentApprovedNotification({
							to: transaction.user.phoneNumber,
							fullName: transaction.user.fullName || 'Valued Customer',
							paymentAmount: approvedAmount.toFixed(2),
							loanName: loanWithProduct.application.product.name,
							nextPaymentAmount: nextPaymentAmount.toFixed(2),
							nextDueDate: nextDueDate,
							completedPayments: completedPayments.toString(),
							totalPayments: totalScheduledPayments.toString(),
							receiptUrl: receiptUrl
						});
						
						if (whatsappResult.success) {
							console.log(`WhatsApp payment approval notification sent successfully to ${transaction.user.phoneNumber}. Message ID: ${whatsappResult.messageId}${receiptUrl ? ` with receipt: ${receiptUrl}` : ' (no receipt)'}`);
						} else {
							console.error(`Failed to send WhatsApp payment approval notification: ${whatsappResult.error}`);
						}
					}
				} catch (whatsappError) {
					console.error("Error sending WhatsApp payment approval notification:", whatsappError);
				}
			}

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
					user: {
						select: {
							id: true,
							fullName: true,
							phoneNumber: true,
							email: true,
						},
					},
					loan: {
						select: {
							id: true,
							application: {
								select: {
									product: {
										select: {
											name: true,
										},
									},
								},
							},
						},
					},
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

			// Check if this is an early settlement request
			const isEarlySettlement = (transaction.metadata as any)?.kind === 'EARLY_SETTLEMENT';

			// Reject the transaction
		const result = await prisma.$transaction(async (tx) => {
			// Import SafeMath utilities for precise calculations
			const { SafeMath } = await import("../lib/precisionUtils");
			
			// Get the actual payment amount (stored as positive in metadata) - preserve exact user input
			const paymentAmount = SafeMath.toNumber(
				(transaction.metadata as any)?.originalAmount ||
				Math.abs(transaction.amount)
			);

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

				// If this is an early settlement request, revert loan status and restore repayments
				if (isEarlySettlement && transaction.loanId) {
					// Restore original repayment statuses if they were stored
					const originalRepaymentStatuses = (transaction.metadata as any)?.originalRepaymentStatuses;
					const earlySettlementRepaymentId = (transaction.metadata as any)?.earlySettlementRepaymentId;
					
					if (originalRepaymentStatuses && Array.isArray(originalRepaymentStatuses)) {
						// Restore each repayment to its original status
						for (const repaymentStatus of originalRepaymentStatuses) {
							await tx.loanRepayment.update({
								where: { id: repaymentStatus.id },
								data: {
									status: repaymentStatus.originalStatus,
									actualAmount: repaymentStatus.originalActualAmount,
									principalPaid: repaymentStatus.originalPrincipalPaid,
									lateFeesPaid: repaymentStatus.originalLateFeesPaid,
									updatedAt: new Date()
								}
							});
						}
					}
					
					// Remove the early settlement repayment record if it exists
					if (earlySettlementRepaymentId) {
						await tx.loanRepayment.delete({
							where: { id: earlySettlementRepaymentId }
						}).catch((error) => {
							// Log error but don't fail the transaction if repayment doesn't exist
							console.warn('Early settlement repayment record not found for deletion:', error);
						});
					}
					
					// Revert loan status back to ACTIVE and recalculate outstanding balance
					const revertedLoan = await tx.loan.update({
						where: { id: transaction.loanId },
						data: {
							status: 'ACTIVE',
							updatedAt: new Date()
							// Note: Outstanding balance will be recalculated by the system
						},
						include: {
							application: {
								select: {
									id: true
								}
							}
						}
					});

					// Create audit trail entry for early settlement rejection (admin payments page)
					if (revertedLoan.applicationId) {
						const formatCurrency = (amount: number): string => {
							return new Intl.NumberFormat('en-MY', {
								style: 'currency',
								currency: 'MYR'
							}).format(amount);
						};

						const quote = (transaction.metadata as any)?.quote;
						await tx.loanApplicationHistory.create({
							data: {
								applicationId: revertedLoan.applicationId,
								previousStatus: 'PENDING_EARLY_SETTLEMENT',
								newStatus: 'ACTIVE',
								changedBy: adminUserId || 'SYSTEM',
								changeReason: 'Early Settlement Rejected (Admin Payments)',
								notes: `Early settlement request rejected via admin payments page. Reason: ${reason}.${notes ? ` Admin notes: ${notes}` : ''} Settlement amount was: ${quote ? formatCurrency(SafeMath.toNumber(quote.totalSettlement)) : formatCurrency(paymentAmount)}.`,
								metadata: {
									kind: 'EARLY_SETTLEMENT_REJECTION_ADMIN',
									transactionId: id,
									rejectionReason: reason,
									rejectedBy: adminUserId || 'SYSTEM',
									rejectedAt: new Date().toISOString(),
									rejectedVia: 'ADMIN_PAYMENTS_PAGE',
									originalQuote: quote || null
								}
							}
						});
					}
				}

				// Create notification for user
				const notificationTitle = isEarlySettlement ? "Early Settlement Rejected" : "Payment Rejected";
				const notificationMessage = isEarlySettlement 
					? `Your early settlement request of RM ${new Intl.NumberFormat("en-MY", {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					}).format(paymentAmount)} has been rejected. Your loan remains active. Reason: ${reason}`
					: `Your loan repayment of RM ${new Intl.NumberFormat("en-MY", {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					}).format(paymentAmount)} has been rejected. Reason: ${reason}`;

				await tx.notification.create({
					data: {
						userId: transaction.userId,
						title: notificationTitle,
						message: notificationMessage,
						type: "SYSTEM",
						priority: "HIGH",
						metadata: {
							transactionId: id,
							rejectionReason: reason,
							adminNotes: notes || "",
							rejectedBy: adminUserId,
							amount: paymentAmount,
							isEarlySettlement: isEarlySettlement,
						},
					},
				});

				return { updatedTransaction };
			});

			// Send WhatsApp notification for payment failure
			try {
				if (transaction.user.phoneNumber && transaction.user.fullName && transaction.loan?.application?.product?.name) {
					// Calculate payment amount from transaction data
					const paymentAmount = Math.abs(transaction.amount);
					
					const whatsappResult = await whatsappService.sendPaymentFailedNotification({
						to: transaction.user.phoneNumber,
						fullName: transaction.user.fullName,
						paymentAmount: `${paymentAmount.toFixed(2)}`,
						loanName: transaction.loan.application.product.name
					});

					if (whatsappResult.success) {
						console.log(`WhatsApp payment failed notification sent to ${transaction.user.phoneNumber}`);
					} else {
						console.log(`WhatsApp payment failed notification failed: ${whatsappResult.error}`);
					}
				} else {
					console.log("Missing required data for WhatsApp payment failed notification");
				}
			} catch (whatsappError) {
				console.error("Could not send WhatsApp payment failed notification:", whatsappError);
			}

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

	// Import SafeMath for precise calculations
	const { SafeMath } = require("../lib/precisionUtils");

	// Flat rate calculation: (Principal + Total Interest) / Term
	const monthlyInterestRate = SafeMath.toNumber(loan.interestRate) / 100;
	const principal = SafeMath.toNumber(loan.principalAmount);
	const term = loan.term;
	
	// Calculate total interest with precision
	const totalInterest = SafeMath.multiply(
		SafeMath.multiply(principal, monthlyInterestRate), 
		term
	);
	
	// Total amount to be paid (principal + interest)
	const totalAmountToPay = SafeMath.add(principal, totalInterest);
	
	// Calculate base monthly payment (will be adjusted for final payment)
	const baseMonthlyPayment = SafeMath.divide(totalAmountToPay, term);
	
	// Calculate base monthly portions
	const baseMonthlyInterest = SafeMath.divide(totalInterest, term);
	const baseMonthlyPrincipal = SafeMath.divide(principal, term);

	console.log(`Generating payment schedule for loan ${loanId}:`);
	console.log(`Principal: ${principal}, Interest Rate: ${loan.interestRate}%, Term: ${term} months`);
	console.log(`Total Interest: ${totalInterest}, Total Amount: ${totalAmountToPay}`);
	console.log(`Base Monthly Payment: ${baseMonthlyPayment}`);

	// Generate all installments first (except the last one)
	let totalScheduled = 0;
	let totalInterestScheduled = 0;
	let totalPrincipalScheduled = 0;

	for (let month = 1; month <= term; month++) {
		// Set due date to end of day exactly 1 month from loan creation
		const loanCreationDate = new Date(loan.createdAt);
		const dueDate = new Date(
			Date.UTC(
				loanCreationDate.getUTCFullYear(),
				loanCreationDate.getUTCMonth() + month,
				loanCreationDate.getUTCDate(),
				15,
				59,
				59,
				999
			)
		);

		let installmentAmount, interestAmount, principalAmount;

		if (month === term) {
			// Final installment: adjust to ensure total matches exactly
			installmentAmount = SafeMath.subtract(totalAmountToPay, totalScheduled);
			interestAmount = SafeMath.subtract(totalInterest, totalInterestScheduled);
			principalAmount = SafeMath.subtract(principal, totalPrincipalScheduled);
			
			console.log(`Final installment adjustment:`);
			console.log(`  Target total: ${totalAmountToPay}, Scheduled so far: ${totalScheduled}`);
			console.log(`  Final payment: ${installmentAmount} (diff: ${SafeMath.subtract(installmentAmount, baseMonthlyPayment)})`);
		} else {
			// Regular installment: use base amounts
			installmentAmount = baseMonthlyPayment;
			interestAmount = baseMonthlyInterest;
			principalAmount = baseMonthlyPrincipal;
			
			// Track running totals
			totalScheduled = SafeMath.add(totalScheduled, installmentAmount);
			totalInterestScheduled = SafeMath.add(totalInterestScheduled, interestAmount);
			totalPrincipalScheduled = SafeMath.add(totalPrincipalScheduled, principalAmount);
		}

		repayments.push({
			loanId: loan.id,
			amount: installmentAmount,
			principalAmount: principalAmount,
			interestAmount: interestAmount,
			status: "PENDING",
			dueDate: dueDate,
			installmentNumber: month,
			scheduledAmount: installmentAmount,
		});
	}

	// Verify total matches exactly
	const calculatedTotal = repayments.reduce((sum, r) => SafeMath.add(sum, r.amount), 0);
	console.log(`Verification: Calculated total ${calculatedTotal} vs Expected ${totalAmountToPay}`);
	if (Math.abs(calculatedTotal - totalAmountToPay) > 0.01) {
		throw new Error(`Payment schedule total mismatch: ${calculatedTotal} vs ${totalAmountToPay}`);
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
				monthlyPayment: baseMonthlyPayment,
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

	const mostRecentPayment = actualPayments[actualPayments.length - 1];
	const mostRecentPaymentDate =
		mostRecentPayment?.processedAt || mostRecentPayment?.createdAt;

	// Process payment allocation at loan level ONCE to avoid double allocation
	let paymentAllocated = false;
	if (totalPaymentsMade > 0) {
		try {
			const { LateFeeProcessor } = await import("../lib/lateFeeProcessor");
			console.log(`💰 Processing payment allocation for loan ${loanId}, total payments: ${totalPaymentsMade}`);
			
			// Check if payment allocation has already been done for this total amount
			// by comparing the sum of actualAmount in repayments with totalPaymentsMade
			const currentAllocatedAmount = repayments.reduce((sum: number, rep: any) => {
				return sum + (rep.actualAmount || 0);
			}, 0);

			console.log(`Current allocated amount: ${currentAllocatedAmount}, Total payments: ${totalPaymentsMade}`);

			// Only re-allocate if there's a significant difference (more than 1 cent)
			if (Math.abs(totalPaymentsMade - currentAllocatedAmount) > 0.01) {
				console.log(`Re-allocating payments due to difference: ${Math.abs(totalPaymentsMade - currentAllocatedAmount)}`);
				
				// Reset all repayment allocation data before re-allocating
				for (const repayment of repayments) {
					await tx.loanRepayment.update({
						where: { id: repayment.id },
						data: {
							actualAmount: null,
							principalPaid: 0,
							lateFeesPaid: 0,
							status: 'PENDING',
							paidAt: null,
							paymentType: null,
							daysEarly: null,
							daysLate: null
						}
					});
				}

				const allocationResult = await LateFeeProcessor.handlePaymentAllocation(
					loanId,
					totalPaymentsMade,
					new Date(mostRecentPaymentDate || new Date()),
					tx
				);

				console.log(`✅ Payment allocation completed for loan ${loanId}:`, {
					lateFeesPaid: allocationResult.lateFeesPaid,
					principalPaid: allocationResult.principalPaid,
					remainingPayment: allocationResult.remainingPayment
				});

				paymentAllocated = true;
			} else {
				console.log(`Payment allocation already up to date for loan ${loanId}`);
				paymentAllocated = true; // Skip fallback logic
			}
		} catch (error) {
			console.error(`Error in payment allocation for loan ${loanId}:`, error);
			// Continue with fallback logic below
		}
	}

	// If payment allocation failed, fall back to simple chronological allocation
	if (!paymentAllocated) {
		let remainingPayments = totalPaymentsMade;

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
			} else {
				const dueDate = new Date(repayment.dueDate);
				const paidDate = new Date(mostRecentPaymentDate || new Date());
				const daysDiff = Math.ceil(
					(paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
				);

				const daysEarly = daysDiff < 0 ? Math.abs(daysDiff) : 0;
				const daysLate = daysDiff > 0 ? daysDiff : 0;

				const wasCompleted = repayment.status === "COMPLETED";

				if (!wasCompleted) {
					// Simple allocation: apply payment up to repayment amount
					const paymentForThisRepayment = Math.min(remainingPayments, repayment.amount);
					
					let repaymentStatus = "PARTIAL";
					let paymentType = "PARTIAL";

					if (paymentForThisRepayment >= repayment.amount) {
						// Check if there are any existing unpaid late fees for this repayment
						const unpaidLateFees = Math.max(0, Math.round(((repayment.lateFeeAmount || 0) - (repayment.lateFeesPaid || 0)) * 100) / 100);

						if (unpaidLateFees <= 0) {
							// Principal fully paid and no late fees - can mark as COMPLETED
							repaymentStatus = "COMPLETED";
							paymentType = daysEarly > 0 ? "EARLY" : daysLate > 0 ? "LATE" : "ON_TIME";
						}
					}

					// Set actualAmount to the payment amount for this repayment (not additive)
					const updateData: any = {
						status: repaymentStatus,
						paidAt: mostRecentPaymentDate,
						paymentType: paymentType,
						daysEarly: daysEarly,
						daysLate: daysLate,
						actualAmount: paymentForThisRepayment, // Set directly, not additive
					};

					await tx.loanRepayment.update({
						where: { id: repayment.id },
						data: updateData,
					});

					remainingPayments -= paymentForThisRepayment;
					console.log(`💰 Fallback allocation for repayment ${repayment.id}: ${paymentForThisRepayment}`);
				} else {
					// Already completed - preserve existing actualAmount
					const existingAmount = repayment.actualAmount || repayment.amount;
					console.log(`✅ Repayment ${repayment.id} already COMPLETED with actualAmount: ${existingAmount}`);
				}
			}
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
		// Calculate total amount due for this repayment using new schema
		const lateFeeAmount = Math.max(0, (repayment.lateFeeAmount || 0) - (repayment.lateFeesPaid || 0));
		const totalAmountDue = repayment.amount + lateFeeAmount;

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
	// Import SafeMath utilities for precise calculations
	const { SafeMath } = require("../lib/precisionUtils");
	
	// Get the loan to get the total amount and current status
	const loan = await tx.loan.findUnique({
		where: { id: loanId },
	});

	if (!loan) {
		throw new Error(`Loan ${loanId} not found`);
	}

	// Skip recalculation for loans that have been settled/discharged
	// Early settlement loans may have interest discounts that don't match the payment-based calculation
	if (loan.status === "PENDING_DISCHARGE" || loan.status === "PENDING_EARLY_SETTLEMENT" || loan.status === "DISCHARGED") {
		console.log(`Skipping outstanding balance recalculation for loan ${loanId} with status ${loan.status}`);
		return loan.outstandingBalance;
	}

	// Get all APPROVED wallet transactions for this loan (actual payments made)
	const actualPayments = await tx.walletTransaction.findMany({
		where: {
			loanId: loanId,
			type: "LOAN_REPAYMENT",
			status: "APPROVED",
		},
	});

	// Get total unpaid late fees for this loan using new schema
	const unpaidLateFees = await tx.$queryRawUnsafe(
		`
		SELECT COALESCE(SUM(lr."lateFeeAmount" - COALESCE(lr."lateFeesPaid", 0)), 0) as total_unpaid_late_fees
		FROM loan_repayments lr
		WHERE lr."loanId" = $1 AND lr."lateFeeAmount" > 0
	`,
		loanId
	);
	const totalUnpaidLateFees = SafeMath.round(SafeMath.toNumber(
		unpaidLateFees[0]?.total_unpaid_late_fees || 0
	));

	console.log(`Calculating outstanding balance for loan ${loanId}:`);
	console.log(`Original loan amount: ${loan.totalAmount}`);
	console.log(`Unpaid late fees: ${totalUnpaidLateFees}`);

	// Calculate total actual payments made (sum of all approved payment transactions)
	const totalPaymentsMade = actualPayments.reduce(
		(total: number, payment: any) => {
			// Payment amounts are stored as negative, so we take absolute value and use SafeMath
			const paymentAmount = SafeMath.toNumber(Math.abs(payment.amount));
			console.log(`Payment transaction ${payment.id}: ${paymentAmount}`);
			return SafeMath.add(total, paymentAmount);
		},
		0
	);

	console.log(`Total payments made: ${totalPaymentsMade}`);

	// Outstanding balance = Original loan amount + Unpaid late fees - Total actual payments made
	const totalAmountOwed = SafeMath.add(SafeMath.toNumber(loan.totalAmount), totalUnpaidLateFees);
	const outstandingBalance = SafeMath.subtract(totalAmountOwed, totalPaymentsMade);
	const finalOutstandingBalance = Math.max(0, outstandingBalance);

	console.log(`Outstanding balance: ${finalOutstandingBalance}`);

	// Check if loan should be marked as PENDING_DISCHARGE
	if ((loan.status === "ACTIVE" || loan.status === "DEFAULT") && finalOutstandingBalance === 0) {
		console.log(
			`🎯 Loan ${loanId} fully paid - updating status to PENDING_DISCHARGE and clearing default flags`
		);
		
		// Check if we're clearing default flags to create audit trail
		const clearingDefaultFlags = loan.defaultRiskFlaggedAt || loan.defaultedAt || loan.status === "DEFAULT";
		
		await tx.loan.update({
			where: { id: loanId },
			data: {
				status: "PENDING_DISCHARGE",
				outstandingBalance: finalOutstandingBalance,
				// Clear default flags when loan is fully paid
				defaultRiskFlaggedAt: null,
				defaultedAt: null,
			},
		});

		// Track the automatic loan status change in audit trail
		await trackLoanStatusChange(
			tx,
			loanId,
			loan.status, // previous status (could be ACTIVE or DEFAULT)
			"PENDING_DISCHARGE", // new status
			"SYSTEM",
			"Loan automatically marked as pending discharge - fully paid",
			`Outstanding balance reached zero${loan.status === "DEFAULT" ? ", default flags cleared" : ""}`,
			{
				automaticStatusChange: true,
				finalOutstandingBalance,
				triggeredBy: "payment_processing",
				defaultFlagsCleared: loan.status === "DEFAULT",
			}
		);

		// Create specific default recovery audit trail entry if we cleared default flags
		if (clearingDefaultFlags) {
			await tx.loanDefaultLog.create({
				data: {
					loanId: loanId,
					eventType: 'RECOVERED',
					daysOverdue: 0,
					outstandingAmount: 0,
					totalLateFees: 0,
					noticeType: 'FULL_PAYMENT_RECOVERY',
					processedAt: new Date(),
					metadata: {
						clearedVia: 'ADMIN_FULL_LOAN_PAYMENT',
						previousStatus: loan.status,
						previousDefaultRiskFlaggedAt: loan.defaultRiskFlaggedAt,
						previousDefaultedAt: loan.defaultedAt,
						newStatus: 'PENDING_DISCHARGE',
						reason: 'Loan fully paid via admin processing - moved to pending discharge'
					}
				}
			});

			// Also create audit trail entry in LoanApplicationHistory
			const loanWithApp = await tx.loan.findUnique({
				where: { id: loanId },
				select: { applicationId: true }
			});
			
			if (loanWithApp?.applicationId) {
				await tx.loanApplicationHistory.create({
					data: {
						applicationId: loanWithApp.applicationId,
						previousStatus: loan.status,
						newStatus: 'PENDING_DISCHARGE',
						changedBy: 'SYSTEM',
						changeReason: 'Default flags cleared after admin full loan payment',
						notes: 'Loan fully paid via admin processing - default risk and default flags cleared, moved to pending discharge.',
						metadata: {
							clearedVia: 'ADMIN_FULL_LOAN_PAYMENT',
							previousDefaultRiskFlaggedAt: loan.defaultRiskFlaggedAt,
							previousDefaultedAt: loan.defaultedAt,
							finalOutstandingBalance: finalOutstandingBalance
						}
					}
				});
			}
			
			console.log(`✅ Default flags cleared for loan ${loanId} via admin full payment - audit trail created`);
		}
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
					status: "PARTIAL", // Mark as partial since not fully paid but some payment made
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

			// Update loan status to PENDING_DISCHARGE with audit trail
			const updatedLoan = await prisma.$transaction(async (tx) => {
				const updated = await tx.loan.update({
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

				// Track the loan status change in audit trail
				await trackLoanStatusChange(
					tx,
					id,
					loan.status, // previous status
					"PENDING_DISCHARGE", // new status
					req.user?.userId,
					"Loan discharge requested by admin",
					reason,
					{
						requestedBy: req.user?.userId,
						requestedAt: new Date().toISOString(),
						dischargeReason: reason,
						outstandingBalance: loan.outstandingBalance,
					}
				);

				return updated;
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
							paymentType: true,
							status: true,
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

			// Check if this is an early settlement case
			const hasEarlySettlement = loan.repayments.some(
				repayment => repayment.paymentType === 'EARLY_SETTLEMENT' && 
				(repayment.status === 'COMPLETED' || repayment.status === 'PAID')
			);

			// Final check for outstanding balance (skip for early settlement cases)
			if (loan.outstandingBalance > 0 && !hasEarlySettlement) {
				return res.status(400).json({
					success: false,
					message: `Cannot discharge loan with outstanding balance of ${loan.outstandingBalance}`,
				});
			}

			// For early settlement cases with remaining balance, log the details
			if (hasEarlySettlement && loan.outstandingBalance > 0) {
				console.log(`🔍 Discharging early settlement loan ${id} with remaining balance: ${loan.outstandingBalance} (due to interest discount)`);
			}

			// Approve discharge with audit trail
			const updatedLoan = await prisma.$transaction(async (tx) => {
				const updated = await tx.loan.update({
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
					},
				});

				// Track the loan status change in audit trail
				await trackLoanStatusChange(
					tx,
					id,
					"PENDING_DISCHARGE", // previous status
					"DISCHARGED", // new status
					req.user?.userId,
					"Loan discharge approved by admin",
					hasEarlySettlement ? "Early settlement loan discharged" : "Fully paid loan discharged",
					{
						approvedBy: req.user?.userId,
						approvedAt: new Date().toISOString(),
						dischargedAt: new Date().toISOString(),
						hasEarlySettlement,
						finalOutstandingBalance: loan.outstandingBalance,
					}
				);

				return updated;
			});

			// Create notification for the user about loan discharge
			try {
				await prisma.notification.create({
					data: {
						userId: updatedLoan.user.id,
						title: "Loan Fully Discharged",
						message: `Congratulations! Your ${updatedLoan.application.product.name} loan has been fully discharged. Thank you for your business.`,
						type: "SYSTEM",
						priority: "HIGH",
						metadata: {
							loanId: id,
							productName: updatedLoan.application.product.name,
							dischargedAt: new Date().toISOString(),
							dischargedBy: req.user?.userId,
						},
					},
				});
			} catch (notificationError) {
				console.error("Could not create loan discharge notification:", notificationError);
			}

		// Send WhatsApp notification for loan discharge
		console.log(`📱 Attempting to send WhatsApp loan discharged notification for loan ${id}`);
		console.log(`📱 User data: phone=${updatedLoan.user.phoneNumber}, name=${updatedLoan.user.fullName}, product=${updatedLoan.application.product.name}`);
		console.log(`📱 Is early settlement: ${hasEarlySettlement}`);
		try {
			if (updatedLoan.user.phoneNumber && updatedLoan.user.fullName) {
				const whatsappResult = await whatsappService.sendLoanDischargedNotification({
					to: updatedLoan.user.phoneNumber,
					fullName: updatedLoan.user.fullName,
					loanName: updatedLoan.application.product.name
				});

				if (whatsappResult.success) {
					console.log(`✅ WhatsApp loan discharged notification sent to ${updatedLoan.user.phoneNumber}`);
				} else {
					console.log(`❌ WhatsApp loan discharged notification failed: ${whatsappResult.error}`);
				}
			} else {
				console.log("⚠️ Missing required data for WhatsApp loan discharged notification");
			}
		} catch (whatsappError) {
			console.error("❌ Could not send WhatsApp loan discharged notification:", whatsappError);
		}

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

			// Process the status change in a transaction to ensure loan creation
			const updatedApplication = await prisma.$transaction(async (tx) => {
			// Update the application with attestation completion
				const updated = await tx.loanApplication.update({
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

				// Create loan and repayment schedule when moving to PENDING_SIGNATURE
				try {
					await createLoanOnPendingSignature(id, tx);
					console.log(`Loan and repayment schedule created for application ${id} during attestation completion`);
				} catch (error) {
					console.error(`Failed to create loan for application ${id}:`, error);
					// Don't fail the transaction, just log the error
				}

				return updated;
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







// Helper function to get loan calculation settings from database
async function getLoanCalculationSettings(tx: any) {
	try {
		const settings = await tx.systemSettings.findMany({
			where: {
				key: {
					in: ['PAYMENT_SCHEDULE_TYPE', 'CUSTOM_DUE_DATE', 'PRORATION_CUTOFF_DATE', 'LOAN_CALCULATION_METHOD']
				},
				isActive: true
			}
		});

		const scheduleType = settings.find((s: any) => s.key === 'PAYMENT_SCHEDULE_TYPE')?.value || '"CUSTOM_DATE"';
		const customDueDate = settings.find((s: any) => s.key === 'CUSTOM_DUE_DATE')?.value || '1';
		const prorationCutoffDate = settings.find((s: any) => s.key === 'PRORATION_CUTOFF_DATE')?.value || '20';
		const calculationMethod = settings.find((s: any) => s.key === 'LOAN_CALCULATION_METHOD')?.value || '"STRAIGHT_LINE"';

		return {
			scheduleType: JSON.parse(scheduleType),
			customDueDate: JSON.parse(customDueDate),
			prorationCutoffDate: JSON.parse(prorationCutoffDate),
			calculationMethod: JSON.parse(calculationMethod)
		};
	} catch (error) {
		console.error('Error fetching loan calculation settings, using defaults:', error);
		// Return defaults if settings not found
		return {
			scheduleType: 'CUSTOM_DATE',
			customDueDate: 1,
			prorationCutoffDate: 20,
			calculationMethod: 'STRAIGHT_LINE'
		};
	}
}



/**
 * @swagger
 * /api/admin/payments/manual:
 *   post:
 *     summary: Create a manual payment for a loan (admin only)
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
 *               - loanId
 *               - amount
 *               - paymentMethod
 *               - reference
 *             properties:
 *               loanId:
 *                 type: string
 *                 description: The loan ID to apply payment to
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               paymentMethod:
 *                 type: string
 *                 description: Payment method (e.g., bank_transfer, cash, etc.)
 *               reference:
 *                 type: string
 *                 description: Payment reference/transaction ID
 *               notes:
 *                 type: string
 *                 description: Admin notes about the payment
 *               paymentDate:
 *                 type: string
 *                 format: date
 *                 description: Date when payment was made (defaults to now)
 *     responses:
 *       200:
 *         description: Payment created and allocated successfully
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.post(
	"/payments/manual",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const { loanId, amount, paymentMethod, reference, notes, paymentDate } = req.body;
			const adminUserId = req.user?.userId;

			// Validate required fields
			if (!loanId || !amount || !paymentMethod || !reference) {
				return res.status(400).json({
					success: false,
					message: "Missing required fields: loanId, amount, paymentMethod, reference"
				});
			}

			if (amount <= 0) {
				return res.status(400).json({
					success: false,
					message: "Payment amount must be greater than 0"
				});
			}

			// Get the loan to verify it exists and is active
			const loan = await prisma.loan.findUnique({
				where: { id: loanId },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							phoneNumber: true,
						}
					},
					application: {
						include: {
							product: {
								select: {
									name: true
								}
							}
						}
					}
				}
			});

			if (!loan) {
				return res.status(404).json({
					success: false,
					message: "Loan not found"
				});
			}

			if (loan.status !== "ACTIVE") {
				return res.status(400).json({
					success: false,
					message: `Cannot create payment for loan with status: ${loan.status}. Only ACTIVE loans can receive payments.`
				});
			}

			const processedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

			// Use a transaction to create the payment and handle allocation
			const result = await prisma.$transaction(async (tx) => {
				// Get user's wallet first
				const wallet = await tx.wallet.findUnique({
					where: { userId: loan.userId }
				});

				if (!wallet) {
					throw new Error("User wallet not found");
				}

				// Create a wallet transaction record exactly like user repayments
				const walletTransaction = await tx.walletTransaction.create({
					data: {
						userId: loan.userId,
						walletId: wallet.id,
						loanId: loanId,
						amount: -amount, // Negative for outgoing payment (like user repayments)
						type: "LOAN_REPAYMENT", // Same type as user repayments
						status: "APPROVED", // Manual payments are pre-approved
						description: `Manual loan repayment for loan ${loanId} via ${paymentMethod}`,
						reference: reference,
						processedAt: processedPaymentDate,
						metadata: {
							paymentMethod: paymentMethod,
							loanId: loanId,
							outstandingBalance: loan.outstandingBalance,
							originalAmount: amount,
							createdBy: "ADMIN",
							adminUserId: adminUserId,
							notes: notes || "",
							paymentDate: processedPaymentDate.toISOString(),
						} as any,
					},
				});

				// Import and use the payment allocation function
				const { LateFeeProcessor } = await import("../lib/lateFeeProcessor");
				const allocationResult = await LateFeeProcessor.handlePaymentAllocation(
					loanId,
					amount,
					processedPaymentDate,
					tx
				);

				if (!allocationResult.success) {
					throw new Error(allocationResult.errorMessage || "Failed to allocate payment");
				}

				// Update the wallet transaction with allocation details
				const currentMetadata = walletTransaction.metadata as any;
				await tx.walletTransaction.update({
					where: { id: walletTransaction.id },
					data: {
						metadata: {
							...currentMetadata,
							allocationResult: {
								lateFeesPaid: allocationResult.lateFeesPaid,
								principalPaid: allocationResult.principalPaid,
								paymentAllocation: allocationResult.paymentAllocation,
								remainingPayment: allocationResult.remainingPayment,
							}
						} as any
					}
				});

				// Update loan outstanding balance
				const { calculateOutstandingBalance } = await import("./wallet");
				await calculateOutstandingBalance(loanId, tx);

				// Create notification for the user (like user repayments do)
				await tx.notification.create({
					data: {
						userId: loan.userId,
						title: "Payment Processed",
						message: `A manual payment of RM ${amount.toFixed(2)} has been processed for your loan. Reference: ${reference}`,
						type: "SYSTEM",
						priority: "MEDIUM",
						metadata: {
							transactionId: walletTransaction.id,
							loanId: loanId,
							amount: amount,
							paymentMethod: paymentMethod,
							reference: reference,
							processedBy: "ADMIN",
							adminUserId: adminUserId,
							notes: notes || "",
						},
					},
				});

				return {
					walletTransaction,
					allocationResult,
					loan
				};
			});

			// Generate receipt for manual payment first
			try {
				// Check if receipt already exists for this transaction
				const existingReceipt = await prisma.paymentReceipt.findFirst({
					where: {
						metadata: {
							path: ['transactionId'],
							equals: result.walletTransaction.id
						}
					}
				});

				if (!existingReceipt) {
					// Find the repayment that corresponds to this specific transaction
					// Get all repayments for this loan and find the one that should receive this payment
					const allRepayments = await prisma.loanRepayment.findMany({
						where: {
							loanId: loanId
						},
						orderBy: { dueDate: 'asc' }
					});

					console.log(`🧾 Manual payment receipt generation - All repayments for loan ${loanId}:`);
					allRepayments.forEach((r, i) => {
						console.log(`  ${i + 1}. Installment ${r.installmentNumber || 'N/A'}: ${r.status}, actualAmount: ${r.actualAmount || 0}, amount: ${r.amount}, paidAt: ${r.paidAt}`);
					});

					// IMPROVED: Find the most recent repayment that was affected by this manual payment
					// Use the same reliable strategy as automated payments
					
					let primaryRepayment = null;
					
					console.log(`🧾 Finding repayment for manual payment receipt generation...`);
					
					// Strategy 1: Look for PARTIAL repayments first (these are currently being paid)
					primaryRepayment = allRepayments.find(r => r.status === 'PARTIAL');
					if (primaryRepayment) {
						console.log(`🧾 ✅ Found PARTIAL repayment: Installment ${primaryRepayment.installmentNumber}`);
					}
					
					// Strategy 2: If no PARTIAL, find the most recently completed repayment
					if (!primaryRepayment) {
						const completedRepayments = allRepayments.filter(r => r.status === 'COMPLETED' && (r.actualAmount || 0) > 0);
						
						if (completedRepayments.length > 0) {
							// Sort by: 1) updatedAt (most recent update), 2) paidAt (most recent payment), 3) installmentNumber (latest installment)
							primaryRepayment = completedRepayments.sort((a, b) => {
								// First compare updatedAt
								const aUpdated = new Date(a.updatedAt).getTime();
								const bUpdated = new Date(b.updatedAt).getTime();
								if (aUpdated !== bUpdated) return bUpdated - aUpdated;
								
								// Then compare paidAt
								if (a.paidAt && b.paidAt) {
									const aPaid = new Date(a.paidAt).getTime();
									const bPaid = new Date(b.paidAt).getTime();
									if (aPaid !== bPaid) return bPaid - aPaid;
								}
								
								// Finally compare installment number (higher = more recent)
								return (b.installmentNumber || 0) - (a.installmentNumber || 0);
							})[0];
							
							console.log(`🧾 ✅ Found most recent COMPLETED repayment: Installment ${primaryRepayment.installmentNumber}, updatedAt: ${primaryRepayment.updatedAt}`);
						}
					}
					
					// Strategy 3: If still no match, get the first PENDING repayment (next in line)
					if (!primaryRepayment) {
						primaryRepayment = allRepayments.find(r => r.status === 'PENDING');
						if (primaryRepayment) {
							console.log(`🧾 ⚠️ Using next PENDING repayment: Installment ${primaryRepayment.installmentNumber}`);
						}
					}
					
					// Strategy 4: Final fallback - most recent repayment by installment number
					if (!primaryRepayment && allRepayments.length > 0) {
						primaryRepayment = allRepayments.sort((a, b) => (b.installmentNumber || 0) - (a.installmentNumber || 0))[0];
						console.log(`🧾 ⚠️ Using latest installment fallback: Installment ${primaryRepayment.installmentNumber}`);
					}

					if (primaryRepayment) {
						const ReceiptService = await import("../lib/receiptService");
						const receiptResult = await ReceiptService.default.generateReceipt({
							repaymentId: primaryRepayment.id,
							generatedBy: adminUserId || 'admin',
							paymentMethod: paymentMethod,
							reference: reference,
							actualPaymentAmount: amount,
							transactionId: result.walletTransaction.id
						});
						
						console.log(`Receipt generated for manual payment ${result.walletTransaction.id}: ${receiptResult.receiptNumber}`);
					}
				}
			} catch (receiptError) {
				console.error("Error generating receipt for manual payment:", receiptError);
				// Don't fail the payment if receipt generation fails
			}

			console.log(`Manual payment created successfully: ${result.walletTransaction.id} for loan ${loanId}, amount: RM ${amount}`);

			// Send WhatsApp notification for manual payment AFTER receipt generation
			try {
				if (loan.user.phoneNumber && loan.user.fullName) {
					// Find the newly generated receipt for this transaction
					let receiptUrl: string | undefined;
					try {
						const receipt = await prisma.paymentReceipt.findFirst({
							where: {
								metadata: {
									path: ['transactionId'],
									equals: result.walletTransaction.id
								}
							}
						});
						
						if (receipt) {
							receiptUrl = receipt.id;
							console.log(`🔗 Found receipt for manual payment WhatsApp notification: ${receipt.id}`);
						} else {
							console.log(`🔗 No receipt found for manual payment: ${result.walletTransaction.id}`);
						}
					} catch (receiptError) {
						console.error("Error getting receipt for manual payment WhatsApp notification:", receiptError);
					}

					// Get updated loan details for notification
					const updatedLoan = await prisma.loan.findUnique({
						where: { id: loanId },
						include: {
							repayments: {
								where: { status: "COMPLETED" },
								orderBy: { dueDate: 'asc' }
							},
							application: {
								include: {
									product: { select: { name: true } }
								}
							}
						}
					});

					if (updatedLoan) {
						// Get next payment info
						const nextPayment = await prisma.loanRepayment.findFirst({
							where: {
								loanId: loanId,
								status: { in: ['PENDING', 'PARTIAL'] }
							},
							orderBy: { dueDate: 'asc' }
						});

						const completedPayments = updatedLoan.repayments.length;
						const totalPayments = updatedLoan.term || updatedLoan.application.term || 12;

						// Calculate next payment amount properly
						let nextPaymentAmount = 0;
						if (nextPayment) {
							const scheduledAmount = nextPayment.scheduledAmount || nextPayment.amount;
							const lateFeeAmount = nextPayment.lateFeeAmount || 0;
							const paidAmount = nextPayment.actualAmount || 0;

							if (nextPayment.status === 'PARTIAL') {
								const remainingAmount = (scheduledAmount + lateFeeAmount) - paidAmount;
								nextPaymentAmount = Math.max(remainingAmount, 0);
							} else {
								nextPaymentAmount = scheduledAmount + lateFeeAmount;
							}
						}

						const whatsappService = await import("../lib/whatsappService");
						const whatsappResult = await whatsappService.default.sendPaymentApprovedNotification({
							to: loan.user.phoneNumber,
							fullName: loan.user.fullName,
							paymentAmount: amount.toFixed(2),
							loanName: updatedLoan.application.product.name,
							nextPaymentAmount: nextPaymentAmount.toFixed(2),
							nextDueDate: nextPayment ? formatDateForWhatsApp(nextPayment.dueDate) : "N/A",
							completedPayments: completedPayments.toString(),
							totalPayments: totalPayments.toString(),
							receiptUrl: receiptUrl // Include receipt URL for manual payments
						});
						
						if (whatsappResult.success) {
							console.log(`WhatsApp manual payment notification sent: ${whatsappResult.messageId}${receiptUrl ? ` with receipt: ${receiptUrl}` : ' (no receipt)'}`);
						} else {
							console.error(`Failed to send WhatsApp manual payment notification: ${whatsappResult.error}`);
						}
					}
				}
			} catch (whatsappError) {
				console.error("Error sending WhatsApp notification for manual payment:", whatsappError);
				// Don't fail the entire operation if WhatsApp fails
			}

			return res.json({
				success: true,
				message: `Manual payment of RM ${amount.toFixed(2)} created successfully`,
				data: {
					paymentId: result.walletTransaction.id,
					loanId: loanId,
					amount: amount,
					paymentMethod: paymentMethod,
					reference: reference,
					paymentDate: processedPaymentDate,
					allocationResult: result.allocationResult,
				}
			});
		} catch (error) {
			console.error("Error creating manual payment:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to create manual payment",
				error: error instanceof Error ? error.message : "Unknown error"
			});
		}
	}
);

// Configure multer for CSV uploads
const csvUpload = multer({
	storage: (multer as any).memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB max file size
	},
	fileFilter: (
		_req: Request,
		file: Express.Multer.File,
		cb: (error: Error | null, acceptFile: boolean) => void
	) => {
		if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
			cb(null, true);
		} else {
			cb(new Error('Only CSV files are allowed'), false);
		}
	}
});

/**
 * @swagger
 * /api/admin/payments/csv-upload:
 *   post:
 *     summary: Upload and process CSV bank transaction file for payment matching (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               csvFile:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing bank transactions
 *     responses:
 *       200:
 *         description: CSV processed successfully with matching results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       description: All extracted transactions
 *                     matches:
 *                       type: array
 *                       description: Matched transactions with payments
 *                     unmatchedTransactions:
 *                       type: array
 *                       description: Transactions that couldn't be matched
 *                     unmatchedPayments:
 *                       type: array
 *                       description: Payments that couldn't be matched
 *                     bankFormat:
 *                       type: string
 *                       description: Detected bank format
 *                     summary:
 *                       type: object
 *                       description: Processing summary statistics
 *       400:
 *         description: Invalid file or processing error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.post(
	"/payments/csv-upload",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	csvUpload.single('csvFile'),
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const file = req.file;
			
			if (!file) {
				return res.status(400).json({
					success: false,
					message: "No CSV file uploaded"
				});
			}

			// Convert buffer to string
			const csvContent = file.buffer.toString('utf-8');
			
			if (!csvContent.trim()) {
				return res.status(400).json({
					success: false,
					message: "CSV file is empty"
				});
			}

			// Get pending payments for matching
			const pendingPayments = await prisma.walletTransaction.findMany({
				where: {
					status: "PENDING",
					type: "LOAN_REPAYMENT"
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							phoneNumber: true
						}
					},
					loan: {
						include: {
							application: {
								include: {
									product: {
										select: {
											name: true
										}
									}
								}
							}
						}
					}
				},
				orderBy: {
					createdAt: 'desc'
				}
			});

			// Process CSV file
			const result = processCSVFile(csvContent, pendingPayments);

			return res.json({
				success: true,
				data: result
			});

		} catch (error) {
			console.error("Error processing CSV file:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to process CSV file",
				error: error instanceof Error ? error.message : "Unknown error"
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/payments/csv-batch-approve:
 *   post:
 *     summary: Batch approve payments based on CSV transaction matches (admin only)
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
 *               - matches
 *             properties:
 *               matches:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     paymentId:
 *                       type: string
 *                       description: The payment ID to approve
 *                     transactionRef:
 *                       type: string
 *                       description: Bank transaction reference
 *                     amount:
 *                       type: number
 *                       description: Transaction amount
 *                     notes:
 *                       type: string
 *                       description: Optional approval notes
 *               notes:
 *                 type: string
 *                 description: General notes for the batch approval
 *     responses:
 *       200:
 *         description: Batch approval completed
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
router.post(
	"/payments/csv-batch-approve",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const { matches, notes } = req.body;
			const adminUserId = req.user?.userId;

			if (!matches || !Array.isArray(matches) || matches.length === 0) {
				return res.status(400).json({
					success: false,
					message: "No matches provided for batch approval"
				});
			}

			const results = {
				approved: [] as string[],
				failed: [] as { paymentId: string; error: string }[],
				summary: {
					total: matches.length,
					successful: 0,
					failed: 0
				}
			};

			// Process each match in sequence to avoid race conditions
			for (const match of matches) {
				try {
					const { paymentId, transactionRef, amount, notes: matchNotes } = match;

					if (!paymentId) {
						results.failed.push({
							paymentId: 'unknown',
							error: 'Missing payment ID'
						});
						continue;
					}

					// Get the payment to verify it exists and is still pending
					const payment = await prisma.walletTransaction.findUnique({
						where: { id: paymentId },
						include: {
							user: {
								select: {
									id: true,
									fullName: true,
									phoneNumber: true
								}
							},
							loan: {
								include: {
									application: {
										include: {
											product: {
												select: {
													name: true
												}
											}
										}
									}
								}
							}
						}
					});

					if (!payment) {
						results.failed.push({
							paymentId,
							error: 'Payment not found'
						});
						continue;
					}

					if (payment.status !== "PENDING") {
						results.failed.push({
							paymentId,
							error: `Payment is ${payment.status}, not pending`
						});
						continue;
					}

					// Use a transaction to approve the payment
					await prisma.$transaction(async (tx) => {
						// Update payment status
						await tx.walletTransaction.update({
							where: { id: paymentId },
							data: {
								status: "APPROVED",
								processedAt: new Date(),
								metadata: Object.assign(
									payment.metadata || {},
									{
										csvBatchApproval: true,
										bankTransactionRef: transactionRef,
										bankAmount: amount,
										approvedBy: adminUserId,
										approvalNotes: matchNotes || notes,
										approvalDate: new Date().toISOString()
									}
								)
							}
						});

						// Handle loan repayment allocation using existing LateFeeProcessor
						if (payment.loanId) {
							const { LateFeeProcessor } = await import("../lib/lateFeeProcessor");
							await LateFeeProcessor.handlePaymentAllocation(
								payment.loanId,
								Math.abs(payment.amount),
								new Date(),
								tx
							);
						}
					});

					// Clear default flags if needed (outside transaction to avoid conflicts)
					if (payment.loanId) {
						await clearDefaultFlagsIfNeeded(payment.loanId, adminUserId || 'SYSTEM');
					}

					// Continue with the rest of the processing in a new transaction
					await prisma.$transaction(async (tx) => {
						// Create admin notification
						await tx.notification.create({
							data: {
								userId: payment.userId,
								title: "Payment Approved",
								message: `Your payment of RM ${new Intl.NumberFormat("en-MY", {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								}).format(Math.abs(payment.amount))} has been approved via CSV batch processing.`,
								type: "SYSTEM",
								priority: "HIGH",
								isRead: false
							}
						});

						console.log(`Payment ${paymentId} approved via CSV batch processing`);
					});

					// Generate receipt for bulk approved payment (using same logic as individual approval)
					try {
						if (payment.loanId) {
							const existingReceipt = await prisma.paymentReceipt.findFirst({
								where: {
									metadata: {
										path: ['transactionId'],
										equals: paymentId
									}
								}
							});

							if (!existingReceipt) {
								const allRepayments = await prisma.loanRepayment.findMany({
									where: { loanId: payment.loanId },
									orderBy: { dueDate: 'asc' }
								});
								
								// Use improved strategy to find affected repayment
								let affectedRepayment = allRepayments.find(r => r.status === 'PARTIAL');
								
								if (!affectedRepayment) {
									const completedRepayments = allRepayments.filter(r => r.status === 'COMPLETED' && (r.actualAmount || 0) > 0);
									if (completedRepayments.length > 0) {
										affectedRepayment = completedRepayments.sort((a, b) => {
											const aUpdated = new Date(a.updatedAt).getTime();
											const bUpdated = new Date(b.updatedAt).getTime();
											return bUpdated - aUpdated;
										})[0];
									}
								}
								
								if (!affectedRepayment) {
									affectedRepayment = allRepayments.find(r => r.status === 'PENDING');
								}
								
								if (!affectedRepayment && allRepayments.length > 0) {
									affectedRepayment = allRepayments.sort((a, b) => (b.installmentNumber || 0) - (a.installmentNumber || 0))[0];
								}

								if (affectedRepayment) {
									const ReceiptService = await import("../lib/receiptService");
									const receiptResult = await ReceiptService.default.generateReceipt({
										repaymentId: affectedRepayment.id,
										generatedBy: adminUserId || 'admin',
										paymentMethod: 'CSV Batch Processing',
										reference: transactionRef || paymentId,
										actualPaymentAmount: Math.abs(payment.amount),
										transactionId: paymentId
									});
									
									console.log(`Receipt generated for bulk payment ${paymentId}: ${receiptResult.receiptNumber}`);
								}
							}
						}
					} catch (receiptError) {
						console.error("Error generating receipt for bulk payment:", receiptError);
					}

					// Send WhatsApp notification for approved payment
					try {
						if (payment.user?.phoneNumber && payment.user?.fullName && payment.loan) {
							// Get updated loan details for notification
							const updatedLoan = await prisma.loan.findUnique({
								where: { id: payment.loanId! },
								include: {
									repayments: {
										where: { status: { in: ["PAID", "COMPLETED"] } },
										orderBy: { dueDate: 'asc' }
									},
									application: {
										include: {
											product: { select: { name: true } }
										}
									}
								}
							});

							if (updatedLoan) {
								// Get next payment info
								const nextPayment = await prisma.loanRepayment.findFirst({
									where: {
										loanId: payment.loanId!,
										status: { notIn: ["PAID", "COMPLETED"] }
									},
									orderBy: { dueDate: 'asc' }
								});

								const completedPayments = updatedLoan.repayments.length;
								const totalPayments = updatedLoan.term || updatedLoan.application.term || 12;

								// Find receipt for this transaction
								let receiptUrl: string | undefined;
								try {
									const receipt = await prisma.paymentReceipt.findFirst({
										where: {
											metadata: {
												path: ['transactionId'],
												equals: paymentId
											}
										}
									});
									
									if (receipt) {
										receiptUrl = receipt.id;
										console.log(`🔗 Found receipt for bulk WhatsApp notification: ${receipt.id}`);
									}
								} catch (receiptError) {
									console.error("Error getting receipt for bulk WhatsApp notification:", receiptError);
								}

								const whatsappResult = await whatsappService.sendPaymentApprovedNotification({
									to: payment.user.phoneNumber,
									fullName: payment.user.fullName,
									paymentAmount: Math.abs(payment.amount).toFixed(2),
									loanName: updatedLoan.application.product.name,
									nextPaymentAmount: nextPayment?.amount?.toFixed(2) || "0.00",
									nextDueDate: nextPayment ? formatDateForWhatsApp(nextPayment.dueDate) : "N/A",
									completedPayments: completedPayments.toString(),
									totalPayments: totalPayments.toString(),
									receiptUrl: receiptUrl // Include receipt URL for bulk payments
								});

								if (whatsappResult.success) {
									console.log("WhatsApp payment approval notification sent:", whatsappResult.messageId);
								} else {
									console.error("WhatsApp payment approval notification failed:", whatsappResult.error);
								}
							}
						}
					} catch (whatsappError) {
						console.error("Error sending WhatsApp payment approval notification:", whatsappError);
						// Continue without failing the approval
					}

					results.approved.push(paymentId);
					results.summary.successful++;

				} catch (error) {
					console.error(`Error approving payment ${match.paymentId}:`, error);
					results.failed.push({
						paymentId: match.paymentId || 'unknown',
						error: error instanceof Error ? error.message : 'Unknown error'
					});
					results.summary.failed++;
				}
			}

			return res.json({
				success: true,
				data: results
			});

		} catch (error) {
			console.error("Error in batch payment approval:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to process batch approval",
				error: error instanceof Error ? error.message : "Unknown error"
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/products:
 *   get:
 *     summary: Get all products (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   code:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   interestRate:
 *                     type: number
 *                   isActive:
 *                     type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied, admin privileges required
 *       500:
 *         description: Server error
 */
// Get all products (admin only)
router.get(
	"/products",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			const products = await prisma.product.findMany({
				select: {
					id: true,
					code: true,
					name: true,
					description: true,
					minAmount: true,
					maxAmount: true,
					repaymentTerms: true,
					interestRate: true,
					eligibility: true,
					lateFeeRate: true,
					lateFeeFixedAmount: true,
					lateFeeFrequencyDays: true,
					originationFee: true,
					legalFee: true,
					applicationFee: true,
					stampingFee: true,
					legalFeeFixed: true,
					legalFeeType: true,
					legalFeeValue: true,
					requiredDocuments: true,
					features: true,
					loanTypes: true,
					isActive: true,
					collateralRequired: true,
				},
				orderBy: {
					createdAt: "asc",
				},
			});

			// Convert Decimal fields to numbers for proper JSON serialization
			const productsWithNumbers = products.map(product => ({
				...product,
				originationFee: Number(product.originationFee),
				legalFee: Number(product.legalFee),
				applicationFee: Number(product.applicationFee),
				stampingFee: Number(product.stampingFee),
				legalFeeFixed: Number(product.legalFeeFixed),
				legalFeeValue: Number(product.legalFeeValue),
				interestRate: Number(product.interestRate),
				lateFeeRate: Number(product.lateFeeRate),
				lateFeeFixedAmount: Number(product.lateFeeFixedAmount),
			}));

			return res.json(productsWithNumbers);
		} catch (error) {
			console.error("Error fetching products:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

// Manual trigger for upcoming payment notifications
router.post("/trigger-upcoming-payment-notifications", async (_req: any, res: any) => {
	try {
		console.log(`[${new Date().toISOString()}] Manual trigger for upcoming payment notifications requested by admin`);

		// Import the PaymentNotificationProcessor
		const { PaymentNotificationProcessor } = await import("../lib/upcomingPaymentProcessor");

		// Process upcoming payments only
		const result = await PaymentNotificationProcessor.processUpcomingPayments();

		console.log(`[${new Date().toISOString()}] Manual upcoming payment processing completed:`, result);

		return res.json({
			success: true,
			message: "Upcoming payment notifications processed successfully",
			data: {
				totalChecked: result.totalChecked,
				notificationsSent: result.notificationsSent,
				errors: result.errors,
				details: result.details,
				processedAt: new Date().toISOString()
			}
		});

	} catch (error: any) {
		console.error("Error in manual upcoming payment notification trigger:", error);
		return res.status(500).json({
			success: false,
			message: "Failed to process upcoming payment notifications",
			error: error.message
		});
	}
});

// Manual trigger for payment notifications (both upcoming and late)
router.post("/trigger-payment-notifications", async (_req: any, res: any) => {
	try {
		console.log(`[${new Date().toISOString()}] Manual trigger for payment notifications (upcoming & late) requested by admin`);

		// Import the PaymentNotificationProcessor
		const { PaymentNotificationProcessor } = await import("../lib/upcomingPaymentProcessor");

		// Process both upcoming and late payments
		const result = await PaymentNotificationProcessor.processAllPaymentNotifications();

		console.log(`[${new Date().toISOString()}] Manual payment notification processing completed:`, result);

		return res.json({
			success: true,
			message: "Payment notifications processed successfully",
			data: {
				totalChecked: result.totalChecked,
				notificationsSent: result.notificationsSent,
				errors: result.errors,
				upcomingPayments: result.upcomingPayments,
				latePayments: result.latePayments,
				details: result.details,
				processedAt: new Date().toISOString()
			}
		});

	} catch (error: any) {
		console.error("Error in manual payment notification trigger:", error);
		return res.status(500).json({
			success: false,
			message: "Failed to process payment notifications",
			error: error.message
		});
	}
});

/**
 * GET /api/admin/loans/:loanId/signatures
 * Get signature status for a specific loan
 */
router.get('/loans/:loanId/signatures', authenticateToken, async (req, res) => {
	try {
		const { loanId } = req.params;

		if (!loanId) {
			return res.status(400).json({
				success: false,
				message: 'Loan ID is required'
			});
		}

		// Verify loan exists
		const loan = await prisma.loan.findUnique({
			where: { id: loanId },
			include: {
				application: true,
				user: true
			}
		});

		if (!loan) {
			return res.status(404).json({
				success: false,
				message: 'Loan not found'
			});
		}

		// Get signature status using DocuSeal service
		const { docusealService } = await import('../lib/docusealService');
		const signatures = await docusealService.getSignatureStatus(loanId);

		// Calculate current agreement status from signatory records
		const currentAgreementStatus = await docusealService.calculateAgreementStatus(loanId);

		return res.json({
			success: true,
			data: {
				loanId,
				loanStatus: loan.status,
				agreementStatus: currentAgreementStatus, // Use calculated status from signatory records
				legacyAgreementStatus: loan.agreementStatus, // Keep legacy field for backward compatibility
				docusealSubmissionId: loan.docusealSubmissionId,
				signatures,
				borrowerName: loan.user.fullName,
				borrowerEmail: loan.user.email
			}
		});

	} catch (error: any) {
		console.error('Error fetching signature status:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to fetch signature status',
			error: error.message
		});
	}
});

/**
 * GET /api/admin/applications/:applicationId/signatures
 * Get signature status for a specific loan application
 */
router.get('/applications/:applicationId/signatures', authenticateToken, async (req, res) => {
	try {
		const { applicationId } = req.params;

		if (!applicationId) {
			return res.status(400).json({
				success: false,
				message: 'Application ID is required'
			});
		}

		// Find the application and its associated loan
		const application = await prisma.loanApplication.findUnique({
			where: { id: applicationId },
			include: {
				user: true,
				product: true
			}
		});

		if (!application) {
			return res.status(404).json({
				success: false,
				message: 'Application not found'
			});
		}

		// Find the loan associated with this application
		const loan = await prisma.loan.findFirst({
			where: { applicationId: applicationId },
			include: {
				user: true
			}
		});

		if (!loan) {
			return res.status(404).json({
				success: false,
				message: 'No loan found for this application'
			});
		}

		// Get signature status using DocuSeal service
		const { docusealService } = await import('../lib/docusealService');
		const signatures = await docusealService.getSignatureStatus(loan.id);

		// Calculate current agreement status from signatory records
		const currentAgreementStatus = await docusealService.calculateAgreementStatus(loan.id);

		return res.json({
			success: true,
			data: {
				applicationId,
				loanId: loan.id,
				loanStatus: loan.status,
				agreementStatus: currentAgreementStatus, // Use calculated status from signatory records
				legacyAgreementStatus: loan.agreementStatus, // Keep legacy field for backward compatibility
				docusealSubmissionId: loan.docusealSubmissionId,
				signatures,
				borrowerName: loan.user.fullName,
				borrowerEmail: loan.user.email
			}
		});

	} catch (error: any) {
		console.error('Error fetching application signature status:', error);
		return res.status(500).json({
			success: false,
			message: 'Internal server error'
		});
	}
});

/**
 * @swagger
 * /api/admin/applications/pin-sign:
 *   post:
 *     summary: Sign document with PIN for company/witness (admin and attestor)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               applicationId:
 *                 type: string
 *               signatoryId:
 *                 type: string
 *               pin:
 *                 type: string
 *               signatoryType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document signed successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.post(
	"/applications/pin-sign",
	authenticateToken,
	requireAdminOrAttestor as unknown as RequestHandler,
	// @ts-ignore
	async (req: AuthRequest, res: Response) => {
		try {
			const { applicationId, pin, signatoryType } = req.body;
			const userRole = req.user?.role;

			// Validate required fields
			if (!applicationId || !pin || !signatoryType) {
				return res.status(400).json({
					success: false,
					message: "Missing required fields"
				});
			}

			// Validate PIN format (8 digits)
			if (!/^\d{8}$/.test(pin)) {
				return res.status(400).json({
					success: false,
					message: "PIN must be exactly 8 digits"
				});
			}

			// ATTESTOR users can only sign as WITNESS
			if (userRole === "ATTESTOR" && signatoryType !== "WITNESS") {
				return res.status(403).json({
					success: false,
					message: "ATTESTOR users can only sign as witness"
				});
			}

			// Get application and loan details
			const application = await prisma.loanApplication.findUnique({
				where: { id: applicationId },
				include: {
					loan: {
						include: {
							signatories: true
						}
					}
				}
			});

			if (!application || !application.loan) {
				return res.status(404).json({
					success: false,
					message: "Application or loan not found"
				});
			}

		// Find the signatory by type (since we don't have signatoryId anymore)
		// Convert signatoryType to uppercase to match database values
		const normalizedSignatoryType = signatoryType.toUpperCase();
		
		console.log(`Looking for signatory with type: ${normalizedSignatoryType} for loan: ${application.loan.id}`);
		
		const signatory = await prisma.loanSignatory.findFirst({
			where: { 
				loanId: application.loan.id,
				signatoryType: normalizedSignatoryType
			}
		});

		// Debug: Log all signatories for this loan
		const debugSignatories = await prisma.loanSignatory.findMany({
			where: { loanId: application.loan.id }
		});
		console.log(`All signatories for loan ${application.loan.id}:`, debugSignatories.map(s => ({ type: s.signatoryType, status: s.status })));

		if (!signatory) {
			return res.status(404).json({
				success: false,
				message: `${normalizedSignatoryType} signatory not found`
			});
		}

			// Check if already signed
			if (signatory.status === "SIGNED") {
				return res.status(400).json({
					success: false,
					message: "Document already signed by this party"
				});
			}

			// TODO: Validate PIN against stored PIN/credentials (implement your PIN validation logic here)
			// For now, we'll assume PIN validation passes
			console.log(`PIN signing attempt for ${normalizedSignatoryType} with PIN: ${pin}`);

			// Call signing orchestrator for PKI signing
			// Get the IC number and full name of the currently logged-in admin user
			const adminUserId = req.user?.userId;
			const adminUser = await prisma.user.findUnique({
				where: { id: adminUserId },
				select: { icNumber: true, idNumber: true, fullName: true }
			});

			if (!adminUser) {
				return res.status(404).json({
					success: false,
					message: "Admin user not found"
				});
			}

			const adminIcNumber = adminUser.icNumber || adminUser.idNumber;
			if (!adminIcNumber) {
				return res.status(400).json({
					success: false,
					message: "Admin user IC number not found. Please update your profile."
				});
			}

			// Use admin user's IC number and name for signing
			const userInfo = {
				userId: adminIcNumber, // Admin user's IC number for MTSA
				fullName: adminUser.fullName || `${signatoryType} Representative`,
				vpsUserId: `${signatoryType}_${application.loan.id}` // Unique identifier for database
			};

			try {
				const orchestratorResponse = await fetch(`${signingConfig.url}/api/pki/sign-pdf-pin`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-API-Key': signingConfig.apiKey
					},
					body: JSON.stringify({
						userId: userInfo?.userId || `${normalizedSignatoryType}_DEFAULT`, // IC number for MTSA
						vpsUserId: userInfo?.vpsUserId || `${normalizedSignatoryType}_${applicationId}`, // Unique identifier for database
						pin: pin, // PIN instead of OTP
						submissionId: application.loan.docusealSubmissionId,
						applicationId: applicationId,
						docusealSubmitterId: signatory.docusealSubmitterId,
						userFullName: userInfo?.fullName || `${normalizedSignatoryType} Representative`,
						signatoryType: normalizedSignatoryType
					})
				});

				const orchestratorResult = await orchestratorResponse.json();

				if (!orchestratorResult.success) {
					const rawError = orchestratorResult.message || orchestratorResult.error || 'PKI signing failed';
					const formattedError = formatPKIErrorMessage(rawError);
					
					return res.status(400).json({
						success: false,
						message: formattedError.userMessage,
						error: formattedError.technicalDetails,
						errorCode: formattedError.errorCode
					});
				}

				console.log(`PKI signing successful for ${normalizedSignatoryType} - updating database`);

			} catch (orchestratorError) {
				console.error("Error calling signing orchestrator:", orchestratorError);
				const errorMessage = orchestratorError instanceof Error ? orchestratorError.message : "Unknown orchestrator error";
				
				return res.status(500).json({
					success: false,
					message: "Failed to complete PKI signing",
					error: formatPKIErrorMessage(errorMessage)
				});
			}

			// Update signatory status to SIGNED (only after successful PKI signing)
			await prisma.loanSignatory.update({
				where: { id: signatory.id },
				data: {
					status: "SIGNED",
					signedAt: new Date()
				}
			});

			// Add audit trail entry for PIN-based PKI signing completion
			try {
				const roleDisplayName = normalizedSignatoryType === 'COMPANY' ? 'Company' : 'Witness';
				const signerName = adminUser?.fullName || 'Unknown Admin';
				await prisma.loanApplicationHistory.create({
					data: {
						applicationId: applicationId,
						previousStatus: 'PENDING_PKI_SIGNING',
						newStatus: 'PENDING_PKI_SIGNING', // Keep same status until all parties sign
						changedBy: 'ADMIN_PKI_SIGNING',
						changeReason: `${roleDisplayName} completed PKI signing via PIN`,
						notes: `${roleDisplayName} completed PKI digital signing using PIN method. Signed by ${signerName}.`,
						metadata: {
							loanId: application.loan.id,
							signatoryType: normalizedSignatoryType,
							signedAt: new Date().toISOString(),
							pkiSigningMethod: 'admin_pin_signing',
							adminUserId: req.user?.userId,
							adminUserName: adminUser?.fullName || 'Unknown Admin',
							docusealSubmissionId: application.loan.docusealSubmissionId
						}
					}
				});
				console.log(`✅ Audit trail entry created for ${normalizedSignatoryType} PIN-based PKI signing completion`);
			} catch (auditError) {
				console.error('❌ Failed to create audit trail entry for PIN-based PKI signing:', auditError);
				// Don't fail the main operation for audit trail issues
			}

			// Check if all parties have signed
			const allSignatories = await prisma.loanSignatory.findMany({
				where: { loanId: application.loan.id }
			});

			const allSigned = allSignatories.every(sig => sig.status === "SIGNED");

			// If all parties have signed, update loan and application status to PENDING_DISBURSEMENT
			if (allSigned) {
				// Construct the signed PDF URL from the signing orchestrator
				const signedPdfUrl = `${signingConfig.url}/api/signed/${applicationId}/download`;
				
			await prisma.$transaction([
				// Update loan status to PENDING_STAMPING and record signed agreement details
				prisma.loan.update({
					where: { id: application.loan.id },
					data: { 
						status: "PENDING_STAMPING",
						agreementStatus: "SIGNED",
						agreementSignedAt: new Date(),
						pkiSignedPdfUrl: signedPdfUrl, // Store the PKI-signed PDF URL for download
						updatedAt: new Date()
					}
				}),
				// Update loan application status to PENDING_STAMPING
				prisma.loanApplication.update({
					where: { id: applicationId },
					data: { 
						status: "PENDING_STAMPING",
						updatedAt: new Date()
					}
				})
			]);

			// Add audit trail entry for loan status update after all signatures completed
			try {
				const finalSignerName = adminUser?.fullName || 'Unknown Admin';
				const roleDisplayName = signatoryType === 'COMPANY' ? 'Company' : 'Witness';
				await prisma.loanApplicationHistory.create({
					data: {
						applicationId: applicationId,
						previousStatus: 'PENDING_PKI_SIGNING',
						newStatus: 'PENDING_STAMPING',
						changedBy: 'SYSTEM_PKI_COMPLETE',
						changeReason: 'All parties completed PKI signing - pending stamp certificate upload',
						notes: `All required parties (Borrower, Company, and Witness) have completed PKI digital signing. Final signature completed by ${finalSignerName} as ${roleDisplayName}. Loan and application status updated to PENDING_STAMPING, awaiting stamp certificate upload before disbursement.`,
						metadata: {
							loanId: application.loan.id,
							completedAt: new Date().toISOString(),
							allSignatoriesCount: allSignatories.length,
							finalSignatoryType: signatoryType,
							finalSignerName: finalSignerName,
							finalSignerUserId: req.user?.userId,
							docusealSubmissionId: application.loan.docusealSubmissionId
						}
					}
				});
				console.log('✅ Audit trail entry created for loan activation after all PKI signatures completed');
			} catch (auditError) {
				console.error('❌ Failed to create audit trail entry for loan activation:', auditError);
				// Don't fail the main operation for audit trail issues
			}

		console.log(`All parties signed - Loan ${application.loan.id} and Application ${applicationId} set to PENDING_STAMPING`);

		// Fetch full application data for notifications
		const fullApplication = await prisma.loanApplication.findUnique({
			where: { id: applicationId },
			include: {
				user: {
					select: {
						fullName: true,
						email: true,
						phoneNumber: true
					}
				},
				product: {
					select: {
						name: true
					}
				}
			}
		});

		// Send email notification to borrower
		try {
			console.log(`📧 Sending email notification to borrower after all parties signed`);
			const emailResult = await emailService.sendAllPartiesSignedNotification(
				application.userId,
				application.loan.id,
				applicationId
			);
			if (emailResult.success) {
				console.log('✅ Email notification sent successfully to borrower');
			} else {
				console.warn(`⚠️ Failed to send email notification: ${emailResult.error}`);
			}
		} catch (emailError) {
			console.error('❌ Error sending email notification:', emailError);
			// Don't fail the signing process if email fails
		}

		// Send WhatsApp notification to borrower
		if (fullApplication && fullApplication.amount && fullApplication.user.fullName) {
			whatsappService.sendAllPartiesSigningCompleteNotification({
				to: fullApplication.user.phoneNumber,
				fullName: fullApplication.user.fullName,
				productName: fullApplication.product.name,
				amount: fullApplication.amount.toFixed(2),
				email: fullApplication.user.email || 'your registered email'
			}).then(result => {
				if (!result.success) {
					console.error(`Failed to send WhatsApp all parties signing complete notification for application ${applicationId}: ${result.error}`);
				}
			}).catch(error => {
				console.error('❌ Error sending WhatsApp notification:', error);
			});
		}
		}

		return res.json({
			success: true,
			message: `Document signed successfully as ${signatoryType}`,
			allSigned,
			newStatus: allSigned ? "PENDING_STAMPING" : application.status
		});

		} catch (error) {
			console.error("Error in PIN signing:", error);
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			const formattedError = formatPKIErrorMessage(errorMessage);
			
			return res.status(500).json({
				success: false,
				message: formattedError.userMessage,
				error: formattedError.technicalDetails,
				errorCode: formattedError.errorCode
			});
		}
	}
);

/**
 * GET /api/admin/loans/:loanId/download-agreement
 * Download signed loan agreement PDF (admin only)
 */
router.get("/loans/:loanId/download-agreement", authenticateToken, requireAdminOrAttestor, async (req: AuthRequest, res: Response) => {
	try {
		const { loanId } = req.params;

		// Find the loan
		const loan = await prisma.loan.findUnique({
			where: { id: loanId },
			include: {
				user: true,
				application: {
					include: {
						product: true
					}
				}
			}
		});

		if (!loan) {
			return res.status(404).json({
				success: false,
				message: 'Loan not found'
			});
		}

		// Check if agreement is signed
		if (loan.agreementStatus !== 'SIGNED') {
			return res.status(400).json({
				success: false,
				message: 'Agreement is not yet signed'
			});
		}

		// Download PKI-signed PDF from signing orchestrator
		if (!loan.applicationId) {
			return res.status(400).json({
				success: false,
				message: 'No application ID found for this loan'
			});
		}

		try {
			const signedPdfUrl = `${signingConfig.url}/api/signed/${loan.applicationId}/download`;
			
			console.log('Admin downloading PKI PDF from:', signedPdfUrl);
			
			const response = await fetch(signedPdfUrl, {
				method: 'GET',
				headers: {
					'X-API-Key': signingConfig.apiKey
				}
			});

			if (!response.ok) {
				throw new Error(`Signing orchestrator responded with status: ${response.status}`);
			}

			// PKI-signed PDF is available
			const pdfBuffer = await response.arrayBuffer();
			
			// Set headers for PDF response
			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', `attachment; filename="loan-agreement-${loan.user.fullName?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown'}-${loanId.substring(0, 8)}.pdf"`);
			res.setHeader('Content-Length', pdfBuffer.byteLength);
			
			// Send the PDF buffer
			return res.send(Buffer.from(pdfBuffer));
			
		} catch (error) {
			console.error('Failed to download PKI-signed PDF:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to download signed agreement from signing orchestrator',
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}

	} catch (error) {
		console.error('Error downloading signed agreement:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to download signed agreement',
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

/**
 * GET /api/admin/loans/:loanId/download-stamped-agreement
 * Download stamped loan agreement PDF (admin and attestor)
 */
router.get("/loans/:loanId/download-stamped-agreement", authenticateToken, requireAdminOrAttestor, async (req: AuthRequest, res: Response) => {
	try {
		const { loanId } = req.params;

		// Find the loan
		const loan = await prisma.loan.findUnique({
			where: { id: loanId },
			include: {
				user: true,
				application: {
					include: {
						product: true
					}
				}
			}
		});

		if (!loan) {
			return res.status(404).json({
				success: false,
				message: 'Loan not found'
			});
		}

		// Check if stamped agreement exists
		if (!loan.pkiStampedPdfUrl) {
			return res.status(400).json({
				success: false,
				message: 'No stamped agreement available for download'
			});
		}

		// Download stamped PDF from signing orchestrator
		if (!loan.applicationId) {
			return res.status(400).json({
				success: false,
				message: 'No application ID found for this loan'
			});
		}

		try {
			const stampedPdfUrl = `${signingConfig.url}/api/admin/agreements/${loan.applicationId}/download/stamped`;
			
			console.log('Admin downloading stamped PDF from:', stampedPdfUrl);
			
			const response = await fetch(stampedPdfUrl, {
				method: 'GET',
				headers: {
					'X-API-Key': signingConfig.apiKey
				}
			});

			if (!response.ok) {
				throw new Error(`Signing orchestrator responded with status: ${response.status}`);
			}

			// Stamped PDF is available
			const pdfBuffer = await response.arrayBuffer();
			
			// Set headers for PDF response
			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', `attachment; filename="stamped-loan-agreement-${loan.user.fullName?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown'}-${loanId.substring(0, 8)}.pdf"`);
			res.setHeader('Content-Length', pdfBuffer.byteLength);
			
			// Send the PDF buffer
			return res.send(Buffer.from(pdfBuffer));
			
		} catch (error) {
			console.error('Failed to download stamped PDF:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to download stamped agreement from signing orchestrator',
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}

	} catch (error) {
		console.error('Error downloading stamped agreement:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to download stamped agreement',
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// Configure multer for stamped PDF and certificate uploads (temporary storage before sending to orchestrator)
const stampedPdfUpload = multer({
	storage: (multer as any).memoryStorage(), // Store in memory temporarily
	limits: {
		fileSize: 50 * 1024 * 1024, // 50MB max file size for PDFs
	},
	fileFilter: (_req: any, file: any, cb: any) => {
		// Only allow PDF files
		if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
			cb(null, true);
		} else {
			cb(new Error('Only PDF files are allowed'), false);
		}
	}
});

// Configure multer for stamp certificate uploads (memory storage for S3)
const stampCertUpload = multer({
	storage: (multer as any).memoryStorage(),
	fileFilter: (_req: any, file: any, cb: any) => {
		if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
			cb(null, true);
		} else {
			cb(new Error('Only PDF files are allowed'), false);
		}
	},
	limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Configure multer for disbursement slip uploads (memory storage for S3)
const disbursementSlipUpload = multer({
	storage: (multer as any).memoryStorage(),
	fileFilter: (_req: any, file: any, cb: any) => {
		if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
			cb(null, true);
		} else {
			cb(new Error('Only PDF files are allowed'), false);
		}
	},
	limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/**
 * @swagger
 * /api/admin/loans/{id}/upload-stamped-agreement:
 *   post:
 *     summary: Upload stamped agreement PDF and stamp certificate for a loan (admin only)
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               stampedPdf:
 *                 type: string
 *                 format: binary
 *                 description: The stamped agreement PDF file
 *               stampCertificate:
 *                 type: string
 *                 format: binary
 *                 description: The stamp certificate PDF file
 *               notes:
 *                 type: string
 *                 description: Optional notes about the stamped agreement
 *     responses:
 *       200:
 *         description: Stamped agreement and certificate uploaded successfully
 *       400:
 *         description: Invalid file or missing loan
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
	"/loans/:id/upload-stamped-agreement",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	stampedPdfUpload.single('stampedPdf'),
	async (req: AuthRequest, res: Response) => {
		try {
		const { id: loanId } = req.params;
		const { notes } = req.body;
		const file = req.file;
		const adminUser = req.user;

		if (!file) {
			return res.status(400).json({
				success: false,
				message: "No stamped PDF file provided"
			});
		}

			// Verify loan exists and has a signed agreement
			const loan = await prisma.loan.findUnique({
				where: { id: loanId },
				include: {
					application: {
						include: {
							user: {
								select: {
									id: true,
									fullName: true,
									email: true
								}
							}
						}
					}
				}
			});

			if (!loan) {
				return res.status(404).json({
					success: false,
					message: "Loan not found"
				});
			}

			// Check if loan has a signed agreement
			if (!loan.pkiSignedPdfUrl) {
				return res.status(400).json({
					success: false,
					message: "Loan must have a signed agreement before uploading stamped version"
				});
			}

			// Upload to signing orchestrator
			// Generate URLs pointing to orchestrator
			const stampedPdfUrl = `${signingConfig.url}/api/admin/agreements/${loan.applicationId}/download/stamped`;
			
			try {
				// Upload stamped PDF to signing orchestrator
				const stampedUploadResponse = await fetch(`${signingConfig.url}/api/admin/agreements/${loan.applicationId}/upload/stamped`, {
					method: 'POST',
					headers: {
						'X-API-Key': signingConfig.apiKey,
						'Content-Type': 'application/pdf',
						'X-Original-Filename': file.originalname,
						'X-Uploaded-By': adminUser?.fullName || 'Unknown Admin',
						...(notes && { 'X-Notes': notes })
					},
					body: new Uint8Array(file.buffer)
				});

				if (!stampedUploadResponse.ok) {
					const errorText = await stampedUploadResponse.text();
					throw new Error(`Stamped PDF upload failed: ${stampedUploadResponse.status} - ${errorText}`);
				}

			const uploadResult = await stampedUploadResponse.json();
			console.log('✅ Stamped agreement uploaded to orchestrator:', uploadResult);

			// Update loan with stamped PDF URL and create audit trail
			await prisma.$transaction(async (tx) => {
				// Check if this is a replacement (existing stamped agreement)
				const existingLoan = await tx.loan.findUnique({
					where: { id: loanId },
					select: { pkiStampedPdfUrl: true }
				});
				
				const isReplacement = !!existingLoan?.pkiStampedPdfUrl;
				
				await tx.loan.update({
					where: { id: loanId },
					data: {
						pkiStampedPdfUrl: stampedPdfUrl,
						updatedAt: new Date()
					}
				});

				// Create audit trail entry
				await tx.loanApplicationHistory.create({
					data: {
						applicationId: loan.applicationId,
						previousStatus: isReplacement ? 'STAMPED_AGREEMENT_REPLACED' : 'SIGNED_AGREEMENT_UPLOADED',
						newStatus: 'STAMPED_AGREEMENT_UPLOADED',
						changedBy: adminUser?.fullName || 'Unknown Admin',
						changeReason: isReplacement ? 'Stamped agreement replaced' : 'Stamped agreement uploaded',
						notes: notes
							? `Stamped agreement ${isReplacement ? 'replaced' : 'uploaded'} by ${adminUser?.fullName || 'Unknown Admin'}. Notes: ${notes}`
							: `Stamped agreement ${isReplacement ? 'replaced' : 'uploaded'} by ${adminUser?.fullName || 'Unknown Admin'}`,
						metadata: {
							loanId: loanId,
							originalName: file.originalname,
							fileSize: file.size,
							uploadedAt: new Date().toISOString(),
							uploadedBy: adminUser?.fullName || 'Unknown Admin',
							notes: notes || null,
							isReplacement: isReplacement
						}
					}
				});
			});
			} catch (orchestratorError) {
				console.error('❌ Error uploading to signing orchestrator:', orchestratorError);
				throw new Error(`Failed to upload to signing orchestrator: ${orchestratorError instanceof Error ? orchestratorError.message : 'Unknown error'}`);
			}

		console.log(`✅ Stamped agreement uploaded for loan ${loanId} by ${adminUser?.fullName || 'Unknown Admin'}`);

		return res.json({
			success: true,
			message: "Stamped agreement uploaded successfully",
			data: {
				loanId: loanId,
				stampedPdfUrl: stampedPdfUrl,
				uploadedAt: new Date().toISOString(),
				uploadedBy: adminUser?.fullName || 'Unknown Admin',
				borrowerName: loan.application?.user?.fullName,
				notes: notes || null
			}
		});

	} catch (error) {
		console.error('❌ Error uploading stamped agreement:', error);

		return res.status(500).json({
			success: false,
			message: "Error uploading stamped agreement",
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
	}
);

/**
 * @swagger
 * /api/admin/loans/{id}/upload-stamp-certificate:
 *   post:
 *     summary: Upload stamp certificate PDF for a loan (admin only)
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               stampCertificate:
 *                 type: string
 *                 format: binary
 *                 description: The stamp certificate PDF file
 *               notes:
 *                 type: string
 *                 description: Optional notes about the certificate
 *     responses:
 *       200:
 *         description: Certificate uploaded successfully
 *       400:
 *         description: Bad request or validation error
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.post(
	"/loans/:id/upload-stamp-certificate",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	stampedPdfUpload.single('stampCertificate'),
	async (req: AuthRequest, res: Response) => {
		try {
			const { id: loanId } = req.params;
			const { notes } = req.body;
			const file = req.file;
			const adminUser = req.user;

			if (!file) {
				return res.status(400).json({
					success: false,
					message: "No stamp certificate file provided"
				});
			}

			// Verify loan exists
			const loan = await prisma.loan.findUnique({
				where: { id: loanId },
				include: {
					application: {
						include: {
							user: true
						}
					}
				}
			});

			if (!loan) {
				return res.status(404).json({
					success: false,
					message: "Loan not found"
				});
			}

			// Upload to signing orchestrator
			// Generate the certificate URL pointing to orchestrator
			const stampCertificateUrl = `${signingConfig.url}/api/admin/agreements/${loan.applicationId}/download/certificate`;

			try {
				// Upload certificate to signing orchestrator
				const uploadResponse = await fetch(`${signingConfig.url}/api/admin/agreements/${loan.applicationId}/upload/certificate`, {
					method: 'POST',
					headers: {
						'X-API-Key': signingConfig.apiKey,
						'Content-Type': 'application/pdf',
						'X-Original-Filename': file.originalname,
						'X-Uploaded-By': adminUser?.fullName || 'Unknown Admin',
						...(notes && { 'X-Notes': notes })
					},
					body: new Uint8Array(file.buffer)
				});

				if (!uploadResponse.ok) {
					const errorText = await uploadResponse.text();
					throw new Error(`Orchestrator upload failed: ${uploadResponse.status} - ${errorText}`);
				}

				const uploadResult = await uploadResponse.json();
				console.log('✅ Stamp certificate uploaded to orchestrator:', uploadResult);

				// Update loan with certificate URL and create audit trail
				await prisma.$transaction(async (tx) => {
					// Check if this is a replacement (existing certificate)
					const existingLoan = await tx.loan.findUnique({
						where: { id: loanId },
						select: { pkiStampCertificateUrl: true }
					});
					
					const isReplacement = !!existingLoan?.pkiStampCertificateUrl;
					
					// Update loan with certificate URL
					await tx.loan.update({
						where: { id: loanId },
						data: {
							pkiStampCertificateUrl: stampCertificateUrl,
							updatedAt: new Date()
						}
					});

					// Create audit trail entry
					await tx.loanApplicationHistory.create({
						data: {
							applicationId: loan.applicationId,
							previousStatus: isReplacement ? 'STAMP_CERTIFICATE_REPLACED' : 'STAMPED_AGREEMENT_UPLOADED',
							newStatus: 'STAMP_CERTIFICATE_UPLOADED',
							changedBy: adminUser?.fullName || 'Unknown Admin',
							changeReason: isReplacement ? 'Stamp certificate replaced' : 'Stamp certificate uploaded',
							notes: notes
								? `Stamp certificate ${isReplacement ? 'replaced' : 'uploaded'} by ${adminUser?.fullName || 'Unknown Admin'}. Notes: ${notes}`
								: `Stamp certificate ${isReplacement ? 'replaced' : 'uploaded'} by ${adminUser?.fullName || 'Unknown Admin'}`,
							metadata: {
								loanId: loanId,
								originalName: file.originalname,
								fileSize: file.size,
								uploadedAt: new Date().toISOString(),
								uploadedBy: adminUser?.fullName || 'Unknown Admin',
								notes: notes || null,
								isReplacement: isReplacement
							}
						}
					});
				});

				console.log(`✅ Stamp certificate uploaded for loan ${loanId} by ${adminUser?.fullName || 'Unknown Admin'}`);

				return res.json({
					success: true,
					message: "Stamp certificate uploaded successfully",
					data: {
						loanId: loanId,
						stampCertificateUrl: stampCertificateUrl,
						uploadedAt: new Date().toISOString(),
						uploadedBy: adminUser?.fullName || 'Unknown Admin',
						borrowerName: loan.application?.user?.fullName,
						notes: notes || null
					}
				});

			} catch (orchestratorError) {
				console.error('❌ Orchestrator upload failed:', orchestratorError);
				throw orchestratorError;
			}

		} catch (error) {
			console.error('❌ Error uploading stamp certificate:', error);

			return res.status(500).json({
				success: false,
				message: "Error uploading stamp certificate",
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/loans/{loanId}/download-stamp-certificate:
 *   get:
 *     summary: Download stamp certificate PDF for a loan (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan ID
 *     responses:
 *       200:
 *         description: Stamp certificate PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: No certificate available or invalid loan
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
	"/loans/:loanId/download-stamp-certificate",
	authenticateToken,
	requireAdminOrAttestor as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { loanId } = req.params;

			// Verify loan exists and has a certificate
			const loan = await prisma.loan.findUnique({
				where: { id: loanId },
				include: {
					user: true,
					application: {
						include: {
							product: true
						}
					}
				}
			});

			if (!loan) {
				return res.status(404).json({
					success: false,
					message: 'Loan not found'
				});
			}

		const certificateUrl = loan.pkiStampCertificateUrl;

		if (!certificateUrl) {
			return res.status(400).json({
				success: false,
				message: 'No stamp certificate available for download'
			});
		}

		const downloadFileName = `stamp-certificate-${loanId.substring(0, 8)}.pdf`;

		if (certificateUrl.startsWith('http://') || certificateUrl.startsWith('https://')) {
			try {
				const downloadResponse = await fetch(certificateUrl, {
					headers: {
						'X-API-Key': signingConfig.apiKey,
					}
				});

				if (!downloadResponse.ok) {
					const errorText = await downloadResponse.text();
					throw new Error(`Certificate download failed: ${downloadResponse.status} - ${errorText}`);
				}

				const pdfArrayBuffer = await downloadResponse.arrayBuffer();
				const pdfBuffer = Buffer.from(pdfArrayBuffer);

				res.setHeader('Content-Type', 'application/pdf');
				res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
				res.setHeader('Content-Length', pdfBuffer.length.toString());

				res.send(pdfBuffer);
				return;
			} catch (remoteError) {
				console.error('❌ Error downloading stamp certificate from orchestrator:', remoteError);
				return res.status(500).json({
					success: false,
					message: 'Error retrieving stamp certificate from signing orchestrator',
					error: remoteError instanceof Error ? remoteError.message : 'Unknown error'
				});
			}
		}

		// Stream from S3
		try {
			console.log(`📁 Streaming stamp certificate from S3: ${certificateUrl}`);
			const { stream, contentType, contentLength } = await getS3ObjectStream(certificateUrl);

			res.setHeader('Content-Type', contentType || 'application/pdf');
			res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
			if (contentLength) {
				res.setHeader('Content-Length', contentLength);
			}

			stream.on('error', (error: Error) => {
				console.error('❌ Error streaming file from S3:', error);
				if (!res.headersSent) {
					res.status(500).json({
						success: false,
						message: "Error streaming certificate file",
						error: error.message
					});
				}
			});
			stream.pipe(res);
			return;
		} catch (s3Error) {
			console.error(`❌ Stamp certificate not found in S3: ${certificateUrl}`, s3Error);
			return res.status(404).json({
				success: false,
				message: 'Stamp certificate file not found in storage'
			});
		}

		} catch (error) {
			console.error('❌ Error downloading stamp certificate:', error);

			return res.status(500).json({
				success: false,
				message: "Error downloading stamp certificate",
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/{id}/upload-stamp-certificate:
 *   post:
 *     summary: Upload stamp certificate for an application (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The application ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               stampCertificate:
 *                 type: string
 *                 format: binary
 *                 description: The stamp certificate PDF file
 *     responses:
 *       200:
 *         description: Certificate uploaded successfully
 *       400:
 *         description: Bad request or validation error
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
router.post(
	"/applications/:id/upload-stamp-certificate",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	stampCertUpload.single('stampCertificate'),
	async (req: AuthRequest, res: Response) => {
		try {
			const { id: applicationId } = req.params;
			const file = req.file;
			const adminUser = req.user;

			if (!file) {
				return res.status(400).json({
					success: false,
					message: "No stamp certificate file provided"
				});
			}

			// Verify application exists and has an associated loan
			const application = await prisma.loanApplication.findUnique({
				where: { id: applicationId },
				include: {
					loan: true,
					user: {
						select: {
							id: true,
							fullName: true,
							email: true
						}
					}
				}
			});

			if (!application) {
				return res.status(404).json({
					success: false,
					message: "Application not found"
				});
			}

			if (!application.loan) {
				return res.status(400).json({
					success: false,
					message: "No loan associated with this application"
				});
			}

			// Verify application is in PENDING_STAMPING status
			if (application.status !== 'PENDING_STAMPING') {
				return res.status(400).json({
					success: false,
					message: `Application must be in PENDING_STAMPING status. Current status: ${application.status}`
				});
			}

		// Upload to S3 with organized folder structure
		const uploadResult = await uploadToS3Organized(
			file.buffer,
			file.originalname,
			'application/pdf',
			{
				folder: S3_FOLDERS.STAMP_CERTIFICATES,
				subFolder: application.loan.id.substring(0, 8), // Organize by loan ID prefix
			}
		);

		if (!uploadResult.success || !uploadResult.key) {
			return res.status(500).json({
				success: false,
				message: `Failed to upload stamp certificate: ${uploadResult.error}`
			});
		}

		const s3Key = uploadResult.key;

		// Check if certificate already exists (replacement scenario)
		const existingCertUrl = application.loan.pkiStampCertificateUrl;
		const isReplacement = !!existingCertUrl;
		const action = isReplacement ? 'replaced' : 'uploaded';
		const adminName = adminUser?.fullName || `admin_${adminUser?.userId}`;

		// Delete old certificate from S3 if replacing
		if (isReplacement && existingCertUrl) {
			try {
				await deleteFromS3(existingCertUrl);
			} catch (deleteErr) {
				console.warn(`Failed to delete old S3 certificate: ${existingCertUrl}`, deleteErr);
			}
		}

		// Update loan with certificate URL
		await prisma.loan.update({
			where: { id: application.loan.id },
			data: {
				pkiStampCertificateUrl: s3Key,
				updatedAt: new Date()
			}
		});

		// Create audit trail entry
		await prisma.loanApplicationHistory.create({
			data: {
				applicationId: applicationId,
				previousStatus: null,
				newStatus: `STAMP_CERTIFICATE_${action.toUpperCase()}`,
				changedBy: adminName,
				changeReason: `Stamp certificate ${action}`,
				notes: `Stamp certificate ${action} by ${adminName}. File: ${file.originalname}`,
				metadata: {
					action,
					previousCertUrl: existingCertUrl,
					newCertUrl: s3Key,
					fileName: file.originalname,
					fileSize: file.size,
					uploadedBy: adminUser?.userId,
					uploadedByName: adminName,
					uploadedAt: new Date().toISOString(),
					loanId: application.loan.id
				}
			}
		});

			console.log(`✅ Stamp certificate uploaded to S3 for application ${applicationId}: ${s3Key}`);

			return res.json({
				success: true,
				message: "Stamp certificate uploaded successfully",
				data: {
					certificateUrl: s3Key,
					fileName: file.originalname,
					applicationId: applicationId,
					loanId: application.loan.id
				}
			});

		} catch (error) {
			console.error('❌ Error uploading stamp certificate:', error);
			return res.status(500).json({
				success: false,
				message: "Error uploading stamp certificate",
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/{id}/confirm-stamping:
 *   post:
 *     summary: Confirm stamping and transition application to PENDING_DISBURSEMENT (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The application ID
 *     responses:
 *       200:
 *         description: Stamping confirmed, status updated to PENDING_DISBURSEMENT
 *       400:
 *         description: Bad request or validation error
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
router.post(
	"/applications/:id/confirm-stamping",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id: applicationId } = req.params;
			const adminUser = req.user;

			// Verify application exists and has an associated loan
			const application = await prisma.loanApplication.findUnique({
				where: { id: applicationId },
				include: {
					loan: true,
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							phoneNumber: true
						}
					},
					product: {
						select: {
							name: true
						}
					}
				}
			});

			if (!application) {
				return res.status(404).json({
					success: false,
					message: "Application not found"
				});
			}

			if (!application.loan) {
				return res.status(400).json({
					success: false,
					message: "No loan associated with this application"
				});
			}

			// Verify application is in PENDING_STAMPING status
			if (application.status !== 'PENDING_STAMPING') {
				return res.status(400).json({
					success: false,
					message: `Application must be in PENDING_STAMPING status. Current status: ${application.status}`
				});
			}

			// Verify stamp certificate has been uploaded
			if (!application.loan.pkiStampCertificateUrl) {
				return res.status(400).json({
					success: false,
					message: "Stamp certificate must be uploaded before confirming stamping"
				});
			}

			// Update both loan and application status to PENDING_DISBURSEMENT
			await prisma.$transaction([
				prisma.loan.update({
					where: { id: application.loan.id },
					data: {
						status: 'PENDING_DISBURSEMENT',
						updatedAt: new Date()
					}
				}),
				prisma.loanApplication.update({
					where: { id: applicationId },
					data: {
						status: 'PENDING_DISBURSEMENT',
						updatedAt: new Date()
					}
				})
			]);

		// Create audit trail entry
		await prisma.loanApplicationHistory.create({
			data: {
				applicationId: applicationId,
				previousStatus: 'PENDING_STAMPING',
				newStatus: 'PENDING_DISBURSEMENT',
				changedBy: `admin_${adminUser?.userId}`,
				changeReason: 'Stamping confirmed by admin',
				notes: `Stamping process completed. Stamp certificate verified and uploaded. Application and loan status updated to PENDING_DISBURSEMENT, ready for disbursement by admin ${adminUser?.userId}.`,
				metadata: {
					confirmedBy: adminUser?.userId,
					confirmedAt: new Date().toISOString(),
					loanId: application.loan.id,
					certificateUrl: application.loan.pkiStampCertificateUrl
				}
			}
		});

		console.log(`✅ Stamping confirmed for application ${applicationId}, status updated to PENDING_DISBURSEMENT`);

		// Send WhatsApp notification to borrower
		if (application.amount && application.user.fullName) {
			whatsappService.sendStampingCompletedNotification({
				to: application.user.phoneNumber,
				fullName: application.user.fullName,
				productName: application.product.name,
				amount: application.amount.toFixed(2)
			}).then(result => {
				if (!result.success) {
					console.error(`Failed to send WhatsApp stamping completed notification for application ${applicationId}: ${result.error}`);
				}
			}).catch(error => {
				console.error('❌ Error sending WhatsApp stamping completed notification:', error);
			});
		}

		return res.json({
			success: true,
			message: "Stamping confirmed successfully. Application ready for disbursement.",
			data: {
				applicationId: applicationId,
				loanId: application.loan.id,
				previousStatus: 'PENDING_STAMPING',
				newStatus: 'PENDING_DISBURSEMENT'
			}
		});

		} catch (error) {
			console.error('❌ Error confirming stamping:', error);
			return res.status(500).json({
				success: false,
				message: "Error confirming stamping",
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/{id}/unsigned-agreement:
 *   get:
 *     summary: Download unsigned loan agreement from DocuSeal (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The application ID
 *     responses:
 *       200:
 *         description: Unsigned agreement PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: No agreement available or invalid application
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
router.get(
	"/applications/:id/unsigned-agreement",
	authenticateToken,
	requireAdminOrAttestor as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id: applicationId } = req.params;

			// Verify application exists and has an associated loan
			const application = await prisma.loanApplication.findUnique({
				where: { id: applicationId },
				include: {
					loan: true
				}
			});

			if (!application) {
				return res.status(404).json({
					success: false,
					message: "Application not found"
				});
			}

		if (!application.loan) {
			return res.status(400).json({
				success: false,
				message: "No loan associated with this application"
			});
		}

	// Check if DocuSeal sign URL exists
	if (!application.loan.docusealSignUrl) {
		return res.status(400).json({
			success: false,
			message: "No DocuSeal submission found for this loan"
		});
	}

	// Build the DocuSeal URL from centralized config and slug
	const docusealUrl = `${docusealConfig.baseUrl}/s/${application.loan.docusealSignUrl}`;
	
	// Return the URL for the frontend to open
	return res.json({
		success: true,
		url: docusealUrl,
		message: "Please open this URL to view the unsigned agreement"
	});

		} catch (error) {
			console.error('❌ Error downloading unsigned agreement:', error);
			return res.status(500).json({
				success: false,
				message: "Error downloading unsigned agreement",
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/{id}/signed-agreement:
 *   get:
 *     summary: Download signed loan agreement with PKI signatures (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The application ID
 *     responses:
 *       200:
 *         description: Signed agreement PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: No agreement available or invalid application
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
router.get(
	"/applications/:id/signed-agreement",
	authenticateToken,
	requireAdminOrAttestor as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id: applicationId } = req.params;

			// Verify application exists and has an associated loan
			const application = await prisma.loanApplication.findUnique({
				where: { id: applicationId },
				include: {
					loan: true
				}
			});

			if (!application) {
				return res.status(404).json({
					success: false,
					message: "Application not found"
				});
			}

			if (!application.loan) {
				return res.status(400).json({
					success: false,
					message: "No loan associated with this application"
				});
			}

			if (!application.loan.pkiSignedPdfUrl) {
				return res.status(400).json({
					success: false,
					message: "No signed agreement available for this loan. PKI signing may not be complete."
				});
			}

			// Get signed agreement from signing orchestrator
			if (!signingConfig.url || !signingConfig.apiKey) {
				throw new Error('Signing orchestrator configuration missing');
			}

			const response = await fetch(`${signingConfig.url}/api/signed/${applicationId}/download`, {
				method: 'GET',
				headers: {
					'X-API-Key': signingConfig.apiKey,
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Orchestrator download failed: ${response.status} - ${errorText}`);
			}

			// Stream the PDF directly to the client
			const pdfBuffer = await response.arrayBuffer();
			
			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', `attachment; filename="signed-agreement-${applicationId.substring(0, 8)}.pdf"`);
			res.setHeader('Content-Length', pdfBuffer.byteLength);
			
			res.send(Buffer.from(pdfBuffer));
			return;

		} catch (error) {
			console.error('❌ Error downloading signed agreement:', error);
			return res.status(500).json({
				success: false,
				message: "Error downloading signed agreement",
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/applications/{id}/stamp-certificate:
 *   get:
 *     summary: Download stamp certificate for an application (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The application ID
 *     responses:
 *       200:
 *         description: Stamp certificate PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: No certificate available or invalid application
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
router.get(
	"/applications/:id/stamp-certificate",
	authenticateToken,
	requireAdminOrAttestor as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id: applicationId } = req.params;

			// Verify application exists and has an associated loan
			const application = await prisma.loanApplication.findUnique({
				where: { id: applicationId },
				include: {
					loan: true
				}
			});

			if (!application) {
				return res.status(404).json({
					success: false,
					message: "Application not found"
				});
			}

			if (!application.loan) {
				return res.status(400).json({
					success: false,
					message: "No loan associated with this application"
				});
			}

			const certificateUrl = application.loan.pkiStampCertificateUrl;

			if (!certificateUrl) {
				return res.status(400).json({
					success: false,
					message: "No stamp certificate available for this loan"
				});
			}

			const downloadFileName = `stamp-certificate-${applicationId.substring(0, 8)}.pdf`;

			if (certificateUrl.startsWith('http://') || certificateUrl.startsWith('https://')) {
				try {
					const downloadResponse = await fetch(certificateUrl, {
						headers: {
							'X-API-Key': signingConfig.apiKey,
						}
					});

					if (!downloadResponse.ok) {
						const errorText = await downloadResponse.text();
						throw new Error(`Certificate download failed: ${downloadResponse.status} - ${errorText}`);
					}

					const pdfArrayBuffer = await downloadResponse.arrayBuffer();
					const pdfBuffer = Buffer.from(pdfArrayBuffer);

					res.setHeader('Content-Type', 'application/pdf');
					res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
					res.setHeader('Content-Length', pdfBuffer.length.toString());

					res.send(pdfBuffer);
					return;
				} catch (remoteError) {
					console.error('❌ Error downloading stamp certificate from orchestrator:', remoteError);
					return res.status(500).json({
						success: false,
						message: "Error retrieving stamp certificate from orchestrator",
						error: remoteError instanceof Error ? remoteError.message : 'Unknown error'
					});
				}
			}

			// Stream from S3
			try {
				console.log(`📁 Streaming stamp certificate from S3: ${certificateUrl}`);
				const { stream, contentType, contentLength } = await getS3ObjectStream(certificateUrl);

				res.setHeader('Content-Type', contentType || 'application/pdf');
				res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
				if (contentLength) {
					res.setHeader('Content-Length', contentLength);
				}

				stream.pipe(res);
				return;
			} catch (s3Error) {
				console.error(`❌ Stamp certificate not found in S3: ${certificateUrl}`, s3Error);
				return res.status(404).json({
					success: false,
					message: "Stamp certificate file not found in storage"
				});
			}

	} catch (error) {
			console.error('❌ Error downloading stamp certificate:', error);
			return res.status(500).json({
				success: false,
				message: "Error downloading stamp certificate",
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}
);

// Health check endpoint for on-prem services
router.get("/health-check", authenticateToken, requireAdminOrAttestor, async (_req: AuthRequest, res: Response) => {
	try {
		const healthStatus = {
			timestamp: new Date().toISOString(),
			services: {
				docuseal: { status: 'unknown' as const, url: '', responseTime: 0, error: null as string | null },
				signingOrchestrator: { status: 'unknown' as const, url: '', responseTime: 0, error: null as string | null },
				mtsa: { status: 'unknown' as const, url: '', responseTime: 0, error: null as string | null }
			},
			overall: 'checking' as const
		};

		// Define service URLs - these are configurable based on environment
		const baseHost = serverConfig.isProduction ? 'sign.creditxpress.com.my' : 'host.docker.internal';
		
		const services = [
			{
				name: 'docuseal',
				url: serverConfig.isProduction ? 'https://sign.creditxpress.com.my/' : `http://${baseHost}:3001/`, // DocuSeal doesn't have /health, use root
				timeout: 5000
			},
		{
			name: 'signingOrchestrator', 
			// Cloudflare tunnel routes /orchestrator/* to port 4010, passing the full path
			// The orchestrator now has /orchestrator/health mounted to handle this
			url: serverConfig.isProduction ? 'https://sign.creditxpress.com.my/orchestrator/health' : `http://${baseHost}:4010/health`,
			timeout: 10000  // Increased to 10s to account for Cloudflare tunnel latency
		},
			{
				name: 'mtsa',
				// Cloudflare route MTSAPilot/* -> localhost:8080, path is passed through
				url: serverConfig.isProduction ? 'https://sign.creditxpress.com.my/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl' : `http://${baseHost}:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl`,
				timeout: 5000
			}
		];

		// Check each service health
		const healthChecks = services.map(async (service) => {
			const startTime = Date.now();
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), service.timeout);

				const response = await fetch(service.url, {
					method: 'GET',
					signal: controller.signal,
					headers: {
						'User-Agent': 'Kredit-HealthCheck/1.0',
						'Accept': 'application/json, text/plain, */*'
					}
				});

				clearTimeout(timeoutId);
				const responseTime = Date.now() - startTime;

				(healthStatus.services as any)[service.name] = {
					status: response.ok ? 'healthy' : 'unhealthy',
					url: service.url,
					responseTime,
					error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
				};

			} catch (error: any) {
				const responseTime = Date.now() - startTime;
				(healthStatus.services as any)[service.name] = {
					status: 'unreachable',
					url: service.url,
					responseTime,
					error: error.name === 'AbortError' ? 'Request timeout' : error.message
				};
			}
		});

		// Wait for all health checks to complete
		await Promise.all(healthChecks);

		// Determine overall status
		const statuses = Object.values(healthStatus.services).map(s => s.status as string);
		if (statuses.every(status => status === 'healthy')) {
			(healthStatus as any).overall = 'healthy';
		} else if (statuses.some(status => status === 'healthy')) {
			(healthStatus as any).overall = 'degraded';
		} else {
			(healthStatus as any).overall = 'unhealthy';
		}

		console.log('✅ Health check completed:', healthStatus.overall);
		res.json(healthStatus);

	} catch (error) {
		console.error('❌ Health check endpoint error:', error);
		res.status(500).json({
			timestamp: new Date().toISOString(),
			services: {
				docuseal: { status: 'error', url: '', responseTime: 0, error: 'Internal server error' },
				signingOrchestrator: { status: 'error', url: '', responseTime: 0, error: 'Internal server error' },
				mtsa: { status: 'error', url: '', responseTime: 0, error: 'Internal server error' }
			},
			overall: 'error',
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

/**
 * @swagger
 * /api/admin/applications/{id}/upload-disbursement-slip:
 *   post:
 *     summary: Upload disbursement payment slip (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               paymentSlip:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Payment slip uploaded successfully
 *       404:
 *         description: Disbursement not found
 *       500:
 *         description: Server error
 */
router.post(
	"/applications/:id/upload-disbursement-slip",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	disbursementSlipUpload.single('paymentSlip'),
	async (req: AuthRequest, res: Response) => {
		try {
			const { id: applicationId } = req.params;
			const file = req.file;
			const adminName = req.user?.fullName || `admin_${req.user?.userId}` || 'Unknown Admin';

			if (!file) {
				return res.status(400).json({ success: false, message: 'No file uploaded' });
			}

			// Find disbursement record
			const disbursement = await prisma.loanDisbursement.findUnique({
				where: { applicationId }
			});

			if (!disbursement) {
				return res.status(404).json({ success: false, message: 'Disbursement not found' });
			}

			// Upload to S3 with organized folder structure
			const uploadResult = await uploadToS3Organized(
				file.buffer,
				file.originalname,
				'application/pdf',
				{
					folder: S3_FOLDERS.DISBURSEMENT_SLIPS,
					subFolder: applicationId.substring(0, 8), // Organize by application ID prefix
				}
			);

			if (!uploadResult.success || !uploadResult.key) {
				return res.status(500).json({
					success: false,
					message: `Failed to upload payment slip: ${uploadResult.error}`
				});
			}

			const s3Key = uploadResult.key;
			const previousSlipUrl = disbursement.paymentSlipUrl;
			const action = previousSlipUrl ? 'replaced' : 'uploaded';

			// Delete old slip from S3 if replacing
			if (previousSlipUrl) {
				try {
					await deleteFromS3(previousSlipUrl);
				} catch (deleteErr) {
					console.warn(`Failed to delete old S3 disbursement slip: ${previousSlipUrl}`, deleteErr);
				}
			}

			// Update with payment slip URL
			const updatedDisbursement = await prisma.loanDisbursement.update({
				where: { applicationId },
				data: {
					paymentSlipUrl: s3Key
				}
			});

			// Create audit trail entry
			await prisma.loanApplicationHistory.create({
				data: {
					applicationId,
					previousStatus: null,
					newStatus: 'PAYMENT_SLIP_' + action.toUpperCase(),
					changedBy: adminName,
					notes: `Payment slip ${action} by ${adminName}`,
					metadata: {
						action,
						previousSlipUrl,
						newSlipUrl: s3Key,
						fileName: file.originalname,
						fileSize: file.size,
						uploadedBy: req.user?.userId,
						uploadedByName: adminName,
						uploadedAt: new Date().toISOString()
					}
				}
			});

			return res.json({
				success: true,
				message: `Payment slip ${action} successfully`,
				data: updatedDisbursement
			});
		} catch (error) {
			console.error('Error uploading disbursement slip:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to upload payment slip',
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/disbursements/{applicationId}/payment-slip:
 *   get:
 *     summary: Download disbursement payment slip
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment slip PDF file
 *       404:
 *         description: Payment slip not found
 *       500:
 *         description: Server error
 */
router.get(
	"/disbursements/:applicationId/payment-slip",
	authenticateToken,
	requireAdminOrAttestor as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { applicationId } = req.params;

			const disbursement = await prisma.loanDisbursement.findUnique({
				where: { applicationId },
				select: { paymentSlipUrl: true }
			});

		if (!disbursement?.paymentSlipUrl) {
			return res.status(404).json({
				success: false,
				message: 'Payment slip not found'
			});
		}

		// Stream from S3
		try {
			console.log(`📁 Streaming payment slip from S3: ${disbursement.paymentSlipUrl}`);
			const { stream, contentType, contentLength } = await getS3ObjectStream(disbursement.paymentSlipUrl);

			res.setHeader('Content-Type', contentType || 'application/pdf');
			res.setHeader('Content-Disposition', `attachment; filename="disbursement-slip-${applicationId}.pdf"`);
			if (contentLength) {
				res.setHeader('Content-Length', contentLength);
			}

			stream.on('error', (error: Error) => {
				console.error('❌ Error streaming payment slip from S3:', error);
				if (!res.headersSent) {
					res.status(500).json({
						success: false,
						message: "Error streaming payment slip file",
						error: error.message
					});
				}
			});
			stream.pipe(res);
			return;
		} catch (s3Error) {
			console.error(`❌ Payment slip not found in S3: ${disbursement.paymentSlipUrl}`, s3Error);
			return res.status(404).json({
				success: false,
				message: 'Payment slip file not found in storage'
			});
		}
		} catch (error) {
			console.error('❌ Error downloading disbursement slip:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to download payment slip',
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/disbursements:
 *   get:
 *     summary: Get all disbursements with details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of disbursements
 *       500:
 *         description: Server error
 */
router.get(
	"/disbursements",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			const disbursements = await prisma.loanDisbursement.findMany({
				include: {
					application: {
						include: {
							user: {
								select: {
									id: true,
									fullName: true,
									email: true,
									phoneNumber: true,
									bankName: true,
									accountNumber: true
								}
							},
							product: {
								select: {
									name: true,
									code: true
								}
							},
							loan: {
								select: {
									id: true,
									status: true,
								},
							},
						}
					},
				},
				orderBy: {
					disbursedAt: 'desc'
				}
			});

			// Fetch admin users for disbursedBy field
			const adminUserIds = [...new Set(disbursements.map(d => d.disbursedBy))];
			const adminUsers = await prisma.user.findMany({
				where: {
					id: {
						in: adminUserIds
					}
				},
				select: {
					id: true,
					fullName: true,
					email: true,
				}
			});

			// Create a map of admin users
			const adminUserMap = new Map(adminUsers.map(u => [u.id, u]));

			// Enhance disbursements with admin user info
			const enhancedDisbursements = disbursements.map(d => ({
				...d,
				disbursedByUser: adminUserMap.get(d.disbursedBy) || null
			}));

			return res.json({
				success: true,
				data: enhancedDisbursements
			});
		} catch (error) {
			console.error('Error fetching disbursements:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to fetch disbursements'
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/credit-reports/fetch:
 *   post:
 *     summary: Fetch credit report from CTOS B2B (Admin only)
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
 *               - applicationId
 *               - userId
 *               - icNumber
 *               - fullName
 *             properties:
 *               applicationId:
 *                 type: string
 *               userId:
 *                 type: string
 *               icNumber:
 *                 type: string
 *               fullName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Credit report fetched successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to fetch credit report
 */
router.post(
	'/credit-reports/fetch',
	authenticateToken,
	requireAdmin,
	async (req: AuthRequest, res: Response) => {
		try {
			const { applicationId, userId, icNumber, fullName } = req.body;
			const adminUserId = req.user?.userId;
			const isMockMode = ctosConfig.b2bMockMode;

			console.log("Mock Mode 2:", isMockMode);
			console.log("CTOS_B2B_MOCK_MODE 2:", ctosConfig.b2bMockMode);

			if (!adminUserId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized',
				});
			}

			// Validate required fields
			if (!applicationId || !userId || !icNumber || !fullName) {
				return res.status(400).json({
					success: false,
					message: 'Missing required fields: applicationId, userId, icNumber, fullName',
				});
			}

			// Verify application exists and belongs to user
			const application = await prisma.loanApplication.findUnique({
				where: { id: applicationId },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							icNumber: true,
						},
					},
				},
			});

			if (!application) {
				if (!isMockMode) {
					return res.status(404).json({
						success: false,
						message: "Application not found",
					});
				}

				// Mock mode: allow testing without an actual application/user in the database
				console.warn(
					"CTOS B2B: Application not found. Running in mock mode, returning mock response without persistence."
				);

				const { ctosB2BService } = await import("../lib/ctosB2BService");
				const result = await ctosB2BService.fetchIndividualCreditReport({
					icNumber,
					fullName,
				});

				if (!result.success) {
					return res.status(400).json({
						success: false,
						message: result.error || "Failed to fetch credit report",
					});
				}

				const now = new Date().toISOString();
				const mockReport = {
					id: `mock-${Date.now()}`,
					userId,
					applicationId,
					reportType: "INDIVIDUAL",
					icNumber: icNumber.replace(/[\s-]/g, ""),
					fullName,
					fetchedAt: now,
					fetchedBy: adminUserId,
					mock: true,
					...(result.data || {}),
				};

				return res.json({
					success: true,
					data: mockReport,
					cached: false,
					mock: true,
					rawResponse: result.rawResponse,
				});
			}

			if (application.userId !== userId) {
				return res.status(403).json({
					success: false,
					message: 'Application does not belong to the specified user',
				});
			}

			// Get admin user info for audit log
			const adminUser = await prisma.user.findUnique({
				where: { id: adminUserId },
				select: { fullName: true },
			});

			// Note: This endpoint now uses the two-step process directly
			// For cached reports, use GET /api/admin/credit-reports/cache/:userId instead
			// Create audit log entry for fetch request
			const auditLog = await prisma.creditReportLog.create({
				data: {
					applicationId,
					userId,
					action: 'FETCH_REQUESTED',
					status: 'PENDING',
					requestedBy: adminUserId,
					requestedByName: adminUser?.fullName || null,
					metadata: {
						icNumber,
						fullName,
					},
				},
			});

			// Fetch credit report from CTOS B2B
			// The service now handles authentication (login) automatically
			const { ctosB2BService } = await import('../lib/ctosB2BService');
			const result = await ctosB2BService.fetchIndividualCreditReport({
				icNumber,
				fullName,
			});

			if (!result.success) {
				// Check if it's an authentication error
				const isAuthError = result.error?.includes('Login') || 
								   result.error?.includes('authentication') ||
								   result.error?.includes('Unauthorized');
				// Update audit log with failure
				await prisma.creditReportLog.update({
					where: { id: auditLog.id },
					data: {
						action: 'FETCH_FAILED',
						status: 'FAILED',
						errorMessage: result.error,
				},
			});

				return res.status(isAuthError ? 401 : 400).json({
					success: false,
					message: result.error || 'Failed to fetch credit report',
					errorType: isAuthError ? 'AUTHENTICATION_ERROR' : 'API_ERROR',
				});
			}

			// Store credit report in database
			const creditReport = await prisma.creditReport.create({
					data: {
						userId,
					applicationId,
					reportType: 'INDIVIDUAL',
					icNumber: icNumber.replace(/[\s-]/g, ''),
					fullName,
					rawResponse: result.rawResponse || {},
					creditScore: result.data?.creditScore,
					dueDiligentIndex: result.data?.dueDiligentIndex,
					riskGrade: result.data?.riskGrade,
					summaryStatus: result.data?.summaryStatus,
					totalOutstanding: result.data?.totalOutstanding,
					activeAccounts: result.data?.activeAccounts,
					defaultedAccounts: result.data?.defaultedAccounts,
					legalCases: result.data?.legalCases,
					bankruptcyRecords: result.data?.bankruptcyRecords,
					hasDataError: result.data?.hasDataError,
					errorMessage: result.data?.errorMessage,
					requestStatus: 'COMPLETED',
					confirmedAt: new Date(),
					fetchedBy: adminUserId,
				},
			});

			// Update audit log with success
			await prisma.creditReportLog.update({
				where: { id: auditLog.id },
				data: {
					action: 'FETCH_SUCCESS',
						status: 'SUCCESS',
					reportId: creditReport.id,
					},
				});

				// Create application history entry
				await prisma.loanApplicationHistory.create({
					data: {
						applicationId,
						previousStatus: application.status,
						newStatus: application.status,
						changedBy: adminUserId,
						changeReason: 'CREDIT_REPORT_FETCHED',
					notes: `Credit report fetched from CTOS for ${fullName} (${icNumber})`,
						metadata: {
						creditScore: creditReport.creditScore,
						riskGrade: creditReport.riskGrade,
						reportId: creditReport.id,
						},
					},
				});

				return res.json({
					success: true,
				data: creditReport,
				cached: false,
			});
		} catch (error) {
			console.error('Error fetching credit report:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to fetch credit report',
				error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
	}
);

/**
 * @swagger
 * /api/admin/credit-reports/request:
 *   post:
 *     summary: Request credit report from CTOS (Step 1 - Admin only)
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
 *               - applicationId
 *               - userId
 *               - icNumber
 *               - fullName
 *             properties:
 *               applicationId:
 *                 type: string
 *               userId:
 *                 type: string
 *               icNumber:
 *                 type: string
 *               fullName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Request created successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to create request
 */
router.post(
	'/credit-reports/request',
	authenticateToken,
	requireAdmin,
	async (req: AuthRequest, res: Response) => {
		try {
			const { applicationId, userId, icNumber, fullName } = req.body;
			const adminUserId = req.user?.userId;

			if (!adminUserId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized',
				});
			}

			// Validate required fields
			if (!applicationId || !userId || !icNumber || !fullName) {
				return res.status(400).json({
					success: false,
					message: 'Missing required fields: applicationId, userId, icNumber, fullName',
				});
			}

			// Verify application exists and belongs to user
			const application = await prisma.loanApplication.findUnique({
				where: { id: applicationId },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							icNumber: true,
						},
					},
				},
			});

			if (!application) {
				return res.status(404).json({
					success: false,
					message: 'Application not found',
				});
			}

			if (application.userId !== userId) {
				return res.status(403).json({
					success: false,
					message: 'Application does not belong to the specified user',
				});
			}

			// Get admin user info for audit log
			const adminUser = await prisma.user.findUnique({
				where: { id: adminUserId },
				select: { fullName: true },
			});

			// Call CTOS B2B service to request report (Step 1)
			// The service now handles authentication (login) automatically
			const { ctosB2BService } = await import('../lib/ctosB2BService');
			const result = await ctosB2BService.requestCreditReport({
				icNumber,
				fullName,
			});

			if (!result.success || !result.requestId) {
				// Check if it's an authentication error
				const isAuthError = result.error?.includes('Login') || 
								   result.error?.includes('authentication') ||
								   result.error?.includes('Unauthorized');
				
				return res.status(isAuthError ? 401 : 400).json({
					success: false,
					message: result.error || 'Failed to request credit report',
					errorType: isAuthError ? 'AUTHENTICATION_ERROR' : 'API_ERROR',
				});
			}

			// Create CreditReport record with PENDING_REQUEST status
			const creditReport = await prisma.creditReport.create({
				data: {
					userId,
					applicationId,
					reportType: 'INDIVIDUAL',
					icNumber: icNumber.replace(/[\s-]/g, ''),
					fullName,
					ctosRequestId: result.requestId,
					requestStatus: 'PENDING_REQUEST',
					requestedAt: new Date(),
					rawResponse: result.rawResponse || {},
					fetchedBy: adminUserId,
				},
			});

			// Create audit log entry
			await prisma.creditReportLog.create({
				data: {
					applicationId,
					userId,
					reportId: creditReport.id,
					action: 'REQUEST_CREATED',
					status: 'PENDING',
					requestedBy: adminUserId,
					requestedByName: adminUser?.fullName || null,
					metadata: {
						requestId: result.requestId,
						icNumber,
						fullName,
					},
				},
			});

			return res.json({
				success: true,
				data: creditReport,
				requestId: result.requestId,
			});
		} catch (error) {
			console.error('Error requesting credit report:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to request credit report',
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/credit-reports/confirm:
 *   post:
 *     summary: Confirm credit report request and fetch report (Step 2 - Admin only)
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
 *               - reportId
 *             properties:
 *               reportId:
 *                 type: string
 *                 description: Credit report ID from step 1
 *     responses:
 *       200:
 *         description: Report confirmed and fetched successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to confirm request
 */
router.post(
	'/credit-reports/confirm',
	authenticateToken,
	requireAdmin,
	async (req: AuthRequest, res: Response) => {
		try {
			const { reportId } = req.body;
			const adminUserId = req.user?.userId;

			if (!adminUserId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized',
				});
			}

			if (!reportId) {
				return res.status(400).json({
					success: false,
					message: 'Missing required field: reportId',
				});
			}

			// Get the pending report
			const pendingReport = await prisma.creditReport.findUnique({
				where: { id: reportId },
			});

			if (!pendingReport) {
				return res.status(404).json({
					success: false,
					message: 'Credit report request not found',
				});
			}

			if (pendingReport.requestStatus !== 'PENDING_REQUEST') {
				return res.status(400).json({
					success: false,
					message: `Report is not in PENDING_REQUEST status. Current status: ${pendingReport.requestStatus}`,
				});
			}

			if (!pendingReport.ctosRequestId) {
				return res.status(400).json({
					success: false,
					message: 'No CTOS request ID found for this report',
				});
			}

			// Get admin user info
			const adminUser = await prisma.user.findUnique({
				where: { id: adminUserId },
				select: { fullName: true },
			});

			// Call CTOS B2B service to confirm and fetch report (Step 2)
			// The service now handles authentication (login) automatically
			const { ctosB2BService } = await import('../lib/ctosB2BService');
			const result = await ctosB2BService.confirmCreditReport(
				pendingReport.ctosRequestId,
				{
					icNumber: pendingReport.icNumber || '',
					fullName: pendingReport.fullName,
				}
			);

			if (!result.success) {
				// Check if it's an authentication error
				const isAuthError = result.error?.includes('Login') || 
								   result.error?.includes('authentication') ||
								   result.error?.includes('Unauthorized');
				// Update report status to FAILED
				await prisma.creditReport.update({
					where: { id: reportId },
					data: {
						requestStatus: 'FAILED',
					},
				});

				// Update audit log
				await prisma.creditReportLog.create({
					data: {
						applicationId: pendingReport.applicationId || '',
						userId: pendingReport.userId,
						reportId: pendingReport.id,
						action: 'CONFIRM_FAILED',
						status: 'FAILED',
						requestedBy: adminUserId,
						requestedByName: adminUser?.fullName || null,
						errorMessage: result.error,
						metadata: {
							requestId: pendingReport.ctosRequestId,
						},
					},
				});

				return res.status(isAuthError ? 401 : 400).json({
					success: false,
					message: result.error || 'Failed to confirm credit report',
					errorType: isAuthError ? 'AUTHENTICATION_ERROR' : 'API_ERROR',
				});
			}

			// Update CreditReport with actual data and COMPLETED status
			// Merge extractedData into rawResponse for frontend access
			const rawResponseWithExtractedData = {
				...(result.rawResponse || {}),
				extractedData: result.data?.extractedData || {},
			};

			const creditReport = await prisma.creditReport.update({
				where: { id: reportId },
				data: {
					requestStatus: 'COMPLETED',
					confirmedAt: new Date(),
					rawResponse: rawResponseWithExtractedData,
					creditScore: result.data?.creditScore,
					dueDiligentIndex: result.data?.dueDiligentIndex,
					riskGrade: result.data?.riskGrade,
					litigationIndex: result.data?.litigationIndex,
					summaryStatus: result.data?.summaryStatus,
					totalOutstanding: result.data?.totalOutstanding,
					activeAccounts: result.data?.activeAccounts,
					defaultedAccounts: result.data?.defaultedAccounts,
					legalCases: result.data?.legalCases,
					bankruptcyRecords: result.data?.bankruptcyRecords,
					hasDataError: result.data?.hasDataError,
					errorMessage: result.data?.errorMessage,
					fetchedAt: new Date(),
				},
			});

			// Update audit log
			await prisma.creditReportLog.updateMany({
				where: {
					reportId: pendingReport.id,
					action: 'REQUEST_CREATED',
				},
				data: {
					action: 'CONFIRM_SUCCESS',
					status: 'SUCCESS',
				},
			});

			// Create new audit log entry for confirmation
			await prisma.creditReportLog.create({
				data: {
					applicationId: pendingReport.applicationId || '',
					userId: pendingReport.userId,
					reportId: creditReport.id,
					action: 'CONFIRM_SUCCESS',
					status: 'SUCCESS',
					requestedBy: adminUserId,
					requestedByName: adminUser?.fullName || null,
					metadata: {
						requestId: pendingReport.ctosRequestId,
						creditScore: creditReport.creditScore,
						riskGrade: creditReport.riskGrade,
					},
				},
			});

			// Create application history entry
			if (pendingReport.applicationId) {
				const application = await prisma.loanApplication.findUnique({
					where: { id: pendingReport.applicationId },
				});

				if (application) {
			await prisma.loanApplicationHistory.create({
				data: {
							applicationId: pendingReport.applicationId,
					previousStatus: application.status,
					newStatus: application.status,
					changedBy: adminUserId,
					changeReason: 'CREDIT_REPORT_FETCHED',
							notes: `Credit report fetched from CTOS for ${pendingReport.fullName} (${pendingReport.icNumber})`,
					metadata: {
						creditScore: creditReport.creditScore,
						riskGrade: creditReport.riskGrade,
						reportId: creditReport.id,
					},
				},
			});
				}
			}

			return res.json({
				success: true,
				data: creditReport,
			});
		} catch (error) {
			console.error('Error confirming credit report:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to confirm credit report',
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/credit-reports/cache/{userId}:
 *   get:
 *     summary: Get cached credit report for a user (Admin only, no time limit)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cached report retrieved successfully
 *       404:
 *         description: No cached report found
 *       403:
 *         description: Admin access required
 */
router.get(
	'/credit-reports/cache/:userId',
	authenticateToken,
	requireAdmin,
	async (req: AuthRequest, res: Response) => {
		try {
			const { userId } = req.params;
			console.log(`[CTOS CACHE] ========================================`);
			console.log(`[CTOS CACHE] Fetching cached report for userId: ${userId}`);
			console.log(`[CTOS CACHE] Request timestamp: ${new Date().toISOString()}`);

			// First, let's check if ANY reports exist for this user
			const allReports = await prisma.creditReport.findMany({
				where: { userId },
				select: {
					id: true,
					requestStatus: true,
					fetchedAt: true,
					ctosRequestId: true,
					hasDataError: true,
					creditScore: true,
				},
				orderBy: { fetchedAt: 'desc' },
			});
			console.log(`[CTOS CACHE] Total reports found for user: ${allReports.length}`);
			if (allReports.length > 0) {
				console.log('[CTOS CACHE] All reports summary:');
				allReports.forEach((report, index) => {
					console.log(`[CTOS CACHE]   Report ${index + 1}:`, {
						id: report.id,
						requestStatus: report.requestStatus,
						hasDataError: report.hasDataError,
						creditScore: report.creditScore,
						fetchedAt: report.fetchedAt,
					});
			});
		}

			// Query for the most recent COMPLETED report regardless of error status
			// This ensures we always get the latest timeline from the database
			console.log('[CTOS CACHE] Fetching the most recent COMPLETED report (including errors)...');
			let creditReport = await prisma.creditReport.findFirst({
				where: {
					userId,
					requestStatus: 'COMPLETED',
				},
				orderBy: {
					fetchedAt: 'desc',
				},
			});
			
			if (creditReport) {
				console.log('[CTOS CACHE] ✓ SUCCESS: Found report');
				console.log('[CTOS CACHE] Report details:', {
					id: creditReport.id,
					requestStatus: creditReport.requestStatus,
					hasDataError: creditReport.hasDataError,
					creditScore: creditReport.creditScore,
					errorMessage: creditReport.errorMessage,
					fetchedAt: creditReport.fetchedAt,
				});
				
				if (creditReport.hasDataError) {
					console.log('[CTOS CACHE] ⚠ WARNING: Latest report has data error');
				}
			} else {
				console.log('[CTOS CACHE] ✗ No completed reports found');
			}

			
			
			if (!creditReport) {
				console.log('[CTOS CACHE] ✗ FINAL: No completed reports found at all');
				console.log('[CTOS CACHE] Returning 404 response');
				console.log(`[CTOS CACHE] ========================================`);
				return res.status(404).json({
					success: false,
					message: 'No cached credit report found for this user',
					debug: {
						totalReports: allReports.length,
						reportStatuses: allReports.map(r => r.requestStatus),
					},
				});
			}

			console.log('[CTOS CACHE] ✓ FINAL: Returning report to client');
			console.log('[CTOS CACHE] Final report ID:', creditReport.id);
			console.log('[CTOS CACHE] Final report hasDataError:', creditReport.hasDataError);
			console.log(`[CTOS CACHE] ========================================`);
			
			// Set cache-busting headers to prevent stale data
			res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
			res.setHeader('Pragma', 'no-cache');
			res.setHeader('Expires', '0');
			
			return res.json({
				success: true,
				data: creditReport,
			});
		} catch (error) {
			console.error('[CTOS CACHE] ✗ ERROR: Exception occurred:', error);
			console.error('[CTOS CACHE] Error stack:', error instanceof Error ? error.stack : 'No stack');
			console.log(`[CTOS CACHE] ========================================`);
			return res.status(500).json({
				success: false,
				message: 'Failed to fetch cached credit report',
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/credit-reports/{userId}:
 *   get:
 *     summary: Get latest credit report for a user (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credit report retrieved successfully
 *       404:
 *         description: No credit report found
 *       403:
 *         description: Admin access required
 */
router.get(
	'/credit-reports/:userId',
	authenticateToken,
	requireAdmin,
	async (req: AuthRequest, res: Response) => {
		try {
			const { userId } = req.params;

			const creditReport = await prisma.creditReport.findFirst({
				where: {
					userId,
				},
				orderBy: {
					fetchedAt: 'desc',
				},
			});

			if (!creditReport) {
				return res.status(404).json({
					success: false,
					message: 'No credit report found for this user',
				});
			}

			return res.json({
				success: true,
				data: creditReport,
			});
		} catch (error) {
			console.error('Error fetching credit report:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to fetch credit report',
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/credit-reports/request-and-confirm:
 *   post:
 *     summary: Request and confirm credit report in single operation (Admin only)
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
 *               - applicationId
 *               - userId
 *               - icNumber
 *               - fullName
 *             properties:
 *               applicationId:
 *                 type: string
 *               userId:
 *                 type: string
 *               icNumber:
 *                 type: string
 *               fullName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report requested, confirmed and fetched successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to request and confirm credit report
 */
router.post(
	'/credit-reports/request-and-confirm',
	authenticateToken,
	requireAdmin,
	async (req: AuthRequest, res: Response) => {
		try {
			const { applicationId, userId, icNumber, fullName } = req.body;
			const adminUserId = req.user?.userId;

			if (!adminUserId) {
				return res.status(401).json({
					success: false,
					message: 'Unauthorized',
				});
			}

			// Validate required fields
			if (!applicationId || !userId || !icNumber || !fullName) {
				return res.status(400).json({
					success: false,
					message: 'Missing required fields: applicationId, userId, icNumber, fullName',
				});
			}

			// Verify application exists and belongs to user
			const application = await prisma.loanApplication.findUnique({
				where: { id: applicationId },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							icNumber: true,
						},
					},
				},
			});

			if (!application) {
				return res.status(404).json({
					success: false,
					message: 'Application not found',
				});
			}

			if (application.userId !== userId) {
				return res.status(403).json({
					success: false,
					message: 'Application does not belong to the specified user',
				});
			}

			// Get admin user info for audit log
			const adminUser = await prisma.user.findUnique({
				where: { id: adminUserId },
				select: { fullName: true },
			});

			// Step 1: Request credit report from CTOS B2B
			const { ctosB2BService } = await import('../lib/ctosB2BService');
			const requestResult = await ctosB2BService.requestCreditReport({
				icNumber,
				fullName,
			});

			if (!requestResult.success || !requestResult.requestId) {
				// Check if it's an authentication error
				const isAuthError = requestResult.error?.includes('Login') || 
								   requestResult.error?.includes('authentication') ||
								   requestResult.error?.includes('Unauthorized');
				
				// Create single audit log entry for failed request
				await prisma.creditReportLog.create({
					data: {
						applicationId,
						userId,
						action: 'FETCH_FAILED',
						status: 'FAILED',
						requestedBy: adminUserId,
						requestedByName: adminUser?.fullName || null,
						errorMessage: requestResult.error || 'Failed to request credit report',
						metadata: {
							icNumber,
							fullName,
							step: 'request',
						},
					},
				});

				return res.status(isAuthError ? 401 : 400).json({
					success: false,
					message: requestResult.error || 'Failed to request credit report',
					errorType: isAuthError ? 'AUTHENTICATION_ERROR' : 'API_ERROR',
				});
			}

			// Step 2: Confirm and fetch the report
			const confirmResult = await ctosB2BService.confirmCreditReport(
				requestResult.requestId,
				{
					icNumber,
					fullName,
				}
			);

			if (!confirmResult.success) {
				// Check if it's an authentication error
				const isAuthError = confirmResult.error?.includes('Login') || 
								   confirmResult.error?.includes('authentication') ||
								   confirmResult.error?.includes('Unauthorized');

				// Create CreditReport record with FAILED status
				const failedReport = await prisma.creditReport.create({
					data: {
						userId,
						applicationId,
						reportType: 'INDIVIDUAL',
						icNumber: icNumber.replace(/[\s-]/g, ''),
						fullName,
						ctosRequestId: requestResult.requestId,
						requestStatus: 'FAILED',
						requestedAt: new Date(),
						rawResponse: requestResult.rawResponse || {},
						fetchedBy: adminUserId,
					},
				});

				// Create single audit log entry for failed confirmation
				await prisma.creditReportLog.create({
					data: {
						applicationId,
						userId,
						reportId: failedReport.id,
						action: 'FETCH_FAILED',
						status: 'FAILED',
						requestedBy: adminUserId,
						requestedByName: adminUser?.fullName || null,
						errorMessage: confirmResult.error || 'Failed to confirm credit report',
						metadata: {
							requestId: requestResult.requestId,
							icNumber,
							fullName,
							step: 'confirm',
						},
					},
				});

				return res.status(isAuthError ? 401 : 400).json({
					success: false,
					message: confirmResult.error || 'Failed to confirm credit report',
					errorType: isAuthError ? 'AUTHENTICATION_ERROR' : 'API_ERROR',
				});
			}

			// Create CreditReport record with COMPLETED status
			// Merge extractedData into rawResponse for frontend access
			const rawResponseWithExtractedData = {
				...(confirmResult.rawResponse || {}),
				extractedData: confirmResult.data?.extractedData || {},
			};

			const creditReport = await prisma.creditReport.create({
				data: {
					userId,
					applicationId,
					reportType: 'INDIVIDUAL',
					icNumber: icNumber.replace(/[\s-]/g, ''),
					fullName,
					ctosRequestId: requestResult.requestId,
					requestStatus: 'COMPLETED',
					requestedAt: new Date(),
					confirmedAt: new Date(),
					rawResponse: rawResponseWithExtractedData,
					creditScore: confirmResult.data?.creditScore,
					dueDiligentIndex: confirmResult.data?.dueDiligentIndex,
					riskGrade: confirmResult.data?.riskGrade,
					litigationIndex: confirmResult.data?.litigationIndex,
					summaryStatus: confirmResult.data?.summaryStatus,
					totalOutstanding: confirmResult.data?.totalOutstanding,
					activeAccounts: confirmResult.data?.activeAccounts,
					defaultedAccounts: confirmResult.data?.defaultedAccounts,
					legalCases: confirmResult.data?.legalCases,
					bankruptcyRecords: confirmResult.data?.bankruptcyRecords,
					hasDataError: confirmResult.data?.hasDataError,
					errorMessage: confirmResult.data?.errorMessage,
					fetchedAt: new Date(),
					fetchedBy: adminUserId,
				},
			});

			// Create single audit log entry for successful fetch
			await prisma.creditReportLog.create({
				data: {
					applicationId,
					userId,
					reportId: creditReport.id,
					action: 'FETCH_SUCCESS',
					status: 'SUCCESS',
					requestedBy: adminUserId,
					requestedByName: adminUser?.fullName || null,
					metadata: {
						requestId: requestResult.requestId,
						icNumber,
						fullName,
						creditScore: creditReport.creditScore,
						riskGrade: creditReport.riskGrade,
					},
				},
			});

			// Create application history entry
			if (application) {
				await prisma.loanApplicationHistory.create({
					data: {
						applicationId,
						previousStatus: application.status,
						newStatus: application.status,
						changedBy: adminUserId,
						changeReason: 'CREDIT_REPORT_FETCHED',
						notes: `Credit report fetched from CTOS for ${fullName} (${icNumber.replace(/[\s-]/g, '')})`,
						metadata: {
							creditScore: creditReport.creditScore,
							riskGrade: creditReport.riskGrade,
							reportId: creditReport.id,
						},
					},
				});
			}

			return res.json({
				success: true,
				data: creditReport,
			});
		} catch (error) {
			console.error('Error requesting and confirming credit report:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to request and confirm credit report',
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}
);

/**
 * @swagger
 * /api/admin/credit-reports/{reportId}/pdf:
 *   get:
 *     summary: Download credit report as PDF (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Credit report not found
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to generate PDF
 */
router.get(
	'/credit-reports/:reportId/pdf',
	authenticateToken,
	requireAdmin,
	async (req: AuthRequest, res: Response) => {
		try {
			const { reportId } = req.params;

			// Get the credit report
			const creditReport = await prisma.creditReport.findUnique({
				where: { id: reportId },
			});

			if (!creditReport) {
				return res.status(404).json({
					success: false,
					message: 'Credit report not found',
				});
			}

			// Extract base64 encoded XML from rawResponse
			const rawResponse = creditReport.rawResponse as any;
			const base64Encoded = rawResponse?.base64Encoded;

			if (!base64Encoded) {
				return res.status(400).json({
					success: false,
					message: 'No base64 encoded report data found',
				});
			}

			// Convert base64 to buffer
			const buffer = Buffer.from(base64Encoded, 'base64');
			
			// Check if it's already a PDF (starts with PDF magic bytes)
			const isPDF = buffer.slice(0, 4).toString() === '%PDF';
			
			let pdfBuffer: Buffer;
			if (isPDF) {
				// Already a PDF, use directly
				pdfBuffer = buffer;
			} else {
				// It's XML, convert it to PDF using pdfkit
				// Note: pdfkit needs to be installed: npm install pdfkit @types/pdfkit
				let PDFDocument;
				try {
					PDFDocument = require('pdfkit');
				} catch (error) {
					throw new Error('pdfkit is not installed. Please run: npm install pdfkit @types/pdfkit');
				}
				
				const chunks: Buffer[] = [];
				
				// Create promise to wait for PDF generation
				const pdfPromise = new Promise<Buffer>((resolve, reject) => {
					const doc = new PDFDocument({
						margin: 50,
						size: 'A4',
					});
					
					doc.on('data', (chunk: Buffer) => chunks.push(chunk));
					doc.on('end', () => {
						resolve(Buffer.concat(chunks));
					});
					doc.on('error', reject);

					// Decode XML for display
					const xmlContent = buffer.toString('utf-8');
					
					// Add header
					doc.fontSize(16).font('Helvetica-Bold');
					doc.text('CTOS Credit Report', { align: 'center' });
					doc.moveDown();
					
					// Add report metadata
					doc.fontSize(10).font('Helvetica');
					doc.text(`Report ID: ${creditReport.id}`);
					doc.text(`IC Number: ${creditReport.icNumber || 'N/A'}`);
					doc.text(`Full Name: ${creditReport.fullName}`);
					doc.text(`Fetched At: ${creditReport.fetchedAt.toLocaleString()}`);
					
					// Add credit metrics if available
					if (creditReport.creditScore) {
						doc.moveDown();
						doc.fontSize(12).font('Helvetica-Bold');
						doc.text('Credit Metrics:', { underline: true });
						doc.fontSize(10).font('Helvetica');
						doc.text(`Credit Score: ${creditReport.creditScore}`);
						if (creditReport.riskGrade) doc.text(`Risk Grade: ${creditReport.riskGrade}`);
						if (creditReport.dueDiligentIndex) doc.text(`Due Diligent Index: ${creditReport.dueDiligentIndex}`);
					}
					
					doc.moveDown();
					doc.fontSize(10).font('Helvetica-Bold');
					doc.text('Raw XML Report Data:', { underline: true });
					doc.moveDown(0.5);
					doc.fontSize(8).font('Courier');
					// Limit XML content to avoid PDF size issues
					const xmlPreview = xmlContent.length > 50000 
						? xmlContent.substring(0, 50000) + '\n\n... (truncated)'
						: xmlContent;
					doc.text(xmlPreview, { 
						align: 'left',
						indent: 10,
					});
					
					doc.end();
				});
				
				pdfBuffer = await pdfPromise;
			}

			// Generate filename
			const dateStr = creditReport.fetchedAt.toISOString().split('T')[0];
			const icNumber = creditReport.icNumber?.replace(/[\s-]/g, '') || 'unknown';
			const filename = `credit-report-${icNumber}-${dateStr}.pdf`;

			// Set response headers
			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
			res.setHeader('Content-Length', pdfBuffer.length.toString());

			// Send PDF buffer
			return res.send(pdfBuffer);
		} catch (error) {
			console.error('Error generating PDF:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to generate PDF',
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}
);

export default router;
