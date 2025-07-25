import { prisma } from "./prisma";
import crypto from "crypto";

// OTP Types for different purposes
export enum OTPType {
	PHONE_VERIFICATION = "PHONE_VERIFICATION",
	PASSWORD_RESET = "PASSWORD_RESET",
	PHONE_CHANGE_CURRENT = "PHONE_CHANGE_CURRENT",
	PHONE_CHANGE_NEW = "PHONE_CHANGE_NEW",
}

interface CreateOTPResult {
	success: boolean;
	otp?: string;
	expiresAt?: Date;
	error?: string;
}

interface ValidateOTPResult {
	success: boolean;
	userId?: string;
	error?: string;
}

export class OTPUtils {
	private static readonly OTP_LENGTH = 6;
	private static readonly OTP_EXPIRY_MINUTES = 5;
	private static readonly MAX_ATTEMPTS = 5;

	// Rate limiting configurations per OTP type
	private static readonly RATE_LIMITS = {
		[OTPType.PHONE_VERIFICATION]: { requests: 10, windowMinutes: 15 }, // 10 per 15 minutes (for development)
		[OTPType.PASSWORD_RESET]: { requests: 6, windowMinutes: 15 }, // 6 per 15 minutes (for development)
		[OTPType.PHONE_CHANGE_CURRENT]: { requests: 6, windowMinutes: 15 }, // 6 per 15 minutes (for development)
		[OTPType.PHONE_CHANGE_NEW]: { requests: 6, windowMinutes: 15 }, // 6 per 15 minutes (for development)
	};

	/**
	 * Generate a secure 6-digit OTP
	 */
	static generateOTP(): string {
		// Use crypto.randomInt for secure random number generation
		const otp = crypto.randomInt(100000, 999999).toString();
		return otp.padStart(this.OTP_LENGTH, "0");
	}

