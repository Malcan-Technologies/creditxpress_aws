"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Stepper,
	Step,
	StepLabel,
	Paper,
	Typography,
	Button,
} from "@mui/material";
import Cookies from "js-cookie";
import ProductSelectionForm from "@/components/application/ProductSelectionForm";
import ApplicationDetailsForm from "@/components/application/ApplicationDetailsForm";
import PersonalInfoVerificationForm from "@/components/application/PersonalInfoVerificationForm";
import DocumentUploadForm from "@/components/application/DocumentUploadForm";
import ReviewAndSubmitForm from "@/components/application/ReviewAndSubmitForm";
import ArrowBack from "@mui/icons-material/ArrowBack";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Info from "@mui/icons-material/Info";

interface Product {
	id: string;
	code: string;
	name: string;
	description: string;
	minAmount: number;
	maxAmount: number;
	repaymentTerms: number[];
	interestRate: number;
	legalFee: number;
	originationFee: number;
	lateFee: number;
	applicationFee: number;
	eligibility: string[];
	features: string[];
	requiredDocuments: string[];
	loanTypes: string[];
	requirements: string[];
}

const steps = [
	"Select Product",
	"Application Details",
	"Personal Information",
	"Supporting Documents",
	"Review & Submit",
];

interface PersonalInfo {
	fullName: string;
	email: string;
	phoneNumber: string;
	employmentStatus: string;
	employerName?: string;
	monthlyIncome: string;
	address1: string;
	address2?: string;
	city: string;
	state: string;
	postalCode: string;
	zipCode?: string;
}

const defaultUserData: PersonalInfo = {
	fullName: "",
	email: "",
	phoneNumber: "",
	employmentStatus: "",
	monthlyIncome: "",
	address1: "",
	city: "",
	state: "",
	postalCode: "",
};

interface EmploymentInfo {
	employmentStatus: string;
	employerName: string;
	monthlyIncome: string;
}

interface BankInfo {
	bankName: string;
	accountNumber: string;
}

interface LoanDetails {
	amount: number;
	term: number;
	purpose: string;
}

interface LoanApplication {
	id: string;
	productId: string;
	appStep: number;
	personalInfo?: PersonalInfo;
	employmentInfo?: EmploymentInfo;
	bankInfo?: BankInfo;
	loanDetails?: LoanDetails;
}

interface Document {
	id: string;
	name: string;
	status: string;
}

