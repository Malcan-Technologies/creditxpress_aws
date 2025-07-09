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
	VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { checkAuth, fetchWithTokenRefresh, TokenStorage } from "@/lib/authUtils";
import PaymentMethodModal from "@/components/modals/PaymentMethodModal";
import BankTransferModal from "@/components/modals/BankTransferModal";
import AttestationMethodModal from "@/components/modals/AttestationMethodModal";
import LiveCallConfirmationModal from "@/components/modals/LiveCallConfirmationModal";

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
}

interface LoanApplication {
	id: string;
	status: string;
	appStep: number;
	amount: number;
	term: number;
	purpose: string;
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
	loanApplicationId: string;
	previousStatus: string | null;
	newStatus: string;
	changedBy: string;
	changedById: string;
	createdAt: string;
	notes?: string;
}

function LoansPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [userName, setUserName] = useState<string>("");
	const [loans, setLoans] = useState<Loan[]>([]);
	const [applications, setApplications] = useState<LoanApplication[]>([]);
	const [activeTab, setActiveTab] = useState<
		"loans" | "discharged" | "applications" | "incomplete"
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
	const [showBankTransferModal, setShowBankTransferModal] =
		useState<boolean>(false);
	const [repaymentAmount, setRepaymentAmount] = useState<string>("");
	const [paymentMethod, setPaymentMethod] = useState<
		"WALLET_BALANCE" | "FRESH_FUNDS"
	>("WALLET_BALANCE");
	const [walletBalance, setWalletBalance] = useState<number>(0);
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
				if (!userData?.isOnboardingComplete) {
					router.push("/onboarding");
					return;
				}

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

	// Handle tab query parameter
	useEffect(() => {
		const tab = searchParams.get("tab");
		if (tab === "applications") {
			setActiveTab("applications");
		} else if (tab === "discharged") {
			setActiveTab("discharged");
		} else if (tab === "incomplete") {
			setActiveTab("incomplete");
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

	const loadWalletBalance = async () => {
		try {
			const data = await fetchWithTokenRefresh<any>("/api/wallet");
			if (data?.balance) {
				setWalletBalance(data.balance);
			}
		} catch (error) {
			console.error("Error loading wallet balance:", error);
		}
	};

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
		loadWalletBalance();
		setShowLoanRepayModal(true);
	};

	const handleConfirmRepayment = async () => {
		if (!selectedLoan || !repaymentAmount) return;

		if (paymentMethod === "FRESH_FUNDS") {
			setShowLoanRepayModal(false);
			setShowPaymentMethodModal(true);
		} else {
			try {
				const amount = parseFloat(repaymentAmount);

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
							paymentMethod,
						}),
					}
				);

				if (response) {
					// Wallet balance payment - reload data
					await Promise.all([
						loadLoansAndSummary(),
						loadWalletBalance(),
					]);
					setShowLoanRepayModal(false);
					setRepaymentAmount("");
					setSelectedLoan(null);
				}
			} catch (error) {
				console.error("Error processing repayment:", error);
			}
		}
	};

	const handleFPXSelect = () => {
		// Handle FPX payment flow
		console.log("FPX payment selected");
	};

	const handleBankTransferSelect = () => {
		setShowPaymentMethodModal(false);
		setShowBankTransferModal(true);
	};

	const handleBankTransferConfirm = async () => {
		if (!selectedLoan || !repaymentAmount) return;

		try {
			const amount = parseFloat(repaymentAmount);

			// Call the API to create the fresh funds payment transaction
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
						description: `Fresh funds loan repayment - ${formatCurrency(
							amount
						)}`,
					}),
				}
			);

			if (response) {
				// Fresh funds payment submitted successfully
				setShowBankTransferModal(false);
				setRepaymentAmount("");
				setSelectedLoan(null);

				// Reload data to show updated status
				await loadLoansAndSummary();

				alert(
					"Payment submitted successfully! Your transaction is pending approval."
				);
			}
		} catch (error) {
			console.error("Error submitting fresh funds payment:", error);
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
		if (daysUntilDue <= 5)
			return { color: "text-orange-600", text: "Due Soon" };
		if (daysUntilDue <= 10)
			return { color: "text-yellow-600", text: "Due This Month" };
		return { color: "text-green-600", text: "On Track" };
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

		if (paymentMethod === "WALLET_BALANCE" && numAmount > walletBalance) {
			setRepaymentError(
				`Insufficient wallet balance. Available: ${formatCurrency(
					walletBalance
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

		return `Status changed from ${getApplicationStatusLabel(
			previousStatus
		)} to ${getApplicationStatusLabel(newStatus)}`;
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

	// Handle bar click to show details
	const handleBarClick = (monthData: any) => {
		const now = new Date();
		const isCurrentMonth =
			monthData.date.getMonth() === now.getMonth() &&
			monthData.date.getFullYear() === now.getFullYear();

		// Use backend overdue data instead of frontend date calculations
		const overdue = (monthData.unpaidLateFees || 0) > 0 ? monthData.totalOutstanding : 0;
		const upcoming =
			!isCurrentMonth && (monthData.unpaidLateFees || 0) === 0 ? monthData.totalOutstanding : 0;

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
					{/* Repayment Schedule Chart - Full Width */}
					<div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full mb-6 min-w-0">
						<div className="p-6 min-w-0">
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
								<div className="flex items-center space-x-2">
									<div className="p-2 bg-purple-primary/10 rounded-lg border border-purple-primary/20">
										<ChartBarIcon className="h-5 w-5 text-purple-primary" />
									</div>
									<h3 className="text-lg font-heading text-purple-primary font-semibold">
										Repayment Schedule
									</h3>
								</div>

								{/* Time Filter Buttons */}
								<div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200 w-full sm:w-auto max-w-xs sm:max-w-none">
									<button
										onClick={() =>
											setChartTimeFilter("year")
										}
										className={`flex-1 sm:flex-none px-3 py-2 text-sm rounded-md transition-colors font-body ${
											chartTimeFilter === "year"
												? "bg-purple-primary text-white shadow-sm"
												: "text-gray-600 hover:text-purple-primary hover:bg-white"
										}`}
									>
										<span className="hidden sm:inline">
											This Year
										</span>
										<span className="sm:hidden">Year</span>
									</button>
									<button
										onClick={() =>
											setChartTimeFilter("all")
										}
										className={`flex-1 sm:flex-none px-3 py-2 text-sm rounded-md transition-colors font-body ${
											chartTimeFilter === "all"
												? "bg-purple-primary text-white shadow-sm"
												: "text-gray-600 hover:text-purple-primary hover:bg-white"
										}`}
									>
										<span className="hidden sm:inline">
											All Time
										</span>
										<span className="sm:hidden">All</span>
									</button>
								</div>
							</div>

							{/* Chart Section */}
							<div className="mb-6 min-w-0 overflow-hidden">
								{(() => {
									// Generate monthly data for all loans using proper payment allocation
									const monthlyData = new Map();
									const now = new Date();

									// Process each loan individually
									loans
										.filter(
											(loan) =>
												loan.status === "ACTIVE" ||
												loan.status ===
													"PENDING_DISCHARGE"
										)
										.forEach((loan) => {
											if (!loan.repayments) return;

											// Sort repayments by due date (chronological order)
											const sortedRepayments = [
												...loan.repayments,
											].sort(
												(a, b) =>
													new Date(
														a.dueDate
													).getTime() -
													new Date(
														b.dueDate
													).getTime()
											);

											// Process each repayment individually based on its actual status and payments
											sortedRepayments.forEach(
												(repayment) => {
													const dueDate = new Date(
														repayment.dueDate
													);
													const monthKey = `${dueDate.getFullYear()}-${String(
														dueDate.getMonth() + 1
													).padStart(2, "0")}`;

													if (
														!monthlyData.has(
															monthKey
														)
													) {
														monthlyData.set(
															monthKey,
															{
																month: monthKey,
																date: dueDate,
																totalScheduled: 0,
																		totalPrincipalPaid: 0, // Track principal paid (excluding late fees)
																totalOutstanding: 0,
																lateFees: 0, // Track total late fees for this month
																paidLateFees: 0, // Track late fees that were paid
																unpaidLateFees: 0, // Track late fees still owed
															}
														);
													}

													const monthData =
														monthlyData.get(
															monthKey
														);

													// Get late fee information directly from the repayment data
													const repaymentLateFees = repayment.lateFeeAmount || 0;
													const repaymentLateFeesPaid = repayment.lateFeesPaid || 0;

													// Calculate total amount for this repayment (scheduled + late fees)
													const repaymentTotalAmount =
														repayment.amount +
														repaymentLateFees;

													// Add to total scheduled for this month (ONLY the original scheduled amount)
													monthData.totalScheduled +=
														(repayment.amount || 0);
													monthData.lateFees +=
														(repaymentLateFees || 0);

																												// Determine payment status based on repayment status and principalPaid
													if (
														repayment.status ===
														"COMPLETED"
													) {
																														// Use principalPaid which excludes late fees
														// Handle null/undefined principalPaid by falling back to amount for completed payments
														const principalPaid = Number(repayment.principalPaid ?? 
															(repayment.status === "COMPLETED" ? (repayment.amount || 0) : 0)) || 0;
														monthData.totalPrincipalPaid +=
															principalPaid;

														// For completed repayments, use the actual database values for late fees
														if (repaymentLateFees > 0) {
															// Add the late fees that were actually paid according to the database
															monthData.paidLateFees += repaymentLateFeesPaid;
															
															// The remaining late fees are unpaid (should be 0 for completed payments)
															const remainingLateFees = repaymentLateFees - repaymentLateFeesPaid;
															if (remainingLateFees > 0) {
																monthData.unpaidLateFees += remainingLateFees;
															}
														}

														// For completed payments, calculate outstanding as: total amount (including late fees) - principal paid
														// This naturally includes any unpaid late fees in the outstanding balance
														const totalAmountDue = (repayment.amount || 0) + (repaymentLateFees || 0);
														const outstanding = Math.max(0, totalAmountDue - principalPaid);
														monthData.totalOutstanding += outstanding;
													} else if (
														repayment.status === "PARTIAL" ||
														(repayment.status === "PENDING" &&
														repayment.paymentType === "PARTIAL" &&
														(repayment.actualAmount ?? 0) > 0)
													) {
														// Partially paid - use principalPaid for principal portion
														// Handle both new PARTIAL status and legacy PENDING+PARTIAL paymentType
														// Fall back to actualAmount if principalPaid is null (legacy data)
														const principalPaid = Number(repayment.principalPaid ?? 
															(repayment.actualAmount || 0)) || 0;

														console.log(
															`PARTIAL payment debug:`,
															{
																repaymentId:
																	repayment.id,
																status: repayment.status,
																paymentType:
																	repayment.paymentType,
																amount: repayment.amount,
																actualAmount:
																	repayment.actualAmount,
																principalPaid:
																	principalPaid,
																repaymentTotalAmount:
																	repaymentTotalAmount,
																repaymentLateFees:
																	repaymentLateFees,
																repaymentLateFeesPaid:
																	repaymentLateFeesPaid,
																monthKey:
																	monthKey,
															}
														);

														monthData.totalPrincipalPaid +=
															principalPaid;
														// For partial payments, calculate outstanding as: total amount (including late fees) - principal paid
														const totalAmountDue = (repayment.amount || 0) + (repaymentLateFees || 0);
														const outstanding = Math.max(0, totalAmountDue - principalPaid);
														monthData.totalOutstanding += outstanding;

														// Use actual database values for late fees (this is the key fix!)
														if (repaymentLateFees > 0) {
															// Add the late fees that were actually paid according to the database
															monthData.paidLateFees += repaymentLateFeesPaid;
															
															// The remaining late fees are unpaid and will continue to accrue
															const remainingLateFees = repaymentLateFees - repaymentLateFeesPaid;
															if (remainingLateFees > 0) {
																monthData.unpaidLateFees += remainingLateFees;
															}
														}
													} else {
														// PENDING - nothing paid yet (excluding partial payments which are handled above)
														// Total amount due includes original amount + late fees
														const totalAmountDue = (repayment.amount || 0) + (repaymentLateFees || 0);
														monthData.totalOutstanding += totalAmountDue;

														// Use actual database values for late fees
														if (repaymentLateFees > 0) {
															// Add the late fees that were actually paid according to the database
															monthData.paidLateFees += repaymentLateFeesPaid;
															
															// The remaining late fees are unpaid
															const remainingLateFees = repaymentLateFees - repaymentLateFeesPaid;
															if (remainingLateFees > 0) {
																monthData.unpaidLateFees += remainingLateFees;
															}
														}
													}
												}
											);
										});

									// Sort months chronologically and apply time filter
									let sortedMonths = Array.from(
										monthlyData.values()
									).sort(
										(a, b) =>
											a.date.getTime() - b.date.getTime()
									);

									// Apply time filter
									if (chartTimeFilter === "year") {
										const currentYear =
											new Date().getFullYear();
										sortedMonths = sortedMonths.filter(
											(month) =>
												month.date.getFullYear() ===
												currentYear
										);
									}

									// Calculate responsive bar width and spacing based on number of months
									const getBarConfig = (
										monthCount: number
									) => {
										// Responsive bar sizing based on screen size and month count
										let barClass;
										if (monthCount <= 6) {
											barClass =
												"flex-1 max-w-20 min-w-8"; // Wider bars for fewer months
										} else if (monthCount <= 12) {
											barClass =
												"flex-1 max-w-16 min-w-6"; // Medium bars
										} else if (monthCount <= 24) {
											barClass =
												"flex-1 max-w-12 min-w-4"; // Smaller bars for more months
										} else {
											barClass = "flex-1 max-w-8 min-w-3"; // Very thin bars for many months
										}

										return {
											barClass,
											containerClass:
												"justify-between gap-0.5 sm:gap-1 md:gap-2",
											scrollable: false, // Always full width, no scrolling
											minWidth: null,
										};
									};

									const barConfig = getBarConfig(
										sortedMonths.length
									);
									const {
										barClass: barWidthClass,
										containerClass,
										scrollable,
										minWidth,
									} = barConfig;

									if (sortedMonths.length === 0) {
										return (
											<div className="text-center text-gray-500 py-8 md:py-12">
												<div className="bg-gray-50 rounded-lg p-6 md:p-8 border border-gray-200">
													<ChartBarIcon className="h-12 w-12 md:h-16 md:w-16 text-gray-400 mx-auto mb-4" />
													<p className="text-base md:text-lg font-medium font-heading text-gray-700">
														No repayment schedule
														available
													</p>
													<p className="text-sm text-gray-500 mt-2 font-body">
														Apply for a loan to see
														your payment timeline
													</p>
												</div>
											</div>
										);
									}

									return (
										<div className="space-y-4 min-w-0">
											{/* Vertical Bar Chart */}
											<div className="relative h-64 sm:h-80 w-full min-w-0">
												{/* Chart area - properly contained */}
												<div className="absolute inset-0">
													<div
														className={`h-full flex items-end border-b border-gray-200 pt-4 px-2 pb-2 ${containerClass}`}
														style={{
															width: "100%",
														}}
													>
														{sortedMonths.map(
															(monthData) => {
																// Calculate max amount considering both scheduled and actual principal paid amounts
																// This ensures bars scale properly for principal payment progress
																const maxAmount = Math.max(
																	1, // Minimum value to prevent division by zero
																		...sortedMonths.map(
																		(m) =>
																				Math.max(
																				Number(m.totalScheduled) || 0,
																				(Number(m.totalPrincipalPaid) || 0) +
																					(Number(m.totalOutstanding) || 0)
																			)
																	)
																);

																// Calculate the actual total for this month (principal paid + what's still owed)
																const actualTotal =
																	(Number(monthData.totalPrincipalPaid) || 0) +
																	(Number(monthData.totalOutstanding) || 0);
																const totalBarHeight =
																	(actualTotal /
																		maxAmount) *
																	100;
																const paidHeight =
																	maxAmount > 0
																		? ((Number(monthData.totalPrincipalPaid) || 0) /
																				maxAmount) *
																		  100
																		: 0;
																const outstandingHeight =
																	maxAmount > 0
																		? ((Number(monthData.totalOutstanding) || 0) /
																				maxAmount) *
																		  100
																		: 0;
																// Use backend overdue data instead of frontend date calculations
																const hasUnpaidLateFees = (monthData.unpaidLateFees || 0) > 0;
																const isCurrentMonth =
																	monthData.date.getMonth() ===
																		now.getMonth() &&
																	monthData.date.getFullYear() ===
																		now.getFullYear();

																return (
																	<div
																		key={
																			monthData.month
																		}
																		className="flex flex-col items-center h-full flex-1"
																	>
																		{/* Bar container */}
																		<div
																			className="relative flex-1 flex items-end w-full cursor-pointer hover:opacity-80 transition-opacity"
																			style={{
																				height: "200px",
																			}}
																			onClick={() =>
																				handleBarClick(
																					monthData
																				)
																			}
																		>
																			{/* Paid portion (bottom - green) */}
																			{paidHeight >
																				0 && (
																				<div
																					className={`${barWidthClass} bg-green-600 absolute bottom-0 left-1/2 transform -translate-x-1/2 ${
																						outstandingHeight ===
																						0
																							? "rounded-lg"
																							: "rounded-b-lg"
																					}`}
																					style={{
																						height: `${paidHeight}%`,
																					}}
																				/>
																			)}

																			{/* Outstanding portion (stacked on top of paid) */}
																			{outstandingHeight >
																				0 && (
																				<div
																					className={`${barWidthClass} absolute left-1/2 transform -translate-x-1/2 ${
																						hasUnpaidLateFees
																							? "bg-red-500"
																							: isCurrentMonth
																							? "bg-amber-500"
																							: "bg-blue-tertiary"
																					} ${
																						paidHeight ===
																						0
																							? "rounded-lg bottom-0"
																							: "rounded-t-lg"
																					}`}
																					style={{
																						height: `${outstandingHeight}%`,
																						bottom: `${paidHeight}%`,
																					}}
																				/>
																			)}

																			{/* Data Label - Smart positioning */}
																			{(() => {
																				// Show actual total (paid + outstanding) instead of just scheduled
																				const totalAmount =
																					actualTotal;
																				const shouldLabelBeInside =
																					totalBarHeight >
																					75; // If bar is taller than 75%, put label inside
																				const shouldShowLabel =
																					totalBarHeight >
																					15; // Only show label if bar is at least 15% tall
																				const labelPosition =
																					shouldLabelBeInside
																						? {
																								top: `${
																									100 -
																									totalBarHeight +
																									2
																								}%`,
																						  } // Inside the bar, starting from top
																						: {
																								bottom: `${
																									totalBarHeight +
																									3
																								}%`,
																						  }; // Outside the bar, above it

																				if (
																					!shouldShowLabel
																				)
																					return null;

																				return (
																					<div
																						className={`absolute left-1/2 transform -translate-x-1/2 text-xs font-medium font-body pointer-events-none z-20 ${
																							shouldLabelBeInside
																								? "text-white"
																								: "text-gray-600"
																						}`}
																						style={{
																							...labelPosition,
																							writingMode:
																								"vertical-rl",
																							textOrientation:
																								"mixed",
																							transform:
																								"translateX(-50%) rotate(180deg)",
																						}}
																					>
																						{formatCurrency(
																							totalAmount
																						)}
																					</div>
																				);
																			})()}

																			{/* Amount tooltip on hover - hidden on mobile */}
																			<div className="hidden md:block absolute -top-16 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 shadow-lg text-gray-700 text-xs px-3 py-2 rounded-lg opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
																				<div className="font-medium">
																					Scheduled:{" "}
																					{formatCurrency(
																						Number(monthData.totalScheduled) || 0
																					)}
																				</div>
																				{(monthData.paidLateFees ||
																					0) >
																					0 && (
																					<div className="text-green-600 font-medium">
																						Late
																						Fees
																						Paid:{" "}
																						{formatCurrency(
																							Number(monthData.paidLateFees) || 0
																						)}
																					</div>
																				)}
																				{(monthData.unpaidLateFees ||
																					0) >
																					0 && (
																					<div className="text-red-600 font-medium">
																						Late
																						Fees
																						Owed:{" "}
																						{formatCurrency(
																							Number(monthData.unpaidLateFees) || 0
																						)}
																					</div>
																				)}
																				<div className="text-green-600 font-medium">
																					Principal Paid:{" "}
																					{formatCurrency(
																						Number(monthData.totalPrincipalPaid) || 0
																					)}
																				</div>
																				<div className="text-blue-tertiary font-medium">
																					Outstanding:{" "}
																					{formatCurrency(
																						Number(monthData.totalOutstanding) || 0
																					)}
																				</div>
																				{actualTotal !==
																					monthData.totalScheduled && (
																					<div className="font-medium border-t border-gray-200 pt-1 mt-1">
																						Actual
																						Total:{" "}
																						{formatCurrency(
																							actualTotal
																						)}
																					</div>
																				)}
																			</div>
																		</div>

																		{/* X-axis label */}
																		<div className="text-xs text-gray-500 text-center font-medium mt-2 whitespace-nowrap">
																			<span className="hidden sm:inline">
																				{monthData.date.toLocaleDateString(
																					"en-US",
																					{
																						month: "short",
																						year: "2-digit",
																					}
																				)}
																			</span>
																			<span className="sm:hidden">
																				{monthData.date.toLocaleDateString(
																					"en-US",
																					{
																						month: "short",
																					}
																				)}
																			</span>
																		</div>
																	</div>
																);
															}
														)}
													</div>
												</div>
											</div>

											{/* Legend */}
											<div className="flex flex-wrap justify-center gap-4 md:gap-6 text-xs">
												<div className="flex items-center gap-2">
													<div className="w-3 h-3 bg-green-600 rounded"></div>
													<span className="text-gray-600 font-body">
														Paid
													</span>
												</div>
												<div className="flex items-center gap-2">
													<div className="w-3 h-3 bg-blue-tertiary rounded"></div>
													<span className="text-gray-600 font-body">
														Upcoming
													</span>
												</div>
												<div className="flex items-center gap-2">
													<div className="w-3 h-3 bg-amber-500 rounded"></div>
													<span className="text-gray-600 font-body">
														Due This Month
													</span>
												</div>
												<div className="flex items-center gap-2">
													<div className="w-3 h-3 bg-red-500 rounded"></div>
													<span className="text-gray-600 font-body">
														Overdue
													</span>
												</div>
											</div>

											{/* Selected Bar Details */}
											{selectedBarData && (
												<div className="bg-blue-tertiary/5 rounded-lg p-4 border border-blue-tertiary/20">
													<div className="flex justify-between items-start mb-4">
														<h4 className="text-base md:text-lg font-heading text-gray-700 font-semibold">
															{
																selectedBarData.month
															}{" "}
															Details
														</h4>
														<button
															onClick={() =>
																setSelectedBarData(
																	null
																)
															}
															className="text-gray-500 hover:text-gray-700 transition-colors"
														>
															<XMarkIcon className="h-5 w-5" />
														</button>
													</div>
													<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
														<div className="text-left">
															<div className="text-base md:text-lg font-semibold text-gray-700 mb-1 font-heading">
																{formatCurrency(
																	Number(selectedBarData.totalScheduled) || 0
																)}
															</div>
															<div className="text-xs text-gray-500 font-body">
																Scheduled
																Payment
															</div>
														</div>
														<div className="text-left">
															<div className="text-base md:text-lg font-semibold text-green-600 mb-1 font-heading">
																{formatCurrency(
																	Number(selectedBarData.totalPaid) || 0
																)}
															</div>
															<div className="text-xs text-green-600 font-body">
																Principal Paid
															</div>
														</div>
														{(Number(selectedBarData.paidLateFees) || 0) >
															0 && (
															<div className="text-left">
																<div className="text-base md:text-lg font-semibold text-green-600 mb-1 font-heading">
																	{formatCurrency(
																		Number(selectedBarData.paidLateFees) || 0
																	)}
																</div>
																<div className="text-xs text-green-600 font-body">
																	Late Fees
																	Paid
																</div>
															</div>
														)}
														{(Number(selectedBarData.unpaidLateFees) || 0) >
															0 && (
															<div className="text-left">
																<div className="text-base md:text-lg font-semibold text-red-600 mb-1 font-heading">
																	{formatCurrency(
																		Number(selectedBarData.unpaidLateFees) || 0
																	)}
																</div>
																<div className="text-xs text-red-600 font-body">
																	Late Fees
																	Owed
																</div>
															</div>
														)}
														{(Number(selectedBarData.upcoming) || 0) >
															0 && (
															<div className="text-left">
																<div className="text-base md:text-lg font-semibold text-blue-tertiary mb-1 font-heading">
																	{formatCurrency(
																		Number(selectedBarData.upcoming) || 0
																	)}
																</div>
																<div className="text-xs text-blue-tertiary font-body">
																	Upcoming
																</div>
															</div>
														)}
														{(Number(selectedBarData.overdue) || 0) >
															0 && (
															<div className="text-left">
																<div className="text-base md:text-lg font-semibold text-red-600 mb-1 font-heading">
																	{formatCurrency(
																		Number(selectedBarData.overdue) || 0
																	)}
																</div>
																<div className="text-xs text-red-600 font-body">
																	Overdue
																</div>
															</div>
														)}
													</div>
												</div>
											)}

											{/* Summary Stats */}
											<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
												<div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col justify-center items-center">
													<div className="text-base md:text-lg font-semibold text-green-600 font-heading">
														{formatCurrency(
															sortedMonths.reduce(
																(sum, month) =>
																	sum + (Number(month.totalPrincipalPaid) || 0),
																0
															)
														)}
													</div>
													<div className="text-xs text-green-600 font-body">
														Principal Paid
													</div>
												</div>
												<div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col justify-center items-center">
													<div className="text-base md:text-lg font-semibold text-blue-tertiary font-heading">
														{formatCurrency(
														(() => {
															// Use database outstandingBalance for single source of truth
															// This is already updated by backend when late fees are processed
															return loans
																.filter((loan) =>
																	["ACTIVE", "PENDING_DISCHARGE"].includes(
																		loan.status.toUpperCase()
																	)
																)
																.reduce((sum, loan) => sum + (loan.outstandingBalance || 0), 0);
														})()
														)}
													</div>
													<div className="text-xs text-blue-tertiary font-body">
														Outstanding
													</div>
												</div>
												<div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col justify-center items-center">
													<div className="text-base md:text-lg font-semibold text-amber-600 font-heading">
														{formatCurrency(
															(() => {
																const now =
																	new Date();
																const currentMonth =
																	sortedMonths.find(
																		(
																			month
																		) =>
																			month.date.getMonth() ===
																				now.getMonth() &&
																			month.date.getFullYear() ===
																				now.getFullYear()
																	);
																if (!currentMonth) return 0;
																
																// Calculate amount still due this month (accounting for partial payments AND late fees paid)
																// Total due = scheduled + late fees - principal already paid - late fees already paid
																const scheduledAmount = Number(currentMonth.totalScheduled) || 0;
																const lateFees = Number(currentMonth.lateFees) || 0;
																const principalPaid = Number(currentMonth.totalPrincipalPaid) || 0;
																const lateFeesPaid = Number(currentMonth.paidLateFees) || 0;
																const totalDueThisMonth = Math.max(0, (scheduledAmount + lateFees) - principalPaid - lateFeesPaid);
																
																return totalDueThisMonth;
															})()
														)}
													</div>
													<div className="text-xs text-amber-600 font-body">
														Due This Month
													</div>
												</div>
												<div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col justify-center items-center">
													<div className="text-base md:text-lg font-semibold text-purple-primary font-heading">
														{Math.round(
															sortedMonths.reduce(
																(sum, month) =>
																	sum +
																	(Number(month.totalScheduled) || 0),
																0
															) > 0
																? (sortedMonths.reduce(
																		(
																			sum,
																			month
																		) =>
																			sum +
																			(Number(month.totalPrincipalPaid) || 0),
																		0
																  ) /
																		sortedMonths.reduce(
																			(
																				sum,
																				month
																			) =>
																				sum +
																				(Number(month.totalScheduled) || 0),
																			0
																		)) *
																		100
																: 0
														)}
														%
													</div>
													<div className="text-xs text-purple-primary font-body">
														Overall Progress
													</div>
												</div>
											</div>
										</div>
									);
								})()}
							</div>
						</div>
					</div>

					{/* Loans and Applications Tabs */}
					<div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full overflow-hidden">
						{/* Card Header */}
						<div className="p-6 pb-0">
							<div className="flex items-center space-x-2 mb-6">
								<div className="p-2 bg-purple-primary/10 rounded-lg border border-purple-primary/20">
									<CreditCardIcon className="h-5 w-5 text-purple-primary" />
								</div>
								<h3 className="text-lg font-heading text-purple-primary font-semibold">
									Your Loans
								</h3>
							</div>
						</div>

						{/* Tab Navigation - Responsive */}
						<div className="border-b border-gray-200 overflow-x-auto">
							<nav
								className="flex space-x-6 md:space-x-8 px-4 md:px-6 min-w-max"
								aria-label="Tabs"
							>
								<button
									onClick={() => setActiveTab("loans")}
									className={`py-4 px-1 border-b-2 font-medium text-sm font-body whitespace-nowrap ${
										activeTab === "loans"
											? "border-purple-primary text-purple-primary"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
									}`}
								>
									<div className="flex items-center space-x-2">
										<CreditCardIcon className="h-4 w-4 md:h-5 md:w-5" />
										<span className="hidden sm:inline">
											Active Loans
										</span>
										<span className="sm:hidden">
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
											<span className="bg-purple-primary/10 text-purple-primary py-0.5 px-2 rounded-full text-xs font-medium border border-purple-primary/20 font-body">
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
									className={`py-4 px-1 border-b-2 font-medium text-sm font-body whitespace-nowrap ${
										activeTab === "discharged"
											? "border-purple-primary text-purple-primary"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
									}`}
								>
									<div className="flex items-center space-x-2">
										<CheckCircleIcon className="h-4 w-4 md:h-5 md:w-5" />
										<span>Discharged</span>
										{loans.filter(
											(loan) =>
												loan.status.toUpperCase() ===
												"DISCHARGED"
										).length > 0 && (
											<span className="bg-purple-primary/10 text-purple-primary py-0.5 px-2 rounded-full text-xs font-medium border border-purple-primary/20 font-body">
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
									className={`py-4 px-1 border-b-2 font-medium text-sm font-body whitespace-nowrap ${
										activeTab === "applications"
											? "border-purple-primary text-purple-primary"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
									}`}
								>
									<div className="flex items-center space-x-2">
										<DocumentTextIcon className="h-4 w-4 md:h-5 md:w-5" />
										<span>Applications</span>
										{applications.filter(
											(app) =>
												![
													"ACTIVE",
													"INCOMPLETE",
												].includes(
													app.status.toUpperCase()
												)
										).length > 0 && (
											<span className="bg-gray-200 text-gray-600 py-0.5 px-2 rounded-full text-xs font-medium border border-gray-300 font-body">
												{
													applications.filter(
														(app) =>
															![
																"ACTIVE",
																"INCOMPLETE",
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
									className={`py-4 px-1 border-b-2 font-medium text-sm font-body whitespace-nowrap ${
										activeTab === "incomplete"
											? "border-purple-primary text-purple-primary"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
									}`}
								>
									<div className="flex items-center space-x-2">
										<ClockIcon className="h-4 w-4 md:h-5 md:w-5" />
										<span>Incomplete</span>
										{applications.filter(
											(app) =>
												app.status.toUpperCase() ===
												"INCOMPLETE"
										).length > 0 && (
											<span className="bg-yellow-100 text-yellow-700 py-0.5 px-2 rounded-full text-xs font-medium border border-yellow-200 font-body">
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
							</nav>
						</div>

						{/* Tab Content */}
						<div className="p-6 min-w-0">
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
														// Only use frontend calculations for non-overdue future payments
														const daysUntilDue = calculateDaysUntilDue(loan.nextPaymentDue);
														if (daysUntilDue <= 5) {
															urgency = { color: "text-orange-600", text: "Due Soon" };
														} else if (daysUntilDue <= 10) {
															urgency = { color: "text-yellow-600", text: "Due This Month" };
														} else {
															urgency = { color: "text-green-600", text: "On Track" };
														}
													} else {
														urgency = { color: "text-green-600", text: "On Track" };
													}
													const isExpanded =
														showLoanDetails[
															loan.id
														];

													return (
														<div
															key={loan.id}
															className="border border-gray-200 rounded-xl overflow-hidden hover:border-purple-primary transition-colors bg-white shadow-sm w-full min-w-0"
														>
															{/* Loan Header */}
															<div className="p-6 bg-gray-50/50">
																<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
																	<div className="flex items-center space-x-3">
																		<div className="p-2 bg-purple-primary/10 rounded-lg border border-purple-primary/20">
																			<CreditCardIcon className="h-5 w-5 md:h-6 md:w-6 text-purple-primary" />
																		</div>
																		<div>
																			<h4 className="text-base md:text-lg font-semibold text-gray-700 font-heading">
																				{
																					loan
																						.application
																						.product
																						.name
																				}
																			</h4>
																			<p className="text-sm text-gray-500 font-body">
																				Loan
																				ID:{" "}
																				{loan.id
																					.slice(
																						-8
																					)
																					.toUpperCase()}
																			</p>
																		</div>
																	</div>
																	<div className="text-left sm:text-right">
																		{getStatusBadge(
																			loan.status
																		)}
																	</div>
																</div>

																{/* Overdue Payment Alert - Only show if backend has processed late fees */}
																{loan
																	.overdueInfo
																	?.hasOverduePayments && (
																	<div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
																		<div className="flex items-center">
																			<ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-3 flex-shrink-0" />
																			<div className="flex-1">
																				<h4 className="text-sm font-semibold text-red-700 mb-1 font-heading">
																					Overdue
																					Payment
																				</h4>
																				<p className="text-sm text-red-600 font-body">
																					Total
																					amount
																					due:{" "}
																					{formatCurrency(
																						loan
																							.overdueInfo
																							.totalOverdueAmount +
																							loan
																								.overdueInfo
																								.totalLateFees
																					)}
																					{loan
																						.overdueInfo
																						.totalLateFees >
																						0 && (
																						<span className="text-xs text-red-500 block mt-1">
																							Includes{" "}
																							{formatCurrency(
																								loan
																									.overdueInfo
																									.totalLateFees
																							)}{" "}
																							in
																							late
																							fees
																						</span>
																					)}
																				</p>
																				{/* Use backend-calculated days overdue from overdueRepayments */}
																				{loan.overdueInfo.overdueRepayments && 
																				 loan.overdueInfo.overdueRepayments.length > 0 && (
																							<span className="text-xs text-red-600 block mt-1 font-medium">
																						⏰ {Math.max(...loan.overdueInfo.overdueRepayments.map(rep => rep.daysOverdue))} day{Math.max(...loan.overdueInfo.overdueRepayments.map(rep => rep.daysOverdue)) !== 1 ? "s" : ""} overdue
																							</span>
																				)}
																			</div>
																		</div>
																	</div>
																)}

																{/* Loan Summary Stats */}
																{(() => {
																	// Calculate total late fees paid and total principal paid for display
																	let totalLateFeesPaid = 0;
																	let totalPrincipalPaid = 0;
																	if (loan.repayments) {
																		loan.repayments.forEach(repayment => {
																			totalLateFeesPaid += repayment.lateFeesPaid || 0;
																			// Handle null/undefined principalPaid by falling back to appropriate amounts
																			const principalPaid = repayment.principalPaid ?? 
																				(repayment.status === "COMPLETED" ? repayment.amount : 
																				 repayment.status === "PARTIAL" ? (repayment.actualAmount || 0) : 0);
																			totalPrincipalPaid += principalPaid;
																		});
																	}
																	
																	return (
																		<div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 ${totalLateFeesPaid > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 md:gap-4 mb-4`}>
																	<div>
																		<p className="text-sm text-gray-500 mb-1 font-body">
																			Outstanding
																			Balance
																		</p>
																		<p className="text-base md:text-lg font-semibold text-purple-primary font-heading">
																{formatCurrency(loan.outstandingBalance || 0)}
															</p>
																			</div>
																			
																			<div>
																				<p className="text-sm text-gray-500 mb-1 font-body">
																					Principal Paid
																				</p>
																				<p className="text-base md:text-lg font-semibold text-green-600 font-heading">
																					{formatCurrency(totalPrincipalPaid)}
																		</p>
																	</div>
																	<div>
																		{(() => {
																			const nextPayment =
																				loan.nextPaymentInfo || {
																					amount: loan.monthlyPayment,
																					isOverdue:
																						false,
																					includesLateFees:
																						false,
																					description:
																						"Monthly Payment",
																				};
																			return (
																				<>
																					<p className="text-sm text-gray-500 mb-1 font-body">
																						{
																							nextPayment.description
																						}
																					</p>
																					<p
																						className={`text-base md:text-lg font-semibold font-heading ${
																							nextPayment.isOverdue
																								? "text-red-600"
																								: "text-purple-primary"
																						}`}
																					>
																						{nextPayment.amount >
																						0
																							? formatCurrency(
																									nextPayment.amount
																							  )
																							: "Fully Paid"}
																					</p>
																					{nextPayment.includesLateFees && (
																						<p className="text-xs text-red-600 font-body">
																							Includes
																							late
																							fees
																						</p>
																					)}
																				</>
																			);
																		})()}
																	</div>

																	<div>
																		{(() => {
																			const performance =
																				calculatePaymentPerformance(
																					loan
																				);
																			return (
																				<>
																					<p className="text-sm text-gray-500 mb-1 font-body">
																						Payment
																						Performance
																					</p>
																					{performance.percentage !==
																					null ? (
																						<>
																							<p
																								className={`text-base md:text-lg font-semibold font-heading ${getPerformanceColor(
																									performance.percentage
																								)}`}
																							>
																								{
																									performance.percentage
																								}

																								%
																							</p>
																							<p className="text-xs text-gray-500 font-body">
																								{
																									performance.onTimeCount
																								}{" "}
																								of{" "}
																								{
																									performance.totalCount
																								}{" "}
																								on-time
																							</p>
																						</>
																					) : (
																						<>
																							<p className="text-base md:text-lg font-semibold text-gray-500 font-heading">
																								N/A
																							</p>
																							<p className="text-xs text-gray-500 font-body">
																								No
																								payments
																								yet
																							</p>
																						</>
																					)}
																				</>
																			);
																		})()}
																	</div>
																	<div>
																		<p className="text-sm text-gray-500 mb-1 font-body">
																			Next
																			Payment
																			Due
																		</p>
																		{loan.nextPaymentDue ? (
																			<>
																				<p
																					className={`text-base md:text-lg font-semibold font-heading ${urgency.color}`}
																				>
																					{formatDate(
																						loan.nextPaymentDue
																					)}
																				</p>
																				<p
																					className={`text-xs font-body ${urgency.color}`}
																				>
																					{
																						urgency.text
																					}
																				</p>
																			</>
																		) : (
																			<p className="text-base md:text-lg font-semibold text-gray-500 font-heading">
																				N/A
																			</p>
																		)}
																	</div>
																	
																	{/* Conditionally show Late Fees Paid if there are any */}
																	{totalLateFeesPaid > 0 && (
																		<div>
																			<p className="text-sm text-gray-500 mb-1 font-body">
																				Late Fees Paid
																			</p>
																			<p className="text-base md:text-lg font-semibold text-green-600 font-heading">
																				{formatCurrency(totalLateFeesPaid)}
																			</p>
																			<p className="text-xs text-green-600 font-body">
																				Total paid
																			</p>
																</div>
																	)}
																		</div>
																	);
																})()}

																{/* Progress Bar */}
																<div className="mb-4">
																	{(() => {
																		// Calculate progress based on the backend-calculated outstanding balance
																		// The outstandingBalance already includes late fees and is updated by backend
																		const totalOriginalAmount =
																			loan.totalAmount ||
																			loan.principalAmount ||
																			0;
																		const currentOutstanding =
																			loan.outstandingBalance ||
																			0;

																		// Calculate total amount that has been owed (original + any late fees that were added)
																		// If currentOutstanding > totalOriginalAmount, it means late fees were added
																		const totalAmountOwed =
																			Math.max(
																				totalOriginalAmount,
																				currentOutstanding
																			);

																		// For progress calculation, we should compare against the original loan amount
																		// Late fees are additional charges, not part of loan progress
																		const originalLoanAmount = totalOriginalAmount;

																		// Calculate principal amount actually paid (excluding late fees)
																		// This gives accurate progress towards loan principal
																		let totalPrincipalPaid = 0;
																		let totalLateFeesPaidAmount = 0;
																		
																		if (loan.repayments) {
																			loan.repayments.forEach(repayment => {
																				// Use principalPaid field which excludes late fees
																				// Handle null/undefined principalPaid by falling back to amount for completed payments
																				const principalPaid = repayment.principalPaid ?? 
																					(repayment.status === "COMPLETED" ? repayment.amount : 
																					 repayment.status === "PARTIAL" ? (repayment.actualAmount || 0) : 0);
																				totalPrincipalPaid += principalPaid;
																				
																				// Track late fees paid separately
																				totalLateFeesPaidAmount += repayment.lateFeesPaid || 0;
																			});
																		}
																		
																		const paidAmount = totalPrincipalPaid;

																		const progressPercent =
																			originalLoanAmount >
																			0
																				? Math.min(
																						100,
																						Math.max(
																							0,
																							Math.round(
																								(paidAmount /
																									originalLoanAmount) *
																									100
																							)
																						)
																				  )
																				: 0;

																		return (
																			<>
																				<div className="flex justify-between text-sm text-gray-500 mb-2 font-body">
																					<span>
																						Repayment
																						Progress
																					</span>
																					<span>
																						{
																							progressPercent
																						}

																						%
																					</span>
																				</div>
																				<div className="w-full bg-gray-200 rounded-full h-3">
																					<div
																						className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-300"
																						style={{
																							width: `${progressPercent}%`,
																						}}
																					></div>
																				</div>
																				<div className="flex justify-between text-xs text-gray-500 mt-1 font-body">
																					<span>
																						Principal Paid:{" "}
																						{formatCurrency(
																							paidAmount
																						)}
																					</span>
																					<span>
																						Outstanding:{" "}
														{formatCurrency(loan.outstandingBalance || 0)}
																					</span>
																				</div>
																			</>
																		);
																	})()}
																</div>

																{/* Action Buttons */}
																<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
																	<button
																		onClick={() =>
																			toggleLoanDetails(
																				loan.id
																			)
																		}
																		className="flex items-center justify-center sm:justify-start text-sm text-purple-primary hover:text-purple-600 font-medium font-body transition-colors"
																	>
																		<span className="hidden sm:inline">
																			{isExpanded
																				? "Hide Details"
																				: "View Details"}
																		</span>
																		<span className="sm:hidden">
																			{isExpanded
																				? "Hide"
																				: "Details"}
																		</span>
																		{isExpanded ? (
																			<ChevronUpIcon className="ml-1 h-4 w-4" />
																		) : (
																			<ChevronDownIcon className="ml-1 h-4 w-4" />
																		)}
																	</button>
																	{loan.status.toUpperCase() !==
																		"PENDING_DISCHARGE" && (
																		<button
																			onClick={async () => {
																				setSelectedLoan(
																					loan
																				);
																				loadWalletBalance();
																				// Load late fee info if loan has overdue payments
																				if (
																					loan
																						.overdueInfo
																						?.hasOverduePayments
																				) {
																					await loadLateFeeInfo(
																						loan.id
																					);
																				}
																				setShowLoanRepayModal(
																					true
																				);
																			}}
																			className="bg-purple-primary hover:bg-purple-600 text-white inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors w-full sm:w-auto shadow-sm"
																		>
																			<span className="hidden sm:inline">
																				Make
																				Payment
																			</span>
																			<span className="sm:hidden">
																				Pay
																			</span>
																			<ArrowRightIcon className="ml-2 h-4 w-4" />
																		</button>
																	)}
																</div>
															</div>

															{/* Expanded Loan Details */}
															{isExpanded && (
																<div className="p-6 border-t border-gray-200 bg-gray-50/30">
																	<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
																		{/* Loan Information */}
																		<div>
																			<h5 className="text-base md:text-lg font-semibold text-gray-700 mb-4 font-heading">
																				Loan
																				Information
																			</h5>
																			<div className="space-y-3 text-sm">
																				<div className="flex justify-between">
																					<span className="text-gray-500 font-body">
																						Principal
																						Amount
																					</span>
																					<span className="font-medium text-gray-700 font-body">
																						{formatCurrency(
																							loan.principalAmount
																						)}
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-500 font-body">
																						Monthly
																						Payment
																					</span>
																					<span className="font-medium text-gray-700 font-body">
																						{formatCurrency(
																							loan.monthlyPayment
																						)}
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-500 font-body">
																						Interest
																						Rate
																					</span>
																					<span className="font-medium text-gray-700 font-body">
																						{
																							loan.interestRate
																						}

																						%
																						per
																						month
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-500 font-body">
																						Loan
																						Term
																					</span>
																					<span className="font-medium text-gray-700 font-body">
																						{
																							loan.term
																						}{" "}
																						months
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-500 font-body">
																						Disbursed
																						Date
																					</span>
																					<span className="font-medium text-gray-700 font-body">
																						{formatDate(
																							loan.disbursedAt
																						)}
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-500 font-body">
																						Application
																						Date
																					</span>
																					<span className="font-medium text-gray-700 font-body">
																						{formatDate(
																							loan
																								.application
																								.createdAt
																						)}
																					</span>
																				</div>
																			</div>
																		</div>

																		{/* Recent Payments */}
																		<div>
																			<h5 className="text-base md:text-md font-semibold text-gray-700 mb-4 font-heading">
																				Recent
																				Payments
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
																									<div>
																										<p className="text-sm font-medium text-gray-700">
																											{formatCurrency(
																												transaction.amount
																											)}
																										</p>
																										<p className="text-xs text-gray-500">
																											{formatDate(
																												transaction.createdAt
																											)}
																										</p>
																										<p className="text-xs text-gray-500">
																											{
																												transaction.description
																											}
																										</p>
																									</div>
																									{getStatusBadge(
																										transaction.status
																									)}
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
													className="bg-purple-primary hover:bg-purple-600 text-white inline-flex items-center px-6 py-3 text-base font-medium rounded-md transition-colors shadow-sm"
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
															className="border border-gray-200 rounded-xl overflow-hidden hover:border-purple-primary transition-colors bg-white shadow-sm"
														>
															{/* Loan Header */}
															<div className="p-6 bg-gray-50/50">
																<div className="flex items-center justify-between mb-4">
																	<div className="flex items-center space-x-3">
																		<div className="p-2 bg-purple-primary/10 rounded-lg border border-purple-primary/20">
																			<CheckCircleIcon className="h-6 w-6 text-purple-primary" />
																		</div>
																		<div>
																			<h4 className="text-lg font-semibold text-gray-700">
																				{
																					loan
																						.application
																						.product
																						.name
																				}
																			</h4>
																			<p className="text-sm text-gray-500">
																				Loan
																				ID:{" "}
																				{loan.id
																					.slice(
																						-8
																					)
																					.toUpperCase()}
																			</p>
																		</div>
																	</div>
																	<div className="text-right">
																		{getStatusBadge(
																			loan.status
																		)}
																	</div>
																</div>

																{/* Loan Summary Stats */}
																<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
																	<div>
																		<p className="text-sm text-gray-500 mb-1">
																			Total
																			Repaid
																		</p>
																		<p className="text-lg font-semibold text-green-600">
																			{formatCurrency(
																				loan.totalAmount
																			)}
																		</p>
																	</div>
																	<div>
																		{(() => {
																			const performance =
																				calculatePaymentPerformance(
																					loan
																				);
																			return (
																				<>
																					<p className="text-sm text-gray-500 mb-1">
																						Payment
																						Performance
																					</p>
																					{performance.percentage !==
																					null ? (
																						<>
																							<p
																								className={`text-lg font-semibold ${getPerformanceColor(
																									performance.percentage
																								)}`}
																							>
																								{
																									performance.percentage
																								}

																								%
																							</p>
																							<p className="text-xs text-gray-500">
																								{
																									performance.onTimeCount
																								}{" "}
																								of{" "}
																								{
																									performance.totalCount
																								}{" "}
																								on-time
																							</p>
																						</>
																					) : (
																						<>
																							<p className="text-lg font-semibold text-gray-500">
																								N/A
																							</p>
																							<p className="text-xs text-gray-500">
																								No
																								payments
																								yet
																							</p>
																						</>
																					)}
																				</>
																			);
																		})()}
																	</div>
																	<div>
																		<p className="text-sm text-gray-500 mb-1">
																			Discharged
																			Date
																		</p>
																		<p className="text-lg font-semibold text-purple-primary">
																			{formatDate(
																				loan.disbursedAt
																			)}
																		</p>
																	</div>
																</div>

																{/* Completion Badge */}
																<div className="mb-4">
																	<div className="flex items-center p-4 bg-purple-primary/10 rounded-xl border border-purple-primary/20">
																		<CheckCircleIcon className="h-8 w-8 text-purple-primary mr-3" />
																		<div>
																			<p className="text-lg font-semibold text-purple-primary">
																				Loan
																				Fully
																				Repaid
																			</p>
																			<p className="text-sm text-gray-600">
																				Congratulations
																				on
																				completing
																				your
																				loan!
																			</p>
																		</div>
																	</div>
																</div>

																{/* Action Buttons */}
																<div className="flex items-center justify-between">
																	<button
																		onClick={() =>
																			toggleLoanDetails(
																				loan.id
																			)
																		}
																		className="flex items-center text-sm text-purple-primary hover:text-purple-600 font-medium"
																	>
																		{isExpanded
																			? "Hide Details"
																			: "View Details"}
																		{isExpanded ? (
																			<ChevronUpIcon className="ml-1 h-4 w-4" />
																		) : (
																			<ChevronDownIcon className="ml-1 h-4 w-4" />
																		)}
																	</button>
																</div>
															</div>

															{/* Expanded Loan Details */}
															{isExpanded && (
																<div className="p-6 border-t border-gray-200 bg-gray-50/30">
																	<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
																		{/* Loan Information */}
																		<div>
																			<h5 className="text-md font-semibold text-gray-700 mb-4">
																				Loan
																				Information
																			</h5>
																			<div className="space-y-3 text-sm">
																				<div className="flex justify-between">
																					<span className="text-gray-500">
																						Principal
																						Amount
																					</span>
																					<span className="font-medium text-gray-700">
																						{formatCurrency(
																							loan.principalAmount
																						)}
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-500">
																						Interest
																						Rate
																					</span>
																					<span className="font-medium text-gray-700">
																						{
																							loan.interestRate
																						}

																						%
																						per
																						month
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-500">
																						Loan
																						Term
																					</span>
																					<span className="font-medium text-gray-700">
																						{
																							loan.term
																						}{" "}
																						months
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-500">
																						Disbursed
																						Date
																					</span>
																					<span className="font-medium text-gray-700">
																						{formatDate(
																							loan.disbursedAt
																						)}
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-gray-500">
																						Application
																						Date
																					</span>
																					<span className="font-medium text-gray-700">
																						{formatDate(
																							loan
																								.application
																								.createdAt
																						)}
																					</span>
																				</div>
																			</div>
																		</div>

																		{/* Payment History */}
																		<div>
																			<h5 className="text-md font-semibold text-gray-700 mb-4">
																				Payment
																				History
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
																									<div>
																										<p className="text-sm font-medium text-gray-700">
																											{formatCurrency(
																												transaction.amount
																											)}
																										</p>
																										<p className="text-xs text-gray-500">
																											{formatDate(
																												transaction.createdAt
																											)}
																										</p>
																										<p className="text-xs text-gray-500">
																											{
																												transaction.description
																											}
																										</p>
																									</div>
																									{getStatusBadge(
																										transaction.status
																									)}
																								</div>
																							)
																						)}
																					{loanTransactions[
																						loan
																							.id
																					]
																						.length >
																						3 && (
																						<p className="text-xs text-gray-400 text-center mt-2">
																							Showing
																							latest
																							3
																							payments
																						</p>
																					)}
																				</div>
																			) : (
																				<div className="text-center py-4">
																					<p className="text-sm text-gray-400">
																						No
																						payment
																						history
																						available
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
									// Applications Content (excluding ACTIVE and INCOMPLETE)
									const filteredApplications =
										applications.filter(
											(app) =>
												![
													"ACTIVE",
													"INCOMPLETE",
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
																className="border border-gray-200 rounded-xl overflow-hidden hover:border-purple-primary transition-colors bg-white shadow-sm"
															>
																{/* Application Header */}
																<div className="p-6 bg-gray-50/50">
																	<div className="flex items-center justify-between mb-4">
																		<div className="flex items-center space-x-3">
																			<div className="p-2 bg-purple-primary/10 rounded-lg border border-purple-primary/20">
																				<DocumentTextIcon className="h-6 w-6 text-purple-primary" />
																			</div>
																			<div>
																				<h4 className="text-lg font-semibold text-gray-700 font-heading">
																					{app
																						.product
																						?.name ||
																						"Unknown Product"}
																				</h4>
																				<p className="text-sm text-gray-500 font-body">
																					Application
																					ID:{" "}
																					{app.id
																						.slice(
																							-8
																						)
																						.toUpperCase()}
																				</p>
																			</div>
																		</div>
																		<span
																			className={`px-3 py-1 rounded-full text-xs font-medium ${getApplicationStatusColor(
																				app.status,
																				app.attestationType
																			)}`}
																		>
																			{getApplicationStatusLabel(
																				app.status,
																				app.attestationType
																			)}
																		</span>
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

																	<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
																		<div>
																			<p className="text-sm text-gray-500 mb-1 font-body">
																				Amount
																			</p>
																			<p className="text-lg font-semibold text-gray-700 font-heading">
																				{app.amount
																					? formatCurrency(
																							app.amount
																					  )
																					: "-"}
																			</p>
																		</div>
																		<div>
																			<p className="text-sm text-gray-500 mb-1 font-body">
																				Term
																			</p>
																			<p className="text-lg font-semibold text-gray-700 font-heading">
																				{app.term
																					? `${app.term} months`
																					: "-"}
																			</p>
																		</div>
																		<div>
																			<p className="text-sm text-gray-500 mb-1 font-body">
																				Purpose
																			</p>
																			<p className="text-lg font-semibold text-gray-700 font-heading">
																				{app.purpose ||
																					"-"}
																			</p>
																		</div>
																		<div>
																			<p className="text-sm text-gray-500 mb-1 font-body">
																				Applied
																				On
																			</p>
																			<p className="text-lg font-semibold text-gray-700 font-heading">
																				{formatDate(
																					app.updatedAt
																				)}
																			</p>
																		</div>
																	</div>

																	{/* Action Buttons */}
																	<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
																		<button
																			onClick={() =>
																				toggleApplicationDetails(
																					app.id
																				)
																			}
																			className="flex items-center justify-center sm:justify-start text-sm text-purple-primary hover:text-purple-600 font-medium font-body transition-colors"
																		>
																			<span className="hidden sm:inline">
																				{isExpanded
																					? "Hide Details"
																					: "View Details"}
																			</span>
																			<span className="sm:hidden">
																				{isExpanded
																					? "Hide"
																					: "Details"}
																			</span>
																			{isExpanded ? (
																				<ChevronUpIcon className="ml-1 h-4 w-4" />
																			) : (
																				<ChevronDownIcon className="ml-1 h-4 w-4" />
																			)}
																		</button>
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
																									handleAttestationMethodSelect(
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
																			{[
																				"PENDING_APP_FEE",
																				"PENDING_KYC",
																				"PENDING_APPROVAL",
																			].includes(
																				app.status
																			) && (
																				<button
																					onClick={() => {
																						setSelectedApplication(
																							app
																						);
																						setShowWithdrawModal(
																							true
																						);
																					}}
																					className="inline-flex items-center px-4 py-2 border border-red-200 text-sm font-medium rounded-md text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
																				>
																					Withdraw
																				</button>
																			)}
																		</div>
																	</div>
																</div>

																{/* Expanded Application Details */}
																{isExpanded && (
																	<div className="p-6 border-t border-gray-200 bg-gray-50/30">
																		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
																			{/* Application Information */}
																			<div>
																				<h5 className="text-base md:text-lg font-semibold text-gray-700 mb-4 font-heading">
																					Application
																					Information
																				</h5>
																				<div className="space-y-3 text-sm">
																					<div className="flex justify-between">
																						<span className="text-gray-500 font-body">
																							Product
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{app
																								.product
																								?.name ||
																								"Unknown"}
																						</span>
																					</div>
																					<div className="flex justify-between">
																						<span className="text-gray-500 font-body">
																							Loan
																							Amount
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{app.amount
																								? formatCurrency(
																										app.amount
																								  )
																								: "-"}
																						</span>
																					</div>
																					<div className="flex justify-between">
																						<span className="text-gray-500 font-body">
																							Loan
																							Term
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{app.term
																								? `${app.term} months`
																								: "-"}
																						</span>
																					</div>
																					<div className="flex justify-between">
																						<span className="text-gray-500 font-body">
																							Loan
																							Purpose
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{app.purpose ||
																								"-"}
																						</span>
																					</div>
																					<div className="flex justify-between">
																						<span className="text-gray-500 font-body">
																							Created
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{formatDate(
																								app.createdAt
																							)}
																						</span>
																					</div>
																					<div className="flex justify-between">
																						<span className="text-gray-500 font-body">
																							Last
																							Updated
																						</span>
																						<span className="font-medium text-gray-700 font-body">
																							{formatDate(
																								app.updatedAt
																							)}
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
																													handleAttestationMethodSelect(
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
																				<h5 className="text-base md:text-lg font-semibold text-gray-700 mb-4 font-heading">
																					Application
																					History
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
																									className="flex items-start space-x-3 p-3 bg-white rounded-lg border border-gray-200"
																								>
																									<div className="w-8 h-8 bg-blue-tertiary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
																										<ClockIcon className="h-4 w-4 text-blue-tertiary" />
																									</div>
																									<div className="flex-1 min-w-0">
																										<p className="text-sm font-medium text-gray-700 font-body">
																											{getHistoryActionDescription(
																												historyItem.previousStatus,
																												historyItem.newStatus
																											)}
																										</p>
																										<div className="flex items-center justify-between text-xs text-gray-500 mt-1 font-body">
																											<span>
																												{
																													historyItem.changedBy
																												}
																											</span>
																											<span>
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
															className="border border-yellow-200 rounded-xl p-6 hover:border-yellow-400 transition-colors bg-yellow-50"
														>
															<div className="flex items-center justify-between mb-4">
																<div className="flex items-center space-x-3">
																	<div className="p-2 bg-yellow-100 rounded-lg border border-yellow-200">
																		<ClockIcon className="h-6 w-6 text-yellow-600" />
																	</div>
																	<div>
																		<h4 className="text-lg font-semibold text-gray-700">
																			{app
																				.product
																				?.name ||
																				"Unknown Product"}
																		</h4>
																		<p className="text-sm text-gray-500">
																			Application
																			ID:{" "}
																			{app.id
																				.slice(
																					-8
																				)
																				.toUpperCase()}
																		</p>
																	</div>
																</div>
																<span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
																	Incomplete
																</span>
															</div>

															<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
																<div>
																	<p className="text-sm text-gray-500 mb-1">
																		Amount
																	</p>
																	<p className="text-lg font-semibold text-gray-700">
																		{app.amount
																			? formatCurrency(
																					app.amount
																			  )
																			: "-"}
																	</p>
																</div>
																<div>
																	<p className="text-sm text-gray-500 mb-1">
																		Term
																	</p>
																	<p className="text-lg font-semibold text-gray-700">
																		{app.term
																			? `${app.term} months`
																			: "-"}
																	</p>
																</div>
																<div>
																	<p className="text-sm text-gray-500 mb-1">
																		Purpose
																	</p>
																	<p className="text-lg font-semibold text-gray-700">
																		{app.purpose ||
																			"-"}
																	</p>
																</div>
																<div>
																	<p className="text-sm text-gray-500 mb-1">
																		Started
																		On
																	</p>
																	<p className="text-lg font-semibold text-gray-700">
																		{formatDate(
																			app.createdAt
																		)}
																	</p>
																</div>
															</div>

															<div className="bg-yellow-100 border border-yellow-200 rounded-xl p-4 mb-4">
																<div className="flex items-center">
																	<ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-2" />
																	<div>
																		<p className="text-sm font-medium text-yellow-700">
																			Application
																			Incomplete
																		</p>
																		<p className="text-sm text-yellow-600">
																			Complete
																			your
																			application
																			to
																			proceed
																			with
																			the
																			loan
																			process.
																		</p>
																	</div>
																</div>
															</div>

															<div className="flex items-center justify-between">
																<div className="text-sm text-gray-500">
																	<span className="text-yellow-700 font-medium">
																		Complete
																		your
																		application
																		to
																		proceed
																	</span>
																</div>
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
													className="bg-purple-primary hover:bg-purple-600 text-white inline-flex items-center px-6 py-3 text-base font-medium rounded-md transition-colors shadow-sm"
												>
													<PlusIcon className="h-5 w-5 mr-2" />
													Start New Application
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
										{loans.map((loan) => (
											<button
												key={loan.id}
												onClick={() =>
													handleLoanSelection(loan)
												}
												className="w-full p-4 border border-gray-200 rounded-xl hover:border-purple-primary/50 hover:bg-purple-primary/5 transition-colors text-left bg-white shadow-sm"
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
																{formatDate(
																	loan.nextPaymentDue
																)}
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
									{loans.length === 0 && (
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
													{formatDate(
														selectedLoan.nextPaymentDue
													)}
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
											<label className="flex items-start p-4 border border-gray-200 rounded-xl hover:bg-purple-primary/5 cursor-pointer bg-white shadow-sm transition-colors">
												<input
													type="radio"
													name="paymentMethod"
													value="WALLET_BALANCE"
													checked={
														paymentMethod ===
														"WALLET_BALANCE"
													}
													onChange={(e) => {
														const newMethod = e
															.target.value as
															| "WALLET_BALANCE"
															| "FRESH_FUNDS";
														setPaymentMethod(
															newMethod
														);
														if (
															selectedLoan &&
															repaymentAmount
														) {
															validateRepaymentAmount(
																repaymentAmount,
																selectedLoan
															);
														}
													}}
													className="h-4 w-4 text-purple-primary focus:ring-purple-primary border-gray-300 bg-white mt-1"
												/>
												<div className="ml-3 flex-1">
													<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
														<div>
															<p className="font-semibold text-gray-700 font-heading">
																Wallet Balance
															</p>
															<p className="text-sm text-gray-500 font-body">
																<span className="hidden sm:inline">
																	Pay from
																	your current
																	wallet
																	balance
																</span>
																<span className="sm:hidden">
																	Use wallet
																	balance
																</span>
															</p>
														</div>
														<div className="text-left sm:text-right">
															<p className="font-semibold text-gray-700 font-heading">
																{formatCurrency(
																	walletBalance
																)}
															</p>
															<p className="text-xs text-gray-500 font-body">
																Available
															</p>
														</div>
													</div>
												</div>
											</label>

											<label className="flex items-start p-4 border border-gray-200 rounded-xl hover:bg-purple-primary/5 cursor-pointer bg-white shadow-sm transition-colors">
												<input
													type="radio"
													name="paymentMethod"
													value="FRESH_FUNDS"
													checked={
														paymentMethod ===
														"FRESH_FUNDS"
													}
													onChange={(e) => {
														const newMethod = e
															.target.value as
															| "WALLET_BALANCE"
															| "FRESH_FUNDS";
														setPaymentMethod(
															newMethod
														);
														if (
															selectedLoan &&
															repaymentAmount
														) {
															validateRepaymentAmount(
																repaymentAmount,
																selectedLoan
															);
														}
													}}
													className="h-4 w-4 text-purple-primary focus:ring-purple-primary border-gray-300 bg-white mt-1"
												/>
												<div className="ml-3 flex-1">
													<div>
														<p className="font-semibold text-gray-700 font-heading">
															Fresh Funds Transfer
														</p>
														<p className="text-sm text-gray-500 font-body">
															<span className="hidden sm:inline">
																Transfer
																directly from
																your bank
																account
															</span>
															<span className="sm:hidden">
																Bank transfer
															</span>
														</p>
													</div>
												</div>
											</label>
										</div>
									</div>

									{/* Repayment Amount */}
									<div className="mb-6">
										<div className="flex items-center justify-between mb-2">
											<label className="block text-sm font-medium text-gray-500 font-body">
												Repayment Amount (MYR)
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
											className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-primary focus:border-purple-primary text-gray-700 placeholder-gray-400 bg-white font-body ${
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

											if (
												selectedLoan.overdueInfo
													?.hasOverduePayments &&
												lateFeeInfo[selectedLoan.id]
											) {
												return (
													<div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
														<div className="flex items-center mb-2">
															<ExclamationTriangleIcon className="h-4 w-4 text-amber-600 mr-2" />
															<span className="text-sm font-semibold text-amber-800 font-heading">
																Recommended
																Payment
															</span>
														</div>
														<div className="flex justify-between text-sm font-body">
															<span className="text-amber-700">
																Total Amount Due
																(incl. late
																fees):
															</span>
															<span className="font-semibold text-amber-800">
																{formatCurrency(
																	lateFeeInfo[
																		selectedLoan
																			.id
																	].summary
																		.totalAmountDue
																)}
															</span>
														</div>
														<p className="text-xs text-amber-700 mt-2 font-body">
															Pay this amount to
															clear all overdue
															payments and avoid
															additional late
															fees.
														</p>
													</div>
												);
											} else {
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
											}
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
													selectedLoan.outstandingBalance ||
												(paymentMethod ===
													"WALLET_BALANCE" &&
													parseFloat(
														repaymentAmount
													) > walletBalance)
											}
											className="bg-purple-primary text-white flex-1 py-3 px-4 rounded-xl font-semibold font-heading hover:bg-purple-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md disabled:shadow-none"
										>
											{paymentMethod === "WALLET_BALANCE"
												? "Pay Now"
												: "Continue"}
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Payment Method Selection Modal */}
			{showPaymentMethodModal && (
				<PaymentMethodModal
					onClose={() => setShowPaymentMethodModal(false)}
					onFPXSelect={handleFPXSelect}
					onBankTransferSelect={handleBankTransferSelect}
					amount={repaymentAmount}
					title="How would you like to pay?"
				/>
			)}

			{/* Bank Transfer Details Modal */}
			{showBankTransferModal && selectedLoan && (
				<BankTransferModal
					onClose={() => setShowBankTransferModal(false)}
					onConfirm={handleBankTransferConfirm}
					amount={repaymentAmount}
					reference={`LOAN-${selectedLoan.id
						.slice(-8)
						.toUpperCase()}`}
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