	/**
	 * Create and store an OTP for a user with specific type
	 */
	static async createOTPWithType(
		userId: string,
		phoneNumber: string,
		type: OTPType = OTPType.PHONE_VERIFICATION
	): Promise<CreateOTPResult> {
		try {
			// Generate OTP and expiry time
			const otp = this.generateOTP();
			const expiresAt = new Date(
				Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000
			);

			// Invalidate any existing OTPs for this user and type
			await prisma.phoneVerification.updateMany({
				where: {
					userId,
					verified: false,
					otpType: type,
				},
				data: {
					verified: true, // Mark as used so they can't be reused
				},
			});

			// Create new OTP record
			await prisma.phoneVerification.create({
				data: {
					userId,
					phoneNumber,
					otp,
					expiresAt,
					verified: false,
					attempts: 0,
					otpType: type,
				},
			});

			console.log(`OTP created for user ${userId} (${type}): ${otp} (expires at ${expiresAt})`);

			return {
				success: true,
				otp,
				expiresAt,
			};
		} catch (error) {
			console.error("Error creating OTP:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Validate an OTP with specific type
	 */
	static async validateOTPWithType(
		phoneNumber: string,
		otpCode: string,
		type: OTPType = OTPType.PHONE_VERIFICATION
	): Promise<ValidateOTPResult> {
		try {
			// Find the most recent unverified OTP for this phone number and type
			const otpRecord = await prisma.phoneVerification.findFirst({
				where: {
					phoneNumber,
					verified: false,
					otpType: type,
					expiresAt: {
						gt: new Date(), // Not expired
					},
				},
				orderBy: {
					createdAt: "desc",
				},
				include: {
					user: true,
				},
			});

			if (!otpRecord) {
				return {
					success: false,
					error: "Invalid or expired OTP. Please request a new one.",
				};
			}

			// Check if max attempts exceeded
			if (otpRecord.attempts >= this.MAX_ATTEMPTS) {
				return {
					success: false,
					error: "Too many invalid attempts. Please request a new OTP.",
				};
			}

			// Increment attempt count
			await prisma.phoneVerification.update({
				where: { id: otpRecord.id },
				data: {
					attempts: otpRecord.attempts + 1,
				},
			});

			// Check if OTP matches
			if (otpRecord.otp !== otpCode) {
				return {
					success: false,
					error: "Invalid OTP. Please try again.",
				};
			}

			// OTP is valid - mark as verified
			await prisma.phoneVerification.update({
				where: { id: otpRecord.id },
				data: { verified: true },
			});

			// For phone verification, also update user's phone verification status
			if (type === OTPType.PHONE_VERIFICATION) {
				await prisma.user.update({
					where: { id: otpRecord.userId },
					data: { phoneVerified: true },
				});
			}

			console.log(`${type} verification successful for user ${otpRecord.userId}`);

			return {
				success: true,
				userId: otpRecord.userId,
			};
		} catch (error) {
			console.error("Error validating OTP:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Check if user can request a new OTP with type-specific rate limiting
	 */
	static async canRequestNewOTPWithType(
		phoneNumber: string, 
		type: OTPType = OTPType.PHONE_VERIFICATION
	): Promise<{
		canRequest: boolean;
		waitTime?: number;
		error?: string;
	}> {
		try {
			const rateLimit = this.RATE_LIMITS[type];
			const windowStart = new Date(Date.now() - rateLimit.windowMinutes * 60 * 1000);

			// Check for recent OTP requests within the rate limit window
			const recentOTPs = await prisma.phoneVerification.findMany({
				where: {
					phoneNumber,
					otpType: type,
					createdAt: {
						gt: windowStart,
					},
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			// Check if we've exceeded the rate limit
			if (recentOTPs.length >= rateLimit.requests) {
				const oldestInWindow = recentOTPs[recentOTPs.length - 1];
				const resetTime = new Date(oldestInWindow.createdAt.getTime() + rateLimit.windowMinutes * 60 * 1000);
				const waitTimeSeconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000); // seconds

				return {
					canRequest: false,
					waitTime: waitTimeSeconds > 0 ? waitTimeSeconds : 0,
					error: `Rate limit exceeded. Please wait ${waitTimeSeconds} seconds before requesting a new OTP.`,
				};
			}

			// Check for recent OTP requests (within last minute for immediate rate limiting)
			const recentOTP = recentOTPs[0];
			if (recentOTP) {
				const timeSinceLastRequest = Date.now() - recentOTP.createdAt.getTime();
				const oneMinuteInMs = 60 * 1000;
				
				if (timeSinceLastRequest < oneMinuteInMs) {
					const waitTime = Math.ceil((oneMinuteInMs - timeSinceLastRequest) / 1000);
					return {
						canRequest: false,
						waitTime: waitTime > 0 ? waitTime : 0,
					};
				}
			}

			return { canRequest: true };
		} catch (error) {
			console.error("Error checking OTP rate limit:", error);
			return {
				canRequest: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	// Legacy methods for backward compatibility
	static async createOTP(userId: string, phoneNumber: string): Promise<CreateOTPResult> {
		return this.createOTPWithType(userId, phoneNumber, OTPType.PHONE_VERIFICATION);
	}

	static async validateOTP(phoneNumber: string, otpCode: string): Promise<ValidateOTPResult> {
		return this.validateOTPWithType(phoneNumber, otpCode, OTPType.PHONE_VERIFICATION);
	}

	static async canRequestNewOTP(phoneNumber: string): Promise<{
		canRequest: boolean;
		waitTime?: number;
		error?: string;
	}> {
		return this.canRequestNewOTPWithType(phoneNumber, OTPType.PHONE_VERIFICATION);
	}

	/**
	 * Clean up expired OTPs (for maintenance)
	 */
	static async cleanupExpiredOTPs(): Promise<number> {
		try {
			const result = await prisma.phoneVerification.deleteMany({
				where: {
					expiresAt: {
						lt: new Date(),
					},
				},
			});

			console.log(`Cleaned up ${result.count} expired OTPs`);
			return result.count;
		} catch (error) {
			console.error("Error cleaning up expired OTPs:", error);
			return 0;
		}
	}

	/**
	 * Get OTP status for a phone number with specific type
	 */
	static async getOTPStatusWithType(
		phoneNumber: string, 
		type: OTPType = OTPType.PHONE_VERIFICATION
	): Promise<{
		hasActivePendingOTP: boolean;
		attemptsRemaining?: number;
		expiresAt?: Date;
	}> {
		try {
			const otpRecord = await prisma.phoneVerification.findFirst({
				where: {
					phoneNumber,
					verified: false,
					otpType: type,
					expiresAt: {
						gt: new Date(),
					},
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			if (!otpRecord) {
				return { hasActivePendingOTP: false };
			}

			return {
				hasActivePendingOTP: true,
				attemptsRemaining: Math.max(0, this.MAX_ATTEMPTS - otpRecord.attempts),
				expiresAt: otpRecord.expiresAt,
			};
		} catch (error) {
			console.error("Error getting OTP status:", error);
			return { hasActivePendingOTP: false };
		}
	}

	// Legacy method for backward compatibility
	static async getOTPStatus(phoneNumber: string): Promise<{
		hasActivePendingOTP: boolean;
		attemptsRemaining?: number;
		expiresAt?: Date;
	}> {
		return this.getOTPStatusWithType(phoneNumber, OTPType.PHONE_VERIFICATION);
	}
} 