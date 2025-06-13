"use client";

import { useState, useEffect } from "react";
import AdminLayout from "../../../components/AdminLayout";
import Link from "next/link";
import {
	CheckCircleIcon,
	BanknotesIcon,
	DocumentTextIcon,
	ClockIcon,
	UserCircleIcon,
	CurrencyDollarIcon,
	CalendarIcon,
	DocumentDuplicateIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "../../../../lib/authUtils";
import { useRouter } from "next/navigation";

interface ApplicationData {
	id: string;
	status: string;
	createdAt: string;
	updatedAt: string;
	approvedAt?: string;
	amount: number;
	term: number;
	purpose?: string;
	monthlyPayment?: number;
	interestRate?: number;
	applicationFee?: number;
	originationFee?: number;
	legalFee?: number;
	lateFee?: number;
	netDisbursement?: number;
	user: {
		id: string;
		fullName: string;
		email: string;
		phoneNumber: string;
		bankName?: string;
		bankAccountNumber?: string;
		employmentStatus?: string;
		employerName?: string;
		monthlyIncome?: string;
	};
	product: {
		id: string;
		name: string;
		code: string;
		description?: string;
	};
	documents?: any[];
	history?: ApplicationHistory[];
}

interface UserDetailData {
	id: string;
	fullName?: string;
	email?: string;
	phoneNumber?: string;
	bankName?: string;
	accountNumber?: string;
	employmentStatus?: string;
	employerName?: string;
	monthlyIncome?: string;
	role?: string;
	createdAt?: string;
	dateOfBirth?: string;
	address1?: string;
	address2?: string;
	city?: string;
	state?: string;
	zipCode?: string;
	onboardingStep?: string;
	kycStatus?: string;
	lastLoginAt?: string;
}

// Add interface for Application History
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

// Generate a reference number
const generateReferenceNumber = (): string => {
	return `DISB-${Date.now()}`;
};

// Add a copy to clipboard function
const copyToClipboard = (text: string) => {
	navigator.clipboard
		.writeText(text)
		.then(() => {
			toast.success("Copied to clipboard!");
		})
		.catch((err) => {
			console.error("Failed to copy text: ", err);
			toast.error("Failed to copy to clipboard");
		});
};

// Create a simple toast function since we can't import react-hot-toast yet
const toast = {
	success: (message: string) => {
		console.log(`Success: ${message}`);
		alert(message);
	},
	error: (message: string) => {
		console.error(`Error: ${message}`);
		alert(`Error: ${message}`);
	},
};

export default function PendingDisbursementPage() {
	const [applications, setApplications] = useState<ApplicationData[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedApp, setSelectedApp] = useState<ApplicationData | null>(
		null
	);
	const [processingId, setProcessingId] = useState<string>("");
	const [disbursementNotes, setDisbursementNotes] = useState("");
	const [disbursementSuccess, setDisbursementSuccess] = useState<
		boolean | null
	>(null);
	const [disbursementMessage, setDisbursementMessage] = useState("");
	const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
	const [generatedReference, setGeneratedReference] = useState<string>("");
	const [activeTab, setActiveTab] = useState<string>("actions");

	useEffect(() => {
		fetchPendingDisbursements();
	}, []);

	// Reset to actions tab when selecting a new application
	useEffect(() => {
		if (selectedApp) {
			setActiveTab("actions");
		}
	}, [selectedApp]);

	const fetchPendingDisbursements = async () => {
		try {
			setLoading(true);
			// Try to fetch pending disbursement applications with comprehensive user data
			console.log("Fetching pending disbursement applications...");
			const data = await fetchWithAdminTokenRefresh<ApplicationData[]>(
				"/api/admin/applications?status=PENDING_DISBURSEMENT&include=user,product"
			);

			console.log(`Received ${data.length} applications from API`);

			// Debug data
			data.forEach((app, index) => {
				console.log(`Application ${index + 1} (${app.id}):`, {
					status: app.status,
					amount: app.amount,
					userName: app.user?.fullName || "Unknown",
					userId: app.user?.id || "Unknown",
					hasBankName: !!app.user?.bankName,
					hasBankAccount: !!app.user?.bankAccountNumber,
				});
			});

			// Ensure we only have PENDING_DISBURSEMENT status
			const filteredData = data.filter(
				(app) => app.status === "PENDING_DISBURSEMENT"
			);

			console.log(
				`Filtered to ${filteredData.length} pending disbursement applications`
			);

			// For each application, fetch its history
			const applicationsWithHistory = await Promise.all(
				filteredData.map(async (app) => {
					try {
						// Fetch history data
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

			// If we have applications but no bank details, try to fetch full user data separately
			for (let i = 0; i < applicationsWithHistory.length; i++) {
				const app = applicationsWithHistory[i];
				if (
					app.user &&
					(!app.user.bankName || !app.user.bankAccountNumber)
				) {
					try {
						console.log(`Fetching details for user ${app.user.id}`);
						// Fetch complete user data
						const userData =
							await fetchWithAdminTokenRefresh<UserDetailData>(
								`/api/admin/users/${app.user.id}`
							);
						// Update user data in our application object
						if (userData) {
							console.log(
								`Received user data for ${app.user.id}:`,
								userData
							);
							applicationsWithHistory[i].user = {
								...applicationsWithHistory[i].user,
								bankName: userData.bankName || "",
								// Map accountNumber from backend to bankAccountNumber in our frontend model
								bankAccountNumber: userData.accountNumber || "",
								employmentStatus:
									userData.employmentStatus || "",
								employerName: userData.employerName || "",
								monthlyIncome: userData.monthlyIncome || "",
							};
							console.log(
								"Updated user data with bank details:",
								{
									bankName: userData.bankName,
									accountNumber: userData.accountNumber,
									employmentStatus: userData.employmentStatus,
								}
							);
						} else {
							console.log(
								`No user data returned for ${app.user.id}`
							);
						}
					} catch (userError) {
						console.error(
							`Error fetching details for user ${app.user.id}:`,
							userError
						);
					}
				}
			}

			setApplications(applicationsWithHistory);
		} catch (error) {
			console.error("Error fetching pending disbursements:", error);
			// Handle error or use fallback data
			setApplications([]);
		} finally {
			setLoading(false);
		}
	};

	const fetchApplicationHistory = async (applicationId: string) => {
		try {
			const history = await fetchWithAdminTokenRefresh<
				ApplicationHistory[]
			>(`/api/admin/applications/${applicationId}/history`);

			// Update the selected application's history
			if (selectedApp && selectedApp.id === applicationId) {
				setSelectedApp((prev) => (prev ? { ...prev, history } : null));
			}

			// Also update in the applications list
			setApplications((prev) =>
				prev.map((app) =>
					app.id === applicationId ? { ...app, history } : app
				)
			);
		} catch (error) {
			console.error(
				`Error fetching history for application ${applicationId}:`,
				error
			);
		}
	};

	const handleViewApplication = (app: ApplicationData) => {
		setSelectedApp(app);
		setDisbursementNotes("");
		setDisbursementSuccess(null);
		setDisbursementMessage("");
		// Generate a reference number when viewing application
		setGeneratedReference(generateReferenceNumber());
	};

	const handleConfirmDisbursement = () => {
		// Ensure reference number is set
		if (!generatedReference) {
			setGeneratedReference(generateReferenceNumber());
		}
		setConfirmDialogOpen(true);
	};

	const handleCompleteDisbursement = async () => {
		if (!selectedApp) return;
		setConfirmDialogOpen(false);

		try {
			setProcessingId(selectedApp.id);

			console.log(
				`Processing disbursement for application ${selectedApp.id}`
			);
			console.log(`Notes: ${disbursementNotes}`);
			console.log(`Reference: ${generatedReference}`);

			// Try the dedicated disburse endpoint
			try {
				// Prepare the request payload with the pre-generated reference number
				const payload = {
					notes: disbursementNotes,
					referenceNumber: generatedReference,
				};

				console.log("Disbursement payload:", payload);

				// Use the dedicated disburse endpoint
				const response = await fetchWithAdminTokenRefresh<any>(
					`/api/admin/applications/${selectedApp.id}/disburse`,
					{
						method: "POST",
						body: JSON.stringify(payload),
					}
				);

				// Update UI on success
				setDisbursementSuccess(true);
				setDisbursementMessage(
					`Loan disbursed successfully with reference: ${generatedReference}`
				);

				// Refresh the application history immediately
				await fetchApplicationHistory(selectedApp.id);

				// Refresh the list after a short delay
				setTimeout(() => {
					fetchPendingDisbursements();
					// Don't reset selectedApp so the admin can still see the details with the reference
				}, 2000);

				return;
			} catch (primaryError) {
				console.error(
					"Primary disbursement endpoint failed:",
					primaryError
				);

				// If the first attempt fails, try directly with the status endpoint as fallback
				try {
					console.log("Attempting fallback with status endpoint");

					// Prepare the fallback payload with the pre-generated reference number
					const fallbackPayload = {
						status: "DISBURSED",
						notes: disbursementNotes,
						referenceNumber: generatedReference,
					};

					console.log("Fallback payload:", fallbackPayload);

					const fallbackResponse =
						await fetchWithAdminTokenRefresh<any>(
							`/api/admin/applications/${selectedApp.id}/status`,
							{
								method: "PATCH",
								body: JSON.stringify(fallbackPayload),
							}
						);

					// Update UI on success
					setDisbursementSuccess(true);
					setDisbursementMessage(
						`Loan disbursed successfully (via fallback) with reference: ${generatedReference}`
					);

					// Refresh the application history immediately
					await fetchApplicationHistory(selectedApp.id);

					// Refresh the list after a short delay
					setTimeout(() => {
						fetchPendingDisbursements();
						// Don't reset selectedApp so the admin can still see the details with the reference
					}, 2000);

					return;
				} catch (fallbackError) {
					console.error(
						"Fallback disbursement also failed:",
						fallbackError
					);
					throw fallbackError; // Re-throw to be caught by outer catch block
				}
			}
		} catch (error) {
			console.error("Error disbursing loan:", error);
			setDisbursementSuccess(false);
			setDisbursementMessage(
				error instanceof Error
					? error.message
					: "Failed to disburse loan. Please try again."
			);
		} finally {
			setProcessingId("");
		}
	};

	// Function to refresh reference number
	const refreshReferenceNumber = () => {
		setGeneratedReference(generateReferenceNumber());
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-MY", {
			style: "currency",
			currency: "MYR",
		}).format(amount);
	};

	const formatDate = (dateString?: string) => {
		if (!dateString) return "N/A";
		return new Date(dateString).toLocaleDateString("en-MY", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	};

	const formatDateTime = (dateString?: string) => {
		if (!dateString) return "N/A";
		return new Date(dateString).toLocaleDateString("en-MY", {
			day: "numeric",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Helper function to get a user-friendly action description
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

		return `Status changed from ${previousStatus.replace(
			/_/g,
			" "
		)} to ${newStatus.replace(/_/g, " ")}`;
	};

	const renderTabContent = () => {
		if (!selectedApp) return null;

		switch (activeTab) {
			case "actions":
				return (
					<div className="space-y-6">
						{/* Disbursement Form */}
						<div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50">
							<h4 className="text-lg font-medium text-white mb-3 flex items-center">
								<BanknotesIcon className="h-5 w-5 mr-2 text-green-400" />
								Disbursement Information
							</h4>

							<div className="space-y-6">
								{/* Bank Details Section */}
								<div className="p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
									<h5 className="text-md font-medium text-white mb-3 flex items-center">
										<BanknotesIcon className="h-4 w-4 mr-2 text-blue-400" />
										Bank Details
									</h5>
									{selectedApp.user.bankName &&
									selectedApp.user.bankAccountNumber ? (
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
											<div>
												<span className="text-gray-400">
													Bank Name:
												</span>{" "}
												<span className="text-white">
													{selectedApp.user.bankName}
												</span>
											</div>
											<div>
												<span className="text-gray-400">
													Account Holder:
												</span>{" "}
												<span className="text-white">
													{selectedApp.user.fullName}
												</span>
											</div>
											<div className="md:col-span-2">
												<div className="flex items-center">
													<span className="text-gray-400 mr-2">
														Account Number:
													</span>
													<span className="text-white font-mono">
														{
															selectedApp.user
																.bankAccountNumber
														}
													</span>
													<button
														onClick={() =>
															copyToClipboard(
																selectedApp.user
																	.bankAccountNumber ||
																	""
															)
														}
														className="ml-2 text-blue-400 hover:text-blue-300 transition-colors"
														title="Copy account number"
													>
														<DocumentDuplicateIcon className="h-4 w-4" />
													</button>
												</div>
											</div>
											<div className="md:col-span-2">
												<div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-400/20 rounded">
													<span className="text-gray-300 font-medium">
														Net Disbursement Amount:
													</span>
													<span className="text-green-300 font-semibold text-lg">
														{formatCurrency(
															selectedApp.netDisbursement ||
																selectedApp.amount
														)}
													</span>
												</div>
											</div>
										</div>
									) : (
										<div className="p-3 bg-yellow-500/20 border border-yellow-400/20 rounded">
											<p className="text-yellow-200 text-sm mb-2">
												⚠️ Bank details are incomplete
												or missing. Please verify the
												customer's banking information
												before disbursing the loan.
											</p>
											<div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
												{selectedApp.user.bankName ? (
													<div>
														<span className="text-gray-400">
															Bank Name:
														</span>{" "}
														<span className="text-white">
															{
																selectedApp.user
																	.bankName
															}
														</span>
													</div>
												) : (
													<div>
														<span className="text-gray-400">
															Bank Name:
														</span>{" "}
														<span className="text-red-300">
															Not provided
														</span>
													</div>
												)}
												{selectedApp.user
													.bankAccountNumber ? (
													<div>
														<span className="text-gray-400">
															Account Number:
														</span>{" "}
														<span className="text-white">
															{
																selectedApp.user
																	.bankAccountNumber
															}
														</span>
													</div>
												) : (
													<div>
														<span className="text-gray-400">
															Account Number:
														</span>{" "}
														<span className="text-red-300">
															Not provided
														</span>
													</div>
												)}
											</div>
										</div>
									)}
								</div>

								{/* Reference Number Section */}
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Reference Number for Bank Transfer
									</label>
									<div className="flex items-center">
										<input
											type="text"
											value={generatedReference}
											readOnly
											className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-l text-white focus:outline-none"
										/>
										<button
											onClick={() =>
												copyToClipboard(
													generatedReference
												)
											}
											className="px-3 py-2 bg-gray-600 text-white rounded-r-l border border-gray-600 hover:bg-gray-500 transition-colors"
											title="Copy reference number"
										>
											<DocumentDuplicateIcon className="h-5 w-5" />
										</button>
										<button
											onClick={refreshReferenceNumber}
											className="px-3 py-2 bg-blue-600 text-white rounded-r border border-blue-600 hover:bg-blue-500 transition-colors"
											title="Generate new reference"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 24 24"
												fill="currentColor"
												className="h-5 w-5"
											>
												<path
													fillRule="evenodd"
													d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z"
													clipRule="evenodd"
												/>
											</svg>
										</button>
									</div>
									<p className="mt-1 text-xs text-gray-400">
										Use this reference number when making
										the bank transfer. You can copy it or
										generate a new one if needed.
									</p>
									<p className="mt-1 text-xs text-blue-400">
										This reference will be recorded with the
										disbursement.
									</p>
								</div>

								{/* Notes Section */}
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Disbursement Notes
									</label>
									<textarea
										value={disbursementNotes}
										onChange={(e) =>
											setDisbursementNotes(e.target.value)
										}
										className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
										placeholder="Add notes about this disbursement (optional)"
										rows={3}
									></textarea>
								</div>
							</div>
						</div>

						{/* Success/Error Message */}
						{disbursementSuccess !== null && (
							<div
								className={`p-3 rounded ${
									disbursementSuccess
										? "bg-green-700/30 text-green-300 border border-green-600/30"
										: "bg-red-700/30 text-red-300 border border-red-600/30"
								}`}
							>
								{disbursementMessage}
							</div>
						)}
					</div>
				);

			case "details":
				return (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* Applicant Information */}
						<div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50">
							<h4 className="text-lg font-medium text-white mb-3 flex items-center">
								<UserCircleIcon className="h-5 w-5 mr-2 text-blue-400" />
								Applicant Information
							</h4>
							<div className="space-y-2 text-sm">
								<div>
									<span className="text-gray-400">Name:</span>{" "}
									<span className="text-white">
										{selectedApp.user.fullName}
									</span>
								</div>
								<div>
									<span className="text-gray-400">
										Email:
									</span>{" "}
									<span className="text-white">
										{selectedApp.user.email}
									</span>
								</div>
								<div>
									<span className="text-gray-400">
										Phone:
									</span>{" "}
									<span className="text-white">
										{selectedApp.user.phoneNumber}
									</span>
								</div>
								{selectedApp.user.employmentStatus && (
									<div>
										<span className="text-gray-400">
											Employment:
										</span>{" "}
										<span className="text-white">
											{selectedApp.user.employmentStatus}
										</span>
									</div>
								)}
								{selectedApp.user.employerName && (
									<div>
										<span className="text-gray-400">
											Employer:
										</span>{" "}
										<span className="text-white">
											{selectedApp.user.employerName}
										</span>
									</div>
								)}
								{selectedApp.user.monthlyIncome && (
									<div>
										<span className="text-gray-400">
											Monthly Income:
										</span>{" "}
										<span className="text-white">
											{selectedApp.user.monthlyIncome}
										</span>
									</div>
								)}
							</div>
						</div>

						{/* Loan Details */}
						<div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50">
							<h4 className="text-lg font-medium text-white mb-3 flex items-center">
								<CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-400" />
								Loan Details
							</h4>
							<div className="space-y-2 text-sm">
								<div>
									<span className="text-gray-400">
										Product:
									</span>{" "}
									<span className="text-white">
										{selectedApp.product.name}
									</span>
								</div>
								<div>
									<span className="text-gray-400">
										Amount Requested:
									</span>{" "}
									<span className="text-white font-medium">
										{formatCurrency(selectedApp.amount)}
									</span>
								</div>
								<div>
									<span className="text-gray-400">Term:</span>{" "}
									<span className="text-white">
										{selectedApp.term} months
									</span>
								</div>
								{selectedApp.interestRate && (
									<div>
										<span className="text-gray-400">
											Interest Rate:
										</span>{" "}
										<span className="text-white">
											{selectedApp.interestRate}%
										</span>
									</div>
								)}
								{selectedApp.monthlyPayment && (
									<div>
										<span className="text-gray-400">
											Monthly Payment:
										</span>{" "}
										<span className="text-white">
											{formatCurrency(
												selectedApp.monthlyPayment
											)}
										</span>
									</div>
								)}
								<div>
									<span className="text-gray-400">
										Purpose:
									</span>{" "}
									<span className="text-white">
										{selectedApp.purpose || "Not specified"}
									</span>
								</div>
							</div>
						</div>

						{/* Fees & Disbursement */}
						<div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50 md:col-span-2">
							<h4 className="text-lg font-medium text-white mb-3 flex items-center">
								<BanknotesIcon className="h-5 w-5 mr-2 text-yellow-400" />
								Fees & Disbursement Breakdown
							</h4>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
								{selectedApp.applicationFee && (
									<div className="flex justify-between">
										<span className="text-gray-400">
											Application Fee:
										</span>
										<span className="text-white">
											{formatCurrency(
												selectedApp.applicationFee
											)}
										</span>
									</div>
								)}
								{selectedApp.originationFee && (
									<div className="flex justify-between">
										<span className="text-gray-400">
											Origination Fee:
										</span>
										<span className="text-white">
											{formatCurrency(
												selectedApp.originationFee
											)}
										</span>
									</div>
								)}
								{selectedApp.legalFee && (
									<div className="flex justify-between">
										<span className="text-gray-400">
											Legal Fee:
										</span>
										<span className="text-white">
											{formatCurrency(
												selectedApp.legalFee
											)}
										</span>
									</div>
								)}
								{selectedApp.lateFee && (
									<div className="flex justify-between">
										<span className="text-gray-400">
											Late Fee:
										</span>
										<span className="text-white">
											{formatCurrency(
												selectedApp.lateFee
											)}
										</span>
									</div>
								)}
								<div className="md:col-span-2 border-t border-gray-700 pt-3 mt-3">
									<div className="flex justify-between items-center">
										<span className="text-gray-400 font-medium text-base">
											Net Disbursement:
										</span>
										<span className="text-green-300 font-semibold text-xl">
											{formatCurrency(
												selectedApp.netDisbursement ||
													selectedApp.amount
											)}
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				);

			case "documents":
				return (
					<div className="space-y-4">
						<div className="text-center py-8">
							<DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
							<p className="mt-4 text-gray-300">
								Document management for disbursement
								applications coming soon
							</p>
						</div>
					</div>
				);

			case "audit-trail":
				return (
					<div className="space-y-4">
						{selectedApp.history &&
						selectedApp.history.length > 0 ? (
							<div className="space-y-3">
								{selectedApp.history
									.sort(
										(a, b) =>
											new Date(b.createdAt).getTime() -
											new Date(a.createdAt).getTime()
									)
									.map((historyItem, index) => (
										<div
											key={historyItem.id}
											className="flex items-start space-x-3 p-4 bg-gray-800/30 rounded-lg border border-gray-700/30"
										>
											<div className="flex-shrink-0 mt-1">
												<div
													className={`w-2 h-2 rounded-full ${
														index === 0
															? "bg-blue-400"
															: "bg-gray-500"
													}`}
												></div>
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center justify-between">
													<p className="text-sm font-medium text-white">
														{getHistoryActionDescription(
															historyItem.previousStatus,
															historyItem.newStatus
														)}
													</p>
													<p className="text-xs text-gray-400">
														{formatDateTime(
															historyItem.createdAt
														)}
													</p>
												</div>
												<p className="text-xs text-gray-400 mt-1">
													Changed by:{" "}
													{historyItem.changedBy ||
														"System"}
												</p>
												{historyItem.notes && (
													<div className="mt-2 p-2 bg-gray-700/50 rounded text-xs text-gray-300">
														<span className="font-medium">
															Notes:
														</span>{" "}
														{historyItem.notes}
													</div>
												)}
											</div>
										</div>
									))}
							</div>
						) : (
							<div className="text-center py-8">
								<ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
								<p className="mt-4 text-gray-300">
									No audit trail available for this
									application
								</p>
							</div>
						)}
					</div>
				);

			default:
				return null;
		}
	};

	return (
		<AdminLayout
			title="Pending Disbursement"
			description="Process and disburse approved loan applications"
		>
			{/* Confirmation Dialog */}
			{confirmDialogOpen && selectedApp && (
				<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
					<div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-lg w-full">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-xl font-bold text-white">
								Confirm Disbursement
							</h3>
							<button
								onClick={() => setConfirmDialogOpen(false)}
								className="text-gray-400 hover:text-white"
							>
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>

						<div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 mb-4">
							<div className="space-y-3">
								<div className="flex justify-between">
									<span className="text-gray-300">
										Applicant:
									</span>
									<span className="text-white font-medium">
										{selectedApp.user.fullName}
									</span>
								</div>

								<div className="flex justify-between">
									<span className="text-gray-300">
										Net Disbursement:
									</span>
									<span className="text-green-300 font-semibold">
										{formatCurrency(
											selectedApp.netDisbursement ||
												selectedApp.amount
										)}
									</span>
								</div>

								<div className="border-t border-gray-600 pt-2 mt-2">
									<div className="flex justify-between">
										<span className="text-gray-300">
											Bank Name:
										</span>
										<span className="text-white">
											{selectedApp.user.bankName ||
												"Not provided"}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-300">
											Account Number:
										</span>
										<span className="text-white">
											{selectedApp.user
												.bankAccountNumber ||
												"Not provided"}
										</span>
									</div>
								</div>

								<div className="border-t border-gray-600 pt-2 mt-2">
									<div className="flex justify-between items-center">
										<span className="text-gray-300">
											Reference Number:
										</span>
										<div className="flex items-center">
											<span className="text-white font-mono">
												{generatedReference}
											</span>
											<button
												onClick={() =>
													copyToClipboard(
														generatedReference
													)
												}
												className="ml-2 text-blue-400 hover:text-blue-300 transition-colors"
												title="Copy reference number"
											>
												<DocumentDuplicateIcon className="h-4 w-4" />
											</button>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
							<p className="text-yellow-200 text-sm">
								Please use the reference number above when
								making the bank transfer. Confirm disbursement
								after you've completed the transfer.
							</p>
						</div>

						<div className="flex justify-end space-x-3">
							<button
								onClick={() => setConfirmDialogOpen(false)}
								className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={handleCompleteDisbursement}
								disabled={processingId === selectedApp.id}
								className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors flex items-center"
							>
								{processingId === selectedApp.id ? (
									<>
										<div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
										Processing...
									</>
								) : (
									<>
										<CheckCircleIcon className="h-5 w-5 mr-2" />
										Confirm Disbursement
									</>
								)}
							</button>
						</div>
					</div>
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Panel - Application List */}
				<div className="lg:col-span-1">
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
						<div className="p-4 border-b border-gray-700/30 flex justify-between items-center">
							<h2 className="text-lg font-medium text-white">
								Approved Loans Pending Disbursement
							</h2>
							<span className="px-2 py-1 bg-green-500/20 text-green-200 text-xs font-medium rounded-full border border-green-400/20">
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
											className={`p-4 hover:bg-gray-800/30 transition-colors cursor-pointer ${
												selectedApp?.id === app.id
													? "bg-gray-800/50 border-l-4 border-blue-400"
													: ""
											}`}
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
														<CurrencyDollarIcon className="mr-1 h-4 w-4 text-green-400" />
														{formatCurrency(
															app.amount
														)}
													</div>
												</div>
												<div className="text-right">
													<p className="text-xs text-gray-400">
														Approved:{" "}
														{formatDate(
															app.approvedAt
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
										No applications pending disbursement
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
											onClick={handleConfirmDisbursement}
											disabled={!!processingId}
											className="flex items-center space-x-2 bg-green-600/80 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
										>
											<BanknotesIcon className="h-5 w-5" />
											<span>Disburse Loan</span>
										</button>
									</div>
								</div>

								{/* Tab Navigation */}
								<div className="border-b border-gray-700/50 mb-6">
									<nav className="-mb-px flex space-x-8">
										{[
											{
												id: "actions",
												name: "Disbursement",
												icon: BanknotesIcon,
											},
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
												id: "audit-trail",
												name: "Audit Trail",
												icon: ClockIcon,
											},
										].map((tab) => (
											<button
												key={tab.id}
												onClick={() =>
													setActiveTab(tab.id)
												}
												className={`group inline-flex items-center py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
													activeTab === tab.id
														? "border-blue-400 text-white"
														: "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-300"
												}`}
											>
												<tab.icon
													className={`mr-2 h-5 w-5 ${
														activeTab === tab.id
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
								{renderTabContent()}
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
		</AdminLayout>
	);
}
