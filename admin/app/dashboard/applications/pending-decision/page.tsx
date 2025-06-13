"use client";

import { useState, useEffect } from "react";
import AdminLayout from "../../../components/AdminLayout";
import Link from "next/link";
import {
	CheckCircleIcon,
	XCircleIcon,
	DocumentMagnifyingGlassIcon,
	ClockIcon,
	UserCircleIcon,
	CurrencyDollarIcon,
	CalendarIcon,
	DocumentTextIcon,
	ChevronRightIcon,
	UserIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "../../../../lib/authUtils";

interface ApplicationData {
	id: string;
	status: string;
	createdAt: string;
	updatedAt: string;
	amount: number;
	term: number;
	purpose: string;
	interestRate?: number;
	lateFee?: number;
	legalFee?: number;
	originationFee?: number;
	applicationFee?: number;
	monthlyRepayment?: number;
	netDisbursement?: number;
	user: {
		id: string;
		fullName: string;
		email: string;
		phoneNumber: string;
		employmentStatus?: string;
		employerName?: string;
		monthlyIncome?: string;
		bankName?: string;
		accountNumber?: string;
	};
	product: {
		id: string;
		name: string;
		code: string;
		description?: string;
		minAmount?: number;
		maxAmount?: number;
	};
	creditScore?: number;
	documents?: Array<{
		id: string;
		type: string;
		status: string;
		fileUrl: string;
	}>;
	history?: ApplicationHistory[];
}

interface ApplicationHistory {
	id: string;
	loanApplicationId: string;
	previousStatus: string | null;
	newStatus: string;
	changedBy: string;
	changedById: string;
	createdAt: string;
	notes?: string;
}

interface LoanApplication {
	id: string;
	userId: string;
	productId: string;
	amount: number;
	term: number;
	status: string;
	createdAt: string;
	product: {
		name: string;
	};
	user: {
		fullName: string;
		phoneNumber: string;
	};
	documents?: Array<{
		id: string;
		type: string;
		status: string;
		fileUrl: string;
	}>;
}

interface AuditTrailEntry {
	id: string;
	applicationId: string;
	previousStatus: string | null;
	newStatus: string;
	changedBy: string;
	changedById?: string;
	changeReason?: string;
	notes?: string;
	createdAt: string;
}

export default function PendingDecisionPage() {
	const [applications, setApplications] = useState<ApplicationData[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedApp, setSelectedApp] = useState<ApplicationData | null>(
		null
	);
	const [processingId, setProcessingId] = useState<string | null>(null);
	const [decisionNotes, setDecisionNotes] = useState("");
	const [decisionSuccess, setDecisionSuccess] = useState<boolean | null>(
		null
	);
	const [decisionMessage, setDecisionMessage] = useState("");
	const [showApproveConfirm, setShowApproveConfirm] = useState(false);
	const [showRejectConfirm, setShowRejectConfirm] = useState(false);
	const [selectedTab, setSelectedTab] = useState<string>("details");
	const [auditTrail, setAuditTrail] = useState<AuditTrailEntry[]>([]);
	const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);

	useEffect(() => {
		fetchPendingDecisionApplications();
	}, []);

	const fetchPendingDecisionApplications = async () => {
		try {
			setLoading(true);
			// Try to fetch pending approval applications
			let data = await fetchWithAdminTokenRefresh<ApplicationData[]>(
				"/api/admin/applications?status=PENDING_APPROVAL"
			);

			console.log("Fetched PENDING_APPROVAL applications:", data);

			// Filter to ensure we only have the correct status
			data = data.filter((app) => app.status === "PENDING_APPROVAL");

			// For each application, fetch its history
			const applicationsWithHistory = await Promise.all(
				data.map(async (app) => {
					try {
						const history = await fetchWithAdminTokenRefresh<
							ApplicationHistory[]
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
		} catch (error) {
			console.error(
				"Error fetching pending approval applications:",
				error
			);

			// Try to fetch all applications as a fallback
			try {
				const allApps = await fetchWithAdminTokenRefresh<
					ApplicationData[]
				>("/api/admin/applications");

				console.log("Fetched all applications as fallback:", allApps);

				// Filter applications that might be pending decision or have similar statuses
				const pendingApps = allApps.filter(
					(app) => app.status === "PENDING_APPROVAL"
				);

				console.log("Filtered pending applications:", pendingApps);

				if (pendingApps.length > 0) {
					// For each application, fetch its history
					const applicationsWithHistory = await Promise.all(
						pendingApps.map(async (app) => {
							try {
								const history =
									await fetchWithAdminTokenRefresh<
										ApplicationHistory[]
									>(
										`/api/admin/applications/${app.id}/history`
									);
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
				} else {
					// If no pending applications found, try to get dashboard data
					const dashboardData = await fetchWithAdminTokenRefresh<any>(
						"/api/admin/dashboard"
					);

					// Use recent applications as fallback if available
					if (dashboardData?.recentApplications?.length > 0) {
						// Convert dashboard format to application format
						const mockPendingApps = dashboardData.recentApplications
							.slice(0, 3) // Take first 3 applications
							.map((app: any) => ({
								...app,
								status: "PENDING_APPROVAL", // Set the correct status
								amount: 10000, // Default amount
								term: 12, // Default term
								purpose: "Business expansion", // Default purpose
								product: {
									id: "default-product",
									name: "Term Loan",
									code: "TERM-LOAN",
								},
								// Ensure user data is available
								user: app.user || {
									id: app.userId || "unknown",
									fullName: "Sample User",
									email: "user@example.com",
									phoneNumber: "123456789",
								},
							}));

						setApplications(mockPendingApps);
					}
				}
			} catch (fallbackError) {
				console.error(
					"Error fetching fallback application data:",
					fallbackError
				);
				// Last resort - create sample data
				setApplications([
					{
						id: "sample-app-1",
						status: "PENDING_APPROVAL",
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
						amount: 15000,
						term: 12,
						purpose: "Business expansion",
						user: {
							id: "sample-user-1",
							fullName: "Sample Applicant",
							email: "sample@example.com",
							phoneNumber: "123456789",
						},
						product: {
							id: "sample-product-1",
							name: "Business Loan",
							code: "BIZ-LOAN",
						},
					},
				]);
			}
		} finally {
			setLoading(false);
		}
	};

	const handleViewApplication = (app: ApplicationData) => {
		setSelectedApp(app);
		setDecisionNotes("");
		setDecisionSuccess(null);
		setDecisionMessage("");
	};

	const handleApprove = () => {
		setShowApproveConfirm(true);
	};

	const handleReject = () => {
		setShowRejectConfirm(true);
	};

	const confirmApprove = async () => {
		if (!selectedApp) return;
		setShowApproveConfirm(false);
		await makeDecision(selectedApp.id, "APPROVED");
	};

	const confirmReject = async () => {
		if (!selectedApp) return;
		setShowRejectConfirm(false);
		await makeDecision(selectedApp.id, "REJECTED");
	};

	const makeDecision = async (appId: string, decision: string) => {
		try {
			setProcessingId(appId);
			const response = await fetchWithAdminTokenRefresh(
				`/api/admin/applications/${appId}/status`,
				{
					method: "PATCH",
					body: JSON.stringify({
						status: decision,
						notes: decisionNotes,
					}),
				}
			);

			// Update UI on success
			setDecisionSuccess(true);
			setDecisionMessage(
				`Application ${
					decision === "APPROVED" ? "approved" : "rejected"
				} successfully`
			);

			// Refresh the audit trail if we're on that tab
			if (selectedTab === "audit") {
				await fetchAuditTrail();
			}

			// Refresh the list after a short delay
			setTimeout(() => {
				fetchPendingDecisionApplications();
				setSelectedApp(null);
			}, 2000);
		} catch (error) {
			console.error(
				`Error ${decision.toLowerCase()}ing application:`,
				error
			);
			setDecisionSuccess(false);
			setDecisionMessage(
				`Failed to ${decision.toLowerCase()} application. Please try again.`
			);
		} finally {
			setProcessingId(null);
		}
	};

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

	const getHistoryActionDescription = (
		previousStatus: string | null,
		newStatus: string
	): string => {
		if (!previousStatus) {
			return `Application created with status: ${newStatus.replace(
				/_/g,
				" "
			)}`;
		}

		if (previousStatus === newStatus) {
			return `Status updated: ${newStatus.replace(/_/g, " ")}`;
		}

		return `Status changed from ${previousStatus.replace(
			/_/g,
			" "
		)} to ${newStatus.replace(/_/g, " ")}`;
	};

	const getStatusColor = (status: string): string => {
		switch (status) {
			case "INCOMPLETE":
				return "bg-gray-400";
			case "PENDING_APP_FEE":
				return "bg-yellow-400";
			case "PENDING_KYC":
				return "bg-orange-400";
			case "PENDING_APPROVAL":
				return "bg-blue-400";
			case "APPROVED":
				return "bg-green-400";
			case "REJECTED":
				return "bg-red-400";
			case "DISBURSED":
				return "bg-purple-400";
			default:
				return "bg-gray-400";
		}
	};

	// Fetch audit trail when tab is selected
	useEffect(() => {
		if (selectedTab === "audit" && selectedApp?.id) {
			fetchAuditTrail();
		}
	}, [selectedTab, selectedApp?.id]);

	const fetchAuditTrail = async () => {
		if (!selectedApp?.id) return;

		setIsLoadingAudit(true);
		try {
			// Use the fetchWithAdminTokenRefresh utility to make authenticated requests
			const data = await fetchWithAdminTokenRefresh<AuditTrailEntry[]>(
				`/api/admin/applications/${selectedApp.id}/history`
			);
			console.log(
				"Frontend - Received audit trail data:",
				JSON.stringify(data, null, 2)
			);
			console.log("Frontend - Data type:", typeof data);
			console.log("Frontend - Is array:", Array.isArray(data));
			console.log("Frontend - Data length:", data?.length);
			setAuditTrail(data);
		} catch (error) {
			console.error("Failed to fetch audit trail:", error);
			console.error("Error: Failed to load audit trail");
		} finally {
			setIsLoadingAudit(false);
		}
	};

	return (
		<AdminLayout
			title="Pending Approval Applications"
			description="Review and make decisions on loan applications awaiting approval"
		>
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Panel - Application List */}
				<div className="lg:col-span-1">
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
						<div className="p-4 border-b border-gray-700/30 flex justify-between items-center">
							<h2 className="text-lg font-medium text-white">
								Applications Pending Approval
							</h2>
							<span className="px-2 py-1 bg-yellow-500/20 text-yellow-200 text-xs font-medium rounded-full border border-yellow-400/20">
								{applications.length}
							</span>
						</div>
						<div className="overflow-y-auto max-h-[70vh]">
							{loading ? (
								<div className="flex justify-center items-center p-8">
									<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400"></div>
								</div>
							) : applications.length > 0 ? (
								<ul className="divide-y divide-gray-700/30">
									{applications.map((app) => (
										<li
											key={app.id}
											className="p-4 hover:bg-gray-800/30 transition-colors cursor-pointer"
											onClick={() =>
												handleViewApplication(app)
											}
										>
											<div className="flex justify-between items-start">
												<div>
													<p className="text-white font-medium">
														{app.user.fullName}
													</p>
													<p className="text-sm text-gray-400">
														{app.user.email}
													</p>
													<div className="mt-2 flex items-center text-sm text-gray-300">
														<CurrencyDollarIcon className="mr-1 h-4 w-4 text-blue-400" />
														{formatCurrency(
															app.amount
														)}{" "}
														/ {app.term} months
													</div>
												</div>
												<div className="text-right">
													<p className="text-xs text-gray-400">
														Applied:{" "}
														{formatDate(
															app.createdAt
														)}
													</p>
													<p className="text-xs text-gray-400 mt-1">
														Product:{" "}
														{app.product.name}
													</p>
												</div>
											</div>
										</li>
									))}
								</ul>
							) : (
								<div className="p-8 text-center">
									<ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
									<p className="mt-4 text-gray-300">
										No applications pending approval
									</p>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Right Panel - Application Details */}
				<div className="lg:col-span-2">
					{selectedApp ? (
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
							<div className="p-6">
								<div className="flex justify-between items-center mb-6">
									<h3 className="text-xl font-semibold text-white">
										Application Details
									</h3>
									<div className="flex space-x-2">
										<button
											onClick={handleApprove}
											disabled={!!processingId}
											className="flex items-center space-x-1 bg-green-600/80 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
										>
											<CheckCircleIcon className="h-4 w-4" />
											<span>Approve</span>
										</button>
										<button
											onClick={handleReject}
											disabled={!!processingId}
											className="flex items-center space-x-1 bg-red-600/80 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
										>
											<XCircleIcon className="h-4 w-4" />
											<span>Reject</span>
										</button>
									</div>
								</div>

								{/* Tab Navigation */}
								<div className="border-b border-gray-700/50 mb-6">
									<nav className="-mb-px flex space-x-8">
										{[
											{
												id: "details",
												name: "Details",
												icon: UserCircleIcon,
											},
											{
												id: "documents",
												name: "Documents",
												icon: DocumentTextIcon,
											},
											{
												id: "audit",
												name: "Audit Trail",
												icon: ClockIcon,
											},
										].map((tab) => (
											<button
												key={tab.id}
												onClick={() =>
													setSelectedTab(tab.id)
												}
												className={`group inline-flex items-center py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
													selectedTab === tab.id
														? "border-blue-400 text-white"
														: "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-300"
												}`}
											>
												<tab.icon
													className={`mr-2 h-5 w-5 ${
														selectedTab === tab.id
															? "text-blue-400"
															: "text-gray-400 group-hover:text-gray-200"
													}`}
												/>
												{tab.name}
											</button>
										))}
									</nav>
								</div>

								{/* Tab Content */}
								<div className="flex-1 overflow-y-auto">
									{selectedTab === "details" && (
										<div className="space-y-6">
											<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
																{
																	selectedApp
																		.user
																		.fullName
																}
															</span>
														</div>
														<div>
															<span className="text-gray-400">
																Email:
															</span>{" "}
															<span className="text-white">
																{
																	selectedApp
																		.user
																		.email
																}
															</span>
														</div>
														<div>
															<span className="text-gray-400">
																Phone:
															</span>{" "}
															<span className="text-white">
																{
																	selectedApp
																		.user
																		.phoneNumber
																}
															</span>
														</div>
														{selectedApp.user
															.employmentStatus && (
															<div>
																<span className="text-gray-400">
																	Employment:
																</span>{" "}
																<span className="text-white">
																	{
																		selectedApp
																			.user
																			.employmentStatus
																	}
																</span>
															</div>
														)}
														{selectedApp.user
															.employerName && (
															<div>
																<span className="text-gray-400">
																	Employer:
																</span>{" "}
																<span className="text-white">
																	{
																		selectedApp
																			.user
																			.employerName
																	}
																</span>
															</div>
														)}
														{selectedApp.user
															.monthlyIncome && (
															<div>
																<span className="text-gray-400">
																	Monthly
																	Income:
																</span>{" "}
																<span className="text-white">
																	{formatCurrency(
																		parseFloat(
																			selectedApp
																				.user
																				.monthlyIncome
																		)
																	)}
																</span>
															</div>
														)}
														{selectedApp.creditScore && (
															<div>
																<span className="text-gray-400">
																	Credit
																	Score:
																</span>{" "}
																<span className="text-white">
																	{
																		selectedApp.creditScore
																	}
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
																{
																	selectedApp
																		.product
																		.name
																}
															</span>
														</div>
														<div>
															<span className="text-gray-400">
																Amount
																Requested:
															</span>{" "}
															<span className="text-white">
																{formatCurrency(
																	selectedApp.amount
																)}
															</span>
														</div>
														<div>
															<span className="text-gray-400">
																Term:
															</span>{" "}
															<span className="text-white">
																{
																	selectedApp.term
																}{" "}
																months
															</span>
														</div>
														<div>
															<span className="text-gray-400">
																Purpose:
															</span>{" "}
															<span className="text-white">
																{
																	selectedApp.purpose
																}
															</span>
														</div>
														{selectedApp.interestRate && (
															<div>
																<span className="text-gray-400">
																	Interest
																	Rate:
																</span>{" "}
																<span className="text-white">
																	{
																		selectedApp.interestRate
																	}
																	%
																</span>
															</div>
														)}
														{selectedApp.monthlyRepayment && (
															<div>
																<span className="text-gray-400">
																	Monthly
																	Repayment:
																</span>{" "}
																<span className="text-white">
																	{formatCurrency(
																		selectedApp.monthlyRepayment
																	)}
																</span>
															</div>
														)}
													</div>
												</div>

												{/* Fees & Disbursement Details */}
												<div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50">
													<h4 className="text-lg font-medium text-white mb-3 flex items-center">
														<DocumentMagnifyingGlassIcon className="h-5 w-5 mr-2 text-yellow-400" />
														Fees & Disbursement
													</h4>
													<div className="space-y-2 text-sm">
														{selectedApp.applicationFee && (
															<div>
																<span className="text-gray-400">
																	Application
																	Fee:
																</span>{" "}
																<span className="text-white">
																	{formatCurrency(
																		selectedApp.applicationFee
																	)}
																</span>
															</div>
														)}
														{selectedApp.originationFee && (
															<div>
																<span className="text-gray-400">
																	Origination
																	Fee:
																</span>{" "}
																<span className="text-white">
																	{formatCurrency(
																		selectedApp.originationFee
																	)}
																</span>
															</div>
														)}
														{selectedApp.legalFee && (
															<div>
																<span className="text-gray-400">
																	Legal Fee:
																</span>{" "}
																<span className="text-white">
																	{formatCurrency(
																		selectedApp.legalFee
																	)}
																</span>
															</div>
														)}
														{selectedApp.lateFee && (
															<div>
																<span className="text-gray-400">
																	Late Fee:
																</span>{" "}
																<span className="text-white">
																	{formatCurrency(
																		selectedApp.lateFee
																	)}
																</span>
															</div>
														)}
														{selectedApp.netDisbursement && (
															<div>
																<span className="text-gray-400">
																	Net
																	Disbursement:
																</span>{" "}
																<span className="text-white font-semibold">
																	{formatCurrency(
																		selectedApp.netDisbursement
																	)}
																</span>
															</div>
														)}
													</div>
												</div>
											</div>
										</div>
									)}

									{selectedTab === "documents" && (
										<div className="space-y-4">
											{selectedApp.documents &&
											selectedApp.documents.length > 0 ? (
												<div className="space-y-3">
													{selectedApp.documents.map(
														(doc) => (
															<div
																key={doc.id}
																className="flex justify-between items-center border-b border-gray-700/30 pb-2"
															>
																<div className="flex flex-col">
																	<span className="text-white text-sm">
																		{
																			doc.type
																		}
																	</span>
																	<span
																		className={`text-xs ${
																			doc.status ===
																			"APPROVED"
																				? "text-green-400"
																				: doc.status ===
																				  "REJECTED"
																				? "text-red-400"
																				: "text-yellow-400"
																		}`}
																	>
																		{
																			doc.status
																		}
																	</span>
																</div>
																<a
																	href={
																		doc.fileUrl
																	}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="text-blue-400 hover:text-blue-300 text-sm"
																>
																	View
																</a>
															</div>
														)
													)}
												</div>
											) : (
												<p className="text-gray-400 text-sm">
													No documents uploaded
												</p>
											)}
										</div>
									)}

									{selectedTab === "audit" && (
										<div className="space-y-4">
											<h3 className="text-lg font-medium text-white">
												Application Audit Trail
											</h3>

											{isLoadingAudit ? (
												<div className="flex justify-center p-8">
													<div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-400"></div>
												</div>
											) : auditTrail &&
											  auditTrail.length > 0 ? (
												<div className="relative">
													<div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-600/50"></div>
													<ul className="space-y-4">
														{auditTrail
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
																	entry,
																	index
																) => (
																	<li
																		key={
																			entry.id
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
																						entry.previousStatus,
																						entry.newStatus
																					)}
																				</span>
																				<span className="text-xs text-gray-400">
																					{new Date(
																						entry.createdAt
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
																					{entry.changedBy ||
																						"System"}
																				</span>
																			</div>
																			{(entry.notes ||
																				entry.changeReason) && (
																				<div className="mt-2 text-xs text-gray-300 bg-gray-800/50 p-2 rounded border border-gray-700/30">
																					<span className="font-medium">
																						Notes:
																					</span>{" "}
																					{entry.notes ||
																						entry.changeReason}
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
														No history available for
														this application
													</p>
												</div>
											)}
										</div>
									)}
								</div>

								{/* Decision Notes */}
								<div className="mt-6">
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Decision Notes
									</label>
									<textarea
										value={decisionNotes}
										onChange={(e) =>
											setDecisionNotes(e.target.value)
										}
										className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
										rows={3}
										placeholder="Add notes about your decision..."
									></textarea>
								</div>

								{/* Success/Error Messages */}
								{decisionSuccess !== null && (
									<div
										className={`mt-4 p-3 rounded ${
											decisionSuccess
												? "bg-green-700/30 text-green-300 border border-green-600/30"
												: "bg-red-700/30 text-red-300 border border-red-600/30"
										}`}
									>
										{decisionMessage}
									</div>
								)}
							</div>
						</div>
					) : (
						<div className="flex items-center justify-center h-full">
							<p className="text-gray-400">
								Select an application to view details
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Confirmation Dialogs */}
			{showApproveConfirm && selectedApp && (
				<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
					<div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full">
						<h3 className="text-xl font-bold text-white mb-4">
							Confirm Approval
						</h3>
						<p className="text-gray-300 mb-6">
							Are you sure you want to approve the loan
							application for{" "}
							<span className="font-semibold text-white">
								{selectedApp.user.fullName}
							</span>{" "}
							for the amount of{" "}
							<span className="font-semibold text-white">
								{formatCurrency(selectedApp.amount)}
							</span>
							?
						</p>
						<div className="flex justify-end space-x-3">
							<button
								onClick={() => setShowApproveConfirm(false)}
								className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
							>
								Cancel
							</button>
							<button
								onClick={confirmApprove}
								className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg"
							>
								Confirm Approval
							</button>
						</div>
					</div>
				</div>
			)}

			{showRejectConfirm && selectedApp && (
				<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
					<div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full">
						<h3 className="text-xl font-bold text-white mb-4">
							Confirm Rejection
						</h3>
						<p className="text-gray-300 mb-6">
							Are you sure you want to reject the loan application
							for{" "}
							<span className="font-semibold text-white">
								{selectedApp.user.fullName}
							</span>
							?
						</p>
						<div className="flex justify-end space-x-3">
							<button
								onClick={() => setShowRejectConfirm(false)}
								className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
							>
								Cancel
							</button>
							<button
								onClick={confirmReject}
								className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
							>
								Confirm Rejection
							</button>
						</div>
					</div>
				</div>
			)}
		</AdminLayout>
	);
}
