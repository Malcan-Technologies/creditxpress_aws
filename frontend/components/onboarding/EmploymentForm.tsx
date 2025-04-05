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
	MenuItem,
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

const incomeRanges = [
	"Below RM2,000",
	"RM2,000 - RM4,000",
	"RM4,001 - RM6,000",
	"RM6,001 - RM8,000",
	"RM8,001 - RM10,000",
	"Above RM10,000",
] as const;

const validationSchema = Yup.object({
	employmentStatus: Yup.string()
		.oneOf(employmentStatuses)
		.required("Employment status is required"),
	employerName: Yup.string().when("employmentStatus", {
		is: (status: string) =>
			status === "Employed" || status === "Self-Employed",
		then: (schema) => schema.required("Employer name is required"),
		otherwise: (schema) => schema,
	}),
	monthlyIncome: Yup.string()
		.oneOf(incomeRanges)
		.required("Monthly income range is required"),
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
			onSubmit(values);
		},
	});

	const showEmployerField =
		formik.values.employmentStatus === "Employed" ||
		formik.values.employmentStatus === "Self-Employed";

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
						}
						className="[&_.MuiOutlinedInput-root]:focus-within:ring-indigo-600 [&_.MuiOutlinedInput-root]:focus-within:border-indigo-600"
					/>
				)}

				<TextField
					fullWidth
					select
					id="monthlyIncome"
					name="monthlyIncome"
					label="Monthly Income Range"
					value={formik.values.monthlyIncome}
					onChange={formik.handleChange}
					error={
						formik.touched.monthlyIncome &&
						Boolean(formik.errors.monthlyIncome)
					}
					helperText={
						formik.touched.monthlyIncome &&
						formik.errors.monthlyIncome
					}
					className="[&_.MuiOutlinedInput-root]:focus-within:ring-indigo-600 [&_.MuiOutlinedInput-root]:focus-within:border-indigo-600"
				>
					{incomeRanges.map((range) => (
						<MenuItem key={range} value={range}>
							{range}
						</MenuItem>
					))}
				</TextField>

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
