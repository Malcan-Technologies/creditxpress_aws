"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import AttestationForm from "@/components/application/AttestationForm";

import { fetchWithTokenRefresh } from "@/lib/authUtils";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

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
	stampingFee?: number;
	legalFeeFixed?: number;
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

export default function AttestationPage() {
	const router = useRouter();
	const params = useParams();
	const applicationId = params.id as string;

	const [application, setApplication] = useState<LoanApplication | null>(
		null
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [completing, setCompleting] = useState(false);
	const [userName, setUserName] = useState("");

	const layoutProps = useMemo(
		() => ({
			title: "Application Attestation",
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
				console.warn("Failed to load user profile for attestation page", err);
			}
		};

		loadUserName();
	}, []);

	useEffect(() => {
		const fetchApplication = async () => {
			try {
				const data = await fetchWithTokenRefresh<LoanApplication>(
					`/api/loan-applications/${applicationId}`
				);

				// Check if application is in the correct status for attestation
				if (data.status === "PENDING_SIGNING_OTP") {
					// Redirect to OTP verification page if attestation is already complete
					router.push(`/dashboard/applications/${applicationId}/otp-verification`);
					return;
				} else if (data.status !== "PENDING_ATTESTATION") {
					setError(
						`This application is not pending attestation. Current status: ${data.status}`
					);
					return;
				}

				setApplication(data);

				const fullName = data.user?.fullName?.trim();
				if (fullName) {
					setUserName((prev) => prev || fullName.split(" ")[0]);
				}
			} catch (err) {
				setError(
					err instanceof Error
						? err.message
						: "Failed to load application"
				);
			} finally {
				setLoading(false);
			}
		};

		if (applicationId) {
			fetchApplication();
		}
	}, [applicationId]);

	const handleAttestationComplete = async () => {
		setCompleting(true);
		try {
			// Complete the attestation first
			await fetchWithTokenRefresh(
				`${
					process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001"
				}/api/loan-applications/${applicationId}/complete-attestation`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						attestationType: "IMMEDIATE",
						attestationVideoWatched: true,
						attestationTermsAccepted: true,
					}),
				}
			);

			// After successful attestation, redirect to certificate check page
			router.push(`/dashboard/applications/${applicationId}/cert-check`);
		} catch (error) {
			console.error("Error completing attestation:", error);
			throw error;
		} finally {
			setCompleting(false);
		}
	};



	const handleBack = () => {
		router.push("/dashboard/loans?tab=applications");
	};

	const handleLiveCallSelect = () => {
		// Navigate back to loans page after live call is scheduled
		router.push("/dashboard/loans?tab=applications");
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
		});
	};

	const calculateFees = (application: LoanApplication) => {
		// Use the fees stored in the database instead of calculating them
		const netDisbursement = application.netDisbursement;
		
		// Check if new fee structure is used - only if values are actually present (not null/undefined)
		const hasStampingFee = application.stampingFee !== undefined && application.stampingFee !== null;
		const hasLegalFeeFixed = application.legalFeeFixed !== undefined && application.legalFeeFixed !== null;
		
		const stampingFee = hasStampingFee ? application.stampingFee! : 0;
		const legalFeeFixed = hasLegalFeeFixed ? application.legalFeeFixed! : 0;
		
		// Old fees for backward compatibility
		const legalFee = application.legalFee || 0;
		const applicationFee = application.applicationFee || 0;
		const originationFee = application.originationFee || 0;
		
		// Determine which fee structure is being used - check if new fees actually exist
		const isNewFeeStructure = hasStampingFee || hasLegalFeeFixed;

		return {
			interestRate: application.interestRate,
			legalFee: isNewFeeStructure ? 0 : legalFee,
			netDisbursement,
			originationFee: isNewFeeStructure ? 0 : originationFee,
			applicationFee: isNewFeeStructure ? 0 : applicationFee,
			stampingFee,
			legalFeeFixed,
			totalFees: isNewFeeStructure 
				? (stampingFee + legalFeeFixed) 
				: (originationFee + legalFee + applicationFee),
			isNewFeeStructure,
		};
	};

	if (loading) {
		return (
			<DashboardLayout {...layoutProps}>
				<div className="flex justify-center items-center min-h-[400px]">
					<div className="flex flex-col items-center space-y-4">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary"></div>
						<p className="text-gray-700 font-body">
							Loading attestation details...
						</p>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	if (error || !application) {
		return (
			<DashboardLayout {...layoutProps}>
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
					<div className="mb-6">
						<button
							onClick={handleBack}
							className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors font-body"
						>
							<ArrowLeftIcon className="h-4 w-4 mr-2" />
							Back to Applications
						</button>
					</div>

					<div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
						<p className="text-red-600 font-body">
							{error || "Application not found"}
						</p>
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
						Back to Applications
					</button>
				</div>

				{/* Attestation Content */}
				<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
					<AttestationForm
						onSubmit={handleAttestationComplete}
						onBack={handleBack}
						onLiveCallSelect={handleLiveCallSelect}
						application={application}
						calculateFees={calculateFees}
						formatCurrency={formatCurrency}
					/>
				</div>
			</div>
		</DashboardLayout>
	);
}
