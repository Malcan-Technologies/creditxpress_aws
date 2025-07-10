"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import PieChart from "@/components/PieChart";
import CreditScoreGauge from "@/components/CreditScoreGauge";
import ActionNotificationBar from "@/components/ActionNotificationBar";
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

				// Skip onboarding check - all users go directly to dashboard
				// if (!data?.isOnboardingComplete) {
				// 	console.log(
				// 		"Dashboard - User has not completed onboarding, redirecting to onboarding"
				// 	);
				// 	router.push("/onboarding");
				// 	return;
				// }

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
				totalLateFees: 0,
			};
		}

		// Find the loan with the most urgent next payment
		let nextPayment = null;
		let earliestDueDate = null;
		let totalLateFees = 0;

		// Filter to only active loans
		const activeLoans = loans.filter(loan => 
			loan.status === "ACTIVE" || loan.status === "PENDING_DISCHARGE"
		);

		// First, calculate total late fees across active loans only
		for (const loan of activeLoans) {
			if (loan.overdueInfo?.hasOverduePayments && loan.overdueInfo?.totalLateFees > 0) {
				totalLateFees += loan.overdueInfo.totalLateFees;
			}
		}

		// Find the most urgent payment from active loans only
		for (const loan of activeLoans) {
			if (loan.nextPaymentInfo && loan.nextPaymentInfo.amount > 0) {
				// Use the same logic as loans page: prioritize loan.nextPaymentDue, fallback to overdue dates
				let actualDueDate = null;
				
				if (loan.overdueInfo?.hasOverduePayments && loan.overdueInfo?.overdueRepayments && loan.overdueInfo.overdueRepayments.length > 0) {
					// Find the earliest overdue repayment due date
					const earliestOverdueDate = loan.overdueInfo.overdueRepayments
						.map((rep: any) => new Date(rep.dueDate))
						.sort((a: Date, b: Date) => a.getTime() - b.getTime())[0];
					actualDueDate = earliestOverdueDate;
				} else if (loan.nextPaymentDue) {
					// Use the loan's next payment due date
					actualDueDate = new Date(loan.nextPaymentDue);
				}

				if (
					!nextPayment ||
					(actualDueDate && (!earliestDueDate || actualDueDate < earliestDueDate))
				) {
					nextPayment = {
						...loan.nextPaymentInfo,
						dueDate: actualDueDate ? actualDueDate.toISOString() : null
					};
					earliestDueDate = actualDueDate;
				}
			}
		}

		// If we have a next payment, include late fees in the total
		if (nextPayment && totalLateFees > 0) {
			return {
				...nextPayment,
				amount: nextPayment.amount + totalLateFees,
				includesLateFees: true,
				totalLateFees,
				description: totalLateFees > 0 
					? `Includes ${formatCurrency(totalLateFees)} late fees`
					: nextPayment.description,
			};
		}

		// If no next payment but we have late fees, show just the late fees
		if (totalLateFees > 0) {
			return {
				amount: totalLateFees,
				isOverdue: true,
				includesLateFees: true,
				totalLateFees,
				description: "Outstanding late fees",
				dueDate: null,
			};
		}

		return (
			nextPayment || {
				amount: 0,
				isOverdue: false,
				includesLateFees: false,
				description: "No payments due",
				dueDate: null,
				totalLateFees: 0,
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

	// Convert applications to action notifications
	const getActionNotifications = () => {
		const actionableApps = incompleteApplications.filter((app: any) =>
			[
				"INCOMPLETE",
				"PENDING_APP_FEE", 
				"APPROVED",
				"PENDING_ATTESTATION"
			].includes(app.status)
		);

		return actionableApps.map((app: any) => {
			const getNotificationData = (status: string) => {
				switch (status) {
					case "INCOMPLETE":
						return {
							type: 'INCOMPLETE_APPLICATION' as const,
							title: "Complete Your Loan Application",
							description: `You have an incomplete application for ${
								app.product?.name || "loan"
							}${
								app.amount
									? ` of ${formatCurrency(parseFloat(app.amount))}`
									: ""
							}`,
							buttonText: "Resume Application",
							buttonHref: `/dashboard/apply?applicationId=${app.id}&step=${app.appStep}&productCode=${app.product?.code || ""}`,
							priority: 'HIGH' as const,
						};
					case "PENDING_APP_FEE":
						return {
							type: 'PENDING_APP_FEE' as const,
							title: "Application Fee Payment Required",
							description: `Your loan application is pending fee payment for ${
								app.product?.name || "loan"
							}${
								app.amount
									? ` of ${formatCurrency(parseFloat(app.amount))}`
									: ""
							}`,
							buttonText: "Pay Fee",
							buttonHref: `/dashboard/applications/${app.id}`,
							priority: 'HIGH' as const,
						};
					case "APPROVED":
						return {
							type: 'APPROVED' as const,
							title: "🎉 Loan Application Approved!",
							description: `Congratulations! Your application for ${
								app.product?.name || "loan"
							}${
								app.amount
									? ` of ${formatCurrency(parseFloat(app.amount))}`
									: ""
							} has been approved`,
							buttonText: "View Details",
							buttonHref: `/dashboard/applications/${app.id}`,
							priority: 'MEDIUM' as const,
						};
					case "PENDING_ATTESTATION":
						return {
							type: 'PENDING_ATTESTATION' as const,
							title: "Attestation Required",
							description: `Your approved loan for ${
								app.product?.name || "loan"
							}${
								app.amount
									? ` of ${formatCurrency(parseFloat(app.amount))}`
									: ""
							} requires attestation to proceed`,
							buttonText: "Complete Attestation",
							buttonHref: `/dashboard/loans?tab=applications`,
							priority: 'HIGH' as const,
						};
					default:
						return {
							type: 'INCOMPLETE_APPLICATION' as const,
							title: "Application Update",
							description: "Your loan application requires attention",
							buttonText: "View Application",
							buttonHref: `/dashboard/applications/${app.id}`,
							priority: 'MEDIUM' as const,
						};
				}
			};

			const notificationData = getNotificationData(app.status);
			
			return {
				id: app.id,
				...notificationData,
				metadata: {
					productName: app.product?.name,
					amount: app.amount ? formatCurrency(parseFloat(app.amount)) : undefined,
					date: app.status === "APPROVED" 
						? `Approved on ${formatDate(app.approvedAt || app.updatedAt)}`
						: app.status === "PENDING_ATTESTATION"
						? `Requires attestation since ${formatDate(app.approvedAt || app.updatedAt)}`
						: `Started on ${formatDate(app.createdAt)}`,
					applicationId: app.id,
				},
			};
		});
	};



	return (
		<DashboardLayout userName={userName}>
			<div className="w-full bg-offwhite min-h-screen px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
				<div className="space-y-6">
					{/* Action Notification Bar */}
					<ActionNotificationBar 
						notifications={getActionNotifications()}
					/>
					{/* Loans & Applications Card - Spans 2 columns */}
					<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
						<div className="p-4 sm:p-6 lg:p-8">
							{/* Header - Mobile: Stack, Desktop: Side by side */}
							<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
								<div className="flex items-center">
									<div className="w-12 h-12 lg:w-14 lg:h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
										<CreditCardIcon className="h-6 w-6 lg:h-7 lg:w-7 text-blue-600" />
									</div>
									<div className="min-w-0">
										<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
											Loans
										</h3>
										<p className="text-sm lg:text-base text-blue-600 font-semibold">
											Your borrowing overview
										</p>
									</div>
								</div>
								{/* Desktop View All Button */}
								<Link
									href="/dashboard/loans"
									className="hidden lg:inline-flex bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium font-body text-base transition-all duration-200 shadow-sm hover:shadow-md items-center"
								>
									View All
									<ArrowRightIcon className="ml-1 h-4 w-4" />
								</Link>
							</div>

							{/* Main Content Grid - Chart and Stats */}
							<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
								{/* Donut Chart Section */}
								<div className="flex flex-col items-center justify-center order-2 lg:order-1">
									<PieChart
										borrowed={
											(() => {
												// Calculate total borrowed from active loans only
												const activeLoans = loans.filter(loan => 
													loan.status === "ACTIVE" || loan.status === "PENDING_DISCHARGE"
												);
												return activeLoans.reduce((sum, loan) => 
													sum + (loan.totalAmount || 0), 0
												);
											})()
										}
										repaid={
											(() => {
												// Calculate total principal paid from active loans only
												const activeLoans = loans.filter(loan => 
													loan.status === "ACTIVE" || loan.status === "PENDING_DISCHARGE"
												);
												return activeLoans.reduce((sum, loan) => {
													if (!loan.repayments) return sum;
													
													// Sum up principal paid from all repayments
													const loanPrincipalPaid = loan.repayments.reduce((loanSum: number, repayment: any) => {
														if (repayment.status === "COMPLETED") {
															// For completed payments, use principalPaid or fall back to amount
															return loanSum + (Number(repayment.principalPaid) || Number(repayment.amount) || 0);
														} else if (repayment.status === "PARTIAL") {
															// For partial payments, use principalPaid or actualAmount
															return loanSum + (Number(repayment.principalPaid) || Number(repayment.actualAmount) || 0);
														}
														return loanSum;
													}, 0);
													
													return sum + loanPrincipalPaid;
												}, 0);
											})()
										}
										size={240}
										theme="light"
									/>
								</div>

								{/* Stats Section */}
								<div className="lg:col-span-2 space-y-4 lg:space-y-6 order-1 lg:order-2">
									{/* Main Balance */}
									<div className="text-center lg:text-left">
										<p className="text-gray-500 text-sm mb-2 font-body">
											Total Outstanding
										</p>
										<p className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-gray-700 mb-3">
											{formatCurrency(
												(() => {
													// Calculate outstanding from active loans only
													const activeLoans = loans.filter(loan => 
														loan.status === "ACTIVE" || loan.status === "PENDING_DISCHARGE"
													);
													return activeLoans.reduce((sum, loan) => 
														sum + (loan.outstandingBalance || 0), 0
													);
												})()
											)}
										</p>
										<p className="text-sm sm:text-base lg:text-lg text-gray-600 font-body leading-relaxed">
											of{" "}
											{formatCurrency(
												(() => {
													// Calculate total borrowed from active loans only
													const activeLoans = loans.filter(loan => 
														loan.status === "ACTIVE" || loan.status === "PENDING_DISCHARGE"
													);
													return activeLoans.reduce((sum, loan) => 
														sum + (loan.totalAmount || 0), 0
													);
												})()
											)}{" "}
											borrowed
										</p>
									</div>

									{/* Subtle separator line */}
									<div className="border-t border-gray-100"></div>

									{/* Quick Stats Grid */}
									<div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 lg:gap-6 justify-items-center md:justify-items-start">
										<div className="space-y-2 text-center md:text-left w-full">
											<div className="flex items-center space-x-2 justify-center md:justify-start">
												<svg
													className="h-4 w-4 text-blue-600"
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
												<span className="text-xs sm:text-sm font-medium text-gray-500 font-body">
													Total Paid
												</span>
											</div>
											<p className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-blue-600">
												{formatCurrency(
													(() => {
														// Calculate total principal paid from active loans only
														const activeLoans = loans.filter(loan => 
															loan.status === "ACTIVE" || loan.status === "PENDING_DISCHARGE"
														);
														return activeLoans.reduce((sum, loan) => {
															if (!loan.repayments) return sum;
															
															// Sum up principal paid from all repayments
															const loanPrincipalPaid = loan.repayments.reduce((loanSum: number, repayment: any) => {
																if (repayment.status === "COMPLETED") {
																	// For completed payments, use principalPaid or fall back to amount
																	return loanSum + (Number(repayment.principalPaid) || Number(repayment.amount) || 0);
																} else if (repayment.status === "PARTIAL") {
																	// For partial payments, use principalPaid or actualAmount
																	return loanSum + (Number(repayment.principalPaid) || Number(repayment.actualAmount) || 0);
																}
																return loanSum;
															}, 0);
															
															return sum + loanPrincipalPaid;
														}, 0);
													})()
												)}
											</p>
											<p className="text-xs text-gray-500 font-body mt-1">Excluding late fees</p>
										</div>
										{(() => {
											const nextPaymentInfo =
												calculateNextPaymentInfo();
											const isOverdue =
												nextPaymentInfo.isOverdue;

											return (
												<div className="space-y-2 text-center md:text-left w-full">
													<div className="flex items-center space-x-2 justify-center md:justify-start">
														<svg
															className={`h-4 w-4 ${
																isOverdue
																	? "text-red-500"
																	: "text-blue-600"
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
															className={`text-xs sm:text-sm font-medium font-body ${
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
														className={`text-xl sm:text-2xl lg:text-3xl font-heading font-bold ${
															isOverdue
																? "text-red-600"
																: "text-blue-600"
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
										<div className="space-y-2 text-center md:text-left w-full col-span-2 sm:col-span-1">
											<div className="flex items-center space-x-2 justify-center md:justify-start">
												<svg
													className="h-4 w-4 text-blue-600"
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
												<span className="text-xs sm:text-sm font-medium text-gray-500 font-body">
													Active Loans
												</span>
											</div>
											<p className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-blue-600">
												{(() => {
													// Count only active loans
													const activeLoans = loans.filter(loan => 
														loan.status === "ACTIVE" || loan.status === "PENDING_DISCHARGE"
													);
													return activeLoans.length;
												})()}
											</p>
											<p className="text-xs text-gray-500 mt-1 font-body">
												{(() => {
													const activeLoansCount = loans.filter(loan => 
														loan.status === "ACTIVE" || loan.status === "PENDING_DISCHARGE"
													).length;
													return activeLoansCount === 1 ? "loan" : "loans";
												})()}{" "}
												active
											</p>
										</div>
									</div>
								</div>
							</div>



							{/* CTA Section - Show when no active loans */}
							{(() => {
								const activeLoans = loans.filter(loan => 
									loan.status === "ACTIVE" || loan.status === "PENDING_DISCHARGE"
								);
								return activeLoans.length === 0;
							})() && (
								<div className="bg-blue-600/5 rounded-xl p-6 text-center border border-blue-600/20">
									<div className="w-12 h-12 lg:w-14 lg:h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mx-auto mb-4">
										<CreditCardIcon className="h-6 w-6 lg:h-7 lg:w-7 text-blue-600" />
									</div>
									<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-2">
										Ready to Get Started?
									</h3>
									<p className="text-base lg:text-lg text-gray-600 font-body leading-relaxed mb-4">
										Apply for your first loan and start
										building your credit history
									</p>
									<Link
										href="/dashboard/apply"
										className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium font-body text-base transition-all duration-200 shadow-sm hover:shadow-md inline-flex items-center"
									>
										Apply for a Loan
										<ArrowRightIcon className="ml-2 h-4 w-4" />
									</Link>
								</div>
							)}

							{/* Mobile View All Button */}
							<div className="lg:hidden pt-4 border-t border-gray-100">
								<Link
									href="/dashboard/loans"
									className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium font-body text-base transition-all duration-200 shadow-sm hover:shadow-md inline-flex items-center justify-center"
								>
									View All Loans
									<ArrowRightIcon className="ml-2 h-4 w-4" />
								</Link>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Wallet Card */}
						<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
							<div className="p-4 sm:p-6 lg:p-8">
								{/* Header - Mobile: Stack, Desktop: Side by side */}
								<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
									<div className="flex items-center">
										<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
											<WalletIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
										</div>
										<div className="min-w-0">
											<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
												Wallet
											</h3>
											<p className="text-sm lg:text-base text-purple-primary font-semibold">
												Your financial hub
											</p>
										</div>
									</div>
									{/* Desktop Manage Button */}
									<Link
										href="/dashboard/wallet"
										className="hidden lg:inline-flex bg-purple-primary hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-medium font-body text-base transition-all duration-200 shadow-sm hover:shadow-md items-center"
									>
										Manage
										<ArrowRightIcon className="ml-1 h-4 w-4" />
									</Link>
								</div>

								{/* Main Balance */}
								<div className="text-center lg:text-left mb-6">
									<p className="text-gray-500 text-sm mb-2 font-body">
										Total Balance
									</p>
									<p className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-gray-700 mb-3">
										{formatCurrency(walletData.balance)}
									</p>
									<p className="text-sm sm:text-base lg:text-lg text-gray-600 font-body leading-relaxed">
										Available:{" "}
										{formatCurrency(
											walletData.availableForWithdrawal
										)}
									</p>
								</div>

								{/* Subtle separator line */}
								<div className="border-t border-gray-100 mb-6"></div>

								{/* Quick Stats Grid */}
								<div className="grid grid-cols-2 md:grid-cols-2 gap-4 lg:gap-6 justify-items-center lg:justify-items-start mb-6">
									<div className="space-y-2 text-center lg:text-left w-full">
										<div className="flex items-center space-x-2 justify-center lg:justify-start">
											<ArrowDownIcon className="h-4 w-4 text-purple-primary" />
											<span className="text-xs sm:text-sm font-medium text-gray-500 font-body">
												Deposits
											</span>
										</div>
										<p className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-purple-primary">
											{formatCurrency(
												walletData.totalDeposits
											)}
										</p>
									</div>
									<div className="space-y-2 text-center lg:text-left w-full">
										<div className="flex items-center space-x-2 justify-center lg:justify-start">
											<CreditCardIcon className="h-4 w-4 text-purple-primary" />
											<span className="text-xs sm:text-sm font-medium text-gray-500 font-body">
												Disbursed
											</span>
										</div>
										<p className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-purple-primary">
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

								{/* Mobile Manage Button */}
								<div className="border-t border-gray-100 pt-4 lg:hidden">
									<Link
										href="/dashboard/wallet"
										className="w-full bg-purple-primary hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-medium font-body text-base transition-all duration-200 shadow-sm hover:shadow-md inline-flex items-center justify-center"
									>
										Manage
										<ArrowRightIcon className="ml-1 h-4 w-4" />
									</Link>
								</div>
							</div>
						</div>

						{/* Credit Score Card */}
						<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
							<div className="p-4 sm:p-6 lg:p-8">
								{/* Header - Mobile: Stack, Desktop: Side by side */}
								<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
									<div className="flex items-center">
										<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
											<svg
												className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary"
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
										<div className="min-w-0">
											<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
												Credit Score
											</h3>
											<p className="text-sm lg:text-base text-purple-primary font-semibold">
												Your creditworthiness
											</p>
										</div>
									</div>
									{/* Desktop View Details Button */}
									<Link
										href="/dashboard/credit-score"
										className="hidden lg:inline-flex bg-purple-primary hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-medium font-body text-base transition-all duration-200 shadow-sm hover:shadow-md items-center"
									>
										View Details
										<ArrowRightIcon className="ml-1 h-4 w-4" />
									</Link>
								</div>

								<div className="space-y-6">
									{/* Gauge Section */}
									<div className="flex flex-col items-center">
										<CreditScoreGauge
											score={600}
											size={300}
										/>
									</div>

									{/* Subtle separator line */}
									<div className="border-t border-gray-100"></div>

									{/* Score Info Section */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 justify-items-center lg:justify-items-start">
										{(() => {
											const scoreInfo =
												getCreditScoreInfo(600);
											return (
												<>
													{/* Current Score Info */}
													<div className="space-y-2 text-center lg:text-left w-full">
														<div className="flex items-center space-x-2 justify-center lg:justify-start">
															<span className="text-xs sm:text-sm font-medium text-gray-500 font-body">
																{scoreInfo.category}
															</span>
														</div>
														<p className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-purple-primary">
															600
														</p>
														<p className="text-xs text-gray-500 font-body">
															Range: {scoreInfo.range}
														</p>
													</div>

													{/* Last Updated */}
													<div className="space-y-2 text-center lg:text-left w-full">
														<div className="flex items-center space-x-2 justify-center lg:justify-start">
															<span className="text-xs sm:text-sm font-medium text-gray-500 font-body">
																Last Updated
															</span>
														</div>
														<p className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-purple-primary">
															Never
														</p>
													</div>
												</>
											);
										})()}
									</div>

									{/* Description */}
									<div className="text-center lg:text-left">
										<p className="text-sm sm:text-base lg:text-lg text-gray-600 font-body leading-relaxed">
											{getCreditScoreInfo(600).description}
										</p>
									</div>
								</div>

								{/* Mobile View Details Button */}
								<div className="border-t border-gray-100 pt-4 lg:hidden">
									<Link
										href="/dashboard/credit-score"
										className="w-full bg-purple-primary hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-medium font-body text-base transition-all duration-200 shadow-sm hover:shadow-md inline-flex items-center justify-center"
									>
										View Details
										<ArrowRightIcon className="ml-1 h-4 w-4" />
									</Link>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
}
