"use client";

import React, { useEffect, useState } from "react";
import {
	InformationCircleIcon,
	ArrowPathIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	DocumentTextIcon,
	DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import { fetchWithAdminTokenRefresh } from "../../lib/authUtils";
import { GaugeComponent } from "react-gauge-component";
import { toast } from "sonner";

interface CreditReport {
	id: string;
	userId: string;
	applicationId?: string;
	reportType: string;
	icNumber?: string;
	fullName: string;
	creditScore?: number;
	dueDiligentIndex?: string;
	riskGrade?: string;
	litigationIndex?: string;
	summaryStatus?: string;
	totalOutstanding?: number;
	activeAccounts?: number;
	defaultedAccounts?: number;
	legalCases?: number;
	bankruptcyRecords?: number;
	fetchedAt: string;
	fetchedBy: string;
	rawResponse?: any;
	ctosRequestId?: string;
	requestStatus?: string;
	requestedAt?: string;
	confirmedAt?: string;
	hasDataError?: boolean;
	errorMessage?: string;
}

interface CreditReportCardProps {
	userId: string;
	applicationId: string;
	userFullName: string;
	userIcNumber?: string;
	existingReport?: CreditReport | null;
	onReportFetched?: (report: CreditReport) => void;
	onRequestConfirmation?: (onConfirm: () => void) => void;
}

export default function CreditReportCard({
	userId,
	applicationId,
	userFullName,
	userIcNumber,
	existingReport,
	onReportFetched,
	onRequestConfirmation,
}: CreditReportCardProps) {
	const [loadingCache, setLoadingCache] = useState(false);
	const [loadingRequest, setLoadingRequest] = useState(false);
	const [report, setReport] = useState<CreditReport | null>(existingReport || null);
	const [expanded, setExpanded] = useState(false);
	const [autoLoaded, setAutoLoaded] = useState(false);
	const [requestStatus, setRequestStatus] = useState<string | null>(null);
	const [expandedSubAccounts, setExpandedSubAccounts] = useState<Set<string>>(new Set());

	// Auto-load cached report on mount or when userId/applicationId changes
	useEffect(() => {
		setReport(existingReport || null);
		setExpanded(false);
		if (existingReport) {
			setRequestStatus(existingReport.requestStatus || null);
			setAutoLoaded(true);
		} else {
			setRequestStatus(null);
		}
	}, [existingReport, applicationId, userId]);

	// Separate effect for auto-loading cached report
	useEffect(() => {
		if (!existingReport && !autoLoaded && userId) {
			handleAutoLoadCachedReport();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userId, applicationId]);

	// Auto-load cached report function
	const handleAutoLoadCachedReport = async () => {
		if (autoLoaded) return; // Prevent multiple auto-loads
		
		setLoadingCache(true);
		setError(null);

		try {
			const result = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: CreditReport;
			}>(`/api/admin/credit-reports/cache/${userId}`, {
				method: "GET",
			});

		if (result.success && result.data) {
			setReport(result.data);
			setRequestStatus(result.data.requestStatus || null);
			if (onReportFetched) {
				onReportFetched(result.data);
			}
		} else {
			setReport(null);
			setError(null);
		}
	} catch (err: any) {
		console.error("[CTOS FRONTEND] ✗ Error fetching cached credit report:", err);
		// Handle 404 as expected case (no cached report) - stay silent
		if (err?.response?.status === 404 || err?.status === 404) {
			setReport(null);
		} else {
			// Only show error for actual failures (not 404)
			toast.error(
				err instanceof Error
					? err.message
					: "Error loading cached report"
			);
		}
	} finally {
		setLoadingCache(false);
		setAutoLoaded(true);
	}
	};

	const handleReloadReport = async () => {
		setLoadingCache(true);

		try {
			const result = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: CreditReport;
			}>(`/api/admin/credit-reports/cache/${userId}`, {
				method: "GET",
			});

			if (result.success && result.data) {
				setReport(result.data);
				setRequestStatus(result.data.requestStatus || null);
				if (onReportFetched) {
					onReportFetched(result.data);
				}
				toast.success("Credit report reloaded successfully");
			} else {
				toast.info("No cached report available for this user");
			}
		} catch (err: any) {
			console.error("[CTOS FRONTEND] ✗ Error reloading credit report:", err);
			// Handle 404 as expected case (no cached report)
			if (err?.response?.status === 404 || err?.status === 404) {
				toast.info("No cached report available for this user");
			} else {
				toast.error(
					err instanceof Error
						? err.message
						: "Failed to reload report"
				);
			}
		} finally {
			setLoadingCache(false);
		}
	};
			
	const executeRequestFreshReport = async () => {
		setLoadingRequest(true);

		try {
			const result = await fetchWithAdminTokenRefresh<{
				success: boolean;
				data: CreditReport;
			}>("/api/admin/credit-reports/request-and-confirm", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					applicationId,
					userId,
					icNumber: userIcNumber,
					fullName: userFullName,
				}),
			});

			if (result.success && result.data) {
				setReport(result.data);
				setRequestStatus("COMPLETED");
				if (onReportFetched) {
					onReportFetched(result.data);
				}
				toast.success("Fresh credit report requested successfully");
			} else {
				toast.error("Failed to request credit report");
			}
		} catch (err) {
			console.error("Error requesting credit report:", err);
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to request credit report"
			);
		} finally {
			setLoadingRequest(false);
		}
	};

	const handleRequestFreshReport = () => {
		if (!userIcNumber) {
			toast.error("IC number is required to request credit report");
			return;
		}

		// Use callback if provided, otherwise use window.confirm as fallback
		if (onRequestConfirmation) {
			onRequestConfirmation(executeRequestFreshReport);
		} else {
			const confirmMessage = `Are you sure you want to request a fresh credit report from CTOS?\n\nThis will charge company credits.`;
			if (window.confirm(confirmMessage)) {
				executeRequestFreshReport();
			}
		}
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-MY", {
			day: "numeric",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const getTimeAgo = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "just now";
		if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
		if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
		return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
	};

	const getRiskColor = (riskGrade?: string) => {
		if (!riskGrade) return "text-gray-400";
		const grade = riskGrade.toUpperCase();
		if (grade.includes("A") || grade.includes("LOW")) return "text-green-400";
		if (grade.includes("B") || grade.includes("MEDIUM")) return "text-yellow-400";
		if (grade.includes("C") || grade.includes("HIGH")) return "text-orange-400";
		if (grade.includes("D") || grade.includes("VERY_HIGH")) return "text-red-400";
		return "text-gray-400";
	};

	const getLitigationIndexColor = (litigationIndex?: string) => {
		if (!litigationIndex) return "text-gray-400";
		// Litigation Index ranges from "0000" (good/green) to "9999" (bad/red)
		const indexValue = parseInt(litigationIndex, 10);
		if (isNaN(indexValue)) return "text-gray-400";
		
		if (indexValue === 0) return "text-green-400"; // 0000 = Excellent
		if (indexValue <= 100) return "text-green-300"; // 0001-0100 = Good
		if (indexValue <= 500) return "text-yellow-400"; // 0101-0500 = Fair
		if (indexValue <= 2000) return "text-orange-400"; // 0501-2000 = Poor
		return "text-red-400"; // 2001-9999 = Very Poor
	};

	const toggleSubAccountExpansion = (subAccountId: string) => {
		setExpandedSubAccounts((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(subAccountId)) {
				newSet.delete(subAccountId);
			} else {
				newSet.add(subAccountId);
			}
			return newSet;
		});
	};

	const Tooltip = ({
		children,
		content,
	}: {
		children: React.ReactNode;
		content: string;
	}) => (
		<div className="group relative inline-block">
			{children}
			<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50 pointer-events-none">
				<div className="text-left">{content}</div>
				<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
			</div>
		</div>
	);

	return (
		<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-6 mb-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<DocumentTextIcon className="h-5 w-5 text-blue-400" />
					<h4 className="text-lg font-medium text-white">
						Credit Report (CTOS)
					</h4>
					<Tooltip content="Credit report from CTOS B2B API provides comprehensive credit information including CTOS Score (FICO-based), Due Diligent Index (DDI), Risk Grade, Litigation Index, financial summaries, and legal records. Data sourced from CCRIS, CTOS databases, and other credit information providers for informed loan approval decisions.">
						<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
					</Tooltip>
				</div>
				<div className="flex items-center gap-2">
					{/* Reload Report Button - Only show after auto-load */}
					{autoLoaded && (
					<button
							onClick={handleReloadReport}
						disabled={loadingCache}
						className="flex items-center px-4 py-2 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loadingCache ? (
							<>
								<ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
									Reloading...
							</>
						) : (
							<>
									<ArrowPathIcon className="h-4 w-4 mr-2" />
									Reload Report
							</>
						)}
					</button>
					)}
					{/* Request Fresh Report Button */}
					<button
						onClick={handleRequestFreshReport}
						disabled={loadingRequest || !userIcNumber}
						className="flex items-center px-4 py-2 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loadingRequest ? (
							<>
								<ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
								Requesting...
							</>
						) : (
							<>
								<DocumentTextIcon className="h-4 w-4 mr-2" />
								Request Fresh Report
							</>
						)}
					</button>
				</div>
			</div>


			{/* Report Display */}
			{report && (
				<div>
					{/* Check for data errors */}
					{report.hasDataError ? (
						/* Error Display */
						<div className="bg-red-500/10 border border-red-400/30 rounded-xl p-8 text-center">
							<div className="flex flex-col items-center gap-4">
								<div className="rounded-full bg-red-500/20 p-4">
									<svg className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
									</svg>
								</div>
								<div>
									<h3 className="text-xl font-semibold text-red-300 mb-2">
										No Credit Data Available
									</h3>
									<p className="text-gray-300 mb-2">
										{report.errorMessage || 'The IC number provided does not have any credit data in the CTOS system.'}
									</p>
									<p className="text-sm text-gray-400">
										This could mean:
									</p>
									<ul className="text-sm text-gray-400 mt-2 space-y-1">
										<li>• The IC number is not registered in CTOS database</li>
										<li>• CCRIS service was unavailable during the request</li>
										<li>• The individual has no credit history</li>
									</ul>
								</div>
								<div className="flex items-center gap-3 mt-4">
									<button
										onClick={handleRequestFreshReport}
										disabled={loadingRequest || !userIcNumber}
										className="flex items-center px-4 py-2 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{loadingRequest ? (
											<>
												<ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
												Requesting...
											</>
										) : (
											<>
												<DocumentTextIcon className="h-4 w-4 mr-2" />
												Try Request Again
											</>
										)}
									</button>
								</div>
							</div>
						</div>
					) : (
						/* Normal Report Display */
						<>
							{/* Summary Info */}
							<div className="flex items-center justify-between mb-4">
						<div className="flex flex-col gap-1">
							<div className="text-sm text-gray-400">
								Last fetched: {getTimeAgo(report.fetchedAt)} (
								{formatDate(report.fetchedAt)})
							</div>
							{report.requestStatus && (
								<div className="flex items-center gap-2">
									<span className="text-xs text-gray-500">Status:</span>
									<span
										className={`text-xs px-2 py-0.5 rounded ${
											report.requestStatus === "COMPLETED"
												? "bg-green-500/20 text-green-400"
												: report.requestStatus === "PENDING_REQUEST"
												? "bg-yellow-500/20 text-yellow-400"
												: report.requestStatus === "FAILED"
												? "bg-red-500/20 text-red-400"
												: "bg-gray-500/20 text-gray-400"
										}`}
									>
										{report.requestStatus}
									</span>
								</div>
							)}
							{report.requestedAt && (
								<div className="text-xs text-gray-500">
									Requested: {formatDate(report.requestedAt)}
								</div>
							)}
							{report.confirmedAt && (
								<div className="text-xs text-gray-500">
									Confirmed: {formatDate(report.confirmedAt)}
								</div>
							)}
						</div>
						<button
							onClick={() => setExpanded(!expanded)}
							className="flex items-center text-sm text-gray-400 hover:text-gray-200 transition-colors"
						>
							{expanded ? (
								<>
									<ChevronUpIcon className="h-4 w-4 mr-1" />
									Hide Details
								</>
							) : (
								<>
									<ChevronDownIcon className="h-4 w-4 mr-1" />
									Show Details
								</>
							)}
						</button>
					</div>

					{/* Credit Score Gauge */}
					{report.creditScore !== undefined && (
						<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-6 rounded-xl border border-gray-700/40 shadow-lg mb-4">
							<div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/30">
								<h5 className="text-white font-semibold text-lg">CTOS Credit Score</h5>
								<Tooltip content="CTOS Score (FICO-based) ranges from 300-850. Higher scores indicate better creditworthiness. Score bands: 740+ (Excellent), 700-739 (Good), 650-699 (Fair), 600-649 (Poor), &lt;600 (Very Poor). Based on credit history, payment behavior, outstanding debts, and financial standing.">
									<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
								</Tooltip>
							</div>
							<div className="flex justify-center">
								<GaugeComponent
									value={report.creditScore}
									minValue={300}
									maxValue={850}
									arc={{
										width: 0.2,
										padding: 0.005,
										cornerRadius: 1,
										gradient: false,
										subArcs: [
											{ limit: 528, color: "#EF4444" }, // Red (Poor)
											{ limit: 650, color: "#F97316" }, // Orange (Low)
											{ limit: 696, color: "#EAB308" }, // Yellow (Fair)
											{ limit: 717, color: "#84CC16" }, // Light Green (Good)
											{ limit: 743, color: "#22C55E" }, // Green (Very Good)
											{ limit: 850, color: "#16A34A" }, // Dark Green (Excellent)
										],
									}}
									pointer={{
										type: "arrow",
										length: 0.7,
										width: 8,
										color: "#FFFFFF",
									}}
									labels={{
										valueLabel: {
											formatTextValue: (value) => Math.round(value).toString(),
											style: {
												fontSize: "32px",
												fontWeight: "bold",
												fill: "#FFFFFF",
											},
										},
										tickLabels: {
											type: "outer",
											defaultTickValueConfig: {
												formatTextValue: (value) => Math.round(value).toString(),
												style: {
													fontSize: "12px",
													fill: "#9CA3AF",
												},
											},
											ticks: [
												{ value: 300 },
												{ value: 400 },
												{ value: 500 },
												{ value: 600 },
												{ value: 700 },
												{ value: 850 },
											],
										},
									}}
									style={{
										width: "100%",
										maxWidth: "400px",
										margin: "0 auto",
									}}
								/>
							</div>
						</div>
					)}

					{/* Key Metrics Grid - Arranged in logical order */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
						{/* Due Diligent Index */}
						{report.dueDiligentIndex && (
							<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-5 rounded-xl border border-gray-700/40 shadow-lg hover:shadow-xl transition-shadow">
								<div className="flex items-center gap-2 mb-2">
									<p className="text-gray-300 text-xs font-medium uppercase tracking-wide">
										Due Diligent Index
									</p>
									<Tooltip content="Due Diligent Index (DDI) is a 4-digit composite score from CTOS. Lower values indicate better creditworthiness: 0000 (Excellent), 0001-0010 (Good), 0011-0100 (Fair), 0101-1000 (Poor), 1001-9999 (Very Poor). Combines payment history, outstanding debts, legal records, and credit behavior patterns.">
										<InformationCircleIcon className="h-3.5 w-3.5 text-gray-500 hover:text-gray-300 cursor-help" />
									</Tooltip>
								</div>
								<p className="text-3xl font-bold text-white tracking-tight">
									{report.dueDiligentIndex}
								</p>
							</div>
						)}

						{/* Risk Grade */}
						{report.riskGrade && (
							<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-5 rounded-xl border border-gray-700/40 shadow-lg hover:shadow-xl transition-shadow">
								<div className="flex items-center gap-2 mb-2">
									<p className="text-gray-300 text-xs font-medium uppercase tracking-wide">Risk Grade</p>
									<Tooltip content="Risk Grade is automatically derived from CTOS Score (FICO score). Grade bands: A (740+ = Excellent/Low Risk), B (700-739 = Good/Moderate Risk), C (650-699 = Fair/Moderate-High Risk), D (600-649 = Poor/High Risk), E (&lt;600 = Very Poor/Very High Risk). Indicates likelihood of default or payment issues.">
										<InformationCircleIcon className="h-3.5 w-3.5 text-gray-500 hover:text-gray-300 cursor-help" />
									</Tooltip>
								</div>
								<p
									className={`text-3xl font-bold ${getRiskColor(
										report.riskGrade
									)} tracking-tight`}
								>
									{report.riskGrade}
								</p>
							</div>
						)}

						{/* Litigation Index */}
						{(report.litigationIndex || (report.rawResponse as any)?.extractedData?.litigationIndex?.value) && (
							<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-5 rounded-xl border border-gray-700/40 shadow-lg hover:shadow-xl transition-shadow">
								<div className="flex items-center gap-2 mb-2">
									<p className="text-gray-300 text-xs font-medium uppercase tracking-wide">Litigation Index</p>
									<Tooltip content="CTOS Litigation Index is a 4-digit score indicating legal risk exposure. Ranges from 0000 (Excellent - no litigation risk) to 9999 (Very High - significant litigation risk). Lower values indicate better legal standing. Based on legal cases, court records, and litigation history from CTOS databases.">
										<InformationCircleIcon className="h-3.5 w-3.5 text-gray-500 hover:text-gray-300 cursor-help" />
									</Tooltip>
								</div>
								<p
									className={`text-3xl font-bold ${getLitigationIndexColor(
										report.litigationIndex || (report.rawResponse as any)?.extractedData?.litigationIndex?.value
									)} tracking-tight`}
								>
									{report.litigationIndex || (report.rawResponse as any)?.extractedData?.litigationIndex?.value}
								</p>
							</div>
						)}

						{/* Summary Status */}
						{report.summaryStatus && (
							<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-5 rounded-xl border border-gray-700/40 shadow-lg hover:shadow-xl transition-shadow">
								<div className="flex items-center gap-2 mb-2">
									<p className="text-gray-300 text-xs font-medium uppercase tracking-wide">Status</p>
									<Tooltip content="Summary Status is a CTOS status code (typically numeric like '1000') indicating the overall credit assessment result. This code reflects the completeness and status of the credit report data retrieved from CTOS databases including CCRIS, CTOS, and other credit information sources.">
										<InformationCircleIcon className="h-3.5 w-3.5 text-gray-500 hover:text-gray-300 cursor-help" />
									</Tooltip>
								</div>
								<p className="text-2xl font-bold text-white tracking-tight">
									{report.summaryStatus}
								</p>
							</div>
						)}
					</div>

					{/* Expanded Details */}
					{expanded && (
						<div className="mt-6 space-y-6">
							{/* Section 2: Credit Info at a Glance */}
							{report.rawResponse && (report.rawResponse as any)?.extractedData?.creditInfoAtGlance && (
								<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-6 rounded-xl border border-gray-700/40 shadow-lg">
									<div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/30">
										<h5 className="text-white font-semibold text-lg">Credit Info at a Glance</h5>
										<Tooltip content="Summary of key credit information from various sources including bankruptcy status, outstanding balances, legal records, credit applications, and special attention accounts. Provides a quick overview of creditworthiness.">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
									</Tooltip>
								</div>
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
										{(report.rawResponse as any).extractedData.creditInfoAtGlance.bankruptcyStatus && (
											<div>
												<p className="text-gray-400 text-xs mb-1">Bankruptcy Status</p>
												<p
													className={`font-medium ${
														(report.rawResponse as any).extractedData.creditInfoAtGlance.bankruptcyRecords
															? 'text-red-400'
															: 'text-green-400'
													}`}
												>
													{(report.rawResponse as any).extractedData.creditInfoAtGlance.bankruptcyStatus}
												</p>
											</div>
										)}
										{(report.rawResponse as any).extractedData.creditInfoAtGlance.activeLegalRecordsPersonal && (
											<div>
												<p className="text-gray-400 text-xs mb-1">Active Legal Records (Personal)</p>
												<p className="text-white font-medium">
													{((report.rawResponse as any).extractedData.creditInfoAtGlance.activeLegalRecordsPersonal.count || 0)} records
												</p>
												{((report.rawResponse as any).extractedData.creditInfoAtGlance.activeLegalRecordsPersonal.value !== undefined && 
												  (report.rawResponse as any).extractedData.creditInfoAtGlance.activeLegalRecordsPersonal.value !== null) && (
													<p className="text-gray-300 text-xs">
														RM {((report.rawResponse as any).extractedData.creditInfoAtGlance.activeLegalRecordsPersonal.value || 0).toLocaleString('en-MY', {
															minimumFractionDigits: 2,
															maximumFractionDigits: 2
														})}
													</p>
						)}
					</div>
										)}
										{(report.rawResponse as any).extractedData.creditInfoAtGlance.activeLegalRecordsNonPersonal && (
											<div>
												<p className="text-gray-400 text-xs mb-1">Active Legal Records (Non-Personal)</p>
												<p className="text-white font-medium">
													{((report.rawResponse as any).extractedData.creditInfoAtGlance.activeLegalRecordsNonPersonal.count || 0)} records
												</p>
												{((report.rawResponse as any).extractedData.creditInfoAtGlance.activeLegalRecordsNonPersonal.value !== undefined && 
												  (report.rawResponse as any).extractedData.creditInfoAtGlance.activeLegalRecordsNonPersonal.value !== null) && (
													<p className="text-gray-300 text-xs">
														RM {((report.rawResponse as any).extractedData.creditInfoAtGlance.activeLegalRecordsNonPersonal.value || 0).toLocaleString('en-MY', {
															minimumFractionDigits: 2,
															maximumFractionDigits: 2
														})}
													</p>
												)}
											</div>
										)}
										{(report.rawResponse as any).extractedData.creditInfoAtGlance.legalRecordsAvailability !== undefined && (
											<div>
												<p className="text-gray-400 text-xs mb-1">Legal Records Availability</p>
												<p className="text-white font-medium">
													{(report.rawResponse as any).extractedData.creditInfoAtGlance.legalRecordsAvailability}
												</p>
											</div>
										)}
										{(report.rawResponse as any).extractedData.creditInfoAtGlance.specialAttentionAccounts !== undefined && (
											<div>
												<p className="text-gray-400 text-xs mb-1">Special Attention Accounts</p>
												<p className="text-red-400 font-medium">
													{(report.rawResponse as any).extractedData.creditInfoAtGlance.specialAttentionAccounts}
												</p>
											</div>
										)}
										{(report.rawResponse as any).extractedData.creditInfoAtGlance.dishonouredChequesAvailability !== undefined && (
											<div>
												<p className="text-gray-400 text-xs mb-1">Dishonoured Cheques</p>
												<p className={`font-medium ${
													(report.rawResponse as any).extractedData.creditInfoAtGlance.dishonouredChequesAvailability 
														? 'text-red-400' 
														: 'text-green-400'
												}`}>
													{(report.rawResponse as any).extractedData.creditInfoAtGlance.dishonouredChequesAvailability ? 'YES' : 'NO'}
												</p>
											</div>
										)}
										{(report.rawResponse as any).extractedData.creditInfoAtGlance.outstandingCreditFacilities && (
											<div>
												<p className="text-gray-400 text-xs mb-1">Outstanding Credit Facilities</p>
												<p className="text-white font-medium">
													{((report.rawResponse as any).extractedData.creditInfoAtGlance.outstandingCreditFacilities.count || 0)} facilities
												</p>
												{((report.rawResponse as any).extractedData.creditInfoAtGlance.outstandingCreditFacilities.value !== undefined && 
												  (report.rawResponse as any).extractedData.creditInfoAtGlance.outstandingCreditFacilities.value !== null) && (
													<p className="text-gray-300 text-xs">
														RM {((report.rawResponse as any).extractedData.creditInfoAtGlance.outstandingCreditFacilities.value || 0).toLocaleString('en-MY', {
															minimumFractionDigits: 2,
															maximumFractionDigits: 2
														})}
													</p>
												)}
											</div>
										)}
										{(report.rawResponse as any).extractedData.creditInfoAtGlance.instalmentArrearsPast24Months !== undefined && (
											<div>
												<p className="text-gray-400 text-xs mb-1">Instalment Arrears (Past 24 Months)</p>
												<p className={`font-medium ${
													(report.rawResponse as any).extractedData.creditInfoAtGlance.instalmentArrearsPast24Months 
														? 'text-red-400' 
														: 'text-green-400'
												}`}>
													{(report.rawResponse as any).extractedData.creditInfoAtGlance.instalmentArrearsPast24Months ? 'YES' : 'NO'}
												</p>
											</div>
										)}
										{(report.rawResponse as any).extractedData.creditInfoAtGlance.creditApplicationsPast12Months && (
											<div>
												<p className="text-gray-400 text-xs mb-1">Credit Applications (Past 12 Months)</p>
												<p className="text-white font-medium">
													Total: {((report.rawResponse as any).extractedData.creditInfoAtGlance.creditApplicationsPast12Months.total || 0)}
												</p>
												<p className="text-gray-300 text-xs">
													Approved: {((report.rawResponse as any).extractedData.creditInfoAtGlance.creditApplicationsPast12Months.approved || 0)} | 
													Pending: {((report.rawResponse as any).extractedData.creditInfoAtGlance.creditApplicationsPast12Months.pending || 0)}
												</p>
											</div>
										)}
										{(report.rawResponse as any).extractedData.creditInfoAtGlance.tradeRefereeListingAvailability !== undefined && (
											<div>
												<p className="text-gray-400 text-xs mb-1">Trade Referee Listing</p>
												<p className={`font-medium ${
													(report.rawResponse as any).extractedData.creditInfoAtGlance.tradeRefereeListingAvailability 
														? 'text-red-400' 
														: 'text-green-400'
												}`}>
													{(report.rawResponse as any).extractedData.creditInfoAtGlance.tradeRefereeListingAvailability ? 'YES' : 'NO'}
												</p>
											</div>
										)}
									</div>
								</div>
							)}

							{/* Section 5: CTOS Litigation Index */}
							{((report.rawResponse && (report.rawResponse as any)?.extractedData?.litigationIndex) || report.litigationIndex) && (
								<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-6 rounded-xl border border-gray-700/40 shadow-lg">
									<div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/30">
										<h5 className="text-white font-semibold text-lg">CTOS Litigation Index</h5>
										<Tooltip content="CTOS Litigation Index is a 4-digit score (0000-9999) indicating legal risk exposure. Lower values (0000) indicate excellent/no litigation risk, while higher values (9999) indicate very high litigation risk. Based on legal cases, court records, and litigation history from CTOS databases.">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
										</Tooltip>
									</div>
									<div className="flex justify-center mb-2">
										<GaugeComponent
											value={parseInt(
												(report.rawResponse as any)?.extractedData?.litigationIndex?.value || 
												report.litigationIndex || 
												'0', 
												10
											)}
											minValue={0}
											maxValue={9999}
											arc={{
												width: 0.2,
												padding: 0.005,
												cornerRadius: 1,
												gradient: false,
											subArcs: [
												{ limit: 100, color: "#22C55E" }, // Green (Very Low Risk)
												{ limit: 500, color: "#84CC16" }, // Light Green (Low Risk)
												{ limit: 2000, color: "#EAB308" }, // Yellow (Moderate Risk)
												{ limit: 5000, color: "#F97316" }, // Orange (High Risk)
												{ limit: 9999, color: "#EF4444" }, // Red (Very High Risk)
											],
											}}
											pointer={{
												type: "arrow",
												length: 0.7,
												width: 8,
												color: "#FFFFFF",
											}}
											labels={{
												valueLabel: {
													formatTextValue: (value) => Math.round(value).toString().padStart(4, '0'),
													style: {
														fontSize: "32px",
														fontWeight: "bold",
														fill: "#FFFFFF",
													},
												},
												tickLabels: {
													type: "outer",
													defaultTickValueConfig: {
														formatTextValue: (value) => Math.round(value).toString().padStart(4, '0'),
														style: {
															fontSize: "12px",
															fill: "#9CA3AF",
														},
													},
													ticks: [
														{ value: 0 },
														{ value: 2500 },
														{ value: 5000 },
														{ value: 7500 },
														{ value: 9999 },
													],
												},
											}}
											style={{
												width: "100%",
												maxWidth: "400px",
												margin: "0 auto",
											}}
										/>
									</div>
									{((report.rawResponse as any)?.extractedData?.litigationIndex?.description) && (
										<p className="text-gray-400 text-xs text-center mt-2">
											{(report.rawResponse as any).extractedData.litigationIndex.description}
										</p>
									)}
								</div>
							)}

							{/* Section 9: Banking Payment History (CCRIS Summary) */}
							{report.rawResponse && (report.rawResponse as any)?.extractedData?.ccrisSummary && (
								<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-6 rounded-xl border border-gray-700/40 shadow-lg">
									<div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/30">
										<h5 className="text-white font-semibold text-lg">Banking Payment History (CCRIS Summary)</h5>
										<Tooltip content="Summary of credit applications and liabilities from CCRIS. Includes approved and pending applications, outstanding balances as borrower and guarantor, legal action status, and special attention accounts.">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
										</Tooltip>
									</div>
									
									{/* Credit Applications */}
									{(report.rawResponse as any).extractedData.ccrisSummary.applications && (
										<div className="mb-4 pb-4 border-b border-gray-700/30">
											<h6 className="text-gray-300 text-sm font-medium mb-2">Credit Applications (Past 12 Months)</h6>
											<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
												<div>
													<p className="text-gray-400 text-xs">Total</p>
													<p className="text-white font-medium">
														{(report.rawResponse as any).extractedData.ccrisSummary.applications.total || 0}
													</p>
												</div>
												<div>
													<p className="text-gray-400 text-xs">Approved</p>
													<p className="text-green-400 font-medium">
														{(report.rawResponse as any).extractedData.ccrisSummary.applications.approved?.count || 0}
													</p>
													{(report.rawResponse as any).extractedData.ccrisSummary.applications.approved?.amount !== undefined && (
														<p className="text-gray-300 text-xs">
															RM {((report.rawResponse as any).extractedData.ccrisSummary.applications.approved.amount || 0).toLocaleString('en-MY', {
																minimumFractionDigits: 2,
																maximumFractionDigits: 2
															})}
														</p>
													)}
												</div>
												<div>
													<p className="text-gray-400 text-xs">Pending</p>
													<p className="text-yellow-400 font-medium">
														{(report.rawResponse as any).extractedData.ccrisSummary.applications.pending?.count || 0}
													</p>
													{(report.rawResponse as any).extractedData.ccrisSummary.applications.pending?.amount !== undefined && (
														<p className="text-gray-300 text-xs">
															RM {((report.rawResponse as any).extractedData.ccrisSummary.applications.pending.amount || 0).toLocaleString('en-MY', {
																minimumFractionDigits: 2,
																maximumFractionDigits: 2
															})}
														</p>
													)}
												</div>
											</div>
										</div>
									)}

									{/* Liabilities Summary */}
									{(report.rawResponse as any).extractedData.ccrisSummary.liabilities && (
										<div className="mb-4 pb-4 border-b border-gray-700/30">
											<h6 className="text-gray-300 text-sm font-medium mb-2">Summary of Potential & Current Liabilities</h6>
											<div className="space-y-3 text-sm">
												{(report.rawResponse as any).extractedData.ccrisSummary.liabilities.asBorrower && (
													<div>
														<p className="text-gray-400 text-xs mb-1">As Borrower</p>
														<div className="grid grid-cols-3 gap-2">
															<div>
																<p className="text-gray-500 text-xs">Outstanding</p>
																<p className="text-white font-medium">
																	RM {((report.rawResponse as any).extractedData.ccrisSummary.liabilities.asBorrower.outstanding || 0).toLocaleString('en-MY', {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2
																	})}
																</p>
															</div>
															<div>
																<p className="text-gray-500 text-xs">Total Limit</p>
																<p className="text-white font-medium">
																	RM {((report.rawResponse as any).extractedData.ccrisSummary.liabilities.asBorrower.totalLimit || 0).toLocaleString('en-MY', {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2
																	})}
																</p>
															</div>
															<div>
																<p className="text-gray-500 text-xs">FEC Limit</p>
																<p className="text-white font-medium">
																	RM {((report.rawResponse as any).extractedData.ccrisSummary.liabilities.asBorrower.fecLimit || 0).toLocaleString('en-MY', {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2
																	})}
																</p>
															</div>
														</div>
													</div>
												)}
												{(report.rawResponse as any).extractedData.ccrisSummary.liabilities.asGuarantor && (
													<div>
														<p className="text-gray-400 text-xs mb-1">As Guarantor</p>
														<div className="grid grid-cols-3 gap-2">
															<div>
																<p className="text-gray-500 text-xs">Outstanding</p>
																<p className="text-white font-medium">
																	RM {((report.rawResponse as any).extractedData.ccrisSummary.liabilities.asGuarantor.outstanding || 0).toLocaleString('en-MY', {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2
																	})}
																</p>
															</div>
															<div>
																<p className="text-gray-500 text-xs">Total Limit</p>
																<p className="text-white font-medium">
																	RM {((report.rawResponse as any).extractedData.ccrisSummary.liabilities.asGuarantor.totalLimit || 0).toLocaleString('en-MY', {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2
																	})}
																</p>
															</div>
															<div>
																<p className="text-gray-500 text-xs">FEC Limit</p>
																<p className="text-white font-medium">
																	RM {((report.rawResponse as any).extractedData.ccrisSummary.liabilities.asGuarantor.fecLimit || 0).toLocaleString('en-MY', {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2
																	})}
																</p>
															</div>
														</div>
													</div>
												)}
												{(report.rawResponse as any).extractedData.ccrisSummary.liabilities.total && (
													<div>
														<p className="text-gray-400 text-xs mb-1">Total</p>
														<div className="grid grid-cols-3 gap-2">
															<div>
																<p className="text-gray-500 text-xs">Outstanding</p>
																<p className="text-white font-medium">
																	RM {((report.rawResponse as any).extractedData.ccrisSummary.liabilities.total.outstanding || 0).toLocaleString('en-MY', {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2
																	})}
																</p>
															</div>
															<div>
																<p className="text-gray-500 text-xs">Total Limit</p>
																<p className="text-white font-medium">
																	RM {((report.rawResponse as any).extractedData.ccrisSummary.liabilities.total.totalLimit || 0).toLocaleString('en-MY', {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2
																	})}
																</p>
															</div>
															<div>
																<p className="text-gray-500 text-xs">FEC Limit</p>
																<p className="text-white font-medium">
																	RM {((report.rawResponse as any).extractedData.ccrisSummary.liabilities.total.fecLimit || 0).toLocaleString('en-MY', {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2
																	})}
																</p>
															</div>
														</div>
													</div>
												)}
											</div>
										</div>
									)}

									{/* Legal Action & Special Attention */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
										{(report.rawResponse as any).extractedData.ccrisSummary.legalActionTaken !== undefined && (
											<div>
												<p className="text-gray-400 text-xs mb-1">Legal Action Taken</p>
												<p className={`font-medium ${
													(report.rawResponse as any).extractedData.ccrisSummary.legalActionTaken 
														? 'text-red-400' 
														: 'text-green-400'
												}`}>
													{(report.rawResponse as any).extractedData.ccrisSummary.legalActionTaken ? 'YES' : 'NO'}
												</p>
											</div>
										)}
										{(report.rawResponse as any).extractedData.ccrisSummary.specialAttentionAccount !== undefined && (
											<div>
												<p className="text-gray-400 text-xs mb-1">Special Attention Account</p>
												<p className={`font-medium ${
													(report.rawResponse as any).extractedData.ccrisSummary.specialAttentionAccount 
														? 'text-red-400' 
														: 'text-green-400'
												}`}>
													{(report.rawResponse as any).extractedData.ccrisSummary.specialAttentionAccount ? 'YES' : 'NO'}
												</p>
											</div>
										)}
									</div>
								</div>
							)}

							{/* Section 10: Banking Payment History (CCRIS Details) */}
							{report.rawResponse && (report.rawResponse as any)?.extractedData?.ccrisAccounts && 
							 (report.rawResponse as any).extractedData.ccrisAccounts.length > 0 && (
								<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-6 rounded-xl border border-gray-700/40 shadow-lg">
									<div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/30">
										<h5 className="text-white font-semibold text-lg">Banking Payment History (CCRIS Details)</h5>
										<Tooltip content="Detailed breakdown of each credit facility from CCRIS including facility type, lender, credit limit, outstanding balance, repayment terms, and account status. Provides comprehensive view of individual credit accounts.">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
										</Tooltip>
									</div>
									<div className="space-y-4">
										{(report.rawResponse as any).extractedData.ccrisAccounts.map((account: any, index: number) => (
											<div key={index} className="bg-gray-900/60 p-5 rounded-lg border border-gray-700/30 shadow-md hover:shadow-lg transition-shadow">
												<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
													{account.approvalDate && (
														<div>
															<p className="text-gray-400 text-xs">Approval Date</p>
															<p className="text-white font-medium">{account.approvalDate}</p>
														</div>
													)}
													{account.capacity && (
														<div>
															<p className="text-gray-400 text-xs">Capacity</p>
															<p className="text-white font-medium">{account.capacity}</p>
														</div>
													)}
													{account.lenderType && (
														<div>
															<p className="text-gray-400 text-xs">Lender Type</p>
															<p className="text-white font-medium">{account.lenderType}</p>
														</div>
													)}
													{account.limit !== undefined && (
														<div>
															<p className="text-gray-400 text-xs">Credit Limit</p>
															<p className="text-white font-medium">
																RM {account.limit.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
															</p>
														</div>
													)}
													{account.subAccounts && account.subAccounts.length > 0 && (
														<div className="md:col-span-2">
															<p className="text-gray-300 text-xs font-medium mb-3 uppercase tracking-wide">Sub-Accounts</p>
															<div className="space-y-3">
																{account.subAccounts.map((subAccount: any, subIndex: number) => {
																	const subAccountId = `${index}-${subIndex}`;
																	const isExpanded = expandedSubAccounts.has(subAccountId);
																	const hasMultiplePositions = subAccount.positions && subAccount.positions.length > 1;
																	
																	return (
																		<div key={subIndex} className="bg-gray-800/60 p-4 rounded-lg border border-gray-700/20 shadow-sm hover:shadow-md transition-shadow">
																			<div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
																				{subAccount.facility && (
																					<div>
																						<p className="text-gray-500">Facility Type</p>
																						<p className="text-white font-medium">{subAccount.facility}</p>
																					</div>
																				)}
																				{subAccount.repayTerm && (
																					<div>
																						<p className="text-gray-500">Repayment Term</p>
																						<p className="text-white font-medium">{subAccount.repayTerm}</p>
																					</div>
																				)}
																				{subAccount.status && (
																					<div>
																						<p className="text-gray-500">Status</p>
																						<p className={`font-medium ${
																							subAccount.statusCode === '0' || subAccount.status.toLowerCase().includes('active') || subAccount.status.toLowerCase().includes('good')
																								? 'text-green-400'
																								: subAccount.status.toLowerCase().includes('default') || subAccount.status.toLowerCase().includes('overdue')
																								? 'text-red-400'
																								: 'text-gray-400'
																						}`}>
																							{subAccount.status}
																						</p>
																					</div>
																				)}
																				{subAccount.balance !== undefined && (
																					<div>
																						<p className="text-gray-500">Balance</p>
																						<p className="text-white font-medium">
																							RM {subAccount.balance.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																						</p>
																					</div>
																				)}
																				{subAccount.positionDate && (
																					<div>
																						<p className="text-gray-500 text-xs">Position Date</p>
																						<p className="text-white font-medium">{subAccount.positionDate}</p>
																					</div>
																				)}
																				{subAccount.installmentAmount !== undefined && (
																					<div>
																						<p className="text-gray-500">Installment Amount</p>
																						<p className="text-white font-medium">
																							RM {subAccount.installmentAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																						</p>
																					</div>
																				)}
																				{subAccount.installmentArrears !== undefined && (
																					<div>
																						<p className="text-gray-500">Installment Arrears</p>
																						<p className={`font-medium ${
																							subAccount.installmentArrears > 0 ? 'text-red-400' : 'text-green-400'
																						}`}>
																							RM {subAccount.installmentArrears.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																						</p>
																					</div>
																				)}
																			</div>
																			
																			{/* View More Button */}
																			{hasMultiplePositions && (
																				<div className="mt-3 pt-3 border-t border-gray-700/30">
																					<button
																						onClick={() => toggleSubAccountExpansion(subAccountId)}
																						className="flex items-center justify-center w-full text-xs text-blue-400 hover:text-blue-300 transition-colors"
																					>
																						{isExpanded ? (
																							<>
																								<ChevronUpIcon className="h-4 w-4 mr-1" />
																								Show Less
																							</>
																						) : (
																							<>
																								<ChevronDownIcon className="h-4 w-4 mr-1" />
																								View More ({subAccount.positions.length} months)
																							</>
																						)}
																					</button>
																				</div>
																			)}
																			
																			{/* Expanded Monthly History */}
																			{isExpanded && hasMultiplePositions && (
																				<div className="mt-3 pt-3 border-t border-gray-700/30 space-y-2">
																					<p className="text-gray-400 text-xs font-medium mb-2">Monthly Repayment History</p>
																					{subAccount.positions.map((position: any, posIndex: number) => (
																						<div key={posIndex} className="bg-gray-700/40 p-3 rounded-lg border border-gray-700/20">
																							<div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
																								{position.positionDate && (
																									<div>
																										<p className="text-gray-500">Position Date</p>
																										<p className="text-white font-medium">{position.positionDate}</p>
																									</div>
																								)}
																								{position.status && (
																									<div>
																										<p className="text-gray-500">Status</p>
																										<p className={`font-medium ${
																											position.statusCode === '0' || position.status.toLowerCase().includes('active') || position.status.toLowerCase().includes('good')
																												? 'text-green-400'
																												: position.status.toLowerCase().includes('default') || position.status.toLowerCase().includes('overdue')
																												? 'text-red-400'
																												: 'text-gray-400'
																										}`}>
																											{position.status}
																										</p>
																									</div>
																								)}
																								{position.balance !== undefined && (
																									<div>
																										<p className="text-gray-500">Balance</p>
																										<p className="text-white font-medium">
																											RM {position.balance.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																										</p>
																									</div>
																								)}
																								{position.installmentAmount !== undefined && (
																									<div>
																										<p className="text-gray-500">Installment Amount</p>
																										<p className="text-white font-medium">
																											RM {position.installmentAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																										</p>
																									</div>
																								)}
																								{position.installmentArrears !== undefined && (
																									<div>
																										<p className="text-gray-500">Installment Arrears</p>
																										<p className={`font-medium ${
																											position.installmentArrears > 0 ? 'text-red-400' : 'text-green-400'
																										}`}>
																											RM {position.installmentArrears.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																										</p>
																									</div>
																								)}
																								{position.monthlyArrears !== undefined && (
																									<div>
																										<p className="text-gray-500">Monthly Arrears</p>
																										<p className={`font-medium ${
																											position.monthlyArrears > 0 ? 'text-red-400' : 'text-green-400'
																										}`}>
																											RM {position.monthlyArrears.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																										</p>
																									</div>
																								)}
																								{position.rescheduledDate && (
																									<div>
																										<p className="text-gray-500">Rescheduled Date</p>
																										<p className="text-yellow-400 font-medium">{position.rescheduledDate}</p>
																									</div>
																								)}
																								{position.restructuredDate && (
																									<div>
																										<p className="text-gray-500">Restructured Date</p>
																										<p className="text-yellow-400 font-medium">{position.restructuredDate}</p>
																									</div>
																								)}
																							</div>
																						</div>
																					))}
																				</div>
																			)}
																		</div>
																	);
																})}
															</div>
														</div>
													)}
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Section 11: CCRIS Derivatives */}
							{report.rawResponse && (report.rawResponse as any)?.extractedData?.ccrisDerivatives && (
								<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-6 rounded-xl border border-gray-700/40 shadow-lg">
									<div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/30">
										<h5 className="text-white font-semibold text-lg">CCRIS Derivatives</h5>
										<Tooltip content="Derived analysis from CCRIS data including earliest known facility, secured and unsecured facilities breakdown. Provides insights into credit history length, facility types, and risk distribution.">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
										</Tooltip>
									</div>
									<div className="space-y-4">
										{/* Earliest Known Facility */}
										{(report.rawResponse as any).extractedData.ccrisDerivatives.earliestFacility && (
											<div className="bg-gray-900/60 p-5 rounded-lg border border-gray-700/30 shadow-md">
												<h6 className="text-gray-300 text-sm font-medium mb-2">Earliest Known Facility</h6>
												<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
													{(report.rawResponse as any).extractedData.ccrisDerivatives.earliestFacility.date && (
														<div>
															<p className="text-gray-400 text-xs">Date of Application</p>
															<p className="text-white font-medium">
																{(report.rawResponse as any).extractedData.ccrisDerivatives.earliestFacility.date}
															</p>
														</div>
													)}
													{(report.rawResponse as any).extractedData.ccrisDerivatives.earliestFacility.facilityType && (
														<div>
															<p className="text-gray-400 text-xs">Facility Type</p>
															<p className="text-white font-medium">
																{(report.rawResponse as any).extractedData.ccrisDerivatives.earliestFacility.facilityType}
															</p>
														</div>
													)}
												</div>
											</div>
										)}

										{/* Secured Facilities */}
										{(report.rawResponse as any).extractedData.ccrisDerivatives.securedFacilities && (
											<div className="bg-gray-900/60 p-5 rounded-lg border border-gray-700/30 shadow-md">
												<h6 className="text-gray-300 text-sm font-medium mb-2">Secured Facilities</h6>
												<div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
													<div>
														<p className="text-gray-400 text-xs"># of Facilities</p>
														<p className="text-white font-medium">
															{((report.rawResponse as any).extractedData.ccrisDerivatives.securedFacilities.count || 0)}
														</p>
													</div>
													<div>
														<p className="text-gray-400 text-xs">Total Outstanding</p>
														<p className="text-white font-medium">
															RM {((report.rawResponse as any).extractedData.ccrisDerivatives.securedFacilities.totalOutstanding || 0).toLocaleString('en-MY', {
																minimumFractionDigits: 2,
																maximumFractionDigits: 2
															})}
														</p>
														{((report.rawResponse as any).extractedData.ccrisDerivatives.securedFacilities.percentage !== undefined && 
														  (report.rawResponse as any).extractedData.ccrisDerivatives.securedFacilities.percentage !== null) && (
															<p className="text-gray-400 text-xs">
																({((report.rawResponse as any).extractedData.ccrisDerivatives.securedFacilities.percentage || 0).toFixed(1)}%)
															</p>
														)}
													</div>
													<div>
														<p className="text-gray-400 text-xs">Avg. Installments</p>
														<p className="text-white font-medium">
															{((report.rawResponse as any).extractedData.ccrisDerivatives.securedFacilities.averageInstallments || 0).toFixed(1)}
														</p>
													</div>
												</div>
											</div>
										)}

										{/* Unsecured Facilities */}
										{(report.rawResponse as any).extractedData.ccrisDerivatives.unsecuredFacilities && (
											<div className="bg-gray-900/60 p-5 rounded-lg border border-gray-700/30 shadow-md">
												<h6 className="text-gray-300 text-sm font-medium mb-2">Unsecured Facilities</h6>
												<div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
													<div>
														<p className="text-gray-400 text-xs"># of Facilities</p>
														<p className="text-white font-medium">
															{((report.rawResponse as any).extractedData.ccrisDerivatives.unsecuredFacilities.count || 0)}
														</p>
													</div>
													<div>
														<p className="text-gray-400 text-xs">Total Outstanding</p>
														<p className="text-white font-medium">
															RM {((report.rawResponse as any).extractedData.ccrisDerivatives.unsecuredFacilities.totalOutstanding || 0).toLocaleString('en-MY', {
																minimumFractionDigits: 2,
																maximumFractionDigits: 2
															})}
														</p>
														{((report.rawResponse as any).extractedData.ccrisDerivatives.unsecuredFacilities.percentage !== undefined && 
														  (report.rawResponse as any).extractedData.ccrisDerivatives.unsecuredFacilities.percentage !== null) && (
															<p className="text-gray-400 text-xs">
																({((report.rawResponse as any).extractedData.ccrisDerivatives.unsecuredFacilities.percentage || 0).toFixed(1)}%)
															</p>
														)}
													</div>
													<div>
														<p className="text-gray-400 text-xs">Avg. Installments</p>
														<p className="text-white font-medium">
															{((report.rawResponse as any).extractedData.ccrisDerivatives.unsecuredFacilities.averageInstallments || 0).toFixed(1)}
														</p>
													</div>
												</div>
											</div>
										)}
									</div>
								</div>
							)}

							{/* Financial Information */}
							{((report.totalOutstanding !== undefined && report.totalOutstanding !== null) ||
								(report.activeAccounts !== undefined && report.activeAccounts !== null) ||
								(report.defaultedAccounts !== undefined && report.defaultedAccounts !== null)) && (
								<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-6 rounded-xl border border-gray-700/40 shadow-lg">
									<div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/30">
										<h5 className="text-white font-semibold text-lg">Financial Information</h5>
										<Tooltip content="Financial information extracted from CCRIS (Central Credit Reference Information System) data. Includes total outstanding credit facilities across all financial institutions, number of active credit accounts, and accounts with special attention (defaulted/overdue). This data helps assess the borrower's current debt obligations and payment behavior.">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
										</Tooltip>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										{report.totalOutstanding !== undefined && report.totalOutstanding !== null && (
											<div>
												<div className="flex items-center gap-1 mb-1">
													<p className="text-gray-400 text-sm">
													Total Outstanding
												</p>
													<Tooltip content="Total amount of outstanding credit facilities (loans, credit cards, etc.) across all financial institutions reported to CCRIS. This includes all active credit obligations that the borrower currently owes.">
														<InformationCircleIcon className="h-3 w-3 text-gray-500 hover:text-gray-300 cursor-help" />
													</Tooltip>
												</div>
												<p className="text-white font-medium">
													RM{" "}
													{typeof report.totalOutstanding === 'number' 
														? report.totalOutstanding.toLocaleString("en-MY", {
															minimumFractionDigits: 2,
															maximumFractionDigits: 2,
														})
														: '0.00'}
												</p>
											</div>
										)}
										{report.activeAccounts !== undefined && report.activeAccounts !== null && (
											<div>
												<div className="flex items-center gap-1 mb-1">
													<p className="text-gray-400 text-sm">
													Active Accounts
												</p>
													<Tooltip content="Number of active credit accounts currently reported in CCRIS. This includes all credit facilities (personal loans, credit cards, hire purchase, etc.) that are currently active with any financial institution.">
														<InformationCircleIcon className="h-3 w-3 text-gray-500 hover:text-gray-300 cursor-help" />
													</Tooltip>
												</div>
												<p className="text-white font-medium">
													{report.activeAccounts}
												</p>
											</div>
										)}
										{report.defaultedAccounts !== undefined && report.defaultedAccounts !== null && (
											<div>
												<div className="flex items-center gap-1 mb-1">
													<p className="text-gray-400 text-sm">
													Defaulted Accounts
												</p>
													<Tooltip content="Number of credit accounts with special attention status in CCRIS. These are accounts that have been flagged due to defaults, overdue payments, or other payment issues. Higher numbers indicate higher credit risk.">
														<InformationCircleIcon className="h-3 w-3 text-gray-500 hover:text-gray-300 cursor-help" />
													</Tooltip>
												</div>
												<p className="text-red-400 font-medium">
													{report.defaultedAccounts}
												</p>
											</div>
										)}
									</div>
								</div>
							)}

							{/* Legal Information */}
							{(report.legalCases !== undefined && report.legalCases !== null ||
								report.bankruptcyRecords !== undefined && report.bankruptcyRecords !== null ||
								report.litigationIndex !== undefined && report.litigationIndex !== null) && (
								<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-6 rounded-xl border border-gray-700/40 shadow-lg">
									<div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/30">
										<h5 className="text-white font-semibold text-lg">Legal Information</h5>
										<Tooltip content="Legal information sourced from CTOS databases including court records, legal cases, bankruptcy filings, and litigation history. This data helps assess legal risk exposure and potential financial obligations from legal proceedings.">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
										</Tooltip>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										{report.legalCases !== undefined && report.legalCases !== null && (
											<div>
												<div className="flex items-center gap-1 mb-1">
													<p className="text-gray-400 text-sm">
													Legal Cases
												</p>
													<Tooltip content="Total number of legal cases involving the borrower recorded in CTOS databases. This includes civil suits, debt recovery cases, and other legal proceedings. Higher numbers indicate greater legal risk exposure.">
														<InformationCircleIcon className="h-3 w-3 text-gray-500 hover:text-gray-300 cursor-help" />
													</Tooltip>
												</div>
												<p className="text-white font-medium">
													{report.legalCases}
												</p>
											</div>
										)}
										{report.bankruptcyRecords !== undefined && report.bankruptcyRecords !== null && (
											<div>
												<div className="flex items-center gap-1 mb-1">
													<p className="text-gray-400 text-sm">
													Bankruptcy Records
												</p>
													<Tooltip content="Indicates whether the borrower has any bankruptcy records. Bankruptcy records significantly impact creditworthiness and ability to obtain new credit facilities.">
														<InformationCircleIcon className="h-3 w-3 text-gray-500 hover:text-gray-300 cursor-help" />
													</Tooltip>
												</div>
												<p className={report.bankruptcyRecords === 1 ? "text-red-400 font-medium" : "text-green-400 font-medium"}>
													{report.bankruptcyRecords === 1 ? "Yes" : "No"}
												</p>
											</div>
										)}
										{((report.litigationIndex !== undefined && report.litigationIndex !== null) || 
										 (report.rawResponse as any)?.extractedData?.litigationIndex?.value) && (
											<div>
												<div className="flex items-center gap-1 mb-1">
													<p className="text-gray-400 text-sm">
													Litigation Index
												</p>
													<Tooltip content="CTOS Litigation Index is a 4-digit score (0000-9999) indicating legal risk exposure. Lower values (0000) indicate excellent/no litigation risk, while higher values (9999) indicate very high litigation risk. Based on legal cases, court records, and litigation history from CTOS databases.">
														<InformationCircleIcon className="h-3 w-3 text-gray-500 hover:text-gray-300 cursor-help" />
													</Tooltip>
												</div>
												<p
													className={`font-medium ${getLitigationIndexColor(
														report.litigationIndex || (report.rawResponse as any)?.extractedData?.litigationIndex?.value
													)}`}
												>
													{report.litigationIndex || (report.rawResponse as any)?.extractedData?.litigationIndex?.value}
												</p>
											</div>
										)}
									</div>
								</div>
							)}

							{/* FICO Factors */}
							{report.rawResponse && (report.rawResponse as any)?.extractedData?.ficoFactors && 
							 (report.rawResponse as any).extractedData.ficoFactors.length > 0 && (
								<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-6 rounded-xl border border-gray-700/40 shadow-lg">
									<div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/30">
										<h5 className="text-white font-semibold text-lg">Credit Score Factors</h5>
										<Tooltip content="Key factors that influenced the CTOS Credit Score. These factors explain why the score is at its current level and highlight areas that may have positively or negatively impacted the creditworthiness assessment.">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
										</Tooltip>
									</div>
									<ul className="space-y-2">
										{(report.rawResponse as any).extractedData.ficoFactors.map((factor: { code: string; description: string }, index: number) => (
											<li key={index} className="flex items-start gap-2 text-sm">
												<span className="text-gray-400 mt-1">•</span>
												<div className="flex-1">
													{factor.code && (
														<span className="text-blue-400 font-medium mr-2">[{factor.code}]</span>
													)}
													<span className="text-gray-300">{factor.description}</span>
												</div>
											</li>
										))}
									</ul>
								</div>
							)}

							{/* Identity Verification */}
							{report.rawResponse && (report.rawResponse as any)?.extractedData?.identityVerification && (
								<div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 p-6 rounded-xl border border-gray-700/40 shadow-lg">
									<div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/30">
										<h5 className="text-white font-semibold text-lg">Identity Verification</h5>
										<Tooltip content="Identity verification data from CTOS Section A, including verified address, birth date, and nationality information from NRD (National Registration Department). Match indicators show whether the provided information matches official records.">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
										</Tooltip>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
										{(report.rawResponse as any).extractedData.identityVerification.name && (
								<div>
												<div className="flex items-center gap-1 mb-1">
													<p className="text-gray-400">Name</p>
													{(report.rawResponse as any).extractedData.identityVerification.nameMatch === '1' && (
														<span className="text-green-400 text-xs">✓</span>
													)}
												</div>
												<p className="text-white">{(report.rawResponse as any).extractedData.identityVerification.name}</p>
										</div>
										)}
										{(report.rawResponse as any).extractedData.identityVerification.nicBrno && (
											<div>
												<div className="flex items-center gap-1 mb-1">
													<p className="text-gray-400">IC Number</p>
													{(report.rawResponse as any).extractedData.identityVerification.nicBrnoMatch === '1' && (
														<span className="text-green-400 text-xs">✓</span>
													)}
												</div>
												<p className="text-white">{(report.rawResponse as any).extractedData.identityVerification.nicBrno}</p>
								</div>
							)}
										{(report.rawResponse as any).extractedData.identityVerification.address && (
											<div className="md:col-span-2">
												<p className="text-gray-400 mb-1">Address</p>
												<p className="text-white">{(report.rawResponse as any).extractedData.identityVerification.address}</p>
						</div>
					)}
										{(report.rawResponse as any).extractedData.identityVerification.birthDate && (
											<div>
												<p className="text-gray-400 mb-1">Birth Date</p>
												<p className="text-white">{(report.rawResponse as any).extractedData.identityVerification.birthDate}</p>
				</div>
			)}
										{(report.rawResponse as any).extractedData.identityVerification.nationality && (
											<div>
												<p className="text-gray-400 mb-1">Nationality</p>
												<p className="text-white">{(report.rawResponse as any).extractedData.identityVerification.nationality}</p>
		</div>
										)}
										{(report.rawResponse as any).extractedData.identityVerification.source && (
											<div>
												<p className="text-gray-400 mb-1">Data Source</p>
												<p className="text-white">{(report.rawResponse as any).extractedData.identityVerification.source}</p>
											</div>
										)}
									</div>
								</div>
							)}

							{/* CCRIS Applications */}
							{report.rawResponse && (report.rawResponse as any)?.extractedData?.ccrisApplications && (
								<div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
									<div className="flex items-center gap-2 mb-3">
										<h5 className="text-white font-medium">CCRIS Applications</h5>
										<Tooltip content="Credit application statistics from CCRIS showing total applications, approved applications, and pending applications across all financial institutions. This helps assess recent credit activity and application patterns.">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
										</Tooltip>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										<div>
											<p className="text-gray-400 text-sm mb-1">Total Applications</p>
											<p className="text-white font-medium text-lg">
												{(report.rawResponse as any).extractedData.ccrisApplications.total || 0}
											</p>
										</div>
										<div>
											<p className="text-gray-400 text-sm mb-1">Approved</p>
											<p className="text-green-400 font-medium text-lg">
												{(report.rawResponse as any).extractedData.ccrisApplications.approved || 0}
											</p>
										</div>
										<div>
											<p className="text-gray-400 text-sm mb-1">Pending</p>
											<p className="text-yellow-400 font-medium text-lg">
												{(report.rawResponse as any).extractedData.ccrisApplications.pending || 0}
											</p>
										</div>
									</div>
								</div>
							)}

							

							{/* PDF Download Button */}
							{report.rawResponse && (report.rawResponse as any)?.base64Encoded && (
								<div className="mt-6 pt-6 border-t border-gray-700/30">
									<button
										onClick={async () => {
											try {
												const token = localStorage.getItem("adminToken") || "";
												
												const response = await fetch(
													`/api/admin/credit-reports/pdf/${report.id}`,
													{
														method: "GET",
														headers: {
															Authorization: `Bearer ${token}`,
														},
													}
												);

												if (!response.ok) {
													const errorData = await response.json().catch(() => ({}));
													throw new Error(errorData.message || "Failed to download PDF");
												}

												const blob = await response.blob();
												const url = window.URL.createObjectURL(blob);
												const a = document.createElement("a");
												a.href = url;
												const dateStr = new Date(report.fetchedAt).toISOString().split("T")[0];
												const icNumber = report.icNumber?.replace(/[\s-]/g, "") || report.id;
												a.download = `credit-report-${icNumber}-${dateStr}.pdf`;
												document.body.appendChild(a);
												a.click();
												window.URL.revokeObjectURL(url);
												document.body.removeChild(a);
											} catch (error) {
												console.error("Error downloading PDF:", error);
												toast.error(error instanceof Error ? error.message : "Failed to download PDF report");
											}
										}}
										className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-500/20 to-purple-600/20 text-purple-200 rounded-xl border border-purple-400/30 hover:from-purple-500/30 hover:to-purple-600/30 hover:shadow-lg transition-all font-medium shadow-md"
									>
										<DocumentArrowDownIcon className="h-4 w-4 mr-2" />
										Download PDF Report
									</button>
								</div>
							)}
						</div>
					)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

