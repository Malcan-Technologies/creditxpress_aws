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
	AcademicCapIcon,
	ShieldCheckIcon
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

const raceOptions = [
	"Melayu",
	"Cina",
	"India",
	"Lain-lain",
	"Bumiputra (Sabah/Sarawak)",
	"Bukan Warganegara",
] as const;

const genderOptions = [
	"Male",
	"Female",
] as const;

interface PersonalInfoFormProps {
	initialValues: Partial<PersonalInfo>;
	onSubmit: (values: PersonalInfo) => void;
	onBack: () => void;
	showBackButton: boolean;
	isLastStep: boolean;
	certificateStatus?: {
		loading: boolean;
		hasValidCert: boolean;
		certificateData?: any;
		nameMatches?: boolean;
		expectedName?: string;
	};
	error?: string | null;
}

export default function PersonalInfoForm({
	initialValues,
	onSubmit,
	onBack,
	showBackButton,
	isLastStep,
	certificateStatus,
	error,
}: PersonalInfoFormProps) {
	const [formData, setFormData] = useState<PersonalInfo>({
		fullName: initialValues.fullName || "",
		dateOfBirth: initialValues.dateOfBirth || null,
		email: initialValues.email || "",
		phoneNumber: initialValues.phoneNumber || "",
		icNumber: initialValues.icNumber || "",
		icType: initialValues.icType || null,
		educationLevel: initialValues.educationLevel || "",
		race: initialValues.race || "",
		gender: initialValues.gender || "",
		emergencyContactName: initialValues.emergencyContactName || "",
		emergencyContactPhone: initialValues.emergencyContactPhone || "",
		emergencyContactRelationship: initialValues.emergencyContactRelationship || "",
	});

	const [errors, setErrors] = useState<Record<string, string>>({});
	const [icError, setIcError] = useState<string>("");

	// Re-validate IC number on mount to ensure correct type detection
	// This fixes cases where icType was incorrectly stored in database (e.g., IC stored as PASSPORT)
	useEffect(() => {
		if (formData.icNumber.trim()) {
			const validation = validateICOrPassport(formData.icNumber);
			if (validation.isValid && validation.type) {
				// Only update if the detected type is different from current
				if (validation.type !== formData.icType) {
					console.log(`IC type corrected: ${formData.icType} -> ${validation.type}`);
					setFormData(prev => ({
						...prev,
						icType: validation.type,
						dateOfBirth: validation.extractedDOB || prev.dateOfBirth || null,
					}));
				} else if (validation.type === 'IC' && validation.extractedDOB && !formData.dateOfBirth) {
					// Also extract DOB if we have IC but no DOB
					setFormData(prev => ({
						...prev,
						dateOfBirth: validation.extractedDOB || null,
					}));
				}
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Only run on mount

	// Check if name and IC fields should be disabled due to valid certificate
	const hasValidCertificate = certificateStatus?.hasValidCert && certificateStatus?.nameMatches;
	const shouldDisableNameAndIC = hasValidCertificate;

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const { name, value } = e.target;
		setFormData(prev => ({ ...prev, [name]: value }));
		
		// Clear error when user starts typing
		if (errors[name]) {
			setErrors(prev => ({ ...prev, [name]: "" }));
		}
		
		// Clear external error if it's email-related and user is typing in email field
		if (name === "email" && error && error.toLowerCase().includes("email")) {
			// Error will be cleared by parent component on next submit attempt
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
		// For passport holders: DOB is optional (age verification done via KYC)
		const isPassportType = formData.icType === 'PASSPORT';
		if (!isPassportType && !formData.dateOfBirth) {
			newErrors.dateOfBirth = "Date of birth is required for age verification";
		} else if (formData.dateOfBirth && !isAtLeast18YearsOld(formData.dateOfBirth)) {
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

		// Race validation
		if (!formData.race?.trim()) {
			newErrors.race = "Race is required";
		}

		// Gender validation
		if (!formData.gender?.trim()) {
			newErrors.gender = "Gender is required";
		}

		// Occupation validation
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
				race: formData.race!,
				gender: formData.gender!,
				emergencyContactName: formData.emergencyContactName!,
				emergencyContactPhone: formData.emergencyContactPhone!,
				emergencyContactRelationship: formData.emergencyContactRelationship!,
			});
		}
	};

	// Check if mandatory fields are completed and valid
	// For passport holders: DOB is optional since we can't extract it, but if provided, age must be valid
	const isPassport = formData.icType === 'PASSPORT';
	const dobProvided = formData.dateOfBirth !== null;
	const ageIsValid = dobProvided ? isAtLeast18YearsOld(formData.dateOfBirth) : false;
	
	const validationChecks = {
		fullName: formData.fullName.trim() !== "",
		icNumber: formData.icNumber.trim() !== "",
		email: formData.email.trim() !== "",
		emailFormat: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email),
		educationLevel: formData.educationLevel.trim() !== "",
		race: formData.race.trim() !== "",
		gender: formData.gender.trim() !== "",
		emergencyContactName: formData.emergencyContactName.trim() !== "",
		emergencyContactPhone: formData.emergencyContactPhone.trim() !== "",
		emergencyContactPhoneValid: validateEmergencyContactPhone(formData.emergencyContactPhone),
		emergencyContactRelationship: formData.emergencyContactRelationship.trim() !== "",
		icValid: validateICOrPassport(formData.icNumber).isValid,
		// For passport: DOB is optional (can be verified later via KYC)
		// For IC: DOB is required and extracted automatically
		dateOfBirth: isPassport ? true : dobProvided,
		// For passport: If DOB is provided, check age; otherwise skip age check
		// For IC: Age must be valid (18+)
		ageValid: isPassport ? (!dobProvided || ageIsValid) : ageIsValid,
		noIcError: !icError,
	};

	// Debug: Log which validations are failing
	if (process.env.NODE_ENV === 'development') {
		const failingChecks = Object.entries(validationChecks)
			.filter(([_, valid]) => !valid)
			.map(([key]) => key);
		if (failingChecks.length > 0) {
			console.log('Failing validations:', failingChecks);
		}
	}

	const isFormValid = Object.values(validationChecks).every(Boolean);

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
					{/* General Error Banner */}
					{error && !error.toLowerCase().includes("email") && (
						<div className="bg-red-50 border border-red-200 rounded-xl p-4">
							<div className="flex items-start space-x-3">
								<div className="flex-1">
									<p className="text-sm text-red-700 font-body">{error}</p>
								</div>
							</div>
						</div>
					)}
					
					{/* Certificate Warning */}
					{shouldDisableNameAndIC && (
						<div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
							<div className="flex items-start space-x-3">
								<ShieldCheckIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
								<div className="flex-1">
									<h4 className="text-sm font-medium text-blue-800 font-body mb-1">
										Certificate Protection Enabled
									</h4>
									<p className="text-sm text-blue-700 font-body">
										Your name and IC number are protected because you have a valid digital certificate. 
										These fields cannot be changed to maintain certificate validity.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Full Name */}
					<div>
						<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
							Full Name (as per IC) <span className="text-red-500">*</span>
							{shouldDisableNameAndIC && (
								<span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
									Protected
								</span>
							)}
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<UserIcon className={`h-5 w-5 ${shouldDisableNameAndIC ? 'text-gray-400' : 'text-gray-400'}`} />
							</div>
							<input
								type="text"
								name="fullName"
								value={formData.fullName}
								onChange={handleInputChange}
								disabled={shouldDisableNameAndIC}
								className={`w-full pl-10 pr-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base transition-all duration-200 ${
									shouldDisableNameAndIC
										? "bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed"
										: errors.fullName
										? "border-red-300 focus:border-red-500 focus:ring-red-500 text-gray-900 bg-white"
										: "border-gray-300 focus:border-purple-primary focus:ring-purple-primary hover:border-gray-400 text-gray-900 bg-white"
								} focus:outline-none focus:ring-2 focus:ring-opacity-50`}
								placeholder="Enter your full name"
							/>
							{shouldDisableNameAndIC && (
								<div className="absolute inset-y-0 right-0 pr-3 flex items-center">
									<ShieldCheckIcon className="h-5 w-5 text-blue-600" />
								</div>
							)}
						</div>
						{errors.fullName && (
							<p className="mt-2 text-sm text-red-600 font-medium">{errors.fullName}</p>
						)}
					</div>

					{/* IC/Passport Number */}
					<div>
						<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
							IC/Passport Number <span className="text-red-500">*</span>
							{shouldDisableNameAndIC && (
								<span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
									Protected
								</span>
							)}
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
								disabled={shouldDisableNameAndIC}
								className={`w-full pl-10 pr-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base transition-all duration-200 ${
									shouldDisableNameAndIC
										? "bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed"
										: errors.icNumber || icError
										? "border-red-300 focus:border-red-500 focus:ring-red-500 text-gray-900 bg-white"
										: "border-gray-300 focus:border-purple-primary focus:ring-purple-primary hover:border-gray-400 text-gray-900 bg-white"
								} focus:outline-none focus:ring-2 focus:ring-opacity-50`}
								placeholder="Enter your IC or passport number"
							/>
							{shouldDisableNameAndIC && (
								<div className="absolute inset-y-0 right-0 pr-3 flex items-center">
									<ShieldCheckIcon className="h-5 w-5 text-blue-600" />
								</div>
							)}
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
									errors.email || (error && error.toLowerCase().includes("email"))
										? "border-red-300 focus:border-red-500 focus:ring-red-500"
										: "border-gray-300 focus:border-purple-primary focus:ring-purple-primary hover:border-gray-400"
								} focus:outline-none focus:ring-2 focus:ring-opacity-50`}
								placeholder="Enter your email address"
							/>
						</div>
						{errors.email && (
							<p className="mt-2 text-sm text-red-600 font-medium">{errors.email}</p>
						)}
						{error && error.toLowerCase().includes("email") && !errors.email && (
							<p className="mt-2 text-sm text-red-600 font-medium">{error}</p>
						)}
					</div>

					{/* Education Level */}
					<div>
						<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
							Education Level <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
								<AcademicCapIcon className="h-5 w-5 text-gray-400" />
							</div>
							<select
								name="educationLevel"
								value={formData.educationLevel}
								onChange={handleInputChange}
								className={`w-full pl-11 pr-10 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base text-gray-900 bg-white transition-all duration-200 appearance-none ${
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
							{/* Custom dropdown arrow */}
							<div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
								<svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
									<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
								</svg>
							</div>
						</div>
						{errors.educationLevel && (
							<p className="mt-2 text-sm text-red-600 font-medium">{errors.educationLevel}</p>
						)}
					</div>

					{/* Race */}
					<div>
						<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
							Race <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<select
								name="race"
								value={formData.race}
								onChange={handleInputChange}
								className={`w-full px-3 pr-10 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base text-gray-900 bg-white transition-all duration-200 appearance-none ${
									errors.race
										? "border-red-300 focus:border-red-500 focus:ring-red-500"
										: "border-gray-300 focus:border-purple-primary focus:ring-purple-primary hover:border-gray-400"
								} focus:outline-none focus:ring-2 focus:ring-opacity-50`}
							>
								<option value="">Select your race</option>
								{raceOptions.map((race) => (
									<option key={race} value={race}>
										{race}
									</option>
								))}
							</select>
							{/* Custom dropdown arrow */}
							<div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
								<svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
									<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
								</svg>
							</div>
						</div>
						{errors.race && (
							<p className="mt-2 text-sm text-red-600 font-medium">{errors.race}</p>
						)}
					</div>

					{/* Gender */}
					<div>
						<label className="block text-sm lg:text-base font-medium text-gray-700 mb-2 font-body">
							Gender <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<select
								name="gender"
								value={formData.gender}
								onChange={handleInputChange}
								className={`w-full px-3 pr-10 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base text-gray-900 bg-white transition-all duration-200 appearance-none ${
									errors.gender
										? "border-red-300 focus:border-red-500 focus:ring-red-500"
										: "border-gray-300 focus:border-purple-primary focus:ring-purple-primary hover:border-gray-400"
								} focus:outline-none focus:ring-2 focus:ring-opacity-50`}
							>
								<option value="">Select your gender</option>
								{genderOptions.map((gender) => (
									<option key={gender} value={gender}>
										{gender}
									</option>
								))}
							</select>
							{/* Custom dropdown arrow */}
							<div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
								<svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
									<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
								</svg>
							</div>
						</div>
					{errors.gender && (
						<p className="mt-2 text-sm text-red-600 font-medium">{errors.gender}</p>
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
							<div className="relative">
								<select
									name="emergencyContactRelationship"
									value={formData.emergencyContactRelationship}
									onChange={handleInputChange}
									className={`w-full px-3 pr-10 py-3 lg:py-4 border rounded-xl lg:rounded-2xl font-body text-sm lg:text-base text-gray-900 bg-white transition-all duration-200 appearance-none ${
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
								{/* Custom dropdown arrow */}
								<div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
									<svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
										<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
									</svg>
								</div>
							</div>
							{errors.emergencyContactRelationship && (
								<p className="mt-2 text-sm text-red-600 font-medium">{errors.emergencyContactRelationship}</p>
							)}
						</div>
					</div>

					{/* Missing Fields Indicator */}
					{!isFormValid && (
						<div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
							<p className="text-sm font-medium text-amber-800 mb-2">Please complete the following:</p>
							<ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
								{!validationChecks.fullName && <li>Full Name is required</li>}
								{!validationChecks.icNumber && <li>IC/Passport Number is required</li>}
								{validationChecks.icNumber && !validationChecks.icValid && <li>IC/Passport Number format is invalid</li>}
								{!validationChecks.dateOfBirth && !isPassport && <li>Date of Birth is required (enter valid Malaysian IC)</li>}
								{!validationChecks.ageValid && dobProvided && <li>You must be at least 18 years old</li>}
								{!validationChecks.email && <li>Email Address is required</li>}
								{validationChecks.email && !validationChecks.emailFormat && <li>Email Address format is invalid</li>}
								{!validationChecks.educationLevel && <li>Education Level is required</li>}
								{!validationChecks.race && <li>Race is required</li>}
								{!validationChecks.gender && <li>Gender is required</li>}
								{!validationChecks.emergencyContactName && <li>Emergency Contact Name is required</li>}
								{!validationChecks.emergencyContactPhone && <li>Emergency Contact Phone is required</li>}
								{validationChecks.emergencyContactPhone && !validationChecks.emergencyContactPhoneValid && <li>Emergency Contact Phone must be 8-15 digits</li>}
								{!validationChecks.emergencyContactRelationship && <li>Emergency Contact Relationship is required</li>}
								{!validationChecks.noIcError && <li>Please fix the IC/Passport error shown above</li>}
							</ul>
						</div>
					)}

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
