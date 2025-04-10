"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Stepper,
	Step,
	StepLabel,
	Box,
	Paper,
	Typography,
} from "@mui/material";
import PersonalInfoForm from "../../components/onboarding/PersonalInfoForm";
import AddressForm from "../../components/onboarding/AddressForm";
import EmploymentForm from "../../components/onboarding/EmploymentForm";
import BankAccountForm from "../../components/onboarding/BankAccountForm";
import { OnboardingFormData } from "@/types/onboarding";
import Cookies from "js-cookie";
import { checkAuth, fetchWithTokenRefresh } from "@/lib/authUtils";

const steps = [
	"Personal Information",
	"Residential Address",
	"Employment Details",
	"Bank Account (optional)",
];

// Create a client component for handling searchParams
function OnboardingPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [activeStep, setActiveStep] = useState(0);
	const [formData, setFormData] = useState<Partial<OnboardingFormData>>({});

	useEffect(() => {
		const fetchUserData = async () => {
			try {
				// Use our new checkAuth utility to verify authentication
				const isAuthenticated = await checkAuth();

				if (!isAuthenticated) {
					console.log(
						"Onboarding - Auth check failed, redirecting to login"
					);
					router.push("/login");
					return;
				}

				// Fetch user data using our fetchWithTokenRefresh utility
				const userData = await fetchWithTokenRefresh<{
					isOnboardingComplete?: boolean;
					onboardingStep?: number;
				}>("/api/users/me");

				console.log("Onboarding - Auth check data:", userData);

				if (userData?.isOnboardingComplete) {
					console.log(
						"Onboarding - User completed onboarding, redirecting to dashboard"
					);
					router.push("/dashboard");
					return;
				}

				// Only fetch onboarding data if auth check passes
				try {
					const onboardingData = await fetchWithTokenRefresh<
						Partial<OnboardingFormData>
					>("/api/onboarding");
					setFormData(onboardingData);
					if (onboardingData.onboardingStep) {
						setActiveStep(onboardingData.onboardingStep);
					}
				} catch (error) {
					console.error("Error fetching onboarding data:", error);
				}
			} catch (error) {
				console.error("Error fetching user data:", error);
				router.push("/login");
			}
		};

		fetchUserData();
	}, [router]);

	useEffect(() => {
		const step = searchParams.get("step");
		if (step) {
			setActiveStep(parseInt(step) - 1);
		}
	}, [searchParams]);

	const handleNext = async (values: Partial<OnboardingFormData>) => {
		const newFormData = { ...formData, ...values };
		setFormData(newFormData);

		try {
			// Get token from localStorage or cookies
			let token = localStorage.getItem("token");
			if (!token) {
				const cookieToken = Cookies.get("token");
				if (cookieToken) {
					token = cookieToken;
				}
			}

			if (!token) {
				console.error("No token found");
				return;
			}

			// Calculate the next step
			const nextStep = activeStep + 1;
			const isLastStep = nextStep === steps.length;
			const isEmploymentStep = activeStep === 3; // Index 3 is Employment Details

			// Update the onboarding step and completion status
			const response = await fetch(`/api/onboarding`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					...newFormData,
					onboardingStep: nextStep,
					isOnboardingComplete: isEmploymentStep || isLastStep,
				}),
			});

			if (!response.ok) throw new Error("Failed to save user data");

			// If we've completed employment details or it's the last step, redirect to dashboard
			if (isEmploymentStep || isLastStep) {
				console.log("Onboarding completed, redirecting to dashboard");
				router.push("/dashboard");
			} else {
				// Otherwise, go to the next step
				setActiveStep(nextStep);
				const params = new URLSearchParams(searchParams.toString());
				params.set("step", (nextStep + 1).toString());
				router.push(`/onboarding?${params.toString()}`);
			}
		} catch (error) {
			console.error("Error saving user data:", error);
		}
	};

	const handleSkip = async () => {
		try {
			// Get token from localStorage or cookies
			let token = localStorage.getItem("token");
			if (!token) {
				const cookieToken = Cookies.get("token");
				if (cookieToken) {
					token = cookieToken;
				}
			}

			if (!token) {
				console.error("No token found");
				return;
			}

			const response = await fetch(`/api/onboarding`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					isOnboardingComplete: true,
					onboardingStep: steps.length - 1,
				}),
			});

			if (!response.ok) throw new Error("Failed to skip onboarding");
			console.log("Onboarding skipped, redirecting to dashboard");
			router.push("/dashboard");
		} catch (error) {
			console.error("Error skipping onboarding:", error);
		}
	};

	const handleBack = () => {
		const prevStep = activeStep - 1;
		setActiveStep(prevStep);
		const params = new URLSearchParams(searchParams.toString());
		params.set("step", (prevStep + 1).toString());
		router.push(`/onboarding?${params.toString()}`);
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
						onSkip={handleSkip}
						showBackButton={true}
						isLastStep={true}
					/>
				);
			default:
				return null;
		}
	};

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-2xl w-full">
				<Paper className="p-8">
					<Box className="mb-12">
						<Typography
							variant="h4"
							component="h1"
							className="text-center mb-8 text-indigo-900"
						>
							Complete Your Profile
						</Typography>
						<Stepper
							activeStep={activeStep}
							alternativeLabel
							className="[&_.MuiStepLabel-root]:text-indigo-600 [&_.MuiStepIcon-root]:text-indigo-200 [&_.MuiStepIcon-root.Mui-active]:text-indigo-600 [&_.MuiStepIcon-root.Mui-completed]:text-indigo-600"
						>
							{steps.map((label) => (
								<Step key={label}>
									<StepLabel>{label}</StepLabel>
								</Step>
							))}
						</Stepper>
					</Box>

					<Box className="mt-8">{renderStepContent(activeStep)}</Box>
				</Paper>
			</div>
		</div>
	);
}

export default function OnboardingPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<OnboardingPageContent />
		</Suspense>
	);
}
