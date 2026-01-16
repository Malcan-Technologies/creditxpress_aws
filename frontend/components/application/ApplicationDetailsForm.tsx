import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Product {
	id: string;
	name: string;
	description: string;
	maxAmount: number;
	minAmount: number;
	features: string[];
	requirements?: string[];
	loanTypes?: string[];
	repaymentTerms: number[]; // Array of months
	interestRate: number; // Monthly interest rate in percentage
	legalFee: number; // Legal fee in percentage (old - deprecated)
	originationFee: number; // Origination fee in percentage (old - deprecated)
	applicationFee: number; // Application fee as fixed amount (old - deprecated)
	stampingFee: number; // Stamping fee in percentage (always percentage)
	legalFeeFixed: number; // Legal fee as fixed amount (old - deprecated)
	legalFeeType?: 'PERCENTAGE' | 'FIXED'; // New: determines how legal fee is calculated
	legalFeeValue?: number; // New: the legal fee value (interpreted based on legalFeeType)
}

interface ApplicationDetails {
	loanAmount: string;
	loanPurpose: string | null;
	loanTerm: string;
	monthlyRepayment: string;
	interestRate: string;
	legalFee: string; // Keep for backward compatibility
	originationFee: string; // Keep for backward compatibility
	stampingFee: string;
	legalFeeFixed: string;
	netDisbursement: string;
}

interface ApplicationDetailsFormProps {
	onSubmit: (values: ApplicationDetails) => void;
	onBack: () => void;
	selectedProduct: Product;
}

