"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import {
	WalletIcon,
	ArrowUpIcon,
	ArrowDownIcon,
	CreditCardIcon,
	BanknotesIcon,
	ClockIcon,
	CheckCircleIcon,
	ExclamationTriangleIcon,
	PlusIcon,
	ArrowPathIcon,
	ChevronUpIcon,
	ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { checkAuth, fetchWithTokenRefresh, TokenStorage } from "@/lib/authUtils";

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

export default function WalletPage() {
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

	const [loading, setLoading] = useState<boolean>(true);

	const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
	const [showBankTransferModal, setShowBankTransferModal] =
		useState<boolean>(false);
	const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
	const [depositAmount, setDepositAmount] = useState<string>("");
	const [withdrawAmount, setWithdrawAmount] = useState<string>("");
	const [selectedBankAccount, setSelectedBankAccount] = useState<string>("");
	const [showAddBankModal, setShowAddBankModal] = useState<boolean>(false);
	const [newBankName, setNewBankName] = useState<string>("");
	const [newAccountNumber, setNewAccountNumber] = useState<string>("");
	const [transferConfirmed, setTransferConfirmed] = useState<boolean>(false);
	const [showManageBankModal, setShowManageBankModal] =
		useState<boolean>(false);

	useEffect(() => {
		const checkAuthAndLoadData = async () => {
			try {
				// First check if we have any tokens at all
				const accessToken = TokenStorage.getAccessToken();
				const refreshToken = TokenStorage.getRefreshToken();

				// If no tokens available, immediately redirect to login
				if (!accessToken && !refreshToken) {
					console.log(
						"Wallet - No tokens available, redirecting to login"
					);
					router.push("/login");
					return;
				}

				const isAuthenticated = await checkAuth();
				if (!isAuthenticated) {
					console.log(
						"Wallet - Auth check failed, redirecting to login"
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

				// Load wallet data
				loadWalletData();
			} catch (error) {
				console.error("Wallet - Auth check error:", error);
				// Clear any invalid tokens and redirect to login
				TokenStorage.clearTokens();
				router.push("/login");
			} finally {
				setLoading(false);
			}
		};

		checkAuthAndLoadData();
	}, [router]);

	const loadWalletData = async () => {
		try {
			const data = await fetchWithTokenRefresh<WalletData>("/api/wallet");
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
			console.error("Error loading wallet data:", error);
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

	const handleDepositClick = () => {
		setShowDepositModal(true);
	};

	const handleBankTransferClick = () => {
		setShowDepositModal(false);
		setShowBankTransferModal(true);
	};

	const handleConfirmTransfer = async () => {
		if (!depositAmount || parseFloat(depositAmount) <= 0) {
			alert("Please enter a valid amount");
			return;
		}

		try {
			const response = await fetchWithTokenRefresh(
				"/api/wallet/deposit",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						amount: parseFloat(depositAmount),
						method: "BANK_TRANSFER",
						description: `Bank transfer deposit of ${formatCurrency(
							parseFloat(depositAmount)
						)}`,
					}),
				}
			);

			if (response) {
				// Refresh wallet data
				await loadWalletData();

				// Reset states
				setShowBankTransferModal(false);
				setDepositAmount("");
				setTransferConfirmed(false);

				alert(
					"Deposit request submitted successfully! Your transaction is pending approval."
				);
			}
		} catch (error) {
			console.error("Error creating deposit:", error);
			alert("Failed to submit deposit request. Please try again.");
		}
	};

	const handleWithdrawClick = () => {
		setShowWithdrawModal(true);
	};

	const handleConfirmWithdrawal = async () => {
		if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
			alert("Please enter a valid amount");
			return;
		}

		if (!selectedBankAccount) {
			alert("Please select a bank account");
			return;
		}

		if (parseFloat(withdrawAmount) > walletData.availableForWithdrawal) {
			alert("Insufficient funds available for withdrawal");
			return;
		}

		try {
			const response = await fetchWithTokenRefresh(
				"/api/wallet/withdraw",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						amount: parseFloat(withdrawAmount),
						bankAccount: selectedBankAccount,
						description: `Withdrawal of ${formatCurrency(
							parseFloat(withdrawAmount)
						)} to ${selectedBankAccount}`,
					}),
				}
			);

			if (response) {
				// Refresh wallet data
				await loadWalletData();

				// Reset states
				setShowWithdrawModal(false);
				setWithdrawAmount("");
				setSelectedBankAccount("");

				alert(
					"Withdrawal request submitted successfully! Your transaction is pending approval."
				);
			}
		} catch (error) {
			console.error("Error creating withdrawal:", error);
			alert("Failed to submit withdrawal request. Please try again.");
		}
	};

	const handleAddBankAccount = async () => {
		if (!newBankName || !newAccountNumber) {
			alert("Please fill in all bank account details");
			return;
		}

		try {
			const response = await fetchWithTokenRefresh("/api/users/me", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					bankName: newBankName,
					accountNumber: newAccountNumber,
				}),
			});

			if (response) {
				// Refresh wallet data to get updated bank info
				await loadWalletData();

				// Set the new bank account as selected
				setSelectedBankAccount(`${newBankName} - ${newAccountNumber}`);

				// Reset and close add bank modal
				setNewBankName("");
				setNewAccountNumber("");
				setShowAddBankModal(false);

				alert("Bank account added successfully!");
			}
		} catch (error) {
			console.error("Error adding bank account:", error);
			alert("Failed to add bank account. Please try again.");
		}
	};

	const handleManageBankClick = () => {
		setShowManageBankModal(true);
	};

	const handleEditBankAccount = async () => {
		if (!newBankName || !newAccountNumber) {
			alert("Please fill in all bank account details");
			return;
		}

		try {
			const response = await fetchWithTokenRefresh("/api/users/me", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					bankName: newBankName,
					accountNumber: newAccountNumber,
				}),
			});

			if (response) {
				// Refresh wallet data to get updated bank info
				await loadWalletData();

				// Reset and close modals
				setNewBankName("");
				setNewAccountNumber("");
				setShowManageBankModal(false);
				setShowAddBankModal(false);

				alert("Bank account updated successfully!");
			}
		} catch (error) {
			console.error("Error updating bank account:", error);
			alert("Failed to update bank account. Please try again.");
		}
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		alert("Copied to clipboard!");
	};

	if (loading) {
		return (
			<DashboardLayout userName={userName} title="Wallet">
				<div className="flex items-center justify-center h-64">
					<div className="w-16 h-16 border-4 border-purple-primary border-t-transparent rounded-full animate-spin"></div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout userName={userName} title="Wallet">
			<div className="w-full bg-offwhite min-h-screen px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
				<div className="space-y-6">
					{/* Wallet Balance Card */}
					<div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
						<div className="flex items-center justify-between mb-6">
							<div className="flex items-center space-x-3">
								<div className="p-3 bg-purple-primary/10 rounded-xl border border-purple-primary/20">
									<WalletIcon className="h-8 w-8 text-purple-primary" />
								</div>
								<div>
									<h2 className="text-2xl font-heading font-bold text-purple-primary">
										Wallet Balance
									</h2>
									<p className="text-gray-500 font-body">
										Available funds
									</p>
								</div>
							</div>
							<div className="text-right">
								<div className="text-4xl font-heading font-bold mb-1 text-purple-primary">
									{formatCurrency(walletData.balance)}
								</div>
								<div className="text-gray-500 text-sm font-body">
									Available:{" "}
									{formatCurrency(
										walletData.availableForWithdrawal
									)}
								</div>
							</div>
						</div>

						{/* Quick Actions */}
						<div className="grid grid-cols-2 gap-4">
							<button
								onClick={handleDepositClick}
								className="flex flex-col items-center p-4 bg-purple-primary/5 rounded-xl hover:bg-purple-primary/10 transition-all duration-300 border border-purple-primary/20 hover:border-purple-primary/30 group"
							>
								<ArrowDownIcon className="h-6 w-6 mb-2 text-green-600 group-hover:text-purple-primary transition-colors" />
								<span className="text-sm font-medium font-body text-gray-700">
									Deposit
								</span>
							</button>
							<button
								onClick={handleWithdrawClick}
								className="flex flex-col items-center p-4 bg-blue-tertiary/5 rounded-xl hover:bg-blue-tertiary/10 transition-all duration-300 border border-blue-tertiary/20 hover:border-blue-tertiary/30 group"
							>
								<ArrowUpIcon className="h-6 w-6 mb-2 text-blue-tertiary group-hover:text-blue-600 transition-colors" />
								<span className="text-sm font-medium font-body text-gray-700">
									Withdraw
								</span>
							</button>
						</div>
					</div>

					{/* Stats Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						<div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-gray-500 font-body">
										Total Deposits
									</p>
									<p className="text-2xl font-bold text-green-600 font-heading">
										{formatCurrency(
											walletData.totalDeposits
										)}
									</p>
								</div>
								<div className="p-3 bg-green-100 rounded-xl border border-green-200">
									<ArrowDownIcon className="h-6 w-6 text-green-600" />
								</div>
							</div>
						</div>

						<div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-gray-500 font-body">
										Total Withdrawals
									</p>
									<p className="text-2xl font-bold text-blue-tertiary font-heading">
										{formatCurrency(
											walletData.totalWithdrawals
										)}
									</p>
								</div>
								<div className="p-3 bg-blue-tertiary/10 rounded-xl border border-blue-tertiary/20">
									<ArrowUpIcon className="h-6 w-6 text-blue-tertiary" />
								</div>
							</div>
						</div>

						<div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-gray-500 font-body">
										Total Disbursed
									</p>
									<p className="text-2xl font-bold text-purple-primary font-heading">
										{formatCurrency(
											walletData.totalDisbursed
										)}
									</p>
								</div>
								<div className="p-3 bg-purple-primary/10 rounded-xl border border-purple-primary/20">
									<BanknotesIcon className="h-6 w-6 text-purple-primary" />
								</div>
							</div>
						</div>
					</div>

					{/* Wallet Actions */}
					<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
						<div className="p-6">
							<div className="space-y-6">
								{/* Bank Account Info */}
								<div>
									<h4 className="text-lg font-semibold text-purple-primary mb-4 font-heading">
										Connected Bank Account
									</h4>
									{walletData.bankConnected ? (
										<div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
											<div className="flex items-center">
												<div className="p-3 bg-purple-primary/10 rounded-xl mr-4 border border-purple-primary/20">
													<BanknotesIcon className="h-6 w-6 text-purple-primary" />
												</div>
												<div>
													<p className="font-semibold text-gray-700 font-body">
														{walletData.bankName}
													</p>
													<p className="text-sm text-gray-500 font-body">
														Account{" "}
														{
															walletData.accountNumber
														}
													</p>
												</div>
											</div>
											<button
												className="text-sm font-medium text-purple-primary hover:text-blue-tertiary bg-purple-primary/5 px-3 py-2 rounded-lg hover:bg-purple-primary/10 transition-all duration-300 border border-purple-primary/20 font-body"
												onClick={handleManageBankClick}
											>
												Manage
											</button>
										</div>
									) : (
										<div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
											<div className="flex items-center">
												<div className="p-3 bg-amber-100 rounded-xl mr-4 border border-amber-200">
													<ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
												</div>
												<div>
													<p className="font-semibold text-gray-700 font-body">
														No Bank Account
														Connected
													</p>
													<p className="text-sm text-gray-500 font-body">
														Connect your bank
														account to enable
														transfers
													</p>
												</div>
											</div>
											<button
												onClick={() =>
													setShowManageBankModal(true)
												}
												className="text-sm font-medium text-amber-700 hover:text-amber-800 bg-amber-100 px-3 py-2 rounded-lg hover:bg-amber-200 transition-all duration-300 border border-amber-200 font-body"
											>
												Connect Now
											</button>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Deposit Method Selection Modal */}
				{showDepositModal && (
					<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
						<div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-lg border border-gray-200">
							<div className="p-6">
								<div className="flex items-center justify-between mb-6">
									<h2 className="text-xl font-bold font-heading text-purple-primary">
										How would you like to deposit?
									</h2>
									<button
										onClick={() =>
											setShowDepositModal(false)
										}
										className="text-gray-400 hover:text-gray-600"
									>
										<svg
											className="w-6 h-6"
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

								<div className="space-y-4">
									{/* FPX Express Deposit */}
									<div className="border border-gray-200 rounded-xl p-4 hover:border-purple-primary/50 transition-colors bg-gray-50">
										<div className="flex items-center justify-between mb-3">
											<div className="flex items-center space-x-3">
												<div className="w-10 h-10 bg-purple-primary/10 rounded-lg flex items-center justify-center border border-purple-primary/20">
													<span className="text-purple-primary font-bold text-sm font-body">
														FPX
													</span>
												</div>
												<div>
													<h3 className="font-semibold text-gray-700 font-body">
														FPX Express Deposit
													</h3>
													<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-tertiary/10 text-blue-tertiary border border-blue-tertiary/20 font-body">
														Popular
													</span>
												</div>
											</div>
											<svg
												className="w-5 h-5 text-gray-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9 5l7 7-7 7"
												/>
											</svg>
										</div>
										<div className="space-y-2 text-sm text-gray-500 font-body">
											<div className="flex justify-between">
												<span>Estimated Arrival</span>
												<span>Usually 5 Min</span>
											</div>
											<div className="flex justify-between">
												<span>Fees</span>
												<span>Free</span>
											</div>
											<div className="flex justify-between">
												<span>Currency</span>
												<span>MYR</span>
											</div>
											<div className="flex justify-between">
												<span>Supported Banks</span>
												<span>
													Most Malaysian Banks
												</span>
											</div>
										</div>
									</div>

									{/* Bank Transfer */}
									<button
										onClick={handleBankTransferClick}
										className="w-full border border-gray-200 rounded-xl p-4 hover:border-purple-primary/50 hover:bg-purple-primary/5 transition-colors text-left bg-gray-50"
									>
										<div className="flex items-center justify-between mb-3">
											<h3 className="font-semibold text-gray-700 font-body">
												Bank Transfer
											</h3>
											<svg
												className="w-5 h-5 text-gray-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9 5l7 7-7 7"
												/>
											</svg>
										</div>
										<div className="space-y-2 text-sm text-gray-500 font-body">
											<div className="flex justify-between">
												<span>Estimated Arrival</span>
												<span>
													Usually 1 Business Day
												</span>
											</div>
											<div className="flex justify-between">
												<span>Fees</span>
												<span>Free</span>
											</div>
											<div className="flex justify-between">
												<span>Currency</span>
												<span>MYR</span>
											</div>
											<div className="flex justify-between">
												<span>Supported Banks</span>
												<span>
													Most Malaysian Banks
												</span>
											</div>
										</div>
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Bank Transfer Details Modal */}
				{showBankTransferModal && (
					<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
						<div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-lg border border-gray-200">
							<div className="p-6">
								<div className="flex items-center justify-between mb-6">
									<h2 className="text-xl font-bold font-heading text-purple-primary">
										Bank Transfer
									</h2>
									<button
										onClick={() => {
											setShowBankTransferModal(false);
											setDepositAmount("");
											setTransferConfirmed(false);
										}}
										className="text-gray-400 hover:text-gray-600"
									>
										<svg
											className="w-6 h-6"
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

								{/* Amount Input */}
								<div className="mb-6">
									<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
										Deposit Amount (MYR)
									</label>
									<input
										type="number"
										value={depositAmount}
										onChange={(e) =>
											setDepositAmount(e.target.value)
										}
										placeholder="0.00"
										className="block w-full h-12 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary transition-colors font-body text-gray-700"
										min="1"
										step="0.01"
									/>
								</div>

								{/* Instructions */}
								<div className="mb-6 space-y-3 text-sm text-gray-600 font-body">
									<div className="flex items-start space-x-2">
										<div className="w-2 h-2 bg-purple-primary rounded-full mt-2 flex-shrink-0"></div>
										<p>
											Please transfer funds only from your
											bank account named{" "}
											<span className="font-semibold text-gray-700">
												{userName.toUpperCase()}
											</span>
											.{" "}
											<span className="text-blue-tertiary">
												We do not accept transfers from
												third-party bank accounts.
											</span>
										</p>
									</div>
									<div className="flex items-start space-x-2">
										<div className="w-2 h-2 bg-purple-primary rounded-full mt-2 flex-shrink-0"></div>
										<p>
											We recommend using Instant Transfer
											(DuitNow Transfer).
										</p>
									</div>
									<div className="flex items-start space-x-2">
										<div className="w-2 h-2 bg-purple-primary rounded-full mt-2 flex-shrink-0"></div>
										<p>
											We do not accept any cash deposits.
										</p>
									</div>
								</div>

								{/* Bank Details */}
								<div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-4 border border-gray-200">
									<div>
										<p className="text-sm text-gray-600 mb-1 font-body">
											Beneficiary Account Number
										</p>
										<div className="flex items-center justify-between">
											<p className="font-mono text-lg font-semibold text-gray-700">
												001866001878013
											</p>
											<button
												onClick={() =>
													copyToClipboard(
														"001866001878013"
													)
												}
												className="text-purple-primary hover:text-blue-tertiary text-sm font-medium font-body"
											>
												Copy
											</button>
										</div>
										<p className="text-xs text-gray-500 mt-1 font-body">
											The account number is exclusive to{" "}
											{userName.toUpperCase()}
										</p>
									</div>

									<div>
										<p className="text-sm text-gray-600 mb-1 font-body">
											Beneficiary Name
										</p>
										<div className="flex items-center justify-between">
											<p className="font-mono text-lg font-semibold text-gray-700">
												GROWKAPITAL187813
											</p>
											<button
												onClick={() =>
													copyToClipboard(
														"GROWKAPITAL187813"
													)
												}
												className="text-purple-primary hover:text-blue-tertiary text-sm font-medium font-body"
											>
												Copy
											</button>
										</div>
									</div>

									<div>
										<p className="text-sm text-gray-600 mb-1 font-body">
											Beneficiary Bank
										</p>
										<div className="flex items-center justify-between">
											<p className="font-semibold text-gray-700 font-body">
												HSBC Bank Malaysia Berhad
											</p>
											<button
												onClick={() =>
													copyToClipboard(
														"HSBC Bank Malaysia Berhad"
													)
												}
												className="text-purple-primary hover:text-blue-tertiary text-sm font-medium font-body"
											>
												Copy
											</button>
										</div>
									</div>

									<div>
										<p className="text-sm text-gray-600 mb-1 font-body">
											Reference (Required)
										</p>
										<div className="flex items-center justify-between">
											<p className="font-mono text-lg font-semibold text-blue-tertiary">
												105358340
											</p>
											<button
												onClick={() =>
													copyToClipboard("105358340")
												}
												className="text-purple-primary hover:text-blue-tertiary text-sm font-medium font-body"
											>
												Copy
											</button>
										</div>
										<p className="text-xs text-gray-500 mt-1 font-body">
											Please enter your reference ID
											accurately in the "Reference field".
											Otherwise, your deposit will be
											delayed.
										</p>
									</div>
								</div>

								{/* Confirmation Checkbox */}
								<div className="mb-6">
									<label className="flex items-start space-x-3">
										<input
											type="checkbox"
											checked={transferConfirmed}
											onChange={(e) =>
												setTransferConfirmed(
													e.target.checked
												)
											}
											className="mt-1 h-4 w-4 bg-white border-gray-300 rounded text-purple-primary focus:ring-purple-primary/20 focus:ring-2"
										/>
										<span className="text-sm text-gray-600 font-body">
											I confirm that I have completed the
											bank transfer of{" "}
											{depositAmount
												? formatCurrency(
														parseFloat(
															depositAmount
														)
												  )
												: "the specified amount"}{" "}
											to the above bank account details.
										</span>
									</label>
								</div>

								{/* Submit Button */}
								<button
									onClick={handleConfirmTransfer}
									disabled={
										!transferConfirmed ||
										!depositAmount ||
										parseFloat(depositAmount) <= 0
									}
									className="w-full bg-purple-primary text-white font-semibold py-3 px-6 rounded-xl hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-body"
								>
									Confirm Deposit
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Withdrawal Modal */}
				{showWithdrawModal && (
					<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
						<div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-lg border border-gray-200">
							<div className="p-6">
								<div className="flex items-center justify-between mb-6">
									<h2 className="text-xl font-bold font-heading text-purple-primary">
										Withdrawal
									</h2>
									<button
										onClick={() => {
											setShowWithdrawModal(false);
											setWithdrawAmount("");
											setSelectedBankAccount("");
										}}
										className="text-gray-400 hover:text-gray-600"
									>
										<svg
											className="w-6 h-6"
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

								{/* Transfer To Section */}
								<div className="mb-6">
									<h3 className="text-lg font-semibold mb-4 font-heading text-purple-primary">
										Transfer To
									</h3>

									{/* Bank Account Selection */}
									<div className="mb-4">
										<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
											Select Bank Account
										</label>
										<select
											value={selectedBankAccount}
											onChange={(e) =>
												setSelectedBankAccount(
													e.target.value
												)
											}
											className="block w-full h-12 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary transition-colors font-body text-gray-700"
										>
											<option value="">
												Select an account
											</option>
											{walletData.bankConnected && (
												<option
													value={`${walletData.bankName} - ${walletData.accountNumber}`}
												>
													{walletData.bankName} -{" "}
													{walletData.accountNumber}
												</option>
											)}
										</select>
									</div>

									{/* Add/Edit Bank Account Link */}
									<div className="text-center">
										<button
											onClick={() => {
												setShowWithdrawModal(false);
												setShowManageBankModal(true);
											}}
											className="text-sm text-purple-primary hover:text-blue-tertiary transition-colors font-body"
										>
											{walletData.bankConnected
												? "Edit Bank Account"
												: "Add Bank Account"}
										</button>
									</div>
								</div>

								{/* Withdrawal Amount */}
								<div className="mb-6">
									<div className="flex items-center justify-between mb-2">
										<label className="block text-sm font-medium text-gray-700 font-body">
											Withdrawal Amount (MYR)
										</label>
										<button
											onClick={() =>
												setWithdrawAmount(
													walletData.availableForWithdrawal.toString()
												)
											}
											className="text-sm text-purple-primary hover:text-blue-tertiary font-medium font-body"
										>
											All
										</button>
									</div>
									<input
										type="number"
										value={withdrawAmount}
										onChange={(e) =>
											setWithdrawAmount(e.target.value)
										}
										placeholder="0.00"
										className="block w-full h-12 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary transition-colors font-body text-gray-700"
										min="1"
										step="0.01"
										max={walletData.availableForWithdrawal}
									/>
									<div className="flex justify-between text-sm text-gray-600 mt-2 font-body">
										<span>Available Amount</span>
										<span>
											{formatCurrency(
												walletData.availableForWithdrawal
											)}
										</span>
									</div>
									<div className="flex justify-between text-sm text-gray-600 font-body">
										<span>Bank Fees</span>
										<span>Free</span>
									</div>
									<div className="flex justify-between text-sm text-gray-600 font-body">
										<span>Arrival</span>
										<span>Usually 1 Business Day</span>
									</div>
								</div>

								{/* Submit Button */}
								<button
									onClick={handleConfirmWithdrawal}
									disabled={
										!selectedBankAccount ||
										!withdrawAmount ||
										parseFloat(withdrawAmount) <= 0 ||
										parseFloat(withdrawAmount) >
											walletData.availableForWithdrawal
									}
									className="w-full bg-purple-primary text-white font-semibold py-3 px-6 rounded-xl hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-body"
								>
									Withdraw
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Manage Bank Account Modal */}
				{showManageBankModal && (
					<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
						<div className="bg-white rounded-xl max-w-md w-full shadow-lg border border-gray-200">
							<div className="p-6">
								<div className="flex items-center justify-between mb-6">
									<h2 className="text-xl font-bold font-heading text-purple-primary">
										{walletData.bankConnected
											? "Edit Bank Account"
											: "Add Bank Account"}
									</h2>
									<button
										onClick={() => {
											setShowManageBankModal(false);
											setNewBankName("");
											setNewAccountNumber("");
										}}
										className="text-gray-400 hover:text-gray-600"
									>
										<svg
											className="w-6 h-6"
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

								{/* Bank Name Input */}
								<div className="mb-4">
									<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
										Bank Name
									</label>
									<input
										type="text"
										value={newBankName}
										onChange={(e) =>
											setNewBankName(e.target.value)
										}
										placeholder="e.g., Maybank, CIMB Bank"
										className="block w-full h-12 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary transition-colors font-body text-gray-700"
										defaultValue={walletData.bankName}
									/>
								</div>

								{/* Account Number Input */}
								<div className="mb-6">
									<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
										Account Number
									</label>
									<input
										type="text"
										value={newAccountNumber}
										onChange={(e) =>
											setNewAccountNumber(e.target.value)
										}
										placeholder="Enter your account number"
										className="block w-full h-12 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary transition-colors font-body text-gray-700"
										defaultValue={walletData.accountNumber}
									/>
								</div>

								{/* Action Buttons */}
								<div className="flex space-x-3">
									<button
										onClick={() => {
											setShowManageBankModal(false);
											setNewBankName("");
											setNewAccountNumber("");
										}}
										className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-gray-200 transition-colors font-body"
									>
										Cancel
									</button>
									<button
										onClick={handleEditBankAccount}
										disabled={
											!newBankName || !newAccountNumber
										}
										className="flex-1 bg-purple-primary text-white font-semibold py-3 px-4 rounded-xl hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-body"
									>
										{walletData.bankConnected
											? "Update"
											: "Add"}
									</button>
								</div>

								{walletData.bankConnected && (
									<div className="mt-6 pt-6 border-t border-gray-200">
										<div className="flex items-center space-x-2 text-sm text-gray-600 font-body">
											<ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
											<p>
												Updating your bank account will
												affect all future transactions.
											</p>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		</DashboardLayout>
	);
}
