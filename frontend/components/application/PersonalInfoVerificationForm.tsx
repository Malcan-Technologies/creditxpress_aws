import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
	AcademicCapIcon, 
	UserIcon, 
	BriefcaseIcon, 
	HomeIcon, 
	BanknotesIcon,
	CreditCardIcon
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleIconSolid } from "@heroicons/react/24/solid";
import { fetchWithTokenRefresh } from "@/lib/authUtils";

interface PersonalInfo {
	fullName: string;
	email: string;
	phoneNumber: string;
	employmentStatus: string;
	employerName?: string;
	monthlyIncome: string;
	serviceLength?: string;
	educationLevel: string;
	race: string;
	gender: string;
	occupation: string;
	address1: string;
	address2?: string;
	city: string;
	state: string;
	postalCode: string;
	zipCode?: string;
	bankName?: string;
	accountNumber?: string;
}

// Malaysian banks list
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

interface PersonalInfoVerificationFormProps {
	onSubmit: (values: PersonalInfo) => void;
	onBack: () => void;
}

const educationLevels = [
	"Primary School",
	"Secondary School (SPM/O-Levels)",
	"Pre-University (STPM/A-Levels/Foundation)",
	"Diploma",
	"Bachelor's Degree",
	"Master's Degree",
	"Doctorate (PhD)",
	"Professional Certification",
	"Vocational Training",
	"Other",
];

const raceOptions = [
	"Melayu",
	"Cina",
	"India",
	"Lain-lain",
	"Bumiputra (Sabah/Sarawak)",
	"Bukan Warganegara",
];

