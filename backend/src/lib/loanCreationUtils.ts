import { prisma } from "./prisma";

// Helper function to calculate days between two dates in Malaysia timezone
function calculateDaysBetweenMalaysia(startDate: Date, endDate: Date): number {
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

// Helper function to calculate first payment date based on schedule type and settings
function calculateFirstPaymentDateDynamic(loanCreationDate: Date, scheduleSettings: any): Date {
	if (scheduleSettings.scheduleType === 'EXACT_MONTHLY') {
		// For EXACT_MONTHLY: same day of next month (e.g., 18th → 18th next month)
		const malaysiaTime = new Date(loanCreationDate.getTime() + (8 * 60 * 60 * 1000));
		const day = malaysiaTime.getUTCDate();
		const month = malaysiaTime.getUTCMonth();
		const year = malaysiaTime.getUTCFullYear();
		
		// First payment is same day of next month
		let firstPaymentMonth = month + 1;
		let firstPaymentYear = year;
		
		// Handle year rollover
		if (firstPaymentMonth > 11) {
			firstPaymentMonth = 0;
			firstPaymentYear++;
		}
		
		// Create first payment date as same day of next month at end of day (Malaysia timezone)
		// Set to 15:59:59 UTC so it becomes 23:59:59 Malaysia time (GMT+8)
		const firstPaymentDate = new Date(
			Date.UTC(firstPaymentYear, firstPaymentMonth, day, 15, 59, 59, 999)
		);
		
		return firstPaymentDate;
	} else {
		// For CUSTOM_DATE: use cutoff logic with configurable date
		const malaysiaTime = new Date(loanCreationDate.getTime() + (8 * 60 * 60 * 1000));
		
		const day = malaysiaTime.getUTCDate();
		const month = malaysiaTime.getUTCMonth();
		const year = malaysiaTime.getUTCFullYear();
		
		let firstPaymentMonth: number;
		let firstPaymentYear: number;
		
		if (day < scheduleSettings.prorationCutoffDate) {
			// If created before cutoff, first payment is custom date of next month
			firstPaymentMonth = month + 1;
			firstPaymentYear = year;
			
			// Handle year rollover
			if (firstPaymentMonth > 11) {
				firstPaymentMonth = 0;
				firstPaymentYear++;
			}
		} else {
			// If created on or after cutoff, first payment is custom date of month after next
			firstPaymentMonth = month + 2;
			firstPaymentYear = year;
			
			// Handle year rollover
			if (firstPaymentMonth > 11) {
				firstPaymentMonth = firstPaymentMonth - 12;
				firstPaymentYear++;
			}
		}
		
		// Create first payment date as custom date of target month at end of day (Malaysia timezone)
		// Set to 15:59:59 UTC so it becomes 23:59:59 Malaysia time (GMT+8)
		const firstPaymentDate = new Date(
			Date.UTC(firstPaymentYear, firstPaymentMonth, scheduleSettings.customDueDate, 15, 59, 59, 999)
		);
		
		return firstPaymentDate;
	}
}

// Helper function to calculate all payment allocations based on calculation method
function calculateAllPaymentAllocations(principal: number, totalInterest: number, term: number, daysInFirstPeriod: number, calculationSettings: any) {
	console.log(`📊 Calculating payment allocations with ${calculationSettings.calculationMethod} method`);
	
	if (calculationSettings.calculationMethod === 'RULE_OF_78') {
		return calculateRuleOf78Allocations(principal, totalInterest, term, daysInFirstPeriod, calculationSettings);
	} else {
		// Default to STRAIGHT_LINE method
		return calculateStraightLineAllocations(principal, totalInterest, term, daysInFirstPeriod, calculationSettings);
	}
}

// Helper function to calculate Rule of 78 allocations
function calculateRuleOf78Allocations(principal: number, totalInterest: number, term: number, daysInFirstPeriod: number, calculationSettings: any) {
	const { SafeMath } = require("./precisionUtils");
	const payments = [];
	
	// Calculate sum of digits (1 + 2 + 3 + ... + n)
	const sumOfDigits = (term * (term + 1)) / 2;
	
	console.log(`🎯 Rule of 78 calculation:`);
	console.log(`  Term: ${term} months`);
	console.log(`  Sum of digits: ${sumOfDigits}`);
	console.log(`  Days in first period: ${daysInFirstPeriod}`);
	console.log(`  Schedule type: ${calculationSettings.scheduleType}`);
	
	// Calculate equal payment amount (same for all months in Rule of 78)
	const equalPaymentAmount = SafeMath.divide(SafeMath.add(principal, totalInterest), term);
	console.log(`  Equal monthly payment: ${equalPaymentAmount.toFixed(2)}`);
	
	let totalInterestAllocated = 0;
	let totalPrincipalAllocated = 0;
	
	for (let month = 1; month <= term; month++) {
		// Rule of 78: Higher weights for earlier payments (front-loaded interest)
		const interestWeight = (term - month + 1) / sumOfDigits;
		let interestAmount = SafeMath.multiply(totalInterest, interestWeight);
		
		// Principal amount = Equal payment - Interest amount
		let principalAmount = SafeMath.subtract(equalPaymentAmount, interestAmount);
		let totalPayment = equalPaymentAmount;
		
		// Handle pro-rating for first payment (ONLY for CUSTOM_DATE)
		if (month === 1 && calculationSettings.scheduleType === 'CUSTOM_DATE' && daysInFirstPeriod !== 30) {
			// Calculate average days per period (approximate)
			const averageDaysPerPeriod = 30; // Approximate average
			const proRatedRatio = SafeMath.divide(daysInFirstPeriod, averageDaysPerPeriod);
			
			// Pro-rate the interest and principal amounts
			interestAmount = SafeMath.multiply(interestAmount, proRatedRatio);
			principalAmount = SafeMath.multiply(principalAmount, proRatedRatio);
			totalPayment = SafeMath.add(interestAmount, principalAmount);
			
			console.log(`  Month ${month}: Pro-rated payment ${totalPayment.toFixed(2)} (${(proRatedRatio * 100).toFixed(2)}% of ${equalPaymentAmount.toFixed(2)})`);
			console.log(`    Interest: ${interestAmount.toFixed(2)}, Principal: ${principalAmount.toFixed(2)}`);
		} else {
			console.log(`  Month ${month}: Interest weight ${(interestWeight * 100).toFixed(2)}% = ${interestAmount.toFixed(2)}, Principal = ${principalAmount.toFixed(2)}`);
		}
		
		// Add to totals BEFORE final adjustment check
		totalInterestAllocated = SafeMath.add(totalInterestAllocated, interestAmount);
		totalPrincipalAllocated = SafeMath.add(totalPrincipalAllocated, principalAmount);
		
		// For final payment, adjust to ensure exact totals
		if (month === term) {
			// Calculate remaining amounts that need to be allocated
			const remainingInterest = SafeMath.subtract(totalInterest, SafeMath.subtract(totalInterestAllocated, interestAmount));
			const remainingPrincipal = SafeMath.subtract(principal, SafeMath.subtract(totalPrincipalAllocated, principalAmount));
			
			// Apply final adjustments
			interestAmount = remainingInterest;
			principalAmount = remainingPrincipal;
			totalPayment = SafeMath.add(interestAmount, principalAmount);
			
			console.log(`  Final payment adjustment: Interest = ${interestAmount.toFixed(2)}, Principal = ${principalAmount.toFixed(2)}`);
			
			// Update totals with final adjusted amounts
			totalInterestAllocated = SafeMath.add(SafeMath.subtract(totalInterestAllocated, remainingInterest), interestAmount);
			totalPrincipalAllocated = SafeMath.add(SafeMath.subtract(totalPrincipalAllocated, remainingPrincipal), principalAmount);
		}
		
		payments.push({
			month: month,
			interestAmount: interestAmount,
			principalAmount: principalAmount,
			totalPayment: totalPayment
		});
		
		console.log(`  Month ${month} final: Payment = ${totalPayment.toFixed(2)} (Interest: ${interestAmount.toFixed(2)}, Principal: ${principalAmount.toFixed(2)})`);
	}
	
	console.log(`🎯 Rule of 78 totals: Interest = ${totalInterestAllocated.toFixed(2)}, Principal = ${totalPrincipalAllocated.toFixed(2)}, Total = ${SafeMath.add(totalInterestAllocated, totalPrincipalAllocated).toFixed(2)}`);
	return payments;
}

// Helper function to calculate Straight Line allocations
function calculateStraightLineAllocations(principal: number, totalInterest: number, term: number, daysInFirstPeriod: number, calculationSettings: any) {
	const { SafeMath } = require("./precisionUtils");
	const payments = [];
	
	console.log(`📐 Straight Line calculation:`);
	console.log(`  Days in first period: ${daysInFirstPeriod}`);
	console.log(`  Schedule type: ${calculationSettings.scheduleType}`);
	
	// Calculate equal monthly payment
	const monthlyPayment = SafeMath.divide(SafeMath.add(principal, totalInterest), term);
	const monthlyInterest = SafeMath.divide(totalInterest, term);
	const monthlyPrincipal = SafeMath.divide(principal, term);
	
	console.log(`  Monthly payment: ${monthlyPayment.toFixed(2)}`);
	console.log(`  Monthly interest: ${monthlyInterest.toFixed(2)}`);
	console.log(`  Monthly principal: ${monthlyPrincipal.toFixed(2)}`);
	
	let totalInterestAllocated = 0;
	let totalPrincipalAllocated = 0;
	
	for (let month = 1; month <= term; month++) {
		let paymentAmount = monthlyPayment;
		let interestAmount = monthlyInterest;
		let principalAmount = monthlyPrincipal;
		
		// Handle pro-rating for first payment (ONLY for CUSTOM_DATE)
		if (month === 1 && calculationSettings.scheduleType === 'CUSTOM_DATE' && daysInFirstPeriod !== 30) {
			// Calculate average days per period (approximate)
			const averageDaysPerPeriod = 30; // Approximate average
			const proRatedRatio = SafeMath.divide(daysInFirstPeriod, averageDaysPerPeriod);
			
			// Pro-rate all amounts
			paymentAmount = SafeMath.multiply(monthlyPayment, proRatedRatio);
			interestAmount = SafeMath.multiply(monthlyInterest, proRatedRatio);
			principalAmount = SafeMath.multiply(monthlyPrincipal, proRatedRatio);
			
			console.log(`  Month ${month}: Pro-rated payment ${paymentAmount.toFixed(2)} (${(proRatedRatio * 100).toFixed(2)}% of ${monthlyPayment.toFixed(2)})`);
		} else {
			console.log(`  Month ${month}: Payment = ${paymentAmount.toFixed(2)} (Interest: ${interestAmount.toFixed(2)}, Principal: ${principalAmount.toFixed(2)})`);
		}
		
		// Add to totals BEFORE final adjustment check
		totalInterestAllocated = SafeMath.add(totalInterestAllocated, interestAmount);
		totalPrincipalAllocated = SafeMath.add(totalPrincipalAllocated, principalAmount);
		
		// For final payment, adjust to ensure exact totals
		if (month === term) {
			// Calculate remaining amounts that need to be allocated
			const remainingInterest = SafeMath.subtract(totalInterest, SafeMath.subtract(totalInterestAllocated, interestAmount));
			const remainingPrincipal = SafeMath.subtract(principal, SafeMath.subtract(totalPrincipalAllocated, principalAmount));
			
			// Apply final adjustments
			interestAmount = remainingInterest;
			principalAmount = remainingPrincipal;
			paymentAmount = SafeMath.add(interestAmount, principalAmount);
			
			console.log(`  Final payment adjustment: Interest = ${interestAmount.toFixed(2)}, Principal = ${principalAmount.toFixed(2)}`);
			
			// Update totals with final adjusted amounts
			totalInterestAllocated = SafeMath.add(SafeMath.subtract(totalInterestAllocated, remainingInterest), interestAmount);
			totalPrincipalAllocated = SafeMath.add(SafeMath.subtract(totalPrincipalAllocated, remainingPrincipal), principalAmount);
		}
		
		payments.push({
			month: month,
			interestAmount: interestAmount,
			principalAmount: principalAmount,
			totalPayment: paymentAmount
		});
		
		console.log(`  Month ${month} final: Payment = ${paymentAmount.toFixed(2)} (Interest: ${interestAmount.toFixed(2)}, Principal: ${principalAmount.toFixed(2)})`);
	}
	
	console.log(`📐 Straight Line totals: Interest = ${totalInterestAllocated.toFixed(2)}, Principal = ${totalPrincipalAllocated.toFixed(2)}, Total = ${SafeMath.add(totalInterestAllocated, totalPrincipalAllocated).toFixed(2)}`);
	return payments;
}

// Helper function to get loan calculation settings (copied from admin.ts)
async function getLoanCalculationSettings(tx: any) {
	// Default settings
	const defaultSettings = {
		calculationMethod: 'PROPORTIONAL',
		scheduleType: 'FIRST_OF_MONTH',
		customDueDate: 1,
		prorationCutoffDate: 20
	};

	try {
		// Fetch current settings from system_settings table
		const settings = await tx.systemSettings.findMany({
			where: {
				isActive: true,
				category: {
					in: ['LOAN_CALCULATION', 'PAYMENT_SCHEDULE']
				}
			}
		});

		const settingsMap = settings.reduce((acc: any, setting: any) => {
			try {
				acc[setting.key] = JSON.parse(setting.value);
			} catch (error) {
				// If JSON parsing fails, use the raw value
				acc[setting.key] = setting.value;
			}
			return acc;
		}, {});
		
		console.log('🧮 Settings map:', settingsMap);

		const result = {
			calculationMethod: settingsMap.LOAN_CALCULATION_METHOD || defaultSettings.calculationMethod,
			scheduleType: settingsMap.PAYMENT_SCHEDULE_TYPE || defaultSettings.scheduleType,
			customDueDate: settingsMap.CUSTOM_DUE_DATE || defaultSettings.customDueDate,
			prorationCutoffDate: settingsMap.PRORATION_CUTOFF_DATE || defaultSettings.prorationCutoffDate
		};
		
		console.log('🧮 Final calculation settings:', result);
		return result;
	} catch (error) {
		console.warn('Failed to fetch loan calculation settings, using defaults:', error);
		return defaultSettings;
	}
}

// Function to create loan and repayment schedule when application moves to PENDING_SIGNATURE
export async function createLoanOnPendingSignature(applicationId: string, tx: any = null) {
	const prismaClient = tx || prisma;
	
	console.log(`Creating loan for PENDING_SIGNATURE application: ${applicationId}`);
	
	// Get the application with required data
	const application = await prismaClient.loanApplication.findUnique({
		where: { id: applicationId },
		include: {
			user: true,
			product: true,
			loan: true // Check if loan already exists
		}
	});
	
	if (!application) {
		throw new Error("Application not found");
	}
	
	// Check if loan already exists to prevent duplicates
	if (application.loan) {
		console.log(`Loan already exists for application ${applicationId}, skipping creation`);
		return application.loan;
	}
	
	// Validate required data
	if (!application.amount) {
		throw new Error("Cannot create loan: Amount is required");
	}
	
	// Calculate total amount
	const principal = application.amount;
	const interestRate = application.product.interestRate;
	const term = application.term || 12;
	const totalInterest = Math.round(principal * (interestRate / 100) * term * 100) / 100;
	const totalAmount = Math.round((principal + totalInterest) * 100) / 100;
	
	// Get current calculation settings
	const calculationSettings = await getLoanCalculationSettings(prismaClient);
	
	// Create the loan record with status PENDING_SIGNATURE
	const newLoan = await prismaClient.loan.create({
		data: {
			userId: application.userId,
			applicationId: application.id,
			principalAmount: application.amount,
			totalAmount: totalAmount,
			outstandingBalance: totalAmount,
			interestRate: application.product.interestRate,
			term: application.term || 12,
			monthlyPayment: application.monthlyRepayment || application.amount / 12,
			status: "PENDING_SIGNATURE", // Set initial status as PENDING_SIGNATURE
			disbursedAt: null, // Will be set during disbursement
			// Store calculation method settings
			calculationMethod: calculationSettings.calculationMethod,
			scheduleType: calculationSettings.scheduleType,
			// Only store custom due date and proration cutoff for CUSTOM_DATE schedule type
			customDueDate: calculationSettings.scheduleType === 'CUSTOM_DATE' ? calculationSettings.customDueDate : null,
			prorationCutoffDate: calculationSettings.scheduleType === 'CUSTOM_DATE' ? calculationSettings.prorationCutoffDate : null,
		},
	});
	
	console.log(`Loan created successfully with ID: ${newLoan.id}`);
	
	// Generate repayment schedule
	console.log(`Generating repayment schedule for loan ${newLoan.id}`);
	await generatePaymentScheduleForPendingLoan(newLoan.id, prismaClient);
	
	return newLoan;
}

// Function to generate payment schedule for PENDING_SIGNATURE loans (without disbursement date)
async function generatePaymentScheduleForPendingLoan(loanId: string, tx: any) {
	const loan = await tx.loan.findUnique({
		where: { id: loanId },
	});

	if (!loan) {
		throw new Error("Loan not found");
	}

	// Clear any existing schedule first
	await tx.loanRepayment.deleteMany({
		where: { loanId: loan.id },
	});

	const repayments = [];

	// Import SafeMath for precise calculations
	const { SafeMath } = require("./precisionUtils");

	// Calculate total interest with precision
	const monthlyInterestRate = SafeMath.toNumber(loan.interestRate) / 100;
	const principal = SafeMath.toNumber(loan.principalAmount);
	const term = loan.term;
	
	const totalInterest = SafeMath.multiply(
		SafeMath.multiply(principal, monthlyInterestRate), 
		term
	);
	
	// For PENDING_SIGNATURE loans, use the loan creation date as the base date
	// This ensures consistent payment schedules regardless of when disbursement happens
	const startDate = new Date(); // Use current date (loan creation date)
	
	// Fetch loan calculation and payment schedule settings
	const calculationSettings = await getLoanCalculationSettings(tx);
	
	// Calculate first payment date based on schedule type using loan creation date
	const firstPaymentDate = calculateFirstPaymentDateDynamic(startDate, calculationSettings);
	
	// Calculate pro-rated first payment for actual period from loan creation to first payment
	const daysInFirstPeriod = calculateDaysBetweenMalaysia(startDate, firstPaymentDate);
	
	// Calculate interest and principal allocations based on calculation method
	console.log(`💰 Using allocation method: ${calculationSettings.calculationMethod}`);
	const allPaymentAllocations = calculateAllPaymentAllocations(
		principal, 
		totalInterest, 
		term, 
		daysInFirstPeriod, 
		calculationSettings
	);
	console.log(`🧮 Using loan calculation settings:`, calculationSettings);
	console.log(`🧮 Schedule type: ${calculationSettings.scheduleType}`);
	console.log(`🧮 Custom due date: ${calculationSettings.customDueDate}`);
	console.log(`🧮 Proration cutoff date: ${calculationSettings.prorationCutoffDate}`);
	
	for (let i = 1; i <= term; i++) {
		// Calculate due date based on schedule type
		let dueDate;
		if (calculationSettings.scheduleType === 'EXACT_MONTHLY') {
			// For EXACT_MONTHLY: use same day of each month from start date
			// Create due date at midnight Malaysia time (16:00 UTC = 00:00 MYT)
			const malaysiaTime = new Date(startDate.getTime() + (8 * 60 * 60 * 1000));
			const startDay = malaysiaTime.getUTCDate();
			const targetYear = malaysiaTime.getUTCFullYear();
			const targetMonth = malaysiaTime.getUTCMonth() + i;
			
			// Create date in UTC at 15:59:59 (which is 23:59:59 Malaysia time - end of day)
			// This allows users to pay throughout the entire due date
			dueDate = new Date(Date.UTC(targetYear, targetMonth, startDay, 15, 59, 59, 999));
			
			// Handle month overflow (e.g., day 31 in February)
			if (new Date(dueDate.getTime() + (8 * 60 * 60 * 1000)).getUTCDate() !== startDay) {
				// Use last day of the target month at end of day Malaysia time
				dueDate = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 15, 59, 59, 999));
			}
		} else if (calculationSettings.scheduleType === 'CUSTOM_DATE' && calculationSettings.customDueDate) {
			// For CUSTOM_DATE: use cutoff logic with configurable date
			// Create due date at end of day Malaysia time (15:59:59 UTC = 23:59:59 MYT)
			const malaysiaTime = new Date(startDate.getTime() + (8 * 60 * 60 * 1000));
			const startDay = malaysiaTime.getUTCDate();
			const startMonth = malaysiaTime.getUTCMonth();
			const startYear = malaysiaTime.getUTCFullYear();
			
			let targetMonth: number;
			let targetYear: number;
			
			if (startDay < calculationSettings.prorationCutoffDate) {
				// If created before cutoff, first payment is custom date of next month
				targetMonth = startMonth + i;
				targetYear = startYear;
			} else {
				// If created on or after cutoff, first payment is custom date of month after next
				targetMonth = startMonth + i + 1;
				targetYear = startYear;
			}
			
			// Handle year rollover
			while (targetMonth > 11) {
				targetMonth = targetMonth - 12;
				targetYear++;
			}
			
			// Create date in UTC at 15:59:59 (which is 23:59:59 Malaysia time - end of day)
			dueDate = new Date(Date.UTC(targetYear, targetMonth, calculationSettings.customDueDate, 15, 59, 59, 999));
			
			// Handle month overflow (e.g., day 31 in February)
			if (new Date(dueDate.getTime() + (8 * 60 * 60 * 1000)).getUTCDate() !== calculationSettings.customDueDate) {
				// Use last day of the target month at end of day Malaysia time
				dueDate = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 15, 59, 59, 999));
			}
			
			console.log(`🧮 CUSTOM_DATE calculation for installment ${i}:`);
			console.log(`🧮   Start date: ${startDate.toISOString()}`);
			console.log(`🧮   Start day: ${startDay}, cutoff: ${calculationSettings.prorationCutoffDate}`);
			console.log(`🧮   Target month: ${targetMonth}, year: ${targetYear}`);
			console.log(`🧮   Calculated due date: ${dueDate.toISOString()}`);
		} else {
			// Default: FIRST_OF_MONTH - Due on 1st of each month
			// Create due date at end of day Malaysia time (15:59:59 UTC = 23:59:59 MYT)
			const malaysiaTime = new Date(startDate.getTime() + (8 * 60 * 60 * 1000));
			const targetYear = malaysiaTime.getUTCFullYear();
			const targetMonth = malaysiaTime.getUTCMonth() + i;
			
			// Create date in UTC at 15:59:59 (which is 23:59:59 Malaysia time - end of day)
			dueDate = new Date(Date.UTC(targetYear, targetMonth, 1, 15, 59, 59, 999));
		}

		// Get payment allocation for this installment (already includes proration if needed)
		const allocation = allPaymentAllocations[i - 1];
		let paymentAmount = allocation.totalPayment;
		let interestAmount = allocation.interestAmount;
		let principalAmount = allocation.principalAmount;
		
		console.log(`🧮 Using pre-calculated allocation for installment ${i}:`);
		console.log(`🧮   Payment: ${paymentAmount.toFixed(2)}`);
		console.log(`🧮   Interest: ${interestAmount.toFixed(2)}`);
		console.log(`🧮   Principal: ${principalAmount.toFixed(2)}`);

		const repayment = {
			loanId: loan.id,
			installmentNumber: i,
			amount: SafeMath.toNumber(paymentAmount),
			principalAmount: SafeMath.toNumber(principalAmount),
			interestAmount: SafeMath.toNumber(interestAmount),
			dueDate: dueDate,
			status: "PENDING",
			paymentType: "SCHEDULED",
			scheduledAmount: SafeMath.toNumber(paymentAmount),
		};

		repayments.push(repayment);
	}

	// Bulk create all repayments
	await tx.loanRepayment.createMany({
		data: repayments,
	});

	// Update the loan's nextPaymentDue field with the first payment due date
	if (repayments.length > 0) {
		console.log(`🧮 Setting nextPaymentDue for loan ${loanId}:`);
		console.log(`🧮   First repayment due date: ${repayments[0].dueDate.toISOString()}`);
		console.log(`🧮   First repayment installment: ${repayments[0].installmentNumber}`);
		
		await tx.loan.update({
			where: { id: loanId },
			data: {
				nextPaymentDue: repayments[0].dueDate
			}
		});
		console.log(`✅ Updated loan ${loanId} nextPaymentDue to: ${repayments[0].dueDate.toISOString()}`);
	}

	console.log(`Created ${repayments.length} payment records for pending loan`);
	return repayments;
}


