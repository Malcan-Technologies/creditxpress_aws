"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import Cookies from "js-cookie";

interface User {
	id: string;
	fullName: string;
	email: string;
	phoneNumber: string;
	role: string;
	isOnboardingComplete: boolean;
	createdAt: string;
}

export default function AdminUsersPage() {
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [userName, setUserName] = useState("Admin");
	const [searchTerm, setSearchTerm] = useState("");

	useEffect(() => {
		const fetchUsers = async () => {
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

				// Fetch all users
				const usersResponse = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
						},
					}
				);

				if (usersResponse.ok) {
					const data = await usersResponse.json();
					setUsers(data);
				}
			} catch (error) {
				console.error("Error fetching users:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchUsers();
	}, []);

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-MY", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	};

	const filteredUsers = users.filter(
		(user) =>
			user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			user.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
	);

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
				<h1 className="text-2xl font-semibold text-gray-900">Users</h1>
				<p className="mt-1 text-sm text-gray-500">
					Manage and view all users in the system
				</p>
			</div>

			{/* Search Bar */}
			<div className="mb-6">
				<div className="relative rounded-md shadow-sm">
					<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<UserGroupIcon
							className="h-5 w-5 text-gray-400"
							aria-hidden="true"
						/>
					</div>
					<input
						type="text"
						className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
						placeholder="Search users by name, email, or phone number"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
			</div>

			{/* Users Table */}
			<div className="bg-white shadow rounded-lg overflow-hidden">
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50">
							<tr>
								<th
									scope="col"
									className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Name
								</th>
								<th
									scope="col"
									className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Contact
								</th>
								<th
									scope="col"
									className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Role
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
									Joined
								</th>
							</tr>
						</thead>
						<tbody className="bg-white divide-y divide-gray-200">
							{filteredUsers.length > 0 ? (
								filteredUsers.map((user) => (
									<tr key={user.id}>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm font-medium text-gray-900">
												{user.fullName ||
													"Unnamed User"}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm text-gray-900">
												{user.email || "No email"}
											</div>
											<div className="text-sm text-gray-500">
												{user.phoneNumber || "No phone"}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<span
												className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
													user.role === "ADMIN"
														? "bg-purple-100 text-purple-800"
														: "bg-blue-100 text-blue-800"
												}`}
											>
												{user.role}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<span
												className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
													user.isOnboardingComplete
														? "bg-green-100 text-green-800"
														: "bg-yellow-100 text-yellow-800"
												}`}
											>
												{user.isOnboardingComplete
													? "Complete"
													: "Incomplete"}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{formatDate(user.createdAt)}
										</td>
									</tr>
								))
							) : (
								<tr>
									<td
										colSpan={5}
										className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
									>
										No users found
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