const genderOptions = [
	"Male",
	"Female",
];

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
		educationLevel: "",
		race: "",
		gender: "",
		occupation: "",
		address1: "",
		address2: "",
		city: "",
		state: "",
		postalCode: "",
		bankName: "",
		accountNumber: "",
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

				// Fetch user data using token refresh utility
				const userData = await fetchWithTokenRefresh<any>("/api/users/me");

				// Set form values from user data if available
				if (userData) {
					const newFormValues = {
						fullName: userData.fullName || "",
						email: userData.email || "",
						phoneNumber: userData.phoneNumber || "",
						employmentStatus: userData.employmentStatus || "",
						employerName: userData.employerName || "",
						monthlyIncome: userData.monthlyIncome || "",
						serviceLength: userData.serviceLength || "",
						educationLevel: userData.educationLevel || "",
						race: userData.race || "",
						gender: userData.gender || "",
						occupation: userData.occupation || "",
						address1: userData.address1 || "",
						address2: userData.address2 || "",
						city: userData.city || "",
						state: userData.state || "",
						postalCode:
							userData.postalCode || userData.zipCode || "",
						bankName: userData.bankName || "",
						accountNumber: userData.accountNumber || "",
					};
					
					setFormValues(newFormValues);
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
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.email)) {
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

		if (!formValues.educationLevel) {
			newErrors.educationLevel = "Education level is required";
		}

		if (!formValues.race) {
			newErrors.race = "Race is required";
		}

		if (!formValues.gender) {
			newErrors.gender = "Gender is required";
		}

		if (!formValues.occupation) {
			newErrors.occupation = "Occupation is required";
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

		// Bank details validation
		if (!formValues.bankName) {
			newErrors.bankName = "Please select your bank";
		}

		if (!formValues.accountNumber) {
			newErrors.accountNumber = "Account number is required";
		} else if (!/^\d{10,16}$/.test(formValues.accountNumber)) {
			newErrors.accountNumber = "Account number must be between 10 and 16 digits";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	// Section completion check functions
	const isPersonalInfoComplete = () => {
		return !!(
			formValues.fullName &&
			formValues.email &&
			/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.email) &&
			formValues.phoneNumber
		);
	};

	const isEducationEmploymentComplete = () => {
		const hasBasicInfo = !!(
			formValues.educationLevel &&
			formValues.employmentStatus &&
			formValues.monthlyIncome &&
			parseFloat(formValues.monthlyIncome) > 0
		);

		// If employed/self-employed, also require employer name
		if (formValues.employmentStatus === "Employed" || formValues.employmentStatus === "Self-Employed") {
			return hasBasicInfo && !!formValues.employerName;
		}

		return hasBasicInfo;
	};

	const isAddressComplete = () => {
		return !!(
			formValues.address1 &&
			formValues.city &&
			formValues.state &&
			formValues.postalCode &&
			/^\d{5}$/.test(formValues.postalCode)
		);
	};

	const isBankDetailsComplete = () => {
		return !!(
			formValues.bankName &&
			formValues.accountNumber &&
			/^\d{10,16}$/.test(formValues.accountNumber)
		);
	};

	// Section completion badge component
	const SectionBadge = ({ isComplete }: { isComplete: boolean }) => {
		if (!isComplete) return null;
		return (
			<div className="flex items-center space-x-1 ml-auto">
				<CheckCircleIconSolid className="h-5 w-5 text-green-500" />
				<span className="text-sm font-medium text-green-600 font-body">Complete</span>
			</div>
		);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (validateForm()) {
			onSubmit(formValues);
		}
	};

	const handleChange =
		(field: keyof PersonalInfo) =>
		(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
			} else if (field === "monthlyIncome" || field === "postalCode" || field === "serviceLength" || field === "accountNumber") {
				const numericValue = value.replace(/[^0-9.]/g, "");
				if (field === "postalCode" && numericValue.length > 5) {
					return;
				}
				if (field === "accountNumber" && numericValue.length > 16) {
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
		<div>
			<form onSubmit={handleSubmit} className="space-y-8">
				{/* Header */}
				<div className="flex items-center space-x-3 mb-6">
					<div className="p-2 bg-purple-primary/10 rounded-lg border border-purple-primary/20">
						<svg
							className="h-6 w-6 text-purple-primary"
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
					<div>
						<h2 className="text-xl font-heading text-purple-primary font-bold">
							Verify Personal Information
						</h2>
						<p className="text-sm text-gray-500 font-body">
							Please review and update your information below
						</p>
					</div>
				</div>

				{/* Personal Information Section */}
				<div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
					<div className="flex items-center space-x-2 mb-6">
						<UserIcon className="h-5 w-5 text-blue-400" />
						<h3 className="text-lg font-heading font-semibold text-blue-400">
							Personal Information
						</h3>
						<SectionBadge isComplete={isPersonalInfoComplete()} />
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
								Full Name (follow IC)
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

					<div className="md:col-span-2">
						<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
							Phone Number
						</label>
						<input
							type="text"
							value={formValues.phoneNumber}
							disabled
							className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 font-body cursor-not-allowed"
							placeholder="Phone number (verified)"
						/>
						<p className="mt-1 text-xs text-gray-500 font-body">
							Your phone number cannot be changed as it's linked to your verified account
						</p>
					</div>

					{/* Race */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
							Race
						</label>
						<div className="relative">
							<select
								value={formValues.race}
								onChange={handleChange("race")}
								className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body appearance-none ${
									errors.race ? "border-red-300" : "border-gray-300"
								}`}
							>
								<option value="">Select your race</option>
								{raceOptions.map((race) => (
									<option key={race} value={race}>
										{race}
									</option>
								))}
							</select>
							<div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
								<svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
									<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
								</svg>
							</div>
						</div>
						{errors.race && (
							<p className="mt-1 text-sm text-red-600 font-body">
								{errors.race}
							</p>
						)}
					</div>

					{/* Gender */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
							Gender
						</label>
						<div className="relative">
							<select
								value={formValues.gender}
								onChange={handleChange("gender")}
								className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body appearance-none ${
									errors.gender ? "border-red-300" : "border-gray-300"
								}`}
							>
								<option value="">Select your gender</option>
								{genderOptions.map((gender) => (
									<option key={gender} value={gender}>
										{gender}
									</option>
								))}
							</select>
							<div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
								<svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
									<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
								</svg>
							</div>
						</div>
						{errors.gender && (
							<p className="mt-1 text-sm text-red-600 font-body">
								{errors.gender}
							</p>
						)}
					</div>
				</div>
			</div>

			{/* Education & Employment Section */}
				<div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
					<div className="flex items-center space-x-2 mb-6">
						<BriefcaseIcon className="h-5 w-5 text-blue-400" />
						<h3 className="text-lg font-heading font-semibold text-blue-400">
							Education & Employment
						</h3>
						<SectionBadge isComplete={isEducationEmploymentComplete()} />
					</div>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
								Education Level
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
									<AcademicCapIcon className="h-5 w-5 text-gray-400" />
								</div>
								<select
									value={formValues.educationLevel}
									onChange={handleChange("educationLevel")}
									className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body appearance-none"
								>
									<option value="">Select your education level</option>
									{educationLevels.map((level) => (
										<option key={level} value={level}>
											{level}
										</option>
									))}
								</select>
								<div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
									<svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
										<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
									</svg>
								</div>
							</div>
					{errors.educationLevel && (
						<p className="mt-1 text-sm text-red-600 font-body">
							{errors.educationLevel}
						</p>
					)}
				</div>

				{/* Occupation */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
							Occupation
						</label>
						<input
							type="text"
							value={formValues.occupation}
							onChange={handleChange("occupation")}
							className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body ${
								errors.occupation ? "border-red-300" : "border-gray-300"
							}`}
							placeholder="e.g. Manager, Engineer, Doctor"
						/>
						{errors.occupation && (
							<p className="mt-1 text-sm text-red-600 font-body">
								{errors.occupation}
							</p>
						)}
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-3 font-body">
							Employment Status
						</label>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
								{[
									"Employed",
									"Self-Employed",
									"Student",
									"Unemployed",
								].map((status) => (
									<label
										key={status}
										className="flex items-center p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
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
										<span className="ml-3 text-sm text-gray-700 font-body">
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
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
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
									<p className="mt-1 text-xs text-gray-500 font-body">
										Length of time you've been working at your current company
									</p>
								</div>
							</div>
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
					</div>
				</div>

				{/* Address Section */}
				<div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
					<div className="flex items-center space-x-2 mb-6">
						<HomeIcon className="h-5 w-5 text-blue-400" />
						<h3 className="text-lg font-heading font-semibold text-blue-400">
							Residential Address
						</h3>
						<SectionBadge isComplete={isAddressComplete()} />
					</div>
					<div className="space-y-4">
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

						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
					</div>
				</div>

				{/* Bank Details Section */}
				<div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
					<div className="flex items-center space-x-2 mb-6">
						<BanknotesIcon className="h-5 w-5 text-blue-400" />
						<h3 className="text-lg font-heading font-semibold text-blue-400">
							Bank Account Details
						</h3>
						<SectionBadge isComplete={isBankDetailsComplete()} />
					</div>
					<p className="text-sm text-gray-500 font-body mb-4">
						Your bank account will be used for loan disbursement
					</p>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
								Bank Name <span className="text-red-500">*</span>
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
									<BanknotesIcon className="h-5 w-5 text-gray-400" />
								</div>
								<select
									value={formValues.bankName || ""}
									onChange={handleChange("bankName")}
									className={`w-full pl-12 pr-10 py-3 bg-white border rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body appearance-none ${
										errors.bankName
											? "border-red-300"
											: "border-gray-300"
									}`}
								>
									<option value="">Choose your bank</option>
									{banks.map((bank) => (
										<option key={bank} value={bank}>
											{bank}
										</option>
									))}
								</select>
								<div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
									<svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
										<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
									</svg>
								</div>
							</div>
							{errors.bankName && (
								<p className="mt-1 text-sm text-red-600 font-body">
									{errors.bankName}
								</p>
							)}
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
								Account Number <span className="text-red-500">*</span>
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
									<CreditCardIcon className="h-5 w-5 text-gray-400" />
								</div>
								<input
									type="text"
									value={formValues.accountNumber || ""}
									onChange={handleChange("accountNumber")}
									className={`w-full pl-12 pr-4 py-3 bg-white border rounded-xl text-gray-700 placeholder-gray-400 focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors font-body ${
										errors.accountNumber
											? "border-red-300"
											: "border-gray-300"
									}`}
									placeholder="Enter your account number"
								/>
							</div>
							{errors.accountNumber && (
								<p className="mt-1 text-sm text-red-600 font-body">
									{errors.accountNumber}
								</p>
							)}
							<p className="mt-1 text-xs text-gray-500 font-body">
								Must be between 10 and 16 digits
							</p>
						</div>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex justify-between items-center pt-6 border-t border-gray-200">
					<button
						type="button"
						onClick={handleBack}
						className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium font-body"
					>
						← Back
					</button>
					<button
						type="submit"
						className="px-8 py-3 bg-purple-primary text-white rounded-xl hover:bg-purple-700 transition-all duration-200 font-medium font-body shadow-lg hover:shadow-xl"
					>
						Continue →
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
