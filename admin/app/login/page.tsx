"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Logo from "../components/Logo";
import { AdminTokenStorage } from "../../lib/authUtils";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import AdminOTPVerification from "../../components/AdminOTPVerification";

interface CountryData {
	countryCode: string;
	dialCode: string;
	format: string;
	name: string;
}

// Create a separate component for handling searchParams
function LoginMessage() {
	const searchParams = useSearchParams();
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		const urlMessage = searchParams?.get("message");
		if (urlMessage) {
			setMessage(urlMessage);
		}
	}, [searchParams]);

	if (!message) return null;

	return (
		<div className="text-sm text-center text-green-300 bg-green-900/20 border border-green-700/30 rounded-md p-3">
			{message}
		</div>
	);
}

export default function AdminLoginPage() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [phoneNumber, setPhoneNumber] = useState("");
	const [showPassword, setShowPassword] = useState(false);

	// OTP verification states
	const [showOTPVerification, setShowOTPVerification] = useState(false);
	const [userDataForOTP, setUserDataForOTP] = useState<{
		phoneNumber: string;
		userId: string;
	} | null>(null);

	// Example placeholders for different countries
	const placeholders: { [key: string]: string } = {
		my: "+60", // Malaysia
		sg: "+65", // Singapore
		id: "+62", // Indonesia
		th: "+66", // Thailand
	};

	const [placeholder, setPlaceholder] = useState(placeholders["my"]);

	const handleOTPSuccess = (data: {
		accessToken: string;
		refreshToken: string;
		userId: string;
		phoneNumber: string;
		isOnboardingComplete: boolean;
		onboardingStep: number;
		role?: string;
	}) => {
		// Verify admin privileges
		if (data.role && data.role !== "ADMIN" && data.role !== "ATTESTOR") {
			setError("Access denied. Admin or Attestor privileges required.");
			setShowOTPVerification(false);
			setUserDataForOTP(null);
			return;
		}

		// Store tokens using AdminTokenStorage
		AdminTokenStorage.setAccessToken(data.accessToken);
		AdminTokenStorage.setRefreshToken(data.refreshToken);

		console.log("Admin OTP - Verification successful, redirecting to dashboard");
		
		// Redirect to dashboard
		router.push("/dashboard");
	};

	const handleBackToLogin = () => {
		setShowOTPVerification(false);
		setUserDataForOTP(null);
		setError(null);
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		const formData = new FormData(e.currentTarget);
		const password = formData.get("password") as string;

		try {
			console.log("Admin Login - Attempting login with:", {
				phoneNumber,
			});

			const response = await fetch("/api/admin/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ phoneNumber, password }),
			});

		console.log("Admin Login - Response status:", response.status);
		const data = await response.json();
		console.log("Admin Login - Response data:", data);

		if (!response.ok) {
			// Check if this is a phone verification required error
			if (response.status === 403 && data.requiresPhoneVerification) {
				console.log("Admin Login - Phone verification required, showing OTP verification");
				
				// Show OTP verification screen
				setUserDataForOTP({
					phoneNumber: data.phoneNumber || phoneNumber,
					userId: data.userId
				});
				setShowOTPVerification(true);
				return;
			}
			
			throw new Error(data.error || "Invalid credentials");
		}

			// Check if user has admin panel access (ADMIN or ATTESTOR)
			if (data.role !== "ADMIN" && data.role !== "ATTESTOR") {
				throw new Error("Access denied. Admin or Attestor privileges required.");
			}

			console.log("Admin Login - Storing tokens");
			// Use AdminTokenStorage to store tokens with proper expiration
			AdminTokenStorage.setAccessToken(data.accessToken);
			AdminTokenStorage.setRefreshToken(data.refreshToken);

			// Verify tokens were properly stored
			const storedAccessToken = AdminTokenStorage.getAccessToken();
			const storedRefreshToken = AdminTokenStorage.getRefreshToken();

			console.log("Admin Login - Tokens stored:", {
				accessToken: !!storedAccessToken,
				refreshToken: !!storedRefreshToken,
			});

			console.log("Admin Login - Successful, redirecting based on role:", data.role);

			// Add a small delay to ensure token storage is complete before navigation
			setTimeout(() => {
				// Both ADMIN and ATTESTOR users go to main dashboard
				// Role-based filtering will handle what they can see
				router.push("/dashboard");
			}, 100);
		} catch (error) {
			console.error("Admin Login - Error:", error);
			if (error instanceof Error) {
				setError(error.message);
			} else if (error instanceof Response) {
				const data = await error.json();
				setError(data.error || "Failed to authenticate");
			} else {
				setError("An unexpected error occurred");
			}
		} finally {
			setLoading(false);
		}
	};

	// Show OTP verification if needed
	if (showOTPVerification && userDataForOTP) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
				{/* Background decorative elements */}
				<div className="absolute inset-0 overflow-hidden">
					<div className="absolute -top-40 -right-32 w-80 h-80 rounded-full bg-gradient-to-br from-blue-600/10 to-purple-600/10 blur-3xl"></div>
					<div className="absolute -bottom-40 -left-32 w-80 h-80 rounded-full bg-gradient-to-br from-purple-600/10 to-blue-600/10 blur-3xl"></div>
				</div>

				<div className="max-w-md w-full relative z-10">
					<div className="mb-6">
						<Logo
							size="lg"
							variant="black"
							linkTo={undefined}
						/>
					</div>

					<AdminOTPVerification
						phoneNumber={userDataForOTP.phoneNumber}
						onVerificationSuccess={handleOTPSuccess}
						onBack={handleBackToLogin}
						title="Admin Verification Required"
						description="For security, please verify your phone number. We've sent a verification code to your WhatsApp"
					/>
				</div>
			</div>
		);
	}

	return (
		<>
			<style jsx global>{`
				/* Remove all shadows and focus styles from phone input */
				.react-tel-input *,
				.react-tel-input *:before,
				.react-tel-input *:after,
				.react-tel-input .flag-dropdown,
				.react-tel-input .form-control,
				.react-tel-input .selected-flag {
					outline: none !important;
					box-shadow: none !important;
					-webkit-box-shadow: none !important;
					-moz-box-shadow: none !important;
				}
				.react-tel-input .flag-dropdown:focus,
				.react-tel-input .form-control:focus,
				.react-tel-input .selected-flag:focus,
				.react-tel-input .flag-dropdown:hover,
				.react-tel-input .form-control:hover,
				.react-tel-input .selected-flag:hover,
				.react-tel-input .flag-dropdown:active,
				.react-tel-input .form-control:active,
				.react-tel-input .selected-flag:active {
					outline: none !important;
					box-shadow: none !important;
					-webkit-box-shadow: none !important;
					-moz-box-shadow: none !important;
				}

				/* Style the container wrapper */
				.phone-input-wrapper {
					border-radius: 0;
					transition: all 0.2s;
					position: relative;
				}
				.phone-input-wrapper:focus-within {
					box-shadow: 0 0 0 2px rgb(59 130 246 / 0.5);
				}
				.phone-input-wrapper:focus-within
					.react-tel-input
					.flag-dropdown,
				.phone-input-wrapper:focus-within
					.react-tel-input
					.form-control {
					border-color: rgb(59 130 246) !important;
				}

				/* Remove all border radius from phone input */
				.react-tel-input,
				.react-tel-input > div,
				.react-tel-input .flag-dropdown,
				.react-tel-input .form-control {
					border-radius: 0.375rem !important;
				}

				.react-tel-input .flag-dropdown {
					background-color: rgb(55 65 81) !important;
					border-color: rgb(75 85 99) !important;
					color: rgb(229 231 235) !important;
				}
				.react-tel-input .flag-dropdown:hover {
					background-color: rgb(75 85 99) !important;
				}
				.react-tel-input .selected-flag {
					background-color: transparent !important;
					width: 100% !important;
					height: 100% !important;
					display: flex !important;
					align-items: center !important;
					justify-content: center !important;
					padding: 0 !important;
					border: none !important;
				}
				.react-tel-input .selected-flag:hover {
					background-color: transparent !important;
				}
				.react-tel-input .country-list {
					background-color: rgb(55 65 81) !important;
					border-color: rgb(75 85 99) !important;
				}
				.react-tel-input .country-list .country {
					background-color: rgb(55 65 81) !important;
					color: rgb(229 231 235) !important;
				}
				.react-tel-input .country-list .country:hover {
					background-color: rgb(59 130 246 / 0.1) !important;
					color: rgb(147 197 253) !important;
				}
				.react-tel-input .country-list .country.highlight {
					background-color: rgb(59 130 246 / 0.2) !important;
					color: rgb(147 197 253) !important;
				}
				.react-tel-input .search-box {
					background-color: rgb(55 65 81) !important;
					border-color: rgb(75 85 99) !important;
					color: rgb(229 231 235) !important;
				}
				.react-tel-input .search-box::placeholder {
					color: rgb(156 163 175) !important;
				}
			`}</style>
			<div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
				{/* Background decorative elements */}
				<div className="absolute inset-0 overflow-hidden">
					<div className="absolute -top-40 -right-32 w-80 h-80 rounded-full bg-gradient-to-br from-blue-600/10 to-purple-600/10 blur-3xl"></div>
					<div className="absolute -bottom-40 -left-32 w-80 h-80 rounded-full bg-gradient-to-br from-purple-600/10 to-blue-600/10 blur-3xl"></div>
				</div>

				<div className="max-w-md w-full relative z-10">
					<button
						onClick={() => router.back()}
						className="mb-4 flex items-center text-sm text-gray-400 hover:text-gray-200 transition-colors font-body"
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

					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-xl p-8 space-y-8">
						<div className="flex flex-col items-center">
							<div className="mb-6">
								<Logo
									size="lg"
									variant="black"
									linkTo={undefined}
								/>
							</div>
							<h2 className="text-center text-3xl font-extrabold text-white font-heading">
								Admin Login
							</h2>
							<p className="mt-2 text-center text-sm text-gray-400 font-body">
								Access the admin dashboard
							</p>
						</div>

						{/* Wrap the component using searchParams in Suspense boundary */}
						<Suspense fallback={<div className="h-10"></div>}>
							<LoginMessage />
						</Suspense>

						<form
							className="mt-8 space-y-6"
							onSubmit={handleSubmit}
						>
							<div className="space-y-4">
								<div>
									<label
										htmlFor="phoneNumber"
										className="block text-sm font-medium text-gray-300 mb-1 font-body"
									>
										Phone Number
									</label>
									<div className="phone-input-wrapper">
										<PhoneInput
											country="my"
											value={phoneNumber}
											onChange={(
												value: string,
												data: CountryData
											) => {
												setPhoneNumber(value);
												setPlaceholder(
													placeholders[
														data.countryCode
													] || "1234 5678"
												);
											}}
											inputProps={{
												id: "phoneNumber",
												name: "phoneNumber",
												required: true,
												placeholder: placeholder,
											}}
											containerClass="!w-full"
											inputClass="!w-full !h-12 !pl-20 !pr-4 !py-3 !text-base !font-body !bg-gray-700 !border !border-gray-600 !text-gray-100 !placeholder-gray-400 hover:!border-gray-500 focus:!border-blue-500 !transition-colors"
											buttonClass="!h-12 !w-16 !border !border-gray-600 !bg-gray-700 hover:!bg-gray-600 !text-gray-300 !transition-colors !border-r-0"
											dropdownClass="!bg-gray-700 !border-gray-600 !text-gray-100 !shadow-xl !rounded-lg !mt-1 !max-h-60 !overflow-y-auto !min-w-72"
											searchClass="!bg-gray-700 !border-gray-600 !text-gray-100 !placeholder-gray-400"
											enableSearch
											disableSearchIcon
											searchPlaceholder="Search country..."
										/>
									</div>
								</div>

								<div>
									<div className="flex items-center justify-between">
										<label
											htmlFor="password"
											className="block text-sm font-medium text-gray-300 font-body"
										>
											Password
										</label>
										<Link
											href="/forgot-password"
											className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
										>
											Forgot password?
										</Link>
									</div>
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
											className="mt-1 block w-full h-12 px-4 py-3 pr-12 text-base font-body bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-500 transition-colors rounded-md [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
											placeholder="Enter your password"
											autoComplete="current-password"
										/>
										<button
											type="button"
											onClick={() =>
												setShowPassword(!showPassword)
											}
											className="absolute inset-y-0 right-0 top-1 flex items-center pr-3 text-gray-400 hover:text-gray-200 transition-colors"
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
							</div>

							{error && (
								<div className="text-sm text-center text-red-300 bg-red-900/20 border border-red-700/30 rounded-md p-3">
									{error}
								</div>
							)}

							<div>
								<button
									type="submit"
									disabled={loading}
									className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
								>
									{loading ? (
										<>
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
											Signing in...
										</>
									) : (
										"Sign in"
									)}
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		</>
	);
}
