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
	XMarkIcon,
	CloudArrowUpIcon,
	DocumentChartBarIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";

interface Payment {
	id: string;
	amount: number;
	description: string;
	reference?: string;
	createdAt: string;
	status: "PENDING" | "APPROVED" | "REJECTED";
	processedAt?: string;
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

function getDisplayAmount(payment: Payment): number {
	// Use originalAmount from metadata if available, otherwise use absolute value of amount
	return payment.metadata?.originalAmount || Math.abs(payment.amount);
}

function getStatusColor(status: string) {
	switch (status) {
		case "PENDING":
			return {
				bg: "bg-orange-500/20",
				text: "text-orange-200",
				border: "border-orange-400/20",
			};
		case "APPROVED":
			return {
				bg: "bg-green-500/20",
				text: "text-green-200",
				border: "border-green-400/20",
			};
		case "REJECTED":
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
}

function PaymentsContent() {
	const searchParams = useSearchParams();
	const [payments, setPayments] = useState<Payment[]>([]);
	const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("PENDING");
	const [activeTab, setActiveTab] = useState<"repayments" | "early-settlement">("repayments");
	const [filterCounts, setFilterCounts] = useState({
		all: 0,
		PENDING: 0,
		APPROVED: 0,
		REJECTED: 0,
	});
	const [earlySettlementCounts, setEarlySettlementCounts] = useState({
		PENDING: 0,
	});
	const [refreshing, setRefreshing] = useState(false);
	const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
	const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

	// Modal states
	const [showApprovalModal, setShowApprovalModal] = useState(false);
	const [showRejectionModal, setShowRejectionModal] = useState(false);
	const [showManualPaymentModal, setShowManualPaymentModal] = useState(false);
	const [showCSVModal, setShowCSVModal] = useState(false);
	const [approvalNotes, setApprovalNotes] = useState("");
	const [rejectionReason, setRejectionReason] = useState("");
	const [rejectionNotes, setRejectionNotes] = useState("");
	const [processing, setProcessing] = useState(false);

	// CSV processing states
	const [csvFile, setCSVFile] = useState<File | null>(null);
	const [csvProcessing, setCSVProcessing] = useState(false);
	const [csvResults, setCSVResults] = useState<any>(null);
	const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
	const [showMatchingResults, setShowMatchingResults] = useState(false);

	// Default processing states
	const [defaultProcessing, setDefaultProcessing] = useState(false);

	// Early settlement states
	const [earlySettlements, setEarlySettlements] = useState<any[]>([]);
	const [selectedEarlySettlement, setSelectedEarlySettlement] = useState<any>(null);
	const [showEarlySettlementApprovalModal, setShowEarlySettlementApprovalModal] = useState(false);
	const [showEarlySettlementRejectionModal, setShowEarlySettlementRejectionModal] = useState(false);
	const [earlySettlementNotes, setEarlySettlementNotes] = useState("");
	const [earlySettlementRejectionReason, setEarlySettlementRejectionReason] = useState("");

	// Manual payment form states
	const [manualPaymentForm, setManualPaymentForm] = useState({
		loanId: "",
		amount: "",
		paymentMethod: "bank_transfer",
		reference: "",
		notes: "",
		paymentDate: "",
	});

	// Handle URL search parameter
	useEffect(() => {
		const searchParam = searchParams.get("search");
		if (searchParam) {
			setSearchTerm(searchParam);
		}
	}, [searchParams]);

	// Fetch payments with automatic token refresh and cache busting
	const fetchPayments = useCallback(async (
		showLoader = true,
		bustCache = false
	) => {
		if (showLoader) {
			setRefreshing(true);
		}

		try {
			// Add cache-busting parameter to ensure fresh data
			const cacheBuster = bustCache ? `?_t=${Date.now()}` : "";
			const statusParam = statusFilter === "all" ? "" : `&status=${statusFilter}`;
			const url = cacheBuster ? 
				`/api/admin/repayments${cacheBuster}${statusParam}` : 
				`/api/admin/repayments?status=${statusFilter}`;
			
			const data = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: Payment[];
			}>(url);

			if (data.success && data.data) {
				setPayments(data.data);
				setLastRefresh(new Date());
				
				// Calculate filter counts
				const counts = {
					all: data.data.length,
					PENDING: data.data.filter((p: Payment) => p.status === "PENDING").length,
					APPROVED: data.data.filter((p: Payment) => p.status === "APPROVED").length,
					REJECTED: data.data.filter((p: Payment) => p.status === "REJECTED").length,
				};
				setFilterCounts(counts);
			} else {
				throw new Error("Failed to fetch payments");
			}
		} catch (error) {
			console.error("Error fetching payments:", error);
			setPayments([]);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, [statusFilter]);

	// Setup auto-refresh with cleanup
	const setupAutoRefresh = useCallback(() => {
		// Clear any existing interval
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}

		// Set up new interval (only for pending payments)
		if (statusFilter === "PENDING") {
			const interval = setInterval(() => {
				fetchPayments(false); // Silent refresh
			}, 30000); // 30 seconds

			setRefreshInterval(interval);
			return interval;
		}
		return null;
	}, [refreshInterval, fetchPayments, statusFilter]);

	// Auto-refresh every 30 seconds to keep data fresh and re-fetch when status filter changes
	useEffect(() => {
		fetchPayments();
		const interval = setupAutoRefresh();

		return () => {
			if (interval) {
				clearInterval(interval);
			}
		};
	}, [statusFilter]);

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
			setFilteredPayments(payments);
		} else {
			const search = searchTerm.toLowerCase();

			// First, check for exact loan ID match
			const exactLoanMatch = payments.find(
				(payment: Payment) => payment.loan.id.toLowerCase() === search
			);

			if (exactLoanMatch) {
				// If exact loan ID match found, show only that payment
				setFilteredPayments([exactLoanMatch]);
			} else {
				// Otherwise, do partial matching across all fields
				const filtered = payments.filter(
					(payment: Payment) =>
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
	}, [searchTerm, payments]);

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

	const handleViewPayment = (payment: Payment) => {
		setSelectedPayment(payment);
	};

	const handleRefresh = () => {
		setRefreshing(true);
		fetchPayments(true, true); // Force cache bust
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
				setPayments((prev: Payment[]) =>
					prev.filter((r: Payment) => r.id !== selectedPayment.id)
				);
				setSelectedPayment(null);
				setShowApprovalModal(false);
				setApprovalNotes("");

				// Show success message
				alert("Payment approved successfully!");

				// Force refresh with cache busting
				await fetchPayments(false, true);

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
				await fetchPayments(false, true);
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
				setPayments((prev: Payment[]) =>
					prev.filter((r: Payment) => r.id !== selectedPayment.id)
				);
				setSelectedPayment(null);
				setShowRejectionModal(false);
				setRejectionReason("");
				setRejectionNotes("");

				// Show success message
				alert("Payment rejected successfully!");

				// Force refresh with cache busting
				await fetchPayments(false, true);

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
				await fetchPayments(false, true);
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

	const handleCreateManualPayment = async () => {
		if (!manualPaymentForm.loanId || !manualPaymentForm.amount || !manualPaymentForm.reference) {
			alert("Please fill in all required fields (Loan ID, Amount, Reference)");
			return;
		}

		const amount = parseFloat(manualPaymentForm.amount);
		if (isNaN(amount) || amount <= 0) {
			alert("Please enter a valid payment amount greater than 0");
			return;
		}

		setProcessing(true);
		try {
			const data = await fetchWithAdminTokenRefresh<{
				success: boolean;
				message?: string;
				data?: any;
			}>(`/api/admin/payments/manual`, {
				method: "POST",
				body: JSON.stringify({
					loanId: manualPaymentForm.loanId,
					amount: amount,
					paymentMethod: manualPaymentForm.paymentMethod,
					reference: manualPaymentForm.reference,
					notes: manualPaymentForm.notes,
					paymentDate: manualPaymentForm.paymentDate || undefined,
				}),
			});

			if (data.success) {
				alert(data.message || "Manual payment created successfully!");
				
				// Reset form
				setManualPaymentForm({
					loanId: "",
					amount: "",
					paymentMethod: "bank_transfer",
					reference: "",
					notes: "",
					paymentDate: "",
				});
				setShowManualPaymentModal(false);
				
				// Refresh payments list
				await fetchPayments(false, true);
			} else {
				throw new Error(data.message || "Failed to create manual payment");
			}
		} catch (error) {
			console.error("Error creating manual payment:", error);
			alert(`Failed to create manual payment: ${error instanceof Error ? error.message : "Unknown error"}`);
		} finally {
			setProcessing(false);
		}
	};

	// CSV handling functions
	const handleCSVFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
				alert("Please select a CSV file");
				return;
			}
			if (file.size > 10 * 1024 * 1024) { // 10MB limit
				alert("File size must be less than 10MB");
				return;
			}
			setCSVFile(file);
			setCSVResults(null);
			setSelectedMatches(new Set());
			setShowMatchingResults(false);
		}
	};

