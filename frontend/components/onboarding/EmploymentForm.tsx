import { useFormik } from "formik";
import * as Yup from "yup";
import {
	TextField,
	Button,
	Box,
	FormControl,
	FormLabel,
	RadioGroup,
	FormControlLabel,
	Radio,
	InputAdornment,
} from "@mui/material";
import { EmploymentInfo } from "@/types/onboarding";

interface EmploymentFormProps {
	initialValues: Partial<EmploymentInfo>;
	onSubmit: (values: EmploymentInfo) => void;
	onBack: () => void;
	showBackButton: boolean;
	isLastStep: boolean;
}

const employmentStatuses = [
	"Employed",
	"Self-Employed",
	"Student",
	"Unemployed",
] as const;

const validationSchema = Yup.object({
	employmentStatus: Yup.string()
		.oneOf(employmentStatuses)
		.required("Employment status is required"),
	employerName: Yup.string().when("employmentStatus", {
		is: (status: string) =>
			status === "Employed" || status === "Self-Employed",
		then: (schema) => schema.optional(),
		otherwise: (schema) => schema,
	}),
	monthlyIncome: Yup.mixed()
		.optional()
		.nullable()
		.test("is-number", "Please enter a valid number", (value) => {
			if (value === undefined || value === null || value === "") {
				return true; // Allow empty values
			}
			return !isNaN(Number(value));
		})
		.test("is-positive", "Monthly income cannot be negative", (value) => {
			if (value === undefined || value === null || value === "") {
				return true; // Allow empty values
			}
			return Number(value) >= 0;
		}),
});

export default function EmploymentForm({
	initialValues,
	onSubmit,
	onBack,
	showBackButton,
	isLastStep,
}: EmploymentFormProps) {
	const formik = useFormik<EmploymentInfo>({
		initialValues: {
			employmentStatus: initialValues.employmentStatus || "",
			employerName: initialValues.employerName || "",
			monthlyIncome: initialValues.monthlyIncome || "",
		},
		validationSchema,
		onSubmit: (values) => {
			// Format the values before submission
			const formattedValues = {
				...values,
				// Keep monthly income as a string, but ensure it's properly formatted
				monthlyIncome: values.monthlyIncome
					? String(values.monthlyIncome)
					: "",
			};
			onSubmit(formattedValues);
		},
	});

	const showEmployerField =
		formik.values.employmentStatus === "Employed" ||
		formik.values.employmentStatus === "Self-Employed";

	// Check if mandatory fields are completed
	const isFormValid = formik.values.employmentStatus !== "";

	return (
		<form onSubmit={formik.handleSubmit}>
			<Box className="space-y-6">
				<FormControl component="fieldset" className="w-full">
					<FormLabel component="legend" className="text-gray-700">
						Employment Status
					</FormLabel>
					<RadioGroup
						name="employmentStatus"
						value={formik.values.employmentStatus}
						onChange={formik.handleChange}
						className="[&_.MuiRadio-root]:text-indigo-600"
					>
						{employmentStatuses.map((status) => (
							<FormControlLabel
								key={status}
								value={status}
								control={<Radio />}
								label={status}
								sx={{ color: "text.secondary" }}
							/>
						))}
					</RadioGroup>
					{formik.touched.employmentStatus &&
						formik.errors.employmentStatus && (
							<div className="text-red-500 text-sm mt-1">
								{formik.errors.employmentStatus}
							</div>
						)}
				</FormControl>

				{showEmployerField && (
					<TextField
						fullWidth
						id="employerName"
						name="employerName"
						label="Employer Name"
						value={formik.values.employerName}
						onChange={formik.handleChange}
						error={
							formik.touched.employerName &&
							Boolean(formik.errors.employerName)
						}
						helperText={
							formik.touched.employerName &&
							formik.errors.employerName
								? formik.errors.employerName
								: "Optional"
						}
						className="[&_.MuiOutlinedInput-root]:focus-within:ring-indigo-600 [&_.MuiOutlinedInput-root]:focus-within:border-indigo-600"
					/>
				)}

				<TextField
					fullWidth
					id="monthlyIncome"
					name="monthlyIncome"
					label="Monthly Income"
					type="number"
					value={formik.values.monthlyIncome}
					onChange={formik.handleChange}
					error={
						formik.touched.monthlyIncome &&
						Boolean(formik.errors.monthlyIncome)
					}
					helperText={
						formik.touched.monthlyIncome &&
						formik.errors.monthlyIncome
							? formik.errors.monthlyIncome
							: "Optional"
					}
					InputProps={{
						startAdornment: (
							<InputAdornment position="start">RM</InputAdornment>
						),
					}}
					className="[&_.MuiOutlinedInput-root]:focus-within:ring-indigo-600 [&_.MuiOutlinedInput-root]:focus-within:border-indigo-600"
				/>

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
					<div className="flex-1 flex justify-end">
						<Button
							type="submit"
							variant="contained"
							disabled={!isFormValid}
							className={`${
								!isFormValid
									? "bg-gray-300 text-gray-500"
									: "bg-purple-600 hover:bg-purple-700 text-white"
							}`}
						>
							{isLastStep ? "Complete" : "Next"}
						</Button>
					</div>
				</Box>
			</Box>
		</form>
	);
}
