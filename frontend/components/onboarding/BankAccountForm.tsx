import { useFormik } from "formik";
import * as Yup from "yup";
import { TextField, Button, Box, Typography, MenuItem } from "@mui/material";
import { BankInfo } from "@/types/onboarding";

interface BankAccountFormProps {
	initialValues: Partial<BankInfo>;
	onSubmit: (values: BankInfo) => void;
	onBack: () => void;
	onSkip: () => void;
	showBackButton: boolean;
	isLastStep: boolean;
}

const banks = [
	"Maybank",
	"CIMB Bank",
	"Public Bank",
	"RHB Bank",
	"Hong Leong Bank",
	"AmBank",
	"Bank Islam",
	"OCBC Bank",
	"UOB Bank",
	"Standard Chartered",
] as const;

const validationSchema = Yup.object({
	bankName: Yup.string().oneOf([...banks, ""]),
	accountNumber: Yup.string().when("bankName", {
		is: (val: string) => val && val.length > 0,
		then: (schema) =>
			schema
				.required("Account number is required when bank is selected")
				.matches(
					/^\d{10,16}$/,
					"Account number must be between 10 and 16 digits"
				),
		otherwise: (schema) => schema,
	}),
});

export default function BankAccountForm({
	initialValues,
	onSubmit,
	onBack,
	onSkip,
	showBackButton,
	isLastStep,
}: BankAccountFormProps) {
	const formik = useFormik<BankInfo>({
		initialValues: {
			bankName: initialValues.bankName || "",
			accountNumber: initialValues.accountNumber || "",
		},
		validationSchema,
		onSubmit: (values) => {
			onSubmit(values);
		},
	});

	return (
		<form onSubmit={formik.handleSubmit}>
			<Box className="space-y-6">
				<Typography variant="body1" color="text.secondary" mb={4}>
					Link your bank account for loan disbursements. This step is
					optional and can be completed later.
				</Typography>

				<TextField
					fullWidth
					select
					id="bankName"
					name="bankName"
					label="Select Bank"
					value={formik.values.bankName}
					onChange={formik.handleChange}
					error={
						formik.touched.bankName &&
						Boolean(formik.errors.bankName)
					}
					helperText={
						formik.touched.bankName && formik.errors.bankName
					}
					className="[&_.MuiOutlinedInput-root]:focus-within:ring-indigo-600 [&_.MuiOutlinedInput-root]:focus-within:border-indigo-600"
				>
					<MenuItem value="">
						<em>None</em>
					</MenuItem>
					{banks.map((bank) => (
						<MenuItem key={bank} value={bank}>
							{bank}
						</MenuItem>
					))}
				</TextField>

				{formik.values.bankName && (
					<TextField
						fullWidth
						id="accountNumber"
						name="accountNumber"
						label="Account Number"
						value={formik.values.accountNumber}
						onChange={formik.handleChange}
						error={
							formik.touched.accountNumber &&
							Boolean(formik.errors.accountNumber)
						}
						helperText={
							formik.touched.accountNumber &&
							formik.errors.accountNumber
						}
						className="[&_.MuiOutlinedInput-root]:focus-within:ring-indigo-600 [&_.MuiOutlinedInput-root]:focus-within:border-indigo-600"
					/>
				)}

				{/* Navigation buttons */}
				<Box className="flex justify-between items-center space-x-4 mt-6">
					{showBackButton && (
						<Button
							onClick={onBack}
							variant="outlined"
							className="text-indigo-600 border-indigo-600 hover:bg-indigo-50"
						>
							Back
						</Button>
					)}
					<div className="flex-1 flex justify-end items-center space-x-4">
						<Button
							onClick={onSkip}
							variant="text"
							className="text-gray-600 hover:text-gray-900"
						>
							Skip for now
						</Button>
						<Button
							type="submit"
							variant="contained"
							className="bg-purple-600 hover:bg-purple-700 text-white"
						>
							{isLastStep ? "Complete" : "Next"}
						</Button>
					</div>
				</Box>
			</Box>
		</form>
	);
}
