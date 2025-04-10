"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Logo from "../components/Logo";
import { AdminTokenStorage } from "../../lib/authUtils";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

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
		<div className="text-sm text-center text-green-600 bg-green-50 border border-green-200 rounded-md p-3">
			{message}
		</div>
	);
}

export default function AdminLoginPage() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
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
				throw new Error(data.error || "Invalid credentials");
			}

			// Check if user is an admin
			if (data.role !== "ADMIN") {
				throw new Error("Access denied. Admin privileges required.");
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

			console.log("Admin Login - Successful, redirecting to dashboard");

			// Add a small delay to ensure token storage is complete before navigation
			setTimeout(() => {
				// Redirect to admin dashboard
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
							Admin Login
						</h2>
						<p className="mt-2 text-center text-sm text-gray-600">
							Access the admin dashboard
						</p>
					</div>

					{/* Wrap the component using searchParams in Suspense boundary */}
					<Suspense fallback={<div className="h-10"></div>}>
						<LoginMessage />
					</Suspense>

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
									onChange={(
										value: string,
										data: CountryData
									) => {
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
									inputClass="!w-full !h-10 !py-2 !text-base !border-gray-300 focus:!ring-purple-500 focus:!border-purple-500"
									buttonClass="!border-gray-300 !bg-white hover:!bg-gray-50"
									dropdownClass="!bg-white"
									searchClass="!bg-white"
									enableSearch
									disableSearchIcon
									searchPlaceholder="Search country..."
								/>
							</div>

							<div>
								<div className="flex items-center justify-between">
									<label
										htmlFor="password"
										className="block text-sm font-medium text-gray-700"
									>
										Password
									</label>
									<Link
										href="/forgot-password"
										className="text-sm font-medium text-purple-600 hover:text-purple-500"
									>
										Forgot password?
									</Link>
								</div>
								<input
									id="password"
									name="password"
									type="password"
									required
									className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
									placeholder="Enter your password"
								/>
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
								className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
	);
}
