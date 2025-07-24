"use client";

import { useState, useEffect } from "react";
import { PersonalInfo } from "@/types/onboarding";
import { 
	validateICOrPassport, 
	extractDOBFromMalaysianIC, 
	formatMalaysianIC,
	validateEmergencyContactPhone,
	isAtLeast18YearsOld,
	calculateAge
} from "@/lib/icUtils";
import { 
	UserIcon, 
	UserCircleIcon,
	IdentificationIcon, 
	EnvelopeIcon, 
	UserGroupIcon,
	AcademicCapIcon
} from "@heroicons/react/24/outline";

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
] as const;

interface PersonalInfoFormProps {
	initialValues: Partial<PersonalInfo>;
	onSubmit: (values: PersonalInfo) => void;
	onBack: () => void;
	showBackButton: boolean;
	isLastStep: boolean;
}

export default function PersonalInfoForm({
	initialValues,
	onSubmit,
	onBack,
	showBackButton,
	isLastStep,
}: PersonalInfoFormProps) {
	const [formData, setFormData] = useState<PersonalInfo>({
		fullName: initialValues.fullName || "",
		dateOfBirth: initialValues.dateOfBirth || null,
		email: initialValues.email || "",
		phoneNumber: initialValues.phoneNumber || "",
		icNumber: initialValues.icNumber || "",
		icType: initialValues.icType || null,
		educationLevel: initialValues.educationLevel || "",
		emergencyContactName: initialValues.emergencyContactName || "",
		emergencyContactPhone: initialValues.emergencyContactPhone || "",
		emergencyContactRelationship: initialValues.emergencyContactRelationship || "",
	});

	const [errors, setErrors] = useState<Record<string, string>>({});
	const [icError, setIcError] = useState<string>("");

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const { name, value } = e.target;
		setFormData(prev => ({ ...prev, [name]: value }));
		
		// Clear error when user starts typing
		if (errors[name]) {
			setErrors(prev => ({ ...prev, [name]: "" }));
		}
	};

	const handleIcNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setIcError("");
		
		// Clear date of birth error when IC number changes
		if (errors.dateOfBirth) {
			setErrors(prev => ({ ...prev, dateOfBirth: "" }));
		}
		
		setFormData(prev => ({
			...prev,
			icNumber: value,
		}));

		// Validate and extract DOB if IC number is provided
		if (value.trim()) {
			const validation = validateICOrPassport(value);
			
			if (validation.isValid && validation.type) {
				setFormData(prev => ({
					...prev,
					icType: validation.type,
					dateOfBirth: validation.extractedDOB || prev.dateOfBirth || null,
				}));
			} else {
				setFormData(prev => ({
					...prev,
					icType: null,
					dateOfBirth: null,
				}));
				if (validation.error) {
					setIcError(validation.error);
				}
			}
		} else {
			setFormData(prev => ({
				...prev,
				icType: null,
				dateOfBirth: null,
			}));
		}
	};

	const validateForm = (): boolean => {
		const newErrors: Record<string, string> = {};

		if (!formData.fullName?.trim()) {
			newErrors.fullName = "Full name is required";
		}

		if (!formData.icNumber?.trim()) {
			newErrors.icNumber = "IC or passport number is required";
		} else {
			const icValidation = validateICOrPassport(formData.icNumber);
			if (!icValidation.isValid) {
				newErrors.icNumber = icValidation.error || "Invalid IC or passport number";
			}
		}

		// Age validation - must be at least 18 years old
		if (!formData.dateOfBirth) {
			newErrors.dateOfBirth = "Date of birth is required for age verification";
		} else if (!isAtLeast18YearsOld(formData.dateOfBirth)) {
			const age = calculateAge(formData.dateOfBirth);
			newErrors.dateOfBirth = `You must be at least 18 years old to apply. Current age: ${age} years`;
		}

		// Email is now required
		if (!formData.email?.trim()) {
			newErrors.email = "Email address is required";
		} else {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(formData.email)) {
				newErrors.email = "Please enter a valid email address";
			}
		}

		// Education level validation
		if (!formData.educationLevel?.trim()) {
			newErrors.educationLevel = "Education level is required";
		}

		// Emergency contact validation
		if (!formData.emergencyContactName?.trim()) {
			newErrors.emergencyContactName = "Emergency contact name is required";
		}

		if (!formData.emergencyContactPhone?.trim()) {
			newErrors.emergencyContactPhone = "Emergency contact phone is required";
		} else {
			const isValidPhone = validateEmergencyContactPhone(formData.emergencyContactPhone);
			if (!isValidPhone) {
				newErrors.emergencyContactPhone = "Invalid phone number format";
			}
		}

		if (!formData.emergencyContactRelationship?.trim()) {
			newErrors.emergencyContactRelationship = "Relationship is required";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		
		if (validateForm()) {
			onSubmit({
				fullName: formData.fullName!,
				dateOfBirth: formData.dateOfBirth || null,
				email: formData.email || "",
				phoneNumber: formData.phoneNumber!,
				icNumber: formData.icNumber!,
				icType: formData.icType!,
				educationLevel: formData.educationLevel!,
				emergencyContactName: formData.emergencyContactName!,
				emergencyContactPhone: formData.emergencyContactPhone!,
				emergencyContactRelationship: formData.emergencyContactRelationship!,
			});
		}
	};

	// Check if mandatory fields are completed and valid
	const isFormValid = 
		formData.fullName.trim() !== "" &&
		formData.icNumber.trim() !== "" &&
		formData.email.trim() !== "" &&
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
		formData.educationLevel.trim() !== "" &&
		formData.emergencyContactName.trim() !== "" &&
		formData.emergencyContactPhone.trim() !== "" &&
		validateEmergencyContactPhone(formData.emergencyContactPhone) &&
		formData.emergencyContactRelationship.trim() !== "" &&
		validateICOrPassport(formData.icNumber).isValid &&
		formData.dateOfBirth !== null &&
		isAtLeast18YearsOld(formData.dateOfBirth) &&
		!icError;

	return (
		<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
			<div className="p-4 sm:p-6 lg:p-8">
				{/* Header */}
				<div className="flex items-center mb-6 lg:mb-8">
					<div className="bg-purple-primary/10 rounded-xl p-3 mr-4">
						<UserCircleIcon className="w-6 h-6 lg:w-7 lg:h-7 text-purple-primary" />
					</div>
					<div>
						<h2 className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-1">
							Personal Information
						</h2>
						<p className="text-sm lg:text-base text-purple-primary font-semibold">
							Tell us about yourself
						</p>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6">
					{/* Full Name */}
					<div>
						<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
							Full Name (as per IC) <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<UserIcon className="h-5 w-5 text-gray-400" />
							</div>
							<input
								type="text"
								name="fullName"
								value={formData.fullName}
								onChange={handleInputChange}
								className={`w-full pl-10 pr-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base text-gray-900 bg-white transition-all duration-200 ${
									errors.fullName
										? "border-red-300 focus:border-red-500 focus:ring-red-500"
										: "border-gray-300 focus:border-purple-primary focus:ring-purple-primary hover:border-gray-400"
								} focus:outline-none focus:ring-2 focus:ring-opacity-50`}
								placeholder="Enter your full name"
							/>
						</div>
						{errors.fullName && (
							<p className="mt-2 text-sm text-red-600 font-medium">{errors.fullName}</p>
						)}
					</div>

					{/* IC/Passport Number */}
					<div>
						<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
							IC/Passport Number <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<IdentificationIcon className="h-5 w-5 text-gray-400" />
							</div>
							<input
								type="text"
								name="icNumber"
								value={formData.icNumber}
								onChange={handleIcNumberChange}
								className={`w-full pl-10 pr-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base text-gray-900 bg-white transition-all duration-200 ${
									errors.icNumber || icError
										? "border-red-300 focus:border-red-500 focus:ring-red-500"
										: "border-gray-300 focus:border-purple-primary focus:ring-purple-primary hover:border-gray-400"
								} focus:outline-none focus:ring-2 focus:ring-opacity-50`}
								placeholder="Enter your IC or passport number"
							/>
						</div>
						{formData.icType && (
							<div className="mt-2 flex items-center space-x-2">
								<div className="w-2 h-2 bg-green-500 rounded-full"></div>
								<span className="text-sm text-green-600 font-body">
									{formData.icType === 'IC' ? 'Malaysian IC detected' : 'Passport number detected'}
								</span>
							</div>
						)}
						{formData.dateOfBirth && (
							<div className="mt-2 flex items-center space-x-2">
								<div className={`w-2 h-2 rounded-full ${isAtLeast18YearsOld(formData.dateOfBirth) ? 'bg-green-500' : 'bg-red-500'}`}></div>
								<span className={`text-sm font-body ${isAtLeast18YearsOld(formData.dateOfBirth) ? 'text-green-600' : 'text-red-600'}`}>
									Date of Birth: {formData.dateOfBirth.toLocaleDateString()} (Age: {calculateAge(formData.dateOfBirth)} years)
								</span>
							</div>
						)}
						{(errors.icNumber || icError) && (
							<p className="mt-2 text-sm text-red-600 font-medium">{errors.icNumber || icError}</p>
						)}
						{errors.dateOfBirth && (
							<p className="mt-2 text-sm text-red-600 font-medium">{errors.dateOfBirth}</p>
						)}
					</div>

					{/* Date of Birth - Manual input for passport holders or if DOB not extracted */}
					{(formData.icType === 'PASSPORT' || (formData.icType === 'IC' && !formData.dateOfBirth)) && (
						<div>
							<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
								Date of Birth <span className="text-red-500">*</span>
							</label>
							<input
								type="date"
								name="dateOfBirth"
								value={formData.dateOfBirth ? formData.dateOfBirth.toISOString().split('T')[0] : ''}
								onChange={(e) => {
									const dateValue = e.target.value ? new Date(e.target.value + 'T12:00:00') : null;
									setFormData(prev => ({ ...prev, dateOfBirth: dateValue }));
									// Clear error when user changes date
									if (errors.dateOfBirth) {
										setErrors(prev => ({ ...prev, dateOfBirth: "" }));
									}
								}}
								className={`w-full px-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base text-gray-900 bg-white transition-all duration-200 ${
									errors.dateOfBirth
										? "border-red-300 focus:border-red-500 focus:ring-red-500"
										: "border-gray-300 focus:border-purple-primary focus:ring-purple-primary hover:border-gray-400"
								} focus:outline-none focus:ring-2 focus:ring-opacity-50`}
							/>
							{errors.dateOfBirth && (
								<p className="mt-2 text-sm text-red-600 font-medium">{errors.dateOfBirth}</p>
							)}
						</div>
					)}

					{/* Email Address */}
					<div>
						<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
							Email Address <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<EnvelopeIcon className="h-5 w-5 text-gray-400" />
							</div>
							<input
								type="email"
								name="email"
								value={formData.email}
								onChange={handleInputChange}
								className={`w-full pl-10 pr-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base text-gray-900 bg-white transition-all duration-200 ${
									errors.email
										? "border-red-300 focus:border-red-500 focus:ring-red-500"
										: "border-gray-300 focus:border-purple-primary focus:ring-purple-primary hover:border-gray-400"
								} focus:outline-none focus:ring-2 focus:ring-opacity-50`}
								placeholder="Enter your email address"
							/>
						</div>
						{errors.email && (
							<p className="mt-2 text-sm text-red-600 font-medium">{errors.email}</p>
						)}
					</div>

					{/* Education Level */}
					<div>
						<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
							Education Level <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<AcademicCapIcon className="h-5 w-5 text-gray-400" />
							</div>
							<select
								name="educationLevel"
								value={formData.educationLevel}
								onChange={handleInputChange}
								className={`w-full pl-10 pr-8 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base text-gray-900 bg-white transition-all duration-200 ${
									errors.educationLevel
										? "border-red-300 focus:border-red-500 focus:ring-red-500"
										: "border-gray-300 focus:border-purple-primary focus:ring-purple-primary hover:border-gray-400"
								} focus:outline-none focus:ring-2 focus:ring-opacity-50`}
							>
								<option value="">Select your education level</option>
								{educationLevels.map((level) => (
									<option key={level} value={level}>
										{level}
									</option>
								))}
							</select>
						</div>
						{errors.educationLevel && (
							<p className="mt-2 text-sm text-red-600 font-medium">{errors.educationLevel}</p>
						)}
					</div>

					{/* Emergency Contact Section */}
					<div className="space-y-6 pt-6 border-t border-gray-100">
						<div className="flex items-center mb-4">
							<div className="bg-purple-primary/10 rounded-xl p-3 mr-4">
								<UserGroupIcon className="w-6 h-6 lg:w-7 lg:h-7 text-purple-primary" />
							</div>
							<div>
								<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
									Emergency Contact
								</h3>
								<p className="text-sm lg:text-base text-purple-primary font-semibold">
									Someone we can reach in emergencies
								</p>
							</div>
						</div>

						{/* Emergency Contact Name */}
						<div>
							<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
								Full Name <span className="text-red-500">*</span>
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<UserIcon className="h-5 w-5 text-gray-400" />
								</div>
								<input
									type="text"
									name="emergencyContactName"
									value={formData.emergencyContactName}
									onChange={handleInputChange}
									className={`w-full pl-10 pr-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base text-gray-900 bg-white transition-all duration-200 ${
										errors.emergencyContactName
											? "border-red-300 focus:border-red-500 focus:ring-red-500"
											: "border-gray-300 focus:border-purple-primary focus:ring-purple-primary hover:border-gray-400"
									} focus:outline-none focus:ring-2 focus:ring-opacity-50`}
									placeholder="Enter emergency contact's full name"
								/>
							</div>
							{errors.emergencyContactName && (
								<p className="mt-2 text-sm text-red-600 font-medium">{errors.emergencyContactName}</p>
							)}
						</div>

						{/* Emergency Contact Phone */}
						<div>
							<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
								Phone Number <span className="text-red-500">*</span>
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<UserIcon className="h-5 w-5 text-gray-400" />
								</div>
								<input
									type="tel"
									name="emergencyContactPhone"
									value={formData.emergencyContactPhone}
									onChange={handleInputChange}
									className={`w-full pl-10 pr-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base text-gray-900 bg-white transition-all duration-200 ${
										errors.emergencyContactPhone
											? "border-red-300 focus:border-red-500 focus:ring-red-500"
											: "border-gray-300 focus:border-purple-primary focus:ring-purple-primary hover:border-gray-400"
									} focus:outline-none focus:ring-2 focus:ring-opacity-50`}
									placeholder="e.g., +60123456789 or 0123456789"
								/>
							</div>
							{errors.emergencyContactPhone && (
								<p className="mt-2 text-sm text-red-600 font-medium">{errors.emergencyContactPhone}</p>
							)}
							<p className="mt-2 text-sm text-gray-500 font-body">
								Include country code for international numbers
							</p>
						</div>

						{/* Emergency Contact Relationship */}
						<div>
							<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
								Relationship <span className="text-red-500">*</span>
							</label>
							<select
								name="emergencyContactRelationship"
								value={formData.emergencyContactRelationship}
								onChange={handleInputChange}
								className={`w-full px-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base text-gray-900 bg-white transition-all duration-200 ${
									errors.emergencyContactRelationship
										? "border-red-300 focus:border-red-500 focus:ring-red-500"
										: "border-gray-300 focus:border-purple-primary focus:ring-purple-primary hover:border-gray-400"
								} focus:outline-none focus:ring-2 focus:ring-opacity-50`}
							>
								<option value="">Select relationship</option>
								<option value="Parent">Parent</option>
								<option value="Spouse">Spouse</option>
								<option value="Sibling">Sibling</option>
								<option value="Child">Child</option>
								<option value="Friend">Friend</option>
								<option value="Relative">Relative</option>
								<option value="Colleague">Colleague</option>
								<option value="Other">Other</option>
							</select>
							{errors.emergencyContactRelationship && (
								<p className="mt-2 text-sm text-red-600 font-medium">{errors.emergencyContactRelationship}</p>
							)}
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-100">
						{showBackButton && (
							<button
								type="button"
								onClick={onBack}
								className="w-full sm:w-auto px-6 py-3 lg:py-4 border border-gray-300 text-gray-700 rounded-xl lg:rounded-2xl font-medium font-body text-sm lg:text-base transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-opacity-50"
							>
								Back
							</button>
						)}
						<button
							type="submit"
							disabled={!isFormValid}
							className={`w-full sm:flex-1 px-6 py-3 lg:py-4 rounded-xl lg:rounded-2xl font-medium font-body text-sm lg:text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-opacity-50 ${
								!isFormValid
									? "bg-gray-300 text-gray-500 cursor-not-allowed"
									: "bg-purple-primary hover:bg-purple-700 text-white shadow-sm hover:shadow-md"
							}`}
						>
							{isLastStep ? "Complete" : "Continue"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
