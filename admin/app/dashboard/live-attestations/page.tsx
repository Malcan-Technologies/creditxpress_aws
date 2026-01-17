"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "../../components/AdminLayout";
import ConfirmationModal from "../../../components/ConfirmationModal";
import {
	VideoCameraIcon,
	UserIcon,
	PhoneIcon,
	EnvelopeIcon,
	CheckCircleIcon,
	ClockIcon,
	DocumentTextIcon,
	CalendarDaysIcon,
	ArrowPathIcon,
	BanknotesIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "@/lib/authUtils";
import { toast } from "sonner";

interface LoanApplication {
	id: string;
	status: string;
	amount: number;
	term: number;
	purpose: string;
	createdAt: string;
	updatedAt: string;
	attestationType: string;
	attestationCompleted: boolean;
	attestationDate: string | null;
	attestationNotes: string | null;
	meetingCompletedAt: string | null;
	user: {
		id: string;
		fullName: string;
		email: string;
		phoneNumber: string;
	};
	product: {
		id: string;
		name: string;
		code: string;
	};
}

export default function LiveAttestationsPage() {
	const router = useRouter();
	const [applications, setApplications] = useState<LoanApplication[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [processingId, setProcessingId] = useState<string | null>(null);
	const [selectedApplication, setSelectedApplication] = useState<LoanApplication | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [filteredApplications, setFilteredApplications] = useState<LoanApplication[]>([]);
	const [showConfirmModal, setShowConfirmModal] = useState(false);
	const [confirmApplicationId, setConfirmApplicationId] = useState<string | null>(null);

	useEffect(() => {
		loadLiveAttestationRequests();
	}, []);

	// Filter applications based on search term
	useEffect(() => {
		if (!searchTerm.trim()) {
			setFilteredApplications(applications);
		} else {
			const search = searchTerm.toLowerCase();
			const filtered = applications.filter(
				(application) =>
					application.user.fullName.toLowerCase().includes(search) ||
					application.user.email.toLowerCase().includes(search) ||
					application.user.phoneNumber.toLowerCase().includes(search) ||
					application.product.name.toLowerCase().includes(search) ||
					application.id.toLowerCase().includes(search) ||
					application.purpose?.toLowerCase().includes(search)
			);
			setFilteredApplications(filtered);
		}
	}, [applications, searchTerm]);

	// Auto-select first application when filtered list changes
	useEffect(() => {
		if (
			filteredApplications.length > 0 &&
			(!selectedApplication ||
				!filteredApplications.find(
					(app) => app.id === selectedApplication.id
				))
		) {
			setSelectedApplication(filteredApplications[0]);
		} else if (filteredApplications.length === 0) {
			setSelectedApplication(null);
		}
	}, [filteredApplications, selectedApplication]);

	const loadLiveAttestationRequests = async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetchWithAdminTokenRefresh<
				| LoanApplication[]
				| { success: boolean; data: LoanApplication[] }
			>("/api/admin/applications/live-attestations");

			// Handle both direct array format and wrapped format { success, data }
			let data: LoanApplication[] = [];
			if (Array.isArray(response)) {
				data = response;
			} else if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
				data = response.data;
			}

			setApplications(data);
		} catch (error) {
			console.error("Error loading live attestation requests:", error);
			setError("Failed to load live attestation requests");
		} finally {
			setLoading(false);
		}
	};

	const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchTerm(e.target.value);
	};

	const handleRefresh = async () => {
		try {
			await loadLiveAttestationRequests();
			toast.success("Live attestations refreshed successfully");
		} catch (error) {
			console.error("Error refreshing live attestations:", error);
			toast.error("Failed to refresh live attestations");
		}
	};

	const handleMarkCompleteClick = (applicationId: string) => {
		setConfirmApplicationId(applicationId);
		setShowConfirmModal(true);
	};

	const handleCompleteAttestation = async () => {
		if (!confirmApplicationId) return;
		
		try {
			setProcessingId(confirmApplicationId);
			setShowConfirmModal(false);

			await fetchWithAdminTokenRefresh(
				`/api/admin/applications/${confirmApplicationId}/complete-live-attestation`,
				{
					method: "POST",
					body: JSON.stringify({
						notes: "Live video call completed by admin",
						meetingCompletedAt: new Date().toISOString(),
					}),
				}
			);

			// Reload the list
			await loadLiveAttestationRequests();

			toast.success("Live attestation completed successfully!");
		} catch (error) {
			console.error("Error completing live attestation:", error);
			toast.error("Failed to complete live attestation. Please try again.");
		} finally {
			setProcessingId(null);
			setConfirmApplicationId(null);
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
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const formatDateOnly = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-MY", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	if (loading) {
		return (
			<AdminLayout
				title="Live Video Attestations"
				description="Manage live video call attestation requests"
			>
				<div className="px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
					<div className="flex items-center justify-center h-64">
						<div className="w-16 h-16 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
					</div>
				</div>
			</AdminLayout>
		);
	}

	if (error) {
		return (
			<AdminLayout
				title="Live Video Attestations"
				description="Manage live video call attestation requests"
			>
				<div className="px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
					<div className="bg-red-500/20 border border-red-400/20 rounded-lg p-4">
						<p className="text-red-200">{error}</p>
						<button
							onClick={loadLiveAttestationRequests}
							className="mt-2 text-red-300 hover:text-red-100 underline"
						>
							Try again
						</button>
					</div>
				</div>
			</AdminLayout>
		);
	}

	return (
		<AdminLayout
			title="Live Video Attestations"
			description="Manage live video call attestation requests"
		>
			{/* Header and Controls */}
			<div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="text-xl font-semibold text-white mb-2">
						Live Video Attestations
					</h2>
					<p className="text-gray-400">
						{filteredApplications.length} attestation request{filteredApplications.length !== 1 ? "s" : ""} • {applications.filter(app => !app.attestationCompleted).length} pending calls
					</p>
				</div>
				<button
					onClick={handleRefresh}
					className="mt-4 md:mt-0 flex items-center px-4 py-2 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors"
				>
					<ArrowPathIcon className="h-4 w-4 mr-2" />
					Refresh
				</button>
			</div>

			{/* Search Bar */}
			<div className="mb-6 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
				<div className="relative">
					<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
					</div>
					<input
						type="text"
						className="block w-full pl-10 pr-10 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
						placeholder="Search by customer name, email, phone, product, or application ID"
						value={searchTerm}
						onChange={handleSearch}
					/>
					{searchTerm && (
						<button
							onClick={() => setSearchTerm("")}
							className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300 transition-colors"
							title="Clear search"
						>
							<XMarkIcon className="h-4 w-4" />
						</button>
					)}
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Panel - Applications List */}
				<div className="lg:col-span-1">
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
						<div className="p-4 border-b border-gray-700/30">
							<h3 className="text-lg font-medium text-white">
								Attestation Requests ({filteredApplications.length})
							</h3>
						</div>
						<div className="overflow-y-auto max-h-[70vh]">
							{filteredApplications.length > 0 ? (
								<ul className="divide-y divide-gray-700/30">
									{filteredApplications.map((application) => (
										<li
											key={application.id}
											className="p-4 hover:bg-gray-800/30 transition-colors cursor-pointer"
											onClick={() => setSelectedApplication(application)}
										>
											<div className="flex justify-between items-start">
												<div className="flex-1">
													<p className="text-white font-medium">
														{application.user.fullName}
													</p>
													<p className="text-sm text-gray-400">
														{application.product.name}
													</p>
													<div className="mt-2 flex items-center text-sm text-gray-300">
														<BanknotesIcon className="mr-1 h-4 w-4 text-green-400" />
														{formatCurrency(application.amount)}
													</div>
													<p className="text-xs text-gray-400 mt-1">
														{application.term} months
													</p>
												</div>
												<div className="text-right ml-4">
													<span
														className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
															application.attestationCompleted
																? "bg-green-500/20 text-green-300 border-green-400/20"
																: "bg-amber-500/20 text-amber-300 border-amber-400/20"
														}`}
													>
														{application.attestationCompleted ? (
															<CheckCircleIcon className="h-3 w-3 mr-1" />
														) : (
															<ClockIcon className="h-3 w-3 mr-1" />
														)}
														{application.attestationCompleted ? "Completed" : "Pending"}
													</span>
													<p className="text-xs text-gray-400 mt-2">
														{formatDateOnly(application.updatedAt)}
													</p>
												</div>
											</div>
										</li>
									))}
								</ul>
							) : (
								<div className="p-8 text-center">
									<VideoCameraIcon className="mx-auto h-12 w-12 text-gray-400" />
									<p className="mt-4 text-gray-300">
										{searchTerm ? "No attestation requests found" : "No attestation requests found"}
									</p>
									{searchTerm && (
										<p className="text-sm text-gray-400 mt-2">
											Try adjusting your search criteria
										</p>
									)}
									{!searchTerm && (
										<p className="text-sm text-gray-400 mt-2">
											When users request live video calls for attestation, they will appear here.
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
							<div className="p-4 border-b border-gray-700/30 flex justify-between items-start">
								<div>
									<h3 className="text-lg font-medium text-white">
										Attestation Details
									</h3>
									<div className="mt-1.5 flex items-center gap-2">
										<span
											className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
												selectedApplication.attestationCompleted
													? "bg-green-500/20 text-green-300 border-green-400/20"
													: "bg-amber-500/20 text-amber-300 border-amber-400/20"
											}`}
										>
											{selectedApplication.attestationCompleted ? (
												<CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
											) : (
												<ClockIcon className="h-3.5 w-3.5 mr-1" />
											)}
											{selectedApplication.attestationCompleted ? "Completed" : "Pending"}
										</span>
									</div>
								</div>
								<span className="px-2 py-1 bg-gray-500/20 text-gray-300 text-xs font-medium rounded-full border border-gray-400/20">
									ID: {selectedApplication.id.substring(0, 8)}
								</span>
							</div>

							{/* Action Bar */}
							<div className="p-4 border-b border-gray-700/30">
								<div className="flex items-center gap-3">
									<span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</span>
									<div className="h-4 w-px bg-gray-600/50"></div>
									<div className="flex items-center gap-2 flex-wrap">
										{!selectedApplication.attestationCompleted ? (
											<button
												onClick={() => handleMarkCompleteClick(selectedApplication.id)}
												disabled={processingId === selectedApplication.id}
												className="flex items-center px-3 py-1.5 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors text-xs disabled:opacity-50"
												title="Mark attestation as complete"
											>
												{processingId === selectedApplication.id ? (
													<>
														<div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-1"></div>
														Processing...
													</>
												) : (
													<>
														<CheckCircleIcon className="h-3 w-3 mr-1" />
														Mark Complete
													</>
												)}
											</button>
										) : (
											<div className="text-green-400 font-medium text-xs flex items-center px-3 py-1.5 bg-green-500/10 rounded-lg border border-green-400/20">
												<CheckCircleIcon className="h-3 w-3 mr-1" />
												Attestation Completed
											</div>
										)}
									</div>
								</div>
							</div>

							<div className="p-6">
								{/* Summary Cards */}
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
										<p className="text-gray-400 text-sm mb-1">
											Loan Amount
										</p>
										<p className="text-2xl font-bold text-white">
											{formatCurrency(selectedApplication.amount)}
										</p>
									</div>
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
										<p className="text-gray-400 text-sm mb-1">
											Status
										</p>
										<div className="flex items-center">
											<span
												className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
													selectedApplication.attestationCompleted
														? "bg-green-500/20 text-green-300 border-green-400/20"
														: "bg-amber-500/20 text-amber-300 border-amber-400/20"
												}`}
											>
												{selectedApplication.attestationCompleted ? (
													<CheckCircleIcon className="h-4 w-4 mr-1" />
												) : (
													<ClockIcon className="h-4 w-4 mr-1" />
												)}
												{selectedApplication.attestationCompleted ? "Completed" : "Pending"}
											</span>
										</div>
									</div>
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
										<p className="text-gray-400 text-sm mb-1">
											Requested Date
										</p>
										<p className="text-sm font-medium text-white text-center">
											{formatDate(selectedApplication.updatedAt)}
										</p>
									</div>
								</div>

								{/* Details */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
									{/* Customer Information */}
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
										<h4 className="text-white font-medium mb-3 flex items-center">
											<UserIcon className="h-5 w-5 mr-2 text-blue-400" />
											Customer Information
										</h4>
										<div className="space-y-3">
											<div>
												<p className="text-gray-400 text-sm">
													Full Name
												</p>
												<p className="text-white">
													{selectedApplication.user.fullName}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Email
												</p>
												<p className="text-white">
													{selectedApplication.user.email}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Phone
												</p>
												<p className="text-white">
													{selectedApplication.user.phoneNumber}
												</p>
											</div>
										</div>
									</div>

									{/* Application Information */}
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
										<h4 className="text-white font-medium mb-3 flex items-center">
											<DocumentTextIcon className="h-5 w-5 mr-2 text-purple-400" />
											Application Details
										</h4>
										<div className="space-y-3">
											<div>
												<p className="text-gray-400 text-sm">
													Product
												</p>
												<p className="text-white">
													{selectedApplication.product.name}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Loan Amount
												</p>
												<p className="text-white">
													{formatCurrency(selectedApplication.amount)}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Term
												</p>
												<p className="text-white">
													{selectedApplication.term} months
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Purpose
												</p>
												<p className="text-white">
													{selectedApplication.purpose || "N/A"}
												</p>
											</div>
										</div>
									</div>
								</div>

								{/* Timeline */}
								<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 mb-6">
									<h4 className="text-white font-medium mb-3 flex items-center">
										<CalendarDaysIcon className="h-5 w-5 mr-2 text-green-400" />
										Timeline
									</h4>
									<div className="space-y-3">
										<div className="flex items-center space-x-3">
											<ClockIcon className="h-4 w-4 text-amber-400" />
											<div>
												<p className="text-sm text-gray-300">
													Requested
												</p>
												<p className="text-xs text-gray-400">
													{formatDate(selectedApplication.updatedAt)}
												</p>
											</div>
										</div>
										{selectedApplication.meetingCompletedAt && (
											<div className="flex items-center space-x-3">
												<CheckCircleIcon className="h-4 w-4 text-green-400" />
												<div>
													<p className="text-sm text-gray-300">
														Completed
													</p>
													<p className="text-xs text-gray-400">
														{formatDate(selectedApplication.meetingCompletedAt)}
													</p>
												</div>
											</div>
										)}
									</div>
								</div>

								{/* Notes */}
								{selectedApplication.attestationNotes && (
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 mb-6">
										<h4 className="text-white font-medium mb-3 flex items-center">
											<DocumentTextIcon className="h-5 w-5 mr-2 text-blue-400" />
											Admin Notes
										</h4>
										<p className="text-gray-300">
											{selectedApplication.attestationNotes}
										</p>
									</div>
								)}

							</div>
						</div>
					) : (
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg h-full flex items-center justify-center p-8">
							<div className="text-center">
								<VideoCameraIcon className="mx-auto h-16 w-16 text-gray-500" />
								<h3 className="mt-4 text-xl font-medium text-white">
									No Attestation Selected
								</h3>
								<p className="mt-2 text-gray-400">
									Select an attestation request from the list to view its details
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Confirmation Modal */}
			<ConfirmationModal
				open={showConfirmModal}
				onClose={() => {
					setShowConfirmModal(false);
					setConfirmApplicationId(null);
				}}
				onConfirm={handleCompleteAttestation}
				title="Confirm Attestation Completion"
				message="Please confirm that the following has been completed:"
				details={[
					"The borrower has met with the lawyer via live video call",
					"The lawyer has verified the borrower's identity",
					"The attestation process has been successfully completed",
					"⚠️ This action cannot be undone. The application will proceed to the next stage.",
				]}
				confirmText="Confirm Completion"
				confirmColor="green"
				isProcessing={processingId !== null}
				processingText="Processing..."
			/>
		</AdminLayout>
	);
}
