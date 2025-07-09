"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
// Material-UI imports removed - using custom dark theme components
import Cookies from "js-cookie";
import ProductSelectionForm from "@/components/application/ProductSelectionForm";
import ApplicationDetailsForm from "@/components/application/ApplicationDetailsForm";
import PersonalInfoVerificationForm from "@/components/application/PersonalInfoVerificationForm";
import DocumentUploadForm from "@/components/application/DocumentUploadForm";
import ReviewAndSubmitForm from "@/components/application/ReviewAndSubmitForm";

import ArrowBack from "@mui/icons-material/ArrowBack";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Info from "@mui/icons-material/Info";
import { ProductType } from "@/types/product";
import { fetchWithTokenRefresh, checkAuth } from "@/lib/authUtils";

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

// Create a client component for handling searchParams
function ApplyPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [activeStep, setActiveStep] = useState(0);
	const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(
		null
	);
	const [products, setProducts] = useState<ProductType[]>([]);
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
				// Fetch application data using token refresh utility
				const data = await fetchWithTokenRefresh<any>(
					`/api/loan-applications/${applicationId}`
				);

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
				// Add cache-busting parameter to ensure fresh data
				const data = await fetchWithTokenRefresh<any>(
					`/api/products?t=${Date.now()}`
				);

				setProducts(data);
			} catch (error) {
				console.error("Error fetching products:", error);
			}
		};

		fetchProducts();
	}, []);

	useEffect(() => {
		const verifyUserAndFetchData = async () => {
			try {
				// Check authentication using our utility
				const isAuthenticated = await checkAuth();

				if (!isAuthenticated) {
					router.push("/login");
					return;
				}

				// Fetch user data using token refresh utility
				const data = await fetchWithTokenRefresh<any>("/api/users/me");

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

		verifyUserAndFetchData();
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
			return; // Add explicit return statement for success case
		} catch (error) {
			console.error("Error creating/updating loan application:", error);
			setError(
				error instanceof Error ? error.message : "An error occurred"
			);
			return; // Add explicit return statement for error case
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
			return; // Add explicit return statement for success case
		} catch (error) {
			console.error("Error updating loan application details:", error);
			return; // Add explicit return statement for error case
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
			return; // Add explicit return statement for success case
		} catch (error) {
			console.error("Error updating personal information:", error);
			return; // Add explicit return statement for error case
		}
	};

	const handleDocumentUpload = async (values: {
		documents: File[];
		documentTypes: string[];
	}) => {
		const applicationId = searchParams.get("applicationId");
		if (!applicationId) return;

		try {
			const token = localStorage.getItem("token") || Cookies.get("token");
			const formData = new FormData();

			// Add files and their corresponding types
			values.documents.forEach((file) => {
				formData.append("documents", file);
			});
			formData.append(
				"documentTypes",
				JSON.stringify(values.documentTypes)
			);

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
			return; // Add explicit return statement for success case
		} catch (error) {
			console.error("Error uploading documents:", error);
			return; // Add explicit return statement for error case
		}
	};

	const handleSubmit = async (data: { termsAccepted: boolean }) => {
		if (!data.termsAccepted) return;

		// The submission is already handled in ReviewAndSubmitForm.tsx
		// No need for an additional submit API call since it properly updates the application
		// with acceptTerms: true and status: "PENDING_APP_FEE"
		
		// Just navigate to dashboard since the submission was successful
		router.push("/dashboard");
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
		<div className="min-h-screen bg-offwhite">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="flex items-center justify-between mb-8">
					<div>
						<h1 className="text-2xl font-semibold text-gray-700 font-heading">
							Apply for a Loan
						</h1>
						<p className="mt-1 text-sm text-gray-500 font-body">
							Complete the steps below to submit your loan
							application
						</p>
					</div>
					<button
						onClick={() => router.push("/dashboard")}
						className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm font-body"
					>
						<ArrowBack className="h-4 w-4 mr-2" />
						Back to Dashboard
					</button>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					<div className="lg:col-span-2">
						{/* Custom Stepper */}
						<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
							<div className="flex items-center justify-between">
								{steps.map((label, index) => (
									<div
										key={label}
										className="flex items-center"
									>
										<div className="flex flex-col items-center">
											<div
												className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors font-body ${
													index < activeStep
														? "bg-purple-primary border-purple-primary text-white"
														: index === activeStep
														? "bg-purple-primary/10 border-purple-primary text-purple-primary"
														: "bg-gray-100 border-gray-300 text-gray-500"
												}`}
											>
												{index < activeStep ? (
													<CheckCircle className="h-5 w-5" />
												) : (
													index + 1
												)}
											</div>
											<span
												className={`mt-2 text-xs font-medium text-center max-w-[80px] font-body ${
													index <= activeStep
														? "text-purple-primary"
														: "text-gray-500"
												}`}
											>
												{label}
											</span>
										</div>
										{index < steps.length - 1 && (
											<div
												className={`w-16 h-0.5 mx-4 ${
													index < activeStep
														? "bg-purple-primary"
														: "bg-gray-300"
												}`}
											/>
										)}
									</div>
								))}
							</div>
						</div>

						{/* Main Content */}
						<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
							{renderStepContent(activeStep)}
						</div>
					</div>

					<div className="lg:col-span-1">
						{activeStep === 0 && selectedProductDetails && (
							<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-8">
								<div className="space-y-4">
									<div>
										<p className="text-sm text-gray-500 font-body">
											Product
										</p>
										<p className="text-gray-700 font-medium font-heading">
											{selectedProductDetails.name}
										</p>
									</div>
									<div>
										<p className="text-sm text-gray-500 font-body">
											Amount Range
										</p>
										<p className="text-gray-700 font-medium font-body">
											RM
											{selectedProductDetails.minAmount.toLocaleString()}{" "}
											- RM
											{selectedProductDetails.maxAmount.toLocaleString()}
										</p>
									</div>
									<div>
										<p className="text-sm text-gray-500 font-body">
											Description
										</p>
										<p className="text-gray-700 font-body">
											{selectedProductDetails.description}
										</p>
									</div>
									<div>
										<p className="text-sm text-gray-500 font-body">
											Features
										</p>
										<ul className="mt-1 space-y-1">
											{selectedProductDetails.features.map(
												(feature, index) => (
													<li
														key={index}
														className="flex items-start"
													>
														<CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
														<p className="text-gray-700 font-body">
															{feature}
														</p>
													</li>
												)
											)}
										</ul>
									</div>
									<div>
										<p className="text-sm text-gray-500 font-body">
											Fees & Charges
										</p>
										<div className="mt-1 space-y-1">
											{selectedProductDetails.originationFee >
												0 && (
												<div className="flex items-start">
													<Info className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
													<p className="text-gray-700 font-body">
														{
															selectedProductDetails.originationFee
														}
														% origination fee
													</p>
												</div>
											)}
											{selectedProductDetails.legalFee >
												0 && (
												<div className="flex items-start">
													<Info className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
													<p className="text-gray-700 font-body">
														{
															selectedProductDetails.legalFee
														}
														% legal fee
													</p>
												</div>
											)}
											{selectedProductDetails.applicationFee >
												0 && (
												<div className="flex items-start">
													<Info className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
													<p className="text-gray-700 font-body">
														RM{" "}
														{
															selectedProductDetails.applicationFee
														}{" "}
														application fee (paid
														before approval)
													</p>
												</div>
											)}
											{selectedProductDetails.applicationFee >
												0 && (
												<div className="flex items-start">
													<CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
													<p className="text-gray-700 font-body">
														Includes 1 free CTOS
														credit report
													</p>
												</div>
											)}
										</div>
									</div>
									<div>
										<p className="text-sm text-gray-500 font-body">
											Late Payment Fees
										</p>
										<div className="mt-1 space-y-1">
											{selectedProductDetails.lateFeeRate &&
												selectedProductDetails.lateFeeRate >
													0 && (
													<div className="flex items-start">
														<Info className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
														<p className="text-gray-700 font-body">
															{Math.floor(
																selectedProductDetails.lateFeeRate *
																	365
															)}
															% per year interest
															on overdue amounts
														</p>
													</div>
												)}
											{(selectedProductDetails.lateFeeFixedAmount ||
												0) > 0 && (
												<div className="flex items-start">
													<Info className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
													<p className="text-gray-700 font-body">
														RM{" "}
														{
															selectedProductDetails.lateFeeFixedAmount
														}{" "}
														fixed fee every{" "}
														{selectedProductDetails.lateFeeFrequencyDays ||
															7}{" "}
														days
													</p>
												</div>
											)}
										</div>
									</div>
									<div>
										<p className="text-sm text-gray-500 font-body">
											Requirements
										</p>
										<ul className="mt-1 space-y-1">
											{selectedProductDetails.eligibility.map(
												(req, index) => (
													<li
														key={index}
														className="flex items-start"
													>
														<Info className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
														<p className="text-gray-700 font-body">
															{req}
														</p>
													</li>
												)
											)}
										</ul>
									</div>
								</div>
							</div>
						)}
						{activeStep > 0 && selectedProductDetails && (
							<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-8">
								<h3 className="text-lg font-semibold text-gray-700 mb-4 font-heading">
									Product Details
								</h3>
								<div className="space-y-4">
									<div>
										<p className="text-sm text-gray-500 font-body">
											Product
										</p>
										<p className="text-gray-700 font-medium font-heading">
											{selectedProductDetails.name}
										</p>
									</div>
									<div>
										<p className="text-sm text-gray-500 font-body">
											Amount Range
										</p>
										<p className="text-gray-700 font-medium font-body">
											RM
											{selectedProductDetails.minAmount.toLocaleString()}{" "}
											- RM
											{selectedProductDetails.maxAmount.toLocaleString()}
										</p>
									</div>
									<div>
										<p className="text-sm text-gray-500 font-body">
											Description
										</p>
										<p className="text-gray-700 font-body">
											{selectedProductDetails.description}
										</p>
									</div>
									<div>
										<p className="text-sm text-gray-500 font-body">
											Features
										</p>
										<ul className="mt-1 space-y-1">
											{selectedProductDetails.features.map(
												(feature, index) => (
													<li
														key={index}
														className="flex items-start"
													>
														<CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
														<p className="text-gray-700 font-body">
															{feature}
														</p>
													</li>
												)
											)}
										</ul>
									</div>
									<div>
										<p className="text-sm text-gray-500 font-body">
											Fees & Charges
										</p>
										<div className="mt-1 space-y-1">
											{selectedProductDetails.originationFee >
												0 && (
												<div className="flex items-start">
													<Info className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
													<p className="text-gray-700 font-body">
														{
															selectedProductDetails.originationFee
														}
														% origination fee
													</p>
												</div>
											)}
											{selectedProductDetails.legalFee >
												0 && (
												<div className="flex items-start">
													<Info className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
													<p className="text-gray-700 font-body">
														{
															selectedProductDetails.legalFee
														}
														% legal fee
													</p>
												</div>
											)}
											{selectedProductDetails.applicationFee >
												0 && (
												<div className="flex items-start">
													<Info className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
													<p className="text-gray-700 font-body">
														RM{" "}
														{
															selectedProductDetails.applicationFee
														}{" "}
														application fee (paid
														before approval)
													</p>
												</div>
											)}
											{selectedProductDetails.applicationFee >
												0 && (
												<div className="flex items-start">
													<CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
													<p className="text-gray-700 font-body">
														Includes 1 free CTOS
														credit report
													</p>
												</div>
											)}
										</div>
									</div>
									<div>
										<p className="text-sm text-gray-500 font-body">
											Late Payment Fees
										</p>
										<div className="mt-1 space-y-1">
											{selectedProductDetails.lateFeeRate &&
												selectedProductDetails.lateFeeRate >
													0 && (
													<div className="flex items-start">
														<Info className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
														<p className="text-gray-700 font-body">
															{Math.floor(
																selectedProductDetails.lateFeeRate *
																	365
															)}
															% per year interest
															on overdue amounts
														</p>
													</div>
												)}
											{(selectedProductDetails.lateFeeFixedAmount ||
												0) > 0 && (
												<div className="flex items-start">
													<Info className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
													<p className="text-gray-700 font-body">
														RM{" "}
														{
															selectedProductDetails.lateFeeFixedAmount
														}{" "}
														fixed fee every{" "}
														{selectedProductDetails.lateFeeFrequencyDays ||
															7}{" "}
														days
													</p>
												</div>
											)}
										</div>
									</div>
									<div>
										<p className="text-sm text-gray-500 font-body">
											Requirements
										</p>
										<ul className="mt-1 space-y-1">
											{selectedProductDetails.eligibility.map(
												(req, index) => (
													<li
														key={index}
														className="flex items-start"
													>
														<Info className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
														<p className="text-gray-700 font-body">
															{req}
														</p>
													</li>
												)
											)}
										</ul>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export default function ApplyPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-offwhite flex items-center justify-center">
					<div className="text-gray-700 font-body">Loading...</div>
				</div>
			}
		>
			<ApplyPageContent />
		</Suspense>
	);
}
