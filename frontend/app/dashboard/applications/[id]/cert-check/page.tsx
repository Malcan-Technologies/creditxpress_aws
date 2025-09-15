"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { fetchWithTokenRefresh } from "@/lib/authUtils";
import { ArrowLeftIcon, CheckCircleIcon, ClockIcon, XCircleIcon, IdentificationIcon } from "@heroicons/react/24/outline";

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
		zipCode: string;
		idNumber?: string;
		icNumber?: string;
		icType?: string;
	};
}

export default function CertCheckPage() {
	const router = useRouter();
	const params = useParams();
	const [application, setApplication] = useState<LoanApplication | null>(null);
	const [loading, setLoading] = useState(true);
	const [checking, setChecking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [checkResult, setCheckResult] = useState<{
		hasValidCert: boolean;
		message: string;
		nextStep: string;
		certificateData?: any;
	} | null>(null);
	const [showIcInput, setShowIcInput] = useState(false);
	const [icNumber, setIcNumber] = useState("");
	const [updating, setUpdating] = useState(false);
	const [signingInProgress, setSigningInProgress] = useState(false);

	useEffect(() => {
		const fetchApplication = async () => {
			try {
				const data = await fetchWithTokenRefresh<LoanApplication>(
					`/api/loan-applications/${params.id}`
				);
				
				setApplication(data);
				
				// Debug logging
				console.log("User data:", data.user);
				console.log("IC Number:", data.user?.icNumber);
				
				// Auto-start certificate check - only use icNumber, ignore idNumber
				const userId = data.user?.icNumber;
				console.log("Final userId (icNumber only):", userId);
				
				if (userId) {
					console.log("Starting certificate check with userId:", userId);
					checkCertificate(userId);
				} else {
					console.log("No IC number found, showing IC input form");
					// Show IC input form if no IC number found
					setShowIcInput(true);
					setLoading(false);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "An error occurred");
				setLoading(false);
			}
		};

		if (params.id) {
			fetchApplication();
		}
	}, [params.id]);

	const checkCertificate = async (userId: string) => {
		try {
			setChecking(true);
			setError(null);

			// Check if user has a valid certificate
			const certResponse = await fetchWithTokenRefresh(
				`/api/mtsa/cert-info/${userId}?t=${Date.now()}`,
				{
					method: "GET",
					cache: "no-store",
				}
			) as any;

			// Check for successful certificate status
			// MTSA GetCertInfo returns "000" for success, and certStatus should be "Valid" for valid certificates
			const isSuccess = certResponse.success && certResponse.data?.statusCode === "000";
			const hasValidCert = isSuccess && certResponse.data?.certStatus === "Valid";

			if (hasValidCert) {
				// User has a valid certificate - can go directly to signing
				setCheckResult({
					hasValidCert: true,
					message: "Valid digital certificate found! You can proceed directly to document signing.",
					nextStep: "PENDING_SIGNATURE",
					certificateData: certResponse.data
				});

				// Update application status to PENDING_SIGNATURE
				await fetchWithTokenRefresh(
					`/api/loan-applications/${params.id}`,
					{
						method: "PATCH",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							status: "PENDING_SIGNATURE",
						}),
					}
				);

				// Auto-redirect disabled for debugging
				// setTimeout(() => {
				// 	router.push("/dashboard/loans");
				// }, 3000);

			} else {
				// User needs to get a new certificate - proceed with profile confirmation first
				setCheckResult({
					hasValidCert: false,
					message: "No valid digital certificate found. You'll need to complete profile confirmation and identity verification to obtain a new certificate.",
					nextStep: "PENDING_PROFILE_CONFIRMATION"
				});

				// Update application status to PENDING_PROFILE_CONFIRMATION
				await fetchWithTokenRefresh(
					`/api/loan-applications/${params.id}`,
					{
						method: "PATCH",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							status: "PENDING_PROFILE_CONFIRMATION",
						}),
					}
				);

				// Auto-redirect disabled for debugging
				// setTimeout(() => {
				// 	router.push(`/dashboard/applications/${params.id}/profile-confirmation`);
				// }, 3000);
			}

		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to check certificate status");
		} finally {
			setChecking(false);
			setLoading(false);
		}
	};

	const updateIcNumber = async () => {
		if (!icNumber.trim()) {
			setError("Please enter your IC number");
			return;
		}

		// Validate IC number format (Malaysian IC: 12 digits)
		const icPattern = /^\d{12}$/;
		if (!icPattern.test(icNumber)) {
			setError("Please enter a valid IC number (12 digits)");
			return;
		}

		try {
			setUpdating(true);
			setError(null);

			// Update user IC number
			await fetchWithTokenRefresh("/api/users/me", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					icNumber: icNumber.trim(),
				}),
			});

			// Update the application state
			if (application) {
				setApplication({
					...application,
					user: {
						...application.user!,
						icNumber: icNumber.trim(),
					},
				});
			}

			// Hide IC input and start certificate check
			setShowIcInput(false);
			checkCertificate(icNumber.trim());

		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to update IC number");
		} finally {
			setUpdating(false);
		}
	};

	const handleBack = () => {
		// Go back to loans dashboard applications tab (after attestation completion)
		router.push("/dashboard/loans?tab=applications");
	};

	console.log("Render states:", { loading, checking, showIcInput, error, application: !!application });

	if (loading || checking) {
		return (
			<DashboardLayout>
				<div className="flex items-center justify-center min-h-96">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-primary mx-auto mb-4"></div>
						<p className="text-gray-600 font-body">
							{loading ? "Loading application..." : "Checking certificate status..."}
						</p>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	if (error || !application) {
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

					{/* Error Content */}
					<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
						<div className="text-center py-12">
							<div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
								<XCircleIcon className="w-8 h-8 text-red-600" />
							</div>
							
							<h2 className="text-2xl font-heading font-bold text-gray-700 mb-4">
								Unable to Check Certificate
							</h2>
							
							<div className="max-w-md mx-auto">
								<p className="text-gray-600 mb-6 leading-relaxed">
									{error || "Application not found. Please check if the application exists and try again."}
								</p>
								
								<div className="space-y-3">
									<button
										onClick={handleBack}
										className="w-full inline-flex items-center justify-center px-6 py-3 bg-purple-primary text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold"
									>
										<ArrowLeftIcon className="h-4 w-4 mr-2" />
										Back to Applications
									</button>
									
									<button
										onClick={() => window.location.reload()}
										className="w-full inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
									>
										<svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
										</svg>
										Try Again
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	// IC Number Input State
	if (showIcInput) {
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

					{/* IC Number Input Form */}
					<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
						<div className="text-center py-12">
							<div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
								<IdentificationIcon className="w-8 h-8 text-blue-600" />
							</div>
							
							<h2 className="text-2xl font-heading font-bold text-gray-700 mb-4">
								IC Number Required
							</h2>
							
							<div className="max-w-md mx-auto">
								<p className="text-gray-600 mb-6 leading-relaxed">
									To check your digital certificate status, please enter your Malaysian IC number.
								</p>

								{error && (
									<div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
										<p className="text-red-600 text-sm">{error}</p>
									</div>
								)}
								
								<div className="space-y-4">
									<div>
										<label htmlFor="icNumber" className="block text-sm font-medium text-gray-700 mb-2">
											IC Number
										</label>
										<input
											type="text"
											id="icNumber"
											value={icNumber}
											onChange={(e) => setIcNumber(e.target.value)}
											placeholder="XXXXXXXXXXXX"
											className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-primary focus:border-purple-primary font-mono text-center text-gray-900 placeholder-gray-400"
											maxLength={12}
											disabled={updating}
										/>
										<p className="text-xs text-gray-500 mt-1">
											Enter your IC number in the format: XXXXXXXXXXXX
										</p>
									</div>
									
									<div className="space-y-3">
										<button
											onClick={updateIcNumber}
											disabled={updating || !icNumber.trim()}
											className="w-full inline-flex items-center justify-center px-6 py-3 bg-purple-primary text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
										>
											{updating ? (
												<>
													<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
													Updating...
												</>
											) : (
												<>
													<IdentificationIcon className="h-4 w-4 mr-2" />
													Continue Certificate Check
												</>
											)}
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	// Handle proceeding to document signing (same logic as loan applications card)
	const handleProceedToSigning = async () => {
		if (!application) return;

		try {
			setSigningInProgress(true);
			
			// First, try to get existing signing URL from loan_signatories table
			try {
				const signingResponse = await fetchWithTokenRefresh<{
					success: boolean;
					data?: {
						signingUrl: string;
						applicationId: string;
						loanId: string;
					};
				}>(`/api/loan-applications/${application.id}/signing-url`);

				if (signingResponse?.success && signingResponse?.data?.signingUrl) {
					// Open existing signing URL
					window.open(signingResponse.data.signingUrl, '_blank');
					return;
				}
			} catch (error) {
				console.log('No existing signing URL found, will initiate new signing process');
			}
			
			// If no existing signing URL, initiate new document signing with DocuSeal
			const response = await fetchWithTokenRefresh<{
				success: boolean;
				message: string;
				data?: {
					submissionId: string;
					signUrl: string;
					status: string;
				};
			}>('/api/docuseal/initiate-application-signing', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					applicationId: application.id,
				}),
			});

			if (response?.success && response?.data?.signUrl) {
				// Open DocuSeal signing URL in a new tab
				window.open(response.data.signUrl, '_blank');
				
				// Navigate back to dashboard to see updated status
				router.push("/dashboard/loans?tab=applications");
			} else {
				throw new Error(response?.message || 'Failed to initiate document signing');
			}

		} catch (error) {
			console.error('Error initiating document signing:', error);
			setError(`Failed to initiate document signing: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			setSigningInProgress(false);
		}
	};

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

				{/* Main Content */}
				<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
					{!checkResult ? (
						// Loading State
						<div className="text-center py-12">
							<div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
								<ClockIcon className="w-8 h-8 text-purple-600" />
							</div>
							
							<h2 className="text-2xl font-heading font-bold text-gray-700 mb-4">
								Checking Certificate Status
							</h2>
							
							<p className="text-gray-600 mb-6 leading-relaxed max-w-md mx-auto">
								We're verifying your digital certificate status...
							</p>
							
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary mx-auto"></div>
						</div>
					) : (
						// Result State
						<div className="text-center py-12">
							<div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
								checkResult.hasValidCert 
									? 'bg-green-100' 
									: 'bg-blue-100'
							}`}>
								{checkResult.hasValidCert ? (
									<CheckCircleIcon className="w-8 h-8 text-green-600" />
								) : (
									<ClockIcon className="w-8 h-8 text-blue-600" />
								)}
							</div>
							
							<h2 className={`text-2xl font-heading font-bold text-gray-700 mb-4`}>
								{checkResult.hasValidCert ? "Certificate Found!" : "Certificate Required"}
							</h2>
							
							<div className="max-w-md mx-auto">
								<p className="text-gray-600 mb-6 leading-relaxed">
									{checkResult.message}
								</p>

								{/* Certificate Details */}
								{checkResult.hasValidCert && checkResult.certificateData && (
									<div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
										<h3 className="font-semibold text-gray-700 mb-3">Certificate Details:</h3>
										<div className="space-y-2 text-sm text-gray-600">
											{checkResult.certificateData.certSubjectDN && (
												<div>
													<span className="font-medium text-gray-700">Name:</span> {
														checkResult.certificateData.certSubjectDN
															.split(',')
															.find((part: string) => part.trim().startsWith('CN='))
															?.replace('CN=', '')
															?.trim() || 'N/A'
													}
												</div>
											)}
											{checkResult.certificateData.certSerialNo && (
												<div>
													<span className="font-medium text-gray-700">Serial No:</span> 
													<span className="font-mono ml-1">{checkResult.certificateData.certSerialNo}</span>
												</div>
											)}
											{checkResult.certificateData.certIssuer && (
												<div>
													<span className="font-medium text-gray-700">Issuer:</span> {checkResult.certificateData.certIssuer}
												</div>
											)}
											{checkResult.certificateData.certValidFrom && (
												<div>
													<span className="font-medium text-gray-700">Valid From:</span> {checkResult.certificateData.certValidFrom}
												</div>
											)}
											{checkResult.certificateData.certValidTo && (
												<div>
													<span className="font-medium text-gray-700">Valid To:</span> {checkResult.certificateData.certValidTo}
												</div>
											)}
											<div>
												<span className="font-medium text-green-600">Status:</span> Valid
											</div>
										</div>
									</div>
								)}

								{/* Action Buttons */}
								<div className="space-y-3">
									{checkResult.hasValidCert ? (
										<button
											onClick={handleProceedToSigning}
											disabled={signingInProgress}
											className="w-full inline-flex items-center justify-center px-6 py-3 bg-purple-primary text-white rounded-xl hover:bg-purple-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors font-semibold"
										>
											<CheckCircleIcon className="h-4 w-4 mr-2" />
											{signingInProgress ? "Initiating..." : "Continue to Document Signing"}
										</button>
									) : (
										<button
											onClick={() => router.push(`/dashboard/applications/${params.id}/profile-confirmation`)}
											className="w-full inline-flex items-center justify-center px-6 py-3 bg-purple-primary text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold"
										>
											<ClockIcon className="h-4 w-4 mr-2" />
											Continue to e-KYC
										</button>
									)}
									
									<button
										onClick={() => window.location.reload()}
										className="w-full inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
									>
										<svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
										</svg>
										Check Again
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</DashboardLayout>
	);
}