export default function ApplyPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [activeStep, setActiveStep] = useState(0);
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(
		null
	);
	const [products, setProducts] = useState<Product[]>([]);
	const [userData, setUserData] = useState<PersonalInfo>(defaultUserData);
	const [applicationData, setApplicationData] = useState<{
		productId: string;
		loanAmount: string;
		loanPurpose: string;
		loanTerm: string;
		monthlyRepayment: string;
		interestRate: string;
		legalFee: string;
		originationFee: string;
		netDisbursement: string;
		documents: Document[];
	} | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Initialize active step from URL parameters
	useEffect(() => {
		const step = searchParams.get("step");
		if (step) {
			const stepNumber = parseInt(step);
			if (!isNaN(stepNumber) && stepNumber >= 1 && stepNumber <= 5) {
				setActiveStep(stepNumber - 1); // Convert 1-based to 0-based for internal state
			}
		}
	}, [searchParams]);

	// Load application data when resuming an application
	useEffect(() => {
		const loadApplicationData = async () => {
			const applicationId = searchParams.get("applicationId");
			if (!applicationId) return;

			try {
				const token =
					localStorage.getItem("token") || Cookies.get("token");
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
						},
					}
				);

				if (!response.ok) {
					throw new Error("Failed to fetch application data");
				}

				const data = await response.json();

				// Set the selected product
				const product = products.find((p) => p.id === data.productId);
				if (product) {
					setSelectedProduct(product);
				}

				// Set application data
				setApplicationData({
					productId: data.productId,
					loanAmount: data.amount?.toString() || "",
					loanPurpose: data.purpose || "",
					loanTerm: data.term?.toString() || "",
					monthlyRepayment: data.monthlyRepayment?.toString() || "",
					interestRate: data.interestRate?.toString() || "",
					legalFee: data.legalFee?.toString() || "",
					originationFee: data.originationFee?.toString() || "",
					netDisbursement: data.netDisbursement?.toString() || "",
					documents: data.documents || [],
				});

				// If we don't have a productCode in the URL but we have the product data, update the URL
				const productCode = searchParams.get("productCode");
				if (!productCode && data.product?.code) {
					const url = new URL(window.location.href);
					url.searchParams.set("productCode", data.product.code);
					window.history.pushState({}, "", url.toString());
				}
			} catch (error) {
				console.error("Error loading application data:", error);
				setError(
					error instanceof Error
						? error.message
						: "Failed to load application data"
				);
			}
		};

		if (products.length > 0) {
			loadApplicationData();
		}
	}, [searchParams, products]);

	useEffect(() => {
		const fetchProducts = async () => {
			try {
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/products`
				);
				if (!response.ok) {
					throw new Error("Failed to fetch products");
				}
				const data = await response.json();
				setProducts(data);
			} catch (error) {
				console.error("Error fetching products:", error);
			}
		};

		fetchProducts();
	}, []);

	useEffect(() => {
		const checkAuth = async () => {
			try {
				const token =
					localStorage.getItem("token") || Cookies.get("token");

				if (!token) {
					router.push("/login");
					return;
				}

				// Fetch user data
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
						},
					}
				);

				if (!response.ok) {
					router.push("/login");
					return;
				}

				const data = await response.json();
				setUserData({
					...defaultUserData,
					...data,
				});

				// Check if onboarding is complete
				if (!data?.isOnboardingComplete) {
					router.push("/onboarding");
					return;
				}
			} catch (error) {
				console.error("Apply - Auth check error:", error);
				router.push("/login");
			}
		};

		checkAuth();
	}, [router]);

	const handleNext = async () => {
		const applicationId = searchParams.get("applicationId");
		if (applicationId) {
			try {
				const token =
					localStorage.getItem("token") || Cookies.get("token");
				const nextStep = activeStep + 2; // Add 2 to convert from 0-based to 1-based

				// Update the application step in the database
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}/step`,
					{
						method: "PATCH",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${token}`,
						},
						body: JSON.stringify({ appStep: nextStep }),
					}
				);

				if (!response.ok) {
					throw new Error("Failed to update application step");
				}

				// Update URL with new step
				const url = new URL(window.location.href);
				url.searchParams.set("step", nextStep.toString());
				window.history.pushState({}, "", url.toString());
			} catch (error) {
				console.error("Error updating application step:", error);
			}
		}

		setActiveStep((prevStep) => prevStep + 1);
	};

	const handleBack = async () => {
		const applicationId = searchParams.get("applicationId");
		if (!applicationId) return;

		try {
			const token = localStorage.getItem("token") || Cookies.get("token");
			const prevStep = activeStep + 1; // Add 1 to convert from 0-based to 1-based
			setActiveStep((prev) => prev - 1);

			// Update the application step in the database
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}/step`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ appStep: prevStep }),
				}
			);

			if (!response.ok) {
				throw new Error("Failed to update application step");
			}

			// Update URL with the new step
			const newUrl = new URL(window.location.href);
			newUrl.searchParams.set("step", String(prevStep));
			window.history.pushState({}, "", newUrl.toString());
		} catch (error) {
			console.error("Error updating application step:", error);
			// Revert the step if there was an error
			setActiveStep((prev) => prev + 1);
		}
	};

	const handleProductPreview = (productId: string | null) => {
		if (productId) {
			const product = products.find((p) => p.id === productId);
			setSelectedProduct(product || null);
		} else {
			setSelectedProduct(null);
		}
	};

	const handleProductSelect = async (values: { productId: string }) => {
		try {
			setLoading(true);
			setError(null);

			const token = localStorage.getItem("token") || Cookies.get("token");
			const applicationId = searchParams.get("applicationId");
			let newApplicationId = applicationId;

			// Find the selected product from the products array
			const selectedProductDetails = products.find(
				(p) => p.id === values.productId
			);

			if (!selectedProductDetails) {
				throw new Error("Selected product not found");
			}

			// Fetch detailed product information using the product code
			const productResponse = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/products?code=${selectedProductDetails.code}`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);

			if (!productResponse.ok) {
				throw new Error("Failed to fetch product details");
			}

			const productData = await productResponse.json();

			if (applicationId) {
				// Update existing application
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}`,
					{
						method: "PATCH",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${token}`,
						},
						body: JSON.stringify({
							productId: values.productId,
							appStep: 2, // This is correct as it's 1-based
							interestRate: productData.interestRate || 0,
							lateFee: productData.lateFee || 0,
							originationFee: productData.originationFee || 0,
							legalFee: productData.legalFee || 0,
							applicationFee: productData.applicationFee || 0,
							status: "INCOMPLETE",
							// Clear all information fields that exist in the database
							amount: null,
							term: null,
							purpose: null,
							monthlyRepayment: null,
							netDisbursement: null,
							acceptTerms: false,
							paidAppFee: false,
						}),
					}
				);

				if (!response.ok) {
					const errorData = await response.json().catch(() => null);
					console.error("Error response:", errorData);
					throw new Error(
						errorData?.message ||
							`Failed to update loan application: ${response.status} ${response.statusText}`
					);
				}
			} else {
				// Create new application
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${token}`,
						},
						body: JSON.stringify({
							productId: values.productId,
							appStep: 2, // This is correct as it's 1-based
							product: productData,
						}),
					}
				);

				if (!response.ok) {
					throw new Error("Failed to create loan application");
				}

				const data = await response.json();
				newApplicationId = data.id;
			}

			// Update URL and navigate in one step
			const newUrl = new URL(window.location.href);
			newUrl.searchParams.set("applicationId", newApplicationId || "");
			newUrl.searchParams.set("productCode", selectedProductDetails.code);
			newUrl.searchParams.set("step", "2"); // This is correct as it's 1-based
			window.history.pushState({}, "", newUrl.toString());

			// Set active step after URL update
			setActiveStep(1); // This is correct as it's 0-based for internal state

			// Update the selected product in state
			setSelectedProduct(selectedProductDetails);
		} catch (error) {
			console.error("Error creating/updating loan application:", error);
			setError(
				error instanceof Error ? error.message : "An error occurred"
			);
		} finally {
			setLoading(false);
		}
	};

	const handleApplicationDetails = async (details: {
		loanAmount: string;
		loanPurpose: string;
		loanTerm: string;
		monthlyRepayment: string;
		interestRate: string;
		legalFee: string;
		originationFee: string;
		netDisbursement: string;
	}) => {
		const applicationId = searchParams.get("applicationId");
		if (!applicationId) return;

		try {
			const token = localStorage.getItem("token") || Cookies.get("token");

			// Update the application with the entered details
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						amount: parseFloat(details.loanAmount),
						term: parseInt(details.loanTerm),
						purpose: details.loanPurpose,
						monthlyRepayment: parseFloat(details.monthlyRepayment),
						interestRate: parseFloat(details.interestRate),
						legalFee: parseFloat(details.legalFee),
						originationFee: parseFloat(details.originationFee),
						netDisbursement: parseFloat(details.netDisbursement),
						appStep: 3, // This is correct as it's 1-based
					}),
				}
			);

			if (!response.ok) {
				throw new Error("Failed to update loan application details");
			}

			// Update application data state
			setApplicationData({
				productId: selectedProduct!.id,
				...details,
				netDisbursement: "",
				documents: [],
			});

			// Update URL with new step
			const url = new URL(window.location.href);
			url.searchParams.set("step", "3"); // This is correct as it's 1-based
			window.history.pushState({}, "", url.toString());

			// Move to next step after successful update
			setActiveStep(2); // This is correct as it's 0-based for internal state
		} catch (error) {
			console.error("Error updating loan application details:", error);
		}
	};

	const handlePersonalInfo = async (info: PersonalInfo) => {
		const applicationId = searchParams.get("applicationId");
		if (!applicationId) return;

		try {
			const token = localStorage.getItem("token") || Cookies.get("token");

			// Map postalCode to zipCode for backend
			const userData = {
				...info,
				zipCode: info.postalCode,
				postalCode: undefined,
			};

			// First, update the user's personal information
			const userResponse = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify(userData),
				}
			);

			if (!userResponse.ok) {
				throw new Error("Failed to update personal information");
			}

			// Then, update the loan application step
			const applicationResponse = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						appStep: 4, // This is correct as it's 1-based
					}),
				}
			);

			if (!applicationResponse.ok) {
				throw new Error("Failed to update application step");
			}

			// Update user data state
			setUserData(info);

			// Update URL with new step
			const url = new URL(window.location.href);
			url.searchParams.set("step", "4"); // This is correct as it's 1-based
			window.history.pushState({}, "", url.toString());

			// Move to next step after successful update
			setActiveStep(3); // This is correct as it's 0-based for internal state
		} catch (error) {
			console.error("Error updating personal information:", error);
		}
	};

	const handleDocumentUpload = async (values: { documents: File[] }) => {
		const applicationId = searchParams.get("applicationId");
		if (!applicationId) return;

		try {
			const token = localStorage.getItem("token") || Cookies.get("token");
			const formData = new FormData();
			values.documents.forEach((file) => {
				formData.append("documents", file);
			});

			// Upload documents
			const uploadResponse = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}/documents`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
					},
					body: formData,
				}
			);

			if (!uploadResponse.ok) {
				throw new Error("Failed to upload documents");
			}

			// Update application step
			const stepResponse = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						appStep: 5, // This is correct as it's 1-based
					}),
				}
			);

			if (!stepResponse.ok) {
				throw new Error("Failed to update application step");
			}

			// Update URL with new step
			const url = new URL(window.location.href);
			url.searchParams.set("step", "5"); // This is correct as it's 1-based
			window.history.pushState({}, "", url.toString());

			// Move to next step after successful update
			setActiveStep(4); // This is correct as it's 0-based for internal state
		} catch (error) {
			console.error("Error uploading documents:", error);
		}
	};

	const handleSubmit = async (data: { termsAccepted: boolean }) => {
		if (!data.termsAccepted) return;

		const applicationId = searchParams.get("applicationId");
		if (!applicationId) return;

		try {
			const token = localStorage.getItem("token") || Cookies.get("token");
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}/submit`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						termsAccepted: data.termsAccepted,
						appStep: 6, // This is correct as it's 1-based
					}),
				}
			);

			if (response.ok) {
				router.push("/dashboard/applications");
			} else {
				throw new Error("Failed to submit application");
			}
		} catch (error) {
			console.error("Error submitting application:", error);
		}
	};

	const selectedProductDetails = selectedProduct
		? products.find((p) => p.id === selectedProduct.id)
		: null;

	const renderStepContent = (step: number) => {
		switch (step) {
			case 0:
				return (
					<ProductSelectionForm
						products={products}
						selectedProduct={selectedProduct}
						onProductSelect={handleProductPreview}
						onProductPreview={handleProductPreview}
						onSubmit={handleProductSelect}
						showBackButton={false}
					/>
				);
			case 1:
				return selectedProductDetails ? (
					<ApplicationDetailsForm
						onSubmit={handleApplicationDetails}
						onBack={handleBack}
						selectedProduct={selectedProductDetails}
					/>
				) : null;
			case 2:
				return (
					<PersonalInfoVerificationForm
						onSubmit={handlePersonalInfo}
						onBack={handleBack}
					/>
				);
			case 3:
				return selectedProduct ? (
					<DocumentUploadForm
						onSubmit={handleDocumentUpload}
						onBack={handleBack}
						selectedProduct={selectedProduct}
					/>
				) : null;
			case 4:
				return (
					<ReviewAndSubmitForm
						onSubmit={handleSubmit}
						onBack={handleBack}
						userData={userData}
					/>
				);
			default:
				return null;
		}
	};

	return (
		<div className="min-h-screen bg-gray-50">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="flex items-center justify-between mb-8">
					<div>
						<h1 className="text-2xl font-semibold text-gray-900">
							Apply for a Loan
						</h1>
						<p className="mt-1 text-sm text-gray-500">
							Complete the steps below to submit your loan
							application
						</p>
					</div>
					<Button
						variant="outlined"
						onClick={() => router.push("/dashboard")}
						className="text-gray-700 border-gray-300 hover:bg-gray-50"
						startIcon={<ArrowBack />}
					>
						Back to Dashboard
					</Button>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					<div className="lg:col-span-2">
						<Paper className="p-6 mb-6">
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
						</Paper>
						<Paper className="p-6">
							{renderStepContent(activeStep)}
						</Paper>
					</div>

					<div className="lg:col-span-1">
						{activeStep === 0 && selectedProductDetails && (
							<Paper className="p-6 sticky top-8">
								{/* <Typography
									variant="h6"
									className="text-gray-900 mb-4"
								>
									Product Details
								</Typography> */}
								<div className="space-y-4">
									<div>
										<Typography className="text-sm text-gray-500">
											Product
										</Typography>
										<Typography className="text-gray-900 font-medium">
											{selectedProductDetails.name}
										</Typography>
									</div>
									<div>
										<Typography className="text-sm text-gray-500">
											Amount Range
										</Typography>
										<Typography className="text-gray-900 font-medium">
											RM
											{selectedProductDetails.minAmount.toLocaleString()}{" "}
											- RM
											{selectedProductDetails.maxAmount.toLocaleString()}
										</Typography>
									</div>
									<div>
										<Typography className="text-sm text-gray-500">
											Description
										</Typography>
										<Typography className="text-gray-600">
											{selectedProductDetails.description}
										</Typography>
									</div>
									<div>
										<Typography className="text-sm text-gray-500">
											Features
										</Typography>
										<ul className="mt-1 space-y-1">
											{selectedProductDetails.features.map(
												(feature, index) => (
													<li
														key={index}
														className="flex items-start"
													>
														<CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
														<Typography className="text-gray-600">
															{feature}
														</Typography>
													</li>
												)
											)}
										</ul>
									</div>
									<div>
										<Typography className="text-sm text-gray-500">
											Requirements
										</Typography>
										<ul className="mt-1 space-y-1">
											{selectedProductDetails.eligibility.map(
												(req, index) => (
													<li
														key={index}
														className="flex items-start"
													>
														<Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
														<Typography className="text-gray-600">
															{req}
														</Typography>
													</li>
												)
											)}
										</ul>
									</div>
								</div>
							</Paper>
						)}
						{activeStep > 0 && selectedProductDetails && (
							<Paper className="p-6 sticky top-8">
								<Typography
									variant="h6"
									className="text-gray-900 mb-4"
								>
									Product Details
								</Typography>
								<div className="space-y-4">
									<div>
										<Typography className="text-sm text-gray-500">
											Product
										</Typography>
										<Typography className="text-gray-900 font-medium">
											{selectedProductDetails.name}
										</Typography>
									</div>
									<div>
										<Typography className="text-sm text-gray-500">
											Amount Range
										</Typography>
										<Typography className="text-gray-900 font-medium">
											RM
											{selectedProductDetails.minAmount.toLocaleString()}{" "}
											- RM
											{selectedProductDetails.maxAmount.toLocaleString()}
										</Typography>
									</div>
									<div>
										<Typography className="text-sm text-gray-500">
											Description
										</Typography>
										<Typography className="text-gray-600">
											{selectedProductDetails.description}
										</Typography>
									</div>
									<div>
										<Typography className="text-sm text-gray-500">
											Features
										</Typography>
										<ul className="mt-1 space-y-1">
											{selectedProductDetails.features.map(
												(feature, index) => (
													<li
														key={index}
														className="flex items-start"
													>
														<CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
														<Typography className="text-gray-600">
															{feature}
														</Typography>
													</li>
												)
											)}
										</ul>
									</div>
									<div>
										<Typography className="text-sm text-gray-500">
											Requirements
										</Typography>
										<ul className="mt-1 space-y-1">
											{selectedProductDetails.eligibility.map(
												(req, index) => (
													<li
														key={index}
														className="flex items-start"
													>
														<Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
														<Typography className="text-gray-600">
															{req}
														</Typography>
													</li>
												)
											)}
										</ul>
									</div>
								</div>
							</Paper>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
