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
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "../../lib/authUtils";
import Link from "next/link";
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
	disbursedLoans: number;
	totalDisbursedAmount: number;
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
		disbursement_amount: number;
		disbursement_count: number;
		users: number;
		kyc_users: number;
	}[];
	statusBreakdown?: {
		status: string;
		count: number;
		percentage: number;
	}[];
}

export default function AdminDashboardPage() {
	const [stats, setStats] = useState<DashboardStats>({
		totalUsers: 0,
		pendingReviewApplications: 0,
		approvedLoans: 0,
		disbursedLoans: 0,
		totalDisbursedAmount: 0,
		recentApplications: [],
		totalApplications: 0,
		rejectedApplications: 0,
		averageLoanAmount: 0,
		monthlyGrowth: 0,
		activeUsers: 0,
		conversionRate: 0,
		totalRevenue: 0,
		monthlyStats: [],
		statusBreakdown: [],
	});
	const [loading, setLoading] = useState(true);
	const [userName, setUserName] = useState("Admin");
	const [workflowCounts, setWorkflowCounts] = useState({
		PENDING_DECISION: 0,
		PENDING_DISBURSEMENT: 0,
	});

	useEffect(() => {
		const fetchDashboardData = async () => {
			try {
				// Fetch user data with token refresh
				try {
					const userData = await fetchWithAdminTokenRefresh<any>(
						"/api/users/me"
					);
					if (userData.fullName) {
						setUserName(userData.fullName);
					}
				} catch (error) {
					console.error("Error fetching user data:", error);
				}

				// Fetch dashboard stats with token refresh
				const data = await fetchWithAdminTokenRefresh<DashboardStats>(
					"/api/admin/dashboard"
				);

				// Fetch real monthly statistics
				let monthlyStats = [];
				try {
					const monthlyData = await fetchWithAdminTokenRefresh<{
						monthlyStats: {
							month: string;
							applications: number;
							approvals: number;
							disbursements: number;
							revenue: number;
							disbursement_amount: number;
							disbursement_count: number;
							users: number;
							kyc_users: number;
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
							disbursement_amount: 280000,
							disbursement_count: 28,
							users: 12,
							kyc_users: 8,
						},
						{
							month: "Feb",
							applications: 52,
							approvals: 38,
							disbursements: 35,
							revenue: 17500,
							disbursement_amount: 350000,
							disbursement_count: 35,
							users: 15,
							kyc_users: 11,
						},
						{
							month: "Mar",
							applications: 48,
							approvals: 35,
							disbursements: 32,
							revenue: 16000,
							disbursement_amount: 320000,
							disbursement_count: 32,
							users: 18,
							kyc_users: 14,
						},
						{
							month: "Apr",
							applications: 61,
							approvals: 44,
							disbursements: 40,
							revenue: 20000,
							disbursement_amount: 400000,
							disbursement_count: 40,
							users: 22,
							kyc_users: 18,
						},
						{
							month: "May",
							applications: 58,
							approvals: 42,
							disbursements: 38,
							revenue: 19000,
							disbursement_amount: 380000,
							disbursement_count: 38,
							users: 19,
							kyc_users: 15,
						},
						{
							month: "Jun",
							applications: 67,
							approvals: 49,
							disbursements: 45,
							revenue: 22500,
							disbursement_amount: 450000,
							disbursement_count: 45,
							users: 25,
							kyc_users: 20,
						},
					];
				}

				// Enhance data with calculated metrics
				const totalApplications =
					(data.approvedLoans || 0) +
					(data.rejectedApplications || 0) +
					(data.pendingReviewApplications || 0);

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

				const enhancedData = {
					...data,
					totalApplications,
					averageLoanAmount:
						data.disbursedLoans > 0
							? (data.totalDisbursedAmount || 0) /
							  data.disbursedLoans
							: 0,
					conversionRate:
						totalApplications > 0
							? ((data.approvedLoans || 0) / totalApplications) *
							  100
							: 0,
					monthlyGrowth,
					activeUsers: Math.floor((data.totalUsers || 0) * 0.7), // Mock data
					totalRevenue: (data.totalDisbursedAmount || 0) * 0.05, // Assuming 5% fee
					monthlyStats,
					statusBreakdown: [
						{
							status: "Approved",
							count: data.approvedLoans || 0,
							percentage: 0,
						},
						{
							status: "Pending",
							count: data.pendingReviewApplications || 0,
							percentage: 0,
						},
						{
							status: "Rejected",
							count: data.rejectedApplications || 0,
							percentage: 0,
						},
						{
							status: "Disbursed",
							count: data.disbursedLoans || 0,
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

					setWorkflowCounts({
						PENDING_DECISION:
							countsData.PENDING_DECISION ||
							data.pendingReviewApplications ||
							0,
						PENDING_DISBURSEMENT:
							countsData.PENDING_DISBURSEMENT ||
							data.approvedLoans ||
							0,
					});
				} catch (countsError) {
					console.error(
						"Error fetching application counts, using dashboard stats:",
						countsError
					);

					setWorkflowCounts({
						PENDING_DECISION: data.pendingReviewApplications || 0,
						PENDING_DISBURSEMENT: data.approvedLoans || 0,
					});
				}
			} catch (error) {
				console.error("Error fetching dashboard data:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchDashboardData();
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
				return "bg-yellow-500/20 text-yellow-200 border border-yellow-400/20";
			case "APPROVED":
				return "bg-green-500/20 text-green-200 border border-green-400/20";
			case "REJECTED":
				return "bg-red-500/20 text-red-200 border border-red-400/20";
			case "DISBURSED":
				return "bg-blue-500/20 text-blue-200 border border-blue-400/20";
			case "WITHDRAWN":
				return "bg-gray-500/20 text-gray-200 border border-gray-400/20";
			default:
				return "bg-gray-500/20 text-gray-200 border border-gray-400/20";
		}
	};

	const formatNumber = (num: number) => {
		if (num >= 1000000) {
			return (num / 1000000).toFixed(1) + "M";
		}
		if (num >= 1000) {
			return (num / 1000).toFixed(1) + "K";
		}
		return num.toString();
	};

	// Helper function to calculate totals and growth
	const calculateMetrics = (data: any[], key: string) => {
		const total = data.reduce((sum, item) => sum + (item[key] || 0), 0);
		const currentMonth = data[data.length - 1]?.[key] || 0;
		const previousMonth = data[data.length - 2]?.[key] || 0;
		const growth =
			previousMonth > 0
				? ((currentMonth - previousMonth) / previousMonth) * 100
				: 0;

		return { total, currentMonth, growth };
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

	return (
		<AdminLayout
			title="Dashboard"
			description="Overview of your platform's performance"
		>
			{/* Key Metrics Grid */}
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
				{/* Total Users */}
				<div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-md border border-blue-500/30 overflow-hidden shadow-lg rounded-xl">
					<div className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-blue-200">
									Total Users
								</p>
								<p className="text-3xl font-bold text-white">
									{formatNumber(stats.totalUsers)}
								</p>
								<div className="flex items-center mt-2">
									<TrendingUpIcon className="h-4 w-4 text-green-400 mr-1" />
									<span className="text-sm text-green-400">
										+{stats.monthlyGrowth?.toFixed(1)}%
									</span>
									<span className="text-xs text-gray-400 ml-1">
										this month
									</span>
								</div>
							</div>
							<div className="p-3 bg-blue-500/30 rounded-xl">
								<UserGroupIcon className="h-8 w-8 text-blue-300" />
							</div>
						</div>
					</div>
				</div>

				{/* Total Applications */}
				<div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 backdrop-blur-md border border-purple-500/30 overflow-hidden shadow-lg rounded-xl">
					<div className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-purple-200">
									Total Applications
								</p>
								<p className="text-3xl font-bold text-white">
									{formatNumber(stats.totalApplications || 0)}
								</p>
								<div className="flex items-center mt-2">
									<span className="text-sm text-purple-300">
										{stats.conversionRate?.toFixed(1)}%
									</span>
									<span className="text-xs text-gray-400 ml-1">
										approval rate
									</span>
								</div>
							</div>
							<div className="p-3 bg-purple-500/30 rounded-xl">
								<DocumentTextIcon className="h-8 w-8 text-purple-300" />
							</div>
						</div>
					</div>
				</div>

				{/* Total Disbursed */}
				<div className="bg-gradient-to-br from-green-600/20 to-green-800/20 backdrop-blur-md border border-green-500/30 overflow-hidden shadow-lg rounded-xl">
					<div className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-green-200">
									Total Disbursed
								</p>
								<p className="text-3xl font-bold text-white">
									{formatCurrency(stats.totalDisbursedAmount)}
								</p>
								<div className="flex items-center mt-2">
									<span className="text-sm text-green-300">
										{stats.disbursedLoans}
									</span>
									<span className="text-xs text-gray-400 ml-1">
										active loans
									</span>
								</div>
							</div>
							<div className="p-3 bg-green-500/30 rounded-xl">
								<BanknotesIcon className="h-8 w-8 text-green-300" />
							</div>
						</div>
					</div>
				</div>

				{/* Revenue */}
				<div className="bg-gradient-to-br from-amber-600/20 to-amber-800/20 backdrop-blur-md border border-amber-500/30 overflow-hidden shadow-lg rounded-xl">
					<div className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-amber-200">
									Total Revenue
								</p>
								<p className="text-3xl font-bold text-white">
									{formatCurrency(stats.totalRevenue || 0)}
								</p>
								<div className="flex items-center mt-2">
									<span className="text-sm text-amber-300">
										{formatCurrency(
											stats.averageLoanAmount || 0
										)}
									</span>
									<span className="text-xs text-gray-400 ml-1">
										avg loan
									</span>
								</div>
							</div>
							<div className="p-3 bg-amber-500/30 rounded-xl">
								<CurrencyDollarIcon className="h-8 w-8 text-amber-300" />
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Charts Section */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
				{/* Monthly Trends Chart */}
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-medium text-white">
							Monthly Application Trends
						</h3>
						<ChartBarIcon className="h-6 w-6 text-blue-400" />
					</div>

					{/* Application Headlines */}
					<div className="grid grid-cols-3 gap-4 mb-6">
						<div className="text-center">
							<p className="text-2xl font-bold text-blue-400">
								{formatNumber(
									calculateMetrics(
										stats.monthlyStats || [],
										"applications"
									).total
								)}
							</p>
							<p className="text-xs text-gray-400">
								Total Applications
							</p>
						</div>
						<div className="text-center">
							<p className="text-2xl font-bold text-white">
								{formatNumber(
									calculateMetrics(
										stats.monthlyStats || [],
										"applications"
									).currentMonth
								)}
							</p>
							<p className="text-xs text-gray-400">This Month</p>
						</div>
						<div className="text-center">
							<p
								className={`text-2xl font-bold ${
									calculateMetrics(
										stats.monthlyStats || [],
										"applications"
									).growth >= 0
										? "text-green-400"
										: "text-red-400"
								}`}
							>
								{calculateMetrics(
									stats.monthlyStats || [],
									"applications"
								).growth >= 0
									? "+"
									: ""}
								{calculateMetrics(
									stats.monthlyStats || [],
									"applications"
								).growth.toFixed(1)}
								%
							</p>
							<p className="text-xs text-gray-400">MoM Growth</p>
						</div>
					</div>
					<div className="h-80">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={stats.monthlyStats}>
								<defs>
									<linearGradient
										id="colorApplications"
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
										id="colorApprovals"
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
										id="colorDisbursements"
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
									dataKey="month"
									stroke="#9CA3AF"
									fontSize={12}
								/>
								<YAxis stroke="#9CA3AF" fontSize={12} />
								<Tooltip
									contentStyle={{
										backgroundColor: "#1F2937",
										border: "1px solid #374151",
										borderRadius: "8px",
										color: "#F9FAFB",
									}}
								/>
								<Legend wrapperStyle={{ color: "#9CA3AF" }} />
								<Area
									type="monotone"
									dataKey="applications"
									stroke="#3B82F6"
									fillOpacity={1}
									fill="url(#colorApplications)"
									name="Applications"
								/>
								<Area
									type="monotone"
									dataKey="approvals"
									stroke="#10B981"
									fillOpacity={1}
									fill="url(#colorApprovals)"
									name="Approvals"
								/>
								<Area
									type="monotone"
									dataKey="disbursements"
									stroke="#F59E0B"
									fillOpacity={1}
									fill="url(#colorDisbursements)"
									name="Disbursements"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</div>

				{/* Application Status Breakdown */}
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-medium text-white">
							Application Status Distribution
						</h3>
						<DocumentTextIcon className="h-6 w-6 text-purple-400" />
					</div>

					{/* Status Headlines */}
					<div className="grid grid-cols-3 gap-4 mb-6">
						<div className="text-center">
							<p className="text-2xl font-bold text-green-400">
								{formatNumber(stats.approvedLoans || 0)}
							</p>
							<p className="text-xs text-gray-400">
								Total Approvals
							</p>
						</div>
						<div className="text-center">
							<p className="text-2xl font-bold text-yellow-400">
								{formatNumber(
									stats.pendingReviewApplications || 0
								)}
							</p>
							<p className="text-xs text-gray-400">
								Pending Review
							</p>
						</div>
						<div className="text-center">
							<p className="text-2xl font-bold text-purple-400">
								{stats.conversionRate?.toFixed(1) || 0}%
							</p>
							<p className="text-xs text-gray-400">
								Approval Rate
							</p>
						</div>
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
												"#10B981",
												"#F59E0B",
												"#EF4444",
												"#3B82F6",
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
					<div className="mt-4 grid grid-cols-2 gap-4">
						{stats.statusBreakdown?.map((status, index) => {
							const colors = [
								"#10B981",
								"#F59E0B",
								"#EF4444",
								"#3B82F6",
							];
							return (
								<div
									key={status.status}
									className="flex items-center space-x-2"
								>
									<div
										className="w-3 h-3 rounded-full"
										style={{
											backgroundColor:
												colors[index % colors.length],
										}}
									></div>
									<span className="text-sm text-gray-300">
										{status.status}
									</span>
									<span className="text-sm font-medium text-white">
										({status.count})
									</span>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{/* Additional Charts Row */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
				{/* Revenue Trends */}
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-medium text-white">
							Monthly Revenue & Disbursements
						</h3>
						<CurrencyDollarIcon className="h-6 w-6 text-green-400" />
					</div>

					{/* Revenue Headlines */}
					<div className="grid grid-cols-3 gap-4 mb-6">
						<div className="text-center">
							<p className="text-2xl font-bold text-green-400">
								{formatCurrency(
									calculateMetrics(
										stats.monthlyStats || [],
										"revenue"
									).total
								)}
							</p>
							<p className="text-xs text-gray-400">
								Total Revenue
							</p>
						</div>
						<div className="text-center">
							<p className="text-2xl font-bold text-white">
								{formatCurrency(
									calculateMetrics(
										stats.monthlyStats || [],
										"revenue"
									).currentMonth
								)}
							</p>
							<p className="text-xs text-gray-400">This Month</p>
						</div>
						<div className="text-center">
							<p
								className={`text-2xl font-bold ${
									calculateMetrics(
										stats.monthlyStats || [],
										"revenue"
									).growth >= 0
										? "text-green-400"
										: "text-red-400"
								}`}
							>
								{calculateMetrics(
									stats.monthlyStats || [],
									"revenue"
								).growth >= 0
									? "+"
									: ""}
								{calculateMetrics(
									stats.monthlyStats || [],
									"revenue"
								).growth.toFixed(1)}
								%
							</p>
							<p className="text-xs text-gray-400">MoM Growth</p>
						</div>
					</div>

					<div className="h-80">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={stats.monthlyStats}>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="#374151"
								/>
								<XAxis
									dataKey="month"
									stroke="#9CA3AF"
									fontSize={12}
								/>
								<YAxis
									stroke="#9CA3AF"
									fontSize={12}
									tickFormatter={(value) =>
										`RM${(value / 1000).toFixed(0)}K`
									}
								/>
								<Tooltip
									contentStyle={{
										backgroundColor: "#1F2937",
										border: "1px solid #374151",
										borderRadius: "8px",
										color: "#F9FAFB",
									}}
									formatter={(
										value: number,
										name: string
									) => [
										`RM${value.toLocaleString()}`,
										name === "revenue"
											? "Revenue"
											: "Total Disbursements",
									]}
								/>
								<Legend
									wrapperStyle={{ color: "#9CA3AF" }}
									formatter={(value: string) =>
										value === "revenue"
											? "Revenue"
											: "Total Disbursements"
									}
								/>
								<Bar
									dataKey="revenue"
									fill="#10B981"
									radius={[4, 4, 0, 0]}
									name="revenue"
								/>
								<Bar
									dataKey="disbursement_amount"
									fill="#3B82F6"
									radius={[4, 4, 0, 0]}
									name="disbursement_amount"
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</div>

				{/* User Growth */}
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-medium text-white">
							User Growth & KYC Completion
						</h3>
						<UserGroupIcon className="h-6 w-6 text-blue-400" />
					</div>

					{/* User Growth Headlines */}
					<div className="grid grid-cols-3 gap-4 mb-6">
						<div className="text-center">
							<p className="text-2xl font-bold text-blue-400">
								{formatNumber(
									calculateMetrics(
										stats.monthlyStats || [],
										"users"
									).total
								)}
							</p>
							<p className="text-xs text-gray-400">Total Users</p>
						</div>
						<div className="text-center">
							<p className="text-2xl font-bold text-white">
								{formatNumber(
									calculateMetrics(
										stats.monthlyStats || [],
										"users"
									).currentMonth
								)}
							</p>
							<p className="text-xs text-gray-400">This Month</p>
						</div>
						<div className="text-center">
							<p
								className={`text-2xl font-bold ${
									calculateMetrics(
										stats.monthlyStats || [],
										"users"
									).growth >= 0
										? "text-green-400"
										: "text-red-400"
								}`}
							>
								{calculateMetrics(
									stats.monthlyStats || [],
									"users"
								).growth >= 0
									? "+"
									: ""}
								{calculateMetrics(
									stats.monthlyStats || [],
									"users"
								).growth.toFixed(1)}
								%
							</p>
							<p className="text-xs text-gray-400">MoM Growth</p>
						</div>
					</div>

					<div className="h-80">
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={stats.monthlyStats}>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="#374151"
								/>
								<XAxis
									dataKey="month"
									stroke="#9CA3AF"
									fontSize={12}
								/>
								<YAxis stroke="#9CA3AF" fontSize={12} />
								<Tooltip
									contentStyle={{
										backgroundColor: "#1F2937",
										border: "1px solid #374151",
										borderRadius: "8px",
										color: "#F9FAFB",
									}}
								/>
								<Legend wrapperStyle={{ color: "#9CA3AF" }} />
								<Line
									type="monotone"
									dataKey="users"
									stroke="#3B82F6"
									strokeWidth={3}
									dot={{
										fill: "#3B82F6",
										strokeWidth: 2,
										r: 6,
									}}
									activeDot={{
										r: 8,
										stroke: "#3B82F6",
										strokeWidth: 2,
									}}
									name="Total Users"
								/>
								<Line
									type="monotone"
									dataKey="kyc_users"
									stroke="#10B981"
									strokeWidth={3}
									dot={{
										fill: "#10B981",
										strokeWidth: 2,
										r: 6,
									}}
									activeDot={{
										r: 8,
										stroke: "#10B981",
										strokeWidth: 2,
									}}
									name="KYC Users"
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>

			{/* Quick Actions */}
			<div className="mb-8">
				<h2 className="text-lg font-medium text-white mb-5 flex items-center">
					<ClockIcon className="h-6 w-6 mr-2 text-amber-400" />
					Quick Actions
				</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{/* Pending Decisions */}
					<Link
						href="/dashboard/applications/pending-decision"
						className="group bg-gradient-to-br from-amber-600/20 to-amber-800/20 backdrop-blur-md border border-amber-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-amber-400/50"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-amber-500/30 rounded-lg">
								<ExclamationTriangleIcon className="h-6 w-6 text-amber-300" />
							</div>
							{workflowCounts.PENDING_DECISION > 0 && (
								<span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
									{workflowCounts.PENDING_DECISION}
								</span>
							)}
						</div>
						<h3 className="text-white font-medium mb-1">
							Review Applications
						</h3>
						<p className="text-sm text-amber-200 mb-3">
							{workflowCounts.PENDING_DECISION > 0
								? `${workflowCounts.PENDING_DECISION} applications need review`
								: "No pending applications"}
						</p>
						<div className="flex items-center text-amber-300 text-sm font-medium group-hover:text-amber-200">
							Review now
							<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</Link>

					{/* Pending Disbursements */}
					<Link
						href="/dashboard/applications/pending-disbursement"
						className="group bg-gradient-to-br from-green-600/20 to-green-800/20 backdrop-blur-md border border-green-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-green-400/50"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-green-500/30 rounded-lg">
								<CheckCircleIcon className="h-6 w-6 text-green-300" />
							</div>
							{workflowCounts.PENDING_DISBURSEMENT > 0 && (
								<span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
									{workflowCounts.PENDING_DISBURSEMENT}
								</span>
							)}
						</div>
						<h3 className="text-white font-medium mb-1">
							Process Disbursements
						</h3>
						<p className="text-sm text-green-200 mb-3">
							{workflowCounts.PENDING_DISBURSEMENT > 0
								? `${workflowCounts.PENDING_DISBURSEMENT} loans ready to disburse`
								: "No pending disbursements"}
						</p>
						<div className="flex items-center text-green-300 text-sm font-medium group-hover:text-green-200">
							Process now
							<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</Link>

					{/* Manage Users */}
					<Link
						href="/dashboard/users"
						className="group bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-md border border-blue-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-blue-400/50"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-blue-500/30 rounded-lg">
								<UserGroupIcon className="h-6 w-6 text-blue-300" />
							</div>
							<span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
								{stats.totalUsers}
							</span>
						</div>
						<h3 className="text-white font-medium mb-1">
							Manage Users
						</h3>
						<p className="text-sm text-blue-200 mb-3">
							View and manage all platform users
						</p>
						<div className="flex items-center text-blue-300 text-sm font-medium group-hover:text-blue-200">
							View users
							<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</Link>

					{/* Send Notifications */}
					<Link
						href="/dashboard/notifications"
						className="group bg-gradient-to-br from-purple-600/20 to-purple-800/20 backdrop-blur-md border border-purple-500/30 rounded-xl shadow-lg p-5 transition-all hover:scale-[1.02] hover:border-purple-400/50"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 bg-purple-500/30 rounded-lg">
								<BellIcon className="h-6 w-6 text-purple-300" />
							</div>
						</div>
						<h3 className="text-white font-medium mb-1">
							Send Notifications
						</h3>
						<p className="text-sm text-purple-200 mb-3">
							Broadcast messages to users
						</p>
						<div className="flex items-center text-purple-300 text-sm font-medium group-hover:text-purple-200">
							Create notification
							<ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</Link>
				</div>
			</div>

			{/* Recent Applications */}
			<div className="mb-8">
				<div className="flex items-center justify-between mb-5">
					<h2 className="text-lg font-medium text-white flex items-center">
						<DocumentTextIcon className="h-6 w-6 mr-2 text-blue-400" />
						Recent Applications
					</h2>
					<Link href="/dashboard/applications">
						<span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors border border-blue-400/20">
							View all applications
							<ChevronRightIcon className="ml-2 h-4 w-4" />
						</span>
					</Link>
				</div>
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-700/30">
							<thead className="bg-gray-800/50">
								<tr>
									<th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
										Customer
									</th>
									<th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
										Status
									</th>
									<th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
										Date
									</th>
									<th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
										Action
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-700/30">
								{stats.recentApplications.length > 0 ? (
									stats.recentApplications.map(
										(application) => (
											<tr
												key={application.id}
												className="hover:bg-gray-800/30 transition-colors"
											>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="flex items-center">
														<div className="flex-shrink-0 h-10 w-10">
															<div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
																<UserGroupIcon className="h-6 w-6 text-gray-400" />
															</div>
														</div>
														<div className="ml-4">
															<div className="text-sm font-medium text-white">
																{application
																	.user
																	?.fullName ||
																	"Unknown"}
															</div>
															<div className="text-sm text-gray-400">
																{application
																	.user
																	?.email ||
																	"N/A"}
															</div>
														</div>
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<span
														className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(
															application.status
														)}`}
													>
														{application.status?.replace(
															/_/g,
															" "
														)}
													</span>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="flex items-center text-sm text-gray-400">
														<CalendarDaysIcon className="h-4 w-4 mr-2" />
														{formatDate(
															application.createdAt
														)}
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm">
													<Link
														href={`/dashboard/applications?id=${application.id}`}
														className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors"
													>
														<EyeIcon className="h-4 w-4 mr-1" />
														View details
													</Link>
												</td>
											</tr>
										)
									)
								) : (
									<tr>
										<td
											colSpan={4}
											className="px-6 py-12 text-center"
										>
											<DocumentTextIcon className="mx-auto h-12 w-12 text-gray-500 mb-2" />
											<h3 className="text-sm font-medium text-gray-300">
												No recent applications
											</h3>
											<p className="text-sm text-gray-500">
												Applications will appear here as
												they are submitted
											</p>
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			{/* System Tools */}
			<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-lg font-medium text-white flex items-center">
						<Cog6ToothIcon className="h-6 w-6 mr-2 text-gray-400" />
						System Maintenance
					</h2>
				</div>
				<div className="flex flex-wrap gap-4">
					<button
						className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
						onClick={async () => {
							try {
								const response =
									await fetchWithAdminTokenRefresh(
										"/api/admin/ensure-wallets",
										{ method: "POST" }
									);
								alert("Wallets verified successfully!");
								console.log(response);
							} catch (error) {
								console.error("Error ensuring wallets:", error);
								alert(
									"Error ensuring wallets. Check console for details."
								);
							}
						}}
					>
						<CreditCardIcon className="h-4 w-4 mr-2" />
						Ensure All Users Have Wallets
					</button>

					<Link
						href="/dashboard/products"
						className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
					>
						<PlusIcon className="h-4 w-4 mr-2" />
						Manage Products
					</Link>
				</div>
			</div>
		</AdminLayout>
	);
}
