"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";
import Link from "next/link";
import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	TextField,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	SelectChangeEvent,
	Chip,
} from "@mui/material";
import {
	CheckCircleIcon,
	XCircleIcon,
	DocumentTextIcon,
	ClockIcon,
	UserCircleIcon,
	CurrencyDollarIcon,
	ArrowPathIcon,
	ArrowRightIcon,
	DocumentMagnifyingGlassIcon,
	BanknotesIcon,
	ClipboardDocumentCheckIcon,
	PencilSquareIcon,
	ArrowLeftIcon,
} from "@heroicons/react/24/outline";

interface LoanApplication {
	id: string;
	userId: string;
	productId: string;
	amount?: number;
	term?: number;
	purpose?: string;
	status: string;
	createdAt: string;
	updatedAt: string;
	monthlyRepayment?: number;
	interestRate?: number;
	netDisbursement?: number;
	user?: {
		fullName?: string;
		phoneNumber?: string;
		email?: string;
		employmentStatus?: string;
		employerName?: string;
		monthlyIncome?: string;
		bankName?: string;
		accountNumber?: string;
		address1?: string;
		address2?: string;
		city?: string;
		state?: string;
		zipCode?: string;
	};
	product?: {
		name?: string;
		code?: string;
		description?: string;
		interestRate?: number;
		repaymentTerms?: any;
	};
	documents?: Document[];
	history?: LoanApplicationHistory[];
}

interface Document {
	id: string;
	type: string;
	status: string;
	fileUrl: string;
	createdAt: string;
	updatedAt: string;
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
			fullName?: string;
			email?: string;
		};
	}[];
}

