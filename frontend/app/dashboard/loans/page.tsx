"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import Cookies from "js-cookie";
import PieChart from "@/components/PieChart";
import {
	CreditCardIcon,
	ArrowRightIcon,
	CalendarIcon,
	BanknotesIcon,
	ChartBarIcon,
	ClockIcon,
	CheckCircleIcon,
	ExclamationTriangleIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	PlusIcon,
	DocumentTextIcon,
	XMarkIcon,
	CheckIcon,
	VideoCameraIcon,
	ChartPieIcon,
	DocumentIcon,
	ArrowPathIcon,
	UserIcon,
	DocumentCheckIcon,
	ShieldCheckIcon,
	KeyIcon,
} from "@heroicons/react/24/outline";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { checkAuth, fetchWithTokenRefresh, TokenStorage } from "@/lib/authUtils";
import PaymentMethodModal from "@/components/modals/PaymentMethodModal";
import BankTransferModal from "@/components/modals/BankTransferModal";
import AttestationMethodModal from "@/components/modals/AttestationMethodModal";
import LiveCallConfirmationModal from "@/components/modals/LiveCallConfirmationModal";
import { 
	BarChart, 
	Bar, 
	XAxis, 
	YAxis, 
	CartesianGrid, 
	Tooltip, 
	Legend, 
	ResponsiveContainer,
	Cell,
	LabelList 
} from 'recharts';

interface LoanSummary {
	totalOutstanding: number;
	nextPaymentDue: string | null;
	nextPaymentAmount: number;
	totalBorrowed: number;
	totalRepaid: number;
}

interface OverdueInfo {
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
	}>;
}

interface Loan {
	id: string;
	applicationId: string;
	principalAmount: number;
	totalAmount: number;
	outstandingBalance: number;
	interestRate: number;
	term: number;
	monthlyPayment: number;
	nextPaymentDue: string;
	status: string;
	disbursedAt: string;
	dischargedAt?: string;
	totalRepaid?: number;
	progressPercentage?: number;
	canRepay?: boolean;
	overdueInfo?: OverdueInfo;
	nextPaymentInfo?: {
		amount: number;
		isOverdue: boolean;
		includesLateFees: boolean;
		description: string;
		dueDate: string | null;
	};
	gracePeriodDays?: number; // Grace period setting from backend
	// Grace period information from late_fees table
	gracePeriodInfo?: {
		gracePeriodDays: number | null;
		gracePeriodRepayments: number;
		totalGracePeriodFees: number;
		totalAccruedFees: number;
		status: string;
	} | null;
	// Default tracking fields
	defaultRiskFlaggedAt?: string | null;
	defaultNoticesSent?: number;
	defaultedAt?: string | null;
	// DocuSeal Agreement fields
	docusealSubmissionId?: string | null;
	agreementStatus?: string | null;
	agreementSignedAt?: string | null;
	docusealSignUrl?: string | null;
	// PKI Integration fields
	pkiSignedPdfUrl?: string | null;
	pkiStampedPdfUrl?: string | null;
	pkiStampCertificateUrl?: string | null;
	application: {
		id: string;
		product: {
			name: string;
			code: string;
		};
		createdAt: string;
		disbursement?: {
			referenceNumber: string;
			amount: number;
			disbursedAt: string;
			paymentSlipUrl: string | null;
		};
	};
	repayments?: Array<{
		id: string;
		amount: number;

		principalAmount?: number;
		interestAmount?: number;
		status: string;
		dueDate: string;
		paidAt: string | null;
		createdAt: string;
		actualAmount?: number | null;
		paymentType?: string | null;
		installmentNumber?: number | null;
		lateFeeAmount?: number | null;
		lateFeesPaid?: number | null;
		principalPaid?: number | null;
		graceStatus?: string;
		isInGracePeriod?: boolean;
		daysIntoGracePeriod?: number;
		effectiveDaysOverdue?: number;
		receipts?: {
			id: string;
			receiptNumber: string;
			filePath: string;
			generatedBy: string;
			generatedAt: string;
		}[];
	}>;
}

interface LoanRepayment {
	id: string;
	amount: number;
	principalAmount: number;
	interestAmount: number;
	status: string;
	dueDate: string;
	paidAt: string | null;
	createdAt: string;
	actualAmount?: number | null;
	paymentType?: string | null;
	installmentNumber?: number | null;
	graceStatus?: string;
	isInGracePeriod?: boolean;
	daysIntoGracePeriod?: number;
	effectiveDaysOverdue?: number;
	// Receipt information - supports multiple receipts
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
	description: string;
	createdAt: string;
	updatedAt: string;
	reference?: string;
}

interface LoanApplication {
	id: string;
	status: string;
	appStep: number;
	amount: number;
	term: number;
	purpose: string;
	monthlyRepayment?: number;
	interestRate?: number;
	netDisbursement?: number;
	// Old fee structure (kept for backward compatibility)
	applicationFee?: number;
	originationFee?: number;
	legalFee?: number;
	// New fee structure
	stampingFee?: number;
	legalFeeFixed?: number;
	// Fresh offer fields - old structure
	freshOfferAmount?: number;
	freshOfferTerm?: number;
	freshOfferInterestRate?: number;
	freshOfferMonthlyRepayment?: number;
	freshOfferNetDisbursement?: number;
	freshOfferOriginationFee?: number;
	freshOfferLegalFee?: number;
	freshOfferApplicationFee?: number;
	// Fresh offer fields - new structure
	freshOfferStampingFee?: number;
	freshOfferLegalFeeFixed?: number;
	freshOfferNotes?: string;
	freshOfferSubmittedAt?: string;
	createdAt: string;
	updatedAt: string;
	attestationType?: string;
	attestationCompleted?: boolean;
	attestationDate?: string;
	attestationNotes?: string;
	meetingCompletedAt?: string;
	product: {
		name: string;
		code: string;
		requiredDocuments?: string[];
	};
	documents?: Array<{
		id: string;
		name: string;
		type: string;
		status: string;
	}>;
	history?: LoanApplicationHistory[];
	// DocuSeal Agreement fields for applications
	loan?: {
		id: string;
		docusealSubmissionId?: string | null;
		agreementStatus?: string | null;
		agreementSignedAt?: string | null;
		docusealSignUrl?: string | null;
		pkiSignedPdfUrl?: string | null;
		pkiStampedPdfUrl?: string | null;
		pkiStampCertificateUrl?: string | null;
	};
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

function LoansPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [userName, setUserName] = useState<string>("");
	const [loans, setLoans] = useState<Loan[]>([]);
	const [applications, setApplications] = useState<LoanApplication[]>([]);
	const [activeTab, setActiveTab] = useState<
		"loans" | "discharged" | "applications" | "incomplete" | "rejected"
	>("loans");
	const [loanSummary, setLoanSummary] = useState<LoanSummary>({
		totalOutstanding: 0,
		nextPaymentDue: null,
		nextPaymentAmount: 0,
		totalBorrowed: 0,
		totalRepaid: 0,
	});
	const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
	const [loanTransactions, setLoanTransactions] = useState<{
		[key: string]: WalletTransaction[];
	}>({});
	const [loadingTransactions, setLoadingTransactions] = useState<{
		[key: string]: boolean;
	}>({});
	const [loading, setLoading] = useState<boolean>(true);
	const [refreshing, setRefreshing] = useState<boolean>(false);
	const [showLoanDetails, setShowLoanDetails] = useState<{
		[key: string]: boolean;
	}>({});
	const [showApplicationDetails, setShowApplicationDetails] = useState<{
		[key: string]: boolean;
	}>({});
	const [showTimelineDetails, setShowTimelineDetails] = useState<{
		[key: string]: boolean;
	}>({});
	const [applicationHistory, setApplicationHistory] = useState<{
		[key: string]: LoanApplicationHistory[];
	}>({});
	const [loadingApplicationHistory, setLoadingApplicationHistory] = useState<{
		[key: string]: boolean;
	}>({});

	// Loan repayment modal states
	const [showLoanRepayModal, setShowLoanRepayModal] =
		useState<boolean>(false);
	const [showPaymentMethodModal, setShowPaymentMethodModal] =
		useState<boolean>(false);
	const [currentPaymentReference, setCurrentPaymentReference] = useState<string>("");
	const [repaymentAmount, setRepaymentAmount] = useState<string>("");
	// Payment method - currently only BANK_TRANSFER is supported (FPX may be added in the future)
	const selectedPaymentMethod = "BANK_TRANSFER";
	const [repaymentError, setRepaymentError] = useState<string>("");
	const [isEarlySettlement, setIsEarlySettlement] = useState(false);
	const [earlySettlementQuote, setEarlySettlementQuote] = useState<any>(null);
	const [earlySettlementError, setEarlySettlementError] = useState<string>("");
	const [earlySettlementAvailableDate, setEarlySettlementAvailableDate] = useState<string>("");

	// Late fee information
	const [lateFeeInfo, setLateFeeInfo] = useState<{
		[loanId: string]: {
			summary: {
				totalOverdueAmount: number;
				totalLateFees: number;
				totalAmountDue: number;
				overdueRepaymentCount: number;
				hasOverduePayments: boolean;
			};
			overdueRepayments: Array<{
				repaymentId: string;
				installmentNumber: number;
				originalAmount: number;
				outstandingAmount: number;
				totalLateFees: number;
				totalAmountDue: number;
				dueDate: string;
				daysOverdue: number;
				status: string;
			}>;
		};
	}>({});

	// Loading states for late fee info
	const [loadingLateFeeInfo, setLoadingLateFeeInfo] = useState<{
		[loanId: string]: boolean;
	}>({});

	// Application withdrawal modal states
	const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
	const [selectedApplication, setSelectedApplication] =
		useState<LoanApplication | null>(null);
	const [withdrawing, setWithdrawing] = useState<boolean>(false);

	// Application deletion modal states
	const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
	const [selectedDeleteApplication, setSelectedDeleteApplication] =
		useState<LoanApplication | null>(null);
	const [deleting, setDeleting] = useState<boolean>(false);

	// Document signing modal states
	const [showDocumentSigningModal, setShowDocumentSigningModal] = useState<boolean>(false);
	const [selectedSigningApplication, setSelectedSigningApplication] =
		useState<LoanApplication | null>(null);
	const [signingInProgress, setSigningInProgress] = useState<boolean>(false);

	// Attestation method modal states
	const [showAttestationMethodModal, setShowAttestationMethodModal] =
		useState<boolean>(false);
	const [selectedAttestationApplication, setSelectedAttestationApplication] =
		useState<LoanApplication | null>(null);
	const [showLiveCallConfirmationModal, setShowLiveCallConfirmationModal] =
		useState<boolean>(false);

	// Chart filter state
	const [chartTimeFilter, setChartTimeFilter] = useState<"all" | "year">(
		"all"
	);

	// Selected bar data state for showing details
	const [selectedBarData, setSelectedBarData] = useState<{
		month: string;
		totalScheduled: number;
		totalPaid: number;
		totalOutstanding: number;
		lateFees: number;
		paidLateFees: number;
		unpaidLateFees: number;
		overdue: number;
		upcoming: number;
	} | null>(null);

	// Success message state
	const [successMessage, setSuccessMessage] = useState<string>("");
	const [warningMessage, setWarningMessage] = useState<string>("");

	// Handle success and warning messages from URL parameters
	useEffect(() => {
		const success = searchParams.get("success");
		const warning = searchParams.get("warning");
		const signed = searchParams.get("signed");
		const pki = searchParams.get("pki");
		
		if (success === "attestation_completed_signing_initiated") {
			setSuccessMessage("✅ Attestation completed successfully! Document signing has been opened in a new tab. Please complete the signing process to finalize your loan.");
			// Clear the success message after 8 seconds
			setTimeout(() => setSuccessMessage(""), 8000);
		} else if (success === "attestation_completed") {
			setSuccessMessage("✅ Attestation completed successfully! You can now proceed to sign your loan documents.");
			setTimeout(() => setSuccessMessage(""), 6000);
		} else if (signed === "success" && pki === "true") {
			setSuccessMessage("🔐 PKI Digital Signing completed successfully! Your document has been signed with your digital certificate and is now legally binding.");
			setTimeout(() => setSuccessMessage(""), 8000);
		} else if (signed === "success") {
			setSuccessMessage("✅ Document signing completed successfully! Your agreement is now active.");
			setTimeout(() => setSuccessMessage(""), 6000);
		}
		
		if (warning === "signing_initiation_failed") {
			setWarningMessage("⚠️ Attestation was completed, but we couldn't automatically start the signing process. Please click 'Begin Signing' to proceed manually.");
			setTimeout(() => setWarningMessage(""), 8000);
		}
	}, [searchParams]);

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

