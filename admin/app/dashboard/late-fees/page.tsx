"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AdminLayout from "../../components/AdminLayout";
import Link from "next/link";
import {
	MagnifyingGlassIcon,
	ArrowPathIcon,
	ExclamationTriangleIcon,
	UserCircleIcon,
	DocumentTextIcon,
	BanknotesIcon,
	CalendarIcon,
	CheckCircleIcon,
	XCircleIcon,
	ClockIcon,
	CreditCardIcon,
	XMarkIcon,
	ChartBarIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";
import { toast } from "sonner";

interface LateFeeData {
	id: string;
	loanRepaymentId: string;
	calculationDate: string;
	daysOverdue: number;
	outstandingPrincipal: number;
	dailyRate: number;
	feeAmount: number;
	outstandingFeeAmount?: number; // Outstanding late fees still owed
	cumulativeFees: number;
	feeType: "INTEREST" | "FIXED" | "COMBINED";
	fixedFeeAmount?: number;
	frequencyDays?: number;
	interestFeesTotal?: number;
	fixedFeesTotal?: number;
	status: "ACTIVE" | "PAID" | "WAIVED";
	createdAt: string;
	updatedAt: string;
			loanRepayment: {
			id: string;
			amount: number;
			principalAmount: number;
			interestAmount: number;
			dueDate: string;
			status: string;
			installmentNumber: number;
			actualAmount?: number | null;
			paidAt?: string | null;
			paymentType?: string | null;
			lateFeeAmount: number;
			lateFeesPaid: number;
			principalPaid: number;
			loan: {
				id: string;
				principalAmount: number;
				outstandingBalance: number;
				monthlyPayment: number;
				user: {
					id: string;
					fullName: string | null;
					email: string | null;
					phoneNumber: string;
				};
				application: {
					id: string;
					product: {
						name: string;
						code: string;
					};
				};
			};
		};
}

interface ProcessingStatus {
	lastProcessed: string | null;
	lastStatus: string;
	processedToday: boolean;
	todayProcessingCount: number;
	lastError: string | null;
	systemHealth: "healthy" | "warning" | "critical";
	alerts: Array<{
		id: string;
		type: string;
		severity: "HIGH" | "MEDIUM" | "LOW";
		title: string;
		message: string;
		timestamp: string;
		details: any;
		suggestedAction: string;
		impact: string;
		category: string;
		systemComponent: string;
		environment: string;
	}>;
	alertSummary: {
		total: number;
		high: number;
		medium: number;
		low: number;
	};
}

function LateFeeContent({ initialSearchTerm }: { initialSearchTerm: string }) {
	const [lateFees, setLateFees] = useState<LateFeeData[]>([]);
	const [filteredLateFees, setFilteredLateFees] = useState<LateFeeData[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedLateFee, setSelectedLateFee] = useState<LateFeeData | null>(
		null
	);
	const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
	const [statusFilter, setStatusFilter] = useState("ACTIVE");
	const [filterCounts, setFilterCounts] = useState({
		all: 0,
		ACTIVE: 0,
		PAID: 0,
		WAIVED: 0,
	});
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [processingStatus, setProcessingStatus] =
		useState<ProcessingStatus | null>(null);
	const [processing, setProcessing] = useState(false);
	const [lastRefresh, setLastRefresh] = useState<Date | null>(null);


	// Update search term when initialSearchTerm changes
	useEffect(() => {
		setSearchTerm(initialSearchTerm);
	}, [initialSearchTerm]);

	const fetchLateFees = async () => {
		try {
			setLoading(true);
			setError(null);

			// Fetch late fees data with cache busting
			const timestamp = Date.now();
			const response = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: LateFeeData[];
			}>(`/api/admin/late-fees?_t=${timestamp}`, {
				cache: "no-cache",
				headers: {
					"Cache-Control": "no-cache, no-store, must-revalidate",
					Pragma: "no-cache",
					Expires: "0",
				},
			});

			if (response.success && response.data) {
				setLateFees(response.data);
				
				// Calculate filter counts
				const counts = {
					all: response.data.length,
					ACTIVE: response.data.filter((f: LateFeeData) => f.status === "ACTIVE").length,
					PAID: response.data.filter((f: LateFeeData) => f.status === "PAID").length,
					WAIVED: response.data.filter((f: LateFeeData) => f.status === "WAIVED").length,
				};
				setFilterCounts(counts);
			} else {
				setError("Failed to load late fees data");
			}

			// Fetch basic processing status (simplified)
			try {
				const statusResponse = await fetchWithAdminTokenRefresh<{
					success: boolean;
					data: ProcessingStatus;
				}>(`/api/admin/late-fees/status?_t=${timestamp}`, {
					cache: "no-cache",
					headers: {
						"Cache-Control": "no-cache, no-store, must-revalidate",
						Pragma: "no-cache",
						Expires: "0",
					},
				});

				if (statusResponse.success && statusResponse.data) {
					setProcessingStatus(statusResponse.data);
				}
			} catch (statusError) {
				console.warn("Could not fetch processing status:", statusError);
				// Don't fail the entire operation if status fetch fails
			}
		} catch (error) {
			console.error("Error fetching overdue payment fees:", error);
			setError("Failed to load overdue payment fees. Please try again.");
		} finally {
			setLoading(false);
			setRefreshing(false);
			setLastRefresh(new Date());
		}
	};

	useEffect(() => {
		fetchLateFees();
	}, []);

	const filterLateFees = useCallback(() => {
		let filtered = [...lateFees];

		// Apply status filter
		if (statusFilter !== "all") {
			filtered = filtered.filter((fee) => fee.status === statusFilter);
		}

		// Apply search filter
		if (searchTerm) {
			const search = searchTerm.toLowerCase();

			// First, check for exact loan ID match
			const exactLoanMatch = filtered.find(
				(fee) => fee.loanRepayment.loan.id.toLowerCase() === search
			);

			if (exactLoanMatch) {
				filtered = [exactLoanMatch];
			} else {
				// Otherwise, do partial matching across all fields
				filtered = filtered.filter(
					(fee) =>
						fee.loanRepayment.loan.user.fullName
							?.toLowerCase()
							.includes(search) ||
						fee.loanRepayment.loan.user.email
							?.toLowerCase()
							.includes(search) ||
						fee.loanRepayment.loan.user.phoneNumber
							.toLowerCase()
							.includes(search) ||
						fee.loanRepayment.loan.application.product.name
							.toLowerCase()
							.includes(search) ||
						fee.loanRepayment.loan.id
							.toLowerCase()
							.includes(search) ||
						fee.loanRepayment.loan.application.id
							.toLowerCase()
							.includes(search) ||
						fee.id.toLowerCase().includes(search)
				);
			}
		}

		setFilteredLateFees(filtered);
		return filtered;
	}, [lateFees, searchTerm, statusFilter]);

	// Handle auto-selection and update selected fee with fresh data
	useEffect(() => {
		const filtered = filteredLateFees;

		if (filtered.length > 0) {
			if (!selectedLateFee) {
				// No selection, select the first one
				setSelectedLateFee(filtered[0]);
			} else {
				// Update the selected fee with fresh data if it exists in filtered results
				const updatedSelectedFee = filtered.find(
					(fee) => fee.id === selectedLateFee.id
				);
				if (updatedSelectedFee) {
					// Update with fresh data
					setSelectedLateFee(updatedSelectedFee);
				} else {
					// Selected fee no longer exists in filtered results, select first available
					setSelectedLateFee(filtered[0]);
				}
			}
		} else {
			setSelectedLateFee(null);
		}
	}, [filteredLateFees]);

	useEffect(() => {
		filterLateFees();
	}, [filterLateFees]);

	const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchTerm(e.target.value);
	};

	const handleRefresh = async () => {
		setRefreshing(true);
		// Clear selected late fee to force re-selection with fresh data
		setSelectedLateFee(null);
		try {
			await fetchLateFees();
			toast.success("Late fees refreshed successfully");
		} catch (error) {
			console.error("Error refreshing late fees:", error);
			toast.error("Failed to refresh late fees");
		}
	};

	const handleViewLateFee = (fee: LateFeeData) => {
		setSelectedLateFee(fee);
	};

	const handleManualProcessing = async () => {
		setProcessing(true);
		try {
			const response = await fetchWithAdminTokenRefresh<{
				success: boolean;
				message: string;
				data: {
					lateFeeResult: {
						success?: boolean;
						feesCalculated: number;
						totalFeeAmount: number;
						overdueRepayments: number;
						processingTimeMs: number;
						isManualRun?: boolean;
					};
					defaultResult: {
						success: boolean;
						riskLoansProcessed: number;
						remedyLoansProcessed: number;
						defaultedLoans: number;
						recoveredLoans: number;
						whatsappMessagesSent: number;
						pdfLettersGenerated: number;
						processingTimeMs: number;
						isManualRun?: boolean;
					};
				};
			}>("/api/admin/late-fees/process", {
				method: "POST",
			});

			if (response.success && response.data) {
				const {
					feesCalculated,
					totalFeeAmount,
					overdueRepayments,
					processingTimeMs,
				} = response.data.lateFeeResult;

				const {
					riskLoansProcessed,
					defaultedLoans,
					pdfLettersGenerated,
				} = response.data.defaultResult;

				// Show detailed success message
				const message =
					`Processing complete! Found ${overdueRepayments} overdue repayments, calculated ${feesCalculated} new fees ($${totalFeeAmount.toFixed(2)}). ` +
					`${riskLoansProcessed} loans flagged as risk, ${defaultedLoans} defaulted, ${pdfLettersGenerated} PDF letters generated.`;

				toast.success(message);

				// Force a complete refresh of all data
				setSelectedLateFee(null);
				await fetchLateFees();
			} else {
				throw new Error(
					response.message || "Failed to process overdue payment fees"
				);
			}
		} catch (error) {
			console.error("Error processing overdue payment fees:", error);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			toast.error(
				`Failed to process overdue payment fees: ${errorMessage}. Please try again.`
			);
		} finally {
			setProcessing(false);
		}
	};



	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-MY", {
			style: "currency",
			currency: "MYR",
		}).format(amount);
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-MY", {
			day: "numeric",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "ACTIVE":
				return {
					bg: "bg-red-500/20",
					text: "text-red-200",
					border: "border-red-400/20",
				};
			case "PAID":
				return {
					bg: "bg-green-500/20",
					text: "text-green-200",
					border: "border-green-400/20",
				};
			case "WAIVED":
				return {
					bg: "bg-yellow-500/20",
					text: "text-yellow-200",
					border: "border-yellow-400/20",
				};
			default:
				return {
					bg: "bg-gray-500/20",
					text: "text-gray-200",
					border: "border-gray-400/20",
				};
		}
	};

	const getRepaymentStatusColor = (status: string) => {
		switch (status) {
			case "COMPLETED":
				return {
					bg: "bg-green-500/20",
					text: "text-green-200",
					border: "border-green-400/20",
				};
			case "PENDING":
				return {
					bg: "bg-orange-500/20",
					text: "text-orange-200",
					border: "border-orange-400/20",
				};
			case "OVERDUE":
				return {
					bg: "bg-red-500/20",
					text: "text-red-200",
					border: "border-red-400/20",
				};
			default:
				return {
					bg: "bg-gray-500/20",
					text: "text-gray-200",
					border: "border-gray-400/20",
				};
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "ACTIVE":
				return ExclamationTriangleIcon;
			case "PAID":
				return CheckCircleIcon;
			case "WAIVED":
				return XCircleIcon;
			default:
				return ClockIcon;
		}
	};

	if (loading) {
		return (
			<AdminLayout
				title="Overdue Payments"
				description="Manage and monitor overdue payment fees"
			>
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
				</div>
			</AdminLayout>
		);
	}

	const totalOverdueAmount = filteredLateFees.reduce(
		(sum, fee) =>
			sum +
			(fee.loanRepayment.principalAmount || 0) +
			(fee.loanRepayment.interestAmount || 0) +
			fee.feeAmount,
		0
	);

	const totalActiveFees = filteredLateFees
		.reduce((sum, fee) => {
			const lateFeeAmount = fee.loanRepayment.lateFeeAmount || 0;
			const lateFeesPaid = fee.loanRepayment.lateFeesPaid || 0;
			const outstandingFees = Math.max(0, lateFeeAmount - lateFeesPaid);
			return sum + outstandingFees;
		}, 0);

	return (
		<AdminLayout
			title="Overdue Payments"
			description="Manage and monitor overdue payment fees"
		>
			{/* Simple Status Bar */}
			{processingStatus && (
				<div className="mb-6 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between">
						<div className="flex items-center space-x-4">
							<div className="flex items-center">
								<span className="text-gray-400 text-sm mr-2">
									Last Processed:
								</span>
								<span className="text-white text-sm">
									{processingStatus.lastProcessed
										? formatDate(
												processingStatus.lastProcessed
										  )
										: "Never"}
								</span>
							</div>
							<div className="flex items-center">
								<span className="text-gray-400 text-sm mr-2">
									Daily Processing:
								</span>
								<span
									className={`text-sm font-medium ${
										processingStatus.processedToday
											? "text-green-400"
											: "text-yellow-400"
									}`}
								>
									{processingStatus.processedToday
										? "✅ Completed Today"
										: "⏳ Pending"}
								</span>
							</div>
						</div>
						<button
							onClick={handleManualProcessing}
							disabled={processing}
							className="mt-4 md:mt-0 px-4 py-2 bg-purple-500/20 text-purple-200 rounded-lg border border-purple-400/20 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
						>
							{processing
								? "Processing..."
								: "Run Manual Fee Processing"}
						</button>
					</div>
					{processingStatus.lastError && (
						<div className="mt-3 p-3 bg-red-900/20 border border-red-600/30 rounded-lg">
							<div className="flex items-center">
								<ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
								<span className="text-red-300 text-sm font-medium">
									Last Processing Error:
								</span>
							</div>
							<p className="text-red-200 text-sm mt-1">
								{processingStatus.lastError}
							</p>
						</div>
					)}
				</div>
			)}

			{/* Header and Controls */}
			<div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="text-xl font-semibold text-white mb-2">
						Overdue Payment Fees
					</h2>
					<p className="text-gray-400">
						{filteredLateFees.length} overdue payment record
						{filteredLateFees.length !== 1 ? "s" : ""} • Total
						overdue: {formatCurrency(totalOverdueAmount)} • Outstanding
						fees: {formatCurrency(totalActiveFees)}
					</p>
				</div>
				<div className="mt-4 md:mt-0 flex flex-col items-end">
					<button
						onClick={handleRefresh}
						disabled={refreshing}
						className="flex items-center px-4 py-2 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors"
					>
						{refreshing ? (
							<ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<ArrowPathIcon className="h-4 w-4 mr-2" />
						)}
						Refresh
					</button>
					{lastRefresh && (
						<p className="text-xs text-gray-400 mt-1">
							Last updated: {lastRefresh.toLocaleTimeString()}
						</p>
					)}
				</div>
			</div>

			{/* Error Message */}
			{error && (
				<div className="mb-6 bg-red-700/30 border border-red-600/30 text-red-300 px-4 py-3 rounded-lg">
					{error}
				</div>
			)}

			{/* Search Bar */}
			<div className="mb-4 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
				<div className="flex-1 relative">
					<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
					</div>
					<input
						type="text"
						className="block w-full pl-10 pr-10 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
						placeholder="Search by customer name, email, phone, loan ID, or product"
						value={searchTerm}
						onChange={handleSearch}
					/>
					{searchTerm && (
						<button
							onClick={() => setSearchTerm("")}
							className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300 transition-colors"
							title="Clear search"
						>
							<XMarkIcon className="h-4 w-4" />
						</button>
					)}
				</div>
			</div>

			{/* Filter Buttons */}
			<div className="mb-6 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
				<div className="flex flex-wrap gap-2">
					<button
						onClick={() => setStatusFilter("all")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "all"
								? "bg-blue-500/30 text-blue-100 border-blue-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						All ({filterCounts.all})
					</button>
					<button
						onClick={() => setStatusFilter("ACTIVE")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "ACTIVE"
								? "bg-red-500/30 text-red-100 border-red-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Active ({filterCounts.ACTIVE})
					</button>
					<button
						onClick={() => setStatusFilter("PAID")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "PAID"
								? "bg-green-500/30 text-green-100 border-green-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Paid ({filterCounts.PAID})
					</button>
					<button
						onClick={() => setStatusFilter("WAIVED")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "WAIVED"
								? "bg-yellow-500/30 text-yellow-100 border-yellow-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Waived ({filterCounts.WAIVED})
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Panel - Overdue Payments List */}
				<div className="lg:col-span-1">
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
						<div className="p-4 border-b border-gray-700/30">
							<h3 className="text-lg font-medium text-white">
								Overdue Payments ({filteredLateFees.length})
							</h3>
						</div>
						<div className="overflow-y-auto max-h-[70vh]">
							{filteredLateFees.length > 0 ? (
								<ul className="divide-y divide-gray-700/30">
									{filteredLateFees.map((fee) => {
										const statusColor = getStatusColor(
											fee.status
										);
										const StatusIcon = getStatusIcon(
											fee.status
										);

										return (
											<li
												key={fee.id}
												className={`p-4 hover:bg-gray-800/30 transition-colors cursor-pointer ${
													selectedLateFee?.id ===
													fee.id
														? "bg-gray-800/50"
														: ""
												}`}
												onClick={() =>
													handleViewLateFee(fee)
												}
											>
												<div className="flex justify-between items-start">
													<div className="flex-1">
														<p className="text-white font-medium">
															{fee.loanRepayment
																.loan.user
																.fullName ||
																"N/A"}
														</p>
														<p className="text-sm text-gray-400">
															Installment #
															{
																fee
																	.loanRepayment
																	.installmentNumber
															}
														</p>
														<div className="mt-2 flex items-center text-sm">
															<BanknotesIcon className="mr-1 h-4 w-4 text-red-400" />
															{(() => {
																const lateFeeAmount = fee.loanRepayment.lateFeeAmount || 0;
																const lateFeesPaid = fee.loanRepayment.lateFeesPaid || 0;
																const outstandingFees = Math.max(0, lateFeeAmount - lateFeesPaid);
																const colorClass = outstandingFees === 0 ? "text-green-400" : "text-gray-300";
																return (
																	<span className={colorClass}>
																		{formatCurrency(outstandingFees)}
																	</span>
																);
															})()}
														</div>
														<p className="text-xs text-gray-400 mt-1">
															Outstanding fees
														</p>
														{(() => {
															const lateFeeAmount = fee.loanRepayment.lateFeeAmount || 0;
															const lateFeesPaid = fee.loanRepayment.lateFeesPaid || 0;
															
															if (lateFeesPaid > 0) {
																return (
																	<div className="mt-1">
																		<p className="text-xs text-green-400">
																			{formatCurrency(lateFeesPaid)} paid
																		</p>
																	</div>
																);
															}
															return null;
														})()}
														{fee.loanRepayment
															.actualAmount && (
															<>
																<div className="mt-2 border-t border-gray-700/30 pt-2">
																	<p className="text-xs text-green-400">
																		Paid:{" "}
																		{formatCurrency(
																			fee
																				.loanRepayment
																				.actualAmount
																		)}
																	</p>
																</div>
															</>
														)}
														<div className="mt-2">
															{(() => {
																const originalAmount = (fee.loanRepayment.principalAmount || 0) + 
																	(fee.loanRepayment.interestAmount || 0);
																const principalPaid = fee.loanRepayment.principalPaid || 0;
																const lateFeeAmount = fee.loanRepayment.lateFeeAmount || 0;
																const lateFeesPaid = fee.loanRepayment.lateFeesPaid || 0;
																const outstandingLateFees = Math.max(0, lateFeeAmount - lateFeesPaid);
																const remainingScheduledAmount = Math.max(0, originalAmount - principalPaid);
																const totalDue = remainingScheduledAmount + outstandingLateFees;
																
																if (totalDue === 0) {
																	return (
																		<div className="mb-2 px-2 py-1 bg-green-900/20 border border-green-600/30 rounded text-xs">
																			<p className="text-green-300 font-medium">✅ Fully Paid</p>
																		</div>
																	);
																} else if (remainingScheduledAmount === 0) {
																	return (
																		<div className="mb-2 px-2 py-1 bg-yellow-900/20 border border-yellow-600/30 rounded text-xs">
																			<p className="text-yellow-300 font-medium">⚠️ Late fees only: {formatCurrency(outstandingLateFees)}</p>
																		</div>
																	);
																} else {
																	return (
																		<div className="mb-2 px-2 py-1 bg-red-900/20 border border-red-600/30 rounded text-xs">
																			<p className="text-red-300 font-medium">💰 Total due: {formatCurrency(totalDue)}</p>
																		</div>
																	);
																}
															})()}
															<p className="text-xs text-gray-400">
																{
																	fee.daysOverdue
																}{" "}
																days overdue
															</p>
															<p className="text-xs text-gray-400">
																{
																	fee
																		.loanRepayment
																		.loan
																		.application
																		.product
																		.name
																}
															</p>
														</div>
													</div>
													<div className="text-right ml-4">
														<span
															className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
														>
															<StatusIcon className="h-3 w-3 mr-1" />
															{fee.status}
														</span>
														<p className="text-xs text-gray-400 mt-2">
															{formatDate(
																fee.calculationDate
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
									<ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
									<p className="mt-4 text-gray-300">
										No overdue payments found
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

				{/* Right Panel - Overdue Payment Details */}
				<div className="lg:col-span-2">
					{selectedLateFee ? (
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
							<div className="p-4 border-b border-gray-700/30 flex justify-between items-start">
								<div>
									<h3 className="text-lg font-medium text-white">
										Overdue Payment Details
									</h3>
									<div className="mt-1.5 flex items-center gap-2">
										{(() => {
											const statusColor = getStatusColor(selectedLateFee.status);
											const StatusIcon = getStatusIcon(selectedLateFee.status);
											return (
												<span
													className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
												>
													<StatusIcon className="h-3.5 w-3.5 mr-1" />
													{selectedLateFee.status}
												</span>
											);
										})()}
									</div>
								</div>
								<span className="px-2 py-1 bg-gray-500/20 text-gray-300 text-xs font-medium rounded-full border border-gray-400/20">
									ID: {selectedLateFee.id.substring(0, 8)}
								</span>
							</div>

							{/* Action Bar */}
							<div className="p-4 border-b border-gray-700/30">
								<div className="flex items-center gap-3">
									<span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</span>
									<div className="h-4 w-px bg-gray-600/50"></div>
									<div className="flex items-center gap-2 flex-wrap">
										{selectedLateFee.loanRepayment.loan.application.id && (
											<Link
												href={`/dashboard/loans?search=${selectedLateFee.loanRepayment.loan.application.id}`}
												className="flex items-center px-3 py-1.5 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors text-xs"
												title="View loan details"
											>
												<CreditCardIcon className="h-3 w-3 mr-1" />
												View Loan Details
											</Link>
										)}
										{selectedLateFee.loanRepayment.loan.id && (
											<Link
												href={`/dashboard/payments?search=${selectedLateFee.loanRepayment.loan.id}&status=all`}
												className="flex items-center px-3 py-1.5 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors text-xs"
												title="View related payments"
											>
												<BanknotesIcon className="h-3 w-3 mr-1" />
												View Related Payments
											</Link>
										)}
									</div>
								</div>
							</div>

							<div className="p-6">
								{/* Summary Cards */}
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
										<p className="text-gray-400 text-sm mb-1">
											Total Late Fees
										</p>
										{(() => {
											const lateFeeAmount = selectedLateFee.loanRepayment.lateFeeAmount || 0;
											return (
												<p className="text-2xl font-bold text-red-400">
													{formatCurrency(lateFeeAmount)}
												</p>
											);
										})()}
										{(() => {
											const lateFeeAmount = selectedLateFee.loanRepayment.lateFeeAmount || 0;
											const lateFeesPaid = selectedLateFee.loanRepayment.lateFeesPaid || 0;
											if (lateFeesPaid > 0) {
												return (
													<p className="text-xs text-green-400 mt-1">
														{formatCurrency(lateFeesPaid)} paid
													</p>
												);
											}
											return null;
										})()}
									</div>
									{/* Show Outstanding Fees for all statuses */}
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
										<p className="text-gray-400 text-sm mb-1">
											Outstanding Fees
										</p>
										{(() => {
											const lateFeeAmount = selectedLateFee.loanRepayment.lateFeeAmount || 0;
											const lateFeesPaid = selectedLateFee.loanRepayment.lateFeesPaid || 0;
											const outstandingFees = Math.max(0, lateFeeAmount - lateFeesPaid);
											const colorClass = outstandingFees === 0 ? "text-green-400" : "text-orange-400";
											
											return (
												<p className={`text-2xl font-bold ${colorClass}`}>
													{formatCurrency(outstandingFees)}
												</p>
											);
										})()}
									</div>
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
										<p className="text-gray-400 text-sm mb-1">
											Days Overdue
										</p>
										<p className="text-2xl font-bold text-white">
											{selectedLateFee.daysOverdue}
										</p>
									</div>
								</div>

								{/* Total Amount Due Breakdown */}
								<div className="bg-gradient-to-br from-red-900/20 to-red-800/20 p-4 rounded-lg border border-red-600/30 mb-6">
									<h4 className="text-white font-medium mb-3 flex items-center">
										<ExclamationTriangleIcon className="h-5 w-5 mr-2 text-red-400" />
										Total Amount Due
									</h4>
									{(() => {
										const originalAmount = (selectedLateFee.loanRepayment.principalAmount || 0) + 
											(selectedLateFee.loanRepayment.interestAmount || 0);
										const actualAmountPaid = selectedLateFee.loanRepayment.actualAmount || 0;
										const lateFeeAmount = selectedLateFee.loanRepayment.lateFeeAmount || 0;
										const lateFeesPaid = selectedLateFee.loanRepayment.lateFeesPaid || 0;
										const principalPaid = selectedLateFee.loanRepayment.principalPaid || 0;
										const outstandingLateFees = Math.max(0, lateFeeAmount - lateFeesPaid);
										
										// Calculate breakdown using correct payment allocation
										// The backend allocates payments: late fees first, then principal
										const scheduledPaymentPaid = principalPaid; // Use actual principalPaid from backend
										const remainingScheduledAmount = Math.max(0, originalAmount - principalPaid);
										const totalDue = remainingScheduledAmount + outstandingLateFees;
										
										return (
											<div className="space-y-3">
												<div className="flex justify-between text-sm">
													<span className="text-gray-300">
														Original Amount (Principal + Interest):
													</span>
													<span className="text-white font-medium">
														{formatCurrency(originalAmount)}
													</span>
												</div>
												
												{scheduledPaymentPaid > 0 && (
													<div className="flex justify-between text-sm">
														<span className="text-gray-300">
															Scheduled Payment Paid:
														</span>
														<span className="text-green-300 font-medium">
															-{formatCurrency(scheduledPaymentPaid)}
														</span>
													</div>
												)}
												
												{remainingScheduledAmount > 0 && (
													<div className="flex justify-between text-sm">
														<span className="text-gray-300">
															Remaining Scheduled Amount:
														</span>
														<span className="text-red-300 font-medium">
															{formatCurrency(remainingScheduledAmount)}
														</span>
													</div>
												)}
												
												<div className="flex justify-between text-sm">
													<span className="text-gray-300">
														Total Late Fees Assessed:
													</span>
													<span className="text-red-300 font-medium">
														{formatCurrency(lateFeeAmount)}
													</span>
												</div>
												
												{lateFeesPaid > 0 && (
													<div className="flex justify-between text-sm">
														<span className="text-gray-300">
															Late Fees Paid:
														</span>
														<span className="text-green-300 font-medium">
															-{formatCurrency(lateFeesPaid)}
														</span>
													</div>
												)}
												
												{/* Show Outstanding Late Fees for all statuses when there are outstanding fees */}
												{outstandingLateFees > 0 && (
													<div className="flex justify-between text-sm">
														<span className="text-gray-300">
															Outstanding Late Fees:
														</span>
														<span className="text-orange-300 font-medium">
															{formatCurrency(outstandingLateFees)}
														</span>
													</div>
												)}
												
												<div className="border-t border-red-600/30 pt-3">
													<div className="flex justify-between">
														<span className="text-white font-semibold text-lg">
															Total Due:
														</span>
														{(() => {
															// Determine color based on payment status
															let colorClass = "text-red-300"; // Default: red for outstanding balance
															if (totalDue === 0) {
																colorClass = "text-green-300"; // Green for fully paid
															} else if (remainingScheduledAmount === 0) {
																colorClass = "text-yellow-300"; // Yellow for only late fees remaining
															}
															
															return (
																<span className={`font-bold text-xl ${colorClass}`}>
																	{formatCurrency(totalDue)}
																</span>
															);
														})()}
													</div>
													
													{actualAmountPaid > 0 && (
														<div className="mt-2 text-xs text-gray-400">
															{(() => {
																if (totalDue === 0) {
																	return "✅ Fully Paid";
																} else if (remainingScheduledAmount === 0) {
																	return `Outstanding Late Fees: ${formatCurrency(outstandingLateFees)}`;
																} else {
																	return `Remaining: ${formatCurrency(remainingScheduledAmount)} + Late Fees: ${formatCurrency(outstandingLateFees)}`;
																}
															})()}
														</div>
													)}
												</div>
											</div>
										);
									})()}
								</div>

								{/* Details */}
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
													{selectedLateFee
														.loanRepayment.loan.user
														.fullName || "N/A"}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Email
												</p>
												<p className="text-white">
													{selectedLateFee
														.loanRepayment.loan.user
														.email || "N/A"}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Phone
												</p>
												<p className="text-white">
													{
														selectedLateFee
															.loanRepayment.loan
															.user.phoneNumber
													}
												</p>
											</div>
										</div>
									</div>

									{/* Overdue Fee Calculation */}
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
										<h4 className="text-white font-medium mb-3 flex items-center">
											<ChartBarIcon className="h-5 w-5 mr-2 text-red-400" />
											Overdue Fee Calculation
										</h4>
										<div className="space-y-3">
											<div>
												<p className="text-gray-400 text-sm">
													Outstanding Principal
												</p>
												<p className="text-white">
													{formatCurrency(
														selectedLateFee.outstandingPrincipal
													)}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Daily Rate
												</p>
												<p className="text-white">
													{(
														selectedLateFee.dailyRate *
														100
													).toFixed(5)}
													%
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Calculation Date
												</p>
												<p className="text-white">
													{formatDate(
														selectedLateFee.calculationDate
													)}
												</p>
											</div>
										</div>
									</div>
								</div>

								{/* Repayment Information */}
								<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 mb-6">
									<h4 className="text-white font-medium mb-3 flex items-center">
										<DocumentTextIcon className="h-5 w-5 mr-2 text-purple-400" />
										Related Repayment
									</h4>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<p className="text-gray-400 text-sm">
												Installment Number
											</p>
											<p className="text-white">
												#
												{
													selectedLateFee
														.loanRepayment
														.installmentNumber
												}
											</p>
										</div>
										<div>
											<p className="text-gray-400 text-sm">
												Due Date
											</p>
											<p className="text-white">
												{formatDate(
													selectedLateFee
														.loanRepayment.dueDate
												)}
											</p>
										</div>
										<div>
											<p className="text-gray-400 text-sm">
												Scheduled Amount
											</p>
											<p className="text-white">
												{formatCurrency(
													selectedLateFee
														.loanRepayment.amount
												)}
											</p>
										</div>
										<div>
											<p className="text-gray-400 text-sm">
												Repayment Status
											</p>
											{(() => {
												const repaymentStatusColor =
													getRepaymentStatusColor(
														selectedLateFee
															.loanRepayment
															.status
													);
												return (
													<span
														className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${repaymentStatusColor.bg} ${repaymentStatusColor.text} ${repaymentStatusColor.border}`}
													>
														{
															selectedLateFee
																.loanRepayment
																.status
														}
													</span>
												);
											})()}
										</div>
										{selectedLateFee.loanRepayment
											.actualAmount && (
											<div>
												<p className="text-gray-400 text-sm">
													Amount Paid
												</p>
												<p className="text-green-400 font-medium">
													{formatCurrency(
														selectedLateFee
															.loanRepayment
															.actualAmount
													)}
												</p>
											</div>
										)}
										{selectedLateFee.loanRepayment
											.paidAt && (
											<div>
												<p className="text-gray-400 text-sm">
													Payment Date
												</p>
												<p className="text-white">
													{formatDate(
														selectedLateFee
															.loanRepayment
															.paidAt
													)}
												</p>
											</div>
										)}
										{selectedLateFee.loanRepayment
											.paymentType && (
											<div>
												<p className="text-gray-400 text-sm">
													Payment Type
												</p>
												<p className="text-white">
													{
														selectedLateFee
															.loanRepayment
															.paymentType
													}
												</p>
											</div>
										)}
										{selectedLateFee.loanRepayment
											.actualAmount &&
											selectedLateFee.loanRepayment
												.actualAmount <
												selectedLateFee.loanRepayment
													.amount && (
												<div className="md:col-span-2">
													<div className="bg-orange-900/20 p-3 rounded-lg border border-orange-600/30">
														<p className="text-orange-300 text-sm font-medium mb-1">
															Partial Payment
														</p>
														<p className="text-orange-200 text-sm">
															Outstanding:{" "}
															{formatCurrency(
																selectedLateFee
																	.loanRepayment
																	.amount -
																	selectedLateFee
																		.loanRepayment
																		.actualAmount
															)}{" "}
															- Late fees will
															continue to compound
															until fully paid.
														</p>
													</div>
												</div>
											)}
									</div>
								</div>

								{/* Loan Information */}
								<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 mb-6">
									<h4 className="text-white font-medium mb-3 flex items-center">
										<BanknotesIcon className="h-5 w-5 mr-2 text-green-400" />
										Loan Information
									</h4>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<p className="text-gray-400 text-sm">
												Product
											</p>
											<p className="text-white">
												{
													selectedLateFee
														.loanRepayment.loan
														.application.product
														.name
												}
											</p>
										</div>
										<div>
											<p className="text-gray-400 text-sm">
												Principal Amount
											</p>
											<p className="text-white">
												{formatCurrency(
													selectedLateFee
														.loanRepayment.loan
														.principalAmount
												)}
											</p>
										</div>
										<div>
											<p className="text-gray-400 text-sm">
												Outstanding Balance
											</p>
											<p className="text-white">
												{formatCurrency(
													selectedLateFee
														.loanRepayment.loan
														.outstandingBalance
												)}
											</p>
										</div>
										<div>
											<p className="text-gray-400 text-sm">
												Monthly Payment
											</p>
											<p className="text-white">
												{formatCurrency(
													selectedLateFee
														.loanRepayment.loan
														.monthlyPayment
												)}
											</p>
										</div>
									</div>
								</div>

							</div>
						</div>
					) : (
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg h-full flex items-center justify-center p-8">
							<div className="text-center">
								<ChartBarIcon className="mx-auto h-16 w-16 text-gray-500" />
								<h3 className="mt-4 text-xl font-medium text-white">
									No Overdue Payment Selected
								</h3>
								<p className="mt-2 text-gray-400">
									Select an overdue payment from the list to
									view its details
								</p>
							</div>
						</div>
					)}
				</div>
			</div>


		</AdminLayout>
	);
}

function OverduePaymentsPageContent() {
	const searchParams = useSearchParams();
	const initialSearchTerm = searchParams.get("search") || "";

	return <LateFeeContent initialSearchTerm={initialSearchTerm} />;
}

export default function OverduePaymentsPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<OverduePaymentsPageContent />
		</Suspense>
	);
}
