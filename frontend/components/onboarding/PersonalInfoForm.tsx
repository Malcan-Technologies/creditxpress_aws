import { useFormik } from "formik";
import * as Yup from "yup";
import { TextField, Button, Box, FormHelperText } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { PersonalInfo } from "@/types/onboarding";

interface PersonalInfoFormProps {
	initialValues: Partial<PersonalInfo>;
	onSubmit: (values: PersonalInfo) => void;
	onBack: () => void;
	showBackButton: boolean;
	isLastStep: boolean;
}

const validationSchema = Yup.object({
	fullName: Yup.string().required("Full name is required"),
	dateOfBirth: Yup.date()
		.required("Date of birth is required")
		.max(new Date(), "Date of birth cannot be in the future")
		.test("age", "You must be at least 18 years old", (value) => {
			if (!value) return false;
			const today = new Date();
			const birthDate = new Date(value);
			let age = today.getFullYear() - birthDate.getFullYear();
			const monthDiff = today.getMonth() - birthDate.getMonth();
			if (
				monthDiff < 0 ||
				(monthDiff === 0 && today.getDate() < birthDate.getDate())
			) {
				age--;
			}
			return age >= 18;
		}),
	email: Yup.string()
		.email("Invalid email address")
		.required("Email is required"),
});

export default function PersonalInfoForm({
	initialValues,
	onSubmit,
	onBack,
	showBackButton,
	isLastStep,
}: PersonalInfoFormProps) {
	const formik = useFormik<PersonalInfo>({
		initialValues: {
			fullName: initialValues.fullName || "",
			dateOfBirth: initialValues.dateOfBirth || null,
			email: initialValues.email || "",
		},
		validationSchema,
		onSubmit: (values) => {
			onSubmit(values);
		},
	});

	// Check if mandatory fields are completed
	const isFormValid =
		formik.values.fullName.trim() !== "" &&
		formik.values.dateOfBirth !== null &&
		formik.values.email.trim() !== "" &&
		/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formik.values.email);

	return (
		<form onSubmit={formik.handleSubmit}>
			<Box className="space-y-6">
				<TextField
					fullWidth
					id="fullName"
					name="fullName"
					label="Full Name"
					value={formik.values.fullName}
					onChange={formik.handleChange}
					error={
						formik.touched.fullName &&
						Boolean(formik.errors.fullName)
					}
					helperText={
						formik.touched.fullName && formik.errors.fullName
					}
					className="[&_.MuiOutlinedInput-root]:focus-within:ring-indigo-600 [&_.MuiOutlinedInput-root]:focus-within:border-indigo-600"
				/>

				<LocalizationProvider dateAdapter={AdapterDateFns}>
					<DatePicker
						label="Date of Birth"
						value={formik.values.dateOfBirth}
						onChange={(value) =>
							formik.setFieldValue("dateOfBirth", value)
						}
						slotProps={{
							textField: {
								fullWidth: true,
								error:
									formik.touched.dateOfBirth &&
									Boolean(formik.errors.dateOfBirth),
								className:
									"[&_.MuiOutlinedInput-root]:focus-within:ring-indigo-600 [&_.MuiOutlinedInput-root]:focus-within:border-indigo-600",
							},
						}}
					/>
				</LocalizationProvider>
				{formik.touched.dateOfBirth && formik.errors.dateOfBirth && (
					<FormHelperText error>
						{formik.errors.dateOfBirth}
					</FormHelperText>
				)}

				<TextField
					fullWidth
					id="email"
					name="email"
					label="Email Address"
					type="email"
					value={formik.values.email}
					onChange={formik.handleChange}
					error={formik.touched.email && Boolean(formik.errors.email)}
					helperText={formik.touched.email && formik.errors.email}
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