				// Load all data in parallel for better performance
				await Promise.all([
					loadLoansAndSummary(), // Combined call for better performance
					loadApplications(),
				]);
			} catch (error) {
				console.error("Loans - Auth check error:", error);
				// Clear any invalid tokens and redirect to login
				TokenStorage.clearTokens();
				router.push("/login");
			} finally {
				setLoading(false);
			}
		};

		checkAuthAndLoadData();
	}, [router]);

	// Handle tab query parameter and scrolling
	useEffect(() => {
		const tab = searchParams.get("tab");
		const shouldScroll = searchParams.get("scroll");
		
		if (tab === "applications") {
			setActiveTab("applications");
		} else if (tab === "discharged") {
			setActiveTab("discharged");
		} else if (tab === "incomplete") {
			setActiveTab("incomplete");
		} else if (tab === "rejected") {
			setActiveTab("rejected");
		}

		// Scroll to loans section only if explicitly requested
		if (shouldScroll === "true") {
			// Try multiple times with increasing delays to ensure content is loaded
			const attemptScroll = (attempt = 1, maxAttempts = 5) => {
				const loansSection = document.getElementById("loans-section");
				if (loansSection) {
					
					// Try scrollIntoView first
					try {
						loansSection.scrollIntoView({ 
							behavior: "smooth", 
							block: "start" 
						});
					} catch (error) {
						// Fallback to manual scroll calculation
						const rect = loansSection.getBoundingClientRect();
						const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
						const targetPosition = rect.top + scrollTop - 20; // 20px offset from top
						
						window.scrollTo({
							top: targetPosition,
							behavior: "smooth"
						});
					}
				} else if (attempt < maxAttempts) {
					setTimeout(() => attemptScroll(attempt + 1, maxAttempts), 300 * attempt);
				} else {
					console.error("Failed to find loans section after", maxAttempts, "attempts");
				}
			};
			
			setTimeout(() => attemptScroll(), 500);
		}
	}, [searchParams]);

	// Auto-refresh loans every 10 seconds if there are pending early settlement requests
	useEffect(() => {
		const hasPendingEarlySettlement = loans.some(loan => 
			// Check if loan has pending early settlement status
			loan.status === 'PENDING_EARLY_SETTLEMENT' || loan.status === 'PENDING_DISCHARGE'
		);

		if (hasPendingEarlySettlement) {
			const interval = setInterval(async () => {
				// Force refresh with cache busting
				await loadLoansAndSummary();
				// Also refresh selected loan details if it's one of the pending loans
				if (selectedLoan && (selectedLoan.status === 'PENDING_EARLY_SETTLEMENT' || selectedLoan.status === 'PENDING_DISCHARGE')) {
					// Force refresh the selected loan by finding it in the updated loans list
					const updatedLoans = await fetchWithTokenRefresh<{ loans: Loan[] }>("/api/loans");
					const updatedSelectedLoan = updatedLoans.loans.find(l => l.id === selectedLoan.id);
					if (updatedSelectedLoan) {
						setSelectedLoan(updatedSelectedLoan);
					}
				}
			}, 10000); // Refresh every 10 seconds (more frequent)

			return () => clearInterval(interval);
		}
	}, [loans, selectedLoan]);

	// Combined function to load both loans and summary data efficiently
	const loadLoansAndSummary = async () => {
		try {
			// Load wallet data (includes loanSummary) and loans data in parallel
			const [walletData, loansData] = await Promise.all([
				fetchWithTokenRefresh<any>("/api/wallet"),
				fetchWithTokenRefresh<{ loans: Loan[] }>("/api/loans"),
			]);

			// Set loan summary from wallet API (consistent with dashboard)
			if (walletData?.loanSummary) {
				setLoanSummary(walletData.loanSummary);
			}

			// Set loans data - repayments with receipts are now included in the main API response
			if (loansData?.loans) {
				// Debug logging for pending discharge loans
				loansData.loans.forEach(loan => {
					if (loan.status === 'PENDING_DISCHARGE') {
						console.warn(`Repayments for PENDING_DISCHARGE loan ${loan.id}:`, 
							loan.repayments?.map(r => ({
								id: r.id,
								status: r.status,
								amount: r.amount,
								paymentType: r.paymentType,
								receipts: r.receipts?.length || 0
							}))
						);
					}
				});

				setLoans(loansData.loans);
			}
		} catch (error) {
			console.error("Error loading loans and summary:", error);
		}
	};

	const loadApplications = async () => {
		try {
			const data = await fetchWithTokenRefresh<LoanApplication[]>(
				"/api/loan-applications"
			);
			if (data) {
				setApplications(data);
			}
		} catch (error) {
			console.error("Error loading applications:", error);
		}
	};

	const loadLoanTransactions = async (loanId: string) => {
		// Don't reload if already loaded
		if (loanTransactions[loanId]) {
			return;
		}

		setLoadingTransactions((prev) => ({
			...prev,
			[loanId]: true,
		}));

		try {
			const data = await fetchWithTokenRefresh<{
				walletTransactions: WalletTransaction[];
			}>(`/api/loans/${loanId}/transactions`);

			if (data?.walletTransactions) {
				setLoanTransactions((prev) => ({
					...prev,
					[loanId]: data.walletTransactions,
				}));
			} else {
				// If no transactions data, set empty array
				setLoanTransactions((prev) => ({
					...prev,
					[loanId]: [],
				}));
			}
		} catch (error) {
			console.error("Error loading loan transactions:", error);
			// Set empty array on error to show "No payment history" message
			setLoanTransactions((prev) => ({
				...prev,
				[loanId]: [],
			}));
		} finally {
			setLoadingTransactions((prev) => ({
				...prev,
				[loanId]: false,
			}));
		}
	};

	// Removed wallet balance loading as we only support bank transfer

	const loadLateFeeInfo = async (loanId: string, forceRefresh = false) => {
		// Don't reload if currently loading, unless it's a force refresh
		if (loadingLateFeeInfo[loanId]) {
			return;
		}

		// Skip if already loaded and not forcing refresh
		if (lateFeeInfo[loanId] && !forceRefresh) {
			return;
		}

		setLoadingLateFeeInfo((prev) => ({
			...prev,
			[loanId]: true,
		}));

		try {
			const data = await fetchWithTokenRefresh<{
				summary: any;
				overdueRepayments: any[];
			}>(`/api/loans/${loanId}/late-fees`);

			if (data) {
				setLateFeeInfo((prev) => ({
					...prev,
					[loanId]: data,
				}));
			}
		} catch (error) {
			console.error(
				`Error loading late fee info for loan ${loanId}:`,
				error
			);
		} finally {
			setLoadingLateFeeInfo((prev) => ({
				...prev,
				[loanId]: false,
			}));
		}
	};

	const loadApplicationHistory = async (applicationId: string) => {
		// Only skip if currently loading to prevent duplicate requests
		if (loadingApplicationHistory[applicationId]) {
			return;
		}

		setLoadingApplicationHistory((prev) => ({
			...prev,
			[applicationId]: true,
		}));

		try {
			const historyData = await fetchWithTokenRefresh<
				| {
						applicationId: string;
						currentStatus: string;
						timeline: LoanApplicationHistory[];
				  }
				| LoanApplicationHistory[]
			>(`/api/loan-applications/${applicationId}/history`);

			// Handle both old array format and new object format
			let history: LoanApplicationHistory[] = [];
			if (Array.isArray(historyData)) {
				// Old format - direct array
				history = historyData;
			} else if (
				historyData &&
				typeof historyData === "object" &&
				"timeline" in historyData
			) {
				// New format - object with timeline property
				history = historyData.timeline || [];
			}

			setApplicationHistory((prev) => ({
				...prev,
				[applicationId]: history,
			}));
		} catch (error) {
			console.error(
				`Error loading history for application ${applicationId}:`,
				error
			);
			// Set empty array on error
			setApplicationHistory((prev) => ({
				...prev,
				[applicationId]: [],
			}));
		} finally {
			setLoadingApplicationHistory((prev) => ({
				...prev,
				[applicationId]: false,
			}));
		}
	};

	const handleLoanRepayClick = () => {
		if (loans.length === 1) {
			// If only one loan, select it automatically
			setSelectedLoan(loans[0]);
		}
		setShowLoanRepayModal(true);
	};

	const downloadDisbursementSlip = async (loan: Loan) => {
		try {
			// Check if payment slip is available
			if (!loan.application?.disbursement?.paymentSlipUrl) {
				throw new Error('Payment slip is not yet available for download');
			}

			// Use direct backend download endpoint with authentication
			const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
			const response = await fetch(`${backendUrl}/api/loans/${loan.id}/download-disbursement-slip`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${TokenStorage.getAccessToken()}`,
				},
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
			}

			// Get the PDF blob and create download link
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `payment-slip-${loan.id.substring(0, 8)}.pdf`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Error downloading payment slip:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to download payment slip');
		}
	};

	const handleConfirmRepayment = async () => {
		if (!selectedLoan || !repaymentAmount) return;

		// Generate reference and show the bank transfer modal
		const paymentReference = `${selectedLoan.id
			.slice(0, 8)
			.toUpperCase()}-${Date.now().toString().slice(-8)}`;
		setCurrentPaymentReference(paymentReference);
		setShowLoanRepayModal(false);
		setShowPaymentMethodModal(true);
	};

	const handlePaymentConfirm = async () => {
		if (!selectedLoan || !repaymentAmount) return;

		try {
			const amount = parseFloat(repaymentAmount);

			let response: any;
			if (isEarlySettlement && earlySettlementQuote) {
				// Create early settlement request
				response = await fetchWithTokenRefresh(
					`/api/loans/${selectedLoan.id}/early-settlement/request`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							reference: currentPaymentReference,
							description: `Early settlement - ${formatCurrency(amount)}`,
						}),
					}
				) as any;
			} else {
				// Standard repayment
				response = await fetchWithTokenRefresh(
					"/api/wallet/repay-loan",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							loanId: selectedLoan.id,
							amount,
							paymentMethod: "FRESH_FUNDS",
							reference: currentPaymentReference,
							description: `Loan repayment - ${formatCurrency(amount)}`,
						}),
					}
				);
			}

			if (response) {
				// Payment/Request submitted successfully
				setShowPaymentMethodModal(false);
				setCurrentPaymentReference("");
				setRepaymentAmount("");
				setSelectedLoan(null);
				setIsEarlySettlement(false);
				setEarlySettlementQuote(null);

				// Reload data to show updated status
				await loadLoansAndSummary();

				toast.success(
					isEarlySettlement
						? "Early settlement request submitted! Pending admin approval."
						: "Payment submitted successfully! Your transaction is pending approval."
				);
			}
		} catch (error) {
			console.error("Error submitting bank transfer payment:", error);
			toast.error("Failed to submit payment. Please try again.");
		}
	};

	const handleAutoFillMonthlyPayment = async () => {
		if (selectedLoan) {
			// Reset early settlement state when switching to regular payment
			setIsEarlySettlement(false);
			setEarlySettlementQuote(null);
			setEarlySettlementError("");
			setEarlySettlementAvailableDate("");
			
			// Use the next payment info from backend instead of calculating
			const nextPayment = selectedLoan.nextPaymentInfo || {
				amount: selectedLoan.monthlyPayment,
				isOverdue: false,
				includesLateFees: false,
				description: "Monthly Payment",
			};

			if (nextPayment.amount > 0) {
				// Preserve exact decimal precision - don't round user input
				const amountToFill = nextPayment.amount.toFixed(2);
				setRepaymentAmount(amountToFill);
				validateRepaymentAmount(amountToFill, selectedLoan);
			}
		}
	};

	const handleLoanSelection = async (loan: Loan) => {
		setSelectedLoan(loan);
		setRepaymentError("");
		setIsEarlySettlement(false);
		setEarlySettlementQuote(null);
		setEarlySettlementError("");
		setEarlySettlementAvailableDate("");
		// Load late fee info if loan has overdue payments
		if (loan.overdueInfo?.hasOverduePayments) {
			await loadLateFeeInfo(loan.id);
		}
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-MY", {
			style: "currency",
			currency: "MYR",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(Math.abs(amount));
	};

	const formatCurrencyCompact = (amount: number) => {
		if (amount >= 1000000000) {
			return `RM ${(amount / 1000000000).toFixed(1)}B`;
		} else if (amount >= 1000000) {
			return `RM ${(amount / 1000000).toFixed(1)}M`;
		} else if (amount >= 1000) {
			return `RM ${(amount / 1000).toFixed(0)}k`;
		} else {
			return `RM ${amount.toFixed(0)}`;
		}
	};

	const handleEarlySettlementClick = async () => {
		if (!selectedLoan) return;
		
		// Clear previous errors
		setEarlySettlementError("");
		setEarlySettlementAvailableDate("");
		
		try {
			const resp = await fetchWithTokenRefresh<any>(`/api/loans/${selectedLoan.id}/early-settlement/quote`, { method: 'POST' });
			if (!resp?.success) {
				// Handle lock-in period error
				if (resp?.message?.includes('Early settlement available after')) {
					// Extract date from message like "Early settlement available after 2025-11-29."
					const dateMatch = resp.message.match(/after\s+(\d{4}-\d{2}-\d{2})/);
					if (dateMatch && dateMatch[1]) {
						const availableDate = dateMatch[1];
						setEarlySettlementAvailableDate(availableDate);
						
						// Format the date for display
						const formattedDate = new Date(availableDate).toLocaleDateString('en-MY', {
							year: 'numeric',
							month: 'long',
							day: 'numeric'
						});
						
						const daysLeft = getDaysUntilEarlySettlement(availableDate);
						const dayText = daysLeft === 1 ? 'day' : 'days';
						
						setEarlySettlementError(
							`Lock-in period active. Available in ${daysLeft} ${dayText} (${formattedDate}).`
						);
					} else {
						setEarlySettlementError(resp.message);
					}
				} else if (resp?.message?.includes('disabled')) {
					setEarlySettlementError('Early settlement feature is currently disabled. Please contact support for assistance.');
				} else {
					setEarlySettlementError(resp?.message || 'Unable to get early settlement quote');
				}
				return;
			}
			
			// Success - show quote
			setIsEarlySettlement(true);
			setEarlySettlementQuote(resp.data);
			const amt = Number(resp.data.totalSettlement).toFixed(2);
			setRepaymentAmount(amt);
			validateRepaymentAmount(amt, selectedLoan);
		} catch (e: any) {
			console.error('Early settlement quote error', e);
			
			// Try to extract error message from the response
			let errorMessage = 'Failed to get early settlement quote. Please try again later.';
			
			if (e?.message?.includes('Early settlement available after')) {
				// Handle the case where the error comes from the catch block
				const dateMatch = e.message.match(/after\s+(\d{4}-\d{2}-\d{2})/);
				if (dateMatch && dateMatch[1]) {
					const availableDate = dateMatch[1];
					setEarlySettlementAvailableDate(availableDate);
					
					const formattedDate = new Date(availableDate).toLocaleDateString('en-MY', {
						year: 'numeric',
						month: 'long',
						day: 'numeric'
					});
					
					const daysLeft = getDaysUntilEarlySettlement(availableDate);
					const dayText = daysLeft === 1 ? 'day' : 'days';
					
					errorMessage = `Lock-in period active. Available in ${daysLeft} ${dayText} (${formattedDate}).`;
				}
			}
			
			setEarlySettlementError(errorMessage);
		}
	};

	// Helper function to check if early settlement might be available
	const isEarlySettlementLikelyAvailable = (loan: Loan) => {
		if (!loan.disbursedAt) return false;
		// Assume 3 months lock-in period (this is just for UI hint, actual check is done on server)
		const disbursedDate = new Date(loan.disbursedAt);
		const lockInEndDate = new Date(disbursedDate);
		lockInEndDate.setMonth(lockInEndDate.getMonth() + 3);
		return new Date() >= lockInEndDate;
	};

	// Helper function to calculate days until early settlement becomes available
	const getDaysUntilEarlySettlement = (availableDate: string) => {
		const available = new Date(availableDate);
		const now = new Date();
		const diffTime = available.getTime() - now.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return Math.max(0, diffDays);
	};

	const downloadReceipt = async (loanId: string, receiptId: string, receiptNumber: string) => {
		try {
			// Use direct fetch to backend with proper token handling
			const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
			const response = await fetch(`${backendUrl}/api/loans/${loanId}/receipts/${receiptId}/download`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${TokenStorage.getAccessToken()}`,
				},
			});

			if (!response.ok) {
				throw new Error('Failed to download receipt');
			}

			// Create blob from response
			const blob = await response.blob();
			
			// Create download link
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `${receiptNumber}.pdf`;
			document.body.appendChild(link);
			link.click();
			
			// Cleanup
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Error downloading receipt:', error);
			toast.error('Failed to download receipt. Please try again.');
		}
	};

	const downloadSignedAgreement = async (loan: Loan) => {
		try {
			// Check if agreement is signed and PKI URL is available
			if (loan.agreementStatus !== 'SIGNED' || !loan.pkiSignedPdfUrl) {
				throw new Error('Agreement is not yet signed by all parties or not available for download');
			}

			// Use direct backend download endpoint
			const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
			const response = await fetch(`${backendUrl}/api/loans/${loan.id}/download-agreement`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${TokenStorage.getAccessToken()}`,
				},
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to download signed agreement');
			}

			// Create blob from response
			const blob = await response.blob();
			
			// Extract filename from Content-Disposition header or use default
			const contentDisposition = response.headers.get('Content-Disposition');
			let filename = `loan-agreement-${loan.id.substring(0, 8)}.pdf`;
			if (contentDisposition) {
				const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
				if (filenameMatch) {
					filename = filenameMatch[1];
				}
			}
			
			// Create download link
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			
			// Cleanup
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
			
		} catch (error) {
			console.error('Error downloading signed agreement:', error);
			toast.error(`Failed to download signed agreement: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	};

	const downloadStampedAgreement = async (loan: Loan) => {
		try {
			// Check if stamped agreement is available
			if (!loan.pkiStampedPdfUrl) {
				throw new Error('Stamped agreement is not yet available for download');
			}

			// Use direct backend download endpoint with authentication
			const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
			const response = await fetch(`${backendUrl}/api/loans/${loan.id}/download-stamped-agreement`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${TokenStorage.getAccessToken()}`,
				},
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
			}

			// Get the PDF blob and create download link
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `stamped-agreement-${loan.id.substring(0, 8)}.pdf`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);

		} catch (error) {
			console.error('Error downloading stamped agreement:', error);
			toast.error(`Failed to download stamped agreement: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	};

	const downloadStampCertificate = async (loan: Loan) => {
		try {
			// Check if certificate is available
			if (!loan.pkiStampCertificateUrl) {
				throw new Error('Stamp certificate is not yet available for download');
			}

			// Use direct backend download endpoint with authentication
			const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
			const response = await fetch(`${backendUrl}/api/loans/${loan.id}/download-stamp-certificate`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${TokenStorage.getAccessToken()}`,
				},
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
			}

			// Get the PDF blob and create download link
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `stamp-certificate-${loan.id.substring(0, 8)}.pdf`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);

		} catch (error) {
			console.error('Error downloading stamp certificate:', error);
			toast.error(`Failed to download stamp certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	};

	// Helper functions to get display values (fresh offer or original)
	const getDisplayAmount = (app: LoanApplication) => {
		if (app.status === "PENDING_FRESH_OFFER" && app.freshOfferAmount !== undefined) {
			return app.freshOfferAmount;
		}
		return app.amount || 0; // Default to 0 if null/undefined
	};

	const getDisplayTerm = (app: LoanApplication) => {
		if (app.status === "PENDING_FRESH_OFFER" && app.freshOfferTerm !== undefined) {
			return app.freshOfferTerm;
		}
		return app.term || 0; // Default to 0 if null/undefined
	};

	const getDisplayMonthlyRepayment = (app: LoanApplication) => {
		if (app.status === "PENDING_FRESH_OFFER" && app.freshOfferMonthlyRepayment !== undefined) {
			return app.freshOfferMonthlyRepayment;
		}
		return app.monthlyRepayment || 0; // Default to 0 if null/undefined
	};

	const getDisplayInterestRate = (app: LoanApplication) => {
		if (app.status === "PENDING_FRESH_OFFER" && app.freshOfferInterestRate !== undefined) {
			return app.freshOfferInterestRate;
		}
		return app.interestRate || 0; // Default to 0 if null/undefined
	};

	const getDisplayNetDisbursement = (app: LoanApplication) => {
		if (app.status === "PENDING_FRESH_OFFER" && app.freshOfferNetDisbursement !== undefined) {
			return app.freshOfferNetDisbursement;
		}
		return app.netDisbursement || 0; // Default to 0 if null/undefined
	};

	// Helper functions to get fee values (fresh offer or original) with null handling
	// Old fee structure helpers (for backward compatibility)
	const getDisplayOriginationFee = (app: LoanApplication) => {
		if (app.status === "PENDING_FRESH_OFFER" && app.freshOfferOriginationFee !== undefined) {
			return app.freshOfferOriginationFee;
		}
		return app.originationFee || 0; // Default to 0 if null/undefined
	};

	const getDisplayLegalFee = (app: LoanApplication) => {
		if (app.status === "PENDING_FRESH_OFFER" && app.freshOfferLegalFee !== undefined) {
			return app.freshOfferLegalFee;
		}
		return app.legalFee || 0; // Default to 0 if null/undefined
	};

	const getDisplayApplicationFee = (app: LoanApplication) => {
		if (app.status === "PENDING_FRESH_OFFER" && app.freshOfferApplicationFee !== undefined) {
			return app.freshOfferApplicationFee;
		}
		return app.applicationFee || 0; // Default to 0 if null/undefined
	};

	// New fee structure helpers
	const getDisplayStampingFee = (app: LoanApplication) => {
		if (app.status === "PENDING_FRESH_OFFER" && app.freshOfferStampingFee !== undefined) {
			return app.freshOfferStampingFee;
		}
		return app.stampingFee || 0; // Default to 0 if null/undefined
	};

	const getDisplayLegalFeeFixed = (app: LoanApplication) => {
		if (app.status === "PENDING_FRESH_OFFER" && app.freshOfferLegalFeeFixed !== undefined) {
			return app.freshOfferLegalFeeFixed;
		}
		return app.legalFeeFixed || 0; // Default to 0 if null/undefined
	};

	// Helper to check if application uses new fee structure
	const usesNewFeeStructure = (app: LoanApplication) => {
		// Check if fresh offer has new fees
		if (app.status === "PENDING_FRESH_OFFER") {
			return app.freshOfferStampingFee !== undefined || app.freshOfferLegalFeeFixed !== undefined;
		}
		// Check if application has new fees
		return app.stampingFee !== undefined || app.legalFeeFixed !== undefined;
	};

	// Helper function to check if any value has changed
	const hasValueChanged = (original: number | undefined, freshOffer: number | undefined) => {
		// Convert null/undefined to 0 for comparison
		const originalValue = original || 0;
		const freshOfferValue = freshOffer || 0;
		
		// Only return true if both values exist and are actually different
		if (freshOffer === undefined || freshOffer === null) return false;
		return Math.abs(originalValue - freshOfferValue) > 0.01; // Account for floating point precision
	};

	// Component to show comparison values for fresh offers
	const ComparisonValue = ({ 
		original, 
		freshOffer, 
		formatValue, 
		showComparison = true 
	}: { 
		original: number | undefined; 
		freshOffer: number | undefined; 
		formatValue: (value: number) => string;
		showComparison?: boolean;
	}) => {
		const hasChanged = hasValueChanged(original, freshOffer);
		
		// Use fresh offer value if available, otherwise use original, fallback to 0
		const displayValue = freshOffer !== undefined && freshOffer !== null ? freshOffer : (original !== undefined ? original : 0);
		

		
		// For fresh offers, show comparison logic
		if (showComparison) {
			if (hasChanged) {
				// Show new value with previous value (no strikethrough)
				const safeOriginal = original || 0;
				const safeFreshOffer = freshOffer || 0;
				
				return (
					<div className="space-y-2">
						<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700">
							{formatValue(safeFreshOffer)}
						</p>
						<div className="text-xs text-gray-400">
							Previously: {formatValue(safeOriginal)}
						</div>
					</div>
				);
			} else {
				// Show no change text
				return (
					<div className="space-y-2">
						<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700">
							{formatValue(displayValue)}
						</p>
						<div className="text-xs text-gray-400">
							No change
						</div>
					</div>
				);
			}
		}

		// Regular display for non-fresh offers
		return (
			<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
				{formatValue(displayValue)}
			</p>
		);
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

	const getStatusBadge = (status: string, loan?: Loan) => {
		// Check for default risk status
		if (loan?.defaultRiskFlaggedAt && !loan?.defaultedAt) {
			return (
				<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 font-body">
					<ExclamationTriangleIcon className="h-3 w-3 mr-1" />
					Default Risk
				</span>
			);
		}

		switch (status.toUpperCase()) {
			case "ACTIVE":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200 font-body">
						<CheckCircleIcon className="h-3 w-3 mr-1" />
						Active
					</span>
				);
			case "DEFAULT":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200 font-body">
						<ExclamationTriangleIcon className="h-3 w-3 mr-1" />
						Defaulted
					</span>
				);
		case "PENDING_DISCHARGE":
			return (
				<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 font-body">
					<ClockIcon className="h-3 w-3 mr-1" />
					Pending Discharge
				</span>
			);
		case "PENDING_EARLY_SETTLEMENT":
			return (
				<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 font-body">
					<ClockIcon className="h-3 w-3 mr-1" />
					Early Settlement Pending
				</span>
			);
			case "DISCHARGED":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200 font-body">
						<CheckCircleIcon className="h-3 w-3 mr-1" />
						Discharged
					</span>
				);
			case "PENDING":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200 font-body">
						<ClockIcon className="h-3 w-3 mr-1" />
						Pending
					</span>
				);
			case "COMPLETED":
			case "PAID":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200 font-body">
						<CheckCircleIcon className="h-3 w-3 mr-1" />
						{status.toUpperCase() === "PAID" ? "Paid" : "Completed"}
					</span>
				);
			case "DEFAULTED":
			case "FAILED":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200 font-body">
						<ExclamationTriangleIcon className="h-3 w-3 mr-1" />
						{status.toUpperCase() === "FAILED"
							? "Failed"
							: "Defaulted"}
					</span>
				);
			default:
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 font-body">
						{status}
					</span>
				);
		}
	};

	const toggleLoanDetails = (loanId: string) => {
		setShowLoanDetails((prev) => ({
			...prev,
			[loanId]: !prev[loanId],
		}));

		if (!showLoanDetails[loanId]) {
			loadLoanTransactions(loanId);
		}
	};

	const calculateDaysUntilDue = (dueDate: string) => {
		// Get current date in Malaysia timezone (UTC+8) for consistent calculation with backend
		const now = new Date();
		const malaysiaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
		const todayMalaysia = new Date(Date.UTC(
			malaysiaTime.getUTCFullYear(),
			malaysiaTime.getUTCMonth(),
			malaysiaTime.getUTCDate(),
			0, 0, 0, 0
		));
		
		// Parse due date and convert to Malaysia timezone start of day
		const dueUTC = new Date(dueDate);
		const dueMalaysiaTime = new Date(dueUTC.getTime() + (8 * 60 * 60 * 1000));
		const dueMalaysia = new Date(Date.UTC(
			dueMalaysiaTime.getUTCFullYear(),
			dueMalaysiaTime.getUTCMonth(),
			dueMalaysiaTime.getUTCDate(),
			0, 0, 0, 0
		));
		
		const diffTime = dueMalaysia.getTime() - todayMalaysia.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	};

	// Helper function to get the correct due date for display
	const getCorrectDueDate = (loan: Loan): string | null => {
		// Check for overdue payments first
		const hasOverduePayments = loan.overdueInfo?.hasOverduePayments;
		const overdueRepayments = loan.overdueInfo?.overdueRepayments;
		
		if (hasOverduePayments && overdueRepayments && overdueRepayments.length > 0) {
			// Show the earliest overdue repayment due date
			const earliestOverdue = overdueRepayments
				.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
			return earliestOverdue.dueDate;
		} else {
			// Use nextPaymentInfo.dueDate if available (this comes from backend calculation of next unpaid/partial repayment)
			// Otherwise fall back to loan.nextPaymentDue
			return loan.nextPaymentInfo?.dueDate || loan.nextPaymentDue;
		}
	};

	const getPaymentUrgency = (daysUntilDue: number) => {
		if (daysUntilDue < 0) return { color: "text-red-600", text: "Overdue" };
		if (daysUntilDue === 0) return { color: "text-red-600", text: "Due Today" };
		if (daysUntilDue === 1) return { color: "text-orange-600", text: "Due Tomorrow" };
		if (daysUntilDue <= 5)
			return { color: "text-orange-600", text: "Due Soon" };
		if (daysUntilDue <= 10)
			return { color: "text-yellow-600", text: "Due This Month" };
		return { color: "text-green-600", text: `Due in ${daysUntilDue} days` };
	};

	const validateRepaymentAmount = (amount: string, loan: Loan) => {
		const numAmount = parseFloat(amount);

		if (!amount || amount.trim() === "") {
			setRepaymentError("");
			return;
		}

		if (isNaN(numAmount) || numAmount <= 0) {
			setRepaymentError("Please enter a valid amount greater than 0");
			return;
		}

		// Skip outstanding balance validation for early settlement
		// Early settlement amounts can legitimately exceed outstanding balance due to fees
		if (!isEarlySettlement && numAmount > loan.outstandingBalance) {
			setRepaymentError(
				`Amount cannot exceed outstanding balance of ${formatCurrency(
					loan.outstandingBalance
				)}`
			);
			return;
		}

		setRepaymentError("");
	};

	const handleRepaymentAmountChange = (value: string) => {
		setRepaymentAmount(value);
		if (selectedLoan) {
			validateRepaymentAmount(value, selectedLoan);
		}
	};

	// Application utility functions
	const getApplicationStatusColor = (
		status: string,
		attestationType?: string
	) => {
		switch (status) {
			case "INCOMPLETE":
				return "bg-yellow-100 text-yellow-800";
			case "PENDING_APP_FEE":
			case "PENDING_KYC":
			case "PENDING_APPROVAL":
				return "bg-blue-100 text-blue-800";
			case "PENDING_FRESH_OFFER":
				return "bg-purple-100 text-purple-800";
			case "PENDING_ATTESTATION":
				// Special color for live call requests
				if (attestationType === "MEETING") {
					return "bg-purple-100 text-purple-800";
				}
				return "bg-cyan-100 text-cyan-800";
			case "CERT_CHECK":
				return "bg-emerald-100 text-emerald-800";
			case "PENDING_PKI_SIGNING":
				return "bg-violet-100 text-violet-800";
			case "PENDING_SIGNING_OTP":
				return "bg-purple-100 text-purple-800";
		case "PENDING_CERTIFICATE_OTP":
			return "bg-purple-100 text-purple-800";
	case "PENDING_SIGNATURE":
			return "bg-indigo-100 text-indigo-800";
	case "PENDING_SIGNING_COMPANY_WITNESS":
			return "bg-teal-100 text-teal-800";
	case "PENDING_STAMPING":
			return "bg-teal-100 text-teal-800";
		case "PENDING_DISBURSEMENT":
			return "bg-orange-100 text-orange-800";
			case "APPROVED":
				return "bg-green-100 text-green-800";
			case "REJECTED":
				return "bg-red-100 text-red-800";
			case "DISBURSED":
				return "bg-purple-100 text-purple-800";
			case "WITHDRAWN":
				return "bg-gray-100 text-gray-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const getApplicationStatusLabel = (
		status: string,
		attestationType?: string
	) => {
		switch (status) {
			case "INCOMPLETE":
				return "Application Started";
			case "PENDING_APP_FEE":
				return "Application Started";
			case "PENDING_PROFILE_CONFIRMATION":
				return "KYC Verification";
			case "PENDING_KYC":
				return "KYC Verification";
			case "PENDING_APPROVAL":
				return "Pending Approval";
			case "PENDING_FRESH_OFFER":
				return "Pending Approval";
			case "PENDING_ATTESTATION":
				// Show special status for live call requests
				if (attestationType === "MEETING") {
					return "Awaiting Live Call";
				}
				return "Attestation";
			case "CERT_CHECK":
				return "Certificate Check";
		case "PENDING_PKI_SIGNING":
			return "Document Signing";
		case "PENDING_SIGNING_OTP":
			return "Pending OTP Verification";
	case "PENDING_CERTIFICATE_OTP":
		return "Pending Certificate OTP";
	case "PENDING_SIGNATURE":
			return "Document Signing";
	case "PENDING_SIGNING_COMPANY_WITNESS":
			return "Company & Witness Signing";
	case "PENDING_STAMPING":
			return "Agreement Stamping";
		case "PENDING_DISBURSEMENT":
			return "Loan Disbursement";
			case "APPROVED":
				return "Approved";
			case "REJECTED":
				return "Rejected";
			case "DISBURSED":
				return "Disbursed";
			case "ACTIVE":
				return "Loan Active";
			case "WITHDRAWN":
				return "Withdrawn";
			default:
				return status;
		}
	};

	const getHistoryActionDescription = (
		previousStatus: string | null,
		newStatus: string
	): string => {
		if (!previousStatus) {
			return `Application created with status: ${getApplicationStatusLabel(
				newStatus
			)}`;
		}

		return `Status changed to ${getApplicationStatusLabel(newStatus)}`;
	};

	const toggleApplicationDetails = (applicationId: string) => {
		setShowApplicationDetails((prev) => ({
			...prev,
			[applicationId]: !prev[applicationId],
		}));

		if (!showApplicationDetails[applicationId]) {
			loadApplicationHistory(applicationId);
		}
	};

	const calculatePaymentPerformance = (loan: Loan) => {
		if (!loan.repayments || loan.repayments.length === 0) {
			return { percentage: null, onTimeCount: 0, lateCount: 0, missedCount: 0, settledEarlyCount: 0, totalCount: 0 };
		}

		// Find early settlement repayment if exists
		const earlySettlementRepayment = loan.repayments.find(
			(r) => r.paymentType === "EARLY_SETTLEMENT" && r.status === "COMPLETED"
		);
		const earlySettlementDate = earlySettlementRepayment
			? new Date(earlySettlementRepayment.paidAt || earlySettlementRepayment.createdAt)
			: null;

		// Get all scheduled repayments (excluding early settlement type)
		const scheduledRepayments = loan.repayments.filter(
			(r) => r.paymentType !== "EARLY_SETTLEMENT"
		);

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

		// Total repayments to consider = completed + cancelled (all cancelled count now)
		const totalRepaymentsToConsider = completedRepayments.length + cancelledRepayments.length;

		if (totalRepaymentsToConsider === 0) {
			return { percentage: null, onTimeCount: 0, lateCount: 0, missedCount: 0, settledEarlyCount: 0, totalCount: 0 };
		}

		// On-time payments from completed repayments
		const onTimeOrEarlyPayments = completedRepayments.filter((r) => {
			const paymentDate = new Date(r.paidAt || r.createdAt);
			const dueDate = new Date(r.dueDate);
			return paymentDate <= dueDate;
		});

		// Late payments from completed repayments
		const latePayments = completedRepayments.filter((r) => {
			const paymentDate = new Date(r.paidAt || r.createdAt);
			const dueDate = new Date(r.dueDate);
			return paymentDate > dueDate;
		});

		// Missed payments = cancelled overdue
		const missedPayments = cancelledOverdueRepayments.length;
		
		// Settled early = cancelled but not yet due (count as on-time)
		const settledEarlyPayments = cancelledSettledEarlyRepayments.length;

		// On-time includes both actual on-time payments AND those cleared early via settlement
		const totalOnTime = onTimeOrEarlyPayments.length + settledEarlyPayments;

		const percentage = Math.round(
			(totalOnTime / totalRepaymentsToConsider) * 100
		);

		return {
			percentage,
			onTimeCount: onTimeOrEarlyPayments.length,
			lateCount: latePayments.length,
			missedCount: missedPayments,
			settledEarlyCount: settledEarlyPayments,
			totalCount: totalRepaymentsToConsider,
		};
	};

	const getPerformanceColor = (percentage: number | null) => {
		if (percentage === null) return "text-gray-500";
		if (percentage >= 90) return "text-green-600";
		if (percentage >= 75) return "text-blue-tertiary";
		if (percentage >= 60) return "text-yellow-600";
		return "text-red-600";
	};

	const handleWithdrawApplication = async () => {
		if (!selectedApplication) return;

		try {
			setWithdrawing(true);
			await fetchWithTokenRefresh(
				`/api/loan-applications/${selectedApplication.id}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						status: "WITHDRAWN",
					}),
				}
			);

			// Update local state
			setApplications(
				applications.map((app) =>
					app.id === selectedApplication.id
						? { ...app, status: "WITHDRAWN" }
						: app
				)
			);

			// Clear any cached application history to force refresh
			setApplicationHistory((prev) => ({
				...prev,
				[selectedApplication.id]: [],
			}));

			setShowWithdrawModal(false);
			setSelectedApplication(null);
		} catch (error) {
			console.error("Error withdrawing application:", error);
		} finally {
			setWithdrawing(false);
		}
	};

	const handleDeleteApplication = async () => {
		if (!selectedDeleteApplication) return;

		try {
			setDeleting(true);
			await fetchWithTokenRefresh(
				`/api/loan-applications/${selectedDeleteApplication.id}`,
				{
					method: "DELETE",
				}
			);

			// Remove from local state
			setApplications(
				applications.filter(
					(app) => app.id !== selectedDeleteApplication.id
				)
			);

			setShowDeleteModal(false);
			setSelectedDeleteApplication(null);
		} catch (error) {
			console.error("Error deleting application:", error);
			toast.error("Failed to delete application. Please try again.");
		} finally {
			setDeleting(false);
		}
	};

	const handleAttestationMethodSelect = (app: LoanApplication) => {
		setSelectedAttestationApplication(app);
		setShowAttestationMethodModal(true);
	};

	const handleSwitchToInstantAttestation = (app: LoanApplication) => {
		// Direct navigation to instant attestation page without modal
		router.push(`/dashboard/applications/${app.id}/attestation`);
	};

	const handleInstantAttestationSelect = () => {
		if (selectedAttestationApplication) {
			setShowAttestationMethodModal(false);
			router.push(
				`/dashboard/applications/${selectedAttestationApplication.id}/attestation`
			);
		}
	};

	const handleLiveCallSelect = () => {
		setShowAttestationMethodModal(false);
		setShowLiveCallConfirmationModal(true);
	};

	const handleAttestationModalClose = () => {
		setShowAttestationMethodModal(false);
		setSelectedAttestationApplication(null);
	};

	const handleLiveCallConfirm = async () => {
		if (!selectedAttestationApplication) return;

		try {
			const response = await fetchWithTokenRefresh(
				`/api/loan-applications/${selectedAttestationApplication.id}/request-live-call`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						attestationType: "MEETING",
					}),
				}
			);

			if (response) {
				// Reload applications to show updated status
				await loadApplications();
				setShowLiveCallConfirmationModal(false);
				setSelectedAttestationApplication(null);

				toast.success(
					"Live video call request submitted! Our legal team will contact you within 1-2 business days to schedule your appointment."
				);
			}
		} catch (error) {
			console.error("Error requesting live call:", error);
			toast.error("Failed to submit live call request. Please try again.");
		}
	};

	const handleLiveCallBack = () => {
		setShowLiveCallConfirmationModal(false);
		setShowAttestationMethodModal(true);
	};

	const handleLiveCallModalClose = () => {
		setShowLiveCallConfirmationModal(false);
		setSelectedAttestationApplication(null);
	};

	// Handle document signing initiation
	const handleDocumentSigning = async (app: LoanApplication) => {
		try {
			setSigningInProgress(true);
			
			// First, try to get existing signing URL from loan_signatories table
			try {
				const signingResponse = await fetchWithTokenRefresh<{
					success: boolean;
					data?: {
						signingUrl: string;
						applicationId: string;
						loanId: string;
					};
				}>(`/api/loan-applications/${app.id}/signing-url`);

				if (signingResponse?.success && signingResponse?.data?.signingUrl) {
					// Navigate to existing signing URL
					window.location.href = signingResponse.data.signingUrl;
					return;
				}
			} catch (error) {
				console.error('No existing signing URL found, will initiate new signing process');
			}
			
			// If no existing signing URL, initiate new document signing with DocuSeal
			const response = await fetchWithTokenRefresh<{
				success: boolean;
				message: string;
				data?: {
					submissionId: string;
					signUrl: string;
					status: string;
				};
			}>('/api/docuseal/initiate-application-signing', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					applicationId: app.id,
				}),
			});

			if (response?.success && response?.data?.signUrl) {
				// Navigate to DocuSeal signing URL
				window.location.href = response.data.signUrl;
			} else {
				throw new Error(response?.message || 'Failed to initiate document signing');
			}

		} catch (error) {
			console.error('Error initiating document signing:', error);
			toast.error(`Failed to initiate document signing: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			setSigningInProgress(false);
		}
	};

	// Handle document signing modal
	const handleShowDocumentSigningModal = (app: LoanApplication) => {
		setSelectedSigningApplication(app);
		setShowDocumentSigningModal(true);
	};

	const handleDocumentSigningModalClose = () => {
		setShowDocumentSigningModal(false);
		setSelectedSigningApplication(null);
	};

	// Handle fresh offer response
	// Helper function to get the appropriate signing status message
	const getSigningStatusMessage = (agreementStatus: string | null | undefined) => {
		// If status is PENDING_SIGNATURE, it means no one has signed yet
		if (!agreementStatus || agreementStatus === 'PENDING_SIGNATURE') {
			return { type: 'pending', message: 'Ready to sign agreement' };
		}
		
		// If status is SIGNED, all parties have completed signing
		if (agreementStatus === 'SIGNED') {
			return { type: 'completed', message: 'Agreement fully signed' };
		}
		
		// For any other status (partial completion states), show waiting message
		// This covers cases where some signatories have signed but not all
		return { type: 'waiting', message: 'Waiting for other signatories to complete signing' };
	};

	const executeFreshOfferAction = async (applicationId: string, action: 'accept' | 'reject') => {
		try {
			const response = await fetchWithTokenRefresh(
				`/api/loan-applications/${applicationId}/fresh-offer-response`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						action: action,
					}),
				}
			);

			if (response) {
				// Reload applications to show updated status
				await loadApplications();
				
				const message = action === 'accept' 
					? 'Fresh offer accepted! Your application will proceed with the new terms.'
					: 'Fresh offer rejected. Your application has been restored to the original terms.';
				
				toast.success(message);
			}
		} catch (error) {
			console.error(`Error ${action}ing fresh offer:`, error);
			toast.error(`Failed to ${action} fresh offer. Please try again.`);
		}
	};

	const handleFreshOfferResponse = (applicationId: string, action: 'accept' | 'reject') => {
		const actionText = action === 'accept' ? 'accept' : 'reject';
		const actionLabel = action === 'accept' ? 'Accept' : 'Reject';
		
		toast(`Are you sure you want to ${actionText} this fresh offer?`, {
			action: {
				label: actionLabel,
				onClick: () => executeFreshOfferAction(applicationId, action),
			},
			cancel: {
				label: "Cancel",
				onClick: () => {},
			},
			duration: 10000,
		});
	};

	// Handle tab switching with refresh
	const handleTabSwitch = async (tab: "loans" | "discharged" | "applications" | "incomplete" | "rejected") => {
		setActiveTab(tab);
		// Refresh all data when switching tabs
		await Promise.all([
			loadLoansAndSummary(),
			loadApplications(),
		]);
	};

	// Handle bar click to show details
	const handleBarClick = (monthData: any) => {
		const now = new Date();
		const isCurrentMonth =
			monthData.date.getMonth() === now.getMonth() &&
			monthData.date.getFullYear() === now.getFullYear();

		// Use pre-categorized amounts from the data processing
		const overdue = monthData.overdueOutstanding || 0;
		const upcoming = monthData.regularOutstanding || 0;

		const newBarData = {
			month: monthData.date.toLocaleDateString("en-US", {
				month: "long",
				year: "numeric",
			}),
			totalScheduled: monthData.totalScheduled,
			totalPaid: monthData.totalPrincipalPaid, // Map totalPrincipalPaid to totalPaid for the selected bar data
			totalOutstanding: monthData.totalOutstanding,
			lateFees: monthData.lateFees || 0,
			paidLateFees: monthData.paidLateFees || 0,
			unpaidLateFees: monthData.unpaidLateFees || 0,
			overdue,
			upcoming,
		};

		// Toggle: close if clicking on the same month, otherwise show new data
		if (selectedBarData && selectedBarData.month === newBarData.month) {
			setSelectedBarData(null);
		} else {
			setSelectedBarData(newBarData);
		}
	};

	if (loading) {
		return (
			<DashboardLayout userName={userName} title="Loans">
				<div className="flex items-center justify-center h-64">
					<div className="w-16 h-16 border-4 border-purple-primary border-t-transparent rounded-full animate-spin"></div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout userName={userName} title="Loans & Applications">
			<div className="w-full bg-offwhite min-h-screen px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
				<div className="space-y-6">
					{/* Success and Warning Messages */}
					{successMessage && (
						<div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 shadow-sm">
							<div className="flex items-start">
								<div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
									<svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
									</svg>
								</div>
								<div className="flex-1">
									<p className="text-green-800 font-body font-medium text-sm lg:text-base">
										{successMessage}
									</p>
								</div>
								<button
									onClick={() => setSuccessMessage("")}
									className="text-green-600 hover:text-green-800 ml-2 flex-shrink-0"
								>
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						</div>
					)}
					
					{warningMessage && (
						<div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 shadow-sm">
							<div className="flex items-start">
								<div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
									<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
									</svg>
								</div>
								<div className="flex-1">
									<p className="text-amber-800 font-body font-medium text-sm lg:text-base">
										{warningMessage}
									</p>
								</div>
								<button
									onClick={() => setWarningMessage("")}
									className="text-amber-600 hover:text-amber-800 ml-2 flex-shrink-0"
								>
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						</div>
					)}
					{/* Quick Actions Bar - Top */}
					{/* <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
						<div className="p-6 lg:p-8">
							<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
								<div className="flex items-center min-w-0">
									<div className="w-12 h-12 lg:w-14 lg:h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
										<CreditCardIcon className="h-6 w-6 lg:h-7 lg:w-7 text-blue-600" />
									</div>
									<div className="min-w-0">
										<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
											Quick Actions
									</h3>
										<p className="text-sm lg:text-base text-blue-600 font-semibold">
											Manage your loans
								
										</p>
									</div>
								</div>
								<div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 flex-shrink-0">
									<button
										onClick={handleLoanRepayClick}
										className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium font-body text-base transition-all duration-200 shadow-sm hover:shadow-md"
									>
										Make Payment
									</button>
									<Link
										href="/dashboard/apply"
										className="bg-white hover:bg-gray-50 text-blue-600 border border-blue-600/20 px-6 py-3 rounded-xl font-medium font-body text-base transition-all duration-200 shadow-sm hover:shadow-md text-center"
									>
										Apply for Loan
									</Link>
								</div>
							</div>
						</div>
					</div> */}

					{/* Main Stats Cards - Due This Month & Loan Progress */}
					
								

										{/* Recharts Version - Repayment Timeline */}
					<div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full min-w-0 overflow-hidden">
						<div className="p-6 lg:p-8 min-w-0">
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-4 sm:space-y-0">
								<div className="flex items-center min-w-0">
									<div className="w-12 h-12 lg:w-14 lg:h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
										<ChartBarIcon className="h-6 w-6 lg:h-7 lg:w-7 text-blue-600" />
									</div>
									<div className="min-w-0">
										<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
											Repayment Timeline
										</h3>
										<p className="text-sm lg:text-base text-blue-600 font-semibold">
											Track your payment progress over time
										</p>
									</div>
								</div>

								{/* Time Filter Buttons */}
								<div className="flex bg-gray-100 rounded-xl p-1 border border-gray-200 w-full sm:w-auto flex-shrink-0 min-w-0">
									<button
										onClick={() => setChartTimeFilter("year")}
										className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 text-xs sm:text-sm rounded-lg transition-colors font-body font-medium ${
											chartTimeFilter === "year"
											? "bg-blue-600 text-white shadow-sm"
											: "text-gray-600 hover:text-blue-600 hover:bg-white"
										}`}
									>
										<span className="hidden sm:inline">This Year</span>
										<span className="sm:hidden">Year</span>
									</button>
									<button
										onClick={() => setChartTimeFilter("all")}
										className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 text-xs sm:text-sm rounded-lg transition-colors font-body font-medium ${
											chartTimeFilter === "all"
											? "bg-blue-600 text-white shadow-sm"
											: "text-gray-600 hover:text-blue-600 hover:bg-white"
										}`}
									>
										<span className="hidden sm:inline">All Time</span>
										<span className="sm:hidden">All</span>
									</button>
								</div>
							</div>

											{/* Recharts Bar Chart */}
			<div className="mb-6 min-w-0 overflow-x-auto">
				<div className="min-w-[320px] w-full">
					{(() => {
						// Generate monthly data for all loans using proper payment allocation
						const monthlyData = new Map();
						const now = new Date();

									// Process each loan individually
									loans
										.filter(
											(loan) =>
												loan.status === "ACTIVE" ||
												loan.status === "PENDING_DISCHARGE" ||
												loan.status === "DEFAULT" ||
												(loan.defaultRiskFlaggedAt && !loan.defaultedAt)
										)
										.forEach((loan) => {
											if (!loan.repayments) return;

											// Sort repayments by due date (chronological order)
										const sortedRepayments = [...loan.repayments].sort(
												(a, b) =>
												new Date(a.dueDate).getTime() -
												new Date(b.dueDate).getTime()
										);

										// Process each repayment individually
										sortedRepayments.forEach((repayment) => {
											const dueDate = new Date(repayment.dueDate);
													const monthKey = `${dueDate.getFullYear()}-${String(
														dueDate.getMonth() + 1
													).padStart(2, "0")}`;

											if (!monthlyData.has(monthKey)) {
												monthlyData.set(monthKey, {
																month: monthKey,
													monthName: dueDate.toLocaleDateString("en-US", {
														month: "short",
														year: "2-digit",
													}),
																date: dueDate,
																totalScheduled: 0,
													totalPrincipalPaid: 0,
																totalOutstanding: 0,
													overdueOutstanding: 0,
													currentMonthOutstanding: 0,
													regularOutstanding: 0,
													lateFees: 0,
													paidLateFees: 0,
													unpaidLateFees: 0,
												});
											}

											const monthData = monthlyData.get(monthKey);

													// Get late fee information directly from the repayment data
													const repaymentLateFees = repayment.lateFeeAmount || 0;
													const repaymentLateFeesPaid = repayment.lateFeesPaid || 0;

											// Add to total scheduled for this month
											monthData.totalScheduled += (repayment.amount || 0);
											monthData.lateFees += (repaymentLateFees || 0);

											// Helper function to categorize outstanding amounts by due date
											const categorizeOutstanding = (outstanding: number) => {
												if (outstanding <= 0) return;
												
												const repaymentYear = dueDate.getFullYear();
												const repaymentMonth = dueDate.getMonth();
												const nowYear = now.getFullYear();
												const nowMonth = now.getMonth();
												const hasLateFees = repaymentLateFees > repaymentLateFeesPaid;
												
												if (repaymentYear < nowYear || (repaymentYear === nowYear && repaymentMonth < nowMonth)) {
													// Past month - overdue
													monthData.overdueOutstanding += outstanding;
												} else if (repaymentYear === nowYear && repaymentMonth === nowMonth) {
													// Current month - check specific due date and late fees
													if (dueDate < now || hasLateFees) {
														monthData.overdueOutstanding += outstanding;
													} else {
														monthData.currentMonthOutstanding += outstanding;
													}
												} else {
													// Future month
													monthData.regularOutstanding += outstanding;
												}
											};

											// Determine payment status
											if (repayment.status === "COMPLETED") {
														// For early settlement, use actualAmount as it includes all fees
														const principalPaid = Number(repayment.paymentType === "EARLY_SETTLEMENT" 
															? (repayment.actualAmount || 0)
															: (repayment.principalPaid ?? (repayment.amount || 0))) || 0;
												monthData.totalPrincipalPaid += principalPaid;

														if (repaymentLateFees > 0) {
															monthData.paidLateFees += repaymentLateFeesPaid;
															const remainingLateFees = repaymentLateFees - repaymentLateFeesPaid;
															if (remainingLateFees > 0) {
																monthData.unpaidLateFees += remainingLateFees;
															}
														}

														const totalAmountDue = (repayment.amount || 0) + (repaymentLateFees || 0);
														const totalPaid = principalPaid + repaymentLateFeesPaid;
														const outstanding = Math.max(0, totalAmountDue - totalPaid);
														monthData.totalOutstanding += outstanding;
														categorizeOutstanding(outstanding);
													} else if (
														repayment.status === "PARTIAL" ||
														(repayment.status === "PENDING" &&
														repayment.paymentType === "PARTIAL" &&
														(repayment.actualAmount ?? 0) > 0)
													) {
														// For early settlement, use actualAmount as it includes all fees
														const principalPaid = Number(repayment.paymentType === "EARLY_SETTLEMENT" 
															? (repayment.actualAmount || 0)
															: (repayment.principalPaid ?? (repayment.actualAmount || 0))) || 0;

												monthData.totalPrincipalPaid += principalPaid;
														const totalAmountDue = (repayment.amount || 0) + (repaymentLateFees || 0);
														const totalPaid = principalPaid + repaymentLateFeesPaid;
														const outstanding = Math.max(0, totalAmountDue - totalPaid);
														monthData.totalOutstanding += outstanding;
														categorizeOutstanding(outstanding);

														if (repaymentLateFees > 0) {
															monthData.paidLateFees += repaymentLateFeesPaid;
															const remainingLateFees = repaymentLateFees - repaymentLateFeesPaid;
															if (remainingLateFees > 0) {
																monthData.unpaidLateFees += remainingLateFees;
															}
														}
													} else {
												// PENDING - nothing paid yet
														const totalAmountDue = (repayment.amount || 0) + (repaymentLateFees || 0);
														monthData.totalOutstanding += totalAmountDue;
														categorizeOutstanding(totalAmountDue);

														if (repaymentLateFees > 0) {
															monthData.paidLateFees += repaymentLateFeesPaid;
															const remainingLateFees = repaymentLateFees - repaymentLateFeesPaid;
															if (remainingLateFees > 0) {
																monthData.unpaidLateFees += remainingLateFees;
															}
														}
													}
										});
										});

									// Sort months chronologically and apply time filter
								let sortedMonths = Array.from(monthlyData.values()).sort(
									(a, b) => a.date.getTime() - b.date.getTime()
									);

																	// Apply time filter
								if (chartTimeFilter === "year") {
								const currentYear = new Date().getFullYear();
									sortedMonths = sortedMonths.filter(
									(month) => month.date.getFullYear() === currentYear
								);
							}

							// Store original count before limiting
							const totalMonths = sortedMonths.length;
							
							// For mobile optimization, prioritize current and future months
							const currentDate = new Date();
							const currentMonthIndex = sortedMonths.findIndex(month => 
								month.date.getMonth() === currentDate.getMonth() && 
								month.date.getFullYear() === currentDate.getFullYear()
							);
							
							// If current month exists, start from there and take 12 months
							if (currentMonthIndex !== -1 && totalMonths > 12) {
								sortedMonths = sortedMonths.slice(currentMonthIndex, currentMonthIndex + 12);
							} else {
								// Otherwise, limit to maximum 12 bars to prevent horizontal scrolling
								sortedMonths = sortedMonths.slice(0, 12);
							}

							// Transform data for Recharts with color categorization
							const chartData = sortedMonths.map((month) => {
									// Use pre-categorized amounts from the data processing
									const regularOutstanding = month.regularOutstanding || 0;
									const currentMonthOutstanding = month.currentMonthOutstanding || 0;
									const overdueOutstanding = month.overdueOutstanding || 0;

										return {
										month: month.monthName,
										scheduled: month.totalScheduled,
										principalPaid: month.totalPrincipalPaid,
										outstanding: regularOutstanding,
										currentMonthOutstanding: currentMonthOutstanding,
										overdueOutstanding: overdueOutstanding,
										lateFees: month.unpaidLateFees,
									};
								});

								if (chartData.length === 0) {
										return (
											<div className="text-center text-gray-500 py-8 md:py-12">
												<div className="bg-gray-50 rounded-lg p-6 md:p-8 border border-gray-200">
													<ChartBarIcon className="h-12 w-12 md:h-16 md:w-16 text-gray-400 mx-auto mb-4" />
													<p className="text-base md:text-lg font-medium font-heading text-gray-700">
													No repayment schedule available
													</p>
													<p className="text-sm text-gray-500 mt-2 font-body">
													Apply for a loan to see your payment timeline
													</p>
												</div>
											</div>
										);
									}

									return (
										<div className="space-y-4 min-w-0">
										{/* Show truncation indicator if needed */}
										{totalMonths > 12 && (
											<div className="text-xs text-gray-500 text-center mb-2">
												Showing 12 of {totalMonths} months
											</div>
										)}
										{/* Recharts Bar Chart - styled like original */}
											<div className="h-64 sm:h-72 lg:h-80 w-full">
												<ResponsiveContainer width="100%" height="100%">
													<BarChart
														data={chartData}
														margin={{
															top: 4,
															right: 8,
															left: 8,
															bottom: 10,
														}}
														barCategoryGap="3%"
														maxBarSize={chartData.length <= 3 ? 50 : chartData.length <= 6 ? 35 : chartData.length <= 9 ? 25 : 20}
													>

														{/* Simple bottom border like original */}
														<XAxis 
															dataKey="month" 
															axisLine={{ stroke: '#E5E7EB', strokeWidth: 1 }}
															tickLine={false}
															tick={({ x, y, payload }) => {
																// Responsive font size based on screen width
																const getResponsiveFontSize = () => {
																	if (typeof window !== 'undefined') {
																		if (window.innerWidth >= 1024) return 14; // lg screens
																		if (window.innerWidth >= 768) return 12;  // md screens
																		return 10; // sm screens
																	}
																	return 10; // default for SSR
																};
																
																return (
																	<text
																		x={x}
																		y={y + 8}
																		fill="#6B7280"
																		fontFamily="Inter, sans-serif"
																		fontSize={getResponsiveFontSize()}
																		textAnchor="end"
																		transform={`rotate(-45 ${x} ${y + 8})`}
																	>
																		{payload.value}
																	</text>
																);
															}}
															height={typeof window !== 'undefined' && window.innerWidth >= 1024 ? 65 : typeof window !== 'undefined' && window.innerWidth >= 768 ? 60 : 55}
															interval={0}
														/>
														<YAxis hide />
																												<Tooltip 
															content={({ active, payload, label }) => {
																if (active && payload && payload.length) {
																	const totalPaid = payload.find(p => p.dataKey === 'principalPaid')?.value || 0;
																	const outstanding = payload.find(p => p.dataKey === 'outstanding')?.value || 0;
																	const currentMonthOutstanding = payload.find(p => p.dataKey === 'currentMonthOutstanding')?.value || 0;
																	const overdueOutstanding = payload.find(p => p.dataKey === 'overdueOutstanding')?.value || 0;
																	const lateFees = payload.find(p => p.dataKey === 'lateFees')?.value || 0;
																	const totalOutstanding = Number(outstanding) + Number(currentMonthOutstanding) + Number(overdueOutstanding);
																	const total = Number(totalPaid) + totalOutstanding + Number(lateFees);

																				return (
																		<div className="bg-white border border-gray-200 shadow-lg text-gray-700 text-xs px-3 py-2 rounded-lg">
																			<div className="font-medium mb-1">{label}</div>
																			{Number(totalPaid) > 0 && (
																				<div className="text-blue-600 font-medium">
																					Principal Paid: {formatCurrency(Number(totalPaid))}
																					</div>
																			)}
																																		{Number(outstanding) > 0 && (
																				<div className="text-gray-600 font-medium">
																					Outstanding: {formatCurrency(Number(outstanding))}
																				</div>
															)}
																			{Number(currentMonthOutstanding) > 0 && (
																				<div className="text-amber-600 font-medium">
																					Due This Month: {formatCurrency(Number(currentMonthOutstanding))}
																					</div>
																				)}
																			{Number(overdueOutstanding) > 0 && (
																					<div className="text-red-600 font-medium">
																					Overdue: {formatCurrency(Number(overdueOutstanding))}
																					</div>
																				)}
																			{Number(lateFees) > 0 && (
																				<div className="text-red-600 font-medium">
																					Late Fees: {formatCurrency(Number(lateFees))}
																				</div>
																					)}
																			{/* {total > 0 && (
																					<div className="font-medium border-t border-gray-200 pt-1 mt-1">
																					Total: {formatCurrency(total)}
																					</div>
																				)} */}
																	</div>
																);
															}
																return null;
															}}
														/>
														<Bar 
															dataKey="principalPaid" 
															fill="#2563eb" 
															stackId="stack"
														/>
														<Bar 
															dataKey="outstanding" 
															fill="#f5f5f5" 
															stackId="stack"
														>
															
														</Bar>
														<Bar 
															dataKey="currentMonthOutstanding" 
															fill="#fef3c7" 
															stackId="stack"
														>
															
														</Bar>
														<Bar 
															dataKey="overdueOutstanding" 
															fill="#fee2e2" 
															stackId="stack"
														>
															
														</Bar>
														<Bar 
															dataKey="lateFees" 
															fill="#fee2e2" 
															stackId="stack"
														/>
													</BarChart>
												</ResponsiveContainer>
											</div>

																														{/* Legend - matching all color categories */}
											<div className="flex flex-wrap justify-center gap-2 sm:gap-4 md:gap-6 text-xs">
												<div className="flex items-center gap-1 sm:gap-2">
												<div className="w-3 h-3 bg-blue-600 rounded"></div>
													<span className="text-gray-600 font-body">
														Paid
													</span>
												</div>
												<div className="flex items-center gap-1 sm:gap-2">
												<div className="w-3 h-3 bg-gray-200 rounded"></div>
													<span className="text-gray-600 font-body">
														Upcoming
													</span>
												</div>
												<div className="flex items-center gap-1 sm:gap-2">
												<div className="w-3 h-3 bg-amber-200 rounded"></div>
													<span className="text-gray-600 font-body">
														Due This Month
													</span>
												</div>
												<div className="flex items-center gap-1 sm:gap-2">
												<div className="w-3 h-3 bg-red-200 rounded"></div>
													<span className="text-gray-600 font-body">
														Overdue
													</span>
												</div>
											</div>
										</div>
									);
								})()}
							</div>
						</div>
					</div>
					</div>

					{/* Loans and Applications Tabs */}
					<div id="loans-section" className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 w-full min-w-0 overflow-hidden">
						{/* Card Header */}
						<div className="p-6 lg:p-8 pb-0">
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center">
									<div className="w-12 h-12 lg:w-14 lg:h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mr-3">
										<DocumentIcon className="h-6 w-6 lg:h-7 lg:w-7 text-blue-600" />
									</div>
									<div>
										<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
										Your Loans
									</h3>
										<p className="text-sm lg:text-base text-blue-600 font-semibold">
											Active and completed loans
										</p>
									</div>
								</div>
								<button
									onClick={async () => {
										setRefreshing(true);
										try {
											// Refresh all data including application history
											await loadLoansAndSummary();
											await loadApplications();
											toast.success("Data refreshed successfully");
										} catch (error) {
											console.error("Error refreshing data:", error);
											toast.error("Failed to refresh data");
										} finally {
											setRefreshing(false);
										}
									}}
									disabled={refreshing}
									className="group inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-white hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 rounded-lg shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
									title="Refresh all loan and application data"
								>
									<ArrowPathIcon className={`h-4 w-4 mr-2 text-gray-500 group-hover:text-blue-600 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'}`} />
									<span className="group-hover:text-blue-700 transition-colors">
										{refreshing ? 'Refreshing...' : 'Refresh All Data'}
									</span>
								</button>
							</div>
						</div>

						{/* Tab Navigation - Mobile Friendly */}
						<div className="border-b border-gray-100 bg-gray-50/50">
							<nav
								className="grid grid-cols-3 gap-1 px-1 sm:grid-cols-5 sm:gap-0 sm:flex sm:space-x-4 sm:px-6 lg:px-8"
								aria-label="Tabs"
							>
								<button
									onClick={() => handleTabSwitch("loans")}
									className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm font-body transition-colors text-center ${
										activeTab === "loans"
											? "border-blue-600 text-blue-600"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
									}`}
								>
									<div className="flex flex-col items-center space-y-1 sm:flex-row sm:space-x-2 sm:space-y-0">
										<CreditCardIcon className="h-3 w-3 sm:h-4 sm:w-4" />
										<span className="text-xs sm:text-sm">
											Active
										</span>
										{loans.filter((loan) =>
											[
												"ACTIVE",
												"PENDING_DISCHARGE",
												"PENDING_EARLY_SETTLEMENT",
												"DEFAULT",
											].includes(
												loan.status.toUpperCase()
											) || (loan.defaultRiskFlaggedAt && !loan.defaultedAt)
										).length > 0 && (
											<span className="bg-blue-600/10 text-blue-600 py-0.5 px-1.5 rounded-full text-xs font-medium border border-blue-600/20 font-body sm:px-2">
												{
													loans.filter((loan) =>
														[
															"ACTIVE",
															"PENDING_DISCHARGE",
															"PENDING_EARLY_SETTLEMENT",
															"DEFAULT",
														].includes(
															loan.status.toUpperCase()
														) || (loan.defaultRiskFlaggedAt && !loan.defaultedAt)
													).length
												}
											</span>
										)}
									</div>
								</button>
								<button
									onClick={() => handleTabSwitch("discharged")}
									className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm font-body transition-colors text-center ${
										activeTab === "discharged"
											? "border-blue-600 text-blue-600"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
									}`}
								>
									<div className="flex flex-col items-center space-y-1 sm:flex-row sm:space-x-2 sm:space-y-0">
										<CheckCircleIcon className="h-3 w-3 sm:h-4 sm:w-4" />
										<span className="text-xs sm:text-sm">
											Discharged
										</span>
										{loans.filter(
											(loan) =>
												loan.status.toUpperCase() ===
												"DISCHARGED"
										).length > 0 && (
											<span className="bg-green-600/10 text-green-600 py-0.5 px-1.5 rounded-full text-xs font-medium border border-green-600/20 font-body sm:px-2">
												{
													loans.filter(
														(loan) =>
															loan.status.toUpperCase() ===
															"DISCHARGED"
													).length
												}
											</span>
										)}
									</div>
								</button>
								<button
									onClick={() => handleTabSwitch("applications")}
									className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm font-body transition-colors text-center ${
										activeTab === "applications"
											? "border-blue-600 text-blue-600"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
									}`}
								>
									<div className="flex flex-col items-center space-y-1 sm:flex-row sm:space-x-2 sm:space-y-0">
										<DocumentTextIcon className="h-3 w-3 sm:h-4 sm:w-4" />
										<span className="text-xs sm:text-sm">
											Applications
										</span>
										{applications.filter(
											(app) =>
												![
													"ACTIVE",
													"INCOMPLETE",
													"WITHDRAWN",
													"REJECTED",
												].includes(
													app.status.toUpperCase()
												)
										).length > 0 && (
											<span className="bg-gray-200 text-gray-600 py-0.5 px-1.5 rounded-full text-xs font-medium border border-gray-300 font-body sm:px-2">
												{
													applications.filter(
														(app) =>
															![
																"ACTIVE",
																"INCOMPLETE",
																"WITHDRAWN",
																"REJECTED",
															].includes(
																app.status.toUpperCase()
															)
													).length
												}
											</span>
										)}
									</div>
								</button>
								<button
									onClick={() => handleTabSwitch("incomplete")}
									className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm font-body transition-colors text-center ${
										activeTab === "incomplete"
											? "border-blue-600 text-blue-600"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
									}`}
								>
									<div className="flex flex-col items-center space-y-1 sm:flex-row sm:space-x-2 sm:space-y-0">
										<ClockIcon className="h-3 w-3 sm:h-4 sm:w-4" />
										<span className="text-xs sm:text-sm">
											Incomplete
										</span>
										{applications.filter(
											(app) =>
												app.status.toUpperCase() ===
												"INCOMPLETE"
										).length > 0 && (
											<span className="bg-yellow-100 text-yellow-700 py-0.5 px-1.5 rounded-full text-xs font-medium border border-yellow-200 font-body sm:px-2">
												{
													applications.filter(
														(app) =>
															app.status.toUpperCase() ===
															"INCOMPLETE"
													).length
												}
											</span>
										)}
									</div>
								</button>
								<button
									onClick={() => handleTabSwitch("rejected")}
									className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm font-body transition-colors text-center ${
										activeTab === "rejected"
											? "border-blue-600 text-blue-600"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
									}`}
								>
									<div className="flex flex-col items-center space-y-1 sm:flex-row sm:space-x-2 sm:space-y-0">
										<ExclamationTriangleIcon className="h-3 w-3 sm:h-4 sm:w-4" />
										<span className="text-xs sm:text-sm">
											Rejected
										</span>
										{applications.filter(
											(app) =>
												["REJECTED", "WITHDRAWN"].includes(
													app.status.toUpperCase()
												)
										).length > 0 && (
											<span className="bg-red-100 text-red-700 py-0.5 px-1.5 rounded-full text-xs font-medium border border-red-200 font-body sm:px-2">
												{
													applications.filter(
														(app) =>
															["REJECTED", "WITHDRAWN"].includes(
																app.status.toUpperCase()
															)
													).length
												}
											</span>
										)}
									</div>
								</button>
							</nav>
						</div>

						{/* Tab Content */}
						<div className="p-6 lg:p-8 min-w-0 w-full">
							{(() => {
								if (activeTab === "loans") {
									// Active Loans Content
									const activeLoans = loans.filter((loan) => {
										const status =
											loan.status.toUpperCase();
										return (
											([
												"ACTIVE",
												"PENDING_DISCHARGE",
												"PENDING_EARLY_SETTLEMENT",
												"DEFAULT",
											].includes(status) &&
												loan.outstandingBalance > 0) ||
											status === "PENDING_DISCHARGE" ||
											status === "PENDING_EARLY_SETTLEMENT" ||
											status === "DEFAULT" ||
											(loan.defaultRiskFlaggedAt && !loan.defaultedAt) // Include potential default loans
										);
									});

									if (activeLoans.length > 0) {
										return (
											<div className="space-y-6 min-w-0">
												{activeLoans.map((loan) => {
													// Use backend overdue data for overdue status, frontend calculations for future due dates only
													const isOverdue = loan.nextPaymentInfo?.isOverdue || false;
													let urgency;
													if (isOverdue) {
														urgency = { color: "text-red-600", text: "Overdue" };
													} else {
														const dueDateToUse = getCorrectDueDate(loan);
														if (dueDateToUse) {
															const daysUntilDue = calculateDaysUntilDue(dueDateToUse);
															urgency = getPaymentUrgency(daysUntilDue);
														} else {
															urgency = { color: "text-gray-500", text: "No Due Date" };
														}
													}
													const isExpanded =
														showLoanDetails[
															loan.id
														];

													return (
														<div
															key={loan.id}
															className="bg-blue-50/30 rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-blue-200 overflow-hidden w-full min-w-0"
														>
																															{/* Loan Header */}
															<div className="p-6 lg:p-8">
																<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 lg:mb-6 space-y-4 sm:space-y-0">
																	<div className="flex items-center space-x-4">
																		<div className="w-16 h-16 lg:w-20 lg:h-20 bg-blue-600/10 rounded-xl lg:rounded-2xl flex items-center justify-center border border-blue-600/20">
																			<CreditCardIcon className="h-8 w-8 lg:h-10 lg:w-10 text-blue-600" />
																		</div>
																		<div>
																			<div className="flex items-center space-x-3 mb-1">
																				<h4 className="text-lg lg:text-xl font-heading font-bold text-gray-700">
																					{
																						loan
																							.application
																							.product
																							.name
																					}
																				</h4>
																				{loan.status.toUpperCase() === "PENDING_DISCHARGE" && (
																					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 font-body">
																						<ClockIcon className="h-3 w-3 mr-1" />
																						Pending Discharge
																					</span>
																				)}
																				{loan.status.toUpperCase() === "PENDING_EARLY_SETTLEMENT" && (
																					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 font-body">
																						<ClockIcon className="h-3 w-3 mr-1" />
																						Early Settlement Pending
																					</span>
																				)}
																				{loan.defaultRiskFlaggedAt && !loan.defaultedAt && (
																					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 font-body">
																						<ExclamationTriangleIcon className="h-3 w-3 mr-1" />
																						Default Risk
																					</span>
																				)}
																				{loan.status.toUpperCase() === "DEFAULT" && (
																					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200 font-body">
																						<ExclamationTriangleIcon className="h-3 w-3 mr-1" />
																						Defaulted
																					</span>
																				)}
																			</div>
																			<p className="text-sm lg:text-base text-blue-600 font-semibold font-body">
																				ID: {loan.id
																					.slice(
																						0, 8
																					)
																					.toUpperCase()}
																			</p>
																		</div>
																	</div>
																	<div className="text-left sm:text-right">
																		{loan.canRepay && (
																			<button
																				onClick={() => {
																					setSelectedLoan(loan);
																					handleLoanRepayClick();
																				}}
																				className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
																				>
																				Make Payment
																				<ArrowRightIcon className="ml-2 h-4 w-4" />

																			</button>
																		)}
																	</div>
																</div>

																{/* Default Risk/Status Warning */}
																{(loan.defaultRiskFlaggedAt || loan.status.toUpperCase() === "DEFAULT") && (
																	<div className="mb-6">
																		{loan.defaultRiskFlaggedAt && !loan.defaultedAt && (
																			<div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
																				<div className="flex items-start">
																					<div className="flex-shrink-0">
																						<ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
																					</div>
																					<div className="ml-3 flex-1">
																						<h3 className="text-lg font-semibold text-amber-800 font-heading">
																								Default Risk Notice
																						</h3>
																						<div className="mt-2 text-sm text-amber-700 space-y-2">
																							<p>
																								Your loan has been flagged as at risk of default due to overdue payments. 
																								You have a <strong>16-day remedy period</strong> to clear all outstanding amounts.
																							</p>
																							<p>
																								<strong>Action Required:</strong> Please make payment immediately to avoid your loan being classified as defaulted.
																							</p>
																							
																						</div>
																					</div>
																				</div>
																			</div>
																		)}
																		{(loan.status.toUpperCase() === "DEFAULT" || loan.defaultedAt) && (
																			<div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-6">
																				<div className="flex items-start">
																					<div className="flex-shrink-0">
																						<ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
																					</div>
																					<div className="ml-3 flex-1">
																						<h3 className="text-lg font-semibold text-red-800 font-heading">
																							🚨 Loan Defaulted
																						</h3>
																						<div className="mt-2 text-sm text-red-700 space-y-2">
																							<p>
																								Your loan has been classified as defaulted. Please contact us immediately to discuss resolution options.
																							</p>
																							<p>
																								<strong>Contact:</strong> Our customer service team is available to help you resolve this matter.
																							</p>
																						</div>
																					</div>
																				</div>
																			</div>
																		)}
																	</div>
																)}

																{/* Simplified Loan Overview - Focus on key repayment info */}
																<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
																	{/* Repayment Progress Circle */}
																	<div className="flex flex-col items-center justify-center h-full">
																{(() => {
																			// Calculate progress based on principal amount
																			const totalOriginalAmount = loan.totalAmount || loan.principalAmount || 0;
																	let totalPrincipalPaid = 0;
																			
																	if (loan.repayments) {
																		loan.repayments.forEach(repayment => {
																			// For early settlement, use actualAmount as it includes all fees
																			const principalPaid = repayment.paymentType === "EARLY_SETTLEMENT" 
																				? (repayment.actualAmount || 0)
																				: (repayment.principalPaid ?? 
																					(repayment.status === "COMPLETED" ? repayment.amount : 
																					 repayment.status === "PARTIAL" ? (repayment.actualAmount || 0) : 0));
																			totalPrincipalPaid += principalPaid;
																		});
																	}
																	
																		// Handle special cases for PENDING_EARLY_SETTLEMENT and PENDING_DISCHARGE
																		const isPendingEarlySettlement = loan.status.toUpperCase() === "PENDING_EARLY_SETTLEMENT";
																		const isPendingDischarge = loan.status.toUpperCase() === "PENDING_DISCHARGE";
																		
																		const progressPercent = (isPendingEarlySettlement || isPendingDischarge)
																			? 100 // Show as complete for early settlement and pending discharge
																			: totalOriginalAmount > 0 
																				? Math.min(100, Math.max(0, Math.round((totalPrincipalPaid / totalOriginalAmount) * 100)))
																				: 0;
																			
																			const circumference = 2 * Math.PI * 45;
																			const strokeDasharray = circumference;
																			const strokeDashoffset = circumference - (progressPercent / 100) * circumference;
																	
																	return (
																				<>
																					<div className="relative w-48 h-48 mb-4">
																						<svg
																							className="w-48 h-48 transform -rotate-90"
																							viewBox="0 0 100 100"
																						>
																							{/* Background circle */}
																							<circle
																								cx="50"
																								cy="50"
																								r="45"
																								stroke="currentColor"
																								strokeWidth="8"
																								fill="transparent"
																								className="text-gray-200"
																							/>
																							{/* Progress circle */}
																							<circle
																								cx="50"
																								cy="50"
																								r="45"
																								stroke="currentColor"
																								strokeWidth="8"
																								fill="transparent"
																								strokeDasharray={strokeDasharray}
																								strokeDashoffset={strokeDashoffset}
																								className="text-blue-600 transition-all duration-300"
																								strokeLinecap="round"
																							/>
																						</svg>
																						{/* Percentage in center */}
																						<div className="absolute inset-0 flex items-center justify-center">
																							<div className="text-center">
																				<div className="text-xl lg:text-2xl font-heading font-bold text-gray-700">
																					{(isPendingEarlySettlement || isPendingDischarge) ? "✓" : `${progressPercent}%`}
																			</div>
																			<div className="text-sm text-gray-500 font-body">
																				{isPendingEarlySettlement ? "Settlement Pending" : 
																				 isPendingDischarge ? "Awaiting Discharge" : "Repaid"}
																			</div>
																							</div>
																						</div>
																					</div>
																					<div className="text-center">
																						<p className="text-lg xl:text-xl font-heading font-bold text-blue-600">
																					{isPendingEarlySettlement 
																						? "Early Settlement" 
																						: isPendingDischarge
																						? "Loan Settled"
																						: formatCurrency(totalPrincipalPaid)
																					}
																		</p>
																						<p className="text-sm lg:text-base text-gray-500 font-body">
																							{isPendingEarlySettlement 
																								? "Awaiting admin approval" 
																								: isPendingDischarge
																								? "Awaiting final discharge"
																								: `of ${formatCurrency(totalOriginalAmount)} repaid`
																							}
																		</p>
																	</div>
																				</>
																			);
																		})()}
																	</div>

																	{/* Next Payment Amount */}
																	<div className="text-left">
																		{(() => {
																			// Don't show payment info for settled loans
																			const isSettledLoan = loan.status.toUpperCase() === "PENDING_EARLY_SETTLEMENT" || 
																			                     loan.status.toUpperCase() === "PENDING_DISCHARGE";
																			
																			if (isSettledLoan) {
																				return (
																					<div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 h-full flex flex-col p-6">
																						<div className="flex items-center mb-4">
																							<div className="w-12 h-12 lg:w-14 lg:h-14 bg-green-600/10 rounded-xl flex items-center justify-center mr-3">
																								<svg className="h-6 w-6 lg:h-7 lg:w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
																								</svg>
																							</div>
																							<div>
																								<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																									{loan.status.toUpperCase() === "PENDING_EARLY_SETTLEMENT" ? "Settlement Status" : "Loan Status"}
																								</h4>
																							</div>
																						</div>
																						<div className="space-y-4 lg:space-y-6">
																							<div>
																								<p className="text-xl lg:text-2xl font-heading font-bold text-green-700 mb-3">
																									{loan.status.toUpperCase() === "PENDING_EARLY_SETTLEMENT" ? "Settlement Pending" : "Fully Settled"}
																								</p>
																							</div>
																							<div className="text-base lg:text-lg text-green-600 font-body leading-relaxed">
																								{loan.status.toUpperCase() === "PENDING_EARLY_SETTLEMENT" 
																									? "Awaiting admin approval" 
																									: "Awaiting final discharge"}
																							</div>
																						</div>
																					</div>
																				);
																			}
																			
																			const nextPayment = loan.nextPaymentInfo || {
																					amount: loan.monthlyPayment,
																				isOverdue: false,
																				includesLateFees: false,
																				description: "Monthly Payment",
																			};
																			
																			// Check for overdue payments
																			const hasOverduePayments = loan.overdueInfo?.hasOverduePayments;
																			const overdueAmount = loan.overdueInfo?.totalOverdueAmount || 0;
																			const lateFees = loan.overdueInfo?.totalLateFees || 0;
																			const totalDue = hasOverduePayments ? (overdueAmount + lateFees) : nextPayment.amount;
																			
													// Use different themes based on payment status (grace period UI removed)
													const isOverdue = hasOverduePayments || nextPayment.isOverdue;
													
													// Determine card styling based on payment status
													let cardColors, iconColor, textColor, amountColor, cardTitle;
													if (isOverdue) {
														// Red theme for overdue payments
														cardColors = "from-red-50 to-red-100 border-red-200";
														iconColor = "bg-red-400";
														textColor = "text-red-700";
														amountColor = "text-red-600";
														cardTitle = "Total Amount Due";
													} else {
														// Blue theme for regular payments
														cardColors = "from-blue-50 to-blue-100 border-blue-200";
														iconColor = "bg-blue-400";
														textColor = "text-blue-700";
														amountColor = "text-blue-700";
														cardTitle = "Next Payment";
													}
																			
																			return (
																<>
																	<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																		<div className="flex items-center mb-4">
																			<div className={`w-12 h-12 lg:w-14 lg:h-14 ${isOverdue ? 'bg-red-600/10' : 'bg-blue-600/10'} rounded-xl flex items-center justify-center mr-3`}>
																				{isOverdue ? (
																									<svg className="h-6 w-6 lg:h-7 lg:w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.982 16.5c-.77.833.192 2.5 1.732 2.5z" />
																									</svg>
																								) : (
																									<svg className="h-6 w-6 lg:h-7 lg:w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
																									</svg>
																								)}
																							</div>
																							<div>
																								<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																									{cardTitle}
																								</h4>
																							</div>
																						</div>
																						<div className="space-y-4 lg:space-y-6">
																							<div>
																								<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																									{totalDue > 0 ? formatCurrency(totalDue) : "Fully Paid"}
																								</p>
																							</div>
															<div className="text-base lg:text-lg text-gray-600 font-body leading-relaxed">
																{hasOverduePayments && (
																	<div className="space-y-2">
																		<div className="space-y-1">
																											<p className="text-sm text-red-600 font-body">
																												Overdue: {formatCurrency(overdueAmount)}
																											</p>
																											{lateFees > 0 && (
																												<p className="text-sm text-red-600 font-body">
																													Late Fees: {formatCurrency(lateFees)}
																												</p>
																											)}
																										</div>
																									</div>
																								)}
																								{!hasOverduePayments && nextPayment.includesLateFees && (
																									<p className="text-sm text-red-600 font-body">
																										Includes late fees
																									</p>
																								)}
																							</div>
																						</div>
																					</div>
																				</>
																			);
																		})()}
																	</div>

																	{/* Next Payment Date */}
																	<div className="text-left">
																		{(() => {
																			// Don't show due date for settled loans
																			const isSettledLoan = loan.status.toUpperCase() === "PENDING_EARLY_SETTLEMENT" || 
																			                     loan.status.toUpperCase() === "PENDING_DISCHARGE";
																			
																			if (isSettledLoan) {
																				return (
																					<div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 h-full flex flex-col p-6">
																						<div className="flex items-center mb-4">
																							<div className="w-12 h-12 lg:w-14 lg:h-14 bg-green-600/10 rounded-xl flex items-center justify-center mr-3">
																								<svg className="h-6 w-6 lg:h-7 lg:w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
																								</svg>
																							</div>
																							<div>
																								<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																									Completion Status
																								</h4>
																							</div>
																						</div>
																						<div className="space-y-4 lg:space-y-6">
																							<div>
																								<p className="text-xl lg:text-2xl font-heading font-bold text-green-700 mb-3">
																									No Further Payments
																								</p>
																							</div>
																							<div className="text-base lg:text-lg text-green-600 font-body leading-relaxed">
																								{loan.status.toUpperCase() === "PENDING_EARLY_SETTLEMENT" 
																									? "Settlement under review" 
																									: "Loan fully settled"}
																							</div>
																						</div>
																					</div>
																				);
																			}
																			
																			// Check for overdue payments for styling
																			const hasOverduePayments = loan.overdueInfo?.hasOverduePayments;
																			const maxDaysOverdue = hasOverduePayments && loan.overdueInfo?.overdueRepayments && loan.overdueInfo.overdueRepayments.length > 0
																				? Math.max(...loan.overdueInfo.overdueRepayments.map(rep => rep.daysOverdue))
																				: 0;
																			
																			// Calculate days until due for color coding
																			const dueDateToUse = getCorrectDueDate(loan);
																			const daysUntilDue = dueDateToUse ? calculateDaysUntilDue(dueDateToUse) : 0;
																			let cardColors, iconColor, textColor;
																			
																			if (hasOverduePayments) {
																				// Red theme for overdue
																				cardColors = "from-red-50 to-red-100 border-red-200";
																				iconColor = "bg-red-500";
																				textColor = "text-red-700";
																			} else if (daysUntilDue <= 3) {
																				// Orange theme for upcoming (3 days or less)
																				cardColors = "from-orange-50 to-orange-100 border-orange-200";
																				iconColor = "bg-orange-500";
																				textColor = "text-orange-700";
																			} else {
																				// Green theme for normal (more than 3 days)
																				cardColors = "from-green-50 to-green-100 border-green-200";
																				iconColor = "bg-green-500";
																				textColor = "text-green-700";
																			}

																		return (
																				<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																					<div className="flex items-center mb-4">
																						<div className={`w-12 h-12 lg:w-14 lg:h-14 ${hasOverduePayments ? 'bg-red-600/10' : (daysUntilDue <= 3 ? 'bg-orange-600/10' : 'bg-green-600/10')} rounded-xl flex items-center justify-center mr-3`}>
																							{hasOverduePayments ? (
																								<svg className="h-6 w-6 lg:h-7 lg:w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.982 16.5c-.77.833.192 2.5 1.732 2.5z" />
																								</svg>
																							) : (
																								<svg className={`h-6 w-6 lg:h-7 lg:w-7 ${daysUntilDue <= 3 ? 'text-orange-600' : 'text-green-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
																									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
																								</svg>
																							)}
																	</div>
																	<div>
																							<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																								{hasOverduePayments ? "Payment Overdue" : "Due Date"}
																							</h4>
																						</div>
																					</div>
																					<div className="space-y-4 lg:space-y-6">
																		{(() => {
																			// Get the correct due date using our helper function
																			const displayDate = getCorrectDueDate(loan);
																			
																			return displayDate ? (
																				<>
																					<div>
																						<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																							{formatDate(displayDate)}
																						</p>
																					</div>
																					<div className="text-base lg:text-lg text-gray-600 font-body leading-relaxed">
																						{hasOverduePayments && maxDaysOverdue > 0 ? `${urgency.text} by ${maxDaysOverdue} day${maxDaysOverdue !== 1 ? "s" : ""}` : urgency.text}
																					</div>
																				</>
																			) : (
																				<div>
																					<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																						N/A
																					</p>
																				</div>
																			);
																		})()}
																					</div>
																		</div>
																	);
																})()}
																	</div>

																	
																</div>

																{/* View Details Button - Subtle and Centered */}
																<div className="flex justify-center mt-6">
																	<button
																		onClick={() => toggleLoanDetails(loan.id)}
																		className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors font-body border border-blue-200 hover:border-blue-300"
																	>
																		{isExpanded ? "Hide Details" : "View Details"}
																		{isExpanded ? (
																			<ChevronUpIcon className="ml-2 h-4 w-4" />
																		) : (
																			<ChevronDownIcon className="ml-2 h-4 w-4" />
																		)}
																	</button>
																</div>
																															</div>

															{/* Expanded Loan Details */}
															{isExpanded && (
																<div className="p-6 lg:p-8 border-t border-gray-200 bg-gray-50/30">
																	{/* Key Financial Details Grid */}
																	<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
																		{(() => {
																			// Calculate totals for display
																		let totalPrincipalPaid = 0;
																			let totalLateFeesPaid = 0;
																			let totalLateFeesAssessed = 0;
																		
																		if (loan.repayments) {
																			loan.repayments.forEach(repayment => {
																					totalLateFeesPaid += repayment.lateFeesPaid || 0;
																					totalLateFeesAssessed += repayment.lateFeeAmount || 0;
																				// For early settlement, use actualAmount as it includes all fees
																				const principalPaid = repayment.paymentType === "EARLY_SETTLEMENT" 
																					? (repayment.actualAmount || 0)
																					: (repayment.principalPaid ?? 
																						(repayment.status === "COMPLETED" ? repayment.amount : 
																						 repayment.status === "PARTIAL" ? (repayment.actualAmount || 0) : 0));
																				totalPrincipalPaid += principalPaid;
																				});
																			}

																			const performance = calculatePaymentPerformance(loan);

																		return (
																			<>
																					{/* Outstanding Balance */}
																					<div className="bg-white p-4 rounded-lg border border-gray-200">
																						<p className="text-sm text-gray-500 mb-1 font-body">
																							Outstanding Balance
																						</p>
																						<p className="text-lg font-semibold text-gray-600 font-heading">
																							{(() => {
																								const isPendingSettlement = loan.status.toUpperCase() === "PENDING_EARLY_SETTLEMENT" || 
																															loan.status.toUpperCase() === "PENDING_DISCHARGE";
																								return formatCurrency(isPendingSettlement ? 0 : (loan.outstandingBalance || 0));
																							})()}
																						</p>
																					</div>

																					{/* Payment Performance */}
																					<div className="bg-white p-4 rounded-lg border border-gray-200">
																						<p className="text-sm text-gray-500 mb-1 font-body">
																							Payment Performance
																						</p>
																						{performance.percentage !== null ? (
																							<>
																								<p className={`text-lg font-semibold font-heading ${getPerformanceColor(performance.percentage)}`}>
																									{performance.percentage}%
																								</p>
																								<p className="text-xs text-gray-500 font-body">
																									{performance.onTimeCount} on-time
																									{performance.settledEarlyCount > 0 && (
																										<span className="text-purple-500"> / {performance.settledEarlyCount} settled early</span>
																									)}
																									{performance.lateCount > 0 && (
																										<span className="text-orange-500"> / {performance.lateCount} late</span>
																									)}
																									{performance.missedCount > 0 && (
																										<span className="text-red-500"> / {performance.missedCount} missed</span>
																									)}
																								</p>
																								<p className="text-xs text-gray-400 font-body">
																									of {performance.totalCount} scheduled
																								</p>
																							</>
																						) : (
																							<>
																								<p className="text-lg font-semibold text-gray-500 font-heading">
																									N/A
																								</p>
																								<p className="text-xs text-gray-500 font-body">
																									No payments yet
																								</p>
																							</>
																						)}
																				</div>

																					{/* Total Principal Paid */}
																					<div className="bg-white p-4 rounded-lg border border-gray-200">
																						<p className="text-sm text-gray-500 mb-1 font-body">
																							Total Paid
																						</p>
																						<p className="text-lg font-semibold text-blue-600 font-heading">
																							{formatCurrency(totalPrincipalPaid)}
																						</p>
																				</div>

																					{/* Late Fees if any */}
																					{totalLateFeesAssessed > 0 && (
																						<div className="bg-white p-4 rounded-lg border border-gray-200">
																							<p className="text-sm text-gray-500 mb-1 font-body">
																								Late Fees Paid
																							</p>
																							<p className="text-lg font-semibold text-blue-600 font-heading">
																								{formatCurrency(totalLateFeesPaid)}
																							</p>
																							<p className="text-xs text-gray-500 font-body">
																								of {formatCurrency(totalLateFeesAssessed)} assessed
																							</p>
																				</div>
																					)}
																			</>
																		);
																	})()}
																</div>

																	{/* Repayment Schedule Table */}
																	<div className="mb-8">
																		<h5 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-6">
																			Repayment Schedule
																		</h5>
																		<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
																			{loan.repayments && loan.repayments.length > 0 ? (
																				<div className="overflow-x-auto">
																					<table className="w-full min-w-[600px]">
																						<thead className="bg-gray-50">
																							<tr>
																								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
																								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
																								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
																								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late Fees</th>
																								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
																								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
																								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cleared Date</th>
																								<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
																							</tr>
																						</thead>
																						<tbody className="bg-white divide-y divide-gray-200">
																							{loan.repayments
																								.sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0))
																								.map((repayment, index) => {
																									const totalDue = (repayment.amount || 0) + (repayment.lateFeeAmount || 0);
																									const isOverdue = repayment.status === "PENDING" && new Date(repayment.dueDate) < new Date();
																									
																									// Calculate payment amounts
																									// For early settlement, use actualAmount as it includes all fees
																									const principalPaid = repayment.paymentType === "EARLY_SETTLEMENT" 
																										? (repayment.actualAmount || 0)
																										: (repayment.principalPaid ?? 
																											(repayment.status === "COMPLETED" ? (repayment.amount || 0) : 
																											 repayment.status === "PARTIAL" ? (repayment.actualAmount || 0) : 0));
																									const lateFeesPaid = repayment.lateFeesPaid || 0;
																									const totalPaid = principalPaid + lateFeesPaid;
																									const remaining = Math.max(0, totalDue - totalPaid);
																									
																									// Calculate payment timing for cleared payments
																									const getPaymentTiming = () => {
																										if (!repayment.paidAt || (repayment.status !== "COMPLETED" && repayment.status !== "PARTIAL")) {
																											return null;
																										}
																										
																										const paidDate = new Date(repayment.paidAt);
																										const dueDate = new Date(repayment.dueDate);
																										const diffTime = paidDate.getTime() - dueDate.getTime();
																										const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
																										
																										if (diffDays < 0) {
																											return { type: "early", days: Math.abs(diffDays), color: "text-green-600" };
																										} else if (diffDays > 0) {
																											return { type: "late", days: diffDays, color: "text-red-600" };
																										} else {
																											return { type: "onTime", days: 0, color: "text-blue-600" };
																										}
																									};
																									
																									const paymentTiming = getPaymentTiming();
																									
																									return (
																										<tr key={repayment.id} className="hover:bg-gray-50">
																											<td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
																												{repayment.installmentNumber || index + 1}
																											</td>
																											<td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
																												{formatDate(repayment.dueDate)}
																											</td>
																											<td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
																												<div className="flex flex-col">
																													<div className="flex items-center space-x-1">
																														<span>{formatCurrency(repayment.amount || 0)}</span>
																														{/* Show tooltip for special payment types */}
																														{repayment.paymentType === "EARLY_SETTLEMENT" ? (
																															<div className="relative group">
																																<svg className="h-3 w-3 text-green-500 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
																																</svg>
																																<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
																																	Early Settlement Payment
																																	<br />
																																	Includes remaining principal + fees - discount
																																	<div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
																																</div>
																															</div>
																														) : (
																															/* Show prorated interest info for first payment if amount is different from regular monthly payment */
																															(repayment.installmentNumber === 1 || (index === 0 && !repayment.installmentNumber)) && 
																															 Math.abs((repayment.amount || 0) - loan.monthlyPayment) > 1 && (
																																<div className="relative group">
																																	<svg className="h-3 w-3 text-blue-500 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
																																	</svg>
																																	<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
																																		{(() => {
																																			// Calculate approximate days based on amount difference
																																			// Assuming monthly interest rate, estimate daily rate
																																			const monthlyInterestAmount = loan.principalAmount * (loan.interestRate / 100);
																																			const dailyInterestAmount = monthlyInterestAmount / 30; // Approximate 30 days per month
																																			const amountDifference = Math.abs((repayment.amount || 0) - loan.monthlyPayment);
																																			const estimatedDays = Math.round(amountDifference / dailyInterestAmount);
																																			
																																			// Get disbursed date and first due date to calculate actual days
																																			const disbursedDate = new Date(loan.disbursedAt);
																																			const firstDueDate = new Date(repayment.dueDate);
																																			const disbursedDay = disbursedDate.getDate();
																																			const dueDay = firstDueDate.getDate();
																																			
																																			// Calculate actual days in first period
																																			let actualDays;
																																			if (disbursedDate.getMonth() === firstDueDate.getMonth()) {
																																				// Same month disbursement
																																				actualDays = dueDay - disbursedDay;
																																			} else {
																																				// Cross-month disbursement
																																				const daysInDisbursedMonth = new Date(disbursedDate.getFullYear(), disbursedDate.getMonth() + 1, 0).getDate();
																																				const remainingDaysInDisbursedMonth = daysInDisbursedMonth - disbursedDay + 1;
																																				actualDays = remainingDaysInDisbursedMonth + dueDay;
																																			}
																																			
																																			// Use actual days if reasonable, otherwise use estimated
																																			const daysToShow = (actualDays > 0 && actualDays <= 45) ? actualDays : estimatedDays;
																																			
																																			return (repayment.amount || 0) > loan.monthlyPayment ? (
																																				<>
																																					This payment includes prorated interest
																																					<br />
																																					for {daysToShow} days ({formatCurrency((repayment.amount || 0) - loan.monthlyPayment)} extra)
																																				</>
																																			) : (
																																				<>
																																					This payment is prorated for {daysToShow} days
																																					<br />
																																					({formatCurrency(loan.monthlyPayment - (repayment.amount || 0))} less than regular)
																																				</>
																																			);
																																		})()}
																																		<div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
																																	</div>
																																</div>
																															)
																														)}
																													</div>
																													{totalPaid > 0 && (
																														<span className="text-xs text-green-600 font-medium">
																															Paid: {formatCurrency(principalPaid)}
																														</span>
																													)}
																												</div>
																											</td>
																											<td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
																												{(repayment.lateFeeAmount || 0) > 0 ? (
																													<div className="flex flex-col">
																														<span className="text-red-600">{formatCurrency(repayment.lateFeeAmount || 0)}</span>
																														<span className="text-xs text-green-600 font-medium">
																															Paid: {formatCurrency(lateFeesPaid)} of {formatCurrency(repayment.lateFeeAmount || 0)}
																														</span>
																													</div>
																												) : (
																													<span className="text-gray-400">-</span>
																												)}
																											</td>
																											<td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
																												{formatCurrency(remaining)}
																											</td>
																											<td className="px-4 py-3 whitespace-nowrap">
																												{(() => {
																													if (repayment.status === "COMPLETED") {
																														return (
																															<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
																																<CheckCircleIcon className="h-3 w-3 mr-1" />
																																Paid
																															</span>
																														);
																													} else if (repayment.status === "PAID" || repayment.status === "COMPLETED") {
																														return (
																															<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
																																<CheckCircleIcon className="h-3 w-3 mr-1" />
																																Paid
																															</span>
																														);
																													} else if (repayment.status === "PARTIAL") {
																														return (
																															<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
																																<ClockIcon className="h-3 w-3 mr-1" />
																																Partial
																															</span>
																														);
																													} else if (repayment.status === "CANCELLED") {
																														return (
																															<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
																																<XMarkIcon className="h-3 w-3 mr-1" />
																										Cancelled
																									</span>
																								);
																							} else if (isOverdue) {
																														return (
																															<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
																																<ExclamationTriangleIcon className="h-3 w-3 mr-1" />
																																Overdue
																															</span>
																														);
																													} else {
																														return (
																															<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
																																<ClockIcon className="h-3 w-3 mr-1" />
																																Pending
																															</span>
																														);
																													}
																												})()}
																											</td>
																											<td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
																												{repayment.paidAt ? (
																													<div className="flex flex-col">
																														<span>{formatDate(repayment.paidAt)}</span>
																														{repayment.paymentType === "EARLY_SETTLEMENT" ? (
																															<span className="text-xs font-medium text-purple-600">
																																Early Settlement
																															</span>
																														) : paymentTiming && (
																															<span className={`text-xs font-medium ${paymentTiming.color}`}>
																																{paymentTiming.type === "early" 
																																	? `${paymentTiming.days} day${paymentTiming.days !== 1 ? "s" : ""} early`
																																	: paymentTiming.type === "late"
																																	? `${paymentTiming.days} day${paymentTiming.days !== 1 ? "s" : ""} late`
																																	: "On time"
																																}
																															</span>
																														)}
																													</div>
																												) : (
																													<span className="text-gray-400">-</span>
																												)}
																											</td>
																											{/* Receipt Column */}
																											<td className="px-4 py-3 text-sm text-gray-700">
																												{(repayment.status === "COMPLETED" || repayment.status === "PAID" || repayment.status === "PARTIAL" || repayment.status === "CANCELLED") && repayment.receipts && repayment.receipts.length > 0 ? (
																													<div className="flex flex-wrap items-center gap-1">
																														{repayment.receipts.map((receipt) => (
																															<button
																																key={receipt.id}
																																onClick={() => downloadReceipt(loan.id, receipt.id, receipt.receiptNumber)}
																																className="flex items-center px-2 py-1 bg-green-100 text-green-700 rounded border border-green-200 hover:bg-green-200 transition-colors text-xs font-medium"
																																title={`Download receipt ${receipt.receiptNumber}`}
																															>
																																<svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
																																</svg>
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
																								})}
																						</tbody>
																					</table>
																				</div>
																			) : (
																				<div className="text-center py-8">
																					<CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
																					<p className="text-gray-500 font-body">No repayment schedule available</p>
																				</div>
																			)}
																		</div>
																	</div>

																	<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
																		{/* Loan Information */}
																		<div>
																			<h5 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-6">
																				Loan Information
																			</h5>
																			<div className="space-y-4 text-base">
																				<div className="flex justify-between">
																					<span className="text-gray-600 font-body">
																						Principal Amount
																					</span>
																					<span className="font-semibold text-gray-700 font-body">
																						{formatCurrency(loan.principalAmount)}
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-600 font-body">
																						Monthly Payment
																					</span>
																					<span className="font-semibold text-gray-700 font-body">
																						{formatCurrency(loan.monthlyPayment)}
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-600 font-body">
																						Interest Rate
																					</span>
																					<span className="font-semibold text-gray-700 font-body">
																						{loan.interestRate}% per month
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-600 font-body">
																						Loan Term
																					</span>
																					<span className="font-semibold text-gray-700 font-body">
																						{loan.term} months
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-600 font-body">
																						Disbursed Date
																					</span>
																					<span className="font-semibold text-gray-700 font-body">
																						{formatDate(loan.disbursedAt)}
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-600 font-body">
																						Application Date
																					</span>
																					<span className="font-semibold text-gray-700 font-body">
																						{formatDate(loan.application.createdAt)}
																					</span>
																				</div>
																			</div>
																		</div>

																		{/* Agreement Information */}
																		{(loan.agreementStatus || loan.agreementSignedAt || loan.docusealSubmissionId) && (
																			<div>
																				<h5 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-6">
																					Loan Agreement
																				</h5>
																				<div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
																					{loan.agreementStatus && (
																						<div className="flex justify-between">
																							<span className="text-gray-600 font-body">
																								Agreement Status
																							</span>
																							<span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
																								loan.agreementStatus === 'SIGNED' 
																									? 'bg-green-100 text-green-700 border border-green-200'
																									: loan.agreementStatus === 'PENDING_SIGNATURE'
																									? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
																									: loan.agreementStatus === 'COMPANY_SIGNED'
																									? 'bg-blue-100 text-blue-700 border border-blue-200'
																									: loan.agreementStatus === 'BORROWER_SIGNED'
																									? 'bg-purple-100 text-purple-700 border border-purple-200'
																									: loan.agreementStatus === 'WITNESS_SIGNED'
																									? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
																									: 'bg-gray-100 text-gray-700 border border-gray-200'
																							}`}>
																								{loan.agreementStatus === 'SIGNED' ? 'Signed' :
																								 loan.agreementStatus === 'PENDING_SIGNATURE' ? 'Pending Signature' :
																								 loan.agreementStatus === 'COMPANY_SIGNED' ? 'Waiting for Other Signatories' :
																								 loan.agreementStatus === 'BORROWER_SIGNED' ? 'Waiting for Other Signatories' :
																								 loan.agreementStatus === 'WITNESS_SIGNED' ? 'Waiting for Completion' :
																								 loan.agreementStatus}
																							</span>
																						</div>
																					)}
																					{loan.agreementSignedAt && (
																						<div className="flex justify-between">
																							<span className="text-gray-600 font-body">
																								Signed Date
																							</span>
																							<span className="font-semibold text-gray-700 font-body">
																			{formatDateTime(loan.agreementSignedAt)}
																		</span>
																	</div>
																)}
																{loan.agreementStatus === 'SIGNED' && (
																	<div className="pt-3 border-t border-gray-100">
																		<h6 className="text-sm font-medium text-gray-600 mb-3">Download Loan Documents</h6>
																		<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
														{/* Unsigned Agreement */}
														<button
															onClick={async () => {
															try {
																// Get token from storage
																const token = typeof window !== 'undefined' 
																	? localStorage.getItem('token') || Cookies.get('token')
																	: null;
																
																if (!token) {
																	throw new Error('No authentication token found');
																}
																
																const response = await fetch(
																	`/api/loan-applications/${loan.application.id}/unsigned-agreement`,
																	{ 
																		method: 'GET',
																		headers: {
																			'Authorization': `Bearer ${token}`
																		}
																	}
																);
																if (response.ok) {
																	const data = await response.json();
																	if (data.url) {
																		// Open DocuSeal URL in new tab
																		window.open(data.url, '_blank');
																	} else {
																		throw new Error('No URL returned');
																	}
																} else {
																	throw new Error('Failed to get unsigned agreement');
																}
															} catch (error) {
																console.error('Error opening unsigned agreement:', error);
																toast.error('Failed to open unsigned agreement');
															}
															}}
															className="inline-flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
														>
															<DocumentTextIcon className="h-4 w-4 mr-2" />
															Unsigned
														</button>
																			
																			{/* Signed Agreement */}
																			<button
																				onClick={() => downloadSignedAgreement(loan)}
																				className="inline-flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
																			>
																				<CheckCircleIcon className="h-4 w-4 mr-2" />
																				Signed
																			</button>
																			
																			{/* Stamp Certificate */}
																			<button
																				onClick={() => downloadStampCertificate(loan)}
																				disabled={!loan.pkiStampCertificateUrl}
																				className={`inline-flex items-center justify-center px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
																					loan.pkiStampCertificateUrl
																						? 'bg-purple-600 text-white hover:bg-purple-700'
																						: 'bg-gray-300 text-gray-500 cursor-not-allowed'
																				}`}
																				title={!loan.pkiStampCertificateUrl ? 'Stamp certificate pending' : 'Download stamp certificate'}
																			>
																				<DocumentCheckIcon className="h-4 w-4 mr-2" />
																				Certificate
																			</button>
																		</div>
																	</div>
																)}

																{/* Disbursement Information */}
																{loan.application?.disbursement && (
																	<div className="pt-3 border-t border-gray-100">
																		<h6 className="text-sm font-medium text-gray-600 mb-3">Disbursement Information</h6>
																		<div className="space-y-2 mb-3">
																			<div className="flex justify-between text-sm">
																				<span className="text-gray-600">Reference</span>
																				<span className="font-medium text-gray-700">{loan.application.disbursement.referenceNumber}</span>
																			</div>
																			<div className="flex justify-between text-sm">
																				<span className="text-gray-600">Disbursed Date</span>
																				<span className="font-medium text-gray-700">
																					{new Date(loan.application.disbursement.disbursedAt).toLocaleDateString("en-MY", {
																						day: "numeric",
																						month: "short",
																						year: "numeric",
																					})}
																				</span>
																			</div>
																			<div className="flex justify-between text-sm">
																				<span className="text-gray-600">Amount</span>
																				<span className="font-medium text-green-600">
																					{new Intl.NumberFormat("en-MY", {
																						style: "currency",
																						currency: "MYR",
																					}).format(loan.application.disbursement.amount)}
																				</span>
																			</div>
																		</div>
																		{loan.application.disbursement.paymentSlipUrl && (
																			<button
																				onClick={() => downloadDisbursementSlip(loan)}
																				className="w-full inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
																			>
																				<DocumentTextIcon className="h-4 w-4 mr-2" />
																				Download Payment Slip
																			</button>
																		)}
																	</div>
																)}
															</div>
														</div>
													)}

													{/* Recent Payments */}
																		<div>
																			<h5 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-6">
																				Recent Payments
																			</h5>
																			{loadingTransactions[
																				loan
																					.id
																			] ? (
																				<div className="flex items-center justify-center py-4">
																					<div className="w-6 h-6 border-2 border-blue-tertiary border-t-transparent rounded-full animate-spin"></div>
																					<span className="ml-2 text-sm text-gray-500">
																						Loading
																						payments...
																					</span>
																				</div>
																			) : loanTransactions[
																					loan
																						.id
																			  ] &&
																			  loanTransactions[
																					loan
																						.id
																			  ]
																					.length >
																					0 ? (
																				<div className="space-y-2">
																					{loanTransactions[
																						loan
																							.id
																					]
																						.slice(
																							0,
																							3
																						)
																						.map(
																							(
																								transaction: WalletTransaction
																							) => (
																								<div
																									key={
																										transaction.id
																									}
																									className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
																								>
																									<div className="flex-1 min-w-0">
																										<p className="text-sm font-medium text-gray-700">
																											{formatCurrency(
																												transaction.amount
																											)}
																										</p>
																										<p className="text-xs text-gray-500">
																											{formatDateTime(
																												transaction.createdAt
																											)}
																										</p>
																										{transaction.reference && (
																											<p className="text-xs text-gray-500 truncate">
																												Ref: {transaction.reference}
																											</p>
																										)}
																									</div>
																									<div className="flex-shrink-0 ml-3">
																										{getStatusBadge(
																											transaction.status
																										)}
																									</div>
																								</div>
																							)
																						)}
																					{loanTransactions[
																						loan
																							.id
																					]
																						.length >
																						3 && (
																						<p className="text-xs text-gray-500 text-center mt-2">
																							Showing
																							latest
																							3
																							payments
																						</p>
																					)}
																					{/* See All Button */}
																					{loanTransactions[loan.id]?.length > 0 && (
																						<div className="flex justify-center mt-3">
																							<button
																								onClick={() => {
																									router.push('/dashboard/transactions?filter=LOAN_REPAYMENT');
																								}}
																								className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 hover:bg-blue-50"
																							>
																								See All Payments
																							</button>
																						</div>
																					)}
																				</div>
																			) : (
																				<div className="text-center py-4">
																					<p className="text-sm text-gray-500 mb-2">
																						No
																						payment
																						history
																						available
																					</p>
																					<p className="text-xs text-gray-500">
																						Payment
																						history
																						will
																						appear
																						here
																						once
																						you
																						make
																						your
																						first
																						payment
																					</p>
																				</div>
																			)}
																		</div>
																	</div>
																</div>
															)}
														</div>
													);
												})}
											</div>
										);
									} else {
										return (
											<div className="text-center py-12">
												<CreditCardIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
												<h4 className="text-xl font-medium text-gray-700 mb-2 font-heading">
													No Active Loans
												</h4>
												<p className="text-gray-500 mb-6 font-body">
													You don't have any active
													loans at the moment.
												</p>
												<Link
													href="/dashboard/apply"
													className="bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center px-6 py-3 text-base font-medium rounded-md transition-colors shadow-sm"
												>
													<PlusIcon className="h-5 w-5 mr-2" />
													Apply for Your First Loan
												</Link>
											</div>
										);
									}
								} else if (activeTab === "discharged") {
									// Discharged Loans Content
									const dischargedLoans = loans.filter(
										(loan) => {
											const status =
												loan.status.toUpperCase();
											return (
												[
													"DISCHARGED",
													"COMPLETED",
													"PAID",
													"CLOSED",
													"SETTLED",
												].includes(status) ||
												(loan.outstandingBalance ===
													0 &&
													status === "ACTIVE")
											);
										}
									);

									if (dischargedLoans.length > 0) {
										return (
											<div className="space-y-6 min-w-0">
												{dischargedLoans.map((loan) => {
													const isExpanded =
														showLoanDetails[
															loan.id
														];

													return (
														<div
															key={loan.id}
															className="bg-green-50/30 border border-green-200 rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden"
														>
															{/* Loan Header */}
															<div className="p-6 lg:p-8">
																<div className="flex items-center mb-4 lg:mb-6">
																	<div className="w-16 h-16 lg:w-20 lg:h-20 bg-green-600/10 rounded-xl lg:rounded-2xl flex items-center justify-center mr-4 border border-green-600/20">
																		<CheckCircleIcon className="h-8 w-8 lg:h-10 lg:w-10 text-green-600" />
																	</div>
																	<div>
																		<h4 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
																			{
																				loan
																					.application
																					.product
																					.name
																			}
																		</h4>
																		<p className="text-sm lg:text-base text-green-600 font-semibold">
																			ID: {loan.id
																				.slice(
																					0, 8
																				)
																				.toUpperCase()}
																		</p>
																	</div>
																</div>

																{/* Loan Summary Stats - Redesigned to match active loans */}
																<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
																	{/* Total Repaid */}
																	<div className="text-left">
																		{(() => {
																			// Calculate actual total repaid from repayments
																			const totalRepaid = loan.repayments?.reduce((total, repayment) => {
																				return total + (repayment.actualAmount || 0);
																			}, 0) || 0;

																			// Check if this is an early settlement
																			const hasEarlySettlement = loan.repayments?.some(
																				repayment => repayment.paymentType === 'EARLY_SETTLEMENT'
																			) || false;
																			
																			// Calculate interest saved correctly
																			// Original total interest = totalAmount - principalAmount
																			const originalTotalInterest = loan.totalAmount - loan.principalAmount;
																			
																			// Actual interest paid = sum of interestAmount from all COMPLETED repayments
																			const actualInterestPaid = loan.repayments?.reduce((total, repayment) => {
																				if (repayment.status === 'COMPLETED') {
																					return total + (repayment.interestAmount || 0);
																				}
																				return total;
																			}, 0) || 0;
																			
																			// Interest saved = original interest - actual interest paid
																			const interestSaved = Math.max(0, originalTotalInterest - actualInterestPaid);

																			return (
																				<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																					<div className="flex items-center mb-4">
																						<div className="w-12 h-12 lg:w-14 lg:h-14 bg-green-600/10 rounded-xl flex items-center justify-center mr-3">
																							<CheckCircleIcon className="h-6 w-6 lg:h-7 lg:w-7 text-green-600" />
																						</div>
																						<div className="flex-1">
																							<div className="flex items-center gap-2 mb-1">
																								<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700">
																									Total Repaid
																								</h4>
																								{hasEarlySettlement && (
																									<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
																										Early Settlement
																									</span>
																								)}
																							</div>
																						</div>
																					</div>
																					<div className="space-y-4 lg:space-y-6">
																						<div>
																							<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																								{formatCurrency(totalRepaid)}
																							</p>
																							{hasEarlySettlement && interestSaved > 0 && (
																								<p className="text-sm text-blue-600 font-medium">
																									Saved: {formatCurrency(interestSaved)} in interest
																								</p>
																							)}
																						</div>
																						<div className="text-base lg:text-lg text-gray-600 font-body leading-relaxed">
																							{hasEarlySettlement ? "Early settlement completed" : "Loan fully completed"}
																						</div>
																					</div>
																				</div>
																			);
																		})()}
																	</div>

																	{/* Payment Performance */}
																	<div className="text-left">
																		{(() => {
																			const performance = calculatePaymentPerformance(loan);
																			return (
																				<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																					<div className="flex items-center mb-4">
																						<div className="w-12 h-12 lg:w-14 lg:h-14 bg-green-600/10 rounded-xl flex items-center justify-center mr-3">
																							<ChartBarIcon className="h-6 w-6 lg:h-7 lg:w-7 text-green-600" />
																						</div>
																						<div>
																							<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																								Payment Performance
																							</h4>
																						</div>
																					</div>
																					<div className="space-y-4 lg:space-y-6">
																						<div>
																							{performance.percentage !== null ? (
																								<p className={`text-xl lg:text-2xl font-heading font-bold ${getPerformanceColor(performance.percentage)} mb-3`}>
																									{performance.percentage}%
																								</p>
																							) : (
																								<p className="text-xl lg:text-2xl font-heading font-bold text-gray-500 mb-3">
																									N/A
																								</p>
																							)}
																						</div>
																						<div className="text-base lg:text-lg text-gray-600 font-body leading-relaxed">
																							{performance.percentage !== null ? (
																								<>
																									<span>{performance.onTimeCount} on-time</span>
																									{performance.settledEarlyCount > 0 && (
																										<span className="text-purple-500"> / {performance.settledEarlyCount} settled early</span>
																									)}
																									{performance.lateCount > 0 && (
																										<span className="text-orange-500"> / {performance.lateCount} late</span>
																									)}
																									{performance.missedCount > 0 && (
																										<span className="text-red-500"> / {performance.missedCount} missed</span>
																									)}
																									<span className="block text-sm text-gray-400">of {performance.totalCount} scheduled</span>
																								</>
																							) : (
																								"No payments recorded"
																							)}
																						</div>
																					</div>
																				</div>
																			);
																		})()}
																	</div>

																	{/* Discharged Date */}
																	<div className="text-left">
																		<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																			<div className="flex items-center mb-4">
																																						<div className="w-12 h-12 lg:w-14 lg:h-14 bg-green-600/10 rounded-xl flex items-center justify-center mr-3">
																			<CalendarIcon className="h-6 w-6 lg:h-7 lg:w-7 text-green-600" />
																				</div>
																				<div>
																					<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																						Discharged Date
																					</h4>
																				</div>
																			</div>
																			<div className="space-y-4 lg:space-y-6">
																				<div>
																					<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																						{loan.dischargedAt ? formatDate(loan.dischargedAt) : formatDate(loan.disbursedAt)}
																					</p>
																				</div>
																				<div className="text-base lg:text-lg text-gray-600 font-body leading-relaxed">
																					Loan completion date
																				</div>
																			</div>
																		</div>
																	</div>
																</div>

																{/* Completion Badge */}
																<div className="mb-4">
																	<div className="flex items-center p-4 bg-green-50 rounded-xl border border-green-200">
																		<CheckCircleIcon className="h-8 w-8 text-green-600 mr-3" />
																		<div>
																			<p className="text-lg font-semibold text-green-700">
																				Loan Fully Repaid
																			</p>
																			<p className="text-sm text-gray-600">
																				Congratulations on completing your loan!
																			</p>
																		</div>
																	</div>
																</div>

																{/* View Details Button - Centered to match active loans */}
																<div className="flex justify-center mt-6">
																	<button
																		onClick={() =>
																			toggleLoanDetails(
																				loan.id
																			)
																		}
																		className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors font-body border border-blue-200 hover:border-blue-300"
																	>
																		{isExpanded
																			? "Hide Details"
																			: "View Details"}
																		{isExpanded ? (
																			<ChevronUpIcon className="ml-2 h-4 w-4" />
																		) : (
																			<ChevronDownIcon className="ml-2 h-4 w-4" />
																		)}
																	</button>
																</div>
															</div>

															{/* Expanded Loan Details */}
															{isExpanded && (
																<div className="p-6 lg:p-8 border-t border-gray-200 bg-gray-50/30">
																	<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
																		{/* Loan Information */}
																		<div>
																			<h5 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-6">
																				Loan Information
																			</h5>
																			<div className="space-y-3 text-sm lg:text-base">
																				<div className="flex justify-between py-2">
																					<span className="text-gray-500 font-body">
																						Principal Amount
																					</span>
																					<span className="font-medium text-gray-700 font-body">
																						{formatCurrency(loan.principalAmount)}
																					</span>
																				</div>
																				<div className="flex justify-between py-2">
																					<span className="text-gray-500 font-body">
																						Interest Rate
																					</span>
																					<span className="font-medium text-gray-700 font-body">
																						{loan.interestRate}% per month
																					</span>
																				</div>
																				<div className="flex justify-between py-2">
																					<span className="text-gray-500 font-body">
																						Loan Term
																					</span>
																					<span className="font-medium text-gray-700 font-body">
																						{loan.term} months
																					</span>
																				</div>
																				<div className="flex justify-between py-2">
																					<span className="text-gray-500 font-body">
																						Disbursed Date
																					</span>
																					<span className="font-medium text-gray-700 font-body">
																						{formatDate(loan.disbursedAt)}
																					</span>
																				</div>
																				<div className="flex justify-between py-2">
																					<span className="text-gray-500 font-body">
																						Application Date
																					</span>
																					<span className="font-medium text-gray-700 font-body">
																						{formatDate(loan.application.createdAt)}
																					</span>
																				</div>
																			</div>
																		</div>

																		{/* Agreement Information */}
																		{(loan.agreementStatus || loan.agreementSignedAt || loan.docusealSubmissionId) && (
																			<div>
																				<h5 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-6">
																					Loan Agreement
																				</h5>
																				<div className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
																					{loan.agreementStatus && (
																						<div className="flex justify-between py-2">
																							<span className="text-gray-500 font-body">
																								Agreement Status
																							</span>
																							<span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
																								loan.agreementStatus === 'SIGNED' 
																									? 'bg-green-100 text-green-700 border border-green-200'
																									: loan.agreementStatus === 'PENDING_SIGNATURE'
																									? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
																									: loan.agreementStatus === 'COMPANY_SIGNED'
																									? 'bg-blue-100 text-blue-700 border border-blue-200'
																									: loan.agreementStatus === 'BORROWER_SIGNED'
																									? 'bg-purple-100 text-purple-700 border border-purple-200'
																									: loan.agreementStatus === 'WITNESS_SIGNED'
																									? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
																									: 'bg-gray-100 text-gray-700 border border-gray-200'
																							}`}>
																								{loan.agreementStatus === 'SIGNED' ? 'Signed' :
																								 loan.agreementStatus === 'PENDING_SIGNATURE' ? 'Pending Signature' :
																								 loan.agreementStatus === 'COMPANY_SIGNED' ? 'Waiting for Other Signatories' :
																								 loan.agreementStatus === 'BORROWER_SIGNED' ? 'Waiting for Other Signatories' :
																								 loan.agreementStatus === 'WITNESS_SIGNED' ? 'Waiting for Completion' :
																								 loan.agreementStatus}
																							</span>
																						</div>
																					)}
																					{loan.agreementSignedAt && (
																						<div className="flex justify-between py-2">
																							<span className="text-gray-500 font-body">
																								Signed Date
																							</span>
																							<span className="font-medium text-gray-700 font-body">
																								{formatDateTime(loan.agreementSignedAt)}
																							</span>
																						</div>
																					)}
																					{loan.agreementStatus === 'SIGNED' && (
																						<div className="pt-3 border-t border-gray-100">
																							{(loan.pkiStampedPdfUrl || loan.pkiStampCertificateUrl) ? (
																								<div className="flex flex-wrap gap-2">
																									{loan.pkiStampedPdfUrl && (
																										<button
																											onClick={() => downloadStampedAgreement(loan)}
																											className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
																										>
																											<svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
																											</svg>
																											Download Stamped Agreement
																										</button>
																									)}
																									
																									{loan.pkiStampCertificateUrl && (
																										<button
																											onClick={() => downloadStampCertificate(loan)}
																											className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
																										>
																											<svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
																											</svg>
																											Download Certificate
																										</button>
																									)}
																								</div>
																							) : (
																								<div className="flex items-center p-3 bg-amber-50 border border-amber-200 rounded-lg">
																									<ClockIcon className="h-5 w-5 text-amber-600 mr-3" />
																									<div>
																										<p className="text-sm font-medium text-amber-800">
																											Waiting for loan stamping
																										</p>
																										<p className="text-xs text-amber-600 mt-1">
																											Your agreement has been signed and is being processed for final stamping.
																										</p>
																									</div>
																								</div>
																							)}
																						</div>
																					)}
																				</div>
																			</div>
																		)}

																		{/* Payment History */}
																		<div>
																			<h5 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-6">
																				Payment History
																			</h5>
																			{loadingTransactions[loan.id] ? (
																				<div className="flex items-center justify-center py-4">
																					<div className="w-6 h-6 border-2 border-blue-tertiary border-t-transparent rounded-full animate-spin"></div>
																					<span className="ml-2 text-sm text-gray-500">
																						Loading payments...
																					</span>
																				</div>
																			) : loanTransactions[loan.id] && loanTransactions[loan.id].length > 0 ? (
																				<div className="space-y-2">
																					{loanTransactions[loan.id]
																						.slice(0, 3)
																						.map((transaction: WalletTransaction) => (
																							<div
																								key={transaction.id}
																								className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
																							>
																								<div className="flex-1 min-w-0">
																									<p className="text-sm font-medium text-gray-700">
																										{formatCurrency(transaction.amount)}
																									</p>
																									<p className="text-xs text-gray-500">
																										{formatDateTime(transaction.createdAt)}
																									</p>
																									{transaction.reference && (
																										<p className="text-xs text-gray-500 truncate">
																											Ref: {transaction.reference}
																										</p>
																									)}
																								</div>
																								<div className="flex-shrink-0 ml-3">
																									{getStatusBadge(transaction.status)}
																								</div>
																							</div>
																						))}
																					{loanTransactions[loan.id].length > 3 && (
																						<p className="text-xs text-gray-500 text-center mt-2">
																							Showing latest 3 payments
																						</p>
																					)}
																					{/* See All Button */}
																					{loanTransactions[loan.id]?.length > 0 && (
																						<div className="flex justify-center mt-3">
																							<button
																								onClick={() => {
																									router.push('/dashboard/transactions?filter=LOAN_REPAYMENT');
																								}}
																								className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 hover:bg-blue-50"
																							>
																								See All Payments
																							</button>
																						</div>
																					)}
																				</div>
																			) : (
																				<div className="text-center py-4">
																					<p className="text-sm text-gray-500 mb-2">
																						No payment history available
																					</p>
																					<p className="text-xs text-gray-500">
																						Payment records may not be available for completed loans
																					</p>
																				</div>
																			)}
																		</div>
																	</div>
																</div>
															)}
														</div>
													);
												})}
											</div>
										);
									} else {
										return (
											<div className="text-center py-12">
												<CheckCircleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
												<h4 className="text-xl font-medium text-gray-700 mb-2 font-heading">
													No Discharged Loans
												</h4>
												<p className="text-gray-500 mb-6 font-body">
													Loans that have been fully
													repaid will appear here.
												</p>
											</div>
										);
									}
								} else if (activeTab === "applications") {
									// Applications Content (excluding ACTIVE, INCOMPLETE, REJECTED, and WITHDRAWN)
									const filteredApplications =
										applications.filter(
											(app) =>
												![
													"ACTIVE",
													"INCOMPLETE",
													"WITHDRAWN",
													"REJECTED",
												].includes(
													app.status.toUpperCase()
												)
										);

									if (filteredApplications.length > 0) {
										return (
											<div className="space-y-4">
												{filteredApplications.map(
													(app) => {
														const isExpanded =
															showApplicationDetails[
																app.id
															];

														return (
															<div
																key={app.id}
																className="bg-purple-50/30 border border-purple-200 rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden"
															>
																{/* Application Header */}
																<div className="p-6 lg:p-8">
																	<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 lg:mb-6 space-y-4 sm:space-y-0">
																		<div className="flex items-center space-x-4">
																			<div className="w-16 h-16 lg:w-20 lg:h-20 bg-purple-600/10 rounded-xl lg:rounded-2xl flex items-center justify-center border border-purple-600/20">
																				<DocumentTextIcon className="h-8 w-8 lg:h-10 lg:w-10 text-purple-600" />
																			</div>
																			<div>
																				<div className="flex items-center gap-3 mb-1">
																					<h4 className="text-lg lg:text-xl font-heading font-bold text-gray-700">
																					{app
																						.product
																						?.name ||
																						"Unknown Product"}
																				</h4>
																					{app.status === "PENDING_FRESH_OFFER" && (
																						<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800 border border-pink-200">
																							Fresh Offer
																						</span>
																					)}
																				</div>
																				<p className="text-sm lg:text-base text-purple-primary font-semibold">
																					ID: {app.id
																						.slice(
																							-8
																						)
																						.toUpperCase()}
																				</p>
																			</div>
																		</div>
																		<div className="text-left sm:text-right">
																			<div className="flex items-center space-x-3">
																				{app.status ===
																					"PENDING_ATTESTATION" && (
																					<>
																						{app.attestationType ===
																						"MEETING" ? (
																							<div className="flex items-center space-x-3">
																								<div className="flex items-center px-4 py-2 border border-purple-200 text-sm font-medium rounded-md text-purple-700 bg-purple-50">
																									<ClockIcon className="h-4 w-4 mr-2" />
																									Live
																									Call
																									Requested
																								</div>
																								<button
																									onClick={() =>
																										handleSwitchToInstantAttestation(
																											app
																										)
																									}
																									className="inline-flex items-center px-3 py-2 border border-cyan-200 text-sm font-medium rounded-md text-cyan-600 bg-cyan-50 hover:bg-cyan-100 transition-colors"
																									title="Switch to instant video attestation instead"
																								>
																									Switch
																									to
																									Instant
																								</button>
																							</div>
																						) : (
																							<button
																								onClick={() =>
																									handleAttestationMethodSelect(
																										app
																									)
																								}
																								className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-700 transition-colors"
																							>
																								Continue
																								Attestation
																								<ArrowRightIcon className="ml-2 h-4 w-4" />
																							</button>
																						)}
																					</>
																				)}
																												{app.status === "PENDING_SIGNING_OTP" && (
									<button
										onClick={() => router.push(`/dashboard/applications/${app.id}/otp-verification`)}
										className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 transition-colors"
									>
										<Shield className="h-4 w-4 mr-2" />
										Complete OTP Verification
										<ArrowRightIcon className="ml-2 h-4 w-4" />
									</button>
								)}
								{app.status === "PENDING_CERTIFICATE_OTP" && (
									<button
										onClick={() => router.push(`/dashboard/applications/${app.id}/otp-verification`)}
										className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 transition-colors"
									>
										<Shield className="h-4 w-4 mr-2" />
										Complete Certificate OTP
										<ArrowRightIcon className="ml-2 h-4 w-4" />
									</button>
								)}
								{app.status === "CERT_CHECK" && (
									<button
										onClick={() => router.push(`/dashboard/applications/${app.id}/cert-check`)}
										className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
									>
										<CheckIcon className="h-4 w-4 mr-2" />
										Complete Certificate Check
										<ArrowRightIcon className="ml-2 h-4 w-4" />
									</button>
								)}
								{app.status === "PENDING_KYC" && (
									<button
										onClick={() => router.push(`/dashboard/applications/${app.id}/kyc-verification`)}
										className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
									>
										<CheckIcon className="h-4 w-4 mr-2" />
										Complete KYC Verification
										<ArrowRightIcon className="ml-2 h-4 w-4" />
									</button>
								)}
								{app.status === "PENDING_PROFILE_CONFIRMATION" && (
									<button
										onClick={() => router.push(`/dashboard/applications/${app.id}/profile-confirmation`)}
										className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
									>
										<UserIcon className="h-4 w-4 mr-2" />
										Confirm Profile Details
										<ArrowRightIcon className="ml-2 h-4 w-4" />
									</button>
								)}
								{app.status === "PENDING_SIGNING_OTP_DS" && (
									<button
										onClick={() => router.push(`/dashboard/applications/${app.id}/signing-otp-verification`)}
										className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-violet-600 hover:bg-violet-700 transition-colors"
									>
										<DocumentCheckIcon className="h-4 w-4 mr-2" />
										Complete Signing Verification
										<ArrowRightIcon className="ml-2 h-4 w-4" />
									</button>
								)}
																				{app.status === "PENDING_FRESH_OFFER" && (
																					<div className="flex items-center space-x-3">
																						<button
																							onClick={() => handleFreshOfferResponse(app.id, 'accept')}
																							className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"
																						>
																							<CheckIcon className="h-4 w-4 mr-2" />
																							Accept Offer
																						</button>
																						<button
																							onClick={() => handleFreshOfferResponse(app.id, 'reject')}
																							className="inline-flex items-center px-4 py-2 border border-red-200 text-sm font-medium rounded-md text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
																						>
																							<XMarkIcon className="h-4 w-4 mr-2" />
																							Reject Offer
																						</button>
																					</div>
																				)}
																																{app.status === "PENDING_SIGNATURE" && (
													<div className="space-y-2">
														{/* Show different messages based on agreement status */}
														{(() => {
															const statusInfo = getSigningStatusMessage(app.loan?.agreementStatus);
															if (statusInfo.type === 'waiting') {
																return (
																	<div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
																		<div className="flex items-center">
																			<ClockIcon className="h-4 w-4 text-blue-600 mr-2" />
																			<span className="text-sm font-medium text-blue-700">
																				{statusInfo.message}
																			</span>
																		</div>
																	</div>
																);
															}
															return null;
														})()}
														{(() => {
															const statusInfo = getSigningStatusMessage(app.loan?.agreementStatus);
															return app.status === "PENDING_SIGNATURE" && statusInfo.type === 'pending' && (
                        <button
                            onClick={() => handleShowDocumentSigningModal(app)}
                            disabled={signingInProgress}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            <DocumentIcon className="h-4 w-4 mr-2" />
                            {signingInProgress ? "Initiating..." : "Sign Agreement"}
                            <ArrowRightIcon className="ml-2 h-4 w-4" />
                        </button>
                    );
														})()}
													</div>
												)}

																{app.status === "PENDING_PKI_SIGNING" && (
													<button
														onClick={() => router.push(`/pki-signing?application=${app.id}`)}
														className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-violet-600 hover:bg-violet-700 transition-colors"
													>
														<KeyIcon className="h-4 w-4 mr-2" />
														Complete Signing
														<ArrowRightIcon className="ml-2 h-4 w-4" />
													</button>
												)}

                                                                                {["PENDING_APP_FEE","PENDING_APPROVAL"].includes(app.status) && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setSelectedApplication(app);
                                                                                            setShowWithdrawModal(true);
                                                                                        }}
                                                                                        className="inline-flex items-center px-4 py-2 border border-red-200 text-sm font-medium rounded-md text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                                                                                    >
                                                                                        Withdraw
                                                                                    </button>
                                                                                )}
																			</div>
																		</div>
																	</div>

																	{/* Live Call Information Banner */}
																	{app.status ===
																		"PENDING_ATTESTATION" &&
																		app.attestationType ===
																			"MEETING" && (
																			<div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
																				<div className="flex items-center">
																					<VideoCameraIcon className="h-5 w-5 text-purple-600 mr-3 flex-shrink-0" />
																					<div className="flex-1">
																						<h4 className="text-sm font-semibold text-purple-700 mb-1 font-heading">
																							Live
																							Video
																							Call
																							Requested
																						</h4>
																						<p className="text-sm text-purple-600 font-body">
																							Our
																							legal
																							team
																							will
																							contact
																							you
																							within
																							1-2
																							business
																							days
																							to
																							schedule
																							your
																							live
																							video
																							call
																							attestation.
																							Please
																							keep
																							your
																							phone
																							accessible.
																						</p>
																						{app.attestationNotes && (
																							<p className="text-xs text-purple-500 mt-2 italic font-body">
																								Note:{" "}
																								{
																									app.attestationNotes
																								}
																							</p>
																						)}
																					</div>
																				</div>
																			</div>
																		)}

																	{/* Application Summary - Redesigned to match active loans */}
																	<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
																		{/* Amount Requested */}
																		<div className="text-left">
																			<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																				<div className="flex items-center mb-4">
																					<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-600/10 rounded-xl flex items-center justify-center mr-3">
																						<BanknotesIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-600" />
																					</div>
																					<div>
																						<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																							{app.status === "PENDING_FRESH_OFFER" ? "Revised Amount" : "Amount Requested"}
																						</h4>
																					</div>
																				</div>
																				<div className="space-y-4 lg:space-y-6">
																					<div>
																						<ComparisonValue 
																							original={app.amount}
																							freshOffer={app.freshOfferAmount}
																							formatValue={formatCurrency}
																							showComparison={app.status === "PENDING_FRESH_OFFER"}
																						/>

																					</div>
																					<div className="text-sm lg:text-base text-gray-600 font-body leading-relaxed">
																						{app.status === "PENDING_FRESH_OFFER" ? "Revised loan amount" : "Loan amount requested"}
																					</div>
																				</div>
																			</div>
																		</div>

																		{/* Term & Purpose */}
																		<div className="text-left">
																			<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																				<div className="flex items-center mb-4">
																																						<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-600/10 rounded-xl flex items-center justify-center mr-3">
																		<ClockIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-600" />
																					</div>
																					<div>
																						<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																							Term & Purpose
																						</h4>
																					</div>
																				</div>
																				<div className="space-y-4 lg:space-y-6">
																					<div>
																						<ComparisonValue 
																							original={app.term}
																							freshOffer={app.freshOfferTerm}
																							formatValue={(value) => `${value} months`}
																							showComparison={app.status === "PENDING_FRESH_OFFER"}
																						/>

																					</div>
																					<div className="text-sm lg:text-base text-gray-600 font-body leading-relaxed">
																						{app.purpose || "Purpose not specified"}
																					</div>
																				</div>
																			</div>
																		</div>


																		{/* Monthly Repayment */}
																		<div className="text-left">
																			<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																				<div className="flex items-center mb-4">
																					<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-600/10 rounded-xl flex items-center justify-center mr-3">
																						<svg className="h-6 w-6 lg:h-7 lg:w-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
																						</svg>
																					</div>
																					<div>
																						<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																							{app.status === "PENDING_FRESH_OFFER" ? "Revised Monthly Payment" : "Monthly Payment"}
																						</h4>
																					</div>
																				</div>
																				<div className="space-y-4 lg:space-y-6">
																					<div>
																						<ComparisonValue 
																							original={app.monthlyRepayment}
																							freshOffer={app.freshOfferMonthlyRepayment}
																							formatValue={formatCurrency}
																							showComparison={app.status === "PENDING_FRESH_OFFER"}
																						/>

																					</div>
																					<div className="text-sm lg:text-base text-gray-600 font-body leading-relaxed">
																						{app.status === "PENDING_FRESH_OFFER" ? "Revised monthly payment amount" : "Expected monthly payment"}
																					</div>
																				</div>
																			</div>
																		</div>
																	</div>

																	{/* Application Status Timeline */}
																	<div className="mb-6">
																		<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
																			{/* Timeline Header - Always Visible */}
																			<button
																				onClick={() => setShowTimelineDetails(prev => ({
																					...prev,
																					[app.id]: !prev[app.id]
																				}))}
																				className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
																			>
																				<div className="flex items-center flex-1">
																					<div className="w-12 h-12 bg-purple-600/10 rounded-xl flex items-center justify-center mr-3">
																						<ClockIcon className="h-6 w-6 text-purple-600" />
																					</div>
																					<div className="text-left">
																						<h4 className="text-lg font-heading font-bold text-gray-700 mb-1">
																							Application Progress
																						</h4>
																						{!showTimelineDetails[app.id] && (
																							<p className="text-sm text-purple-600 font-medium">
																								Current: {getApplicationStatusLabel(app.status, app.attestationType)}
																							</p>
																						)}
																					</div>
																				</div>
																				<div className="ml-4">
																					{showTimelineDetails[app.id] ? (
																						<ChevronUpIcon className="h-5 w-5 text-gray-400" />
																					) : (
																						<ChevronDownIcon className="h-5 w-5 text-gray-400" />
																					)}
																				</div>
																			</button>

																			{/* Timeline Content - Collapsible */}
																			{showTimelineDetails[app.id] && (
																			<div className="px-6 pb-6 pt-2">
																			<div className="relative">
																				{/* Vertical line connecting steps */}
																				<div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200"></div>
																				
																				<div className="space-y-6 relative">
																					{[
																						{ status: 'INCOMPLETE', label: 'Application Started', icon: DocumentTextIcon },
																						{ status: 'PENDING_APPROVAL', label: 'Pending Approval', icon: ChartBarIcon },
																						{ status: 'PENDING_ATTESTATION', label: 'Attestation', icon: VideoCameraIcon },
																						{ status: 'PENDING_KYC', label: 'KYC Verification', icon: ShieldCheckIcon },
																						{ status: 'PENDING_SIGNATURE', label: 'Document Signing', icon: DocumentCheckIcon },
																						{ status: 'PENDING_SIGNING_COMPANY_WITNESS', label: 'Company & Witness Signing', icon: DocumentTextIcon },
																						{ status: 'PENDING_STAMPING', label: 'Agreement Stamping', icon: DocumentTextIcon },
																						{ status: 'PENDING_DISBURSEMENT', label: 'Loan Disbursement', icon: BanknotesIcon },
																						{ status: 'ACTIVE', label: 'Loan Active', icon: CheckCircleIcon },
																					].map((step, index, array) => {
																						// Define the sequential order of statuses (actual backend flow)
																						const statusOrder = [
																							'INCOMPLETE', 'PENDING_APP_FEE', 
																							'PENDING_APPROVAL', 'PENDING_FRESH_OFFER',
																							'PENDING_ATTESTATION',
																							'PENDING_PROFILE_CONFIRMATION', 'PENDING_KYC', 'PENDING_KYC_VERIFICATION', 'PENDING_CERTIFICATE_OTP',
																							'PENDING_SIGNATURE', 'PENDING_PKI_SIGNING', 'PENDING_SIGNING_COMPANY_WITNESS',
																							'PENDING_SIGNING_OTP_DS', 'PENDING_STAMPING', 'PENDING_DISBURSEMENT', 'ACTIVE'
																						];
																						
																						const currentStatusIndex = statusOrder.indexOf(app.status);
																						const stepIndex = statusOrder.indexOf(step.status);
																						
																						// Special handling for combined statuses
																						let isCompleted = stepIndex < currentStatusIndex && stepIndex !== -1;
																						let isCurrent = app.status === step.status;
																						
																						// Application Started step - show as current for INCOMPLETE or PENDING_APP_FEE
																						if (step.status === 'INCOMPLETE') {
																							isCurrent = app.status === 'INCOMPLETE' || app.status === 'PENDING_APP_FEE';
																							isCompleted = !isCurrent && (currentStatusIndex > statusOrder.indexOf('PENDING_APP_FEE'));
																						}
																						
																						// Pending Approval step - show as current for PENDING_APPROVAL or PENDING_FRESH_OFFER
																						if (step.status === 'PENDING_APPROVAL') {
																							isCurrent = app.status === 'PENDING_APPROVAL' || app.status === 'PENDING_FRESH_OFFER';
																							isCompleted = !isCurrent && (currentStatusIndex > statusOrder.indexOf('PENDING_FRESH_OFFER'));
																						}
																						
																						// KYC Verification step - show as current for PENDING_PROFILE_CONFIRMATION or PENDING_KYC
																						if (step.status === 'PENDING_KYC') {
																							isCurrent = app.status === 'PENDING_PROFILE_CONFIRMATION' || app.status === 'PENDING_KYC' || app.status === 'PENDING_KYC_VERIFICATION' || app.status === 'PENDING_CERTIFICATE_OTP';
																							isCompleted = !isCurrent && (currentStatusIndex > statusOrder.indexOf('PENDING_CERTIFICATE_OTP'));
																						}
																						
																						// Document Signing step - show as current for PENDING_SIGNATURE or PENDING_PKI_SIGNING
																						if (step.status === 'PENDING_SIGNATURE') {
																							isCurrent = app.status === 'PENDING_SIGNATURE' || app.status === 'PENDING_PKI_SIGNING';
																							isCompleted = !isCurrent && (currentStatusIndex > statusOrder.indexOf('PENDING_PKI_SIGNING'));
																						}
																						
																						const isPending = !isCompleted && !isCurrent;
																						
																						const StepIcon = step.icon;
																						const isLastStep = index === array.length - 1;
																						
																						return (
																							<div key={step.status} className="flex items-start relative">
																								{/* Step indicator */}
																								<div className="flex-shrink-0 mr-4 relative z-10">
																									{isCompleted && (
																										<div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
																											<CheckIcon className="h-5 w-5 text-white stroke-2" />
																										</div>
																									)}
																									{isCurrent && (
																										<div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shadow-md ring-4 ring-purple-100">
																											<StepIcon className="h-4 w-4 text-white" />
																										</div>
																									)}
																									{isPending && (
																										<div className="w-8 h-8 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center">
																											<div className="w-2.5 h-2.5 rounded-full bg-gray-300"></div>
																										</div>
																									)}
																								</div>
																								
																								{/* Step content */}
																								<div className="flex-1 min-w-0 pt-0.5">
																									<div className={`text-sm font-medium transition-colors ${
																										isCurrent ? 'text-purple-600 font-bold' : 
																										isCompleted ? 'text-green-600 font-semibold' : 
																										'text-gray-400'
																									}`}>
																										{step.label}
																									</div>
																									{isCurrent && (
																										<div className="text-xs text-purple-500 mt-1">
																											In Progress
																										</div>
																									)}
																									{isCompleted && (
																										<div className="text-xs text-green-500 mt-1">
																											✓ Completed
																										</div>
																									)}
																								</div>
																							</div>
																						);
																					})}
																				</div>
																			</div>
																			</div>
																			)}
																		</div>
																	</div>


																	{/* Fees and Net Disbursement Section */}
																	{app.status === "PENDING_FRESH_OFFER" && (
																		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
																			{/* Fee Breakdown */}
																			<div className="text-left">
																				<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																					<div className="flex items-center mb-4">
																						<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-600/10 rounded-xl flex items-center justify-center mr-3">
																							<DocumentTextIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-600" />
																						</div>
																						<div>
																							<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																								Fee Breakdown
																							</h4>
																						</div>
																					</div>
																					<div className="space-y-4">
																						{/* Show new fee structure if available, otherwise show old */}
																						{usesNewFeeStructure(app) ? (
																							<>
																								{/* Legal Fee (Fixed) */}
																								<div className="flex justify-between items-center">
																									<span className="text-sm text-gray-600">Legal Fee (Fixed)</span>
																									<div className="text-right">
																										{hasValueChanged(app.legalFeeFixed, app.freshOfferLegalFeeFixed) ? (
																											<div className="space-y-1">
																												<span className="text-sm font-medium text-gray-700">
																													{formatCurrency(app.freshOfferLegalFeeFixed || 0)}
																												</span>
																												<div className="text-xs text-gray-400">
																													Previously: {formatCurrency(app.legalFeeFixed || 0)}
																												</div>
																											</div>
																										) : (
																											<div className="space-y-1">
																												<span className="text-sm font-medium text-gray-700">
																													{formatCurrency(getDisplayLegalFeeFixed(app))}
																												</span>
																												<div className="text-xs text-gray-400">
																													No change
																												</div>
																											</div>
																										)}
																									</div>
																								</div>

																								{/* Stamping Fee */}
																								<div className="flex justify-between items-center">
																									<span className="text-sm text-gray-600">Stamping Fee</span>
																									<div className="text-right">
																										{hasValueChanged(app.stampingFee, app.freshOfferStampingFee) ? (
																											<div className="space-y-1">
																												<span className="text-sm font-medium text-gray-700">
																													{formatCurrency(app.freshOfferStampingFee || 0)}
																												</span>
																												<div className="text-xs text-gray-400">
																													Previously: {formatCurrency(app.stampingFee || 0)}
																												</div>
																											</div>
																										) : (
																											<div className="space-y-1">
																												<span className="text-sm font-medium text-gray-700">
																													{formatCurrency(getDisplayStampingFee(app))}
																												</span>
																												<div className="text-xs text-gray-400">
																													No change
																												</div>
																											</div>
																										)}
																									</div>
																								</div>
																							</>
																						) : (
																							<>
																								{/* Old fee structure */}
																								{/* Origination Fee */}
																								<div className="flex justify-between items-center">
																									<span className="text-sm text-gray-600">Origination Fee</span>
																									<div className="text-right">
																										{hasValueChanged(app.originationFee, app.freshOfferOriginationFee) ? (
																											<div className="space-y-1">
																												<span className="text-sm font-medium text-gray-700">
																													{formatCurrency(app.freshOfferOriginationFee || 0)}
																												</span>
																												<div className="text-xs text-gray-400">
																													Previously: {formatCurrency(app.originationFee || 0)}
																												</div>
																											</div>
																										) : (
																											<div className="space-y-1">
																												<span className="text-sm font-medium text-gray-700">
																													{formatCurrency(getDisplayOriginationFee(app))}
																												</span>
																												<div className="text-xs text-gray-400">
																													No change
																												</div>
																											</div>
																										)}
																									</div>
																								</div>

																								{/* Legal Fee */}
																								<div className="flex justify-between items-center">
																									<span className="text-sm text-gray-600">Legal Fee</span>
																									<div className="text-right">
																										{hasValueChanged(app.legalFee, app.freshOfferLegalFee) ? (
																											<div className="space-y-1">
																												<span className="text-sm font-medium text-gray-700">
																													{formatCurrency(app.freshOfferLegalFee || 0)}
																												</span>
																												<div className="text-xs text-gray-400">
																													Previously: {formatCurrency(app.legalFee || 0)}
																												</div>
																											</div>
																										) : (
																											<div className="space-y-1">
																												<span className="text-sm font-medium text-gray-700">
																													{formatCurrency(getDisplayLegalFee(app))}
																												</span>
																												<div className="text-xs text-gray-400">
																													No change
																												</div>
																											</div>
																										)}
																									</div>
																								</div>

																								{/* Application Fee */}
																								<div className="flex justify-between items-center">
																									<span className="text-sm text-gray-600">Application Fee</span>
																									<div className="text-right">
																										{hasValueChanged(app.applicationFee, app.freshOfferApplicationFee) ? (
																											<div className="space-y-1">
																												<span className="text-sm font-medium text-gray-700">
																													{formatCurrency(app.freshOfferApplicationFee || 0)}
																												</span>
																												<div className="text-xs text-gray-400">
																													Previously: {formatCurrency(app.applicationFee || 0)}
																												</div>
																											</div>
																										) : (
																											<div className="space-y-1">
																												<span className="text-sm font-medium text-gray-700">
																													{formatCurrency(getDisplayApplicationFee(app))}
																												</span>
																												<div className="text-xs text-gray-400">
																													No change
																												</div>
																											</div>
																										)}
																									</div>
																								</div>
																							</>
																						)}
																					</div>
																				</div>
																			</div>

																			{/* Net Disbursement */}
																			<div className="text-left">
																				<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																					<div className="flex items-center mb-4">
																						<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-600/10 rounded-xl flex items-center justify-center mr-3">
																							<BanknotesIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-600" />
																						</div>
																						<div>
																							<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																								Net Disbursement
																							</h4>
																						</div>
																					</div>
																					<div className="space-y-4 lg:space-y-6">
																						<div>
																							<ComparisonValue 
																								original={app.netDisbursement}
																								freshOffer={app.freshOfferNetDisbursement}
																								formatValue={formatCurrency}
																								showComparison={true}
																							/>

																					</div>
																					<div className="text-sm lg:text-base text-gray-600 font-body leading-relaxed">
																							Amount you will receive after deducting all fees
																					</div>
																				</div>
																			</div>
																		</div>
																	</div>
																	)}

																	{/* Status */}
																	{/* View Details Button - Centered to match other cards */}
																	<div className="flex justify-center mt-6">
																		<button
																			onClick={() =>
																				toggleApplicationDetails(
																					app.id
																				)
																			}
																			className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors font-body border border-blue-200 hover:border-blue-300"
																		>
																			{isExpanded ? "Hide Details" : "View Details"}
																			{isExpanded ? (
																				<ChevronUpIcon className="ml-2 h-4 w-4" />
																			) : (
																				<ChevronDownIcon className="ml-2 h-4 w-4" />
																			)}
																		</button>
																	</div>


																</div>

																{/* Expanded Application Details */}
																{isExpanded && (
																	<div className="p-6 lg:p-8 border-t border-gray-200 bg-gray-50/30">
																		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
																			{/* Application Information */}
																			<div>
																				<h5 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-6">
																					Application Information
																				</h5>
																				<div className="space-y-3 text-sm lg:text-base">
																					<div className="flex justify-between py-2">
																						<span className="text-gray-500 font-body">
																							Product
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{app.product?.name || "Unknown"}
																						</span>
																					</div>
																					<div className="flex justify-between py-2">
																						<span className="text-gray-500 font-body">
																							Loan Amount
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{getDisplayAmount(app) ? formatCurrency(getDisplayAmount(app)!) : "-"}
																						</span>
																					</div>
																					<div className="flex justify-between py-2">
																						<span className="text-gray-500 font-body">
																							Loan Term
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{getDisplayTerm(app) ? `${getDisplayTerm(app)} months` : "-"}
																						</span>
																					</div>
																					<div className="flex justify-between py-2">
																						<span className="text-gray-500 font-body">
																							Loan Purpose
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{app.purpose || "-"}
																						</span>
																					</div>
																					<div className="flex justify-between py-2">
																						<span className="text-gray-500 font-body">
																							Created
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{formatDate(app.createdAt)}
																						</span>
																					</div>
																					<div className="flex justify-between py-2">
																						<span className="text-gray-500 font-body">
																							Last Updated
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{formatDate(app.updatedAt)}
																						</span>
																					</div>
																					{app.status ===
																						"PENDING_ATTESTATION" &&
																						app.attestationType ===
																							"MEETING" && (
																							<div className="pt-3 border-t border-gray-200">
																								<div className="flex justify-between">
																									<span className="text-gray-500 font-body">
																										Attestation
																										Type
																									</span>
																									<span className="font-medium text-purple-700 font-body">
																										Live
																										Video
																										Call
																									</span>
																								</div>
																								{app.attestationNotes && (
																									<div className="mt-2">
																										<span className="text-gray-500 font-body text-sm">
																											Notes:{" "}
																											{
																												app.attestationNotes
																											}
																										</span>
																									</div>
																								)}
																								<div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
																									<div className="flex items-start space-x-3">
																										<VideoCameraIcon className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
																										<div className="flex-1 min-w-0">
																											<p className="text-sm text-amber-800 font-medium font-body">
																												Live
																												Call
																												Requested
																											</p>
																											<p className="text-xs text-amber-700 font-body mt-1">
																												Our
																												legal
																												team
																												will
																												contact
																												you
																												within
																												3-5
																												business
																												days
																												to
																												schedule
																												your
																												attestation.
																											</p>
																											<button
																												onClick={() =>
																													handleSwitchToInstantAttestation(
																														app
																													)
																												}
																												className="mt-2 text-xs text-cyan-600 hover:text-cyan-700 underline font-medium font-body transition-colors"
																											>
																												Changed
																												your
																												mind?
																												Switch
																												to
																												instant
																												video
																											</button>
																										</div>
																									</div>
																								</div>
																							</div>
																						)}
																				</div>
																			</div>

																			{/* Application History */}
																			<div>
																				<h5 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-6">
																					Application History
																				</h5>
																				{loadingApplicationHistory[
																					app
																						.id
																				] ? (
																					<div className="flex items-center justify-center py-4">
																						<div className="w-6 h-6 border-2 border-blue-tertiary border-t-transparent rounded-full animate-spin"></div>
																						<span className="ml-2 text-sm text-gray-500">
																							Loading
																							history...
																						</span>
																					</div>
																				) : applicationHistory[
																						app
																							.id
																				  ] &&
																				  applicationHistory[
																						app
																							.id
																				  ]
																						.length >
																						0 ? (
																					<div className="space-y-3">
																						{applicationHistory[
																							app
																								.id
																						].map(
																							(
																								historyItem
																							) => (
																								<div
																									key={
																										historyItem.id
																									}
																									className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200"
																								>
																									<div className="w-8 h-8 bg-blue-tertiary/10 rounded-full flex items-center justify-center flex-shrink-0">
																										<ClockIcon className="h-4 w-4 text-blue-tertiary" />
																									</div>
																									<div className="flex-1 min-w-0">
																										<div className="flex items-center justify-between">
																											<p className="text-sm font-medium text-gray-700 font-body">
																												{getHistoryActionDescription(
																													historyItem.previousStatus,
																													historyItem.newStatus
																												)}
																											</p>
																											<span className="text-xs text-gray-500 font-body ml-4">
																												{formatDateTime(
																													historyItem.createdAt
																												)}
																											</span>
																										</div>
																										{historyItem.notes && (
																											<p className="text-xs text-gray-600 mt-2 italic font-body">
																												"
																												{
																													historyItem.notes
																												}

																												"
																											</p>
																										)}
																									</div>
																								</div>
																							)
																						)}
																					</div>
																				) : (
																					<div className="text-center py-4">
																						<p className="text-sm text-gray-500 mb-2 font-body">
																							No
																							history
																							available
																						</p>
																						<p className="text-xs text-gray-500 font-body">
																							Application
																							history
																							will
																							appear
																							here
																							once
																							status
																							changes
																							occur
																						</p>
																					</div>
																				)}
																			</div>
																		</div>
																	</div>
																)}
															</div>
														);
													}
												)}
											</div>
										);
									} else {
										return (
											<div className="text-center py-12">
												<DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
												<h4 className="text-xl font-medium text-gray-700 mb-2 font-heading">
													No Applications Found
												</h4>
												<p className="text-gray-500 mb-6 font-body">
													You haven't submitted any
													loan applications yet.
												</p>
												<Link
													href="/dashboard/apply"
													className="bg-purple-primary hover:bg-purple-600 text-white inline-flex items-center px-6 py-3 text-base font-medium rounded-md transition-colors shadow-sm"
												>
													<PlusIcon className="h-5 w-5 mr-2" />
													Apply for a Loan
												</Link>
											</div>
										);
									}
								} else if (activeTab === "incomplete") {
									// Incomplete Applications Content
									const incompleteApplications =
										applications.filter(
											(app) =>
												app.status.toUpperCase() ===
												"INCOMPLETE"
										);

									if (incompleteApplications.length > 0) {
										return (
											<div className="space-y-4">
												{incompleteApplications.map(
													(app) => (
														<div
															key={app.id}
																															className="bg-yellow-50/30 border border-yellow-200 rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all p-6 lg:p-8"
														>
															<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 lg:mb-6 space-y-4 sm:space-y-0">
																<div className="flex items-center space-x-4">
																	<div className="w-16 h-16 lg:w-20 lg:h-20 bg-yellow-600/10 rounded-xl lg:rounded-2xl flex items-center justify-center border border-yellow-600/20">
																		<ClockIcon className="h-8 w-8 lg:h-10 lg:w-10 text-yellow-600" />
																	</div>
																	<div>
																		<h4 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
																			{app
																				.product
																				?.name ||
																				"Unknown Product"}
																		</h4>
																		<p className="text-sm lg:text-base text-yellow-600 font-semibold">
																			ID: {app.id
																				.slice(
																					-8
																				)
																				.toUpperCase()}
																		</p>
																	</div>
																</div>
																<div className="text-left sm:text-right">
																	<div className="flex items-center space-x-3">
																		<button
																			onClick={() => {
																				setSelectedDeleteApplication(
																					app
																				);
																				setShowDeleteModal(
																					true
																				);
																			}}
																			className="inline-flex items-center px-3 py-2 border border-red-200 text-sm font-medium rounded-md text-red-600 bg-red-50 hover:bg-red-100 transition-colors font-body"
																		>
																			<svg
																				className="h-4 w-4 mr-1"
																				fill="none"
																				viewBox="0 0 24 24"
																				stroke="currentColor"
																			>
																				<path
																					strokeLinecap="round"
																					strokeLinejoin="round"
																					strokeWidth={
																						2
																					}
																					d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
																				/>
																			</svg>
																			Delete
																		</button>
																		<Link
																			href={`/dashboard/apply?applicationId=${
																				app.id
																			}&step=${
																				app.appStep
																			}&productCode=${
																				app
																					.product
																					?.code ||
																				""
																			}`}
																			className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 transition-colors font-body"
																		>
																			Resume
																			Application
																			<ArrowRightIcon className="ml-2 h-4 w-4" />
																		</Link>
																	</div>
																</div>
															</div>

															{/* Application Summary - Redesigned to match active loans */}
															<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
																																				{/* Amount */}
																				<div className="text-left">
																	<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																		<div className="flex items-center mb-4">
																			<div className="w-12 h-12 lg:w-14 lg:h-14 bg-yellow-500/10 rounded-xl flex items-center justify-center mr-3">
																				<BanknotesIcon className="h-6 w-6 lg:h-7 lg:w-7 text-yellow-500" />
																			</div>
																			<div>
																				<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																					Amount
																				</h4>
																			</div>
																		</div>
																		<div className="space-y-4 lg:space-y-6">
																			<div>
																				<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																					{getDisplayAmount(app) ? formatCurrency(getDisplayAmount(app)!) : "-"}
																				</p>
																			</div>
																			<div className="text-sm lg:text-base text-gray-600 font-body leading-relaxed">
																				Requested amount
																			</div>
																		</div>
																	</div>
																</div>

																																				{/* Term & Purpose */}
																				<div className="text-left">
																	<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																		<div className="flex items-center mb-4">
																			<div className="w-12 h-12 lg:w-14 lg:h-14 bg-yellow-500/10 rounded-xl flex items-center justify-center mr-3">
																				<ClockIcon className="h-6 w-6 lg:h-7 lg:w-7 text-yellow-500" />
																			</div>
																			<div>
																				<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																					Term & Purpose
																				</h4>
																			</div>
																		</div>
																		<div className="space-y-4 lg:space-y-6">
																			<div>
																				<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																					{getDisplayTerm(app) ? `${getDisplayTerm(app)} months` : "-"}
																				</p>
																			</div>
																			<div className="text-sm lg:text-base text-gray-600 font-body leading-relaxed">
																				{app.purpose || "Purpose not specified"}
																			</div>
																		</div>
																	</div>
																</div>

																{/* Started Date */}
																																				<div className="text-left">
																	<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																		<div className="flex items-center mb-4">
																			<div className="w-12 h-12 lg:w-14 lg:h-14 bg-yellow-500/10 rounded-xl flex items-center justify-center mr-3">
																				<CalendarIcon className="h-6 w-6 lg:h-7 lg:w-7 text-yellow-500" />
																			</div>
																			<div>
																				<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																					Started On
																				</h4>
																			</div>
																		</div>
																		<div className="space-y-4 lg:space-y-6">
																			<div>
																				<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																					{formatDate(app.createdAt)}
																				</p>
																			</div>
																			<div className="text-sm lg:text-base text-gray-600 font-body leading-relaxed">
																				Application started
																			</div>
																		</div>
																	</div>
																</div>
															</div>

															{/* Status Alert */}
															<div className="mb-4">
																<div className="flex items-center p-4 bg-yellow-50 rounded-xl border border-yellow-200">
																	<ExclamationTriangleIcon className="h-8 w-8 text-yellow-600 mr-3" />
																	<div className="flex-1">
																		<p className="text-lg font-semibold text-yellow-700">
																			Application Incomplete
																		</p>
																		<p className="text-sm text-gray-600">
																			Complete your application to proceed with the loan process.
																		</p>
																	</div>
																</div>
															</div>


														</div>
													)
												)}
											</div>
										);
									} else {
										return (
											<div className="text-center py-12">
												<ClockIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
												<h4 className="text-xl font-medium text-gray-700 mb-2 font-heading">
													No Incomplete Applications
												</h4>
												<p className="text-gray-500 mb-6 font-body">
													All your applications have
													been completed or you
													haven't started any yet.
												</p>
												<Link
													href="/dashboard/apply"
													className="bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center px-6 py-3 text-base font-medium rounded-md transition-colors shadow-sm"
												>
													<PlusIcon className="h-5 w-5 mr-2" />
													Start New Application
												</Link>
											</div>
										);
									}
								} else if (activeTab === "rejected") {
									// Rejected Applications Content
									const rejectedApplications =
										applications.filter(
											(app) =>
												["REJECTED", "WITHDRAWN"].includes(
													app.status.toUpperCase()
												)
										);

									if (rejectedApplications.length > 0) {
										return (
											<div className="space-y-4">
												{rejectedApplications.map(
													(app) => {
														const isExpanded =
															showApplicationDetails[
																app.id
															];

														return (
															<div
																key={app.id}
																className="bg-red-50/30 border border-red-200 rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden"
															>
																{/* Application Header */}
																<div className="p-6 lg:p-8">
																	<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 lg:mb-6 space-y-4 sm:space-y-0">
																		<div className="flex items-center space-x-4">
																			<div className="w-16 h-16 lg:w-20 lg:h-20 bg-red-600/10 rounded-xl lg:rounded-2xl flex items-center justify-center border border-red-600/20">
																				<ExclamationTriangleIcon className="h-8 w-8 lg:h-10 lg:w-10 text-red-600" />
																			</div>
																			<div>
																				<h4 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
																					{app
																						.product
																						?.name ||
																						"Unknown Product"}
																				</h4>
																				<p className="text-sm lg:text-base text-red-600 font-semibold">
																					ID: {app.id
																						.slice(
																							-8
																						)
																						.toUpperCase()}
																				</p>
																			</div>
																		</div>
																	</div>

																	{/* Application Summary - Redesigned to match active loans */}
																	<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
																		{/* Amount Requested */}
																		<div className="text-left">
																			<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																				<div className="flex items-center mb-4">
																					<div className="w-12 h-12 lg:w-14 lg:h-14 bg-red-600/10 rounded-xl flex items-center justify-center mr-3">
																						<BanknotesIcon className="h-6 w-6 lg:h-7 lg:w-7 text-red-600" />
																					</div>
																					<div>
																						<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																							Amount Requested
																						</h4>
																					</div>
																				</div>
																				<div className="space-y-4 lg:space-y-6">
																					<div>
																						<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																							{getDisplayAmount(app) ? formatCurrency(getDisplayAmount(app)!) : "-"}
																						</p>
																					</div>
																					<div className="text-sm lg:text-base text-gray-600 font-body leading-relaxed">
																						Loan amount requested
																					</div>
																				</div>
																			</div>
																		</div>

																		{/* Term & Purpose */}
																		<div className="text-left">
																			<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																				<div className="flex items-center mb-4">
																					<div className="w-12 h-12 lg:w-14 lg:h-14 bg-red-600/10 rounded-xl flex items-center justify-center mr-3">
																						<ClockIcon className="h-6 w-6 lg:h-7 lg:w-7 text-red-600" />
																					</div>
																					<div>
																						<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																							Term & Purpose
																						</h4>
																					</div>
																				</div>
																				<div className="space-y-4 lg:space-y-6">
																					<div>
																						<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																							{getDisplayTerm(app) ? `${getDisplayTerm(app)} months` : "-"}
																						</p>
																					</div>
																					<div className="text-sm lg:text-base text-gray-600 font-body leading-relaxed">
																						{app.purpose || "Purpose not specified"}
																					</div>
																				</div>
																			</div>
																		</div>

																		{/* Status Date */}
																		<div className="text-left">
																			<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																				<div className="flex items-center mb-4">
																					<div className="w-12 h-12 lg:w-14 lg:h-14 bg-red-600/10 rounded-xl flex items-center justify-center mr-3">
																						<CalendarIcon className="h-6 w-6 lg:h-7 lg:w-7 text-red-600" />
																					</div>
																					<div>
																						<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																							{app.status.toUpperCase() === "REJECTED" ? "Rejected On" : "Withdrawn On"}
																						</h4>
																					</div>
																				</div>
																				<div className="space-y-4 lg:space-y-6">
																					<div>
																						<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																							{formatDate(app.updatedAt)}
																						</p>
																					</div>
																					<div className="text-sm lg:text-base text-gray-600 font-body leading-relaxed">
																						{app.status.toUpperCase() === "REJECTED" ? "Application rejected" : "Application withdrawn"}
																					</div>
																				</div>
																			</div>
																		</div>
																	</div>

																	{/* Status Alert */}
																	<div className="mb-4">
																		<div className="flex items-center p-4 bg-red-50 rounded-xl border border-red-200">
																			<ExclamationTriangleIcon className="h-8 w-8 text-red-600 mr-3" />
																			<div className="flex-1">
																				<p className="text-lg font-semibold text-red-700">
																					{app.status.toUpperCase() === "REJECTED" ? "Application Rejected" : "Application Withdrawn"}
																				</p>
																				<p className="text-sm text-gray-600">
																					{app.status.toUpperCase() === "REJECTED" 
																						? "Your loan application was not approved. Check the application history for details."
																						: "Your loan application was withdrawn. Check the application history for details."
																					}
																				</p>
																			</div>
																		</div>
																	</div>

																	{/* View Details Button - Centered to match other cards */}
																	<div className="flex justify-center mt-6">
																		<button
																			onClick={() =>
																				toggleApplicationDetails(
																					app.id
																				)
																			}
																			className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors font-body border border-blue-200 hover:border-blue-300"
																		>
																			{isExpanded ? "Hide Details" : "View Details"}
																			{isExpanded ? (
																				<ChevronUpIcon className="ml-2 h-4 w-4" />
																			) : (
																				<ChevronDownIcon className="ml-2 h-4 w-4" />
																			)}
																		</button>
																	</div>
																</div>

																{/* Expanded Application Details */}
																{isExpanded && (
																	<div className="p-6 lg:p-8 border-t border-gray-200 bg-gray-50/30">
																		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
																			{/* Application Information */}
																			<div>
																				<h5 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-6">
																					Application Information
																				</h5>
																				<div className="space-y-3 text-sm lg:text-base">
																					<div className="flex justify-between py-2">
																						<span className="text-gray-500 font-body">
																							Product
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{app.product?.name || "Unknown"}
																						</span>
																					</div>
																					<div className="flex justify-between py-2">
																						<span className="text-gray-500 font-body">
																							Loan Amount
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{getDisplayAmount(app) ? formatCurrency(getDisplayAmount(app)!) : "-"}
																						</span>
																					</div>
																					<div className="flex justify-between py-2">
																						<span className="text-gray-500 font-body">
																							Loan Term
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{getDisplayTerm(app) ? `${getDisplayTerm(app)} months` : "-"}
																						</span>
																					</div>
																					<div className="flex justify-between py-2">
																						<span className="text-gray-500 font-body">
																							Loan Purpose
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{app.purpose || "-"}
																						</span>
																					</div>
																					<div className="flex justify-between py-2">
																						<span className="text-gray-500 font-body">
																							Applied
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{formatDate(app.createdAt)}
																						</span>
																					</div>
																					<div className="flex justify-between py-2">
																						<span className="text-gray-500 font-body">
																							{app.status.toUpperCase() === "REJECTED" ? "Rejected" : "Withdrawn"}
																						</span>
																						<span className="font-medium text-red-700 font-body">
																							{formatDate(app.updatedAt)}
																						</span>
																					</div>
																				</div>
																			</div>

																			{/* Application History */}
																			<div>
																				<h5 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-6">
																					Application History
																				</h5>
																				{loadingApplicationHistory[
																					app
																						.id
																				] ? (
																					<div className="flex items-center justify-center py-4">
																						<div className="w-6 h-6 border-2 border-blue-tertiary border-t-transparent rounded-full animate-spin"></div>
																						<span className="ml-2 text-sm text-gray-500">
																							Loading
																							history...
																						</span>
																					</div>
																				) : applicationHistory[
																						app
																							.id
																				  ] &&
																				  applicationHistory[
																						app
																							.id
																				  ]
																						.length >
																						0 ? (
																					<div className="space-y-3">
																						{applicationHistory[
																							app
																								.id
																						].map(
																							(
																								historyItem
																							) => (
																								<div
																									key={
																										historyItem.id
																									}
																									className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200"
																								>
																									<div className="w-8 h-8 bg-blue-tertiary/10 rounded-full flex items-center justify-center flex-shrink-0">
																										<ClockIcon className="h-4 w-4 text-blue-tertiary" />
																									</div>
																									<div className="flex-1 min-w-0">
																										<div className="flex items-center justify-between">
																											<p className="text-sm font-medium text-gray-700 font-body">
																												{getHistoryActionDescription(
																													historyItem.previousStatus,
																													historyItem.newStatus
																												)}
																											</p>
																											<span className="text-xs text-gray-500 font-body ml-4">
																												{formatDateTime(
																													historyItem.createdAt
																												)}
																											</span>
																										</div>
																										{historyItem.notes && (
																											<p className="text-xs text-gray-600 mt-2 italic font-body">
																												"
																												{
																													historyItem.notes
																												}

																												"
																											</p>
																										)}
																									</div>
																								</div>
																							)
																						)}
																					</div>
																				) : (
																					<div className="text-center py-4">
																						<p className="text-sm text-gray-500 mb-2 font-body">
																							No
																							history
																							available
																						</p>
																						<p className="text-xs text-gray-500 font-body">
																							Application
																							history
																							will
																							appear
																							here
																							once
																							status
																							changes
																							occur
																						</p>
																					</div>
																				)}
																			</div>
																		</div>
																	</div>
																)}
															</div>
														);
													}
												)}
											</div>
										);
									} else {
										return (
											<div className="text-center py-12">
												<ExclamationTriangleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
												<h4 className="text-xl font-medium text-gray-700 mb-2 font-heading">
													No Rejected or Withdrawn Applications
												</h4>
												<p className="text-gray-500 mb-6 font-body">
													Applications that have been rejected or withdrawn will appear here.
												</p>
												<Link
													href="/dashboard/apply"
													className="bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center px-6 py-3 text-base font-medium rounded-md transition-colors shadow-sm"
												>
													<PlusIcon className="h-5 w-5 mr-2" />
													Apply for a New Loan
												</Link>
											</div>
										);
									}
								}

								return null;
							})()}
						</div>
					</div>
				</div>
			</div>

			{/* Loan Repayment Modal */}
			{showLoanRepayModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
					<div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
						<div className="p-6">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-lg md:text-xl font-bold text-gray-700 font-heading">
									<span className="hidden sm:inline">
										Loan Repayment
									</span>
									<span className="sm:hidden">
										Repay Loan
									</span>
								</h2>
								<button
									onClick={() => {
										setShowLoanRepayModal(false);
										setSelectedLoan(null);
										setRepaymentAmount("");
										setIsEarlySettlement(false);
										setEarlySettlementQuote(null);
										setEarlySettlementError("");
										setEarlySettlementAvailableDate("");
									}}
									className="text-gray-500 hover:text-gray-700 transition-colors"
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

							{/* Loan Selection */}
							{!selectedLoan ? (
								<div>
									<h3 className="text-lg font-semibold text-gray-700 mb-4 font-heading">
										Select a Loan to Repay
									</h3>
									<div className="space-y-4">
										{loans
											.filter((loan) => {
												const status = loan.status.toUpperCase();
												return (
													["ACTIVE", "PENDING_DISCHARGE"].includes(status) &&
													loan.outstandingBalance > 0
												);
											})
											.map((loan) => (
											<button
												key={loan.id}
												onClick={() =>
													handleLoanSelection(loan)
												}
												className="w-full p-4 border border-gray-200 rounded-xl hover:border-blue-600/50 hover:bg-blue-600/5 transition-colors text-left bg-white shadow-sm"
											>
												<div className="flex items-center justify-between">
													<div>
														<p className="font-semibold text-gray-700 font-heading">
															{
																loan.application
																	.product
																	.name
															}
														</p>
														<p className="text-sm text-gray-500 font-body">
															Outstanding:{" "}
															<span className="text-gray-700 font-medium">
																{formatCurrency(
																	loan.outstandingBalance
																)}
															</span>
														</p>
														<p className="text-sm text-gray-500 font-body">
															Monthly Payment:{" "}
															<span className="text-gray-700 font-medium">
																{formatCurrency(
																	loan.monthlyPayment
																)}
															</span>
														</p>
														<p className="text-sm text-gray-500 font-body">
															Next Due:{" "}
															<span className="text-gray-700 font-medium">
																{(() => {
																	const displayDueDate = getCorrectDueDate(loan);
																	return displayDueDate ? formatDate(displayDueDate) : "N/A";
																})()}
															</span>
														</p>
													</div>
													<div className="text-right">
														<span
															className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium font-body ${
																loan.status ===
																"ACTIVE"
																	? "bg-green-100 text-green-700 border border-green-200"
																	: "bg-gray-100 text-gray-600 border border-gray-200"
															}`}
														>
															{loan.status}
														</span>
													</div>
												</div>
											</button>
										))}
									</div>
									{loans
										.filter((loan) => {
											const status = loan.status.toUpperCase();
											return (
												["ACTIVE", "PENDING_DISCHARGE"].includes(status) &&
												loan.outstandingBalance > 0
											);
										}).length === 0 && (
										<div className="text-center py-12">
											<CreditCardIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
											<p className="text-gray-500 font-body">
												No active loans found
											</p>
										</div>
									)}
								</div>
							) : (
								<div>
									{/* Selected Loan Details */}
									<div className="bg-blue-tertiary/5 rounded-xl p-4 mb-6 border border-blue-tertiary/20">
										<h3 className="text-base md:text-lg font-semibold text-gray-700 mb-3 font-heading">
											{
												selectedLoan.application.product
													.name
											}
										</h3>

										{/* Overdue Payment Warning */}
										{selectedLoan.overdueInfo
											?.hasOverduePayments && (
											<div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
												<div className="flex items-center mb-3">
													<ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
													<div>
														<p className="text-sm font-semibold text-red-800 font-heading">
															Overdue Payment
															Alert
														</p>
														<p className="text-xs text-red-700 mt-1 font-body">
															You have overdue
															payments with late
															fees. Pay the full
															amount due to avoid
															additional charges.
														</p>
													</div>
												</div>

												{/* Payment Breakdown */}
												<div className="space-y-2 text-xs font-body border-t border-red-200 pt-3">
													<div className="flex justify-between">
														<span className="text-red-600">
															Outstanding
															Principal:
														</span>
														<span className="text-red-800 font-semibold">
															{formatCurrency(
																selectedLoan
																	.overdueInfo
																	.totalOverdueAmount
															)}
														</span>
													</div>
													{selectedLoan.overdueInfo
														.totalLateFees > 0 && (
														<div className="flex justify-between">
															<span className="text-red-600">
																Late Fees:
															</span>
															<span className="text-red-800 font-semibold">
																{formatCurrency(
																	selectedLoan
																		.overdueInfo
																		.totalLateFees
																)}
															</span>
														</div>
													)}
													<div className="flex justify-between border-t border-red-200 pt-2">
														<span className="text-red-700 font-semibold">
															Total Amount Due:
														</span>
														<span className="text-red-700 font-semibold">
															{formatCurrency(
																selectedLoan
																	.overdueInfo
																	.totalOverdueAmount +
																	selectedLoan
																		.overdueInfo
																		.totalLateFees
															)}
														</span>
													</div>
												</div>
											</div>
										)}

										{/* Late Fee Breakdown - Hidden for overdue payments to avoid duplication with overdue alert */}

										<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 text-sm font-body">
											<div>
												<p className="text-gray-500 mb-1">
													Outstanding Amount
												</p>
												<p className="font-semibold text-gray-700 font-heading">
													{formatCurrency(
														selectedLoan.outstandingBalance
													)}
												</p>
											</div>
											<div>
												<p className="text-gray-500 mb-1">
													Monthly Payment
												</p>
												<p className="font-semibold text-gray-700 font-heading">
													{formatCurrency(
														selectedLoan.monthlyPayment
													)}
												</p>
											</div>
											<div>
												<p className="text-gray-500 mb-1">
													Interest Rate
												</p>
												<p className="font-semibold text-gray-700 font-heading">
													{selectedLoan.interestRate}%
													per month
												</p>
											</div>
											<div>
												<p className="text-gray-500 mb-1">
													Next Due Date
												</p>
												<p className="font-semibold text-gray-700 font-heading">
																												{(() => {
																const displayDueDate = getCorrectDueDate(selectedLoan);
																return displayDueDate ? formatDate(displayDueDate) : "N/A";
															})()}
												</p>
											</div>
										</div>
									</div>

									{/* Payment Method */}
									<div className="mb-6">
										<h4 className="text-lg font-semibold text-gray-700 mb-4 font-heading">
											Payment Method
										</h4>
										<div className="w-full border rounded-xl p-4 bg-blue-50/50 border-blue-500 text-left shadow-sm">
											<div className="flex items-center space-x-3">
												<div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center border border-blue-600/20">
													<svg
														className="w-5 h-5 text-blue-600"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
														/>
													</svg>
												</div>
												<div>
													<h3 className="font-semibold text-gray-700 font-heading">
														Bank Transfer
													</h3>
													<p className="text-sm text-gray-500 font-body">
														Usually 1 Business Day • Free
													</p>
												</div>
											</div>
										</div>
									</div>



									{/* Repayment Amount */}
									<div className="mb-6">
										<div className="flex items-center justify-between mb-4">
											<label className=" text-lg font-semibold text-gray-700 font-heading">
												Payment Amount (RM)
											</label>
											<div className="flex items-center space-x-3">
												{(() => {
													const nextPayment =
														selectedLoan.nextPaymentInfo || {
															amount: selectedLoan.monthlyPayment,
															isOverdue: false,
															includesLateFees:
																false,
															description:
																"Monthly Payment",
														};
													return (
														<button
															onClick={
																handleAutoFillMonthlyPayment
															}
															className="text-sm text-blue-tertiary hover:text-blue-600 font-medium font-body"
														>
															{nextPayment.amount ===
															0
																? "Fully Paid"
																: nextPayment.description}
														</button>
													);
												})()}
												{selectedLoan &&
													selectedLoan.outstandingBalance >
														0 && (
															<button
																onClick={handleEarlySettlementClick}
																className={`text-sm font-medium font-body ${
																	earlySettlementError
																		? "text-blue-600 hover:text-blue-700"
																		: isEarlySettlementLikelyAvailable(selectedLoan)
																			? "text-green-600 hover:text-green-700"
																			: "text-gray-400 hover:text-gray-500"
																}`}
																title={
																	!isEarlySettlementLikelyAvailable(selectedLoan)
																		? "Early settlement may not be available due to lock-in period"
																		: "Get a quote for early settlement"
																}
														>
															{earlySettlementError 
																? "Check Again"
																: isEarlySettlementLikelyAvailable(selectedLoan)
																	? "Settle Early"
																	: "Settle Early (Check Availability)"}
														</button>
													)}
											</div>
										</div>
										<input
											type="number"
											value={repaymentAmount}
											onChange={(e) =>
												!isEarlySettlement && handleRepaymentAmountChange(
													e.target.value
												)
											}
											placeholder="0.00"
											readOnly={isEarlySettlement}
											className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-gray-700 placeholder-gray-400 font-body ${
												isEarlySettlement 
													? "bg-gray-100 cursor-not-allowed" 
													: "bg-white"
											} ${
												repaymentError
													? "border-red-400 focus:border-red-400 focus:ring-red-400"
													: "border-gray-300"
											}`}
											min="1"
											step="0.01"
											max={
												isEarlySettlement ? undefined : selectedLoan.outstandingBalance
											}
										/>
										{repaymentError && (
											<p className="mt-2 text-sm text-red-600 font-body">
												{repaymentError}
											</p>
										)}
										{isEarlySettlement && (
											<p className="mt-2 text-sm text-blue-600 font-body flex items-center">
												<span className="mr-1">ℹ️</span>
												Early settlement amount is calculated and cannot be modified
											</p>
										)}
										{/* Payment Guidance */}
										{(() => {
											const nextPayment =
												selectedLoan.nextPaymentInfo || {
													amount: selectedLoan.monthlyPayment,
													isOverdue: false,
													includesLateFees: false,
													description:
														"Monthly Payment",
												};

											return (
												<div className="flex justify-between text-sm text-gray-500 mt-2 font-body">
													<span>
														{
															nextPayment.description
														}
													</span>
													<span className="font-medium text-gray-700">
														{nextPayment.amount >
														0
															? formatCurrency(
																	nextPayment.amount
															  )
															: "Fully Paid"}
													</span>
												</div>
											);
										})()}

										{/* Early Settlement Breakdown */}
										{isEarlySettlement && earlySettlementQuote && (
											<div className="mt-3 text-sm bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 font-body">
												<div className="flex items-center justify-between mb-3">
													<h4 className="font-semibold text-green-800 flex items-center">
														💰 Early Settlement Breakdown
													</h4>
													{(() => {
														const netSavings = earlySettlementQuote.discountAmount - (earlySettlementQuote.feeAmount || 0);
														return netSavings > 0 && (
															<span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
																Save {formatCurrency(netSavings)}
															</span>
														);
													})()}
												</div>
												
												<div className="space-y-2">
													<div className="flex justify-between text-gray-700">
														<span>Remaining Principal</span>
														<span className="font-medium">{formatCurrency(earlySettlementQuote.remainingPrincipal)}</span>
													</div>
													
													<div className="flex justify-between text-gray-700">
														<span>Future Interest (Total)</span>
														<span className="font-medium">{formatCurrency(earlySettlementQuote.remainingInterest)}</span>
													</div>
													
													{earlySettlementQuote.discountFactor > 0 && (
														<div className="flex justify-between text-green-700 bg-green-100/50 px-2 py-1 rounded">
															<span>Interest Discount ({(earlySettlementQuote.discountFactor*100).toFixed(1)}%)</span>
															<span className="font-medium">- {formatCurrency(earlySettlementQuote.discountAmount)}</span>
														</div>
													)}
													
													{earlySettlementQuote.feeAmount > 0 && (
														<div className="flex justify-between text-gray-700">
															<span>Early Settlement Fee</span>
															<span className="font-medium">+ {formatCurrency(earlySettlementQuote.feeAmount)}</span>
														</div>
													)}
													
													{earlySettlementQuote.includeLateFees && earlySettlementQuote.lateFeesAmount > 0 && (
														<div className="flex justify-between text-orange-700">
															<span>Unpaid Late Fees</span>
															<span className="font-medium">+ {formatCurrency(earlySettlementQuote.lateFeesAmount)}</span>
														</div>
													)}
												</div>
												
												<div className="border-t border-green-300 mt-3 pt-3">
													<div className="flex justify-between text-lg font-bold text-green-800">
														<span>Total Settlement Amount</span>
														<span>{formatCurrency(earlySettlementQuote.totalSettlement)}</span>
													</div>
													
													{(() => {
														const netSavings = earlySettlementQuote.discountAmount - (earlySettlementQuote.feeAmount || 0);
														const originalTotal = earlySettlementQuote.remainingPrincipal + earlySettlementQuote.remainingInterest;
														
														return netSavings > 0 && (
															<div className="mt-2 p-2 bg-green-100 rounded text-center">
																<p className="text-xs text-green-700 font-medium">
																	🎉 You save {formatCurrency(netSavings)} by settling early!
																</p>
																<p className="text-xs text-green-600 mt-1">
																	Instead of paying {formatCurrency(originalTotal)}, you only pay {formatCurrency(earlySettlementQuote.totalSettlement)}
																</p>
																{earlySettlementQuote.feeAmount > 0 && (
																	<p className="text-xs text-gray-600 mt-1">
																		(Interest discount: {formatCurrency(earlySettlementQuote.discountAmount)}, Early settlement fee: {formatCurrency(earlySettlementQuote.feeAmount)})
																	</p>
																)}
															</div>
														);
													})()}
												</div>
												
												<p className="mt-3 text-xs text-gray-500 text-center border-t pt-2">
													Quote generated on {new Date(earlySettlementQuote.computedAt).toLocaleString('en-MY', {
														year: 'numeric',
														month: 'short',
														day: 'numeric',
														hour: '2-digit',
														minute: '2-digit'
													})}
												</p>
											</div>
										)}

										{/* Early Settlement Error Display */}
										{earlySettlementError && (
											<div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
												<div className="flex items-start">
													<div className="flex-shrink-0">
														<svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
															<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
														</svg>
													</div>
													<div className="ml-3 flex-1">
														<h4 className="text-sm font-medium text-red-800 font-body">
															Early Settlement Not Available
														</h4>
														<p className="mt-1 text-sm text-red-700 font-body">
															{earlySettlementError}
														</p>
														{earlySettlementAvailableDate && (
															<div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
																<div className="flex items-center">
																	<svg className="h-4 w-4 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
																	</svg>
																	<span className="text-sm font-medium text-red-800 font-body">
																		Available from: {new Date(earlySettlementAvailableDate).toLocaleDateString('en-MY', {
																			year: 'numeric',
																			month: 'long',
																			day: 'numeric'
																		})}
																	</span>
																</div>
																{(() => {
																	const daysLeft = getDaysUntilEarlySettlement(earlySettlementAvailableDate);
																	return (
																		<div className="mt-1 flex items-center text-xs text-red-600 font-body">
																			{daysLeft > 0 ? (
																				<>
																					<svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
																					</svg>
																					<span className="font-medium">{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</span>
																				</>
																			) : (
																				<>
																					<svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
																					</svg>
																					<span className="font-medium">Available now - try again!</span>
																				</>
																			)}
																		</div>
																	);
																})()}
															
															</div>
														)}
														<div className="mt-3 flex justify-end">
															<button
																onClick={() => {
																	setEarlySettlementError("");
																	setEarlySettlementAvailableDate("");
																}}
																className="text-sm text-gray-600 hover:text-gray-800 font-medium font-body underline"
															>
																Dismiss
															</button>
														</div>
													</div>
												</div>
											</div>
										)}

										<div className="flex justify-between text-sm text-gray-500 mt-2 font-body">
											<span>Outstanding Balance</span>
											<span className="font-medium text-gray-700">
												{(() => {
													const isPendingSettlement = selectedLoan.status.toUpperCase() === "PENDING_EARLY_SETTLEMENT" || 
																				selectedLoan.status.toUpperCase() === "PENDING_DISCHARGE";
													return formatCurrency(isPendingSettlement ? 0 : selectedLoan.outstandingBalance);
												})()}
											</span>
										</div>
									</div>

									{/* Action Buttons */}
									<div className="flex space-x-3">
										<button
											onClick={() => {
												setSelectedLoan(null);
												setRepaymentAmount("");
												setRepaymentError("");
											}}
											className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-semibold font-heading hover:bg-gray-200 transition-colors border border-gray-200"
										>
											Back
										</button>
										<button
											onClick={handleConfirmRepayment}
											disabled={
												!repaymentAmount ||
												parseFloat(repaymentAmount) <=
													0 ||
												(!isEarlySettlement && parseFloat(repaymentAmount) >
													selectedLoan.outstandingBalance)
											}
											className="bg-blue-600 text-white flex-1 py-3 px-4 rounded-xl font-semibold font-heading hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md disabled:shadow-none"
										>
											Continue
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Bank Transfer Details Modal */}
			{showPaymentMethodModal && selectedLoan && (
				<BankTransferModal
					onClose={() => {
						setShowPaymentMethodModal(false);
						setCurrentPaymentReference("");
					}}
					onConfirm={handlePaymentConfirm}
					amount={repaymentAmount}
					reference={currentPaymentReference}
					userName={userName}
				/>
			)}

			{/* Application Withdrawal Modal */}
			{showWithdrawModal && selectedApplication && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200">
						<div className="p-6">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-xl font-bold text-gray-700 font-heading">
									Withdraw Application
								</h2>
								<button
									onClick={() => {
										setShowWithdrawModal(false);
										setSelectedApplication(null);
									}}
									className="text-gray-500 hover:text-gray-700 transition-colors"
								>
									<XMarkIcon className="w-6 h-6" />
								</button>
							</div>

							<div className="mb-6">
								<div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
									<div className="flex items-center">
										<ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-3" />
										<div>
											<h3 className="text-sm font-medium text-red-800 font-heading">
												Warning
											</h3>
											<p className="text-sm text-red-700 mt-1 font-body">
												This action cannot be undone.
												Your application fee will not be
												refunded.
											</p>
										</div>
									</div>
								</div>

								<div className="bg-blue-tertiary/5 rounded-xl p-4 border border-blue-tertiary/20">
									<h4 className="font-semibold text-gray-700 mb-2 font-heading">
										{selectedApplication.product?.name ||
											"Unknown Product"}
									</h4>
									<div className="text-sm text-gray-500 space-y-1 font-body">
										<p>
											Application ID:{" "}
											<span className="text-gray-700 font-medium">
												{selectedApplication.id
													.slice(-8)
													.toUpperCase()}
											</span>
										</p>
										<p>
											Amount:{" "}
											<span className="text-gray-700 font-medium">
												{selectedApplication.amount
													? formatCurrency(
															selectedApplication.amount
													  )
													: "-"}
											</span>
										</p>
										<p>
											Status:{" "}
											<span className="text-gray-700 font-medium">
												{getApplicationStatusLabel(
													selectedApplication.status,
													selectedApplication.attestationType
												)}
											</span>
										</p>
									</div>
								</div>
							</div>

							<p className="text-gray-600 mb-6 font-body">
								Are you sure you want to withdraw this loan
								application?
							</p>

							<div className="flex space-x-3">
								<button
									onClick={() => {
										setShowWithdrawModal(false);
										setSelectedApplication(null);
									}}
									className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-semibold font-heading hover:bg-gray-200 transition-colors border border-gray-200"
								>
									Cancel
								</button>
								<button
									onClick={handleWithdrawApplication}
									disabled={withdrawing}
									className="flex-1 bg-red-600 text-white py-3 px-4 rounded-xl font-semibold font-heading hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors shadow-sm"
								>
									{withdrawing
										? "Withdrawing..."
										: "Withdraw Application"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Application Deletion Modal */}
			{showDeleteModal && selectedDeleteApplication && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200">
						<div className="p-6">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-xl font-bold text-gray-700 font-heading">
									Delete Application
								</h2>
								<button
									onClick={() => {
										setShowDeleteModal(false);
										setSelectedDeleteApplication(null);
									}}
									className="text-gray-500 hover:text-gray-700 transition-colors"
								>
									<XMarkIcon className="w-6 h-6" />
								</button>
							</div>

							<div className="mb-6">
								<div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
									<div className="flex items-center">
										<ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-3" />
										<div>
											<h3 className="text-sm font-medium text-red-800 font-heading">
												Warning
											</h3>
											<p className="text-sm text-red-700 mt-1 font-body">
												This action cannot be undone.
												The application and all its data
												will be permanently deleted.
											</p>
										</div>
									</div>
								</div>

								<div className="bg-blue-tertiary/5 rounded-xl p-4 border border-blue-tertiary/20">
									<h4 className="font-semibold text-gray-700 mb-2 font-heading">
										{selectedDeleteApplication.product
											?.name || "Unknown Product"}
									</h4>
									<div className="text-sm text-gray-500 space-y-1 font-body">
										<p>
											Application ID:{" "}
											<span className="text-gray-700 font-medium">
												{selectedDeleteApplication.id
													.slice(-8)
													.toUpperCase()}
											</span>
										</p>
										<p>
											Amount:{" "}
											<span className="text-gray-700 font-medium">
												{selectedDeleteApplication.amount
													? formatCurrency(
															selectedDeleteApplication.amount
													  )
													: "-"}
											</span>
										</p>
										<p>
											Status:{" "}
											<span className="text-gray-700 font-medium">
												{getApplicationStatusLabel(
													selectedDeleteApplication.status,
													selectedDeleteApplication.attestationType
												)}
											</span>
										</p>
									</div>
								</div>
							</div>

							<p className="text-gray-600 mb-6 font-body">
								Are you sure you want to permanently delete this
								incomplete application?
							</p>

							<div className="flex space-x-3">
								<button
									onClick={() => {
										setShowDeleteModal(false);
										setSelectedDeleteApplication(null);
									}}
									className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-semibold font-heading hover:bg-gray-200 transition-colors border border-gray-200"
								>
									Cancel
								</button>
								<button
									onClick={handleDeleteApplication}
									disabled={deleting}
									className="flex-1 bg-red-600 text-white py-3 px-4 rounded-xl font-semibold font-heading hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors shadow-sm"
								>
									{deleting
										? "Deleting..."
										: "Delete Application"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Attestation Method Selection Modal */}
			{showAttestationMethodModal && selectedAttestationApplication && (
				<AttestationMethodModal
					onClose={handleAttestationModalClose}
					onInstantSelect={handleInstantAttestationSelect}
					onLiveCallSelect={handleLiveCallSelect}
					applicationId={selectedAttestationApplication.id}
				/>
			)}

			{/* Live Call Confirmation Modal */}
			{showLiveCallConfirmationModal &&
				selectedAttestationApplication && (
					<LiveCallConfirmationModal
						applicationId={selectedAttestationApplication.id}
						onClose={handleLiveCallModalClose}
						onConfirm={handleLiveCallConfirm}
						onBackToInstant={handleLiveCallBack}
					/>
				)}

			{/* Document Signing Modal */}
			{showDocumentSigningModal && selectedSigningApplication && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
					<div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200">
						<div className="p-6">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-xl font-bold text-gray-700 font-heading">
									Sign Loan Agreement
								</h2>
								<button
									onClick={handleDocumentSigningModalClose}
									className="text-gray-500 hover:text-gray-700 transition-colors"
								>
									<XMarkIcon className="w-6 h-6" />
								</button>
							</div>

							<div className="mb-6">
								<div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
									<div className="flex items-center">
										<DocumentIcon className="h-6 w-6 text-indigo-600 mr-3" />
										<div>
											<h3 className="text-sm font-medium text-indigo-800 font-heading">
												Ready to Sign
											</h3>
											<p className="text-sm text-indigo-700 mt-1 font-body">
												Your loan agreement is ready for digital signature.
											</p>
										</div>
									</div>
								</div>

								<div className="bg-blue-tertiary/5 rounded-xl p-4 border border-blue-tertiary/20">
									<h4 className="font-semibold text-gray-700 mb-2 font-heading">
										{selectedSigningApplication.product?.name || "Unknown Product"}
									</h4>
									<div className="text-sm text-gray-500 space-y-1 font-body">
										<p>
											Application ID:{" "}
											<span className="text-gray-700 font-medium">
												{selectedSigningApplication.id.slice(-8).toUpperCase()}
											</span>
										</p>
										<p>
											Amount:{" "}
											<span className="text-gray-700 font-medium">
												{getDisplayAmount(selectedSigningApplication) 
													? formatCurrency(getDisplayAmount(selectedSigningApplication)!) 
													: "-"}
											</span>
										</p>
										<p>
											Monthly Payment:{" "}
											<span className="text-gray-700 font-medium">
												{getDisplayMonthlyRepayment(selectedSigningApplication)
													? formatCurrency(getDisplayMonthlyRepayment(selectedSigningApplication)!)
													: "-"}
											</span>
										</p>
									</div>
								</div>
							</div>

							<div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
								<div className="flex items-start">
									<svg className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<div>
										<p className="text-sm text-amber-800 font-medium font-body">
											Important Information
										</p>
										<p className="text-xs text-amber-700 mt-1 font-body">
											• You will be redirected to the signing platform
											<br />
											• Review all terms carefully before signing
											<br />
											• You'll receive a copy of the signed agreement
											<br />
											• The signing process is secure and legally binding
										</p>
									</div>
								</div>
							</div>

							<div className="flex space-x-3">
								<button
									onClick={handleDocumentSigningModalClose}
									className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-semibold font-heading hover:bg-gray-200 transition-colors border border-gray-200"
								>
									Cancel
								</button>
								<button
									onClick={() => {
										handleDocumentSigningModalClose();
										handleDocumentSigning(selectedSigningApplication);
									}}
									disabled={signingInProgress}
									className="flex-1 bg-indigo-600 text-white py-3 px-4 rounded-xl font-semibold font-heading hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors shadow-sm"
								>
									{signingInProgress ? "Initiating..." : "Proceed to Sign"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</DashboardLayout>
	);
}

export default function LoansPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<LoansPageContent />
		</Suspense>
	);
}
