#!/usr/bin/env node

/**
 * Debug July 1st Disbursement Issue
 * 
 * This script investigates why a July 1st disbursement with August 1st first payment
 * results in different payment amounts when they should be equal.
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// SafeMath utilities (simplified for testing)
const SafeMath = {
	toNumber: (value) => Math.round(value * 100) / 100,
	add: (a, b) => Math.round((a + b) * 100) / 100,
	subtract: (a, b) => Math.round((a - b) * 100) / 100,
	multiply: (a, b) => Math.round((a * b) * 100) / 100,
	divide: (a, b) => Math.round((a / b) * 100) / 100,
	max: (a, b) => Math.max(a, b)
};

// Helper function to calculate first payment date with 20th cutoff rule
function calculateFirstPaymentDate(disbursementDate) {
	// Convert disbursement date to Malaysia timezone for cutoff logic
	const malaysiaTime = new Date(disbursementDate.getTime() + (8 * 60 * 60 * 1000));
	
	const day = malaysiaTime.getUTCDate();
	const month = malaysiaTime.getUTCMonth();
	const year = malaysiaTime.getUTCFullYear();
	
	let firstPaymentMonth;
	let firstPaymentYear;
	
	if (day < 20) {
		// If disbursed before 20th, first payment is 1st of next month
		firstPaymentMonth = month + 1;
		firstPaymentYear = year;
		
		// Handle year rollover
		if (firstPaymentMonth > 11) {
			firstPaymentMonth = 0;
			firstPaymentYear++;
		}
	} else {
		// If disbursed on or after 20th, first payment is 1st of month after next
		firstPaymentMonth = month + 2;
		firstPaymentYear = year;
		
		// Handle year rollover
		if (firstPaymentMonth > 11) {
			firstPaymentMonth = firstPaymentMonth - 12;
			firstPaymentYear++;
		}
	}
	
	// Create first payment date as 1st of target month at end of day (Malaysia timezone)
	// Set to 15:59:59 UTC so it becomes 23:59:59 Malaysia time (GMT+8)
	const firstPaymentDate = new Date(
		Date.UTC(firstPaymentYear, firstPaymentMonth, 1, 15, 59, 59, 999)
	);
	
	return firstPaymentDate;
}

// Helper function to calculate days between two dates in Malaysia timezone
function calculateDaysBetweenMalaysia(startDate, endDate) {
	// Convert both dates to Malaysia timezone for accurate day calculation
	const startMalaysia = new Date(startDate.getTime() + (8 * 60 * 60 * 1000));
	const endMalaysia = new Date(endDate.getTime() + (8 * 60 * 60 * 1000));
	
	// Get start of day for both dates
	const startDay = new Date(Date.UTC(
		startMalaysia.getUTCFullYear(),
		startMalaysia.getUTCMonth(),
		startMalaysia.getUTCDate(),
		0, 0, 0, 0
	));
	
	const endDay = new Date(Date.UTC(
		endMalaysia.getUTCFullYear(),
		endMalaysia.getUTCMonth(),
		endMalaysia.getUTCDate(),
		0, 0, 0, 0
	));
	
	const diffMs = endDay.getTime() - startDay.getTime();
	return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// Format date for display (Malaysia timezone)
function formatMalaysiaDate(date) {
	const malaysiaTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
	return malaysiaTime.toISOString().split('T')[0];
}

// Current implementation - simulate the actual calculation
function simulateCurrentCalculation(disbursementDate, principal, interestRate, term) {
	console.log(`\n🔍 SIMULATING CURRENT CALCULATION:`);
	console.log(`   Disbursement: ${formatMalaysiaDate(disbursementDate)}`);
	
	// Calculate first payment date using cutoff logic
	const firstPaymentDate = calculateFirstPaymentDate(disbursementDate);
	const daysInFirstPeriod = calculateDaysBetweenMalaysia(disbursementDate, firstPaymentDate);
	
	console.log(`   First Payment Date: ${formatMalaysiaDate(firstPaymentDate)}`);
	console.log(`   Days in First Period: ${daysInFirstPeriod}`);
	
	// Flat rate calculation: (Principal + Total Interest) / Term
	const monthlyInterestRateDecimal = SafeMath.toNumber(interestRate) / 100;
	const totalInterest = SafeMath.multiply(
		SafeMath.multiply(principal, monthlyInterestRateDecimal), 
		term
	);
	
	// Total amount to be paid (principal + interest)
	const totalAmountToPay = SafeMath.add(principal, totalInterest);
	
	console.log(`   Principal: RM ${principal.toLocaleString()}`);
	console.log(`   Interest Rate: ${interestRate}% monthly`);
	console.log(`   Term: ${term} months`);
	console.log(`   Total Interest: RM ${totalInterest.toFixed(2)}`);
	console.log(`   Total Amount: RM ${totalAmountToPay.toFixed(2)}`);
	
	// STRAIGHT-LINE FINANCING: Pro-rate the full monthly payment based on days
	const standardMonthlyPayment = SafeMath.divide(totalAmountToPay, term);
	const proRatedRatio = SafeMath.divide(daysInFirstPeriod, 30);
	
	console.log(`   Standard Monthly Payment: RM ${standardMonthlyPayment.toFixed(2)}`);
	console.log(`   Pro-rated Ratio: ${(proRatedRatio * 100).toFixed(2)}%`);
	
	// Calculate pro-rated amounts by applying the ratio to standard monthly amounts
	const monthlyInterestPortion = SafeMath.divide(totalInterest, term);
	const monthlyPrincipalPortion = SafeMath.divide(principal, term);
	
	const firstPeriodInterest = SafeMath.multiply(monthlyInterestPortion, proRatedRatio);
	const firstPeriodPrincipal = SafeMath.multiply(monthlyPrincipalPortion, proRatedRatio);
	const firstPayment = SafeMath.add(firstPeriodInterest, firstPeriodPrincipal);
	
	console.log(`   Monthly Interest Portion: RM ${monthlyInterestPortion.toFixed(2)}`);
	console.log(`   Monthly Principal Portion: RM ${monthlyPrincipalPortion.toFixed(2)}`);
	console.log(`   First Period Interest: RM ${firstPeriodInterest.toFixed(2)}`);
	console.log(`   First Period Principal: RM ${firstPeriodPrincipal.toFixed(2)}`);
	console.log(`   First Payment: RM ${firstPayment.toFixed(2)}`);
	
	// Calculate remaining amounts after first payment
	const remainingTerm = term - 1;
	const remainingInterest = SafeMath.subtract(totalInterest, firstPeriodInterest);
	const remainingPrincipal = SafeMath.subtract(principal, firstPeriodPrincipal);
	const remainingTotal = SafeMath.add(remainingInterest, remainingPrincipal);
	
	const baseMonthlyPayment = remainingTerm > 0 ? SafeMath.divide(remainingTotal, remainingTerm) : 0;
	
	console.log(`   Remaining Term: ${remainingTerm} payments`);
	console.log(`   Remaining Interest: RM ${remainingInterest.toFixed(2)}`);
	console.log(`   Remaining Principal: RM ${remainingPrincipal.toFixed(2)}`);
	console.log(`   Remaining Total: RM ${remainingTotal.toFixed(2)}`);
	console.log(`   Base Monthly Payment (2-${term}): RM ${baseMonthlyPayment.toFixed(2)}`);
	
	// Check if this matches your observed values
	console.log(`\n📊 COMPARISON WITH YOUR DATA:`);
	console.log(`   Your First Payment: RM 1,922.67`);
	console.log(`   Calculated First Payment: RM ${firstPayment.toFixed(2)}`);
	console.log(`   Difference: ${firstPayment > 1922.67 ? '+' : ''}${(firstPayment - 1922.67).toFixed(2)}`);
	
	console.log(`   Your Regular Payment: RM 1,861.58`);
	console.log(`   Calculated Regular Payment: RM ${baseMonthlyPayment.toFixed(2)}`);
	console.log(`   Difference: ${baseMonthlyPayment > 1861.58 ? '+' : ''}${(baseMonthlyPayment - 1861.58).toFixed(2)}`);
	
	// Analysis
	console.log(`\n💡 ANALYSIS:`);
	if (Math.abs(daysInFirstPeriod - 30) <= 1) {
		console.log(`   ⚠️  ISSUE: Days (${daysInFirstPeriod}) ≈ 30 days, should have equal payments!`);
		console.log(`   ⚠️  Pro-rating ratio should be ~100%, not ${(proRatedRatio * 100).toFixed(1)}%`);
		console.log(`   ⚠️  For monthly disbursements (1st to 1st), all payments should be equal`);
	} else {
		console.log(`   ℹ️  Pro-rating is appropriate for ${daysInFirstPeriod} days`);
	}
	
	return {
		firstPayment,
		baseMonthlyPayment,
		daysInFirstPeriod,
		proRatedRatio,
		standardMonthlyPayment
	};
}

// Test the July 1st scenario
async function testJulyDisbursement() {
	console.log('🐛 DEBUGGING JULY 1ST DISBURSEMENT ISSUE');
	console.log('========================================');
	
	// Based on your loan data - estimating the loan parameters
	const disbursementDate = new Date('2025-07-01T10:00:00.000Z');
	
	// Work backwards from your payment amounts to estimate loan parameters
	// Total of regular payments: 11 × 1,861.58 + 1,861.53 = RM 20,477.91
	// Plus first payment: 1,922.67 = RM 22,400.58 total
	// This suggests a loan amount around RM 20,000 at 1% monthly for 12 months
	
	const testScenarios = [
		{
			name: "Estimated Loan Parameters (PayAdvance)",
			principal: 20000,
			interestRate: 1.0, // 1% monthly
			term: 12
		},
		{
			name: "Alternative Parameters (SME)",
			principal: 15000,
			interestRate: 1.5, // 1.5% monthly  
			term: 12
		}
	];
	
	testScenarios.forEach(scenario => {
		console.log(`\n${'='.repeat(80)}`);
		console.log(`📊 ${scenario.name}`);
		console.log(`${'='.repeat(80)}`);
		
		const result = simulateCurrentCalculation(
			disbursementDate,
			scenario.principal,
			scenario.interestRate,
			scenario.term
		);
		
		// Check if this could be the issue
		console.log(`\n🎯 POTENTIAL FIX:`);
		if (Math.abs(result.daysInFirstPeriod - 30) <= 1) {
			console.log(`   ✅ For ${result.daysInFirstPeriod} days (≈1 month), all payments should be:`);
			console.log(`   ✅ Equal Payment Amount: RM ${result.standardMonthlyPayment.toFixed(2)}`);
			console.log(`   ✅ No pro-rating needed when period ≈ 30 days`);
		}
	});
}

// Propose the fix
async function proposeFix() {
	console.log(`\n\n🔧 PROPOSED FIX:`);
	console.log('================');
	console.log('When days in first period is ≈ 30 days (±1 day), skip pro-rating:');
	console.log('');
	console.log('```javascript');
	console.log('const daysInFirstPeriod = calculateDaysBetweenMalaysia(disbursementDate, firstPaymentDate);');
	console.log('');
	console.log('if (Math.abs(daysInFirstPeriod - 30) <= 1) {');
	console.log('    // Standard month - no pro-rating needed');
	console.log('    const standardMonthlyPayment = SafeMath.divide(totalAmountToPay, term);');
	console.log('    // All payments are equal');
	console.log('} else {');
	console.log('    // Pro-rate for non-standard periods');
	console.log('    const proRatedRatio = SafeMath.divide(daysInFirstPeriod, 30);');
	console.log('    // Apply pro-rating logic');
	console.log('}');
	console.log('```');
	console.log('');
	console.log('This ensures:');
	console.log('✅ 1st-to-1st disbursements have equal payments');
	console.log('✅ Pro-rating only applies when actually needed');
	console.log('✅ Maintains straight-line financing principles');
}

// Main execution
async function main() {
	try {
		await testJulyDisbursement();
		await proposeFix();
		
	} catch (error) {
		console.error('❌ Debug failed:', error);
	} finally {
		await prisma.$disconnect();
	}
}

main();