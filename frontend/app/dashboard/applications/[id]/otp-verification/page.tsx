"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { fetchWithTokenRefresh } from "@/lib/authUtils";
import { ArrowLeftIcon, CheckCircleIcon, EnvelopeIcon } from "@heroicons/react/24/outline";

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
	};
}

export default function OTPVerificationPage() {
	const router = useRouter();
	const params = useParams();
	const [application, setApplication] = useState<LoanApplication | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [email, setEmail] = useState("");
	const [otp, setOtp] = useState("");
	const [otpSent, setOtpSent] = useState(false);
	const [sendingOtp, setSendingOtp] = useState(false);
	const [verifyingOtp, setVerifyingOtp] = useState(false);
	const [countdown, setCountdown] = useState(0);
	const [certificateSuccess, setCertificateSuccess] = useState(false);
	const [certificateData, setCertificateData] = useState<any>(null);
	const [userName, setUserName] = useState("");

	const layoutProps = useMemo(
		() => ({
			title: "OTP Verification",
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
				console.warn("Failed to load user profile for OTP page", err);
			}
		};

		loadUserName();
	}, []);

	useEffect(() => {
		const fetchApplication = async () => {
			try {
				const data = await fetchWithTokenRefresh<LoanApplication>(
					`/api/loan-applications/${params.id}`
				);
				
				setApplication(data);
				setEmail(data.user?.email || "");
				if (data.user?.fullName) {
					setUserName((prev) => prev || data.user!.fullName.split(" ")[0]);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "An error occurred");
			} finally {
				setLoading(false);
			}
		};

		if (params.id) {
			fetchApplication();
		}
	}, [params.id]);



	const handleSendOTP = async () => {
		if (!application?.user?.icNumber && !application?.user?.idNumber) {
			setError("IC Number is required for OTP verification");
			return;
		}

		try {
			setSendingOtp(true);
			setError(null);

			// Get user ID (IC number or ID number)
			const userId = application.user.icNumber || application.user.idNumber!;

			console.log("Checking certificate status for user:", userId);

					// Step 1: Check if user has a valid certificate using GetCertInfo
		const certCheckData = await fetchWithTokenRefresh(
			`/api/mtsa/cert-info/${userId}`,
			{
				method: "GET",
			}
		) as any;
		console.log("Certificate check response:", certCheckData);

		// Determine OTP usage type based on certificate status
		let otpUsage = "NU"; // New enrollment by default
		if (certCheckData.success && certCheckData.data?.certStatus === "ACTIVE") {
			otpUsage = "DS"; // Digital signing if user has active certificate
			console.log("User has active certificate, using DS (Digital Signing) OTP");
		} else {
			console.log("User needs new certificate, using NU (New User) OTP");
		}

		// Step 2: Request OTP with appropriate usage type
		const otpRequestData = await fetchWithTokenRefresh(
			"/api/mtsa/request-otp",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					userId: userId,
					usage: otpUsage,
					emailAddress: email, // Required for NU (new enrollment)
				}),
			}
		) as any;

		console.log("OTP request response:", otpRequestData);

		if (otpRequestData.success) {
			setOtpSent(true);
			setCountdown(300); // 5 minutes countdown
			console.log("OTP sent successfully to", email);
		} else {
			throw new Error(otpRequestData.message || "Failed to send OTP");
		}
		} catch (err) {
			console.error("OTP send error:", err);
			setError(err instanceof Error ? err.message : "Failed to send OTP");
		} finally {
			setSendingOtp(false);
		}
	};

	const handleVerifyOTP = async () => {
		if (!otp || otp.length !== 6) {
			setError("Please enter a valid 6-digit OTP");
			return;
		}

		if (!application?.user?.icNumber && !application?.user?.idNumber) {
			setError("IC Number is required for OTP verification");
			return;
		}

		try {
			setVerifyingOtp(true);
			setError(null);

					// Get user ID (IC number or ID number)
		const userId = application.user.icNumber || application.user.idNumber!;

		console.log("Requesting certificate with OTP for user:", userId);
		console.log("OTP Code:", otp);
			
					// Step 1: Fetch KYC images from user profile (not application-specific)
		console.log("Fetching KYC images for certificate request...");
			
			const kycResponse = await fetchWithTokenRefresh(
				`/api/kyc/images`,
				{
					method: "GET",
				}
			) as any;

			console.log("=== KYC RESPONSE DEBUG ===");
			console.log("Full KYC Response:", JSON.stringify(kycResponse, null, 2));
			console.log("========================");

			if (!kycResponse.images) {
				throw new Error("KYC documents not found. Please complete KYC verification first.");
			}

			const { front, back, selfie } = kycResponse.images;
			
			console.log("=== KYC IMAGES DEBUG ===");
			console.log("Front object:", JSON.stringify(front, null, 2));
			console.log("Back object:", JSON.stringify(back, null, 2));
			console.log("Selfie object:", JSON.stringify(selfie, null, 2));
			console.log("========================");

			if (!front || !back || !selfie) {
				throw new Error("Required KYC documents (IC front, IC back, selfie) not found. Please complete KYC verification first.");
			}

			// Check if URLs exist
			if (!front.url || !back.url || !selfie.url) {
				throw new Error("KYC document URLs are missing. Please contact support.");
			}

			// Log KYC document URLs for debugging
			console.log("=== KYC DOCUMENT URLS ===");
			console.log("IC Front URL:", front.url);
			console.log("IC Back URL:", back.url);
			console.log("Selfie URL:", selfie.url);
			console.log("=========================");

					// Step 2: Request Certificate with MTSA using OTP as authFactor
		console.log("Requesting certificate from MTSA...");
			
			// Prepare verification data for certificate request
			// Format datetime as yyyy-MM-dd HH:mm:ss (MTSA expected format)
			const now = new Date();
			const formattedDateTime = now.getFullYear().toString() + '-' +
				(now.getMonth() + 1).toString().padStart(2, '0') + '-' +
				now.getDate().toString().padStart(2, '0') + ' ' +
				now.getHours().toString().padStart(2, '0') + ':' +
				now.getMinutes().toString().padStart(2, '0') + ':' +
				now.getSeconds().toString().padStart(2, '0');
				
			const verificationData = {
				verifyDatetime: formattedDateTime,
				verifyMethod: "email_otp",
				verifyStatus: "verified",
				verifyVerifier: "mtsa_otp_system"
			};

			const certificateRequest = {
				userId: userId,
				fullName: application.user.fullName,
				emailAddress: email,
				mobileNo: application.user.phoneNumber,
				nationality: "MY",
				userType: "1", // External borrower
				idType: "N", // N for Malaysian NRIC, P for Passport
				authFactor: otp, // Use the verified OTP as auth factor
				// Pass KYC image URLs - backend will fetch and convert to base64
				nricFrontUrl: front.url, 
				nricBackUrl: back.url, 
				selfieImageUrl: selfie.url,
				verificationData: verificationData
			};

			const certificateResponse = await fetchWithTokenRefresh(
				"/api/mtsa/request-certificate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(certificateRequest),
				}
			) as any;

			console.log("Certificate request response:", certificateResponse);

			// Handle different MTSA status codes
			const statusCode = certificateResponse.data?.statusCode;
			const statusMsg = certificateResponse.data?.statusMsg || certificateResponse.message;

			if (statusCode === "000") {
				// Success - store certificate data for success screen
				setCertificateData(certificateResponse.data);
			} else {
				// Handle various error scenarios with user-friendly messages
				let errorMessage = statusMsg || "Failed to request certificate";
				
				switch (statusCode) {
					case "AP100":
						errorMessage = "Certificate auto-enrollment failed. Please contact support.";
						break;
					case "AP101":
						errorMessage = "Missing required information. Please ensure all fields are completed.";
						break;
					case "AP102":
						errorMessage = "Invalid information provided. Please check your details.";
						break;
					case "AP103":
						errorMessage = "Invalid user type. Please contact support.";
						break;
					case "AP104":
					case "AP106":
					case "AP107":
						errorMessage = "Invalid information format. Please try again.";
						break;
					case "AP105":
						errorMessage = "Invalid nationality. Please ensure your nationality is set correctly.";
						break;
					case "AP108":
						errorMessage = "Invalid image file. Please ensure your KYC images are valid.";
						break;
					case "AP109":
						errorMessage = "Invalid image format. Please ensure your KYC images are in the correct format.";
						break;
					case "AP110":
						errorMessage = "Invalid ID type. Please ensure your IC information is correct.";
						break;
					case "AP111":
						errorMessage = "You already have a certificate. Proceeding to document signing.";
						// This is actually not an error - user has existing certificate
						setCertificateData({
							...certificateResponse.data,
							statusMsg: "Existing certificate found"
						});
						break;
					case "AP112":
						errorMessage = "Invalid OTP code. Please check the OTP you entered.";
						break;
					case "AP113":
						errorMessage = "OTP has expired. Please request a new OTP.";
						break;
					case "AP114":
						errorMessage = "OTP validation failed. Please try again.";
						break;
					case "AP115":
						errorMessage = "KYC verification error. Please complete KYC verification first.";
						break;
					case "AP121":
						errorMessage = "You already have an active certificate request. Please wait for processing to complete.";
						break;
					case "AP122":
						errorMessage = "Document size is too large. Please contact support.";
						break;
					case "AP123":
						errorMessage = "No document to upload. Please ensure KYC documents are available.";
						break;
					default:
						errorMessage = `Certificate request failed: ${statusMsg} (Code: ${statusCode})`;
				}

				if (statusCode === "AP111") {
					// User already has certificate - this is success scenario
					// Continue with the flow
				} else {
					throw new Error(errorMessage);
				}
			}

			// Step 3: Update application status to PENDING_SIGNATURE (ready for DocuSeal)
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

			console.log("Certificate requested successfully, showing success screen");
			// Show success screen instead of immediately redirecting
			setCertificateSuccess(true);
		} catch (err) {
			console.error("OTP verification error:", err);
			
			// If it's a KYC documents error, show a helpful message
			if (err instanceof Error && err.message.includes("404")) {
				setError("KYC documents not found. Please complete KYC verification first, then try again.");
			} else {
				setError(err instanceof Error ? err.message : "Failed to verify OTP");
			}
		} finally {
			setVerifyingOtp(false);
		}
	};

	const handleOtpChange = (value: string) => {
		// Only allow digits and limit to 6 characters
		const numericValue = value.replace(/\D/g, '').slice(0, 6);
		setOtp(numericValue);
		if (error) setError(null);
	};

	// Helper function to check if error is OTP-related and user should try again
	const isRetryableOtpError = (errorMessage: string) => {
		return errorMessage.includes("Invalid OTP") || 
			   errorMessage.includes("OTP has expired") || 
			   errorMessage.includes("OTP validation failed");
	};

	// Countdown timer effect
	useEffect(() => {
		if (countdown <= 0) return;

		const timer = setInterval(() => {
			setCountdown(prev => prev - 1);
		}, 1000);

		return () => clearInterval(timer);
	}, [countdown]);

	const formatTime = (seconds: number) => {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
	};

	const handleBack = async () => {
		try {
			// Update application status back to PENDING_KYC
			await fetchWithTokenRefresh(
				`/api/loan-applications/${params.id}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						status: "PENDING_KYC",
					}),
				}
			);

			// Navigate back to KYC verification
			router.push(`/dashboard/applications/${params.id}/kyc-verification`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to go back to KYC verification");
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
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
					{/* Back Button */}
					<div className="mb-6">
						<button
							onClick={() => router.push("/dashboard/loans")}
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
								<svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 16.5c-.77.833.192 2.5 1.732 2.5z" />
								</svg>
							</div>
							
							<h2 className="text-2xl font-heading font-bold text-gray-700 mb-4">
								Unable to Process Request
							</h2>
							
							<div className="max-w-md mx-auto">
								<p className="text-gray-600 mb-6 leading-relaxed">
									{error || "Application not found. Please check if the application exists and try again."}
								</p>
								
								{/* Additional helpful actions */}
								<div className="space-y-3">
									<button
										onClick={() => router.push("/dashboard/loans")}
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

	// Only show OTP verification for applications in PENDING_SIGNING_OTP or PENDING_CERTIFICATE_OTP status
	if (application.status !== "PENDING_SIGNING_OTP" && application.status !== "PENDING_CERTIFICATE_OTP") {
		return (
			<DashboardLayout {...layoutProps}>
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
					{/* Back Button */}
					<div className="mb-6">
						<button
							onClick={() => router.push("/dashboard/loans")}
							className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors font-body"
						>
							<ArrowLeftIcon className="h-4 w-4 mr-2" />
							Back to Applications
						</button>
					</div>

					{/* Status Content */}
					<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
						<div className="text-center py-12">
							<div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
								<svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							
							<h2 className="text-2xl font-heading font-bold text-gray-700 mb-4">
								OTP Verification Not Required
							</h2>
							
							<div className="max-w-md mx-auto">
								<p className="text-gray-600 mb-6 leading-relaxed">
									This application is currently in "{application.status}" status and does not require OTP verification at this time.
								</p>
								
								<button
									onClick={() => router.push("/dashboard/loans")}
									className="w-full inline-flex items-center justify-center px-6 py-3 bg-purple-primary text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold"
								>
									<ArrowLeftIcon className="h-4 w-4 mr-2" />
									Back to Applications
								</button>
							</div>
						</div>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	// Success Screen
	if (certificateSuccess) {
		return (
			<DashboardLayout {...layoutProps}>
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
					{/* Success Card */}
					<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center max-w-2xl mx-auto">
						<div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
							<CheckCircleIcon className="w-8 h-8 text-green-600" />
						</div>
						
						<h2 className="text-2xl font-heading font-bold text-gray-700 mb-4">
							{certificateData?.statusCode === "AP111" ? "Certificate Ready!" : "Certificate Request Successful!"}
						</h2>
						
						<p className="text-gray-600 mb-6 max-w-md mx-auto">
							{certificateData?.statusCode === "AP111" 
								? "You already have a valid certificate. You can proceed directly to document signing."
								: "Your digital certificate has been successfully requested. You can now proceed to document signing."
							}
						</p>

													{/* Certificate Details */}
							{certificateData && (
								<div className="bg-gray-50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
									<h3 className="font-semibold text-gray-700 mb-2">Certificate Details:</h3>
									<div className="space-y-1 text-sm text-gray-600">
										<div>Status: <span className="font-medium text-green-600">{certificateData.statusMsg || 'Success'}</span></div>
										{certificateData.certSerialNo && (
											<div>Serial No: <span className="font-mono">{certificateData.certSerialNo}</span></div>
										)}
										{certificateData.certRequestID && (
											<div>Request ID: <span className="font-mono">{certificateData.certRequestID}</span></div>
										)}
										{certificateData.certValidFrom && (
											<div>Valid From: {certificateData.certValidFrom}</div>
										)}
										{certificateData.certValidTo && (
											<div>Valid To: {certificateData.certValidTo}</div>
										)}
										{certificateData.certRequestStatus && (
											<div>Request Status: <span className="font-medium">{certificateData.certRequestStatus}</span></div>
										)}
									</div>
								</div>
							)}

						{/* Action Buttons */}
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<button
								onClick={async () => {
									try {
										// First, try to get existing signing URL
										const signingResponse = await fetchWithTokenRefresh<{
											success: boolean;
											data?: { signingUrl: string; };
										}>(`/api/loan-applications/${params.id}/signing-url`);

										if (signingResponse?.success && signingResponse?.data?.signingUrl) {
											window.location.href = signingResponse.data.signingUrl;
											return;
										}

										// If no existing URL, initiate new signing
										const response = await fetchWithTokenRefresh<{
											success: boolean;
											data?: { signUrl: string; };
										}>('/api/docuseal/initiate-application-signing', {
											method: 'POST',
											headers: { 'Content-Type': 'application/json' },
											body: JSON.stringify({ applicationId: params.id }),
										});

										if (response?.success && response?.data?.signUrl) {
											window.location.href = response.data.signUrl;
										} else {
											throw new Error('Failed to initiate document signing');
										}
									} catch (error) {
										console.error('Error initiating signing:', error);
										alert('Failed to initiate document signing. Please try again.');
									}
								}}
								className="bg-purple-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
							>
								Proceed to Document Signing
							</button>
							
							<button
								onClick={() => router.push("/dashboard/loans")}
								className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
							>
								Back to Applications
							</button>
						</div>
					</div>
				</div>
			</DashboardLayout>
		);
	}

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
						Back to KYC Verification
					</button>
				</div>

				{/* OTP Verification Content */}
				<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
					<div className="mb-6">
						<h1 className="text-3xl font-heading font-bold text-gray-700">
							OTP Verification
						</h1>
						<p className="text-gray-600 mt-2">
							We'll send a verification code to your email address to confirm your identity.
						</p>
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
								<div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center">
									<CheckCircleIcon className="w-4 h-4" />
								</div>
								<span className="ml-2 text-green-600 font-medium">KYC Verification</span>
							</div>
							<div className="flex-1 h-px bg-green-300 mx-4"></div>
							<div className="flex items-center">
								<div className="w-8 h-8 bg-purple-primary text-white rounded-full flex items-center justify-center">
									<span className="text-xs font-bold">3</span>
								</div>
								<span className="ml-2 text-purple-primary font-medium">Certificate Request</span>
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

					{/* Email Section */}
					<div className="space-y-6">
						<div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
							<div className="flex items-start space-x-4">
								<div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
									<EnvelopeIcon className="w-6 h-6 text-blue-600" />
								</div>
								<div className="flex-1">
									<h3 className="text-lg font-heading font-bold text-blue-800 mb-2">
										Email Verification
									</h3>
									<p className="text-blue-700 font-body mb-4">
										We'll send a 6-digit verification code to your confirmed email address.
									</p>
									
									{/* Email Field - Read Only */}
									<div className="space-y-3">
										<label className="block text-sm font-medium text-blue-700 font-body">
											Email Address
										</label>
										<div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
											<span className="text-blue-800 font-body text-lg">{email || "No email address"}</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* OTP Section */}
						{!otpSent ? (
							<div className="text-center py-8">
								<button
									onClick={handleSendOTP}
									disabled={sendingOtp || !email}
									className="inline-flex items-center px-8 py-4 bg-purple-primary text-white rounded-xl hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{sendingOtp ? (
										<>
											<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
											Sending OTP...
										</>
									) : (
										<>
											<EnvelopeIcon className="w-6 h-6 mr-3" />
											Send Verification Code
										</>
									)}
								</button>
								{!email && (
									<p className="mt-2 text-sm text-red-600 font-body">Please enter your email address first</p>
								)}
							</div>
						) : (
							<div className="space-y-6">
								<div className="bg-green-50 border border-green-200 rounded-xl p-6">
									<div className="flex items-start space-x-4">
										<div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
											<CheckCircleIcon className="w-5 h-5 text-green-600" />
										</div>
										<div className="flex-1">
											<h4 className="text-sm font-medium text-green-800 font-body mb-1">
												Verification Code Sent
											</h4>
											<p className="text-sm text-green-700 font-body">
												We've sent a 6-digit code to <strong>{email}</strong>
											</p>
										</div>
									</div>
								</div>

								{/* OTP Input */}
								<div className="space-y-4">
									<label className="block">
										<span className="text-sm font-medium text-gray-700 font-body mb-2 block">
											Enter 6-digit verification code
										</span>
										<input
											type="text"
											value={otp}
											onChange={(e) => handleOtpChange(e.target.value)}
											placeholder="000000"
											className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-primary focus:border-transparent text-center text-2xl font-mono tracking-widest text-gray-900 placeholder-gray-400"
											maxLength={6}
										/>
									</label>

									{/* Error Message */}
									{error && (
										<div className="bg-red-50 border border-red-200 rounded-lg p-3">
											<p className="text-sm text-red-700 font-body">{error}</p>
										</div>
									)}

									{/* Verify Button */}
									<button
										onClick={handleVerifyOTP}
										disabled={verifyingOtp || otp.length !== 6}
										className="w-full flex items-center justify-center px-6 py-3 bg-purple-primary text-white rounded-xl hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{verifyingOtp ? (
											<>
												<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
												Verifying...
											</>
										) : (
											<>
												<CheckCircleIcon className="w-5 h-5 mr-2" />
												Verify & Continue
											</>
										)}
									</button>

									{/* Resend OTP */}
									<div className="text-center">
										{countdown > 0 ? (
											<p className="text-sm text-gray-500 font-body">
												Resend code in {formatTime(countdown)}
											</p>
										) : (
											<button
												onClick={handleSendOTP}
												disabled={sendingOtp}
												className="text-sm text-purple-primary hover:text-purple-700 font-body underline disabled:opacity-50"
											>
												{sendingOtp ? "Sending..." : "Resend verification code"}
											</button>
										)}
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
}
