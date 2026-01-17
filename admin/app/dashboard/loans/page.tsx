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
	ClipboardDocumentCheckIcon,
	XCircleIcon,
	FolderIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";
import { toast } from "sonner";
import CreditReportCard from "../../components/CreditReportCard";
import ConfirmationModal, { ConfirmationModalColor } from "../../../components/ConfirmationModal";

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
	dischargedAt?: string | null;
	createdAt: string;
	updatedAt: string;
	totalPaid?: number;
	// Early settlement fields (legacy - kept for backward compatibility)
	earlySettlementAmount?: number | null;
	earlySettlementDiscount?: number | null;
	// Early settlement info from loan application history
	earlySettlementInfo?: {
		totalSettlement: number | null;
		discountAmount: number | null;
		feeAmount: number | null;
		netSavings: number | null;
		approvedAt: string | null;
	} | null;
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
		// Fee fields for financial breakdown
		stampingFee?: number;
		legalFeeFixed?: number;
		legalFee?: number;
		originationFee?: number;
		applicationFee?: number;
		netDisbursement?: number;
		interestRate?: number;
		monthlyRepayment?: number;
		product: {
			name: string;
			code: string;
			// Late fee fields
			lateFeeRate?: number;
			lateFeeFixedAmount?: number;
			lateFeeFrequencyDays?: number;
			// Document requirements
			requiredDocuments?: string[];
			collateralRequired?: boolean;
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
			// Address fields
			address1?: string;
			address2?: string;
			city?: string;
			state?: string;
			zipCode?: string;
			country?: string;
			// Education and employment fields
			educationLevel?: string;
			serviceLength?: string;
			nationality?: string;
			icNumber?: string;
			idNumber?: string;
			// Demographics
			race?: string;
			gender?: string;
			occupation?: string;
		};
		// Documents associated with this application
		documents?: {
			id: string;
			type: string;
			status: string;
			fileUrl: string;
			createdAt: string;
			updatedAt?: string;
		}[];
	};
	user: {
		id: string;
		fullName: string;
		email: string;
		phoneNumber: string;
		// Address fields
		address1?: string;
		address2?: string;
		city?: string;
		state?: string;
		zipCode?: string;
		country?: string;
		// Additional fields
		icNumber?: string;
		idNumber?: string;
		nationality?: string;
		educationLevel?: string;
		employmentStatus?: string;
		employerName?: string;
		serviceLength?: string;
		monthlyIncome?: string;
		bankName?: string;
		accountNumber?: string;
		// Emergency contact fields
		emergencyContactName?: string;
		emergencyContactPhone?: string;
		emergencyContactRelationship?: string;
		// Demographics
		race?: string;
		gender?: string;
		occupation?: string;
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
	disbursedByUser?: {
		id: string;
		fullName: string | null;
		email: string | null;
	} | null;
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
		loan?: {
			id: string;
			status: string;
		} | null;
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
	
	// System-wide late fee grace period setting
	const [lateFeeGraceDays, setLateFeeGraceDays] = useState<number>(3);

	// Credit report state
	const [creditReport, setCreditReport] = useState<any | null>(null);

	// Confirmation modal state
	const [confirmModal, setConfirmModal] = useState<{
		open: boolean;
		title: string;
		message: string;
		details?: string[];
		confirmText: string;
		confirmColor: ConfirmationModalColor;
		onConfirm: () => void;
	}>({
		open: false,
		title: "",
		message: "",
		details: [],
		confirmText: "Confirm",
		confirmColor: "blue",
		onConfirm: () => {},
	});

	const showConfirmModal = (config: {
		title: string;
		message: string;
		details?: string[];
		confirmText: string;
		confirmColor: ConfirmationModalColor;
		onConfirm: () => void;
	}) => {
		setConfirmModal({ ...config, open: true });
	};

	const closeConfirmModal = () => {
		setConfirmModal((prev) => ({ ...prev, open: false }));
	};

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

	// Handle loanId query parameter (from document audit logs)
	useEffect(() => {
		const loanIdParam = searchParams.get("loanId");
		if (loanIdParam) {
			// Switch to loans tab if currently on disbursements
			setViewMode("loans");
			
			// Set the search term to the loan ID so it filters the list
			setSearchTerm(loanIdParam);
			setStatusFilter("all"); // Show all statuses
			
			// If loans are loaded, try to auto-select the matching loan
			if (loans.length > 0) {
				const matchedLoan = loans.find((loan) => loan.id === loanIdParam);
				if (matchedLoan) {
					setSelectedLoan(matchedLoan);
				}
			}
		}
	}, [searchParams, loans]);

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
					lateFeeGraceDays: number;
				};
			}>("/api/admin/loans");

			if (response.success && response.data) {
				// Include all loan statuses (ACTIVE, PENDING_DISCHARGE, DISCHARGED)
				setLoans(response.data);
				
				// Store system settings for displaying calculation methods
				if (response.systemSettings) {
					// Store in state if needed, or use directly in rendering
					(window as any).loanSystemSettings = response.systemSettings;
					// Store late fee grace days from system settings
					setLateFeeGraceDays(response.systemSettings.lateFeeGraceDays ?? 3);
				}
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
				toast.error('Payment slip not found');
			}
		} catch (error) {
			console.error('Error downloading slip:', error);
			toast.error('Failed to download payment slip');
		}
	};

	const handleUploadDisbursementSlip = async (applicationId: string, fileInput: HTMLInputElement) => {
		const file = fileInput.files?.[0];
		if (!file) return;

		// Check file size (10MB limit set by backend Multer)
		const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
		if (file.size > MAX_FILE_SIZE) {
			toast.warning(`File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds 10MB limit. Please compress or use a smaller file.`);
			fileInput.value = ''; // Clear file input
			return;
		}

		// Check file type
		if (file.type !== 'application/pdf') {
			toast.warning('Only PDF files are allowed for payment slips.');
			fileInput.value = ''; // Clear file input
			return;
		}

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
				let errorMessage = 'Upload failed';
				try {
					const error = await response.json();
					errorMessage = error.message || error.error || errorMessage;
				} catch (e) {
					// If response is not JSON, try to get text
					const errorText = await response.text();
					if (errorText.includes('File too large')) {
						errorMessage = 'File size exceeds the 10MB limit. Please use a smaller file.';
					} else if (errorText) {
						errorMessage = errorText;
					}
				}
				throw new Error(errorMessage);
			}

			const data = await response.json();
			
			toast.success('Payment slip uploaded successfully');
			fileInput.value = ''; // Clear file input
			
			// Refresh disbursements
			await fetchDisbursements();
		} catch (error) {
			console.error('Error uploading payment slip:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to upload payment slip';
			toast.error(`Upload failed: ${errorMessage}`);
			fileInput.value = ''; // Clear file input on error
		} finally {
			setUploadingSlipFor(null);
		}
	};

	const fetchLoanRepayments = async (loanId: string) => {
		try {
			setLoadingRepayments(true);
			const response = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: LoanData;
			}>(`/api/admin/loans/${loanId}/repayments?raw=true&t=${Date.now()}`);


			if (response.success && response.data) {

				// Update the selected loan with repayments data and totalPaid from backend
				setSelectedLoan((prev) =>
					prev
						? { 
							...prev, 
							repayments: response.data.repayments,
							// Also update totalPaid from backend calculation (based on wallet transactions)
							totalPaid: (response.data as any).totalPaid ?? prev.totalPaid
						}
						: null
				);
			} else {
				console.error("❌ Failed to get repayments data:", response);
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
			const response = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: WalletTransaction[];
			}>(`/api/admin/loans/${loanId}/transactions`);

			if (response.success && response.data) {
				setWalletTransactions(response.data);
			} else {
				console.error(
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
			const response = await fetchWithAdminTokenRefresh<
				| {
						applicationId: string;
						currentStatus: string;
						timeline: LoanApplicationHistory[];
				  }
				| LoanApplicationHistory[]
			>(`/api/admin/applications/${applicationId}/history`);

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
				fetchPDFLetters(loanId); // Refresh the list
			} else {
				throw new Error(data.message || "Failed to generate PDF letter");
			}
		} catch (error) {
			console.error("Error generating PDF letter:", error);
			toast.error(`Failed to generate PDF letter: ${error instanceof Error ? error.message : "Unknown error"}`);
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
			toast.error('Failed to download PDF letter');
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

		if (
			selectedTab === "repayments" &&
			selectedLoan &&
			fetchedRepaymentsForLoan !== selectedLoan.id
		) {
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
				toast.success("Loans refreshed successfully");
			} else {
				setError("Failed to load loans data");
				toast.error("Failed to load loans data");
			}
		} catch (error) {
			console.error("Error refreshing loans:", error);
			setError("Failed to refresh loans. Please try again.");
			toast.error("Failed to refresh loans");
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
			toast.warning("Please provide a reason for the discharge request");
			return;
		}
		if (dischargeAction === "approve" && !dischargeNotes.trim()) {
			toast.warning("Please provide admin notes for the discharge approval");
			return;
		}
		if (dischargeAction === "reject" && !dischargeReason.trim()) {
			toast.warning("Please provide a reason for rejecting the discharge");
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
				toast.success(`Loan discharge ${actionText} successfully`);
			} else {
				toast.error(
					response.message || `Failed to ${dischargeAction} discharge`
				);
			}
		} catch (error) {
			console.error(`Error ${dischargeAction}ing discharge:`, error);
			toast.error(`Failed to ${dischargeAction} discharge. Please try again.`);
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
			toast.warning("Please fill in all required fields (Loan ID, Amount, Reference)");
			return;
		}

		const amount = parseFloat(manualPaymentForm.amount);
		if (isNaN(amount) || amount <= 0) {
			toast.warning("Please enter a valid payment amount greater than 0");
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
			toast.error(`Failed to create manual payment: ${error instanceof Error ? error.message : "Unknown error"}`);
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
			toast.error('Failed to download receipt');
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
			toast.error(`Failed to download signed agreement: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
		} catch (error) {
			console.error("❌ Error downloading stamped agreement:", error);
			toast.error(error instanceof Error ? error.message : "Failed to download stamped agreement");
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

		} catch (error) {
			console.error("❌ Error downloading stamp certificate:", error);
			toast.error(error instanceof Error ? error.message : "Failed to download stamp certificate");
		}
	};

	const downloadLampiranA = async (loanId: string) => {
		try {
			toast.info("Generating Lampiran A...");
			const token = localStorage.getItem("adminToken");
			const response = await fetch(
				`/api/admin/loans/${loanId}/lampiran-a`,
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
			let filename = `Lampiran-A-${loanId.substring(0, 8)}.pdf`;
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
			toast.success("Lampiran A downloaded successfully");
		} catch (error) {
			console.error('Error downloading Lampiran A:', error);
			toast.error(`Failed to download Lampiran A: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
			toast.warning("Please select a PDF file to upload");
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

			// Reset form and close modal
			resetUploadStampedModals();
			
			// Refresh loans to show updated data
			await fetchActiveLoans();

		} catch (error) {
			console.error("❌ Error uploading stamped agreement:", error);
			toast.error(error instanceof Error ? error.message : "Failed to upload stamped agreement");
		} finally {
			setUploadStampedLoading(false);
		}
	};

	const handleUploadCertificateSubmit = async () => {
		if (!uploadCertificateFile || !uploadCertificateLoanId) {
			toast.warning("Please select a PDF file to upload");
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

			// Reset form and close modal
			resetUploadCertificateModals();
			
			// Refresh loans to show updated data
			await fetchActiveLoans();

		} catch (error) {
			console.error("❌ Error uploading stamp certificate:", error);
			toast.error(error instanceof Error ? error.message : "Failed to upload stamp certificate");
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
			return maxDaysLate;
		}
		
		// Fallback to nextPaymentDue check for backward compatibility
		const fallbackDays = getDaysLateFromDate(loan.nextPaymentDue);
		return fallbackDays;
	};

	const getLateStatusColor = (daysLate: number) => {
		if (daysLate === 0)
			return {
				bg: "bg-blue-500/20",
				text: "text-blue-200",
				border: "border-blue-400/20",
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
		// 31+ days - red/critical
		return {
			bg: "bg-red-500/20",
			text: "text-red-200",
			border: "border-red-400/20",
		};
	};
	
	// Helper to check if loan is in any late/risk/default state
	const isLoanInTrouble = (loan: LoanData) => {
		const isDefaulted = loan.status === "DEFAULT" || loan.defaultedAt;
		const isDefaultRisk = loan.defaultRiskFlaggedAt && !loan.defaultedAt;
		const daysLate = getDaysLate(loan);
		return isDefaulted || isDefaultRisk || daysLate > 0;
	};

	const getLoanStatusColor = (status: string) => {
		switch (status) {
			case "ACTIVE":
				return {
					bg: "bg-blue-500/20",
					text: "text-blue-200",
					border: "border-blue-400/20",
				};
			case "PENDING_DISCHARGE":
				return {
					bg: "bg-purple-500/20",
					text: "text-purple-200",
					border: "border-purple-400/20",
				};
			case "PENDING_EARLY_SETTLEMENT":
				return {
					bg: "bg-purple-500/20",
					text: "text-purple-200",
					border: "border-purple-400/20",
				};
			case "DISCHARGED":
				return {
					bg: "bg-green-500/20",
					text: "text-green-200",
					border: "border-green-400/20",
				};
			case "DEFAULT":
				return {
					bg: "bg-red-800/50",
					text: "text-red-100",
					border: "border-red-600/50",
				};
			case "DEFAULT_RISK":
				return {
					bg: "bg-rose-600/30",
					text: "text-rose-200",
					border: "border-rose-400/30",
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
		// For discharged or settled loans, show 100% progress
		const isSettled = loan.status === "DISCHARGED" || 
						  loan.status === "PENDING_DISCHARGE" || 
						  loan.status === "PENDING_EARLY_SETTLEMENT";
		if (isSettled) return 100;
		
		// Calculate total amount including late fees
		const baseLoanAmount = loan.totalAmount || loan.principalAmount;
		const totalLateFeesAssessed = loan.repayments?.reduce((total, repayment) => {
			return total + (repayment.lateFeeAmount || 0);
		}, 0) || 0;
		const totalAmountDue = baseLoanAmount + totalLateFeesAssessed;
		
		if (totalAmountDue === 0) return 0;
		
		// Calculate total paid using actualAmount (the actual amount paid)
		// Include both COMPLETED and PARTIAL repayments since actualAmount reflects actual payments made
		const totalPaid = loan.repayments?.reduce((total, repayment) => {
			if (repayment.status !== "COMPLETED" && repayment.status !== "PARTIAL") return total;
			return total + (repayment.actualAmount || 0);
		}, 0) || 0;
		
		return Math.min((totalPaid / totalAmountDue) * 100, 100);
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
		// Handle document-related events with readable descriptions
		if (newStatus === "DOCUMENT_UPLOADED") {
			return "Document Uploaded";
		}
		if (newStatus === "DOCUMENT_DELETED") {
			return "Document Deleted";
		}
		if (newStatus === "DOCUMENT_APPROVED") {
			return "Document Approved";
		}
		if (newStatus === "DOCUMENT_REJECTED") {
			return "Document Rejected";
		}
		if (newStatus === "DOCUMENT_STATUS_CHANGED") {
			return "Document Status Changed";
		}
		
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

	// Document helper functions for Documents tab
	const getDocumentTypeName = (type: string): string => {
		const documentTypeMap: Record<string, string> = {
			ID: "Identification Document",
			PAYSLIP: "Pay Slip",
			BANK_STATEMENT: "Bank Statement",
			UTILITY_BILL: "Utility Bill",
			EMPLOYMENT_LETTER: "Employment Letter",
			OTHER: "Other Document",
		};
		return documentTypeMap[type] || type;
	};

	const getDocumentStatusColor = (
		status: string
	): { bg: string; text: string } => {
		const statusMap: Record<string, { bg: string; text: string }> = {
			PENDING: { bg: "bg-yellow-500/20", text: "text-yellow-200" },
			APPROVED: { bg: "bg-green-500/20", text: "text-green-200" },
			REJECTED: { bg: "bg-red-500/20", text: "text-red-200" },
		};
		return statusMap[status] || { bg: "bg-gray-500/20", text: "text-gray-300" };
	};

	// Format document URL for viewing
	const formatDocumentUrl = (fileUrl: string, documentId: string, applicationId: string): string => {
		if (!fileUrl) return "";

		// If the URL already includes http(s), it's already an absolute URL
		if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
			return fileUrl;
		}

		// For relative URLs, use the loan-applications API endpoint
		if (applicationId && documentId) {
			return `${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}/documents/${documentId}`;
		}

		// Fallback to direct file access
		const backendUrl = process.env.NEXT_PUBLIC_API_URL;
		const cleanFileUrl = fileUrl.startsWith("/") ? fileUrl.substring(1) : fileUrl;
		return `${backendUrl}/${cleanFileUrl}`;
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
					console.error(`CSV Export - Bulk - No history entries found for loan ${loan.id}`);
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

	/**
	 * Download all loans in KPKT format for uploading to KPKT portal
	 * Format follows the contoh_upload.csv template
	 */
	const downloadKPKTExport = async () => {
		try {
			setRefreshing(true);
			
			// KPKT CSV headers (exact column names from template)
			const headers = [
				'JenisPemohon',
				'NamaPemohon',
				'JenisSyarikat',
				'NomborPerniagaan',
				'NoKp',
				'NomborTelefon',
				'Bangsa',
				'Jantina',
				'Pekerjaan',
				'Pendapatan',
				'Majikan',
				'Alamat',
				'StatusCagaran',
				'JenisCagaran',
				'NilaiCagaran',
				'TarikhPinjaman',
				'PinjamanPokok',
				'JumlahFaedahKeseluruhan',
				'JumlahPinjamanKeseluruhan',
				'KadarFaedah',
				'TempohBayaran',
				'BakiPinjamanKeseluruhan',
				'JumlahNpl',
				'Nota'
			];

			// Helper to get Majikan (Employer type) for KPKT format
			// Valid values: Kerajaan, Swasta, Berniaga, Kerja Sendiri, Tidak Bekerja
			const getMajikanForKPKT = (employmentStatus?: string): string => {
				if (!employmentStatus) return 'Tiada Maklumat';
				const s = employmentStatus.toUpperCase();
				// Check UNEMPLOYED first before EMPLOYED (since UNEMPLOYED contains EMPLOYED)
				// Student, Retired, Unemployed, Not Working all fall under Tidak Bekerja
				if (s.includes('UNEMPLOYED') || s.includes('NOT WORKING') || s.includes('TIDAK BEKERJA') || 
				    s.includes('STUDENT') || s.includes('PELAJAR') || s.includes('RETIRED') || s.includes('PENCEN')) {
					return 'Tidak Bekerja';
				}
				if (s.includes('GOVERNMENT') || s.includes('KERAJAAN')) return 'Kerajaan';
				if (s.includes('PRIVATE') || s.includes('SWASTA') || s.includes('EMPLOYED')) return 'Swasta';
				if (s.includes('BUSINESS') || s.includes('BERNIAGA')) return 'Berniaga';
				if (s.includes('SELF') || s.includes('FREELANCE') || s.includes('SENDIRI')) return 'Kerja Sendiri';
				return 'Tiada Maklumat';
			};

			// Helper to get Pekerjaan (Occupation/Job title) for KPKT format
			// This is the actual job title (e.g., Manager, Salesman)
			// If not provided, return "Tiada Maklumat"
			const getPekerjaanForKPKT = (occupation?: string): string => {
				return occupation || 'Tiada Maklumat';
			};

			// Helper to translate gender to Jantina (Lelaki/Perempuan)
			const getJantinaForKPKT = (gender?: string): string => {
				if (!gender) return '';
				const g = gender.toUpperCase();
				if (g === 'MALE' || g === 'M' || g === 'LELAKI') return 'Lelaki';
				if (g === 'FEMALE' || g === 'F' || g === 'PEREMPUAN') return 'Perempuan';
				return '';
			};

			// Helper to translate race to Bangsa for KPKT
			const getBangsaForKPKT = (race?: string): string => {
				if (!race) return 'Tiada Maklumat';
				const r = race.toUpperCase();
				if (r.includes('MALAY') || r === 'MELAYU') return 'Melayu';
				if (r.includes('CHINESE') || r === 'CINA') return 'Cina';
				if (r.includes('INDIAN') || r === 'INDIA') return 'India';
				if (r.includes('SABAH') || r.includes('SARAWAK') || r.includes('BUMIPUTRA') || r.includes('KADAZAN') || r.includes('IBAN') || r.includes('BIDAYUH')) return 'Bumiputra(Sabah/Sarawak)';
				if (r.includes('OTHER') || r.includes('LAIN')) return 'Lain - lain';
				return 'Lain - lain';
			};

			// Helper to translate nationality to Bangsa (fallback if race not available)
			const translateNationalityToKPKT = (nationality?: string): string => {
				if (!nationality) return 'Tiada Maklumat';
				const n = nationality.toUpperCase();
				if (n.includes('MALAY') || n === 'MELAYU') return 'Melayu';
				if (n.includes('CHINESE') || n === 'CINA') return 'Cina';
				if (n.includes('INDIAN') || n === 'INDIA') return 'India';
				if (n.includes('SABAH') || n.includes('SARAWAK') || n.includes('BUMIPUTRA') || n.includes('KADAZAN') || n.includes('IBAN') || n.includes('BIDAYUH')) return 'Bumiputra(Sabah/Sarawak)';
				if (n.includes('MALAYSIA') || n.includes('WARGANEGARA')) return 'Lain - lain';
				if (n.includes('FOREIGN') || n.includes('ASING') || !n.includes('MALAYSIA')) return 'Bukan Warganegara';
				return 'Lain - lain';
			};

			// Helper to get loan status in KPKT Nota format
			const getLoanNota = (loan: LoanData): string => {
				const status = loan.status.toUpperCase();
				if (status === 'DISCHARGED' || status === 'COMPLETED' || status === 'SETTLED') {
					return 'PINJAMAN SELESAI';
				}
				if (status === 'DEFAULTED' || status === 'DEFAULT' || status === 'IN_COURT' || status === 'LEGAL_ACTION' || loan.defaultedAt) {
					return 'DALAM TINDAKAN MAHKAMAH';
				}
				if (status === 'POTENTIAL_DEFAULT' || status === 'RECOVERY' || status === 'COLLECTION' || status === 'OVERDUE' || loan.defaultRiskFlaggedAt) {
					return 'DALAM PROSES DAPAT BALIK';
				}
				return 'PINJAMAN SEMASA';
			};

			// Helper to format date as DD/MM/YYYY
			const formatKPKTDate = (dateString: string | null): string => {
				if (!dateString) return '';
				const date = new Date(dateString);
				const day = date.getDate().toString().padStart(2, '0');
				const month = (date.getMonth() + 1).toString().padStart(2, '0');
				const year = date.getFullYear();
				return `${day}/${month}/${year}`;
			};

			// Helper to format address
			const formatKPKTAddress = (user: any): string => {
				const parts = [
					user?.address1,
					user?.address2,
					user?.city,
					user?.state,
					user?.zipCode,
				].filter(Boolean);
				return parts.join(', ') || '';
			};

			// Build CSV data
			const csvData: string[][] = [headers];

			for (const loan of filteredLoans) {
				const user = loan.application?.user || loan.user;
				const isCompany = false; // Currently all loans are individual - can be extended if needed
				
				// Calculate total interest
				const totalInterest = (loan.totalAmount || loan.principalAmount) - loan.principalAmount;
				
				// Calculate annualized interest rate
				// Formula: (Total Interest / Principal) / (Term in Years) * 100
				// Example: Principal 150,000, Interest 27,000, Term 12 months
				//   Annual Rate = (27,000 / 150,000) / (12/12) * 100 = 18%
				const termInYears = loan.term / 12;
				const annualizedInterestRate = loan.principalAmount > 0 && termInYears > 0
					? (totalInterest / loan.principalAmount) / termInYears * 100
					: loan.interestRate; // Fallback to stored rate if calculation fails
				
				// Calculate NPL amount (if in default or recovery status)
				const isNPL = loan.status === 'DEFAULTED' || loan.status === 'DEFAULT' || 
				              loan.status === 'POTENTIAL_DEFAULT' || loan.defaultedAt || loan.defaultRiskFlaggedAt;
				const nplAmount = isNPL ? loan.outstandingBalance : 0;

				const row = [
					isCompany ? 'Syarikat' : 'Individu',                           // JenisPemohon
					user?.fullName || '',                                           // NamaPemohon
					isCompany ? '' : '',                                            // JenisSyarikat (empty for individuals)
					isCompany ? '' : '',                                            // NomborPerniagaan (empty for individuals)
					user?.icNumber || user?.idNumber || '',                         // NoKp
					user?.phoneNumber || '',                                        // NomborTelefon
					getBangsaForKPKT(user?.race) || translateNationalityToKPKT(user?.nationality), // Bangsa (use race, fallback to nationality)
					getJantinaForKPKT(user?.gender),                                // Jantina
					getPekerjaanForKPKT(user?.occupation),                          // Pekerjaan (job title)
					user?.monthlyIncome || '',                                      // Pendapatan
					getMajikanForKPKT(user?.employmentStatus),                      // Majikan (employer type)
					formatKPKTAddress(user),                                        // Alamat
					loan.application?.product?.collateralRequired ? 'Bercagar' : 'Tidak Bercagar', // StatusCagaran
					loan.application?.product?.collateralRequired ? 'Lain-lain' : '', // JenisCagaran
					'',                                                             // NilaiCagaran
					formatKPKTDate(loan.disbursedAt || loan.createdAt),            // TarikhPinjaman
					Math.round(loan.principalAmount).toString(),                    // PinjamanPokok
					Math.round(totalInterest).toString(),                           // JumlahFaedahKeseluruhan
					Math.round(loan.totalAmount || loan.principalAmount).toString(), // JumlahPinjamanKeseluruhan
					Math.round(annualizedInterestRate).toString(),                  // KadarFaedah (annualized %)
					loan.term.toString(),                                           // TempohBayaran
					Math.round(loan.outstandingBalance).toString(),                 // BakiPinjamanKeseluruhan
					Math.round(nplAmount).toString(),                               // JumlahNpl
					getLoanNota(loan)                                               // Nota
				];

				csvData.push(row);
			}

			// Convert to CSV string
			const csvContent = csvData
				.map(row => 
					row.map(cell => {
						const cellString = String(cell || '');
						// Escape quotes and wrap in quotes if contains comma, quote, or newline
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
				link.setAttribute('download', `KPKT_Export_${new Date().toISOString().split('T')[0]}.csv`);
				link.style.visibility = 'hidden';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			}

			toast.success('KPKT export downloaded successfully');
		} catch (error) {
			console.error('Error downloading KPKT export:', error);
			setError('Failed to download KPKT export file');
			toast.error('Failed to download KPKT export');
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
					const historyData = await fetchWithAdminTokenRefresh(
						`/api/admin/applications/${loan.applicationId}/history`
					) as any;
					// The API returns the timeline directly as an array
					history = Array.isArray(historyData) ? historyData : (historyData.timeline || historyData.history || []);
				} catch (error) {
					console.error('Error fetching history for CSV:', error);
				}
			} else {
				console.error(`CSV Export - No application ID for loan ${loan.id}`);
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
				const transactionsData = await fetchWithAdminTokenRefresh(
					`/api/admin/loans/${loan.id}/transactions`
				) as any;
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


			// Add audit trail entries as separate rows
			if (allAuditEvents.length > 0) {
				allAuditEvents.forEach((event, index) => {
					if (event.type === 'application') {
						const historyData = event.data as LoanApplicationHistory;
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
				console.error(`CSV Export - Individual Loan - No audit trail events found for loan ${loan.id}`);
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
						onClick={downloadKPKTExport}
						disabled={refreshing}
						className="flex items-center px-4 py-2 bg-amber-500/20 text-amber-200 rounded-lg border border-amber-400/20 hover:bg-amber-500/30 transition-colors"
						title="Export all loans in KPKT format for portal upload"
					>
						{refreshing ? (
							<ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<DocumentArrowDownIcon className="h-4 w-4 mr-2" />
						)}
						KPKT Export (CSV)
					</button>
					<button
						onClick={downloadCSV}
						disabled={refreshing}
						className="flex items-center px-4 py-2 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors"
						title="Download detailed audit trail with repayments and history"
					>
						{refreshing ? (
							<ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<DocumentArrowDownIcon className="h-4 w-4 mr-2" />
						)}
						Audit Trail (CSV)
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
								? "bg-blue-500/30 text-blue-100 border-blue-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Current ({filterCounts.active})
					</button>
					<button
						onClick={() => setStatusFilter("pending_discharge")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "pending_discharge"
								? "bg-purple-500/30 text-purple-100 border-purple-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Pending Discharge ({filterCounts.pending_discharge})
					</button>
					<button
						onClick={() => setStatusFilter("pending_early_settlement")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "pending_early_settlement"
								? "bg-purple-500/30 text-purple-100 border-purple-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Early Settlement ({filterCounts.pending_early_settlement})
					</button>
					<button
						onClick={() => setStatusFilter("discharged")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "discharged"
								? "bg-green-500/30 text-green-100 border-green-400/30"
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
								? "bg-rose-600/30 text-rose-100 border-rose-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Default Risk ({filterCounts.potential_default})
					</button>
					<button
						onClick={() => setStatusFilter("defaulted")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "defaulted"
								? "bg-red-800/50 text-red-100 border-red-600/50"
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
														{/* Status Display - Priority: DEFAULT > Default Risk > Late > Active */}
														{(() => {
															// Check for defaulted status (highest priority)
															const isDefaulted = loan.status === "DEFAULT" || loan.defaultedAt;
															if (isDefaulted) {
																const defaultedStatus = getLoanStatusColor("DEFAULT");
																return (
																	<span
																		className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${defaultedStatus.bg} ${defaultedStatus.text} ${defaultedStatus.border} mb-1`}
																	>
																		Loan Defaulted
																	</span>
																);
															}
															
															// Check for default risk (second priority)
															const isDefaultRisk = loan.defaultRiskFlaggedAt && !loan.defaultedAt;
															if (isDefaultRisk) {
																const defaultRiskStatus = getLoanStatusColor("DEFAULT_RISK");
																return (
																	<span
																		className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${defaultRiskStatus.bg} ${defaultRiskStatus.text} ${defaultRiskStatus.border} mb-1`}
																	>
																		Default Risk
																	</span>
																);
															}
															
															// For ACTIVE loans, show payment status (late/current)
															if (loan.status === "ACTIVE") {
																return (
																	<span
																		className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${lateStatus.bg} ${lateStatus.text} ${lateStatus.border} mb-1`}
																	>
																		{getPaymentStatusText(daysLate)}
																	</span>
																);
															}
															
															// For other non-active statuses
															return (
																<span
																	className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${loanStatus.bg} ${loanStatus.text} ${loanStatus.border} mb-1`}
																>
																	{loan.status === "PENDING_DISCHARGE"
																		? "Pending Discharge"
																		: loan.status === "PENDING_EARLY_SETTLEMENT"
																		? "Early Settlement Pending"
																		: loan.status === "DISCHARGED"
																		? "Discharged"
																		: loan.status}
																</span>
															);
														})()}

														<p className="text-xs text-gray-400 mt-2">
															Outstanding:
														</p>
														<p className="text-xs font-medium">
															{(() => {
																const isPendingSettlement = loan.status === "PENDING_EARLY_SETTLEMENT" || 
																						   loan.status === "PENDING_DISCHARGE" ||
																						   loan.status === "DISCHARGED";
																if (isPendingSettlement) {
																	// Calculate total paid from completed/partial repayments (this is the actual amount paid)
																	const totalPaid = loan.repayments?.reduce((total, repayment) => {
																		if (repayment.status !== "COMPLETED" && repayment.status !== "PARTIAL") return total;
																		// For completed/partial repayments, use actualAmount which reflects actual payment
																		return total + (repayment.actualAmount || 0);
																	}, 0) || 0;
																	
																	// Get discount info if available
																	const discount = loan.earlySettlementInfo?.discountAmount || loan.earlySettlementDiscount || 0;
																	
																	// Always show total paid from repayments (actual amount paid)
																	return (
																		<span className="text-green-300">
																			Paid: {formatCurrency(totalPaid)}
																			{discount > 0 && (
																				<span className="text-xs text-green-400 block">
																					-{formatCurrency(discount)} discount
																				</span>
																			)}
																		</span>
																	);
																}
																
																// Calculate late fees for late/default loans
																const unpaidLateFees = loan.repayments?.reduce((total, repayment) => {
																	const assessed = repayment.lateFeeAmount || 0;
																	const paid = repayment.lateFeesPaid || 0;
																	return total + Math.max(0, assessed - paid);
																}, 0) || 0;
																const totalOutstanding = loan.outstandingBalance + unpaidLateFees;
																
																// Check if loan is in trouble (late, default risk, or defaulted)
																const isDefaulted = loan.status === "DEFAULT" || loan.defaultedAt;
																const isDefaultRisk = loan.defaultRiskFlaggedAt && !loan.defaultedAt;
																const isLate = daysLate > 0;
																
																if (isDefaulted) {
																	return (
																		<span className="text-red-300 font-semibold">
																			{formatCurrency(totalOutstanding)}
																			{unpaidLateFees > 0 && (
																				<span className="text-xs text-red-400 block">
																					incl. {formatCurrency(unpaidLateFees)} fees
																				</span>
																			)}
																		</span>
																	);
																}
																if (isDefaultRisk) {
																	return (
																		<span className="text-rose-300">
																			{formatCurrency(totalOutstanding)}
																			{unpaidLateFees > 0 && (
																				<span className="text-xs text-rose-400 block">
																					incl. {formatCurrency(unpaidLateFees)} fees
																				</span>
																			)}
																		</span>
																	);
																}
																if (isLate) {
																	return (
																		<span className="text-orange-300">
																			{formatCurrency(totalOutstanding)}
																			{unpaidLateFees > 0 && (
																				<span className="text-xs text-orange-400 block">
																					incl. {formatCurrency(unpaidLateFees)} fees
																				</span>
																			)}
																		</span>
																	);
																}
																return (
																	<span className="text-white">
																		{formatCurrency(loan.outstandingBalance)}
																	</span>
																);
															})()}
														</p>
														<p className="text-xs text-blue-300 mt-1">
															{(() => {
																const isPendingSettlement = loan.status === "PENDING_EARLY_SETTLEMENT" || 
																						   loan.status === "PENDING_DISCHARGE" ||
																						   loan.status === "DISCHARGED";
																// For settled loans, show original loan amount
																if (isPendingSettlement) {
																	return (
																		<span className="text-gray-400">
																			Loan: {formatCurrency(loan.totalAmount || loan.principalAmount)}
																		</span>
																	);
																}
																// For late loans, show total including late fees
																const totalLateFeesAssessed = loan.repayments?.reduce((total, repayment) => {
																	return total + (repayment.lateFeeAmount || 0);
																}, 0) || 0;
																const baseLoanAmount = loan.totalAmount || loan.principalAmount;
																
																if (totalLateFeesAssessed > 0) {
																	return (
																		<>
																			of {formatCurrency(baseLoanAmount + totalLateFeesAssessed)} total
																		</>
																	);
																}
																return (
																	<>
																		of {formatCurrency(baseLoanAmount)} total
																	</>
																);
															})()}
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
							<div className="p-4 border-b border-gray-700/30 flex justify-between items-start">
								<div>
									<h3 className="text-lg font-medium text-white">
										Loan Details
									</h3>
									<div className="mt-1.5 flex items-center gap-2">
										{(() => {
											const statusColor = getLoanStatusColor(selectedLoan.status);
											const statusLabels: Record<string, string> = {
												'ACTIVE': 'Active',
												'PENDING_DISCHARGE': 'Pending Discharge',
												'PENDING_EARLY_SETTLEMENT': 'Early Settlement',
												'DISCHARGED': 'Discharged',
												'DEFAULT': 'Defaulted',
												'DEFAULT_RISK': 'Default Risk'
											};
											return (
												<span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
													{statusLabels[selectedLoan.status] || selectedLoan.status}
												</span>
											);
										})()}
									</div>
								</div>
								<div className="flex items-center gap-3">
									<span className="px-2 py-1 bg-gray-500/20 text-gray-300 text-xs font-medium rounded-full border border-gray-400/20">
										ID: {selectedLoan.id.substring(0, 8)}
									</span>
								</div>
							</div>
							<div className="p-4 border-b border-gray-700/30 space-y-3">
								{/* Row 1: View Actions */}
								<div className="flex items-center gap-3">
									<span className="text-xs font-medium text-gray-400 uppercase tracking-wider w-20">View</span>
									<div className="h-4 w-px bg-gray-600/50"></div>
									<div className="flex items-center gap-2 flex-wrap">
										{/* View Disbursement - Show if applicationId exists */}
										{selectedLoan.applicationId && (
											<Link
												href={`/dashboard/disbursements?search=${selectedLoan.applicationId}`}
												className="flex items-center px-3 py-1.5 bg-teal-500/20 text-teal-200 rounded-lg border border-teal-400/20 hover:bg-teal-500/30 transition-colors text-xs"
												title="View disbursement details"
											>
												<BanknotesIcon className="h-3 w-3 mr-1" />
												Disbursement
											</Link>
										)}
										{/* View Related Payments - Show if there are repayments */}
										{selectedLoan.repayments && selectedLoan.repayments.length > 0 && (
											<Link
												href={`/dashboard/payments?search=${selectedLoan.id}&status=all`}
												className="flex items-center px-3 py-1.5 bg-teal-500/20 text-teal-200 rounded-lg border border-teal-400/20 hover:bg-teal-500/30 transition-colors text-xs"
												title="View related payments"
											>
												<CreditCardIcon className="h-3 w-3 mr-1" />
												Payments
											</Link>
										)}
									</div>
								</div>

								{/* Row 2: Download Actions */}
								<div className="flex items-center gap-3">
									<span className="text-xs font-medium text-gray-400 uppercase tracking-wider w-20">Downloads</span>
									<div className="h-4 w-px bg-gray-600/50"></div>
									<div className="flex items-center gap-2 flex-wrap">
										<button
											onClick={() => downloadIndividualLoanCSV(selectedLoan)}
											disabled={refreshing}
											className="flex items-center px-3 py-1.5 bg-emerald-500/20 text-emerald-200 rounded-lg border border-emerald-400/20 hover:bg-emerald-500/30 transition-colors text-xs"
											title="Download loan audit trail as CSV"
										>
											{refreshing ? (
												<ArrowPathIcon className="h-3 w-3 mr-1 animate-spin" />
											) : (
												<DocumentArrowDownIcon className="h-3 w-3 mr-1" />
											)}
											Audit Trail (CSV)
										</button>
										{/* Lampiran A - Compliance Document */}
										<button
											onClick={() => downloadLampiranA(selectedLoan.id)}
											className="flex items-center px-3 py-1.5 bg-indigo-500/20 text-indigo-200 rounded-lg border border-indigo-400/20 hover:bg-indigo-500/30 transition-colors text-xs"
											title="Download Lampiran A (Borrower Account Ledger) - Compliance document under Moneylenders Act 1951"
										>
											<ClipboardDocumentCheckIcon className="h-3 w-3 mr-1" />
											Lampiran A (PDF)
										</button>
									</div>
								</div>

								{/* Row 3: Actions */}
								{(selectedLoan.status === "ACTIVE" || selectedLoan.status === "PENDING_DISCHARGE") && (
									<div className="flex items-center gap-3">
										<span className="text-xs font-medium text-gray-400 uppercase tracking-wider w-20">Actions</span>
										<div className="h-4 w-px bg-gray-600/50"></div>
										<div className="flex items-center gap-2 flex-wrap">
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
											{/* Request Discharge - Show for ACTIVE loans with zero balance */}
											{selectedLoan.status === "ACTIVE" && selectedLoan.outstandingBalance === 0 && (
												<button
													onClick={() => handleDischargeRequest("request")}
													className="flex items-center px-3 py-1.5 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors text-xs"
													title="Request loan discharge"
												>
													<CheckCircleIcon className="h-3 w-3 mr-1" />
													Request Discharge
												</button>
											)}
											{/* Discharge Actions - Show for PENDING_DISCHARGE status */}
											{selectedLoan.status === "PENDING_DISCHARGE" && (
												<>
													<button
														onClick={() => handleDischargeRequest("approve")}
														className="flex items-center px-3 py-1.5 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors text-xs"
														title="Approve loan discharge"
													>
														<CheckCircleIcon className="h-3 w-3 mr-1" />
														Approve Discharge
													</button>
													<button
														onClick={() => handleDischargeRequest("reject")}
														className="flex items-center px-3 py-1.5 bg-red-500/20 text-red-200 rounded-lg border border-red-400/20 hover:bg-red-500/30 transition-colors text-xs"
														title="Reject loan discharge"
													>
														<XMarkIcon className="h-3 w-3 mr-1" />
														Reject Discharge
													</button>
												</>
											)}
										</div>
									</div>
								)}
							</div>

							<div className="p-6">
								{/* Tab Navigation */}
								<div className="flex border-b border-gray-700/30 mb-6">
									<div
										className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
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
										className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
											selectedTab === "repayments"
												? "border-b-2 border-blue-400 font-medium text-white"
												: "text-gray-400 hover:text-gray-200"
										}`}
										onClick={() =>
											setSelectedTab("repayments")
										}
									>
										<ArrowsRightLeftIcon className="h-4 w-4 mr-1.5" />
										Repayments
									</div>
									<div
										className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
											selectedTab === "audit"
												? "border-b-2 border-blue-400 font-medium text-white"
												: "text-gray-400 hover:text-gray-200"
										}`}
										onClick={() => setSelectedTab("audit")}
									>
										<DocumentTextIcon className="h-4 w-4 mr-1.5" />
										Audit Trail
									</div>
									<div
										className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
											selectedTab === "signatures"
												? "border-b-2 border-blue-400 font-medium text-white"
												: "text-gray-400 hover:text-gray-200"
										}`}
										onClick={() => setSelectedTab("signatures")}
									>
										<PencilIcon className="h-4 w-4 mr-1.5" />
										Signatures
									</div>
									<div
										className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
											selectedTab === "documents"
												? "border-b-2 border-blue-400 font-medium text-white"
												: "text-gray-400 hover:text-gray-200"
										}`}
										onClick={() => setSelectedTab("documents")}
									>
										<FolderIcon className="h-4 w-4 mr-1.5" />
										Documents
									</div>
									{/* Credit Report tab - ADMIN only */}
									{userRole === "ADMIN" && (
										<div
											className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
												selectedTab === "credit-report"
													? "border-b-2 border-blue-400 font-medium text-white"
													: "text-gray-400 hover:text-gray-200"
											}`}
											onClick={() => setSelectedTab("credit-report")}
										>
											<DocumentCheckIcon className="h-4 w-4 mr-1.5" />
											Credit Report
										</div>
									)}
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
													className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
														selectedTab === "pdf-letters"
															? "border-b-2 border-blue-400 font-medium text-white"
															: "text-gray-400 hover:text-gray-200"
													}`}
													onClick={() => setSelectedTab("pdf-letters")}
												>
													<DocumentArrowDownIcon className="h-4 w-4 mr-1.5" />
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
														// Check statuses in priority order
														const isPendingSettlement = selectedLoan.status === "PENDING_EARLY_SETTLEMENT" || 
																				   selectedLoan.status === "PENDING_DISCHARGE" ||
																				   selectedLoan.status === "DISCHARGED";
														if (isPendingSettlement) {
															const textColor = selectedLoan.status === "DISCHARGED" ? "text-green-300" : "text-purple-300";
															return (
																<span className={`${textColor} text-center`}>
																	{formatCurrency(0)}
																	<span className="text-xs text-gray-400 mt-1 font-normal block text-center">
																		{selectedLoan.status === "DISCHARGED" ? "Discharged" : "Early Settlement"}
																	</span>
																</span>
															);
														}
														
														// Check for defaulted
														const isDefaulted = selectedLoan.status === "DEFAULT" || selectedLoan.defaultedAt;
														if (isDefaulted) {
															return (
																<span className="text-red-300 text-center">
																	{formatCurrency(selectedLoan.outstandingBalance)}
																	<span className="text-xs text-red-400 mt-1 font-normal block text-center">
																		Defaulted
																	</span>
																</span>
															);
														}
														
														// Check for default risk
														const isDefaultRisk = selectedLoan.defaultRiskFlaggedAt && !selectedLoan.defaultedAt;
														if (isDefaultRisk) {
															return (
																<span className="text-rose-300 text-center">
																	{formatCurrency(selectedLoan.outstandingBalance)}
																	<span className="text-xs text-rose-400 mt-1 font-normal block text-center">
																		Default Risk
																	</span>
																</span>
															);
														}
														
														// Check for late payment
														const daysLate = getDaysLate(selectedLoan);
														if (daysLate > 0) {
															// Use color gradient based on days late
															let textColor = "text-yellow-300";
															if (daysLate > 30) textColor = "text-red-300";
															else if (daysLate > 15) textColor = "text-orange-300";
															
															return (
																<span className={`${textColor} text-center`}>
																	{formatCurrency(selectedLoan.outstandingBalance)}
																	<span className={`text-xs ${textColor} mt-1 font-normal block text-center`}>
																		{daysLate} days late
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
														// Calculate from repayments (primary method)
														// Include both COMPLETED and PARTIAL since actualAmount reflects actual payments
														const calculatedFromRepayments = repayments.reduce((total, repayment) => {
															if (repayment.status !== "COMPLETED" && repayment.status !== "PARTIAL") return total;
															return total + (repayment.actualAmount || 0);
														}, 0);
														// Use calculated value, or fall back to backend-provided totalPaid if calculation returns 0
														const totalPaid = calculatedFromRepayments > 0 
															? calculatedFromRepayments 
															: (selectedLoan.totalPaid || 0);
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
														const statusColor = selectedLoan.status === "DISCHARGED" ? "text-green-300" : "text-purple-300";
														return (
															<>
																<p className="text-gray-400 text-sm mb-1">
																	Payment Status
																</p>
																<p className={`text-2xl font-bold ${statusColor}`}>
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
													
													// Check if loan has overdue payments (late, default risk, defaulted)
													const hasOverduePayments = selectedLoan.overdueInfo?.hasOverduePayments;
													const isDefaulted = selectedLoan.status === "DEFAULT" || selectedLoan.defaultedAt;
													const isDefaultRisk = selectedLoan.defaultRiskFlaggedAt && !selectedLoan.defaultedAt;
													const daysLate = getDaysLate(selectedLoan);
													const isLate = daysLate > 0;
													
													if (hasOverduePayments || isDefaulted || isDefaultRisk || isLate) {
														// Calculate total amount to clear late status
														const overdueAmount = selectedLoan.overdueInfo?.totalOverdueAmount || 0;
														const overdueLateFees = selectedLoan.overdueInfo?.totalLateFees || 0;
														const totalToClear = overdueAmount + overdueLateFees;
														const overdueCount = selectedLoan.overdueInfo?.overdueRepayments?.length || 0;
														
														// Determine color based on status
														let statusColor = "text-yellow-300";
														let statusLabel = "Late Payment";
														if (isDefaulted) {
															statusColor = "text-red-300";
															statusLabel = "Defaulted";
														} else if (isDefaultRisk) {
															statusColor = "text-rose-300";
															statusLabel = "Default Risk";
														} else if (daysLate > 30) {
															statusColor = "text-red-300";
															statusLabel = `${daysLate} Days Late`;
														} else if (daysLate > 15) {
															statusColor = "text-orange-300";
															statusLabel = `${daysLate} Days Late`;
														} else if (daysLate > 0) {
															statusColor = "text-yellow-300";
															statusLabel = `${daysLate} Days Late`;
														}
														
														return (
															<>
																<p className="text-gray-400 text-sm mb-1">
																	Amount to Clear
																</p>
																<p className={`text-2xl font-bold ${statusColor}`}>
																	{formatCurrency(totalToClear)}
																</p>
																<p className="text-xs text-gray-400 mt-1">
																	{overdueCount > 1 ? `${overdueCount} overdue payments` : "1 overdue payment"}
																	{overdueLateFees > 0 && (
																		<span className="block text-red-400">
																			incl. {formatCurrency(overdueLateFees)} late fees
																		</span>
																	)}
																</p>
																<p className={`text-xs ${statusColor} mt-1 font-medium`}>
																	{statusLabel}
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
													
													// Find early settlement repayment if exists
													const earlySettlementRepayment = repayments.find(
														(r) => r.paymentType === "EARLY_SETTLEMENT" && r.status === "COMPLETED"
													);
													const earlySettlementDate = earlySettlementRepayment 
														? new Date(earlySettlementRepayment.actualPaymentDate || earlySettlementRepayment.paidAt || earlySettlementRepayment.createdAt)
														: null;
													
													// Get all scheduled repayments (excluding early settlement type)
													const scheduledRepayments = repayments.filter(
														(r) => r.paymentType !== "EARLY_SETTLEMENT"
													);
													
													// For early settlement loans, consider repayments that were due before settlement
													// Completed payments
													const completedRepayments = scheduledRepayments.filter(
														(r) => r.status === "COMPLETED"
													);
													
													// Cancelled repayments - split into overdue (missed) vs cleared early via settlement
													const cancelledRepayments = scheduledRepayments.filter((r) => r.status === "CANCELLED");
													
													// Cancelled repayments that were overdue at time of early settlement (missed)
													const cancelledOverdueRepayments = cancelledRepayments.filter((r) => {
														if (!earlySettlementDate) return false;
														const dueDate = new Date(r.dueDate);
														// Was due before early settlement date (was overdue/missed)
														return dueDate < earlySettlementDate;
													});
													
													// Cancelled repayments that were NOT yet due at time of early settlement (cleared early)
													const cancelledSettledEarlyRepayments = cancelledRepayments.filter((r) => {
														if (!earlySettlementDate) return false;
														const dueDate = new Date(r.dueDate);
														// Was due on or after early settlement date (cleared early via settlement)
														return dueDate >= earlySettlementDate;
													});
													
													// Total repayments to consider = completed + all cancelled
													const totalRepaymentsToConsider = completedRepayments.length + cancelledRepayments.length;

													if (totalRepaymentsToConsider === 0) {
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
																	due yet
																</p>
															</>
														);
													}

													// On-time payments from completed repayments
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
													
													// Late payments from completed repayments
													const latePayments = completedRepayments.filter((r) => {
														const paymentDate = new Date(
															r.actualPaymentDate || r.paidAt || r.createdAt
														);
														const dueDate = new Date(r.dueDate);
														return paymentDate > dueDate;
													});
													
													// Missed payments = cancelled overdue
													const missedPayments = cancelledOverdueRepayments.length;
													
													// Settled early = cancelled but not yet due (count as on-time)
													const settledEarlyPayments = cancelledSettledEarlyRepayments.length;
													
													// On-time includes both actual on-time payments AND those cleared early via settlement
													const totalOnTime = onTimeOrEarlyPayments.length + settledEarlyPayments;

													const percentage =
														Math.round(
															(totalOnTime /
																totalRepaymentsToConsider) *
																100
														);
													
													// Determine color based on performance
													let performanceColor = "text-green-400";
													if (percentage < 50) {
														performanceColor = "text-red-400";
													} else if (percentage < 75) {
														performanceColor = "text-orange-400";
													} else if (percentage < 100) {
														performanceColor = "text-yellow-400";
													}

													return (
														<>
															<p className="text-gray-400 text-sm mb-1">
																Payment
																Performance
															</p>
															<p className={`text-2xl font-bold ${performanceColor}`}>
																{percentage}%
															</p>
															<p className="text-xs text-gray-400 mt-1">
																{onTimeOrEarlyPayments.length} on-time
																{settledEarlyPayments > 0 && (
																	<span className="text-purple-400"> / {settledEarlyPayments} settled early</span>
																)}
																{latePayments.length > 0 && (
																	<span className="text-yellow-400"> / {latePayments.length} late</span>
																)}
																{missedPayments > 0 && (
																	<span className="text-red-400"> / {missedPayments} missed</span>
																)}
															</p>
															<p className="text-xs text-gray-500 mt-0.5">
																of {totalRepaymentsToConsider} scheduled
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

										{/* Loan Status Alert - Discharged / Defaulted / Default Risk */}
										{(() => {
											const isDefaulted = selectedLoan.status === "DEFAULT" || selectedLoan.defaultedAt;
											const isDefaultRisk = selectedLoan.defaultRiskFlaggedAt && !selectedLoan.defaultedAt;
											const isDischarged = selectedLoan.status === "DISCHARGED";
											
											if (isDischarged) {
												const dischargedStatus = getLoanStatusColor("DISCHARGED");
												return (
													<div
														className={`p-4 rounded-lg mb-6 border ${dischargedStatus.bg} ${dischargedStatus.border}`}
													>
														<div className="flex items-start">
															<CheckCircleIcon className="h-5 w-5 mr-2 mt-0.5 text-green-200" />
															<div>
																<p className={`font-medium ${dischargedStatus.text}`}>
																	Loan Discharged
																</p>
																<p className="text-sm text-gray-300 mt-1">
																	This loan has been fully settled and discharged
																	{selectedLoan.dischargedAt ? (
																		<span> on {formatDate(selectedLoan.dischargedAt)}</span>
																	) : selectedLoan.updatedAt && (
																		<span> on {formatDate(selectedLoan.updatedAt)}</span>
																	)}
																</p>
																<p className="text-xs text-green-300 mt-1">
																	Total loan amount: {formatCurrency(selectedLoan.totalAmount || selectedLoan.principalAmount)}
																</p>
															</div>
														</div>
													</div>
												);
											}
											
											if (isDefaulted) {
												const defaultedStatus = getLoanStatusColor("DEFAULT");
												return (
													<div
														className={`p-4 rounded-lg mb-6 border ${defaultedStatus.bg} ${defaultedStatus.border}`}
													>
														<div className="flex items-start">
															<ExclamationTriangleIcon className="h-5 w-5 mr-2 mt-0.5 text-red-200" />
															<div>
																<p className={`font-medium ${defaultedStatus.text}`}>
																	Loan Defaulted
																</p>
																<p className="text-sm text-gray-300 mt-1">
																	This loan has been marked as defaulted
																	{selectedLoan.defaultedAt && (
																		<span> on {formatDate(selectedLoan.defaultedAt)}</span>
																	)}
																</p>
																<p className="text-xs text-red-300 mt-1">
																	Outstanding balance: {formatCurrency(selectedLoan.outstandingBalance)}
																</p>
															</div>
														</div>
													</div>
												);
											}
											
											if (isDefaultRisk) {
												const defaultRiskStatus = getLoanStatusColor("DEFAULT_RISK");
												return (
													<div
														className={`p-4 rounded-lg mb-6 border ${defaultRiskStatus.bg} ${defaultRiskStatus.border}`}
													>
														<div className="flex items-start">
															<ExclamationTriangleIcon className="h-5 w-5 mr-2 mt-0.5 text-rose-200" />
															<div>
																<p className={`font-medium ${defaultRiskStatus.text}`}>
																	Default Risk
																</p>
																<p className="text-sm text-gray-300 mt-1">
																	This loan has been flagged for potential default
																	{selectedLoan.defaultRiskFlaggedAt && (
																		<span> on {formatDate(selectedLoan.defaultRiskFlaggedAt)}</span>
																	)}
																</p>
																<p className="text-xs text-rose-300 mt-1">
																	Outstanding balance: {formatCurrency(selectedLoan.outstandingBalance)}
																</p>
															</div>
														</div>
													</div>
												);
											}
											
											return null;
										})()}

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
														<p>Total Paid</p>
														<p className="text-white font-medium">
															{formatCurrency(
																(() => {
																	// Calculate total paid using actualAmount (the actual amount paid)
																	// Include both COMPLETED and PARTIAL since actualAmount reflects actual payments
																	const calculatedFromRepayments = selectedLoan.repayments?.reduce((total, repayment) => {
																		if (repayment.status !== "COMPLETED" && repayment.status !== "PARTIAL") return total;
																		return total + (repayment.actualAmount || 0);
																	}, 0) || 0;
																	// Use calculated value, or fall back to backend-provided totalPaid
																	return calculatedFromRepayments > 0 
																		? calculatedFromRepayments 
																		: (selectedLoan.totalPaid || 0);
																})()
															)}
														</p>
													</div>
													<div className="text-right">
														<p>Outstanding (incl. late fees)</p>
														<p className="text-white font-medium">
															{(() => {
																const isPendingSettlement = selectedLoan.status === "PENDING_EARLY_SETTLEMENT" || 
																						   selectedLoan.status === "PENDING_DISCHARGE" ||
																						   selectedLoan.status === "DISCHARGED";
																if (isPendingSettlement) {
																	const textColor = selectedLoan.status === "DISCHARGED" ? "text-green-300" : "text-purple-300";
																	const statusText = selectedLoan.status === "DISCHARGED" ? "discharged" : "settling";
																	return (
																		<span className={textColor}>
																			{formatCurrency(0)} 
																			<span className="text-xs text-gray-400 block">({statusText})</span>
																		</span>
																	);
																}
																
																// Calculate outstanding including unpaid late fees
																const unpaidLateFees = selectedLoan.repayments?.reduce((total, repayment) => {
																	const assessed = repayment.lateFeeAmount || 0;
																	const paid = repayment.lateFeesPaid || 0;
																	return total + Math.max(0, assessed - paid);
																}, 0) || 0;
																const totalOutstanding = selectedLoan.outstandingBalance + unpaidLateFees;
																
																// Check for defaulted
																const isDefaulted = selectedLoan.status === "DEFAULT" || selectedLoan.defaultedAt;
																if (isDefaulted) {
																	return (
																		<span className="text-red-300">
																			{formatCurrency(totalOutstanding)}
																			{unpaidLateFees > 0 && (
																				<span className="text-xs text-red-400 block">
																					(incl. {formatCurrency(unpaidLateFees)} fees)
																				</span>
																			)}
																		</span>
																	);
																}
																
																// Check for default risk
																const isDefaultRisk = selectedLoan.defaultRiskFlaggedAt && !selectedLoan.defaultedAt;
																if (isDefaultRisk) {
																	return (
																		<span className="text-rose-300">
																			{formatCurrency(totalOutstanding)}
																			{unpaidLateFees > 0 && (
																				<span className="text-xs text-rose-400 block">
																					(incl. {formatCurrency(unpaidLateFees)} fees)
																				</span>
																			)}
																		</span>
																	);
																}
																
																// Check for late (has unpaid late fees or overdue)
																if (unpaidLateFees > 0) {
																	const daysLate = getDaysLate(selectedLoan);
																	let textColor = "text-yellow-300";
																	let subTextColor = "text-yellow-400";
																	if (daysLate > 30) {
																		textColor = "text-red-300";
																		subTextColor = "text-red-400";
																	} else if (daysLate > 15) {
																		textColor = "text-orange-300";
																		subTextColor = "text-orange-400";
																	}
																	return (
																		<span className={textColor}>
																			{formatCurrency(totalOutstanding)}
																			<span className={`text-xs ${subTextColor} block`}>
																				(incl. {formatCurrency(unpaidLateFees)} late fees)
																			</span>
																		</span>
																	);
																}
																return formatCurrency(selectedLoan.outstandingBalance);
															})()}
														</p>
													</div>
												</div>
												
												{/* Early Settlement / Payment Breakdown */}
												{(() => {
													const isPendingSettlement = selectedLoan.status === "PENDING_EARLY_SETTLEMENT" || 
																			   selectedLoan.status === "PENDING_DISCHARGE" ||
																			   selectedLoan.status === "DISCHARGED";
													
													if (!isPendingSettlement) return null;
													
													// Calculate payments breakdown
													const regularPayments = selectedLoan.repayments?.filter(r => 
														r.status === "COMPLETED" && r.paymentType !== "EARLY_SETTLEMENT"
													) || [];
													const earlySettlementPayment = selectedLoan.repayments?.find(r => 
														r.paymentType === "EARLY_SETTLEMENT" && r.status === "COMPLETED"
													);
													
													// Total paid before early settlement (regular installments)
													const paidBeforeSettlement = regularPayments.reduce((total, repayment) => {
														return total + (repayment.actualAmount || repayment.amount || 0);
													}, 0);
													
													// Late fees paid (from all completed/partial repayments)
													const totalLateFeesPaid = selectedLoan.repayments?.reduce((total, repayment) => {
														if (repayment.status !== "COMPLETED" && repayment.status !== "PARTIAL") return total;
														return total + (repayment.lateFeesPaid || 0);
													}, 0) || 0;
													
													// Early settlement payment amount
													const earlySettlementPaid = earlySettlementPayment?.actualAmount || earlySettlementPayment?.amount || 0;
													
													// Get discount info if available
													const discountAmount = selectedLoan.earlySettlementInfo?.discountAmount || selectedLoan.earlySettlementDiscount || 0;
													const feeAmount = selectedLoan.earlySettlementInfo?.feeAmount || 0;
													
													// Grand total paid
													const grandTotalPaid = paidBeforeSettlement + earlySettlementPaid;
													
													return (
														<div className="mt-4 pt-4 border-t border-gray-700/30">
															<p className="text-gray-400 text-sm mb-3">Payment Breakdown</p>
															<div className="space-y-2 text-sm">
																{/* Regular payments before settlement */}
																{paidBeforeSettlement > 0 && (
																	<div>
																		<div className="flex justify-between">
																			<span className="text-gray-400">
																				Regular Installments ({regularPayments.length} payments)
																			</span>
																			<span className="text-white font-medium">
																				{formatCurrency(paidBeforeSettlement)}
																			</span>
																		</div>
																		{/* Late fees included info */}
																		{totalLateFeesPaid > 0 && (
																			<div className="flex justify-between text-xs mt-0.5">
																				<span className="text-gray-500 pl-2">
																					↳ incl. {formatCurrency(totalLateFeesPaid)} late fees
																				</span>
																			</div>
																		)}
																	</div>
																)}
																
																{/* Early settlement payment */}
																{earlySettlementPaid > 0 && (
																	<div className="flex justify-between">
																		<span className="text-gray-400">Early Settlement Payment</span>
																		<span className="text-green-300 font-medium">
																			{formatCurrency(earlySettlementPaid)}
																		</span>
																	</div>
																)}
																
																{/* Divider and total */}
																<div className="border-t border-gray-600/50 pt-2 mt-2">
																	<div className="flex justify-between">
																		<span className="text-white font-medium">Total Paid</span>
																		<span className="text-green-300 font-bold">
																			{formatCurrency(grandTotalPaid)}
																		</span>
																	</div>
																</div>
																
																{/* Savings info (separate from total - these are savings, not payments) */}
																{(discountAmount > 0 || feeAmount > 0) && (
																	<div className="border-t border-gray-600/50 pt-2 mt-2">
																		<p className="text-gray-500 text-xs mb-1">Early Settlement Details</p>
																		{discountAmount > 0 && (
																			<div className="flex justify-between text-xs">
																				<span className="text-gray-400">Interest Saved</span>
																				<span className="text-green-400">
																					{formatCurrency(discountAmount)}
																				</span>
																			</div>
																		)}
																		{feeAmount > 0 && (
																			<div className="flex justify-between text-xs">
																				<span className="text-gray-400">Settlement Fee</span>
																				<span className="text-yellow-300">
																					{formatCurrency(feeAmount)}
																				</span>
																			</div>
																		)}
																		{discountAmount > 0 && feeAmount > 0 && (
																			<div className="flex justify-between text-xs mt-1">
																				<span className="text-gray-400">Net Savings</span>
																				<span className={discountAmount - feeAmount > 0 ? "text-green-400" : "text-red-400"}>
																					{formatCurrency(discountAmount - feeAmount)}
																				</span>
																			</div>
																		)}
																	</div>
																)}
															</div>
														</div>
													);
												})()}
											</div>
										</div>

										{/* Loan Details */}
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
											{/* Customer Information - Enhanced */}
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
												
												{/* Basic Info */}
												<div className="space-y-2 text-sm mb-4">
													<div className="flex justify-between">
														<span className="text-gray-400">Full Name</span>
														<span className="text-white font-medium">
															{selectedLoan.user.fullName}
														</span>
													</div>
													<div className="flex justify-between">
														<span className="text-gray-400">IC Number</span>
														<span className="text-white">
															{selectedLoan.user.icNumber || selectedLoan.user.idNumber || "N/A"}
														</span>
													</div>
													<div className="flex justify-between">
														<span className="text-gray-400">Email</span>
														<span className="text-white">
															{selectedLoan.user.email}
														</span>
													</div>
													<div className="flex justify-between">
														<span className="text-gray-400">Phone</span>
														<span className="text-white">
															{selectedLoan.user.phoneNumber || "N/A"}
														</span>
													</div>
													{selectedLoan.user.nationality && (
														<div className="flex justify-between">
															<span className="text-gray-400">Nationality</span>
															<span className="text-white">
																{selectedLoan.user.nationality}
															</span>
														</div>
													)}
													{selectedLoan.user.race && (
														<div className="flex justify-between">
															<span className="text-gray-400">Race</span>
															<span className="text-white">
																{selectedLoan.user.race}
															</span>
														</div>
													)}
													{selectedLoan.user.gender && (
														<div className="flex justify-between">
															<span className="text-gray-400">Gender</span>
															<span className="text-white">
																{selectedLoan.user.gender}
															</span>
														</div>
													)}
												</div>

												{/* Employment Section */}
												{(selectedLoan.user.employmentStatus || selectedLoan.user.employerName || selectedLoan.user.monthlyIncome || selectedLoan.user.occupation || selectedLoan.user.educationLevel) && (
													<div className="border-t border-gray-600/50 pt-3 mb-4">
														<p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Employment</p>
														<div className="space-y-2 text-sm">
															{selectedLoan.user.employmentStatus && (
																<div className="flex justify-between">
																	<span className="text-gray-400">Status</span>
																	<span className="text-white">
																		{selectedLoan.user.employmentStatus}
																	</span>
																</div>
															)}
															{selectedLoan.user.occupation && (
																<div className="flex justify-between">
																	<span className="text-gray-400">Occupation</span>
																	<span className="text-white">
																		{selectedLoan.user.occupation}
																	</span>
																</div>
															)}
															{selectedLoan.user.employerName && (
																<div className="flex justify-between">
																	<span className="text-gray-400">Employer</span>
																	<span className="text-white">
																		{selectedLoan.user.employerName}
																	</span>
																</div>
															)}
															{selectedLoan.user.serviceLength && (
																<div className="flex justify-between">
																	<span className="text-gray-400">Length of Service</span>
																	<span className="text-white">
																		{selectedLoan.user.serviceLength} years
																	</span>
																</div>
															)}
															{selectedLoan.user.monthlyIncome && (
																<div className="flex justify-between">
																	<span className="text-gray-400">Monthly Income</span>
																	<span className="text-emerald-400 font-medium">
																		{formatCurrency(parseFloat(selectedLoan.user.monthlyIncome))}
																	</span>
																</div>
															)}
															{selectedLoan.user.educationLevel && (
																<div className="flex justify-between">
																	<span className="text-gray-400">Education Level</span>
																	<span className="text-white">
																		{selectedLoan.user.educationLevel}
																	</span>
																</div>
															)}
														</div>
													</div>
												)}

												{/* Address Section */}
												{(selectedLoan.user.address1 || selectedLoan.user.city) && (
													<div className="border-t border-gray-600/50 pt-3 mb-4">
														<p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Address</p>
														<div className="text-sm text-white">
															{selectedLoan.user.address1 && (
																<p>{selectedLoan.user.address1}</p>
															)}
															{selectedLoan.user.address2 && (
																<p>{selectedLoan.user.address2}</p>
															)}
															{(selectedLoan.user.city || selectedLoan.user.state || selectedLoan.user.zipCode) && (
																<p>
																	{[
																		selectedLoan.user.city,
																		selectedLoan.user.state,
																		selectedLoan.user.zipCode
																	].filter(Boolean).join(', ')}
																</p>
															)}
															{selectedLoan.user.country && (
																<p>{selectedLoan.user.country}</p>
															)}
														</div>
													</div>
												)}

												{/* Bank Details */}
												{(selectedLoan.user.bankName || selectedLoan.user.accountNumber) && (
													<div className="border-t border-gray-600/50 pt-3 mb-4">
														<p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Bank Details</p>
														<div className="space-y-2 text-sm">
															{selectedLoan.user.bankName && (
																<div className="flex justify-between">
																	<span className="text-gray-400">Bank</span>
																	<span className="text-white">
																		{selectedLoan.user.bankName}
																	</span>
																</div>
															)}
															{selectedLoan.user.accountNumber && (
																<div className="flex justify-between items-center">
																	<span className="text-gray-400">Account No.</span>
																	<div className="flex items-center gap-2">
																		<span className="text-white font-mono">
																			{selectedLoan.user.accountNumber}
																		</span>
																		<button
																			onClick={() => {
																				navigator.clipboard.writeText(selectedLoan.user.accountNumber || '');
																				toast.success("Account number copied to clipboard");
																			}}
																			className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-400/20 hover:bg-blue-500/30"
																			title="Copy"
																		>
																			Copy
																		</button>
																	</div>
																</div>
															)}
														</div>
													</div>
												)}

												{/* Emergency Contact */}
												{(selectedLoan.user.emergencyContactName || selectedLoan.user.emergencyContactPhone) && (
													<div className="border-t border-gray-600/50 pt-3">
														<p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Emergency Contact</p>
														<div className="space-y-2 text-sm">
															{selectedLoan.user.emergencyContactName && (
																<div className="flex justify-between">
																	<span className="text-gray-400">Name</span>
																	<span className="text-white">
																		{selectedLoan.user.emergencyContactName}
																	</span>
																</div>
															)}
															{selectedLoan.user.emergencyContactRelationship && (
																<div className="flex justify-between">
																	<span className="text-gray-400">Relationship</span>
																	<span className="text-white">
																		{selectedLoan.user.emergencyContactRelationship}
																	</span>
																</div>
															)}
															{selectedLoan.user.emergencyContactPhone && (
																<div className="flex justify-between">
																	<span className="text-gray-400">Phone</span>
																	<span className="text-white">
																		{selectedLoan.user.emergencyContactPhone}
																	</span>
																</div>
															)}
														</div>
													</div>
												)}
											</div>

											{/* Calculation Method */}
											<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
												<h4 className="text-white font-medium mb-3 flex items-center">
													<DocumentTextIcon className="h-5 w-5 mr-2 text-green-400" />
													Calculation Method
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

											{/* Loan Terms - Full width */}
											<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 md:col-span-2">
												<h4 className="text-white font-medium mb-4 flex items-center">
													<BanknotesIcon className="h-5 w-5 mr-2 text-emerald-400" />
													Loan Terms
												</h4>
												
												<div className="space-y-4">
													{/* Loan Terms Row */}
													<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
														<div className="flex justify-between md:flex-col md:justify-start">
															<span className="text-gray-400">Loan Amount</span>
															<span className="text-white font-medium md:mt-1">
																{selectedLoan.application?.amount
																	? formatCurrency(selectedLoan.application.amount)
																	: formatCurrency(selectedLoan.principalAmount)}
															</span>
														</div>
														<div className="flex justify-between md:flex-col md:justify-start">
															<span className="text-gray-400">Loan Term</span>
															<span className="text-white font-medium md:mt-1">
																{selectedLoan.term} months
															</span>
														</div>
														<div className="flex justify-between md:flex-col md:justify-start">
															<span className="text-gray-400">Interest Rate</span>
															<span className="text-white font-medium md:mt-1">
																{selectedLoan.interestRate}% p.a.
															</span>
														</div>
														<div className="flex justify-between md:flex-col md:justify-start">
															<span className="text-gray-400">Monthly Repayment</span>
															<span className="text-purple-400 font-semibold md:mt-1">
																{formatCurrency(selectedLoan.monthlyPayment)}
															</span>
														</div>
													</div>

													{/* Fees Breakdown */}
													<div className="border-t border-gray-600/50 pt-4">
														<p className="text-sm font-medium text-gray-300 mb-3">Fees Deducted at Disbursement</p>
														<div className="space-y-2 text-sm">
															<div className="flex justify-between items-center">
																<span className="text-gray-400">Legal Fee</span>
																<span className="text-red-400">
																	- {selectedLoan.application?.legalFeeFixed !== undefined && selectedLoan.application?.legalFeeFixed !== null && selectedLoan.application?.legalFeeFixed > 0
																		? formatCurrency(selectedLoan.application.legalFeeFixed)
																		: "RM 0.00"}
																</span>
															</div>
															<div className="flex justify-between items-center">
																<span className="text-gray-400">Stamping Fee</span>
																<span className="text-red-400">
																	- {selectedLoan.application?.stampingFee !== undefined && selectedLoan.application?.stampingFee !== null && selectedLoan.application?.stampingFee > 0
																		? formatCurrency(selectedLoan.application.stampingFee)
																		: "RM 0.00"}
																</span>
															</div>
															<div className="flex justify-between items-center pt-2 border-t border-gray-600/30">
																<span className="text-gray-300 font-medium">Total Fees</span>
																<span className="text-red-400 font-medium">
																	- {formatCurrency(
																		(selectedLoan.application?.legalFeeFixed || 0) + 
																		(selectedLoan.application?.stampingFee || 0)
																	)}
																</span>
															</div>
														</div>
													</div>

													{/* Net Disbursement - Highlighted */}
													<div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/30">
														<div className="flex justify-between items-center">
															<div>
																<p className="text-emerald-400 font-medium">Net Disbursement</p>
																<p className="text-xs text-gray-400 mt-0.5">Amount credited to borrower's account</p>
															</div>
															<span className="text-emerald-400 text-xl font-semibold">
																{selectedLoan.application?.netDisbursement
																	? formatCurrency(selectedLoan.application.netDisbursement)
																	: formatCurrency(
																		(selectedLoan.application?.amount || selectedLoan.principalAmount) - 
																		(selectedLoan.application?.legalFeeFixed || 0) - 
																		(selectedLoan.application?.stampingFee || 0)
																	)}
															</span>
														</div>
													</div>

													{/* Late Payment Fees from Product */}
													{selectedLoan.application?.product && (
														<div className="border-t border-gray-600/50 pt-4">
															<p className="text-sm font-medium text-gray-300 mb-3">Late Payment Fees</p>
															<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
																<div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
																	<span className="text-gray-400 block text-xs mb-1">Late Fee Rate</span>
																	<span className="text-amber-400 font-medium">
																		{selectedLoan.application.product.lateFeeRate !== undefined && selectedLoan.application.product.lateFeeRate !== null
																			? `${selectedLoan.application.product.lateFeeRate}%`
																			: "8%"} <span className="text-xs text-gray-400">per annum</span>
																	</span>
																</div>
																<div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
																	<span className="text-gray-400 block text-xs mb-1">Fixed Late Fee</span>
																	<span className="text-amber-400 font-medium">
																		{selectedLoan.application.product.lateFeeFixedAmount !== undefined && selectedLoan.application.product.lateFeeFixedAmount !== null
																			? formatCurrency(selectedLoan.application.product.lateFeeFixedAmount)
																			: "RM 0.00"}
																	</span>
																	{selectedLoan.application.product.lateFeeFrequencyDays !== undefined && selectedLoan.application.product.lateFeeFrequencyDays !== null && selectedLoan.application.product.lateFeeFrequencyDays > 0 && (
																		<span className="text-xs text-gray-400 block mt-1">every {selectedLoan.application.product.lateFeeFrequencyDays} days</span>
																	)}
																</div>
																<div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
																	<span className="text-gray-400 block text-xs mb-1">Grace Period</span>
																	<span className="text-amber-400 font-medium">
																		{lateFeeGraceDays} days
																	</span>
																	<span className="text-xs text-gray-400 block mt-1">before fee applies</span>
																	<span className="text-xs text-blue-400 block mt-0.5">(system-wide)</span>
																</div>
															</div>
														</div>
													)}
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

									</>
								)}

								{/* Repayments Tab */}
								{selectedTab === "repayments" && (
									<div>
										{/* Early Settlement / Discharged Banner */}
										{(() => {
											const isSettled = selectedLoan.status === "DISCHARGED" || 
															  selectedLoan.status === "PENDING_DISCHARGE" || 
															  selectedLoan.status === "PENDING_EARLY_SETTLEMENT";
											if (!isSettled) return null;
											
											const statusColor = selectedLoan.status === "DISCHARGED" 
												? "bg-green-500/20 border-green-400/30 text-green-200"
												: "bg-purple-500/20 border-purple-400/30 text-purple-200";
											const statusText = selectedLoan.status === "DISCHARGED" 
												? "Loan Discharged" 
												: selectedLoan.status === "PENDING_EARLY_SETTLEMENT"
												? "Early Settlement Pending"
												: "Discharge Pending";
											
											return (
												<div className={`p-4 rounded-lg mb-6 border ${statusColor}`}>
													<div className="flex items-center justify-between">
														<div className="flex items-center">
															<CheckCircleIcon className="h-5 w-5 mr-2" />
															<div>
																<p className="font-medium">{statusText}</p>
																{selectedLoan.dischargedAt && (
																	<p className="text-sm text-gray-300">
																		Discharged on {formatDate(selectedLoan.dischargedAt)}
																	</p>
																)}
															</div>
														</div>
														{(() => {
															// Check for early settlement info from backend (preferred)
															const hasSettlementInfo = selectedLoan.earlySettlementInfo?.totalSettlement;
															// Fallback to legacy fields
															const hasLegacyInfo = selectedLoan.earlySettlementAmount || selectedLoan.earlySettlementDiscount;
															
															if (!hasSettlementInfo && !hasLegacyInfo) return null;
															
															const settlementAmount = selectedLoan.earlySettlementInfo?.totalSettlement || selectedLoan.earlySettlementAmount || 0;
															const discountAmount = selectedLoan.earlySettlementInfo?.discountAmount || selectedLoan.earlySettlementDiscount || 0;
															
															return (
																<div className="text-right">
																	{settlementAmount > 0 && (
																		<p className="text-sm">
																			Settlement: <span className="font-medium">{formatCurrency(settlementAmount)}</span>
																		</p>
																	)}
																	{discountAmount > 0 && (
																		<p className="text-xs text-green-300">
																			Discount: -{formatCurrency(discountAmount)}
																		</p>
																	)}
																</div>
															);
														})()}
													</div>
												</div>
											);
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
																Loan Progress (incl. late fees)
															</span>
															<span className="text-white">
																{Math.round(calculateProgress(selectedLoan))}% Complete
															</span>
														</div>
														<div className="w-full bg-gray-700 rounded-full h-4 relative overflow-hidden">
															{/* Base progress */}
															<div
																className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full transition-all duration-300"
																style={{
																	width: `${calculateProgress(selectedLoan)}%`,
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
													<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
														<div className="text-center">
															<p className="text-gray-400 text-sm">
																Total Paid
															</p>
															<p className="text-white font-medium text-lg">
																{formatCurrency(
																	(() => {
																		// Calculate total paid using actualAmount (the actual amount paid)
																		// Include both COMPLETED and PARTIAL since actualAmount reflects actual payments
																		const calculatedFromRepayments = selectedLoan.repayments?.reduce((total, repayment) => {
																			if (repayment.status !== "COMPLETED" && repayment.status !== "PARTIAL") return total;
																			return total + (repayment.actualAmount || 0);
																		}, 0) || 0;
																		// Use calculated value, or fall back to backend-provided totalPaid
																		return calculatedFromRepayments > 0 
																			? calculatedFromRepayments 
																			: (selectedLoan.totalPaid || 0);
																	})()
																)}
															</p>
														</div>
														<div className="text-center">
															<p className="text-gray-400 text-sm">
																Late Fees Paid
															</p>
															<p className="text-white font-medium text-lg">
																{(() => {
																	const lateFeesPaid = selectedLoan.repayments?.reduce((total, repayment) => {
																		return total + (repayment.lateFeesPaid || 0);
																	}, 0) || 0;
																	const lateFeesAssessed = selectedLoan.repayments?.reduce((total, repayment) => {
																		return total + (repayment.lateFeeAmount || 0);
																	}, 0) || 0;
																	const unpaid = lateFeesAssessed - lateFeesPaid;
																	
																	if (lateFeesAssessed === 0) {
																		return <span className="text-gray-400">None</span>;
																	}
																	return (
																		<>
																			{formatCurrency(lateFeesPaid)}
																			{unpaid > 0 && (
																				<span className="text-xs text-red-400 block">
																					{formatCurrency(unpaid)} unpaid
																				</span>
																			)}
																		</>
																	);
																})()}
															</p>
														</div>
														<div className="text-center">
															<p className="text-gray-400 text-sm">
																Outstanding (incl. fees)
															</p>
															<p className="text-white font-medium text-lg">
																{(() => {
																	const isPendingSettlement = selectedLoan.status === "PENDING_EARLY_SETTLEMENT" || 
																							   selectedLoan.status === "PENDING_DISCHARGE" ||
																							   selectedLoan.status === "DISCHARGED";
																	if (isPendingSettlement) {
																		const textColor = selectedLoan.status === "DISCHARGED" ? "text-green-300" : "text-purple-300";
																		return (
																			<span className={textColor}>
																				{formatCurrency(0)}
																				<br />
																				<span className="text-xs text-gray-400">
																					{selectedLoan.status === "DISCHARGED" ? "Discharged" : "Early Settlement"}
																				</span>
																			</span>
																		);
																	}
																	
																	// Calculate outstanding including unpaid late fees
																	const unpaidLateFees = selectedLoan.repayments?.reduce((total, repayment) => {
																		const assessed = repayment.lateFeeAmount || 0;
																		const paid = repayment.lateFeesPaid || 0;
																		return total + Math.max(0, assessed - paid);
																	}, 0) || 0;
																	const totalOutstanding = selectedLoan.outstandingBalance + unpaidLateFees;
																	
																	// Check for defaulted
																	const isDefaulted = selectedLoan.status === "DEFAULT" || selectedLoan.defaultedAt;
																	if (isDefaulted) {
																		return (
																			<span className="text-red-300">
																				{formatCurrency(totalOutstanding)}
																			</span>
																		);
																	}
																	
																	// Check for default risk
																	const isDefaultRisk = selectedLoan.defaultRiskFlaggedAt && !selectedLoan.defaultedAt;
																	if (isDefaultRisk) {
																		return (
																			<span className="text-rose-300">
																				{formatCurrency(totalOutstanding)}
																			</span>
																		);
																	}
																	
																	// Check for late (has unpaid late fees)
																	if (unpaidLateFees > 0) {
																		const daysLate = getDaysLate(selectedLoan);
																		let textColor = "text-yellow-300";
																		if (daysLate > 30) textColor = "text-red-300";
																		else if (daysLate > 15) textColor = "text-orange-300";
																		return (
																			<span className={textColor}>
																				{formatCurrency(totalOutstanding)}
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

												{/* Payment Allocation Information - Collapsible */}
												<details className="bg-blue-900/20 rounded-lg border border-blue-400/20 mb-6">
													<summary className="p-4 cursor-pointer text-blue-200 font-medium flex items-center list-none">
														<svg className="h-5 w-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
														</svg>
														Payment Allocation Hierarchy
														<svg className="h-4 w-4 ml-auto text-blue-400 transition-transform details-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
														</svg>
													</summary>
													<div className="px-4 pb-4 text-sm text-blue-100 space-y-2">
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
												</details>

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
																									// Check if this is an early settlement payment
																									if (repayment.paymentType === "EARLY_SETTLEMENT") {
																										return (
																											<div className="text-xs text-purple-400 mt-1">
																												Early Settlement
																											</div>
																										);
																									}
																									
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
																		toast.error('Failed to open unsigned agreement');
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
																				{/* Only show name/email subtext for borrower */}
																				{signature.type === 'USER' && (
																					<p className="text-gray-400 text-sm">
																						{signature.name} ({signature.email})
																					</p>
																				)}
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
																						Pending Signature
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
																		) : null}
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
														<div className="flex items-center">
															<div className="w-2 h-2 bg-cyan-400 rounded-full mr-2"></div>
															<span className="text-gray-400">Document Changes</span>
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
																						// Document-related events get cyan color
																						event.data.newStatus === 'DOCUMENT_UPLOADED' || 
																						event.data.newStatus === 'DOCUMENT_DELETED' ||
																						event.data.newStatus === 'DOCUMENT_APPROVED' ||
																						event.data.newStatus === 'DOCUMENT_REJECTED' ||
																						event.data.newStatus === 'DOCUMENT_STATUS_CHANGED' ||
																						event.data.changeReason?.includes('DOCUMENT')
																							? "bg-cyan-400"
																							: event.data.changedBy?.toLowerCase().includes('system')
																							? "bg-blue-400" 
																							: event.data.changedBy && (
																								event.data.changedBy.startsWith('admin_') || 
																								event.data.changedBy === 'Unknown Admin' ||
																								event.data.changeReason?.toLowerCase().includes('admin') ||
																								event.data.changeReason?.toLowerCase().includes('stamped agreement uploaded') ||
																								event.data.changeReason?.toLowerCase().includes('stamped agreement replaced') ||
																								event.data.changeReason?.toLowerCase().includes('stamp certificate uploaded') ||
																								event.data.changeReason?.toLowerCase().includes('stamp certificate replaced') ||
																								event.data.changeReason?.toLowerCase().includes('payment slip uploaded') ||
																								event.data.changeReason?.toLowerCase().includes('payment slip replaced') ||
																								event.data.changeReason?.toLowerCase().includes('payment_slip_uploaded') ||
																								event.data.changeReason?.toLowerCase().includes('payment_slip_replaced') ||
																								event.data.notes?.toLowerCase().includes('admin') ||
																								event.data.notes?.toLowerCase().includes('stamped agreement') ||
																								event.data.notes?.toLowerCase().includes('stamp certificate') ||
																								event.data.notes?.toLowerCase().includes('payment slip')
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

								{/* Documents Tab - Read Only */}
								{selectedTab === "documents" && (
									<div className="space-y-6">
										{(() => {
											// Normalize document types - remove surrounding quotes if present
											const normalizeDocType = (docType: string | unknown): string => {
												if (typeof docType !== 'string') return String(docType);
												return docType.replace(/^["']|["']$/g, '').trim();
											};
											
											const rawRequiredDocs = selectedLoan.application?.product?.requiredDocuments || [];
											const requiredDocs = rawRequiredDocs.map(normalizeDocType);
											const uploadedDocs = selectedLoan.application?.documents || [];
											const uploadedDocTypes = Array.from(new Set(uploadedDocs.map(d => normalizeDocType(d.type))));
											const missingDocs = requiredDocs.filter((docType: string) => !uploadedDocTypes.includes(docType));
											const hasAllDocs = missingDocs.length === 0 && requiredDocs.length > 0;
											const isCollateralLoan = selectedLoan.application?.product?.collateralRequired === true;
											
											return (
												<>
													{/* Summary Banner */}
													<div className={`rounded-lg p-4 border ${
														isCollateralLoan 
															? "bg-amber-500/10 border-amber-500/30"
															: hasAllDocs 
																? "bg-green-500/10 border-green-500/30" 
																: requiredDocs.length === 0
																	? "bg-gray-700/30 border-gray-600/30"
																	: "bg-amber-500/10 border-amber-500/30"
													}`}>
														<div className="flex items-center justify-between">
															<div className="flex items-center">
																{isCollateralLoan ? (
																	<ClipboardDocumentCheckIcon className="h-5 w-5 text-amber-400 mr-2" />
																) : hasAllDocs ? (
																	<CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
																) : requiredDocs.length === 0 ? (
																	<DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
																) : (
																	<ExclamationTriangleIcon className="h-5 w-5 text-amber-400 mr-2" />
																)}
																<div>
																	<p className={`font-medium ${
																		isCollateralLoan 
																			? "text-amber-200"
																			: hasAllDocs 
																				? "text-green-200" 
																				: requiredDocs.length === 0
																					? "text-gray-300"
																					: "text-amber-200"
																	}`}>
																		{isCollateralLoan 
																			? "Collateral Loan - Documents Optional"
																			: hasAllDocs 
																				? "All Required Documents Uploaded" 
																				: requiredDocs.length === 0
																					? "No Required Documents for this Product"
																					: `${missingDocs.length} of ${requiredDocs.length} Required Documents Missing`}
																	</p>
																	<p className="text-xs text-gray-400 mt-0.5">
																		{uploadedDocs.length} document{uploadedDocs.length !== 1 ? 's' : ''} uploaded
																		{requiredDocs.length > 0 && ` • ${requiredDocs.length} required by product`}
																	</p>
																</div>
															</div>
															<span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded">
																Read Only
															</span>
														</div>
													</div>

													{/* Required Documents Checklist */}
													{requiredDocs.length > 0 && (
														<div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50">
															<h4 className="text-lg font-medium text-white mb-4 flex items-center">
																<ClipboardDocumentCheckIcon className="h-5 w-5 mr-2 text-blue-400" />
																Required Documents
															</h4>
															<div className="space-y-3">
																{requiredDocs.map((docType: string) => {
																	const uploadedForType = uploadedDocs.filter(d => normalizeDocType(d.type) === docType);
																	const hasUpload = uploadedForType.length > 0;
																	const allApproved = hasUpload && uploadedForType.every(d => d.status === 'APPROVED');
																	const hasRejected = hasUpload && uploadedForType.some(d => d.status === 'REJECTED');
																	
																	return (
																		<div key={docType} className="border border-gray-700/40 rounded-lg p-3 bg-gray-800/30">
																			<div className="flex justify-between items-start">
																				<div className="flex items-start">
																					<div className={`mt-0.5 mr-3 rounded-full p-1 ${
																						allApproved 
																							? "bg-green-500/20" 
																							: hasRejected 
																								? "bg-red-500/20"
																								: hasUpload 
																									? "bg-amber-500/20" 
																									: "bg-gray-600/20"
																					}`}>
																						{allApproved ? (
																							<CheckCircleIcon className="h-4 w-4 text-green-400" />
																						) : hasRejected ? (
																							<XCircleIcon className="h-4 w-4 text-red-400" />
																						) : hasUpload ? (
																							<ClockIcon className="h-4 w-4 text-amber-400" />
																						) : (
																							<XMarkIcon className="h-4 w-4 text-gray-500" />
																						)}
																					</div>
																					<div>
																						<p className="text-white font-medium">{getDocumentTypeName(docType)}</p>
																						<p className="text-xs text-gray-400 mt-0.5">
																							{!hasUpload 
																								? "Not uploaded" 
																								: allApproved 
																									? `${uploadedForType.length} file(s) approved`
																									: hasRejected
																										? "Needs re-upload"
																										: `${uploadedForType.length} file(s) pending review`}
																						</p>
																					</div>
																				</div>
																				<span className={`px-2 py-1 text-xs rounded-full ${
																					allApproved 
																						? "bg-green-500/20 text-green-200 border border-green-400/30"
																						: hasRejected 
																							? "bg-red-500/20 text-red-200 border border-red-400/30"
																							: hasUpload 
																								? "bg-amber-500/20 text-amber-200 border border-amber-400/30"
																								: "bg-gray-600/20 text-gray-400 border border-gray-500/30"
																				}`}>
																					{allApproved ? "Approved" : hasRejected ? "Rejected" : hasUpload ? "Pending" : "Missing"}
																				</span>
																			</div>
																			
																			{/* Show uploaded files for this type */}
																			{hasUpload && (
																				<div className="mt-3 pl-8 space-y-2">
																					{uploadedForType.map((doc) => (
																						<div key={doc.id} className="flex items-center justify-between text-sm bg-gray-700/30 rounded px-3 py-2">
																							<span className="text-gray-300 truncate max-w-[200px]">
																								{doc.fileUrl.split('/').pop()}
																							</span>
																							<div className="flex items-center space-x-2">
																								<span className={`px-1.5 py-0.5 text-xs rounded ${
																									getDocumentStatusColor(doc.status).bg
																								} ${getDocumentStatusColor(doc.status).text}`}>
																									{doc.status}
																								</span>
																								<a
																									href={formatDocumentUrl(doc.fileUrl, doc.id, selectedLoan.applicationId)}
																									target="_blank"
																									rel="noopener noreferrer"
																									className="text-xs px-2 py-1 bg-blue-500/20 text-blue-200 rounded border border-blue-400/20 hover:bg-blue-500/30"
																								>
																									View
																								</a>
																							</div>
																						</div>
																					))}
																				</div>
																			)}
																		</div>
																	);
																})}
															</div>
														</div>
													)}

													{/* Additional Documents (uploaded but not in required list) */}
													{(() => {
														const additionalDocs = uploadedDocs.filter(
															(doc) => !requiredDocs.includes(normalizeDocType(doc.type))
														);
														if (additionalDocs.length === 0) return null;
														
														return (
															<div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50">
																<h4 className="text-lg font-medium text-white mb-4 flex items-center">
																	<DocumentTextIcon className="h-5 w-5 mr-2 text-purple-400" />
																	Additional Documents
																</h4>
																<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
																	{additionalDocs.map((doc) => (
																		<div
																			key={doc.id}
																			className="border border-gray-700/40 rounded-lg p-3 bg-gray-800/30"
																		>
																			<div className="flex justify-between items-center mb-2">
																				<span className="text-sm font-medium text-white">
																					{getDocumentTypeName(doc.type)}
																				</span>
																				<span
																					className={`px-2 py-1 text-xs rounded-full ${
																						getDocumentStatusColor(doc.status).bg
																					} ${getDocumentStatusColor(doc.status).text}`}
																				>
																					{doc.status}
																				</span>
																			</div>
																			<p className="text-xs text-gray-400 truncate mb-2">
																				{doc.fileUrl.split('/').pop()}
																			</p>
																			<a
																				href={formatDocumentUrl(doc.fileUrl, doc.id, selectedLoan.applicationId)}
																				target="_blank"
																				rel="noopener noreferrer"
																				className="text-xs px-2 py-1 bg-blue-500/20 text-blue-200 rounded border border-blue-400/20 hover:bg-blue-500/30 inline-block"
																			>
																				View Document
																			</a>
																		</div>
																	))}
																</div>
															</div>
														);
													})()}

													{/* No documents message */}
													{uploadedDocs.length === 0 && requiredDocs.length === 0 && (
														<div className="border border-gray-700/50 rounded-lg p-8 bg-gray-800/50 text-center">
															<FolderIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
															<h4 className="text-white font-medium mb-2">No Documents</h4>
															<p className="text-gray-400 text-sm">
																No documents have been uploaded for this loan application.
															</p>
														</div>
													)}
												</>
											);
										})()}
									</div>
								)}

								{/* Credit Report Tab */}
								{selectedTab === "credit-report" && userRole === "ADMIN" && (
									<div className="space-y-6">
										{/* User Summary Card */}
										<div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50">
											<h4 className="text-lg font-medium text-white mb-4 flex items-center">
												<UserCircleIcon className="h-5 w-5 mr-2 text-blue-400" />
												Borrower Information
											</h4>
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
												<div>
													<p className="text-gray-400 text-xs">Full Name</p>
													<p className="text-white font-medium">
														{selectedLoan.user?.fullName || "—"}
													</p>
												</div>
												<div>
													<p className="text-gray-400 text-xs">IC Number</p>
													<p className="text-white font-medium">
														{selectedLoan.user?.icNumber || selectedLoan.user?.idNumber || "—"}
													</p>
												</div>
												<div>
													<p className="text-gray-400 text-xs">Phone</p>
													<p className="text-white font-medium">
														{selectedLoan.user?.phoneNumber || "—"}
													</p>
												</div>
												<div>
													<p className="text-gray-400 text-xs">Loan Amount</p>
													<p className="text-white font-medium">
														{formatCurrency(selectedLoan.principalAmount)}
													</p>
												</div>
											</div>
										</div>

										{/* Credit Report Card */}
										<CreditReportCard
											userId={selectedLoan.userId}
											applicationId={selectedLoan.applicationId}
											userFullName={selectedLoan.user?.fullName || ""}
											userIcNumber={selectedLoan.user?.icNumber || selectedLoan.user?.idNumber}
											existingReport={creditReport}
											onReportFetched={(report) => {
												setCreditReport(report);
											}}
											onRequestConfirmation={(onConfirm) => {
												showConfirmModal({
													title: "Request Fresh Credit Report",
													message: "Are you sure you want to request a fresh credit report from CTOS?",
													details: [
														`Borrower: ${selectedLoan.user?.fullName || "Unknown"}`,
														`IC Number: ${selectedLoan.user?.icNumber || selectedLoan.user?.idNumber || "Not set"}`,
														"",
														"⚠️ This will charge company credits.",
													],
													confirmText: "Request Report",
													confirmColor: "blue",
													onConfirm: () => {
														closeConfirmModal();
														onConfirm();
													},
												});
											}}
										/>
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
												toast.warning('Please select a PDF file');
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
												toast.warning('Please select a PDF file');
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
											Loan ID
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
												{d.application.loan?.id ? (
													<Link
														href={`/dashboard/loans?loanId=${d.application.loan.id}`}
														className="text-sm text-blue-400 hover:text-blue-300 hover:underline font-mono"
													>
														{d.application.loan.id.substring(0, 12)}...
													</Link>
												) : (
													<div className="text-sm text-gray-500">N/A</div>
												)}
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-gray-300">
													{formatDateTime(d.disbursedAt)}
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-gray-400">
													{d.disbursedByUser?.fullName || d.disbursedBy}
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

			{/* Confirmation Modal */}
			<ConfirmationModal
				open={confirmModal.open}
				onClose={closeConfirmModal}
				onConfirm={confirmModal.onConfirm}
				title={confirmModal.title}
				message={confirmModal.message}
				details={confirmModal.details}
				confirmText={confirmModal.confirmText}
				confirmColor={confirmModal.confirmColor}
			/>
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
