"use client";

import React from "react";
import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import {
	UserGroupIcon,
	ClockIcon,
	CurrencyDollarIcon,
	DocumentTextIcon,
	BanknotesIcon,
	CreditCardIcon,
	ChevronRightIcon,
	ArrowTrendingUpIcon,
	ArrowTrendingDownIcon,
	ExclamationTriangleIcon,
	CheckCircleIcon,
	XCircleIcon,
	EyeIcon,
	PlusIcon,
	BellIcon,
	Cog6ToothIcon,
	ChartBarIcon,
	CalendarDaysIcon,
	ArrowTrendingUpIcon as TrendingUpIcon,
	ReceiptPercentIcon,
	VideoCameraIcon,
	InformationCircleIcon,
	ClipboardDocumentCheckIcon,
	UserCircleIcon,
	ArrowPathIcon,
	SignalIcon,
	ServerIcon,
	DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh, checkAdminAuth } from "../../lib/authUtils";
import Link from "next/link";
import { toast } from "sonner";
import {
	LineChart,
	Line,
	AreaChart,
	Area,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
} from "recharts";

interface DashboardStats {
	totalUsers: number;
	pendingReviewApplications: number;
	approvedLoans: number;
	pendingDisbursementCount?: number;
	disbursedLoans: number;
	potentialDefaultLoansCount?: number;
	defaultedLoansCount?: number;
	pendingStampedAgreements?: number;
	completedStampedAgreements?: number;
	disbursementsWithoutSlips?: number;
	totalDisbursedAmount: number;
	totalLoanValue?: number;
	currentLoanValue?: number;
	totalFeesCollected?: number;
	totalLateFeesCollected?: number;
	totalRepayments?: number;
	recentApplications: {
		id: string;
		userId: string;
		status: string;
		createdAt: string;
		user: {
			fullName: string;
			email: string;
		};
	}[];
	// Enhanced stats
	totalApplications?: number;
	rejectedApplications?: number;
	averageLoanAmount?: number;
	monthlyGrowth?: number;
	activeUsers?: number;
	conversionRate?: number;
	totalRevenue?: number;
	monthlyStats?: {
		month: string;
		applications: number;
		approvals: number;
		disbursements: number;
		revenue: number;
		fees_earned: number;
		accrued_interest: number;
		disbursement_amount: number;
		disbursement_count: number;
		users: number;
		kyc_users: number;
		actual_repayments: number;
		scheduled_repayments: number;
		total_loan_value: number;
		current_loan_value: number;
		repayment_count: number;
		scheduled_count: number;
	}[];
	dailyStats?: {
		date: string;
		applications: number;
		approvals: number;
		disbursements: number;
		revenue: number;
		fees_earned: number;
		accrued_interest: number;
		disbursement_amount: number;
		disbursement_count: number;
		users: number;
		kyc_users: number;
		actual_repayments: number;
		scheduled_repayments: number;
		total_loan_value: number;
		current_loan_value: number;
		repayment_count: number;
		scheduled_count: number;
	}[];

	// 🔹 NEW INDUSTRY-STANDARD LOAN PORTFOLIO KPIs
	portfolioOverview?: {
		activeLoanBook: number;
		numberOfActiveLoans: number;
		totalRepaidAmount: number;
		averageLoanSize: number;
		averageLoanTerm: number;
		totalValueWithInterest: number;
		accruedInterest: number;
	};

	repaymentPerformance?: {
		repaymentRate: number;
		delinquencyRate30Days: number; // Now: Overdue + Default rate (uses system settings, not hardcoded 30 days)
		delinquencyRate60Days: number; // Now: Default risk rate (flagged for default)
		delinquencyRate90Days: number; // Now: Active default rate (loans in DEFAULT status / outstanding)
		defaultRate: number; // Historical default rate (defaulted / total ever issued)
		collectionsLast30Days: number;
		upcomingPaymentsDue7Days: {
			amount: number;
			count: number;
		};
		upcomingPaymentsDue30Days: {
			amount: number;
			count: number;
		};
		latePayments: {
			amount: number;
			count: number;
		};
	};

	revenueMetrics?: {
		totalInterestEarned: number;
		averageInterestRate: number;
		totalFeesEarned: number;
		penaltyFeesCollected: number;
	};

	userInsights?: {
		totalBorrowers: number;
		newBorrowersThisMonth: number;
		repeatBorrowersPercentage: number;
		topBorrowersByExposure: {
			id: string;
			fullName: string;
			email: string;
			totalExposure: number;
		}[];
	};

	operationalKPIs?: {
		loanApprovalTime: number;
		disbursementTime: number;
		applicationApprovalRatio: number;
		totalApplications: number;
	};
	statusBreakdown?: {
		status: string;
		count: number;
		percentage: number;
	}[];
}

interface HealthStatus {
	timestamp: string;
	services: {
		docuseal: ServiceHealth;
		signingOrchestrator: ServiceHealth;
		mtsa: ServiceHealth;
	};
	overall: 'healthy' | 'degraded' | 'unhealthy' | 'checking' | 'error';
	error?: string;
}

interface ServiceHealth {
	status: 'healthy' | 'unhealthy' | 'unreachable' | 'error' | 'unknown';
	url: string;
	responseTime: number;
	error: string | null;
}

