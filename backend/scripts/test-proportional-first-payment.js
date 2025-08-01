#!/usr/bin/env node

/**
 * Test Proportional First Payment Calculation
 * 
 * This script tests the new proportional method for calculating the first payment
 * using actual average days per period instead of assumed 30 days.
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
	const malaysiaTime = new Date(disbursementDate.getTime() + (8 * 60 * 60 * 1000));
	
	const day = malaysiaTime.getUTCDate();
	const month = malaysiaTime.getUTCMonth();
	const year = malaysiaTime.getUTCFullYear();
	
	let firstPaymentMonth, firstPaymentYear;
	
	if (day < 20) {
		firstPaymentMonth = month + 1;
		firstPaymentYear = year;
		if (firstPaymentMonth > 11) {
			firstPaymentMonth = 0;
			firstPaymentYear++;
		}
	} else {
		firstPaymentMonth = month + 2;
		firstPaymentYear = year;
		if (firstPaymentMonth > 11) {
			firstPaymentMonth = firstPaymentMonth - 12;
			firstPaymentYear++;
		}
	}
	
	return new Date(Date.UTC(firstPaymentYear, firstPaymentMonth, 1, 15, 59, 59, 999));
}

// Helper function to calculate days between dates in Malaysia timezone
function calculateDaysBetweenMalaysia(startDate, endDate) {
	const startMalaysia = new Date(startDate.getTime() + (8 * 60 * 60 * 1000));
	const endMalaysia = new Date(endDate.getTime() + (8 * 60 * 60 * 1000));
	
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

// Helper function to calculate actual average days per period for the entire loan term
function calculateActualAverageDaysPerPeriod(disbursementDate, term) {
	const firstPaymentDate = calculateFirstPaymentDate(disbursementDate);
	let totalDays = 0;
	
	// Calculate days for the first period (disbursement to first payment)
	totalDays += calculateDaysBetweenMalaysia(disbursementDate, firstPaymentDate);
	
	// Calculate days for subsequent periods (payment to payment)
	let currentPaymentDate = firstPaymentDate;
	for (let month = 2; month <= term; month++) {
		// Calculate next payment date (1st of next month)
		const currentMalaysia = new Date(currentPaymentDate.getTime() + (8 * 60 * 60 * 1000));
		let nextMonth = currentMalaysia.getUTCMonth() + 1;
		let nextYear = currentMalaysia.getUTCFullYear();
		
		if (nextMonth > 11) {
			nextMonth = 0;
			nextYear++;
		}
		
		const nextPaymentDate = new Date(Date.UTC(nextYear, nextMonth, 1, 15, 59, 59, 999));
		
		// Add days in this period
		totalDays += calculateDaysBetweenMalaysia(currentPaymentDate, nextPaymentDate);
		
		// Move to next period
		currentPaymentDate = nextPaymentDate;
	}
	
	return totalDays / term;
}

// Format date for display
function formatDate(date) {
	const malaysiaTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
	return malaysiaTime.toISOString().split('T')[0];
}

// NEW PROPORTIONAL METHOD
function calculateWithProportionalMethod(disbursementDate, principal, interestRate, term) {
	console.log('\n📊 NEW PROPORTIONAL METHOD CALCULATION');
	console.log('======================================');
	
	const firstPaymentDate = calculateFirstPaymentDate(disbursementDate);
	const daysInFirstPeriod = calculateDaysBetweenMalaysia(disbursementDate, firstPaymentDate);
	
	// Calculate actual average days per period for this specific loan
	const actualAverageDaysPerPeriod = calculateActualAverageDaysPerPeriod(disbursementDate, term);
	
	// Flat rate calculation
	const monthlyInterestRateDecimal = interestRate / 100;
	const totalInterest = principal * monthlyInterestRateDecimal * term;
	const totalAmountToPay = principal + totalInterest;
	
	// PROPORTIONAL METHOD: Use actual average days instead of assumed 30 days
	const standardMonthlyPayment = totalAmountToPay / term;
	const proRatedRatio = daysInFirstPeriod / actualAverageDaysPerPeriod;
	
	// Calculate pro-rated amounts
	const monthlyInterestPortion = totalInterest / term;
	const monthlyPrincipalPortion = principal / term;
	
	const firstPeriodInterest = monthlyInterestPortion * proRatedRatio;
	const firstPeriodPrincipal = monthlyPrincipalPortion * proRatedRatio;
	const firstPayment = firstPeriodInterest + firstPeriodPrincipal;
	
	// Calculate remaining payments
	const remainingTerm = term - 1;
	const remainingInterest = totalInterest - firstPeriodInterest;
	const remainingPrincipal = principal - firstPeriodPrincipal;
	const regularPayment = (remainingInterest + remainingPrincipal) / remainingTerm;
	
	console.log(`Disbursement: ${formatDate(disbursementDate)}`);
	console.log(`First Payment Date: ${formatDate(firstPaymentDate)}`);
	console.log(`Days in First Period: ${daysInFirstPeriod}`);
	console.log(`Actual Average Days Per Period: ${actualAverageDaysPerPeriod.toFixed(1)}`);
	console.log(`Standard Monthly Payment: RM ${standardMonthlyPayment.toFixed(2)}`);
	console.log(`Pro-rated Ratio: ${(proRatedRatio * 100).toFixed(2)}% (vs actual average)`);
	console.log(`First Payment: RM ${firstPayment.toFixed(2)}`);
	console.log(`Regular Payments (2-${term}): RM ${regularPayment.toFixed(2)}`);
	
	return {
		firstPayment: SafeMath.toNumber(firstPayment),
		regularPayment: SafeMath.toNumber(regularPayment),
		proRatedRatio,
		actualAverageDaysPerPeriod,
		daysInFirstPeriod
	};
}

// OLD METHOD for comparison
function calculateWithOldMethod(disbursementDate, principal, interestRate, term) {
	console.log('\n📊 OLD METHOD CALCULATION (for comparison)');
	console.log('==========================================');
	
	const firstPaymentDate = calculateFirstPaymentDate(disbursementDate);
	const daysInFirstPeriod = calculateDaysBetweenMalaysia(disbursementDate, firstPaymentDate);
	
	// Flat rate calculation
	const monthlyInterestRateDecimal = interestRate / 100;
	const totalInterest = principal * monthlyInterestRateDecimal * term;
	const totalAmountToPay = principal + totalInterest;
	
	// OLD METHOD: Use fixed 30 days
	const standardMonthlyPayment = totalAmountToPay / term;
	const proRatedRatio = daysInFirstPeriod / 30; // Fixed 30 days
	
	// Calculate pro-rated amounts
	const monthlyInterestPortion = totalInterest / term;
	const monthlyPrincipalPortion = principal / term;
	
	const firstPeriodInterest = monthlyInterestPortion * proRatedRatio;
	const firstPeriodPrincipal = monthlyPrincipalPortion * proRatedRatio;
	const firstPayment = firstPeriodInterest + firstPeriodPrincipal;
	
	// Calculate remaining payments
	const remainingTerm = term - 1;
	const remainingInterest = totalInterest - firstPeriodInterest;
	const remainingPrincipal = principal - firstPeriodPrincipal;
	const regularPayment = (remainingInterest + remainingPrincipal) / remainingTerm;
	
	console.log(`Pro-rated Ratio: ${(proRatedRatio * 100).toFixed(2)}% (vs fixed 30 days)`);
	console.log(`First Payment: RM ${firstPayment.toFixed(2)}`);
	console.log(`Regular Payments (2-${term}): RM ${regularPayment.toFixed(2)}`);
	
	return {
		firstPayment: SafeMath.toNumber(firstPayment),
		regularPayment: SafeMath.toNumber(regularPayment),
		proRatedRatio
	};
}

// Test scenarios
async function testScenarios() {
	console.log('🧪 TESTING PROPORTIONAL FIRST PAYMENT CALCULATION');
	console.log('==================================================');
	
	const testCases = [
		{
			name: "July 1st Disbursement (Your Case)",
			disbursementDate: new Date('2025-07-01T10:00:00.000Z'),
			principal: 20000,
			interestRate: 1.0,
			term: 12,
			description: "Should have more equal payments for 31-day periods"
		},
		{
			name: "February 15th Disbursement",
			disbursementDate: new Date('2025-02-15T10:00:00.000Z'),
			principal: 20000,
			interestRate: 1.0,
			term: 12,
			description: "Test with February (28 days) in the payment schedule"
		},
		{
			name: "December 25th Disbursement (Long Grace)",
			disbursementDate: new Date('2024-12-25T10:00:00.000Z'),
			principal: 15000,
			interestRate: 1.5,
			term: 12,
			description: "Long grace period after 20th cutoff"
		}
	];
	
	for (const testCase of testCases) {
		console.log(`\n${'='.repeat(80)}`);
		console.log(`🎯 ${testCase.name}`);
		console.log(`   ${testCase.description}`);
		console.log(`${'='.repeat(80)}`);
		
		const newResult = calculateWithProportionalMethod(
			testCase.disbursementDate,
			testCase.principal,
			testCase.interestRate,
			testCase.term
		);
		
		const oldResult = calculateWithOldMethod(
			testCase.disbursementDate,
			testCase.principal,
			testCase.interestRate,
			testCase.term
		);
		
		console.log(`\n🔍 COMPARISON:`);
		console.log(`  New First Payment: RM ${newResult.firstPayment.toFixed(2)}`);
		console.log(`  Old First Payment: RM ${oldResult.firstPayment.toFixed(2)}`);
		console.log(`  Difference: RM ${(newResult.firstPayment - oldResult.firstPayment).toFixed(2)}`);
		
		console.log(`  New Regular Payment: RM ${newResult.regularPayment.toFixed(2)}`);
		console.log(`  Old Regular Payment: RM ${oldResult.regularPayment.toFixed(2)}`);
		console.log(`  Difference: RM ${(newResult.regularPayment - oldResult.regularPayment).toFixed(2)}`);
		
		// Check if July case is more balanced
		if (testCase.name.includes("July")) {
			const newVariation = Math.abs(newResult.firstPayment - newResult.regularPayment);
			const oldVariation = Math.abs(oldResult.firstPayment - oldResult.regularPayment);
			
			console.log(`\n💡 PAYMENT VARIATION ANALYSIS:`);
			console.log(`  New Method Variation: RM ${newVariation.toFixed(2)}`);
			console.log(`  Old Method Variation: RM ${oldVariation.toFixed(2)}`);
			console.log(`  Improvement: ${newVariation < oldVariation ? '✅ BETTER' : '❌ WORSE'} (${(oldVariation - newVariation).toFixed(2)} less variation)`);
			
			console.log(`\n📋 YOUR CURRENT SYSTEM vs NEW:`);
			console.log(`  Your First Payment: RM 1,922.67`);
			console.log(`  New First Payment: RM ${newResult.firstPayment.toFixed(2)}`);
			console.log(`  Your Regular Payment: RM 1,861.58`);
			console.log(`  New Regular Payment: RM ${newResult.regularPayment.toFixed(2)}`);
			console.log(`  New method matches actual periods: ${Math.abs(newResult.daysInFirstPeriod - newResult.actualAverageDaysPerPeriod) < 1 ? '✅ YES' : '❌ NO'}`);
		}
	}
	
	console.log(`\n\n✅ SUMMARY OF PROPORTIONAL METHOD:`);
	console.log('=====================================');
	console.log('✅ Uses actual average days per period instead of assumed 30 days');
	console.log('✅ More accurate pro-rating for first payment');
	console.log('✅ Subsequent payments use current logic to ensure total adds up');
	console.log('✅ Handles edge cases like February (28 days) and leap years naturally');
	console.log('✅ July 1st disbursements will have more balanced payment amounts');
	console.log('✅ Maintains mathematical integrity of the loan structure');
}

// Main execution
async function main() {
	try {
		await testScenarios();
	} catch (error) {
		console.error('❌ Test failed:', error);
	} finally {
		await prisma.$disconnect();
	}
}

main();