	const handleCSVUpload = async () => {
		if (!csvFile) {
			alert("Please select a CSV file first");
			return;
		}

		setCSVProcessing(true);
		try {
			const formData = new FormData();
			formData.append('csvFile', csvFile);

			const data = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data?: any;
				message?: string;
			}>(`/api/admin/payments/csv-upload`, {
				method: "POST",
				body: formData,
			});

			if (data.success && data.data) {
				setCSVResults(data.data);
				setShowMatchingResults(true);
				
				// Auto-select high-confidence matches (score >= 50%) - High confidence threshold
				const highConfidenceMatches = new Set<string>();
				data.data.matches?.forEach((match: any) => {
					if (match.matchScore >= 50) {
						highConfidenceMatches.add(match.payment.id);
					}
				});
				setSelectedMatches(highConfidenceMatches);
			} else {
				throw new Error(data.message || "Failed to process CSV file");
			}
		} catch (error) {
			console.error("Error processing CSV file:", error);
			alert(`Failed to process CSV file: ${error instanceof Error ? error.message : "Unknown error"}`);
		} finally {
			setCSVProcessing(false);
		}
	};

	const handleToggleMatch = (paymentId: string) => {
		const newSelected = new Set(selectedMatches);
		if (newSelected.has(paymentId)) {
			newSelected.delete(paymentId);
		} else {
			newSelected.add(paymentId);
		}
		setSelectedMatches(newSelected);
	};

	const handleBatchApprove = async () => {
		if (selectedMatches.size === 0) {
			alert("Please select at least one match to approve");
			return;
		}

		if (!csvResults?.matches) {
			alert("No matches available for approval");
			return;
		}

		const matchesToApprove = csvResults.matches
			.filter((match: any) => selectedMatches.has(match.payment.id))
			.map((match: any) => ({
				paymentId: match.payment.id,
				transactionRef: match.transaction.refCode,
				amount: match.transaction.amount,
				notes: `CSV batch approval - Match score: ${match.matchScore}% - ${match.matchReasons.join(', ')}`
			}));

		setProcessing(true);
		try {
			const data = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data?: any;
				message?: string;
			}>(`/api/admin/payments/csv-batch-approve`, {
				method: "POST",
				body: JSON.stringify({
					matches: matchesToApprove,
					notes: `CSV batch approval from ${csvFile?.name || 'uploaded file'} - ${csvResults.bankFormat} format detected`
				}),
			});

			if (data.success && data.data) {
				const { approved, failed, summary } = data.data;
				
				let message = `Batch approval completed!\n\n`;
				message += `✅ Successfully approved: ${summary.successful} payments\n`;
				if (summary.failed > 0) {
					message += `❌ Failed: ${summary.failed} payments\n\n`;
					message += `Failed payments:\n`;
					failed.forEach((fail: any) => {
						message += `- ${fail.paymentId}: ${fail.error}\n`;
					});
				}
				
				alert(message);
				
				// Close modal and refresh payments
				setShowCSVModal(false);
				setCSVFile(null);
				setCSVResults(null);
				setSelectedMatches(new Set());
				setShowMatchingResults(false);
				
				// Refresh payments list
				await fetchPayments(false, true);
			} else {
				throw new Error(data.message || "Failed to process batch approval");
			}
		} catch (error) {
			console.error("Error processing batch approval:", error);
			alert(`Failed to process batch approval: ${error instanceof Error ? error.message : "Unknown error"}`);
		} finally {
			setProcessing(false);
		}
	};

	const resetCSVModal = () => {
		setCSVFile(null);
		setCSVResults(null);
		setSelectedMatches(new Set());
		setShowMatchingResults(false);
		setCSVProcessing(false);
	};

	// Default processing handler
	const handleManualDefaultProcessing = async () => {
		setDefaultProcessing(true);
		try {
			const data = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data?: any;
				message?: string;
			}>("/api/admin/cron/trigger-default-processing", {
				method: "POST",
			});

			if (data.success) {
				alert(`Default processing completed successfully!\n\nResults:\n${JSON.stringify(data.data, null, 2)}`);
			} else {
				throw new Error(data.message || "Failed to trigger default processing");
			}
		} catch (error) {
			console.error("Error triggering default processing:", error);
			alert(`Failed to trigger default processing: ${error instanceof Error ? error.message : "Unknown error"}`);
		} finally {
			setDefaultProcessing(false);
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
							Payment Management
						</h1>
						<p className="text-gray-400">
							Review and manage loan payments
						</p>
						<p className="text-xs text-gray-500 mt-1">
							Last updated: {lastRefresh.toLocaleTimeString()} •
							{statusFilter === "PENDING" ? " Auto-refreshes every 30s" : " Manual refresh"}
						</p>
					</div>
					<div className="flex gap-3">
						<button
							onClick={handleManualDefaultProcessing}
							disabled={defaultProcessing}
							className="px-4 py-2 bg-amber-500/20 text-amber-200 rounded-lg border border-amber-400/20 hover:bg-amber-500/30 transition-colors flex items-center disabled:opacity-50"
							title="Manually trigger default processing (28-day and 42-day checks)"
						>
							<ExclamationTriangleIcon className={`h-5 w-5 mr-2 ${defaultProcessing ? "animate-pulse" : ""}`} />
							{defaultProcessing ? "Processing..." : "Process Defaults"}
						</button>
						<button
							onClick={() => setShowCSVModal(true)}
							className="px-4 py-2 bg-purple-500/20 text-purple-200 rounded-lg border border-purple-400/20 hover:bg-purple-500/30 transition-colors flex items-center"
						>
							<CloudArrowUpIcon className="h-5 w-5 mr-2" />
							Upload CSV
						</button>
						<button
							onClick={() => setShowManualPaymentModal(true)}
							className="px-4 py-2 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors flex items-center"
						>
							<BanknotesIcon className="h-5 w-5 mr-2" />
							Create Manual Payment
						</button>
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
				</div>

				{/* Search Bar */}
				<div className="mb-4 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
					<div className="flex-1 relative">
						<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
							<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
						</div>
						<input
							type="text"
							className="block w-full pl-10 pr-10 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
							placeholder="Search by customer name, email, payment ID, loan ID, or product..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
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
							onClick={() => setStatusFilter("PENDING")}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								statusFilter === "PENDING"
									? "bg-orange-500/30 text-orange-100 border-orange-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							Pending ({filterCounts.PENDING})
						</button>
						<button
							onClick={() => setStatusFilter("APPROVED")}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								statusFilter === "APPROVED"
									? "bg-green-500/30 text-green-100 border-green-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							Approved ({filterCounts.APPROVED})
						</button>
						<button
							onClick={() => setStatusFilter("REJECTED")}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								statusFilter === "REJECTED"
									? "bg-red-500/30 text-red-100 border-red-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							Rejected ({filterCounts.REJECTED})
						</button>
					</div>
				</div>

				{/* Main Content */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Left Panel - Payments List */}
					<div className="lg:col-span-1">
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
							<div className="p-4 border-b border-gray-700/30">
								<h3 className="text-lg font-medium text-white">
									{statusFilter === "all" ? "All Payments" : `${statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()} Payments`} ({filteredPayments.length})
								</h3>
							</div>
							<div className="overflow-y-auto max-h-[70vh]">
								{filteredPayments.length > 0 ? (
									<ul className="divide-y divide-gray-700/30">
										{filteredPayments.map((payment) => {
											const statusColor = getStatusColor(payment.status);
											return (
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
															<div className="mt-2">
																<span
																	className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
																>
																	{payment.status}
																</span>
															</div>
														</div>
														<div className="text-right ml-4">
															<p className="text-xs text-gray-400">
																{formatDate(
																	payment.createdAt
																)}
															</p>
															{payment.processedAt && (
																<p className="text-xs text-gray-500 mt-1">
																	Processed: {formatDate(
																		payment.processedAt
																	)}
																</p>
															)}
														</div>
													</div>
												</li>
											);
										})}
									</ul>
								) : (
									<div className="p-8 text-center">
										<BanknotesIcon className="mx-auto h-12 w-12 text-gray-400" />
										<p className="mt-4 text-gray-300">
											No {statusFilter === "all" ? "" : statusFilter.toLowerCase()} payments found
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
									<div className="flex items-center space-x-2">
										{(() => {
											const statusColor = getStatusColor(selectedPayment.status);
											return (
												<span
													className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
												>
													{selectedPayment.status}
												</span>
											);
										})()}
										<span className="px-2 py-1 bg-blue-500/20 text-blue-200 text-xs font-medium rounded-full border border-blue-400/20">
											{selectedPayment.reference ||
												selectedPayment.id}
										</span>
									</div>
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
												{selectedPayment.status === "PENDING" ? "Submitted Date" : "Processed Date"}
											</p>
											<p className="text-sm font-medium text-white text-center">
												{formatDate(
													selectedPayment.processedAt || selectedPayment.createdAt
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
										{selectedPayment.status === "PENDING" && (
											<>
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
											</>
										)}
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

			{/* Manual Payment Modal */}
			{showManualPaymentModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
					<div className="min-h-screen flex items-center justify-center p-1 xs:p-2 sm:p-4 lg:p-6">
						<div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg sm:rounded-xl w-full max-w-xs xs:max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl border border-gray-700/30 my-2 sm:my-4 max-h-[98vh] flex flex-col">
							{/* Header */}
							<div className="flex-shrink-0 p-3 xs:p-4 sm:p-6 border-b border-gray-700/30">
								<h3 className="text-base xs:text-lg sm:text-xl font-medium text-white mb-1 sm:mb-2">
									Create Manual Payment
								</h3>
								<p className="text-gray-300 text-xs xs:text-sm sm:text-base">
									Create a manual payment for direct bank transfers or other offline payments.
								</p>
							</div>
							
							{/* Scrollable Content */}
							<div className="flex-1 overflow-y-auto p-3 xs:p-4 sm:p-6">
								<div className="space-y-3 xs:space-y-4">
									{/* Loan ID */}
									<div>
										<label className="block text-xs xs:text-sm font-medium text-gray-300 mb-1 xs:mb-2">
											Loan ID *
										</label>
										<input
											type="text"
											value={manualPaymentForm.loanId}
											onChange={(e) =>
												setManualPaymentForm(prev => ({ ...prev, loanId: e.target.value }))
											}
											placeholder="Enter loan ID"
											className="w-full px-2 xs:px-3 py-1.5 xs:py-2 bg-gray-800/50 border border-gray-700/30 rounded-md xs:rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-xs xs:text-sm sm:text-base"
										/>
									</div>

									{/* Amount */}
									<div>
										<label className="block text-xs xs:text-sm font-medium text-gray-300 mb-1 xs:mb-2">
											Payment Amount (RM) *
										</label>
										<input
											type="number"
											step="0.01"
											min="0"
											value={manualPaymentForm.amount}
											onChange={(e) =>
												setManualPaymentForm(prev => ({ ...prev, amount: e.target.value }))
											}
											placeholder="0.00"
											className="w-full px-2 xs:px-3 py-1.5 xs:py-2 bg-gray-800/50 border border-gray-700/30 rounded-md xs:rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-xs xs:text-sm sm:text-base"
										/>
									</div>

									{/* Payment Method */}
									<div>
										<label className="block text-xs xs:text-sm font-medium text-gray-300 mb-1 xs:mb-2">
											Payment Method *
										</label>
										<select
											value={manualPaymentForm.paymentMethod}
											onChange={(e) =>
												setManualPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))
											}
											className="w-full px-2 xs:px-3 py-1.5 xs:py-2 bg-gray-800/50 border border-gray-700/30 rounded-md xs:rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-xs xs:text-sm sm:text-base"
										>
											<option value="bank_transfer">Bank Transfer</option>
											<option value="cash">Cash</option>
											<option value="cheque">Cheque</option>
											<option value="online_banking">Online Banking</option>
											<option value="other">Other</option>
										</select>
									</div>

									{/* Reference */}
									<div>
										<label className="block text-xs xs:text-sm font-medium text-gray-300 mb-1 xs:mb-2">
											Reference/Transaction ID *
										</label>
										<input
											type="text"
											value={manualPaymentForm.reference}
											onChange={(e) =>
												setManualPaymentForm(prev => ({ ...prev, reference: e.target.value }))
											}
											placeholder="Enter reference or transaction ID"
											className="w-full px-2 xs:px-3 py-1.5 xs:py-2 bg-gray-800/50 border border-gray-700/30 rounded-md xs:rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-xs xs:text-sm sm:text-base"
										/>
									</div>

									{/* Payment Date */}
									<div>
										<label className="block text-xs xs:text-sm font-medium text-gray-300 mb-1 xs:mb-2">
											Payment Date (Optional)
										</label>
										<input
											type="date"
											value={manualPaymentForm.paymentDate}
											onChange={(e) =>
												setManualPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))
											}
											className="w-full px-2 xs:px-3 py-1.5 xs:py-2 bg-gray-800/50 border border-gray-700/30 rounded-md xs:rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-xs xs:text-sm sm:text-base"
										/>
										<p className="text-xs text-gray-400 mt-1">
											Leave empty to use current date/time
										</p>
									</div>

									{/* Notes */}
									<div>
										<label className="block text-xs xs:text-sm font-medium text-gray-300 mb-1 xs:mb-2">
											Admin Notes (Optional)
										</label>
										<textarea
											value={manualPaymentForm.notes}
											onChange={(e) =>
												setManualPaymentForm(prev => ({ ...prev, notes: e.target.value }))
											}
											placeholder="Add any notes about this payment..."
											className="w-full px-2 xs:px-3 py-1.5 xs:py-2 bg-gray-800/50 border border-gray-700/30 rounded-md xs:rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-xs xs:text-sm sm:text-base resize-none"
											rows={2}
										/>
									</div>
								</div>
							</div>

							{/* Footer */}
							<div className="flex-shrink-0 p-3 xs:p-4 sm:p-6 border-t border-gray-700/30">
								<div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
									<button
										onClick={handleCreateManualPayment}
										disabled={processing || !manualPaymentForm.loanId || !manualPaymentForm.amount || !manualPaymentForm.reference}
										className="flex-1 px-3 xs:px-4 py-2 bg-green-500/20 text-green-200 rounded-md xs:rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs xs:text-sm sm:text-base font-medium"
									>
										{processing ? "Creating..." : "Create Payment"}
									</button>
									<button
										onClick={() => {
											setShowManualPaymentModal(false);
											setManualPaymentForm({
												loanId: "",
												amount: "",
												paymentMethod: "bank_transfer",
												reference: "",
												notes: "",
												paymentDate: "",
											});
										}}
										disabled={processing}
										className="flex-1 px-3 xs:px-4 py-2 bg-gray-500/20 text-gray-200 rounded-md xs:rounded-lg border border-gray-400/20 hover:bg-gray-500/30 transition-colors disabled:opacity-50 text-xs xs:text-sm sm:text-base font-medium"
									>
										Cancel
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* CSV Upload Modal */}
			{showCSVModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 w-full max-w-6xl border border-gray-700/30 max-h-[90vh] overflow-y-auto">
						<div className="flex justify-between items-center mb-6">
							<h3 className="text-xl font-medium text-white flex items-center">
								<CloudArrowUpIcon className="h-6 w-6 mr-2 text-purple-400" />
								CSV Bank Transaction Upload
							</h3>
							<button
								onClick={() => {
									setShowCSVModal(false);
									resetCSVModal();
								}}
								className="text-gray-400 hover:text-gray-300 transition-colors"
							>
								<XMarkIcon className="h-6 w-6" />
							</button>
						</div>

						{!showMatchingResults ? (
							// File Upload Section
							<div className="space-y-6">
								<div className="text-gray-300 space-y-2">
									<p>Upload a CSV file containing bank transactions to automatically match and process payments.</p>
									<p className="text-sm text-gray-400">
										<strong>Expected format:</strong> Standardized CSV with headers: <code>transaction_date, description_1, description_2, beneficiary, account, cash_in, cash_out</code>
									</p>
									<div className="flex items-center justify-between">
										<p className="text-xs text-gray-500">
											Legacy formats (Maybank, CIMB, Public Bank) are still supported for backward compatibility.
										</p>
										<a
											href={`/Cleaned_Bank_CSV_Data_Example.csv`}
											download="CSV_Template_Example.csv"
											className="text-xs text-purple-400 hover:text-purple-300 underline flex items-center"
										>
											<DocumentChartBarIcon className="h-3 w-3 mr-1" />
											Download CSV Template
										</a>
									</div>
								</div>

								{/* File Upload */}
								<div className="border-2 border-dashed border-purple-400/30 rounded-lg p-8 text-center">
									<CloudArrowUpIcon className="mx-auto h-12 w-12 text-purple-400 mb-4" />
									<div className="space-y-2">
										<input
											type="file"
											accept=".csv"
											onChange={handleCSVFileChange}
											className="hidden"
											id="csvFileInput"
										/>
										<label
											htmlFor="csvFileInput"
											className="cursor-pointer inline-flex items-center px-4 py-2 bg-purple-500/20 text-purple-200 rounded-lg border border-purple-400/20 hover:bg-purple-500/30 transition-colors"
										>
											<DocumentChartBarIcon className="h-5 w-5 mr-2" />
											Select CSV File
										</label>
										<p className="text-sm text-gray-400">
											Maximum file size: 10MB
										</p>
									</div>
								</div>

								{csvFile && (
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
										<div className="flex items-center justify-between">
											<div className="flex items-center">
												<DocumentChartBarIcon className="h-5 w-5 text-purple-400 mr-2" />
												<span className="text-white font-medium">{csvFile.name}</span>
												<span className="text-gray-400 text-sm ml-2">
													({(csvFile.size / 1024).toFixed(1)} KB)
												</span>
											</div>
											<button
												onClick={handleCSVUpload}
												disabled={csvProcessing}
												className="px-4 py-2 bg-purple-500/20 text-purple-200 rounded-lg border border-purple-400/20 hover:bg-purple-500/30 transition-colors disabled:opacity-50 flex items-center"
											>
												{csvProcessing ? (
													<>
														<ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
														Processing...
													</>
												) : (
													<>
														<CloudArrowUpIcon className="h-4 w-4 mr-2" />
														Process File
													</>
												)}
											</button>
										</div>
									</div>
								)}
							</div>
						) : (
							// Results Section
							<div className="space-y-6">
								{/* Summary Cards */}
								<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
									<div className="bg-blue-500/10 p-4 rounded-lg border border-blue-400/20">
										<p className="text-blue-400 text-sm font-medium">Bank Format</p>
										<p className="text-white text-lg font-bold">{csvResults?.bankFormat}</p>
									</div>
									<div className="bg-green-500/10 p-4 rounded-lg border border-green-400/20">
										<p className="text-green-400 text-sm font-medium">Total Transactions</p>
										<p className="text-white text-lg font-bold">{csvResults?.summary?.totalTransactions || 0}</p>
									</div>
									<div className="bg-purple-500/10 p-4 rounded-lg border border-purple-400/20">
										<p className="text-purple-400 text-sm font-medium">Matches Found</p>
										<p className="text-white text-lg font-bold">{csvResults?.matches?.length || 0}</p>
									</div>
									<div className="bg-yellow-500/10 p-4 rounded-lg border border-yellow-400/20">
										<p className="text-yellow-400 text-sm font-medium">Total Amount</p>
										<p className="text-white text-lg font-bold">
											{formatCurrency(csvResults?.summary?.totalAmount || 0)}
										</p>
									</div>
								</div>

								{/* Processing Errors */}
								{csvResults?.processingErrors?.length > 0 && (
									<div className="bg-red-500/10 p-4 rounded-lg border border-red-400/20">
										<div className="flex items-center mb-2">
											<ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
											<h4 className="text-red-400 font-medium">Processing Warnings</h4>
										</div>
										<ul className="text-red-300 text-sm space-y-1">
											{csvResults.processingErrors.map((error: string, index: number) => (
												<li key={index}>• {error}</li>
											))}
										</ul>
									</div>
								)}

								{/* Matches Table */}
								{csvResults?.matches?.length > 0 && (
									<div className="bg-gray-800/30 rounded-lg border border-gray-700/30 overflow-hidden">
										<div className="p-4 border-b border-gray-700/30 flex justify-between items-center">
											<h4 className="text-white font-medium">Transaction Matches</h4>
											<div className="flex items-center gap-4">
												<span className="text-gray-400 text-sm">
													{selectedMatches.size} of {csvResults.matches.length} selected
												</span>
												<button
													onClick={handleBatchApprove}
													disabled={processing || selectedMatches.size === 0}
													className="px-4 py-2 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center"
												>
													<CheckCircleIcon className="h-4 w-4 mr-2" />
													Approve Selected ({selectedMatches.size})
												</button>
											</div>
										</div>
										<div className="overflow-x-auto">
											<table className="w-full">
												<thead className="bg-gray-900/50">
													<tr>
														<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
															Select
														</th>
														<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
															Match Score
														</th>
														<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
															Transaction Date
														</th>
														<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
															Bank Transaction
														</th>
														<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
															Pending Payment
														</th>
														<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
															Match Reasons
														</th>
													</tr>
												</thead>
												<tbody className="divide-y divide-gray-700/30">
													{csvResults.matches.map((match: any, index: number) => (
														<tr 
															key={index} 
															className={`hover:bg-gray-800/20 ${selectedMatches.has(match.payment.id) ? 'bg-purple-500/10' : ''}`}
														>
															<td className="px-4 py-3">
																<input
																	type="checkbox"
																	checked={selectedMatches.has(match.payment.id)}
																	onChange={() => handleToggleMatch(match.payment.id)}
																	className="h-4 w-4 text-purple-400 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
																/>
															</td>
															<td className="px-4 py-3">
																<div className="flex items-center">
																	<span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
																		match.matchScore >= 70 ? 'bg-green-500/20 text-green-200 border border-green-400/20' :
																		match.matchScore >= 50 ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-400/20' :
																		'bg-red-500/20 text-red-200 border border-red-400/20'
																	}`}>
																		{match.matchScore}%
																	</span>
																</div>
															</td>
															<td className="px-4 py-3">
																<div className="text-white text-sm">
																	{match.transaction.transactionDate ? (
																		<div className="text-purple-400 font-medium">
																			{new Date(match.transaction.transactionDate).toLocaleDateString('en-MY', {
																				year: 'numeric',
																				month: 'short',
																				day: 'numeric',
																				timeZone: 'Asia/Kuala_Lumpur'
																			})}
																		</div>
																	) : (
																		<div className="text-gray-500 text-xs">No date</div>
																	)}
																</div>
															</td>
															<td className="px-4 py-3">
																<div className="text-white text-sm">
																	<div className="font-medium">{match.transaction.beneficiary}</div>
																	<div className="text-gray-400 text-xs">{match.transaction.refCode}</div>
																	<div className="text-green-400 font-medium">{formatCurrency(match.transaction.amount)}</div>
																</div>
															</td>
															<td className="px-4 py-3">
																<div className="text-white text-sm">
																	<div className="font-medium">{match.payment.user?.fullName}</div>
																	<div className="text-gray-400 text-xs">{match.payment.reference || match.payment.id}</div>
																	<div className="text-blue-400 font-medium">{formatCurrency(Math.abs(match.payment.amount))}</div>
																</div>
															</td>
															<td className="px-4 py-3">
																<div className="text-gray-300 text-xs">
																	{match.matchReasons.map((reason: string, i: number) => (
																		<div key={i} className="mb-1">• {reason}</div>
																	))}
																</div>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</div>
								)}

								{/* Unmatched Transactions */}
								{csvResults?.unmatchedTransactions?.length > 0 && (
									<div className="bg-gray-800/30 rounded-lg border border-gray-700/30 overflow-hidden">
										<div className="p-4 border-b border-gray-700/30">
											<h4 className="text-white font-medium">Unmatched Transactions ({csvResults.unmatchedTransactions.length})</h4>
											<p className="text-gray-400 text-sm">These transactions could not be matched to pending payments</p>
										</div>
										<div className="overflow-x-auto max-h-64">
											<table className="w-full">
												<thead className="bg-gray-900/50">
													<tr>
														<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
															Reference
														</th>
														<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
															Beneficiary
														</th>
														<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
															Amount
														</th>
													</tr>
												</thead>
												<tbody className="divide-y divide-gray-700/30">
													{csvResults.unmatchedTransactions.map((transaction: any, index: number) => (
														<tr key={index} className="hover:bg-gray-800/20">
															<td className="px-4 py-3 text-white text-sm">{transaction.refCode}</td>
															<td className="px-4 py-3 text-gray-300 text-sm">{transaction.beneficiary}</td>
															<td className="px-4 py-3 text-green-400 text-sm font-medium">{formatCurrency(transaction.amount)}</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</div>
								)}

								{/* Action Buttons */}
								<div className="flex gap-3 pt-4 border-t border-gray-700/30">
									<button
										onClick={() => {
											setShowMatchingResults(false);
											setCSVResults(null);
											setSelectedMatches(new Set());
										}}
										className="px-4 py-2 bg-gray-500/20 text-gray-200 rounded-lg border border-gray-400/20 hover:bg-gray-500/30 transition-colors"
									>
										Upload Another File
									</button>
									<button
										onClick={() => {
											setShowCSVModal(false);
											resetCSVModal();
										}}
										className="px-4 py-2 bg-gray-500/20 text-gray-200 rounded-lg border border-gray-400/20 hover:bg-gray-500/30 transition-colors"
									>
										Close
									</button>
								</div>
							</div>
						)}
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
