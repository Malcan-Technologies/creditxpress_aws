import { useState, useEffect, Suspense } from "react";
import { toast } from "sonner";
import {
	Box,
	Button,
	Typography,
	Alert,
	Checkbox,
	FormControlLabel,
	Paper,
	Link,
} from "@mui/material";

// Override Material-UI styles for light theme
const lightThemeOverrides = {
	"& .MuiTypography-root": {
		color: "#374151 !important",
		fontFamily: "Inter, sans-serif !important",
	},
	"& .MuiTypography-h6": {
		color: "#374151 !important",
		fontFamily: "Manrope, sans-serif !important",
		fontWeight: "600 !important",
	},
	"& .MuiTypography-root.text-blue-400": {
		color: "#38BDF8 !important",
	},
	"& .MuiTypography-root.text-green-400": {
		color: "#059669 !important",
	},
	"& .MuiTypography-root.text-purple-400": {
		color: "#7C3AED !important",
	},
	"& .MuiButton-root": {
		color: "white !important",
		backgroundColor: "#7C3AED !important",
		borderRadius: "12px !important",
		padding: "12px 24px !important",
		fontWeight: "500 !important",
		fontFamily: "Inter, sans-serif !important",
		transition: "all 0.2s ease !important",
		boxShadow: "none !important",
		textTransform: "none !important",
		"&:hover": {
			backgroundColor: "#6D28D9 !important",
			boxShadow: "none !important",
		},
	},
	"& .MuiButton-outlined": {
		color: "#374151 !important",
		backgroundColor: "white !important",
		borderColor: "#D1D5DB !important",
		borderRadius: "12px !important",
		padding: "12px 24px !important",
		fontWeight: "500 !important",
		fontFamily: "Inter, sans-serif !important",
		transition: "all 0.2s ease !important",
		"&:hover": {
			backgroundColor: "#F9FAFB !important",
			borderColor: "#9CA3AF !important",
		},
	},
	"& .MuiButton-contained": {
		color: "white !important",
		backgroundColor: "#7C3AED !important",
		borderRadius: "12px !important",
		padding: "12px 24px !important",
		fontWeight: "500 !important",
		fontFamily: "Inter, sans-serif !important",
		transition: "all 0.2s ease !important",
		boxShadow: "none !important",
		"&:hover": {
			backgroundColor: "#6D28D9 !important",
			boxShadow: "none !important",
		},
		"&:disabled": {
			backgroundColor: "#9CA3AF !important",
			color: "#6B7280 !important",
			cursor: "not-allowed !important",
		},
	},
	"& .MuiFormControlLabel-label": {
		color: "#374151 !important",
		fontFamily: "Inter, sans-serif !important",
	},
	"& .MuiCheckbox-root": {
		color: "#7C3AED !important",
		"&.Mui-checked": {
			color: "#7C3AED !important",
		},
	},
	"& .MuiPaper-root": {
		backgroundColor: "white !important",
		border: "1px solid #E5E7EB !important",
		borderRadius: "12px !important",
		color: "#374151 !important",
		boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1) !important",
	},
	"& .MuiAlert-root": {
		backgroundColor: "#FEF2F2 !important",
		color: "#DC2626 !important",
		border: "1px solid #FECACA !important",
		borderRadius: "12px !important",
	},
};
import InfoIcon from "@mui/icons-material/Info";
import { useSearchParams, useRouter } from "next/navigation";
import * as Tooltip from "@radix-ui/react-tooltip";
import Cookies from "js-cookie";

interface ApplicationData {
	productId: string;
	loanAmount: string;
	loanPurpose: string | null;
	loanTerm: string;
	monthlyRepayment: string;
	interestRate: string;
	legalFee: string; // Old
	netDisbursement: string;
	applicationFee?: string; // Old
	originationFee?: string; // Old
	stampingFee?: string; // New
	legalFeeFixed?: string; // New
	documents: Array<{
		id: string;
		name: string;
		type: string;
		status: string;
		fileUrl: string;
	}>;
	product: {
		code: string;
		name: string;
	};
}

