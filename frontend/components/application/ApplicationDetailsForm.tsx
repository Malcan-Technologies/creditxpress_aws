import { useState, useEffect } from "react";
import {
	Box,
	Button,
	TextField,
	Typography,
	MenuItem,
	FormHelperText,
	FormControl,
	InputLabel,
	Select,
	Paper,
} from "@mui/material";
import { SelectChangeEvent } from "@mui/material/Select";
import { useSearchParams } from "next/navigation";

interface Product {
	id: string;
	name: string;
	description: string;
	maxAmount: number;
	minAmount: number;
	features: string[];
	requirements: string[];
	loanTypes: string[];
	repaymentTerms: number[]; // Array of months
	interestRate: number; // Monthly interest rate in percentage
	legalFee: number; // Legal fee in percentage
	originationFee: number; // Origination fee in percentage
}

interface ApplicationDetails {
	loanAmount: string;
	loanPurpose: string;
	loanTerm: string;
	monthlyRepayment: string;
	interestRate: string;
	legalFee: string;
	originationFee: string;
	netDisbursement: string;
}

interface ApplicationDetailsFormProps {
	onSubmit: (values: ApplicationDetails) => void;
	onBack: () => void;
	selectedProduct: Product;
}

export default function ApplicationDetailsForm({
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
		netDisbursement: "",
	});
	const [errors, setErrors] = useState<Partial<ApplicationDetails>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				setError(null);

				// Get application ID from URL params
				const applicationId = searchParams.get("applicationId");
				console.log("Application ID from URL:", applicationId);

				// Get product code from URL params
				const productCode = searchParams.get("productCode");
				if (!productCode) {
					throw new Error("Product code not found in URL");
				}

				console.log("Fetching application data for ID:", applicationId);

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
				console.log("Application data:", applicationData);

				// Set form values from application data if available
				if (applicationData) {
					setFormValues({
						loanAmount: applicationData.amount?.toString() || "",
						loanPurpose: applicationData.purpose || "",
						loanTerm: applicationData.term?.toString() || "",
						monthlyRepayment:
							applicationData.monthlyRepayment?.toString() || "",
						interestRate:
							applicationData.interestRate?.toString() || "",
						legalFee: applicationData.legalFee?.toString() || "",
						originationFee:
							applicationData.originationFee?.toString() || "",
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

	const handleSelectChange = (e: SelectChangeEvent<string>) => {
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

		if (selectedProduct.loanTypes?.length > 0 && !formValues.loanPurpose) {
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

			// Calculate exact legal fee value (not percentage)
			const legalFeeValue = (loanAmount * selectedProduct.legalFee) / 100;

			// Calculate exact origination fee value (not percentage)
			const originationFeeValue =
				(loanAmount * selectedProduct.originationFee) / 100;

			// Calculate net disbursement
			const netDisbursementValue =
				loanAmount - legalFeeValue - originationFeeValue;

			const submissionValues = {
				...formValues,
				monthlyRepayment,
				interestRate: selectedProduct.interestRate.toString(), // Keep as percentage
				legalFee: legalFeeValue.toFixed(2),
				originationFee: originationFeeValue.toFixed(2),
				netDisbursement: netDisbursementValue.toFixed(2),
				loanPurpose:
					selectedProduct.loanTypes?.length > 0
						? formValues.loanPurpose
						: "",
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

		return monthlyPayment.toFixed(2);
	};

	return (
		<Box component="form" onSubmit={handleSubmit} className="space-y-6">
			<Typography variant="h6" className="text-gray-900 mb-4">
				Loan Details for {selectedProduct.name}
			</Typography>

			<div className="space-y-4">
				<TextField
					fullWidth
					label="Loan Amount"
					name="loanAmount"
					value={formValues.loanAmount}
					onChange={handleChange}
					error={!!errors.loanAmount}
					helperText={
						errors.loanAmount ||
						`Enter amount between RM ${selectedProduct.minAmount.toLocaleString()} and RM ${selectedProduct.maxAmount.toLocaleString()}`
					}
					type="number"
					inputProps={{
						min: selectedProduct.minAmount,
						max: selectedProduct.maxAmount,
						step: 100,
					}}
				/>

				{selectedProduct.loanTypes &&
					selectedProduct.loanTypes.length > 0 && (
						<FormControl fullWidth error={!!errors.loanPurpose}>
							<InputLabel>Loan Purpose</InputLabel>
							<Select
								name="loanPurpose"
								value={formValues.loanPurpose}
								onChange={handleSelectChange}
								label="Loan Purpose"
							>
								{selectedProduct.loanTypes.map((type) => (
									<MenuItem key={type} value={type}>
										{type}
									</MenuItem>
								))}
							</Select>
							{errors.loanPurpose && (
								<FormHelperText>
									{errors.loanPurpose}
								</FormHelperText>
							)}
						</FormControl>
					)}

				<FormControl fullWidth error={!!errors.loanTerm}>
					<InputLabel>Loan Term</InputLabel>
					<Select
						name="loanTerm"
						value={formValues.loanTerm}
						onChange={handleSelectChange}
						label="Loan Term"
					>
						{selectedProduct.repaymentTerms.map((term) => (
							<MenuItem key={term} value={term.toString()}>
								{formatTermDisplay(term)}
							</MenuItem>
						))}
					</Select>
					{errors.loanTerm && (
						<FormHelperText>{errors.loanTerm}</FormHelperText>
					)}
				</FormControl>

				{formValues.loanAmount && formValues.loanTerm && (
					<Paper className="p-4 bg-gray-50">
						<Typography
							variant="subtitle2"
							className="text-gray-600"
						>
							Estimated Monthly Repayment
						</Typography>
						<Typography variant="h6" className="text-indigo-600">
							RM{" "}
							{calculateMonthlyRepayment(
								parseFloat(formValues.loanAmount),
								parseInt(formValues.loanTerm)
							)}
						</Typography>
						<Typography variant="caption" className="text-gray-500">
							*Based on {selectedProduct.interestRate}% monthly
							interest rate (flat)
						</Typography>
					</Paper>
				)}
			</div>

			<Box className="flex justify-between pt-6">
				<Button
					type="button"
					variant="outlined"
					onClick={onBack}
					className="text-gray-700 border-gray-300 hover:bg-gray-50"
				>
					Back
				</Button>
				<Button
					type="submit"
					variant="contained"
					className="bg-indigo-600 hover:bg-indigo-700 text-white"
				>
					Continue
				</Button>
			</Box>
		</Box>
	);
}
