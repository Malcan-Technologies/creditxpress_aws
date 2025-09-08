"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { fetchWithTokenRefresh } from "@/lib/authUtils";
import { fetchKycImages, KycImages } from "@/lib/kycUtils";
import KycImageDisplay from "@/components/KycImageDisplay";
import { ArrowLeftIcon, EyeIcon, CheckCircleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

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
	const [kycImages, setKycImages] = useState<KycImages | null>(null);
	const [loading, setLoading] = useState(true);
	const [kycImagesLoading, setKycImagesLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [kycError, setKycError] = useState<string | null>(null);
	const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
	const [imageViewerOpen, setImageViewerOpen] = useState(false);
	const [processingAccept, setProcessingAccept] = useState(false);
	const [ctosOnboardingUrl, setCtosOnboardingUrl] = useState<string | null>(null);
	const [pollingKycId, setPollingKycId] = useState<string | null>(null);
	const [ctosStatus, setCtosStatus] = useState<{ status: number; result?: number } | null>(null);
	const [kycInProgress, setKycInProgress] = useState(false);
	const [kycCompleted, setKycCompleted] = useState(false);

	useEffect(() => {
		const fetchData = async () => {
			try {
				// Fetch application data
				const appData = await fetchWithTokenRefresh<LoanApplication>(
					`/api/loan-applications/${params.id}`
				);
				setApplication(appData);

				// Fetch KYC images for this user (KYC is tied to user profile, not specific application)
				const kycData = await fetchKycImages();
				setKycImages(kycData);
			} catch (err) {
				setError(err instanceof Error ? err.message : "An error occurred");
			} finally {
				setLoading(false);
				setKycImagesLoading(false);
			}
		};

		if (params.id) {
			fetchData();
		}
	}, [params.id]);

	const handleStartKyc = async (forceRedo: boolean = false) => {
		try {
			setKycError(null); // Clear previous KYC errors
			
			// Get user data for document information
			if (!application?.user?.icNumber || !application?.user?.fullName) {
				setKycError("Missing user information required for KYC. Please complete your profile first.");
				return;
			}

			// Start CTOS eKYC process
			const response = await fetchWithTokenRefresh<{ 
				success: boolean; 
				kycId: string; 
				onboardingUrl: string; 
				onboardingId: string; 
				expiredAt: string; 
				kycToken: string; 
				ttlMinutes: number; 
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
				
				// Open CTOS eKYC in new tab
				window.open(response.onboardingUrl, '_blank');
				
				// Start polling for status updates
				startStatusPolling(response.kycId);
			} else {
				throw new Error('Failed to create CTOS eKYC session');
			}
		} catch (err) {
			console.error("CTOS KYC start error:", err);
			setKycError(err instanceof Error ? err.message : "Failed to start KYC verification");
			setKycInProgress(false);
			setKycCompleted(false);
		}
	};

	const startStatusPolling = (kycId: string) => {
		const pollStatus = async () => {
			try {
				const statusResponse = await fetchWithTokenRefresh<{
					success: boolean;
					status: string;
					ctosStatus: number;
					ctosResult: number;
				}>(`/api/kyc/${kycId}/ctos-status`);

				setCtosStatus({ 
					status: statusResponse.ctosStatus, 
					result: statusResponse.ctosResult 
				});

				// Check if CTOS process is completed
				if (statusResponse.ctosStatus === 2) { // Completed
					setKycInProgress(false);
					setKycCompleted(true);
					
					if (statusResponse.ctosResult === 1) { // Approved
						// Refresh KYC images to show new documents
						const kycData = await fetchKycImages();
						setKycImages(kycData);
						setCtosOnboardingUrl(null);
						setPollingKycId(null);
					} else {
						// Rejected
						setKycError("KYC verification was rejected. Please try again.");
						setCtosOnboardingUrl(null);
						setPollingKycId(null);
						setKycCompleted(false);
					}
				} else if (statusResponse.ctosStatus === 3) { // Expired
					setKycError("KYC verification session expired. Please start again.");
					setCtosOnboardingUrl(null);
					setPollingKycId(null);
					setKycInProgress(false);
					setKycCompleted(false);
				}
			} catch (err) {
				console.error("Status polling error:", err);
			}
		};

		// Poll every 5 seconds
		const interval = setInterval(pollStatus, 5000);
		
		// Clean up after 30 minutes
		setTimeout(() => {
			clearInterval(interval);
			setCtosOnboardingUrl(null);
			setPollingKycId(null);
		}, 30 * 60 * 1000);

		// Return cleanup function
		return () => clearInterval(interval);
	};

	const handleAcceptKyc = async () => {
		if (!kycImages) return;

		try {
			setProcessingAccept(true);
			
			// In the new flow, we just need to update the application status
			// The KYC images are already approved and available
			console.log("New flow: Accepting existing KYC images and proceeding to profile confirmation");

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

			// Redirect to certificate request
			router.push(`/dashboard/applications/${params.id}/cert-check`);
		} catch (err) {
			setKycError(err instanceof Error ? err.message : "Failed to accept KYC verification");
		} finally {
			setProcessingAccept(false);
		}
	};

	const handleKycImageView = (imageId: string) => {
		setSelectedImageId(imageId);
		setImageViewerOpen(true);
	};

	const closeImageViewer = () => {
		setImageViewerOpen(false);
		setSelectedImageId(null);
	};

	const handleBack = () => {
		// Go back to loans dashboard - attestation is already completed and cannot be reversed
		router.push("/dashboard/loans?tab=applications");
	};

	if (loading) {
		return (
			<DashboardLayout>
				<div className="flex items-center justify-center min-h-96">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-primary"></div>
				</div>
			</DashboardLayout>
		);
	}

	if (error || !application) {
		return (
			<DashboardLayout>
				<div className="text-center py-12">
					<h2 className="text-2xl font-heading font-bold text-gray-700 mb-4">
						Error Loading Application
					</h2>
					<p className="text-gray-600 mb-6">{error || "Application not found"}</p>
					<button
						onClick={() => router.push("/dashboard/loans")}
						className="inline-flex items-center px-4 py-2 bg-purple-primary text-white rounded-lg hover:bg-purple-700 transition-colors"
					>
						<ArrowLeftIcon className="h-4 w-4 mr-2" />
						Back to Applications
					</button>
				</div>
			</DashboardLayout>
		);
	}

	// Only show KYC verification for applications in PENDING_KYC status
	if (application.status !== "PENDING_KYC") {
		return (
			<DashboardLayout>
				<div className="text-center py-12">
					<h2 className="text-2xl font-heading font-bold text-gray-700 mb-4">
						KYC Verification Not Required
					</h2>
					<p className="text-gray-600 mb-6">
						This application is not in the correct status for KYC verification.
					</p>
					<button
						onClick={() => router.push("/dashboard/loans")}
						className="inline-flex items-center px-4 py-2 bg-purple-primary text-white rounded-lg hover:bg-purple-700 transition-colors"
					>
						<ArrowLeftIcon className="h-4 w-4 mr-2" />
						Back to Applications
					</button>
				</div>
			</DashboardLayout>
		);
	}

	const formatCurrency = (amount: number) => `RM ${amount.toFixed(2)}`;

	return (
		<DashboardLayout>
			<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
				{/* Back Button */}
				<div className="mb-6">
					<button
						onClick={handleBack}
						className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors font-body"
					>
						<ArrowLeftIcon className="h-4 w-4 mr-2" />
						Back to Applications
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
						// Show CTOS process active
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
							
							<div className="text-center">
								<button
									onClick={() => window.open(ctosOnboardingUrl, '_blank')}
									className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors mr-4"
								>
									<svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M7 7l10 10M17 7l-4 4" />
									</svg>
									Reopen KYC Window
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
						</div>
					) : kycImagesLoading ? (
						<div className="flex items-center justify-center py-12">
							<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-primary"></div>
							<span className="ml-3 text-gray-600 font-body">Checking KYC status...</span>
						</div>
					) : kycImages ? (
						// Show existing KYC images
						<div className="space-y-6">
							<div className="bg-green-50 border border-green-200 rounded-xl p-6">
								<div className="flex items-start space-x-4">
									<div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
										<CheckCircleIcon className="w-6 h-6 text-green-600" />
									</div>
									<div className="flex-1">
										<h3 className="text-lg font-heading font-bold text-green-800 mb-2">
											KYC Documents Found
										</h3>
										<p className="text-green-700 font-body">
											We found your previously uploaded KYC documents. Please review them below and accept to continue, or redo the verification if needed.
										</p>
									</div>
								</div>
							</div>

							{/* KYC Images Grid */}
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
								{kycImages.images?.front && (
									<div className="bg-gray-50 p-4 lg:p-5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
										<div className="flex flex-col items-center space-y-3">
											<div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
												<svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
													<rect x="3" y="3" width="18" height="14" rx="2" ry="2"/>
												</svg>
											</div>
											<div className="text-center">
												<h4 className="text-sm lg:text-base font-semibold text-gray-700 font-body mb-1">
													{kycImages.images?.front?.type}
												</h4>
												<p className="text-xs text-gray-500 font-body mb-3">
													MyKad Front Side
												</p>
												<button
													onClick={() => handleKycImageView(kycImages.images?.front?.id!)}
													className="flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200 hover:border-blue-300 w-full"
												>
													<EyeIcon className="h-4 w-4 mr-1" />
													View
												</button>
											</div>
										</div>
									</div>
								)}
								{kycImages.images?.back && (
									<div className="bg-gray-50 p-4 lg:p-5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
										<div className="flex flex-col items-center space-y-3">
											<div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
												<svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
													<rect x="3" y="3" width="18" height="14" rx="2" ry="2"/>
												</svg>
											</div>
											<div className="text-center">
												<h4 className="text-sm lg:text-base font-semibold text-gray-700 font-body mb-1">
													{kycImages.images?.back?.type}
												</h4>
												<p className="text-xs text-gray-500 font-body mb-3">
													MyKad Back Side
												</p>
												<button
													onClick={() => handleKycImageView(kycImages.images?.back?.id!)}
													className="flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200 hover:border-blue-300 w-full"
												>
													<EyeIcon className="h-4 w-4 mr-1" />
													View
												</button>
											</div>
										</div>
									</div>
								)}
								{kycImages.images?.selfie && (
									<div className="bg-gray-50 p-4 lg:p-5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
										<div className="flex flex-col items-center space-y-3">
											<div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
												<svg className="h-6 w-6 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
													<circle cx="12" cy="12" r="4"/>
												</svg>
											</div>
											<div className="text-center">
												<h4 className="text-sm lg:text-base font-semibold text-gray-700 font-body mb-1">
													{kycImages.images?.selfie?.type}
												</h4>
												<p className="text-xs text-gray-500 font-body mb-3">
													Identity Verification Photo
												</p>
												<button
													onClick={() => handleKycImageView(kycImages.images?.selfie?.id!)}
													className="flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200 hover:border-blue-300 w-full"
												>
													<EyeIcon className="h-4 w-4 mr-1" />
													View
												</button>
											</div>
										</div>
									</div>
								)}
							</div>

							{/* Action Buttons */}
							<div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-100">
								<button
									onClick={handleAcceptKyc}
									disabled={processingAccept}
									className="flex-1 flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{processingAccept ? (
										<>
											<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
											Accepting...
										</>
									) : (
										<>
											<CheckCircleIcon className="w-5 h-5 mr-2" />
											Accept & Continue
										</>
									)}
								</button>
								<button
									onClick={() => handleStartKyc(true)}
									className="flex-1 flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200 text-base font-medium"
								>
									<svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
									Redo KYC
								</button>
							</div>
						</div>
					) : (
						// No existing KYC - start new
						<div className="text-center py-12">
							<div className="w-20 h-20 mx-auto mb-6 bg-purple-100 rounded-full flex items-center justify-center">
								<ShieldCheckIcon className="w-10 h-10 text-purple-600" />
							</div>
							<h3 className="text-2xl font-heading font-bold text-gray-700 mb-4">
								Identity Verification Required
							</h3>
							<p className="text-gray-600 font-body mb-8 max-w-md mx-auto">
								To proceed with your loan application, we need to verify your identity using our secure CTOS eKYC service. This will open in a new tab where you can scan your MyKad and take a selfie.
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
												Please complete the identity verification process in the CTOS tab. We're monitoring your progress...
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
							
							{/* Only show start button when not in progress, not completed, and no error */}
							{!kycInProgress && !kycCompleted && (
								<button
									onClick={() => handleStartKyc(false)}
									className={`inline-flex items-center px-8 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 text-lg font-medium ${
										kycError 
											? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
											: 'bg-purple-primary text-white hover:bg-purple-700 focus:ring-purple-500'
									}`}
									disabled={!!kycError}
								>
									<ShieldCheckIcon className="w-6 h-6 mr-3" />
									{kycError ? 'Fix Error Above' : 'Start CTOS KYC Verification'}
								</button>
							)}
						</div>
					)}
				</div>
			</div>

			{/* KYC Image Viewer Modal */}
			{imageViewerOpen && selectedImageId && (
				<div 
					className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50"
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							closeImageViewer();
						}
					}}
				>
					<div className="bg-white rounded-2xl shadow-2xl max-w-4xl max-h-[90vh] overflow-hidden border border-gray-100 relative">
						<div className="flex items-center justify-between p-6 border-b border-gray-100">
							<h3 className="text-xl font-heading font-bold text-gray-700">
								KYC Document
							</h3>
							<button
								onClick={closeImageViewer}
								className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
						<div className="p-6">
							<KycImageDisplay imageId={selectedImageId} />
						</div>
					</div>
				</div>
			)}
		</DashboardLayout>
	);
}