export default function AdminDashboardPage() {
	const [stats, setStats] = useState<DashboardStats>({
		totalUsers: 0,
		pendingReviewApplications: 0,
		approvedLoans: 0,
		pendingDisbursementCount: 0,
		disbursedLoans: 0,
		totalDisbursedAmount: 0,
		totalLoanValue: 0,
		currentLoanValue: 0,
		totalFeesCollected: 0,
		totalLateFeesCollected: 0,
		totalRepayments: 0,
		recentApplications: [],
		totalApplications: 0,
		rejectedApplications: 0,
		averageLoanAmount: 0,
		monthlyGrowth: 0,
		activeUsers: 0,
		conversionRate: 0,
		totalRevenue: 0,
		monthlyStats: [],
		dailyStats: [],
		statusBreakdown: [],
	});
	const [loading, setLoading] = useState(true);
	const [userName, setUserName] = useState("Admin");
	const [userRole, setUserRole] = useState<string>("");
	const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly');
	const [workflowCounts, setWorkflowCounts] = useState({
		PENDING_DECISION: 0,
		PENDING_DISBURSEMENT: 0,
		PENDING_DISCHARGE: 0,
		PENDING_PAYMENTS: 0,
		LIVE_ATTESTATIONS: 0,
		PENDING_SIGNATURE: 0,
		PENDING_COMPANY_SIGNATURE: 0,
		PENDING_WITNESS_SIGNATURE: 0,
		POTENTIAL_DEFAULT_LOANS: 0,
		DEFAULTED_LOANS: 0,
		PENDING_STAMPED_AGREEMENTS: 0,
	});
	const [refreshing, setRefreshing] = useState(false);
	const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
	const [healthLoading, setHealthLoading] = useState(false);

	const fetchDashboardData = async () => {
		try {
			// Fetch admin user data with token refresh
			try {
				const userData = await fetchWithAdminTokenRefresh<any>(
					"/api/admin/me"
				);
				if (userData.fullName) {
					setUserName(userData.fullName);
				}
				if (userData.role) {
					setUserRole(userData.role);
				}
			} catch (error) {
				console.error("Error fetching user data:", error);
			}

			// Fetch dashboard stats with token refresh
			const data = await fetchWithAdminTokenRefresh<DashboardStats>(
				"/api/admin/dashboard"
			);

			// Total late fees collected is now included in dashboard API response
			const totalLateFeesCollected = data.totalLateFeesCollected || 0;

			// Fetch monthly statistics
			let monthlyStats = [];
			try {
				const monthlyData = await fetchWithAdminTokenRefresh<{
					monthlyStats: {
						month: string;
						applications: number;
						approvals: number;
						disbursements: number;
						revenue: number;
						fees_earned: number;
						accrued_interest: number;
						disbursement_amount: number;
						disbursement_count: number;
						users: number;
						kyc_users: number;
						actual_repayments: number;
						scheduled_repayments: number;
						total_loan_value: number;
						current_loan_value: number;
						repayment_count: number;
						scheduled_count: number;
					}[];
				}>("/api/admin/monthly-stats");
				monthlyStats = monthlyData.monthlyStats;
			} catch (error) {
				console.error("Error fetching monthly stats:", error);
				// Fallback to mock data if API fails
				monthlyStats = [
					{
						month: "Jan",
						applications: 45,
						approvals: 32,
						disbursements: 28,
						revenue: 14000,
						fees_earned: 4700,
						accrued_interest: 2800,
						disbursement_amount: 280000,
						disbursement_count: 28,
						users: 12,
						kyc_users: 8,
						actual_repayments: 14000,
						scheduled_repayments: 15000,
						total_loan_value: 320000,
						current_loan_value: 306000,
						repayment_count: 25,
						scheduled_count: 30,
					},
					{
						month: "Feb",
						applications: 52,
						approvals: 38,
						disbursements: 35,
						revenue: 17500,
						fees_earned: 5800,
						accrued_interest: 3500,
						disbursement_amount: 350000,
						disbursement_count: 35,
						users: 15,
						kyc_users: 11,
						actual_repayments: 17500,
						scheduled_repayments: 18500,
						total_loan_value: 400000,
						current_loan_value: 688500,
						repayment_count: 32,
						scheduled_count: 38,
					},
					{
						month: "Mar",
						applications: 48,
						approvals: 35,
						disbursements: 32,
						revenue: 16000,
						fees_earned: 5300,
						accrued_interest: 3200,
						disbursement_amount: 320000,
						disbursement_count: 32,
						users: 18,
						kyc_users: 14,
						actual_repayments: 16000,
						scheduled_repayments: 17200,
						total_loan_value: 365000,
						current_loan_value: 1037500,
						repayment_count: 28,
						scheduled_count: 35,
					},
					{
						month: "Apr",
						applications: 61,
						approvals: 44,
						disbursements: 40,
						revenue: 20000,
						fees_earned: 6700,
						accrued_interest: 4000,
						disbursement_amount: 400000,
						disbursement_count: 40,
						users: 22,
						kyc_users: 18,
						actual_repayments: 20000,
						scheduled_repayments: 21000,
						total_loan_value: 456000,
						current_loan_value: 1473500,
						repayment_count: 38,
						scheduled_count: 42,
					},
					{
						month: "May",
						applications: 58,
						approvals: 42,
						disbursements: 38,
						revenue: 19000,
						fees_earned: 6300,
						accrued_interest: 3800,
						disbursement_amount: 380000,
						disbursement_count: 38,
						users: 19,
						kyc_users: 15,
						actual_repayments: 19000,
						scheduled_repayments: 20500,
						total_loan_value: 432000,
						current_loan_value: 1886500,
						repayment_count: 35,
						scheduled_count: 40,
					},
					{
						month: "Jun",
						applications: 67,
						approvals: 49,
						disbursements: 45,
						revenue: 22500,
						fees_earned: 7500,
						accrued_interest: 4500,
						disbursement_amount: 450000,
						disbursement_count: 45,
						users: 25,
						kyc_users: 20,
						actual_repayments: 22500,
						scheduled_repayments: 24000,
						total_loan_value: 513000,
						current_loan_value: 2377000,
						repayment_count: 42,
						scheduled_count: 48,
					},
				];
			}

			// Fetch daily statistics
			let dailyStats = [];
			try {
				const dailyData = await fetchWithAdminTokenRefresh<{
					dailyStats: {
						date: string;
						applications: number;
						approvals: number;
						disbursements: number;
						revenue: number;
						fees_earned: number;
						accrued_interest: number;
						disbursement_amount: number;
						disbursement_count: number;
						users: number;
						kyc_users: number;
						actual_repayments: number;
						scheduled_repayments: number;
						total_loan_value: number;
						current_loan_value: number;
						repayment_count: number;
						scheduled_count: number;
					}[];
				}>("/api/admin/daily-stats");
				dailyStats = dailyData.dailyStats;
			} catch (error) {
				console.error("Error fetching daily stats:", error);
				// Generate mock daily data for last 30 days if API fails
				const mockDailyStats = [];
				const now = new Date();
				for (let i = 29; i >= 0; i--) {
					const date = new Date(now);
					date.setDate(date.getDate() - i);
					mockDailyStats.push({
						date: date.toISOString().split('T')[0],
						applications: Math.floor(Math.random() * 8) + 1,
						approvals: Math.floor(Math.random() * 6) + 1,
						disbursements: Math.floor(Math.random() * 4) + 1,
						revenue: Math.floor(Math.random() * 3000) + 500,
						fees_earned: Math.floor(Math.random() * 1000) + 200,
						accrued_interest: Math.floor(Math.random() * 800) + 100,
						disbursement_amount: Math.floor(Math.random() * 50000) + 10000,
						disbursement_count: Math.floor(Math.random() * 3) + 1,
						users: Math.floor(Math.random() * 5) + 1,
						kyc_users: Math.floor(Math.random() * 3) + 1,
						actual_repayments: Math.floor(Math.random() * 2500) + 500,
						scheduled_repayments: Math.floor(Math.random() * 3000) + 600,
						total_loan_value: Math.floor(Math.random() * 100000) + 20000,
						current_loan_value: Math.floor(Math.random() * 80000) + 15000,
						repayment_count: Math.floor(Math.random() * 4) + 1,
						scheduled_count: Math.floor(Math.random() * 5) + 1,
					});
				}
				dailyStats = mockDailyStats;
			}

			// Use totalApplications from API instead of calculating
			const totalApplications = data.totalApplications || 0;

			// Calculate monthly growth from real data
			const currentMonth = monthlyStats[monthlyStats.length - 1];
			const previousMonth = monthlyStats[monthlyStats.length - 2];
			const monthlyGrowth =
				previousMonth && currentMonth
					? ((currentMonth.applications -
							previousMonth.applications) /
							previousMonth.applications) *
					  100
					: 0;

			// Enhance monthlyStats with missing fields if they don't exist
			const enhancedMonthlyStats = monthlyStats.map((stat: any) => {
				const currentLoanValue = stat.current_loan_value || 0;
				const accruedInterest = stat.accrued_interest || 0;
				return {
					...stat,
					fees_earned: stat.fees_earned || 0,
					accrued_interest: accruedInterest,
					actual_repayments: stat.actual_repayments || 0,
					scheduled_repayments: stat.scheduled_repayments || 0,
					total_loan_value: stat.total_loan_value || 0,
					current_loan_value: currentLoanValue,
					// Active Loan Book = Total Exposure (current_loan_value) - Accrued Interest
					active_loan_book: Math.max(0, currentLoanValue - accruedInterest),
					repayment_count: stat.repayment_count || 0,
					scheduled_count: stat.scheduled_count || 0,
				};
			});

			// Enhance dailyStats with missing fields if they don't exist
			const enhancedDailyStats = dailyStats.map((stat: any) => {
				const currentLoanValue = stat.current_loan_value || 0;
				const accruedInterest = stat.accrued_interest || 0;
				return {
					...stat,
					fees_earned: stat.fees_earned || 0,
					accrued_interest: accruedInterest,
					actual_repayments: stat.actual_repayments || 0,
					scheduled_repayments: stat.scheduled_repayments || 0,
					total_loan_value: stat.total_loan_value || 0,
					current_loan_value: currentLoanValue,
					// Active Loan Book = Total Exposure (current_loan_value) - Accrued Interest
					active_loan_book: Math.max(0, currentLoanValue - accruedInterest),
					repayment_count: stat.repayment_count || 0,
					scheduled_count: stat.scheduled_count || 0,
				};
			});

			const enhancedData = {
				...data,
				totalApplications,
				totalLateFeesCollected,
				averageLoanAmount:
					data.disbursedLoans > 0
						? (data.totalLoanValue ||
								data.totalDisbursedAmount ||
								0) / data.disbursedLoans
						: 0,
				conversionRate:
					totalApplications > 0
						? ((data.approvedLoans || 0) / totalApplications) *
						  100
						: 0,
				monthlyGrowth,
				activeUsers: Math.floor((data.totalUsers || 0) * 0.7), // Mock data
				totalRevenue: (data.totalDisbursedAmount || 0) * 0.05, // Assuming 5% fee
				monthlyStats: enhancedMonthlyStats,
				dailyStats: enhancedDailyStats,
				statusBreakdown: [
					{
						status: "Incomplete",
						count: 0, // Will be updated below
						percentage: 0,
					},
					{
						status: "Pending KYC",
						count: 0, // Will be updated below
						percentage: 0,
					},
					{
						status: "Pending Review",
						count: data.pendingReviewApplications || 0,
						percentage: 0,
					},
					{
						status: "Collateral Review",
						count: 0, // Will be updated below
						percentage: 0,
					},
					{
						status: "Pending Attestation",
						count: 0, // Will be updated below
						percentage: 0,
					},
					{
						status: "Pending Signature",
						count: 0, // Will be updated below
						percentage: 0,
					},
					{
						status: "Pending Disbursement",
						count: data.pendingDisbursementCount || 0,
						percentage: 0,
					},
					{
						status: "Disbursed",
						count: data.disbursedLoans || 0,
						percentage: 0,
					},
					{
						status: "Rejected",
						count: data.rejectedApplications || 0,
						percentage: 0,
					},
				],
			};

			// Calculate percentages for status breakdown
			const total = enhancedData.totalApplications || 1;
			enhancedData.statusBreakdown = enhancedData.statusBreakdown.map(
				(item) => ({
					...item,
					percentage: (item.count / total) * 100,
				})
			);

			setStats(enhancedData);

			// Try to fetch application counts for workflow
			try {
				const countsData = await fetchWithAdminTokenRefresh<any>(
					"/api/admin/applications/counts"
				);

				// Fetch pending discharge loans count
				let pendingDischargeCount = 0;
				try {
					const loansResponse = await fetchWithAdminTokenRefresh<{
						success: boolean;
						data: any[];
					}>("/api/admin/loans");

					if (loansResponse.success && loansResponse.data) {
						pendingDischargeCount = loansResponse.data.filter(
							(loan: any) =>
								loan.status === "PENDING_DISCHARGE"
						).length;
					}
				} catch (loansError) {
					console.error(
						"Error fetching loans for discharge count:",
						loansError
					);
				}

				// Fetch pending payments count
				let pendingPaymentsCount = 0;
				try {
					const paymentsResponse =
						await fetchWithAdminTokenRefresh<{
							success: boolean;
							data: any[];
						}>("/api/admin/repayments/pending");

					if (paymentsResponse.success && paymentsResponse.data) {
						pendingPaymentsCount = paymentsResponse.data.length;
					}
				} catch (paymentsError) {
					console.error(
						"Error fetching pending payments count:",
						paymentsError
					);
				}

				// Fetch live attestation requests count
				let liveAttestationsCount = 0;
				try {
					const attestationsResponse =
						await fetchWithAdminTokenRefresh<any[]>(
							"/api/admin/applications/live-attestations"
						);

					if (attestationsResponse) {
						liveAttestationsCount = attestationsResponse.filter(
							(app: any) => !app.attestationCompleted
						).length;
					}
				} catch (attestationsError) {
					console.error(
						"Error fetching live attestations count:",
						attestationsError
					);
				}

				// Get signature counts based on user role
				const pendingCompanySignatureCount = countsData.PENDING_COMPANY_SIGNATURE || 0;
				const pendingWitnessSignatureCount = countsData.PENDING_WITNESS_SIGNATURE || 0;
				

				setWorkflowCounts({
					PENDING_DECISION:
						(countsData.PENDING_APPROVAL || 0) + 
						(countsData.COLLATERAL_REVIEW || 0),
					PENDING_DISBURSEMENT:
						countsData.PENDING_DISBURSEMENT ||
						data.pendingDisbursementCount ||
						0,
					PENDING_DISCHARGE: pendingDischargeCount,
					PENDING_PAYMENTS: pendingPaymentsCount,
					LIVE_ATTESTATIONS: liveAttestationsCount,
					PENDING_SIGNATURE: pendingCompanySignatureCount + pendingWitnessSignatureCount, // Combined count
					PENDING_COMPANY_SIGNATURE: pendingCompanySignatureCount,
					PENDING_WITNESS_SIGNATURE: pendingWitnessSignatureCount,
					POTENTIAL_DEFAULT_LOANS: data.potentialDefaultLoansCount || 0,
					DEFAULTED_LOANS: data.defaultedLoansCount || 0,
					PENDING_STAMPED_AGREEMENTS: data.pendingStampedAgreements || 0,
				});

				// Update the status breakdown with workflow counts
				setStats(prevStats => ({
					...prevStats,
					statusBreakdown: prevStats.statusBreakdown?.map(item => {
						if (item.status === "Pending Signature") {
							return { ...item, count: pendingCompanySignatureCount + pendingWitnessSignatureCount };
						} else if (item.status === "Pending Attestation") {
							return { ...item, count: countsData.PENDING_ATTESTATION || 0 };
						} else if (item.status === "Pending KYC") {
							return { ...item, count: countsData.PENDING_KYC || 0 };
						} else if (item.status === "Collateral Review") {
							return { ...item, count: countsData.COLLATERAL_REVIEW || 0 };
						} else if (item.status === "Incomplete") {
							return { ...item, count: countsData.INCOMPLETE || 0 };
						}
						return item;
					}) || []
				}));
			} catch (countsError) {
				console.error(
					"🔍 Error fetching application counts, using dashboard stats:",
					countsError
				);

				setWorkflowCounts({
					PENDING_DECISION: data.pendingReviewApplications || 0,
					PENDING_DISBURSEMENT:
						data.pendingDisbursementCount || 0,
					PENDING_DISCHARGE: 0,
					PENDING_PAYMENTS: 0,
					LIVE_ATTESTATIONS: 0, // Will be fetched separately
					PENDING_SIGNATURE: 0,
					PENDING_COMPANY_SIGNATURE: 0,
					PENDING_WITNESS_SIGNATURE: 0,
					POTENTIAL_DEFAULT_LOANS: data.potentialDefaultLoansCount || 0,
					DEFAULTED_LOANS: data.defaultedLoansCount || 0,
					PENDING_STAMPED_AGREEMENTS: data.pendingStampedAgreements || 0,
				});
			}
		} catch (error) {
			console.error("Error fetching dashboard data:", error);
		}
	};

	const fetchHealthStatus = async (showToast = false) => {
		setHealthLoading(true);
		try {
			const response = await fetchWithAdminTokenRefresh<HealthStatus>(
				"/api/admin/health-check"
			);
			setHealthStatus(response);
			if (showToast) {
				if (response.overall === 'healthy') {
					toast.success("All on-premise services are healthy");
				} else if (response.overall === 'degraded') {
					toast.warning("Some on-premise services are degraded");
				} else {
					toast.error("On-premise services are unhealthy");
				}
			}
		} catch (error) {
			console.error("Error fetching health status:", error);
			setHealthStatus({
				timestamp: new Date().toISOString(),
				services: {
					docuseal: { status: 'error', url: '', responseTime: 0, error: 'Failed to fetch' },
					signingOrchestrator: { status: 'error', url: '', responseTime: 0, error: 'Failed to fetch' },
					mtsa: { status: 'error', url: '', responseTime: 0, error: 'Failed to fetch' }
				},
				overall: 'error',
				error: 'Failed to fetch health status'
			});
			if (showToast) {
				toast.error("Failed to check on-premise server health");
			}
		} finally {
			setHealthLoading(false);
		}
	};

	const handleRefresh = async () => {
		setRefreshing(true);
		try {
			await Promise.all([
				fetchDashboardData(),
				fetchHealthStatus()
			]);
			toast.success("Dashboard refreshed successfully");
		} catch (error) {
			console.error("Error refreshing dashboard data:", error);
			toast.error("Failed to refresh dashboard");
		} finally {
			setRefreshing(false);
		}
	};

	useEffect(() => {
		const initialLoad = async () => {
			setLoading(true);
			try {
				await Promise.all([
					fetchDashboardData(),
					fetchHealthStatus()
				]);
			} catch (error) {
				console.error("Error loading dashboard:", error);
			} finally {
				setLoading(false);
			}
		};

		initialLoad();
	}, []);

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
		});
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "PENDING":
			case "PENDING_APPROVAL":
			case "Pending Review":
				return "bg-yellow-500/20 text-yellow-200 border border-yellow-400/20";
			case "APPROVED":
			case "Disbursed":
				return "bg-green-500/20 text-green-200 border border-green-400/20";
			case "REJECTED":
			case "Rejected":
				return "bg-red-500/20 text-red-200 border border-red-400/20";
			case "DISBURSED":
			case "Pending Disbursement":
				return "bg-blue-500/20 text-blue-200 border border-blue-400/20";
			case "WITHDRAWN":
				return "bg-gray-500/20 text-gray-200 border border-gray-400/20";
			default:
				return "bg-gray-500/20 text-gray-200 border border-gray-400/20";
		}
	};

	const formatNumber = (num: number) => {
		if (num >= 1000000000) {
			return (num / 1000000000).toFixed(1) + "B";
		}
		if (num >= 1000000) {
			return (num / 1000000).toFixed(1) + "M";
		}
		if (num >= 1000) {
			return (num / 1000).toFixed(1) + "K";
		}
		return num.toString();
	};

	const formatCurrencyCompact = (amount: number) => {
		if (amount >= 1000000000) {
			return `RM${(amount / 1000000000).toFixed(1)}B`;
		}
		if (amount >= 1000000) {
			return `RM${(amount / 1000000).toFixed(1)}M`;
		}
		if (amount >= 1000) {
			return `RM${(amount / 1000).toFixed(1)}K`;
		}
		return formatCurrency(amount);
	};

	// Helper function to calculate totals and growth
	const calculateMetrics = (data: any[], key: string) => {
		let total;
		let currentPeriod;
		
		if (key === 'current_loan_value' || key === 'accrued_interest') {
			// For current loan value and accrued interest, "total" should be the current value, not a sum
			total = data[data.length - 1]?.[key] || 0;
			
			// For current loan value and accrued interest, "currentPeriod" should show the change for the period
			const latestValue = data[data.length - 1]?.[key] || 0;
			if (viewMode === 'monthly') {
				// For monthly: show change from previous month to current month
				const previousMonthValue = data[data.length - 2]?.[key] || latestValue;
				currentPeriod = latestValue - previousMonthValue;
			} else {
				// For daily: show change from yesterday to today
				const yesterdayValue = data[data.length - 2]?.[key] || latestValue;
				currentPeriod = latestValue - yesterdayValue;
			}
		} else {
			// For other metrics, sum them up (applications, repayments, etc.)
			total = data.reduce((sum, item) => sum + (item[key] || 0), 0);
			currentPeriod = data[data.length - 1]?.[key] || 0;
		}
		
		const latestValue = data[data.length - 1]?.[key] || 0;
		const previousValue = data[data.length - 2]?.[key] || 0;
		const growth =
			previousValue > 0
				? ((latestValue - previousValue) / previousValue) * 100
				: 0;

		return { total, currentPeriod, growth };
	};

	// Get current data based on view mode
	const getCurrentData = () => {
		return viewMode === 'monthly' ? stats.monthlyStats || [] : stats.dailyStats || [];
	};

	// Format chart data labels based on view mode
	const formatChartLabel = (value: any) => {
		if (viewMode === 'monthly') {
			return value;
		} else {
			// For daily view, format date as "MM/DD"
			const date = new Date(value);
			return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
		}
	};

	// Get period label
	const getPeriodLabel = () => {
		return viewMode === 'monthly' ? 'This Month' : 'Today';
	};

	// Get growth label
	const getGrowthLabel = () => {
		return viewMode === 'monthly' ? 'MoM Growth' : 'DoD Growth';
	};

	const getHealthStatusColor = (status: string) => {
		switch (status) {
			case 'healthy':
				return 'text-green-400';
			case 'degraded':
				return 'text-yellow-400';
			case 'unhealthy':
			case 'unreachable':
				return 'text-red-400';
			case 'checking':
				return 'text-blue-400';
			case 'error':
			default:
				return 'text-gray-400';
		}
	};

	const getHealthStatusIcon = (status: string) => {
		switch (status) {
			case 'healthy':
				return <CheckCircleIcon className="h-4 w-4" />;
			case 'degraded':
				return <ExclamationTriangleIcon className="h-4 w-4" />;
			case 'unhealthy':
			case 'unreachable':
				return <XCircleIcon className="h-4 w-4" />;
			case 'checking':
				return <ArrowPathIcon className="h-4 w-4 animate-spin" />;
			case 'error':
			default:
				return <ServerIcon className="h-4 w-4" />;
		}
	};

	const getServiceDisplayName = (serviceName: string) => {
		switch (serviceName) {
			case 'docuseal':
				return 'E-Signature Service';
			case 'signingOrchestrator':
				return 'Document Signing Hub';
			case 'mtsa':
				return 'PKI Signing Service';
			default:
				return serviceName;
		}
	};

	const getServiceDescription = (serviceName: string) => {
		switch (serviceName) {
			case 'docuseal':
				return 'Collects borrower e-signatures on loan agreements';
			case 'signingOrchestrator':
				return 'Coordinates document workflow between signing services';
			case 'mtsa':
				return 'Applies legally-binding PKI digital signatures via MyTrustSigner';
			default:
				return '';
		}
	};

	if (loading) {
		return (
			<AdminLayout
				title="Dashboard"
				description="Overview of your platform's performance"
			>
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
				</div>
			</AdminLayout>
		);
	}

	const currentData = getCurrentData();

	return (
		<AdminLayout
			title="Dashboard"
			description="Overview of your platform's performance"
		>
			{/* On-Prem Health Status - Minimal UI */}
			<div className="mb-8">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-medium text-white flex items-center">
						<SignalIcon className="h-6 w-6 mr-2 text-blue-400" />
						On-Premise Server
					</h2>
					<button
						onClick={() => fetchHealthStatus(true)}
						disabled={healthLoading}
						className="flex items-center gap-2 px-3 py-1 bg-gray-800/50 border border-gray-700/50 rounded-lg hover:bg-gray-700/50 transition-colors disabled:opacity-50"
					>
						<ArrowPathIcon className={`h-4 w-4 text-gray-300 ${healthLoading ? 'animate-spin' : ''}`} />
						<span className="text-sm text-gray-300">Check</span>
					</button>
				</div>
				
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-4">
					{healthStatus ? (
						<>
							{/* Overall Status */}
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center gap-2">
									<div className={`${getHealthStatusColor(healthStatus.overall)}`}>
										{getHealthStatusIcon(healthStatus.overall)}
									</div>
									<span className={`text-sm font-medium ${getHealthStatusColor(healthStatus.overall)}`}>
										{healthStatus.overall.charAt(0).toUpperCase() + healthStatus.overall.slice(1)}
									</span>
								</div>
								<span className="text-xs text-gray-500">
									Last checked: {new Date(healthStatus.timestamp).toLocaleTimeString()}
								</span>
							</div>

							{/* Services Grid */}
							<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
								{Object.entries(healthStatus.services).map(([serviceName, service]) => (
									<div 
										key={serviceName}
										className="flex flex-col p-3 bg-gray-800/50 rounded-lg border border-gray-700/30"
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<div className={`${getHealthStatusColor(service.status)}`}>
													{getHealthStatusIcon(service.status)}
												</div>
												<span className="text-sm text-gray-300">
													{getServiceDisplayName(serviceName)}
												</span>
											</div>
											<div className="text-right">
												<div className={`text-xs font-medium ${getHealthStatusColor(service.status)}`}>
													{service.status.charAt(0).toUpperCase() + service.status.slice(1)}
												</div>
												{service.responseTime > 0 && (
													<div className="text-xs text-gray-500">
														{service.responseTime}ms
													</div>
												)}
											</div>
										</div>
										<p className="text-xs text-gray-500 mt-2">
											{getServiceDescription(serviceName)}
										</p>
									</div>
								))}
							</div>

							{/* Error Details */}
							{healthStatus.overall === 'error' && healthStatus.error && (
								<div className="mt-3 p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
									<p className="text-xs text-red-400">{healthStatus.error}</p>
								</div>
							)}
						</>
					) : (
						<div className="flex items-center justify-center py-4">
							<div className="flex items-center gap-2 text-gray-400">
								<ArrowPathIcon className="h-4 w-4 animate-spin" />
								<span className="text-sm">Loading health status...</span>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Quick Actions */}
			<div className="mb-8">
				<div className="flex items-center justify-between mb-5">
					<h2 className="text-lg font-medium text-white flex items-center">
						<ClockIcon className="h-6 w-6 mr-2 text-amber-400" />
						Quick Actions
					</h2>
					<button
						onClick={handleRefresh}
						disabled={refreshing}
						className="group bg-gradient-to-br from-slate-600/20 to-slate-800/20 backdrop-blur-md border border-slate-500/30 rounded-xl shadow-lg px-4 py-2 transition-all hover:scale-[1.02] hover:border-slate-400/50 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<div className="flex items-center gap-2">
							<ArrowPathIcon className={`h-5 w-5 text-slate-300 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'}`} />
							<span className="text-sm font-medium text-slate-300 group-hover:text-slate-200">
								{refreshing ? 'Refreshing...' : 'Refresh'}
							</span>
						</div>
					</button>
				</div>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
					{/* Pending Decisions - ADMIN only */}
					{userRole === "ADMIN" && (
					<Link
						href="/dashboard/applications?filter=pending-approval"
						className="group bg-gradient-to-br from-amber-600/20 to-amber-800/20 backdrop-blur-md border border-amber-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-amber-400/50"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-amber-500/30 rounded-lg">
								<ExclamationTriangleIcon className="h-6 w-6 text-amber-300" />
							</div>
							{workflowCounts.PENDING_DECISION > 0 && (
								<span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
									{formatNumber(
										workflowCounts.PENDING_DECISION
									)}
								</span>
							)}
						</div>
						<h3 className="text-white font-medium mb-1">
							Review Applications
						</h3>
						<p className="text-sm text-amber-200 mb-3">
							{workflowCounts.PENDING_DECISION > 0
								? `${formatNumber(
										workflowCounts.PENDING_DECISION
								  )} applications need review`
								: "No pending applications"}
						</p>
						<div className="flex items-center text-amber-300 text-sm font-medium group-hover:text-amber-200">
							Review now
							<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</Link>
					)}

					{/* Company Signatures - ADMIN only */}
					{userRole === "ADMIN" && (
					<Link
						href="/dashboard/applications?tab=signatures&filter=pending_company_signature"
						className="group bg-gradient-to-br from-cyan-600/20 to-cyan-800/20 backdrop-blur-md border border-cyan-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-cyan-400/50"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-cyan-500/30 rounded-lg">
								<DocumentTextIcon className="h-6 w-6 text-cyan-300" />
							</div>
							{workflowCounts.PENDING_COMPANY_SIGNATURE > 0 && (
								<span className="bg-cyan-500 text-white text-xs font-bold px-2 py-1 rounded-full">
									{formatNumber(
										workflowCounts.PENDING_COMPANY_SIGNATURE
									)}
								</span>
							)}
						</div>
						<h3 className="text-white font-medium mb-1">
							Company Signing
						</h3>
						<p className="text-sm text-cyan-200 mb-3">
							{workflowCounts.PENDING_COMPANY_SIGNATURE > 0
								? `${formatNumber(
										workflowCounts.PENDING_COMPANY_SIGNATURE
								  )} applications need company signatures`
								: "No pending company signatures"}
						</p>
						<div className="flex items-center text-cyan-300 text-sm font-medium group-hover:text-cyan-200">
							Review now
							<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</Link>
					)}

					{/* Witness Signatures - Available to both ADMIN and ATTESTOR */}
					<Link
						href="/dashboard/applications?tab=signatures&filter=pending_witness_signature"
						className="group bg-gradient-to-br from-orange-600/20 to-orange-800/20 backdrop-blur-md border border-orange-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-orange-400/50"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-orange-500/30 rounded-lg">
								<UserCircleIcon className="h-6 w-6 text-orange-300" />
							</div>
							{workflowCounts.PENDING_WITNESS_SIGNATURE > 0 && (
								<span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
									{formatNumber(
										workflowCounts.PENDING_WITNESS_SIGNATURE
									)}
								</span>
							)}
						</div>
						<h3 className="text-white font-medium mb-1">
							Witness Signing
						</h3>
						<p className="text-sm text-orange-200 mb-3">
							{workflowCounts.PENDING_WITNESS_SIGNATURE > 0
								? `${formatNumber(
										workflowCounts.PENDING_WITNESS_SIGNATURE
								  )} applications need witness signatures`
								: "No pending witness signatures"}
						</p>
						<div className="flex items-center text-orange-300 text-sm font-medium group-hover:text-orange-200">
							Review now
							<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</Link>

					{/* Pending Disbursements - ADMIN only */}
					{userRole === "ADMIN" && (
					<Link
						href="/dashboard/applications?filter=pending-disbursement"
						className="group bg-gradient-to-br from-green-600/20 to-green-800/20 backdrop-blur-md border border-green-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-green-400/50"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-green-500/30 rounded-lg">
								<CheckCircleIcon className="h-6 w-6 text-green-300" />
							</div>
							{workflowCounts.PENDING_DISBURSEMENT > 0 && (
								<span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
									{formatNumber(
										workflowCounts.PENDING_DISBURSEMENT
									)}
								</span>
							)}
						</div>
						<h3 className="text-white font-medium mb-1">
							Process Disbursements
						</h3>
						<p className="text-sm text-green-200 mb-3">
							{workflowCounts.PENDING_DISBURSEMENT > 0
								? `${formatNumber(
										workflowCounts.PENDING_DISBURSEMENT
								  )} loans ready to disburse`
								: "No pending disbursements"}
						</p>
						<div className="flex items-center text-green-300 text-sm font-medium group-hover:text-green-200">
							Process now
							<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</Link>
					)}

					{/* Pending Discharge - ADMIN only */}
					{userRole === "ADMIN" && (
					<Link
						href="/dashboard/loans?filter=pending_discharge"
						className="group bg-gradient-to-br from-orange-600/20 to-orange-800/20 backdrop-blur-md border border-orange-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-orange-400/50"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-orange-500/30 rounded-lg">
								<ClockIcon className="h-6 w-6 text-orange-300" />
							</div>
							{workflowCounts.PENDING_DISCHARGE > 0 && (
								<span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
									{formatNumber(
										workflowCounts.PENDING_DISCHARGE
									)}
								</span>
							)}
						</div>
						<h3 className="text-white font-medium mb-1">
							Pending Discharge
						</h3>
						<p className="text-sm text-orange-200 mb-3">
							{workflowCounts.PENDING_DISCHARGE > 0
								? `${formatNumber(
										workflowCounts.PENDING_DISCHARGE
								  )} loans ready for discharge`
								: "No loans pending discharge"}
						</p>
						<div className="flex items-center text-orange-300 text-sm font-medium group-hover:text-orange-200">
							Review now
							<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</Link>
					)}

					{/* Review Payments - ADMIN only */}
					{userRole === "ADMIN" && (
					<Link
						href="/dashboard/payments"
						className="group bg-gradient-to-br from-purple-600/20 to-purple-800/20 backdrop-blur-md border border-purple-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-purple-400/50"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-purple-500/30 rounded-lg">
								<ReceiptPercentIcon className="h-6 w-6 text-purple-300" />
							</div>
							{workflowCounts.PENDING_PAYMENTS > 0 && (
								<span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full">
									{formatNumber(
										workflowCounts.PENDING_PAYMENTS
									)}
								</span>
							)}
						</div>
						<h3 className="text-white font-medium mb-1">
							Review Payments
						</h3>
						<p className="text-sm text-purple-200 mb-3">
							{workflowCounts.PENDING_PAYMENTS > 0
								? `${formatNumber(
										workflowCounts.PENDING_PAYMENTS
								  )} payments need review`
								: "No pending payments"}
						</p>
						<div className="flex items-center text-purple-300 text-sm font-medium group-hover:text-purple-200">
							Review now
							<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</Link>
					)}

					{/* Live Attestations - Available to both ADMIN and ATTESTOR */}
					<Link
						href="/dashboard/live-attestations"
						className="group bg-gradient-to-br from-indigo-600/20 to-indigo-800/20 backdrop-blur-md border border-indigo-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-indigo-400/50"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-indigo-500/30 rounded-lg">
								<VideoCameraIcon className="h-6 w-6 text-indigo-300" />
							</div>
							{workflowCounts.LIVE_ATTESTATIONS > 0 && (
								<span className="bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-full">
									{formatNumber(
										workflowCounts.LIVE_ATTESTATIONS
									)}
								</span>
							)}
						</div>
						<h3 className="text-white font-medium mb-1">
							Live Attestations
						</h3>
						<p className="text-sm text-indigo-200 mb-3">
							{workflowCounts.LIVE_ATTESTATIONS > 0
								? `${formatNumber(
										workflowCounts.LIVE_ATTESTATIONS
								  )} video calls pending`
								: "No pending attestations"}
						</p>
						<div className="flex items-center text-indigo-300 text-sm font-medium group-hover:text-indigo-200">
							Manage now
							<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</Link>

					{/* Default Risk Loans - ADMIN only */}
					{userRole === "ADMIN" && (
					<Link
						href="/dashboard/loans?filter=potential_default"
						className="group bg-gradient-to-br from-amber-600/20 to-amber-800/20 backdrop-blur-md border border-amber-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-amber-400/50"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-amber-500/30 rounded-lg">
								<ExclamationTriangleIcon className="h-6 w-6 text-amber-300" />
							</div>
							{workflowCounts.POTENTIAL_DEFAULT_LOANS > 0 && (
								<span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
									{formatNumber(
										workflowCounts.POTENTIAL_DEFAULT_LOANS
									)}
								</span>
							)}
						</div>
						<h3 className="text-white font-medium mb-1">
							Default Risk Loans
						</h3>
						<p className="text-sm text-amber-200 mb-3">
							{workflowCounts.POTENTIAL_DEFAULT_LOANS > 0
								? `${formatNumber(
										workflowCounts.POTENTIAL_DEFAULT_LOANS
								  )} loans at risk`
								: "No loans at default risk"}
						</p>
						<div className="flex items-center text-amber-300 text-sm font-medium group-hover:text-amber-200">
							Review now
							<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</Link>
					)}

					{/* Defaulted Loans - ADMIN only */}
					{userRole === "ADMIN" && (
					<Link
						href="/dashboard/loans?filter=defaulted"
						className="group bg-gradient-to-br from-red-600/20 to-red-800/20 backdrop-blur-md border border-red-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-red-400/50"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-red-500/30 rounded-lg">
								<XCircleIcon className="h-6 w-6 text-red-300" />
							</div>
							{workflowCounts.DEFAULTED_LOANS > 0 && (
								<span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
									{formatNumber(
										workflowCounts.DEFAULTED_LOANS
									)}
								</span>
							)}
						</div>
						<h3 className="text-white font-medium mb-1">
							Defaulted Loans
						</h3>
						<p className="text-sm text-red-200 mb-3">
							{workflowCounts.DEFAULTED_LOANS > 0
								? `${formatNumber(
										workflowCounts.DEFAULTED_LOANS
								  )} loans defaulted`
								: "No defaulted loans"}
						</p>
						<div className="flex items-center text-red-300 text-sm font-medium group-hover:text-red-200">
							Manage now
							<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</Link>
					)}

				{/* Pending Stamp Certificates - ADMIN only */}
				{userRole === "ADMIN" && (
				<Link
					href="/dashboard/applications?filter=pending-stamping"
					className="group bg-gradient-to-br from-teal-600/20 to-teal-800/20 backdrop-blur-md border border-teal-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-teal-400/50"
				>
					<div className="flex items-center justify-between mb-3">
						<div className="p-2 bg-teal-500/30 rounded-lg">
							<DocumentTextIcon className="h-6 w-6 text-teal-300" />
						</div>
						{workflowCounts.PENDING_STAMPED_AGREEMENTS > 0 && (
							<span className="bg-teal-500 text-white text-xs font-bold px-2 py-1 rounded-full">
								{formatNumber(
									workflowCounts.PENDING_STAMPED_AGREEMENTS
								)}
							</span>
						)}
					</div>
					<h3 className="text-white font-medium mb-1">
						Pending Stamp Certificates
					</h3>
					<p className="text-sm text-teal-200 mb-3">
						{workflowCounts.PENDING_STAMPED_AGREEMENTS > 0
							? `${formatNumber(
									workflowCounts.PENDING_STAMPED_AGREEMENTS
							  )} applications awaiting stamp certificate`
							: "No pending stamp certificates"}
					</p>
					<div className="flex items-center text-teal-300 text-sm font-medium group-hover:text-teal-200">
						Upload certificate
						<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
					</div>
				</Link>
				)}

				{/* Missing Disbursement Slips - ADMIN only */}
				{userRole === "ADMIN" && (stats.disbursementsWithoutSlips || 0) > 0 && (
				<Link
					href="/dashboard/loans?tab=disbursements"
					className="group bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 backdrop-blur-md border border-yellow-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-yellow-400/50"
				>
					<div className="flex items-center justify-between mb-3">
						<div className="p-2 bg-yellow-500/30 rounded-lg">
							<DocumentArrowDownIcon className="h-6 w-6 text-yellow-300" />
						</div>
						<span className="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full">
							{formatNumber(stats.disbursementsWithoutSlips || 0)}
						</span>
					</div>
					<h3 className="text-white font-medium mb-1">
						Missing Payment Slips
					</h3>
					<p className="text-sm text-yellow-200 mb-3">
						{formatNumber(stats.disbursementsWithoutSlips || 0)} disbursements need slips
					</p>
					<div className="flex items-center text-yellow-300 text-sm font-medium group-hover:text-yellow-200">
						Upload now
						<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
					</div>
				</Link>
				)}

				</div>
			</div>

			{/* Application Status Summary - ADMIN only */}
			{userRole === "ADMIN" && (
			<div className="mb-8">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h2 className="text-lg font-medium text-white flex items-center">
							<ChartBarIcon className="h-6 w-6 mr-2 text-purple-400" />
							Application Pipeline
						</h2>
						<p className="text-sm text-gray-400 mt-1">
							Total Applications: {formatNumber(stats.totalApplications || 0)}
						</p>
					</div>
				</div>
				{/* Application Status Overview - Grid Layout */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Pie Chart */}
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-medium text-white">
								Application Status Distribution
							</h3>
							<ChartBarIcon className="h-6 w-6 text-purple-400" />
						</div>

						<div className="h-80">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={stats.statusBreakdown}
										cx="50%"
										cy="50%"
										innerRadius={60}
										outerRadius={120}
										paddingAngle={5}
										dataKey="count"
										nameKey="status"
									>
										{stats.statusBreakdown?.map(
											(entry, index) => {
												const colors = [
													"#6B7280", // Gray for Incomplete
													"#6366F1", // Indigo for Pending KYC
													"#F59E0B", // Yellow/Amber for Pending Review
													"#F97316", // Orange for Collateral Review
													"#06B6D4", // Cyan for Pending Attestation
													"#8B5CF6", // Purple for Pending Signature
													"#3B82F6", // Blue for Pending Disbursement
													"#10B981", // Green for Disbursed
													"#EF4444", // Red for Rejected
												];
												return (
													<Cell
														key={`cell-${index}`}
														fill={
															colors[
																index %
																	colors.length
															]
														}
													/>
												);
											}
										)}
									</Pie>
									<Tooltip
										contentStyle={{
											backgroundColor: "#1F2937",
											border: "1px solid #374151",
											borderRadius: "8px",
											color: "#F9FAFB",
										}}
										labelStyle={{ color: "#F9FAFB" }}
										itemStyle={{ color: "#F9FAFB" }}
									/>
								</PieChart>
						</ResponsiveContainer>
						</div>
					</div>

					{/* Status Cards Grid */}
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
						{/* Incomplete */}
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 overflow-hidden shadow-lg rounded-xl">
							<div className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-gray-300">
											Incomplete
										</p>
										<p className="text-2xl font-bold text-gray-400">
											{formatNumber(stats.statusBreakdown?.find(item => item.status === "Incomplete")?.count || 0)}
										</p>
										<div className="flex items-center mt-2">
											<ClockIcon className="h-4 w-4 text-gray-400 mr-1" />
											<span className="text-xs text-gray-400">
												Partial applications
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Pending KYC */}
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 overflow-hidden shadow-lg rounded-xl">
							<div className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-gray-300">
											Pending KYC
										</p>
										<p className="text-2xl font-bold text-indigo-400">
											{formatNumber(stats.statusBreakdown?.find(item => item.status === "Pending KYC")?.count || 0)}
										</p>
										<div className="flex items-center mt-2">
											<UserCircleIcon className="h-4 w-4 text-indigo-400 mr-1" />
											<span className="text-xs text-gray-400">
												Identity verification
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Pending Review */}
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 overflow-hidden shadow-lg rounded-xl">
							<div className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-gray-300">
											Pending Review
										</p>
										<p className="text-2xl font-bold text-yellow-400">
											{formatNumber(stats.pendingReviewApplications || 0)}
										</p>
										<div className="flex items-center mt-2">
											<ClockIcon className="h-4 w-4 text-yellow-400 mr-1" />
											<span className="text-xs text-gray-400">
												Awaiting decision
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Collateral Review */}
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 overflow-hidden shadow-lg rounded-xl">
							<div className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-gray-300">
											Collateral Review
										</p>
										<p className="text-2xl font-bold text-orange-400">
											{formatNumber(stats.statusBreakdown?.find(item => item.status === "Collateral Review")?.count || 0)}
										</p>
										<div className="flex items-center mt-2">
											<BanknotesIcon className="h-4 w-4 text-orange-400 mr-1" />
											<span className="text-xs text-gray-400">
												Asset evaluation
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Pending Attestation */}
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 overflow-hidden shadow-lg rounded-xl">
							<div className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-gray-300">
											Pending Attestation
										</p>
										<p className="text-2xl font-bold text-cyan-400">
											{formatNumber(stats.statusBreakdown?.find(item => item.status === "Pending Attestation")?.count || 0)}
										</p>
										<div className="flex items-center mt-2">
											<ClipboardDocumentCheckIcon className="h-4 w-4 text-cyan-400 mr-1" />
											<span className="text-xs text-gray-400">
												Terms attestation
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Pending Signature */}
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 overflow-hidden shadow-lg rounded-xl">
							<div className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-gray-300">
											Pending Signature
										</p>
										<p className="text-2xl font-bold text-purple-400">
											{formatNumber(workflowCounts.PENDING_SIGNATURE || 0)}
										</p>
										<div className="flex items-center mt-2">
											<DocumentTextIcon className="h-4 w-4 text-purple-400 mr-1" />
											<span className="text-xs text-gray-400">
												Awaiting signatures
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Pending Disbursement */}
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 overflow-hidden shadow-lg rounded-xl">
							<div className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-gray-300">
											Pending Disbursement
										</p>
										<p className="text-2xl font-bold text-blue-400">
											{formatNumber(stats.pendingDisbursementCount || 0)}
										</p>
										<div className="flex items-center mt-2">
											<CurrencyDollarIcon className="h-4 w-4 text-blue-400 mr-1" />
											<span className="text-xs text-gray-400">
												Ready to fund
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Total Disbursed */}
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 overflow-hidden shadow-lg rounded-xl">
							<div className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-gray-300">
											Total Disbursed
										</p>
										<p className="text-2xl font-bold text-green-400">
											{formatNumber(stats.disbursedLoans || 0)}
										</p>
										<div className="flex items-center mt-2">
											<CheckCircleIcon className="h-4 w-4 text-green-400 mr-1" />
											<span className="text-xs text-gray-400">
												Successfully funded
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Rejected */}
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 overflow-hidden shadow-lg rounded-xl">
							<div className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-gray-300">
											Rejected
										</p>
										<p className="text-2xl font-bold text-red-400">
											{formatNumber(stats.rejectedApplications || 0)}
										</p>
										<div className="flex items-center mt-2">
											<XCircleIcon className="h-4 w-4 text-red-400 mr-1" />
											<span className="text-xs text-gray-400">
												Declined applications
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			)}

			{/* Global View Toggle - ADMIN only */}
			{userRole === "ADMIN" && (
			<div className="mb-8">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-medium text-white flex items-center">
					<ChartBarIcon className="h-6 w-6 mr-2 text-blue-400" />
						Analytics & Trends
				</h2>
					<div className="flex items-center bg-gray-800/50 rounded-lg p-1 border border-gray-700/50">
						<button
							onClick={() => setViewMode('monthly')}
							className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
								viewMode === 'monthly'
									? 'bg-blue-600 text-white shadow-sm'
									: 'text-gray-300 hover:text-white hover:bg-gray-700/50'
							}`}
						>
							Monthly
						</button>
						<button
							onClick={() => setViewMode('daily')}
							className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
								viewMode === 'daily'
									? 'bg-blue-600 text-white shadow-sm'
									: 'text-gray-300 hover:text-white hover:bg-gray-700/50'
							}`}
						>
							Daily (30d)
						</button>
							</div>
						</div>
					</div>
			)}

			{/* Main Dashboard - ADMIN only */}
			{userRole === "ADMIN" && (
			<div className="grid grid-cols-1 3xl:grid-cols-2 gap-8 3xl:gap-12">
				
				{/* Left Column */}
				<div className="space-y-8">
					{/* 🔹 1. LOAN PORTFOLIO OVERVIEW */}
					<div className="mb-8">
						<h2 className="text-lg font-medium text-white mb-5 flex items-center">
							<BanknotesIcon className="h-6 w-6 mr-2 text-blue-400" />
							Loan Portfolio Overview
						</h2>
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
														{/* Total Value with Interest */}
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
						<div className="p-6">
							<div className="flex items-center justify-between">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-2">
										<p className="text-sm font-medium text-gray-300">
													Total Value with Interest
										</p>
										<div className="group relative">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
											<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
												<div className="text-left">
													<p className="font-semibold mb-1">How it's calculated:</p>
													<p>Sum of outstanding balances from loans with status: Active, Overdue, or Default. Excludes discharged/settled loans.</p>
												</div>
												<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
											</div>
										</div>
									</div>
									<p className="text-3xl font-bold text-purple-400">
												{formatCurrencyCompact(stats.portfolioOverview?.totalValueWithInterest || 0)}
									</p>
									<div className="flex items-center mt-2">
										<span className="text-sm text-purple-400">
													Total outstanding exposure
										</span>
									</div>
								</div>
								<div className="p-3 bg-gray-700/50 rounded-xl">
									<TrendingUpIcon className="h-8 w-8 text-gray-400" />
								</div>
							</div>
						</div>
					</div>

							{/* Accrued Interest */}
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
						<div className="p-6">
							<div className="flex items-center justify-between">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-2">
										<p className="text-sm font-medium text-gray-300">
													Accrued Interest
										</p>
										<div className="group relative">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
											<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
												<div className="text-left">
													<p className="font-semibold mb-1">How it's calculated:</p>
													<p>Sum of unpaid interest from scheduled repayments on Active, Overdue, and Default loans. Uses the interestAmount field.</p>
												</div>
												<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
											</div>
										</div>
									</div>
									<p className="text-3xl font-bold text-amber-400">
												{formatCurrencyCompact(stats.portfolioOverview?.accruedInterest || 0)}
									</p>
									<div className="flex items-center mt-2">
										<span className="text-sm text-amber-400">
													Unpaid scheduled interest
										</span>
									</div>
								</div>
								<div className="p-3 bg-gray-700/50 rounded-xl">
									<ReceiptPercentIcon className="h-8 w-8 text-gray-400" />
								</div>
							</div>
						</div>
					</div>

							{/* Active Loan Book */}
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
						<div className="p-6">
							<div className="flex items-center justify-between">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-2">
										<p className="text-sm font-medium text-gray-300">
													Active Loan Book
										</p>
										<div className="group relative">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
											<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
												<div className="text-left">
													<p className="font-semibold mb-1">How it's calculated:</p>
													<p>Outstanding principal + late fees. Calculated as: <span className="text-green-400">Total Exposure - Accrued Interest</span>. Includes Active, Overdue, Default loans.</p>
												</div>
												<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
											</div>
										</div>
									</div>
											<p className="text-3xl font-bold text-green-400">
												{formatCurrencyCompact(stats.portfolioOverview?.activeLoanBook || 0)}
									</p>
									<div className="flex items-center mt-2">
												<span className="text-sm text-green-400">
													{formatNumber(stats.portfolioOverview?.numberOfActiveLoans || 0)} outstanding loans
										</span>
									</div>
								</div>
								<div className="p-3 bg-gray-700/50 rounded-xl">
									<BanknotesIcon className="h-8 w-8 text-gray-400" />
								</div>
							</div>
						</div>
					</div>

							{/* Average Loan Size */}
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
						<div className="p-6">
							<div className="flex items-center justify-between">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-2">
										<p className="text-sm font-medium text-gray-300">
													Average Loan Size
										</p>
										<div className="group relative">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
											<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
												<div className="text-left">
													<p className="font-semibold mb-1">How it's calculated:</p>
													<p>Average principal amount of all active loans. Calculated as: <span className="text-indigo-400">(Total active loan principal ÷ Number of active loans)</span></p>
												</div>
												<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
											</div>
										</div>
									</div>
											<p className="text-3xl font-bold text-indigo-400">
												{formatCurrencyCompact(stats.portfolioOverview?.averageLoanSize || 0)}
									</p>
									<div className="flex items-center mt-2">
												<span className="text-sm text-indigo-400">
													Based on {formatNumber(stats.portfolioOverview?.numberOfActiveLoans || 0)} loans
										</span>
									</div>
								</div>
								<div className="p-3 bg-gray-700/50 rounded-xl">
											<CreditCardIcon className="h-8 w-8 text-gray-400" />
							</div>
						</div>
					</div>
				</div>
			</div>

						{/* Portfolio Performance Chart */}
						<div className="mt-6">
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-medium text-white">
										{viewMode === 'monthly' ? 'Monthly' : 'Daily'} Portfolio Performance
						</h3>
									<BanknotesIcon className="h-6 w-6 text-green-400" />
					</div>
					<div className="h-80">
						<ResponsiveContainer width="100%" height="100%">
										<AreaChart data={currentData}>
								<defs>
									<linearGradient
													id="colorLoanValue"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="5%"
											stopColor="#10B981"
											stopOpacity={0.8}
										/>
										<stop
											offset="95%"
											stopColor="#10B981"
											stopOpacity={0.1}
										/>
									</linearGradient>
									<linearGradient
													id="colorAccruedInterest"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="5%"
											stopColor="#F59E0B"
											stopOpacity={0.8}
										/>
										<stop
											offset="95%"
											stopColor="#F59E0B"
											stopOpacity={0.1}
										/>
									</linearGradient>
								</defs>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="#374151"
								/>
								<XAxis
												dataKey={viewMode === 'monthly' ? 'month' : 'date'}
									stroke="#9CA3AF"
									fontSize={12}
												tickFormatter={viewMode === 'daily' ? formatChartLabel : undefined}
								/>
								<YAxis stroke="#9CA3AF" fontSize={12} />
								<Tooltip
									contentStyle={{
										backgroundColor: "#1F2937",
										border: "1px solid #374151",
										borderRadius: "8px",
										color: "#F9FAFB",
									}}
												labelFormatter={(value) => {
													if (viewMode === 'daily') {
														const date = new Date(value);
														return date.toLocaleDateString("en-US", {
															month: "short",
															day: "numeric",
															year: "numeric"
														});
													}
													return value;
												}}
												formatter={(value: any, name: any) => [formatCurrencyCompact(value), name]}
								/>
								<Legend wrapperStyle={{ color: "#9CA3AF" }} />
								<Area
									type="monotone"
												dataKey="active_loan_book"
									stroke="#10B981"
									fillOpacity={1}
												fill="url(#colorLoanValue)"
												name="Active Loan Book"
								/>
								<Area
									type="monotone"
												dataKey="accrued_interest"
									stroke="#F59E0B"
									fillOpacity={1}
												fill="url(#colorAccruedInterest)"
												name="Accrued Interest"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</div>
						</div>
					</div>

					{/* 🔹 2. REPAYMENT & PERFORMANCE METRICS */}
					<div className="mb-8">
						<h2 className="text-lg font-medium text-white mb-5 flex items-center">
							<ArrowTrendingUpIcon className="h-6 w-6 mr-2 text-green-400" />
							Repayment & Performance
						</h2>
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
							{/* Total Collections */}
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
								<div className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-2">
												<p className="text-sm font-medium text-gray-300">
													Total Collections
												</p>
												<div className="group relative">
													<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
													<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
														<div className="text-left">
															<p className="font-semibold mb-1">How it's calculated:</p>
															<p>Total amount collected from borrowers since inception, including principal repayments, interest payments, and fees. This represents actual cash received.</p>
														</div>
														<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
													</div>
												</div>
											</div>
											<p className="text-3xl font-bold text-emerald-400">
												{formatCurrencyCompact(stats.portfolioOverview?.totalRepaidAmount || 0)}
											</p>
											<div className="flex items-center mt-2">
												<CurrencyDollarIcon className="h-4 w-4 text-emerald-400 mr-1" />
												<span className="text-xs text-gray-400">
													All time collections
												</span>
						</div>
										</div>
										<div className="p-3 bg-gray-700/50 rounded-xl">
											<BanknotesIcon className="h-8 w-8 text-gray-400" />
										</div>
									</div>
								</div>
							</div>

							{/* Repayment Rate */}
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
								<div className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-2">
												<p className="text-sm font-medium text-gray-300">
													Repayment Rate
												</p>
												<div className="group relative">
													<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
													<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
														<div className="text-left">
															<p className="font-semibold mb-1">How it's calculated:</p>
															<p>Percentage of repayments paid on time (within 3-day grace period). Calculated as: <span className="text-green-400">(On-time payments ÷ Total due payments) × 100</span></p>
														</div>
														<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
													</div>
												</div>
											</div>
											<p className="text-3xl font-bold text-green-400">
												{(stats.repaymentPerformance?.repaymentRate || 0).toFixed(1)}%
											</p>
											<div className="flex items-center mt-2">
												<CheckCircleIcon className="h-4 w-4 text-green-400 mr-1" />
												<span className="text-xs text-gray-400">
													On-time payments
												</span>
						</div>
										</div>
									</div>
								</div>
							</div>

							{/* Delinquency Rate */}
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
								<div className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-2">
												<p className="text-sm font-medium text-gray-300">
													Delinquency Rate
												</p>
												<div className="group relative">
													<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
													<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
														<div className="text-left">
															<p className="font-semibold mb-1">How it's calculated:</p>
															<p>Percentage of outstanding loans that are overdue (past grace period) or defaulted. Calculated as: <span className="text-yellow-400">(Overdue + Default loans ÷ Outstanding loans) × 100</span></p>
														</div>
														<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
													</div>
												</div>
											</div>
											<p className="text-3xl font-bold text-yellow-400">
												{(stats.repaymentPerformance?.delinquencyRate30Days || 0).toFixed(1)}%
											</p>
											<div className="flex items-center mt-2">
												<span className="text-xs text-gray-400">
													Overdue & default loans
												</span>
						</div>
					</div>
					</div>
								</div>
							</div>

							{/* Default Rate */}
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
								<div className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-2">
												<p className="text-sm font-medium text-gray-300">
													Default Rate
												</p>
												<div className="group relative">
													<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
													<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
														<div className="text-left">
															<p className="font-semibold mb-1">How it's calculated:</p>
															<p>Percentage of loans that have been written off as uncollectible. Calculated as: <span className="text-red-400">(Defaulted loans ÷ Total loans issued) × 100</span></p>
														</div>
														<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
													</div>
												</div>
											</div>
											<p className="text-3xl font-bold text-red-400">
												{(stats.repaymentPerformance?.defaultRate || 0).toFixed(1)}%
											</p>
											<div className="flex items-center mt-2">
												<XCircleIcon className="h-4 w-4 text-red-400 mr-1" />
												<span className="text-xs text-gray-400">
													Written off
									</span>
								</div>
										</div>
									</div>
					</div>
				</div>
			</div>

						{/* Repayment Performance Chart */}
						<div className="mt-6">
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-medium text-white">
										{viewMode === 'monthly' ? 'Monthly' : 'Daily'} Repayment Trends
						</h3>
									<ArrowTrendingUpIcon className="h-6 w-6 text-emerald-400" />
					</div>

					<div className="h-80">
						<ResponsiveContainer width="100%" height="100%">
										<BarChart data={currentData}>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="#374151"
								/>
								<XAxis
												dataKey={viewMode === 'monthly' ? 'month' : 'date'}
									stroke="#9CA3AF"
									fontSize={12}
												tickFormatter={viewMode === 'daily' ? formatChartLabel : undefined}
											/>
											<YAxis stroke="#9CA3AF" fontSize={12} />
								<Tooltip
									contentStyle={{
										backgroundColor: "#1F2937",
										border: "1px solid #374151",
										borderRadius: "8px",
										color: "#F9FAFB",
									}}
												labelFormatter={(value) => {
													if (viewMode === 'daily') {
														const date = new Date(value);
														return date.toLocaleDateString("en-US", {
															month: "short",
															day: "numeric",
															year: "numeric"
														});
													}
													return value;
												}}
												formatter={(value: any) => [formatCurrencyCompact(value)]}
											/>
											<Legend wrapperStyle={{ color: "#9CA3AF" }} />
								<Bar
									dataKey="actual_repayments"
									fill="#10B981"
												name="Actual Repayments"
									radius={[4, 4, 0, 0]}
								/>
								<Bar
									dataKey="scheduled_repayments"
												fill="#60A5FA"
												name="Scheduled Repayments"
									radius={[4, 4, 0, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Right Column */}
				<div className="space-y-8">
					{/* 🔹 3. REVENUE & INTEREST METRICS */}
					<div className="mb-8">
						<h2 className="text-lg font-medium text-white mb-5 flex items-center">
							<CurrencyDollarIcon className="h-6 w-6 mr-2 text-emerald-400" />
							Revenue & Interest
						</h2>
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
							{/* Portfolio Yield - MOVED TO FIRST POSITION */}
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
								<div className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-2">
												<p className="text-sm font-medium text-gray-300">
													Portfolio Yield
												</p>
												<div className="group relative">
													<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
													<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
														<div className="text-left">
															<p className="font-semibold mb-1">How it's calculated:</p>
															<p>Actual annualized return based on collections. Calculated as: <span className="text-blue-400">(Total Revenue ÷ Total Principal) × (12 ÷ Portfolio Age) × 100</span></p>
															<p className="mt-1 text-gray-400">Revenue = Interest + Fees + Late Fees collected</p>
														</div>
														<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
													</div>
												</div>
											</div>
											<p className="text-3xl font-bold text-blue-400">
												{(typeof stats.revenueMetrics?.averageInterestRate === 'number' 
													? stats.revenueMetrics.averageInterestRate 
													: 0).toFixed(1)}%
											</p>
											<div className="flex items-center mt-2">
												<span className="text-xs text-gray-400">
													Actual annualized return
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* Total Interest Earned */}
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
								<div className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-2">
												<p className="text-sm font-medium text-gray-300">
													Total Interest Earned
												</p>
												<div className="group relative">
													<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
													<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
														<div className="text-left">
															<p className="font-semibold mb-1">How it's calculated:</p>
															<p>Total cumulative interest collected from all loans since inception. This represents the actual interest revenue received from borrowers.</p>
														</div>
														<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
													</div>
												</div>
											</div>
											<p className="text-3xl font-bold text-emerald-400">
												{formatCurrencyCompact(stats.revenueMetrics?.totalInterestEarned || 0)}
											</p>
											<div className="flex items-center mt-2">
												<span className="text-xs text-gray-400">
													Cumulative revenue
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* Fees Earned */}
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
								<div className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-2">
												<p className="text-sm font-medium text-gray-300">
													Fees Earned
												</p>
												<div className="group relative">
													<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
													<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
														<div className="text-left">
															<p className="font-semibold mb-1">How it's calculated:</p>
															<p>Total upfront fees collected from loan applications, including <span className="text-purple-400">application fees</span>, <span className="text-purple-400">origination fees</span>, and <span className="text-purple-400">legal fees</span>.</p>
														</div>
														<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
													</div>
												</div>
											</div>
											<p className="text-3xl font-bold text-purple-400">
												{formatCurrencyCompact(stats.revenueMetrics?.totalFeesEarned || 0)}
											</p>
											<div className="flex items-center mt-2">
												<span className="text-xs text-gray-400">
													Application, origination & legal
												</span>
											</div>
										</div>
										<div className="p-3 bg-gray-700/50 rounded-xl">
											<DocumentTextIcon className="h-8 w-8 text-gray-400" />
										</div>
									</div>
								</div>
							</div>

							{/* Penalty Fees */}
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
								<div className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-2">
												<p className="text-sm font-medium text-gray-300">
													Penalty Fees
												</p>
												<div className="group relative">
													<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
													<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
														<div className="text-left">
															<p className="font-semibold mb-1">How it's calculated:</p>
															<p>Total late fees collected from borrowers who made payments after the due date (beyond the 3-day grace period). These are penalty charges for overdue payments.</p>
														</div>
														<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
													</div>
												</div>
											</div>
											<p className="text-3xl font-bold text-amber-400">
												{formatCurrencyCompact(stats.revenueMetrics?.penaltyFeesCollected || 0)}
											</p>
											<div className="flex items-center mt-2">
												<span className="text-xs text-gray-400">
													Late payment fees
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Revenue Performance Chart */}
						<div className="mt-6">
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-medium text-white">
										{viewMode === 'monthly' ? 'Monthly' : 'Daily'} Revenue Performance
						</h3>
									<CurrencyDollarIcon className="h-6 w-6 text-emerald-400" />
					</div>

					<div className="h-80">
						<ResponsiveContainer width="100%" height="100%">
										<AreaChart data={currentData}>
								<defs>
									<linearGradient
													id="colorRevenue"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="5%"
														stopColor="#10B981"
											stopOpacity={0.8}
										/>
										<stop
											offset="95%"
														stopColor="#10B981"
											stopOpacity={0.1}
										/>
									</linearGradient>
												<linearGradient
													id="colorFees"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="5%"
														stopColor="#A855F7"
														stopOpacity={0.8}
													/>
													<stop
														offset="95%"
														stopColor="#A855F7"
														stopOpacity={0.1}
													/>
												</linearGradient>

								</defs>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="#374151"
								/>
								<XAxis
												dataKey={viewMode === 'monthly' ? 'month' : 'date'}
									stroke="#9CA3AF"
									fontSize={12}
												tickFormatter={viewMode === 'daily' ? formatChartLabel : undefined}
											/>
											<YAxis stroke="#9CA3AF" fontSize={12} />
								<Tooltip
									contentStyle={{
										backgroundColor: "#1F2937",
										border: "1px solid #374151",
										borderRadius: "8px",
										color: "#F9FAFB",
									}}
												labelFormatter={(value) => {
													if (viewMode === 'daily') {
														const date = new Date(value);
														return date.toLocaleDateString("en-US", {
															month: "short",
															day: "numeric",
															year: "numeric"
														});
													}
													return value;
												}}
												formatter={(value: any) => [formatCurrencyCompact(value)]}
											/>
											<Legend wrapperStyle={{ color: "#9CA3AF" }} />
								{/* Interest Revenue (larger) on bottom, Fees Revenue (smaller) on top */}
											<Area
												type="monotone"
												dataKey="revenue"
												stroke="#10B981"
												fillOpacity={1}
												fill="url(#colorRevenue)"
												name="Interest Revenue"
											/>
											<Area
												type="monotone"
												dataKey="fees_earned"
												stroke="#A855F7"
												fillOpacity={1}
												fill="url(#colorFees)"
												name="Fees Revenue"
											/>
							</AreaChart>
						</ResponsiveContainer>
								</div>
							</div>
					</div>
				</div>

					{/* 🔹 4. OPERATIONAL KPIs */}
					<div className="mb-8">
						<h2 className="text-lg font-medium text-white mb-5 flex items-center">
							<Cog6ToothIcon className="h-6 w-6 mr-2 text-purple-400" />
							Operational Efficiency
						</h2>
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
							{/* Application Approval Ratio */}
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
								<div className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-2">
												<p className="text-sm font-medium text-gray-300">
													Approval Ratio
												</p>
												<div className="group relative">
													<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
													<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
														<div className="text-left">
															<p className="font-semibold mb-1">How it's calculated:</p>
															<p>Percentage of applications that get approved (excluding pending reviews). Calculated as: <span className="text-green-400">(Approved applications ÷ (Approved + Rejected applications)) × 100</span></p>
														</div>
														<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
													</div>
												</div>
											</div>
											<p className="text-3xl font-bold text-green-400">
												{(stats.operationalKPIs?.applicationApprovalRatio || 0).toFixed(1)}%
											</p>
											<div className="flex items-center mt-2">
												<span className="text-xs text-gray-400">
													Application funnel
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* Decision Time */}
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
								<div className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-2">
												<p className="text-sm font-medium text-gray-300">
													Decision Time
												</p>
												<div className="group relative">
													<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
													<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
														<div className="text-left">
															<p className="font-semibold mb-1">How it's calculated:</p>
															<p>Average time from when an application enters <span className="text-blue-400">PENDING_APPROVAL</span> status until it receives a decision (<span className="text-green-400">APPROVED</span>, <span className="text-red-400">REJECTED</span>, or moves to next stage).</p>
														</div>
														<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
													</div>
												</div>
											</div>
											<p className="text-3xl font-bold text-blue-400">
												{stats.operationalKPIs?.loanApprovalTime 
													? stats.operationalKPIs.loanApprovalTime >= 60 
														? `${(stats.operationalKPIs.loanApprovalTime / 60).toFixed(1)}h`
														: `${Math.round(stats.operationalKPIs.loanApprovalTime)}m`
													: '0m'
												}
											</p>
											<div className="flex items-center mt-2">
												<span className="text-xs text-gray-400">
													Avg. time to make a decision
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* Disbursement Time */}
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
								<div className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-2">
												<p className="text-sm font-medium text-gray-300">
													Disbursement Time
												</p>
												<div className="group relative">
													<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
													<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
														<div className="text-left">
															<p className="font-semibold mb-1">How it's calculated:</p>
															<p>Average time from when an application enters <span className="text-orange-400">PENDING_DISBURSEMENT</span> status until the funds are actually disbursed to the borrower's account.</p>
														</div>
														<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
													</div>
												</div>
											</div>
											<p className="text-3xl font-bold text-indigo-400">
												{stats.operationalKPIs?.disbursementTime 
													? stats.operationalKPIs.disbursementTime >= 60 
														? `${(stats.operationalKPIs.disbursementTime / 60).toFixed(1)}h`
														: `${Math.round(stats.operationalKPIs.disbursementTime)}m`
													: '0m'
												}
											</p>
											<div className="flex items-center mt-2">
												<span className="text-xs text-gray-400">
												Avg. time to disburse
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* Total Applications */}
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 shadow-lg rounded-xl">
								<div className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-2">
												<p className="text-sm font-medium text-gray-300">
													Total Applications
												</p>
												<div className="group relative">
													<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
													<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50">
														<div className="text-left">
															<p className="font-semibold mb-1">What this shows:</p>
															<p>Total number of loan applications submitted since inception, regardless of status.</p>
														</div>
														<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
													</div>
												</div>
											</div>
											<p className="text-3xl font-bold text-purple-400">
												{formatNumber(stats.operationalKPIs?.totalApplications || 0)}
											</p>
											<div className="flex items-center mt-2">
												<span className="text-xs text-gray-400">
													All time
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Application Flow Chart */}
						<div className="mt-6">
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-medium text-white">
										{viewMode === 'monthly' ? 'Monthly' : 'Daily'} Application Flow
						</h3>
									<Cog6ToothIcon className="h-6 w-6 text-purple-400" />
					</div>

					<div className="h-80">
						<ResponsiveContainer width="100%" height="100%">
										<AreaChart data={currentData}>
											<defs>
												<linearGradient
													id="colorApplicationsFlow"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="5%"
														stopColor="#3B82F6"
														stopOpacity={0.8}
													/>
													<stop
														offset="95%"
														stopColor="#3B82F6"
														stopOpacity={0.1}
													/>
												</linearGradient>
												<linearGradient
													id="colorApprovalsFlow"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="5%"
														stopColor="#10B981"
														stopOpacity={0.8}
													/>
													<stop
														offset="95%"
														stopColor="#10B981"
														stopOpacity={0.1}
													/>
												</linearGradient>
												<linearGradient
													id="colorDisbursementsFlow"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="5%"
														stopColor="#F59E0B"
														stopOpacity={0.8}
													/>
													<stop
														offset="95%"
														stopColor="#F59E0B"
														stopOpacity={0.1}
													/>
												</linearGradient>
											</defs>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="#374151"
								/>
								<XAxis
												dataKey={viewMode === 'monthly' ? 'month' : 'date'}
									stroke="#9CA3AF"
									fontSize={12}
												tickFormatter={viewMode === 'daily' ? formatChartLabel : undefined}
								/>
								<YAxis stroke="#9CA3AF" fontSize={12} />
								<Tooltip
									contentStyle={{
										backgroundColor: "#1F2937",
										border: "1px solid #374151",
										borderRadius: "8px",
										color: "#F9FAFB",
									}}
												labelFormatter={(value) => {
													if (viewMode === 'daily') {
														const date = new Date(value);
														return date.toLocaleDateString("en-US", {
															month: "short",
															day: "numeric",
															year: "numeric"
														});
													}
													return value;
												}}
								/>
								<Legend wrapperStyle={{ color: "#9CA3AF" }} />
											<Area
									type="monotone"
												dataKey="applications"
									stroke="#3B82F6"
												fillOpacity={1}
												fill="url(#colorApplicationsFlow)"
												name="Applications"
											/>
											<Area
									type="monotone"
												dataKey="approvals"
									stroke="#10B981"
												fillOpacity={1}
												fill="url(#colorApprovalsFlow)"
												name="Approvals"
											/>
											<Area
												type="monotone"
												dataKey="disbursements"
												stroke="#F59E0B"
												fillOpacity={1}
												fill="url(#colorDisbursementsFlow)"
												name="Disbursements"
											/>
										</AreaChart>
									</ResponsiveContainer>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			)}




		</AdminLayout>
	);
}
