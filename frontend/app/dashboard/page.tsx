"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import PieChart from "@/components/PieChart";
import CreditScoreGauge from "@/components/CreditScoreGauge";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import {
	TokenStorage,
	fetchWithTokenRefresh,
	checkAuth,
} from "@/lib/authUtils";

export default function DashboardPage() {
	const router = useRouter();
	const [userName, setUserName] = useState<string>("");
	const [bankConnected, setBankConnected] = useState<boolean>(false);
	const [incompleteApplications, setIncompleteApplications] = useState<any[]>(
		[]
	);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		const checkAuthAndLoadData = async () => {
			try {
				// Use the checkAuth utility to verify authentication
				const isAuthenticated = await checkAuth();

				if (!isAuthenticated) {
					console.log(
						"Dashboard - Auth check failed, redirecting to login"
					);
					router.push("/login");
					return;
				}

				// Fetch user data with automatic token refresh
				const data = await fetchWithTokenRefresh<any>("/api/users/me");
				console.log("Dashboard - Auth check data:", data);

				if (!data?.isOnboardingComplete) {
					console.log(
						"Dashboard - User has not completed onboarding, redirecting to onboarding"
					);
					router.push("/onboarding");
					return;
				}

				// Set bank connection status from the response data
				setBankConnected(Boolean(data.bankName && data.accountNumber));

				// Set user name from the response data
				console.log("User data for name extraction:", {
					firstName: data.firstName,
					fullName: data.fullName,
					allData: data,
				});

				if (data.firstName) {
					setUserName(data.firstName);
					console.log(
						"Setting userName to firstName:",
						data.firstName
					);
				} else if (data.fullName) {
					const firstPart = data.fullName.split(" ")[0];
					setUserName(firstPart);
					console.log(
						"Setting userName to first part of fullName:",
						firstPart
					);
				} else {
					// If no name is available, use a generic greeting
					setUserName("Guest");
					console.log("Setting userName to Guest (no name found)");
				}

				// Fetch incomplete applications
				fetchIncompleteApplications();
			} catch (error) {
				console.error("Dashboard - Auth check error:", error);
				router.push("/login");
			} finally {
				setLoading(false);
			}
		};

		checkAuthAndLoadData();
	}, [router]);

	const fetchIncompleteApplications = async () => {
		try {
			// Use fetchWithTokenRefresh for API calls
			const data = await fetchWithTokenRefresh<any[]>(
				"/api/loan-applications"
			);

			// Filter for incomplete and pending applications
			const filteredApps = data.filter((app: any) =>
				[
					"INCOMPLETE",
					"PENDING_APP_FEE",
					"PENDING_KYC",
					"PENDING_APPROVAL",
					"APPROVED",
					"REJECTED",
				].includes(app.status)
			);
			setIncompleteApplications(filteredApps);
		} catch (error) {
			console.error("Error fetching incomplete applications:", error);
		}
	};

	const getApplicationStatusLabel = (status: string) => {
		switch (status) {
			case "INCOMPLETE":
				return "Incomplete";
			case "PENDING_APP_FEE":
				return "Pending Fee";
			case "PENDING_KYC":
				return "Pending KYC";
			case "PENDING_APPROVAL":
				return "Under Review";
			case "APPROVED":
				return "Approved";
			case "REJECTED":
				return "Rejected";
			case "DISBURSED":
				return "Disbursed";
			case "CLOSED":
				return "Closed";
			default:
				return status;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "INCOMPLETE":
				return "bg-yellow-100 text-yellow-800";
			case "PENDING_APP_FEE":
			case "PENDING_KYC":
			case "PENDING_APPROVAL":
				return "bg-blue-100 text-blue-800";
			case "APPROVED":
				return "bg-green-100 text-green-800";
			case "REJECTED":
				return "bg-red-100 text-red-800";
			case "DISBURSED":
				return "bg-purple-100 text-purple-800";
			case "CLOSED":
				return "bg-gray-100 text-gray-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-MY", {
			style: "currency",
			currency: "MYR",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-MY", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	};

	return (
		<DashboardLayout userName={userName}>
			<div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
				{/* Wallet Card */}
				{/* <div className="break-inside-avoid bg-white rounded-lg shadow-sm border border-gray-200 p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium text-gray-900">
							Wallet
						</h2>
						<Link
							href="/dashboard/wallet"
							className="text-sm text-indigo-600 hover:text-indigo-500 inline-flex items-center"
						>
							View details
							<ArrowRightIcon className="ml-1 h-4 w-4" />
						</Link>
					</div>
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm text-gray-500">
								Bank Account
							</span>
							{bankConnected ? (
								<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
									Connected
								</span>
							) : (
								<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
									Not Setup
								</span>
							)}
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-gray-500">
								Available Balance
							</span>
							<span className="text-lg font-medium text-gray-900">
								$0.00
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-gray-500">
								Available for Withdrawal
							</span>
							<span className="text-sm text-gray-900">$0.00</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-gray-500">
								Total Deposits
							</span>
							<span className="text-sm text-gray-900">$0.00</span>
						</div>
					</div>
				</div> */}

				{/* Credit Score Card */}
				{/* <div className="break-inside-avoid bg-white rounded-lg shadow-sm border border-gray-200 p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium text-gray-900">
							Credit Score
						</h2>
						<Link
							href="/dashboard/credit-score"
							className="text-sm text-indigo-600 hover:text-indigo-500 inline-flex items-center"
						>
							View details
							<ArrowRightIcon className="ml-1 h-4 w-4" />
						</Link>
					</div>
					<div className="space-y-4">
						<div className="flex flex-col items-center">
							<CreditScoreGauge score={600} size={240} />
							<div className="mt-4 grid grid-cols-5 gap-1 w-full text-xs text-center">
								<div>
									<div className="h-2 bg-[#FF4B4B] rounded"></div>
									<span className="text-gray-600">Poor</span>
								</div>
								<div>
									<div className="h-2 bg-[#FF9447] rounded"></div>
									<span className="text-gray-600">Fair</span>
								</div>
								<div>
									<div className="h-2 bg-[#FFD700] rounded"></div>
									<span className="text-gray-600">Good</span>
								</div>
								<div>
									<div className="h-2 bg-[#90EE90] rounded"></div>
									<span className="text-gray-600">
										Very Good
									</span>
								</div>
								<div>
									<div className="h-2 bg-[#00C49F] rounded"></div>
									<span className="text-gray-600">
										Excellent
									</span>
								</div>
							</div>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-gray-500">
								Last Updated
							</span>
							<span className="text-sm text-gray-900">Never</span>
						</div>
						<button className="w-full mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
							Get Latest Report
						</button>
					</div>
				</div> */}

				{/* Active Loans Card */}
				<div className="break-inside-avoid bg-white rounded-lg shadow-sm border border-gray-200 p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium text-gray-900">
							Active Loans
						</h2>
						<Link
							href="/dashboard/loans"
							className="text-sm text-indigo-600 hover:text-indigo-500 inline-flex items-center"
						>
							View all
							<ArrowRightIcon className="ml-1 h-4 w-4" />
						</Link>
					</div>
					<div className="flex justify-center mb-6">
						<PieChart borrowed={1000} repaid={0} size={120} />
					</div>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<span className="text-sm text-gray-500">
								Total Borrowed
							</span>
							<span className="text-lg font-medium text-gray-900">
								$0.00
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-gray-500">
								Total Outstanding
							</span>
							<span className="text-lg font-medium text-gray-900">
								$0.00
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-gray-500">
								Next Payment Due
							</span>
							<span className="text-sm text-gray-900">
								No active loans
							</span>
						</div>
					</div>
				</div>

				{/* Recent Transactions Card */}
				<div className="break-inside-avoid bg-white rounded-lg shadow-sm border border-gray-200 p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium text-gray-900">
							Recent Transactions
						</h2>
						<Link
							href="/dashboard/transactions"
							className="text-sm text-indigo-600 hover:text-indigo-500 inline-flex items-center"
						>
							View all
							<ArrowRightIcon className="ml-1 h-4 w-4" />
						</Link>
					</div>
					<div className="space-y-4">
						<p className="text-sm text-gray-500">
							No recent transactions
						</p>
					</div>
				</div>

				{/* Application Status Card */}
				<div className="break-inside-avoid bg-white rounded-lg shadow-sm border border-gray-200 p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium text-gray-900">
							Application Status
						</h2>
						<Link
							href="/dashboard/applications"
							className="text-sm text-indigo-600 hover:text-indigo-500 inline-flex items-center"
						>
							View all
							<ArrowRightIcon className="ml-1 h-4 w-4" />
						</Link>
					</div>
					<p className="text-xs text-gray-500 mb-4">
						Showing your 3 most recent applications.
					</p>
					<div className="space-y-4">
						{loading ? (
							<div className="text-center py-4">
								<div
									className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
									role="status"
								>
									<span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
										Loading...
									</span>
								</div>
							</div>
						) : incompleteApplications.length > 0 ? (
							<div className="space-y-4">
								{incompleteApplications
									.slice(0, 3)
									.map((app) => (
										<div
											key={app.id}
											className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
										>
											<div>
												<p className="font-medium text-gray-900">
													{app.product?.name ||
														"Unnamed Product"}
												</p>
												{app.status === "INCOMPLETE" ? (
													<p className="text-xs text-gray-500">
														Step {app.appStep} of 5
													</p>
												) : (
													<div className="space-y-1">
														<p className="text-xs text-gray-500">
															{formatCurrency(
																app.amount
															)}
														</p>
														<p className="text-xs text-gray-400">
															Updated{" "}
															{formatDate(
																app.updatedAt
															)}
														</p>
													</div>
												)}
											</div>
											<div className="flex items-center gap-4">
												<span
													className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
														app.status
													)}`}
												>
													{getApplicationStatusLabel(
														app.status
													)}
												</span>
												{app.status ===
													"INCOMPLETE" && (
													<Link
														href={`/dashboard/apply?applicationId=${
															app.id
														}&step=${
															app.appStep
														}&productCode=${
															app.product?.code ||
															""
														}`}
														className="text-indigo-600 hover:text-indigo-900 text-xs font-medium"
													>
														Resume
													</Link>
												)}
											</div>
										</div>
									))}
								{incompleteApplications.length > 3 && (
									<p className="text-xs text-gray-500 text-center">
										Showing latest 3 applications
									</p>
								)}
							</div>
						) : (
							<p className="text-gray-500 text-center py-4">
								No active applications
							</p>
						)}
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
}
