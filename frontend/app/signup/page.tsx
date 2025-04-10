"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Logo from "../../components/Logo";
import Cookies from "js-cookie";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { TokenStorage } from "@/lib/authUtils";

interface CountryData {
	countryCode: string;
	dialCode: string;
	format: string;
	name: string;
}

export default function SignupPage() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [acceptedTerms, setAcceptedTerms] = useState(false);
	const [phoneNumber, setPhoneNumber] = useState("");

	// Example placeholders for different countries
	const placeholders: { [key: string]: string } = {
		my: "1234 5678", // Malaysia
		sg: "8123 4567", // Singapore
		id: "812 345 678", // Indonesia
		th: "81 234 5678", // Thailand
	};

	const [placeholder, setPlaceholder] = useState(placeholders["my"]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);

		if (!acceptedTerms) {
			setError("Please accept the terms and conditions to continue");
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
				throw new Error(data.error || "Failed to create account");
			}

			// Store tokens using our utility functions
			TokenStorage.setAccessToken(data.accessToken);
			TokenStorage.setRefreshToken(data.refreshToken);

			// Always redirect to onboarding for new users
			router.push("/onboarding");
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "An error occurred"
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full">
				<button
					onClick={() => router.back()}
					className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
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

				<div className="bg-white rounded-xl shadow-lg p-8 space-y-8">
					<div className="flex flex-col items-center">
						<div className="w-32 mb-6">
							<Logo />
						</div>
						<h2 className="text-center text-3xl font-extrabold text-gray-900">
							Create your account
						</h2>
						<p className="mt-2 text-center text-sm text-gray-600">
							Already have an account?{" "}
							<Link
								href="/login"
								className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
							>
								Sign in
							</Link>
						</p>
					</div>

					<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
						<div className="space-y-4">
							<div>
								<label
									htmlFor="phoneNumber"
									className="block text-sm font-medium text-gray-700 mb-1"
								>
									Phone Number
								</label>
								<PhoneInput
									country="my"
									value={phoneNumber}
									onChange={(value, data: CountryData) => {
										setPhoneNumber(value);
										setPlaceholder(
											placeholders[data.countryCode] ||
												"1234 5678"
										);
									}}
									inputProps={{
										id: "phoneNumber",
										name: "phoneNumber",
										required: true,
										placeholder: placeholder,
									}}
									containerClass="!w-full"
									inputClass="!w-full !h-10 !py-2 !text-base !border-gray-300 focus:!ring-indigo-500 focus:!border-indigo-500"
									buttonClass="!border-gray-300 !bg-white hover:!bg-gray-50"
									dropdownClass="!bg-white"
									searchClass="!bg-white"
									enableSearch
									disableSearchIcon
									searchPlaceholder="Search country..."
								/>
							</div>

							<div>
								<label
									htmlFor="password"
									className="block text-sm font-medium text-gray-700"
								>
									Password
								</label>
								<input
									id="password"
									name="password"
									type="password"
									required
									minLength={8}
									className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
									placeholder="Min. 8 characters"
								/>
							</div>

							<div>
								<label
									htmlFor="confirmPassword"
									className="block text-sm font-medium text-gray-700"
								>
									Confirm Password
								</label>
								<input
									id="confirmPassword"
									name="confirmPassword"
									type="password"
									required
									minLength={8}
									className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
									placeholder="Re-enter your password"
								/>
							</div>

							<div className="flex items-start">
								<div className="flex items-center h-5">
									<input
										id="terms"
										name="terms"
										type="checkbox"
										checked={acceptedTerms}
										onChange={(e) =>
											setAcceptedTerms(e.target.checked)
										}
										className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
									/>
								</div>
								<div className="ml-3 text-sm">
									<label
										htmlFor="terms"
										className="font-medium text-gray-700 cursor-pointer"
									>
										I accept the{" "}
										<Link
											href="/terms"
											className="text-indigo-600 hover:text-indigo-500"
										>
											terms and conditions
										</Link>
									</label>
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
								disabled={loading || !acceptedTerms}
								className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
	);
}
