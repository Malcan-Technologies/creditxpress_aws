import { useFormik } from "formik";
import * as Yup from "yup";
import { TextField, Button, Box } from "@mui/material";
import { AddressInfo } from "@/types/onboarding";

interface AddressFormProps {
	initialValues: Partial<AddressInfo>;
	onSubmit: (values: AddressInfo) => void;
	onBack: () => void;
	showBackButton: boolean;
	isLastStep: boolean;
}

const validationSchema = Yup.object({
	address1: Yup.string().required("Address line 1 is required"),
	address2: Yup.string(),
	city: Yup.string().required("City is required"),
	state: Yup.string().required("State is required"),
	postalCode: Yup.string()
		.required("Postal code is required")
		.matches(/^\d{5}$/, "Postal code must be 5 digits"),
});

export default function AddressForm({
	initialValues,
	onSubmit,
	onBack,
	showBackButton,
	isLastStep,
}: AddressFormProps) {
	const formik = useFormik<AddressInfo>({
		initialValues: {
			address1: initialValues.address1 || "",
			address2: initialValues.address2 || "",
			city: initialValues.city || "",
			state: initialValues.state || "",
			postalCode: initialValues.postalCode || "",
		},
		validationSchema,
		onSubmit: (values) => {
			onSubmit(values);
		},
	});

	// Check if mandatory fields are completed
	const isFormValid =
		formik.values.address1.trim() !== "" &&
		formik.values.city.trim() !== "" &&
		formik.values.state.trim() !== "" &&
		formik.values.postalCode.trim() !== "" &&
		!/^\d{5}$/.test(formik.values.postalCode) === false;

	return (
		<form onSubmit={formik.handleSubmit}>
			<Box className="space-y-6">
				<TextField
					fullWidth
					id="address1"
					name="address1"
					label="Address Line 1"
					value={formik.values.address1}
					onChange={formik.handleChange}
					error={
						formik.touched.address1 &&
						Boolean(formik.errors.address1)
					}
					helperText={
						formik.touched.address1 && formik.errors.address1
					}
					className="[&_.MuiOutlinedInput-root]:focus-within:ring-indigo-600 [&_.MuiOutlinedInput-root]:focus-within:border-indigo-600"
				/>

				<TextField
					fullWidth
					id="address2"
					name="address2"
					label="Address Line 2 (Optional)"
					value={formik.values.address2}
					onChange={formik.handleChange}
					error={
						formik.touched.address2 &&
						Boolean(formik.errors.address2)
					}
					helperText={
						formik.touched.address2 && formik.errors.address2
					}
					className="[&_.MuiOutlinedInput-root]:focus-within:ring-indigo-600 [&_.MuiOutlinedInput-root]:focus-within:border-indigo-600"
				/>

				<TextField
					fullWidth
					id="city"
					name="city"
					label="City"
					value={formik.values.city}
					onChange={formik.handleChange}
					error={formik.touched.city && Boolean(formik.errors.city)}
					helperText={formik.touched.city && formik.errors.city}
					className="[&_.MuiOutlinedInput-root]:focus-within:ring-indigo-600 [&_.MuiOutlinedInput-root]:focus-within:border-indigo-600"
				/>

				<TextField
					fullWidth
					id="state"
					name="state"
					label="State"
					value={formik.values.state}
					onChange={formik.handleChange}
					error={formik.touched.state && Boolean(formik.errors.state)}
					helperText={formik.touched.state && formik.errors.state}
					className="[&_.MuiOutlinedInput-root]:focus-within:ring-indigo-600 [&_.MuiOutlinedInput-root]:focus-within:border-indigo-600"
				/>

				<TextField
					fullWidth
					id="postalCode"
					name="postalCode"
					label="Postal Code"
					value={formik.values.postalCode}
					onChange={formik.handleChange}
					error={
						formik.touched.postalCode &&
						Boolean(formik.errors.postalCode)
					}
					helperText={
						formik.touched.postalCode && formik.errors.postalCode
					}
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
