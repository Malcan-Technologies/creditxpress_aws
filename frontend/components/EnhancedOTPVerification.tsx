"use client";

import { useState, useEffect } from "react";
import { fetchWithTokenRefresh } from "@/lib/authUtils";

interface OTPVerificationData {
	accessToken?: string;
	refreshToken?: string;
	userId?: string;
	phoneNumber?: string;
	isOnboardingComplete?: boolean;
	onboardingStep?: number;
	resetToken?: string;
	changeToken?: string;
	newPhone?: string;
	message?: string;
}

interface EnhancedOTPVerificationProps {
	phoneNumber: string;
	purpose: 'login' | 'password-reset' | 'phone-change-current' | 'phone-change-new';
	onVerificationSuccess: (data: OTPVerificationData) => void;
	onBack?: () => void;
	title?: string;
	description?: string;
	// For phone change flows
	changeToken?: string;
	// For password reset flows
	resetToken?: string;
}

// Purpose-specific configurations
const PURPOSE_CONFIG = {
	'login': {
		defaultTitle: "Verify Your Phone Number",
		defaultDescription: "We've sent a 6-digit verification code to your WhatsApp",
		verifyEndpoint: "/api/auth/verify-otp",
		resendEndpoint: "/api/auth/resend-otp",
		cooldownSeconds: 60,
	},
	'password-reset': {
		defaultTitle: "Verify Reset Code",
		defaultDescription: "We've sent a password reset code to your WhatsApp",
		verifyEndpoint: "/api/auth/verify-reset-otp",
		resendEndpoint: "/api/auth/forgot-password",
		cooldownSeconds: 60,
	},
	'phone-change-current': {
		defaultTitle: "Verify Current Phone",
		defaultDescription: "Please verify your current phone number to continue",
		verifyEndpoint: "/api/users/me/phone/verify-current",
		resendEndpoint: "/api/users/me/phone/change-request",
		cooldownSeconds: 60,
	},
	'phone-change-new': {
		defaultTitle: "Verify New Phone",
		defaultDescription: "Please verify your new phone number to complete the change",
		verifyEndpoint: "/api/users/me/phone/verify-new",
		resendEndpoint: "/api/users/me/phone/change-request",
		cooldownSeconds: 60,
	},
};

