"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Logo from "../../components/Logo";
import { useDocumentTitle } from "@/hooks/use-document-title";
import Cookies from "js-cookie";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { TokenStorage } from "@/lib/authUtils";
import { validatePhoneNumber } from "@/lib/phoneUtils";

interface CountryData {
	countryCode: string;
	dialCode: string;
	format: string;
	name: string;
}

// Create a client component for handling searchParams
function LoginPageContent() {
	useDocumentTitle("Sign In");

	const router = useRouter();
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [phoneNumber, setPhoneNumber] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [phoneError, setPhoneError] = useState<string | null>(null);

	// Example placeholders for different countries
	const placeholders: { [key: string]: string } = {
		my: "+60", // Malaysia
		sg: "+65", // Singapore
		id: "+62", // Indonesia
		th: "+66", // Thailand
	};

	const [placeholder, setPlaceholder] = useState(placeholders["my"]);

	useEffect(() => {
		const message = searchParams.get("message");
		if (message) {
			setMessage(message);
		}
	}, [searchParams]);

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

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);
		setMessage(null);

		// Validate phone number before submission
		const phoneValidation = validatePhoneNumber(phoneNumber, {
			requireMobile: false, // Allow both mobile and landline for login
			allowLandline: true
		});

		if (!phoneValidation.isValid) {
			setPhoneError(phoneValidation.error || "Please enter a valid phone number");
			return;
		}

		setLoading(true);

		const formData = new FormData(e.currentTarget);
		const password = formData.get("password") as string;

		try {
			console.log("Login - Attempting login with:", { phoneNumber });

			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ phoneNumber, password }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Invalid credentials");
			}

			// Store tokens using our utility functions
			TokenStorage.setAccessToken(data.accessToken);
			TokenStorage.setRefreshToken(data.refreshToken);

			console.log("Login - Successful, redirecting to appropriate page");

			// Add a small delay to ensure token storage is complete
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Verify tokens were stored successfully
			let storedAccessToken = TokenStorage.getAccessToken();
			let storedRefreshToken = TokenStorage.getRefreshToken();

			if (!storedAccessToken || !storedRefreshToken) {
				console.error("Login - Token storage failed, retrying...");
				// Retry token storage
				TokenStorage.setAccessToken(data.accessToken);
				TokenStorage.setRefreshToken(data.refreshToken);
				await new Promise((resolve) => setTimeout(resolve, 50));

				// Verify retry was successful
				storedAccessToken = TokenStorage.getAccessToken();
				storedRefreshToken = TokenStorage.getRefreshToken();

				if (!storedAccessToken || !storedRefreshToken) {
					console.error("Login - Token storage failed after retry");
					throw new Error(
						"Failed to store authentication tokens. Please try again."
					);
				}

				console.log("Login - Token storage successful after retry");
			}

			// Check for redirect parameter
			const redirect = searchParams.get("redirect");
			if (redirect) {
				// Decode the redirect URL if it's encoded
				const decodedRedirect = decodeURIComponent(redirect);
				console.log("Login - Redirecting to:", decodedRedirect);

				// Use window.location for more reliable redirect with auth state
				window.location.href = decodedRedirect;
			} else {
				// Always redirect to dashboard
				window.location.href = "/dashboard";
			}
		} catch (error) {
			console.error("Login - Error:", error);
			setError(
				error instanceof Error ? error.message : "Invalid credentials"
			);
		} finally {
			setLoading(false);
		}
	};

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
					box-shadow: 0 0 0 2px #7c3aed;
				}
				.phone-input-wrapper:focus-within
					.react-tel-input
					.flag-dropdown,
				.phone-input-wrapper:focus-within
					.react-tel-input
					.form-control {
					border-color: #7c3aed !important;
				}

				/* Remove all border radius from phone input */
				.react-tel-input,
				.react-tel-input > div,
				.react-tel-input .flag-dropdown,
				.react-tel-input .form-control {
					border-radius: 0 !important;
				}

				.react-tel-input .flag-dropdown {
					background-color: white !important;
					border-color: rgb(209, 213, 219) !important;
				}
				.react-tel-input .flag-dropdown:hover {
					background-color: rgb(249, 250, 251) !important;
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
				.react-tel-input .country-list .country:hover {
					background-color: rgba(124, 58, 237, 0.1) !important;
					color: #7c3aed !important;
				}
				.react-tel-input .country-list .country.highlight {
					background-color: rgba(124, 58, 237, 0.2) !important;
					color: #7c3aed !important;
				}
			`}</style>
			<div className="min-h-screen flex flex-col items-center justify-center bg-offwhite py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
				{/* Background decorative elements */}
				<div className="absolute inset-0 overflow-hidden">
					<div className="absolute -top-40 -right-32 w-80 h-80 rounded-full bg-gradient-to-br from-purple-primary/10 to-blue-tertiary/10 blur-3xl"></div>
					<div className="absolute -bottom-40 -left-32 w-80 h-80 rounded-full bg-gradient-to-br from-blue-tertiary/10 to-purple-primary/10 blur-3xl"></div>
				</div>

				<div className="max-w-md w-full relative z-10">
					<button
						onClick={() => router.back()}
						className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors font-body"
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
								Welcome back
							</h2>
							<p className="mt-2 text-center text-sm text-gray-600 font-body">
								New to Kapital?{" "}
								<Link
									href="/signup"
									className="font-medium text-purple-primary hover:text-purple-600 transition-colors"
								>
									Create an account
								</Link>
							</p>
						</div>

						{message && (
							<div className="text-sm text-center text-green-600 bg-green-50 border border-green-200 rounded-md p-3">
								{message}
							</div>
						)}

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
											dropdownClass="!bg-white !border-gray-300 !text-gray-900 !shadow-xl !rounded-lg !mt-1 !max-h-60 !overflow-y-auto !min-w-72"
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
									<div className="flex items-center justify-between">
										<label
											htmlFor="password"
											className="block text-sm font-medium text-gray-700 font-body"
										>
											Password
										</label>
										<Link
											href="/forgot-password"
											className="text-sm font-medium text-purple-primary hover:text-purple-600 transition-colors"
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
											className="mt-1 block w-full h-12 px-4 py-3 pr-12 text-base font-body bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-purple-primary hover:border-gray-400 transition-colors [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
											placeholder="Enter your password"
											autoComplete="current-password"
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
							</div>

							{error && (
								<div className="text-sm text-center text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
									{error}
								</div>
							)}

							<div>
								<button
									type="submit"
									disabled={loading}
									className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-purple-primary hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
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

export default function LoginPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<LoginPageContent />
		</Suspense>
	);
}
