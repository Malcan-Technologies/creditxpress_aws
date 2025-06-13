"use client";

import { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import {
	BellIcon,
	PlusIcon,
	UserGroupIcon,
	DocumentTextIcon,
	ClockIcon,
	PaperAirplaneIcon,
	ExclamationTriangleIcon,
	InformationCircleIcon,
	CheckCircleIcon,
	XMarkIcon,
	MagnifyingGlassIcon,
	ArrowPathIcon,
	EyeIcon,
	TrashIcon,
	PencilIcon,
	UsersIcon,
	ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";

interface NotificationTemplate {
	id: string;
	code: string;
	title: string;
	message: string;
	type: "SYSTEM" | "MARKETING";
	createdAt: string;
	updatedAt: string;
}

interface NotificationGroup {
	id: string;
	name: string;
	description?: string;
	filters: any;
	createdAt: string;
	updatedAt: string;
}

interface User {
	id: string;
	fullName: string;
	email: string;
	phoneNumber: string;
}

interface RecentNotification {
	id: string;
	title: string;
	message: string;
	type: "SYSTEM" | "MARKETING";
	priority: "LOW" | "MEDIUM" | "HIGH";
	recipientCount?: number;
	createdAt: string;
}

export default function NotificationManagementPage() {
	const [activeTab, setActiveTab] = useState("send");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Send Notification State
	const [notificationForm, setNotificationForm] = useState({
		type: "SYSTEM" as "SYSTEM" | "MARKETING",
		priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH",
		title: "",
		message: "",
		link: "",
		expiresAt: "",
		recipientType: "all" as "all" | "specific" | "group",
		selectedUsers: [] as string[],
		selectedGroup: "",
		templateId: "",
	});

	// Data State
	const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
	const [groups, setGroups] = useState<NotificationGroup[]>([]);
	const [users, setUsers] = useState<User[]>([]);
	const [recentNotifications, setRecentNotifications] = useState<
		RecentNotification[]
	>([]);

	// Recent Activity Filters
	const [recentTypeFilter, setRecentTypeFilter] = useState<string>("ALL");
	const [recentTargetFilter, setRecentTargetFilter] = useState<string>("ALL");

	// Template Management State
	const [templateForm, setTemplateForm] = useState({
		code: "",
		title: "",
		message: "",
		type: "SYSTEM" as "SYSTEM" | "MARKETING",
	});
	const [editingTemplate, setEditingTemplate] =
		useState<NotificationTemplate | null>(null);

	// Group Management State
	const [groupForm, setGroupForm] = useState({
		name: "",
		description: "",
		filters: "{}",
	});
	const [editingGroup, setEditingGroup] = useState<NotificationGroup | null>(
		null
	);

	// User-friendly group filters
	const [groupFilters, setGroupFilters] = useState({
		roles: [] as string[],
		kycStatus: null as boolean | null,
		hasActiveLoans: null as boolean | null,
		registrationDateRange: null as string | null,
	});

	useEffect(() => {
		fetchInitialData();
	}, []);

	const fetchInitialData = async () => {
		try {
			setLoading(true);
			await Promise.all([
				fetchTemplates(),
				fetchGroups(),
				fetchUsers(),
				fetchRecentNotifications(),
			]);
		} catch (error) {
			console.error("Error fetching initial data:", error);
			setError("Failed to load data. Please refresh the page.");
		} finally {
			setLoading(false);
		}
	};

	const fetchTemplates = async () => {
		try {
			const data = await fetchWithAdminTokenRefresh<
				NotificationTemplate[]
			>("/api/admin/notification-templates");
			setTemplates(data || []);
		} catch (error) {
			console.error("Error fetching templates:", error);
		}
	};

	const fetchGroups = async () => {
		try {
			const data = await fetchWithAdminTokenRefresh<NotificationGroup[]>(
				"/api/admin/notification-groups"
			);
			setGroups(data || []);
		} catch (error) {
			console.error("Error fetching groups:", error);
		}
	};

	const fetchUsers = async () => {
		try {
			const data = await fetchWithAdminTokenRefresh<User[]>(
				"/api/admin/users?limit=100"
			);
			setUsers(data || []);
		} catch (error) {
			console.error("Error fetching users:", error);
		}
	};

	const fetchRecentNotifications = async () => {
		try {
			const data = await fetchWithAdminTokenRefresh<{
				notifications: RecentNotification[];
			}>(
				"/api/admin/notifications?limit=50&orderBy=createdAt&order=desc"
			);
			setRecentNotifications(data.notifications || []);
		} catch (error) {
			console.error("Error fetching recent notifications:", error);
		}
	};

	const handleSendNotification = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			setLoading(true);
			setError(null);

			const payload = {
				...notificationForm,
				expiresAt: notificationForm.expiresAt
					? new Date(notificationForm.expiresAt).toISOString()
					: null,
			};

			await fetchWithAdminTokenRefresh("/api/admin/send-notification", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			setSuccess("Notification sent successfully!");
			setNotificationForm({
				type: "SYSTEM",
				priority: "MEDIUM",
				title: "",
				message: "",
				link: "",
				expiresAt: "",
				recipientType: "all",
				selectedUsers: [],
				selectedGroup: "",
				templateId: "",
			});
			fetchRecentNotifications();
		} catch (error) {
			console.error("Error sending notification:", error);
			setError("Failed to send notification. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleCreateTemplate = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			setLoading(true);
			setError(null);

			if (editingTemplate) {
				await fetchWithAdminTokenRefresh(
					`/api/admin/notification-templates/${editingTemplate.id}`,
					{
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(templateForm),
					}
				);
				setSuccess("Template updated successfully!");
			} else {
				await fetchWithAdminTokenRefresh(
					"/api/admin/notification-templates",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(templateForm),
					}
				);
				setSuccess("Template created successfully!");
			}

			setTemplateForm({
				code: "",
				title: "",
				message: "",
				type: "SYSTEM",
			});
			setEditingTemplate(null);
			fetchTemplates();
		} catch (error) {
			console.error("Error saving template:", error);
			setError("Failed to save template. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleCreateGroup = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			setLoading(true);
			setError(null);

			const payload = {
				name: groupForm.name,
				description: groupForm.description,
				filters: JSON.parse(convertFiltersToJSON()),
			};

			if (editingGroup) {
				await fetchWithAdminTokenRefresh(
					`/api/admin/notification-groups/${editingGroup.id}`,
					{
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(payload),
					}
				);
				setSuccess("Group updated successfully!");
			} else {
				await fetchWithAdminTokenRefresh(
					"/api/admin/notification-groups",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(payload),
					}
				);
				setSuccess("Group created successfully!");
			}

			setGroupForm({ name: "", description: "", filters: "{}" });
			setGroupFilters({
				roles: [],
				kycStatus: null,
				hasActiveLoans: null,
				registrationDateRange: null,
			});
			setEditingGroup(null);
			fetchGroups();
		} catch (error) {
			console.error("Error saving group:", error);
			setError("Failed to save group. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteTemplate = async (id: string) => {
		if (!confirm("Are you sure you want to delete this template?")) return;

		try {
			await fetchWithAdminTokenRefresh(
				`/api/admin/notification-templates/${id}`,
				{
					method: "DELETE",
				}
			);
			setSuccess("Template deleted successfully!");
			fetchTemplates();
		} catch (error) {
			console.error("Error deleting template:", error);
			setError("Failed to delete template.");
		}
	};

	const handleDeleteGroup = async (id: string) => {
		if (!confirm("Are you sure you want to delete this group?")) return;

		try {
			await fetchWithAdminTokenRefresh(
				`/api/admin/notification-groups/${id}`,
				{
					method: "DELETE",
				}
			);
			setSuccess("Group deleted successfully!");
			fetchGroups();
		} catch (error) {
			console.error("Error deleting group:", error);
			setError("Failed to delete group.");
		}
	};

	const loadTemplate = (template: NotificationTemplate) => {
		setNotificationForm((prev) => ({
			...prev,
			title: template.title,
			message: template.message,
			type: template.type,
			templateId: template.id,
		}));
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "HIGH":
				return "bg-red-500/20 text-red-200 border-red-400/20";
			case "MEDIUM":
				return "bg-yellow-500/20 text-yellow-200 border-yellow-400/20";
			case "LOW":
				return "bg-green-500/20 text-green-200 border-green-400/20";
			default:
				return "bg-gray-500/20 text-gray-200 border-gray-400/20";
		}
	};

	const getTypeColor = (type: string) => {
		switch (type) {
			case "SYSTEM":
				return "bg-blue-500/20 text-blue-200 border-blue-400/20";
			case "MARKETING":
				return "bg-purple-500/20 text-purple-200 border-purple-400/20";
			default:
				return "bg-gray-500/20 text-gray-200 border-gray-400/20";
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-MY", {
			day: "numeric",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Helper function to convert user-friendly filters to JSON
	const convertFiltersToJSON = () => {
		const filters: any = {};

		if (groupFilters.roles.length > 0) {
			filters.role =
				groupFilters.roles.length === 1
					? groupFilters.roles[0]
					: { $in: groupFilters.roles };
		}

		if (groupFilters.kycStatus !== null) {
			filters.kycStatus = groupFilters.kycStatus;
		}

		if (groupFilters.hasActiveLoans !== null) {
			filters.hasActiveLoans = groupFilters.hasActiveLoans;
		}

		if (groupFilters.registrationDateRange) {
			const now = new Date();
			const daysAgo = parseInt(groupFilters.registrationDateRange);
			const dateThreshold = new Date(
				now.getTime() - daysAgo * 24 * 60 * 60 * 1000
			);
			filters.createdAt = { $gte: dateThreshold.toISOString() };
		}

		return JSON.stringify(filters, null, 2);
	};

	// Helper function to parse JSON filters back to user-friendly format
	const parseFiltersFromJSON = (jsonString: string) => {
		try {
			const filters = JSON.parse(jsonString);
			const newGroupFilters = {
				roles: [] as string[],
				kycStatus: null as boolean | null,
				hasActiveLoans: null as boolean | null,
				registrationDateRange: null as string | null,
			};

			if (filters.role) {
				if (typeof filters.role === "string") {
					newGroupFilters.roles = [filters.role];
				} else if (filters.role.$in) {
					newGroupFilters.roles = filters.role.$in;
				}
			}

			if (filters.kycStatus !== undefined) {
				newGroupFilters.kycStatus = filters.kycStatus;
			}

			if (filters.hasActiveLoans !== undefined) {
				newGroupFilters.hasActiveLoans = filters.hasActiveLoans;
			}

			setGroupFilters(newGroupFilters);
		} catch (error) {
			console.error("Error parsing filters:", error);
		}
	};

	// Filter recent notifications
	const filteredRecentNotifications = recentNotifications.filter(
		(notification) => {
			if (
				recentTypeFilter !== "ALL" &&
				notification.type !== recentTypeFilter
			) {
				return false;
			}
			// Add more filters as needed
			return true;
		}
	);

	const tabs = [
		{ id: "send", name: "Send Notification", icon: PaperAirplaneIcon },
		{ id: "templates", name: "Templates", icon: DocumentTextIcon },
		{ id: "groups", name: "Groups", icon: UserGroupIcon },
		{ id: "recent", name: "Recent Activity", icon: ClockIcon },
	];

	if (loading && activeTab === "send") {
		return (
			<AdminLayout
				title="Notification Management"
				description="Create and broadcast notifications to users"
			>
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
				</div>
			</AdminLayout>
		);
	}

	return (
		<AdminLayout
			title="Notification Management"
			description="Create and broadcast notifications to users"
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

			{/* Tab Navigation */}
			<div className="mb-6">
				<div className="border-b border-gray-700/30">
					<nav className="-mb-px flex space-x-8">
						{tabs.map((tab) => {
							const Icon = tab.icon;
							return (
								<button
									key={tab.id}
									onClick={() => setActiveTab(tab.id)}
									className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
										activeTab === tab.id
											? "border-blue-400 text-blue-300"
											: "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600"
									}`}
								>
									<Icon className="h-5 w-5" />
									<span>{tab.name}</span>
								</button>
							);
						})}
					</nav>
				</div>
			</div>

			{/* Tab Content */}
			{activeTab === "send" && (
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Send Notification Form */}
					<div className="lg:col-span-2">
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
							<h3 className="text-lg font-medium text-white mb-6 flex items-center">
								<PaperAirplaneIcon className="h-6 w-6 mr-2 text-blue-400" />
								Send Notification
							</h3>

							<form
								onSubmit={handleSendNotification}
								className="space-y-6"
							>
								{/* Type and Priority */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-2">
											Type
										</label>
										<select
											value={notificationForm.type}
											onChange={(e) =>
												setNotificationForm((prev) => ({
													...prev,
													type: e.target.value as
														| "SYSTEM"
														| "MARKETING",
												}))
											}
											className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										>
											<option value="SYSTEM">
												System
											</option>
											<option value="MARKETING">
												Marketing
											</option>
										</select>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-2">
											Priority
										</label>
										<select
											value={notificationForm.priority}
											onChange={(e) =>
												setNotificationForm((prev) => ({
													...prev,
													priority: e.target.value as
														| "LOW"
														| "MEDIUM"
														| "HIGH",
												}))
											}
											className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										>
											<option value="LOW">Low</option>
											<option value="MEDIUM">
												Medium
											</option>
											<option value="HIGH">High</option>
										</select>
									</div>
								</div>

								{/* Title */}
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Title
									</label>
									<input
										type="text"
										value={notificationForm.title}
										onChange={(e) =>
											setNotificationForm((prev) => ({
												...prev,
												title: e.target.value,
											}))
										}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										placeholder="Enter notification title"
										required
									/>
								</div>

								{/* Message */}
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Message
									</label>
									<textarea
										value={notificationForm.message}
										onChange={(e) =>
											setNotificationForm((prev) => ({
												...prev,
												message: e.target.value,
											}))
										}
										rows={4}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										placeholder="Enter notification message"
										required
									/>
								</div>

								{/* Link */}
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Link (Optional)
									</label>
									<input
										type="url"
										value={notificationForm.link}
										onChange={(e) =>
											setNotificationForm((prev) => ({
												...prev,
												link: e.target.value,
											}))
										}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										placeholder="https://example.com or /dashboard/page"
									/>
								</div>

								{/* Expiry Date */}
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Expires At (Optional)
									</label>
									<input
										type="datetime-local"
										value={notificationForm.expiresAt}
										onChange={(e) =>
											setNotificationForm((prev) => ({
												...prev,
												expiresAt: e.target.value,
											}))
										}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
									/>
								</div>

								{/* Recipients */}
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Recipients
									</label>
									<div className="space-y-3">
										<div className="flex items-center space-x-4">
											<label className="flex items-center">
												<input
													type="radio"
													value="all"
													checked={
														notificationForm.recipientType ===
														"all"
													}
													onChange={(e) =>
														setNotificationForm(
															(prev) => ({
																...prev,
																recipientType: e
																	.target
																	.value as
																	| "all"
																	| "specific"
																	| "group",
															})
														)
													}
													className="mr-2"
												/>
												<span className="text-gray-300">
													All Users
												</span>
											</label>
											<label className="flex items-center">
												<input
													type="radio"
													value="group"
													checked={
														notificationForm.recipientType ===
														"group"
													}
													onChange={(e) =>
														setNotificationForm(
															(prev) => ({
																...prev,
																recipientType: e
																	.target
																	.value as
																	| "all"
																	| "specific"
																	| "group",
															})
														)
													}
													className="mr-2"
												/>
												<span className="text-gray-300">
													User Group
												</span>
											</label>
											<label className="flex items-center">
												<input
													type="radio"
													value="specific"
													checked={
														notificationForm.recipientType ===
														"specific"
													}
													onChange={(e) =>
														setNotificationForm(
															(prev) => ({
																...prev,
																recipientType: e
																	.target
																	.value as
																	| "all"
																	| "specific"
																	| "group",
															})
														)
													}
													className="mr-2"
												/>
												<span className="text-gray-300">
													Specific Users
												</span>
											</label>
										</div>

										{notificationForm.recipientType ===
											"group" && (
											<select
												value={
													notificationForm.selectedGroup
												}
												onChange={(e) =>
													setNotificationForm(
														(prev) => ({
															...prev,
															selectedGroup:
																e.target.value,
														})
													)
												}
												className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
												required
											>
												<option value="">
													Select a group
												</option>
												{groups.map((group) => (
													<option
														key={group.id}
														value={group.id}
													>
														{group.name}
													</option>
												))}
											</select>
										)}

										{notificationForm.recipientType ===
											"specific" && (
											<div className="max-h-40 overflow-y-auto bg-gray-700/30 border border-gray-600 rounded-lg p-3">
												{users.map((user) => (
													<label
														key={user.id}
														className="flex items-center py-1"
													>
														<input
															type="checkbox"
															checked={notificationForm.selectedUsers.includes(
																user.id
															)}
															onChange={(e) => {
																if (
																	e.target
																		.checked
																) {
																	setNotificationForm(
																		(
																			prev
																		) => ({
																			...prev,
																			selectedUsers:
																				[
																					...prev.selectedUsers,
																					user.id,
																				],
																		})
																	);
																} else {
																	setNotificationForm(
																		(
																			prev
																		) => ({
																			...prev,
																			selectedUsers:
																				prev.selectedUsers.filter(
																					(
																						id
																					) =>
																						id !==
																						user.id
																				),
																		})
																	);
																}
															}}
															className="mr-2"
														/>
														<span className="text-gray-300 text-sm">
															{user.fullName} (
															{user.email})
														</span>
													</label>
												))}
											</div>
										)}
									</div>
								</div>

								{/* Submit Button */}
								<button
									type="submit"
									disabled={loading}
									className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
								>
									{loading ? (
										<ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
									) : (
										<PaperAirplaneIcon className="h-5 w-5 mr-2" />
									)}
									{loading
										? "Sending..."
										: "Send Notification"}
								</button>
							</form>
						</div>
					</div>

					{/* Templates Sidebar */}
					<div className="lg:col-span-1">
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
							<h3 className="text-lg font-medium text-white mb-4 flex items-center">
								<DocumentTextIcon className="h-6 w-6 mr-2 text-green-400" />
								Quick Templates
							</h3>
							<div className="space-y-3 max-h-96 overflow-y-auto">
								{templates.slice(0, 5).map((template) => (
									<div
										key={template.id}
										className="p-3 bg-gray-700/30 border border-gray-600/30 rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer"
										onClick={() => loadTemplate(template)}
									>
										<div className="flex items-center justify-between mb-2">
											<span
												className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(
													template.type
												)}`}
											>
												{template.type}
											</span>
										</div>
										<h4 className="text-white font-medium text-sm mb-1">
											{template.title}
										</h4>
										<p className="text-gray-400 text-xs line-clamp-2">
											{template.message}
										</p>
									</div>
								))}
								{templates.length === 0 && (
									<p className="text-gray-400 text-sm text-center py-4">
										No templates available
									</p>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{activeTab === "templates" && (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Template Form */}
					<div>
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
							<h3 className="text-lg font-medium text-white mb-6 flex items-center">
								<DocumentTextIcon className="h-6 w-6 mr-2 text-green-400" />
								{editingTemplate
									? "Edit Template"
									: "Create Template"}
							</h3>

							<form
								onSubmit={handleCreateTemplate}
								className="space-y-4"
							>
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Code
									</label>
									<input
										type="text"
										value={templateForm.code}
										onChange={(e) =>
											setTemplateForm((prev) => ({
												...prev,
												code: e.target.value,
											}))
										}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										placeholder="TEMPLATE_CODE"
										required
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Type
									</label>
									<select
										value={templateForm.type}
										onChange={(e) =>
											setTemplateForm((prev) => ({
												...prev,
												type: e.target.value as
													| "SYSTEM"
													| "MARKETING",
											}))
										}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
									>
										<option value="SYSTEM">System</option>
										<option value="MARKETING">
											Marketing
										</option>
									</select>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Title
									</label>
									<input
										type="text"
										value={templateForm.title}
										onChange={(e) =>
											setTemplateForm((prev) => ({
												...prev,
												title: e.target.value,
											}))
										}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										placeholder="Template title"
										required
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Message
									</label>
									<textarea
										value={templateForm.message}
										onChange={(e) =>
											setTemplateForm((prev) => ({
												...prev,
												message: e.target.value,
											}))
										}
										rows={4}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										placeholder="Template message"
										required
									/>
								</div>

								<div className="flex space-x-3">
									<button
										type="submit"
										disabled={loading}
										className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-medium py-2 px-4 rounded-lg transition-colors"
									>
										{editingTemplate
											? "Update Template"
											: "Create Template"}
									</button>
									{editingTemplate && (
										<button
											type="button"
											onClick={() => {
												setEditingTemplate(null);
												setTemplateForm({
													code: "",
													title: "",
													message: "",
													type: "SYSTEM",
												});
											}}
											className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
										>
											Cancel
										</button>
									)}
								</div>
							</form>
						</div>
					</div>

					{/* Templates List */}
					<div>
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
							<h3 className="text-lg font-medium text-white mb-6">
								Templates ({templates.length})
							</h3>
							<div className="space-y-3 max-h-96 overflow-y-auto">
								{templates.map((template) => (
									<div
										key={template.id}
										className="p-4 bg-gray-700/30 border border-gray-600/30 rounded-lg"
									>
										<div className="flex items-center justify-between mb-2">
											<span
												className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(
													template.type
												)}`}
											>
												{template.type}
											</span>
											<div className="flex space-x-2">
												<button
													onClick={() => {
														setEditingTemplate(
															template
														);
														setTemplateForm({
															code: template.code,
															title: template.title,
															message:
																template.message,
															type: template.type,
														});
													}}
													className="text-blue-400 hover:text-blue-300"
												>
													<PencilIcon className="h-4 w-4" />
												</button>
												<button
													onClick={() =>
														handleDeleteTemplate(
															template.id
														)
													}
													className="text-red-400 hover:text-red-300"
												>
													<TrashIcon className="h-4 w-4" />
												</button>
											</div>
										</div>
										<h4 className="text-white font-medium mb-1">
											{template.title}
										</h4>
										<p className="text-gray-400 text-sm mb-2">
											{template.message}
										</p>
										<p className="text-gray-500 text-xs">
											Code: {template.code}
										</p>
									</div>
								))}
								{templates.length === 0 && (
									<p className="text-gray-400 text-center py-8">
										No templates created yet
									</p>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{activeTab === "groups" && (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Group Form */}
					<div>
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
							<h3 className="text-lg font-medium text-white mb-6 flex items-center">
								<UserGroupIcon className="h-6 w-6 mr-2 text-purple-400" />
								{editingGroup ? "Edit Group" : "Create Group"}
							</h3>

							<form
								onSubmit={handleCreateGroup}
								className="space-y-4"
							>
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Name
									</label>
									<input
										type="text"
										value={groupForm.name}
										onChange={(e) =>
											setGroupForm((prev) => ({
												...prev,
												name: e.target.value,
											}))
										}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										placeholder="Group name"
										required
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Description
									</label>
									<input
										type="text"
										value={groupForm.description}
										onChange={(e) =>
											setGroupForm((prev) => ({
												...prev,
												description: e.target.value,
											}))
										}
										className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										placeholder="Group description"
									/>
								</div>

								{/* User-friendly filters */}
								<div className="space-y-4">
									<h4 className="text-sm font-medium text-gray-300">
										User Filters
									</h4>

									{/* Role Selection */}
									<div>
										<label className="block text-sm font-medium text-gray-400 mb-2">
											User Roles
										</label>
										<div className="space-y-2">
											{["USER", "ADMIN"].map((role) => (
												<label
													key={role}
													className="flex items-center"
												>
													<input
														type="checkbox"
														checked={groupFilters.roles.includes(
															role
														)}
														onChange={(e) => {
															if (
																e.target.checked
															) {
																setGroupFilters(
																	(prev) => ({
																		...prev,
																		roles: [
																			...prev.roles,
																			role,
																		],
																	})
																);
															} else {
																setGroupFilters(
																	(prev) => ({
																		...prev,
																		roles: prev.roles.filter(
																			(
																				r
																			) =>
																				r !==
																				role
																		),
																	})
																);
															}
														}}
														className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
													/>
													<span className="ml-2 text-gray-300">
														{role}
													</span>
												</label>
											))}
										</div>
									</div>

									{/* KYC Status */}
									<div>
										<label className="block text-sm font-medium text-gray-400 mb-2">
											KYC Status
										</label>
										<select
											value={
												groupFilters.kycStatus === null
													? ""
													: groupFilters.kycStatus.toString()
											}
											onChange={(e) => {
												const value = e.target.value;
												setGroupFilters((prev) => ({
													...prev,
													kycStatus:
														value === ""
															? null
															: value === "true",
												}));
											}}
											className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										>
											<option value="">Any</option>
											<option value="true">
												Completed
											</option>
											<option value="false">
												Not Completed
											</option>
										</select>
									</div>

									{/* Active Loans */}
									<div>
										<label className="block text-sm font-medium text-gray-400 mb-2">
											Has Active Loans
										</label>
										<select
											value={
												groupFilters.hasActiveLoans ===
												null
													? ""
													: groupFilters.hasActiveLoans.toString()
											}
											onChange={(e) => {
												const value = e.target.value;
												setGroupFilters((prev) => ({
													...prev,
													hasActiveLoans:
														value === ""
															? null
															: value === "true",
												}));
											}}
											className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										>
											<option value="">Any</option>
											<option value="true">Yes</option>
											<option value="false">No</option>
										</select>
									</div>

									{/* Registration Date Range */}
									<div>
										<label className="block text-sm font-medium text-gray-400 mb-2">
											Registered Within
										</label>
										<select
											value={
												groupFilters.registrationDateRange ||
												""
											}
											onChange={(e) => {
												setGroupFilters((prev) => ({
													...prev,
													registrationDateRange:
														e.target.value || null,
												}));
											}}
											className="w-full bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
										>
											<option value="">Any time</option>
											<option value="7">
												Last 7 days
											</option>
											<option value="30">
												Last 30 days
											</option>
											<option value="90">
												Last 90 days
											</option>
											<option value="365">
												Last year
											</option>
										</select>
									</div>

									{/* Generated JSON Preview */}
									<div>
										<label className="block text-sm font-medium text-gray-400 mb-2">
											Generated Filters (Preview)
										</label>
										<div className="bg-gray-800/50 p-3 rounded-lg border border-gray-600/30">
											<pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
												{convertFiltersToJSON()}
											</pre>
										</div>
									</div>
								</div>

								<div className="flex space-x-3">
									<button
										type="submit"
										disabled={loading}
										className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-medium py-2 px-4 rounded-lg transition-colors"
									>
										{editingGroup
											? "Update Group"
											: "Create Group"}
									</button>
									{editingGroup && (
										<button
											type="button"
											onClick={() => {
												setEditingGroup(null);
												setGroupForm({
													name: "",
													description: "",
													filters: "{}",
												});
												setGroupFilters({
													roles: [],
													kycStatus: null,
													hasActiveLoans: null,
													registrationDateRange: null,
												});
											}}
											className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
										>
											Cancel
										</button>
									)}
								</div>
							</form>
						</div>
					</div>

					{/* Groups List */}
					<div>
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
							<h3 className="text-lg font-medium text-white mb-6">
								Groups ({groups.length})
							</h3>
							<div className="space-y-3 max-h-96 overflow-y-auto">
								{groups.map((group) => (
									<div
										key={group.id}
										className="p-4 bg-gray-700/30 border border-gray-600/30 rounded-lg"
									>
										<div className="flex items-center justify-between mb-2">
											<h4 className="text-white font-medium">
												{group.name}
											</h4>
											<div className="flex space-x-2">
												<button
													onClick={() => {
														setEditingGroup(group);
														setGroupForm({
															name: group.name,
															description:
																group.description ||
																"",
															filters:
																JSON.stringify(
																	group.filters,
																	null,
																	2
																),
														});
														parseFiltersFromJSON(
															JSON.stringify(
																group.filters
															)
														);
													}}
													className="text-blue-400 hover:text-blue-300"
												>
													<PencilIcon className="h-4 w-4" />
												</button>
												<button
													onClick={() =>
														handleDeleteGroup(
															group.id
														)
													}
													className="text-red-400 hover:text-red-300"
												>
													<TrashIcon className="h-4 w-4" />
												</button>
											</div>
										</div>
										{group.description && (
											<p className="text-gray-400 text-sm mb-2">
												{group.description}
											</p>
										)}
										<div className="bg-gray-800/50 p-2 rounded text-xs font-mono text-gray-300">
											{JSON.stringify(group.filters)}
										</div>
									</div>
								))}
								{groups.length === 0 && (
									<p className="text-gray-400 text-center py-8">
										No groups created yet
									</p>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{activeTab === "recent" && (
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-6">
					<div className="flex items-center justify-between mb-6">
						<h3 className="text-lg font-medium text-white flex items-center">
							<ClockIcon className="h-6 w-6 mr-2 text-amber-400" />
							Recent Notifications (
							{filteredRecentNotifications.length})
						</h3>

						{/* Filters */}
						<div className="flex space-x-3">
							<select
								value={recentTypeFilter}
								onChange={(e) =>
									setRecentTypeFilter(e.target.value)
								}
								className="bg-gray-700/50 border border-gray-600 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
							>
								<option value="ALL">All Types</option>
								<option value="SYSTEM">System</option>
								<option value="MARKETING">Marketing</option>
							</select>

							<button
								onClick={fetchRecentNotifications}
								className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
							>
								<ArrowPathIcon className="h-4 w-4 mr-1" />
								Refresh
							</button>
						</div>
					</div>

					<div className="space-y-4">
						{filteredRecentNotifications.map((notification) => (
							<div
								key={notification.id}
								className="p-4 bg-gray-700/30 border border-gray-600/30 rounded-lg"
							>
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center space-x-2">
										<span
											className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(
												notification.type
											)}`}
										>
											{notification.type}
										</span>
										<span
											className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(
												notification.priority
											)}`}
										>
											{notification.priority}
										</span>
									</div>
									<span className="text-gray-400 text-sm">
										{formatDate(notification.createdAt)}
									</span>
								</div>
								<h4 className="text-white font-medium mb-1">
									{notification.title}
								</h4>
								<p className="text-gray-400 text-sm mb-2">
									{notification.message}
								</p>
								{notification.recipientCount && (
									<p className="text-gray-500 text-xs">
										Sent to {notification.recipientCount}{" "}
										recipients
									</p>
								)}
							</div>
						))}
						{filteredRecentNotifications.length === 0 && (
							<div className="text-center py-8">
								<ClockIcon className="mx-auto h-12 w-12 text-gray-500 mb-2" />
								<p className="text-gray-400">
									{recentNotifications.length === 0
										? "No recent notifications"
										: "No notifications match the selected filters"}
								</p>
							</div>
						)}
					</div>
				</div>
			)}
		</AdminLayout>
	);
}