export default function AdminApplicationsPage() {
	const [applications, setApplications] = useState<LoanApplication[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [userName, setUserName] = useState("Admin");
	const [error, setError] = useState<string | null>(null);

	// Dialog states
	const [viewDialogOpen, setViewDialogOpen] = useState(false);
	const [selectedApplication, setSelectedApplication] =
		useState<LoanApplication | null>(null);
	const [selectedDocument, setSelectedDocument] = useState<Document | null>(
		null
	);
	const [selectedTab, setSelectedTab] = useState<string>("details");
	const [refreshing, setRefreshing] = useState(false);

	// Replace single status filter with multiple filters
	const [selectedFilters, setSelectedFilters] = useState<string[]>([
		"PENDING_APPROVAL",
		"PENDING_APP_FEE",
		"PENDING_KYC",
	]);

	// Status colors for badges
	const statusColors: Record<string, { bg: string; text: string }> = {
		INCOMPLETE: { bg: "bg-gray-100", text: "text-gray-800" },
		PENDING_APP_FEE: { bg: "bg-blue-100", text: "text-blue-800" },
		PENDING_KYC: { bg: "bg-indigo-100", text: "text-indigo-800" },
		PENDING_APPROVAL: { bg: "bg-yellow-100", text: "text-yellow-800" },
		REJECTED: { bg: "bg-red-100", text: "text-red-800" },
		WITHDRAWN: { bg: "bg-gray-100", text: "text-gray-800" },
	};

	// Add missing helper functions
	const getStatusIcon = (status: string) => {
		switch (status) {
			case "INCOMPLETE":
				return PencilSquareIcon;
			case "PENDING_APP_FEE":
				return CurrencyDollarIcon;
			case "PENDING_KYC":
				return ClipboardDocumentCheckIcon;
			case "PENDING_APPROVAL":
				return DocumentMagnifyingGlassIcon;
			case "APPROVED":
				return CheckCircleIcon;
			case "PENDING_SIGNATURE":
				return DocumentTextIcon;
			case "PENDING_DISBURSEMENT":
				return BanknotesIcon;
			case "REJECTED":
				return XCircleIcon;
			case "WITHDRAWN":
				return ArrowLeftIcon;
			default:
				return ClockIcon;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "INCOMPLETE":
				return "bg-yellow-500/20 text-yellow-200 border-yellow-400/20";
			case "PENDING_APP_FEE":
				return "bg-blue-500/20 text-blue-200 border-blue-400/20";
			case "PENDING_KYC":
				return "bg-purple-500/20 text-purple-200 border-purple-400/20";
			case "PENDING_APPROVAL":
				return "bg-amber-500/20 text-amber-200 border-amber-400/20";
			case "APPROVED":
				return "bg-green-500/20 text-green-200 border-green-400/20";
			case "PENDING_SIGNATURE":
				return "bg-indigo-500/20 text-indigo-200 border-indigo-400/20";
			case "PENDING_DISBURSEMENT":
				return "bg-emerald-500/20 text-emerald-200 border-emerald-400/20";
			case "REJECTED":
				return "bg-red-500/20 text-red-200 border-red-400/20";
			case "WITHDRAWN":
				return "bg-gray-500/20 text-gray-200 border-gray-400/20";
			default:
				return "bg-gray-500/20 text-gray-200 border-gray-400/20";
		}
	};

	const getStatusLabel = (status: string) => {
		switch (status) {
			case "INCOMPLETE":
				return "Incomplete";
			case "PENDING_APP_FEE":
				return "Pending Application Fee";
			case "PENDING_KYC":
				return "Pending KYC";
			case "PENDING_APPROVAL":
				return "Pending Approval";
			case "APPROVED":
				return "Approved";
			case "PENDING_SIGNATURE":
				return "Pending Signature";
			case "PENDING_DISBURSEMENT":
				return "Pending Disbursement";
			case "REJECTED":
				return "Rejected";
			case "WITHDRAWN":
				return "Withdrawn";
			default:
				return status.replace(/_/g, " ").toLowerCase();
		}
	};

	// Add function to update refresh button
	const handleRefresh = async () => {
		setRefreshing(true);
		try {
			// Refresh all applications
			await fetchApplications();

			// If there's a selected application, refresh its history specifically
			if (selectedApplication) {
				const updatedHistory = await fetchApplicationHistory(
					selectedApplication.id
				);
				const updatedApp = {
					...selectedApplication,
					history: updatedHistory,
				};
				setSelectedApplication(updatedApp);

				// Also update it in the applications list
				setApplications((prev) =>
					prev.map((app) =>
						app.id === selectedApplication.id ? updatedApp : app
					)
				);
			}
		} catch (error) {
			console.error("Error refreshing data:", error);
		} finally {
			setRefreshing(false);
		}
	};

	// Define fetchApplications outside of useEffect so it can be reused
	const fetchApplications = async () => {
		try {
			setLoading(true);
			setError(null);

			// Fetch user data
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

			// Try fetching applications from applications endpoint
			try {
				const applicationsData = await fetchWithAdminTokenRefresh<
					LoanApplication[]
				>("/api/admin/applications");

				// For each application, fetch its history
				const applicationsWithHistory = await Promise.all(
					applicationsData.map(async (app) => {
						try {
							const history = await fetchWithAdminTokenRefresh<
								LoanApplicationHistory[]
							>(`/api/admin/applications/${app.id}/history`);
							return { ...app, history };
						} catch (historyError) {
							console.error(
								`Error fetching history for application ${app.id}:`,
								historyError
							);
							return app;
						}
					})
				);

				setApplications(applicationsWithHistory);
			} catch (appError) {
				console.error("Error fetching applications:", appError);

				// Fallback to dashboard data
				console.log("Falling back to dashboard data for applications");
				try {
					const dashboardData =
						await fetchWithAdminTokenRefresh<DashboardStats>(
							"/api/admin/dashboard"
						);

					// Convert dashboard recent applications to full application format
					const recentApps = dashboardData.recentApplications.map(
						(app) => ({
							...app,
							productId: "",
							updatedAt: app.createdAt,
						})
					);

					setApplications(recentApps);
				} catch (dashboardError) {
					console.error(
						"Error fetching dashboard data:",
						dashboardError
					);
					setError(
						"Failed to load applications. Please check API implementation."
					);
				}
			}

			// Check for application ID in URL query params
			const params = new URLSearchParams(window.location.search);
			const applicationId = params.get("id");

			if (applicationId && applications.length > 0) {
				const selectedApp = applications.find(
					(app) => app.id === applicationId
				);
				if (selectedApp) {
					setSelectedApplication(selectedApp);
					setViewDialogOpen(true);
				}
			}
		} catch (error) {
			console.error("Error in applications page:", error);
			setError("An unexpected error occurred.");
		} finally {
			setLoading(false);
			setRefreshing(false); // Make sure to stop refreshing state
		}
	};

	useEffect(() => {
		fetchApplications();
	}, []);

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-MY", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	};

	const formatCurrency = (amount?: number) => {
		if (!amount) return "N/A";
		return new Intl.NumberFormat("en-MY", {
			style: "currency",
			currency: "MYR",
		}).format(amount);
	};

	// Filter applications to exclude approved and disbursed ones
	const filteredApplications = applications.filter((app) => {
		// Exclude applications with dedicated workflow pages
		if (
			app.status === "PENDING_APPROVAL" ||
			app.status === "PENDING_DISBURSEMENT"
		) {
			return false;
		}

		// Filter by search term
		const searchTerm = search.toLowerCase();
		const matchesSearch =
			(app.user?.fullName?.toLowerCase() || "").includes(searchTerm) ||
			(app.purpose?.toLowerCase() || "").includes(searchTerm) ||
			(app.product?.name?.toLowerCase() || "").includes(searchTerm) ||
			(app.status?.toLowerCase() || "").includes(searchTerm);

		// Filter by statuses - if no filters selected, show all
		const matchesStatus =
			selectedFilters.length === 0 ||
			selectedFilters.includes(app.status || "");

		return matchesSearch && matchesStatus;
	});

	// Handle filter toggle
	const toggleFilter = (status: string) => {
		if (selectedFilters.includes(status)) {
			setSelectedFilters(selectedFilters.filter((s) => s !== status));
		} else {
			setSelectedFilters([...selectedFilters, status]);
		}
	};

	// Handle view application details
	const handleViewClick = (application: LoanApplication) => {
		setSelectedApplication(application);
		setSelectedTab("details"); // Reset to details tab when selecting new application
		setViewDialogOpen(true);
	};

	const handleViewClose = () => {
		setViewDialogOpen(false);
		setSelectedApplication(null);
	};

	// Function to fetch updated history for an application
	const fetchApplicationHistory = async (applicationId: string) => {
		try {
			const history = await fetchWithAdminTokenRefresh<
				LoanApplicationHistory[]
			>(`/api/admin/applications/${applicationId}/history`);
			return history;
		} catch (error) {
			console.error(
				`Error fetching history for application ${applicationId}:`,
				error
			);
			return [];
		}
	};

	// Handle status change
	const handleStatusChange = async (
		applicationId: string,
		newStatus: string
	) => {
		try {
			const updatedApplication =
				await fetchWithAdminTokenRefresh<LoanApplication>(
					`/api/admin/applications/${applicationId}/status`,
					{
						method: "PATCH",
						body: JSON.stringify({ status: newStatus }),
					}
				);

			// Fetch the updated history after status change
			const updatedHistory = await fetchApplicationHistory(applicationId);
			const applicationWithHistory = {
				...updatedApplication,
				history: updatedHistory,
			};

			setApplications(
				applications.map((app) =>
					app.id === applicationId ? applicationWithHistory : app
				)
			);

			if (selectedApplication?.id === applicationId) {
				setSelectedApplication(applicationWithHistory);
			}
		} catch (error) {
			console.error("Error updating application status:", error);
			alert(
				"Failed to update status. API endpoint may not be implemented yet."
			);
		}
	};

	const getDocumentTypeName = (type: string): string => {
		const documentTypeMap: Record<string, string> = {
			ID: "Identification Document",
			PAYSLIP: "Pay Slip",
			BANK_STATEMENT: "Bank Statement",
			UTILITY_BILL: "Utility Bill",
			EMPLOYMENT_LETTER: "Employment Letter",
			OTHER: "Other Document",
		};

		return documentTypeMap[type] || type;
	};

	const getDocumentStatusColor = (
		status: string
	): { bg: string; text: string } => {
		const statusMap: Record<string, { bg: string; text: string }> = {
			PENDING: { bg: "bg-yellow-100", text: "text-yellow-800" },
			APPROVED: { bg: "bg-green-100", text: "text-green-800" },
			REJECTED: { bg: "bg-red-100", text: "text-red-800" },
		};

		return (
			statusMap[status] || { bg: "bg-gray-100", text: "text-gray-800" }
		);
	};

	// Format document URL by prepending backend URL if it's a relative path
	const formatDocumentUrl = (fileUrl: string): string => {
		if (!fileUrl) return "";

		// If the URL already includes http(s), it's already an absolute URL
		if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
			return fileUrl;
		}

		// For relative URLs, use the loan-applications API endpoint instead of direct file access
		if (selectedApplication) {
			return `${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${selectedApplication.id}/documents/${selectedDocument?.id}`;
		}

		// Fallback to old method if no application is selected (this shouldn't happen in normal usage)
		const backendUrl = process.env.NEXT_PUBLIC_API_URL;
		const cleanFileUrl = fileUrl.startsWith("/")
			? fileUrl.substring(1)
			: fileUrl;
		return `${backendUrl}/${cleanFileUrl}`;
	};

	// Handle document status change
	const handleDocumentStatusChange = async (
		documentId: string,
		newStatus: string
	) => {
		try {
			if (!selectedApplication) return;

			// Call the API to update document status
			const updatedDocument = await fetchWithAdminTokenRefresh<any>(
				`/api/admin/documents/${documentId}/status`,
				{
					method: "PATCH",
					body: JSON.stringify({ status: newStatus }),
				}
			);

			// Update the application in state with the new document status
			if (selectedApplication && selectedApplication.documents) {
				const updatedDocuments = selectedApplication.documents.map(
					(doc) =>
						doc.id === documentId
							? { ...doc, status: newStatus }
							: doc
				);

				setSelectedApplication({
					...selectedApplication,
					documents: updatedDocuments,
				});

				// Also update in the applications list
				setApplications(
					applications.map((app) =>
						app.id === selectedApplication.id
							? { ...app, documents: updatedDocuments }
							: app
					)
				);
			}

			console.log(
				`Document ${documentId} status updated to ${newStatus}`
			);
		} catch (error) {
			console.error("Error updating document status:", error);
			alert(
				"Failed to update document status. API endpoint may not be implemented yet."
			);
		}
	};

	// Add this function to get a user-friendly action description
	const getHistoryActionDescription = (
		previousStatus: string | null,
		newStatus: string
	): string => {
		if (!previousStatus) {
			return `Application created with status: ${getStatusLabel(
				newStatus
			)}`;
		}

		return `Status changed from ${getStatusLabel(
			previousStatus
		)} to ${getStatusLabel(newStatus)}`;
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
			title="Loan Applications"
			description="Manage all loan applications in the early stages of the workflow"
		>
			{/* Header with summary and refresh button */}
			<div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="text-xl font-semibold text-white mb-2">
						Application Management
					</h2>
					<p className="text-gray-400">
						Review and process applications at various stages
					</p>
				</div>
				<button
					onClick={handleRefresh}
					disabled={refreshing}
					className={`mt-4 md:mt-0 flex items-center px-4 py-2 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors ${
						refreshing ? "opacity-50 cursor-not-allowed" : ""
					}`}
				>
					<ArrowPathIcon
						className={`h-4 w-4 mr-2 ${
							refreshing ? "animate-spin" : ""
						}`}
					/>
					{refreshing ? "Refreshing..." : "Refresh Data"}
				</button>
			</div>

			{/* Status filter chips */}
			<div className="mb-6">
				<h3 className="text-white text-sm font-medium mb-3">
					Filter by status:
				</h3>
				<div className="flex flex-wrap gap-2">
					{[
						"INCOMPLETE",
						"PENDING_APP_FEE",
						"PENDING_KYC",
						"APPROVED",
						"PENDING_SIGNATURE",
						"REJECTED",
						"WITHDRAWN",
					].map((status) => {
						// Skip showing Pending Approval and Pending Disbursement filters
						if (
							status === "PENDING_APPROVAL" ||
							status === "PENDING_DISBURSEMENT"
						) {
							return null;
						}

						const isActive = selectedFilters.includes(status);
						const StatusIcon = getStatusIcon(status);
						return (
							<button
								key={status}
								onClick={() => toggleFilter(status)}
								className={`flex items-center px-3 py-1.5 rounded-full text-sm border transition-colors ${
									isActive
										? getStatusColor(status)
										: "bg-gray-800 text-gray-400 border-gray-700"
								}`}
							>
								<StatusIcon className="h-4 w-4 mr-1.5" />
								{getStatusLabel(status)}
							</button>
						);
					})}
				</div>
			</div>

			{/* Main content */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Panel - Application List */}
				<div className="lg:col-span-1">
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
						<div className="p-4 border-b border-gray-700/30 flex justify-between items-center">
							<h2 className="text-lg font-medium text-white">
								Applications
							</h2>
							<span className="px-2 py-1 bg-blue-500/20 text-blue-200 text-xs font-medium rounded-full border border-blue-400/20">
								{filteredApplications.length}
							</span>
						</div>
						<div className="overflow-y-auto max-h-[70vh]">
							{loading ? (
								<div className="flex justify-center items-center p-8">
									<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400"></div>
								</div>
							) : filteredApplications.length > 0 ? (
								<ul className="divide-y divide-gray-700/30">
									{filteredApplications.map((app) => {
										const StatusIcon = getStatusIcon(
											app.status
										);
										return (
											<li
												key={app.id}
												className={`p-4 hover:bg-gray-800/30 transition-colors cursor-pointer ${
													selectedApplication?.id ===
													app.id
														? "bg-gray-800/50"
														: ""
												}`}
												onClick={() =>
													handleViewClick(app)
												}
											>
												<div className="flex justify-between items-start">
													<div>
														<p className="text-white font-medium">
															{app.user
																?.fullName ||
																"Unknown"}
														</p>
														<p className="text-sm text-gray-400">
															{app.user?.email ||
																"N/A"}
														</p>
														<div className="mt-2 flex items-center text-sm text-gray-300">
															<CurrencyDollarIcon className="mr-1 h-4 w-4 text-blue-400" />
															{app.amount
																? formatCurrency(
																		app.amount
																  )
																: "Amount not set"}
														</div>
													</div>
													<div className="text-right">
														<div
															className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getStatusColor(
																app.status
															)}`}
														>
															<StatusIcon className="h-3 w-3 mr-1" />
															{getStatusLabel(
																app.status
															)}
														</div>
														<p className="text-xs text-gray-400 mt-1">
															Applied:{" "}
															{formatDate(
																app.createdAt
															)}
														</p>
														<p className="text-xs text-gray-400 mt-1">
															Product:{" "}
															{app.product
																?.name || "N/A"}
														</p>
													</div>
												</div>
											</li>
										);
									})}
								</ul>
							) : (
								<div className="p-8 text-center">
									<ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
									<p className="mt-4 text-gray-300">
										No applications found with the selected
										filters
									</p>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Right Panel - Application Details */}
				<div className="lg:col-span-2">
					{selectedApplication ? (
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
							<div className="p-6">
								<div className="flex justify-between items-center mb-6">
									<div className="flex items-center">
										<button
											onClick={handleViewClose}
											className="mr-3 p-1 rounded-full bg-gray-700/50 hover:bg-gray-700/70 text-gray-300"
										>
											<svg
												className="w-5 h-5"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												xmlns="http://www.w3.org/2000/svg"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M15 19l-7-7 7-7"
												/>
											</svg>
										</button>
										<h3 className="text-xl font-semibold text-white">
											Application Details
										</h3>
									</div>
									<div
										className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${getStatusColor(
											selectedApplication.status
										)}`}
									>
										<span className="mr-1.5">
											{getStatusLabel(
												selectedApplication.status
											)}
										</span>
									</div>
								</div>

								{/* Tab Navigation */}
								<div className="flex border-b border-gray-700/30 mb-6">
									<div
										className={`px-4 py-2 cursor-pointer transition-colors ${
											selectedTab === "details"
												? "border-b-2 border-blue-400 font-medium text-white"
												: "text-gray-400 hover:text-gray-200"
										}`}
										onClick={() =>
											setSelectedTab("details")
										}
									>
										Details
									</div>
									<div
										className={`px-4 py-2 cursor-pointer transition-colors ${
											selectedTab === "documents"
												? "border-b-2 border-blue-400 font-medium text-white"
												: "text-gray-400 hover:text-gray-200"
										}`}
										onClick={() =>
											setSelectedTab("documents")
										}
									>
										Documents
									</div>
									<div
										className={`px-4 py-2 cursor-pointer transition-colors ${
											selectedTab === "audit"
												? "border-b-2 border-blue-400 font-medium text-white"
												: "text-gray-400 hover:text-gray-200"
										}`}
										onClick={() => setSelectedTab("audit")}
									>
										Audit Trail
									</div>
									<div
										className={`px-4 py-2 cursor-pointer transition-colors ${
											selectedTab === "actions"
												? "border-b-2 border-blue-400 font-medium text-white"
												: "text-gray-400 hover:text-gray-200"
										}`}
										onClick={() =>
											setSelectedTab("actions")
										}
									>
										Actions
									</div>
								</div>

								{/* Tab Content */}
								{selectedTab === "details" && (
									<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
										{/* Applicant Information */}
										<div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50">
											<h4 className="text-lg font-medium text-white mb-3 flex items-center">
												<UserCircleIcon className="h-5 w-5 mr-2 text-blue-400" />
												Applicant Information
											</h4>
											<div className="space-y-2 text-sm">
												<div>
													<span className="text-gray-400">
														Name:
													</span>{" "}
													<span className="text-white">
														{selectedApplication
															.user?.fullName ||
															"N/A"}
													</span>
												</div>
												<div>
													<span className="text-gray-400">
														Email:
													</span>{" "}
													<span className="text-white">
														{selectedApplication
															.user?.email ||
															"N/A"}
													</span>
												</div>
												<div>
													<span className="text-gray-400">
														Phone:
													</span>{" "}
													<span className="text-white">
														{selectedApplication
															.user
															?.phoneNumber ||
															"N/A"}
													</span>
												</div>
												{selectedApplication.user
													?.employmentStatus && (
													<div>
														<span className="text-gray-400">
															Employment:
														</span>{" "}
														<span className="text-white">
															{
																selectedApplication
																	.user
																	.employmentStatus
															}
														</span>
													</div>
												)}
												{selectedApplication.user
													?.employerName && (
													<div>
														<span className="text-gray-400">
															Employer:
														</span>{" "}
														<span className="text-white">
															{
																selectedApplication
																	.user
																	.employerName
															}
														</span>
													</div>
												)}
												{selectedApplication.user
													?.monthlyIncome && (
													<div>
														<span className="text-gray-400">
															Monthly Income:
														</span>{" "}
														<span className="text-white">
															{formatCurrency(
																parseFloat(
																	selectedApplication
																		.user
																		.monthlyIncome
																)
															)}
														</span>
													</div>
												)}
											</div>
										</div>

										{/* Loan Information */}
										<div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50">
											<h4 className="text-lg font-medium text-white mb-3 flex items-center">
												<CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-400" />
												Loan Information
											</h4>
											<div className="space-y-2 text-sm">
												<div>
													<span className="text-gray-400">
														Product:
													</span>{" "}
													<span className="text-white">
														{selectedApplication
															.product?.name ||
															"N/A"}
													</span>
												</div>
												<div>
													<span className="text-gray-400">
														Amount:
													</span>{" "}
													<span className="text-white">
														{selectedApplication.amount
															? formatCurrency(
																	selectedApplication.amount
															  )
															: "Not specified"}
													</span>
												</div>
												<div>
													<span className="text-gray-400">
														Term:
													</span>{" "}
													<span className="text-white">
														{selectedApplication.term
															? `${selectedApplication.term} months`
															: "Not specified"}
													</span>
												</div>
												<div>
													<span className="text-gray-400">
														Purpose:
													</span>{" "}
													<span className="text-white">
														{selectedApplication.purpose ||
															"Not specified"}
													</span>
												</div>
												<div>
													<span className="text-gray-400">
														Applied On:
													</span>{" "}
													<span className="text-white">
														{formatDate(
															selectedApplication.createdAt
														)}
													</span>
												</div>
												<div>
													<span className="text-gray-400">
														Last Updated:
													</span>{" "}
													<span className="text-white">
														{formatDate(
															selectedApplication.updatedAt
														)}
													</span>
												</div>
											</div>
										</div>
									</div>
								)}

								{/* Documents Tab */}
								{selectedTab === "documents" && (
									<div>
										{/* Application Documents */}
										{selectedApplication.documents &&
											selectedApplication.documents
												.length > 0 && (
												<div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50 mb-6">
													<h4 className="text-lg font-medium text-white mb-3 flex items-center">
														<DocumentTextIcon className="h-5 w-5 mr-2 text-amber-400" />
														Documents
													</h4>
													<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
														{selectedApplication.documents.map(
															(doc) => (
																<div
																	key={doc.id}
																	className="border border-gray-700/40 rounded-lg p-3 bg-gray-800/30"
																>
																	<div className="flex justify-between items-center mb-2">
																		<span className="text-sm font-medium text-white">
																			{getDocumentTypeName(
																				doc.type
																			)}
																		</span>
																		<span
																			className={`px-2 py-1 text-xs rounded-full ${
																				getDocumentStatusColor(
																					doc.status
																				)
																					.bg
																			} ${
																				getDocumentStatusColor(
																					doc.status
																				)
																					.text
																			}`}
																		>
																			{
																				doc.status
																			}
																		</span>
																	</div>
																	<div className="flex space-x-2 mt-2">
																		<a
																			href={formatDocumentUrl(
																				doc.fileUrl
																			)}
																			target="_blank"
																			rel="noopener noreferrer"
																			className="text-xs px-2 py-1 bg-blue-500/20 text-blue-200 rounded border border-blue-400/20 hover:bg-blue-500/30"
																		>
																			View
																		</a>
																		<button
																			onClick={() =>
																				handleDocumentStatusChange(
																					doc.id,
																					"APPROVED"
																				)
																			}
																			disabled={
																				doc.status ===
																				"APPROVED"
																			}
																			className={`text-xs px-2 py-1 rounded border ${
																				doc.status ===
																				"APPROVED"
																					? "bg-gray-700/50 text-gray-400 border-gray-600/50"
																					: "bg-green-500/20 text-green-200 border-green-400/20 hover:bg-green-500/30"
																			}`}
																		>
																			Approve
																		</button>
																		<button
																			onClick={() =>
																				handleDocumentStatusChange(
																					doc.id,
																					"REJECTED"
																				)
																			}
																			disabled={
																				doc.status ===
																				"REJECTED"
																			}
																			className={`text-xs px-2 py-1 rounded border ${
																				doc.status ===
																				"REJECTED"
																					? "bg-gray-700/50 text-gray-400 border-gray-600/50"
																					: "bg-red-500/20 text-red-200 border-red-400/20 hover:bg-red-500/30"
																			}`}
																		>
																			Reject
																		</button>
																	</div>
																</div>
															)
														)}
													</div>
												</div>
											)}
									</div>
								)}

								{/* Audit Trail Tab */}
								{selectedTab === "audit" && (
									<div>
										{/* Audit Trail Section */}
										<div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50 mb-6">
											<h4 className="text-lg font-medium text-white mb-3 flex items-center">
												<ClipboardDocumentCheckIcon className="h-5 w-5 mr-2 text-purple-400" />
												Audit Trail
											</h4>
											<div className="space-y-2">
												{selectedApplication.history &&
												selectedApplication.history
													.length > 0 ? (
													<div className="relative">
														<div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-600/50"></div>
														<ul className="space-y-4">
															{selectedApplication.history
																.sort(
																	(a, b) =>
																		new Date(
																			b.createdAt
																		).getTime() -
																		new Date(
																			a.createdAt
																		).getTime()
																)
																.map(
																	(
																		historyItem,
																		index
																	) => (
																		<li
																			key={
																				historyItem.id
																			}
																			className="relative pl-8"
																		>
																			<div className="absolute left-0 top-1.5 w-8 flex items-center justify-center">
																				<div
																					className={`w-3 h-3 rounded-full ${
																						index ===
																						0
																							? "bg-blue-400"
																							: "bg-gray-500"
																					}`}
																				></div>
																			</div>
																			<div className="border border-gray-700/30 rounded-lg p-3 bg-gray-800/20">
																				<div className="flex justify-between items-start mb-1">
																					<span className="text-sm font-medium text-white">
																						{getHistoryActionDescription(
																							historyItem.previousStatus,
																							historyItem.newStatus
																						)}
																					</span>
																					<span className="text-xs text-gray-400">
																						{new Date(
																							historyItem.createdAt
																						).toLocaleDateString(
																							"en-US",
																							{
																								year: "numeric",
																								month: "short",
																								day: "numeric",
																								hour: "2-digit",
																								minute: "2-digit",
																							}
																						)}
																					</span>
																				</div>
																				<div className="text-xs text-gray-400">
																					<span>
																						By:{" "}
																						{historyItem.changedBy ||
																							"System"}
																					</span>
																				</div>
																				{historyItem.notes && (
																					<div className="mt-2 text-xs text-gray-300 bg-gray-800/50 p-2 rounded border border-gray-700/30">
																						<span className="font-medium">
																							Notes:
																						</span>{" "}
																						{
																							historyItem.notes
																						}
																					</div>
																				)}
																			</div>
																		</li>
																	)
																)}
														</ul>
													</div>
												) : (
													<div className="text-center py-4">
														<ClockIcon className="mx-auto h-10 w-10 text-gray-500 mb-2" />
														<p className="text-gray-400">
															No history available
															for this application
														</p>
													</div>
												)}
											</div>
										</div>
									</div>
								)}

								{/* Actions Tab */}
								{selectedTab === "actions" && (
									<div>
										{/* Update Status Section */}
										<div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50 mb-6">
											<h4 className="text-lg font-medium text-white mb-3">
												Update Application Status
											</h4>
											<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
												{[
													"INCOMPLETE",
													"PENDING_APP_FEE",
													"PENDING_KYC",
													"APPROVED",
													"PENDING_SIGNATURE",
													"REJECTED",
													"WITHDRAWN",
												]
													.filter(
														(status) =>
															status !==
																"PENDING_APPROVAL" &&
															status !==
																"PENDING_DISBURSEMENT"
													)
													.map((status) => (
														<button
															key={status}
															onClick={() =>
																handleStatusChange(
																	selectedApplication.id,
																	status
																)
															}
															disabled={
																selectedApplication.status ===
																status
															}
															className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
																selectedApplication.status ===
																status
																	? "bg-gray-700/50 text-gray-400 border-gray-600/50 cursor-not-allowed"
																	: `${getStatusColor(
																			status
																	  )} hover:opacity-80`
															}`}
														>
															{getStatusLabel(
																status
															)}
														</button>
													))}
											</div>

											<div className="mt-3 p-3 bg-blue-500/10 border border-blue-400/20 rounded-lg">
												<p className="text-xs text-blue-200 mb-2">
													<span className="font-medium">
														Note:
													</span>{" "}
													For applications requiring
													credit decision or
													disbursement, please use the
													dedicated workflow pages.
												</p>
												<div className="flex flex-wrap gap-2">
													<Link
														href="/dashboard/applications/pending-decision"
														className="text-xs px-3 py-1.5 bg-amber-500/20 text-amber-200 rounded border border-amber-400/20 hover:bg-amber-500/30"
													>
														Go to Credit Decision
													</Link>
													<Link
														href="/dashboard/applications/pending-disbursement"
														className="text-xs px-3 py-1.5 bg-green-500/20 text-green-200 rounded border border-green-400/20 hover:bg-green-500/30"
													>
														Go to Disbursements
													</Link>
												</div>
											</div>
										</div>

										{/* Advanced Actions */}
										<div className="flex justify-end space-x-3">
											{/* Skip button for automated advancement */}
											{selectedApplication.status !==
												"APPROVED" &&
												selectedApplication.status !==
													"REJECTED" &&
												selectedApplication.status !==
													"WITHDRAWN" &&
												selectedApplication.status !==
													"PENDING_APPROVAL" &&
												selectedApplication.status !==
													"PENDING_DISBURSEMENT" && (
													<button
														onClick={() => {
															// Determine next status based on current status
															let nextStatus = "";
															switch (
																selectedApplication.status
															) {
																case "INCOMPLETE":
																	nextStatus =
																		"PENDING_APP_FEE";
																	break;
																case "PENDING_APP_FEE":
																	nextStatus =
																		"PENDING_KYC";
																	break;
																case "PENDING_KYC":
																	nextStatus =
																		"PENDING_APPROVAL";
																	break;
																case "PENDING_SIGNATURE":
																	nextStatus =
																		"PENDING_DISBURSEMENT";
																	break;
																default:
																	return;
															}

															if (nextStatus) {
																handleStatusChange(
																	selectedApplication.id,
																	nextStatus
																);
															}
														}}
														className="flex items-center px-4 py-2 bg-blue-600/40 text-blue-100 rounded-lg border border-blue-500/40 hover:bg-blue-600/60 transition-colors"
													>
														<ArrowRightIcon className="h-4 w-4 mr-2" />
														Advance to Next Step
													</button>
												)}
										</div>
									</div>
								)}
							</div>
						</div>
					) : (
						<div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg p-10">
							<div className="text-center">
								<DocumentTextIcon className="h-16 w-16 text-gray-500 mx-auto mb-4" />
								<h3 className="text-xl font-medium text-white mb-2">
									Select an Application
								</h3>
								<p className="text-gray-400 max-w-md">
									Choose an application from the list to view
									its details and manage its status
								</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</AdminLayout>
	);
}
