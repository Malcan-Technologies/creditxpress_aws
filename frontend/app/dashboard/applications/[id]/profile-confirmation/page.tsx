"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { fetchWithTokenRefresh } from "@/lib/authUtils";
import { ArrowLeftIcon, CheckCircleIcon, PencilIcon, UserCircleIcon, IdentificationIcon, EnvelopeIcon, PhoneIcon } from "@heroicons/react/24/outline";

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
		dateOfBirth?: string;
	};
}

interface UserProfile {
	id: string;
	phoneNumber: string;
	fullName: string | null;
	email: string | null;
	dateOfBirth: string | null;
	address1: string | null;
	address2: string | null;
	city: string | null;
	state: string | null;
	zipCode: string | null;
	icNumber?: string | null;
	icType?: string | null;
}

// Helper component for rendering field display or input
const ProfileField = ({ 
	label, 
	value, 
	field, 
	icon, 
	type = "text", 
	multiline = false,
	isEditing,
	editedProfile,
	validationErrors,
	handleInputChange
}: { 
	label: string; 
	value: string | null; 
	field: keyof UserProfile; 
	icon: React.ReactNode; 
	type?: string; 
	multiline?: boolean;
	isEditing: boolean;
	editedProfile: UserProfile | null;
	validationErrors: {[key: string]: string};
	handleInputChange: (field: keyof UserProfile, value: string) => void;
}) => {
	const currentValue = isEditing ? (editedProfile?.[field] as string || "") : (value || "");
	const hasError = validationErrors[field as string];

	return (
		<div className={`bg-gray-50 p-4 rounded-lg border border-gray-200 ${hasError ? 'border-red-300 bg-red-50' : ''}`}>
			<div className="flex items-start space-x-3">
				<div className="mt-0.5">{icon}</div>
				<div className="min-w-0 flex-1">
					<label className="block text-sm font-medium text-gray-500 font-body mb-1">
						{label}
					</label>
					{isEditing ? (
						<div>
							{multiline ? (
								<textarea
									value={currentValue}
									onChange={(e) => handleInputChange(field, e.target.value)}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-purple-primary font-body text-gray-900"
									rows={2}
								/>
							) : (
								<input
									type={type}
									value={currentValue}
									onChange={(e) => handleInputChange(field, e.target.value)}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-purple-primary font-body text-gray-900"
								/>
							)}
							{hasError && (
								<p className="mt-1 text-sm text-red-600 font-body">{hasError}</p>
							)}
						</div>
					) : (
						<p className="mt-1 text-base text-gray-700 font-body">
							{value || "Not provided"}
						</p>
					)}
				</div>
			</div>
		</div>
	);
};

