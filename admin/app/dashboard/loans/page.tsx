"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
	EyeIcon,
	XMarkIcon,
	CheckCircleIcon,
	CalendarDaysIcon,
	CurrencyDollarIcon,
	DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";

interface LoanRepayment {
	id: string;
	amount: number;
	principalAmount: number;
	interestAmount: number;
	status: string;
	dueDate: string;
	paidAt: string | null;
	actualPaymentDate?: string | null; // Enhanced payment date from wallet transactions
	createdAt: string;
	installmentNumber?: number;
	scheduledAmount?: number;
	actualAmount?: number;
	paymentType?: string; // EARLY, ON_TIME, LATE, PARTIAL
	daysEarly?: number;
	daysLate?: number;
	parentRepaymentId?: string;
	adjustedAmount?: number;
	prepaymentApplied?: number;
	contributingPayments?: Array<{
		id: string;
		amount: number;
		createdAt: string;
		reference: string;
		description: string;
	}>;
	totalContributingAmount?: number;
	// Late fee fields
	lateFeeAmount?: number; // Total late fees assessed for this repayment
	lateFeesPaid?: number; // Total late fees paid for this repayment
	principalPaid?: number; // Principal amount paid for this repayment
}

interface WalletTransaction {
	id: string;
	amount: number;
	type: string;
	status: string;
	reference: string;
	description: string;
	metadata: any;
	createdAt: string;
	updatedAt: string;
}

interface LoanApplicationHistory {
	id: string;
	applicationId: string;
	previousStatus: string | null;
	newStatus: string;
	changedBy: string;
	changeReason?: string;
	notes?: string;
	metadata?: any;
	createdAt: string;
}

interface LoanData {
	id: string;
	userId: string;
	applicationId: string;
	principalAmount: number;
	totalAmount: number; // Total amount to be repaid (principal + interest)
	outstandingBalance: number; // Outstanding total balance (principal + interest remaining)
	interestRate: number;
	term: number;
	monthlyPayment: number;
	nextPaymentDue: string | null;
	status: string;
	disbursedAt: string | null;
	createdAt: string;
	updatedAt: string;
	totalPaid?: number;
	remainingPrepayment?: number;
	application?: {
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
	repayments?: LoanRepayment[];
	overdueInfo?: {
		hasOverduePayments: boolean;
		totalOverdueAmount: number;
		totalLateFees: number;
		overdueRepayments: Array<{
			id: string;
			amount: number;
			outstandingAmount: number;
			totalLateFees: number;
			totalAmountDue: number;
			dueDate: string;
			daysOverdue: number;
			lateFeeAmount: number;
			lateFeesPaid: number;
			installmentNumber?: number;
		}>;
	};
}

function ActiveLoansContent() {
	const searchParams = useSearchParams();
	const [loans, setLoans] = useState<LoanData[]>([]);
	const [filteredLoans, setFilteredLoans] = useState<LoanData[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedLoan, setSelectedLoan] = useState<LoanData | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedTab, setSelectedTab] = useState<string>("details");
	const [loadingRepayments, setLoadingRepayments] = useState(false);
	const [walletTransactions, setWalletTransactions] = useState<
		WalletTransaction[]
	>([]);
	const [loadingTransactions, setLoadingTransactions] = useState(false);
	const [applicationHistory, setApplicationHistory] = useState<
		LoanApplicationHistory[]
	>([]);
	const [loadingApplicationHistory, setLoadingApplicationHistory] = useState(false);
	const [fetchedRepaymentsForLoan, setFetchedRepaymentsForLoan] = useState<
		string | null
	>(null);
	const [showDischargeModal, setShowDischargeModal] = useState(false);
	const [dischargeAction, setDischargeAction] = useState<
		"request" | "approve" | "reject" | null
	>(null);
	const [dischargeReason, setDischargeReason] = useState("");
	const [dischargeNotes, setDischargeNotes] = useState("");
	const [processingDischarge, setProcessingDischarge] = useState(false);

	// Manual payment modal states
	const [showManualPaymentModal, setShowManualPaymentModal] = useState(false);
	const [manualPaymentForm, setManualPaymentForm] = useState({
		loanId: "",
		amount: "",
		paymentMethod: "bank_transfer",
		reference: "",
		notes: "",
		paymentDate: "",
	});
	const [processingManualPayment, setProcessingManualPayment] = useState(false);

	useEffect(() => {
		fetchActiveLoans();
	}, []);

	// Handle URL parameters
	useEffect(() => {
		const searchParam = searchParams.get("search");
		const filterParam = searchParams.get("filter");

		if (searchParam) {
			setSearchTerm(searchParam);
		}

		if (filterParam) {
			setStatusFilter(filterParam);
		}
	}, [searchParams]);

	// Fetch wallet transactions and application history when audit tab is selected
	useEffect(() => {
		if (
			selectedTab === "audit" &&
			selectedLoan
		) {
			if (walletTransactions.length === 0) {
				fetchWalletTransactions(selectedLoan.id);
			}
			if (applicationHistory.length === 0 && selectedLoan.applicationId) {
				fetchApplicationHistory(selectedLoan.applicationId);
			}
		}
	}, [selectedTab, selectedLoan?.id, selectedLoan?.applicationId]);

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
				// Include all loan statuses (ACTIVE, PENDING_DISCHARGE, DISCHARGED)
				setLoans(response.data);
				
				// Debug: Log overdue info for each loan
				console.log("🔍 DEBUG: Loans data received:", response.data.length);
				response.data.forEach((loan, index) => {
					if (loan.overdueInfo) {
						console.log(`🔍 Loan ${index + 1} (${loan.id.substring(0, 8)}):`, {
							hasOverduePayments: loan.overdueInfo.hasOverduePayments,
							totalOverdueAmount: loan.overdueInfo.totalOverdueAmount,
							totalLateFees: loan.overdueInfo.totalLateFees,
							overdueRepaymentsCount: loan.overdueInfo.overdueRepayments.length,
							status: loan.status,
							nextPaymentDue: loan.nextPaymentDue
						});
					} else {
						console.log(`❌ Loan ${index + 1} (${loan.id.substring(0, 8)}): No overdueInfo`);
					}
				});
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

