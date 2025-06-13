"use client";

import { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import Link from "next/link";
import {
	CreditCardIcon,
	BanknotesIcon,
	ClockIcon,
	UserCircleIcon,
	MagnifyingGlassIcon,
	ExclamationTriangleIcon,
	ArrowPathIcon,
	ArrowsRightLeftIcon,
	DocumentTextIcon,
	ChevronRightIcon,
	EyeIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";

interface LoanData {
	id: string;
	userId: string;
	applicationId: string;
	principalAmount: number;
	outstandingBalance: number;
	interestRate: number;
	term: number;
	monthlyPayment: number;
	nextPaymentDue: string | null;
	status: string;
	disbursedAt: string | null;
	createdAt: string;
	updatedAt: string;
	application: {
		id: string;
		amount: number;
		purpose: string;
		product: {
			name: string;
			code: string;
		};
		user: {
			id: string;
			fullName: string;
			email: string;
			phoneNumber: string;
			employmentStatus?: string;
			employerName?: string;
			monthlyIncome?: string;
			bankName?: string;
			accountNumber?: string;
		};
	};
	user: {
		id: string;
		fullName: string;
		email: string;
		phoneNumber: string;
	};
	repayments?: Array<{
		id: string;
		amount: number;
		principalAmount: number;
		interestAmount: number;
		status: string;
		dueDate: string;
		paidAt: string | null;
		createdAt: string;
	}>;
}

export default function ActiveLoansPage() {
	const [loans, setLoans] = useState<LoanData[]>([]);
	const [filteredLoans, setFilteredLoans] = useState<LoanData[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedLoan, setSelectedLoan] = useState<LoanData | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetchActiveLoans();
	}, []);

	useEffect(() => {
		filterLoans();
	}, [loans, searchTerm, statusFilter]);

	const fetchActiveLoans = async () => {
		try {
			setLoading(true);
			setError(null);

			// Fetch loans from the admin loans endpoint
			const response = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: LoanData[];
			}>("/api/admin/loans");

			if (response.success && response.data) {
				// Filter for only ACTIVE loans from the loans table
				const activeLoans = response.data.filter(
					(loan) => loan.status === "ACTIVE"
				);
				setLoans(activeLoans);
			} else {
				setError("Failed to load loans data");
			}
		} catch (error) {
			console.error("Error fetching active loans:", error);
			setError("Failed to load loans. Please try again.");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	const filterLoans = () => {
		let filtered = [...loans];

		// Apply status filter based on payment status
		if (statusFilter === "late") {
			filtered = filtered.filter((loan) => {
				if (!loan.nextPaymentDue) return false;
				const dueDate = new Date(loan.nextPaymentDue);
				const today = new Date();
				return dueDate < today;
			});
		} else if (statusFilter === "current") {
			filtered = filtered.filter((loan) => {
				if (!loan.nextPaymentDue) return true;
				const dueDate = new Date(loan.nextPaymentDue);
				const today = new Date();
				return dueDate >= today;
			});
		}

		// Apply search filter
		if (searchTerm) {
			const search = searchTerm.toLowerCase();
			filtered = filtered.filter(
				(loan) =>
					loan.user.fullName.toLowerCase().includes(search) ||
					loan.user.email.toLowerCase().includes(search) ||
					loan.id.toLowerCase().includes(search) ||
					loan.application.product.name
						.toLowerCase()
						.includes(search) ||
					(loan.application.purpose &&
						loan.application.purpose.toLowerCase().includes(search))
			);
		}

		setFilteredLoans(filtered);
	};

	const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchTerm(e.target.value);
	};

	const handleRefresh = () => {
		setRefreshing(true);
		fetchActiveLoans();
	};

	const handleViewLoan = (loan: LoanData) => {
		setSelectedLoan(loan);
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-MY", {
			style: "currency",
			currency: "MYR",
		}).format(amount);
	};

	const formatDate = (dateString: string | null) => {
		if (!dateString) return "N/A";
		return new Date(dateString).toLocaleDateString("en-MY", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	};

	const getDaysLate = (nextPaymentDue: string | null) => {
		if (!nextPaymentDue) return 0;
		const dueDate = new Date(nextPaymentDue);
		const today = new Date();
		const diffTime = today.getTime() - dueDate.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays > 0 ? diffDays : 0;
	};

	const getLateStatusColor = (daysLate: number) => {
		if (daysLate === 0)
			return {
				bg: "bg-green-500/20",
				text: "text-green-200",
				border: "border-green-400/20",
			};
		if (daysLate <= 15)
			return {
				bg: "bg-yellow-500/20",
				text: "text-yellow-200",
				border: "border-yellow-400/20",
			};
		if (daysLate <= 30)
			return {
				bg: "bg-orange-500/20",
				text: "text-orange-200",
				border: "border-orange-400/20",
			};
		return {
			bg: "bg-red-500/20",
			text: "text-red-200",
			border: "border-red-400/20",
		};
	};

	const getPaymentStatusText = (daysLate: number) => {
		if (daysLate === 0) return "Current";
		if (daysLate <= 15) return `${daysLate} days late`;
		if (daysLate <= 30) return `${daysLate} days late (Warning)`;
		if (daysLate > 30) return `${daysLate} days late (Critical)`;
		return "Unknown";
	};

	const calculateProgress = (loan: LoanData) => {
		if (loan.principalAmount === 0) return 0;
		return (
			((loan.principalAmount - loan.outstandingBalance) /
				loan.principalAmount) *
			100
		);
	};

	if (loading) {
		return (
			<AdminLayout
				title="Active Loans"
				description="Manage and monitor currently active loans"
			>
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
				</div>
			</AdminLayout>
		);
	}

	return (
		<AdminLayout
			title="Active Loans"
			description="Manage and monitor currently active loans"
		>
			{/* Header and Controls */}
			<div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="text-xl font-semibold text-white mb-2">
						Active Loans Management
					</h2>
					<p className="text-gray-400">
						{filteredLoans.length} active loan
						{filteredLoans.length !== 1 ? "s" : ""} with total
						outstanding:{" "}
						{formatCurrency(
							filteredLoans.reduce(
								(sum, loan) => sum + loan.outstandingBalance,
								0
							)
						)}
					</p>
				</div>
				<button
					onClick={handleRefresh}
					disabled={refreshing}
					className="mt-4 md:mt-0 flex items-center px-4 py-2 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors"
				>
					{refreshing ? (
						<ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<ArrowPathIcon className="h-4 w-4 mr-2" />
					)}
					Refresh Data
				</button>
			</div>

			{/* Error Message */}
			{error && (
				<div className="mb-6 bg-red-700/30 border border-red-600/30 text-red-300 px-4 py-3 rounded-lg">
					{error}
				</div>
			)}

			{/* Search and Filter Bar */}
			<div className="mb-6 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
				<div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
					<div className="flex-1 relative">
						<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
							<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
						</div>
						<input
							type="text"
							className="block w-full pl-10 pr-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
							placeholder="Search by name, email, loan ID, or purpose"
							value={searchTerm}
							onChange={handleSearch}
						/>
					</div>
					<div className="flex space-x-2">
						<button
							onClick={() => setStatusFilter("all")}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								statusFilter === "all"
									? "bg-blue-500/30 text-blue-100 border-blue-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							All Loans
						</button>
						<button
							onClick={() => setStatusFilter("current")}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								statusFilter === "current"
									? "bg-green-500/30 text-green-100 border-green-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							Current
						</button>
						<button
							onClick={() => setStatusFilter("late")}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								statusFilter === "late"
									? "bg-red-500/30 text-red-100 border-red-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							Late
						</button>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Panel - Loan List */}
				<div className="lg:col-span-1">
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
						<div className="p-4 border-b border-gray-700/30">
							<h3 className="text-lg font-medium text-white">
								Active Loans ({filteredLoans.length})
							</h3>
						</div>
						<div className="overflow-y-auto max-h-[70vh]">
							{filteredLoans.length > 0 ? (
								<ul className="divide-y divide-gray-700/30">
									{filteredLoans.map((loan) => {
										const daysLate = getDaysLate(
											loan.nextPaymentDue
										);
										const lateStatus =
											getLateStatusColor(daysLate);

										return (
											<li
												key={loan.id}
												className={`p-4 hover:bg-gray-800/30 transition-colors cursor-pointer ${
													selectedLoan?.id === loan.id
														? "bg-gray-800/50"
														: ""
												}`}
												onClick={() =>
													handleViewLoan(loan)
												}
											>
												<div className="flex justify-between items-start">
													<div className="flex-1">
														<p className="text-white font-medium">
															{loan.user.fullName}
														</p>
														<p className="text-sm text-gray-400">
															{loan.user.email}
														</p>
														<div className="mt-2 flex items-center text-sm text-gray-300">
															<CreditCardIcon className="mr-1 h-4 w-4 text-blue-400" />
															{formatCurrency(
																loan.principalAmount
															)}
														</div>
														<p className="text-xs text-gray-400 mt-1">
															{
																loan.application
																	.product
																	.name
															}
														</p>
													</div>
													<div className="text-right ml-4">
														<span
															className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${lateStatus.bg} ${lateStatus.text} ${lateStatus.border}`}
														>
															{getPaymentStatusText(
																daysLate
															)}
														</span>
														<p className="text-xs text-gray-400 mt-2">
															Outstanding:
														</p>
														<p className="text-xs font-medium text-white">
															{formatCurrency(
																loan.outstandingBalance
															)}
														</p>
													</div>
												</div>
											</li>
										);
									})}
								</ul>
							) : (
								<div className="p-8 text-center">
									<ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
									<p className="mt-4 text-gray-300">
										No active loans found
									</p>
									{searchTerm && (
										<p className="text-sm text-gray-400 mt-2">
											Try adjusting your search criteria
										</p>
									)}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Right Panel - Loan Details */}
				<div className="lg:col-span-2">
					{selectedLoan ? (
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
							<div className="p-4 border-b border-gray-700/30 flex justify-between items-center">
								<h3 className="text-lg font-medium text-white">
									Loan Details
								</h3>
								<span className="px-2 py-1 bg-blue-500/20 text-blue-200 text-xs font-medium rounded-full border border-blue-400/20">
									ID: {selectedLoan.id.substring(0, 8)}
								</span>
							</div>

							<div className="p-6">
								{/* Summary Cards */}
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
										<p className="text-gray-400 text-sm mb-1">
											Outstanding Balance
										</p>
										<p className="text-2xl font-bold text-white">
											{formatCurrency(
												selectedLoan.outstandingBalance
											)}
										</p>
										<p className="text-xs text-gray-400 mt-1">
											of{" "}
											{formatCurrency(
												selectedLoan.principalAmount
											)}
										</p>
									</div>
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
										<p className="text-gray-400 text-sm mb-1">
											Monthly Payment
										</p>
										<p className="text-2xl font-bold text-white">
											{formatCurrency(
												selectedLoan.monthlyPayment
											)}
										</p>
										<p className="text-xs text-gray-400 mt-1">
											Next:{" "}
											{formatDate(
												selectedLoan.nextPaymentDue
											)}
										</p>
									</div>
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
										<p className="text-gray-400 text-sm mb-1">
											Progress
										</p>
										<p className="text-2xl font-bold text-white">
											{Math.round(
												calculateProgress(selectedLoan)
											)}
											%
										</p>
										<p className="text-xs text-gray-400 mt-1">
											{selectedLoan.term} months term
										</p>
									</div>
								</div>

								{/* Payment Status Alert */}
								{(() => {
									const daysLate = getDaysLate(
										selectedLoan.nextPaymentDue
									);
									if (daysLate > 0) {
										const lateStatus =
											getLateStatusColor(daysLate);
										return (
											<div
												className={`p-4 rounded-lg mb-6 border ${lateStatus.bg} ${lateStatus.border}`}
											>
												<div className="flex items-start">
													<ExclamationTriangleIcon
														className={`h-5 w-5 mr-2 mt-0.5 ${lateStatus.text}`}
													/>
													<div>
														<p
															className={`font-medium ${lateStatus.text}`}
														>
															Payment Overdue:{" "}
															{daysLate} days late
														</p>
														<p className="text-sm text-gray-300 mt-1">
															Next payment was
															due:{" "}
															{formatDate(
																selectedLoan.nextPaymentDue
															)}
														</p>
													</div>
												</div>
											</div>
										);
									}
									return null;
								})()}

								{/* Loan Details */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
									{/* Customer Information */}
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
										<h4 className="text-white font-medium mb-3 flex items-center">
											<UserCircleIcon className="h-5 w-5 mr-2 text-blue-400" />
											Customer Information
										</h4>
										<div className="space-y-3">
											<div>
												<p className="text-gray-400 text-sm">
													Full Name
												</p>
												<p className="text-white">
													{selectedLoan.user.fullName}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Email
												</p>
												<p className="text-white">
													{selectedLoan.user.email}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Phone
												</p>
												<p className="text-white">
													{selectedLoan.user
														.phoneNumber || "N/A"}
												</p>
											</div>
											{selectedLoan.application.user
												.employmentStatus && (
												<div>
													<p className="text-gray-400 text-sm">
														Employment
													</p>
													<p className="text-white">
														{
															selectedLoan
																.application
																.user
																.employmentStatus
														}
													</p>
												</div>
											)}
										</div>
									</div>

									{/* Loan Terms */}
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
										<h4 className="text-white font-medium mb-3 flex items-center">
											<DocumentTextIcon className="h-5 w-5 mr-2 text-green-400" />
											Loan Terms
										</h4>
										<div className="space-y-3">
											<div>
												<p className="text-gray-400 text-sm">
													Product
												</p>
												<p className="text-white">
													{
														selectedLoan.application
															.product.name
													}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Purpose
												</p>
												<p className="text-white">
													{selectedLoan.application
														.purpose || "N/A"}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Term
												</p>
												<p className="text-white">
													{selectedLoan.term} months
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Interest Rate
												</p>
												<p className="text-white">
													{selectedLoan.interestRate}%
													p.a.
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Disbursement Date
												</p>
												<p className="text-white">
													{formatDate(
														selectedLoan.disbursedAt
													)}
												</p>
											</div>
										</div>
									</div>
								</div>

								{/* Repayment Progress */}
								<div className="mb-6">
									<h4 className="text-white font-medium mb-3">
										Repayment Progress
									</h4>
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
										{/* Progress Bar */}
										<div className="mb-4">
											<div className="flex justify-between text-sm mb-1">
												<span className="text-gray-400">
													Progress
												</span>
												<span className="text-white">
													{Math.round(
														calculateProgress(
															selectedLoan
														)
													)}
													%
												</span>
											</div>
											<div className="w-full bg-gray-700 rounded-full h-2.5">
												<div
													className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
													style={{
														width: `${calculateProgress(
															selectedLoan
														)}%`,
													}}
												></div>
											</div>
										</div>

										<div className="flex justify-between text-sm text-gray-400">
											<div>
												<p>Paid Amount</p>
												<p className="text-white font-medium">
													{formatCurrency(
														selectedLoan.principalAmount -
															selectedLoan.outstandingBalance
													)}
												</p>
											</div>
											<div className="text-right">
												<p>Remaining</p>
												<p className="text-white font-medium">
													{formatCurrency(
														selectedLoan.outstandingBalance
													)}
												</p>
											</div>
										</div>
									</div>
								</div>

								{/* Action Buttons */}
								<div className="flex flex-wrap gap-3">
									<Link
										href={`/dashboard/loans/${selectedLoan.id}/repayments`}
										className="px-4 py-2 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors flex items-center"
									>
										<ArrowsRightLeftIcon className="h-5 w-5 mr-2" />
										View Repayments
									</Link>
									<Link
										href={`/dashboard/applications/${selectedLoan.applicationId}`}
										className="px-4 py-2 bg-purple-500/20 text-purple-200 rounded-lg border border-purple-400/20 hover:bg-purple-500/30 transition-colors flex items-center"
									>
										<DocumentTextIcon className="h-5 w-5 mr-2" />
										View Application
									</Link>
								</div>
							</div>
						</div>
					) : (
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg h-full flex items-center justify-center p-8">
							<div className="text-center">
								<CreditCardIcon className="mx-auto h-16 w-16 text-gray-500" />
								<h3 className="mt-4 text-xl font-medium text-white">
									No Loan Selected
								</h3>
								<p className="mt-2 text-gray-400">
									Select a loan from the list to view its
									details
								</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</AdminLayout>
	);
}
