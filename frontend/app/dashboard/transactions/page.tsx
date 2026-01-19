"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import {
	WalletIcon,
	ArrowUpIcon,
	ArrowDownIcon,
	CheckCircleIcon,
	ClockIcon,
	ExclamationTriangleIcon,
	ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { checkAuth, fetchWithTokenRefresh, TokenStorage } from "@/lib/authUtils";

interface Transaction {
	id: string;
	type: "DEPOSIT" | "WITHDRAWAL" | "LOAN_DISBURSEMENT" | "LOAN_REPAYMENT";
	amount: number;
	status: "PENDING" | "APPROVED" | "REJECTED";
	description: string;
	createdAt: string;
	reference?: string;
}

export default function TransactionsPage() {
	const router = useRouter();
	const [userName, setUserName] = useState<string>("");
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [transactionFilter, setTransactionFilter] = useState<string>("ALL");
	const [loading, setLoading] = useState<boolean>(true);
	const [refreshing, setRefreshing] = useState<boolean>(false);

	// Set filter from URL parameter on component mount
	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const filterParam = urlParams.get('filter');
		if (filterParam && ['LOAN_DISBURSEMENT', 'LOAN_REPAYMENT'].includes(filterParam)) {
			setTransactionFilter(filterParam);
		}
	}, []);

	useEffect(() => {
		const checkAuthAndLoadData = async () => {
			try {
				// First check if we have any tokens at all
				const accessToken = TokenStorage.getAccessToken();
				const refreshToken = TokenStorage.getRefreshToken();

				// If no tokens available, immediately redirect to login
				if (!accessToken && !refreshToken) {
					router.push("/login");
					return;
				}

				const isAuthenticated = await checkAuth();
				if (!isAuthenticated) {
					// Clear any invalid tokens
					TokenStorage.clearTokens();
					router.push("/login");
					return;
				}

				// Fetch user data
				const userData = await fetchWithTokenRefresh<any>(
					"/api/users/me"
				);
				// Skip onboarding check - all users go directly to dashboard
				// if (!userData?.isOnboardingComplete) {
				// 	router.push("/onboarding");
				// 	return;
				// }

				// Set user name
				if (userData.firstName) {
					setUserName(userData.firstName);
				} else if (userData.fullName) {
					setUserName(userData.fullName.split(" ")[0]);
				} else {
					setUserName("User");
				}

				// Load transactions
				fetchTransactions();
			} catch (error) {
				console.error("Transactions - Auth check error:", error);
				// Clear any invalid tokens and redirect to login
				TokenStorage.clearTokens();
				router.push("/login");
			} finally {
				setLoading(false);
			}
		};

		checkAuthAndLoadData();
	}, [router]);

	const fetchTransactions = async () => {
		try {
			const data = await fetchWithTokenRefresh<{
				transactions: Transaction[];
			}>("/api/wallet/transactions?limit=50");
			if (data?.transactions) {
				setTransactions(data.transactions);
			}
		} catch (error) {
			console.error("Error fetching transactions:", error);
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-MY", {
			style: "currency",
			currency: "MYR",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(Math.abs(amount));
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

	const getTransactionIcon = (type: Transaction["type"]) => {
		switch (type) {
			case "DEPOSIT":
			case "LOAN_DISBURSEMENT":
				return (
					<ArrowDownIcon className="h-5 w-5 lg:h-6 lg:w-6 text-green-600" />
				);
			case "WITHDRAWAL":
				return <ArrowUpIcon className="h-5 w-5 lg:h-6 lg:w-6 text-gray-600" />;
			case "LOAN_REPAYMENT":
				return (
					<svg
						className="h-5 w-5 lg:h-6 lg:w-6 text-purple-primary"
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
				return <WalletIcon className="h-5 w-5 lg:h-6 lg:w-6 text-gray-500" />;
		}
	};

	const getStatusBadge = (status: Transaction["status"]) => {
		switch (status) {
			case "APPROVED":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200 font-body">
						<CheckCircleIcon className="h-3 w-3 mr-1" />
						Approved
					</span>
				);
			case "PENDING":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 font-body">
						<ClockIcon className="h-3 w-3 mr-1" />
						Pending
					</span>
				);
			case "REJECTED":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200 font-body">
						<ExclamationTriangleIcon className="h-3 w-3 mr-1" />
						Rejected
					</span>
				);
		}
	};

	const getFilteredTransactions = () => {
		if (transactionFilter === "ALL") {
			return transactions;
		}
		return transactions.filter(
			(transaction) => transaction.type === transactionFilter
		);
	};

	const getTransactionTypeLabel = (type: string) => {
		switch (type) {
			case "DEPOSIT":
				return "Deposit";
			case "WITHDRAWAL":
				return "Withdrawal";
			case "LOAN_DISBURSEMENT":
				return "Loan Disbursement";
			case "LOAN_REPAYMENT":
				return "Loan Repayment";
			default:
				return "All";
		}
	};

	if (loading) {
		return (
			<DashboardLayout userName={userName} title="Transactions">
				<div className="flex items-center justify-center h-64">
					<div className="w-16 h-16 border-4 border-purple-primary border-t-transparent rounded-full animate-spin"></div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout userName={userName} title="Transactions">
			<div className="w-full bg-offwhite min-h-screen px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
				<div className="space-y-6">
					{/* Main Transactions Card */}
					<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
						{/* Header - Following dashboard card pattern */}
						<div className="p-4 sm:p-6 lg:p-8">
							<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
								<div className="flex items-center">
									<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
										<WalletIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
									</div>
									<div className="min-w-0">
										<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
											Transaction History
										</h3>
										<p className="text-sm lg:text-base text-purple-primary font-semibold">
											{transactions.length} total transaction{transactions.length !== 1 ? "s" : ""}
										</p>
									</div>
								</div>
								<button
									onClick={async () => {
										setRefreshing(true);
										try {
											await fetchTransactions();
											toast.success("Transactions refreshed successfully");
										} catch (error) {
											console.error("Error refreshing transactions:", error);
											toast.error("Failed to refresh transactions");
										} finally {
											setRefreshing(false);
										}
									}}
									disabled={refreshing}
									className="group inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-white hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 rounded-lg shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
									title="Refresh transaction data"
								>
									<ArrowPathIcon className={`h-4 w-4 mr-2 text-gray-500 group-hover:text-blue-600 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'}`} />
									<span className="group-hover:text-blue-700 transition-colors">
										{refreshing ? 'Refreshing...' : 'Refresh All Data'}
									</span>
								</button>
							</div>

							{/* Transaction Type Filter */}
							{transactions.length > 0 && (
								<div className="mb-6">
									<div className="flex flex-wrap gap-2 sm:gap-3">
										{[
											"ALL",
											"LOAN_DISBURSEMENT",
											"LOAN_REPAYMENT",
										].map((type) => (
											<button
												key={type}
												onClick={() =>
													setTransactionFilter(type)
												}
												className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 font-body whitespace-nowrap ${
													transactionFilter === type
														? "bg-purple-primary text-white shadow-sm"
														: "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
												}`}
											>
												{getTransactionTypeLabel(type)}
											</button>
										))}
									</div>
								</div>
							)}

							{/* Transactions List */}
							<div className="space-y-4">
								{loading ? (
									<div className="text-center py-8 sm:py-12">
										<div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
										<p className="mt-4 text-sm sm:text-base text-gray-500 font-body">
											Loading transactions...
										</p>
									</div>
								) : getFilteredTransactions().length > 0 ? (
									<div className="space-y-3">
										{getFilteredTransactions().map(
											(transaction) => (
																							<div
												key={transaction.id}
												className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 lg:p-6 border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200 bg-white hover:border-gray-300 gap-4 sm:gap-0"
											>
												<div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
													<div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-200">
														{getTransactionIcon(
															transaction.type
														)}
													</div>
													<div className="min-w-0 flex-1 overflow-hidden">
														<p className="text-sm sm:text-base lg:text-lg font-semibold text-gray-700 font-body line-clamp-2 sm:line-clamp-1 break-words leading-tight">
															{
																transaction.description
															}
														</p>
														<p className="text-xs sm:text-sm lg:text-base text-gray-500 mt-1 font-body truncate">
															{formatDateTime(
																transaction.createdAt
															)}
														</p>
														{transaction.reference && (
															<p className="text-xs lg:text-sm text-gray-500 font-body mt-1 truncate">
																<span className="text-gray-400">Ref:</span> {transaction.reference}
															</p>
														)}
													</div>
												</div>
												<div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start flex-shrink-0 sm:ml-4 sm:text-right gap-2 sm:gap-0">
													<p className={`text-base sm:text-lg lg:text-xl font-heading font-bold sm:mb-2 ${
														transaction.amount > 0
															? "text-green-600"
															: "text-gray-700"
													}`}>
														{transaction.amount > 0 ? "+" : ""}
														{formatCurrency(transaction.amount)}
													</p>
													<div className="flex-shrink-0">
														{getStatusBadge(transaction.status)}
													</div>
												</div>
											</div>
											)
										)}
									</div>
								) : transactions.length > 0 ? (
									<div className="text-center py-8 sm:py-12">
										<div className="bg-gray-50 rounded-lg p-4 sm:p-6 lg:p-8 border border-gray-200 max-w-md mx-auto">
											<WalletIcon className="h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-gray-400 mx-auto mb-4" />
											<p className="text-sm sm:text-base lg:text-lg font-medium font-heading text-gray-700 mb-2 px-2">
												No {getTransactionTypeLabel(transactionFilter).toLowerCase()} transactions found
											</p>
											<button
												onClick={() => setTransactionFilter("ALL")}
												className="text-xs sm:text-sm lg:text-base text-purple-primary hover:text-purple-700 font-medium font-body transition-colors"
											>
												Show all transactions
											</button>
										</div>
									</div>
								) : (
									<div className="text-center py-8 sm:py-12">
										<div className="bg-gray-50 rounded-lg p-4 sm:p-6 lg:p-8 border border-gray-200 max-w-md mx-auto">
											<WalletIcon className="h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-gray-400 mx-auto mb-4" />
											<h4 className="text-sm sm:text-base lg:text-lg font-medium font-heading text-gray-700 mb-2 px-2">
												No Transactions Yet
											</h4>
											<p className="text-xs sm:text-sm lg:text-base text-gray-500 font-body leading-relaxed px-2">
												Your transaction history will appear here once you start using your wallet.
											</p>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
}
