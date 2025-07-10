"use client";

import React from "react";
import { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";
import {
	UserIcon,
	PlusIcon,
	MagnifyingGlassIcon,
	PencilIcon,
	TrashIcon,
	EyeIcon,
	XMarkIcon,
	UserGroupIcon,
	CalendarIcon,
	ClockIcon,
	PhoneIcon,
	EnvelopeIcon,
	IdentificationIcon,
	CreditCardIcon,
	ArrowPathIcon,
	BanknotesIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

interface User {
	id: string;
	fullName: string;
	email: string;
	phoneNumber: string;
	role: string;
	createdAt: string;
	lastLoginAt?: string;
}

interface LoanApplication {
	id: string;
	userId: string;
	status: string;
	amount?: number;
	createdAt: string;
	updatedAt: string;
	product?: {
		name?: string;
	};
}

interface ActiveLoan {
	id: string;
	userId: string;
	principalAmount: number;
	totalAmount: number;
	outstandingBalance: number;
	interestRate: number;
	term: number;
	monthlyPayment: number;
	nextPaymentDue?: string;
	status: string;
	disbursedAt: string;
	createdAt: string;
	application?: {
		id: string;
		purpose?: string;
		product?: {
			name?: string;
		};
	};
}

export default function AdminUsersPage() {
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const router = useRouter();

	// Dialog states
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [viewDialogOpen, setViewDialogOpen] = useState(false);
	const [userLoans, setUserLoans] = useState<LoanApplication[]>([]);
	const [userActiveLoans, setUserActiveLoans] = useState<ActiveLoan[]>([]);
	const [loadingLoans, setLoadingLoans] = useState(false);

	// Form states
	const [editForm, setEditForm] = useState({
		fullName: "",
		email: "",
		phoneNumber: "",
		role: "",
	});
	const [createForm, setCreateForm] = useState({
		fullName: "",
		email: "",
		phoneNumber: "",
		role: "USER",
		password: "",
	});

	// Loading states
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		fetchUsers();
	}, []);

	const fetchUsers = async () => {
		try {
			setLoading(true);
			setError(null);

			// Fetch all users with token refresh
			const users = await fetchWithAdminTokenRefresh<User[]>(
				"/api/admin/users"
			);
			setUsers(users);
		} catch (error) {
			console.error("Error fetching users:", error);
			setError("Failed to load users. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-MY", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	};

	const formatTime = (dateString: string) => {
		return new Date(dateString).toLocaleTimeString("en-MY", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		});
	};

	const filteredUsers = users.filter((user) => {
		const searchTerm = search.toLowerCase();
		return (
			(user.fullName?.toLowerCase() || "").includes(searchTerm) ||
			(user.email?.toLowerCase() || "").includes(searchTerm) ||
			(user.phoneNumber?.toLowerCase() || "").includes(searchTerm) ||
			(user.role?.toLowerCase() || "").includes(searchTerm)
		);
	});

	// Handle edit user
	const handleEditClick = (user: User) => {
		setSelectedUser(user);
		setEditForm({
			fullName: user.fullName,
			email: user.email,
			phoneNumber: user.phoneNumber,
			role: user.role,
		});
		setEditDialogOpen(true);
	};

	const handleEditChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target;
		setEditForm((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleEditSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedUser) return;

		try {
			setIsSubmitting(true);
			setError(null);

			// Update user with token refresh
			const updatedUser = await fetchWithAdminTokenRefresh<User>(
				`/api/admin/users/${selectedUser.id}`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(editForm),
				}
			);

			// Update the local state with the complete updated user data
			setUsers(
				users.map((user) =>
					user.id === selectedUser.id ? updatedUser : user
				)
			);

			setEditDialogOpen(false);
			setSelectedUser(null);
			setSuccess("User updated successfully!");
		} catch (error) {
			console.error("Error updating user:", error);
			setError("Failed to update user. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleEditCancel = () => {
		setEditDialogOpen(false);
		setSelectedUser(null);
	};

	// Handle create user
	const handleCreateClick = () => {
		setCreateForm({
			fullName: "",
			email: "",
			phoneNumber: "",
			role: "USER",
			password: "",
		});
		setCreateDialogOpen(true);
	};

	const handleCreateChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target;
		setCreateForm((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleCreateSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			setIsSubmitting(true);
			setError(null);

			// Validate password length
			if (createForm.password.length < 8) {
				setError("Password must be at least 8 characters long");
				return;
			}

			// Create user with token refresh
			const newUser = await fetchWithAdminTokenRefresh<User>(
				"/api/auth/signup",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						fullName: createForm.fullName,
						email: createForm.email,
						phoneNumber: createForm.phoneNumber,
						password: createForm.password,
						role: createForm.role,
					}),
				}
			);

			setUsers([...users, newUser]);
			setCreateDialogOpen(false);
			setCreateForm({
				fullName: "",
				email: "",
				phoneNumber: "",
				password: "",
				role: "USER",
			});
			setSuccess("User created successfully!");
		} catch (error) {
			console.error("Error creating user:", error);
			setError("Failed to create user. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCreateCancel = () => {
		setCreateDialogOpen(false);
	};

	// Handle delete user
	const handleDeleteClick = (user: User) => {
		setSelectedUser(user);
		setDeleteDialogOpen(true);
	};

	const handleDeleteSubmit = async () => {
		if (!selectedUser) return;

		try {
			setIsSubmitting(true);
			setError(null);

			// Delete user with token refresh
			await fetchWithAdminTokenRefresh<void>(
				`/api/admin/users/${selectedUser.id}`,
				{
					method: "DELETE",
				}
			);

			// Update the local state to remove the deleted user
			setUsers(users.filter((user) => user.id !== selectedUser.id));
			setDeleteDialogOpen(false);
			setSelectedUser(null);
			setSuccess("User deleted successfully!");
		} catch (error) {
			console.error("Error deleting user:", error);
			setError("Failed to delete user. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteCancel = () => {
		setDeleteDialogOpen(false);
		setSelectedUser(null);
	};

	// Handle viewing user details and applications
	const handleViewClick = async (user: User) => {
		setSelectedUser(user);
		setViewDialogOpen(true);
		setLoadingLoans(true);

		try {
			// Fetch all applications
			const applications = await fetchWithAdminTokenRefresh<
				LoanApplication[]
			>("/api/admin/applications");

			// Filter applications for this user
			const userLoans = applications.filter(
				(app) => app.userId === user.id
			);
			setUserLoans(userLoans);

			// Fetch active loans for this user
			try {
				const loansResponse = await fetchWithAdminTokenRefresh<{
					success?: boolean;
					data?: ActiveLoan[];
				}>("/api/admin/loans");

				if (loansResponse.success && loansResponse.data) {
					const userActiveLoans = loansResponse.data.filter(
						(loan) => loan.userId === user.id
					);
					setUserActiveLoans(userActiveLoans);
				} else {
					setUserActiveLoans([]);
				}
			} catch (error) {
				console.error("Error fetching active loans:", error);
				setUserActiveLoans([]);
			}
		} catch (error) {
			console.error("Error fetching user loans:", error);
			setUserLoans([]);
			setUserActiveLoans([]);
		} finally {
			setLoadingLoans(false);
		}
	};

	const handleViewClose = () => {
		setViewDialogOpen(false);
		setSelectedUser(null);
		setUserLoans([]);
		setUserActiveLoans([]);
	};

	const handleViewLoanDetails = (loanId: string, status: string) => {
		// Close dialog
		setViewDialogOpen(false);

		// Determine which page to navigate to based on loan status
		if (status === "APPROVED" || status === "DISBURSED") {
			router.push(`/dashboard/loans?id=${loanId}`);
		} else {
			router.push(`/dashboard/applications?id=${loanId}`);
		}
	};

	// Helper function for loan status colors
	const getStatusColor = (status: string): string => {
		const statusMap: Record<string, string> = {
			INCOMPLETE: "bg-gray-500/20 text-gray-200 border-gray-400/20",
			PENDING_APP_FEE: "bg-blue-500/20 text-blue-200 border-blue-400/20",
			PENDING_KYC:
				"bg-indigo-500/20 text-indigo-200 border-indigo-400/20",
			PENDING_APPROVAL:
				"bg-yellow-500/20 text-yellow-200 border-yellow-400/20",
			APPROVED: "bg-green-500/20 text-green-200 border-green-400/20",
			DISBURSED: "bg-purple-500/20 text-purple-200 border-purple-400/20",
			REJECTED: "bg-red-500/20 text-red-200 border-red-400/20",
			WITHDRAWN: "bg-gray-500/20 text-gray-200 border-gray-400/20",
		};

		return (
			statusMap[status] ||
			"bg-gray-500/20 text-gray-200 border-gray-400/20"
		);
	};

	// Format currency helper function
	const formatCurrency = (amount?: number) => {
		if (!amount) return "N/A";
		return new Intl.NumberFormat("en-MY", {
			style: "currency",
			currency: "MYR",
		}).format(amount);
	};

	if (loading) {
		return (
			<AdminLayout
				title="Users"
				description="Manage and view all users in the system"
			>
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
				</div>
			</AdminLayout>
		);
	}

	return (
		<AdminLayout
			title="Users"
			description="Manage and view all users in the system"
		>
			{/* Success/Error Messages */}
			{success && (
				<div className="mb-6 bg-green-700/30 border border-green-600/30 text-green-300 px-4 py-3 rounded-lg flex items-center justify-between">
					<span>{success}</span>
					<button onClick={() => setSuccess(null)}>
						<XMarkIcon className="h-5 w-5" />
					</button>
				</div>
			)}

			{error && (
				<div className="mb-6 bg-red-700/30 border border-red-600/30 text-red-300 px-4 py-3 rounded-lg flex items-center justify-between">
					<span>{error}</span>
					<button onClick={() => setError(null)}>
						<XMarkIcon className="h-5 w-5" />
					</button>
				</div>
			)}

			{/* Main Content */}
			<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
				{/* Header */}
				<div className="px-6 py-4 border-b border-gray-700/30">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between">
						<div className="flex items-center mb-4 md:mb-0">
							<UserGroupIcon className="h-8 w-8 text-blue-400 mr-3" />
							<div>
								<h2 className="text-xl font-semibold text-white">
									Users Management
								</h2>
								<p className="text-gray-400 text-sm">
									{filteredUsers.length} user
									{filteredUsers.length !== 1 ? "s" : ""}{" "}
									found
								</p>
							</div>
						</div>
						<button
							onClick={handleCreateClick}
							className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
						>
							<PlusIcon className="h-5 w-5 mr-2" />
							Create User
						</button>
					</div>

					{/* Search Bar */}
					<div className="mt-4 relative max-w-md">
						<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
							<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
						</div>
						<input
							type="text"
							placeholder="Search users..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="block w-full pl-10 pr-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
						/>
					</div>
				</div>

				{/* Users Table */}
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-700/30">
						<thead className="bg-gray-800/50">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									User
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Contact
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Role
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Last Login
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Joined
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-700/30">
							{filteredUsers.length > 0 ? (
								filteredUsers.map((user) => (
									<tr
										key={user.id}
										className="hover:bg-gray-800/30 transition-colors"
									>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="flex items-center">
												<div className="flex-shrink-0 h-10 w-10">
													<div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
														<UserIcon className="h-6 w-6 text-gray-400" />
													</div>
												</div>
												<div className="ml-4">
													<div className="text-sm font-medium text-white">
														{user.fullName}
													</div>
													<div className="text-sm text-gray-400">
														ID:{" "}
														{user.id.substring(
															0,
															8
														)}
														...
													</div>
												</div>
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm text-gray-300">
												<div className="flex items-center mb-1">
													<EnvelopeIcon className="h-4 w-4 text-gray-400 mr-2" />
													{user.email}
												</div>
												<div className="flex items-center">
													<PhoneIcon className="h-4 w-4 text-gray-400 mr-2" />
													{user.phoneNumber}
												</div>
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<span
												className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${
													user.role === "ADMIN"
														? "bg-purple-500/20 text-purple-200 border-purple-400/20"
														: "bg-green-500/20 text-green-200 border-green-400/20"
												}`}
											>
												{user.role}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm text-gray-300">
												{user.lastLoginAt ? (
													<div>
														<div className="flex items-center">
															<CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
															{formatDate(
																user.lastLoginAt
															)}
														</div>
														<div className="flex items-center mt-1">
															<ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
															<span className="text-xs text-gray-400">
																{formatTime(
																	user.lastLoginAt
																)}
															</span>
														</div>
													</div>
												) : (
													<span className="text-gray-500 italic">
														Never logged in
													</span>
												)}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="flex items-center text-sm text-gray-300">
												<CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
												{formatDate(user.createdAt)}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											<div className="flex items-center space-x-3">
												<button
													onClick={() =>
														handleViewClick(user)
													}
													className="text-blue-400 hover:text-blue-300 transition-colors"
													title="View Details"
												>
													<EyeIcon className="h-5 w-5" />
												</button>
												<button
													onClick={() =>
														handleEditClick(user)
													}
													className="text-green-400 hover:text-green-300 transition-colors"
													title="Edit User"
												>
													<PencilIcon className="h-5 w-5" />
												</button>
												<button
													onClick={() =>
														handleDeleteClick(user)
													}
													className="text-red-400 hover:text-red-300 transition-colors"
													title="Delete User"
												>
													<TrashIcon className="h-5 w-5" />
												</button>
											</div>
										</td>
									</tr>
								))
							) : (
								<tr>
									<td
										colSpan={6}
										className="px-6 py-12 text-center"
									>
										<UserGroupIcon className="mx-auto h-12 w-12 text-gray-500" />
										<h3 className="mt-2 text-sm font-medium text-gray-300">
											No users found
										</h3>
										<p className="mt-1 text-sm text-gray-500">
											{search
												? "Try adjusting your search criteria"
												: "Get started by creating a new user"}
										</p>
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Edit User Modal */}
			{editDialogOpen && (
				<div className="fixed inset-0 z-50 overflow-y-auto">
					<div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
						<div
							className="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm transition-opacity"
							onClick={handleEditCancel}
						></div>

						<div className="inline-block align-bottom bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-7xl sm:w-full max-h-[90vh] border border-gray-700/30">
							<div className="px-6 py-4 border-b border-gray-700/30">
								<h3 className="text-lg font-medium text-white">
									Edit User
								</h3>
							</div>

							<form
								onSubmit={handleEditSubmit}
								className="px-6 py-4 space-y-4"
							>
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Full Name
									</label>
									<input
										type="text"
										name="fullName"
										value={editForm.fullName}
										onChange={handleEditChange}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										required
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Email
									</label>
									<input
										type="email"
										name="email"
										value={editForm.email}
										onChange={handleEditChange}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										required
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Phone Number
									</label>
									<input
										type="text"
										name="phoneNumber"
										value={editForm.phoneNumber}
										onChange={handleEditChange}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										required
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Role
									</label>
									<select
										name="role"
										value={editForm.role}
										onChange={handleEditChange}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
									>
										<option value="USER">User</option>
										<option value="ADMIN">Admin</option>
									</select>
								</div>

								<div className="flex justify-end space-x-3 pt-4">
									<button
										type="button"
										onClick={handleEditCancel}
										className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
									>
										Cancel
									</button>
									<button
										type="submit"
										disabled={isSubmitting}
										className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors flex items-center"
									>
										{isSubmitting ? (
											<ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
										) : null}
										{isSubmitting
											? "Saving..."
											: "Save Changes"}
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}

			{/* Create User Modal */}
			{createDialogOpen && (
				<div className="fixed inset-0 z-50 overflow-y-auto">
					<div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
						<div
							className="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm transition-opacity"
							onClick={handleCreateCancel}
						></div>

						<div className="inline-block align-bottom bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-700/30">
							<div className="px-6 py-4 border-b border-gray-700/30">
								<h3 className="text-lg font-medium text-white">
									Create New User
								</h3>
							</div>

							<form
								onSubmit={handleCreateSubmit}
								className="px-6 py-4 space-y-4"
							>
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Full Name
									</label>
									<input
										type="text"
										name="fullName"
										value={createForm.fullName}
										onChange={handleCreateChange}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										required
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Email
									</label>
									<input
										type="email"
										name="email"
										value={createForm.email}
										onChange={handleCreateChange}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										required
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Phone Number
									</label>
									<input
										type="text"
										name="phoneNumber"
										value={createForm.phoneNumber}
										onChange={handleCreateChange}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										required
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Password
									</label>
									<input
										type="password"
										name="password"
										value={createForm.password}
										onChange={handleCreateChange}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										required
									/>
									<p className="mt-1 text-sm text-gray-400">
										Password must be at least 8 characters long
									</p>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Role
									</label>
									<select
										name="role"
										value={createForm.role}
										onChange={handleCreateChange}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
									>
										<option value="USER">User</option>
										<option value="ADMIN">Admin</option>
									</select>
								</div>

								<div className="flex justify-end space-x-3 pt-4">
									<button
										type="button"
										onClick={handleCreateCancel}
										className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
									>
										Cancel
									</button>
									<button
										type="submit"
										disabled={isSubmitting}
										className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors flex items-center"
									>
										{isSubmitting ? (
											<ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
										) : null}
										{isSubmitting
											? "Creating..."
											: "Create User"}
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}

			{/* Delete User Modal */}
			{deleteDialogOpen && (
				<div className="fixed inset-0 z-50 overflow-y-auto">
					<div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
						<div
							className="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm transition-opacity"
							onClick={handleDeleteCancel}
						></div>

						<div className="inline-block align-bottom bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-700/30">
							<div className="px-6 py-4 border-b border-gray-700/30">
								<h3 className="text-lg font-medium text-white">
									Delete User
								</h3>
							</div>

							<div className="px-6 py-4">
								<p className="text-gray-300">
									Are you sure you want to delete{" "}
									<span className="font-medium text-white">
										{selectedUser?.fullName}
									</span>
									? This action cannot be undone.
								</p>
							</div>

							<div className="px-6 py-4 flex justify-end space-x-3">
								<button
									onClick={handleDeleteCancel}
									className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={handleDeleteSubmit}
									disabled={isSubmitting}
									className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg transition-colors flex items-center"
								>
									{isSubmitting ? (
										<ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
									) : null}
									{isSubmitting
										? "Deleting..."
										: "Delete User"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* View User Modal */}
			{viewDialogOpen && selectedUser && (
				<div className="fixed inset-0 z-50 overflow-y-auto">
					<div className="flex items-center justify-center min-h-screen p-4">
						<div
							className="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm transition-opacity"
							onClick={handleViewClose}
						></div>

						<div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-7xl max-h-[90vh] border border-gray-700/30">
							<div className="px-6 py-4 border-b border-gray-700/30 flex justify-between items-center">
								<h3 className="text-lg font-medium text-white">
									User Details
								</h3>
								<button
									onClick={handleViewClose}
									className="text-gray-400 hover:text-white transition-colors"
								>
									<XMarkIcon className="h-6 w-6" />
								</button>
							</div>

							<div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
								<div className="space-y-6">
									{/* User Information */}
									<div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
										<h4 className="text-lg font-medium text-white mb-4 flex items-center">
											<IdentificationIcon className="h-6 w-6 text-blue-400 mr-2" />
											User Information
										</h4>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div className="space-y-3">
												<div>
													<p className="text-sm font-medium text-gray-400">
														Name
													</p>
													<p className="text-white">
														{selectedUser.fullName}
													</p>
												</div>
												<div>
													<p className="text-sm font-medium text-gray-400">
														Email
													</p>
													<p className="text-white">
														{selectedUser.email}
													</p>
												</div>
											</div>
											<div className="space-y-3">
												<div>
													<p className="text-sm font-medium text-gray-400">
														Phone
													</p>
													<p className="text-white">
														{
															selectedUser.phoneNumber
														}
													</p>
												</div>
												<div>
													<p className="text-sm font-medium text-gray-400">
														Role
													</p>
													<span
														className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${
															selectedUser.role ===
															"ADMIN"
																? "bg-purple-500/20 text-purple-200 border-purple-400/20"
																: "bg-green-500/20 text-green-200 border-green-400/20"
														}`}
													>
														{selectedUser.role}
													</span>
												</div>
											</div>
										</div>
									</div>

									{/* Loan Applications */}
									<div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
										<h4 className="text-lg font-medium text-white mb-4 flex items-center">
											<CreditCardIcon className="h-6 w-6 text-green-400 mr-2" />
											Loan Applications
											{userLoans.length > 0 && (
												<span className="ml-2 bg-green-500/20 text-green-200 text-xs font-medium px-2 py-1 rounded-full border border-green-400/20">
													{userLoans.length}
												</span>
											)}
										</h4>

										{loadingLoans ? (
											<div className="flex justify-center py-6">
												<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400"></div>
											</div>
										) : userLoans.length > 0 ? (
											<div className="overflow-x-auto">
												<table className="min-w-full divide-y divide-gray-700/30">
													<thead className="bg-gray-800/50">
														<tr>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Application ID
															</th>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Product
															</th>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Amount
															</th>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Status
															</th>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Applied Date
															</th>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Action
															</th>
														</tr>
													</thead>
													<tbody className="divide-y divide-gray-700/30">
														{userLoans.map(
															(loan) => (
																<tr
																	key={
																		loan.id
																	}
																	className="hover:bg-gray-800/30"
																>
																	<td className="px-3 py-2 whitespace-nowrap">
																		<div className="text-sm font-medium text-white">
																			{loan.id.substring(
																				0,
																				8
																			)}
																			...
																		</div>
																	</td>
																	<td className="px-3 py-2 whitespace-nowrap">
																		<div className="text-sm text-gray-300">
																			{loan
																				.product
																				?.name ||
																				"N/A"}
																		</div>
																	</td>
																	<td className="px-3 py-2 whitespace-nowrap">
																		<div className="text-sm text-gray-300">
																			{formatCurrency(
																				loan.amount
																			)}
																		</div>
																	</td>
																	<td className="px-3 py-2 whitespace-nowrap">
																		<span
																			className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
																				loan.status
																			)}`}
																		>
																			{loan.status.replace(
																				/_/g,
																				" "
																			)}
																		</span>
																	</td>
																	<td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">
																		{formatDate(
																			loan.createdAt
																		)}
																	</td>
																	<td className="px-3 py-2 whitespace-nowrap">
																		<button
																			onClick={() =>
																				handleViewLoanDetails(
																					loan.id,
																					loan.status
																				)
																			}
																			className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
																		>
																			View
																			Details
																		</button>
																	</td>
																</tr>
															)
														)}
													</tbody>
												</table>
											</div>
										) : (
											<div className="text-center py-6 text-gray-400">
												<CreditCardIcon className="mx-auto h-12 w-12 text-gray-500 mb-2" />
												<p>
													No loan applications found
													for this user.
												</p>
											</div>
										)}
									</div>

									{/* Active Loans */}
									<div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
										<h4 className="text-lg font-medium text-white mb-4 flex items-center">
											<BanknotesIcon className="h-6 w-6 text-blue-400 mr-2" />
											Active Loans
											{userActiveLoans.length > 0 && (
												<span className="ml-2 bg-blue-500/20 text-blue-200 text-xs font-medium px-2 py-1 rounded-full border border-blue-400/20">
													{userActiveLoans.length}
												</span>
											)}
										</h4>

										{loadingLoans ? (
											<div className="flex justify-center py-6">
												<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400"></div>
											</div>
										) : userActiveLoans.length > 0 ? (
											<div className="overflow-x-auto">
												<table className="min-w-full divide-y divide-gray-700/30">
													<thead className="bg-gray-800/50">
														<tr>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Loan ID
															</th>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Product
															</th>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Principal
															</th>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Outstanding
															</th>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Monthly Payment
															</th>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Next Payment
															</th>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Status
															</th>
															<th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">
																Action
															</th>
														</tr>
													</thead>
													<tbody className="divide-y divide-gray-700/30">
														{userActiveLoans.map(
															(loan) => (
																<tr
																	key={
																		loan.id
																	}
																	className="hover:bg-gray-800/30"
																>
																	<td className="px-3 py-2 whitespace-nowrap">
																		<div className="text-sm font-medium text-white">
																			{loan.id.substring(
																				0,
																				8
																			)}
																			...
																		</div>
																	</td>
																	<td className="px-3 py-2 whitespace-nowrap">
																		<div className="text-sm text-gray-300">
																			{loan
																				.application
																				?.product
																				?.name ||
																				"N/A"}
																		</div>
																	</td>
																	<td className="px-3 py-2 whitespace-nowrap">
																		<div className="text-sm text-gray-300">
																			{formatCurrency(
																				loan.principalAmount
																			)}
																		</div>
																	</td>
																	<td className="px-3 py-2 whitespace-nowrap">
																		<div className="text-sm text-gray-300">
																			{formatCurrency(
																				loan.outstandingBalance
																			)}
																		</div>
																	</td>
																	<td className="px-3 py-2 whitespace-nowrap">
																		<div className="text-sm text-gray-300">
																			{formatCurrency(
																				loan.monthlyPayment
																			)}
																		</div>
																	</td>
																	<td className="px-3 py-2 whitespace-nowrap">
																		<div className="text-sm text-gray-300">
																			{loan.nextPaymentDue
																				? formatDate(
																						loan.nextPaymentDue
																				  )
																				: "N/A"}
																		</div>
																	</td>
																	<td className="px-3 py-2 whitespace-nowrap">
																		<span
																			className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${
																				loan.status ===
																				"ACTIVE"
																					? "bg-green-500/20 text-green-200 border-green-400/20"
																					: getStatusColor(
																							loan.status
																					  )
																			}`}
																		>
																			{
																				loan.status
																			}
																		</span>
																	</td>
																	<td className="px-3 py-2 whitespace-nowrap">
																		<button
																			onClick={() =>
																				handleViewLoanDetails(
																					loan.id,
																					loan.status
																				)
																			}
																			className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
																		>
																			View
																			Details
																		</button>
																	</td>
																</tr>
															)
														)}
													</tbody>
												</table>
											</div>
										) : (
											<div className="text-center py-6 text-gray-400">
												<BanknotesIcon className="mx-auto h-12 w-12 text-gray-500 mb-2" />
												<p>
													No active loans found for
													this user.
												</p>
											</div>
										)}
									</div>

									{/* Account Information */}
									<div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
										<h4 className="text-lg font-medium text-white mb-4 flex items-center">
											<CalendarIcon className="h-6 w-6 text-amber-400 mr-2" />
											Account Information
										</h4>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div>
												<p className="text-sm font-medium text-gray-400">
													Account Created
												</p>
												<p className="text-white">
													{formatDate(
														selectedUser.createdAt
													)}
												</p>
											</div>
											<div>
												<p className="text-sm font-medium text-gray-400">
													Total Applications
												</p>
												<p className="text-white">
													{userLoans.length}
												</p>
											</div>
										</div>
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
