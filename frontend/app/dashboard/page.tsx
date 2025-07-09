"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import PieChart from "@/components/PieChart";
import CreditScoreGauge from "@/components/CreditScoreGauge";
import {
	ArrowRightIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	ArrowUpIcon,
	ArrowDownIcon,
	WalletIcon,
	CreditCardIcon,
	CheckCircleIcon,
	ClockIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
	TokenStorage,
	fetchWithTokenRefresh,
	checkAuth,
} from "@/lib/authUtils";

interface WalletData {
	balance: number;
	availableForWithdrawal: number;
	totalDeposits: number;
	totalWithdrawals: number;
	totalDisbursed: number;
	pendingTransactions: number;
	bankConnected: boolean;
	bankName?: string;
	accountNumber?: string;
}

export default function DashboardPage() {
	const router = useRouter();
	const [userName, setUserName] = useState<string>("");
	const [walletData, setWalletData] = useState<WalletData>({
		balance: 0,
		availableForWithdrawal: 0,
		totalDeposits: 0,
		totalWithdrawals: 0,
		totalDisbursed: 0,
		pendingTransactions: 0,
		bankConnected: false,
	});
	const [incompleteApplications, setIncompleteApplications] = useState<any[]>(
		[]
	);
	const [loans, setLoans] = useState<any[]>([]);
	const [loanSummary, setLoanSummary] = useState<any>({
		totalOutstanding: 0,
		totalBorrowed: 0,
		totalRepaid: 0,
		nextPaymentDue: null,
		nextPaymentAmount: 0,
	});
	const [transactions, setTransactions] = useState<any[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [currentNotificationIndex, setCurrentNotificationIndex] =
		useState<number>(0);

	useEffect(() => {
		const checkAuthAndLoadData = async () => {
			try {
				// First check if we have any tokens at all
				const accessToken = TokenStorage.getAccessToken();
				const refreshToken = TokenStorage.getRefreshToken();

				// If no tokens available, immediately redirect to login
				if (!accessToken && !refreshToken) {
					console.log(
						"Dashboard - No tokens available, redirecting to login"
					);
					router.push("/login");
					return;
				}

				// Use the checkAuth utility to verify authentication
				const isAuthenticated = await checkAuth();

				if (!isAuthenticated) {
					console.log(
						"Dashboard - Auth check failed, redirecting to login"
					);
					// Clear any invalid tokens
					TokenStorage.clearTokens();
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

				// Load wallet data
				fetchWalletData();

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

				// Fetch incomplete applications and loans
				fetchIncompleteApplications();
				fetchLoans();
				fetchLoanSummary();
				fetchTransactions();
			} catch (error) {
				console.error("Dashboard - Auth check error:", error);
				// Clear any invalid tokens and redirect to login
				TokenStorage.clearTokens();
				router.push("/login");
			} finally {
				setLoading(false);
			}
		};

		checkAuthAndLoadData();
	}, [router]);

	const fetchWalletData = async () => {
		try {
			const data = await fetchWithTokenRefresh<
				WalletData & { loanSummary: any }
			>("/api/wallet");
			if (data) {
				setWalletData({
					balance: data.balance,
					availableForWithdrawal: data.availableForWithdrawal,
					totalDeposits: data.totalDeposits,
					totalWithdrawals: data.totalWithdrawals,
					totalDisbursed: data.totalDisbursed || 0,
					pendingTransactions: data.pendingTransactions,
					bankConnected: data.bankConnected,
					bankName: data.bankName,
					accountNumber: data.accountNumber,
				});
			}
		} catch (error) {
			console.error("Error fetching wallet data:", error);
		}
	};

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
					"PENDING_ATTESTATION",
					"REJECTED",
				].includes(app.status)
			);
			setIncompleteApplications(filteredApps);
		} catch (error) {
			console.error("Error fetching incomplete applications:", error);
		}
	};

	const fetchLoans = async () => {
		try {
			const data = await fetchWithTokenRefresh<{ loans: any[] }>(
				"/api/loans"
			);
			if (data?.loans) {
				setLoans(data.loans);
			}
		} catch (error) {
			console.error("Error fetching loans:", error);
		}
	};

	const fetchLoanSummary = async () => {
		try {
			console.log("Dashboard - Fetching loan summary...");
			const data = await fetchWithTokenRefresh<any>("/api/wallet");
			console.log("Dashboard - Wallet API response:", data);
			if (data?.loanSummary) {
				console.log("Dashboard - Loan Summary Data:", data.loanSummary);
				setLoanSummary(data.loanSummary);
			} else {
				console.log("Dashboard - No loan summary in response");
			}
		} catch (error) {
			console.error("Error fetching loan summary:", error);
		}
	};

	const fetchTransactions = async () => {
		try {
			const data = await fetchWithTokenRefresh<any>(
				"/api/wallet/transactions?limit=3"
			);
			if (data?.transactions) {
				setTransactions(data.transactions);
			}
		} catch (error) {
			console.error("Error fetching transactions:", error);
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
				return "bg-yellow-500/20 text-yellow-300 border border-yellow-400/30";
			case "PENDING_APP_FEE":
			case "PENDING_KYC":
			case "PENDING_APPROVAL":
				return "bg-blue-500/20 text-blue-300 border border-blue-400/30";
			case "APPROVED":
				return "bg-green-500/20 text-green-300 border border-green-400/30";
			case "REJECTED":
				return "bg-red-500/20 text-red-300 border border-red-400/30";
			case "DISBURSED":
				return "bg-purple-500/20 text-purple-300 border border-purple-400/30";
			case "CLOSED":
				return "bg-gray-500/20 text-gray-300 border border-gray-400/30";
			default:
				return "bg-gray-500/20 text-gray-300 border border-gray-400/30";
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

	const formatDateTime = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-MY", {
			day: "numeric",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const getTransactionIcon = (type: string) => {
		switch (type) {
			case "DEPOSIT":
			case "LOAN_DISBURSEMENT":
				return <ArrowDownIcon className="h-5 w-5 text-green-400" />;
			case "WITHDRAWAL":
				return <ArrowUpIcon className="h-5 w-5 text-red-400" />;
			case "LOAN_REPAYMENT":
				return (
					<svg
						className="h-5 w-5 text-brand-primary"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M17 8l4 4m0 0l-4 4m4-4H3"
						/>
					</svg>
				);
			default:
				return <WalletIcon className="h-5 w-5 text-gray-400" />;
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "APPROVED":
				return (
					<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-300 border border-green-400/30">
						<CheckCircleIcon className="h-3 w-3 mr-1" />
						Approved
					</span>
				);
			case "PENDING":
				return (
					<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-400/30">
						<ClockIcon className="h-3 w-3 mr-1" />
						Pending
					</span>
				);
			case "REJECTED":
				return (
					<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-400/30">
						<ExclamationTriangleIcon className="h-3 w-3 mr-1" />
						Rejected
					</span>
				);
			default:
				return null;
		}
	};

	// Calculate next payment info from loans data (including late fees)
	const calculateNextPaymentInfo = () => {
		if (!loans || loans.length === 0) {
			return {
				amount: 0,
				isOverdue: false,
				includesLateFees: false,
				description: "No payments due",
				dueDate: null,
			};
		}

		// Find the loan with the most urgent next payment
		let nextPayment = null;
		let earliestDueDate = null;

		for (const loan of loans) {
			if (loan.nextPaymentInfo && loan.nextPaymentInfo.amount > 0) {
				const dueDate = loan.nextPaymentInfo.dueDate
					? new Date(loan.nextPaymentInfo.dueDate)
					: null;

				if (
					!nextPayment ||
					(dueDate && (!earliestDueDate || dueDate < earliestDueDate))
				) {
					nextPayment = loan.nextPaymentInfo;
					earliestDueDate = dueDate;
				}
			}
		}

		return (
			nextPayment || {
				amount: 0,
				isOverdue: false,
				includesLateFees: false,
				description: "No payments due",
				dueDate: null,
			}
		);
	};

	const getCreditScoreInfo = (score: number) => {
		if (score >= 744) {
			return {
				range: "744 - 850",
				category: "Excellent",
				description:
					"Excellent! You're viewed very favourably by lenders.",
				color: "text-gray-700",
				bgColor: "bg-purple-primary/5",
				borderColor: "border-purple-primary/20",
			};
		} else if (score >= 718) {
			return {
				range: "718 - 743",
				category: "Very Good",
				description: "Very Good! You're viewed as a prime customer.",
				color: "text-gray-700",
				bgColor: "bg-purple-primary/5",
				borderColor: "border-purple-primary/20",
			};
		} else if (score >= 697) {
			return {
				range: "697 - 717",
				category: "Good",
				description:
					"Good! You're above average and viable for new credit.",
				color: "text-gray-700",
				bgColor: "bg-purple-primary/5",
				borderColor: "border-purple-primary/20",
			};
		} else if (score >= 651) {
			return {
				range: "651 - 696",
				category: "Fair",
				description:
					"Fair. You're below average and less viable for credit.",
				color: "text-gray-700",
				bgColor: "bg-purple-primary/5",
				borderColor: "border-purple-primary/20",
			};
		} else if (score >= 529) {
			return {
				range: "529 - 650",
				category: "Low",
				description:
					"Low. You may face diﬃculties when applying for credit.",
				color: "text-gray-700",
				bgColor: "bg-purple-primary/5",
				borderColor: "border-purple-primary/20",
			};
		} else if (score >= 300) {
			return {
				range: "300 - 528",
				category: "Poor",
				description:
					"Poor. Your credit applications will likely be affected.",
				color: "text-gray-700",
				bgColor: "bg-purple-primary/5",
				borderColor: "border-purple-primary/20",
			};
		} else {
			return {
				range: "No Score",
				category: "No Score",
				description:
					"Your score couldn't be generated due to insufficient information.",
				color: "text-gray-700",
				bgColor: "bg-purple-primary/5",
				borderColor: "border-purple-primary/20",
			};
		}
	};

	return (
		<DashboardLayout userName={userName}>
			<div className="w-full bg-offwhite min-h-screen px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
				<div className="space-y-6">
					{/* Incomplete Application Notification Card */}
					{incompleteApplications.length > 0 &&
						(() => {
							const filteredApps = incompleteApplications.filter(
								(app) =>
									[
										"INCOMPLETE",
										"PENDING_APP_FEE",
										"APPROVED",
										"PENDING_ATTESTATION",
									].includes(app.status)
							);

							if (filteredApps.length === 0) return null;

							const currentApp =
								filteredApps[currentNotificationIndex] ||
								filteredApps[0];

							const getAnnouncementContent = (status: string) => {
								switch (status) {
									case "INCOMPLETE":
										return {
											title: "Complete Your Loan Application",
											description: `You have an incomplete application for ${
												currentApp.product?.name ||
												"loan"
											}${
												currentApp.amount
													? ` of ${formatCurrency(
															parseFloat(
																currentApp.amount
															)
													  )}`
													: ""
											}`,
											buttonText: "Resume",
											buttonHref: `/dashboard/apply?applicationId=${
												currentApp.id
											}&step=${
												currentApp.appStep
											}&productCode=${
												currentApp.product?.code || ""
											}`,
											icon: (
												<ClockIcon className="h-6 w-6 text-amber-600" />
											),
										};
									case "PENDING_APP_FEE":
										return {
											title: "Application Fee Payment Required",
											description: `Your loan application is pending fee payment for ${
												currentApp.product?.name ||
												"loan"
											}${
												currentApp.amount
													? ` of ${formatCurrency(
															parseFloat(
																currentApp.amount
															)
													  )}`
													: ""
											}`,
											buttonText: "Pay",
											buttonHref: `/dashboard/applications/${currentApp.id}`,
											icon: (
												<CreditCardIcon className="h-6 w-6 text-amber-600" />
											),
										};
									case "APPROVED":
										return {
											title: "🎉 Loan Application Approved!",
											description: `Congratulations! Your application for ${
												currentApp.product?.name ||
												"loan"
											}${
												currentApp.amount
													? ` of ${formatCurrency(
															parseFloat(
																currentApp.amount
															)
													  )}`
													: ""
											} has been approved`,
											buttonText: "View Details",
											buttonHref: `/dashboard/applications/${currentApp.id}`,
											icon: (
												<CheckCircleIcon className="h-6 w-6 text-green-600" />
											),
										};
									case "PENDING_ATTESTATION":
										return {
											title: "Attestation Required",
											description: `Your approved loan for ${
												currentApp.product?.name ||
												"loan"
											}${
												currentApp.amount
													? ` of ${formatCurrency(
															parseFloat(
																currentApp.amount
															)
													  )}`
													: ""
											} requires attestation to proceed`,
											buttonText: "Complete Attestation",
											buttonHref: `/dashboard/loans?tab=applications`,
											icon: (
												<svg
													className="h-6 w-6 text-cyan-600"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
											),
										};
									default:
										return {
											title: "Application Update",
											description: `Your loan application requires attention`,
											buttonText: "View Application",
											buttonHref: `/dashboard/applications/${currentApp.id}`,
											icon: (
												<ClockIcon className="h-6 w-6 text-amber-600" />
											),
										};
								}
							};

							const content = getAnnouncementContent(
								currentApp.status
							);

							return (
								<div>
									<div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-6">
										{/* Subtle navigation dots for multiple notifications */}
										{filteredApps.length > 1 && (
											<div className="flex items-center justify-center mb-4">
												<div className="flex items-center space-x-2">
													{filteredApps.map(
														(_, index) => (
															<button
																key={index}
																onClick={() =>
																	setCurrentNotificationIndex(
																		index
																	)
																}
																className={`w-2 h-2 rounded-full transition-all duration-200 ${
																	index ===
																	currentNotificationIndex
																		? "bg-amber-500 w-6"
																		: "bg-amber-300 hover:bg-amber-400"
																}`}
																title={`View notification ${
																	index + 1
																}`}
															/>
														)
													)}
												</div>
											</div>
										)}

										<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
											<div className="flex items-start space-x-4">
												<div className="flex-shrink-0">
													<div className="p-2 bg-amber-100 rounded-xl border border-amber-200">
														{content.icon}
													</div>
												</div>
												<div className="flex-1">
													<h3 className="text-lg font-heading text-gray-700">
														{content.title}
													</h3>
													<p className="text-gray-600 text-sm mt-1 font-body">
														{content.description}
													</p>
													<p className="text-gray-500 text-xs mt-1 font-body">
														{currentApp.status ===
														"APPROVED"
															? "Approved on"
															: currentApp.status ===
															  "PENDING_ATTESTATION"
															? "Requires attestation since"
															: "Started on"}{" "}
														{formatDate(
															currentApp.status ===
																"APPROVED"
																? currentApp.approvedAt ||
																		currentApp.updatedAt
																: currentApp.status ===
																  "PENDING_ATTESTATION"
																? currentApp.approvedAt ||
																  currentApp.updatedAt
																: currentApp.createdAt
														)}
													</p>
												</div>
											</div>
											<div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
												<Link
													href={content.buttonHref}
													className={`font-medium px-6 py-3 rounded-xl shadow transition inline-flex items-center justify-center text-sm text-white ${
														currentApp.status ===
														"PENDING_ATTESTATION"
															? "bg-cyan-500 hover:bg-cyan-600"
															: "bg-amber-500 hover:bg-amber-600"
													}`}
												>
													<svg
														className="h-4 w-4 mr-2"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d={
																currentApp.status ===
																"PENDING_APP_FEE"
																	? "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
																	: currentApp.status ===
																	  "PENDING_ATTESTATION"
																	? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
																	: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
															}
														/>
													</svg>
													{content.buttonText}
												</Link>
												<button
													onClick={() => {
														const newApps =
															incompleteApplications.filter(
																(a) =>
																	a.id !==
																	currentApp.id
															);
														setIncompleteApplications(
															newApps
														);
														// Adjust current index if needed
														if (
															currentNotificationIndex >=
															filteredApps.length -
																1
														) {
															setCurrentNotificationIndex(
																0
															);
														}
													}}
													className="inline-flex items-center justify-center px-3 py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
													title="Dismiss"
												>
													<svg
														className="h-4 w-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M6 18L18 6M6 6l12 12"
														/>
													</svg>
												</button>
											</div>
										</div>
									</div>
								</div>
							);
						})()}

					{/* Loans & Applications Card - Spans 2 columns */}
					<div className="break-inside-avoid bg-white rounded-xl shadow-md border border-purple-primary/10">
						<div className="p-6">
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
								<div className="flex items-center space-x-3">
									<div className="p-3 bg-purple-primary/20 rounded-xl border border-purple-primary/30">
										<CreditCardIcon className="h-8 w-8 text-purple-primary" />
									</div>
									<div>
										<h2 className="text-xl font-heading text-purple-primary">
											Loans
										</h2>
										<p className="text-gray-700 text-sm font-body">
											Your borrowing overview
										</p>
									</div>
								</div>
								<Link
									href="/dashboard/loans"
									className="bg-purple-primary text-white font-medium px-6 py-3 rounded-xl shadow hover:bg-purple-700 transition text-sm w-fit inline-flex items-center"
								>
									View All
									<ArrowRightIcon className="ml-1 h-4 w-4" />
								</Link>
							</div>

							{/* Main Content Grid - Chart and Stats */}
							<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
								{/* Donut Chart Section */}
								<div className="flex flex-col items-center justify-center">
									<PieChart
										borrowed={
											loanSummary.totalBorrowed || 0
										}
										repaid={loanSummary.totalRepaid || 0}
										size={240}
										theme="light"
									/>
								</div>

								{/* Stats Section */}
								<div className="lg:col-span-2 space-y-4">
									{/* Main Balance */}
									<div className="text-center lg:text-left">
										<p className="text-gray-500 text-sm mb-1 font-body">
											Total Outstanding
										</p>
										<p className="text-4xl font-bold mb-2 text-purple-primary font-heading">
											{formatCurrency(
												loanSummary.totalOutstanding ||
													0
											)}
										</p>
										<p className="text-gray-500 text-sm font-body">
											of{" "}
											{formatCurrency(
												loanSummary.totalBorrowed || 0
											)}{" "}
											borrowed
										</p>
									</div>

									{/* Quick Stats Grid */}
									<div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
										<div className="bg-blue-tertiary/5 rounded-xl p-6 border border-blue-tertiary/20">
											<div className="flex items-center space-x-2 mb-2">
												<svg
													className="h-4 w-4 text-blue-tertiary"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
												<span className="text-xs font-medium text-gray-500 font-body">
													Total Paid
												</span>
											</div>
											<p className="text-lg font-bold text-blue-tertiary font-heading">
												{formatCurrency(
													loanSummary.totalRepaid || 0
												)}
											</p>
										</div>
										{(() => {
											const nextPaymentInfo =
												calculateNextPaymentInfo();
											const isOverdue =
												nextPaymentInfo.isOverdue;

											return (
												<div
													className={`rounded-xl p-6 border ${
														isOverdue
															? "bg-red-50 border-red-200"
															: "bg-blue-tertiary/5 border-blue-tertiary/20"
													}`}
												>
													<div className="flex items-center space-x-2 mb-2">
														<svg
															className={`h-4 w-4 ${
																isOverdue
																	? "text-red-500"
																	: "text-blue-tertiary"
															}`}
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
															/>
														</svg>
														<span
															className={`text-xs font-medium font-body ${
																isOverdue
																	? "text-red-600"
																	: "text-gray-500"
															}`}
														>
															{isOverdue
																? "Overdue Payment"
																: "Next Payment"}
														</span>
													</div>
													<p
														className={`text-lg font-bold font-heading ${
															isOverdue
																? "text-red-600"
																: "text-blue-tertiary"
														}`}
													>
														{nextPaymentInfo.amount >
														0
															? formatCurrency(
																	nextPaymentInfo.amount
															  )
															: "No payments"}
													</p>
													{nextPaymentInfo.dueDate && (
														<p
															className={`text-xs mt-1 font-body ${
																isOverdue
																	? "text-red-500"
																	: "text-gray-500"
															}`}
														>
															{isOverdue
																? "Was due"
																: "Due"}{" "}
															{formatDate(
																nextPaymentInfo.dueDate
															)}
														</p>
													)}
													{nextPaymentInfo.description !==
														"No payments due" &&
														nextPaymentInfo.amount >
															0 && (
															<p
																className={`text-xs mt-1 font-body ${
																	isOverdue
																		? "text-red-500"
																		: "text-gray-500"
																}`}
															>
																{
																	nextPaymentInfo.description
																}
															</p>
														)}
												</div>
											);
										})()}
										<div className="bg-blue-tertiary/5 rounded-xl p-6 border border-blue-tertiary/20">
											<div className="flex items-center space-x-2 mb-2">
												<svg
													className="h-4 w-4 text-blue-tertiary"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
													/>
												</svg>
												<span className="text-xs font-medium text-gray-500 font-body">
													Active Loans
												</span>
											</div>
											<p className="text-lg font-bold text-blue-tertiary font-heading">
												{loans.length}
											</p>
											<p className="text-xs text-gray-500 mt-1 font-body">
												{loans.length === 1
													? "loan"
													: "loans"}{" "}
												active
											</p>
										</div>
									</div>
								</div>
							</div>

							{/* Late Fees Alert - Show when there are overdue payments with late fees */}
							{(() => {
								const loansWithLateFees = loans.filter(
									(loan) =>
										loan.overdueInfo?.hasOverduePayments &&
										loan.overdueInfo?.totalLateFees > 0
								);

								if (loansWithLateFees.length === 0) return null;

								const totalLateFees = loansWithLateFees.reduce(
									(sum, loan) =>
										sum +
										(loan.overdueInfo?.totalLateFees || 0),
									0
								);

								return (
									<div className="bg-red-50 rounded-xl p-6 border border-red-200">
										<div className="flex items-start space-x-4">
											<div className="flex-shrink-0">
												<div className="p-2 bg-red-100 rounded-xl border border-red-200">
													<ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
												</div>
											</div>
											<div className="flex-1">
												<h3 className="text-lg font-heading text-red-800 mb-1">
													Late Fees Applied
												</h3>
												<p className="text-red-700 text-sm mb-2 font-body">
													You have{" "}
													{formatCurrency(
														totalLateFees
													)}{" "}
													in late fees across{" "}
													{loansWithLateFees.length}{" "}
													{loansWithLateFees.length ===
													1
														? "loan"
														: "loans"}
													. Pay your overdue amounts
													to avoid additional charges.
												</p>
												<div className="flex flex-wrap gap-2">
													{loansWithLateFees.map(
														(loan, index) => (
															<span
																key={loan.id}
																className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200"
															>
																{loan
																	.application
																	?.product
																	?.name ||
																	`Loan ${
																		index +
																		1
																	}`}
																:{" "}
																{formatCurrency(
																	loan
																		.overdueInfo
																		?.totalLateFees ||
																		0
																)}
															</span>
														)
													)}
												</div>
											</div>
											<Link
												href="/dashboard/loans"
												className="bg-red-600 text-white font-medium px-4 py-2 rounded-xl shadow hover:bg-red-700 transition text-sm inline-flex items-center"
											>
												View Details
												<ArrowRightIcon className="ml-1 h-4 w-4" />
											</Link>
										</div>
									</div>
								);
							})()}

							{/* CTA Section - Show when no loans */}
							{loans.length === 0 && (
								<div className="bg-blue-tertiary/5 rounded-xl p-6 text-center border border-blue-tertiary/20">
									<div className="p-3 bg-purple-primary/20 rounded-xl w-fit mx-auto mb-4 border border-purple-primary/30">
										<CreditCardIcon className="h-8 w-8 text-purple-primary" />
									</div>
									<h3 className="font-heading text-lg mb-2 text-purple-primary">
										Ready to Get Started?
									</h3>
									<p className="text-gray-700 text-sm mb-4 font-body">
										Apply for your first loan and start
										building your credit history
									</p>
									<Link
										href="/dashboard/apply"
										className="bg-purple-primary text-white font-medium px-6 py-3 rounded-xl shadow hover:bg-purple-700 transition inline-flex items-center"
									>
										Apply for a Loan
										<ArrowRightIcon className="ml-2 h-4 w-4" />
									</Link>
								</div>
							)}
						</div>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Wallet Card */}
						<div className="break-inside-avoid bg-white rounded-xl shadow-md border border-blue-tertiary/10">
							<div className="p-6">
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
									<div className="flex items-center space-x-3">
										<div className="p-3 bg-purple-primary/20 rounded-xl border border-purple-primary/30">
											<WalletIcon className="h-8 w-8 text-purple-primary" />
										</div>
										<div>
											<h2 className="text-xl font-heading text-purple-primary">
												Wallet
											</h2>
											<p className="text-gray-700 text-sm font-body">
												Your financial hub
											</p>
										</div>
									</div>
									<Link
										href="/dashboard/wallet"
										className="bg-purple-primary text-white font-medium px-6 py-3 rounded-xl hover:bg-purple-700 transition text-sm w-fit inline-flex items-center"
									>
										Manage
										<ArrowRightIcon className="ml-1 h-4 w-4" />
									</Link>
								</div>

								{/* Main Balance */}
								<div className="mb-6">
									<div className="text-center">
										<p className="text-gray-500 text-sm mb-1 font-body">
											Total Balance
										</p>
										<p className="text-4xl font-bold mb-2 text-purple-primary font-heading">
											{formatCurrency(walletData.balance)}
										</p>
										<p className="text-gray-500 text-sm font-body">
											Available:{" "}
											{formatCurrency(
												walletData.availableForWithdrawal
											)}
										</p>
									</div>
								</div>

								{/* Quick Stats Grid */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
									<div className="bg-blue-tertiary/5 rounded-xl p-6 border border-blue-tertiary/20">
										<div className="flex items-center space-x-2 mb-2">
											<ArrowDownIcon className="h-4 w-4 text-blue-tertiary" />
											<span className="text-xs font-medium text-gray-500 font-body">
												Deposits
											</span>
										</div>
										<p className="text-lg font-bold text-blue-tertiary font-heading">
											{formatCurrency(
												walletData.totalDeposits
											)}
										</p>
									</div>
									<div className="bg-blue-tertiary/5 rounded-xl p-6 border border-blue-tertiary/20">
										<div className="flex items-center space-x-2 mb-2">
											<CreditCardIcon className="h-4 w-4 text-blue-tertiary" />
											<span className="text-xs font-medium text-gray-500 font-body">
												Disbursed
											</span>
										</div>
										<p className="text-lg font-bold text-blue-tertiary font-heading">
											{formatCurrency(
												walletData.totalDisbursed
											)}
										</p>
									</div>
								</div>

								{/* Bank Status */}
								<div className="bg-blue-tertiary/5 rounded-xl p-6 border border-blue-tertiary/20">
									<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
										<div className="flex items-center space-x-3">
											<div
												className={`p-2 rounded-xl ${
													walletData.bankConnected
														? "bg-purple-primary/10"
														: "bg-white"
												} border ${
													walletData.bankConnected
														? "border-purple-primary/20"
														: "border-gray-500/10"
												}`}
											>
												<svg
													className={`h-5 w-5 ${
														walletData.bankConnected
															? "text-purple-primary"
															: "text-gray-500"
													}`}
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
													/>
												</svg>
											</div>
											<div>
												<p className="font-semibold text-sm text-gray-700 font-body">
													{walletData.bankConnected
														? "Bank Connected"
														: "Bank Not Connected"}
												</p>
												{walletData.bankConnected &&
												walletData.bankName ? (
													<p className="text-xs text-gray-500 font-body">
														{walletData.bankName}{" "}
														•••
														{walletData.accountNumber?.slice(
															-4
														)}
													</p>
												) : (
													<p className="text-xs text-gray-500 font-body">
														Connect to enable
														transfers
													</p>
												)}
											</div>
										</div>
										{walletData.pendingTransactions > 0 && (
											<div className="flex items-center space-x-1 bg-purple-primary/10 px-2 py-1 rounded-full border border-purple-primary/20">
												<ClockIcon className="h-3 w-3 text-gray-500" />
												<span className="text-xs font-medium text-gray-500 font-body">
													{
														walletData.pendingTransactions
													}{" "}
													pending
												</span>
											</div>
										)}
									</div>
								</div>
							</div>
						</div>

						{/* Credit Score Card */}
						<div className="break-inside-avoid bg-white rounded-xl shadow-md border border-purple-primary/10">
							<div className="p-6">
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
									<div className="flex items-center space-x-3">
										<div className="p-3 bg-purple-primary/20 rounded-xl border border-purple-primary/30">
											<svg
												className="h-8 w-8 text-purple-primary"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
												/>
											</svg>
										</div>
										<div>
											<h2 className="text-xl font-heading text-purple-primary">
												Credit Score
											</h2>
											<p className="text-gray-700 text-sm font-body">
												Your creditworthiness
											</p>
										</div>
									</div>
									<Link
										href="/dashboard/credit-score"
										className="bg-purple-primary text-white font-medium px-6 py-3 rounded-xl shadow hover:bg-purple-700 transition text-sm w-fit inline-flex items-center"
									>
										View Details
										<ArrowRightIcon className="ml-1 h-4 w-4" />
									</Link>
								</div>

								<div className="space-y-6">
									{/* Gauge Section */}
									<div className="flex flex-col items-center">
										<div className="bg-blue-tertiary/5 rounded-2xl p-6 border border-blue-tertiary/20">
											<CreditScoreGauge
												score={600}
												size={240}
											/>
										</div>
									</div>

									{/* Score Info Section */}
									<div className="space-y-4">
										{(() => {
											const scoreInfo =
												getCreditScoreInfo(600);
											return (
												<>
													{/* Current Score Info */}
													<div className="bg-blue-tertiary/5 rounded-xl p-4 border border-blue-tertiary/20">
														<div className="flex items-center justify-between mb-3">
															<div>
																<h3 className="text-lg font-heading text-purple-primary">
																	{
																		scoreInfo.category
																	}
																</h3>
																<p className="text-sm text-gray-500 font-body">
																	Score Range:{" "}
																	{
																		scoreInfo.range
																	}
																</p>
															</div>
															<div className="text-right">
																<p className="text-2xl font-bold text-purple-primary font-heading">
																	600
																</p>
																<p className="text-xs text-gray-500 font-body">
																	Your Score
																</p>
															</div>
														</div>
														<p className="text-sm text-gray-700 leading-relaxed font-body">
															{
																scoreInfo.description
															}
														</p>
													</div>

													{/* Last Updated & Action */}
													<div className="bg-blue-tertiary/5 rounded-xl p-4 border border-blue-tertiary/20">
														<div className="flex items-center justify-between">
															<span className="text-sm font-medium text-gray-500 font-body">
																Last Updated
															</span>
															<span className="text-sm font-bold text-gray-700 font-body">
																Never
															</span>
														</div>
													</div>
												</>
											);
										})()}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
}
