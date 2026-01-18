"use client";

import React from "react";
import { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";
import { toast } from "sonner";
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
	HomeIcon,
	BriefcaseIcon,
	ShieldCheckIcon,
	BuildingOfficeIcon,
	CurrencyDollarIcon,
	AcademicCapIcon,
	MapPinIcon,
	CheckCircleIcon,
	ExclamationCircleIcon,
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
	icNumber?: string;
	icType?: string;
	kycStatus?: boolean;
	isOnboardingComplete?: boolean;
	city?: string;
	state?: string;
}

interface UserDetails extends User {
	updatedAt?: string;
	dateOfBirth?: string;
	address1?: string;
	address2?: string;
	zipCode?: string;
	country?: string;
	employmentStatus?: string;
	employerName?: string;
	monthlyIncome?: string;
	serviceLength?: string;
	occupation?: string;
	bankName?: string;
	accountNumber?: string;
	onboardingStep?: number;
	phoneVerified?: boolean;
	idNumber?: string;
	idType?: string;
	nationality?: string;
	race?: string;
	gender?: string;
	educationLevel?: string;
	emergencyContactName?: string;
	emergencyContactPhone?: string;
	emergencyContactRelationship?: string;
}

export default function AdminUsersPage() {
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [roleFilter, setRoleFilter] = useState<string>("all");
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();

	// Dialog states
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [viewDialogOpen, setViewDialogOpen] = useState(false);
	const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
	const [loadingDetails, setLoadingDetails] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

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

	const handleRefresh = async () => {
		setRefreshing(true);
		try {
			setError(null);

			// Fetch all users with token refresh
			const users = await fetchWithAdminTokenRefresh<User[]>(
				"/api/admin/users"
			);
			setUsers(users);
			toast.success("Users refreshed successfully");
		} catch (error) {
			console.error("Error refreshing users:", error);
			setError("Failed to refresh users. Please try again.");
			toast.error("Failed to refresh users");
		} finally {
			setRefreshing(false);
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
		const matchesSearch = (
			(user.fullName?.toLowerCase() || "").includes(searchTerm) ||
			(user.email?.toLowerCase() || "").includes(searchTerm) ||
			(user.phoneNumber?.toLowerCase() || "").includes(searchTerm) ||
			(user.role?.toLowerCase() || "").includes(searchTerm)
		);
		
		const matchesRole = roleFilter === "all" || user.role === roleFilter;
		
		return matchesSearch && matchesRole;
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
			toast.success("User updated successfully!");
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
				"/api/admin/users",
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
			toast.success("User created successfully!");
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
			toast.success("User deleted successfully!");
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

	// Handle viewing user details
	const handleViewClick = async (user: User) => {
		setSelectedUser(user);
		setViewDialogOpen(true);
		setLoadingDetails(true);

		try {
			// Fetch detailed user information
			const details = await fetchWithAdminTokenRefresh<UserDetails>(
				`/api/admin/users/${user.id}`
			);
			setUserDetails(details);
		} catch (error) {
			console.error("Error fetching user details:", error);
			setUserDetails(null);
		} finally {
			setLoadingDetails(false);
		}
	};

	const handleViewClose = () => {
		setViewDialogOpen(false);
		setSelectedUser(null);
		setUserDetails(null);
	};

	// Format IC number for display
	const formatIC = (ic: string) => {
		if (ic.length === 12) {
			return `${ic.slice(0, 6)}-${ic.slice(6, 8)}-${ic.slice(8)}`;
		}
		return ic;
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
			{/* Error Message */}
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
						<div className="flex gap-3">
							<button
								onClick={handleCreateClick}
								className="flex items-center px-4 py-2 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors"
							>
								<PlusIcon className="h-5 w-5 mr-2" />
								Create User
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

				</div>

			{/* Search Bar */}
			<div className="mb-4 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
				<div className="relative">
					<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
					</div>
					<input
						type="text"
						className="block w-full pl-10 pr-10 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
						placeholder="Search by name, email, phone, or role"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					{search && (
						<button
							onClick={() => setSearch("")}
							className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300 transition-colors"
							title="Clear search"
						>
							<XMarkIcon className="h-4 w-4" />
						</button>
					)}
				</div>
			</div>

			{/* Filter Bar */}
			<div className="mb-6 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
				<div className="flex flex-wrap gap-2">
					<button
						onClick={() => setRoleFilter("all")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							roleFilter === "all"
								? "bg-blue-500/30 text-blue-100 border-blue-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						All ({users.length})
					</button>
					<button
						onClick={() => setRoleFilter("USER")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							roleFilter === "USER"
								? "bg-green-500/30 text-green-100 border-green-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Users ({users.filter(user => user.role === "USER").length})
					</button>
					<button
						onClick={() => setRoleFilter("ADMIN")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							roleFilter === "ADMIN"
								? "bg-purple-500/30 text-purple-100 border-purple-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Admins ({users.filter(user => user.role === "ADMIN").length})
					</button>
					<button
						onClick={() => setRoleFilter("ATTESTOR")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							roleFilter === "ATTESTOR"
								? "bg-blue-500/30 text-blue-100 border-blue-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Attestors ({users.filter(user => user.role === "ATTESTOR").length})
					</button>
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
									Status
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Role
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Last Login
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Created
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
														{user.fullName || "No name"}
													</div>
													<div className="text-xs text-gray-400">
														{user.icNumber ? (
															<span className="flex items-center">
																<IdentificationIcon className="h-3 w-3 mr-1" />
																{formatIC(user.icNumber)}
															</span>
														) : (
															<span>ID: {user.id.substring(0, 8)}...</span>
														)}
													</div>
												</div>
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm text-gray-300">
												<div className="flex items-center mb-1">
													<PhoneIcon className="h-4 w-4 text-gray-400 mr-2" />
													{user.phoneNumber}
												</div>
												{user.email && (
													<div className="flex items-center text-xs text-gray-400">
														<EnvelopeIcon className="h-3 w-3 mr-1" />
														<span className="truncate max-w-[150px]">{user.email}</span>
													</div>
												)}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="flex flex-col items-start gap-1">
												<span
													className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border w-auto ${
														user.kycStatus
															? "bg-green-500/20 text-green-200 border-green-400/20"
															: "bg-gray-500/20 text-gray-300 border-gray-400/20"
													}`}
												>
													{user.kycStatus ? (
														<>
															<CheckCircleIcon className="h-3 w-3 mr-1" />
															KYC Verified
														</>
													) : (
														<>
															<ExclamationCircleIcon className="h-3 w-3 mr-1" />
															No KYC
														</>
													)}
												</span>
												<span
													className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border w-auto ${
														user.isOnboardingComplete
															? "bg-green-500/20 text-green-200 border-green-400/20"
															: "bg-amber-500/20 text-amber-200 border-amber-400/20"
													}`}
												>
													{user.isOnboardingComplete ? (
														<>
															<CheckCircleIcon className="h-3 w-3 mr-1" />
															Profile Complete
														</>
													) : (
														<>
															<ExclamationCircleIcon className="h-3 w-3 mr-1" />
															Profile Incomplete
														</>
													)}
												</span>
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<span
												className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${
													user.role === "ADMIN"
														? "bg-purple-500/20 text-purple-200 border-purple-400/20"
														: user.role === "ATTESTOR"
														? "bg-blue-500/20 text-blue-200 border-blue-400/20"
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
														<div className="text-xs">
															{formatDate(user.lastLoginAt)}
														</div>
														<div className="text-xs text-gray-400">
															{formatTime(user.lastLoginAt)}
														</div>
													</div>
												) : (
													<span className="text-gray-500 text-xs italic">
														Never
													</span>
												)}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-xs text-gray-300">
												{formatDate(user.createdAt)}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											<div className="flex items-center space-x-2">
												<button
													onClick={() => handleViewClick(user)}
													className="text-blue-400 hover:text-blue-300 transition-colors p-1.5 rounded-lg hover:bg-blue-500/10"
													title="View Details"
												>
													<EyeIcon className="h-5 w-5" />
												</button>
												<button
													onClick={() => handleEditClick(user)}
													className="text-green-400 hover:text-green-300 transition-colors p-1.5 rounded-lg hover:bg-green-500/10"
													title="Edit User"
												>
													<PencilIcon className="h-5 w-5" />
												</button>
												<button
													onClick={() => handleDeleteClick(user)}
													className="text-red-400 hover:text-red-300 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
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
										colSpan={7}
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
					<div className="flex items-center justify-center min-h-screen p-4">
						<div
							className="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm transition-opacity"
							onClick={handleEditCancel}
						></div>

						<div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-lg border border-gray-700/30">
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
										<option value="ATTESTOR">Attestor</option>
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
										<option value="ATTESTOR">Attestor</option>
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

						<div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl text-left shadow-xl transform transition-all w-full max-w-4xl max-h-[90vh] border border-gray-700/30 flex flex-col">
							{/* Header */}
							<div className="px-6 py-4 border-b border-gray-700/30 flex justify-between items-center bg-gray-800/50">
								<div className="flex items-center space-x-4">
									<div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
										<UserIcon className="h-6 w-6 text-white" />
									</div>
									<div>
										<h3 className="text-lg font-semibold text-white">
											{userDetails?.fullName || selectedUser.fullName || "User Details"}
										</h3>
										<p className="text-sm text-gray-400">
											{selectedUser.phoneNumber}
										</p>
									</div>
								</div>
								<div className="flex items-center space-x-3">
									<span
										className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${
											selectedUser.role === "ADMIN"
												? "bg-purple-500/20 text-purple-200 border-purple-400/20"
												: selectedUser.role === "ATTESTOR"
												? "bg-blue-500/20 text-blue-200 border-blue-400/20"
												: "bg-green-500/20 text-green-200 border-green-400/20"
										}`}
									>
										{selectedUser.role}
									</span>
									<button
										onClick={handleViewClose}
										className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700/50"
									>
										<XMarkIcon className="h-6 w-6" />
									</button>
								</div>
							</div>

							<div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
								{loadingDetails ? (
									<div className="flex items-center justify-center py-12">
										<div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-400"></div>
										<span className="ml-3 text-gray-400">Loading user details...</span>
									</div>
								) : userDetails ? (
									<div className="space-y-6">
										{/* Status Badges */}
										<div className="flex flex-wrap gap-2">
											<span
												className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full border ${
													userDetails.kycStatus
														? "bg-green-500/20 text-green-200 border-green-400/20"
														: "bg-gray-500/20 text-gray-300 border-gray-400/20"
												}`}
											>
												{userDetails.kycStatus ? (
													<><CheckCircleIcon className="h-3.5 w-3.5 mr-1.5" />KYC Verified</>
												) : (
													<><ExclamationCircleIcon className="h-3.5 w-3.5 mr-1.5" />No KYC</>
												)}
											</span>
											<span
												className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full border ${
													userDetails.isOnboardingComplete
														? "bg-blue-500/20 text-blue-200 border-blue-400/20"
														: "bg-amber-500/20 text-amber-200 border-amber-400/20"
												}`}
											>
												{userDetails.isOnboardingComplete ? "Profile Complete" : "Profile Incomplete"}
											</span>
											<span
												className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full border ${
													userDetails.phoneVerified
														? "bg-green-500/20 text-green-200 border-green-400/20"
														: "bg-red-500/20 text-red-200 border-red-400/20"
												}`}
											>
												{userDetails.phoneVerified ? "Phone Verified" : "Phone Unverified"}
											</span>
										</div>

										{/* Personal Information */}
										<div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
											<h4 className="text-base font-medium text-white mb-4 flex items-center">
												<UserIcon className="h-5 w-5 text-blue-400 mr-2" />
												Personal Information
											</h4>
											<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Full Name</p>
													<p className="text-sm text-white mt-1">{userDetails.fullName || "—"}</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</p>
													<p className="text-sm text-white mt-1">{userDetails.email || "—"}</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date of Birth</p>
													<p className="text-sm text-white mt-1">
														{userDetails.dateOfBirth ? formatDate(userDetails.dateOfBirth) : "—"}
													</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Gender</p>
													<p className="text-sm text-white mt-1">{userDetails.gender || "—"}</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Race</p>
													<p className="text-sm text-white mt-1">{userDetails.race || "—"}</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Education</p>
													<p className="text-sm text-white mt-1">{userDetails.educationLevel || "—"}</p>
												</div>
											</div>
										</div>

										{/* Identity Information */}
										<div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
											<h4 className="text-base font-medium text-white mb-4 flex items-center">
												<IdentificationIcon className="h-5 w-5 text-purple-400 mr-2" />
												Identity Information
											</h4>
											<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">IC Number</p>
													<p className="text-sm text-white mt-1">
														{userDetails.icNumber ? formatIC(userDetails.icNumber) : "—"}
													</p>
													{userDetails.icType && (
														<p className="text-xs text-blue-400">{userDetails.icType === "IC" ? "Malaysian IC" : "Passport"}</p>
													)}
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">ID Number (Legacy)</p>
													<p className="text-sm text-white mt-1">{userDetails.idNumber || "—"}</p>
													{userDetails.idType && (
														<p className="text-xs text-gray-400">{userDetails.idType}</p>
													)}
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nationality</p>
													<p className="text-sm text-white mt-1">{userDetails.nationality || "—"}</p>
												</div>
											</div>
										</div>

										{/* Address */}
										<div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
											<h4 className="text-base font-medium text-white mb-4 flex items-center">
												<HomeIcon className="h-5 w-5 text-green-400 mr-2" />
												Address
											</h4>
											<div className="space-y-2">
												{userDetails.address1 || userDetails.address2 || userDetails.city ? (
													<>
														{userDetails.address1 && <p className="text-sm text-white">{userDetails.address1}</p>}
														{userDetails.address2 && <p className="text-sm text-white">{userDetails.address2}</p>}
														<p className="text-sm text-white">
															{[userDetails.city, userDetails.state, userDetails.zipCode].filter(Boolean).join(", ")}
														</p>
														{userDetails.country && <p className="text-sm text-gray-400">{userDetails.country}</p>}
													</>
												) : (
													<p className="text-sm text-gray-500 italic">No address provided</p>
												)}
											</div>
										</div>

										{/* Employment Information */}
										<div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
											<h4 className="text-base font-medium text-white mb-4 flex items-center">
												<BriefcaseIcon className="h-5 w-5 text-amber-400 mr-2" />
												Employment Information
											</h4>
											<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Occupation</p>
													<p className="text-sm text-white mt-1">{userDetails.occupation || "—"}</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Employment Status</p>
													<p className="text-sm text-white mt-1">{userDetails.employmentStatus || "—"}</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Employer</p>
													<p className="text-sm text-white mt-1">{userDetails.employerName || "—"}</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Service Length</p>
													<p className="text-sm text-white mt-1">
														{userDetails.serviceLength ? `${userDetails.serviceLength} years` : "—"}
													</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Monthly Income</p>
													<p className="text-sm text-white mt-1">
														{userDetails.monthlyIncome ? formatCurrency(Number(userDetails.monthlyIncome)) : "—"}
													</p>
												</div>
											</div>
										</div>

										{/* Banking Information */}
										<div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
											<h4 className="text-base font-medium text-white mb-4 flex items-center">
												<BanknotesIcon className="h-5 w-5 text-cyan-400 mr-2" />
												Banking Information
											</h4>
											<div className="grid grid-cols-2 gap-4">
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bank Name</p>
													<p className="text-sm text-white mt-1">{userDetails.bankName || "—"}</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account Number</p>
													<p className="text-sm text-white mt-1">
														{userDetails.accountNumber || "—"}
													</p>
												</div>
											</div>
										</div>

										{/* Emergency Contact */}
										<div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
											<h4 className="text-base font-medium text-white mb-4 flex items-center">
												<PhoneIcon className="h-5 w-5 text-red-400 mr-2" />
												Emergency Contact
											</h4>
											<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</p>
													<p className="text-sm text-white mt-1">{userDetails.emergencyContactName || "—"}</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</p>
													<p className="text-sm text-white mt-1">{userDetails.emergencyContactPhone || "—"}</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Relationship</p>
													<p className="text-sm text-white mt-1">{userDetails.emergencyContactRelationship || "—"}</p>
												</div>
											</div>
										</div>

										{/* Account Activity */}
										<div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
											<h4 className="text-base font-medium text-white mb-4 flex items-center">
												<CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
												Account Activity
											</h4>
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</p>
													<p className="text-sm text-white mt-1">{formatDate(userDetails.createdAt)}</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Updated</p>
													<p className="text-sm text-white mt-1">
														{userDetails.updatedAt ? formatDate(userDetails.updatedAt) : "—"}
													</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Login</p>
													<p className="text-sm text-white mt-1">
														{userDetails.lastLoginAt ? formatDate(userDetails.lastLoginAt) : "Never"}
													</p>
												</div>
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Onboarding Step</p>
													<p className="text-sm text-white mt-1">{userDetails.onboardingStep ?? 0}</p>
												</div>
											</div>
										</div>
									</div>
								) : (
									<div className="text-center py-12 text-gray-400">
										<ExclamationCircleIcon className="mx-auto h-12 w-12 text-gray-500 mb-3" />
										<p>Failed to load user details</p>
									</div>
								)}
							</div>

							{/* Footer */}
							<div className="px-6 py-4 border-t border-gray-700/30 bg-gray-800/50 flex justify-between items-center flex-shrink-0">
								<button
									onClick={() => {
										handleViewClose();
										router.push(`/dashboard/applications?userId=${selectedUser.id}`);
									}}
									className="px-4 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors border border-blue-500/30"
								>
									View Applications →
								</button>
								<button
									onClick={handleViewClose}
									className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
								>
									Close
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</AdminLayout>
	);
}
