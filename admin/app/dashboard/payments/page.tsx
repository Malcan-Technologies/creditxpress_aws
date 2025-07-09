"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AdminLayout from "../../components/AdminLayout";
import Link from "next/link";
import {
	MagnifyingGlassIcon,
	CreditCardIcon,
	UserIcon,
	BanknotesIcon,
	CalendarIcon,
	CheckCircleIcon,
	XCircleIcon,
	ArrowPathIcon,
	UserCircleIcon,
	DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";

interface PendingPayment {
	id: string;
	amount: number;
	description: string;
	reference?: string;
	createdAt: string;
	metadata: any;
	user: {
		id: string;
		fullName: string;
		email: string;
		phoneNumber: string;
	};
	loan: {
		id: string;
		principalAmount: number;
		outstandingBalance: number;
		monthlyPayment: number;
		application: {
			id: string;
			product: {
				name: string;
			};
		};
	};
}

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

function formatDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString("en-MY", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function getPaymentMethodDisplay(metadata: any): string {
	if (!metadata) return "Unknown";

	if (metadata.paymentMethod === "WALLET_BALANCE") {
		return "Wallet Balance";
	} else if (metadata.paymentMethod === "FRESH_FUNDS") {
		return "Bank Transfer";
	} else if (metadata.paymentMethod === "bank_transfer") {
		return "Bank Transfer";
	} else if (metadata.paymentMethod === "mpesa") {
		return "M-Pesa";
	} else if (metadata.paymentMethod === "card") {
		return "Card Payment";
	}

	return metadata.paymentMethod || "Manual Payment";
}

function getDisplayAmount(payment: PendingPayment): number {
	// Use originalAmount from metadata if available, otherwise use absolute value of amount
	return payment.metadata?.originalAmount || Math.abs(payment.amount);
}

// Note: Using fetchWithAdminTokenRefresh utility for consistent API handling

function PaymentsContent() {
	const searchParams = useSearchParams();
	const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>(
		[]
	);
	const [filteredPayments, setFilteredPayments] = useState<PendingPayment[]>(
		[]
	);
	const [loading, setLoading] = useState(true);
	const [selectedPayment, setSelectedPayment] =
		useState<PendingPayment | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [refreshing, setRefreshing] = useState(false);
	const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
	const [refreshInterval, setRefreshInterval] =
		useState<NodeJS.Timeout | null>(null);

	// Modal states
	const [showApprovalModal, setShowApprovalModal] = useState(false);
	const [showRejectionModal, setShowRejectionModal] = useState(false);
	const [approvalNotes, setApprovalNotes] = useState("");
	const [rejectionReason, setRejectionReason] = useState("");
	const [rejectionNotes, setRejectionNotes] = useState("");
	const [processing, setProcessing] = useState(false);

	// Handle URL search parameter
	useEffect(() => {
		const searchParam = searchParams.get("search");
		if (searchParam) {
			setSearchTerm(searchParam);
		}
	}, [searchParams]);

	// Fetch pending payments with automatic token refresh and cache busting
	const fetchPendingPayments = async (
		showLoader = true,
		bustCache = false
	) => {
		if (showLoader) {
			setRefreshing(true);
		}

		try {
			// Add cache-busting parameter to ensure fresh data
			const cacheBuster = bustCache ? `?_t=${Date.now()}` : "";
			const data = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: PendingPayment[];
			}>(`/api/admin/repayments/pending${cacheBuster}`);

			if (data.success && data.data) {
				setPendingPayments(data.data);
				setLastRefresh(new Date());
			} else {
				throw new Error("Failed to fetch pending payments");
			}
		} catch (error) {
			console.error("Error fetching pending payments:", error);
			setPendingPayments([]);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	// Setup auto-refresh with cleanup
	const setupAutoRefresh = useCallback(() => {
		// Clear any existing interval
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}

		// Set up new interval
		const interval = setInterval(() => {
			fetchPendingPayments(false); // Silent refresh
		}, 30000); // 30 seconds

		setRefreshInterval(interval);
		return interval;
	}, [refreshInterval]);

	// Auto-refresh every 30 seconds to keep data fresh
	useEffect(() => {
		fetchPendingPayments();
		const interval = setupAutoRefresh();

		return () => {
			if (interval) {
				clearInterval(interval);
			}
		};
	}, []);

	// Clean up interval on unmount
	useEffect(() => {
		return () => {
			if (refreshInterval) {
				clearInterval(refreshInterval);
			}
		};
	}, [refreshInterval]);

	// Filter payments based on search term with exact loan ID matching
	const filterPayments = useCallback(() => {
		if (!searchTerm.trim()) {
			setFilteredPayments(pendingPayments);
		} else {
			const search = searchTerm.toLowerCase();

			// First, check for exact loan ID match
			const exactLoanMatch = pendingPayments.find(
				(payment) => payment.loan.id.toLowerCase() === search
			);

			if (exactLoanMatch) {
				// If exact loan ID match found, show only that payment
				setFilteredPayments([exactLoanMatch]);
			} else {
				// Otherwise, do partial matching across all fields
				const filtered = pendingPayments.filter(
					(payment) =>
						payment.user.fullName.toLowerCase().includes(search) ||
						payment.user.email.toLowerCase().includes(search) ||
						payment.id.toLowerCase().includes(search) ||
						payment.reference?.toLowerCase().includes(search) ||
						payment.loan.application.product.name
							.toLowerCase()
							.includes(search) ||
						payment.loan.id.toLowerCase().includes(search) ||
						payment.loan.application.id
							.toLowerCase()
							.includes(search)
				);
				setFilteredPayments(filtered);
			}
		}
	}, [searchTerm, pendingPayments]);

	useEffect(() => {
		filterPayments();
	}, [filterPayments]);

	// Auto-select first payment when filtered list changes
	useEffect(() => {
		if (
			filteredPayments.length > 0 &&
			(!selectedPayment ||
				!filteredPayments.find(
					(payment) => payment.id === selectedPayment.id
				))
		) {
			setSelectedPayment(filteredPayments[0]);
		} else if (filteredPayments.length === 0) {
			setSelectedPayment(null);
		}
	}, [filteredPayments, selectedPayment]);

	const handleViewPayment = (payment: PendingPayment) => {
		setSelectedPayment(payment);
	};

	const handleRefresh = () => {
		setRefreshing(true);
		fetchPendingPayments(true, true); // Force cache bust
	};

	const handleApprovePayment = async () => {
		if (!selectedPayment) return;

		setProcessing(true);
		try {
			// Clear auto-refresh to prevent race conditions
			if (refreshInterval) {
				clearInterval(refreshInterval);
				setRefreshInterval(null);
			}

			const data = await fetchWithAdminTokenRefresh<{
				success: boolean;
				message?: string;
			}>(`/api/admin/repayments/${selectedPayment.id}/approve`, {
				method: "POST",
				body: JSON.stringify({
					notes: approvalNotes,
				}),
			});

			if (data.success) {
				// Remove from pending list immediately
				setPendingPayments((prev) =>
					prev.filter((r) => r.id !== selectedPayment.id)
				);
				setSelectedPayment(null);
				setShowApprovalModal(false);
				setApprovalNotes("");

				// Show success message
				alert("Payment approved successfully!");

				// Force refresh with cache busting
				await fetchPendingPayments(false, true);

				// Restart auto-refresh
				setupAutoRefresh();
			} else {
				throw new Error(data.message || "Failed to approve payment");
			}
		} catch (error) {
			console.error("Error approving payment:", error);

			// Check if payment is no longer pending
			if (
				error instanceof Error &&
				error.message.includes("not pending")
			) {
				alert(
					"This payment has already been processed. Refreshing the list..."
				);
				await fetchPendingPayments(false, true);
				setShowApprovalModal(false);
				setApprovalNotes("");
			} else {
				alert("Failed to approve payment. Please try again.");
			}

			// Restart auto-refresh even on error
			setupAutoRefresh();
		} finally {
			setProcessing(false);
		}
	};

	const handleRejectPayment = async () => {
		if (!selectedPayment) return;

		setProcessing(true);
		try {
			// Clear auto-refresh to prevent race conditions
			if (refreshInterval) {
				clearInterval(refreshInterval);
				setRefreshInterval(null);
			}

			const data = await fetchWithAdminTokenRefresh<{
				success: boolean;
				message?: string;
			}>(`/api/admin/repayments/${selectedPayment.id}/reject`, {
				method: "POST",
				body: JSON.stringify({
					reason: rejectionReason,
					notes: rejectionNotes,
				}),
			});

			if (data.success) {
				// Remove from pending list immediately
				setPendingPayments((prev) =>
					prev.filter((r) => r.id !== selectedPayment.id)
				);
				setSelectedPayment(null);
				setShowRejectionModal(false);
				setRejectionReason("");
				setRejectionNotes("");

				// Show success message
				alert("Payment rejected successfully!");

				// Force refresh with cache busting
				await fetchPendingPayments(false, true);

				// Restart auto-refresh
				setupAutoRefresh();
			} else {
				throw new Error(data.message || "Failed to reject payment");
			}
		} catch (error) {
			console.error("Error rejecting payment:", error);

			// Check if payment is no longer pending
			if (
				error instanceof Error &&
				error.message.includes("not pending")
			) {
				alert(
					"This payment has already been processed. Refreshing the list..."
				);
				await fetchPendingPayments(false, true);
				setShowRejectionModal(false);
				setRejectionReason("");
				setRejectionNotes("");
			} else {
				alert("Failed to reject payment. Please try again.");
			}

			// Restart auto-refresh even on error
			setupAutoRefresh();
		} finally {
			setProcessing(false);
		}
	};

	if (loading) {
		return (
			<AdminLayout>
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
				</div>
			</AdminLayout>
		);
	}

	return (
		<AdminLayout>
			<div className="space-y-6">
				{/* Header */}
				<div className="flex justify-between items-center">
					<div>
						<h1 className="text-2xl font-bold text-white">
							Pending Payments
						</h1>
						<p className="text-gray-400">
							Review and approve pending loan payments
						</p>
						<p className="text-xs text-gray-500 mt-1">
							Last updated: {lastRefresh.toLocaleTimeString()} •
							Auto-refreshes every 30s
						</p>
					</div>
					<button
						onClick={handleRefresh}
						disabled={refreshing}
						className="px-4 py-2 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors flex items-center disabled:opacity-50"
					>
						<ArrowPathIcon
							className={`h-5 w-5 mr-2 ${
								refreshing ? "animate-spin" : ""
							}`}
						/>
						{refreshing ? "Refreshing..." : "Refresh"}
					</button>
				</div>

				{/* Search */}
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
					<div className="relative">
						<MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
						<input
							type="text"
							placeholder="Search by customer name, email, payment ID, loan ID, or product..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
						/>
					</div>
				</div>

				{/* Main Content */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Left Panel - Payments List */}
					<div className="lg:col-span-1">
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
							<div className="p-4 border-b border-gray-700/30">
								<h3 className="text-lg font-medium text-white">
									Pending Payments ({filteredPayments.length})
								</h3>
							</div>
							<div className="overflow-y-auto max-h-[70vh]">
								{filteredPayments.length > 0 ? (
									<ul className="divide-y divide-gray-700/30">
										{filteredPayments.map((payment) => (
											<li
												key={payment.id}
												className={`p-4 hover:bg-gray-800/30 transition-colors cursor-pointer ${
													selectedPayment?.id ===
													payment.id
														? "bg-gray-800/50"
														: ""
												}`}
												onClick={() =>
													handleViewPayment(payment)
												}
											>
												<div className="flex justify-between items-start">
													<div className="flex-1">
														<p className="text-white font-medium">
															{payment.user
																.fullName ||
																"N/A"}
														</p>
														<p className="text-sm text-gray-400">
															{payment.reference ||
																payment.id}
														</p>
														<div className="mt-2 flex items-center text-sm text-gray-300">
															<BanknotesIcon className="mr-1 h-4 w-4 text-green-400" />
															{formatCurrency(
																getDisplayAmount(
																	payment
																)
															)}
														</div>
														<p className="text-xs text-gray-400 mt-1">
															{
																payment.loan
																	.application
																	.product
																	.name
															}
														</p>
														<p className="text-xs text-blue-400 mt-1">
															{getPaymentMethodDisplay(
																payment.metadata
															)}
														</p>
													</div>
													<div className="text-right ml-4">
														<p className="text-xs text-gray-400">
															{formatDate(
																payment.createdAt
															)}
														</p>
													</div>
												</div>
											</li>
										))}
									</ul>
								) : (
									<div className="p-8 text-center">
										<BanknotesIcon className="mx-auto h-12 w-12 text-gray-400" />
										<p className="mt-4 text-gray-300">
											No pending payments found
										</p>
										{searchTerm && (
											<p className="text-sm text-gray-400 mt-2">
												Try adjusting your search
												criteria
											</p>
										)}
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Right Panel - Payment Details */}
					<div className="lg:col-span-2">
						{selectedPayment ? (
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
								<div className="p-4 border-b border-gray-700/30 flex justify-between items-center">
									<h3 className="text-lg font-medium text-white">
										Payment Details
									</h3>
									<span className="px-2 py-1 bg-blue-500/20 text-blue-200 text-xs font-medium rounded-full border border-blue-400/20">
										{selectedPayment.reference ||
											selectedPayment.id}
									</span>
								</div>

								<div className="p-6">
									{/* Summary Cards */}
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
										<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
											<p className="text-gray-400 text-sm mb-1">
												Payment Amount
											</p>
											<p className="text-2xl font-bold text-white">
												{formatCurrency(
													getDisplayAmount(
														selectedPayment
													)
												)}
											</p>
										</div>
										<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
											<p className="text-gray-400 text-sm mb-1">
												Payment Method
											</p>
											<p className="text-sm font-medium text-white text-center">
												{getPaymentMethodDisplay(
													selectedPayment.metadata
												)}
											</p>
										</div>
										<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
											<p className="text-gray-400 text-sm mb-1">
												Submitted Date
											</p>
											<p className="text-sm font-medium text-white text-center">
												{formatDate(
													selectedPayment.createdAt
												)}
											</p>
										</div>
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
														{selectedPayment.user
															.fullName || "N/A"}
													</p>
												</div>
												<div>
													<p className="text-gray-400 text-sm">
														Email
													</p>
													<p className="text-white">
														{selectedPayment.user
															.email || "N/A"}
													</p>
												</div>
												<div>
													<p className="text-gray-400 text-sm">
														Phone
													</p>
													<p className="text-white">
														{
															selectedPayment.user
																.phoneNumber
														}
													</p>
												</div>
											</div>
										</div>

										{/* Payment Information */}
										<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
											<h4 className="text-white font-medium mb-3 flex items-center">
												<BanknotesIcon className="h-5 w-5 mr-2 text-green-400" />
												Payment Details
											</h4>
											<div className="space-y-3">
												<div>
													<p className="text-gray-400 text-sm">
														Payment ID
													</p>
													<p className="text-white font-mono">
														{selectedPayment.id}
													</p>
												</div>
												<div>
													<p className="text-gray-400 text-sm">
														Reference
													</p>
													<p className="text-white font-mono">
														{selectedPayment.reference ||
															"N/A"}
													</p>
												</div>
												<div>
													<p className="text-gray-400 text-sm">
														Description
													</p>
													<p className="text-white">
														{selectedPayment.description ||
															"N/A"}
													</p>
												</div>
											</div>
										</div>
									</div>

									{/* Loan Information */}
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 mb-6">
										<h4 className="text-white font-medium mb-3 flex items-center">
											<DocumentTextIcon className="h-5 w-5 mr-2 text-purple-400" />
											Loan Information
										</h4>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div>
												<p className="text-gray-400 text-sm">
													Product
												</p>
												<p className="text-white">
													{
														selectedPayment.loan
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
														selectedPayment.loan
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
														selectedPayment.loan
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
														selectedPayment.loan
															.monthlyPayment
													)}
												</p>
											</div>
										</div>
									</div>

									{/* Action Buttons */}
									<div className="flex flex-wrap gap-3">
										<button
											onClick={() =>
												setShowApprovalModal(true)
											}
											disabled={processing}
											className="px-4 py-2 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors flex items-center disabled:opacity-50"
										>
											<CheckCircleIcon className="h-5 w-5 mr-2" />
											Approve Payment
										</button>
										<button
											onClick={() =>
												setShowRejectionModal(true)
											}
											disabled={processing}
											className="px-4 py-2 bg-red-500/20 text-red-200 rounded-lg border border-red-400/20 hover:bg-red-500/30 transition-colors flex items-center disabled:opacity-50"
										>
											<XCircleIcon className="h-5 w-5 mr-2" />
											Reject Payment
										</button>
										{selectedPayment.loan.application
											.id && (
											<Link
												href={`/dashboard/loans?search=${selectedPayment.loan.application.id}`}
												className="px-4 py-2 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors flex items-center"
											>
												<CreditCardIcon className="h-5 w-5 mr-2" />
												View Active Loan
											</Link>
										)}
									</div>
								</div>
							</div>
						) : (
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg h-full flex items-center justify-center p-8">
								<div className="text-center">
									<BanknotesIcon className="mx-auto h-16 w-16 text-gray-500" />
									<h3 className="mt-4 text-xl font-medium text-white">
										No Payment Selected
									</h3>
									<p className="mt-2 text-gray-400">
										Select a payment from the list to view
										its details
									</p>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Approval Modal */}
			{showApprovalModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700/30">
						<h3 className="text-lg font-medium text-white mb-4">
							Approve Payment
						</h3>
						<p className="text-gray-300 mb-4">
							Are you sure you want to approve this payment of{" "}
							{selectedPayment &&
								formatCurrency(
									getDisplayAmount(selectedPayment)
								)}
							?
						</p>
						<div className="mb-4">
							<label className="block text-sm font-medium text-gray-300 mb-2">
								Notes (Optional)
							</label>
							<textarea
								value={approvalNotes}
								onChange={(e) =>
									setApprovalNotes(e.target.value)
								}
								className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
								rows={3}
								placeholder="Add any notes about this approval..."
							/>
						</div>
						<div className="flex gap-3">
							<button
								onClick={handleApprovePayment}
								disabled={processing}
								className="flex-1 px-4 py-2 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors disabled:opacity-50"
							>
								{processing ? "Processing..." : "Approve"}
							</button>
							<button
								onClick={() => {
									setShowApprovalModal(false);
									setApprovalNotes("");
								}}
								disabled={processing}
								className="flex-1 px-4 py-2 bg-gray-500/20 text-gray-200 rounded-lg border border-gray-400/20 hover:bg-gray-500/30 transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Rejection Modal */}
			{showRejectionModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700/30">
						<h3 className="text-lg font-medium text-white mb-4">
							Reject Payment
						</h3>
						<p className="text-gray-300 mb-4">
							Are you sure you want to reject this payment of{" "}
							{selectedPayment &&
								formatCurrency(
									getDisplayAmount(selectedPayment)
								)}
							?
						</p>
						<div className="mb-4">
							<label className="block text-sm font-medium text-gray-300 mb-2">
								Rejection Reason *
							</label>
							<select
								value={rejectionReason}
								onChange={(e) =>
									setRejectionReason(e.target.value)
								}
								className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50"
								required
							>
								<option value="">Select a reason</option>
								<option value="insufficient_funds">
									Insufficient Funds
								</option>
								<option value="invalid_payment">
									Invalid Payment
								</option>
								<option value="duplicate_payment">
									Duplicate Payment
								</option>
								<option value="technical_error">
									Technical Error
								</option>
								<option value="other">Other</option>
							</select>
						</div>
						<div className="mb-4">
							<label className="block text-sm font-medium text-gray-300 mb-2">
								Additional Notes
							</label>
							<textarea
								value={rejectionNotes}
								onChange={(e) =>
									setRejectionNotes(e.target.value)
								}
								className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50"
								rows={3}
								placeholder="Provide additional details about the rejection..."
							/>
						</div>
						<div className="flex gap-3">
							<button
								onClick={handleRejectPayment}
								disabled={processing || !rejectionReason}
								className="flex-1 px-4 py-2 bg-red-500/20 text-red-200 rounded-lg border border-red-400/20 hover:bg-red-500/30 transition-colors disabled:opacity-50"
							>
								{processing ? "Processing..." : "Reject"}
							</button>
							<button
								onClick={() => {
									setShowRejectionModal(false);
									setRejectionReason("");
									setRejectionNotes("");
								}}
								disabled={processing}
								className="flex-1 px-4 py-2 bg-gray-500/20 text-gray-200 rounded-lg border border-gray-400/20 hover:bg-gray-500/30 transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}
		</AdminLayout>
	);
}

export default function PaymentsPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<PaymentsContent />
		</Suspense>
	);
}
