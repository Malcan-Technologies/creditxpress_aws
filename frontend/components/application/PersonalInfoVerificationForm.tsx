import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface PersonalInfo {
	fullName: string;
	email: string;
	phoneNumber: string;
	employmentStatus: string;
	employerName?: string;
	monthlyIncome: string;
	serviceLength?: string;
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
		serviceLength: "",
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
						serviceLength: userData.serviceLength || "",
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
			(formValues.employmentStatus === "Employed" || formValues.employmentStatus === "Self-Employed") &&
			!formValues.employerName
		) {
			newErrors.employerName = "Employer name is required";
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
			
			// Handle employment status changes with clearing logic
			if (field === "employmentStatus") {
				if (value === "Student" || value === "Unemployed") {
					// Clear employer name and service length for student/unemployed
					setFormValues((prev) => ({
						...prev,
						[field]: value,
						employerName: "",
						serviceLength: "",
					}));
				} else {
					setFormValues((prev) => ({ ...prev, [field]: value }));
				}
			} else if (field === "monthlyIncome" || field === "postalCode" || field === "serviceLength") {
				const numericValue = value.replace(/[^0-9.]/g, "");
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
		<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
			<form onSubmit={handleSubmit} className="space-y-6">
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
						Verify Personal Information
					</h2>
				</div>

				<div className="space-y-6">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
							Full Name
						</label>
						<input
							type="text"
							value={formValues.fullName}
							onChange={handleChange("fullName")}
							className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body"
							placeholder="Enter your full name"
						/>
						{errors.fullName && (
							<p className="mt-1 text-sm text-red-600 font-body">
								{errors.fullName}
							</p>
						)}
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
							Email
						</label>
						<input
							type="email"
							value={formValues.email}
							onChange={handleChange("email")}
							className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body"
							placeholder="Enter your email address"
						/>
						{errors.email && (
							<p className="mt-1 text-sm text-red-600 font-body">
								{errors.email}
							</p>
						)}
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
							Phone Number
						</label>
						<input
							type="text"
							value={formValues.phoneNumber}
							onChange={handleChange("phoneNumber")}
							className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body"
							placeholder="Enter your phone number"
						/>
						{errors.phoneNumber && (
							<p className="mt-1 text-sm text-red-600 font-body">
								{errors.phoneNumber}
							</p>
						)}
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-3 font-body">
							Employment Status
						</label>
						<div className="space-y-3">
							{[
								"Employed",
								"Self-Employed",
								"Student",
								"Unemployed",
							].map((status) => (
								<label
									key={status}
									className="flex items-center"
								>
									<input
										type="radio"
										name="employmentStatus"
										value={status}
										checked={
											formValues.employmentStatus ===
											status
										}
										onChange={handleChange(
											"employmentStatus"
										)}
										className="w-4 h-4 text-purple-primary bg-white border-gray-300 focus:ring-purple-primary focus:ring-2"
									/>
									<span className="ml-3 text-gray-700 font-body">
										{status}
									</span>
								</label>
							))}
						</div>
						{errors.employmentStatus && (
							<p className="mt-1 text-sm text-red-600 font-body">
								{errors.employmentStatus}
							</p>
						)}
					</div>

					{(formValues.employmentStatus === "Employed" ||
						formValues.employmentStatus === "Self-Employed") && (
						<>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
									Employer Name
								</label>
								<input
									type="text"
									value={formValues.employerName || ""}
									onChange={handleChange("employerName")}
									className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body"
									placeholder="Enter your employer name"
								/>
								{errors.employerName && (
									<p className="mt-1 text-sm text-red-600 font-body">
										{errors.employerName}
									</p>
								)}
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
									Years at Current Company (Optional)
								</label>
								<input
									type="number"
									min="0"
									step="0.1"
									value={formValues.serviceLength || ""}
									onChange={handleChange("serviceLength")}
									className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body"
									placeholder="0.5"
								/>
								<p className="mt-1 text-sm text-gray-500 font-body">
									Length of time you've been working at your current company
								</p>
							</div>
						</>
					)}

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
							Monthly Income
						</label>
						<div className="relative">
							<span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-body">
								RM
							</span>
							<input
								type="text"
								value={formValues.monthlyIncome}
								onChange={handleChange("monthlyIncome")}
								className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body"
								placeholder="Enter your monthly income"
							/>
						</div>
						{errors.monthlyIncome && (
							<p className="mt-1 text-sm text-red-600 font-body">
								{errors.monthlyIncome}
							</p>
						)}
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
							Address Line 1
						</label>
						<input
							type="text"
							value={formValues.address1}
							onChange={handleChange("address1")}
							className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body"
							placeholder="Enter your address"
						/>
						{errors.address1 && (
							<p className="mt-1 text-sm text-red-600 font-body">
								{errors.address1}
							</p>
						)}
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
							Address Line 2 (Optional)
						</label>
						<input
							type="text"
							value={formValues.address2 || ""}
							onChange={handleChange("address2")}
							className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body"
							placeholder="Apartment, suite, etc. (optional)"
						/>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
								City
							</label>
							<input
								type="text"
								value={formValues.city}
								onChange={handleChange("city")}
								className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body"
								placeholder="Enter your city"
							/>
							{errors.city && (
								<p className="mt-1 text-sm text-red-600 font-body">
									{errors.city}
								</p>
							)}
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
								State
							</label>
							<input
								type="text"
								value={formValues.state}
								onChange={handleChange("state")}
								className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body"
								placeholder="Enter your state"
							/>
							{errors.state && (
								<p className="mt-1 text-sm text-red-600 font-body">
									{errors.state}
								</p>
							)}
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
							Postal Code
						</label>
						<input
							type="text"
							value={formValues.postalCode}
							onChange={handleChange("postalCode")}
							className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body"
							placeholder="Enter your postal code"
						/>
						{errors.postalCode && (
							<p className="mt-1 text-sm text-red-600 font-body">
								{errors.postalCode}
							</p>
						)}
					</div>
				</div>

				<div className="flex justify-between pt-6">
					<button
						type="button"
						onClick={handleBack}
						className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium font-body"
					>
						Back
					</button>
					<button
						type="submit"
						className="px-6 py-3 bg-purple-primary text-white rounded-xl hover:bg-purple-700 transition-all duration-200 font-medium font-body"
					>
						Continue
					</button>
				</div>
			</form>
		</div>
	);
}

export default function PersonalInfoVerificationForm(
	props: PersonalInfoVerificationFormProps
) {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center py-8">
					<div className="text-gray-700 font-body">Loading...</div>
				</div>
			}
		>
			<PersonalInfoVerificationFormContent {...props} />
		</Suspense>
	);
}