	const fetchLoanRepayments = async (loanId: string) => {
		try {
			setLoadingRepayments(true);
			console.log("🔍 Fetching repayments for loan ID:", loanId);
			const response = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: LoanData;
			}>(`/api/admin/loans/${loanId}/repayments?raw=true`);

			console.log("📊 Repayments API response:", response);

			if (response.success && response.data) {
				console.log("✅ Repayments data received:", {
					totalRepayments: response.data.repayments?.length || 0,
					totalPaid: response.data.totalPaid,
					remainingPrepayment: response.data.remainingPrepayment,
					firstRepayment: response.data.repayments?.[0],
					lastRepayment:
						response.data.repayments?.[
							response.data.repayments.length - 1
						],
				});

				// Debug: Check if any repayments have contributingPayments
				const repaymentsWithPayments =
					response.data.repayments?.filter(
						(r: any) =>
							r.contributingPayments &&
							r.contributingPayments.length > 0
					) || [];
				console.log("🔍 Repayments with contributing payments:", {
					count: repaymentsWithPayments.length,
					examples: repaymentsWithPayments
						.slice(0, 3)
						.map((r: any) => ({
							id: r.id,
							amount: r.amount,
							status: r.status,
							contributingPayments:
								r.contributingPayments?.length || 0,
							actualPaymentDate: r.actualPaymentDate,
							paidAt: r.paidAt,
						})),
				});

				// Update the selected loan with repayments data
				setSelectedLoan((prev) =>
					prev
						? { ...prev, repayments: response.data.repayments }
						: null
				);
			} else {
				console.log("❌ Failed to get repayments data:", response);
			}
		} catch (error) {
			console.error("Error fetching loan repayments:", error);
		} finally {
			setLoadingRepayments(false);
		}
	};

	const fetchWalletTransactions = async (loanId: string) => {
		try {
			setLoadingTransactions(true);
			console.log("🔍 Fetching wallet transactions for loan ID:", loanId);
			const response = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: WalletTransaction[];
			}>(`/api/admin/loans/${loanId}/transactions`);

			console.log("📊 Wallet transactions API response:", response);

			if (response.success && response.data) {
				console.log("✅ Wallet transactions data received:", {
					totalTransactions: response.data.length,
					transactions: response.data,
				});

				setWalletTransactions(response.data);
			} else {
				console.log(
					"❌ Failed to get wallet transactions data:",
					response
				);
				setWalletTransactions([]);
			}
		} catch (error) {
			console.error("Error fetching wallet transactions:", error);
			setWalletTransactions([]);
		} finally {
			setLoadingTransactions(false);
		}
	};

	const fetchApplicationHistory = async (applicationId: string) => {
		try {
			setLoadingApplicationHistory(true);
			console.log("🔍 Fetching application history for application ID:", applicationId);
			const response = await fetchWithAdminTokenRefresh<
				| {
						applicationId: string;
						currentStatus: string;
						timeline: LoanApplicationHistory[];
				  }
				| LoanApplicationHistory[]
			>(`/api/admin/applications/${applicationId}/history`);

			console.log("📊 Application history API response:", response);

			// Handle both old array format and new object format
			let history: LoanApplicationHistory[] = [];
			if (Array.isArray(response)) {
				// Old format - direct array
				history = response;
			} else if (
				response &&
				typeof response === "object" &&
				"timeline" in response
			) {
				// New format - object with timeline property
				history = response.timeline || [];
			}

			console.log("✅ Application history data received:", {
				totalHistory: history.length,
				history: history,
			});

			setApplicationHistory(history);
		} catch (error) {
			console.error("Error fetching application history:", error);
			setApplicationHistory([]);
		} finally {
			setLoadingApplicationHistory(false);
		}
	};

	const filterLoans = useCallback(() => {
		let filtered = [...loans];

		// Apply status filter
		if (statusFilter === "active") {
			filtered = filtered.filter((loan) => loan.status === "ACTIVE");
		} else if (statusFilter === "pending_discharge") {
			filtered = filtered.filter(
				(loan) => loan.status === "PENDING_DISCHARGE"
			);
		} else if (statusFilter === "discharged") {
			filtered = filtered.filter((loan) => loan.status === "DISCHARGED");
		} else if (statusFilter === "late") {
			filtered = filtered.filter((loan) => {
				if (loan.status !== "ACTIVE" || !loan.nextPaymentDue)
					return false;
				const dueDate = new Date(loan.nextPaymentDue);
				const today = new Date();
				return dueDate < today;
			});
		}

		// Apply search filter
		if (searchTerm) {
			const search = searchTerm.toLowerCase();

			// First, check for exact loan ID match (full ID or truncated ID) or application ID match
			const exactLoanMatch = filtered.find(
				(loan) =>
					loan.id.toLowerCase() === search ||
					loan.id.toLowerCase().substring(0, 8) === search ||
					(loan.applicationId &&
						loan.applicationId.toLowerCase() === search)
			);

			if (exactLoanMatch) {
				// If exact loan ID match found, show only that loan
				filtered = [exactLoanMatch];
			} else {
				// Otherwise, do partial matching across all fields
				filtered = filtered.filter(
					(loan) =>
						loan.user.fullName.toLowerCase().includes(search) ||
						loan.user.email.toLowerCase().includes(search) ||
						loan.id.toLowerCase().includes(search) ||
						(loan.applicationId &&
							loan.applicationId
								.toLowerCase()
								.includes(search)) ||
						(loan.application?.product?.name &&
							loan.application.product.name
								.toLowerCase()
								.includes(search)) ||
						(loan.application?.purpose &&
							loan.application.purpose
								.toLowerCase()
								.includes(search))
				);
			}
		}

		setFilteredLoans(filtered);
	}, [loans, searchTerm, statusFilter]);

	// Apply filters whenever dependencies change
	useEffect(() => {
		filterLoans();
	}, [filterLoans]);

	// Handle auto-selection separately to avoid circular dependency
	useEffect(() => {
		// Auto-select the first loan if there are results and no loan is currently selected or selected loan is not in filtered results
		if (
			filteredLoans.length > 0 &&
			(!selectedLoan ||
				!filteredLoans.find((loan) => loan.id === selectedLoan.id))
		) {
			const newSelectedLoan = filteredLoans[0];
			setSelectedLoan(newSelectedLoan);
			setSelectedTab("details"); // Reset to details tab when selecting new loan
			// Immediately fetch repayments for the selected loan to get accurate next payment data
			if (
				newSelectedLoan &&
				fetchedRepaymentsForLoan !== newSelectedLoan.id
			) {
				setFetchedRepaymentsForLoan(newSelectedLoan.id);
				fetchLoanRepayments(newSelectedLoan.id);
			}
		}
		// Clear selection if no results
		else if (filteredLoans.length === 0) {
			setSelectedLoan(null);
		}
	}, [filteredLoans, selectedLoan]);

	// Fetch repayments when repayments tab is selected
	useEffect(() => {
		console.log("🎯 Repayments useEffect triggered:", {
			selectedTab,
			hasSelectedLoan: !!selectedLoan,
			selectedLoanId: selectedLoan?.id,
			fetchedRepaymentsForLoan,
			hasRepayments: !!selectedLoan?.repayments,
			repaymentsCount: selectedLoan?.repayments?.length || 0,
		});

		if (
			selectedTab === "repayments" &&
			selectedLoan &&
			fetchedRepaymentsForLoan !== selectedLoan.id
		) {
			console.log("🚀 Triggering fetchLoanRepayments for full data");
			setFetchedRepaymentsForLoan(selectedLoan.id);
			fetchLoanRepayments(selectedLoan.id);
			// Also fetch wallet transactions to match payment details
			fetchWalletTransactions(selectedLoan.id);
		}
	}, [selectedTab, selectedLoan?.id, fetchedRepaymentsForLoan]);

	const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchTerm(e.target.value);
	};

	const handleRefresh = async () => {
		setRefreshing(true);

		// Store the currently selected loan ID
		const currentSelectedLoanId = selectedLoan?.id;

		try {
			// Fetch fresh loans data
			const response = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: LoanData[];
			}>("/api/admin/loans");

			if (response.success && response.data) {
				// Include all loan statuses (ACTIVE, PENDING_DISCHARGE, DISCHARGED)
				setLoans(response.data);

				// If a loan was previously selected, update it with fresh data
				if (currentSelectedLoanId) {
					const updatedSelectedLoan = response.data.find(
						(loan) => loan.id === currentSelectedLoanId
					);
					if (updatedSelectedLoan) {
						setSelectedLoan(updatedSelectedLoan);
					}

					// Reset fetch tracker to force fresh data
					setFetchedRepaymentsForLoan(null);
					// Clear existing data
					setWalletTransactions([]);
					setApplicationHistory([]);
					// Fetch fresh detailed data
					fetchLoanRepayments(currentSelectedLoanId);
					if (selectedTab === "audit") {
						fetchWalletTransactions(currentSelectedLoanId);
						if (updatedSelectedLoan && updatedSelectedLoan.applicationId) {
							fetchApplicationHistory(updatedSelectedLoan.applicationId);
						}
					}
				}
			} else {
				setError("Failed to load loans data");
			}
		} catch (error) {
			console.error("Error refreshing loans:", error);
			setError("Failed to refresh loans. Please try again.");
		} finally {
			setRefreshing(false);
		}
	};

	const handleViewLoan = (loan: LoanData) => {
		setSelectedLoan(loan);
		setSelectedTab("details"); // Reset to details tab when selecting new loan
		// Clear previous data
		setWalletTransactions([]);
		setApplicationHistory([]);
		setFetchedRepaymentsForLoan(null); // Reset repayments fetch tracker

		// Immediately fetch repayments to get accurate next payment data for details tab
		if (fetchedRepaymentsForLoan !== loan.id) {
			setFetchedRepaymentsForLoan(loan.id);
			fetchLoanRepayments(loan.id);
		}
	};

	const handleDischargeRequest = (
		action: "request" | "approve" | "reject"
	) => {
		setDischargeAction(action);
		setDischargeReason("");
		setDischargeNotes("");
		setShowDischargeModal(true);
	};

	const handleDischargeSubmit = async () => {
		if (!selectedLoan || !dischargeAction) return;

		// Validation
		if (dischargeAction === "request" && !dischargeReason.trim()) {
			alert("Please provide a reason for the discharge request");
			return;
		}
		if (dischargeAction === "approve" && !dischargeNotes.trim()) {
			alert("Please provide admin notes for the discharge approval");
			return;
		}
		if (dischargeAction === "reject" && !dischargeReason.trim()) {
			alert("Please provide a reason for rejecting the discharge");
			return;
		}

		setProcessingDischarge(true);

		try {
			const endpoint = `/api/admin/loans/${selectedLoan.id}/${dischargeAction}-discharge`;
			const body =
				dischargeAction === "approve"
					? { notes: dischargeNotes }
					: { reason: dischargeReason };

			const response = await fetchWithAdminTokenRefresh<{
				success: boolean;
				message?: string;
				data?: LoanData;
			}>(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			});

			if (response.success) {
				// Update the selected loan with the new status
				if (response.data) {
					setSelectedLoan(response.data);
				}

				// Refresh the loans list
				await handleRefresh();

				// Close modal
				setShowDischargeModal(false);

				// Show success message
				const actionText =
					dischargeAction === "request"
						? "requested"
						: dischargeAction === "approve"
						? "approved"
						: "rejected";
				alert(`Loan discharge ${actionText} successfully`);
			} else {
				alert(
					response.message || `Failed to ${dischargeAction} discharge`
				);
			}
		} catch (error) {
			console.error(`Error ${dischargeAction}ing discharge:`, error);
			alert(`Failed to ${dischargeAction} discharge. Please try again.`);
		} finally {
			setProcessingDischarge(false);
		}
	};

	const handleCreateManualPayment = (loanId?: string) => {
		// Pre-fill the loan ID if provided
		setManualPaymentForm({
			loanId: loanId || "",
			amount: "",
			paymentMethod: "bank_transfer",
			reference: "",
			notes: "",
			paymentDate: "",
		});
		setShowManualPaymentModal(true);
	};

	const handleManualPaymentSubmit = async () => {
		if (!manualPaymentForm.loanId || !manualPaymentForm.amount || !manualPaymentForm.reference) {
			alert("Please fill in all required fields (Loan ID, Amount, Reference)");
			return;
		}

		const amount = parseFloat(manualPaymentForm.amount);
		if (isNaN(amount) || amount <= 0) {
			alert("Please enter a valid payment amount greater than 0");
			return;
		}

		setProcessingManualPayment(true);
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
				
				// Refresh loans data to show updated balances
				await handleRefresh();
			} else {
				throw new Error(data.message || "Failed to create manual payment");
			}
		} catch (error) {
			console.error("Error creating manual payment:", error);
			alert(`Failed to create manual payment: ${error instanceof Error ? error.message : "Unknown error"}`);
		} finally {
			setProcessingManualPayment(false);
		}
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

	const formatDateTime = (dateString: string | null) => {
		if (!dateString) return "N/A";
		return new Date(dateString).toLocaleDateString("en-MY", {
			day: "numeric",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Helper function to calculate days late for a specific date
	const getDaysLateFromDate = (dueDate: string | null) => {
		if (!dueDate) return 0;
		const due = new Date(dueDate);
		const today = new Date();
		const diffTime = today.getTime() - due.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays > 0 ? diffDays : 0;
	};

	const getDaysLate = (loan: LoanData) => {
		// Use backend's overdueInfo if available and has overdue payments
		if (loan.overdueInfo?.hasOverduePayments && loan.overdueInfo.overdueRepayments.length > 0) {
			// Return the maximum days overdue from all overdue repayments
			const maxDaysLate = Math.max(...loan.overdueInfo.overdueRepayments.map(r => r.daysOverdue));
			console.log(`🔍 getDaysLate for loan ${loan.id.substring(0, 8)}: Using overdueInfo, maxDaysLate=${maxDaysLate}`);
			return maxDaysLate;
		}
		
		// Fallback to nextPaymentDue check for backward compatibility
		const fallbackDays = getDaysLateFromDate(loan.nextPaymentDue);
		console.log(`🔍 getDaysLate for loan ${loan.id.substring(0, 8)}: Using fallback, days=${fallbackDays}, hasOverdueInfo=${!!loan.overdueInfo}, hasOverduePayments=${loan.overdueInfo?.hasOverduePayments}`);
		return fallbackDays;
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

	const getLoanStatusColor = (status: string) => {
		switch (status) {
			case "ACTIVE":
				return {
					bg: "bg-green-500/20",
					text: "text-green-200",
					border: "border-green-400/20",
				};
			case "PENDING_DISCHARGE":
				return {
					bg: "bg-yellow-500/20",
					text: "text-yellow-200",
					border: "border-yellow-400/20",
				};
			case "DISCHARGED":
				return {
					bg: "bg-blue-500/20",
					text: "text-blue-200",
					border: "border-blue-400/20",
				};
			default:
				return {
					bg: "bg-gray-500/20",
					text: "text-gray-200",
					border: "border-gray-400/20",
				};
		}
	};

	const getPaymentStatusText = (daysLate: number) => {
		if (daysLate === 0) return "Current";
		if (daysLate <= 15) return `${daysLate} days late`;
		if (daysLate <= 30) return `${daysLate} days late (Warning)`;
		if (daysLate > 30) return `${daysLate} days late (Critical)`;
		return "Unknown";
	};

	const calculateProgress = (loan: LoanData) => {
		const totalLoanAmount = loan.totalAmount || loan.principalAmount;
		if (totalLoanAmount === 0) return 0;
		// Calculate progress based on principal paid (excluding late fees)
		const principalPaid = loan.repayments?.reduce((total, repayment) => {
			return total + (repayment.principalPaid || 0);
		}, 0) || 0;
		return (principalPaid / totalLoanAmount) * 100;
	};

	const getRepaymentStatusColor = (status: string) => {
		switch (status) {
			case "COMPLETED":
				return "bg-green-500/20 text-green-200 border border-green-400/20";
			case "PENDING":
				return "bg-yellow-500/20 text-yellow-200 border border-yellow-400/20";
			case "OVERDUE":
				return "bg-red-500/20 text-red-200 border border-red-400/20";
			default:
				return "bg-gray-500/20 text-gray-200 border border-gray-400/20";
		}
	};

	const getDaysOverdue = (dueDate: string) => {
		const today = new Date();
		const due = new Date(dueDate);
		const diffTime = today.getTime() - due.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays > 0 ? diffDays : 0;
	};

	const getRepaymentStats = (repayments: LoanRepayment[]) => {
		const completed = repayments.filter(
			(r) => r.status === "COMPLETED"
		).length;
		const pending = repayments.filter((r) => r.status === "PENDING").length;
		const overdue = repayments.filter((r) => {
			if (r.status !== "PENDING") return false;
			return getDaysOverdue(r.dueDate) > 0;
		}).length;
		const totalPaid = repayments
			.filter((r) => r.status === "COMPLETED")
			.reduce((sum, r) => sum + r.amount, 0);

		return { completed, pending, overdue, totalPaid };
	};

	// Helper functions for application history
	const getStatusLabel = (status: string) => {
		switch (status) {
			case "INCOMPLETE":
				return "Incomplete";
			case "PENDING_APP_FEE":
				return "Pending Application Fee";
			case "PENDING_KYC":
				return "Pending KYC";
			case "PENDING_APPROVAL":
				return "Pending Approval";
			case "PENDING_ATTESTATION":
				return "Pending Attestation";
			case "PENDING_SIGNATURE":
				return "Pending Signature";
			case "PENDING_DISBURSEMENT":
				return "Pending Disbursement";
			case "APPROVED":
				return "Approved";
			case "REJECTED":
				return "Rejected";
			case "WITHDRAWN":
				return "Withdrawn";
			case "ACTIVE":
				return "Loan Active";
			case "DISBURSED":
				return "Disbursed";
			default:
				return status.replace(/_/g, " ").toLowerCase();
		}
	};

	const getHistoryActionDescription = (
		previousStatus: string | null,
		newStatus: string,
		changeReason?: string
	): string => {
		// If changeReason is provided, use it directly
		if (changeReason) {
			return changeReason;
		}

		// If no previous status, this is application creation
		if (!previousStatus) {
			return `Application created with status: ${getStatusLabel(newStatus)}`;
		}

		// Otherwise, this is a status change
		return `Status changed to ${getStatusLabel(newStatus)}`;
	};

	const getNextPaymentDetails = (repayments: LoanRepayment[]) => {
		if (!repayments || repayments.length === 0) {
			return { amount: 0, dueDate: null, installmentNumber: null };
		}

		// Find the first repayment that still has a balance remaining
		const nextPayment = repayments
			.filter((r) => {
				// Calculate remaining balance for this repayment
				const remainingBalance =
					r.status === "COMPLETED"
						? 0 // Completed repayments have 0 balance
						: r.actualAmount && r.actualAmount > 0
						? r.amount - r.actualAmount // Partial payment: remaining balance
						: r.amount; // No payments made

				return remainingBalance > 0;
			})
			.sort(
				(a, b) =>
					new Date(a.dueDate).getTime() -
					new Date(b.dueDate).getTime()
			)[0];

		if (!nextPayment) {
			return { amount: 0, dueDate: null, installmentNumber: null };
		}

		// Calculate the remaining balance for the next payment
		const remainingBalance =
			nextPayment.status === "COMPLETED"
				? 0 // Completed repayments have 0 balance
				: nextPayment.actualAmount && nextPayment.actualAmount > 0
				? nextPayment.amount - nextPayment.actualAmount // Partial payment: remaining balance
				: nextPayment.amount; // No payments made

		return {
			amount: remainingBalance,
			dueDate: nextPayment.dueDate,
			installmentNumber: nextPayment.installmentNumber,
		};
	};

	const downloadCSV = async () => {
		try {
			setRefreshing(true);
			
			// Prepare CSV data with comprehensive loan information
			const csvData = [];
			
			// Add header row
			csvData.push([
				'Loan ID',
				'User Name',
				'Email',
				'Phone',
				'Product',
				'Loan Purpose',
				'Principal Amount',
				'Total Amount',
				'Outstanding Balance',
				'Interest Rate (%)',
				'Term (months)',
				'Monthly Payment',
				'Total Paid',
				'Next Payment Due',
				'Status',
				'Disbursed At',
				'Created At',
				'Employer',
				'Monthly Income',
				'Bank Name',
				'Account Number',
				'--- REPAYMENTS ---',
				'Repayment ID',
				'Installment #',
				'Due Date',
				'Amount',
				'Principal',
				'Interest',
				'Status',
				'Paid At',
				'Payment Type',
				'Days Late',
				'Late Fee Amount',
				'Late Fees Paid',
				'Principal Paid',
				'Contributing Payments',
				'--- AUDIT TRAIL ---',
				'History ID',
				'Previous Status',
				'New Status',
				'Changed By',
				'Change Reason',
				'Notes',
				'Changed At'
			]);

			// Process each loan
			for (const loan of filteredLoans) {
				// Fetch detailed repayments data if not already loaded
				let repayments = loan.repayments || [];
				if (!repayments.length && loan.id) {
					try {
						const repaymentsData = await fetchWithAdminTokenRefresh(
							`/api/admin/loans/${loan.id}/repayments`
						) as any;
						repayments = repaymentsData.repayments || [];
					} catch (error) {
						console.error('Error fetching repayments for CSV:', error);
					}
				}

				// Fetch application history
				let history: LoanApplicationHistory[] = [];
				if (loan.applicationId) {
					try {
						const historyData = await fetchWithAdminTokenRefresh(
							`/api/admin/applications/${loan.applicationId}/history`
						) as any;
						// The API returns the timeline directly as an array
						history = Array.isArray(historyData) ? historyData : (historyData.timeline || historyData.history || []);
						console.log(`CSV Export - Fetched ${history.length} history entries for loan ${loan.id}`);
					} catch (error) {
						console.error('Error fetching history for CSV:', error);
					}
				}

				// Base loan data
				const baseLoanData = [
					loan.id,
					loan.application?.user?.fullName || loan.user?.fullName || '',
					loan.application?.user?.email || loan.user?.email || '',
					loan.application?.user?.phoneNumber || loan.user?.phoneNumber || '',
					loan.application?.product?.name || '',
					loan.application?.purpose || '',
					formatCurrency(loan.principalAmount),
					formatCurrency(loan.totalAmount || loan.principalAmount),
					formatCurrency(loan.outstandingBalance),
					`${loan.interestRate}%`,
					loan.term,
					formatCurrency(loan.monthlyPayment),
					formatCurrency(loan.totalPaid || 0),
					loan.nextPaymentDue ? formatDate(loan.nextPaymentDue) : '',
					loan.status,
					loan.disbursedAt ? formatDateTime(loan.disbursedAt) : '',
					formatDateTime(loan.createdAt),
					loan.application?.user?.employerName || '',
					loan.application?.user?.monthlyIncome || '',
					loan.application?.user?.bankName || '',
					loan.application?.user?.accountNumber || ''
				];

				// Add repayments data first
				if (repayments.length > 0) {
					repayments.forEach((repayment) => {
						const contributingPaymentsText = repayment.contributingPayments?.map(
							p => `${p.reference}: ${formatCurrency(p.amount)} (${formatDateTime(p.createdAt)})`
						).join('; ') || '';

						csvData.push([
							...baseLoanData,
							'--- REPAYMENTS ---',
							repayment.id,
							repayment.installmentNumber || '',
							formatDate(repayment.dueDate),
							formatCurrency(repayment.amount),
							formatCurrency(repayment.principalAmount),
							formatCurrency(repayment.interestAmount),
							repayment.status,
							repayment.paidAt ? formatDateTime(repayment.paidAt) : '',
							repayment.paymentType || '',
							repayment.daysLate || '',
							formatCurrency(repayment.lateFeeAmount || 0),
							formatCurrency(repayment.lateFeesPaid || 0),
							formatCurrency(repayment.principalPaid || 0),
							contributingPaymentsText,
							'--- AUDIT TRAIL ---',
							'', '', '', '', '', '', ''
						]);
					});
				} else {
					// Add empty repayments row if no repayments exist
					csvData.push([
						...baseLoanData,
						'--- REPAYMENTS ---',
						'', '', '', '', '', '', '', '', '', '', '', '', '', '',
						'--- AUDIT TRAIL ---',
						'', '', '', '', '', '', ''
					]);
				}

				// Add audit trail data as separate rows (application history only for bulk export to avoid too much data)
				if (history.length > 0) {
					console.log(`CSV Export - Bulk - Adding ${history.length} history entries for loan ${loan.id}`);
					history.forEach(historyEntry => {
						csvData.push([
							...baseLoanData,
							'--- REPAYMENTS ---',
							'', '', '', '', '', '', '', '', '', '', '', '', '', '',
							'--- AUDIT TRAIL ---',
							historyEntry.id,
							historyEntry.previousStatus || '',
							historyEntry.newStatus,
							historyEntry.changedBy,
							historyEntry.changeReason || '',
							historyEntry.notes || '',
							formatDateTime(historyEntry.createdAt)
						]);
					});
				} else {
					console.log(`CSV Export - Bulk - No history entries found for loan ${loan.id}`);
				}
			}

			// Convert to CSV string
			const csvContent = csvData
				.map(row => 
					row.map(cell => {
						// Escape quotes and wrap in quotes if contains comma, quote, or newline
						const cellString = String(cell || '');
						if (cellString.includes(',') || cellString.includes('"') || cellString.includes('\n')) {
							return '"' + cellString.replace(/"/g, '""') + '"';
						}
						return cellString;
					}).join(',')
				)
				.join('\n');

			// Create and download the file
			const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
			const link = document.createElement('a');
			
			if (link.download !== undefined) {
				const url = URL.createObjectURL(blob);
				link.setAttribute('href', url);
				link.setAttribute('download', `loans_data_${new Date().toISOString().split('T')[0]}.csv`);
				link.style.visibility = 'hidden';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			}
		} catch (error) {
			console.error('Error downloading CSV:', error);
			setError('Failed to download CSV file');
		} finally {
			setRefreshing(false);
		}
	};

	const downloadIndividualLoanCSV = async (loan: LoanData) => {
		try {
			setRefreshing(true);
			
			// Prepare CSV data for individual loan
			const csvData = [];
			
			// Add header row
			csvData.push([
				'Loan ID',
				'User Name',
				'Email',
				'Phone',
				'Product',
				'Loan Purpose',
				'Principal Amount',
				'Total Amount',
				'Outstanding Balance',
				'Interest Rate (%)',
				'Term (months)',
				'Monthly Payment',
				'Total Paid',
				'Next Payment Due',
				'Status',
				'Disbursed At',
				'Created At',
				'Employer',
				'Monthly Income',
				'Bank Name',
				'Account Number',
				'--- REPAYMENTS ---',
				'Repayment ID',
				'Installment #',
				'Due Date',
				'Amount',
				'Principal',
				'Interest',
				'Status',
				'Paid At',
				'Payment Type',
				'Days Late',
				'Late Fee Amount',
				'Late Fees Paid',
				'Principal Paid',
				'Contributing Payments',
				'--- AUDIT TRAIL ---',
				'Event ID',
				'Event Type',
				'Event Description',
				'Performed By',
				'Category/Reason',
				'Details/Notes',
				'Event Time'
			]);

			// Fetch detailed repayments data if not already loaded
			let repayments = loan.repayments || [];
			if (!repayments.length && loan.id) {
				try {
					const repaymentsData = await fetchWithAdminTokenRefresh(
						`/api/admin/loans/${loan.id}/repayments`
					) as any;
					repayments = repaymentsData.repayments || [];
				} catch (error) {
					console.error('Error fetching repayments for CSV:', error);
				}
			}

			// Fetch application history
			let history: LoanApplicationHistory[] = [];
			if (loan.applicationId) {
				try {
					console.log(`CSV Export - Fetching history for application ID: ${loan.applicationId}`);
					const historyData = await fetchWithAdminTokenRefresh(
						`/api/admin/applications/${loan.applicationId}/history`
					) as any;
					console.log(`CSV Export - Raw history response:`, historyData);
					// The API returns the timeline directly as an array
					history = Array.isArray(historyData) ? historyData : (historyData.timeline || historyData.history || []);
					console.log(`CSV Export - Individual Loan - Fetched ${history.length} history entries for loan ${loan.id}`);
					if (history.length > 0) {
						console.log(`CSV Export - First history entry:`, history[0]);
					}
				} catch (error) {
					console.error('Error fetching history for CSV:', error);
				}
			} else {
				console.log(`CSV Export - No application ID for loan ${loan.id}`);
			}

			// Base loan data
			const baseLoanData = [
				loan.id,
				loan.application?.user?.fullName || loan.user?.fullName || '',
				loan.application?.user?.email || loan.user?.email || '',
				loan.application?.user?.phoneNumber || loan.user?.phoneNumber || '',
				loan.application?.product?.name || '',
				loan.application?.purpose || '',
				formatCurrency(loan.principalAmount),
				formatCurrency(loan.totalAmount || loan.principalAmount),
				formatCurrency(loan.outstandingBalance),
				`${loan.interestRate}%`,
				loan.term,
				formatCurrency(loan.monthlyPayment),
				formatCurrency(loan.totalPaid || 0),
				loan.nextPaymentDue ? formatDate(loan.nextPaymentDue) : '',
				loan.status,
				loan.disbursedAt ? formatDateTime(loan.disbursedAt) : '',
				formatDateTime(loan.createdAt),
				loan.application?.user?.employerName || '',
				loan.application?.user?.monthlyIncome || '',
				loan.application?.user?.bankName || '',
				loan.application?.user?.accountNumber || ''
			];

			// Add repayments data first
			if (repayments.length > 0) {
				repayments.forEach((repayment) => {
					const contributingPaymentsText = repayment.contributingPayments?.map(
						p => `${p.reference}: ${formatCurrency(p.amount)} (${formatDateTime(p.createdAt)})`
					).join('; ') || '';

					csvData.push([
						...baseLoanData,
						'--- REPAYMENTS ---',
						repayment.id,
						repayment.installmentNumber || '',
						formatDate(repayment.dueDate),
						formatCurrency(repayment.amount),
						formatCurrency(repayment.principalAmount),
						formatCurrency(repayment.interestAmount),
						repayment.status,
						repayment.paidAt ? formatDateTime(repayment.paidAt) : '',
						repayment.paymentType || '',
						repayment.daysLate || '',
						formatCurrency(repayment.lateFeeAmount || 0),
						formatCurrency(repayment.lateFeesPaid || 0),
						formatCurrency(repayment.principalPaid || 0),
						contributingPaymentsText,
						'--- AUDIT TRAIL ---',
						'', '', '', '', '', '', ''
					]);
				});
			} else {
				// Add empty repayments row if no repayments exist
				csvData.push([
					...baseLoanData,
					'--- REPAYMENTS ---',
					'', '', '', '', '', '', '', '', '', '', '', '', '', '',
					'--- AUDIT TRAIL ---',
					'', '', '', '', '', '', ''
				]);
			}

			// Fetch wallet transactions for audit trail
			let walletTransactions: WalletTransaction[] = [];
			try {
				console.log(`CSV Export - Fetching transactions for loan ID: ${loan.id}`);
				const transactionsData = await fetchWithAdminTokenRefresh(
					`/api/admin/loans/${loan.id}/transactions`
				) as any;
				console.log(`CSV Export - Raw transactions response:`, transactionsData);
				// Handle different response structures
				if (transactionsData.success && transactionsData.data) {
					walletTransactions = transactionsData.data;
				} else if (transactionsData.transactions) {
					walletTransactions = transactionsData.transactions;
				} else if (Array.isArray(transactionsData)) {
					walletTransactions = transactionsData;
				} else {
					walletTransactions = [];
				}
				console.log(`CSV Export - Extracted ${walletTransactions.length} wallet transactions`);
				if (walletTransactions.length > 0) {
					console.log(`CSV Export - First transaction:`, walletTransactions[0]);
				}
			} catch (error) {
				console.error('Error fetching wallet transactions for CSV:', error);
			}

			// Add audit trail data (application history + wallet transactions)
			const allAuditEvents = [
				// Application history events
				...history.map(item => ({
					type: 'application' as const,
					id: item.id,
					createdAt: item.createdAt,
					data: item
				})),
				// Wallet transaction events
				...walletTransactions.map(transaction => ({
					type: 'transaction' as const,
					id: transaction.id,
					createdAt: transaction.createdAt,
					data: transaction
				}))
			].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

			console.log(`CSV Export - Individual Loan - Total audit events: ${allAuditEvents.length} (${history.length} history + ${walletTransactions.length} transactions)`);

			// Add audit trail entries as separate rows
			if (allAuditEvents.length > 0) {
				console.log(`CSV Export - Individual Loan - Adding ${allAuditEvents.length} audit trail entries`);
				allAuditEvents.forEach((event, index) => {
					if (event.type === 'application') {
						const historyData = event.data as LoanApplicationHistory;
						console.log(`CSV Export - Adding application history event ${index + 1}: ${historyData.previousStatus} -> ${historyData.newStatus}`);
						csvData.push([
							...baseLoanData,
							'--- REPAYMENTS ---',
							'', '', '', '', '', '', '', '', '', '', '', '', '', '',
							'--- AUDIT TRAIL ---',
							historyData.id,
							`Application Status Change`,
							`${historyData.previousStatus || 'NEW'} → ${historyData.newStatus}`,
							historyData.changedBy || 'System',
							historyData.changeReason || 'Status update',
							historyData.notes || '',
							formatDateTime(historyData.createdAt)
						]);
					} else {
						const transactionData = event.data as WalletTransaction;
						console.log(`CSV Export - Adding transaction event ${index + 1}: ${transactionData.type} - ${formatCurrency(Math.abs(transactionData.amount))}`);
						
						// Create a more descriptive transaction description
						let transactionDescription = '';
						if (transactionData.type === 'DEPOSIT') {
							transactionDescription = 'Wallet Deposit';
						} else if (transactionData.type === 'WITHDRAWAL') {
							transactionDescription = 'Wallet Withdrawal';
						} else if (transactionData.type === 'LOAN_REPAYMENT') {
							transactionDescription = 'Loan Repayment';
						} else if (transactionData.type === 'TRANSFER') {
							transactionDescription = 'Transfer';
						} else {
							transactionDescription = `Payment Transaction (${transactionData.type || 'Unknown'})`;
						}
						
						// Create detailed notes including amount, reference, and description
						const transactionNotes = [
							`Amount: ${formatCurrency(Math.abs(transactionData.amount))}`,
							transactionData.reference ? `Reference: ${transactionData.reference}` : null,
							transactionData.description ? `Description: ${transactionData.description}` : null,
							transactionData.metadata ? `Metadata: ${JSON.stringify(transactionData.metadata)}` : null
						].filter(Boolean).join(' | ');
						
						csvData.push([
							...baseLoanData,
							'--- REPAYMENTS ---',
							'', '', '', '', '', '', '', '', '', '', '', '', '', '',
							'--- AUDIT TRAIL ---',
							transactionData.id,
							transactionDescription,
							transactionData.status || 'COMPLETED',
							'System',
							transactionData.type || 'TRANSACTION',
							transactionNotes,
							formatDateTime(transactionData.createdAt)
						]);
					}
				});
			} else {
				console.log(`CSV Export - Individual Loan - No audit trail events found for loan ${loan.id}`);
			}

			// Convert to CSV string
			const csvContent = csvData
				.map(row => 
					row.map(cell => {
						// Escape quotes and wrap in quotes if contains comma, quote, or newline
						const cellString = String(cell || '');
						if (cellString.includes(',') || cellString.includes('"') || cellString.includes('\n')) {
							return '"' + cellString.replace(/"/g, '""') + '"';
						}
						return cellString;
					}).join(',')
				)
				.join('\n');

			// Create and download the file
			const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
			const link = document.createElement('a');
			
			if (link.download !== undefined) {
				const url = URL.createObjectURL(blob);
				link.setAttribute('href', url);
				link.setAttribute('download', `loan_${loan.id.substring(0, 8)}_${new Date().toISOString().split('T')[0]}.csv`);
				link.style.visibility = 'hidden';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			}
		} catch (error) {
			console.error('Error downloading individual loan CSV:', error);
			setError('Failed to download loan CSV file');
		} finally {
			setRefreshing(false);
		}
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
			title="Loans Management"
			description="Manage and monitor loans across all statuses"
		>
			{/* Header and Controls */}
			<div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="text-xl font-semibold text-white mb-2">
						Loans Management
					</h2>
					<p className="text-gray-400">
						{filteredLoans.length} loan
						{filteredLoans.length !== 1 ? "s" : ""} with total
						outstanding:{" "}
						{formatCurrency(
							filteredLoans.reduce(
								(sum, loan) => sum + loan.outstandingBalance,
								0
							)
						)}
						{" | "}
						Total loan value:{" "}
						{formatCurrency(
							filteredLoans.reduce(
								(sum, loan) =>
									sum +
									(loan.totalAmount || loan.principalAmount),
								0
							)
						)}
					</p>
				</div>
				<div className="mt-4 md:mt-0 flex gap-3">
					<button
						onClick={() => handleCreateManualPayment()}
						className="flex items-center px-4 py-2 bg-purple-500/20 text-purple-200 rounded-lg border border-purple-400/20 hover:bg-purple-500/30 transition-colors"
					>
						<CurrencyDollarIcon className="h-4 w-4 mr-2" />
						Create Manual Payment
					</button>
					<button
						onClick={downloadCSV}
						disabled={refreshing}
						className="flex items-center px-4 py-2 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors"
					>
						{refreshing ? (
							<ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<DocumentArrowDownIcon className="h-4 w-4 mr-2" />
						)}
						Download All (CSV)
					</button>
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
						Refresh Data
					</button>
				</div>
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
							className="block w-full pl-10 pr-10 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
							placeholder="Search by name, email, loan ID, or purpose"
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
							onClick={() => setStatusFilter("active")}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								statusFilter === "active"
									? "bg-green-500/30 text-green-100 border-green-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							Current
						</button>
						<button
							onClick={() => setStatusFilter("pending_discharge")}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								statusFilter === "pending_discharge"
									? "bg-yellow-500/30 text-yellow-100 border-yellow-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							Pending Discharge
						</button>
						<button
							onClick={() => setStatusFilter("discharged")}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								statusFilter === "discharged"
									? "bg-blue-500/30 text-blue-100 border-blue-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							Discharged
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
								Loans ({filteredLoans.length})
							</h3>
						</div>
						<div className="overflow-y-auto max-h-[70vh]">
							{filteredLoans.length > 0 ? (
								<ul className="divide-y divide-gray-700/30">
									{filteredLoans.map((loan) => {
										const daysLate = getDaysLate(loan);
										const lateStatus =
											getLateStatusColor(daysLate);
										const loanStatus = getLoanStatusColor(
											loan.status
										);

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
															{loan.application
																?.product
																?.name || "N/A"}
														</p>
													</div>
													<div className="text-right ml-4">
														{/* Status Display */}
														{loan.status ===
														"ACTIVE" ? (
															/* Show payment status for active loans */
															<span
																className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${lateStatus.bg} ${lateStatus.text} ${lateStatus.border} mb-1`}
															>
																{getPaymentStatusText(
																	daysLate
																)}
															</span>
														) : (
															/* Show loan status for non-active loans */
															<span
																className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${loanStatus.bg} ${loanStatus.text} ${loanStatus.border} mb-1`}
															>
																{loan.status ===
																"PENDING_DISCHARGE"
																	? "Pending Discharge"
																	: loan.status ===
																	  "DISCHARGED"
																	? "Discharged"
																	: loan.status}
															</span>
														)}

														<p className="text-xs text-gray-400 mt-2">
															Outstanding:
														</p>
														<p className="text-xs font-medium text-white">
															{formatCurrency(
																loan.outstandingBalance
															)}
														</p>
														<p className="text-xs text-blue-300 mt-1">
															of{" "}
															{formatCurrency(
																loan.totalAmount ||
																	loan.principalAmount
															)}{" "}
															total
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
										No loans found
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
								<div className="flex items-center gap-3">
									<h3 className="text-lg font-medium text-white">
										Loan Details
									</h3>
									<span className="px-2 py-1 bg-gray-500/20 text-gray-300 text-xs font-medium rounded-full border border-gray-400/20">
										ID: {selectedLoan.id.substring(0, 8)}
									</span>
								</div>
								<button
									onClick={() => downloadIndividualLoanCSV(selectedLoan)}
									disabled={refreshing}
									className="flex items-center px-3 py-1.5 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors text-xs"
									title="Download loan data as CSV"
								>
									{refreshing ? (
										<ArrowPathIcon className="h-3 w-3 mr-1 animate-spin" />
									) : (
										<DocumentArrowDownIcon className="h-3 w-3 mr-1" />
									)}
									Download CSV
								</button>
							</div>

							<div className="p-6">
								{/* Tab Navigation */}
								<div className="flex border-b border-gray-700/30 mb-6">
									<div
										className={`px-4 py-2 cursor-pointer transition-colors ${
											selectedTab === "details"
												? "border-b-2 border-blue-400 font-medium text-white"
												: "text-gray-400 hover:text-gray-200"
										}`}
										onClick={() =>
											setSelectedTab("details")
										}
									>
										Details
									</div>
									<div
										className={`px-4 py-2 cursor-pointer transition-colors ${
											selectedTab === "repayments"
												? "border-b-2 border-blue-400 font-medium text-white"
												: "text-gray-400 hover:text-gray-200"
										}`}
										onClick={() =>
											setSelectedTab("repayments")
										}
									>
										<ArrowsRightLeftIcon className="inline h-4 w-4 mr-1" />
										Repayments
									</div>
									<div
										className={`px-4 py-2 cursor-pointer transition-colors ${
											selectedTab === "audit"
												? "border-b-2 border-blue-400 font-medium text-white"
												: "text-gray-400 hover:text-gray-200"
										}`}
										onClick={() => setSelectedTab("audit")}
									>
										<DocumentTextIcon className="inline h-4 w-4 mr-1" />
										Audit Trail
									</div>
								</div>

								{/* Tab Content */}
								{selectedTab === "details" && (
									<>
										{/* Summary Cards */}
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
														selectedLoan.totalAmount ||
															selectedLoan.principalAmount
													)}{" "}
													total loan
												</p>
												<div className="text-xs text-blue-300 mt-2 border-t border-gray-600 pt-2 text-center">
													<div>
														Principal:{" "}
														{formatCurrency(
															selectedLoan.principalAmount
														)}
													</div>
													{selectedLoan.totalAmount &&
														selectedLoan.totalAmount >
															selectedLoan.principalAmount && (
															<div className="text-gray-400">
																Interest:{" "}
																{formatCurrency(
																	selectedLoan.totalAmount -
																		selectedLoan.principalAmount
																)}
															</div>
														)}
												</div>
											</div>
											<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
												{(() => {
													const nextPayment =
														getNextPaymentDetails(
															selectedLoan.repayments ||
																[]
														);
													return (
														<>
															<p className="text-gray-400 text-sm mb-1">
																Next Payment
															</p>
															<p className="text-2xl font-bold text-white">
																{nextPayment.amount >
																0
																	? formatCurrency(
																			nextPayment.amount
																	  )
																	: "Fully Paid"}
															</p>
															<p className="text-xs text-gray-400 mt-1">
																{nextPayment.dueDate ? (
																	<>
																		Due:{" "}
																		{formatDate(
																			nextPayment.dueDate
																		)}
																		{nextPayment.installmentNumber && (
																			<span className="ml-2">
																				(#
																				{
																					nextPayment.installmentNumber
																				}

																				)
																			</span>
																		)}
																	</>
																) : (
																	"No pending payments"
																)}
															</p>
														</>
													);
												})()}
											</div>
											<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
												{(() => {
													const repayments =
														selectedLoan.repayments ||
														[];
													const completedRepayments =
														repayments.filter(
															(r) =>
																r.status ===
																"COMPLETED"
														);

													if (
														completedRepayments.length ===
														0
													) {
														return (
															<>
																<p className="text-gray-400 text-sm mb-1">
																	Payment
																	Performance
																</p>
																<p className="text-2xl font-bold text-gray-400">
																	N/A
																</p>
																<p className="text-xs text-gray-400 mt-1">
																	No payments
																	made yet
																</p>
															</>
														);
													}

													const onTimeOrEarlyPayments =
														completedRepayments.filter(
															(r) => {
																const paymentDate =
																	new Date(
																		r.actualPaymentDate ||
																			r.paidAt ||
																			r.createdAt
																	);
																const dueDate =
																	new Date(
																		r.dueDate
																	);
																return (
																	paymentDate <=
																	dueDate
																);
															}
														);

													const percentage =
														Math.round(
															(onTimeOrEarlyPayments.length /
																completedRepayments.length) *
																100
														);

													return (
														<>
															<p className="text-gray-400 text-sm mb-1">
																Payment
																Performance
															</p>
															<p className="text-2xl font-bold text-white">
																{percentage}%
															</p>
															<p className="text-xs text-gray-400 mt-1">
																{
																	onTimeOrEarlyPayments.length
																}{" "}
																of{" "}
																{
																	completedRepayments.length
																}{" "}
																on-time
															</p>
														</>
													);
												})()}
											</div>
											<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
												{(() => {
													const repayments = selectedLoan.repayments || [];
													const totalLateFeesPaid = repayments.reduce((total, repayment) => {
														return total + (repayment.lateFeesPaid || 0);
													}, 0);
													
													const totalLateFeesAssessed = repayments.reduce((total, repayment) => {
														return total + (repayment.lateFeeAmount || 0);
													}, 0);

													return (
														<>
															<p className="text-gray-400 text-sm mb-1">
																Late Fees Paid
															</p>
															<p className="text-2xl font-bold text-white">
																{totalLateFeesPaid > 0 
																	? formatCurrency(totalLateFeesPaid)
																	: formatCurrency(0)
																}
															</p>
															<p className="text-xs text-gray-400 mt-1">
																{totalLateFeesAssessed > 0 ? (
																	<>
																		of {formatCurrency(totalLateFeesAssessed)} assessed
																		{totalLateFeesAssessed > totalLateFeesPaid && (
																			<div className="text-xs text-red-400 mt-1">
																				{formatCurrency(totalLateFeesAssessed - totalLateFeesPaid)} outstanding
																			</div>
																		)}
																	</>
																) : (
																	"No late fees assessed"
																)}
															</p>
														</>
													);
												})()}
											</div>
										</div>

										{/* Payment Status Alert */}
										{(() => {
											// Use backend's overdueInfo for consistent overdue detection
											const hasOverduePayments = selectedLoan.overdueInfo?.hasOverduePayments;
											const overdueRepayments = selectedLoan.overdueInfo?.overdueRepayments || [];
											
											// Get the most overdue repayment for display
											const mostOverdueRepayment = overdueRepayments.length > 0 
												? overdueRepayments.reduce((max, current) => 
													current.daysOverdue > max.daysOverdue ? current : max
												)
												: null;

											if (hasOverduePayments && mostOverdueRepayment) {
												const daysLate = mostOverdueRepayment.daysOverdue;
												const lateStatus =
													getLateStatusColor(
														daysLate
													);
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
																	Payment
																	Overdue:{" "}
																	{daysLate}{" "}
																	days late
																</p>
																<p className="text-sm text-gray-300 mt-1">
																	Payment of{" "}
																	{formatCurrency(
																		mostOverdueRepayment.totalAmountDue
																	)}{" "}
																	was due:{" "}
																	{formatDate(
																		mostOverdueRepayment.dueDate
																	)}
																	{mostOverdueRepayment.installmentNumber && (
																		<span className="ml-1">
																			(Installment
																			#
																			{
																				mostOverdueRepayment.installmentNumber
																			}
																			)
																		</span>
																	)}
																</p>
															</div>
														</div>
													</div>
												);
											}
											return null;
										})()}

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
														<p>Principal Paid</p>
														<p className="text-white font-medium">
															{formatCurrency(
																(() => {
																	// Calculate total principal paid from repayments (excluding late fees)
																	return selectedLoan.repayments?.reduce((total, repayment) => {
																		return total + (repayment.principalPaid || 0);
																	}, 0) || 0;
																})()
															)}
														</p>
													</div>
													<div className="text-right">
														<p>Outstanding Balance</p>
														<p className="text-white font-medium">
															{formatCurrency(
																selectedLoan.outstandingBalance
															)}
														</p>
													</div>
												</div>
											</div>
										</div>

										{/* Loan Details */}
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
											{/* Customer Information */}
											<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
												<h4 className="text-white font-medium mb-3 flex items-center justify-between">
													<div className="flex items-center">
														<UserCircleIcon className="h-5 w-5 mr-2 text-blue-400" />
														Customer Information
													</div>
													<Link
														href={`/dashboard/users?search=${encodeURIComponent(
															selectedLoan.user
																.email
														)}`}
														className="px-3 py-1 bg-blue-500/20 text-blue-200 rounded-md border border-blue-400/20 hover:bg-blue-500/30 transition-colors text-xs flex items-center"
													>
														<UserCircleIcon className="h-3 w-3 mr-1" />
														View Profile
													</Link>
												</h4>
												<div className="space-y-3">
													<div>
														<p className="text-gray-400 text-sm">
															Full Name
														</p>
														<p className="text-white">
															{
																selectedLoan
																	.user
																	.fullName
															}
														</p>
													</div>
													<div>
														<p className="text-gray-400 text-sm">
															Email
														</p>
														<p className="text-white">
															{
																selectedLoan
																	.user.email
															}
														</p>
													</div>
													<div>
														<p className="text-gray-400 text-sm">
															Phone
														</p>
														<p className="text-white">
															{selectedLoan.user
																.phoneNumber ||
																"N/A"}
														</p>
													</div>
													{selectedLoan.application
														?.user
														?.employmentStatus && (
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
															{selectedLoan
																.application
																?.product
																?.name || "N/A"}
														</p>
													</div>
													<div>
														<p className="text-gray-400 text-sm">
															Purpose
														</p>
														<p className="text-white">
															{selectedLoan
																.application
																?.purpose ||
																"N/A"}
														</p>
													</div>
													<div>
														<p className="text-gray-400 text-sm">
															Term
														</p>
														<p className="text-white">
															{selectedLoan.term}{" "}
															months
														</p>
													</div>
													<div>
														<p className="text-gray-400 text-sm">
															Interest Rate
														</p>
														<p className="text-white">
															{
																selectedLoan.interestRate
															}
															% p.a.
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

										{/* Action Buttons */}
										<div className="flex flex-wrap gap-3">
											{/* Manual Payment Button - Show for ACTIVE loans */}
											{selectedLoan.status === "ACTIVE" && (
												<button
													onClick={() => handleCreateManualPayment(selectedLoan.id)}
													className="px-4 py-2 bg-purple-500/20 text-purple-200 rounded-lg border border-purple-400/20 hover:bg-purple-500/30 transition-colors flex items-center"
												>
													<CurrencyDollarIcon className="h-5 w-5 mr-2" />
													Create Manual Payment
												</button>
											)}

											{selectedLoan.applicationId && (
												<Link
													href={`/dashboard/disbursements?search=${selectedLoan.applicationId}`}
													className="px-4 py-2 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors flex items-center"
												>
													<BanknotesIcon className="h-5 w-5 mr-2" />
													View Disbursement
												</Link>
											)}

											{/* Discharge Actions */}
											{selectedLoan.status === "ACTIVE" &&
												selectedLoan.outstandingBalance ===
													0 && (
													<button
														onClick={() =>
															handleDischargeRequest(
																"request"
															)
														}
														className="px-4 py-2 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors flex items-center"
													>
														<CheckCircleIcon className="h-5 w-5 mr-2" />
														Request Discharge
													</button>
												)}

											{selectedLoan.status ===
												"PENDING_DISCHARGE" && (
												<>
													<button
														onClick={() =>
															handleDischargeRequest(
																"approve"
															)
														}
														className="px-4 py-2 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors flex items-center"
													>
														<CheckCircleIcon className="h-5 w-5 mr-2" />
														Approve Discharge
													</button>
													<button
														onClick={() =>
															handleDischargeRequest(
																"reject"
															)
														}
														className="px-4 py-2 bg-red-500/20 text-red-200 rounded-lg border border-red-400/20 hover:bg-red-500/30 transition-colors flex items-center"
													>
														<XMarkIcon className="h-5 w-5 mr-2" />
														Reject Discharge
													</button>
												</>
											)}
										</div>
									</>
								)}

								{/* Repayments Tab */}
								{selectedTab === "repayments" && (
									<div>
										{(() => {
											console.log(
												"🎯 Repayments tab rendering:",
												{
													loadingRepayments,
													hasRepayments:
														!!selectedLoan.repayments,
													repaymentsCount:
														selectedLoan.repayments
															?.length || 0,
													selectedLoanId:
														selectedLoan.id,
												}
											);
											return null;
										})()}
										{loadingRepayments ? (
											<div className="flex items-center justify-center py-12">
												<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400"></div>
											</div>
										) : selectedLoan.repayments ? (
											<>
												{/* Enhanced Progress Visualization */}
												<div className="bg-gray-800/30 p-6 rounded-lg border border-gray-700/30 mb-6">
													<h4 className="text-white font-medium mb-4 flex items-center">
														<CalendarDaysIcon className="h-5 w-5 mr-2 text-purple-400" />
														Payment Timeline &
														Progress
													</h4>

													{/* Progress Bar with Payment Status */}
													<div className="mb-6">
														<div className="flex justify-between text-sm mb-2">
															<span className="text-gray-400">
																Loan Progress
															</span>
															<span className="text-white">
																{(() => {
																	// Calculate progress based on principal paid (excluding late fees)
																	const totalLoanAmount = selectedLoan.totalAmount || selectedLoan.principalAmount;
																	const principalPaid = selectedLoan.repayments?.reduce((total, repayment) => {
																		return total + (repayment.principalPaid || 0);
																	}, 0) || 0;
																	const progressPercent = totalLoanAmount > 0 ? Math.round((principalPaid / totalLoanAmount) * 100) : 0;
																	return progressPercent;
																})()}
																% Complete
															</span>
														</div>
														<div className="w-full bg-gray-700 rounded-full h-4 relative overflow-hidden">
															{/* Base progress */}
															<div
																className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full transition-all duration-300"
																style={{
																	width: `${(() => {
																		// Calculate progress based on principal paid (excluding late fees)
																		const totalLoanAmount = selectedLoan.totalAmount || selectedLoan.principalAmount;
																		const principalPaid = selectedLoan.repayments?.reduce((total, repayment) => {
																			return total + (repayment.principalPaid || 0);
																		}, 0) || 0;
																		return totalLoanAmount > 0 ? Math.round((principalPaid / totalLoanAmount) * 100) : 0;
																	})()}%`,
																}}
															></div>

															{/* Payment markers */}
															<div className="absolute inset-0 flex">
																{selectedLoan.repayments?.map(
																	(
																		repayment,
																		index
																	) => {
																		const position =
																			((index +
																				1) /
																				(selectedLoan
																					.repayments
																					?.length ??
																					1)) *
																			100;
																		const isOverdue =
																			repayment.status ===
																				"PENDING" &&
																			getDaysOverdue(
																				repayment.dueDate
																			) >
																				0;
																		const isCompleted =
																			repayment.status ===
																			"COMPLETED";
																		const isEarly =
																			repayment.paymentType ===
																			"EARLY";
																		const isLate =
																			repayment.paymentType ===
																			"LATE";

																		return (
																			<div
																				key={
																					repayment.id
																				}
																				className="absolute top-0 w-1 h-4 transform -translate-x-1/2"
																				style={{
																					left: `${position}%`,
																				}}
																				title={`Payment ${
																					index +
																					1
																				}: ${
																					repayment.status
																				} - Due ${formatDate(
																					repayment.dueDate
																				)}`}
																			>
																				<div
																					className={`w-1 h-4 ${
																						isCompleted
																							? isEarly
																								? "bg-green-400"
																								: isLate
																								? "bg-orange-400"
																								: "bg-blue-400"
																							: isOverdue
																							? "bg-red-500"
																							: "bg-gray-500"
																					}`}
																				></div>
																			</div>
																		);
																	}
																)}
															</div>
														</div>

														{/* Legend */}
														<div className="flex flex-wrap gap-4 mt-3 text-xs">
															<div className="flex items-center">
																<div className="w-3 h-3 bg-green-400 rounded mr-2"></div>
																<span className="text-gray-400">
																	Early
																	Payment
																</span>
															</div>
															<div className="flex items-center">
																<div className="w-3 h-3 bg-blue-400 rounded mr-2"></div>
																<span className="text-gray-400">
																	On-Time
																	Payment
																</span>
															</div>
															<div className="flex items-center">
																<div className="w-3 h-3 bg-orange-400 rounded mr-2"></div>
																<span className="text-gray-400">
																	Late Payment
																</span>
															</div>
															<div className="flex items-center">
																<div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
																<span className="text-gray-400">
																	Overdue
																</span>
															</div>
															<div className="flex items-center">
																<div className="w-3 h-3 bg-gray-500 rounded mr-2"></div>
																<span className="text-gray-400">
																	Pending
																</span>
															</div>
														</div>
													</div>

													{/* Payment Statistics */}
													<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
														<div className="text-center">
															<p className="text-gray-400 text-sm">
																Principal Paid
															</p>
															<p className="text-white font-medium text-lg">
																{formatCurrency(
																	(() => {
																		// Calculate total principal paid from repayments (excluding late fees)
																		return selectedLoan.repayments?.reduce((total, repayment) => {
																			return total + (repayment.principalPaid || 0);
																		}, 0) || 0;
																	})()
																)}
															</p>
														</div>
														<div className="text-center">
															<p className="text-gray-400 text-sm">
																Outstanding
																Balance
															</p>
															<p className="text-white font-medium text-lg">
																{formatCurrency(
																	selectedLoan.outstandingBalance
																)}
															</p>
														</div>
														<div className="text-center">
															{(() => {
																const nextPayment =
																	getNextPaymentDetails(
																		selectedLoan.repayments ||
																			[]
																	);
																return (
																	<>
																		<p className="text-gray-400 text-sm">
																			Next
																			Payment
																			Due
																		</p>
																		<p className="text-white font-medium text-lg">
																			{nextPayment.dueDate ? (
																				<>
																					{formatDate(
																						nextPayment.dueDate
																					)}
																					<br />
																					<span className="text-sm text-gray-300">
																						{formatCurrency(
																							nextPayment.amount
																						)}
																						{nextPayment.installmentNumber && (
																							<span className="ml-1">
																								(#
																								{
																									nextPayment.installmentNumber
																								}

																								)
																							</span>
																						)}
																					</span>
																				</>
																			) : (
																				"Fully Paid"
																			)}
																		</p>
																	</>
																);
															})()}
														</div>
													</div>
												</div>

												{/* Payment Summary */}
												<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 mb-6">
													<h5 className="text-white font-medium mb-3">
														Payment Summary
													</h5>
													<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
														<div>
															<p className="text-gray-400">
																Early Payments
															</p>
															<p className="text-green-400 font-medium">
																{selectedLoan.repayments?.filter(
																	(r) =>
																		r.paymentType ===
																		"EARLY"
																).length ?? 0}
															</p>
														</div>
														<div>
															<p className="text-gray-400">
																On-Time Payments
															</p>
															<p className="text-blue-400 font-medium">
																{selectedLoan.repayments?.filter(
																	(r) =>
																		r.paymentType ===
																		"ON_TIME"
																).length ?? 0}
															</p>
														</div>
														<div>
															<p className="text-gray-400">
																Late Payments
															</p>
															<p className="text-orange-400 font-medium">
																{selectedLoan.repayments?.filter(
																	(r) =>
																		r.paymentType ===
																		"LATE"
																).length ?? 0}
															</p>
														</div>
														<div>
															<p className="text-gray-400">
																Partial Payments
															</p>
															<p className="text-purple-400 font-medium">
																{selectedLoan.repayments?.filter(
																	(r) =>
																		r.paymentType ===
																		"PARTIAL"
																).length ?? 0}
															</p>
														</div>
													</div>
												</div>

												{/* Repayment Schedule Table */}
												<div className="bg-gray-800/30 rounded-lg border border-gray-700/30 overflow-hidden">
													<div className="p-4 border-b border-gray-700/30">
														<h4 className="text-white font-medium flex items-center">
															<CalendarDaysIcon className="h-5 w-5 mr-2 text-purple-400" />
															Detailed Repayment
															Schedule (
															{selectedLoan
																.repayments
																?.length ??
																0}{" "}
															payments)
														</h4>
													</div>
													<div className="overflow-x-auto">
														<table className="min-w-full divide-y divide-gray-700/30">
															<thead className="bg-gray-800/50">
																<tr>
																	<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
																		#
																	</th>
																	<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
																		Due Date
																	</th>
																	<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
																		Principal
																	</th>
																	<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
																		Late Fees
																	</th>
																	<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
																		Total Due
																	</th>
																	<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
																		Balance
																	</th>
																	<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
																		Status
																	</th>
																	<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
																		Cleared
																		Date
																	</th>
																</tr>
															</thead>
															<tbody className="divide-y divide-gray-700/30">
																{selectedLoan.repayments
																	?.sort(
																		(
																			a,
																			b
																		) =>
																			(a.installmentNumber ||
																				0) -
																			(b.installmentNumber ||
																				0)
																	)
																	.map(
																		(
																			repayment,
																			index
																		) => {
																			// Debug logging for table rendering
																			if (
																				index ===
																				0
																			) {
																				console.log(
																					"📋 Rendering repayments table:",
																					{
																						totalRepayments:
																							selectedLoan
																								.repayments
																								?.length ||
																							0,
																						firstRepayment:
																							selectedLoan
																								.repayments?.[0],
																						lastRepayment:
																							selectedLoan
																								.repayments?.[
																								selectedLoan
																									.repayments
																									.length -
																									1
																							],
																					}
																				);
																			}
																			const daysOverdue =
																				getDaysOverdue(
																					repayment.dueDate
																				);
																			const isOverdue =
																				repayment.status ===
																					"PENDING" &&
																				daysOverdue >
																					0;

																																		// Simplified status logic
															let displayStatus =
																"PENDING";
															let statusColor =
																"bg-yellow-500/20 text-yellow-200 border border-yellow-400/20";

															if (
																repayment.status ===
																"COMPLETED"
															) {
																displayStatus =
																	"PAID";
																statusColor =
																	"bg-green-500/20 text-green-200 border border-green-400/20";
															} else if (
																repayment.status ===
																"PARTIAL" ||
																repayment.paymentType ===
																	"PARTIAL"
															) {
																displayStatus =
																	"PARTIAL";
																statusColor =
																	"bg-blue-500/20 text-blue-200 border border-blue-400/20";
															} else if (
																repayment.status ===
																	"OVERDUE" ||
																isOverdue
															) {
																displayStatus =
																	"LATE";
																statusColor =
																	"bg-red-500/20 text-red-200 border border-red-400/20";
															}

																			return (
																				<tr
																					key={
																						repayment.id
																					}
																					className="hover:bg-gray-800/30"
																				>
																					<td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
																						{repayment.installmentNumber ||
																							"-"}
																					</td>
																					<td className="px-4 py-3 whitespace-nowrap text-sm text-white">
																						{formatDate(
																							repayment.dueDate
																						)}
																						{isOverdue && (
																							<div className="text-xs text-red-400 mt-1">
																								{
																									daysOverdue
																								}{" "}
																								days
																								overdue
																							</div>
																						)}
																					</td>
																					{/* Principal Column */}
																					<td className="px-4 py-3 whitespace-nowrap text-sm text-white">
																						<div>
																							{formatCurrency(
																								repayment.amount
																							)}
																							{/* Show principal paid info */}
																							{repayment.principalPaid && 
																								repayment.principalPaid > 0 && (
																								<div className="text-xs text-green-400 mt-1">
																									{formatCurrency(
																										repayment.principalPaid
																									)}{" "}
																									paid
																								</div>
																							)}
																						</div>
																					</td>
																					{/* Late Fees Column */}
																					<td className="px-4 py-3 whitespace-nowrap text-sm text-white">
																						<div>
																							{repayment.lateFeeAmount && 
																								repayment.lateFeeAmount > 0 ? (
																								<>
																									{formatCurrency(
																										repayment.lateFeeAmount
																									)}
																									{/* Show late fees paid info */}
																									{repayment.lateFeesPaid && 
																										repayment.lateFeesPaid > 0 && (
																										<div className="text-xs text-orange-400 mt-1">
																											{formatCurrency(
																												repayment.lateFeesPaid
																											)}{" "}
																											paid
																										</div>
																									)}
																								</>
																							) : (
																								<span className="text-gray-500">-</span>
																							)}
																						</div>
																					</td>
																					{/* Total Due Column */}
																					<td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
																						{formatCurrency(
																							repayment.amount + (repayment.lateFeeAmount || 0)
																						)}
																					</td>
																					{/* Balance Column */}
																					<td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
																						<div>
																							{(() => {
																								const principalBalance = repayment.status === "COMPLETED" 
																									? 0 
																									: repayment.amount - (repayment.principalPaid || 0);
																								const lateFeeBalance = (repayment.lateFeeAmount || 0) - (repayment.lateFeesPaid || 0);
																								const totalBalance = principalBalance + lateFeeBalance;
																								
																								return formatCurrency(Math.max(0, totalBalance));
																							})()}
																							{/* Show payment breakdown for partial payments */}
																							{(repayment.status === "PARTIAL" ||
																								repayment.paymentType === "PARTIAL") && (
																								<div className="text-xs text-blue-400 mt-1">
																									{(() => {
																										const totalPaid = (repayment.principalPaid || 0) + (repayment.lateFeesPaid || 0);
																										return totalPaid > 0 ? `${formatCurrency(totalPaid)} paid` : "";
																									})()}
																								</div>
																							)}
																						</div>
																					</td>
																					<td className="px-4 py-3 whitespace-nowrap">
																						<span
																							className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColor}`}
																						>
																							{
																								displayStatus
																							}
																						</span>
																					</td>
																					<td className="px-4 py-3 text-sm text-gray-300">
																						{repayment.status ===
																						"COMPLETED" ? (
																							<div>
																								<div className="text-white">
																									{formatDate(
																										repayment.actualPaymentDate ||
																											repayment.paidAt ||
																											repayment.createdAt
																									)}
																								</div>
																								{(() => {
																									const paymentDate =
																										new Date(
																											repayment.actualPaymentDate ||
																												repayment.paidAt ||
																												repayment.createdAt
																										);
																									const dueDate =
																										new Date(
																											repayment.dueDate
																										);
																									const diffTime =
																										paymentDate.getTime() -
																										dueDate.getTime();
																									const diffDays =
																										Math.ceil(
																											diffTime /
																												(1000 *
																													60 *
																													60 *
																													24)
																										);

																									if (
																										diffDays <
																										0
																									) {
																										// Paid early
																										return (
																											<div className="text-xs text-green-400 mt-1">
																												{Math.abs(
																													diffDays
																												)}{" "}
																												days
																												early
																											</div>
																										);
																									} else if (
																										diffDays >
																										0
																									) {
																										// Paid late
																										return (
																											<div className="text-xs text-orange-400 mt-1">
																												{
																													diffDays
																												}{" "}
																												days
																												late
																											</div>
																										);
																									} else {
																										// Paid on time
																										return (
																											<div className="text-xs text-blue-400 mt-1">
																												On
																												time
																											</div>
																										);
																									}
																								})()}
																							</div>
																						) : (
																							<span className="text-gray-500">
																								-
																							</span>
																						)}
																					</td>
																				</tr>
																			);
																		}
																	)}
															</tbody>
														</table>
													</div>
												</div>

												{/* Prepayment Summary */}
												{selectedLoan.totalPaid &&
													selectedLoan.totalPaid >
														0 && (
														<div className="mt-6 bg-green-800/20 p-4 rounded-lg border border-green-400/20">
															<h5 className="text-green-200 font-medium mb-3">
																Prepayment
																Summary
															</h5>
															<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
																<div>
																	<p className="text-green-300">
																		Total
																		Prepaid
																		Amount
																	</p>
																	<p className="text-white font-medium text-lg">
																		{formatCurrency(
																			selectedLoan.totalPaid
																		)}
																	</p>
																</div>
																{selectedLoan.remainingPrepayment &&
																	selectedLoan.remainingPrepayment >
																		0 && (
																		<div>
																			<p className="text-green-300">
																				Remaining
																				Prepayment
																			</p>
																			<p className="text-white font-medium text-lg">
																				{formatCurrency(
																					selectedLoan.remainingPrepayment
																				)}
																			</p>
																		</div>
																	)}
															</div>
														</div>
													)}
											</>
										) : (
											<div className="text-center py-12">
												<CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-500" />
												<h3 className="mt-4 text-lg font-medium text-white">
													No Repayment Data
												</h3>
												<p className="mt-2 text-gray-400">
													Repayment schedule not
													available for this loan
												</p>
											</div>
										)}
									</div>
								)}

								{/* Audit Trail Tab */}
								{selectedTab === "audit" && (
									<div>
										<div className="mb-6">
											<h4 className="text-white font-medium mb-4 flex items-center">
												<DocumentTextIcon className="h-5 w-5 mr-2 text-blue-400" />
												Complete Audit Trail
											</h4>
											<p className="text-gray-400 text-sm mb-4">
												Application workflow and payment transaction history
											</p>
										</div>

										{(loadingTransactions || loadingApplicationHistory) ? (
											<div className="flex items-center justify-center py-12">
												<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400"></div>
												<span className="ml-3 text-gray-400">
													Loading audit trail...
												</span>
											</div>
										) : (
											<div className="bg-gray-800/30 rounded-lg border border-gray-700/30 overflow-hidden">
												<div className="p-4 border-b border-gray-700/30">
													<h5 className="text-lg font-medium text-white">
														Timeline ({applicationHistory.length + walletTransactions.length} events)
													</h5>
												</div>
												<div className="overflow-y-auto max-h-[60vh]">
													{(() => {
														// Combine and sort all timeline events
														const allEvents = [
															// Application history events
															...applicationHistory.map(item => ({
																type: 'application' as const,
																id: item.id,
																createdAt: item.createdAt,
																data: item
															})),
															// Payment transaction events
															...walletTransactions.map(transaction => ({
																type: 'transaction' as const,
																id: transaction.id,
																createdAt: transaction.createdAt,
																data: transaction
															}))
														].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

														if (allEvents.length === 0) {
															return (
																<div className="p-8 text-center">
																	<DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
																	<p className="mt-4 text-gray-300">No audit trail available</p>
																	<p className="text-sm text-gray-400 mt-2">
																		Application history and payment transactions will appear here
																	</p>
																</div>
															);
														}

														return (
															<ul className="divide-y divide-gray-700/30">
																{allEvents.map((event, index) => (
																	<li
																		key={`${event.type}-${event.id}`}
																		className="p-4 hover:bg-gray-700/20 transition-colors"
																	>
																		{event.type === 'application' ? (
																			// Application history item
																			<div className="flex items-start space-x-3">
																				<div className="flex-shrink-0 mt-1">
																					<div className={`w-2 h-2 rounded-full ${index === 0 ? "bg-blue-400" : "bg-purple-500"}`}></div>
																				</div>
																				<div className="flex-1 min-w-0">
																					<div className="flex items-center justify-between">
																						<p className="text-sm font-medium text-white">
																							{getHistoryActionDescription(
																								event.data.previousStatus,
																								event.data.newStatus,
																								event.data.changeReason
																							)}
																						</p>
																						<p className="text-xs text-gray-400">
																							{formatDateTime(event.data.createdAt)}
																						</p>
																					</div>
																					<p className="text-xs text-gray-400 mt-1">
																						Changed by: {event.data.changedBy || "System"}
																					</p>
																					{event.data.notes && (
																						<div className="mt-2 p-2 bg-gray-700/50 rounded text-xs text-gray-300">
																							<span className="font-medium">Notes:</span> {event.data.notes}
																						</div>
																					)}
																				</div>
																			</div>
																		) : (
																			// Payment transaction item
																			<div className="flex items-start space-x-3">
																				<div className="flex-shrink-0 mt-1">
																					<div className={`w-2 h-2 rounded-full ${index === 0 ? "bg-blue-400" : "bg-green-500"}`}></div>
																				</div>
																				<div className="flex-1 min-w-0">
																					<div className="flex items-center justify-between">
																						<p className="text-sm font-medium text-white">
																							Payment Transaction
																						</p>
																						<p className="text-xs text-gray-400">
																							{formatDateTime(event.data.createdAt)}
																						</p>
																					</div>
																					<p className="text-xs text-gray-400 mt-1">
																						Reference: {event.data.reference || "No reference"}
																					</p>
																					<div className="mt-2 flex items-center justify-between">
																						<div className="flex items-center text-sm text-gray-300">
																							<BanknotesIcon className="mr-1 h-4 w-4 text-green-400" />
																							{formatCurrency(Math.abs(event.data.amount))}
																						</div>
																						<span
																							className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
																								event.data.status === "APPROVED"
																									? "bg-green-500/20 text-green-200 border-green-400/20"
																									: event.data.status === "PENDING"
																									? "bg-yellow-500/20 text-yellow-200 border-yellow-400/20"
																									: "bg-red-500/20 text-red-200 border-red-400/20"
																							}`}
																						>
																							{event.data.status}
																						</span>
																					</div>
																				</div>
																			</div>
																		)}
																	</li>
																))}
															</ul>
														);
													})()}
												</div>
											</div>
										)}
									</div>
								)}
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

			{/* Manual Payment Modal */}
			{showManualPaymentModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 w-full max-w-lg border border-gray-700/30">
						<h3 className="text-lg font-medium text-white mb-4">
							Create Manual Payment
						</h3>
						<div className="text-gray-300 mb-6 text-sm">
							<p>Create a manual payment for direct bank transfers or other offline payments.</p>
							{selectedLoan && (
								<p className="mt-2 text-purple-300">
									For: {selectedLoan.user.fullName} (Loan ID: {selectedLoan.id.substring(0, 8)})
								</p>
							)}
						</div>
						
						<div className="space-y-4">
							{/* Loan ID - Pre-filled and read-only */}
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Loan ID *
								</label>
								<input
									type="text"
									value={manualPaymentForm.loanId}
									readOnly
									className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-300 cursor-not-allowed"
									placeholder="Loan ID will be auto-filled"
								/>
								<p className="text-xs text-gray-400 mt-1">
									Auto-filled from selected loan
								</p>
							</div>

							{/* Amount */}
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-2">
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
									className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
								/>
								{selectedLoan && selectedLoan.outstandingBalance > 0 && (
									<p className="text-xs text-purple-400 mt-1">
										Outstanding balance: {formatCurrency(selectedLoan.outstandingBalance)}
									</p>
								)}
							</div>

							{/* Payment Method */}
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Payment Method *
								</label>
								<select
									value={manualPaymentForm.paymentMethod}
									onChange={(e) =>
										setManualPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))
									}
									className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
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
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Reference/Transaction ID *
								</label>
								<input
									type="text"
									value={manualPaymentForm.reference}
									onChange={(e) =>
										setManualPaymentForm(prev => ({ ...prev, reference: e.target.value }))
									}
									placeholder="Enter reference or transaction ID"
									className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
								/>
							</div>

							{/* Payment Date */}
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Payment Date (Optional)
								</label>
								<input
									type="date"
									value={manualPaymentForm.paymentDate}
									onChange={(e) =>
										setManualPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))
									}
									className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
								/>
								<p className="text-xs text-gray-400 mt-1">
									Leave empty to use current date/time
								</p>
							</div>

							{/* Notes */}
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Admin Notes (Optional)
								</label>
								<textarea
									value={manualPaymentForm.notes}
									onChange={(e) =>
										setManualPaymentForm(prev => ({ ...prev, notes: e.target.value }))
									}
									placeholder="Add any notes about this payment..."
									className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
									rows={3}
								/>
							</div>
						</div>

						<div className="flex gap-3 mt-6">
							<button
								onClick={handleManualPaymentSubmit}
								disabled={processingManualPayment || !manualPaymentForm.loanId || !manualPaymentForm.amount || !manualPaymentForm.reference}
								className="flex-1 px-4 py-2 bg-purple-500/20 text-purple-200 rounded-lg border border-purple-400/20 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{processingManualPayment ? "Creating Payment..." : "Create Payment"}
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
								disabled={processingManualPayment}
								className="flex-1 px-4 py-2 bg-gray-500/20 text-gray-200 rounded-lg border border-gray-400/20 hover:bg-gray-500/30 transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Discharge Modal */}
			{showDischargeModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-medium text-white">
								{dischargeAction === "request" &&
									"Request Loan Discharge"}
								{dischargeAction === "approve" &&
									"Approve Loan Discharge"}
								{dischargeAction === "reject" &&
									"Reject Loan Discharge"}
							</h3>
							<button
								onClick={() => setShowDischargeModal(false)}
								className="text-gray-400 hover:text-gray-300"
							>
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>

						<div className="mb-4">
							<p className="text-gray-300 text-sm mb-4">
								{dischargeAction === "request" &&
									"Submit a request to discharge this loan. This action requires admin approval."}
								{dischargeAction === "approve" &&
									"Approve the discharge request for this loan. This will mark the loan as discharged."}
								{dischargeAction === "reject" &&
									"Reject the discharge request for this loan. This will return the loan to active status."}
							</p>

							{selectedLoan && (
								<div className="bg-gray-700/30 p-3 rounded-lg mb-4">
									<p className="text-white font-medium">
										{selectedLoan.user.fullName}
									</p>
									<p className="text-gray-400 text-sm">
										Loan ID:{" "}
										{selectedLoan.id.substring(0, 8)}
									</p>
									<p className="text-gray-400 text-sm">
										Outstanding:{" "}
										{formatCurrency(
											selectedLoan.outstandingBalance
										)}
									</p>
								</div>
							)}

							<div className="space-y-4">
								{dischargeAction === "approve" ? (
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-2">
											Admin Notes *
										</label>
										<textarea
											value={dischargeNotes}
											onChange={(e) =>
												setDischargeNotes(
													e.target.value
												)
											}
											placeholder="Enter admin notes for the discharge approval..."
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
											rows={3}
										/>
									</div>
								) : (
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-2">
											{dischargeAction === "request"
												? "Reason for Discharge *"
												: "Reason for Rejection *"}
										</label>
										<textarea
											value={dischargeReason}
											onChange={(e) =>
												setDischargeReason(
													e.target.value
												)
											}
											placeholder={
												dischargeAction === "request"
													? "Enter reason for requesting discharge..."
													: "Enter reason for rejecting the discharge..."
											}
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
											rows={3}
										/>
									</div>
								)}
							</div>
						</div>

						<div className="flex justify-end space-x-3">
							<button
								onClick={() => setShowDischargeModal(false)}
								disabled={processingDischarge}
								className="px-4 py-2 bg-gray-600 text-gray-300 rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
							<button
								onClick={handleDischargeSubmit}
								disabled={processingDischarge}
								className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center ${
									dischargeAction === "approve"
										? "bg-green-600 text-white hover:bg-green-500"
										: dischargeAction === "reject"
										? "bg-red-600 text-white hover:bg-red-500"
										: "bg-blue-600 text-white hover:bg-blue-500"
								}`}
							>
								{processingDischarge && (
									<div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
								)}
								{dischargeAction === "request" &&
									"Submit Request"}
								{dischargeAction === "approve" &&
									"Approve Discharge"}
								{dischargeAction === "reject" &&
									"Reject Request"}
							</button>
						</div>
					</div>
				</div>
			)}
		</AdminLayout>
	);
}

export default function ActiveLoansPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<ActiveLoansContent />
		</Suspense>
	);
}
