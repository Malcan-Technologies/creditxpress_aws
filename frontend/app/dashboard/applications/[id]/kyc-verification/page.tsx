"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { fetchWithTokenRefresh } from "@/lib/authUtils";
import { ArrowLeftIcon, CheckCircleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

interface LoanApplication {
	id: string;
	status: string;
	amount: number;
	term: number;
	purpose: string;
	createdAt: string;
	updatedAt: string;
	monthlyRepayment: number;
	interestRate: number;
	legalFee: number;
	netDisbursement: number;
	applicationFee?: number;
	originationFee?: number;
	product: {
		name: string;
		code: string;
		originationFee: number;
		legalFee: number;
		applicationFee: number;
		interestRate: number;
	};
	user?: {
		fullName: string;
		email: string;
		phoneNumber: string;
		employmentStatus: string;
		employerName?: string;
		monthlyIncome?: string;
		address1: string;
		address2?: string;
		city: string;
		state: string;
		postalCode: string;
		idNumber?: string;
		icNumber?: string;
		icType?: string;
		kycStatus?: boolean;
	};
}

export default function KycVerificationPage() {
	const router = useRouter();
	const params = useParams();
	const searchParams = useSearchParams();
	const isSuccess = searchParams.get('success') === 'true';
	
	// Handle success URL parameter
	useEffect(() => {
		if (isSuccess) {
			setKycCompleted(true);
			setKycInProgress(false);
		}
	}, [isSuccess]);
	const [application, setApplication] = useState<LoanApplication | null>(null);
	const [loading, setLoading] = useState(true);
	const [ctosStatusLoading, setCtosStatusLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [kycError, setKycError] = useState<string | null>(null);
	const [processingAccept, setProcessingAccept] = useState(false);
	const [ctosOnboardingUrl, setCtosOnboardingUrl] = useState<string | null>(null);
	const [pollingKycId, setPollingKycId] = useState<string | null>(null);
	const [ctosStatus, setCtosStatus] = useState<{ 
		status: number; 
		result?: number;
		rejectMessage?: string;
		canRetry?: boolean;
		hasKycSession?: boolean;
		isAlreadyApproved?: boolean;
		canResume?: boolean;
		kycSessionId?: string;
	} | null>(null);
	const [kycInProgress, setKycInProgress] = useState(false);
	const [kycCompleted, setKycCompleted] = useState(false);
	const [startingKyc, setStartingKyc] = useState(false);
	const [kycDocuments, setKycDocuments] = useState<{
		id: string;
		type: string;
		storageUrl: string;
		createdAt: string;
	}[]>([]);
	const [documentsLoading, setDocumentsLoading] = useState(false);
	const [userName, setUserName] = useState("");

	const layoutProps = useMemo(
		() => ({
			title: "KYC Verification",
			userName: userName || "User",
		}),
		[userName]
	);

	useEffect(() => {
		const loadUserName = async () => {
			try {
				const profile = await fetchWithTokenRefresh<any>("/api/users/me");
				if (profile?.firstName) {
					setUserName(profile.firstName);
				} else if (profile?.fullName) {
					setUserName(profile.fullName.split(" ")[0]);
				}
			} catch (err) {
				console.warn("Failed to load user profile for KYC page", err);
			}
		};

		loadUserName();
	}, []);

	useEffect(() => {
		const fetchData = async () => {
			try {
				// Fetch application data
				const appData = await fetchWithTokenRefresh<LoanApplication>(
					`/api/loan-applications/${params.id}`
				);
				setApplication(appData);
				if (appData.user?.fullName) {
					setUserName((prev) => prev || appData.user!.fullName.split(" ")[0]);
				}

				// Fetch user's KYC status
				const ctosData = await fetchWithTokenRefresh<{
					success: boolean;
					hasKycSession: boolean;
					status: string;
					ctosStatus: number;
					ctosResult: number;
					canRetry: boolean;
					rejectMessage?: string;
					kycSessionId?: string;
					isAlreadyApproved?: boolean;
					canResume?: boolean;
					resumeUrl?: string;
				}>('/api/kyc/user-ctos-status');
				
				if (ctosData.success && ctosData.hasKycSession) {
					setCtosStatus({
						status: ctosData.ctosStatus,
						result: ctosData.ctosResult,
						rejectMessage: ctosData.rejectMessage,
						canRetry: ctosData.canRetry,
						hasKycSession: true,
						isAlreadyApproved: ctosData.isAlreadyApproved,
						canResume: ctosData.canResume,
						kycSessionId: ctosData.kycSessionId
					});
					
					// If there's a session that can be resumed, prepare resume state (but don't auto-start)
					if (ctosData.canResume && ctosData.resumeUrl) {
						setCtosOnboardingUrl(ctosData.resumeUrl);
						setPollingKycId(ctosData.kycSessionId || null);
						// Don't set kycInProgress = true here - let user click resume button
					}
					
					// Set completed state if approved
					if (ctosData.ctosResult === 1 || ctosData.isAlreadyApproved) {
						setKycCompleted(true);
						setKycInProgress(false);
						
						// Fetch KYC documents for approved users
						fetchKycDocuments();
					}
				} else {
					setCtosStatus({
						status: 0,
						result: 2,
						hasKycSession: false,
						canRetry: true,
						isAlreadyApproved: false
					});
				}
			} catch (err) {
				console.error('Error fetching data:', err);
				setError(err instanceof Error ? err.message : "An error occurred");
			} finally {
				setLoading(false);
				setCtosStatusLoading(false);
			}
		};

		if (params.id) {
			fetchData();
		}
	}, [params.id]);

	const fetchKycDocuments = async () => {
		try {
			setDocumentsLoading(true);
			const documentsData = await fetchWithTokenRefresh<{
				success: boolean;
				hasDocuments: boolean;
				documents: {
					id: string;
					type: string;
					storageUrl: string;
					createdAt: string;
				}[];
			}>('/api/kyc/user-documents');
			
			if (documentsData.success && documentsData.hasDocuments) {
				setKycDocuments(documentsData.documents);
			}
		} catch (err) {
			console.error('Error fetching KYC documents:', err);
		} finally {
			setDocumentsLoading(false);
		}
	};

	const handleStartKyc = async (forceRedo: boolean = false) => {
		// Prevent multiple simultaneous requests
		if (startingKyc || kycInProgress) {
			return;
		}

		setStartingKyc(true);
		try {
			setKycError(null); // Clear previous KYC errors
			
			// Prevent starting new KYC if user already has approved KYC
			if ((ctosStatus?.hasKycSession && ctosStatus?.result === 1) || ctosStatus?.isAlreadyApproved) {
				setKycError("You have already completed KYC verification successfully. No further verification is needed.");
				return;
			}
			
			// Get user data for document information
			if (!application?.user?.icNumber || !application?.user?.fullName) {
				setKycError("Missing user information required for KYC. Please complete your profile first.");
				return;
			}

			// Start eKYC process
			const response = await fetchWithTokenRefresh<{ 
				success: boolean; 
				kycId: string; 
				onboardingUrl: string; 
				onboardingId: string; 
				expiredAt: string; 
				kycToken: string; 
				ttlMinutes: number;
				resumed?: boolean;
				message?: string;
			}>(
				`/api/kyc/start-ctos`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ 
						applicationId: params.id,
						documentName: application.user.fullName,
						documentNumber: application.user.icNumber,
						platform: 'Web',
						responseUrl: `${window.location.origin}/dashboard/applications/${params.id}/kyc-verification?success=true`
					}),
				}
			);

			if (response.success && response.onboardingUrl) {
				// Store the onboarding URL and KYC ID
				setCtosOnboardingUrl(response.onboardingUrl);
				setPollingKycId(response.kycId);
				setKycInProgress(true);
				setKycCompleted(false);
				
				// Navigate to eKYC portal
				window.open(response.onboardingUrl, '_blank');
				
				// Start lightweight database polling to detect webhook updates
				startDatabasePolling(response.kycId);
			} else {
				throw new Error('Failed to create eKYC session');
			}
		} catch (err) {
			console.error("KYC start error:", err);
			const errorMessage = err instanceof Error ? err.message : "Failed to start KYC verification";
			
			// Enhanced error handling for KYC errors
			let displayMessage = errorMessage;
			
			if (errorMessage.includes("Duplicate transaction found") || errorMessage.includes("103")) {
				displayMessage = "You already have a KYC verification session in progress. Please refresh the page to see your current status.";
				// Refresh the page data to get the latest status
				setTimeout(() => window.location.reload(), 2000);
			} else if (errorMessage.includes("eKYC Error:")) {
				// Extract the specific eKYC error message
				displayMessage = errorMessage.replace("eKYC Error: ", "");
			} else if (errorMessage.includes("API Error:")) {
				displayMessage = errorMessage.replace("API Error: ", "");
			} else if (errorMessage.includes("Invalid document")) {
				displayMessage = "Invalid document information. Please check your IC number and full name.";
			} else if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
				displayMessage = "Network connection issue. Please check your internet connection and try again.";
			}
			
			setKycError(displayMessage);
			setKycInProgress(false);
			setKycCompleted(false);
		} finally {
			setStartingKyc(false);
		}
	};

	// Lightweight database polling - only checks our database for status changes
	const startDatabasePolling = (kycSessionId: string) => {
		const pollDatabase = async () => {
			try {
				// Only poll our database, not external KYC API
				const statusResponse = await fetchWithTokenRefresh<{
					success: boolean;
					status: string;
					ctosResult: number;
					isCompleted: boolean;
				}>(`/api/kyc/session-status/${kycSessionId}`);

				if (statusResponse.success && statusResponse.status === 'APPROVED') {
					window.location.reload();
				}
			} catch (err) {
				console.error("Database polling error:", err);
			}
		};

		// Poll database every 3 seconds (much lighter than external KYC API)
		const interval = setInterval(pollDatabase, 3000);
		
		// Clean up after 30 minutes
		setTimeout(() => {
			clearInterval(interval);
		}, 30 * 60 * 1000);

		// Return cleanup function
		return () => clearInterval(interval);
	};

	const handleAcceptKyc = async () => {
		// Allow continuing if either result is 1 OR if isAlreadyApproved is true
		if (!ctosStatus || (ctosStatus.result !== 1 && !ctosStatus.isAlreadyApproved)) {
			console.error('Cannot continue - KYC not approved:', { ctosStatus });
			return;
		}

		try {
			setProcessingAccept(true);
			
			// Update application status to next step - certificate request
			await fetchWithTokenRefresh(
				`/api/loan-applications/${params.id}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						status: "PENDING_CERTIFICATE_OTP",
					}),
				}
			);

			// Redirect to OTP verification for certificate request
			router.push(`/dashboard/applications/${params.id}/otp-verification`);
		} catch (err) {
			console.error('Error in handleAcceptKyc:', err);
			setKycError(err instanceof Error ? err.message : "Failed to proceed with KYC verification");
		} finally {
			setProcessingAccept(false);
		}
	};


	const handleBack = async () => {
		try {
			await fetchWithTokenRefresh(
				`/api/loan-applications/${params.id}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ status: "PENDING_PROFILE_CONFIRMATION" }),
				}
			);

			// Go back to profile confirmation (previous step in the flow)
			router.push(`/dashboard/applications/${params.id}/profile-confirmation`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to go back to profile confirmation");
		}
	};

	if (loading) {
		return (
			<DashboardLayout {...layoutProps}>
				<div className="flex items-center justify-center min-h-96">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-primary"></div>
				</div>
			</DashboardLayout>
		);
	}

	if (error || !application) {
		return (
			<DashboardLayout {...layoutProps}>
				<div className="text-center py-12">
					<h2 className="text-2xl font-heading font-bold text-gray-700 mb-4">
						Error Loading Application
					</h2>
					<p className="text-gray-600 mb-6">{error || "Application not found"}</p>
					<button
						onClick={() => router.push(`/dashboard/applications/${params.id}/profile-confirmation`)}
						className="inline-flex items-center px-4 py-2 bg-purple-primary text-white rounded-lg hover:bg-purple-700 transition-colors"
					>
						<ArrowLeftIcon className="h-4 w-4 mr-2" />
						Back to Profile Confirmation
					</button>
				</div>
			</DashboardLayout>
		);
	}

	// Only show KYC verification for applications in PENDING_KYC status
	if (application.status !== "PENDING_KYC") {
		return (
			<DashboardLayout {...layoutProps}>
				<div className="text-center py-12">
					<h2 className="text-2xl font-heading font-bold text-gray-700 mb-4">
						KYC Verification Not Required
					</h2>
					<p className="text-gray-600 mb-6">
						This application is not in the correct status for KYC verification.
					</p>
				<button
					onClick={() => router.push(`/dashboard/applications/${params.id}/profile-confirmation`)}
						className="inline-flex items-center px-4 py-2 bg-purple-primary text-white rounded-lg hover:bg-purple-700 transition-colors"
					>
						<ArrowLeftIcon className="h-4 w-4 mr-2" />
						Back to Profile Confirmation
					</button>
				</div>
			</DashboardLayout>
		);
	}

	const formatCurrency = (amount: number) => `RM ${amount.toFixed(2)}`;

	return (
		<DashboardLayout {...layoutProps}>
			<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
				{/* Back Button */}
				<div className="mb-6">
				<button
					onClick={handleBack}
					className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors font-body"
				>
					<ArrowLeftIcon className="h-4 w-4 mr-2" />
					Back to Profile Confirmation
				</button>
				</div>

				{/* KYC Verification Content */}
				<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
					<div className="mb-6">
						<h1 className="text-3xl font-heading font-bold text-gray-700">
							Identity Verification (KYC)
						</h1>
						<p className="text-gray-600 mt-2">
							Complete your identity verification to proceed with your loan application for{" "}
							<span className="font-semibold text-purple-primary">
								{formatCurrency(application.amount)}
							</span>.
						</p>
						
						{/* Success Message */}
						{isSuccess && (
							<div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
								<div className="flex items-center">
									<CheckCircleIcon className="h-6 w-6 text-green-600 mr-3" />
									<div>
										<h3 className="text-lg font-semibold text-green-800">KYC Verification Completed!</h3>
										<p className="text-green-600 mt-1">Your identity verification was successful. You can now proceed to the next step.</p>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Progress Steps */}
					<div className="mb-8">
						<div className="flex items-center justify-between text-sm">
							<div className="flex items-center">
								<div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center">
									<CheckCircleIcon className="w-4 h-4" />
								</div>
								<span className="ml-2 text-green-600 font-medium">Profile Confirmation</span>
							</div>
							<div className="flex-1 h-px bg-green-300 mx-4"></div>
							<div className="flex items-center">
								<div className="w-8 h-8 bg-purple-primary text-white rounded-full flex items-center justify-center">
									<span className="text-xs font-bold">2</span>
								</div>
								<span className="ml-2 text-purple-primary font-medium">KYC Verification</span>
							</div>
							<div className="flex-1 h-px bg-gray-300 mx-4"></div>
							<div className="flex items-center">
								<div className="w-8 h-8 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center">
									<span className="text-xs font-bold">3</span>
								</div>
								<span className="ml-2 text-gray-500 font-medium">Certificate Request</span>
							</div>
							<div className="flex-1 h-px bg-gray-300 mx-4"></div>
							<div className="flex items-center">
								<div className="w-8 h-8 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center">
									<span className="text-xs font-bold">4</span>
								</div>
								<span className="ml-2 text-gray-500 font-medium">Document Signing</span>
							</div>
						</div>
					</div>

					{pollingKycId && ctosOnboardingUrl ? (
						// Show KYC process active
						<div className="space-y-6">
							<div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
								<div className="flex items-start space-x-4">
									<div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
										<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
									</div>
									<div className="flex-1">
										<h3 className="text-lg font-heading font-bold text-blue-800 mb-2">
											KYC Verification in Progress
										</h3>
										<p className="text-blue-700 font-body mb-4">
											Please complete the KYC verification in the new tab that opened. We're monitoring the progress automatically.
										</p>
										{ctosStatus && (
											<div className="text-sm text-blue-600">
												Status: {ctosStatus.status === 0 ? 'Not Started' : ctosStatus.status === 1 ? 'In Progress' : ctosStatus.status === 2 ? 'Completed' : 'Expired'}
											</div>
										)}
									</div>
								</div>
							</div>
							
							<div className="text-center space-y-3">
								<div className="flex flex-col sm:flex-row gap-3 justify-center">
									<button
										onClick={() => window.open(ctosOnboardingUrl, '_blank')}
										className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
									>
										<svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M7 7l10 10M17 7l-4 4" />
										</svg>
										Reopen KYC Window
									</button>
									<button
										onClick={() => window.location.reload()}
										className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
									>
										<svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
										</svg>
										Check Status
									</button>
									<button
										onClick={() => {
											setCtosOnboardingUrl(null);
											setPollingKycId(null);
											setCtosStatus(null);
										}}
										className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
									>
										Cancel
									</button>
								</div>
								<p className="text-sm text-blue-600">
									Status updates automatically via webhook when completed
								</p>
							</div>
						</div>
					) : ctosStatusLoading ? (
						<div className="flex items-center justify-center py-12">
							<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-primary"></div>
							<span className="ml-3 text-gray-600 font-body">Checking KYC status...</span>
						</div>
					) : ctosStatus?.hasKycSession && ctosStatus?.result === 1 ? (
						// Show approved KYC status
						<div className="space-y-6">
							<div className="bg-green-50 border border-green-200 rounded-xl p-6">
								<div className="flex items-start space-x-4">
									<div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
										<CheckCircleIcon className="w-6 h-6 text-green-600" />
									</div>
									<div className="flex-1">
										<h3 className="text-lg font-heading font-bold text-green-800 mb-2">
											KYC Verification Approved
										</h3>
									<p className="text-green-700 font-body">
										Your identity verification has been completed and approved. You have already passed the KYC requirements for this application.
									</p>
									</div>
								</div>
							</div>

							{/* KYC Documents Display */}
							{documentsLoading ? (
								<div className="bg-gray-50 rounded-xl p-6">
									<div className="flex items-center justify-center">
										<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-primary"></div>
										<span className="ml-3 text-gray-600 font-body">Loading your verified documents...</span>
									</div>
								</div>
							) : kycDocuments.length > 0 ? (
								<div className="bg-gray-50 rounded-xl p-6">
									<h4 className="text-lg font-heading font-bold text-gray-700 mb-4">
										Your Verified Documents
									</h4>
								<p className="text-gray-600 font-body mb-4">
									These are the documents that were verified and approved during your KYC process:
								</p>
									<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
										{kycDocuments.map((doc) => (
											<div key={doc.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
												<div className="mb-3 bg-gray-100 rounded-lg overflow-hidden">
													{doc.storageUrl ? (
														<div className="relative">
															<img 
																src={doc.storageUrl} 
																alt={`${doc.type === 'front' ? 'IC Front' : doc.type === 'back' ? 'IC Back' : 'Selfie'}`}
																className="w-full h-auto object-contain max-h-64"
																onError={(e) => {
																	const target = e.target as HTMLImageElement;
																	target.style.display = 'none';
																	const parent = target.parentElement;
																	if (parent) {
																		parent.innerHTML = '<div class="flex items-center justify-center h-32 text-gray-500 text-sm">Image not available</div>';
																	}
																}}
															/>
															<div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
																<div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white rounded-full p-2">
																	<svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
																	</svg>
																</div>
															</div>
														</div>
													) : (
														<div className="flex items-center justify-center h-32 text-gray-500 text-sm">
															No image available
														</div>
													)}
												</div>
												<div className="text-center">
													<h5 className="text-sm font-semibold text-gray-700 mb-1">
														{doc.type === 'front' ? 'IC Front' : doc.type === 'back' ? 'IC Back' : 'Selfie Photo'}
													</h5>
													<p className="text-xs text-gray-500">
														Verified: {new Date(doc.createdAt).toLocaleDateString()}
													</p>
												</div>
											</div>
										))}
									</div>
								</div>
							) : null}

							{/* Status Information */}
							<div className="bg-gray-50 rounded-xl p-6">
								<div className="text-center">
									<div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
										<CheckCircleIcon className="w-10 h-10 text-green-600" />
									</div>
									<h4 className="text-xl font-heading font-bold text-gray-700 mb-2">
										KYC Requirements Completed
									</h4>
								<p className="text-gray-600 font-body">
									You have successfully passed all KYC verification requirements. Your identity documents have been processed and approved through our secure eKYC system.
								</p>
								</div>
							</div>

							{/* Action Buttons */}
							<div className="flex justify-center pt-6 border-t border-gray-100">
								<button
									onClick={handleAcceptKyc}
									disabled={processingAccept}
									className="flex items-center justify-center px-8 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{processingAccept ? (
										<>
											<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
											Accepting...
										</>
									) : (
										<>
											<CheckCircleIcon className="w-6 h-6 mr-2" />
											Accept & Continue
										</>
									)}
								</button>
							</div>
						</div>
					) : ctosStatus?.hasKycSession && ctosStatus?.result === 0 ? (
						// Show rejected KYC status
						<div className="space-y-6">
							<div className="bg-red-50 border border-red-200 rounded-xl p-6">
								<div className="flex items-start space-x-4">
									<div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
										<svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.754-.833-2.464 0L4.35 15.5c-.77.833.192 2.5 1.732 2.5z" />
										</svg>
									</div>
									<div className="flex-1">
										<h3 className="text-lg font-heading font-bold text-red-800 mb-2">
											KYC Verification Rejected
										</h3>
										<p className="text-red-700 font-body mb-3">
											{ctosStatus.rejectMessage || "Your identity verification was rejected. Please try again with clearer documents."}
										</p>
										<div className="mt-4">
											<button
												onClick={() => handleStartKyc(true)}
												className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 text-sm font-medium"
											>
												<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
												</svg>
												Retry KYC Verification
											</button>
										</div>
									</div>
								</div>
							</div>
						</div>
					) : (
						// No existing KYC or not available - start new
						<div className="text-center py-12">
							<div className="w-20 h-20 mx-auto mb-6 bg-purple-100 rounded-full flex items-center justify-center">
								<ShieldCheckIcon className="w-10 h-10 text-purple-600" />
							</div>
							<h3 className="text-2xl font-heading font-bold text-gray-700 mb-4">
								Identity Verification Required
							</h3>
						<p className="text-gray-600 font-body mb-8 max-w-md mx-auto">
							To proceed with your loan application, we need to verify your identity using our secure eKYC service. This will open in a new tab where you can scan your MyKad and take a selfie.
						</p>
							
							{/* KYC In Progress Display */}
							{kycInProgress && !kycCompleted && !kycError && (
								<div className="mb-8 max-w-md mx-auto">
									<div className="p-6 bg-blue-50 border border-blue-200 rounded-xl">
										<div className="flex items-center justify-center mb-4">
											<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
										</div>
										<div className="text-center">
											<h4 className="text-lg font-semibold text-blue-800 mb-2">KYC Verification in Progress</h4>
										<p className="text-blue-600 mb-4">
											Please complete the identity verification process in the new tab. Status will be updated automatically when completed, or click "Check Status" to refresh.
										</p>
											<div className="flex flex-col sm:flex-row gap-3 justify-center">
												<button
													onClick={() => window.open(ctosOnboardingUrl!, '_blank')}
													className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 text-sm font-medium"
												>
													<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
													</svg>
													Reopen KYC Window
												</button>
												<button
													onClick={() => window.location.reload()}
													className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 text-sm font-medium"
												>
													<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
													</svg>
													Check Status
												</button>
												<button
													onClick={() => {
														setKycInProgress(false);
														setCtosOnboardingUrl(null);
														setPollingKycId(null);
													}}
													className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200 text-sm font-medium"
												>
													<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
													</svg>
													Cancel
												</button>
											</div>
										</div>
									</div>
								</div>
							)}
							
							{/* KYC Completed Successfully */}
							{kycCompleted && !kycError && (
								<div className="mb-8 max-w-md mx-auto">
									<div className="p-6 bg-green-50 border border-green-200 rounded-xl">
										<div className="text-center">
											<div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
												<CheckCircleIcon className="w-10 h-10 text-green-600" />
											</div>
											<h4 className="text-lg font-semibold text-green-800 mb-2">KYC Verification Completed!</h4>
											<p className="text-green-600 mb-4">
												Your identity has been successfully verified. The documents have been processed and are ready for review.
											</p>
											<button
												onClick={() => {
													setKycCompleted(false);
													// Refresh the page data to show the KYC results
													window.location.reload();
												}}
												className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 text-sm font-medium"
											>
												<CheckCircleIcon className="w-4 h-4 mr-2" />
												Continue to Next Step
											</button>
										</div>
									</div>
								</div>
							)}
							
							{/* KYC Error Display */}
							{kycError && (
								<div className="mb-8 max-w-md mx-auto">
									<div className="p-4 bg-red-50 border border-red-200 rounded-xl">
										<div className="flex items-start">
											<svg className="w-6 h-6 text-red-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.754-.833-2.464 0L4.35 15.5c-.77.833.192 2.5 1.732 2.5z" />
											</svg>
											<div className="flex-1">
												<h4 className="text-lg font-semibold text-red-800 mb-2">KYC Verification Failed</h4>
												<p className="text-red-600 mb-4">{kycError}</p>
												<button
													onClick={() => {
														setKycError(null);
														handleStartKyc(false);
													}}
													className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 text-sm font-medium"
												>
													<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
													</svg>
													Try Again
												</button>
											</div>
										</div>
									</div>
								</div>
							)}
							
							{/* Only show start/resume button when not in progress, not completed, and no error */}
							{!kycInProgress && !kycCompleted && (
								<div className="space-y-3">
									{ctosStatus?.canResume && ctosStatus.hasKycSession && ctosOnboardingUrl ? (
										<>
											<button
												onClick={() => {
													setKycInProgress(true);
													if (ctosStatus.kycSessionId) {
														setPollingKycId(ctosStatus.kycSessionId);
														startDatabasePolling(ctosStatus.kycSessionId);
													}
													window.open(ctosOnboardingUrl, '_blank');
												}}
												className="inline-flex items-center px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 text-lg font-medium"
											>
												<svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
												</svg>
												Resume KYC Verification
											</button>
											<p className="text-sm text-gray-600 text-center">
												You have an in-progress KYC session. Click to resume where you left off.
											</p>
										</>
									) : (
										<button
											onClick={() => handleStartKyc(false)}
											className={`inline-flex items-center px-8 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 text-lg font-medium ${
												(kycError || startingKyc || kycInProgress)
													? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
													: 'bg-purple-primary text-white hover:bg-purple-700 focus:ring-purple-500'
											}`}
											disabled={!!kycError || startingKyc || kycInProgress}
										>
											{startingKyc ? (
												<>
													<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
													Starting...
												</>
											) : (
												<>
													<ShieldCheckIcon className="w-6 h-6 mr-3" />
													{kycError ? 'Fix Error Above' : 'Start KYC Verification'}
												</>
											)}
										</button>
									)}
								</div>
							)}
						</div>
					)}
				</div>
			</div>

		</DashboardLayout>
	);
}
