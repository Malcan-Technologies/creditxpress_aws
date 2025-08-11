"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
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
} from "@heroicons/react/24/outline";
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
	principalAmount: number;
	totalAmount: number;
	outstandingBalance: number;
	interestRate: number;
	term: number;
	monthlyPayment: number;
	nextPaymentDue: string;
	status: string;
	disbursedAt: string;
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
	application: {
		id: string;
		product: {
			name: string;
			code: string;
		};
		createdAt: string;
	};
	repayments?: Array<{
		id: string;
		amount: number;
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
	// Fresh offer fields
	freshOfferAmount?: number;
	freshOfferTerm?: number;
	freshOfferInterestRate?: number;
	freshOfferMonthlyRepayment?: number;
	freshOfferNetDisbursement?: number;
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
	const [showLoanDetails, setShowLoanDetails] = useState<{
		[key: string]: boolean;
	}>({});
	const [showApplicationDetails, setShowApplicationDetails] = useState<{
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
	const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"FPX" | "BANK_TRANSFER">("BANK_TRANSFER");
	const [repaymentError, setRepaymentError] = useState<string>("");

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

	useEffect(() => {
		const checkAuthAndLoadData = async () => {
			try {
				// First check if we have any tokens at all
				const accessToken = TokenStorage.getAccessToken();
				const refreshToken = TokenStorage.getRefreshToken();

				// If no tokens available, immediately redirect to login
				if (!accessToken && !refreshToken) {
					console.log(
						"Loans - No tokens available, redirecting to login"
					);
					router.push("/login");
					return;
				}

				const isAuthenticated = await checkAuth();
				if (!isAuthenticated) {
					console.log(
						"Loans - Auth check failed, redirecting to login"
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
					console.log("Scrolling to loans section");
					
					// Try scrollIntoView first
					try {
						loansSection.scrollIntoView({ 
							behavior: "smooth", 
							block: "start" 
						});
					} catch (error) {
						console.log("scrollIntoView failed, trying alternative method");
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
					console.log(`Scroll attempt ${attempt} failed, retrying...`);
					setTimeout(() => attemptScroll(attempt + 1, maxAttempts), 300 * attempt);
				} else {
					console.log("Failed to find loans section after", maxAttempts, "attempts");
				}
			};
			
			setTimeout(() => attemptScroll(), 500);
		}
	}, [searchParams]);

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

			// Set loans data
			if (loansData?.loans) {
				// Load full repayment schedules for all loans
				const loansWithFullRepayments = await Promise.all(
					loansData.loans.map(async (loan) => {
						try {
							const repaymentData = await fetchWithTokenRefresh<{
								repayments: LoanRepayment[];
							}>(`/api/loans/${loan.id}/repayments`);

							return {
								...loan,
								repayments: repaymentData?.repayments || [],
							};
						} catch (error) {
							console.error(
								`Error loading repayments for loan ${loan.id}:`,
								error
							);
							return loan; // Return loan without repayments if error
						}
					})
				);

				setLoans(loansWithFullRepayments);
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

	const handleConfirmRepayment = async () => {
		if (!selectedLoan || !repaymentAmount) return;

		if (selectedPaymentMethod === "FPX") {
			// Handle FPX payment flow - not implemented yet
			console.log("FPX payment selected");
			alert("FPX payment is not implemented yet. Please use Bank Transfer.");
			return;
		}

		// For Bank Transfer, generate reference and show the bank transfer modal
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

			// Call the API to create the bank transfer payment transaction
			const response = await fetchWithTokenRefresh(
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
						description: `Loan repayment - ${formatCurrency(
							amount
						)}`,
					}),
				}
			);

			if (response) {
				// Bank transfer payment submitted successfully
				setShowPaymentMethodModal(false);
				setCurrentPaymentReference("");
				setRepaymentAmount("");
				setSelectedLoan(null);

				// Reload data to show updated status
				await loadLoansAndSummary();

				alert(
					"Payment submitted successfully! Your transaction is pending approval."
				);
			}
		} catch (error) {
			console.error("Error submitting bank transfer payment:", error);
			alert("Failed to submit payment. Please try again.");
		}
	};

	const handleAutoFillMonthlyPayment = async () => {
		if (selectedLoan) {
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

	// Helper functions to get display values (fresh offer or original)
	const getDisplayAmount = (app: LoanApplication) => {
		return app.status === "PENDING_FRESH_OFFER" && app.freshOfferAmount 
			? app.freshOfferAmount 
			: app.amount;
	};

	const getDisplayTerm = (app: LoanApplication) => {
		return app.status === "PENDING_FRESH_OFFER" && app.freshOfferTerm 
			? app.freshOfferTerm 
			: app.term;
	};

	const getDisplayMonthlyRepayment = (app: LoanApplication) => {
		return app.status === "PENDING_FRESH_OFFER" && app.freshOfferMonthlyRepayment 
			? app.freshOfferMonthlyRepayment 
			: app.monthlyRepayment;
	};

	const getDisplayInterestRate = (app: LoanApplication) => {
		return app.status === "PENDING_FRESH_OFFER" && app.freshOfferInterestRate 
			? app.freshOfferInterestRate 
			: app.interestRate;
	};

	const getDisplayNetDisbursement = (app: LoanApplication) => {
		return app.status === "PENDING_FRESH_OFFER" && app.freshOfferNetDisbursement 
			? app.freshOfferNetDisbursement 
			: app.netDisbursement;
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

	const getStatusBadge = (status: string) => {
		switch (status.toUpperCase()) {
			case "ACTIVE":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200 font-body">
						<CheckCircleIcon className="h-3 w-3 mr-1" />
						Active
					</span>
				);
			case "PENDING_DISCHARGE":
				return (
					<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 font-body">
						<ClockIcon className="h-3 w-3 mr-1" />
						Pending Discharge
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
		const today = new Date();
		const due = new Date(dueDate);
		const diffTime = due.getTime() - today.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
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

		if (numAmount > loan.outstandingBalance) {
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
			case "PENDING_SIGNATURE":
				return "bg-indigo-100 text-indigo-800";
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
				return "Incomplete";
			case "PENDING_APP_FEE":
				return "Pending Fee";
			case "PENDING_KYC":
				return "Pending KYC";
			case "PENDING_APPROVAL":
				return "Under Review";
			case "PENDING_FRESH_OFFER":
				return "Fresh Offer Available";
			case "PENDING_ATTESTATION":
				// Show special status for live call requests
				if (attestationType === "MEETING") {
					return "Awaiting Live Call";
				}
				return "Pending Attestation";
			case "PENDING_SIGNATURE":
				return "Pending Signature";
			case "PENDING_DISBURSEMENT":
				return "Pending Disbursement";
			case "APPROVED":
				return "Approved";
			case "REJECTED":
				return "Rejected";
			case "DISBURSED":
				return "Disbursed";
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
			return { percentage: null, onTimeCount: 0, totalCount: 0 };
		}

		const completedRepayments = loan.repayments.filter(
			(r) => r.status === "COMPLETED"
		);

		if (completedRepayments.length === 0) {
			return { percentage: null, onTimeCount: 0, totalCount: 0 };
		}

		const onTimeOrEarlyPayments = completedRepayments.filter((r) => {
			const paymentDate = new Date(r.paidAt || r.createdAt);
			const dueDate = new Date(r.dueDate);
			return paymentDate <= dueDate;
		});

		const percentage = Math.round(
			(onTimeOrEarlyPayments.length / completedRepayments.length) * 100
		);

		return {
			percentage,
			onTimeCount: onTimeOrEarlyPayments.length,
			totalCount: completedRepayments.length,
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
			alert("Failed to delete application. Please try again.");
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

				alert(
					"Live video call request submitted! Our legal team will contact you within 1-2 business days to schedule your appointment."
				);
			}
		} catch (error) {
			console.error("Error requesting live call:", error);
			alert("Failed to submit live call request. Please try again.");
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

	// Handle fresh offer response
	const handleFreshOfferResponse = async (applicationId: string, action: 'accept' | 'reject') => {
		try {
			const actionText = action === 'accept' ? 'accept' : 'reject';
			const confirmMessage = `Are you sure you want to ${actionText} this fresh offer?`;
			
			if (!window.confirm(confirmMessage)) {
				return;
			}

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
				
				alert(message);
			}
		} catch (error) {
			console.error(`Error ${action}ing fresh offer:`, error);
			alert(`Failed to ${action} fresh offer. Please try again.`);
		}
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
											loan.status === "PENDING_DISCHARGE"
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
														const principalPaid = Number(repayment.principalPaid ?? 
															(repayment.status === "COMPLETED" ? (repayment.amount || 0) : 0)) || 0;
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
														const principalPaid = Number(repayment.principalPaid ?? 
															(repayment.actualAmount || 0)) || 0;

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
							<div className="flex items-center mb-4">
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
						</div>

						{/* Tab Navigation - Mobile Friendly */}
						<div className="border-b border-gray-100 bg-gray-50/50">
							<nav
								className="grid grid-cols-3 gap-1 px-1 sm:grid-cols-5 sm:gap-0 sm:flex sm:space-x-4 sm:px-6 lg:px-8"
								aria-label="Tabs"
							>
								<button
									onClick={() => setActiveTab("loans")}
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
											].includes(
												loan.status.toUpperCase()
											)
										).length > 0 && (
											<span className="bg-blue-600/10 text-blue-600 py-0.5 px-1.5 rounded-full text-xs font-medium border border-blue-600/20 font-body sm:px-2">
												{
													loans.filter((loan) =>
														[
															"ACTIVE",
															"PENDING_DISCHARGE",
														].includes(
															loan.status.toUpperCase()
														)
													).length
												}
											</span>
										)}
									</div>
								</button>
								<button
									onClick={() => setActiveTab("discharged")}
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
									onClick={() => setActiveTab("applications")}
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
									onClick={() => setActiveTab("incomplete")}
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
									onClick={() => setActiveTab("rejected")}
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
											].includes(status) &&
												loan.outstandingBalance > 0) ||
											status === "PENDING_DISCHARGE"
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
													} else if (loan.nextPaymentDue) {
														// Use the updated urgency function for consistent messaging
														const daysUntilDue = calculateDaysUntilDue(loan.nextPaymentDue);
														urgency = getPaymentUrgency(daysUntilDue);
														} else {
														urgency = { color: "text-gray-500", text: "No Due Date" };
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
																			<h4 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
																				{
																					loan
																						.application
																						.product
																						.name
																				}
																			</h4>
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
																			const principalPaid = repayment.principalPaid ?? 
																				(repayment.status === "COMPLETED" ? repayment.amount : 
																				 repayment.status === "PARTIAL" ? (repayment.actualAmount || 0) : 0);
																			totalPrincipalPaid += principalPaid;
																		});
																	}
																	
																			const progressPercent = totalOriginalAmount > 0 
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
																									{progressPercent}%
																			</div>
																								<div className="text-sm text-gray-500 font-body">
																									Repaid
																								</div>
																							</div>
																						</div>
																					</div>
																					<div className="text-center">
																						<p className="text-lg xl:text-xl font-heading font-bold text-blue-600">
																					{formatCurrency(totalPrincipalPaid)}
																		</p>
																						<p className="text-sm lg:text-base text-gray-500 font-body">
																							of {formatCurrency(totalOriginalAmount)} repaid
																		</p>
																	</div>
																				</>
																			);
																		})()}
																	</div>

																	{/* Next Payment Amount */}
																	<div className="text-left">
																		{(() => {
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
																			
																			// Use red theme for overdue, blue for regular payments
																			const isOverdue = hasOverduePayments || nextPayment.isOverdue;
																			const cardColors = isOverdue 
																				? "from-red-50 to-red-100 border-red-200" 
																				: "from-blue-50 to-blue-100 border-blue-200";
																			const iconColor = isOverdue ? "bg-red-400" : "bg-blue-400";
																			const textColor = isOverdue ? "text-red-700" : "text-blue-700";
																			const amountColor = isOverdue ? "text-red-600" : "text-blue-700";
																			
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
																									{hasOverduePayments ? "Total Amount Due" : "Next Payment"}
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
																			// Check for overdue payments for styling
																			const hasOverduePayments = loan.overdueInfo?.hasOverduePayments;
																			const maxDaysOverdue = hasOverduePayments && loan.overdueInfo?.overdueRepayments && loan.overdueInfo.overdueRepayments.length > 0
																				? Math.max(...loan.overdueInfo.overdueRepayments.map(rep => rep.daysOverdue))
																				: 0;
																			
																			// Calculate days until due for color coding
																			const daysUntilDue = calculateDaysUntilDue(loan.nextPaymentDue);
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
																			// For overdue payments, show the earliest overdue repayment due date
																			// For regular payments, show the loan's next payment due date
																			let displayDate = loan.nextPaymentDue;
																			
																			if (hasOverduePayments && loan.overdueInfo?.overdueRepayments && loan.overdueInfo.overdueRepayments.length > 0) {
																				// Find the earliest overdue repayment due date
																				const earliestOverdueDate = loan.overdueInfo.overdueRepayments
																					.map(rep => new Date(rep.dueDate))
																					.sort((a, b) => a.getTime() - b.getTime())[0];
																				displayDate = earliestOverdueDate.toISOString();
																			}
																			
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
																		
																		if (loan.repayments) {
																			loan.repayments.forEach(repayment => {
																					totalLateFeesPaid += repayment.lateFeesPaid || 0;
																				const principalPaid = repayment.principalPaid ?? 
																					(repayment.status === "COMPLETED" ? repayment.amount : 
																					 repayment.status === "PARTIAL" ? (repayment.actualAmount || 0) : 0);
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
																							{formatCurrency(loan.outstandingBalance || 0)}
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
																									{performance.onTimeCount} of {performance.totalCount} on-time
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
																							Principal Paid
																						</p>
																						<p className="text-lg font-semibold text-blue-600 font-heading">
																							{formatCurrency(totalPrincipalPaid)}
																						</p>
																				</div>

																					{/* Late Fees if any */}
																					{totalLateFeesPaid > 0 && (
																						<div className="bg-white p-4 rounded-lg border border-gray-200">
																							<p className="text-sm text-gray-500 mb-1 font-body">
																								Late Fees Paid
																							</p>
																							<p className="text-lg font-semibold text-blue-600 font-heading">
																								{formatCurrency(totalLateFeesPaid)}
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
																							</tr>
																						</thead>
																						<tbody className="bg-white divide-y divide-gray-200">
																							{loan.repayments
																								.sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0))
																								.map((repayment, index) => {
																									const totalDue = (repayment.amount || 0) + (repayment.lateFeeAmount || 0);
																									const isOverdue = repayment.status === "PENDING" && new Date(repayment.dueDate) < new Date();
																									
																									// Calculate payment amounts
																									const principalPaid = repayment.principalPaid ?? 
																										(repayment.status === "COMPLETED" ? (repayment.amount || 0) : 
																										 repayment.status === "PARTIAL" ? (repayment.actualAmount || 0) : 0);
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
																													<span>{formatCurrency(repayment.amount || 0)}</span>
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
																														{lateFeesPaid > 0 && (
																															<span className="text-xs text-green-600 font-medium">
																																Paid: {formatCurrency(lateFeesPaid)}
																															</span>
																														)}
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
																													} else if (repayment.status === "PARTIAL") {
																														return (
																															<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
																																<ClockIcon className="h-3 w-3 mr-1" />
																																Partial
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
																														{paymentTiming && (
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

																	<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
																		<div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col p-6">
																			<div className="flex items-center mb-4">
																				<div className="w-12 h-12 lg:w-14 lg:h-14 bg-green-600/10 rounded-xl flex items-center justify-center mr-3">
																					<CheckCircleIcon className="h-6 w-6 lg:h-7 lg:w-7 text-green-600" />
																				</div>
																				<div>
																					<h4 className="text-base lg:text-lg font-heading font-bold text-gray-700 mb-1">
																						Total Repaid
																					</h4>
																				</div>
																			</div>
																			<div className="space-y-4 lg:space-y-6">
																				<div>
																					<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																						{formatCurrency(loan.totalAmount)}
																					</p>
																				</div>
																				<div className="text-base lg:text-lg text-gray-600 font-body leading-relaxed">
																					Loan fully completed
																				</div>
																			</div>
																		</div>
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
																							{performance.percentage !== null 
																								? `${performance.onTimeCount} of ${performance.totalCount} on-time`
																								: "No payments recorded"
																							}
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
																						{formatDate(loan.disbursedAt)}
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
																				<h4 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
																					{app
																						.product
																						?.name ||
																						"Unknown Product"}
																				</h4>
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
                                                                                {app.status === "PENDING_KYC" && (
                                                                                    <div className="flex items-center space-x-3">
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                // Deep link into KYC flow
                                                                                                window.location.href = `/dashboard/kyc?applicationId=${app.id}`;
                                                                                            }}
                                                                                            className="inline-flex items-center px-4 py-2 border border-blue-200 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                                                                        >
                                                                                            Continue KYC
                                                                                            <ArrowRightIcon className="ml-2 h-4 w-4" />
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setSelectedApplication(app);
                                                                                                setShowWithdrawModal(true);
                                                                                            }}
                                                                                            className="inline-flex items-center px-4 py-2 border border-red-200 text-sm font-medium rounded-md text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                                                                                        >
                                                                                            Withdraw
                                                                                        </button>
                                                                                    </div>
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
																						<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																							{getDisplayAmount(app) ? formatCurrency(getDisplayAmount(app)!) : "-"}
																						</p>
																						{app.status === "PENDING_FRESH_OFFER" && (
																							<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800 border border-pink-200">
																								Fresh Offer
																							</span>
																						)}
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
																						<p className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-3">
																							{getDisplayMonthlyRepayment(app) ? formatCurrency(getDisplayMonthlyRepayment(app)!) : "-"}
																						</p>
																						{app.status === "PENDING_FRESH_OFFER" && (
																							<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800 border border-pink-200">
																								Fresh Offer
																							</span>
																						)}
																					</div>
																					<div className="text-sm lg:text-base text-gray-600 font-body leading-relaxed">
																						{app.status === "PENDING_FRESH_OFFER" ? "Revised monthly payment amount" : "Expected monthly payment"}
																					</div>
																				</div>
																			</div>
																		</div>
																	</div>

																	{/* Status */}
																	<div className="mb-4">
																		<div className="flex items-center p-4 bg-purple-50 rounded-xl border border-purple-200">
																			<DocumentTextIcon className="h-8 w-8 text-purple-600 mr-3" />
																			<div className="flex-1">
																				<p className="text-lg font-semibold text-purple-700">
																					Application Status
																				</p>
																				<p className="text-sm text-gray-600">
																					{getApplicationStatusLabel(app.status, app.attestationType)}
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
																	// Check for overdue payments and get the correct due date
																	const hasOverduePayments = loan.overdueInfo?.hasOverduePayments;
																	const overdueRepayments = loan.overdueInfo?.overdueRepayments;
																	let displayDueDate;
																	
																	if (hasOverduePayments && overdueRepayments && overdueRepayments.length > 0) {
																		// Show the earliest overdue repayment due date
																		const earliestOverdue = overdueRepayments
																			.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
																		displayDueDate = earliestOverdue.dueDate;
																	} else {
																		// Show regular next payment due date
																		displayDueDate = loan.nextPaymentDue;
																	}
																	
																	return formatDate(displayDueDate);
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
																// Check for overdue payments and get the correct due date
																const hasOverduePayments = selectedLoan.overdueInfo?.hasOverduePayments;
																const overdueRepayments = selectedLoan.overdueInfo?.overdueRepayments;
																let displayDueDate;
																
																if (hasOverduePayments && overdueRepayments && overdueRepayments.length > 0) {
																	// Show the earliest overdue repayment due date
																	const earliestOverdue = overdueRepayments
																		.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
																	displayDueDate = earliestOverdue.dueDate;
																} else {
																	// Show regular next payment due date
																	displayDueDate = selectedLoan.nextPaymentDue;
																}
																
																return formatDate(displayDueDate);
															})()}
												</p>
											</div>
										</div>
									</div>

									{/* Payment Method Selection */}
									<div className="mb-6">
										<h4 className="text-lg font-semibold text-gray-700 mb-4 font-heading">
											Payment Method
										</h4>
										<div className="space-y-3">
											{/* FPX Express Payment */}
											<button
												onClick={() => setSelectedPaymentMethod("FPX")}
												className={`w-full border rounded-xl p-4 transition-colors bg-white text-left shadow-sm ${
													selectedPaymentMethod === "FPX"
														? "border-green-500 bg-green-50/50"
														: "border-gray-200 hover:border-green-400 hover:bg-green-50/30"
												}`}
											>
												<div className="flex items-center justify-between mb-3">
													<div className="flex items-center space-x-3">
														<div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center border border-green-200">
															<span className="text-green-700 font-bold text-sm">
																FPX
															</span>
														</div>
														<div>
															<h3 className="font-semibold text-gray-700 font-heading">
																FPX Express Payment
															</h3>
															<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 font-body">
																Popular
															</span>
														</div>
													</div>
													<div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
														selectedPaymentMethod === "FPX"
															? "border-green-500 bg-green-500"
															: "border-gray-300"
													}`}>
														{selectedPaymentMethod === "FPX" && (
															<div className="w-2 h-2 bg-white rounded-full"></div>
														)}
													</div>
												</div>
												<div className="space-y-2 text-sm text-gray-500 font-body">
													<div className="flex justify-between">
														<span>Estimated Arrival</span>
														<span className="text-gray-700">
															Usually 5 Min
														</span>
													</div>
													<div className="flex justify-between">
														<span>Fees</span>
														<span className="text-gray-700">
															Up to 2%
														</span>
													</div>
													{/* <div className="flex justify-between">
														<span>Supported Banks</span>
														<span className="text-gray-700">
															Most Malaysian Banks
														</span>
													</div> */}
												</div>
											</button>

											{/* Bank Transfer */}
											<button
												onClick={() => setSelectedPaymentMethod("BANK_TRANSFER")}
												className={`w-full border rounded-xl p-4 transition-colors text-left bg-white shadow-sm ${
													selectedPaymentMethod === "BANK_TRANSFER"
														? "border-blue-500 bg-blue-50/50"
														: "border-gray-200 hover:border-blue-400 hover:bg-blue-50/30"
												}`}
											>
												<div className="flex items-center justify-between mb-3">
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
														<h3 className="font-semibold text-gray-700 font-heading">
															Bank Transfer
														</h3>
													</div>
													<div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
														selectedPaymentMethod === "BANK_TRANSFER"
															? "border-blue-500 bg-blue-500"
															: "border-gray-300"
													}`}>
														{selectedPaymentMethod === "BANK_TRANSFER" && (
															<div className="w-2 h-2 bg-white rounded-full"></div>
														)}
													</div>
												</div>
												<div className="space-y-2 text-sm text-gray-500 font-body">
													<div className="flex justify-between">
														<span>Estimated Arrival</span>
														<span className="text-gray-700">
															Usually 1 Business Day
														</span>
													</div>
													<div className="flex justify-between">
														<span>Fees</span>
														<span className="text-gray-700">Free</span>
													</div>
													<div className="flex justify-between">
														<span>Supported Banks</span>
														<span className="text-gray-700">
															Most Malaysian Banks
														</span>
													</div>
												</div>
											</button>
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
															onClick={() => {
																const fullBalance =
																	(
																		Math.round(
																			selectedLoan.outstandingBalance *
																				100
																		) / 100
																	).toFixed(
																		2
																	);
																setRepaymentAmount(
																	fullBalance
																);
																validateRepaymentAmount(
																	fullBalance,
																	selectedLoan
																);
															}}
															className="text-sm text-green-600 hover:text-green-700 font-medium font-body"
														>
															Full Balance
														</button>
													)}
											</div>
										</div>
										<input
											type="number"
											value={repaymentAmount}
											onChange={(e) =>
												handleRepaymentAmountChange(
													e.target.value
												)
											}
											placeholder="0.00"
											className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-gray-700 placeholder-gray-400 bg-white font-body ${
												repaymentError
													? "border-red-400 focus:border-red-400 focus:ring-red-400"
													: "border-gray-300"
											}`}
											min="1"
											step="0.01"
											max={
												selectedLoan.outstandingBalance
											}
										/>
										{repaymentError && (
											<p className="mt-2 text-sm text-red-600 font-body">
												{repaymentError}
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
										<div className="flex justify-between text-sm text-gray-500 mt-2 font-body">
											<span>Outstanding Balance</span>
											<span className="font-medium text-gray-700">
												{formatCurrency(
													selectedLoan.outstandingBalance
												)}
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
												parseFloat(repaymentAmount) >
													selectedLoan.outstandingBalance
											}
											className="bg-blue-600 text-white flex-1 py-3 px-4 rounded-xl font-semibold font-heading hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md disabled:shadow-none"
										>
											{selectedPaymentMethod === "FPX" ? "Continue with FPX" : "Continue"}
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
