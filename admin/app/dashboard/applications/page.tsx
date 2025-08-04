"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
	ArrowsUpDownIcon,
	XMarkIcon,
	ExclamationTriangleIcon,
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
	applicationId: string;
	previousStatus: string | null;
	newStatus: string;
	changedBy: string;
	changeReason?: string;
	notes?: string;
	metadata?: any;
	createdAt: string;
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

function AdminApplicationsPageContent() {
	const searchParams = useSearchParams();
	const filterParam = searchParams.get("filter");

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

	// Initialize filters based on URL parameter
	const getInitialFilters = () => {
		if (filterParam === "pending-approval") {
			return ["PENDING_APPROVAL", "COLLATERAL_REVIEW"];
		} else if (filterParam === "pending-disbursement") {
			return ["PENDING_DISBURSEMENT"];
		} else if (filterParam === "collateral-review") {
			return ["COLLATERAL_REVIEW"];
		} else {
			// Default "All Applications" view - show active workflow statuses, exclude rejected/withdrawn/incomplete
			return [
				"PENDING_APP_FEE",
				"PENDING_KYC",
				"PENDING_APPROVAL",
				"PENDING_FRESH_OFFER",
				"PENDING_ATTESTATION",
				"PENDING_SIGNATURE",
				"PENDING_DISBURSEMENT",
				"COLLATERAL_REVIEW",
			];
		}
	};

	const [selectedFilters, setSelectedFilters] = useState<string[]>(
		getInitialFilters()
	);

	// Additional states for approval, attestation, and disbursement
	const [decisionNotes, setDecisionNotes] = useState("");
	const [collateralNotes, setCollateralNotes] = useState("");
	const [disbursementNotes, setDisbursementNotes] = useState("");
	const [disbursementReference, setDisbursementReference] = useState("");
	const [processingDecision, setProcessingDecision] = useState(false);
	const [processingCollateral, setProcessingCollateral] = useState(false);
	const [processingDisbursement, setProcessingDisbursement] = useState(false);
	
	// Fresh offer states
	const [showFreshOfferForm, setShowFreshOfferForm] = useState(false);
	const [freshOfferAmount, setFreshOfferAmount] = useState("");
	const [freshOfferTerm, setFreshOfferTerm] = useState("");
	const [freshOfferInterestRate, setFreshOfferInterestRate] = useState("");
	const [freshOfferMonthlyRepayment, setFreshOfferMonthlyRepayment] = useState("");
	const [freshOfferNetDisbursement, setFreshOfferNetDisbursement] = useState("");
	const [freshOfferNotes, setFreshOfferNotes] = useState("");
	const [freshOfferProductId, setFreshOfferProductId] = useState("");
	const [products, setProducts] = useState<any[]>([]);
	const [processingFreshOffer, setProcessingFreshOffer] = useState(false);
	const [statusCheckInterval, setStatusCheckInterval] = useState<NodeJS.Timeout | null>(null);
	const [lastKnownStatus, setLastKnownStatus] = useState<string | null>(null);
	const [showStatusChangeAlert, setShowStatusChangeAlert] = useState(false);

	// Attestation states
	const [attestationType, setAttestationType] = useState<
		"IMMEDIATE" | "MEETING"
	>("IMMEDIATE");
	const [attestationNotes, setAttestationNotes] = useState("");
	const [attestationVideoWatched, setAttestationVideoWatched] =
		useState(false);
	const [attestationTermsAccepted, setAttestationTermsAccepted] =
		useState(false);
	const [meetingCompletedAt, setMeetingCompletedAt] = useState("");
	const [processingAttestation, setProcessingAttestation] = useState(false);

	// Generate disbursement reference when application is selected for disbursement
	useEffect(() => {
		if (
			selectedApplication &&
			selectedApplication.status === "PENDING_DISBURSEMENT"
		) {
			const reference = `DISB-${selectedApplication.id
				.slice(-8)
				.toUpperCase()}-${Date.now().toString().slice(-6)}`;
			setDisbursementReference(reference);
		}
	}, [selectedApplication]);

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
			case "PENDING_FRESH_OFFER":
				return ArrowsUpDownIcon;
			case "PENDING_ATTESTATION":
				return ClipboardDocumentCheckIcon;
			case "PENDING_SIGNATURE":
				return DocumentTextIcon;
			case "PENDING_DISBURSEMENT":
				return BanknotesIcon;
			case "COLLATERAL_REVIEW":
				return DocumentMagnifyingGlassIcon;
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
			case "PENDING_FRESH_OFFER":
				return "bg-pink-500/20 text-pink-200 border-pink-400/20";
			case "PENDING_ATTESTATION":
				return "bg-cyan-500/20 text-cyan-200 border-cyan-400/20";
			case "PENDING_SIGNATURE":
				return "bg-indigo-500/20 text-indigo-200 border-indigo-400/20";
			case "PENDING_DISBURSEMENT":
				return "bg-emerald-500/20 text-emerald-200 border-emerald-400/20";
			case "COLLATERAL_REVIEW":
				return "bg-orange-500/20 text-orange-200 border-orange-400/20";
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
			case "PENDING_FRESH_OFFER":
				return "Fresh Offer Pending";
			case "PENDING_ATTESTATION":
				return "Pending Attestation";
			case "PENDING_SIGNATURE":
				return "Pending Signature";
			case "PENDING_DISBURSEMENT":
				return "Pending Disbursement";
			case "COLLATERAL_REVIEW":
				return "Collateral Review";
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
							const historyData =
								await fetchWithAdminTokenRefresh<
									| {
											applicationId: string;
											currentStatus: string;
											timeline: LoanApplicationHistory[];
									  }
									| LoanApplicationHistory[]
								>(`/api/admin/applications/${app.id}/history`);

							// Handle both old array format and new object format
							let history: LoanApplicationHistory[] = [];
							if (Array.isArray(historyData)) {
								// Old format - direct array
								history = historyData;
							} else if (
								historyData &&
								typeof historyData === "object" &&
								"timeline" in historyData
							) {
								// New format - object with timeline property
								history = historyData.timeline || [];
							}

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

				// If there's a selected application, update it with fresh data
				if (selectedApplication) {
					const updatedApp = applicationsWithHistory.find(
						app => app.id === selectedApplication.id
					);
					if (updatedApp) {
						setSelectedApplication(updatedApp);
					}
				}

			} catch (appError) {
				console.error("Error fetching applications:", appError);
				setError("Failed to refresh applications. Please try again.");
			}
		} catch (error) {
			console.error("Error refreshing data:", error);
			setError("An unexpected error occurred during refresh.");
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
							const historyData =
								await fetchWithAdminTokenRefresh<
									| {
											applicationId: string;
											currentStatus: string;
											timeline: LoanApplicationHistory[];
									  }
									| LoanApplicationHistory[]
								>(`/api/admin/applications/${app.id}/history`);

							// Handle both old array format and new object format
							let history: LoanApplicationHistory[] = [];
							if (Array.isArray(historyData)) {
								// Old format - direct array
								history = historyData;
							} else if (
								historyData &&
								typeof historyData === "object" &&
								"timeline" in historyData
							) {
								// New format - object with timeline property
								history = historyData.timeline || [];
							}

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

	// Update filters when URL parameter changes
	useEffect(() => {
		setSelectedFilters(getInitialFilters());
	}, [filterParam]);

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

	// Filter applications based on search and status filters
	const filteredApplications = applications.filter((app) => {
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

	// Auto-select the first application when filtered results change
	useEffect(() => {
		// Auto-select the first application if there are results and no application is currently selected or selected application is not in filtered results
		if (
			filteredApplications.length > 0 &&
			(!selectedApplication ||
				!filteredApplications.find(
					(app) => app.id === selectedApplication.id
				))
		) {
			setSelectedApplication(filteredApplications[0]);
		}
		// Clear selection if no results
		else if (filteredApplications.length === 0) {
			setSelectedApplication(null);
		}
	}, [filteredApplications, selectedApplication]);

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

		// Auto-switch to appropriate tab based on status
		if (application.status === "PENDING_APPROVAL") {
			setSelectedTab("approval");
		} else if (application.status === "PENDING_ATTESTATION") {
			setSelectedTab("attestation");
		} else if (application.status === "PENDING_DISBURSEMENT") {
			setSelectedTab("disbursement");
		} else {
			setSelectedTab("details");
		}

		fetchApplicationHistory(application.id);
	};

	const handleViewClose = () => {
		setViewDialogOpen(false);
		setSelectedApplication(null);
		setDecisionNotes("");
		setDisbursementNotes("");
		setDisbursementReference("");
	};

	// Function to fetch updated history for an application
	const fetchApplicationHistory = async (applicationId: string) => {
		try {
			const historyData = await fetchWithAdminTokenRefresh<
				| {
						applicationId: string;
						currentStatus: string;
						timeline: LoanApplicationHistory[];
				  }
				| LoanApplicationHistory[]
			>(`/api/admin/applications/${applicationId}/history`);

			// Handle both old array format and new object format
			let history: LoanApplicationHistory[] = [];
			if (Array.isArray(historyData)) {
				// Old format - direct array
				history = historyData;
			} else if (
				historyData &&
				typeof historyData === "object" &&
				"timeline" in historyData
			) {
				// New format - object with timeline property
				history = historyData.timeline || [];
			}

			return history;
		} catch (error) {
			console.error(
				`Error fetching history for application ${applicationId}:`,
				error
			);
			return [];
		}
	};

	// Handle status change with optimistic locking and conflict detection
	const handleStatusChange = async (
		applicationId: string,
		newStatus: string,
		notes?: string
	) => {
		try {
			const currentApp = applications.find(app => app.id === applicationId) || selectedApplication;
			const currentStatus = currentApp?.status;

			const updatedApplication =
				await fetchWithAdminTokenRefresh<LoanApplication>(
					`/api/admin/applications/${applicationId}/status`,
					{
						method: "PATCH",
						body: JSON.stringify({ 
							status: newStatus, 
							notes,
							currentStatus // Send current status for optimistic locking
						}),
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
		} catch (error: any) {
			console.error("Error updating application status:", error);
			
			// Handle specific error cases
			if (error.error === "LOAN_ALREADY_DISBURSED") {
				alert(
					`❌ Cannot modify this application.\n\n` +
					`This loan has already been disbursed and cannot be changed.\n` +
					`Disbursed: ${error.disbursedAt ? new Date(error.disbursedAt).toLocaleString() : 'Unknown'}\n` +
					`By: ${error.disbursedBy || 'Unknown admin'}\n\n` +
					`The page will automatically refresh to show the current status.`
				);
				// Automatically refresh the applications list to keep all admins in sync
				await fetchApplications();
				// Show status change alert to indicate the page was refreshed
				setShowStatusChangeAlert(true);
			} else if (error.error === "STATUS_CONFLICT") {
				// Show notification and automatically refresh
				alert(
					`⚠️ Status Conflict Detected\n\n` +
					`Another admin has already changed this application's status.\n\n` +
					`Expected: ${error.expectedStatus}\n` +
					`Current: ${error.actualStatus}\n` +
					`Last updated: ${new Date(error.lastUpdated).toLocaleString()}\n\n` +
					`The page will automatically refresh to show the current status.`
				);
				
				// Automatically refresh to keep all admins in sync
				await fetchApplications();
				// If this was the selected application, refresh its details
				if (selectedApplication?.id === applicationId) {
					const refreshedApp = applications.find(app => app.id === applicationId);
					if (refreshedApp) {
						setSelectedApplication(refreshedApp);
					}
				}
				// Show status change alert to indicate the page was refreshed
				setShowStatusChangeAlert(true);
			} else {
				alert(
					`Failed to update status: ${error.message || 'Unknown error'}\n\n` +
					`Please try again or refresh the page.`
				);
			}
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

	// Helper function to check if a loan is already disbursed
	const isLoanDisbursed = (application: LoanApplication): boolean => {
		return application.status === "ACTIVE" || 
			   (application as any).loan?.status === "ACTIVE" || 
			   !!(application as any).disbursement;
	};

	// Function to check for status changes in real-time
	const checkForStatusChanges = async (applicationId: string) => {
		try {
			const currentApp = await fetchWithAdminTokenRefresh<LoanApplication>(
				`/api/admin/applications/${applicationId}`,
				{ method: "GET" }
			);

			if (lastKnownStatus && currentApp.status !== lastKnownStatus) {
				setShowStatusChangeAlert(true);
				// Update the application in the list
				setApplications(prev => 
					prev.map(app => 
						app.id === applicationId ? { ...app, status: currentApp.status } : app
					)
				);
				// Update selected application if it's the one being checked
				if (selectedApplication?.id === applicationId) {
					setSelectedApplication(prev => 
						prev ? { ...prev, status: currentApp.status } : null
					);
				}
			}
			setLastKnownStatus(currentApp.status);
		} catch (error) {
			console.error("Error checking status changes:", error);
		}
	};

	// Start periodic status checking when an application is selected
	useEffect(() => {
		if (selectedApplication?.id && !isLoanDisbursed(selectedApplication)) {
			setLastKnownStatus(selectedApplication.status);
			
			// Clear any existing interval
			if (statusCheckInterval) {
				clearInterval(statusCheckInterval);
				setStatusCheckInterval(null);
			}

			// Set up new interval to check every 30 seconds
			const interval = setInterval(() => {
				checkForStatusChanges(selectedApplication.id);
			}, 30000);

			setStatusCheckInterval(interval);

			return () => {
				clearInterval(interval);
				setStatusCheckInterval(null);
			};
		} else {
			// Clear interval if no application selected or loan is disbursed
			if (statusCheckInterval) {
				clearInterval(statusCheckInterval);
				setStatusCheckInterval(null);
			}
		}
	}, [selectedApplication?.id, selectedApplication?.status]);

	// Cleanup interval on unmount
	useEffect(() => {
		return () => {
			if (statusCheckInterval) {
				clearInterval(statusCheckInterval);
			}
		};
	}, [statusCheckInterval]);

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
	const formatDocumentUrl = (fileUrl: string, documentId: string): string => {
		if (!fileUrl) return "";

		// If the URL already includes http(s), it's already an absolute URL
		if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
			return fileUrl;
		}

		// For relative URLs, use the loan-applications API endpoint instead of direct file access
		if (selectedApplication && documentId) {
			return `${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${selectedApplication.id}/documents/${documentId}`;
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

		return `Status changed to ${getStatusLabel(newStatus)}`;
	};

	// Approval decision handler
	const handleApprovalDecision = async (decision: "approve" | "reject") => {
		if (!selectedApplication) return;

		// Show confirmation dialog
		const actionText = decision === "approve" ? "approve" : "reject";
		const confirmMessage = `Are you sure you want to ${actionText} this loan application for ${selectedApplication.user?.fullName}?`;

		if (!window.confirm(confirmMessage)) {
			return;
		}

		setProcessingDecision(true);
		try {
			const newStatus = decision === "approve" ? "APPROVED" : "REJECTED";
			const notes = decisionNotes || `Application ${decision}d by admin`;

			await handleStatusChange(selectedApplication.id, newStatus, notes);
			
			// Clear decision notes and refresh data
			setDecisionNotes("");
			await fetchApplications();
			await fetchApplicationHistory(selectedApplication.id);
		} catch (error) {
			console.error(`Error ${decision}ing application:`, error);
			// Error handling is already done in handleStatusChange
		} finally {
			setProcessingDecision(false);
		}
	};

	// Collateral decision handler
	const handleCollateralDecision = async (decision: "approve" | "reject") => {
		if (!selectedApplication) return;

		// Show confirmation dialog
		const actionText = decision === "approve" ? "approve" : "reject";
		const confirmMessage = `Are you sure you want to ${actionText} this collateral loan application for ${selectedApplication.user?.fullName}?`;

		if (!window.confirm(confirmMessage)) {
			return;
		}

		setProcessingCollateral(true);
		try {
			const newStatus = decision === "approve" ? "PENDING_DISBURSEMENT" : "REJECTED";
			const notes = collateralNotes || `Collateral ${decision}d by admin`;

			await handleStatusChange(selectedApplication.id, newStatus, notes);
			
			// Clear collateral notes and refresh data
			setCollateralNotes("");
			await fetchApplications();
			await fetchApplicationHistory(selectedApplication.id);
		} catch (error) {
			console.error(`Error ${decision}ing collateral application:`, error);
			// Error handling is already done in handleStatusChange
		} finally {
			setProcessingCollateral(false);
		}
	};

	// Attestation completion handler
	const handleAttestationCompletion = async () => {
		if (!selectedApplication) return;

		// Validation based on attestation type
		if (attestationType === "IMMEDIATE") {
			if (!attestationVideoWatched || !attestationTermsAccepted) {
				setError(
					"For immediate attestation, video must be watched and terms must be accepted"
				);
				return;
			}
		} else if (attestationType === "MEETING") {
			if (!meetingCompletedAt) {
				setError(
					"For meeting attestation, please provide the meeting completion date"
				);
				return;
			}
		}

		// Show confirmation dialog
		const confirmMessage = `Are you sure you want to mark attestation as completed for ${selectedApplication.user?.fullName}?\n\nType: ${attestationType}\nThis will move the application to PENDING_SIGNATURE status.`;

		if (!window.confirm(confirmMessage)) {
			return;
		}

		setProcessingAttestation(true);
		try {
			const response = await fetch(
				`/api/admin/applications/${selectedApplication.id}/complete-attestation`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem(
							"adminToken"
						)}`,
					},
					body: JSON.stringify({
						attestationType,
						attestationNotes:
							attestationNotes ||
							`${attestationType} attestation completed by admin`,
						attestationVideoWatched:
							attestationType === "IMMEDIATE"
								? attestationVideoWatched
								: false,
						attestationTermsAccepted:
							attestationType === "IMMEDIATE"
								? attestationTermsAccepted
								: true,
						meetingCompletedAt:
							attestationType === "MEETING"
								? meetingCompletedAt
								: null,
					}),
				}
			);

			if (response.ok) {
				const data = await response.json();
				// Refresh the application data
				await fetchApplications();
				await fetchApplicationHistory(selectedApplication.id);

				// Reset attestation form
				setAttestationType("IMMEDIATE");
				setAttestationNotes("");
				setAttestationVideoWatched(false);
				setAttestationTermsAccepted(false);
				setMeetingCompletedAt("");

				// Update selected application
				setSelectedApplication((prev) =>
					prev ? { ...prev, status: "PENDING_SIGNATURE" } : null
				);
			} else {
				const errorData = await response.json();
				console.error("Attestation completion error:", errorData);
				setError(
					errorData.error ||
						errorData.message ||
						"Failed to complete attestation"
				);
			}
		} catch (error) {
			console.error("Error completing attestation:", error);
			setError("Failed to complete attestation");
		} finally {
			setProcessingAttestation(false);
		}
	};

	// Disbursement handler
	const handleDisbursement = async () => {
		if (!selectedApplication || !disbursementReference) return;

		// Show confirmation dialog
		const disbursementAmount =
			selectedApplication.netDisbursement || selectedApplication.amount;
		const confirmMessage = `Are you sure you want to disburse ${formatCurrency(
			disbursementAmount
		)} to ${
			selectedApplication.user?.fullName
		}?\n\nReference: ${disbursementReference}\nBank: ${
			selectedApplication.user?.bankName
		}\nAccount: ${selectedApplication.user?.accountNumber}`;

		if (!window.confirm(confirmMessage)) {
			return;
		}

		setProcessingDisbursement(true);
		try {
			console.log("Disbursement request:", {
				applicationId: selectedApplication.id,
				referenceNumber: disbursementReference,
				notes: disbursementNotes || "Loan disbursed by admin",
			});

			const response = await fetch(
				`/api/admin/applications/${selectedApplication.id}/disburse`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem(
							"adminToken"
						)}`,
					},
					body: JSON.stringify({
						referenceNumber: disbursementReference,
						notes: disbursementNotes || "Loan disbursed by admin",
					}),
				}
			);

			console.log("Disbursement response status:", response.status);

			if (response.ok) {
				const data = await response.json();
				console.log("Disbursement success:", data);
				// Refresh the application data
				await fetchApplications();
				await fetchApplicationHistory(selectedApplication.id);
				setDisbursementNotes("");
				setDisbursementReference("");

				// Update selected application
				setSelectedApplication((prev) =>
					prev ? { ...prev, status: "ACTIVE" } : null
				);
			} else {
				const errorData = await response.json();
				console.error("Disbursement error:", errorData);
				setError(
					errorData.error ||
						errorData.message ||
						"Failed to disburse loan"
				);
			}
		} catch (error) {
			console.error("Error disbursing loan:", error);
			setError("Failed to disburse loan");
		} finally {
			setProcessingDisbursement(false);
		}
	};

	// Fresh offer handler
	const handleFreshOfferSubmission = async () => {
		if (!selectedApplication) return;

		// Validate required fields
		if (!freshOfferAmount || !freshOfferTerm || !freshOfferInterestRate || !freshOfferMonthlyRepayment || !freshOfferNetDisbursement || !freshOfferProductId) {
			setError("All fresh offer fields are required, including product selection");
			return;
		}

		// Show confirmation dialog
		const confirmMessage = `Are you sure you want to submit a fresh offer to ${selectedApplication.user?.fullName}?\n\nNew Amount: RM${parseFloat(freshOfferAmount).toFixed(2)}\nNew Term: ${freshOfferTerm} months\nNew Interest Rate: ${freshOfferInterestRate}%`;

		if (!window.confirm(confirmMessage)) {
			return;
		}

		setProcessingFreshOffer(true);
		try {
			const response = await fetchWithAdminTokenRefresh(
				`/api/admin/applications/${selectedApplication.id}/fresh-offer`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						amount: parseFloat(freshOfferAmount),
						term: parseInt(freshOfferTerm),
						interestRate: parseFloat(freshOfferInterestRate),
						monthlyRepayment: parseFloat(freshOfferMonthlyRepayment),
						netDisbursement: parseFloat(freshOfferNetDisbursement),
						productId: freshOfferProductId,
						notes: freshOfferNotes,
					}),
				}
			);

			console.log("Fresh offer submitted successfully");
			
			// Clear form and refresh data
			setShowFreshOfferForm(false);
			setFreshOfferAmount("");
			setFreshOfferTerm("");
			setFreshOfferInterestRate("");
			setFreshOfferMonthlyRepayment("");
			setFreshOfferNetDisbursement("");
			setFreshOfferProductId("");
			setFreshOfferNotes("");
			
			await fetchApplications();
			await fetchApplicationHistory(selectedApplication.id);

			// Update selected application status
			setSelectedApplication(prev => 
				prev ? { ...prev, status: "PENDING_FRESH_OFFER" } : null
			);

		} catch (error) {
			console.error("Error submitting fresh offer:", error);
			setError("Failed to submit fresh offer");
		} finally {
			setProcessingFreshOffer(false);
		}
	};

	// Fetch products for selection
	const fetchProducts = async () => {
		try {
			const productsData = await fetchWithAdminTokenRefresh<any[]>("/api/admin/products");
			setProducts(productsData || []);
		} catch (error) {
			console.error("Error fetching products:", error);
		}
	};

	// Calculate monthly repayment based on amount, term, and interest rate
	const calculateMonthlyRepayment = (principal: number, termInMonths: number, interestRate: number) => {
		// Convert interest rate from percentage to decimal
		const monthlyInterestRate = interestRate / 100;

		// Calculate total interest for the loan period (flat rate)
		const totalInterest = principal * monthlyInterestRate * termInMonths;

		// Monthly interest payment
		const monthlyInterest = totalInterest / termInMonths;

		// Monthly principal payment
		const monthlyPrincipal = principal / termInMonths;

		// Total monthly payment is principal + interest
		const monthlyPayment = monthlyPrincipal + monthlyInterest;

		return monthlyPayment;
	};

	// Auto-calculate monthly repayment when amount, term, or interest rate changes
	const updateCalculatedFields = () => {
		const amount = parseFloat(freshOfferAmount);
		const term = parseInt(freshOfferTerm);
		const interestRate = parseFloat(freshOfferInterestRate);

		if (amount && term && interestRate) {
			const monthlyRepayment = calculateMonthlyRepayment(amount, term, interestRate);
			setFreshOfferMonthlyRepayment(monthlyRepayment.toFixed(2));

			// Calculate net disbursement based on selected product fees
			const selectedProduct = products.find(p => p.id === freshOfferProductId);
			if (selectedProduct) {
				// Legal fee and origination fee are stored as percentages in the database
				const legalFeeValue = (amount * selectedProduct.legalFee) / 100;
				const originationFeeValue = (amount * selectedProduct.originationFee) / 100;
				
				// Net disbursement = loan amount - all fees
				const netDisbursement = amount - legalFeeValue - originationFeeValue;
				setFreshOfferNetDisbursement(netDisbursement.toFixed(2));
			} else {
				// If no product selected, clear net disbursement
				setFreshOfferNetDisbursement("");
			}
		} else {
			// Clear calculated fields if required inputs are missing
			setFreshOfferMonthlyRepayment("");
			setFreshOfferNetDisbursement("");
		}
	};

	// Populate fresh offer form with current application data
	const populateFreshOfferForm = async () => {
		if (selectedApplication) {
			// Fetch products if not already loaded
			if (products.length === 0) {
				await fetchProducts();
			}

			setFreshOfferAmount(selectedApplication.amount?.toString() || "");
			setFreshOfferTerm(selectedApplication.term?.toString() || "");
			setFreshOfferInterestRate(selectedApplication.interestRate?.toString() || "");
			setFreshOfferMonthlyRepayment(selectedApplication.monthlyRepayment?.toString() || "");
			setFreshOfferNetDisbursement(selectedApplication.netDisbursement?.toString() || "");
			setFreshOfferProductId(selectedApplication.productId || "");
			setFreshOfferNotes("");
			setShowFreshOfferForm(true);
		}
	};

	// Auto-calculate when fresh offer values change
	useEffect(() => {
		if (showFreshOfferForm) {
			updateCalculatedFields();
		}
	}, [freshOfferAmount, freshOfferTerm, freshOfferInterestRate, freshOfferProductId, products]);

	if (loading) {
		return (
			<AdminLayout userName={userName}>
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
				</div>
			</AdminLayout>
		);
	}

	const getPageTitle = () => {
		if (filterParam === "pending-approval") {
			return "Pending Approval";
		} else if (filterParam === "pending-disbursement") {
			return "Pending Disbursement";
		} else if (filterParam === "collateral-review") {
			return "Collateral Review";
		} else {
			return "Loan Applications";
		}
	};

	const getPageDescription = () => {
		if (filterParam === "pending-approval") {
			return "Review and make credit decisions on loan applications";
		} else if (filterParam === "pending-disbursement") {
			return "Process loan disbursements for approved applications";
		} else if (filterParam === "collateral-review") {
			return "Review collateral-based loan applications requiring asset evaluation";
		} else {
			return "Manage active loan applications in the workflow (excludes incomplete, rejected, and withdrawn)";
		}
	};

	return (
		<AdminLayout title={getPageTitle()} description={getPageDescription()}>
			{/* Error Display */}
			{error && (
				<div className="mb-6 bg-red-700/30 border border-red-600/30 text-red-300 px-4 py-3 rounded-lg flex items-center justify-between">
					<span>{error}</span>
					<button onClick={() => setError(null)}>
						<XCircleIcon className="h-5 w-5" />
					</button>
				</div>
			)}

			{/* Status Change Alert */}
			{showStatusChangeAlert && (
				<div className="mb-6 p-4 bg-amber-500/10 border border-amber-400/20 rounded-lg">
					<div className="flex items-start justify-between">
						<div className="flex items-center">
							<ExclamationTriangleIcon className="h-6 w-6 text-amber-400 mr-3 flex-shrink-0" />
							<div>
								<p className="text-amber-200 font-medium">
									Application Status Changed
								</p>
								<p className="text-amber-300/70 text-sm">
									This application's status has been updated by another admin. The page has been automatically refreshed.
								</p>
							</div>
						</div>
						<button
							onClick={() => setShowStatusChangeAlert(false)}
							className="text-amber-400 hover:text-amber-300 transition-colors"
						>
							<XMarkIcon className="h-5 w-5" />
						</button>
					</div>
				</div>
			)}

			{/* Header and Controls */}
			<div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="text-xl font-semibold text-white mb-2">
						Application Management
					</h2>
					<p className="text-gray-400">
						{filteredApplications.length} application{filteredApplications.length !== 1 ? "s" : ""} • {applications.filter(app => app.status === "PENDING_APPROVAL").length} pending approval • {applications.filter(app => app.status === "PENDING_DISBURSEMENT").length} pending disbursement • {applications.filter(app => app.status === "COLLATERAL_REVIEW").length} collateral review
					</p>
				</div>
				<button
					onClick={handleRefresh}
					disabled={refreshing}
					className="mt-4 md:mt-0 flex items-center px-4 py-2 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors"
				>
					{refreshing ? (
						<ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<ArrowPathIcon className="h-4 w-4 mr-2" />
					)}
					Refresh Data
				</button>
			</div>

			{/* Search and Filter Bar */}
			<div className="mb-6 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
				<div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
					<div className="flex-1 relative">
						<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
							<svg
								className="h-5 w-5 text-gray-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
						</div>
						<input
							type="text"
							className="block w-full pl-10 pr-10 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
							placeholder="Search by applicant name, email, purpose, or application ID"
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
					<div className="flex space-x-2">
						<button
							onClick={() => setSelectedFilters([
								"PENDING_APP_FEE",
								"PENDING_KYC",
								"PENDING_APPROVAL",
								"PENDING_FRESH_OFFER",
								"PENDING_ATTESTATION",
								"PENDING_SIGNATURE",
								"PENDING_DISBURSEMENT",
								"COLLATERAL_REVIEW",
							])}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								selectedFilters.length === 8 && selectedFilters.includes("PENDING_APP_FEE") && selectedFilters.includes("COLLATERAL_REVIEW") && selectedFilters.includes("PENDING_FRESH_OFFER")
									? "bg-blue-500/30 text-blue-100 border-blue-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							All Active
						</button>
						<button
							onClick={() => setSelectedFilters(["PENDING_APPROVAL"])}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								selectedFilters.length === 1 && selectedFilters.includes("PENDING_APPROVAL")
									? "bg-amber-500/30 text-amber-100 border-amber-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							Pending Approval
						</button>
						<button
							onClick={() => setSelectedFilters(["PENDING_FRESH_OFFER"])}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								selectedFilters.length === 1 && selectedFilters.includes("PENDING_FRESH_OFFER")
									? "bg-pink-500/30 text-pink-100 border-pink-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							Fresh Offers
						</button>
						<button
							onClick={() => setSelectedFilters(["PENDING_DISBURSEMENT"])}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								selectedFilters.length === 1 && selectedFilters.includes("PENDING_DISBURSEMENT")
									? "bg-green-500/30 text-green-100 border-green-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							Pending Disbursement
						</button>
						<button
							onClick={() => setSelectedFilters(["COLLATERAL_REVIEW"])}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								selectedFilters.length === 1 && selectedFilters.includes("COLLATERAL_REVIEW")
									? "bg-orange-500/30 text-orange-100 border-orange-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							Collateral Review
						</button>

						<button
							onClick={() => setSelectedFilters(["REJECTED", "WITHDRAWN"])}
							className={`px-4 py-2 rounded-lg border transition-colors ${
								selectedFilters.length === 2 && selectedFilters.includes("REJECTED") && selectedFilters.includes("WITHDRAWN")
									? "bg-red-500/30 text-red-100 border-red-400/30"
									: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
							}`}
						>
							Closed Applications
						</button>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Panel - Application List */}
				<div className="lg:col-span-1">
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
						<div className="p-4 border-b border-gray-700/30">
							<h3 className="text-lg font-medium text-white">
								Applications ({filteredApplications.length})
							</h3>
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
										{search ? "No applications found" : "No applications found with the selected filters"}
									</p>
									{search && (
										<p className="text-sm text-gray-400 mt-2">
											Try adjusting your search criteria
										</p>
									)}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Right Panel - Application Details */}
				<div className="lg:col-span-2">
					{selectedApplication ? (
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
							<div className="p-4 border-b border-gray-700/30 flex justify-between items-center">
								<h3 className="text-lg font-medium text-white">
									Application Details
								</h3>
								<span className="px-2 py-1 bg-gray-500/20 text-gray-300 text-xs font-medium rounded-full border border-gray-400/20">
									ID: {selectedApplication.id.substring(0, 8)}
								</span>
							</div>

							<div className="p-6">

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
										<div className="flex items-center space-x-2">
											<span>Documents</span>
											{selectedApplication?.documents &&
												selectedApplication.documents
													.length > 0 && (
													<span className="bg-blue-500/20 text-blue-200 text-xs font-medium px-2 py-1 rounded-full border border-blue-400/20">
														{
															selectedApplication
																.documents
																.length
														}
													</span>
												)}
										</div>
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
									{/* Show Approval tab for PENDING_APPROVAL applications */}
									{selectedApplication.status ===
										"PENDING_APPROVAL" && (
										<div
											className={`px-4 py-2 cursor-pointer transition-colors ${
												selectedTab === "approval"
													? "border-b-2 border-amber-400 font-medium text-white"
													: "text-gray-400 hover:text-gray-200"
											}`}
											onClick={() =>
												setSelectedTab("approval")
											}
										>
											<DocumentMagnifyingGlassIcon className="inline h-4 w-4 mr-1" />
											Approval
										</div>
									)}
									{/* Show Collateral Review tab for COLLATERAL_REVIEW applications */}
									{selectedApplication.status ===
										"COLLATERAL_REVIEW" && (
										<div
											className={`px-4 py-2 cursor-pointer transition-colors ${
												selectedTab === "collateral"
													? "border-b-2 border-amber-400 font-medium text-white"
													: "text-gray-400 hover:text-gray-200"
											}`}
											onClick={() =>
												setSelectedTab("collateral")
											}
										>
											<ClipboardDocumentCheckIcon className="inline h-4 w-4 mr-1" />
											Collateral Review
										</div>
									)}
									{/* Show Attestation tab for PENDING_ATTESTATION applications */}
									{selectedApplication.status ===
										"PENDING_ATTESTATION" && (
										<div
											className={`px-4 py-2 cursor-pointer transition-colors ${
												selectedTab === "attestation"
													? "border-b-2 border-cyan-400 font-medium text-white"
													: "text-gray-400 hover:text-gray-200"
											}`}
											onClick={() =>
												setSelectedTab("attestation")
											}
										>
											<ClipboardDocumentCheckIcon className="inline h-4 w-4 mr-1" />
											Attestation
										</div>
									)}
									{/* Show Disbursement tab for PENDING_DISBURSEMENT applications */}
									{selectedApplication.status ===
										"PENDING_DISBURSEMENT" && (
										<div
											className={`px-4 py-2 cursor-pointer transition-colors ${
												selectedTab === "disbursement"
													? "border-b-2 border-green-400 font-medium text-white"
													: "text-gray-400 hover:text-gray-200"
											}`}
											onClick={() =>
												setSelectedTab("disbursement")
											}
										>
											<BanknotesIcon className="inline h-4 w-4 mr-1" />
											Disbursement
										</div>
									)}
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
																				doc.fileUrl,
																				doc.id
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
													<div className="space-y-3">
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
																	<div
																		key={
																			historyItem.id
																		}
																		className="flex items-start space-x-3 p-4 bg-gray-800/30 rounded-lg border border-gray-700/30"
																	>
																		<div className="flex-shrink-0 mt-1">
																			<div
																				className={`w-2 h-2 rounded-full ${
																					index ===
																					0
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
																				</p>
																			</div>
																														<p className="text-xs text-gray-400 mt-1">
												Changed by: {historyItem.changedBy || "System"}
											</p>
																			{historyItem.notes && (
																				<div className="mt-2 p-2 bg-gray-700/50 rounded text-xs text-gray-300">
																					<span className="font-medium">
																						Notes:
																					</span>{" "}
																					{
																						historyItem.notes
																					}
																				</div>
																			)}
																		</div>
																	</div>
																)
															)}
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

								{/* Approval Tab */}
								{selectedTab === "approval" && (
									<div>
										{/* Credit Decision Section */}
										<div className="border border-amber-500/30 rounded-lg p-6 bg-amber-500/10 mb-6">
											<h4 className="text-lg font-medium text-white mb-4 flex items-center">
												<DocumentMagnifyingGlassIcon className="h-6 w-6 mr-2 text-amber-400" />
												Credit Decision Required
											</h4>

											{/* Application Summary */}
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-800/50 rounded-lg">
												<div>
													<h5 className="text-sm font-medium text-gray-300 mb-2">
														Applicant
													</h5>
													<p className="text-white">
														{
															selectedApplication
																.user?.fullName
														}
													</p>
													<p className="text-sm text-gray-400">
														{
															selectedApplication
																.user?.email
														}
													</p>
												</div>
												<div>
													<h5 className="text-sm font-medium text-gray-300 mb-2">
														Loan Details
													</h5>
													<p className="text-white">
														{selectedApplication.amount
															? formatCurrency(
																	selectedApplication.amount
															  )
															: "Amount not set"}
													</p>
													<p className="text-sm text-gray-400">
														{selectedApplication.term
															? `${selectedApplication.term} months`
															: "Term not set"}
													</p>
												</div>
											</div>

											{/* Decision Notes */}
											<div className="mb-6">
												<label className="block text-sm font-medium text-gray-300 mb-2">
													Decision Notes (Optional)
												</label>
												<textarea
													value={decisionNotes}
													onChange={(e) =>
														setDecisionNotes(
															e.target.value
														)
													}
													placeholder="Add notes about your decision..."
													className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
													rows={3}
												/>
											</div>

											{/* Decision Buttons */}
											{isLoanDisbursed(selectedApplication) ? (
												<div className="p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
													<div className="flex items-center">
														<CheckCircleIcon className="h-6 w-6 text-blue-400 mr-3" />
														<div>
															<p className="text-blue-200 font-medium">
																Loan Already Disbursed
															</p>
															<p className="text-blue-300/70 text-sm">
																This loan has been disbursed and cannot be modified.
															</p>
														</div>
													</div>
												</div>
											) : (
												<div className="flex space-x-4">
													<button
														onClick={() =>
															handleApprovalDecision(
																"approve"
															)
														}
														disabled={
															processingDecision
														}
														className="flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-medium rounded-lg transition-colors"
													>
														<CheckCircleIcon className="h-5 w-5 mr-2" />
														{processingDecision
															? "Processing..."
															: "Approve Application"}
													</button>
													<button
														onClick={() =>
															handleApprovalDecision(
																"reject"
															)
														}
														disabled={
															processingDecision
														}
														className="flex items-center px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-medium rounded-lg transition-colors"
													>
														<XCircleIcon className="h-5 w-5 mr-2" />
														{processingDecision
															? "Processing..."
															: "Reject Application"}
													</button>
												</div>
											)}

											{/* Workflow Information */}
											<div className="mt-6 p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
												<h5 className="text-sm font-medium text-blue-200 mb-2">
													Next Steps
												</h5>
												<ul className="text-xs text-blue-200 space-y-1">
													<li>
														•{" "}
														<strong>
															Approve:
														</strong>{" "}
														Application will move to
														PENDING_SIGNATURE status
													</li>
													<li>
														•{" "}
														<strong>Reject:</strong>{" "}
														Application will be
														marked as REJECTED and
														user will be notified
													</li>
													<li>
														• All decisions are
														logged in the audit
														trail with timestamps
													</li>
												</ul>
											</div>

											{/* Fresh Offer Section */}
											<div className="mt-6 p-4 bg-purple-500/10 border border-purple-400/20 rounded-lg">
												<div className="flex items-center justify-between mb-4">
													<h5 className="text-sm font-medium text-purple-200">
														Fresh Offer Option
													</h5>
													{!showFreshOfferForm && (
														<button
															onClick={populateFreshOfferForm}
															className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
														>
															Submit Fresh Offer
														</button>
													)}
												</div>
												
												{showFreshOfferForm && (
													<div className="space-y-4">
														{/* Product Selection */}
														<div>
															<label className="block text-sm font-medium text-gray-300 mb-2">
																Product
															</label>
															<select
																value={freshOfferProductId}
																onChange={(e) => setFreshOfferProductId(e.target.value)}
																className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
															>
																<option value="">Select product</option>
																{products.map((product) => (
																	<option key={product.id} value={product.id}>
																		{product.name} - {product.interestRate}% interest
																	</option>
																))}
															</select>
														</div>
														
														<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
															<div>
																<label className="block text-sm font-medium text-gray-300 mb-2">
																	Amount (RM)
																</label>
																<input
																	type="number"
																	value={freshOfferAmount}
																	onChange={(e) => setFreshOfferAmount(e.target.value)}
																	placeholder="Enter amount"
																	className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
																	step="0.01"
																/>
															</div>
															<div>
																<label className="block text-sm font-medium text-gray-300 mb-2">
																	Term (months)
																</label>
																<input
																	type="number"
																	value={freshOfferTerm}
																	onChange={(e) => setFreshOfferTerm(e.target.value)}
																	placeholder="Enter term"
																	className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
																/>
															</div>
															<div>
																<label className="block text-sm font-medium text-gray-300 mb-2">
																	Interest Rate (%)
																</label>
																<input
																	type="number"
																	value={freshOfferInterestRate}
																	onChange={(e) => setFreshOfferInterestRate(e.target.value)}
																	placeholder="Enter interest rate"
																	className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
																	step="0.01"
																/>
															</div>
															<div>
																<label className="block text-sm font-medium text-gray-300 mb-2">
																	Monthly Repayment (RM)
																</label>
																<input
																	type="number"
																	value={freshOfferMonthlyRepayment}
																	readOnly
																	placeholder="Auto-calculated"
																	className="w-full px-3 py-2 bg-gray-700/50 border border-gray-500 rounded-lg text-gray-300 placeholder-gray-500 cursor-not-allowed"
																	step="0.01"
																/>
															</div>
															<div className="md:col-span-2">
																<label className="block text-sm font-medium text-gray-300 mb-2">
																	Net Disbursement (RM)
																</label>
																<input
																	type="number"
																	value={freshOfferNetDisbursement}
																	readOnly
																	placeholder="Auto-calculated"
																	className="w-full px-3 py-2 bg-gray-700/50 border border-gray-500 rounded-lg text-gray-300 placeholder-gray-500 cursor-not-allowed"
																	step="0.01"
																/>
															</div>
														</div>
														
														<div>
															<label className="block text-sm font-medium text-gray-300 mb-2">
																Fresh Offer Notes (Optional)
															</label>
															<textarea
																value={freshOfferNotes}
																onChange={(e) => setFreshOfferNotes(e.target.value)}
																placeholder="Add notes about the fresh offer..."
																className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
																rows={3}
															/>
														</div>
														
														<div className="flex space-x-4">
															<button
																onClick={handleFreshOfferSubmission}
																disabled={processingFreshOffer}
																className="flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-medium rounded-lg transition-colors"
															>
																{processingFreshOffer ? "Submitting..." : "Submit Fresh Offer"}
															</button>
															<button
																onClick={() => setShowFreshOfferForm(false)}
																disabled={processingFreshOffer}
																className="flex items-center px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600/50 text-white font-medium rounded-lg transition-colors"
															>
																Cancel
															</button>
														</div>
													</div>
												)}
												
												<p className="text-xs text-purple-200/70 mt-2">
													Submit a fresh offer with revised terms. The user will be notified and can accept or reject the new offer.
												</p>
											</div>
										</div>
									</div>
								)}

								{/* Collateral Review Tab */}
								{selectedTab === "collateral" && (
									<div>
										{/* Collateral Review Section */}
										<div className="border border-amber-500/30 rounded-lg p-6 bg-amber-500/10 mb-6">
											<h4 className="text-lg font-medium text-white mb-4 flex items-center">
												<ClipboardDocumentCheckIcon className="h-6 w-6 mr-2 text-amber-400" />
												Collateral Review Decision
											</h4>

											{/* Application Summary */}
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-800/50 rounded-lg">
												<div>
													<h5 className="text-sm font-medium text-gray-300 mb-2">
														Applicant
													</h5>
													<p className="text-white">
														{
															selectedApplication
																.user?.fullName
														}
													</p>
													<p className="text-sm text-gray-400">
														{
															selectedApplication
																.user?.email
														}
													</p>
												</div>
												<div>
													<h5 className="text-sm font-medium text-gray-300 mb-2">
														Loan Details
													</h5>
													<p className="text-white">
														{selectedApplication.amount
															? formatCurrency(
																	selectedApplication.amount
															  )
															: "Amount not set"}
													</p>
													<p className="text-sm text-gray-400">
														{selectedApplication.term
															? `${selectedApplication.term} months`
															: "Term not set"}
													</p>
												</div>
											</div>

											{/* Collateral Information */}
											<div className="mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
												<h5 className="text-sm font-medium text-amber-200 mb-2">
													Collateral Loan Information
												</h5>
												<p className="text-xs text-amber-200/80">
													This is a collateral-backed loan that requires manual review of the collateral details before approval. Please review all collateral documentation and valuation before making a decision.
												</p>
											</div>

											{/* Decision Notes */}
											<div className="mb-6">
												<label className="block text-sm font-medium text-gray-300 mb-2">
													Review Notes (Optional)
												</label>
												<textarea
													value={collateralNotes}
													onChange={(e) =>
														setCollateralNotes(
															e.target.value
														)
													}
													placeholder="Add notes about your collateral review decision..."
													className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
													rows={3}
												/>
											</div>

											{/* Decision Buttons */}
											{isLoanDisbursed(selectedApplication) ? (
												<div className="p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
													<div className="flex items-center">
														<CheckCircleIcon className="h-6 w-6 text-blue-400 mr-3" />
														<div>
															<p className="text-blue-200 font-medium">
																Loan Already Disbursed
															</p>
															<p className="text-blue-300/70 text-sm">
																This loan has been disbursed and cannot be modified.
															</p>
														</div>
													</div>
												</div>
											) : (
												<div className="flex space-x-4">
													<button
														onClick={() =>
															handleCollateralDecision(
																"approve"
															)
														}
														disabled={
															processingCollateral
														}
														className="flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-medium rounded-lg transition-colors"
													>
														<CheckCircleIcon className="h-5 w-5 mr-2" />
														{processingCollateral
															? "Processing..."
															: "Approve Collateral & Proceed to Disbursement"}
													</button>
													<button
														onClick={() =>
															handleCollateralDecision(
																"reject"
															)
														}
														disabled={
															processingCollateral
														}
														className="flex items-center px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-medium rounded-lg transition-colors"
													>
														<XCircleIcon className="h-5 w-5 mr-2" />
														{processingCollateral
															? "Processing..."
															: "Reject Application"}
													</button>
												</div>
											)}

											{/* Workflow Information */}
											<div className="mt-6 p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
												<h5 className="text-sm font-medium text-blue-200 mb-2">
													Next Steps
												</h5>
												<ul className="text-xs text-blue-200 space-y-1">
													<li>
														•{" "}
														<strong>
															Approve:
														</strong>{" "}
														Application will move to
														PENDING_DISBURSEMENT status for fund transfer
													</li>
													<li>
														•{" "}
														<strong>Reject:</strong>{" "}
														Application will be
														marked as REJECTED and
														user will be notified
													</li>
													<li>
														• All collateral review decisions are
														logged in the audit
														trail with timestamps
													</li>
												</ul>
											</div>
										</div>
									</div>
								)}

								{/* Attestation Tab */}
								{selectedTab === "attestation" && (
									<div>
										{/* Attestation Section */}
										<div className="border border-cyan-500/30 rounded-lg p-6 bg-cyan-500/10 mb-6">
											<h4 className="text-lg font-medium text-white mb-4 flex items-center">
												<ClipboardDocumentCheckIcon className="h-6 w-6 mr-2 text-cyan-400" />
												Loan Terms Attestation
											</h4>

											{/* Application Summary */}
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-800/50 rounded-lg">
												<div>
													<h5 className="text-sm font-medium text-gray-300 mb-2">
														Applicant
													</h5>
													<p className="text-white">
														{
															selectedApplication
																.user?.fullName
														}
													</p>
													<p className="text-sm text-gray-400">
														{
															selectedApplication
																.user?.email
														}
													</p>
												</div>
												<div>
													<h5 className="text-sm font-medium text-gray-300 mb-2">
														Loan Details
													</h5>
													<p className="text-white">
														{selectedApplication.amount
															? formatCurrency(
																	selectedApplication.amount
															  )
															: "Amount not set"}
													</p>
													<p className="text-sm text-gray-400">
														{selectedApplication.term
															? `${selectedApplication.term} months`
															: "Term not set"}
													</p>
												</div>
											</div>

											{/* Attestation Type Selection */}
											<div className="mb-6">
												<label className="block text-sm font-medium text-gray-300 mb-3">
													Attestation Type
												</label>
												<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
													<div
														className={`p-4 rounded-lg border cursor-pointer transition-colors ${
															attestationType ===
															"IMMEDIATE"
																? "border-cyan-400/50 bg-cyan-500/10"
																: "border-gray-600 bg-gray-800/30 hover:border-gray-500"
														}`}
														onClick={() =>
															setAttestationType(
																"IMMEDIATE"
															)
														}
													>
														<div className="flex items-center mb-2">
															<input
																type="radio"
																checked={
																	attestationType ===
																	"IMMEDIATE"
																}
																onChange={() =>
																	setAttestationType(
																		"IMMEDIATE"
																	)
																}
																className="mr-2"
															/>
															<h6 className="text-white font-medium">
																Immediate
																Attestation
															</h6>
														</div>
														<p className="text-sm text-gray-400">
															Customer watches
															video and accepts
															terms online
														</p>
													</div>
													<div
														className={`p-4 rounded-lg border cursor-pointer transition-colors ${
															attestationType ===
															"MEETING"
																? "border-cyan-400/50 bg-cyan-500/10"
																: "border-gray-600 bg-gray-800/30 hover:border-gray-500"
														}`}
														onClick={() =>
															setAttestationType(
																"MEETING"
															)
														}
													>
														<div className="flex items-center mb-2">
															<input
																type="radio"
																checked={
																	attestationType ===
																	"MEETING"
																}
																onChange={() =>
																	setAttestationType(
																		"MEETING"
																	)
																}
																className="mr-2"
															/>
															<h6 className="text-white font-medium">
																Meeting with
																Lawyer
															</h6>
														</div>
														<p className="text-sm text-gray-400">
															Schedule meeting
															with legal counsel
														</p>
													</div>
												</div>
											</div>

											{/* Immediate Attestation Form */}
											{attestationType ===
												"IMMEDIATE" && (
												<div className="mb-6 p-4 bg-gray-800/30 rounded-lg">
													<h6 className="text-white font-medium mb-3">
														Immediate Attestation
														Requirements
													</h6>
													<div className="space-y-3">
														<div className="flex items-center">
															<input
																type="checkbox"
																checked={
																	attestationVideoWatched
																}
																onChange={(e) =>
																	setAttestationVideoWatched(
																		e.target
																			.checked
																	)
																}
																className="mr-3"
															/>
															<label className="text-gray-300">
																Customer has
																watched the loan
																terms video
															</label>
														</div>
														<div className="flex items-center">
															<input
																type="checkbox"
																checked={
																	attestationTermsAccepted
																}
																onChange={(e) =>
																	setAttestationTermsAccepted(
																		e.target
																			.checked
																	)
																}
																className="mr-3"
															/>
															<label className="text-gray-300">
																Customer has
																accepted the
																loan terms and
																conditions
															</label>
														</div>
													</div>
												</div>
											)}

											{/* Meeting Attestation Form */}
											{attestationType === "MEETING" && (
												<div className="mb-6 p-4 bg-gray-800/30 rounded-lg">
													<h6 className="text-white font-medium mb-3">
														Meeting Attestation
														Details
													</h6>
													<div>
														<label className="block text-sm font-medium text-gray-300 mb-2">
															Meeting Completion
															Date & Time
														</label>
														<input
															type="datetime-local"
															value={
																meetingCompletedAt
															}
															onChange={(e) =>
																setMeetingCompletedAt(
																	e.target
																		.value
																)
															}
															className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
														/>
													</div>
												</div>
											)}

											{/* Attestation Notes */}
											<div className="mb-6">
												<label className="block text-sm font-medium text-gray-300 mb-2">
													Attestation Notes (Optional)
												</label>
												<textarea
													value={attestationNotes}
													onChange={(e) =>
														setAttestationNotes(
															e.target.value
														)
													}
													placeholder="Add notes about the attestation process..."
													className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
													rows={3}
												/>
											</div>

											{/* Complete Attestation Button */}
											<div className="flex space-x-4">
												<button
													onClick={
														handleAttestationCompletion
													}
													disabled={
														processingAttestation ||
														(attestationType ===
															"IMMEDIATE" &&
															(!attestationVideoWatched ||
																!attestationTermsAccepted)) ||
														(attestationType ===
															"MEETING" &&
															!meetingCompletedAt)
													}
													className="flex items-center px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-600/50 text-white font-medium rounded-lg transition-colors"
												>
													<CheckCircleIcon className="h-5 w-5 mr-2" />
													{processingAttestation
														? "Processing..."
														: "Complete Attestation"}
												</button>
											</div>

											{/* Process Information */}
											<div className="mt-6 p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
												<h5 className="text-sm font-medium text-blue-200 mb-2">
													Attestation Process
												</h5>
												<ul className="text-xs text-blue-200 space-y-1">
													<li>
														•{" "}
														<strong>
															Immediate:
														</strong>{" "}
														Customer confirms they
														have watched the video
														and accepted terms
													</li>
													<li>
														•{" "}
														<strong>
															Meeting:
														</strong>{" "}
														Legal counsel meeting
														completed and terms
														explained
													</li>
													<li>
														• Application will move
														to PENDING_SIGNATURE
														status upon completion
													</li>
													<li>
														• All attestation
														details are logged in
														the audit trail
													</li>
												</ul>
											</div>
										</div>
									</div>
								)}

								{/* Disbursement Tab */}
								{selectedTab === "disbursement" && (
									<div>
										{/* Disbursement Section */}
										<div className="border border-green-500/30 rounded-lg p-6 bg-green-500/10 mb-6">
											<h4 className="text-lg font-medium text-white mb-4 flex items-center">
												<BanknotesIcon className="h-6 w-6 mr-2 text-green-400" />
												Loan Disbursement
											</h4>

											{/* Loan Summary */}
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-800/50 rounded-lg">
												<div>
													<h5 className="text-sm font-medium text-gray-300 mb-2">
														Borrower
													</h5>
													<p className="text-white">
														{
															selectedApplication
																.user?.fullName
														}
													</p>
													<p className="text-sm text-gray-400">
														{
															selectedApplication
																.user?.email
														}
													</p>
													<p className="text-sm text-gray-400">
														{
															selectedApplication
																.user
																?.phoneNumber
														}
													</p>
												</div>
												<div>
													<h5 className="text-sm font-medium text-gray-300 mb-2">
														Disbursement Details
													</h5>
													<p className="text-white">
														Disbursement Amount:{" "}
														{selectedApplication.netDisbursement
															? formatCurrency(
																	selectedApplication.netDisbursement
															  )
															: selectedApplication.amount
															? formatCurrency(
																	selectedApplication.amount
															  )
															: "Not set"}
													</p>
													<p className="text-sm text-gray-400">
														Loan Amount:{" "}
														{selectedApplication.amount
															? formatCurrency(
																	selectedApplication.amount
															  )
															: "Not set"}
													</p>
													<p className="text-sm text-gray-400">
														Bank:{" "}
														{selectedApplication
															.user?.bankName ||
															"Not provided"}
													</p>
													<div className="flex items-center gap-2">
														<p className="text-sm text-gray-400">
															Account:{" "}
															{selectedApplication
																.user
																?.accountNumber ||
																"Not provided"}
														</p>
														{selectedApplication
															.user
															?.accountNumber && (
															<button
																onClick={() =>
																	navigator.clipboard.writeText(
																		selectedApplication
																			.user
																			?.accountNumber ||
																			""
																	)
																}
																className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 bg-blue-500/10 rounded border border-blue-400/20"
																title="Copy account number"
															>
																Copy
															</button>
														)}
													</div>
												</div>
											</div>

											{/* Reference Number */}
											<div className="mb-6">
												<label className="block text-sm font-medium text-gray-300 mb-2">
													Bank Transfer Reference
													Number
												</label>
												<div className="relative">
													<input
														type="text"
														value={
															disbursementReference
														}
														onChange={(e) =>
															setDisbursementReference(
																e.target.value
															)
														}
														placeholder="Enter bank transfer reference..."
														className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
													/>
													<div className="mt-2 p-2 bg-blue-500/10 border border-blue-400/20 rounded text-xs text-blue-200">
														<div className="flex items-center justify-between">
															<div>
																<strong>
																	Auto-generated
																	reference:
																</strong>{" "}
																{
																	disbursementReference
																}
																<br />
																<span className="text-blue-300">
																	Use this
																	reference
																	when making
																	the bank
																	transfer
																</span>
															</div>
															{disbursementReference && (
																<button
																	onClick={() =>
																		navigator.clipboard.writeText(
																			disbursementReference
																		)
																	}
																	className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 bg-blue-500/20 rounded border border-blue-400/30 ml-2"
																	title="Copy reference number"
																>
																	Copy Ref
																</button>
															)}
														</div>
													</div>
												</div>
											</div>

											{/* Disbursement Notes */}
											<div className="mb-6">
												<label className="block text-sm font-medium text-gray-300 mb-2">
													Disbursement Notes
													(Optional)
												</label>
												<textarea
													value={disbursementNotes}
													onChange={(e) =>
														setDisbursementNotes(
															e.target.value
														)
													}
													placeholder="Add notes about the disbursement..."
													className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
													rows={3}
												/>
											</div>

											{/* Disbursement Button */}
											<div className="flex space-x-4">
												<button
													onClick={handleDisbursement}
													disabled={
														processingDisbursement ||
														!disbursementReference.trim()
													}
													className="flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-medium rounded-lg transition-colors"
												>
													<BanknotesIcon className="h-5 w-5 mr-2" />
													{processingDisbursement
														? "Processing..."
														: "Disburse Loan"}
												</button>
												{!disbursementReference.trim() && (
													<p className="text-sm text-red-400 flex items-center">
														Reference number is
														required
													</p>
												)}
											</div>

											{/* Process Information */}
											<div className="mt-6 p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
												<h5 className="text-sm font-medium text-blue-200 mb-2">
													Disbursement Process
												</h5>
												<ul className="text-xs text-blue-200 space-y-1">
													<li>
														• Funds will be
														transferred to the
														borrower's registered
														bank account
													</li>
													<li>
														• Loan status will
														change to ACTIVE upon
														successful disbursement
													</li>
													<li>
														• Borrower will receive
														SMS and email
														notifications
													</li>
													<li>
														• Repayment schedule
														will be automatically
														generated
													</li>
												</ul>
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
												"PENDING_APPROVAL",
												"PENDING_ATTESTATION",
												"PENDING_SIGNATURE",
												"PENDING_DISBURSEMENT",
												"COLLATERAL_REVIEW",
												"REJECTED",
												"WITHDRAWN",
											].map((status) => (
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
														{getStatusLabel(status)}
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
													disbursement, specialized
													tabs will appear above for
													streamlined processing.
												</p>
												{selectedApplication.status ===
													"PENDING_APPROVAL" && (
													<p className="text-xs text-amber-200 mt-1">
														• This application is
														ready for credit
														decision - check the
														"Approval" tab
													</p>
												)}
												{selectedApplication.status ===
													"PENDING_DISBURSEMENT" && (
													<p className="text-xs text-green-200 mt-1">
														• This application is
														ready for disbursement -
														check the "Disbursement"
														tab
													</p>
												)}
												{selectedApplication.status ===
													"COLLATERAL_REVIEW" && (
													<p className="text-xs text-amber-200 mt-1">
														• This collateral loan
														requires review - use the
														approval buttons above
													</p>
												)}
											</div>
										</div>



										{/* Advanced Actions */}
										<div className="flex justify-end space-x-3">
											{/* Skip button for automated advancement */}
											{selectedApplication.status !==
												"PENDING_SIGNATURE" &&
												selectedApplication.status !==
													"REJECTED" &&
												selectedApplication.status !==
													"WITHDRAWN" &&
												selectedApplication.status !==
													"PENDING_APPROVAL" &&
												selectedApplication.status !==
													"PENDING_DISBURSEMENT" &&
												selectedApplication.status !==
													"COLLATERAL_REVIEW" && (
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
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg h-full flex items-center justify-center p-8">
							<div className="text-center">
								<DocumentTextIcon className="mx-auto h-16 w-16 text-gray-500" />
								<h3 className="mt-4 text-xl font-medium text-white">
									No Application Selected
								</h3>
								<p className="mt-2 text-gray-400">
									Select an application from the list to view its details
								</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</AdminLayout>
	);
}

export default function AdminApplicationsPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<AdminApplicationsPageContent />
		</Suspense>
	);
}
