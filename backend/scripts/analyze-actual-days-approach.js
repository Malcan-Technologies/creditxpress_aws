#!/usr/bin/env node

/**
 * Analyze Actual Days Approach for Payment Calculation
 * 
 * Instead of assuming 30-day months, calculate actual days in each payment period
 * and base payment amounts on those actual days.
 */

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

// Generate all payment dates for a loan
function generatePaymentDates(disbursementDate, term) {
	const dates = [];
	const firstPaymentDate = calculateFirstPaymentDate(disbursementDate);
	dates.push(firstPaymentDate);
	
	// Generate subsequent payment dates (1st of each month)
	for (let i = 1; i < term; i++) {
		const prevDate = dates[i - 1];
		const malaysiaTime = new Date(prevDate.getTime() + (8 * 60 * 60 * 1000));
		
		let nextMonth = malaysiaTime.getUTCMonth() + 1;
		let nextYear = malaysiaTime.getUTCFullYear();
		
		if (nextMonth > 11) {
			nextMonth = 0;
			nextYear++;
		}
		
		const nextDate = new Date(Date.UTC(nextYear, nextMonth, 1, 15, 59, 59, 999));
		dates.push(nextDate);
	}
	
	return dates;
}

// Calculate actual days for each payment period
function calculateActualDaysPerPeriod(disbursementDate, term) {
	const paymentDates = generatePaymentDates(disbursementDate, term);
	const periods = [];
	
	// First period: disbursement to first payment
	const firstPeriodDays = calculateDaysBetweenMalaysia(disbursementDate, paymentDates[0]);
	periods.push({
		periodNumber: 1,
		startDate: disbursementDate,
		endDate: paymentDates[0],
		days: firstPeriodDays
	});
	
	// Subsequent periods: payment to payment
	for (let i = 1; i < term; i++) {
		const periodDays = calculateDaysBetweenMalaysia(paymentDates[i - 1], paymentDates[i]);
		periods.push({
			periodNumber: i + 1,
			startDate: paymentDates[i - 1],
			endDate: paymentDates[i],
			days: periodDays
		});
	}
	
	return periods;
}

// Format date for display
function formatDate(date) {
	const malaysiaTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
	return malaysiaTime.toISOString().split('T')[0];
}

// APPROACH 1: Daily Rate Method
function calculateWithDailyRate(disbursementDate, principal, interestRate, term) {
	console.log('\n📊 APPROACH 1: DAILY RATE METHOD');
	console.log('================================');
	console.log('Calculate each payment based on actual days in that period');
	
	const periods = calculateActualDaysPerPeriod(disbursementDate, term);
	const totalDays = periods.reduce((sum, period) => sum + period.days, 0);
	
	console.log(`Total loan days: ${totalDays}`);
	console.log(`Average days per period: ${(totalDays / term).toFixed(1)}`);
	
	// Calculate daily rates
	const monthlyInterestRateDecimal = interestRate / 100;
	const totalInterest = principal * monthlyInterestRateDecimal * term;
	const totalAmount = principal + totalInterest;
	
	const dailyPrincipalRate = principal / totalDays;
	const dailyInterestRate = totalInterest / totalDays;
	const dailyTotalRate = totalAmount / totalDays;
	
	console.log(`Daily principal rate: RM ${dailyPrincipalRate.toFixed(4)}`);
	console.log(`Daily interest rate: RM ${dailyInterestRate.toFixed(4)}`);
	console.log(`Daily total rate: RM ${dailyTotalRate.toFixed(4)}`);
	
	const payments = periods.map(period => {
		const principalAmount = dailyPrincipalRate * period.days;
		const interestAmount = dailyInterestRate * period.days;
		const totalPayment = principalAmount + interestAmount;
		
		return {
			period: period.periodNumber,
			days: period.days,
			principal: Math.round(principalAmount * 100) / 100,
			interest: Math.round(interestAmount * 100) / 100,
			total: Math.round(totalPayment * 100) / 100,
			startDate: formatDate(period.startDate),
			endDate: formatDate(period.endDate)
		};
	});
	
	console.log('\nPayment Schedule:');
	payments.forEach(payment => {
		console.log(`Period ${payment.period}: ${payment.days} days | RM ${payment.total.toFixed(2)} (P: ${payment.principal.toFixed(2)}, I: ${payment.interest.toFixed(2)}) | ${payment.startDate} to ${payment.endDate}`);
	});
	
	const totalCalculated = payments.reduce((sum, p) => sum + p.total, 0);
	console.log(`\nTotal calculated: RM ${totalCalculated.toFixed(2)}`);
	console.log(`Expected total: RM ${totalAmount.toFixed(2)}`);
	console.log(`Difference: RM ${(totalCalculated - totalAmount).toFixed(2)}`);
	
	return payments;
}

