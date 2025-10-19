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
	ReceiptPercentIcon,
	PencilIcon,
	PlusIcon,
	DocumentCheckIcon,
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
	graceStatus?: string;
	isInGracePeriod?: boolean;
	daysIntoGracePeriod?: number;
	effectiveDaysOverdue?: number;
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
	// Receipt information - now supports multiple receipts
	receipts?: {
		id: string;
		receiptNumber: string;
		filePath: string;
		generatedBy: string;
		generatedAt: string;
	}[];
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
	// Calculation method metadata stored at time of disbursement
	calculationMethod?: string | null; // RULE_OF_78 or STRAIGHT_LINE
	scheduleType?: string | null; // EXACT_MONTHLY or CUSTOM_DATE
	customDueDate?: number | null; // For CUSTOM_DATE schedule type
	prorationCutoffDate?: number | null; // For CUSTOM_DATE proration
	// DocuSeal Agreement fields
	docusealSubmissionId?: string | null;
	agreementStatus?: string | null; // PENDING_SIGNATURE, SIGNED, SIGNATURE_EXPIRED, SIGNATURE_DECLINED, SIGNATURE_FAILED
	agreementSignedAt?: string | null;
	docusealSignUrl?: string | null;
	// PKI Integration fields
	pkiSignedPdfUrl?: string | null;
	pkiStampedPdfUrl?: string | null;
	pkiStampCertificateUrl?: string | null;
	application?: {
		id: string;
		amount: number;
		purpose: string;
		status?: string;
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
			isInGracePeriod?: boolean;
			lateFeeAmount: number;
			lateFeesPaid: number;
			installmentNumber?: number;
		}>;
	};
	// Default tracking fields
	defaultRiskFlaggedAt?: string | null;
	defaultNoticesSent?: number;
	defaultedAt?: string | null;
	// Grace period information from late_fees table
	gracePeriodInfo?: {
		gracePeriodDays: number | null;
		gracePeriodRepayments: number;
		totalGracePeriodFees: number;
		totalAccruedFees: number;
		status: string;
	} | null;
}

interface Disbursement {
	id: string;
	applicationId: string;
	referenceNumber: string;
	amount: number;
	bankName: string | null;
	bankAccountNumber: string | null;
	disbursedAt: string;
	disbursedBy: string;
	notes: string | null;
	status: string;
	paymentSlipUrl: string | null;
	application: {
		id: string;
		user: {
			fullName: string;
			email: string;
			phoneNumber: string;
		};
		product: {
			name: string;
		};
	};
}

