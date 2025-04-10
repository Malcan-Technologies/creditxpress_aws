"use client";

import React from "react";
import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import {
	UserGroupIcon,
	DocumentTextIcon,
	CurrencyDollarIcon,
	BanknotesIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "../../lib/authUtils";

interface DashboardStats {
	totalUsers: number;
	totalApplications: number;
	totalLoans: number;
	totalLoanAmount: number;
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
}

export default function AdminDashboardPage() {
	const [stats, setStats] = useState<DashboardStats>({
		totalUsers: 0,
		totalApplications: 0,
		totalLoans: 0,
		totalLoanAmount: 0,
		recentApplications: [],
	});
	const [loading, setLoading] = useState(true);
	const [userName, setUserName] = useState("Admin");

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
				setStats(data);
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
				return "bg-yellow-100 text-yellow-800";
			case "APPROVED":
				return "bg-green-100 text-green-800";
			case "REJECTED":
				return "bg-red-100 text-red-800";
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
		<AdminLayout
			title="Dashboard"
			description="Overview of your platform's performance"
		>
			{/* Stats Grid */}
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
				<div className="bg-white overflow-hidden shadow rounded-lg">
					<div className="p-5">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<UserGroupIcon
									className="h-6 w-6 text-gray-400"
									aria-hidden="true"
								/>
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 truncate">
										Total Users
									</dt>
									<dd className="text-lg font-medium text-gray-900">
										{stats.totalUsers}
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
									className="h-6 w-6 text-gray-400"
									aria-hidden="true"
								/>
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 truncate">
										Total Applications
									</dt>
									<dd className="text-lg font-medium text-gray-900">
										{stats.totalApplications}
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
									className="h-6 w-6 text-gray-400"
									aria-hidden="true"
								/>
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 truncate">
										Total Loans
									</dt>
									<dd className="text-lg font-medium text-gray-900">
										{stats.totalLoans}
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
								<BanknotesIcon
									className="h-6 w-6 text-gray-400"
									aria-hidden="true"
								/>
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 truncate">
										Total Loan Amount
									</dt>
									<dd className="text-lg font-medium text-gray-900">
										{formatCurrency(stats.totalLoanAmount)}
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Recent Applications */}
			<div className="mt-8">
				<h2 className="text-lg font-medium text-gray-900">
					Recent Applications
				</h2>
				<div className="mt-4 bg-white shadow rounded-lg overflow-hidden">
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
									stats.recentApplications.map(
										(application) => (
											<tr key={application.id}>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="text-sm font-medium text-gray-900">
														{
															application.user
																.fullName
														}
													</div>
													<div className="text-sm text-gray-500">
														{application.user.email}
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<span
														className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
															application.status
														)}`}
													>
														{application.status}
													</span>
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{formatDate(
														application.createdAt
													)}
												</td>
											</tr>
										)
									)
								) : (
									<tr>
										<td
											colSpan={3}
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
			</div>
		</AdminLayout>
	);
}