// APPROACH 2: Proportional Monthly Payment Method
function calculateWithProportionalMethod(disbursementDate, principal, interestRate, term) {
	console.log('\n📊 APPROACH 2: PROPORTIONAL MONTHLY PAYMENT METHOD');
	console.log('==================================================');
	console.log('Calculate standard monthly payment, then adjust each period proportionally');
	
	const periods = calculateActualDaysPerPeriod(disbursementDate, term);
	const averageDaysPerMonth = periods.reduce((sum, period) => sum + period.days, 0) / term;
	
	console.log(`Average days per period: ${averageDaysPerMonth.toFixed(1)}`);
	
	// Calculate standard monthly payment based on average days
	const monthlyInterestRateDecimal = interestRate / 100;
	const totalInterest = principal * monthlyInterestRateDecimal * term;
	const totalAmount = principal + totalInterest;
	const standardMonthlyPayment = totalAmount / term;
	
	console.log(`Standard monthly payment: RM ${standardMonthlyPayment.toFixed(2)}`);
	
	const payments = periods.map(period => {
		// Adjust payment based on actual days vs average days
		const dayAdjustmentRatio = period.days / averageDaysPerMonth;
		const adjustedPayment = standardMonthlyPayment * dayAdjustmentRatio;
		
		// Split into principal and interest proportionally
		const interestPortion = (totalInterest / term) * dayAdjustmentRatio;
		const principalPortion = (principal / term) * dayAdjustmentRatio;
		
		return {
			period: period.periodNumber,
			days: period.days,
			ratio: Math.round(dayAdjustmentRatio * 1000) / 1000,
			principal: Math.round(principalPortion * 100) / 100,
			interest: Math.round(interestPortion * 100) / 100,
			total: Math.round(adjustedPayment * 100) / 100,
			startDate: formatDate(period.startDate),
			endDate: formatDate(period.endDate)
		};
	});
	
	console.log('\nPayment Schedule:');
	payments.forEach(payment => {
		console.log(`Period ${payment.period}: ${payment.days} days (${(payment.ratio * 100).toFixed(1)}%) | RM ${payment.total.toFixed(2)} (P: ${payment.principal.toFixed(2)}, I: ${payment.interest.toFixed(2)}) | ${payment.startDate} to ${payment.endDate}`);
	});
	
	const totalCalculated = payments.reduce((sum, p) => sum + p.total, 0);
	console.log(`\nTotal calculated: RM ${totalCalculated.toFixed(2)}`);
	console.log(`Expected total: RM ${totalAmount.toFixed(2)}`);
	console.log(`Difference: RM ${(totalCalculated - totalAmount).toFixed(2)}`);
	
	return payments;
}

// APPROACH 3: Hybrid Method (Current + Adjustment)
function calculateWithHybridMethod(disbursementDate, principal, interestRate, term) {
	console.log('\n📊 APPROACH 3: HYBRID METHOD (CURRENT + ADJUSTMENT)');
	console.log('===================================================');
	console.log('Use current logic but adjust for actual vs assumed days');
	
	const periods = calculateActualDaysPerPeriod(disbursementDate, term);
	
	// Current logic for first payment
	const firstPeriodDays = periods[0].days;
	const monthlyInterestRateDecimal = interestRate / 100;
	const totalInterest = principal * monthlyInterestRateDecimal * term;
	const totalAmount = principal + totalInterest;
	const standardMonthlyPayment = totalAmount / term;
	
	// But adjust based on actual days instead of assuming 30
	const actualDaysRatio = firstPeriodDays / 30; // Current approach
	const adjustedRatio = firstPeriodDays / (periods.reduce((sum, p) => sum + p.days, 0) / term); // Actual approach
	
	console.log(`First period days: ${firstPeriodDays}`);
	console.log(`Current ratio (vs 30): ${(actualDaysRatio * 100).toFixed(1)}%`);
	console.log(`Adjusted ratio (vs avg): ${(adjustedRatio * 100).toFixed(1)}%`);
	
	// Calculate payments using adjusted ratio
	const monthlyInterestPortion = totalInterest / term;
	const monthlyPrincipalPortion = principal / term;
	
	const firstPeriodInterest = monthlyInterestPortion * adjustedRatio;
	const firstPeriodPrincipal = monthlyPrincipalPortion * adjustedRatio;
	const firstPayment = firstPeriodInterest + firstPeriodPrincipal;
	
	// Remaining payments adjust for the difference
	const remainingTerm = term - 1;
	const remainingInterest = totalInterest - firstPeriodInterest;
	const remainingPrincipal = principal - firstPeriodPrincipal;
	const regularPayment = (remainingInterest + remainingPrincipal) / remainingTerm;
	
	console.log(`\nAdjusted First Payment: RM ${firstPayment.toFixed(2)}`);
	console.log(`Regular Payments: RM ${regularPayment.toFixed(2)}`);
	console.log(`Current First Payment: RM ${(standardMonthlyPayment * actualDaysRatio).toFixed(2)}`);
	console.log(`Difference: RM ${(firstPayment - (standardMonthlyPayment * actualDaysRatio)).toFixed(2)}`);
	
	return {
		firstPayment,
		regularPayment,
		adjustedRatio,
		currentRatio: actualDaysRatio
	};
}

