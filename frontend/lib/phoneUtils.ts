import { parsePhoneNumber, isValidPhoneNumber, PhoneNumber } from "libphonenumber-js";

export interface PhoneValidationResult {
	isValid: boolean;
	error?: string;
	formattedNumber?: string;
	country?: string;
	type?: string;
}

/**
 * Validates a phone number using Google's libphonenumber
 * @param phone - The phone number to validate
 * @param options - Validation options
 * @returns Validation result with error message if invalid
 */
export function validatePhoneNumber(
	phone: string,
	options: {
		requireMobile?: boolean;
		allowLandline?: boolean;
	} = {}
): PhoneValidationResult {
	const { requireMobile = false, allowLandline = true } = options;

	if (!phone) {
		return {
			isValid: false,
			error: "Phone number is required"
		};
	}

	try {
		// Add '+' prefix if not present for validation
		const phoneWithPrefix = phone.startsWith('+') ? phone : `+${phone}`;
		
		// Check if the phone number is valid
		if (!isValidPhoneNumber(phoneWithPrefix)) {
			return {
				isValid: false,
				error: "Please enter a valid phone number"
			};
		}

		// Parse the phone number to get more details
		const parsedPhone = parsePhoneNumber(phoneWithPrefix);
		
		if (!parsedPhone) {
			return {
				isValid: false,
				error: "Please enter a valid phone number"
			};
		}

		const phoneType = parsedPhone.getType();
		
		// Check phone type requirements - handle undefined type gracefully
		if (requireMobile && phoneType && phoneType !== 'MOBILE' && phoneType !== 'FIXED_LINE_OR_MOBILE') {
			return {
				isValid: false,
				error: "Please enter a valid mobile phone number"
			};
		}

		if (!allowLandline && phoneType === 'FIXED_LINE') {
			return {
				isValid: false,
				error: "Please enter a mobile phone number"
			};
		}

		// If requireMobile is true but phoneType is undefined, we'll be lenient
		// since some valid mobile numbers might not have a detectable type
		return {
			isValid: true,
			formattedNumber: parsedPhone.formatInternational(),
			country: parsedPhone.country,
			type: phoneType
		};
	} catch (error) {
		return {
			isValid: false,
			error: "Please enter a valid phone number"
		};
	}
}

/**
 * Formats a phone number for display
 * @param phone - The phone number to format
 * @param format - The format to use ('international', 'national', 'e164')
 * @returns Formatted phone number or original if invalid
 */
export function formatPhoneNumber(
	phone: string,
	format: 'international' | 'national' | 'e164' = 'international'
): string {
	try {
		const phoneWithPrefix = phone.startsWith('+') ? phone : `+${phone}`;
		const parsedPhone = parsePhoneNumber(phoneWithPrefix);
		
		if (!parsedPhone) {
			return phone;
		}

		switch (format) {
			case 'international':
				return parsedPhone.formatInternational();
			case 'national':
				return parsedPhone.formatNational();
			case 'e164':
				return parsedPhone.format('E.164');
			default:
				return parsedPhone.formatInternational();
		}
	} catch (error) {
		return phone;
	}
}

/**
 * Gets the country code from a phone number
 * @param phone - The phone number
 * @returns Country code or undefined if invalid
 */
export function getPhoneCountry(phone: string): string | undefined {
	try {
		const phoneWithPrefix = phone.startsWith('+') ? phone : `+${phone}`;
		const parsedPhone = parsePhoneNumber(phoneWithPrefix);
		return parsedPhone?.country;
	} catch (error) {
		return undefined;
	}
}

/**
 * Checks if a phone number is a mobile number
 * @param phone - The phone number to check
 * @returns True if mobile, false otherwise
 */
export function isMobileNumber(phone: string): boolean {
	try {
		const phoneWithPrefix = phone.startsWith('+') ? phone : `+${phone}`;
		const parsedPhone = parsePhoneNumber(phoneWithPrefix);
		
		if (!parsedPhone) {
			return false;
		}

		const phoneType = parsedPhone.getType();
		return phoneType === 'MOBILE' || phoneType === 'FIXED_LINE_OR_MOBILE';
	} catch (error) {
		return false;
	}
} 