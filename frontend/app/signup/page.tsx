"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

			// Store tokens using our utility functions
			TokenStorage.setAccessToken(data.accessToken);
			TokenStorage.setRefreshToken(data.refreshToken);

			// Redirect directly to dashboard instead of onboarding
			router.push("/dashboard");
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "An error occurred"
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			<style jsx global>{`
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
											Creating account...
										</>
									) : (
										"Create account"
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