export default function ProfileConfirmationPage() {
	const router = useRouter();
	const params = useParams();
	const [application, setApplication] = useState<LoanApplication | null>(null);
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null);
	const [saving, setSaving] = useState(false);
	const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
	const [userName, setUserName] = useState("");

	const layoutProps = useMemo(
		() => ({
			title: "Profile Confirmation",
			userName: userName || "User",
		}),
		[userName]
	);

	useEffect(() => {
		const fetchData = async () => {
			try {
				// Fetch application data
				const appData = await fetchWithTokenRefresh<LoanApplication>(
					`/api/loan-applications/${params.id}`
				);
				console.log("Profile Confirmation Page - Application data:", appData);
				setApplication(appData);

				// Fetch profile data
				const profileData = await fetchWithTokenRefresh<UserProfile>(
					`/api/users/me?t=${Date.now()}`
				);
				setProfile(profileData);

				const nameSource =
					profileData?.fullName?.trim() ||
					appData?.user?.fullName?.trim();
				if (nameSource) {
					setUserName(nameSource.split(" ")[0]);
				}
			} catch (err) {
				console.error("Profile Confirmation Page - Error fetching data:", err);
				setError(err instanceof Error ? err.message : "An error occurred");
			} finally {
				setLoading(false);
			}
		};

		if (params.id) {
			fetchData();
		}
	}, [params.id]);

	const handleConfirmProfile = async () => {
		try {
			setConfirming(true);
			setError(null);

			// Step 1: Check if user already has a valid certificate
			const userId = profile?.icNumber || application?.user?.icNumber || application?.user?.idNumber;
			if (!userId) {
				throw new Error("User ID (IC Number) is required");
			}

			console.log("Checking certificate status for user:", userId);
			
			const certCheckResponse = await fetchWithTokenRefresh(
				`/api/mtsa/cert-info/${userId}`,
				{
					method: "GET",
				}
			) as any;

			console.log("Certificate check response:", certCheckResponse);

			// Step 2: Determine next step based on certificate status
			if (certCheckResponse.success && certCheckResponse.data?.certStatus === "ACTIVE") {
				// User has valid certificate - skip OTP flow and go directly to signing
				console.log("User has valid certificate, proceeding directly to document signing");
				
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

				router.push(`/dashboard/applications/${params.id}/signing`);
			} else {
				// User needs new certificate - proceed to KYC verification first
				console.log("User needs new certificate, proceeding to KYC verification");
				
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

				router.push(`/dashboard/applications/${params.id}/kyc-verification`);
			}
		} catch (err) {
			console.error("Profile confirmation error:", err);
			setError(err instanceof Error ? err.message : "Failed to confirm profile and check certificate status");
		} finally {
			setConfirming(false);
		}
	};

	const handleEditProfile = () => {
		if (profile) {
			setEditedProfile({ ...profile });
			setIsEditing(true);
			setValidationErrors({});
		}
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
		setEditedProfile(null);
		setValidationErrors({});
	};

	const handleInputChange = (field: keyof UserProfile, value: string) => {
		if (editedProfile) {
			setEditedProfile({
				...editedProfile,
				[field]: value
			});
			// Clear validation error for this field
			if (validationErrors[field]) {
				setValidationErrors({
					...validationErrors,
					[field]: ""
				});
			}
		}
	};

	const validateProfileData = (data: UserProfile): {[key: string]: string} => {
		const errors: {[key: string]: string} = {};

		if (!data.fullName || data.fullName.trim().length < 2) {
			errors.fullName = "Full name must be at least 2 characters";
		}

		if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
			errors.email = "Valid email address is required";
		}

		if (!data.icNumber || data.icNumber.replace(/\D/g, '').length !== 12) {
			errors.icNumber = "IC number must be 12 digits";
		}

		return errors;
	};

	const handleSaveProfile = async () => {
		if (!editedProfile) return;

		// Validate the data
		const errors = validateProfileData(editedProfile);
		if (Object.keys(errors).length > 0) {
			setValidationErrors(errors);
			return;
		}

		try {
			setSaving(true);
			setError(null);

			// Update the profile using the same PUT endpoint as the profile page
			const response = await fetchWithTokenRefresh<UserProfile>(
				"/api/users/me",
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						fullName: editedProfile.fullName,
						email: editedProfile.email,
						icNumber: editedProfile.icNumber,
						icType: editedProfile.icType || "IC",
					}),
				}
			);

			// Update the local state with the response
			setProfile(response);
			setIsEditing(false);
			setEditedProfile(null);
			setValidationErrors({});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to update profile");
		} finally {
			setSaving(false);
		}
	};

	const handleBack = () => {
		router.push("/dashboard/loans");
	};

	const handleBackToKyc = async () => {
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

	if (error || !application || !profile) {
		return (
			<DashboardLayout {...layoutProps}>
				<div className="text-center py-12">
					<h2 className="text-2xl font-heading font-bold text-gray-700 mb-4">
						Error Loading Data
					</h2>
					<p className="text-gray-600 mb-6">{error || "Data not found"}</p>
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

	// Only show profile confirmation for applications in PENDING_PROFILE_CONFIRMATION status
	if (application.status !== "PENDING_PROFILE_CONFIRMATION") {
		return (
			<DashboardLayout {...layoutProps}>
				<div className="text-center py-12">
					<h2 className="text-2xl font-heading font-bold text-gray-700 mb-4">
						Profile Confirmation Not Required
					</h2>
					<p className="text-gray-600 mb-6">
						This application is not in the correct status for profile confirmation.
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
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-MY", {
			day: "numeric",
			month: "long",
			year: "numeric",
		});
	};



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

				{/* Profile Confirmation Content */}
				<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
					<div className="mb-6">
						<h1 className="text-3xl font-heading font-bold text-gray-700">
							Confirm Your Personal Details
						</h1>
						<p className="text-gray-600 mt-2">
							Please review and confirm your personal details match your IC to ensure smooth document signing for your loan application of{" "}
							<span className="font-semibold text-purple-primary">
								{formatCurrency(application.amount)}
							</span>.
						</p>
					</div>

					{/* Progress Steps */}
					<div className="mb-8">
						<div className="flex items-center justify-between text-sm">
							<div className="flex items-center">
								<div className="w-8 h-8 bg-purple-primary text-white rounded-full flex items-center justify-center">
									<span className="text-xs font-bold">1</span>
								</div>
								<span className="ml-2 text-purple-primary font-medium">Profile Confirmation</span>
							</div>
							<div className="flex-1 h-px bg-gray-300 mx-4"></div>
							<div className="flex items-center">
								<div className="w-8 h-8 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center">
									<span className="text-xs font-bold">2</span>
								</div>
								<span className="ml-2 text-gray-500 font-medium">KYC Verification</span>
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

					{/* Always show profile details for confirmation */}
					{false ? (
						// Profile incomplete - show warning
						<div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
							<div className="flex items-start space-x-4">
								<div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
									<svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 18.5c-.77.833.192 2.5 1.732 2.5z" />
									</svg>
								</div>
								<div className="flex-1">
									<h3 className="text-lg font-heading font-bold text-amber-800 mb-2">
										Profile Incomplete
									</h3>
									<p className="text-amber-700 font-body mb-4">
										Your profile is missing some required information. Please complete your profile before proceeding with document signing.
									</p>
									<button
										onClick={handleEditProfile}
										className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-200 text-sm font-medium"
									>
										<PencilIcon className="w-4 h-4 mr-2" />
										Complete Profile
									</button>
								</div>
							</div>
						</div>
					) : (
						// Profile complete - show details for confirmation
						<div className="space-y-6">
							<div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
								<div className="flex items-start space-x-4">
									<div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
										<CheckCircleIcon className="w-6 h-6 text-amber-600" />
									</div>
									<div className="flex-1">
										<h3 className="text-lg font-heading font-bold text-amber-800 mb-2">
											Check Your Details
										</h3>
										<p className="text-amber-700 font-body">
										Please ensure all information above matches your IC exactly. Any discrepancies may cause delays in document signing and loan processing.
										</p>
									</div>
								</div>
							</div>

							{/* Profile Details Grid */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								{/* Personal Information */}
								<div className="space-y-4">
									<h4 className="text-lg font-heading font-bold text-gray-700 border-b border-gray-200 pb-2">
										Personal Information
									</h4>
									
									<ProfileField
										label="Full Name"
										value={profile.fullName}
										field="fullName"
										icon={<UserCircleIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />}
										isEditing={isEditing}
										editedProfile={editedProfile}
										validationErrors={validationErrors}
										handleInputChange={handleInputChange}
									/>

									<ProfileField
										label="IC Number"
										value={profile.icNumber ?? null}
										field="icNumber"
										icon={<IdentificationIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />}
										isEditing={isEditing}
										editedProfile={editedProfile}
										validationErrors={validationErrors}
										handleInputChange={handleInputChange}
									/>
								</div>

								{/* Contact Information */}
								<div className="space-y-4">
									<h4 className="text-lg font-heading font-bold text-gray-700 border-b border-gray-200 pb-2">
										Contact Information
									</h4>

									<ProfileField
										label="Email Address"
										value={profile.email}
										field="email"
										type="email"
										icon={<EnvelopeIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />}
										isEditing={isEditing}
										editedProfile={editedProfile}
										validationErrors={validationErrors}
										handleInputChange={handleInputChange}
									/>

									<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
										<div className="flex items-center space-x-3">
											<PhoneIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
											<div className="min-w-0 flex-1">
												<label className="block text-sm font-medium text-gray-500 font-body">
													Phone Number
												</label>
												<p className="mt-1 text-base text-gray-700 font-body">
													{profile.phoneNumber}
												</p>
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* Important Notice */}
							{/* <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
								<div className="flex items-start space-x-4">
									<div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
										<svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
									</div>
									<div>
										<h4 className="text-sm font-medium text-blue-800 font-body mb-1">
											Important: Verify Your Information
										</h4>
										<p className="text-sm text-blue-700 font-body">
											Please ensure all information above matches your IC exactly. Any discrepancies may cause delays in document signing and loan processing.
										</p>
									</div>
								</div>
							</div> */}

							{/* Action Buttons */}
							<div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-100">
								{isEditing ? (
									<>
										<button
											onClick={handleSaveProfile}
											disabled={saving}
											className="flex-1 flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
										>
											{saving ? (
												<>
													<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
													Saving...
												</>
											) : (
												<>
													<CheckCircleIcon className="w-5 h-5 mr-2" />
													Save Changes
												</>
											)}
										</button>
										<button
											onClick={handleCancelEdit}
											disabled={saving}
											className="flex-1 flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
										>
											<svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
											</svg>
											Cancel
										</button>
									</>
								) : (
									<>
										<button
											onClick={handleConfirmProfile}
											disabled={confirming}
											className="flex-1 flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
										>
											{confirming ? (
												<>
													<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
													Confirming...
												</>
											) : (
												<>
													<CheckCircleIcon className="w-5 h-5 mr-2" />
													Confirm & Continue
												</>
											)}
										</button>
										<button
											onClick={handleEditProfile}
											className="flex-1 flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200 text-base font-medium"
										>
											<PencilIcon className="w-5 h-5 mr-2" />
											Edit Profile
										</button>
									</>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</DashboardLayout>
	);
}
