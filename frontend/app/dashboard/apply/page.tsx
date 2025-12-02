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

import { 
	ArrowLeftIcon,
	CheckCircleIcon,
	InformationCircleIcon,
	ShoppingBagIcon,
	DocumentTextIcon,
	UserIcon,
	FolderIcon,
	ClipboardDocumentCheckIcon,
	XMarkIcon
} from "@heroicons/react/24/outline";
import { ProductType } from "@/types/product";
import { fetchWithTokenRefresh, checkAuth } from "@/lib/authUtils";

const steps = [
	{
		title: "Select Product",
		description: "Choose your loan product",
		icon: ShoppingBagIcon,
	},
	{
		title: "Application Details",
		description: "Loan amount and terms",
		icon: DocumentTextIcon,
	},
	{
		title: "Personal Information",
		description: "Verify your details",
		icon: UserIcon,
	},
	{
		title: "Supporting Documents",
		description: "Upload required documents",
		icon: FolderIcon,
	},
	{
		title: "Review & Submit",
		description: "Final review and submission",
		icon: ClipboardDocumentCheckIcon,
	},
];

interface PersonalInfo {
	fullName: string;
	email: string;
	phoneNumber: string;
	employmentStatus: string;
	employerName?: string;
	monthlyIncome: string;
	serviceLength?: string;
	educationLevel: string;
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
	serviceLength: "",
	educationLevel: "",
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
		loanPurpose: string | null;
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
					loanPurpose: data.purpose && data.purpose.trim() !== "" ? data.purpose : null,
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

				// Skip onboarding check - all users go directly to dashboard
				// if (!data?.isOnboardingComplete) {
				// 	router.push("/onboarding");
				// 	return;
				// }
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
			let newActiveStep = activeStep - 1;

			// Check if we need to skip the document step (activeStep 3) for collateral loans
			if (activeStep === 4 && newActiveStep === 3) { // Going from activeStep 4 to activeStep 3
				// Check if this is a collateral loan or a product with no required documents
				const isCollateralLoan = selectedProduct?.collateralRequired === true;
				const hasRequiredDocuments = selectedProduct?.requiredDocuments && 
					Array.isArray(selectedProduct.requiredDocuments) && 
					selectedProduct.requiredDocuments.length > 0;
				
				// Skip document step if it's a collateral loan or no documents required
				if (isCollateralLoan || !hasRequiredDocuments) {
					newActiveStep = 2; // Go back to activeStep 2 (Personal Information) instead
				}
			}

			setActiveStep(newActiveStep);

			// Calculate the 1-based step for database and URL (based on newActiveStep)
			const prevStep = newActiveStep + 1; // Convert from 0-based to 1-based

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
		loanPurpose: string | null;
		loanTerm: string;
		monthlyRepayment: string;
		interestRate: string;
		legalFee: string;
		originationFee: string;
		stampingFee?: string;
		legalFeeFixed?: string;
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
						stampingFee: details.stampingFee ? parseFloat(details.stampingFee) : undefined,
						legalFeeFixed: details.legalFeeFixed ? parseFloat(details.legalFeeFixed) : undefined,
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

				{/* Header with Close Button */}
				<div className="relative text-center mb-8">
					<button
						onClick={() => router.push('/dashboard')}
						className="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2"
						title="Close application"
					>
						<XMarkIcon className="w-5 h-5" />
					</button>
					<h1 className="text-2xl lg:text-3xl font-heading font-bold text-gray-700 mb-2">
						Apply for a Loan
					</h1>
					<p className="text-sm lg:text-base text-gray-500 font-body">
						Complete the steps below to submit your loan application
					</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					<div className="lg:col-span-2">
						{/* Progress Steps */}
						<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
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
										<div className="relative grid grid-cols-5 gap-2 lg:gap-4">
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
														<CheckCircleIcon className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
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
													<InformationCircleIcon className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
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
													<InformationCircleIcon className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
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
													<InformationCircleIcon className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
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
													<CheckCircleIcon className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
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
														<InformationCircleIcon className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
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
													<InformationCircleIcon className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
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
														<InformationCircleIcon className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
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
														<CheckCircleIcon className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
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
													<InformationCircleIcon className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
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
													<InformationCircleIcon className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
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
													<InformationCircleIcon className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
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
													<CheckCircleIcon className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
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
														<InformationCircleIcon className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
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
													<InformationCircleIcon className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
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
														<InformationCircleIcon className="h-5 w-5 text-blue-tertiary mr-2 mt-0.5" />
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
