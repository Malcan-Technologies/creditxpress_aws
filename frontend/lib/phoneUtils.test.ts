import { validatePhoneNumber, formatPhoneNumber, isMobileNumber } from './phoneUtils';

// Test cases for phone validation
const testCases = [
	// Valid Malaysian mobile numbers
	{ phone: '+60123456789', expected: true, description: 'Valid Malaysian mobile number' },
	{ phone: '60123456789', expected: true, description: 'Valid Malaysian mobile number without +' },
	{ phone: '+60182440976', expected: true, description: 'Valid Malaysian mobile number (018)' },
	
	// Valid international numbers
	{ phone: '+1234567890', expected: true, description: 'Valid US number' },
	{ phone: '+447700900123', expected: true, description: 'Valid UK mobile number' },
	{ phone: '+6581234567', expected: true, description: 'Valid Singapore number' },
	
	// Invalid numbers
	{ phone: '123', expected: false, description: 'Too short' },
	{ phone: 'invalid', expected: false, description: 'Non-numeric' },
	{ phone: '', expected: false, description: 'Empty string' },
	{ phone: '+999123456789', expected: false, description: 'Invalid country code' },
];

// Run tests
console.log('🧪 Testing Phone Validation Utility');
console.log('=====================================');

testCases.forEach(({ phone, expected, description }, index) => {
	const result = validatePhoneNumber(phone);
	const passed = result.isValid === expected;
	
	console.log(`Test ${index + 1}: ${description}`);
	console.log(`  Input: "${phone}"`);
	console.log(`  Expected: ${expected ? 'Valid' : 'Invalid'}`);
	console.log(`  Result: ${result.isValid ? 'Valid' : 'Invalid'}`);
	console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}`);
	
	if (result.isValid) {
		console.log(`  Formatted: ${result.formattedNumber}`);
		console.log(`  Country: ${result.country}`);
		console.log(`  Type: ${result.type || 'undefined'}`);
	} else {
		console.log(`  Error: ${result.error}`);
	}
	console.log('');
});

// Test mobile number detection
console.log('📱 Testing Mobile Number Detection');
console.log('==================================');

const mobileTests = [
	'+60123456789',
	'+60182440976',
	'+447700900123',
	'+1234567890'
];

mobileTests.forEach(phone => {
	const isMobile = isMobileNumber(phone);
	console.log(`${phone}: ${isMobile ? 'Mobile' : 'Not Mobile/Unknown'}`);
});

console.log('');
console.log('📞 Testing Phone Number Formatting');
console.log('===================================');

const formatTests = [
	'+60123456789',
	'+447700900123',
	'+1234567890'
];

formatTests.forEach(phone => {
	console.log(`Original: ${phone}`);
	console.log(`  International: ${formatPhoneNumber(phone, 'international')}`);
	console.log(`  National: ${formatPhoneNumber(phone, 'national')}`);
	console.log(`  E164: ${formatPhoneNumber(phone, 'e164')}`);
	console.log('');
}); 