// Create a client component for handling searchParams
function ApplicationDetailsFormContent({
	onSubmit,
	onBack,
	selectedProduct,
}: ApplicationDetailsFormProps) {
	const searchParams = useSearchParams();
	const [formValues, setFormValues] = useState<ApplicationDetails>({
		loanAmount: "",
		loanPurpose: "",
		loanTerm: "",
		monthlyRepayment: "",
		interestRate: "",
		legalFee: "",
		originationFee: "",
		stampingFee: "",
		legalFeeFixed: "",
		netDisbursement: "",
	});
	const [errors, setErrors] = useState<Partial<ApplicationDetails>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Helper function to get valid loan types (non-empty strings)
	const getValidLoanTypes = () => {
		return (selectedProduct.loanTypes ?? []).filter(type => type && type.trim() !== "");
	};

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				setError(null);

				// Get application ID from URL params
				const applicationId = searchParams.get("applicationId");

				// Get product code from URL params
				const productCode = searchParams.get("productCode");
				if (!productCode) {
					throw new Error("Product code not found in URL");
				}

				// Fetch application data
				const token = localStorage.getItem("token");
				const applicationResponse = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
						},
					}
				);

				if (!applicationResponse.ok) {
					throw new Error("Failed to fetch application data");
				}

				const applicationData = await applicationResponse.json();

			// Set form values from application data if available
			if (applicationData) {
				setFormValues({
					loanAmount: applicationData.amount?.toString() || "",
					loanPurpose: applicationData.purpose && applicationData.purpose.trim() !== "" ? applicationData.purpose : "",
					loanTerm: applicationData.term?.toString() || "",
					monthlyRepayment:
						applicationData.monthlyRepayment?.toString() || "",
					interestRate:
						applicationData.interestRate?.toString() || "",
					legalFee: applicationData.legalFee?.toString() || "",
					originationFee:
						applicationData.originationFee?.toString() || "",
					stampingFee: applicationData.stampingFee?.toString() || "",
					legalFeeFixed: applicationData.legalFeeFixed?.toString() || "",
					netDisbursement:
						applicationData.netDisbursement?.toString() || "",
				});
			}
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "An error occurred"
				);
				console.error("Error fetching data:", err);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [searchParams]);

	// Helper function to format term display
	const formatTermDisplay = (months: number) => {
		return `${months} Month${months > 1 ? "s" : ""}`;
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormValues((prev) => ({ ...prev, [name]: value }));
		setErrors((prev) => ({ ...prev, [name]: "" }));
	};

	const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const { name, value } = e.target;
		setFormValues((prev) => ({ ...prev, [name]: value }));
		setErrors((prev) => ({ ...prev, [name]: "" }));
	};

	const validateForm = () => {
		const newErrors: Partial<ApplicationDetails> = {};
		let isValid = true;

		if (!formValues.loanAmount) {
			newErrors.loanAmount = "Loan amount is required";
			isValid = false;
		} else {
			const amount = parseFloat(formValues.loanAmount);
			if (isNaN(amount) || amount <= 0) {
				newErrors.loanAmount = "Please enter a valid amount";
				isValid = false;
			} else if (amount > selectedProduct.maxAmount) {
				newErrors.loanAmount = `Amount exceeds maximum limit of ${selectedProduct.maxAmount}`;
				isValid = false;
			}
		}

		if (
			getValidLoanTypes().length > 0 &&
			(!formValues.loanPurpose || formValues.loanPurpose.trim() === "")
		) {
			newErrors.loanPurpose = "Loan purpose is required";
			isValid = false;
		}

		if (!formValues.loanTerm) {
			newErrors.loanTerm = "Loan term is required";
			isValid = false;
		}

		setErrors(newErrors);
		return isValid;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (validateForm()) {
			const loanAmount = parseFloat(formValues.loanAmount);
			const termInMonths = parseInt(formValues.loanTerm);

			// Calculate monthly repayment
			const monthlyRepayment = calculateMonthlyRepayment(
				loanAmount,
				termInMonths
			);

			// Calculate legal fee based on legalFeeType
			const legalFeeValue = selectedProduct.legalFeeValue ?? selectedProduct.legalFeeFixed ?? 0;
			const legalFeeAmount = selectedProduct.legalFeeType === 'PERCENTAGE'
				? (loanAmount * legalFeeValue) / 100
				: legalFeeValue;

			// Stamping fee is always a percentage
			const stampingFeeAmount = (loanAmount * (selectedProduct.stampingFee || 0)) / 100;

			// Calculate net disbursement with new fees
			const netDisbursementValue = loanAmount - legalFeeAmount - stampingFeeAmount;

			const submissionValues = {
				...formValues,
				monthlyRepayment: monthlyRepayment.toFixed(2),
				interestRate: selectedProduct.interestRate.toString(), // Keep as percentage
				// New fee structure
				stampingFee: stampingFeeAmount.toFixed(2),
				legalFeeFixed: legalFeeAmount.toFixed(2), // Store calculated amount regardless of type
				// Old fees set to 0 for backward compatibility
				legalFee: "0",
				originationFee: "0",
				netDisbursement: netDisbursementValue.toFixed(2),
				loanPurpose:
					getValidLoanTypes().length > 0
						? (formValues.loanPurpose && formValues.loanPurpose.trim() !== "" ? formValues.loanPurpose : null)
						: null,
			};
			onSubmit(submissionValues);
		}
	};

	const calculateMonthlyRepayment = (
		principal: number,
		termInMonths: number
	) => {
		// Convert interest rate from percentage to decimal
		const monthlyInterestRate = selectedProduct.interestRate / 100;

		// Calculate total interest for the loan period (flat rate)
		const totalInterest = principal * monthlyInterestRate * termInMonths;

		// Monthly interest payment
		const monthlyInterest = totalInterest / termInMonths;

		// Monthly principal payment
		const monthlyPrincipal = principal / termInMonths;

		// Total monthly payment is principal + interest
		const monthlyPayment = monthlyPrincipal + monthlyInterest;

		return monthlyPayment;
	};

	const handleBack = () => {
		const currentStep = parseInt(searchParams.get("step") || "1", 10);
		const newStep = Math.max(currentStep - 1, 1);
		const newUrl = new URL(window.location.href);
		newUrl.searchParams.set("step", newStep.toString());
		window.location.href = newUrl.toString();
	};

	if (loading) {
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

	if (error) {
		return (
			<div className="space-y-6">
				<h2 className="text-xl font-semibold text-gray-700 mb-4 font-heading">
					Loan Details
				</h2>
				<div className="bg-red-50 border border-red-200 rounded-xl p-4">
					<p className="text-red-600 font-body">{error}</p>
				</div>
				<div className="flex justify-between pt-6">
					<button
						type="button"
						onClick={handleBack}
						className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium font-body"
					>
						Back
					</button>
				</div>
			</div>
		);
	}

	return (
		<div>
			<form onSubmit={handleSubmit} className="space-y-6">
					<div className="flex items-center space-x-2 mb-6 lg:mb-8">
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
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
						</div>
						<h2 className="text-lg lg:text-xl font-heading text-purple-primary font-semibold">
							Loan Details for {selectedProduct.name}
						</h2>
					</div>

				<div className="space-y-6">
					<div>
						<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
							Loan Amount
						</label>
						<input
							type="number"
							name="loanAmount"
							value={formValues.loanAmount}
							onChange={handleChange}
							min={selectedProduct.minAmount}
							max={selectedProduct.maxAmount}
							step={100}
							className="w-full px-4 py-3 lg:py-4 bg-white border border-gray-300 rounded-xl lg:rounded-2xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body text-sm lg:text-base"
							placeholder="Enter loan amount"
						/>
						{errors.loanAmount ? (
							<p className="mt-1 text-sm text-red-600 font-body">
								{errors.loanAmount}
							</p>
						) : (
							<p className="mt-1 text-sm text-gray-500 font-body">
								Enter amount between RM{" "}
								{selectedProduct.minAmount.toLocaleString()} and
								RM {selectedProduct.maxAmount.toLocaleString()}
							</p>
						)}
					</div>

					{getValidLoanTypes().length > 0 && (
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
								Loan Purpose
							</label>
							<select
								name="loanPurpose"
								value={formValues.loanPurpose || ""}
								onChange={handleSelectChange}
								className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body"
							>
								<option value="">Select loan purpose</option>
								{getValidLoanTypes().map((type) => (
									<option key={type} value={type}>
										{type}
									</option>
								))}
							</select>
							{errors.loanPurpose && (
								<p className="mt-1 text-sm text-red-600 font-body">
									{errors.loanPurpose}
								</p>
							)}
						</div>
					)}

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
							Loan Term
						</label>
						<select
							name="loanTerm"
							value={formValues.loanTerm}
							onChange={handleSelectChange}
							className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body"
						>
							<option value="">Select loan term</option>
							{selectedProduct.repaymentTerms.map((term) => (
								<option key={term} value={term.toString()}>
									{formatTermDisplay(term)}
								</option>
							))}
						</select>
						{errors.loanTerm && (
							<p className="mt-1 text-sm text-red-600 font-body">
								{errors.loanTerm}
							</p>
						)}
					</div>

					{formValues.loanAmount && formValues.loanTerm && (
						<div className="bg-blue-tertiary/5 rounded-xl p-6 border border-blue-tertiary/20">
							<h3 className="text-sm font-medium text-gray-700 mb-2 font-body">
								Monthly Repayment
							</h3>
							<p className="text-2xl font-semibold text-blue-tertiary font-heading">
								RM{" "}
								{calculateMonthlyRepayment(
									parseFloat(formValues.loanAmount),
									parseInt(formValues.loanTerm)
								).toLocaleString(undefined, {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								})}
							</p>
						</div>
					)}
				</div>

					<div className="border-t border-gray-100 pt-6 lg:pt-8">
						<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
							<button
								type="button"
								onClick={handleBack}
								className="w-full sm:w-auto px-6 py-3 lg:py-4 bg-white border border-gray-300 text-gray-700 rounded-xl lg:rounded-2xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium font-body text-sm lg:text-base"
							>
								Back
							</button>
							<button
								type="submit"
								className="w-full sm:w-auto px-8 py-3 lg:py-4 bg-purple-primary text-white rounded-xl lg:rounded-2xl hover:bg-purple-700 transition-all duration-200 font-medium font-body shadow-lg hover:shadow-xl text-sm lg:text-base"
							>
								Continue
							</button>
						</div>
					</div>
				</form>
			</div>
		);
	}

export default function ApplicationDetailsForm(
	props: ApplicationDetailsFormProps
) {
	return (
		<Suspense
			fallback={<div className="text-gray-700 font-body">Loading...</div>}
		>
			<ApplicationDetailsFormContent {...props} />
		</Suspense>
	);
}
