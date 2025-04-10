"use client";

import React from "react";
import { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";
import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	TextField,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	Grid,
	SelectChangeEvent,
} from "@mui/material";

interface User {
	id: string;
	fullName: string;
	email: string;
	phoneNumber: string;
	role: string;
	createdAt: string;
}

export default function AdminUsersPage() {
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [userName, setUserName] = useState("Admin");

	// Dialog states
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [selectedUser, setSelectedUser] = useState<User | null>(null);

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
		const fetchUsers = async () => {
			try {
				setLoading(true);

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

				// Fetch all users with token refresh
				const users = await fetchWithAdminTokenRefresh<User[]>(
					"/api/admin/users"
				);
				setUsers(users);
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

	const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setEditForm((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleEditSelectChange = (e: SelectChangeEvent) => {
		const { name, value } = e.target;
		setEditForm((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleEditSubmit = async () => {
		if (!selectedUser) return;

		try {
			setIsSubmitting(true);

			// Update user with token refresh
			const updatedUser = await fetchWithAdminTokenRefresh<User>(
				`/api/admin/users/${selectedUser.id}`,
				{
					method: "PUT",
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
		} catch (error) {
			console.error("Error updating user:", error);
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

	const handleCreateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setCreateForm((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleCreateSelectChange = (e: SelectChangeEvent) => {
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

			// Create user with token refresh
			const newUser = await fetchWithAdminTokenRefresh<User>(
				"/api/auth/signup",
				{
					method: "POST",
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
		} catch (error) {
			console.error("Error creating user:", error);
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
		} catch (error) {
			console.error("Error deleting user:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteCancel = () => {
		setDeleteDialogOpen(false);
		setSelectedUser(null);
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
			title="Users"
			description="Manage and view all users in the system"
		>
			<div className="bg-white shadow rounded-lg overflow-hidden">
				<div className="px-6 py-4 border-b border-gray-200">
					<div className="flex justify-between items-center">
						<h2 className="text-xl font-semibold text-gray-900">
							Users
						</h2>
						<button
							onClick={handleCreateClick}
							className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						>
							Create User
						</button>
					</div>

					{/* Search Bar */}
					<div className="mt-4 max-w-md">
						<input
							type="text"
							placeholder="Search users..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
						/>
					</div>
				</div>

				{/* Users Table */}
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
									Email
								</th>
								<th
									scope="col"
									className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Phone
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
									Joined
								</th>
								<th
									scope="col"
									className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="bg-white divide-y divide-gray-200">
							{filteredUsers.length > 0 ? (
								filteredUsers.map((user) => (
									<tr key={user.id}>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm font-medium text-gray-900">
												{user.fullName}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm text-gray-500">
												{user.email}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm text-gray-500">
												{user.phoneNumber}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<span
												className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
													user.role === "ADMIN"
														? "bg-purple-100 text-purple-800"
														: "bg-green-100 text-green-800"
												}`}
											>
												{user.role}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{formatDate(user.createdAt)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											<div className="flex items-center gap-2">
												<button
													onClick={() =>
														handleEditClick(user)
													}
													className="text-indigo-600 hover:text-indigo-900"
												>
													Edit
												</button>
												<button
													onClick={() =>
														handleDeleteClick(user)
													}
													className="text-red-600 hover:text-red-900"
												>
													Delete
												</button>
											</div>
										</td>
									</tr>
								))
							) : (
								<tr key="no-users">
									<td
										colSpan={6}
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

			{/* Edit User Dialog */}
			<Dialog
				open={editDialogOpen}
				onClose={handleEditCancel}
				aria-labelledby="edit-dialog-title"
				aria-describedby="edit-dialog-description"
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle id="edit-dialog-title">Edit User</DialogTitle>
				<DialogContent>
					<div className="mt-4 space-y-4">
						<TextField
							autoFocus
							margin="dense"
							id="fullName"
							name="fullName"
							label="Full Name"
							type="text"
							fullWidth
							value={editForm.fullName}
							onChange={handleEditChange}
						/>
						<TextField
							margin="dense"
							id="email"
							name="email"
							label="Email"
							type="email"
							fullWidth
							value={editForm.email}
							onChange={handleEditChange}
						/>
						<TextField
							margin="dense"
							id="phoneNumber"
							name="phoneNumber"
							label="Phone Number"
							type="text"
							fullWidth
							value={editForm.phoneNumber}
							onChange={handleEditChange}
						/>
						<FormControl fullWidth margin="dense">
							<InputLabel id="role-label">Role</InputLabel>
							<Select
								labelId="role-label"
								id="role"
								name="role"
								value={editForm.role}
								label="Role"
								onChange={handleEditSelectChange}
							>
								<MenuItem value="USER">User</MenuItem>
								<MenuItem value="ADMIN">Admin</MenuItem>
							</Select>
						</FormControl>
					</div>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleEditCancel} color="primary">
						Cancel
					</Button>
					<Button
						onClick={handleEditSubmit}
						color="primary"
						variant="contained"
						disabled={isSubmitting}
					>
						{isSubmitting ? "Saving..." : "Save"}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Create User Dialog */}
			<Dialog
				open={createDialogOpen}
				onClose={handleCreateCancel}
				aria-labelledby="create-dialog-title"
				aria-describedby="create-dialog-description"
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle id="create-dialog-title">
					Create New User
				</DialogTitle>
				<DialogContent>
					<div className="mt-4 space-y-4">
						<TextField
							autoFocus
							margin="dense"
							id="fullName"
							name="fullName"
							label="Full Name"
							type="text"
							fullWidth
							value={createForm.fullName}
							onChange={handleCreateChange}
						/>
						<TextField
							margin="dense"
							id="email"
							name="email"
							label="Email"
							type="email"
							fullWidth
							value={createForm.email}
							onChange={handleCreateChange}
						/>
						<TextField
							margin="dense"
							id="phoneNumber"
							name="phoneNumber"
							label="Phone Number"
							type="text"
							fullWidth
							value={createForm.phoneNumber}
							onChange={handleCreateChange}
						/>
						<TextField
							margin="dense"
							id="password"
							name="password"
							label="Password"
							type="password"
							fullWidth
							value={createForm.password}
							onChange={handleCreateChange}
						/>
						<FormControl fullWidth margin="dense">
							<InputLabel id="role-label">Role</InputLabel>
							<Select
								labelId="role-label"
								id="role"
								name="role"
								value={createForm.role}
								label="Role"
								onChange={handleCreateSelectChange}
							>
								<MenuItem value="USER">User</MenuItem>
								<MenuItem value="ADMIN">Admin</MenuItem>
							</Select>
						</FormControl>
					</div>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCreateCancel} color="primary">
						Cancel
					</Button>
					<Button
						onClick={handleCreateSubmit}
						color="primary"
						variant="contained"
						disabled={isSubmitting}
					>
						{isSubmitting ? "Creating..." : "Create"}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Delete User Dialog */}
			<Dialog
				open={deleteDialogOpen}
				onClose={handleDeleteCancel}
				aria-labelledby="delete-dialog-title"
				aria-describedby="delete-dialog-description"
			>
				<DialogTitle id="delete-dialog-title">Delete User</DialogTitle>
				<DialogContent>
					<DialogContentText id="delete-dialog-description">
						Are you sure you want to delete {selectedUser?.fullName}
						? This action cannot be undone.
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleDeleteCancel} color="primary">
						Cancel
					</Button>
					<Button
						onClick={handleDeleteSubmit}
						color="error"
						variant="contained"
						disabled={isSubmitting}
					>
						{isSubmitting ? "Deleting..." : "Delete"}
					</Button>
				</DialogActions>
			</Dialog>
		</AdminLayout>
	);
}
