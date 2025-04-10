export interface PersonalInfo {
	fullName: string;
	dateOfBirth: Date | null;
	email: string;
}

export interface AddressInfo {
	address1: string;
	address2: string;
	city: string;
	state: string;
	postalCode: string;
}

export interface EmploymentInfo {
	employmentStatus: string;
	employerName: string;
	monthlyIncome: string;
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
	BankInfo &
	OnboardingMetadata;
