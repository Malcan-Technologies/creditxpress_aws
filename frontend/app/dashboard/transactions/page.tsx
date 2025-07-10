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
} from "@heroicons/react/24/outline";
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

	useEffect(() => {
		const checkAuthAndLoadData = async () => {
			try {
				// First check if we have any tokens at all
				const accessToken = TokenStorage.getAccessToken();
				const refreshToken = TokenStorage.getRefreshToken();

				// If no tokens available, immediately redirect to login
				if (!accessToken && !refreshToken) {
					console.log(
						"Transactions - No tokens available, redirecting to login"
					);
					router.push("/login");
					return;
				}

				const isAuthenticated = await checkAuth();
				if (!isAuthenticated) {
					console.log(
						"Transactions - Auth check failed, redirecting to login"
					);
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
					<ArrowDownIcon className="h-5 w-5 text-purple-primary" />
				);
			case "WITHDRAWAL":
				return <ArrowUpIcon className="h-5 w-5 text-blue-tertiary" />;
			case "LOAN_REPAYMENT":
				return (
					<svg
						className="h-5 w-5 text-green-600"
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
				return <WalletIcon className="h-5 w-5 text-gray-500" />;
		}
	};

	const getStatusBadge = (status: Transaction["status"]) => {
		switch (status) {
			case "APPROVED":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 font-body">
						<CheckCircleIcon className="h-3 w-3 mr-1" />
						Approved
					</span>
				);
			case "PENDING":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 font-body">
						<ClockIcon className="h-3 w-3 mr-1" />
						Pending
					</span>
				);
			case "REJECTED":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 font-body">
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
					<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
						{/* Card Header */}
						<div className="p-6 pb-0">
							<div className="flex items-center space-x-2 mb-6">
								<div className="p-2 bg-purple-primary/10 rounded-lg border border-purple-primary/20">
									<WalletIcon className="h-5 w-5 text-purple-primary" />
								</div>
								<h3 className="text-lg font-heading text-purple-primary font-semibold">
									All Transactions
								</h3>
								<span className="text-sm text-gray-500 font-body ml-auto">
									{transactions.length} Total Transaction
									{transactions.length !== 1 ? "s" : ""}
								</span>
							</div>
						</div>

						<div className="p-6 pt-0">
							{/* Transaction Type Filter */}
							{transactions.length > 0 && (
								<div className="mb-6">
									<div className="flex flex-wrap gap-2">
										{[
											"ALL",
											"DEPOSIT",
											"WITHDRAWAL",
											"LOAN_DISBURSEMENT",
											"LOAN_REPAYMENT",
										].map((type) => (
											<button
												key={type}
												onClick={() =>
													setTransactionFilter(type)
												}
												className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors font-body ${
													transactionFilter === type
														? "bg-purple-primary text-white"
														: "bg-gray-100 text-gray-700 hover:bg-blue-tertiary hover:text-white"
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
									<div className="text-center py-8">
										<div className="w-16 h-16 border-4 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
										<p className="mt-4 text-gray-500 font-body">
											Loading transactions...
										</p>
									</div>
								) : getFilteredTransactions().length > 0 ? (
									<div className="space-y-4">
										{getFilteredTransactions().map(
											(transaction) => (
												<div
													key={transaction.id}
													className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-offwhite hover:border-purple-primary/30 transition-all duration-200 bg-white"
												>
													<div className="flex items-center space-x-4 min-w-0 flex-1">
														<div className="p-2 bg-gray-50 rounded-xl flex-shrink-0 border border-gray-200">
															{getTransactionIcon(
																transaction.type
															)}
														</div>
														<div className="min-w-0 flex-1">
															<p className="font-semibold text-gray-700 truncate font-body">
																{
																	transaction.description
																}
															</p>
															<p className="text-sm text-gray-500 mt-1 font-body">
																{formatDateTime(
																	transaction.createdAt
																)}
															</p>
															{transaction.reference && (
																<p className="text-xs text-gray-500 truncate font-body">
																	Ref:{" "}
																	{
																		transaction.reference
																	}
																</p>
															)}
														</div>
													</div>
													<div className="text-right flex-shrink-0 ml-4">
														<p
															className={`font-bold text-lg font-body ${
																transaction.type ===
																"LOAN_REPAYMENT"
																	? "text-green-600"
																	: transaction.amount >
																	  0
																	? "text-purple-primary"
																	: "text-blue-tertiary"
															}`}
														>
															{transaction.amount >
															0
																? "+"
																: ""}
															{formatCurrency(
																transaction.amount
															)}
														</p>
														<div className="mt-1">
															{getStatusBadge(
																transaction.status
															)}
														</div>
													</div>
												</div>
											)
										)}
									</div>
								) : transactions.length > 0 ? (
									<div className="text-center py-12">
										<WalletIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
										<p className="text-gray-500 mb-2 font-body">
											No{" "}
											{getTransactionTypeLabel(
												transactionFilter
											).toLowerCase()}{" "}
											transactions found
										</p>
										<button
											onClick={() =>
												setTransactionFilter("ALL")
											}
											className="text-sm text-purple-primary hover:text-blue-tertiary font-medium font-body transition-colors"
										>
											Show all transactions
										</button>
									</div>
								) : (
									<div className="text-center py-12">
										<WalletIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
										<h4 className="text-lg font-medium text-gray-700 mb-2 font-heading">
											No Transactions Yet
										</h4>
										<p className="text-gray-500 mb-4 font-body">
											Your transaction history will appear
											here once you start using your
											wallet.
										</p>
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
