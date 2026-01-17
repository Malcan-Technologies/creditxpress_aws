"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AdminLayout from "../../components/AdminLayout";
import Link from "next/link";
import {
	BanknotesIcon,
	MagnifyingGlassIcon,
	ArrowPathIcon,
	DocumentTextIcon,
	UserCircleIcon,
	CheckCircleIcon,
	ExclamationTriangleIcon,
	ClockIcon,
	CreditCardIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";
import { toast } from "sonner";

interface DisbursementData {
	id: string;
	applicationId: string;
	referenceNumber: string;
	amount: number;
	bankName: string | null;
	bankAccountNumber: string | null;
	disbursedAt: string;
	disbursedBy: string;
	notes: string | null;
	status: string;
	createdAt: string;
	updatedAt: string;
	disbursedByUser?: {
		id: string;
		fullName: string | null;
		email: string | null;
	} | null;
	application: {
		id: string;
		amount: number | null;
		purpose: string | null;
		status: string;
		user: {
			id: string;
			fullName: string | null;
			email: string | null;
			phoneNumber: string;
		};
		product: {
			id: string;
			name: string;
			code: string;
		};
		loan?: {
			id: string;
			status: string;
		} | null;
	};
}

function DisbursementsContent() {
	const searchParams = useSearchParams();
	const [disbursements, setDisbursements] = useState<DisbursementData[]>([]);
	const [filteredDisbursements, setFilteredDisbursements] = useState<
		DisbursementData[]
	>([]);
	const [loading, setLoading] = useState(true);
	const [selectedDisbursement, setSelectedDisbursement] =
		useState<DisbursementData | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [filterCounts, setFilterCounts] = useState({
		all: 0,
		COMPLETED: 0,
		FAILED: 0,
	});
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pagination, setPagination] = useState({
		total: 0,
		limit: 50,
		offset: 0,
	});

	useEffect(() => {
		fetchDisbursements();
	}, []);

	// Handle URL search parameter
	useEffect(() => {
		const searchParam = searchParams.get("search");
		if (searchParam) {
			setSearchTerm(searchParam);
		}
	}, [searchParams]);

	const fetchDisbursements = async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: DisbursementData[];
				total: number;
				limit: number;
				offset: number;
			}>("/api/admin/disbursements");

			if (response.success && response.data) {
				setDisbursements(response.data);
				setPagination({
					total: response.total,
					limit: response.limit,
					offset: response.offset,
				});
				
				// Calculate filter counts
				const counts = {
					all: response.data.length,
					COMPLETED: response.data.filter((d: DisbursementData) => d.status === "COMPLETED").length,
					FAILED: response.data.filter((d: DisbursementData) => d.status === "FAILED").length,
				};
				setFilterCounts(counts);
			} else {
				setError("Failed to load disbursements data");
			}
		} catch (error) {
			console.error("Error fetching disbursements:", error);
			setError("Failed to load disbursements. Please try again.");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	const filterDisbursements = useCallback(() => {
		let filtered = [...disbursements];

		// Apply status filter
		if (statusFilter !== "all") {
			filtered = filtered.filter(
				(disbursement) => disbursement.status === statusFilter
			);
		}

		// Apply search filter
		if (searchTerm) {
			const search = searchTerm.toLowerCase();

			// First, check for exact application ID match
			const exactApplicationMatch = filtered.find(
				(disbursement) =>
					disbursement.applicationId.toLowerCase() === search
			);

			if (exactApplicationMatch) {
				// If exact application ID match found, show only that disbursement
				filtered = [exactApplicationMatch];
			} else {
				// Otherwise, do partial matching across all fields
				filtered = filtered.filter(
					(disbursement) =>
						disbursement.referenceNumber
							.toLowerCase()
							.includes(search) ||
						disbursement.applicationId
							.toLowerCase()
							.includes(search) ||
						disbursement.application.user.fullName
							?.toLowerCase()
							.includes(search) ||
						disbursement.application.user.email
							?.toLowerCase()
							.includes(search) ||
						disbursement.application.user.phoneNumber
							.toLowerCase()
							.includes(search) ||
						disbursement.application.product.name
							.toLowerCase()
							.includes(search) ||
						disbursement.disbursedBy.toLowerCase().includes(search)
				);
			}
		}

		setFilteredDisbursements(filtered);
		return filtered;
	}, [disbursements, searchTerm, statusFilter]);

	// Handle auto-selection separately to avoid circular dependency
	useEffect(() => {
		const filtered = filteredDisbursements;

		// Auto-select the first disbursement if there are results and no disbursement is currently selected or selected disbursement is not in filtered results
		if (
			filtered.length > 0 &&
			(!selectedDisbursement ||
				!filtered.find(
					(disbursement) =>
						disbursement.id === selectedDisbursement.id
				))
		) {
			setSelectedDisbursement(filtered[0]);
		}
		// Clear selection if no results
		else if (filtered.length === 0) {
			setSelectedDisbursement(null);
		}
	}, [filteredDisbursements, selectedDisbursement]);

	useEffect(() => {
		filterDisbursements();
	}, [filterDisbursements]);

	const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchTerm(e.target.value);
	};

	const handleRefresh = async () => {
		setRefreshing(true);
		try {
			await fetchDisbursements();
			toast.success("Disbursements refreshed successfully");
		} catch (error) {
			console.error("Error refreshing disbursements:", error);
			toast.error("Failed to refresh disbursements");
		}
	};

	const handleViewDisbursement = (disbursement: DisbursementData) => {
		setSelectedDisbursement(disbursement);
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
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "COMPLETED":
				return {
					bg: "bg-green-500/20",
					text: "text-green-200",
					border: "border-green-400/20",
				};
			case "PENDING":
				return {
					bg: "bg-yellow-500/20",
					text: "text-yellow-200",
					border: "border-yellow-400/20",
				};
			case "FAILED":
				return {
					bg: "bg-red-500/20",
					text: "text-red-200",
					border: "border-red-400/20",
				};
			default:
				return {
					bg: "bg-gray-500/20",
					text: "text-gray-200",
					border: "border-gray-400/20",
				};
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "COMPLETED":
				return CheckCircleIcon;
			case "PENDING":
				return ClockIcon;
			case "FAILED":
				return ExclamationTriangleIcon;
			default:
				return ClockIcon;
		}
	};

	if (loading) {
		return (
			<AdminLayout
				title="Disbursements"
				description="View and manage loan disbursements"
			>
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
				</div>
			</AdminLayout>
		);
	}

	return (
		<AdminLayout
			title="Disbursements"
			description="View and manage loan disbursements"
		>
			{/* Header and Controls */}
			<div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="text-xl font-semibold text-white mb-2">
						Loan Disbursements
					</h2>
					<p className="text-gray-400">
						{filteredDisbursements.length} disbursement
						{filteredDisbursements.length !== 1 ? "s" : ""} with
						total amount:{" "}
						{formatCurrency(
							filteredDisbursements.reduce(
								(sum, disbursement) =>
									sum + disbursement.amount,
								0
							)
						)}
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
					Refresh
				</button>
			</div>

			{/* Error Message */}
			{error && (
				<div className="mb-6 bg-red-700/30 border border-red-600/30 text-red-300 px-4 py-3 rounded-lg">
					{error}
				</div>
			)}

			{/* Search Bar */}
			<div className="mb-4 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
				<div className="flex-1 relative">
					<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
					</div>
					<input
						type="text"
						className="block w-full pl-10 pr-10 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
						placeholder="Search by reference, application ID, customer name, email, or product"
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

			{/* Filter Buttons */}
			<div className="mb-6 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
				<div className="flex flex-wrap gap-2">
					<button
						onClick={() => setStatusFilter("all")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "all"
								? "bg-blue-500/30 text-blue-100 border-blue-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						All ({filterCounts.all})
					</button>
					<button
						onClick={() => setStatusFilter("COMPLETED")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "COMPLETED"
								? "bg-green-500/30 text-green-100 border-green-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Completed ({filterCounts.COMPLETED})
					</button>
					<button
						onClick={() => setStatusFilter("FAILED")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "FAILED"
								? "bg-red-500/30 text-red-100 border-red-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Failed ({filterCounts.FAILED})
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Panel - Disbursements List */}
				<div className="lg:col-span-1">
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
						<div className="p-4 border-b border-gray-700/30">
							<h3 className="text-lg font-medium text-white">
								Disbursements ({filteredDisbursements.length})
							</h3>
						</div>
						<div className="overflow-y-auto max-h-[70vh]">
							{filteredDisbursements.length > 0 ? (
								<ul className="divide-y divide-gray-700/30">
									{filteredDisbursements.map(
										(disbursement) => {
											const statusColor = getStatusColor(
												disbursement.status
											);
											const StatusIcon = getStatusIcon(
												disbursement.status
											);

											return (
												<li
													key={disbursement.id}
													className={`p-4 hover:bg-gray-800/30 transition-colors cursor-pointer ${
														selectedDisbursement?.id ===
														disbursement.id
															? "bg-gray-800/50"
															: ""
													}`}
													onClick={() =>
														handleViewDisbursement(
															disbursement
														)
													}
												>
													<div className="flex justify-between items-start">
														<div className="flex-1">
															<p className="text-white font-medium">
																{disbursement
																	.application
																	.user
																	.fullName ||
																	"N/A"}
															</p>
															<p className="text-sm text-gray-400">
																{
																	disbursement.referenceNumber
																}
															</p>
															<div className="mt-2 flex items-center text-sm text-gray-300">
																<BanknotesIcon className="mr-1 h-4 w-4 text-green-400" />
																{formatCurrency(
																	disbursement.amount
																)}
															</div>
															<p className="text-xs text-gray-400 mt-1">
																{
																	disbursement
																		.application
																		.product
																		.name
																}
															</p>
															{disbursement.application.loan?.id && (
																<Link
																	href={`/dashboard/loans?loanId=${disbursement.application.loan.id}`}
																	className="text-xs text-blue-400 hover:text-blue-300 hover:underline mt-1 block"
																	onClick={(e) => e.stopPropagation()}
																>
																	Loan: {disbursement.application.loan.id.substring(0, 8)}...
																</Link>
															)}
														</div>
														<div className="text-right ml-4">
															<span
																className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
															>
																<StatusIcon className="h-3 w-3 mr-1" />
																{
																	disbursement.status
																}
															</span>
															<p className="text-xs text-gray-400 mt-2">
																{formatDate(
																	disbursement.disbursedAt
																)}
															</p>
														</div>
													</div>
												</li>
											);
										}
									)}
								</ul>
							) : (
								<div className="p-8 text-center">
									<BanknotesIcon className="mx-auto h-12 w-12 text-gray-400" />
									<p className="mt-4 text-gray-300">
										No disbursements found
									</p>
									{searchTerm && (
										<p className="text-sm text-gray-400 mt-2">
											Try adjusting your search criteria
										</p>
									)}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Right Panel - Disbursement Details */}
				<div className="lg:col-span-2">
					{selectedDisbursement ? (
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
							<div className="p-4 border-b border-gray-700/30 flex justify-between items-start">
								<div>
									<h3 className="text-lg font-medium text-white">
										Disbursement Details
									</h3>
									<div className="mt-1.5 flex items-center gap-2">
										{(() => {
											const statusColor = getStatusColor(selectedDisbursement.status);
											const StatusIcon = getStatusIcon(selectedDisbursement.status);
											return (
												<span
													className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
												>
													<StatusIcon className="h-3.5 w-3.5 mr-1" />
													{selectedDisbursement.status}
												</span>
											);
										})()}
									</div>
								</div>
								<span className="px-2 py-1 bg-gray-500/20 text-gray-300 text-xs font-medium rounded-full border border-gray-400/20">
									ID: {selectedDisbursement.id.substring(0, 8)}
								</span>
							</div>

							{/* Action Bar */}
							<div className="p-4 border-b border-gray-700/30">
								<div className="flex items-center gap-3">
									<span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</span>
									<div className="h-4 w-px bg-gray-600/50"></div>
									<div className="flex items-center gap-2 flex-wrap">
										{selectedDisbursement.application.id && (
											<Link
												href={`/dashboard/loans?search=${selectedDisbursement.application.id}`}
												className="flex items-center px-3 py-1.5 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors text-xs"
												title="View the active loan"
											>
												<CreditCardIcon className="h-3 w-3 mr-1" />
												View Active Loan
											</Link>
										)}
									</div>
								</div>
							</div>

							<div className="p-6">
								{/* Summary Cards */}
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
										<p className="text-gray-400 text-sm mb-1">
											Disbursed Amount
										</p>
										<p className="text-2xl font-bold text-white">
											{formatCurrency(
												selectedDisbursement.amount
											)}
										</p>
									</div>
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
										<p className="text-gray-400 text-sm mb-1">
											Status
										</p>
										<div className="flex items-center">
											{(() => {
												const StatusIcon =
													getStatusIcon(
														selectedDisbursement.status
													);
												const statusColor =
													getStatusColor(
														selectedDisbursement.status
													);
												return (
													<span
														className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
													>
														<StatusIcon className="h-4 w-4 mr-1" />
														{
															selectedDisbursement.status
														}
													</span>
												);
											})()}
										</div>
									</div>
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 flex flex-col items-center">
										<p className="text-gray-400 text-sm mb-1">
											Disbursed Date
										</p>
										<p className="text-sm font-medium text-white text-center">
											{formatDate(
												selectedDisbursement.disbursedAt
											)}
										</p>
									</div>
								</div>

								{/* Details */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
									{/* Customer Information */}
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
										<h4 className="text-white font-medium mb-3 flex items-center">
											<UserCircleIcon className="h-5 w-5 mr-2 text-blue-400" />
											Customer Information
										</h4>
										<div className="space-y-3">
											<div>
												<p className="text-gray-400 text-sm">
													Full Name
												</p>
												<p className="text-white">
													{selectedDisbursement
														.application.user
														.fullName || "N/A"}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Email
												</p>
												<p className="text-white">
													{selectedDisbursement
														.application.user
														.email || "N/A"}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Phone
												</p>
												<p className="text-white">
													{
														selectedDisbursement
															.application.user
															.phoneNumber
													}
												</p>
											</div>
										</div>
									</div>

									{/* Disbursement Information */}
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
										<h4 className="text-white font-medium mb-3 flex items-center">
											<BanknotesIcon className="h-5 w-5 mr-2 text-green-400" />
											Disbursement Details
										</h4>
										<div className="space-y-3">
											<div>
												<p className="text-gray-400 text-sm">
													Reference Number
												</p>
												<p className="text-white font-mono">
													{
														selectedDisbursement.referenceNumber
													}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Bank Name
												</p>
												<p className="text-white">
													{selectedDisbursement.bankName ||
														"N/A"}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Account Number
												</p>
												<p className="text-white font-mono">
													{selectedDisbursement.bankAccountNumber ||
														"N/A"}
												</p>
											</div>
											<div>
												<p className="text-gray-400 text-sm">
													Disbursed By
												</p>
												<p className="text-white">
													{selectedDisbursement.disbursedByUser?.fullName || 
														selectedDisbursement.disbursedBy}
												</p>
											</div>
											{selectedDisbursement.application.loan?.id && (
												<div>
													<p className="text-gray-400 text-sm">
														Loan ID
													</p>
													<Link
														href={`/dashboard/loans?loanId=${selectedDisbursement.application.loan.id}`}
														className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-sm"
													>
														{selectedDisbursement.application.loan.id.substring(0, 16)}...
													</Link>
												</div>
											)}
										</div>
									</div>
								</div>

								{/* Application Information */}
								<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 mb-6">
									<h4 className="text-white font-medium mb-3 flex items-center">
										<DocumentTextIcon className="h-5 w-5 mr-2 text-purple-400" />
										Application Information
									</h4>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<p className="text-gray-400 text-sm">
												Product
											</p>
											<p className="text-white">
												{
													selectedDisbursement
														.application.product
														.name
												}
											</p>
										</div>
										<div>
											<p className="text-gray-400 text-sm">
												Application Status
											</p>
											<p className="text-white">
												{
													selectedDisbursement
														.application.status
												}
											</p>
										</div>
										<div>
											<p className="text-gray-400 text-sm">
												Purpose
											</p>
											<p className="text-white">
												{selectedDisbursement
													.application.purpose ||
													"N/A"}
											</p>
										</div>
										<div>
											<p className="text-gray-400 text-sm">
												Application Amount
											</p>
											<p className="text-white">
												{selectedDisbursement
													.application.amount
													? formatCurrency(
															selectedDisbursement
																.application
																.amount
													  )
													: "N/A"}
											</p>
										</div>
									</div>
								</div>

								{/* Notes */}
								{selectedDisbursement.notes && (
									<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30 mb-6">
										<h4 className="text-white font-medium mb-3">
											Notes
										</h4>
										<p className="text-gray-300">
											{selectedDisbursement.notes}
										</p>
									</div>
								)}

							</div>
						</div>
					) : (
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg h-full flex items-center justify-center p-8">
							<div className="text-center">
								<BanknotesIcon className="mx-auto h-16 w-16 text-gray-500" />
								<h3 className="mt-4 text-xl font-medium text-white">
									No Disbursement Selected
								</h3>
								<p className="mt-2 text-gray-400">
									Select a disbursement from the list to view
									its details
								</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</AdminLayout>
	);
}

export default function DisbursementsPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<DisbursementsContent />
		</Suspense>
	);
}

