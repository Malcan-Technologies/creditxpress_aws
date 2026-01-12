"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Logo from "../../components/Logo";
import { useDocumentTitle } from "@/hooks/use-document-title";
import Cookies from "js-cookie";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import "@/styles/phone-input.css";
import { TokenStorage } from "@/lib/authUtils";
import { validatePhoneNumber } from "@/lib/phoneUtils";

interface CountryData {
	countryCode: string;
	dialCode: string;
	format: string;
	name: string;
}

export default function SignupPage() {
	useDocumentTitle("Sign Up");

	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [acceptedTerms, setAcceptedTerms] = useState(false);
	const [phoneNumber, setPhoneNumber] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [phoneError, setPhoneError] = useState<string | null>(null);
	
	// OTP verification states
	const [showOTPVerification, setShowOTPVerification] = useState(false);
	const [otpCode, setOtpCode] = useState("");
	const [otpError, setOtpError] = useState<string | null>(null);
	const [otpLoading, setOtpLoading] = useState(false);
	const [resendLoading, setResendLoading] = useState(false);
	const [signupData, setSignupData] = useState<{
		userId: string;
		phoneNumber: string;
		expiresAt: string;
	} | null>(null);

	// Example placeholders for different countries
	const placeholders: { [key: string]: string } = {
		my: "+60", // Malaysia
		sg: "+65", // Singapore
		id: "+62", // Indonesia
		th: "+66", // Thailand
	};

	const [placeholder, setPlaceholder] = useState(placeholders["my"]);

	const handlePhoneChange = (value: string, data: CountryData) => {
		setPhoneNumber(value);
		setPlaceholder(placeholders[data.countryCode] || "1234 5678");
		
		// Clear phone error when user starts typing
		if (phoneError) {
			setPhoneError(null);
		}
	};

	// Check if user has entered actual digits beyond the country code
	// Show helper text when field is empty or only has country code
	const shouldShowHelper = !phoneNumber || phoneNumber.length <= 2;

	const handleOTPVerification = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setOtpError(null);

		if (!otpCode || otpCode.length !== 6) {
			setOtpError("Please enter a valid 6-digit OTP");
			return;
		}

		if (!signupData) {
			setOtpError("Session expired. Please try signing up again.");
			return;
		}

		setOtpLoading(true);

		try {
			const response = await fetch("/api/auth/verify-otp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ 
					phoneNumber: signupData.phoneNumber, 
					otp: otpCode 
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || "Failed to verify OTP");
			}

			// Store tokens using our utility functions
			TokenStorage.setAccessToken(data.accessToken);
			TokenStorage.setRefreshToken(data.refreshToken);

			// Redirect to dashboard
			router.push("/dashboard");
		} catch (error) {
			setOtpError(
				error instanceof Error ? error.message : "An error occurred"
			);
		} finally {
			setOtpLoading(false);
		}
	};

	const handleResendOTP = async () => {
		if (!signupData) {
			setOtpError("Session expired. Please try signing up again.");
			return;
		}

		setResendLoading(true);
		setOtpError(null);

		try {
			const response = await fetch("/api/auth/resend-otp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ phoneNumber: signupData.phoneNumber }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || "Failed to resend OTP");
			}

			// Update expiry time if provided
			if (data.expiresAt) {
				setSignupData(prev => prev ? { ...prev, expiresAt: data.expiresAt } : null);
			}

			setOtpError("New verification code sent to your WhatsApp!");
		} catch (error) {
			setOtpError(
				error instanceof Error ? error.message : "Failed to resend OTP"
			);
		} finally {
			setResendLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);

		if (!acceptedTerms) {
			setError("Please accept the terms and conditions to continue");
			return;
		}

		// Validate phone number before submission
		const phoneValidation = validatePhoneNumber(phoneNumber, {
			requireMobile: true, // Require mobile numbers for signup
			allowLandline: false
		});

		if (!phoneValidation.isValid) {
			setPhoneError(phoneValidation.error || "Please enter a valid phone number");
			return;
		}

		setLoading(true);

		const formData = new FormData(e.currentTarget);
		const password = formData.get("password") as string;
		const confirmPassword = formData.get("confirmPassword") as string;

		// Disallow passwords that are empty or only whitespace
		if (!password || password.trim().length === 0) {
			setError("Password cannot be empty or only spaces");
			setLoading(false);
			return;
		}

		// Enforce strong password: at least 8 chars, 1 uppercase, 1 special
		const hasUppercase = /[A-Z]/.test(password);
		const hasSpecial = /[^A-Za-z0-9]/.test(password);
		// Disallow any whitespace characters in password
		if (/\s/.test(password)) {
			setError("Password cannot contain spaces");
			setLoading(false);
			return;
		}

		if (password.length < 8 || !hasUppercase || !hasSpecial) {
			setError("Password must be at least 8 characters, include 1 uppercase letter and 1 special character");
			setLoading(false);
			return;
		}

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			setLoading(false);
			return;
		}

		try {
			// Call our Next.js API route
			const response = await fetch("/api/auth/signup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ phoneNumber, password }),
			});

			const data = await response.json();

			if (!response.ok) {
				// Handle specific error cases
				if (response.status === 400 && data.message?.includes("already registered")) {
					setError("This phone number is already registered. Please use a different number or try logging in instead.");
				} else {
					throw new Error(data.message || data.error || "Failed to create account");
				}
				return;
			}

			// Account created successfully, now show OTP verification
			setSignupData({
				userId: data.userId,
				phoneNumber: data.phoneNumber,
				expiresAt: data.expiresAt,
			});
			setShowOTPVerification(true);
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "An error occurred"
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-offwhite py-12 px-4 sm:px-6 lg:px-8">
				<div className="max-w-md w-full">
					<button
						onClick={() => router.back()}
						className="mb-4 flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors font-body"
					>
						<svg
							className="w-4 h-4 mr-2"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M10 19l-7-7m0 0l7-7m-7 7h18"
							/>
						</svg>
						Back
					</button>

					<div className="bg-white rounded-xl shadow-lg p-8 space-y-8 border border-gray-200">
						<div className="flex flex-col items-center">
							<div className="mb-6">
								<Logo
									size="lg"
									variant="white"
									linkTo={undefined}
								/>
							</div>
							<h2 className="text-center text-3xl font-extrabold text-gray-900 font-heading">
								Create your account
							</h2>
							<p className="mt-2 text-center text-sm text-gray-500 font-body">
								Already have an account?{" "}
								<Link
									href="/login"
									className="font-medium text-purple-primary hover:text-purple-700 transition-colors"
								>
									Sign in
								</Link>
							</p>
						</div>

						{!showOTPVerification ? (
							<form
								className="mt-8 space-y-6"
								onSubmit={handleSubmit}
							>
							<div className="space-y-4">
								<div>
									<label
										htmlFor="phoneNumber"
										className="block text-sm font-medium text-gray-700 mb-1 font-body"
									>
										Phone Number
									</label>
									<div className="phone-input-wrapper relative">
										<PhoneInput
											country="my"
											value={phoneNumber}
											onChange={(
												value,
												data: CountryData
											) => {
												handlePhoneChange(value, data);
											}}
											inputProps={{
												id: "phoneNumber",
												name: "phoneNumber",
												required: true,
												placeholder: placeholder,
											}}
											containerClass="!w-full"
											inputClass="!w-full !h-12 !pl-20 !pr-4 !py-3 !text-base !font-body !bg-white !border !border-gray-300 !text-gray-900 !placeholder-gray-400 hover:!border-gray-400 !transition-colors"
											buttonClass="!h-12 !w-16 !border !border-gray-300 !bg-white hover:!bg-gray-50 !text-gray-700 !transition-colors !border-r-0"
											dropdownClass="!bg-white !border-gray-300 !text-gray-900 !shadow-xl !mt-1 !max-h-60 !overflow-y-auto !min-w-72"
											searchClass="!bg-white !border-gray-300 !text-gray-900 !placeholder-gray-400"
											enableSearch
											disableSearchIcon
											searchPlaceholder="Search country..."
										/>
										{shouldShowHelper && (
											<div className="absolute left-32 top-3 text-base text-gray-400 pointer-events-none font-body">
												12 345 6789
											</div>
										)}
										{phoneError && (
											<p className="mt-1 text-sm text-red-600 font-body">
												{phoneError}
											</p>
										)}
									</div>
								</div>

								<div>
									<label
										htmlFor="password"
										className="block text-sm font-medium text-gray-700 font-body"
									>
										Password
									</label>
									<div className="relative">
										<input
											id="password"
											name="password"
											type={
												showPassword
													? "text"
													: "password"
											}
											required
											minLength={8}
											className="mt-1 block w-full h-12 px-4 py-3 pr-12 text-base font-body bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-purple-primary hover:border-gray-400 transition-colors [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
											placeholder="Min. 8 characters"
											autoComplete="new-password"
										/>
										<button
											type="button"
											onClick={() =>
												setShowPassword(!showPassword)
											}
											className="absolute inset-y-0 right-0 top-1 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
										>
											{showPassword ? (
												<svg
													className="h-5 w-5"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
													strokeWidth={2}
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88"
													/>
												</svg>
											) : (
												<svg
													className="h-5 w-5"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
													strokeWidth={2}
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
													/>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
													/>
												</svg>
											)}
										</button>
									</div>
								</div>

								<div>
									<label
										htmlFor="confirmPassword"
										className="block text-sm font-medium text-gray-700 font-body"
									>
										Confirm Password
									</label>
									<div className="relative">
										<input
											id="confirmPassword"
											name="confirmPassword"
											type={
												showConfirmPassword
													? "text"
													: "password"
											}
											required
											minLength={8}
											className="mt-1 block w-full h-12 px-4 py-3 pr-12 text-base font-body bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-purple-primary hover:border-gray-400 transition-colors [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
											placeholder="Re-enter your password"
											autoComplete="new-password"
										/>
										<button
											type="button"
											onClick={() =>
												setShowConfirmPassword(
													!showConfirmPassword
												)
											}
											className="absolute inset-y-0 right-0 top-1 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
										>
											{showConfirmPassword ? (
												<svg
													className="h-5 w-5"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
													strokeWidth={2}
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88"
													/>
												</svg>
											) : (
												<svg
													className="h-5 w-5"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
													strokeWidth={2}
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
													/>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
													/>
												</svg>
											)}
										</button>
									</div>
								</div>

								<div className="flex items-start">
									<div className="flex items-center h-5">
										<input
											id="terms"
											name="terms"
											type="checkbox"
											checked={acceptedTerms}
											onChange={(e) =>
												setAcceptedTerms(
													e.target.checked
												)
											}
											className="h-4 w-4 text-purple-primary focus:ring-purple-primary border-gray-300 bg-white cursor-pointer"
										/>
									</div>
									<div className="ml-3 text-sm">
										<label
											htmlFor="terms"
											className="font-medium text-gray-700 cursor-pointer font-body"
										>
											I accept the{" "}
											<Link
												href="/terms"
												target="_blank"
												className="text-purple-primary hover:text-purple-700"
											>
												terms and conditions
											</Link>
										</label>
									</div>
								</div>
							</div>

							{error && (
								<div className="text-sm text-center text-red-600 bg-red-50 border border-red-200 p-3 font-body">
									{error}
								</div>
							)}

							<div>
								<button
									type="submit"
									disabled={loading || !acceptedTerms}
									className="w-full h-12 px-4 py-2 text-base font-medium text-white bg-purple-primary hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-body rounded-xl shadow-lg"
								>
									{loading ? (
										<span className="flex items-center justify-center whitespace-nowrap">
											<svg
												className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
											Creating account...
										</span>
									) : (
										"Create account"
									)}
								</button>
							</div>
						</form>
					) : (
						// OTP Verification Form
						<form
							className="mt-8 space-y-6"
							onSubmit={handleOTPVerification}
						>
							<div className="text-center mb-6">
								<h3 className="text-xl font-semibold text-gray-900 font-heading mb-2">
									Verify Your Phone Number
								</h3>
								<p className="text-sm text-gray-600 font-body">
									We've sent a 6-digit verification code to your WhatsApp:{" "}
									<span className="font-semibold">{signupData?.phoneNumber}</span>
								</p>
							</div>

							<div className="space-y-4">
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
											if (otpError) setOtpError(null);
										}}
										className="block w-full h-12 px-4 py-3 text-base font-body bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-purple-primary hover:border-gray-400 transition-colors text-center tracking-widest"
										placeholder="000000"
										autoComplete="one-time-code"
									/>
									{otpError && (
										<p className={`mt-1 text-sm font-body ${
											otpError.includes("sent") ? "text-green-600" : "text-red-600"
										}`}>
											{otpError}
										</p>
									)}
								</div>
							</div>

							<div className="flex flex-col space-y-4">
								<button
									type="submit"
									disabled={otpLoading || otpCode.length !== 6}
									className="w-full h-12 px-4 py-2 text-base font-medium text-white bg-purple-primary hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-body rounded-xl shadow-lg"
								>
									{otpLoading ? (
										<span className="flex items-center justify-center whitespace-nowrap">
											<svg
												className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
										</span>
									) : (
										"Verify Code"
									)}
								</button>

								<div className="text-center">
									<p className="text-sm text-gray-600 font-body">
										Didn't receive the code?{" "}
										<button
											type="button"
											onClick={handleResendOTP}
											disabled={resendLoading}
											className="font-medium text-purple-primary hover:text-purple-700 transition-colors disabled:opacity-50"
										>
											{resendLoading ? "Sending..." : "Resend Code"}
										</button>
									</p>
								</div>

								<div className="text-center">
									<button
										type="button"
										onClick={() => {
											setShowOTPVerification(false);
											setOtpCode("");
											setOtpError(null);
											setSignupData(null);
										}}
										className="text-sm text-gray-500 hover:text-gray-700 transition-colors font-body"
									>
										← Back to Sign Up
									</button>
								</div>
							</div>
						</form>
					)}
					</div>
				</div>
		</div>
	);
}