// Test with July 1st scenario
async function testAllApproaches() {
	console.log('🔍 TESTING ALL APPROACHES FOR JULY 1ST DISBURSEMENT');
	console.log('===================================================');
	
	const disbursementDate = new Date('2025-07-01T10:00:00.000Z');
	const principal = 20000;
	const interestRate = 1.0; // 1% monthly
	const term = 12;
	
	console.log(`\nTest Parameters:`);
	console.log(`Disbursement: ${formatDate(disbursementDate)}`);
	console.log(`Principal: RM ${principal.toLocaleString()}`);
	console.log(`Interest Rate: ${interestRate}% monthly`);
	console.log(`Term: ${term} months`);
	
	// Show period breakdown first
	const periods = calculateActualDaysPerPeriod(disbursementDate, term);
	console.log(`\n📅 Payment Period Analysis:`);
	periods.forEach((period, index) => {
		console.log(`${index + 1}: ${period.days} days (${formatDate(period.startDate)} to ${formatDate(period.endDate)})`);
	});
	
	const totalDays = periods.reduce((sum, p) => sum + p.days, 0);
	const avgDays = totalDays / term;
	console.log(`\nTotal days: ${totalDays}, Average: ${avgDays.toFixed(1)} days/period`);
	
	// Test all approaches
	const dailyRatePayments = calculateWithDailyRate(disbursementDate, principal, interestRate, term);
	const proportionalPayments = calculateWithProportionalMethod(disbursementDate, principal, interestRate, term);
	const hybridResult = calculateWithHybridMethod(disbursementDate, principal, interestRate, term);
	
	console.log('\n🎯 SUMMARY COMPARISON:');
	console.log('=====================');
	console.log(`Your Current System:`);
	console.log(`  First Payment: RM 1,922.67`);
	console.log(`  Regular Payments: RM 1,861.58`);
	console.log(`  Variation: ${((1922.67 / 1861.58 - 1) * 100).toFixed(1)}%`);
	
	console.log(`\nDaily Rate Method:`);
	console.log(`  Payment Range: RM ${Math.min(...dailyRatePayments.map(p => p.total)).toFixed(2)} - RM ${Math.max(...dailyRatePayments.map(p => p.total)).toFixed(2)}`);
	console.log(`  Variation: ${(((Math.max(...dailyRatePayments.map(p => p.total)) / Math.min(...dailyRatePayments.map(p => p.total))) - 1) * 100).toFixed(1)}%`);
	
	console.log(`\nProportional Method:`);
	console.log(`  Payment Range: RM ${Math.min(...proportionalPayments.map(p => p.total)).toFixed(2)} - RM ${Math.max(...proportionalPayments.map(p => p.total)).toFixed(2)}`);
	console.log(`  Variation: ${(((Math.max(...proportionalPayments.map(p => p.total)) / Math.min(...proportionalPayments.map(p => p.total))) - 1) * 100).toFixed(1)}%`);
	
	console.log('\n💡 RECOMMENDATIONS:');
	console.log('==================');
	console.log('1. DAILY RATE METHOD - Most mathematically accurate');
	console.log('   ✅ Each payment exactly matches the days in that period');
	console.log('   ✅ No artificial pro-rating assumptions');
	console.log('   ✅ Handles all edge cases naturally');
	console.log('   ❓ May have more payment variation');
	
	console.log('\n2. PROPORTIONAL METHOD - Good balance');
	console.log('   ✅ Payments vary based on actual period length');
	console.log('   ✅ Uses actual average period length instead of assumed 30 days');
	console.log('   ✅ More predictable payment amounts');
	console.log('   ✅ Still mathematically sound');
	
	console.log('\n3. HYBRID METHOD - Minimal change');
	console.log('   ✅ Small adjustment to current logic');
	console.log('   ✅ Uses actual average days instead of fixed 30');
	console.log('   ❓ Still maintains some pro-rating assumptions');
}

// Main execution
async function main() {
	try {
		await testAllApproaches();
	} catch (error) {
		console.error('❌ Analysis failed:', error);
	}
}

main();