function ActiveLoansContent() {
	const searchParams = useSearchParams();
	const [viewMode, setViewMode] = useState<"loans" | "disbursements">("loans");
	const [loans, setLoans] = useState<LoanData[]>([]);
	const [filteredLoans, setFilteredLoans] = useState<LoanData[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedLoan, setSelectedLoan] = useState<LoanData | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [filterCounts, setFilterCounts] = useState({
		all: 0,
		active: 0,
		pending_discharge: 0,
		pending_early_settlement: 0,
		pending_stamped: 0,
		discharged: 0,
		late: 0,
		potential_default: 0,
		defaulted: 0,
	});
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedTab, setSelectedTab] = useState<string>("details");
	const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
	const [loadingDisbursements, setLoadingDisbursements] = useState(false);
	const [uploadingSlipFor, setUploadingSlipFor] = useState<string | null>(null);
	const [loadingRepayments, setLoadingRepayments] = useState(false);
	const [walletTransactions, setWalletTransactions] = useState<
		WalletTransaction[]
	>([]);
	const [loadingTransactions, setLoadingTransactions] = useState(false);
	const [signaturesData, setSignaturesData] = useState<any>(null);
	const [loadingSignatures, setLoadingSignatures] = useState(false);
	const [applicationHistory, setApplicationHistory] = useState<
		LoanApplicationHistory[]
	>([]);
	
	// PDF Letters state
	const [loadingPDFLetters, setLoadingPDFLetters] = useState(false);
	const [pdfLetters, setPDFLetters] = useState<any[]>([]);
	const [generatingPDF, setGeneratingPDF] = useState(false);
	const [borrowerInfo, setBorrowerInfo] = useState<{
		borrowerName: string;
		borrowerAddress: string;
		borrowerIcNumber: string;
		productName: string;
	} | null>(null);
	const [loadingBorrowerInfo, setLoadingBorrowerInfo] = useState(false);
	const [editedBorrowerAddress, setEditedBorrowerAddress] = useState("");
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

	// Stamped agreement upload states
	const [showUploadStampedModal, setShowUploadStampedModal] = useState(false);
	const [showStampedConfirmModal, setShowStampedConfirmModal] = useState(false);
	const [uploadStampedFile, setUploadStampedFile] = useState<File | null>(null);
	const [uploadStampedNotes, setUploadStampedNotes] = useState("");
	const [uploadStampedLoading, setUploadStampedLoading] = useState(false);

	// Certificate upload states
	const [showUploadCertificateModal, setShowUploadCertificateModal] = useState(false);
	const [showCertificateConfirmModal, setShowCertificateConfirmModal] = useState(false);
	const [uploadCertificateFile, setUploadCertificateFile] = useState<File | null>(null);
	const [uploadCertificateNotes, setUploadCertificateNotes] = useState("");
	const [uploadCertificateLoading, setUploadCertificateLoading] = useState(false);
	const [uploadCertificateLoanId, setUploadCertificateLoanId] = useState<string | null>(null);

	// Get user role from API
	const [userRole, setUserRole] = useState<string>("");

	useEffect(() => {
		const fetchUserRole = async () => {
			try {
				const userData = await fetchWithAdminTokenRefresh<{
					role: string;
				}>("/api/admin/me");
				setUserRole(userData.role || "");
			} catch (error) {
				console.error("Error fetching user role:", error);
				setUserRole("");
			}
		};
		fetchUserRole();
	}, []);

	useEffect(() => {
		fetchActiveLoans();
	}, []);

	useEffect(() => {
		if (viewMode === "disbursements") {
			fetchDisbursements();
		}
	}, [viewMode]);

	// Handle URL parameters
	useEffect(() => {
		const tabParam = searchParams.get("tab");
		const searchParam = searchParams.get("search");
		const filterParam = searchParams.get("filter");

		if (tabParam === "disbursements") {
			setViewMode("disbursements");
		}

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

	// Fetch signature status when signatures tab is selected
	useEffect(() => {
		if (
			selectedTab === "signatures" &&
			selectedLoan
		) {
			fetchSignatureStatus(selectedLoan.id);
		}
	}, [selectedTab, selectedLoan?.id]);

	// Fetch PDF letters and borrower info when PDF letters tab is selected
	useEffect(() => {
		if (
			selectedTab === "pdf-letters" &&
			selectedLoan
		) {
			fetchPDFLetters(selectedLoan.id);
			fetchBorrowerInfo(selectedLoan.id);
		}
	}, [selectedTab, selectedLoan?.id]);



	const fetchActiveLoans = async () => {
		try {
			setLoading(true);
			setError(null);

			// Fetch loans from the admin loans endpoint
			const response = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: LoanData[];
				systemSettings?: {
					calculationMethod: string;
					scheduleType: string;
					customDueDate: number;
					prorationCutoffDate: number;
				};
			}>("/api/admin/loans");

			if (response.success && response.data) {
				// Include all loan statuses (ACTIVE, PENDING_DISCHARGE, DISCHARGED)
				setLoans(response.data);
				
				// Store system settings for displaying calculation methods
				if (response.systemSettings) {
					console.log("📋 System settings loaded:", response.systemSettings);
					// Store in state if needed, or use directly in rendering
					(window as any).loanSystemSettings = response.systemSettings;
				}
				
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

	const fetchDisbursements = async () => {
		setLoadingDisbursements(true);
		try {
			const response = await fetchWithAdminTokenRefresh<{ success: boolean; data: Disbursement[] }>(
				"/api/admin/disbursements"
			);
			if (response.success) {
				setDisbursements(response.data);
			}
		} catch (error) {
			console.error("Error fetching disbursements:", error);
		} finally {
			setLoadingDisbursements(false);
		}
	};

	const downloadDisbursementSlip = async (applicationId: string, refNumber: string) => {
		try {
			const response = await fetch(
				`/api/admin/disbursements/${applicationId}/payment-slip`,
				{
					headers: {
						Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
					},
				}
			);

			if (response.ok) {
				const blob = await response.blob();
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `disbursement-slip-${refNumber}.pdf`;
				a.click();
			} else {
				alert('Payment slip not found');
			}
		} catch (error) {
			console.error('Error downloading slip:', error);
			alert('Failed to download payment slip');
		}
	};

	const handleUploadDisbursementSlip = async (applicationId: string, fileInput: HTMLInputElement) => {
		const file = fileInput.files?.[0];
		if (!file) return;

		setUploadingSlipFor(applicationId);
		try {
			const formData = new FormData();
			formData.append('paymentSlip', file);

			const response = await fetch(
				`/api/admin/applications/${applicationId}/upload-disbursement-slip`,
				{
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
					},
					body: formData
				}
			);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Upload failed');
			}

			const data = await response.json();
			console.log('✅ Payment slip uploaded:', data);
			
			alert('Payment slip uploaded successfully');
			fileInput.value = ''; // Clear file input
			
			// Refresh disbursements
			await fetchDisbursements();
		} catch (error) {
			console.error('Error uploading payment slip:', error);
			alert(error instanceof Error ? error.message : 'Failed to upload payment slip');
		} finally {
			setUploadingSlipFor(null);
		}
	};

	const fetchLoanRepayments = async (loanId: string) => {
		try {
			setLoadingRepayments(true);
			console.log("🔍 Fetching repayments for loan ID:", loanId);
			const response = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: LoanData;
			}>(`/api/admin/loans/${loanId}/repayments?raw=true&t=${Date.now()}`);

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

	const fetchSignatureStatus = async (loanId: string) => {
		if (!loanId) return;
		
		setLoadingSignatures(true);
		try {
			const data = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: any;
			}>(`/api/admin/loans/${loanId}/signatures`);
			
			if (data.success) {
				setSignaturesData(data.data);
			} else {
				console.error("Failed to fetch signature status");
			}
		} catch (error) {
			console.error("Error fetching signature status:", error);
		} finally {
			setLoadingSignatures(false);
		}
	};

	const fetchPDFLetters = async (loanId: string) => {
		if (!loanId) return;
		
		setLoadingPDFLetters(true);
		try {
			const data = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: any[];
			}>(`/api/admin/loans/${loanId}/pdf-letters`);
			
			if (data.success) {
				setPDFLetters(data.data || []);
			} else {
				console.error("Failed to fetch PDF letters");
			}
		} catch (error) {
			console.error("Error fetching PDF letters:", error);
		} finally {
			setLoadingPDFLetters(false);
		}
	};

	const fetchBorrowerInfo = async (loanId: string) => {
		if (!loanId) return;
		
		setLoadingBorrowerInfo(true);
		try {
			const data = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: {
					borrowerName: string;
					borrowerAddress: string;
					borrowerIcNumber: string;
					productName: string;
				};
			}>(`/api/admin/loans/${loanId}/borrower-info`);
			
			if (data.success) {
				setBorrowerInfo(data.data);
				setEditedBorrowerAddress(data.data.borrowerAddress);
			} else {
				console.error("Failed to fetch borrower info");
			}
		} catch (error) {
			console.error("Error fetching borrower info:", error);
		} finally {
			setLoadingBorrowerInfo(false);
		}
	};

	const generateManualPDFLetter = async (loanId: string, borrowerAddress?: string) => {
		if (!loanId) return;
		
		setGeneratingPDF(true);
		try {
			const data = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data?: any;
				message?: string;
			}>(`/api/admin/loans/${loanId}/generate-pdf-letter`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ borrowerAddress }),
			});
			
			if (data.success) {
				alert("PDF letter generated successfully!");
				fetchPDFLetters(loanId); // Refresh the list
			} else {
				throw new Error(data.message || "Failed to generate PDF letter");
			}
		} catch (error) {
			console.error("Error generating PDF letter:", error);
			alert(`Failed to generate PDF letter: ${error instanceof Error ? error.message : "Unknown error"}`);
		} finally {
			setGeneratingPDF(false);
		}
	};

	const downloadPDFLetter = async (loanId: string, filename: string) => {
		if (!loanId || !filename) return;
		
		try {
			// Use fetch directly for binary downloads with proper authentication
			const token = localStorage.getItem("adminToken");
			const response = await fetch(
				`/api/admin/loans/${loanId}/pdf-letters/${filename}/download`,
				{
					method: 'GET',
					headers: {
						"Authorization": `Bearer ${token}`,
					},
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Error downloading PDF letter:', error);
			alert('Failed to download PDF letter');
		}
	};

	const calculateFilterCounts = useCallback(() => {
		const counts = {
			all: loans.length,
			active: loans.filter((loan) => {
				// Current count should only include ACTIVE loans that are NOT in default risk or defaulted
				if (loan.status !== "ACTIVE") return false;
				
				// Exclude loans that are defaulted (check defaultedAt since status might still be ACTIVE)
				if (loan.defaultedAt) return false;
				
				// Exclude loans that are in default risk
				if (loan.defaultRiskFlaggedAt && !loan.defaultedAt) return false;
				
				return true;
			}).length,
			pending_discharge: loans.filter((loan) => loan.status === "PENDING_DISCHARGE").length,
			pending_early_settlement: loans.filter((loan) => loan.status === "PENDING_EARLY_SETTLEMENT").length,
			pending_stamped: loans.filter((loan) => loan.pkiSignedPdfUrl && (!loan.pkiStampedPdfUrl || !loan.pkiStampCertificateUrl) && loan.status !== "DEFAULT").length,
			discharged: loans.filter((loan) => loan.status === "DISCHARGED").length,
			late: loans.filter((loan) => {
				// Priority: DEFAULT > Default Risk > Late
				// Skip if loan is defaulted (highest priority)
				if (loan.status === "DEFAULT" || loan.defaultedAt) return false;
				
				// Skip if loan is in default risk (higher priority than late)
				if (loan.defaultRiskFlaggedAt && !loan.defaultedAt) return false;
				
				// Only count ACTIVE loans as late
				if (loan.status !== "ACTIVE") return false;
				
				// Use backend's overdueInfo if available
				if (loan.overdueInfo) {
					return loan.overdueInfo.hasOverduePayments && loan.overdueInfo.overdueRepayments.length > 0;
				}
				
				// Fallback to nextPaymentDue check for backward compatibility
				if (!loan.nextPaymentDue) return false;
				const dueDate = new Date(loan.nextPaymentDue);
				const today = new Date();
				return dueDate < today;
			}).length,
			potential_default: loans.filter((loan) => {
				// Priority: DEFAULT > Default Risk > Late
				// Skip if loan is defaulted (highest priority)
				if (loan.status === "DEFAULT" || loan.defaultedAt) return false;
				
				// Check if loan has defaultRiskFlaggedAt but not defaultedAt (potential default)
				return loan.defaultRiskFlaggedAt && !loan.defaultedAt;
			}).length,
			defaulted: loans.filter((loan) => loan.status === "DEFAULT" || loan.defaultedAt).length,
		};
		setFilterCounts(counts);
	}, [loans]);

	const filterLoans = useCallback(() => {
		let filtered = [...loans];

		// Apply status filter
		if (statusFilter === "active") {
			filtered = filtered.filter((loan) => {
				// Current filter should only show ACTIVE loans that are NOT in default risk or defaulted
				if (loan.status !== "ACTIVE") return false;
				
				// Exclude loans that are defaulted (check defaultedAt since status might still be ACTIVE)
				if (loan.defaultedAt) return false;
				
				// Exclude loans that are in default risk
				if (loan.defaultRiskFlaggedAt && !loan.defaultedAt) return false;
				
				return true;
			});
		} else if (statusFilter === "pending_discharge") {
			filtered = filtered.filter(
				(loan) => loan.status === "PENDING_DISCHARGE"
			);
		} else if (statusFilter === "pending_early_settlement") {
			filtered = filtered.filter(
				(loan) => loan.status === "PENDING_EARLY_SETTLEMENT"
			);
		} else if (statusFilter === "pending_stamped") {
			filtered = filtered.filter(
				(loan) => loan.pkiSignedPdfUrl && (!loan.pkiStampedPdfUrl || !loan.pkiStampCertificateUrl) && loan.status !== "DEFAULT"
			);
		} else if (statusFilter === "discharged") {
			filtered = filtered.filter((loan) => loan.status === "DISCHARGED");
		} else if (statusFilter === "late") {
			filtered = filtered.filter((loan) => {
				// Priority: DEFAULT > Default Risk > Late
				// Skip if loan is defaulted (highest priority)
				if (loan.status === "DEFAULT" || loan.defaultedAt) return false;
				
				// Skip if loan is in default risk (higher priority than late)
				if (loan.defaultRiskFlaggedAt && !loan.defaultedAt) return false;
				
				// Only count ACTIVE loans as late
				if (loan.status !== "ACTIVE") return false;
				
				// Use backend's overdueInfo if available
				if (loan.overdueInfo) {
					return loan.overdueInfo.hasOverduePayments && loan.overdueInfo.overdueRepayments.length > 0;
				}
				
				// Fallback to nextPaymentDue check for backward compatibility
				if (!loan.nextPaymentDue) return false;
				const dueDate = new Date(loan.nextPaymentDue);
				const today = new Date();
				return dueDate < today;
			});
		} else if (statusFilter === "potential_default") {
			filtered = filtered.filter((loan) => {
				// Priority: DEFAULT > Default Risk > Late
				// Skip if loan is defaulted (highest priority)
				if (loan.status === "DEFAULT" || loan.defaultedAt) return false;
				
				// Check if loan has defaultRiskFlaggedAt but not defaultedAt (potential default)
				return loan.defaultRiskFlaggedAt && !loan.defaultedAt;
			});
		} else if (statusFilter === "defaulted") {
			filtered = filtered.filter((loan) => loan.status === "DEFAULT" || loan.defaultedAt);
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

		// Sort loans to prioritize default statuses
		filtered.sort((a, b) => {
			// Priority order: DEFAULT > POTENTIAL_DEFAULT > LATE > others
			const getPriority = (loan: LoanData) => {
				if (loan.status === "DEFAULT" || loan.defaultedAt) return 1; // Highest priority
				if (loan.defaultRiskFlaggedAt && !loan.defaultedAt) return 2; // Potential default
				
				// Check if loan is late
				if (loan.status === "ACTIVE") {
					if (loan.overdueInfo?.hasOverduePayments) return 3;
					if (loan.nextPaymentDue) {
						const dueDate = new Date(loan.nextPaymentDue);
						const today = new Date();
						if (dueDate < today) return 3;
					}
				}
				
				return 4; // Normal priority
			};

			const priorityA = getPriority(a);
			const priorityB = getPriority(b);
			
			if (priorityA !== priorityB) {
				return priorityA - priorityB; // Lower number = higher priority
			}
			
			// If same priority, sort by creation date (newest first)
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});

		setFilteredLoans(filtered);
	}, [loans, searchTerm, statusFilter]);

	// Calculate filter counts when loans data changes
	useEffect(() => {
		calculateFilterCounts();
	}, [calculateFilterCounts]);

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
					setSignaturesData(null);
					// Fetch fresh detailed data
					fetchLoanRepayments(currentSelectedLoanId);
					if (selectedTab === "audit") {
						fetchWalletTransactions(currentSelectedLoanId);
						if (updatedSelectedLoan && updatedSelectedLoan.applicationId) {
							fetchApplicationHistory(updatedSelectedLoan.applicationId);
						}
					}
					if (selectedTab === "signatures") {
						fetchSignatureStatus(currentSelectedLoanId);
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

	const downloadReceipt = async (receiptId: string, receiptNumber: string) => {
		try {
			// Use fetch directly for binary downloads instead of fetchWithAdminTokenRefresh
			const token = localStorage.getItem("adminToken");
			const response = await fetch(
				`/api/admin/receipts/${receiptId}/download`,
				{
					method: 'GET',
					headers: {
						"Authorization": `Bearer ${token}`,
					},
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `${receiptNumber}.pdf`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Error downloading receipt:', error);
			alert('Failed to download receipt');
		}
	};

	const downloadSignedAgreement = async (loanId: string) => {
		try {
			const token = localStorage.getItem("adminToken");
			const response = await fetch(
				`/api/admin/loans/${loanId}/download-agreement`,
				{
					method: 'GET',
					headers: {
						"Authorization": `Bearer ${token}`,
					},
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			
			// Extract filename from Content-Disposition header or use default
			const contentDisposition = response.headers.get('Content-Disposition');
			let filename = `loan-agreement-${loanId.substring(0, 8)}.pdf`;
			if (contentDisposition) {
				const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
				if (filenameMatch) {
					filename = filenameMatch[1];
				}
			}
			
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Error downloading signed agreement:', error);
			alert(`Failed to download signed agreement: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	};

	const downloadStampedAgreement = async (loanId: string) => {
		try {
			const loan = loans.find(l => l.id === loanId);
			if (!loan?.pkiStampedPdfUrl) {
				throw new Error("No stamped agreement available for download");
			}

			const token = localStorage.getItem("adminToken");
			const response = await fetch(
				`/api/admin/loans/${loanId}/download-stamped-agreement`,
				{
					method: 'GET',
					headers: {
						"Authorization": `Bearer ${token}`,
					},
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
			}

			// Get the PDF blob and create download link
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `stamped-agreement-${loanId.substring(0, 8)}.pdf`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);

			console.log("✅ Stamped agreement downloaded successfully");

		} catch (error) {
			console.error("❌ Error downloading stamped agreement:", error);
			alert(error instanceof Error ? error.message : "Failed to download stamped agreement");
		}
	};

	const downloadStampCertificate = async (loanId: string) => {
		try {
			const loan = loans.find(l => l.id === loanId);
			if (!loan?.pkiStampCertificateUrl) {
				throw new Error("No stamp certificate available for download");
			}

			const token = localStorage.getItem("adminToken");
			const response = await fetch(
				`/api/admin/loans/${loanId}/download-stamp-certificate`,
				{
					method: 'GET',
					headers: {
						"Authorization": `Bearer ${token}`,
					},
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
			}

			// Get the PDF blob and create download link
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `stamp-certificate-${loanId.substring(0, 8)}.pdf`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);

			console.log("✅ Stamp certificate downloaded successfully");

		} catch (error) {
			console.error("❌ Error downloading stamp certificate:", error);
			alert(error instanceof Error ? error.message : "Failed to download stamp certificate");
		}
	};

	const handleUploadStampedAgreement = (loanId: string) => {
		const loan = loans.find(l => l.id === loanId);
		setManualPaymentForm(prev => ({ ...prev, loanId }));
		
		// Check if stamped PDF already exists
		if (loan?.pkiStampedPdfUrl) {
			setShowStampedConfirmModal(true);
		} else {
			setShowUploadStampedModal(true);
		}
	};

	const handleUploadStampCertificate = (loanId: string) => {
		const loan = loans.find(l => l.id === loanId);
		setUploadCertificateLoanId(loanId);
		
		// Check if certificate already exists
		if (loan?.pkiStampCertificateUrl) {
			setShowCertificateConfirmModal(true);
		} else {
			setShowUploadCertificateModal(true);
		}
	};

	const resetUploadStampedModals = () => {
		setShowUploadStampedModal(false);
		setShowStampedConfirmModal(false);
		setUploadStampedFile(null);
		setUploadStampedNotes("");
	};

	const resetUploadCertificateModals = () => {
		setShowUploadCertificateModal(false);
		setShowCertificateConfirmModal(false);
		setUploadCertificateFile(null);
		setUploadCertificateNotes("");
		setUploadCertificateLoanId(null);
	};

	const handleUploadStampedSubmit = async () => {
		if (!uploadStampedFile || !manualPaymentForm.loanId) {
			alert("Please select a PDF file to upload");
			return;
		}

		setUploadStampedLoading(true);
		try {
			const formData = new FormData();
			formData.append('stampedPdf', uploadStampedFile);
			if (uploadStampedNotes.trim()) {
				formData.append('notes', uploadStampedNotes.trim());
			}

			const response = await fetch(
				`/api/admin/loans/${manualPaymentForm.loanId}/upload-stamped-agreement`,
				{
					method: "POST",
					headers: {
						"Authorization": `Bearer ${localStorage.getItem("adminToken") || ""}`
					},
					body: formData
				}
			);

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.message || "Failed to upload stamped agreement");
			}

			console.log("✅ Stamped agreement uploaded successfully");
			alert("Stamped agreement uploaded successfully!");

			// Reset form and close modal
			resetUploadStampedModals();
			
			// Refresh loans to show updated data
			await fetchActiveLoans();

		} catch (error) {
			console.error("❌ Error uploading stamped agreement:", error);
			alert(error instanceof Error ? error.message : "Failed to upload stamped agreement");
		} finally {
			setUploadStampedLoading(false);
		}
	};

	const handleUploadCertificateSubmit = async () => {
		if (!uploadCertificateFile || !uploadCertificateLoanId) {
			alert("Please select a PDF file to upload");
			return;
		}

		setUploadCertificateLoading(true);
		try {
			const formData = new FormData();
			formData.append('stampCertificate', uploadCertificateFile);
			if (uploadCertificateNotes.trim()) {
				formData.append('notes', uploadCertificateNotes.trim());
			}

			const response = await fetch(
				`/api/admin/loans/${uploadCertificateLoanId}/upload-stamp-certificate`,
				{
					method: "POST",
					headers: {
						"Authorization": `Bearer ${localStorage.getItem("adminToken") || ""}`
					},
					body: formData
				}
			);

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.message || "Failed to upload stamp certificate");
			}

			console.log("✅ Stamp certificate uploaded successfully");
			alert("Stamp certificate uploaded successfully!");

			// Reset form and close modal
			resetUploadCertificateModals();
			
			// Refresh loans to show updated data
			await fetchActiveLoans();

		} catch (error) {
			console.error("❌ Error uploading stamp certificate:", error);
			alert(error instanceof Error ? error.message : "Failed to upload stamp certificate");
		} finally {
			setUploadCertificateLoading(false);
		}
	};

	const getOrdinalSuffix = (num: number) => {
		const j = num % 10;
		const k = num % 100;
		if (j === 1 && k !== 11) {
			return "st";
		}
		if (j === 2 && k !== 12) {
			return "nd";
		}
		if (j === 3 && k !== 13) {
			return "rd";
		}
		return "th";
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
			case "PENDING_EARLY_SETTLEMENT":
				return {
					bg: "bg-blue-500/20",
					text: "text-blue-200",
					border: "border-blue-400/20",
				};
			case "DISCHARGED":
				return {
					bg: "bg-purple-500/20",
					text: "text-purple-200",
					border: "border-purple-400/20",
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
			case "GRACE_PERIOD":
				return "bg-orange-500/20 text-orange-200 border border-orange-400/20";
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
				'Principal Amount',
				'Interest Amount',
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
				'Principal Amount',
				'Interest Amount',
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
								(sum, loan) => {
									const isPendingSettlement = loan.status === "PENDING_EARLY_SETTLEMENT" || 
															   loan.status === "PENDING_DISCHARGE" ||
															   loan.status === "DISCHARGED";
									return sum + (isPendingSettlement ? 0 : loan.outstandingBalance);
								},
								0
							)
						)}
						{" • "}
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
						Refresh
					</button>
				</div>
			</div>

			{/* Error Message */}
			{error && (
				<div className="mb-6 bg-red-700/30 border border-red-600/30 text-red-300 px-4 py-3 rounded-lg">
					{error}
				</div>
			)}

			{/* Tab Switcher */}
			<div className="mb-6 flex gap-2">
				<button
					onClick={() => setViewMode("loans")}
					className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${
						viewMode === "loans"
							? "bg-gray-800 text-white border-b-2 border-blue-500"
							: "bg-gray-700/50 text-gray-400 hover:text-gray-200"
					}`}
				>
					Loans
				</button>
				<button
					onClick={() => setViewMode("disbursements")}
					className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${
						viewMode === "disbursements"
							? "bg-gray-800 text-white border-b-2 border-blue-500"
							: "bg-gray-700/50 text-gray-400 hover:text-gray-200"
					}`}
				>
					Disbursements
				</button>
			</div>

			{/* Loans View */}
			{viewMode === "loans" && (
			<>
			{/* Search Bar */}
			<div className="mb-4 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
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
						onClick={() => setStatusFilter("active")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "active"
								? "bg-green-500/30 text-green-100 border-green-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Current ({filterCounts.active})
					</button>
					<button
						onClick={() => setStatusFilter("pending_discharge")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "pending_discharge"
								? "bg-yellow-500/30 text-yellow-100 border-yellow-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Pending Discharge ({filterCounts.pending_discharge})
					</button>
					<button
						onClick={() => setStatusFilter("pending_early_settlement")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "pending_early_settlement"
								? "bg-blue-500/30 text-blue-100 border-blue-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Early Settlement ({filterCounts.pending_early_settlement})
					</button>
					<button
						onClick={() => setStatusFilter("pending_stamped")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "pending_stamped"
								? "bg-teal-500/30 text-teal-100 border-teal-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Pending Stamped ({filterCounts.pending_stamped})
					</button>
					<button
						onClick={() => setStatusFilter("discharged")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "discharged"
								? "bg-purple-500/30 text-purple-100 border-purple-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Discharged ({filterCounts.discharged})
					</button>
					<button
						onClick={() => setStatusFilter("late")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "late"
								? "bg-red-500/30 text-red-100 border-red-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Late ({filterCounts.late})
					</button>
					<button
						onClick={() => setStatusFilter("potential_default")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "potential_default"
								? "bg-amber-500/30 text-amber-100 border-amber-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Default Risk ({filterCounts.potential_default})
					</button>
					<button
						onClick={() => setStatusFilter("defaulted")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "defaulted"
								? "bg-red-600/30 text-red-100 border-red-500/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Defaulted ({filterCounts.defaulted})
					</button>
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
																	  "PENDING_EARLY_SETTLEMENT"
																	? "Early Settlement Pending"
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
															{(() => {
																const isPendingSettlement = loan.status === "PENDING_EARLY_SETTLEMENT" || 
																						   loan.status === "PENDING_DISCHARGE" ||
																						   loan.status === "DISCHARGED";
																if (isPendingSettlement) {
																	return (
																		<span className="text-orange-300">
																			{formatCurrency(0)} 
																			<span className="text-xs text-gray-400 ml-1">(settled)</span>
																		</span>
																	);
																}
																return formatCurrency(loan.outstandingBalance);
															})()}
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
								<div className="flex items-center gap-2">
									{/* Manual Payment Button - Show for ACTIVE loans */}
									{selectedLoan.status === "ACTIVE" && (
										<button
											onClick={() => handleCreateManualPayment(selectedLoan.id)}
											className="flex items-center px-3 py-1.5 bg-purple-500/20 text-purple-200 rounded-lg border border-purple-400/20 hover:bg-purple-500/30 transition-colors text-xs"
											title="Create manual payment for this loan"
										>
											<CurrencyDollarIcon className="h-3 w-3 mr-1" />
											Manual Payment
										</button>
									)}
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
									<div
										className={`px-4 py-2 cursor-pointer transition-colors ${
											selectedTab === "signatures"
												? "border-b-2 border-blue-400 font-medium text-white"
												: "text-gray-400 hover:text-gray-200"
										}`}
										onClick={() => setSelectedTab("signatures")}
									>
										<PencilIcon className="inline h-4 w-4 mr-1" />
										Signatures
									</div>
									{/* Only show Default Letters tab for loans that need default-related letters */}
									{(() => {
										// Show tab for loans that are Late, Default Risk, or Defaulted
										const isLate = selectedLoan.status === "ACTIVE" && (
											selectedLoan.overdueInfo?.hasOverduePayments || 
											(selectedLoan.nextPaymentDue && new Date(selectedLoan.nextPaymentDue) < new Date())
										);
										const isDefaultRisk = selectedLoan.defaultRiskFlaggedAt && !selectedLoan.defaultedAt;
										const isDefaulted = selectedLoan.status === "DEFAULT" || selectedLoan.defaultedAt;
										
										if (isLate || isDefaultRisk || isDefaulted) {
											return (
												<div
													className={`px-4 py-2 cursor-pointer transition-colors ${
														selectedTab === "pdf-letters"
															? "border-b-2 border-blue-400 font-medium text-white"
															: "text-gray-400 hover:text-gray-200"
													}`}
													onClick={() => setSelectedTab("pdf-letters")}
												>
													<DocumentArrowDownIcon className="inline h-4 w-4 mr-1" />
													Default Letters
												</div>
											);
										}
										return null;
									})()}

								</div>

								{/* Tab Content */}
								{selectedTab === "details" && (
									<>
										{/* Summary Cards */}
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
											<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
												<p className="text-gray-400 text-sm mb-1">
													Outstanding Balance
												</p>
												<p className="text-2xl font-bold text-white">
													{(() => {
														const isPendingSettlement = selectedLoan.status === "PENDING_EARLY_SETTLEMENT" || 
																				   selectedLoan.status === "PENDING_DISCHARGE" ||
																				   selectedLoan.status === "DISCHARGED";
														if (isPendingSettlement) {
															return (
																<span className="text-orange-300">
																	{formatCurrency(0)}
																	<span className="text-xs text-gray-400 mt-1 font-normal block">
																		{selectedLoan.status === "DISCHARGED" ? "Discharged" : "Early Settlement"}
																	</span>
																</span>
															);
														}
														return formatCurrency(selectedLoan.outstandingBalance);
													})()}
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
												<p className="text-gray-400 text-sm mb-1">
													Total Paid
												</p>
												<p className="text-2xl font-bold text-white">
													{(() => {
														const repayments = selectedLoan.repayments || [];
														const totalPaid = repayments.reduce((total, repayment) => {
															// Sum all actualAmount values (actual amount paid by user)
															// Include CANCELLED repayments as they may have partial payments before cancellation
															return total + (repayment.actualAmount || 0);
														}, 0);
														return formatCurrency(totalPaid);
													})()}
												</p>
												<p className="text-xs text-gray-400 mt-1">
													Total amount paid to date
												</p>
											</div>
											<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
												{(() => {
													const nextPayment =
														getNextPaymentDetails(
															selectedLoan.repayments ||
																[]
														);
													const isPendingSettlement = selectedLoan.status === "PENDING_EARLY_SETTLEMENT" || 
																			   selectedLoan.status === "PENDING_DISCHARGE" ||
																			   selectedLoan.status === "DISCHARGED";
													if (isPendingSettlement) {
														return (
															<>
																<p className="text-gray-400 text-sm mb-1">
																	Payment Status
																</p>
																<p className="text-2xl font-bold text-orange-300">
																	{selectedLoan.status === "PENDING_EARLY_SETTLEMENT" ? "Settlement Pending" : 
																	 selectedLoan.status === "PENDING_DISCHARGE" ? "Fully Settled" : "Discharged"}
																</p>
																<p className="text-xs text-gray-400 mt-1">
																	{selectedLoan.status === "PENDING_EARLY_SETTLEMENT" 
																		? "Awaiting admin approval" 
																		: selectedLoan.status === "PENDING_DISCHARGE"
																		? "Awaiting final discharge"
																		: "Loan completed"}
																</p>
															</>
														);
													}
													
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
																			<span className="text-xs text-red-400 mt-1 block">
																				{formatCurrency(totalLateFeesAssessed - totalLateFeesPaid)} outstanding
																			</span>
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
												const isInGracePeriod = mostOverdueRepayment.isInGracePeriod;
												
												// Determine status and styling based on grace period
												let statusText, statusIcon, lateStatus;
												if (isInGracePeriod) {
													statusText = `Grace Period: ${daysLate} days late`;
													statusIcon = <ClockIcon className="h-5 w-5 mr-2 mt-0.5 text-orange-200" />;
													lateStatus = {
														bg: "bg-orange-500/20",
														text: "text-orange-200",
														border: "border-orange-400/20"
													};
												} else {
													statusText = `Payment Overdue: ${daysLate} days late`;
													statusIcon = <ExclamationTriangleIcon className={`h-5 w-5 mr-2 mt-0.5`} />;
													lateStatus = getLateStatusColor(daysLate);
												}
												
												return (
													<div
														className={`p-4 rounded-lg mb-6 border ${lateStatus.bg} ${lateStatus.border}`}
													>
														<div className="flex items-start">
															{statusIcon}
															<div>
																<p
																	className={`font-medium ${lateStatus.text}`}
																>
																	{statusText}
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
																{isInGracePeriod && (
																	<p className="text-xs text-orange-300 mt-1">
																		⏰ Late fees are accumulating but not yet charged during grace period
																	</p>
																)}
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
															{(() => {
																const isPendingSettlement = selectedLoan.status === "PENDING_EARLY_SETTLEMENT" || 
																						   selectedLoan.status === "PENDING_DISCHARGE" ||
																						   selectedLoan.status === "DISCHARGED";
																if (isPendingSettlement) {
																	return (
																		<span className="text-orange-300">
																			{formatCurrency(0)} 
																			<span className="text-xs text-gray-400 block">(settled)</span>
																		</span>
																	);
																}
																return formatCurrency(selectedLoan.outstandingBalance);
															})()}
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
													Loan Terms & Calculation Method
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
													{/* Loan Calculation Settings */}
													<div className="border-t border-gray-600/30 pt-3 mt-4">
														<p className="text-gray-400 text-sm mb-2">
															Interest & Principal Allocation
														</p>
														{(() => {
															// Use loan's stored calculation method, fallback to legacy badge for old loans
															const loanMethod = selectedLoan.calculationMethod;
															
															if (!loanMethod) {
																return (
																	<div className="flex flex-col gap-1">
																		<span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-200 border-gray-400/20">
																			Legacy
																		</span>
																		<p className="text-xs text-gray-400">
																			Pre-dates calculation method storage
																		</p>
																	</div>
																);
															}
															
															if (loanMethod === 'RULE_OF_78') {
																return (
																	<div className="flex flex-col gap-1">
																		<span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-500/20 text-orange-200 border-orange-400/20">
																			Rule of 78 Method
																		</span>
																		<p className="text-xs text-gray-400">
																			Front-loaded interest with decreasing amounts over time
																		</p>
																	</div>
																);
															} else {
																return (
																	<div className="flex flex-col gap-1">
																		<span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-200 border-blue-400/20">
																			Straight Line Method
																		</span>
																		<p className="text-xs text-gray-400">
																			Equal interest and principal allocation
																		</p>
																	</div>
																);
															}
														})()}
													</div>
													<div className="mt-3">
														<p className="text-gray-400 text-sm mb-2">
															Payment Due Date Schedule
														</p>
														{(() => {
															// Use loan's stored schedule type, fallback to legacy badge for old loans
															const loanSchedule = selectedLoan.scheduleType;
															const customDate = selectedLoan.customDueDate;
															
															if (!loanSchedule) {
																return (
																	<div className="flex flex-col gap-1">
																		<span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-200 border-gray-400/20">
																			Legacy
																		</span>
																		<p className="text-xs text-gray-400">
																			Pre-dates schedule type storage
																		</p>
																	</div>
																);
															}
															
															if (loanSchedule === 'EXACT_MONTHLY') {
																return (
																	<div className="flex flex-col gap-1">
																		<span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-200 border-emerald-400/20">
																			Same Day Each Month
																		</span>
																		<p className="text-xs text-gray-400">
																			Payments due on same day as disbursement
																		</p>
																	</div>
																);
															} else {
																return (
																	<div className="flex flex-col gap-1">
																		<span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-200 border-purple-400/20">
																			Custom Date ({customDate}{getOrdinalSuffix(customDate || 1)} of month)
																		</span>
																		<p className="text-xs text-gray-400">
																			All payments due on {customDate}{getOrdinalSuffix(customDate || 1)} of each month
																		</p>
																	</div>
																);
															}
														})()}
													</div>
												</div>
											</div>

											{/* Agreement Information */}
											<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
												<h4 className="text-white font-medium mb-3 flex items-center">
													<DocumentTextIcon className="h-5 w-5 mr-2 text-blue-400" />
													Loan Agreement
												</h4>
												<div className="space-y-3">
													<div>
														<p className="text-gray-400 text-sm">
															Agreement Status
														</p>
														<p className="text-white">
															{selectedLoan.agreementStatus ? (
																<span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${
																	selectedLoan.agreementStatus === 'SIGNED' 
																		? 'bg-green-500/20 text-green-200 border-green-400/20'
																		: selectedLoan.agreementStatus === 'PENDING_SIGNATURE'
																		? 'bg-yellow-500/20 text-yellow-200 border-yellow-400/20'
																		: 'bg-gray-500/20 text-gray-200 border-gray-400/20'
																}`}>
																	{selectedLoan.agreementStatus === 'SIGNED' ? 'Signed' :
																	 selectedLoan.agreementStatus === 'PENDING_SIGNATURE' ? 'Pending Signature' :
																	 selectedLoan.agreementStatus}
																</span>
															) : (
																<span className="text-gray-500">N/A</span>
															)}
														</p>
													</div>
													{selectedLoan.agreementSignedAt && (
														<div>
															<p className="text-gray-400 text-sm">
																Agreement Signed Date
															</p>
															<p className="text-white">
																{formatDateTime(selectedLoan.agreementSignedAt)}
															</p>
														</div>
													)}
													{selectedLoan.docusealSubmissionId && (
														<div>
															<p className="text-gray-400 text-sm">
																DocuSeal Submission ID
															</p>
															<p className="text-white font-mono text-sm">
																{selectedLoan.docusealSubmissionId}
															</p>
														</div>
													)}
												</div>
											</div>
										</div>

										{/* Action Buttons */}
										<div className="flex flex-wrap gap-3">
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
																{(() => {
																	const isPendingSettlement = selectedLoan.status === "PENDING_EARLY_SETTLEMENT" || 
																							   selectedLoan.status === "PENDING_DISCHARGE" ||
																							   selectedLoan.status === "DISCHARGED";
																	if (isPendingSettlement) {
																		return (
																			<span className="text-orange-300">
																				{formatCurrency(0)}
																				<br />
																				<span className="text-xs text-gray-400">
																					{selectedLoan.status === "DISCHARGED" ? "Discharged" : "Early Settlement"}
																				</span>
																			</span>
																		);
																	}
																	return formatCurrency(selectedLoan.outstandingBalance);
																})()}
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

												{/* Payment Allocation Information */}
												<div className="bg-blue-900/20 p-4 rounded-lg border border-blue-400/20 mb-6">
													<h5 className="text-blue-200 font-medium mb-3 flex items-center">
														<svg className="h-5 w-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
														</svg>
														Payment Allocation Hierarchy
													</h5>
													<div className="text-sm text-blue-100 space-y-2">
														<p>When payments are received, amounts are allocated in the following priority order:</p>
														<div className="flex flex-wrap gap-4 mt-3">
															<div className="flex items-center">
																<span className="w-3 h-3 bg-red-400 rounded-full mr-2"></span>
																<span className="text-red-200">1. Late Fees</span>
															</div>
															<div className="flex items-center">
																<span className="w-3 h-3 bg-blue-400 rounded-full mr-2"></span>
																<span className="text-blue-200">2. Interest</span>
															</div>
															<div className="flex items-center">
																<span className="w-3 h-3 bg-green-400 rounded-full mr-2"></span>
																<span className="text-green-200">3. Principal</span>
															</div>
														</div>
														<p className="text-xs text-blue-300 mt-2">
															<strong>Example:</strong> For a RM 100 payment on an installment with RM 20 late fees, RM 30 interest, and RM 50 principal:
															RM 20 covers late fees, RM 30 covers interest, RM 50 covers principal. All paid amounts are shown in green.
														</p>
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
																		Interest
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
																	<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
																		Receipt
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
																"PAID"
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
																"CANCELLED"
															) {
																displayStatus =
																	"CANCELLED";
																statusColor =
																	"bg-gray-500/20 text-gray-200 border border-gray-400/20";
															} else if (
																repayment.graceStatus === "GRACE_PERIOD" ||
																(repayment.isInGracePeriod && isOverdue)
															) {
																const graceDays = repayment.daysIntoGracePeriod || 
																	(isOverdue ? Math.ceil((new Date().getTime() - new Date(repayment.dueDate).getTime()) / (24 * 60 * 60 * 1000)) : 0);
																displayStatus =
																	`GRACE PERIOD (${graceDays}d)`;
																statusColor =
																	"bg-orange-500/20 text-orange-200 border border-orange-400/20";
															} else if (
																repayment.graceStatus === "OVERDUE" ||
																repayment.status === "OVERDUE" ||
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
																							<div className="font-medium">
																								{formatCurrency(
																									repayment.principalAmount || 0
																								)}
																							</div>
																							{/* Show principal paid info with correct allocation logic */}
																							{(() => {
																								const totalPaid = repayment.actualAmount || 0;
																								const lateFeesPaid = repayment.lateFeesPaid || 0;
																								const interestDue = repayment.interestAmount || 0;
																								
																								// Calculate interest paid based on allocation priority
																								const interestPaid = Math.max(0, Math.min(interestDue, totalPaid - lateFeesPaid));
																								
																								// Principal paid = remaining after late fees and interest
																								const principalPaid = Math.max(0, totalPaid - lateFeesPaid - interestPaid);
																								
																								return principalPaid > 0 && (
																									<div className="text-xs text-green-400 mt-1">
																										{formatCurrency(principalPaid)} paid
																									</div>
																								);
																							})()}
																						</div>
																					</td>
																					{/* Interest Column */}
																					<td className="px-4 py-3 whitespace-nowrap text-sm text-white">
																						<div>
																							<div className="font-medium">
																								{formatCurrency(
																									repayment.interestAmount || 0
																								)}
																							</div>
																							{/* Show interest paid info with correct allocation logic */}
																							{(() => {
																								const totalPaid = repayment.actualAmount || 0;
																								const lateFeesPaid = repayment.lateFeesPaid || 0;
																								const interestDue = repayment.interestAmount || 0;
																								
																								// Interest paid = (total paid - late fees paid), capped at interest due
																								const interestPaid = Math.max(0, Math.min(interestDue, totalPaid - lateFeesPaid));
																								
																								return interestPaid > 0 && (
																									<div className="text-xs text-green-400 mt-1">
																										{formatCurrency(interestPaid)} paid
																									</div>
																								);
																							})()}
																						</div>
																					</td>
																					{/* Late Fees Column */}
																					<td className="px-4 py-3 whitespace-nowrap text-sm text-white">
																						<div>
																							{repayment.lateFeeAmount && 
																								repayment.lateFeeAmount > 0 ? (
																								<>
																									<div className="font-medium">
																										{formatCurrency(
																											repayment.lateFeeAmount
																										)}
																									</div>
																									{/* Show late fees paid info */}
																									{repayment.lateFeesPaid && 
																										repayment.lateFeesPaid > 0 && (
																										<div className="text-xs text-green-400 mt-1">
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
																					{/* Total Due Column - Sum of Principal + Interest + Late Fees */}
																					<td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
																						{formatCurrency(
																							(repayment.principalAmount || 0) + 
																							(repayment.interestAmount || 0) + 
																							(repayment.lateFeeAmount || 0)
																						)}
																					</td>
																					{/* Balance Column - Payment Allocation Logic: Late Fees → Interest → Principal */}
																					<td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
																						<div>
																							{(() => {
																								if (repayment.status === "COMPLETED" || repayment.status === "PAID") {
																									return <span className="text-green-400">Paid in Full</span>;
																								}
																								
																								// Payment allocation logic: Late Fees → Interest → Principal
																								const totalDue = (repayment.principalAmount || 0) + (repayment.interestAmount || 0) + (repayment.lateFeeAmount || 0);
																								const totalPaid = (repayment.actualAmount || 0);
																								const totalBalance = Math.max(0, totalDue - totalPaid);
																								
																								// Calculate remaining balances with allocation priority (consistent with display logic)
																								const lateFeesDue = repayment.lateFeeAmount || 0;
																								const lateFeesPaid = repayment.lateFeesPaid || 0;
																								const lateFeesRemaining = Math.max(0, lateFeesDue - lateFeesPaid);
																								
																								const interestDue = repayment.interestAmount || 0;
																								// Interest paid = (total paid - late fees paid), capped at interest due
																								const interestPaid = Math.max(0, Math.min(interestDue, totalPaid - lateFeesPaid));
																								const interestRemaining = Math.max(0, interestDue - interestPaid);
																								
																								const principalDue = repayment.principalAmount || 0;
																								// Principal paid = remaining after late fees and interest
																								const principalPaid = Math.max(0, totalPaid - lateFeesPaid - interestPaid);
																								const principalRemaining = Math.max(0, principalDue - principalPaid);
																								
																								return (
																									<div>
																										<div className="font-medium">
																											{formatCurrency(totalBalance)}
																										</div>
																										{totalBalance > 0 && (
																											<div className="text-xs mt-1 space-y-1">
																												{lateFeesRemaining > 0 && (
																													<div className="text-red-400">
																														{formatCurrency(lateFeesRemaining)} late fees
																													</div>
																												)}
																												{interestRemaining > 0 && (
																													<div className="text-blue-400">
																														{formatCurrency(interestRemaining)} interest
																													</div>
																												)}
																												{principalRemaining > 0 && (
																													<div className="text-green-400">
																														{formatCurrency(principalRemaining)} principal
																													</div>
																												)}
																											</div>
																										)}
																									</div>
																								);
																							})()}
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
																						{(repayment.status ===
																						"COMPLETED" || repayment.status === "PAID") ? (
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
																					{/* Receipt Column */}
																					<td className="px-4 py-3 text-sm text-gray-300">
																						{(repayment.status === "COMPLETED" || repayment.status === "PAID" || repayment.status === "PARTIAL" || repayment.status === "CANCELLED") && repayment.receipts && repayment.receipts.length > 0 ? (
																							<div className="flex flex-wrap items-center gap-1">
																								{repayment.receipts.map((receipt, index) => (
																									<button
																										key={receipt.id}
																										onClick={() => downloadReceipt(receipt.id, receipt.receiptNumber)}
																										className="flex items-center px-2 py-1 bg-green-500/20 text-green-200 rounded border border-green-400/20 hover:bg-green-500/30 transition-colors text-xs"
																										title={`Download receipt ${receipt.receiptNumber}`}
																									>
																										<ReceiptPercentIcon className="h-3 w-3 mr-1" />
																										{receipt.receiptNumber}
																									</button>
																								))}
																							</div>
																						                            ) : (
                                <span className="text-gray-500">-</span>
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

								{/* Signatures Tab */}
								{selectedTab === "signatures" && (
									<div>
										{loadingSignatures ? (
											<div className="flex items-center justify-center py-8">
												<ArrowPathIcon className="h-6 w-6 animate-spin text-blue-400 mr-2" />
												<span className="text-gray-400">Loading signature status...</span>
											</div>
										) : signaturesData ? (
											<div>
												<div className="mb-6">
													<div className="mb-4">
														<h4 className="text-white font-medium flex items-center mb-3">
															<PencilIcon className="h-5 w-5 mr-2 text-purple-400" />
															Document Signature Status
														</h4>
														
													{/* Download Loan Documents */}
													{selectedLoan?.agreementStatus === 'SIGNED' && (
														<div className="mb-4">
															<h5 className="text-gray-300 text-sm font-medium mb-2">Download Loan Documents</h5>
															<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
															{/* Download Unsigned Agreement */}
															<button
																onClick={async () => {
																	try {
																		const response = await fetch(
																			`/api/admin/applications/${selectedLoan.applicationId}/unsigned-agreement`,
																			{
																				method: 'GET',
																				headers: {
																					'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
																				}
																			}
																		);
																		
																		if (!response.ok) {
																			throw new Error('Failed to get unsigned agreement');
																		}
																		
																		const data = await response.json();
																		if (data.url) {
																			// Open DocuSeal URL in new tab
																			window.open(data.url, '_blank');
																		} else {
																			throw new Error('No URL returned');
																		}
																	} catch (error) {
																		console.error('Error opening unsigned agreement:', error);
																		alert('Failed to open unsigned agreement');
																	}
																}}
																className="inline-flex items-center justify-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
															>
																<DocumentTextIcon className="h-4 w-4 mr-2" />
																Unsigned
															</button>

																{/* Download Signed Agreement */}
																<button
																	onClick={() => downloadSignedAgreement(selectedLoan.id)}
																	disabled={!selectedLoan?.pkiSignedPdfUrl}
																	className={`inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
																		selectedLoan?.pkiSignedPdfUrl
																			? 'bg-green-600 hover:bg-green-700 text-white'
																			: 'bg-gray-600 text-gray-400 cursor-not-allowed'
																	}`}
																>
																	<CheckCircleIcon className="h-4 w-4 mr-2" />
																	Signed
																</button>

																{/* Download Stamp Certificate */}
																<button
																	onClick={() => downloadStampCertificate(selectedLoan.id)}
																	disabled={!selectedLoan?.pkiStampCertificateUrl}
																	className={`inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
																		selectedLoan?.pkiStampCertificateUrl
																			? 'bg-purple-600 hover:bg-purple-700 text-white'
																			: 'bg-gray-600 text-gray-400 cursor-not-allowed'
																	}`}
																>
																	<DocumentCheckIcon className="h-4 w-4 mr-2" />
																	Certificate
																</button>
															</div>
														</div>
													)}
													</div>
													<div className="bg-gray-800/30 rounded-lg border border-gray-700/30 p-4 mb-4">
														<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
															<div>
																<span className="text-gray-400">Borrower:</span>
																<span className="text-white ml-2">{signaturesData.borrowerName}</span>
															</div>
															<div>
																<span className="text-gray-400">Email:</span>
																<span className="text-white ml-2">{signaturesData.borrowerEmail}</span>
															</div>
															<div>
																<span className="text-gray-400">Loan Status:</span>
																<span className="text-white ml-2">{signaturesData.loanStatus}</span>
															</div>
															<div>
																<span className="text-gray-400">Agreement Status:</span>
																<span className="text-white ml-2">{signaturesData.agreementStatus}</span>
															</div>
														</div>
													</div>
												</div>

												<div className="space-y-4">
													{signaturesData.signatures && signaturesData.signatures.length > 0 ? (
														signaturesData.signatures.map((signature: any) => (
															<div
																key={signature.id}
																className="bg-gray-800/30 rounded-lg border border-gray-700/30 p-4"
															>
																<div className="flex items-center justify-between">
																	<div className="flex-1">
																		<div className="flex items-center mb-2">
																			<div className="flex-1">
																				<h5 className="text-white font-medium">
																					{signature.type === 'USER' && '👤 Borrower'}
																					{signature.type === 'COMPANY' && '🏢 Company'}
																					{signature.type === 'WITNESS' && '⚖️ Witness'}
																				</h5>
																				<p className="text-gray-400 text-sm">
																					{signature.name} ({signature.email})
																				</p>
																			</div>
																			<div className="flex items-center">
																				{signature.status === 'SIGNED' ? (
																					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-800/20 text-green-400 border border-green-800/30">
																						<CheckCircleIcon className="h-3 w-3 mr-1" />
																						Signed
																					</span>
																				) : signature.status === 'PENDING' ? (
																					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-800/20 text-yellow-400 border border-yellow-800/30">
																						<ClockIcon className="h-3 w-3 mr-1" />
																						Pending DocuSeal
																					</span>
																				) : signature.status === 'PENDING_PKI_SIGNING' ? (
																					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-800/20 text-blue-400 border border-blue-800/30">
																						<ClockIcon className="h-3 w-3 mr-1" />
																						Pending PKI
																					</span>
																				) : (
																					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-800/20 text-red-400 border border-red-800/30">
																						<XMarkIcon className="h-3 w-3 mr-1" />
																						{signature.status}
																					</span>
																				)}
																			</div>
																		</div>
																		{signature.signedAt && (
																			<p className="text-gray-400 text-xs">
																				Signed: {new Date(signature.signedAt).toLocaleString()}
																			</p>
																		)}
																	</div>
																	<div className="ml-4">
																		{/* Hide signing actions for active loans - this is for audit purposes only */}
																		{selectedLoan?.status === 'ACTIVE' ? (
																			signature.status === 'SIGNED' ? (
																				<span className="text-gray-500 text-xs">
																					{/* Status already shown above */}
																				</span>
																			) : (
																				<span className="text-gray-500 text-xs">
																					Audit Only
																				</span>
																			)
																		) : (
																			/* Loans page only shows status - no signing actions */
																			<span className="text-gray-400 text-xs">
																				Use Applications page to sign
																			</span>
																		)}
																	</div>
																</div>
															</div>
														))
													) : (
														<div className="bg-gray-800/30 rounded-lg border border-gray-700/30 p-8 text-center">
															<PencilIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
															<p className="text-gray-400">No signature records found for this loan.</p>
															<p className="text-gray-500 text-sm mt-1">Signature tracking may not be enabled for this loan.</p>
														</div>
													)}
												</div>
											</div>
										) : (
											<div className="bg-gray-800/30 rounded-lg border border-gray-700/30 p-8 text-center">
												<ExclamationTriangleIcon className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
												<p className="text-gray-400">Unable to load signature status.</p>
												<p className="text-gray-500 text-sm mt-1">Please try refreshing the page.</p>
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
													<h5 className="text-lg font-medium text-white mb-3">
														Timeline ({applicationHistory.length + walletTransactions.length} events)
													</h5>
													{/* Color Legend */}
													<div className="flex flex-wrap gap-4 text-xs">
														<div className="flex items-center">
															<div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
															<span className="text-gray-400">System Actions</span>
														</div>
														<div className="flex items-center">
															<div className="w-2 h-2 bg-amber-400 rounded-full mr-2"></div>
															<span className="text-gray-400">Admin Actions</span>
														</div>
														<div className="flex items-center">
															<div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
															<span className="text-gray-400">Customer Actions</span>
														</div>
														<div className="flex items-center">
															<div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
															<span className="text-gray-400">Payment Transactions</span>
														</div>
													</div>
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
																					<div className={`w-2 h-2 rounded-full ${
																						event.data.changedBy?.toLowerCase().includes('system')
																							? "bg-blue-400" 
																							: event.data.changedBy && (
																								event.data.changedBy.startsWith('admin_') || 
																								event.data.changeReason?.toLowerCase().includes('admin') ||
																								event.data.notes?.toLowerCase().includes('admin')
																							)
																							? "bg-amber-400"
																							: "bg-purple-500"
																					}`}></div>
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
																					<div className="w-2 h-2 rounded-full bg-green-500"></div>
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

								{/* PDF Letters Tab */}
								{selectedTab === "pdf-letters" && (
									<div>
										<div className="mb-6">
											<h4 className="text-white font-medium mb-4 flex items-center">
												<DocumentArrowDownIcon className="h-5 w-5 mr-2 text-blue-400" />
												Default Notice Letters
											</h4>
											<p className="text-gray-400 text-sm mb-4">
												Generate and manage PDF letters for late payment and default risk notifications
											</p>
										</div>

										{/* Generate New Letter Section */}
										<div className="bg-gray-800/30 rounded-lg border border-gray-700/30 p-6 mb-6">
											<h5 className="text-lg font-medium text-white mb-4">Generate New Letter</h5>
											
											{loadingBorrowerInfo ? (
												<div className="flex items-center justify-center py-8">
													<div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-400"></div>
													<span className="ml-3 text-gray-400">Loading borrower information...</span>
												</div>
											) : borrowerInfo ? (
												<div className="space-y-4">
													{/* Borrower Information Display */}
													<div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
														<div>
															<label className="block text-xs font-medium text-gray-400 mb-1">Borrower Name</label>
															<p className="text-white font-medium">{borrowerInfo.borrowerName}</p>
														</div>
														{borrowerInfo.borrowerIcNumber && (
															<div>
																<label className="block text-xs font-medium text-gray-400 mb-1">IC Number</label>
																<p className="text-white font-medium">{borrowerInfo.borrowerIcNumber}</p>
															</div>
														)}
														<div className="md:col-span-2">
															<label className="block text-xs font-medium text-gray-400 mb-1">Product</label>
															<p className="text-white font-medium">{borrowerInfo.productName}</p>
														</div>
													</div>

													{/* Editable Address Section */}
													<div>
														<label className="block text-sm font-medium text-gray-300 mb-2">
															Borrower Address
														</label>
														<textarea
															value={editedBorrowerAddress}
															onChange={(e) => setEditedBorrowerAddress(e.target.value)}
															placeholder="Enter borrower address for the letter..."
															className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none"
															rows={3}
														/>
														<p className="text-xs text-gray-400 mt-1">
															This address will appear on the PDF letter. Edit if needed before generating.
														</p>
													</div>

													<button
														onClick={() => generateManualPDFLetter(selectedLoan.id, editedBorrowerAddress)}
														disabled={generatingPDF || !editedBorrowerAddress.trim()}
														className="px-4 py-2 bg-amber-500/20 text-amber-200 rounded-lg border border-amber-400/20 hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
													>
														<DocumentArrowDownIcon className={`h-4 w-4 mr-2 ${generatingPDF ? "animate-pulse" : ""}`} />
														{generatingPDF ? "Generating..." : "Generate PDF Letter"}
													</button>
												</div>
											) : (
												<div className="text-center py-8">
													<p className="text-gray-400">Failed to load borrower information</p>
													<button
														onClick={() => selectedLoan && fetchBorrowerInfo(selectedLoan.id)}
														className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
													>
														Retry
													</button>
												</div>
											)}
										</div>

										{/* Existing Letters List */}
										<div className="bg-gray-800/30 rounded-lg border border-gray-700/30 overflow-hidden">
											<div className="p-4 border-b border-gray-700/30">
												<h5 className="text-lg font-medium text-white">Generated Letters</h5>
											</div>
											
											{loadingPDFLetters ? (
												<div className="flex items-center justify-center py-12">
													<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400"></div>
													<span className="ml-3 text-gray-400">Loading PDF letters...</span>
												</div>
											) : pdfLetters.length > 0 ? (
												<div className="divide-y divide-gray-700/30">
													{pdfLetters.map((letter, index) => (
														<div key={index} className="p-4 hover:bg-gray-700/20 transition-colors">
															<div className="flex items-center justify-between">
																<div className="flex-1">
																	<div className="flex items-center space-x-3">
																		<DocumentArrowDownIcon className="h-5 w-5 text-amber-400" />
																		<div>
																			<h6 className="text-white font-medium">
																				{letter.filename || `Letter ${index + 1}`}
																			</h6>
																			<div className="flex items-center space-x-4 text-xs text-gray-400 mt-1">
																				<span>Created: {new Date(letter.createdAt).toLocaleDateString()}</span>
																				<span>Size: {(letter.size / 1024).toFixed(1)} KB</span>
																			</div>
																		</div>
																	</div>
																</div>
																<div className="flex items-center space-x-2">
																	<button
																		onClick={() => downloadPDFLetter(selectedLoan.id, letter.filename)}
																		className="px-3 py-1 bg-blue-500/20 text-blue-200 rounded border border-blue-400/20 hover:bg-blue-500/30 transition-colors text-sm"
																	>
																		Download
																	</button>
																</div>
															</div>
														</div>
													))}
												</div>
											) : (
												<div className="p-8 text-center">
													<DocumentArrowDownIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
													<h6 className="text-gray-400 font-medium mb-2">No PDF Letters Generated</h6>
													<p className="text-gray-500 text-sm">
														Generate a PDF letter using the form above to get started.
													</p>
												</div>
											)}
										</div>
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
				<div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
					<div className="min-h-screen flex items-center justify-center p-1 xs:p-2 sm:p-4 lg:p-6">
						<div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg sm:rounded-xl w-full max-w-xs xs:max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl border border-gray-700/30 my-2 sm:my-4 max-h-[98vh] flex flex-col">
							{/* Header */}
							<div className="flex-shrink-0 p-3 xs:p-4 sm:p-6 border-b border-gray-700/30">
								<h3 className="text-base xs:text-lg sm:text-xl font-medium text-white mb-1 sm:mb-2">
									Manual Payment
								</h3>
								<div className="text-gray-300 text-xs xs:text-sm sm:text-base">
									<p>Create a manual payment for direct bank transfers or other offline payments.</p>
									{selectedLoan && (
										<p className="mt-2 text-purple-300">
											For: {selectedLoan.user.fullName} (Loan ID: {selectedLoan.id.substring(0, 8)})
										</p>
									)}
								</div>
							</div>
							
							{/* Scrollable Content */}
							<div className="flex-1 overflow-y-auto p-3 xs:p-4 sm:p-6">
								<div className="space-y-3 xs:space-y-4">
									{/* Loan ID - Pre-filled and read-only */}
									<div>
										<label className="block text-xs xs:text-sm font-medium text-gray-300 mb-1 xs:mb-2">
											Loan ID *
										</label>
										<input
											type="text"
											value={manualPaymentForm.loanId}
											readOnly
											className="w-full px-2 xs:px-3 py-1.5 xs:py-2 bg-gray-700/50 border border-gray-600/50 rounded-md xs:rounded-lg text-gray-300 cursor-not-allowed text-xs xs:text-sm sm:text-base"
											placeholder="Loan ID will be auto-filled"
										/>
										<p className="text-xs text-gray-400 mt-1">
											Auto-filled from selected loan
										</p>
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
											className="w-full px-2 xs:px-3 py-1.5 xs:py-2 bg-gray-800/50 border border-gray-700/30 rounded-md xs:rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-xs xs:text-sm sm:text-base"
										/>
										{selectedLoan && (
											<p className="text-xs text-purple-400 mt-1">
												Outstanding balance: {(() => {
													const isPendingSettlement = selectedLoan.status === "PENDING_EARLY_SETTLEMENT" || 
																			   selectedLoan.status === "PENDING_DISCHARGE" ||
																			   selectedLoan.status === "DISCHARGED";
													if (isPendingSettlement) {
														return (
															<span className="text-orange-300">
																{formatCurrency(0)} ({selectedLoan.status === "DISCHARGED" ? "discharged" : "early settlement"})
															</span>
														);
													}
													return formatCurrency(selectedLoan.outstandingBalance);
												})()}
											</p>
										)}
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
											className="w-full px-2 xs:px-3 py-1.5 xs:py-2 bg-gray-800/50 border border-gray-700/30 rounded-md xs:rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-xs xs:text-sm sm:text-base"
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
											className="w-full px-2 xs:px-3 py-1.5 xs:py-2 bg-gray-800/50 border border-gray-700/30 rounded-md xs:rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-xs xs:text-sm sm:text-base"
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
											className="w-full px-2 xs:px-3 py-1.5 xs:py-2 bg-gray-800/50 border border-gray-700/30 rounded-md xs:rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-xs xs:text-sm sm:text-base"
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
											className="w-full px-2 xs:px-3 py-1.5 xs:py-2 bg-gray-800/50 border border-gray-700/30 rounded-md xs:rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-xs xs:text-sm sm:text-base resize-none"
											rows={2}
										/>
									</div>
								</div>
							</div>

							{/* Footer */}
							<div className="flex-shrink-0 p-3 xs:p-4 sm:p-6 border-t border-gray-700/30">
								<div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
									<button
										onClick={handleManualPaymentSubmit}
										disabled={processingManualPayment || !manualPaymentForm.loanId || !manualPaymentForm.amount || !manualPaymentForm.reference}
										className="flex-1 px-3 xs:px-4 py-2 bg-purple-500/20 text-purple-200 rounded-md xs:rounded-lg border border-purple-400/20 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs xs:text-sm sm:text-base font-medium"
									>
										{processingManualPayment ? "Creating..." : "Create Payment"}
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
										{(() => {
											const isPendingSettlement = selectedLoan.status === "PENDING_EARLY_SETTLEMENT" || 
																	   selectedLoan.status === "PENDING_DISCHARGE" ||
																	   selectedLoan.status === "DISCHARGED";
											if (isPendingSettlement) {
												return (
													<span className="text-orange-300">
														{formatCurrency(0)} ({selectedLoan.status === "DISCHARGED" ? "discharged" : "early settlement"})
													</span>
												);
											}
											return formatCurrency(selectedLoan.outstandingBalance);
										})()}
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

			{/* Stamped Agreement Confirmation Modal */}
			{showStampedConfirmModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-medium text-white">
								Replace Existing Stamped Agreement
							</h3>
							<button
								onClick={() => setShowStampedConfirmModal(false)}
								className="text-gray-400 hover:text-white"
							>
								<XMarkIcon className="h-6 w-6" />
							</button>
						</div>

						<div className="mb-6">
							<div className="flex items-center mb-4">
								<ExclamationTriangleIcon className="h-12 w-12 text-amber-500 mr-4" />
								<div>
									<p className="text-white font-medium mb-1">
										Stamped Agreement Already Exists
									</p>
									<p className="text-gray-400 text-sm">
										This loan already has a stamped agreement. Do you want to replace it with a new one?
									</p>
								</div>
							</div>
							
							<div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
								<p className="text-amber-200 text-sm">
									<strong>Warning:</strong> The existing stamped agreement will be replaced and cannot be recovered.
								</p>
							</div>
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => setShowStampedConfirmModal(false)}
								className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={() => {
									setShowStampedConfirmModal(false);
									setShowUploadStampedModal(true);
								}}
								className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors"
							>
								Replace Agreement
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Certificate Confirmation Modal */}
			{showCertificateConfirmModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-medium text-white">
								Replace Existing Certificate
							</h3>
							<button
								onClick={() => setShowCertificateConfirmModal(false)}
								className="text-gray-400 hover:text-white"
							>
								<XMarkIcon className="h-6 w-6" />
							</button>
						</div>

						<div className="mb-6">
							<div className="flex items-center mb-4">
								<ExclamationTriangleIcon className="h-12 w-12 text-amber-500 mr-4" />
								<div>
									<p className="text-white font-medium mb-1">
										Certificate Already Exists
									</p>
									<p className="text-gray-400 text-sm">
										This loan already has a stamp certificate. Do you want to replace it with a new one?
									</p>
								</div>
							</div>
							
							<div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
								<p className="text-amber-200 text-sm">
									<strong>Warning:</strong> The existing certificate will be replaced and cannot be recovered.
								</p>
							</div>
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => setShowCertificateConfirmModal(false)}
								className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={() => {
									setShowCertificateConfirmModal(false);
									setShowUploadCertificateModal(true);
								}}
								className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
							>
								Replace Certificate
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Upload Stamped Agreement Modal */}
			{showUploadStampedModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-medium text-white">
								Upload Stamped Agreement
							</h3>
							<button
								onClick={() => {
									setShowUploadStampedModal(false);
									setUploadStampedFile(null);
									setUploadStampedNotes("");
								}}
								className="text-gray-400 hover:text-white"
							>
								<XMarkIcon className="h-6 w-6" />
							</button>
						</div>

						<div className="mb-4">
							<p className="text-gray-300 text-sm mb-4">
								Upload the stamped version of the signed agreement. Only PDF files are allowed.
							</p>

							<div className="mb-4">
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Stamped PDF File *
								</label>
								<input
									type="file"
									accept=".pdf"
									onChange={(e) => {
										const file = e.target.files?.[0];
										if (file) {
											if (file.type !== 'application/pdf') {
												alert('Please select a PDF file');
												e.target.value = '';
												return;
											}
											setUploadStampedFile(file);
										}
									}}
									className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
								/>
								{uploadStampedFile && (
									<p className="text-teal-400 text-sm mt-1">
										Selected: {uploadStampedFile.name}
									</p>
								)}
							</div>

							<div className="mb-4">
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Notes (Optional)
								</label>
								<textarea
									value={uploadStampedNotes}
									onChange={(e) => setUploadStampedNotes(e.target.value)}
									placeholder="Add any notes about the stamped agreement..."
									className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
									rows={3}
								/>
							</div>
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => {
									setShowUploadStampedModal(false);
									setUploadStampedFile(null);
									setUploadStampedNotes("");
								}}
								className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={handleUploadStampedSubmit}
								disabled={!uploadStampedFile || uploadStampedLoading}
								className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center ${
									!uploadStampedFile || uploadStampedLoading
										? "bg-gray-600 text-gray-400 cursor-not-allowed"
										: "bg-orange-600 text-white hover:bg-orange-500"
								}`}
							>
								{uploadStampedLoading && (
									<div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
								)}
								Upload Agreement
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Upload Certificate Modal */}
			{showUploadCertificateModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-medium text-white">
								Upload Stamp Certificate
							</h3>
							<button
								onClick={() => {
									setShowUploadCertificateModal(false);
									setUploadCertificateFile(null);
									setUploadCertificateNotes("");
								}}
								className="text-gray-400 hover:text-white"
							>
								<XMarkIcon className="h-6 w-6" />
							</button>
						</div>

						<div className="mb-4">
							<p className="text-gray-300 text-sm mb-4">
								Upload the stamp certificate PDF. Only PDF files are allowed.
							</p>

							<div className="mb-4">
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Certificate PDF File *
								</label>
								<input
									type="file"
									accept=".pdf"
									onChange={(e) => {
										const file = e.target.files?.[0];
										if (file) {
											if (file.type !== 'application/pdf') {
												alert('Please select a PDF file');
												e.target.value = '';
												return;
											}
											setUploadCertificateFile(file);
										}
									}}
									className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
								/>
								{uploadCertificateFile && (
									<p className="text-purple-400 text-sm mt-1">
										Selected: {uploadCertificateFile.name}
									</p>
								)}
							</div>

							<div className="mb-4">
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Notes (Optional)
								</label>
								<textarea
									value={uploadCertificateNotes}
									onChange={(e) => setUploadCertificateNotes(e.target.value)}
									placeholder="Add any notes about the certificate..."
									className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
									rows={3}
								/>
							</div>
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => {
									setShowUploadCertificateModal(false);
									setUploadCertificateFile(null);
									setUploadCertificateNotes("");
								}}
								className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={handleUploadCertificateSubmit}
								disabled={!uploadCertificateFile || uploadCertificateLoading}
								className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center ${
									!uploadCertificateFile || uploadCertificateLoading
										? "bg-gray-600 text-gray-400 cursor-not-allowed"
										: "bg-purple-600 text-white hover:bg-purple-500"
								}`}
							>
								{uploadCertificateLoading && (
									<div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
								)}
								Upload Certificate
							</button>
						</div>
					</div>
				</div>
			)}
			</>
			)}

			{/* Disbursements View */}
			{viewMode === "disbursements" && (
				<div className="bg-gray-800/50 rounded-lg border border-gray-700/30 overflow-hidden">
					{loadingDisbursements ? (
						<div className="flex items-center justify-center py-12">
							<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
						</div>
					) : disbursements.length > 0 ? (
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-gray-700">
								<thead className="bg-gray-900/50">
									<tr>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
											Borrower
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
											Reference
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
											Amount
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
											Bank Details
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
											Disbursed
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
											By
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
											Payment Slip
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-700/50">
									{disbursements.map((d) => (
										<tr key={d.id} className="hover:bg-gray-700/30 transition-colors">
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm font-medium text-white">
													{d.application.user.fullName}
												</div>
												<div className="text-xs text-gray-400">
													{d.application.product.name}
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-gray-300 font-mono">
													{d.referenceNumber}
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm font-semibold text-green-400">
													{formatCurrency(d.amount)}
												</div>
											</td>
											<td className="px-6 py-4">
												<div className="text-sm text-gray-300">
													{d.bankName || 'N/A'}
												</div>
												<div className="text-xs text-gray-400 font-mono">
													{d.bankAccountNumber || 'N/A'}
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-gray-300">
													{formatDateTime(d.disbursedAt)}
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-gray-400">
													{d.disbursedBy}
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="flex flex-col gap-2">
													{/* Download button - shown when slip exists */}
													{d.paymentSlipUrl && (
														<button
															onClick={() => downloadDisbursementSlip(d.applicationId, d.referenceNumber)}
															className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
														>
															<DocumentArrowDownIcon className="h-4 w-4 mr-1.5" />
															Download
														</button>
													)}
													
													{/* Upload/Replace button - always shown */}
													<input
														type="file"
														id={`file-${d.applicationId}`}
														accept=".pdf"
														className="hidden"
														onChange={(e) => {
															if (e.target.files?.[0]) {
																handleUploadDisbursementSlip(d.applicationId, e.target);
															}
														}}
													/>
													<label
														htmlFor={`file-${d.applicationId}`}
														className={`inline-flex items-center px-3 py-1.5 text-white text-xs font-medium rounded-md transition-colors cursor-pointer ${
															uploadingSlipFor === d.applicationId
																? 'bg-green-600/50 cursor-wait'
																: 'bg-green-600 hover:bg-green-700'
														}`}
													>
														{uploadingSlipFor === d.applicationId ? (
															<>
																<ArrowPathIcon className="h-4 w-4 mr-1.5 animate-spin" />
																Uploading...
															</>
														) : (
															<>
																<DocumentArrowDownIcon className="h-4 w-4 mr-1.5" />
																{d.paymentSlipUrl ? 'Replace Slip' : 'Upload Slip'}
															</>
														)}
													</label>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className="text-center py-12">
							<BanknotesIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
							<h4 className="text-xl font-medium text-gray-300 mb-2">
								No Disbursements Found
							</h4>
							<p className="text-gray-500">
								Disbursements will appear here once loans are disbursed.
							</p>
						</div>
					)}
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
