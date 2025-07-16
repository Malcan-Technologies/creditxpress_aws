"use client";

import { useEffect, useState } from "react";
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

	useEffect(() => {
		const fetchApplication = async () => {
			try {
				const data = await fetchWithTokenRefresh<LoanApplication>(
					`/api/loan-applications/${applicationId}`
				);

				// Check if application is in the correct status
				if (data.status !== "PENDING_ATTESTATION") {
					setError(
						`This application is not pending attestation. Current status: ${data.status}`
					);
					return;
				}

				setApplication(data);
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
		try {
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

			// Redirect to loans page with success message
			router.push(
				"/dashboard/loans?tab=applications&success=attestation_completed"
			);
		} catch (error) {
			console.error("Error completing attestation:", error);
			throw error;
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
		const amount = application.amount;
		const legalFee = application.legalFee;
		const netDisbursement = application.netDisbursement;
		const originationFee = amount - netDisbursement - legalFee;
		const applicationFee = Number(application.product.applicationFee) || 0;

		return {
			interestRate: application.interestRate,
			legalFee,
			netDisbursement,
			originationFee,
			applicationFee,
			totalFees: originationFee + legalFee + applicationFee,
		};
	};

	if (loading) {
		return (
			<DashboardLayout>
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
			<DashboardLayout>
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

				{/* Attestation Form */}
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
