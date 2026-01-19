"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PersonalInfoForm from "../../components/onboarding/PersonalInfoForm";
import AddressForm from "../../components/onboarding/AddressForm";
import EmploymentForm from "../../components/onboarding/EmploymentForm";
import BankAccountForm from "../../components/onboarding/BankAccountForm";
import { OnboardingFormData } from "@/types/onboarding";
import { toast } from "sonner";
import { checkAuth, fetchWithTokenRefresh } from "@/lib/authUtils";
import { 
	UserIcon, 
	HomeIcon, 
	BriefcaseIcon, 
	BanknotesIcon,
	XMarkIcon 
} from "@heroicons/react/24/outline";

const steps = [
	{
		title: "Personal & Emergency Contact",
		description: "Tell us about yourself",
		icon: UserIcon,
	},
	{
		title: "Residential Address",
		description: "Where do you live?",
		icon: HomeIcon,
	},
	{
		title: "Employment Details",
		description: "Your work information",
		icon: BriefcaseIcon,
	},
	{
		title: "Bank Account",
		description: "Optional banking details",
		icon: BanknotesIcon,
	},
];

// Create a client component for handling searchParams
function OnboardingPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [activeStep, setActiveStep] = useState(0);
	const [formData, setFormData] = useState<Partial<OnboardingFormData>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	
	// Certificate status state
	const [certificateStatus, setCertificateStatus] = useState<{
		loading: boolean;
		hasValidCert: boolean;
		certificateData?: any;
		nameMatches?: boolean;
		expectedName?: string;
	}>({
		loading: false,
		hasValidCert: false
	});

	const fetchCertificateStatus = async (icNumber: string, fullName: string) => {
		try {
			setCertificateStatus(prev => ({ ...prev, loading: true }));

			const certResponse = await fetchWithTokenRefresh(
				`/api/mtsa/cert-info/${icNumber}?t=${Date.now()}`,
				{
					method: "GET",
					cache: "no-store",
				}
			) as any;

			const isSuccess = certResponse.success && certResponse.data?.statusCode === "000";
			const hasValidCert = isSuccess && certResponse.data?.certStatus === "Valid";

			if (hasValidCert && certResponse.data) {
				// Extract name from certificate subject DN
				const subjectDN = certResponse.data.certSubjectDN || "";
				const expectedName = subjectDN
					.split(',')
					.find((part: string) => part.trim().startsWith('CN='))
					?.replace('CN=', '')
					?.trim() || "";

				// Compare names (normalize for comparison)
				const profileName = (fullName || "").toLowerCase().trim();
				const certName = expectedName.toLowerCase().trim();
				const nameMatches = profileName === certName;

				setCertificateStatus({
					loading: false,
					hasValidCert: true,
					certificateData: certResponse.data,
					nameMatches,
					expectedName
				});
			} else {
				setCertificateStatus({
					loading: false,
					hasValidCert: false
				});
			}
		} catch (error) {
			console.error("Error fetching certificate status:", error);
			setCertificateStatus({
				loading: false,
				hasValidCert: false
			});
		}
	};

	useEffect(() => {
		const fetchUserData = async () => {
			try {
				// Use our new checkAuth utility to verify authentication
				const isAuthenticated = await checkAuth();

				if (!isAuthenticated) {
					router.push("/login");
					return;
				}

			// Fetch user data using our fetchWithTokenRefresh utility
			const userData = await fetchWithTokenRefresh<{
				id: string;
				phoneNumber: string;
				fullName: string | null;
				email: string | null;
				dateOfBirth: string | null;
				address1: string | null;
				address2: string | null;
				city: string | null;
				state: string | null;
				postalCode: string | null;
				employmentStatus: string | null;
				employerName: string | null;
				monthlyIncome: string | null;
				serviceLength: string | null;
				emergencyContactName: string | null;
				emergencyContactPhone: string | null;
				emergencyContactRelationship: string | null;
				bankName: string | null;
				accountNumber: string | null;
				onboardingStep: number;
				isOnboardingComplete: boolean;
				icNumber: string | null;
				icType: string | null;
				educationLevel: string | null;
				race: string | null;
				gender: string | null;
				occupation: string | null;
			}>("/api/onboarding");

			// Set form data with fetched user data
			setFormData({
				fullName: userData.fullName || "",
				dateOfBirth: userData.dateOfBirth
					? new Date(userData.dateOfBirth)
					: null,
				email: userData.email || "",
				phoneNumber: userData.phoneNumber || "",
				icNumber: userData.icNumber || "",
				icType: userData.icType as 'IC' | 'PASSPORT' | null,
				educationLevel: userData.educationLevel || "",
				race: userData.race || "",
				gender: userData.gender || "",
				occupation: userData.occupation || "",
				address1: userData.address1 || "",
				address2: userData.address2 || "",
				city: userData.city || "",
				state: userData.state || "",
				postalCode: userData.postalCode || "",
				employmentStatus: userData.employmentStatus || "",
				employerName: userData.employerName || "",
				monthlyIncome: userData.monthlyIncome || "",
				serviceLength: userData.serviceLength || "",
				emergencyContactName: userData.emergencyContactName || "",
				emergencyContactPhone: userData.emergencyContactPhone || "",
				emergencyContactRelationship: userData.emergencyContactRelationship || "",
				bankName: userData.bankName || "",
				accountNumber: userData.accountNumber || "",
				onboardingStep: userData.onboardingStep || 0,
				isOnboardingComplete: userData.isOnboardingComplete || false,
			});

				// Check certificate status if user has IC number and full name
				if (userData.icNumber && userData.fullName) {
					fetchCertificateStatus(userData.icNumber, userData.fullName);
				}

				// Check if step is specified in URL query parameter
				const stepParam = searchParams.get('step');
				const urlStep = stepParam ? parseInt(stepParam, 10) : null;
				
				// Set active step based on URL parameter or onboarding progress
				if (urlStep !== null && urlStep >= 0 && urlStep < steps.length) {
					setActiveStep(urlStep);
				} else {
					setActiveStep(userData.onboardingStep || 0);
				}
			} catch (error) {
				console.error("Onboarding - Error fetching user data:", error);
				router.push("/login");
			} finally {
				setLoading(false);
			}
		};

		fetchUserData();
	}, [router, searchParams]);

	const handleNext = async (values: Partial<OnboardingFormData>) => {
		try {
			// Clear any previous errors
			setError(null);

			// Merge current form data with new values
			const updatedFormData = { ...formData, ...values };

			// Update onboarding step
			const nextStep = activeStep + 1;
			updatedFormData.onboardingStep = nextStep;

			// Submit to backend
			const response = await fetchWithTokenRefresh<{
				id: string;
				phoneNumber: string;
				fullName: string | null;
				email: string | null;
				dateOfBirth: string | null;
				address1: string | null;
				address2: string | null;
				city: string | null;
				state: string | null;
				postalCode: string | null;
				employmentStatus: string | null;
				employerName: string | null;
				monthlyIncome: string | null;
				serviceLength: string | null;
				emergencyContactName: string | null;
				emergencyContactPhone: string | null;
				emergencyContactRelationship: string | null;
				bankName: string | null;
				accountNumber: string | null;
				onboardingStep: number;
				isOnboardingComplete: boolean;
				icNumber: string | null;
				icType: string | null;
				educationLevel: string | null;
			}>("/api/onboarding", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(updatedFormData),
			});

			// Update local state
			setFormData(updatedFormData);

			// Check if onboarding is complete
			if (response.isOnboardingComplete) {
				toast.success("Profile setup complete! Welcome to your dashboard.");
				router.push("/dashboard/profile");
			} else {
				// Move to next step
				setActiveStep(nextStep);
			}
		} catch (error: any) {
			console.error("Onboarding - Error submitting form:", error);
			// Extract error message from the error object
			const errorMessage = error?.message || "Failed to update onboarding data. Please try again.";
			setError(errorMessage);
		}
	};

	// Remove skip functionality since bank account is now required

	const handleBack = () => {
		if (activeStep > 0) {
			setActiveStep(activeStep - 1);
		}
	};

	const renderStepContent = (step: number) => {
		switch (step) {
			case 0:
				return (
					<PersonalInfoForm
						initialValues={formData}
						onSubmit={handleNext}
						onBack={handleBack}
						showBackButton={false}
						isLastStep={false}
						certificateStatus={certificateStatus}
						error={error}
					/>
				);
			case 1:
				return (
					<AddressForm
						initialValues={formData}
						onSubmit={handleNext}
						onBack={handleBack}
						showBackButton={true}
						isLastStep={false}
					/>
				);
			case 2:
				return (
					<EmploymentForm
						initialValues={formData}
						onSubmit={handleNext}
						onBack={handleBack}
						showBackButton={true}
						isLastStep={false}
					/>
				);
			case 3:
				return (
					<BankAccountForm
						initialValues={formData}
						onSubmit={handleNext}
						onBack={handleBack}
						onSkip={() => {}} // Placeholder function since skip is removed
						showBackButton={true}
						isLastStep={true}
					/>
				);
			default:
				return null;
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-offwhite w-full flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-primary mx-auto mb-4"></div>
					<p className="text-gray-600 font-body">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-offwhite w-full">
			<div className="px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
				<div className="max-w-4xl mx-auto">
					{/* Header with Close Button */}
					<div className="relative text-center mb-8">
						<button
							onClick={() => router.push('/dashboard/profile')}
							className="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2"
							title="Close onboarding"
						>
							<XMarkIcon className="w-5 h-5" />
						</button>
						<h1 className="text-2xl lg:text-3xl font-heading font-bold text-gray-700 mb-2">
							Complete Your Profile
						</h1>
						<p className="text-sm lg:text-base text-gray-500 font-body">
							Help us get to know you better to provide personalized financial solutions
						</p>
					</div>

					{/* Progress Steps */}
					<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
						<div className="p-4 sm:p-6 lg:p-8">
							{/* Mobile Progress - Simplified */}
							<div className="block sm:hidden">
																	<div className="flex items-center justify-center mb-4">
										<div className="flex space-x-2">
											{steps.map((_, index) => (
												<div
													key={index}
													className={`w-2 h-2 rounded-full transition-all duration-200 ${
														index === activeStep 
															? 'bg-purple-primary w-6' 
															: index < activeStep 
															? 'bg-purple-300' 
															: 'bg-gray-200'
													}`}
												/>
											))}
										</div>
									</div>
																	<div className="text-center">
										<div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 transition-all duration-200 ${
											activeStep < steps.length 
												? 'bg-purple-primary text-white' 
												: 'bg-purple-300 text-white'
										}`}>
										{activeStep < steps.length ? (
											(() => {
												const Icon = steps[activeStep].icon;
												return <Icon className="w-5 h-5" />;
											})()
										) : (
											<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
											</svg>
										)}
									</div>
									<p className="text-base font-medium font-body text-purple-primary mb-1">
										{steps[activeStep]?.title || 'Complete'}
									</p>
									<p className="text-sm text-gray-400 font-body">
										{steps[activeStep]?.description || 'All steps completed'}
									</p>
								</div>
							</div>

							{/* Desktop Progress - Full Layout */}
							<div className="hidden sm:block">
								<div className="relative">
									{/* Connection Lines Background */}
											<div className="absolute top-5 lg:top-6 left-0 right-0 flex items-center justify-between px-5 lg:px-6">
											{steps.slice(0, -1).map((_, index) => (
												<div
													key={index}
													className={`flex-1 h-0.5 transition-all duration-200 ${
														index < activeStep ? 'bg-purple-300' : 'bg-gray-200'
													}`}
												/>
											))}
										</div>
									
									{/* Step Icons and Content */}
									<div className="relative grid grid-cols-4 gap-2 lg:gap-4">
										{steps.map((step, index) => {
											const Icon = step.icon;
											const isActive = index === activeStep;
											const isCompleted = index < activeStep;
											
											return (
												<div key={index} className="relative">
													<div className="flex flex-col items-center text-center">
																													<div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 mb-3 border-2 ${
																isActive 
																	? 'border-purple-primary bg-purple-primary text-white shadow-lg' 
																	: isCompleted 
																	? 'border-purple-300 bg-purple-300 text-white shadow-md' 
																	: 'border-gray-200 bg-white text-gray-400'
															}`}>
															{isCompleted ? (
																<svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
																</svg>
															) : (
																<Icon className="w-4 h-4 lg:w-5 lg:h-5" />
															)}
														</div>
														<div className="space-y-1">
															<p className={`text-sm font-medium font-body ${
																isActive ? 'text-purple-primary' : isCompleted ? 'text-purple-600' : 'text-gray-500'
															}`}>
																{step.title}
															</p>
															<p className="text-xs text-gray-400 font-body">
																{step.description}
															</p>
														</div>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Step Content */}
					<div>
						{renderStepContent(activeStep)}
					</div>
				</div>
			</div>
		</div>
	);
}

export default function OnboardingPage() {
	return (
		<Suspense fallback={
			<div className="min-h-screen bg-offwhite w-full flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-primary mx-auto mb-4"></div>
					<p className="text-gray-600 font-body">Loading...</p>
				</div>
			</div>
		}>
			<OnboardingPageContent />
		</Suspense>
	);
}
