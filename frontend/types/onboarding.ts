export interface PersonalInfo {
	fullName: string;
	dateOfBirth: Date | null;
	email: string;
	phoneNumber: string; // Display only, cannot be changed
	icNumber: string;
	icType: 'IC' | 'PASSPORT' | null;
	educationLevel: string;
	race: string;
	gender: string;
	emergencyContactName: string;
	emergencyContactPhone: string;
	emergencyContactRelationship: string;
}

export interface AddressInfo {
	address1: string;
	address2: string;
	city: string;
	state: string;
	postalCode: string;
}

export interface EmploymentInfo {
	occupation: string;
	employmentStatus: string;
	employerName: string;
	monthlyIncome: string;
	serviceLength: string;
}

export interface EmergencyContactInfo {
	emergencyContactName: string;
	emergencyContactPhone: string;
	emergencyContactRelationship: string;
}

export interface BankInfo {
	bankName: string;
	accountNumber: string;
}

export interface OnboardingMetadata {
	onboardingStep?: number;
	isOnboardingComplete?: boolean;
}

export type OnboardingFormData = PersonalInfo &
	AddressInfo &
	EmploymentInfo &
	EmergencyContactInfo &
	BankInfo &
	OnboardingMetadata;