interface ReviewAndSubmitFormProps {
	onSubmit: (values: { termsAccepted: boolean }) => void;
	onBack: () => void;
	userData: {
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

interface ProductDetails {
	originationFee: number;
	legalFee: number;
	applicationFee: number;
	name: string;
	interestRate: number;
	code: string;
	requiredDocuments?: string[];
	collateralRequired?: boolean;
}

// Create a client component for handling searchParams
function ReviewAndSubmitFormContent({
	onSubmit,
	onBack,
	userData,
}: ReviewAndSubmitFormProps) {
	const searchParams = useSearchParams();
	const router = useRouter();
	const [termsAccepted, setTermsAccepted] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [productDetails, setProductDetails] = useState<ProductDetails | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(true);
	const [openTooltip, setOpenTooltip] = useState<string | null>(null);
	const [applicationData, setApplicationData] =
		useState<ApplicationData | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			try {

				// Verify API URL
				const apiUrl = process.env.NEXT_PUBLIC_API_URL;
				if (!apiUrl) {
					throw new Error("API URL is not configured");
				}

				// Get application ID from URL params
				const applicationId = searchParams.get("applicationId");

				if (!applicationId) {
					throw new Error("Application ID not found in URL");
				}

				// Get token
				const token = localStorage.getItem("token");
				if (!token) {
					throw new Error("Authentication token not found");
				}

				// Log the full URL being used
				const fullUrl = `${apiUrl}/api/loan-applications/${applicationId}`;

				// Fetch application data
				const applicationResponse = await fetch(fullUrl, {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				if (!applicationResponse.ok) {
					throw new Error(
						`Failed to fetch application data: ${applicationResponse.status} ${applicationResponse.statusText}`
					);
				}

				const data = await applicationResponse.json();

				// Validate the data structure
				const requiredFields = [
					"productId",
					"amount",
					"term",
					"monthlyRepayment",
					"interestRate",
					"legalFee",
					"netDisbursement",
				];
				// Note: 'purpose' is not required as some loan products don't need it
				const missingFields = requiredFields.filter(
					(field) => data[field] === undefined || data[field] === null
				);

				if (missingFields.length > 0) {
					throw new Error(
						`Application data is missing required fields: ${missingFields.join(
							", "
						)}`
					);
				}

				// Check if product information exists
				if (!data.product) {
					throw new Error(
						"Product information is missing in the application data"
					);
				}

			// Transform the data to match our expected format
			const transformedData: ApplicationData = {
				productId: data.productId,
				loanAmount: data.amount.toString(),
				loanPurpose: data.purpose && data.purpose.trim() !== "" ? data.purpose : null,
				loanTerm: data.term.toString(),
				monthlyRepayment: data.monthlyRepayment.toString(),
				interestRate: data.interestRate.toString(),
				legalFee: data.legalFee.toString(),
				netDisbursement: data.netDisbursement.toString(),
				applicationFee: data.applicationFee?.toString(),
				originationFee: data.originationFee?.toString(),
				stampingFee: data.stampingFee?.toString(),
				legalFeeFixed: data.legalFeeFixed?.toString(),
				documents: data.documents || [],
				product: {
					code: data.product?.code || "",
					name: data.product?.name || "",
				},
			};

				setApplicationData(transformedData);

				// Get product code from application data
				const productCode = data.product?.code;

				if (!productCode) {
					console.warn(
						"Product code not found in application data, trying to use productId"
					);
					// Try to use productId as a fallback
					const fallbackProductId = data.productId;
					if (fallbackProductId) {
						// Try to fetch product details using productId
						try {
							const fallbackProductResponse = await fetch(
								`${apiUrl}/api/products/${fallbackProductId}`
							);

							if (fallbackProductResponse.ok) {
								const fallbackProductData =
									await fallbackProductResponse.json();
								setProductDetails(fallbackProductData);
								return; // Exit early if we successfully got the product data
							}
						} catch (fallbackErr) {
							console.error(
								"Error fetching fallback product data:",
								fallbackErr
							);
						}
					}

					throw new Error(
						"Product code not found in application data and fallback failed"
					);
				}

				// Fetch product details
				const productResponse = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/products?code=${productCode}`
				);


				if (!productResponse.ok) {
					throw new Error(
						`Failed to fetch product details: ${productResponse.status} ${productResponse.statusText}`
					);
				}

				const productData = await productResponse.json();

				// Check if productData is valid
				if (!productData) {
					throw new Error("Product data is empty");
				}

				// Check if productData has the required fields
				const requiredProductFields = [
					"id",
					"code",
					"name",
					"originationFee",
					"legalFee",
					"applicationFee",
				];
				const missingProductFields = requiredProductFields.filter(
					(field) =>
						productData[field] === undefined ||
						productData[field] === null
				);

				if (missingProductFields.length > 0) {
					throw new Error(
						`Product data is missing required fields: ${missingProductFields.join(
							", "
						)}`
					);
				}

				setProductDetails(productData);
				return; // Add explicit return statement
			} catch (err) {
				console.error("Detailed error in fetchData:", err);
				setError(
					"Failed to load application details. Please try again."
				);
				return; // Add explicit return statement for error case
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, [searchParams]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!termsAccepted) {
			setError("Please accept the terms and conditions to proceed");
			return;
		}

		try {
			setIsLoading(true);
			const applicationId = searchParams.get("applicationId");
			if (!applicationId) {
				throw new Error("Application ID not found");
			}

			const token = localStorage.getItem("token") || Cookies.get("token");
			if (!token) {
				throw new Error("Authentication token not found");
			}

			// Complete application and redirect to loans page
			const isCollateralLoan = productDetails?.collateralRequired === true;
			const newStatus = isCollateralLoan ? "COLLATERAL_REVIEW" : "PENDING_APPROVAL";

			// Update the application status and terms acceptance
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						acceptTerms: true,
						status: newStatus,
						appStep: 5, // Set to final step
					}),
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData?.message || "Failed to submit application"
				);
			}

			// Start the new multi-step signing flow
			onSubmit({ termsAccepted });
			
			toast.success("Application submitted successfully!");
			
			// Always redirect to loans dashboard with applications tab open
			router.push("/dashboard/loans?tab=applications");
		} catch (err) {
			console.error("Error submitting application:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to submit application. Please try again."
			);
			toast.error("Failed to submit application. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const formatCurrency = (amount: string | number) => {
		if (!amount) return "RM 0.00";
		const num = typeof amount === "string" ? parseFloat(amount) : amount;
		if (isNaN(num)) return "RM 0.00";
		return `RM ${num.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})}`;
	};

	const calculateFees = () => {
		if (!applicationData) return null;

		// Use the fees stored in the database instead of calculating them
		const interestRate = parseFloat(applicationData.interestRate);
		const netDisbursement = parseFloat(applicationData.netDisbursement);
		
		// Check if new fee structure is used - only if values are actually present (not null/undefined)
		const hasStampingFee = applicationData.stampingFee !== undefined && applicationData.stampingFee !== null && applicationData.stampingFee !== "";
		const hasLegalFeeFixed = applicationData.legalFeeFixed !== undefined && applicationData.legalFeeFixed !== null && applicationData.legalFeeFixed !== "";
		
		const stampingFee = hasStampingFee ? parseFloat(applicationData.stampingFee!) : 0;
		const legalFeeFixed = hasLegalFeeFixed ? parseFloat(applicationData.legalFeeFixed!) : 0;
		
		// Old fees for backward compatibility
		const legalFee = parseFloat(applicationData.legalFee || "0");
		const applicationFee = parseFloat(applicationData.applicationFee || "0");
		const originationFee = parseFloat(applicationData.originationFee || "0");
		
		// Determine which fee structure is being used - check if new fees actually exist
		const isNewFeeStructure = hasStampingFee || hasLegalFeeFixed;

		return {
			interestRate,
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

	// Use monthlyRepayment from the database instead of calculating it
	const monthlyRepayment = applicationData?.monthlyRepayment
		? parseFloat(applicationData?.monthlyRepayment || "0")
		: 0;

	const fees = calculateFees();

	const handleTooltipClick = (tooltipId: string) => {
		setOpenTooltip(openTooltip === tooltipId ? null : tooltipId);
	};

	const handleBack = () => {
		const currentStep = parseInt(searchParams.get("step") || "1", 10);
		let newStep = Math.max(currentStep - 1, 1);
		const applicationId = searchParams.get("applicationId");
		const productCode = searchParams.get("productCode");

		// Check if we need to skip the document step (step 4) for collateral loans
		if (currentStep === 5 && newStep === 4) {
			// Check if this is a collateral loan or a product with no required documents
			const isCollateralLoan = productDetails?.collateralRequired === true;
			const hasRequiredDocuments = productDetails?.requiredDocuments && 
				Array.isArray(productDetails.requiredDocuments) && 
				productDetails.requiredDocuments.length > 0;
			
			// Skip document step if it's a collateral loan or no documents required
			if (isCollateralLoan || !hasRequiredDocuments) {
				newStep = 3; // Go back to step 3 (Personal Information) instead
			}
		}

		// Build the URL with proper query parameters
		const params = new URLSearchParams();
		if (applicationId) params.set("applicationId", applicationId);
		if (productCode) params.set("productCode", productCode);
		params.set("step", newStep.toString());

		router.push(`/dashboard/apply?${params.toString()}`);
	};

	if (isLoading) {
		return (
			<div className="flex justify-center items-center min-h-[200px]">
				<div className="flex flex-col items-center space-y-4">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary"></div>
					<p className="text-gray-700 font-body">
						Loading application details...
					</p>
				</div>
			</div>
		);
	}

	if (!productDetails || !applicationData) {
		// If we have applicationData but no productDetails, try to fetch product details again
		if (applicationData && !productDetails) {
			// Use a timeout to avoid infinite loops
			setTimeout(() => {
				const fetchProductDetails = async () => {
					try {
						const productCode = applicationData.product?.code;
						if (productCode) {
							const response = await fetch(
								`${process.env.NEXT_PUBLIC_API_URL}/api/products?code=${productCode}`
							);

							if (response.ok) {
								const data = await response.json();
								setProductDetails(data);
							}
						}
					} catch (err) {
						console.error("Error fetching product details:", err);
					}
				};

				fetchProductDetails();
			}, 1000);
		}

		return (
			<div className="space-y-6">
				<h2 className="text-xl font-semibold text-gray-700 mb-4 font-heading">
					Review Application
				</h2>
				<div className="bg-red-50 border border-red-200 rounded-xl p-4">
					<p className="text-red-600 font-body">
						Failed to load application details. Please try again
						later.
					</p>
				</div>
				{error && (
					<div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
						<p className="text-blue-600 font-body">
							Error details: {error}
						</p>
					</div>
				)}
				<button
					onClick={() => window.location.reload()}
					className="px-6 py-3 bg-purple-primary text-white rounded-xl hover:bg-purple-700 transition-all duration-200 font-medium font-body"
				>
					Retry Loading
				</button>
			</div>
		);
	}

	return (
		<Box
			component="form"
			onSubmit={handleSubmit}
			className="space-y-6"
			sx={lightThemeOverrides}
		>
				{/* Consistent Header Design */}
				<div className="flex items-center space-x-2 mb-6">
					<div className="p-2 bg-purple-primary/10 rounded-lg border border-purple-primary/20">
						<svg
							className="h-5 w-5 text-purple-primary"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<h2 className="text-lg font-heading text-purple-primary font-semibold">
						Review Application
					</h2>
				</div>

				{error && (
					<Alert severity="error" className="mb-4">
						{error}
					</Alert>
				)}

				<div className="space-y-6">
					<Paper className="p-6">
						<Typography variant="h6" className="text-blue-400 mb-6">
							Loan Details
						</Typography>
						<div className="space-y-6">
							<div className="space-y-4">
								<div className="flex justify-between">
									<Typography className="text-gray-600">
										Product
									</Typography>
									<Typography className="text-gray-900 font-medium">
										{productDetails.name}
									</Typography>
								</div>
								<div className="flex justify-between">
									<Typography className="text-gray-600">
										Loan Amount
									</Typography>
									<Typography className="text-gray-900 font-medium">
										{formatCurrency(
											applicationData.loanAmount
										)}
									</Typography>
								</div>
								{applicationData.loanPurpose && (
									<div className="flex justify-between">
										<Typography className="text-gray-600">
											Loan Purpose
										</Typography>
										<Typography className="text-gray-900 font-medium">
											{applicationData.loanPurpose}
										</Typography>
									</div>
								)}
								<div className="flex justify-between">
									<Typography className="text-gray-600">
										Loan Term
									</Typography>
									<Typography className="text-gray-900 font-medium">
										{applicationData.loanTerm} months
									</Typography>
								</div>
								<div className="flex justify-between">
									<Typography className="text-gray-600">
										Interest Rate
									</Typography>
									<Typography className="text-gray-900 font-medium">
										{productDetails.interestRate}% monthly
									</Typography>
								</div>
							</div>

							{fees && (
								<>
									<div className="pt-4 border-t border-gray-200">
										<div className="space-y-4">
											{fees.isNewFeeStructure ? (
												<>
													{/* New Fee Structure */}
													<div className="flex justify-between">
														<div className="flex items-center gap-1">
															<Typography className="text-gray-600">
																Legal Fee
															</Typography>
															<Tooltip.Provider>
																<Tooltip.Root
																	open={openTooltip === "legalFixed"}
																	onOpenChange={() => handleTooltipClick("legalFixed")}
																>
																	<Tooltip.Trigger asChild>
																		<InfoIcon
																			className="text-gray-400 cursor-pointer"
																			fontSize="small"
																			onClick={() => handleTooltipClick("legalFixed")}
																		/>
																	</Tooltip.Trigger>
																	<Tooltip.Portal>
																		<Tooltip.Content
																			className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs"
																			sideOffset={5}
																		>
																			A fixed fee paid to lawyers to cover legal costs for attestation and processing your loan documents.
																			<Tooltip.Arrow className="fill-gray-800" />
																		</Tooltip.Content>
																	</Tooltip.Portal>
																</Tooltip.Root>
															</Tooltip.Provider>
														</div>
														<Typography className="text-red-600">
															({formatCurrency(fees.legalFeeFixed)})
														</Typography>
													</div>
													<div className="flex justify-between">
														<div className="flex items-center gap-1">
															<Typography className="text-gray-600">
																Stamping Fee
															</Typography>
															<Tooltip.Provider>
																<Tooltip.Root
																	open={openTooltip === "stamping"}
																	onOpenChange={() => handleTooltipClick("stamping")}
																>
																	<Tooltip.Trigger asChild>
																		<InfoIcon
																			className="text-gray-400 cursor-pointer"
																			fontSize="small"
																			onClick={() => handleTooltipClick("stamping")}
																		/>
																	</Tooltip.Trigger>
																	<Tooltip.Portal>
																		<Tooltip.Content
																			className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs"
																			sideOffset={5}
																		>
																			A fee paid to LHDN for stamping and certifying your loan agreement documents.
																			<Tooltip.Arrow className="fill-gray-800" />
																		</Tooltip.Content>
																	</Tooltip.Portal>
																</Tooltip.Root>
															</Tooltip.Provider>
														</div>
														<Typography className="text-red-600">
															({formatCurrency(fees.stampingFee)})
														</Typography>
													</div>
												</>
											) : (
												<>
													{/* Old Fee Structure - for backward compatibility */}
													{fees.originationFee > 0 && (
														<div className="flex justify-between">
															<div className="flex items-center gap-1">
																<Typography className="text-gray-600">
																	Origination Fee
																</Typography>
															</div>
															<Typography className="text-red-600">
																({formatCurrency(fees.originationFee)})
															</Typography>
														</div>
													)}
													{fees.legalFee > 0 && (
														<div className="flex justify-between">
															<div className="flex items-center gap-1">
																<Typography className="text-gray-600">
																	Legal Fee
																</Typography>
															</div>
															<Typography className="text-red-600">
																({formatCurrency(fees.legalFee)})
															</Typography>
														</div>
													)}
													{fees.applicationFee > 0 && (
														<div className="flex justify-between">
															<div className="flex items-center gap-1">
																<Typography className="text-gray-600">
																	Application Fee
																</Typography>
															</div>
															<Typography className="text-red-600">
																({formatCurrency(fees.applicationFee)})
															</Typography>
														</div>
													)}
												</>
											)}
										</div>
									</div>

									<div className="pt-4 border-t border-gray-200">
										<div className="space-y-4">
											{/* Net Loan Disbursement - Highlighted */}
											<div className="bg-blue-tertiary/5 rounded-xl p-4 border border-blue-tertiary/20">
												<div className="flex justify-between items-center">
													<div className="flex items-center gap-1">
														<Typography className="text-blue-tertiary font-normal text-lg font-body">
															Net Loan
															Disbursement
														</Typography>
														<Tooltip.Provider>
															<Tooltip.Root
																open={
																	openTooltip ===
																	"disbursement"
																}
																onOpenChange={() =>
																	handleTooltipClick(
																		"disbursement"
																	)
																}
															>
																<Tooltip.Trigger
																	asChild
																>
																	<InfoIcon
																		className="text-gray-400 cursor-pointer"
																		fontSize="small"
																		onClick={() =>
																			handleTooltipClick(
																				"disbursement"
																			)
																		}
																	/>
																</Tooltip.Trigger>
																<Tooltip.Portal>
																	<Tooltip.Content
																		className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs"
																		sideOffset={
																			5
																		}
																	>
																		The
																		actual
																		amount
																		you will
																		receive
																		after
																		deducting
																		
																		legal
																	 and
																		stamping
																		fees from
																		your
																		loan
																		amount.
																		<Tooltip.Arrow className="fill-gray-800" />
																	</Tooltip.Content>
																</Tooltip.Portal>
															</Tooltip.Root>
														</Tooltip.Provider>
													</div>
													<Typography className="text-blue-tertiary font-normal text-xl font-heading">
														{formatCurrency(
															fees.netDisbursement
														)}
													</Typography>
												</div>
											</div>

											{/* Monthly Repayment - Highlighted */}
											<div className="bg-purple-primary/5 rounded-xl p-4 border border-purple-primary/20">
												<div className="flex justify-between items-center">
													<div className="flex items-center gap-1">
														<Typography className="text-purple-primary font-normal text-lg font-body">
															Monthly Repayment
														</Typography>
														<Tooltip.Provider>
															<Tooltip.Root
																open={
																	openTooltip ===
																	"repayment"
																}
																onOpenChange={() =>
																	handleTooltipClick(
																		"repayment"
																	)
																}
															>
																<Tooltip.Trigger
																	asChild
																>
																	<InfoIcon
																		className="text-gray-400 cursor-pointer"
																		fontSize="small"
																		onClick={() =>
																			handleTooltipClick(
																				"repayment"
																			)
																		}
																	/>
																</Tooltip.Trigger>
																<Tooltip.Portal>
																	<Tooltip.Content
																		className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs"
																		sideOffset={
																			5
																		}
																	>
																		The
																		amount
																		you need
																		to pay
																		each
																		month,
																		which
																		includes
																		both
																		principal
																		and
																		interest.
																		<Tooltip.Arrow className="fill-gray-800" />
																	</Tooltip.Content>
																</Tooltip.Portal>
															</Tooltip.Root>
														</Tooltip.Provider>
													</div>
													<Typography className="text-purple-primary font-normal text-xl font-heading">
														{formatCurrency(
															monthlyRepayment
														)}
													</Typography>
												</div>
											</div>
										</div>
									</div>
								</>
							)}
						</div>
					</Paper>

					<Paper className="p-6">
						<Typography variant="h6" className="text-blue-400 mb-6">
							Personal Information
						</Typography>
						<div className="space-y-4">
							<div className="flex justify-between">
								<Typography className="text-gray-600">
									Full Name
								</Typography>
								<Typography className="text-gray-900 font-medium">
									{userData.fullName}
								</Typography>
							</div>
							<div className="flex justify-between">
								<Typography className="text-gray-600">
									Email
								</Typography>
								<Typography className="text-gray-900 font-medium">
									{userData.email}
								</Typography>
							</div>
							<div className="flex justify-between">
								<Typography className="text-gray-600">
									Phone Number
								</Typography>
								<Typography className="text-gray-900 font-medium">
									{userData.phoneNumber}
								</Typography>
							</div>
							<div className="flex justify-between">
								<Typography className="text-gray-600">
									Employment Status
								</Typography>
								<Typography className="text-gray-900 font-medium">
									{userData.employmentStatus}
								</Typography>
							</div>
							{userData.employerName && (
								<div className="flex justify-between">
									<Typography className="text-gray-600">
										Employer
									</Typography>
									<Typography className="text-gray-900 font-medium">
										{userData.employerName}
									</Typography>
								</div>
							)}
							{userData.monthlyIncome && (
								<div className="flex justify-between">
									<Typography className="text-gray-600">
										Monthly Income
									</Typography>
									<Typography className="text-gray-900 font-medium">
										{formatCurrency(userData.monthlyIncome)}
									</Typography>
								</div>
							)}
							<div className="pt-4 border-t border-gray-200">
								<Typography className="text-gray-900 font-medium mb-2">
									Address
								</Typography>
								<Typography className="text-gray-600">
									{userData.address1}
									{userData.address2 && (
										<>
											<br />
											{userData.address2}
										</>
									)}
									<br />
									{userData.city}, {userData.state}{" "}
									{userData.postalCode}
								</Typography>
							</div>
						</div>
					</Paper>

					<Paper className="p-6">
						<Typography
							variant="h6"
							className="text-blue-400"
							gutterBottom
						>
							Documents
						</Typography>
						<Typography
							variant="body1"
							className="text-gray-600 mb-2 leading-relaxed"
						>
							While documents can be submitted at a later stage,
							providing them now will expedite your loan
							application review process and help us serve you
							faster.
						</Typography>
						<div className="space-y-0">
							{productDetails?.requiredDocuments?.map(
								(docType: string, index: number) => {
									const uploadedDocs =
										applicationData.documents.filter(
											(doc) => doc.type === docType
										);
									const hasUploads = uploadedDocs.length > 0;
									return (
										<div key={docType}>
											<div className="py-4 space-y-2">
												<div className="flex justify-between items-center">
													<Typography
														variant="body1"
														className="text-gray-700 font-medium"
													>
														{docType}
													</Typography>
													<div
														className={`px-3 py-1 rounded-full text-sm font-medium ${
															hasUploads
																? "bg-green-100 text-green-800"
																: "bg-yellow-100 text-yellow-800"
														}`}
													>
														{hasUploads
															? `${uploadedDocs.length} file(s) uploaded`
															: "Not Uploaded"}
													</div>
												</div>
												{hasUploads && (
													<div className="pl-4 space-y-2">
														{uploadedDocs.map(
															(doc) => (
																<div
																	key={doc.id}
																	className="flex justify-between items-center text-sm"
																>
																	<span className="text-gray-500">
																		{doc.fileUrl
																			.split(
																				"/"
																			)
																			.pop()}
																	</span>
																	<Link
																		href={`${
																			process
																				.env
																				.NEXT_PUBLIC_API_URL
																		}/api/loan-applications/${searchParams.get(
																			"applicationId"
																		)}/documents/${
																			doc.id
																		}`}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="text-indigo-600 hover:text-indigo-500"
																	>
																		View
																	</Link>
																</div>
															)
														)}
													</div>
												)}
											</div>
											{index <
												(productDetails
													?.requiredDocuments
													?.length ?? 0) -
													1 && (
												<div className="border-b border-gray-200"></div>
											)}
										</div>
									);
								}
							)}
						</div>
					</Paper>

					<FormControlLabel
						control={
							<Checkbox
								checked={termsAccepted}
								onChange={(e) => {
									setTermsAccepted(e.target.checked);
									if (error) setError(null);
								}}
								className="text-indigo-600"
							/>
						}
						label={
							<Typography className="text-gray-600">
								I have read and agree to the{" "}
								<Link
									href="/terms"
									target="_blank"
									className="text-indigo-600 hover:text-indigo-500"
								>
									Terms and Conditions
								</Link>{" "}
								and{" "}
								<Link
									href="/privacy"
									target="_blank"
									className="text-indigo-600 hover:text-indigo-500"
								>
									Privacy Policy
								</Link>
							</Typography>
						}
					/>
				</div>

				<Box className="flex justify-between pt-6">
					<Button
						type="button"
						variant="outlined"
						onClick={handleBack}
						disabled={isLoading}
						className="text-gray-700 border-gray-300 hover:bg-gray-50"
					>
						Back
					</Button>
					<Button
						type="submit"
						variant="contained"
						disabled={isLoading || !termsAccepted}
						className="bg-indigo-600 hover:bg-indigo-700 text-white"
					>
						{isLoading ? (
							<div className="flex items-center">
								<span className="mr-2">Submitting...</span>
								<div
									className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
									role="status"
								>
									<span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
										Loading...
									</span>
								</div>
							</div>
						) : (
							"Submit Application"
						)}
					</Button>
				</Box>
			</Box>
	);
}

export default function ReviewAndSubmitForm(props: ReviewAndSubmitFormProps) {
	return (
		<Suspense
			fallback={
				<div className="flex justify-center items-center min-h-[200px]">
					<div className="flex flex-col items-center space-y-4">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary"></div>
						<p className="text-gray-700 font-body">Loading...</p>
					</div>
				</div>
			}
		>
			<ReviewAndSubmitFormContent {...props} />
		</Suspense>
	);
}
