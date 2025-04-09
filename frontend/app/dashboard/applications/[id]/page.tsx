"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Cookies from "js-cookie";
import { Box, Button, Typography, Dialog, IconButton } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import DocumentUploadForm from "@/components/application/DocumentUploadForm";

interface LoanApplication {
	id: string;
	status: string;
	appStep: number;
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
		requiredDocuments?: string[];
	};
	documents?: Array<{
		id: string;
		name: string;
		type: string;
		status: string;
		fileUrl: string;
	}>;
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

export default function ApplicationDetails({
	params,
}: {
	params: { id: string };
}) {
	const router = useRouter();
	const [application, setApplication] = useState<LoanApplication | null>(
		null
	);
	const [loading, setLoading] = useState(true);
	const [userName, setUserName] = useState<string>("");
	const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const token =
					localStorage.getItem("token") || Cookies.get("token");
				if (!token) {
					router.push("/login");
					return;
				}

				// Fetch user data
				const userResponse = await fetch("/api/users/me", {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				if (!userResponse.ok) {
					router.push("/login");
					return;
				}

				const userData = await userResponse.json();
				setUserName(
					userData.firstName ||
						userData.fullName?.split(" ")[0] ||
						"Guest"
				);

				// Fetch application details
				const response = await fetch(
					`/api/loan-applications/${params.id}`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
						},
					}
				);

				if (!response.ok) {
					throw new Error("Failed to fetch application");
				}

				const data = await response.json();
				setApplication(data);
			} catch (error) {
				console.error("Error:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [router, params.id]);

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

	const getStatusColor = (status: string) => {
		switch (status) {
			case "INCOMPLETE":
				return "bg-yellow-100 text-yellow-800";
			case "PENDING_APP_FEE":
			case "PENDING_KYC":
			case "PENDING_APPROVAL":
				return "bg-blue-100 text-blue-800";
			case "APPROVED":
				return "bg-green-100 text-green-800";
			case "REJECTED":
				return "bg-red-100 text-red-800";
			case "DISBURSED":
				return "bg-purple-100 text-purple-800";
			case "WITHDRAWN":
				return "bg-gray-100 text-gray-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const getStatusLabel = (status: string) => {
		switch (status) {
			case "INCOMPLETE":
				return "Incomplete";
			case "PENDING_APP_FEE":
				return "Pending Fee";
			case "PENDING_KYC":
				return "Pending KYC";
			case "PENDING_APPROVAL":
				return "Under Review";
			case "APPROVED":
				return "Approved";
			case "REJECTED":
				return "Rejected";
			case "DISBURSED":
				return "Disbursed";
			case "WITHDRAWN":
				return "Withdrawn";
			default:
				return status;
		}
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

	const handleDocumentUpdate = async () => {
		try {
			const token = localStorage.getItem("token") || Cookies.get("token");
			if (!token || !application) return;

			// Fetch updated application details
			const response = await fetch(
				`/api/loan-applications/${params.id}`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);

			if (!response.ok) {
				throw new Error("Failed to fetch updated application");
			}

			const data = await response.json();
			setApplication(data);
		} catch (error) {
			console.error("Error updating documents:", error);
		}
	};

	return (
		<DashboardLayout userName={userName}>
			<div className="bg-white rounded-lg shadow-sm border border-gray-200">
				{loading ? (
					<div className="flex justify-center items-center p-8">
						<div
							className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent align-[-0.125em]"
							role="status"
						>
							<span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
								Loading...
							</span>
						</div>
					</div>
				) : application ? (
					<div className="space-y-6 p-6">
						<div className="flex items-center justify-between border-b border-gray-200 pb-4">
							<div>
								<Button
									startIcon={<ArrowBackIcon />}
									onClick={() => router.back()}
									className="mb-4"
								>
									Back to Applications
								</Button>
								<h1 className="text-2xl font-semibold text-gray-900">
									Loan Application Details
								</h1>
							</div>
							<span
								className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(
									application.status
								)}`}
							>
								{getStatusLabel(application.status)}
							</span>
						</div>

						{/* Loan Details Section */}
						<div className="bg-white rounded-lg border border-gray-200 p-6">
							<h2 className="text-lg font-medium text-gray-900 mb-6">
								Loan Details
							</h2>
							<div className="space-y-6">
								<div className="space-y-4">
									<div className="flex justify-between">
										<span className="text-gray-600">
											Product
										</span>
										<span className="text-gray-900 font-medium">
											{application.product.name}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600">
											Loan Amount
										</span>
										<span className="text-gray-900 font-medium">
											{formatCurrency(application.amount)}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600">
											Loan Purpose
										</span>
										<span className="text-gray-900 font-medium">
											{application.purpose}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600">
											Loan Term
										</span>
										<span className="text-gray-900 font-medium">
											{application.term} months
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600">
											Interest Rate
										</span>
										<span className="text-gray-900 font-medium">
											{application.product.interestRate}%
											monthly
										</span>
									</div>
								</div>

								{/* Fees Section */}
								{application && (
									<>
										<div className="pt-4 border-t border-gray-200">
											<div className="space-y-4">
												<div className="flex justify-between">
													<span className="text-gray-600">
														Origination Fee (
														{
															application.product
																.originationFee
														}
														%)
													</span>
													<span className="text-red-600">
														(
														{formatCurrency(
															calculateFees(
																application
															).originationFee
														)}
														)
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-gray-600">
														Legal Fee (
														{
															application.product
																.legalFee
														}
														%)
													</span>
													<span className="text-red-600">
														(
														{formatCurrency(
															calculateFees(
																application
															).legalFee
														)}
														)
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-gray-600">
														Application Fee (paid
														upfront)
													</span>
													<span className="text-red-600">
														(
														{formatCurrency(
															calculateFees(
																application
															).applicationFee
														)}
														)
													</span>
												</div>
											</div>
										</div>

										<div className="pt-4 border-t border-gray-200">
											<div className="space-y-4">
												<div className="flex justify-between">
													<span className="text-gray-900 font-bold">
														Net Loan Disbursement
													</span>
													<span className="text-green-600 font-bold">
														{formatCurrency(
															calculateFees(
																application
															).netDisbursement
														)}
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-gray-900 font-bold">
														Monthly Repayment
													</span>
													<span className="text-red-600 font-bold">
														(
														{formatCurrency(
															application.monthlyRepayment
														)}
														)
													</span>
												</div>
											</div>
										</div>
									</>
								)}
							</div>
						</div>

						{/* Personal Information Section */}
						{application.user && (
							<div className="bg-white rounded-lg border border-gray-200 p-6">
								<h2 className="text-lg font-medium text-gray-900 mb-6">
									Personal Information
								</h2>
								<div className="space-y-4">
									<div className="flex justify-between">
										<span className="text-gray-600">
											Full Name
										</span>
										<span className="text-gray-900 font-medium">
											{application.user.fullName}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600">
											Email
										</span>
										<span className="text-gray-900 font-medium">
											{application.user.email}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600">
											Phone Number
										</span>
										<span className="text-gray-900 font-medium">
											{application.user.phoneNumber}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600">
											Employment Status
										</span>
										<span className="text-gray-900 font-medium">
											{application.user.employmentStatus}
										</span>
									</div>
									{application.user.employerName && (
										<div className="flex justify-between">
											<span className="text-gray-600">
												Employer
											</span>
											<span className="text-gray-900 font-medium">
												{application.user.employerName}
											</span>
										</div>
									)}
									{application.user.monthlyIncome && (
										<div className="flex justify-between">
											<span className="text-gray-600">
												Monthly Income
											</span>
											<span className="text-gray-900 font-medium">
												{formatCurrency(
													Number(
														application.user
															.monthlyIncome
													)
												)}
											</span>
										</div>
									)}
									<div className="pt-4 border-t border-gray-200">
										<span className="text-gray-900 font-medium block mb-2">
											Address
										</span>
										<span className="text-gray-600 block">
											{application.user.address1}
											{application.user.address2 && (
												<>
													<br />
													{application.user.address2}
												</>
											)}
											<br />
											{application.user.city},{" "}
											{application.user.state}{" "}
											{application.user.postalCode}
										</span>
									</div>
								</div>
							</div>
						)}

						{/* Documents Section */}
						<div className="bg-white rounded-lg border border-gray-200 p-6">
							<div className="flex justify-between items-center mb-4">
								<h2 className="text-lg font-medium text-gray-900">
									Required Documents
								</h2>
								<Button
									variant="outlined"
									startIcon={<EditIcon />}
									onClick={() =>
										setIsDocumentDialogOpen(true)
									}
									className="text-indigo-600 border-indigo-600 hover:bg-indigo-50"
									disabled={
										application.status === "WITHDRAWN"
									}
								>
									Edit Documents
								</Button>
							</div>
							<div className="divide-y divide-gray-200">
								{application.product.requiredDocuments &&
								application.product.requiredDocuments.length >
									0 ? (
									application.product.requiredDocuments.map(
										(docType) => {
											const uploadedDocs =
												application.documents?.filter(
													(doc) =>
														doc.type === docType
												) || [];
											return (
												<div
													key={docType}
													className="flex flex-col py-3"
												>
													<div className="flex justify-between items-center mb-2">
														<span className="text-sm text-gray-900">
															{docType}
														</span>
														<span
															className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
																uploadedDocs.length >
																0
																	? "bg-green-100 text-green-800"
																	: "bg-yellow-100 text-yellow-800"
															}`}
														>
															{uploadedDocs.length >
															0
																? `${uploadedDocs.length} file(s) uploaded`
																: "Not Uploaded"}
														</span>
													</div>
													{uploadedDocs.length >
														0 && (
														<div className="pl-4 space-y-2">
															{uploadedDocs.map(
																(doc) => (
																	<div
																		key={
																			doc.id
																		}
																		className="flex justify-between items-center"
																	>
																		<span className="text-sm text-gray-600">
																			{doc.fileUrl
																				?.split(
																					"/"
																				)
																				.pop() ||
																				doc.name ||
																				"Unknown file"}
																		</span>
																		<a
																			href={`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${application.id}/documents/${doc.id}`}
																			target="_blank"
																			rel="noopener noreferrer"
																			className="text-indigo-600 hover:text-indigo-500 text-sm"
																		>
																			View
																		</a>
																	</div>
																)
															)}
														</div>
													)}
												</div>
											);
										}
									)
								) : (
									<div className="py-3">
										<p className="text-sm text-gray-500">
											No required documents found
										</p>
									</div>
								)}
							</div>
							{application.status === "WITHDRAWN" && (
								<Typography className="text-sm text-gray-500 mt-4">
									Document uploads are disabled for withdrawn
									applications.
								</Typography>
							)}
						</div>

						{/* Document Upload Dialog */}
						<Dialog
							open={isDocumentDialogOpen}
							onClose={() => setIsDocumentDialogOpen(false)}
							maxWidth="md"
							fullWidth
						>
							<div className="p-6">
								<div className="flex justify-between items-center mb-6">
									<Typography
										variant="h6"
										className="text-gray-900"
									>
										Edit Documents
									</Typography>
									<IconButton
										onClick={() =>
											setIsDocumentDialogOpen(false)
										}
										size="small"
										className="text-gray-500 hover:text-gray-700"
									>
										<CloseIcon />
									</IconButton>
								</div>
								{application && (
									<DocumentUploadForm
										applicationId={application.id}
										productCode={application.product.code}
										onSuccess={() => {
											handleDocumentUpdate();
											setIsDocumentDialogOpen(false);
										}}
										existingDocuments={
											application.documents || []
										}
									/>
								)}
							</div>
						</Dialog>

						{/* Application Timeline */}
						<div className="bg-white rounded-lg border border-gray-200 p-6">
							<h2 className="text-lg font-medium text-gray-900 mb-4">
								Application Timeline
							</h2>
							<div className="space-y-4">
								<div className="flex items-center gap-3">
									<div className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500" />
									<div className="flex-1">
										<p className="text-sm font-medium text-gray-900">
											Application Started
										</p>
										<p className="text-sm text-gray-500">
											{formatDate(application.createdAt)}
										</p>
									</div>
								</div>
								{application.status !== "INCOMPLETE" && (
									<div className="flex items-center gap-3">
										<div className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500" />
										<div className="flex-1">
											<p className="text-sm font-medium text-gray-900">
												Application Submitted
											</p>
											<p className="text-sm text-gray-500">
												{formatDate(
													application.updatedAt
												)}
											</p>
										</div>
									</div>
								)}
								{application.status === "WITHDRAWN" && (
									<div className="flex items-center gap-3">
										<div className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500" />
										<div className="flex-1">
											<p className="text-sm font-medium text-gray-900">
												Application Withdrawn
											</p>
											<p className="text-sm text-gray-500">
												{formatDate(
													application.updatedAt
												)}
											</p>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				) : (
					<div className="p-6">
						<p className="text-gray-500">Application not found</p>
					</div>
				)}
			</div>
		</DashboardLayout>
	);
}
