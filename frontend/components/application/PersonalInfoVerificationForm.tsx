import { useState, useEffect, Suspense } from "react";
import {
	Box,
	Button,
	TextField,
	Typography,
	FormControl,
	FormLabel,
	RadioGroup,
	FormControlLabel,
	Radio,
} from "@mui/material";
import { useSearchParams } from "next/navigation";

interface PersonalInfo {
	fullName: string;
	email: string;
	phoneNumber: string;
	employmentStatus: string;
	employerName?: string;
	monthlyIncome: string;
	address1: string;
	address2?: string;
	city: string;
	state: string;
	postalCode: string;
	zipCode?: string;
}

interface PersonalInfoVerificationFormProps {
	onSubmit: (values: PersonalInfo) => void;
	onBack: () => void;
}

// Create a client component for handling searchParams
function PersonalInfoVerificationFormContent({
	onSubmit,
	onBack,
}: PersonalInfoVerificationFormProps) {
	const searchParams = useSearchParams();
	const [formValues, setFormValues] = useState<PersonalInfo>({
		fullName: "",
		email: "",
		phoneNumber: "",
		employmentStatus: "",
		employerName: "",
		monthlyIncome: "",
		address1: "",
		address2: "",
		city: "",
		state: "",
		postalCode: "",
	});
	const [errors, setErrors] = useState<Partial<PersonalInfo>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				setError(null);

				// Get application ID from URL params
				const applicationId = searchParams.get("applicationId");
				if (!applicationId) {
					throw new Error("Application ID not found in URL");
				}

				console.log("Fetching user data");

				// Fetch user data from /api/users/me
				const token = localStorage.getItem("token");
				const userResponse = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
						},
					}
				);

				if (!userResponse.ok) {
					throw new Error("Failed to fetch user data");
				}

				const userData = await userResponse.json();
				console.log("User data:", userData);

				// Set form values from user data if available
				if (userData) {
					setFormValues({
						fullName: userData.fullName || "",
						email: userData.email || "",
						phoneNumber: userData.phoneNumber || "",
						employmentStatus: userData.employmentStatus || "",
						employerName: userData.employerName || "",
						monthlyIncome: userData.monthlyIncome || "",
						address1: userData.address1 || "",
						address2: userData.address2 || "",
						city: userData.city || "",
						state: userData.state || "",
						postalCode:
							userData.postalCode || userData.zipCode || "",
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

	const validateForm = () => {
		const newErrors: Partial<PersonalInfo> = {};

		if (!formValues.fullName) {
			newErrors.fullName = "Full name is required";
		}

		if (!formValues.email) {
			newErrors.email = "Email is required";
		} else if (!/\S+@\S+\.\S+/.test(formValues.email)) {
			newErrors.email = "Please enter a valid email address";
		}

		if (!formValues.phoneNumber) {
			newErrors.phoneNumber = "Phone number is required";
		}

		if (!formValues.employmentStatus) {
			newErrors.employmentStatus = "Employment status is required";
		}

		if (
			formValues.employmentStatus === "Employed" &&
			!formValues.employerName
		) {
			newErrors.employerName = "Employer name is required";
		}

		if (
			formValues.employmentStatus === "Business Owner" &&
			!formValues.employerName
		) {
			newErrors.employerName = "Company name is required";
		}

		if (!formValues.monthlyIncome) {
			newErrors.monthlyIncome = "Monthly income is required";
		} else {
			const income = parseFloat(formValues.monthlyIncome);
			if (isNaN(income) || income <= 0) {
				newErrors.monthlyIncome =
					"Please enter a valid monthly income amount";
			}
		}

		if (!formValues.address1) {
			newErrors.address1 = "Address is required";
		}

		if (!formValues.city) {
			newErrors.city = "City is required";
		}

		if (!formValues.state) {
			newErrors.state = "State is required";
		}

		if (!formValues.postalCode) {
			newErrors.postalCode = "Postal code is required";
		} else if (!/^\d{5}$/.test(formValues.postalCode)) {
			newErrors.postalCode = "Please enter a valid 5-digit postal code";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (validateForm()) {
			onSubmit(formValues);
		}
	};

	const handleChange =
		(field: keyof PersonalInfo) =>
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			if (field === "monthlyIncome" || field === "postalCode") {
				const numericValue = value.replace(/[^0-9]/g, "");
				if (field === "postalCode" && numericValue.length > 5) {
					return;
				}
				setFormValues((prev) => ({ ...prev, [field]: numericValue }));
			} else {
				setFormValues((prev) => ({ ...prev, [field]: value }));
			}
			if (errors[field]) {
				setErrors((prev) => ({ ...prev, [field]: "" }));
			}
		};

	const handleBack = () => {
		const currentStep = parseInt(searchParams.get("step") || "0", 10);
		const newStep = Math.max(currentStep - 1, 0);
		const newUrl = new URL(window.location.href);
		newUrl.searchParams.set("step", newStep.toString());
		window.location.href = newUrl.toString();
	};

	return (
		<Box component="form" onSubmit={handleSubmit} className="space-y-6">
			<Typography variant="h6" className="text-gray-900 mb-4">
				Verify Personal Information
			</Typography>

			<div className="space-y-4">
				<TextField
					fullWidth
					label="Full Name"
					value={formValues.fullName}
					onChange={handleChange("fullName")}
					error={!!errors.fullName}
					helperText={errors.fullName}
					className="[&_.MuiOutlinedInput-root.Mui-focused_.MuiOutlinedInput-notchedOutline]:border-indigo-600"
				/>

				<TextField
					fullWidth
					label="Email"
					type="email"
					value={formValues.email}
					onChange={handleChange("email")}
					error={!!errors.email}
					helperText={errors.email}
					className="[&_.MuiOutlinedInput-root.Mui-focused_.MuiOutlinedInput-notchedOutline]:border-indigo-600"
				/>

				<TextField
					fullWidth
					label="Phone Number"
					value={formValues.phoneNumber}
					onChange={handleChange("phoneNumber")}
					error={!!errors.phoneNumber}
					helperText={errors.phoneNumber}
					className="[&_.MuiOutlinedInput-root.Mui-focused_.MuiOutlinedInput-notchedOutline]:border-indigo-600"
				/>

				<FormControl component="fieldset">
					<FormLabel component="legend">Employment Status</FormLabel>
					<RadioGroup
						value={formValues.employmentStatus}
						onChange={handleChange("employmentStatus")}
					>
						<FormControlLabel
							value="Employed"
							control={
								<Radio
									sx={{
										"&.Mui-checked": {
											color: "rgb(79, 70, 229)",
										},
									}}
								/>
							}
							label="Employed"
						/>
						<FormControlLabel
							value="Self-Employed"
							control={
								<Radio
									sx={{
										"&.Mui-checked": {
											color: "rgb(79, 70, 229)",
										},
									}}
								/>
							}
							label="Self-Employed"
						/>
						<FormControlLabel
							value="Business Owner"
							control={
								<Radio
									sx={{
										"&.Mui-checked": {
											color: "rgb(79, 70, 229)",
										},
									}}
								/>
							}
							label="Business Owner"
						/>
						<FormControlLabel
							value="Unemployed"
							control={
								<Radio
									sx={{
										"&.Mui-checked": {
											color: "rgb(79, 70, 229)",
										},
									}}
								/>
							}
							label="Unemployed"
						/>
					</RadioGroup>
				</FormControl>

				{(formValues.employmentStatus === "Employed" ||
					formValues.employmentStatus === "Business Owner") && (
					<TextField
						fullWidth
						label={
							formValues.employmentStatus === "Business Owner"
								? "Company Name"
								: "Employer Name"
						}
						value={formValues.employerName}
						onChange={handleChange("employerName")}
						error={!!errors.employerName}
						helperText={errors.employerName}
						className="[&_.MuiOutlinedInput-root.Mui-focused_.MuiOutlinedInput-notchedOutline]:border-indigo-600"
					/>
				)}

				<TextField
					fullWidth
					label="Monthly Income"
					value={formValues.monthlyIncome}
					onChange={handleChange("monthlyIncome")}
					error={!!errors.monthlyIncome}
					helperText={errors.monthlyIncome}
					type="text"
					InputProps={{
						startAdornment: (
							<Typography className="text-gray-500 mr-1">
								RM
							</Typography>
						),
					}}
					className="[&_.MuiOutlinedInput-root.Mui-focused_.MuiOutlinedInput-notchedOutline]:border-indigo-600"
				/>

				<TextField
					fullWidth
					label="Address Line 1"
					value={formValues.address1}
					onChange={handleChange("address1")}
					error={!!errors.address1}
					helperText={errors.address1}
					className="[&_.MuiOutlinedInput-root.Mui-focused_.MuiOutlinedInput-notchedOutline]:border-indigo-600"
				/>

				<TextField
					fullWidth
					label="Address Line 2 (Optional)"
					value={formValues.address2}
					onChange={handleChange("address2")}
					className="[&_.MuiOutlinedInput-root.Mui-focused_.MuiOutlinedInput-notchedOutline]:border-indigo-600"
				/>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<TextField
						fullWidth
						label="City"
						value={formValues.city}
						onChange={handleChange("city")}
						error={!!errors.city}
						helperText={errors.city}
						className="[&_.MuiOutlinedInput-root.Mui-focused_.MuiOutlinedInput-notchedOutline]:border-indigo-600"
					/>

					<TextField
						fullWidth
						label="State"
						value={formValues.state}
						onChange={handleChange("state")}
						error={!!errors.state}
						helperText={errors.state}
						className="[&_.MuiOutlinedInput-root.Mui-focused_.MuiOutlinedInput-notchedOutline]:border-indigo-600"
					/>
				</div>

				<TextField
					fullWidth
					label="Postal Code"
					value={formValues.postalCode}
					onChange={handleChange("postalCode")}
					error={!!errors.postalCode}
					helperText={errors.postalCode}
					className="[&_.MuiOutlinedInput-root.Mui-focused_.MuiOutlinedInput-notchedOutline]:border-indigo-600"
				/>
			</div>

			<Box className="flex justify-between pt-6">
				<Button
					type="button"
					variant="outlined"
					onClick={handleBack}
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

export default function PersonalInfoVerificationForm(
	props: PersonalInfoVerificationFormProps
) {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<PersonalInfoVerificationFormContent {...props} />
		</Suspense>
	);
}
