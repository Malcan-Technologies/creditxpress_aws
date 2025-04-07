"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
	UserGroupIcon,
	DocumentTextIcon,
	CreditCardIcon,
	CurrencyDollarIcon,
	ArrowTrendingUpIcon,
	ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";
import Cookies from "js-cookie";

interface DashboardStats {
	totalUsers: number;
	totalApplications: number;
	totalLoans: number;
	totalLoanAmount: number;
	approvedApplications: number;
	rejectedApplications: number;
	pendingApplications: number;
	recentApplications: any[];
}

export default function AdminDashboardPage() {
	const [stats, setStats] = useState<DashboardStats>({
		totalUsers: 0,
		totalApplications: 0,
		totalLoans: 0,
		totalLoanAmount: 0,
		approvedApplications: 0,
		rejectedApplications: 0,
		pendingApplications: 0,
		recentApplications: [],
	});
	const [loading, setLoading] = useState(true);
	const [userName, setUserName] = useState("Admin");

	useEffect(() => {
		const fetchDashboardData = async () => {
			try {
				// Get token from localStorage or cookies
				let token = localStorage.getItem("adminToken");
				if (!token) {
					const cookieToken = Cookies.get("adminToken");
					if (cookieToken) {
						token = cookieToken;
					}
				}

				if (!token) {
					return;
				}

				// Fetch user data
				const userResponse = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
						},
					}
				);

				if (userResponse.ok) {
					const userData = await userResponse.json();
					if (userData.fullName) {
						setUserName(userData.fullName);
					}
				}

				// Fetch dashboard stats
				const statsResponse = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/admin/dashboard-stats`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
						},
					}
				);

				if (statsResponse.ok) {
					const data = await statsResponse.json();
					setStats(data);
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
			case "APPROVED":
				return "bg-green-100 text-green-800";
			case "REJECTED":
				return "bg-red-100 text-red-800";
			case "PENDING_APPROVAL":
			case "PENDING_KYC":
			case "PENDING_APP_FEE":
				return "bg-yellow-100 text-yellow-800";
			case "WITHDRAWN":
				return "bg-gray-100 text-gray-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	if (loading) {
		return (
			<AdminLayout userName={userName}>
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
				</div>
			</AdminLayout>
		);
	}

	return (
		<AdminLayout userName={userName}>
			<div className="mb-8">
				<h1 className="text-2xl font-semibold text-gray-900">
					Dashboard
				</h1>
				<p className="mt-1 text-sm text-gray-500">
					Overview of your platform's performance
				</p>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
				<div className="bg-white overflow-hidden shadow rounded-lg">
					<div className="p-5">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<UserGroupIcon
									className="h-6 w-6 text-blue-600"
									aria-hidden="true"
								/>
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 truncate">
										Total Users
									</dt>
									<dd className="flex items-baseline">
										<div className="text-2xl font-semibold text-gray-900">
											{stats.totalUsers}
										</div>
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>

				<div className="bg-white overflow-hidden shadow rounded-lg">
					<div className="p-5">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<DocumentTextIcon
									className="h-6 w-6 text-blue-600"
									aria-hidden="true"
								/>
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 truncate">
										Total Applications
									</dt>
									<dd className="flex items-baseline">
										<div className="text-2xl font-semibold text-gray-900">
											{stats.totalApplications}
										</div>
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>

				<div className="bg-white overflow-hidden shadow rounded-lg">
					<div className="p-5">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<CreditCardIcon
									className="h-6 w-6 text-blue-600"
									aria-hidden="true"
								/>
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 truncate">
										Total Loans
									</dt>
									<dd className="flex items-baseline">
										<div className="text-2xl font-semibold text-gray-900">
											{stats.totalLoans}
										</div>
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>

				<div className="bg-white overflow-hidden shadow rounded-lg">
					<div className="p-5">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<CurrencyDollarIcon
									className="h-6 w-6 text-blue-600"
									aria-hidden="true"
								/>
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 truncate">
										Total Loan Amount
									</dt>
									<dd className="flex items-baseline">
										<div className="text-2xl font-semibold text-gray-900">
											{formatCurrency(
												stats.totalLoanAmount
											)}
										</div>
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Application Status */}
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
				<div className="bg-white overflow-hidden shadow rounded-lg">
					<div className="p-5">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<ArrowTrendingUpIcon
									className="h-6 w-6 text-green-600"
									aria-hidden="true"
								/>
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 truncate">
										Approved Applications
									</dt>
									<dd className="flex items-baseline">
										<div className="text-2xl font-semibold text-gray-900">
											{stats.approvedApplications}
										</div>
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>

				<div className="bg-white overflow-hidden shadow rounded-lg">
					<div className="p-5">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<ArrowTrendingDownIcon
									className="h-6 w-6 text-red-600"
									aria-hidden="true"
								/>
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 truncate">
										Rejected Applications
									</dt>
									<dd className="flex items-baseline">
										<div className="text-2xl font-semibold text-gray-900">
											{stats.rejectedApplications}
										</div>
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>

				<div className="bg-white overflow-hidden shadow rounded-lg">
					<div className="p-5">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<DocumentTextIcon
									className="h-6 w-6 text-yellow-600"
									aria-hidden="true"
								/>
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 truncate">
										Pending Applications
									</dt>
									<dd className="flex items-baseline">
										<div className="text-2xl font-semibold text-gray-900">
											{stats.pendingApplications}
										</div>
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Recent Applications */}
			<div className="bg-white shadow rounded-lg">
				<div className="px-4 py-5 sm:px-6 border-b border-gray-200">
					<h3 className="text-lg leading-6 font-medium text-gray-900">
						Recent Applications
					</h3>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50">
							<tr>
								<th
									scope="col"
									className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Applicant
								</th>
								<th
									scope="col"
									className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Amount
								</th>
								<th
									scope="col"
									className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Date
								</th>
							</tr>
						</thead>
						<tbody className="bg-white divide-y divide-gray-200">
							{stats.recentApplications.length > 0 ? (
								stats.recentApplications.map((application) => (
									<tr key={application.id}>
										<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
											{application.user?.fullName ||
												"Unknown"}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{formatCurrency(
												application.amount || 0
											)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<span
												className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
													application.status
												)}`}
											>
												{application.status.replace(
													/_/g,
													" "
												)}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{formatDate(application.createdAt)}
										</td>
									</tr>
								))
							) : (
								<tr>
									<td
										colSpan={4}
										className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
									>
										No recent applications
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</AdminLayout>
	);
}
