"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import Logo from "../../components/Logo";
import Cookies from "js-cookie";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

interface CountryData {
	countryCode: string;
	dialCode: string;
	format: string;
	name: string;
}

export default function LoginPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
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

	useEffect(() => {
		const message = searchParams.get("message");
		if (message) {
			setMessage(message);
		}
	}, [searchParams]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);
		setMessage(null);
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

			// Store tokens in localStorage
			localStorage.setItem("token", data.accessToken);
			localStorage.setItem("refreshToken", data.refreshToken);

			// Store tokens in cookies
			Cookies.set("token", data.accessToken, { expires: 1 }); // 1 day
			Cookies.set("refreshToken", data.refreshToken, { expires: 7 }); // 7 days

			console.log("Login - Successful, redirecting to appropriate page");

			// Check for redirect parameter
			const redirect = searchParams.get("redirect");
			if (redirect) {
				// Decode the redirect URL if it's encoded
				const decodedRedirect = decodeURIComponent(redirect);
				console.log("Login - Redirecting to:", decodedRedirect);
				router.push(decodedRedirect);
			} else {
				// Redirect based on onboarding status
				if (data.isOnboardingComplete) {
					router.push("/dashboard");
				} else {
					router.push("/onboarding");
				}
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
							Welcome back
						</h2>
						<p className="mt-2 text-center text-sm text-gray-600">
							New to Kapital?{" "}
							<Link
								href="/signup"
								className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
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
								<div className="flex items-center justify-between">
									<label
										htmlFor="password"
										className="block text-sm font-medium text-gray-700"
									>
										Password
									</label>
									<Link
										href="/forgot-password"
										className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
									>
										Forgot password?
									</Link>
								</div>
								<input
									id="password"
									name="password"
									type="password"
									required
									className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