export default function EnhancedOTPVerification({
	phoneNumber,
	purpose,
	onVerificationSuccess,
	onBack,
	title,
	description,
	changeToken,
	resetToken,
}: EnhancedOTPVerificationProps) {
	const [otpCode, setOtpCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [resendLoading, setResendLoading] = useState(false);
	const [resendCooldown, setResendCooldown] = useState(PURPOSE_CONFIG[purpose].cooldownSeconds);
	const [canResend, setCanResend] = useState(false);
	const [currentChangeToken, setCurrentChangeToken] = useState(changeToken);

	const config = PURPOSE_CONFIG[purpose];
	const displayTitle = title || config.defaultTitle;
	const displayDescription = description || config.defaultDescription;

	// Countdown timer effect
	useEffect(() => {
		let timer: NodeJS.Timeout;
		if (resendCooldown > 0) {
			timer = setTimeout(() => {
				setResendCooldown(resendCooldown - 1);
			}, 1000);
		} else if (resendCooldown === 0 && !canResend) {
			setCanResend(true);
		}
		return () => clearTimeout(timer);
	}, [resendCooldown, canResend]);

	const handleVerification = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);

		if (!otpCode || otpCode.length !== 6) {
			setError("Please enter a valid 6-digit OTP");
			return;
		}

		setLoading(true);

		try {
			// Prepare request body based on purpose
			let requestBody: any = { 
				phoneNumber, 
				otp: otpCode 
			};

			if (purpose.includes('phone-change') && currentChangeToken) {
				requestBody.changeToken = currentChangeToken;
			} else if (purpose === 'password-reset' && resetToken) {
				// For password reset verification, we don't need resetToken in the request
				// The backend will generate one after OTP verification
			}

			let data;

			// Use authenticated requests for phone change purposes
			if (purpose.includes('phone-change')) {
				data = await fetchWithTokenRefresh(config.verifyEndpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(requestBody),
				});
			} else {
				// Use regular fetch for non-authenticated purposes (login, password reset)
				const response = await fetch(config.verifyEndpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(requestBody),
				});

				data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || data.message || "Failed to verify OTP");
				}
			}

			onVerificationSuccess(data);
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "An error occurred"
			);
		} finally {
			setLoading(false);
		}
	};

	const handleResendOTP = async () => {
		if (!canResend || resendCooldown > 0) return;
		
		setResendLoading(true);
		setError(null);

		try {
			// Prepare request body for resend based on purpose
			let requestBody: any = { phoneNumber };
			let endpoint = config.resendEndpoint;

			if (purpose === 'phone-change-new' && currentChangeToken) {
				// For phone change new verification resend, include the new phone number
				requestBody = { newPhoneNumber: phoneNumber };
			}

			let data;
			let responseOk = true;
			let errorMessage = "";

			// Use authenticated requests for phone change purposes
			if (purpose.includes('phone-change')) {
				try {
					data = await fetchWithTokenRefresh(endpoint, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(requestBody),
					});
				} catch (error: any) {
					responseOk = false;
					errorMessage = error.message || "Failed to resend OTP";
				}
			} else {
				// Use regular fetch for non-authenticated purposes
				const response = await fetch(endpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(requestBody),
				});

				data = await response.json();
				responseOk = response.ok;
				
				if (!response.ok) {
					errorMessage = data.error || data.message || "Failed to resend OTP";
				}
			}

			if (!responseOk) {
				// Check if the error message contains cooldown information
				const waitTimeMatch = errorMessage.match(/wait (\d+) seconds/);
				
				if (waitTimeMatch) {
					const waitTime = parseInt(waitTimeMatch[1]);
					setResendCooldown(waitTime);
					setCanResend(false);
					setError(`Please wait ${waitTime} seconds before requesting a new code`);
				} else {
					setError(errorMessage);
				}
				return;
			}

			// Success - update changeToken if returned and set cooldown
			if (data && data.changeToken && purpose.includes('phone-change')) {
				setCurrentChangeToken(data.changeToken);
			}
			setResendCooldown(config.cooldownSeconds);
			setCanResend(false);
			setError("New verification code sent to your WhatsApp!");
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "Failed to resend OTP"
			);
		} finally {
			setResendLoading(false);
		}
	};

	return (
		<div className="bg-white rounded-xl shadow-lg p-8 space-y-8 border border-gray-200">
			<div className="text-center">
				<h2 className="text-2xl font-bold text-gray-900 font-heading mb-2">
					{displayTitle}
				</h2>
				<p className="text-sm text-gray-600 font-body">
					{displayDescription}:{" "}
					<span className="font-semibold">{phoneNumber}</span>
				</p>
			</div>

			<form className="space-y-6" onSubmit={handleVerification}>
				<div>
					<label
						htmlFor="otpCode"
						className="block text-sm font-medium text-gray-700 mb-1 font-body"
					>
						Verification Code
					</label>
					<input
						id="otpCode"
						name="otpCode"
						type="text"
						inputMode="numeric"
						pattern="[0-9]*"
						maxLength={6}
						required
						value={otpCode}
						onChange={(e) => {
							const value = e.target.value.replace(/\D/g, '');
							setOtpCode(value);
							if (error) setError(null);
						}}
						className="block w-full h-12 px-4 py-3 text-base font-body bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-purple-primary hover:border-gray-400 transition-colors text-center tracking-widest rounded-xl"
						placeholder="000000"
						autoComplete="one-time-code"
					/>
					{error && (
						<p className={`mt-1 text-sm font-body ${
							error.includes("sent") || error.includes("WhatsApp") ? "text-green-600" : 
							resendCooldown > 0 && error.includes("wait") ? "text-orange-600" : "text-red-600"
						}`}>
							{resendCooldown > 0 && error.includes("wait") ? 
								`Please wait ${resendCooldown} seconds before requesting a new code` : 
								error
							}
						</p>
					)}
				</div>

				<div className="flex flex-col space-y-4">
					<button
						type="submit"
						disabled={loading || otpCode.length !== 6}
						className="w-full h-12 px-4 py-2 text-base font-medium text-white bg-purple-primary hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-body rounded-xl shadow-lg"
					>
						{loading ? (
							<>
								<svg
									className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle
										className="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										strokeWidth="4"
									></circle>
									<path
										className="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
								Verifying...
							</>
						) : (
							"Verify Code"
						)}
					</button>

					<div className="text-center">
						<p className="text-sm text-gray-600 font-body">
							Didn't receive the code?{" "}
							{resendCooldown > 0 ? (
								<span className="inline-flex items-center text-gray-500 font-medium">
									<svg className="w-4 h-4 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 4" />
										<circle cx="12" cy="12" r="10" strokeWidth={2} fill="none" />
									</svg>
									Resend in {resendCooldown}s
								</span>
							) : (
								<button
									type="button"
									onClick={handleResendOTP}
									disabled={resendLoading || !canResend}
									className="font-medium text-purple-primary hover:text-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{resendLoading ? "Sending..." : "Resend Code"}
								</button>
							)}
						</p>
					</div>

					{onBack && (
						<div className="text-center">
							<button
								type="button"
								onClick={onBack}
								className="text-sm text-gray-500 hover:text-gray-700 transition-colors font-body"
							>
								← Back
							</button>
						</div>
					)}
				</div>
			</form>
		</div>
	);
} 