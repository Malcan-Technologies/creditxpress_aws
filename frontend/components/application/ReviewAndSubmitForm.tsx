import { useState, useEffect } from "react";
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
import InfoIcon from "@mui/icons-material/Info";
import { useSearchParams } from "next/navigation";
import * as Tooltip from "@radix-ui/react-tooltip";
import Cookies from "js-cookie";

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
}

export default function ReviewAndSubmitForm({
	onSubmit,
	onBack,
	userData,
}: ReviewAndSubmitFormProps) {
	const searchParams = useSearchParams();
	const [termsAccepted, setTermsAccepted] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [productDetails, setProductDetails] = useState<ProductDetails | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(true);
	const [openTooltip, setOpenTooltip] = useState<string | null>(null);
	const [applicationData, setApplicationData] = useState<{
		productId: string;
		loanAmount: string;
		loanPurpose: string;
		loanTerm: string;
		monthlyRepayment: string;
		interestRate: string;
		legalFee: string;
		netDisbursement: string;
		documents: Array<{
			id: string;
			name: string;
			status: string;
		}>;
		product: {
			code: string;
			name: string;
		};
	} | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				console.log("Starting to fetch application data...");

				// Verify API URL
				const apiUrl = process.env.NEXT_PUBLIC_API_URL;
				console.log("API URL:", apiUrl);
				if (!apiUrl) {
					throw new Error("API URL is not configured");
				}

				// Get application ID from URL params
				const applicationId = searchParams.get("applicationId");
				console.log("Application ID from URL:", applicationId);

				if (!applicationId) {
					throw new Error("Application ID not found in URL");
				}

				// Get token
				const token = localStorage.getItem("token");
				console.log("Token available:", !!token);
				if (!token) {
					throw new Error("Authentication token not found");
				}

				// Log the full URL being used
				const fullUrl = `${apiUrl}/api/loan-applications/${applicationId}`;
				console.log("Full API URL:", fullUrl);

				// Fetch application data
				console.log(`Fetching from: ${fullUrl}`);
				const applicationResponse = await fetch(fullUrl, {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				console.log(
					"Application response status:",
					applicationResponse.status
				);

				if (!applicationResponse.ok) {
					throw new Error(
						`Failed to fetch application data: ${applicationResponse.status} ${applicationResponse.statusText}`
					);
				}

				const data = await applicationResponse.json();
				console.log("Raw application data:", data);

				// Validate the data structure
				console.log("Validating application data structure...");
				const requiredFields = [
					"productId",
					"amount",
					"purpose",
					"term",
					"monthlyRepayment",
					"interestRate",
					"legalFee",
					"netDisbursement",
				];
				const missingFields = requiredFields.filter(
					(field) => data[field] === undefined || data[field] === null
				);

				if (missingFields.length > 0) {
					console.error("Missing required fields:", missingFields);
					throw new Error(
						`Application data is missing required fields: ${missingFields.join(
							", "
						)}`
					);
				}

				// Check if product information exists
				if (!data.product) {
					console.error(
						"Product information is missing in the application data"
					);
					throw new Error(
						"Product information is missing in the application data"
					);
				}

				// Transform the data to match our expected format
				const transformedData = {
					productId: data.productId,
					loanAmount: data.amount.toString(),
					loanPurpose: data.purpose,
					loanTerm: data.term.toString(),
					monthlyRepayment: data.monthlyRepayment.toString(),
					interestRate: data.interestRate.toString(),
					legalFee: data.legalFee.toString(),
					netDisbursement: data.netDisbursement.toString(),
					documents: data.documents || [],
					product: {
						code: data.product?.code || "",
						name: data.product?.name || "",
					},
				};

				console.log("Transformed application data:", transformedData);
				setApplicationData(transformedData);

				// Get product code from application data
				const productCode = data.product?.code;
				console.log("Product code from application data:", productCode);

				if (!productCode) {
					console.warn(
						"Product code not found in application data, trying to use productId"
					);
					// Try to use productId as a fallback
					const fallbackProductId = data.productId;
					if (fallbackProductId) {
						console.log(
							"Using productId as fallback:",
							fallbackProductId
						);
						// Try to fetch product details using productId
						try {
							const fallbackProductResponse = await fetch(
								`${apiUrl}/api/products/${fallbackProductId}`
							);

							if (fallbackProductResponse.ok) {
								const fallbackProductData =
									await fallbackProductResponse.json();
								console.log(
									"Fallback product data:",
									fallbackProductData
								);
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
				console.log(
					`Fetching product details for code: ${productCode}`
				);
				const productResponse = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/products?code=${productCode}`
				);

				console.log("Product response status:", productResponse.status);

				if (!productResponse.ok) {
					throw new Error(
						`Failed to fetch product details: ${productResponse.status} ${productResponse.statusText}`
					);
				}

				const productData = await productResponse.json();
				console.log("Product data:", productData);

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
					console.error(
						"Missing required product fields:",
						missingProductFields
					);
					throw new Error(
						`Product data is missing required fields: ${missingProductFields.join(
							", "
						)}`
					);
				}

				console.log("Setting product details:", productData);
				setProductDetails(productData);
			} catch (err) {
				console.error("Detailed error in fetchData:", err);
				setError(
					"Failed to load application details. Please try again."
				);
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, [searchParams]);

	// Add this useEffect to verify productDetails is set correctly
	useEffect(() => {
		if (productDetails) {
			console.log(
				"Product details successfully set in state:",
				productDetails
			);
		}
	}, [productDetails]);

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
						status: "PENDING_APP_FEE",
						appStep: 5, // Set to final step
					}),
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error("Error response:", errorData);
				throw new Error(
					errorData?.message || "Failed to submit application"
				);
			}

			// Call the onSubmit callback with the terms acceptance
			onSubmit({ termsAccepted });

			// Redirect to the dashboard page
			window.location.href = "/dashboard";
		} catch (err) {
			console.error("Error submitting application:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to submit application. Please try again."
			);
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
		if (!productDetails || !applicationData) return null;

		const amount = parseFloat(applicationData.loanAmount);
		const interestRate = parseFloat(applicationData.interestRate);
		const legalFee = parseFloat(applicationData.legalFee);
		const netDisbursement = parseFloat(applicationData.netDisbursement);
		const originationFee = amount - netDisbursement - legalFee;
		const applicationFee = Number(productDetails.applicationFee) || 0;

		return {
			interestRate,
			legalFee,
			netDisbursement,
			originationFee,
			applicationFee,
			totalFees: originationFee + legalFee + applicationFee,
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

	if (isLoading) {
		console.log("Component is in loading state");
		return (
			<Box className="flex justify-center items-center p-6">
				<Typography>Loading application details...</Typography>
			</Box>
		);
	}

	console.log("Rendering with applicationData:", applicationData);
	console.log("Rendering with productDetails:", productDetails);

	if (!productDetails || !applicationData) {
		console.log(
			"Missing data - productDetails:",
			!!productDetails,
			"applicationData:",
			!!applicationData
		);

		// If we have applicationData but no productDetails, try to fetch product details again
		if (applicationData && !productDetails) {
			console.log(
				"We have application data but no product details, attempting to fetch product details again"
			);

			// Use a timeout to avoid infinite loops
			setTimeout(() => {
				const fetchProductDetails = async () => {
					try {
						const productCode = applicationData.product?.code;
						if (productCode) {
							console.log(
								"Fetching product details for code:",
								productCode
							);
							const response = await fetch(
								`${process.env.NEXT_PUBLIC_API_URL}/api/products?code=${productCode}`
							);

							if (response.ok) {
								const data = await response.json();
								console.log("Product data fetched:", data);
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
			<Box className="p-6">
				<Alert severity="error" className="mb-4">
					Failed to load application details. Please try again later.
				</Alert>
				{error && (
					<Alert severity="info" className="mb-4">
						Error details: {error}
					</Alert>
				)}
				<Button
					variant="contained"
					color="primary"
					onClick={() => window.location.reload()}
					className="mt-4"
				>
					Retry Loading
				</Button>
			</Box>
		);
	}

	return (
		<Box component="form" onSubmit={handleSubmit} className="space-y-6">
			<Typography variant="h6" className="text-gray-900 mb-4">
				Review Application
			</Typography>

			{error && (
				<Alert severity="error" className="mb-4">
					{error}
				</Alert>
			)}

			<div className="space-y-6">
				<Paper className="p-6">
					<Typography variant="h6" className="text-gray-900 mb-6">
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
									{formatCurrency(applicationData.loanAmount)}
								</Typography>
							</div>
							<div className="flex justify-between">
								<Typography className="text-gray-600">
									Loan Purpose
								</Typography>
								<Typography className="text-gray-900 font-medium">
									{applicationData.loanPurpose}
								</Typography>
							</div>
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
										<div className="flex justify-between">
											<div className="flex items-center gap-1">
												<Typography className="text-gray-600">
													Origination Fee (
													{
														productDetails.originationFee
													}
													%)
												</Typography>
												<Tooltip.Provider>
													<Tooltip.Root
														open={
															openTooltip ===
															"origination"
														}
														onOpenChange={() =>
															handleTooltipClick(
																"origination"
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
																		"origination"
																	)
																}
															/>
														</Tooltip.Trigger>
														<Tooltip.Portal>
															<Tooltip.Content
																className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs"
																sideOffset={5}
															>
																A one-time fee
																charged by the
																lender for
																processing your
																loan
																application.
																<Tooltip.Arrow className="fill-gray-800" />
															</Tooltip.Content>
														</Tooltip.Portal>
													</Tooltip.Root>
												</Tooltip.Provider>
											</div>
											<Typography className="text-red-600">
												(
												{formatCurrency(
													fees.originationFee
												)}
												)
											</Typography>
										</div>
										<div className="flex justify-between">
											<div className="flex items-center gap-1">
												<Typography className="text-gray-600">
													Legal Fee (
													{productDetails.legalFee}%)
												</Typography>
												<Tooltip.Provider>
													<Tooltip.Root
														open={
															openTooltip ===
															"legal"
														}
														onOpenChange={() =>
															handleTooltipClick(
																"legal"
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
																		"legal"
																	)
																}
															/>
														</Tooltip.Trigger>
														<Tooltip.Portal>
															<Tooltip.Content
																className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs"
																sideOffset={5}
															>
																A fee charged to
																cover the legal
																costs associated
																with preparing
																and processing
																your loan
																documents.
																<Tooltip.Arrow className="fill-gray-800" />
															</Tooltip.Content>
														</Tooltip.Portal>
													</Tooltip.Root>
												</Tooltip.Provider>
											</div>
											<Typography className="text-red-600">
												({formatCurrency(fees.legalFee)}
												)
											</Typography>
										</div>
										<div className="flex justify-between">
											<div className="flex items-center gap-1">
												<Typography className="text-gray-600">
													Application Fee (paid
													upfront)
												</Typography>
												<Tooltip.Provider>
													<Tooltip.Root
														open={
															openTooltip ===
															"application"
														}
														onOpenChange={() =>
															handleTooltipClick(
																"application"
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
																		"application"
																	)
																}
															/>
														</Tooltip.Trigger>
														<Tooltip.Portal>
															<Tooltip.Content
																className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs"
																sideOffset={5}
															>
																A non-refundable
																fee charged when
																you submit your
																loan
																application.
																This fee is paid
																separately
																before loan
																disbursement.
																<Tooltip.Arrow className="fill-gray-800" />
															</Tooltip.Content>
														</Tooltip.Portal>
													</Tooltip.Root>
												</Tooltip.Provider>
											</div>
											<Typography className="text-red-600">
												(
												{formatCurrency(
													fees.applicationFee
												)}
												)
											</Typography>
										</div>
									</div>
								</div>

								<div className="pt-4 border-t border-gray-200">
									<div className="space-y-4">
										<div className="flex justify-between">
											<div className="flex items-center gap-1">
												<Typography className="text-gray-900 font-bold">
													Net Loan Disbursement
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
																sideOffset={5}
															>
																The actual
																amount you will
																receive after
																deducting the
																origination fee
																and legal fee
																from your loan
																amount.
																<Tooltip.Arrow className="fill-gray-800" />
															</Tooltip.Content>
														</Tooltip.Portal>
													</Tooltip.Root>
												</Tooltip.Provider>
											</div>
											<Typography className="text-green-600 font-bold">
												{formatCurrency(
													fees.netDisbursement
												)}
											</Typography>
										</div>
										<div className="flex justify-between pt-2">
											<div className="flex items-center gap-1">
												<Typography className="text-gray-900 font-bold">
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
																sideOffset={5}
															>
																The amount you
																need to pay each
																month, which
																includes both
																principal and
																interest.
																<Tooltip.Arrow className="fill-gray-800" />
															</Tooltip.Content>
														</Tooltip.Portal>
													</Tooltip.Root>
												</Tooltip.Provider>
											</div>
											<Typography className="text-red-600 font-bold">
												(
												{formatCurrency(
													monthlyRepayment
												)}
												)
											</Typography>
										</div>
									</div>
								</div>
							</>
						)}
					</div>
				</Paper>

				<Paper className="p-6">
					<Typography variant="h6" className="text-gray-900 mb-6">
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
					<Typography variant="h6" className="text-gray-900 mb-4">
						Documents
					</Typography>
					<div className="space-y-2">
						{applicationData.documents.map((doc) => (
							<div
								key={doc.id}
								className="flex justify-between items-center"
							>
								<Typography className="text-gray-600">
									{doc.name}
								</Typography>
								<Typography
									className={
										doc.status === "success"
											? "text-green-600"
											: "text-yellow-600"
									}
								>
									{doc.status === "success"
										? "Uploaded"
										: "Pending"}
								</Typography>
							</div>
						))}
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
					onClick={onBack}
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
