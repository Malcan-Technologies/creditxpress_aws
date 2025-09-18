import { logger } from "./logger";
import { SafeMath, TimeUtils } from "./precisionUtils";
import { prisma } from "../../lib/prisma";

// Lock constants for PostgreSQL advisory locks
const LATE_FEE_PROCESSING_LOCK_ID = 123456789; // Unique identifier for late fee processing

// Helper function to get late fee grace period settings from database
async function getLateFeeGraceSettings(prismaClient: any = prisma) {
	try {
		const settings = await prismaClient.systemSettings.findMany({
			where: {
				key: {
					in: ['ENABLE_LATE_FEE_GRACE_PERIOD', 'LATE_FEE_GRACE_DAYS']
				},
				isActive: true
			}
		});

		const enableGraceSetting = settings.find((s: any) => s.key === 'ENABLE_LATE_FEE_GRACE_PERIOD');
		const graceDaysSetting = settings.find((s: any) => s.key === 'LATE_FEE_GRACE_DAYS');

		const isGraceEnabled = enableGraceSetting ? JSON.parse(enableGraceSetting.value) : true;
		const graceDays = graceDaysSetting ? JSON.parse(graceDaysSetting.value) : 3;

		// If grace period is disabled, return 0 days
		return isGraceEnabled ? graceDays : 0;
	} catch (error) {
		logger.error('Error fetching late fee grace settings:', error);
		// Default fallback: 3 days grace period
		return 3;
	}
}

/**
 * Acquire a PostgreSQL advisory lock for late fee processing
 * @returns Promise<boolean> - true if lock acquired, false if already locked
 */
async function acquireProcessingLock(): Promise<boolean> {
	try {
		const result = await prisma.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
			SELECT pg_try_advisory_lock(${LATE_FEE_PROCESSING_LOCK_ID})
		`;
		return result[0].pg_try_advisory_lock;
	} catch (error) {
		logger.error("Error acquiring processing lock:", error);
		return false;
	}
}

/**
 * Release the PostgreSQL advisory lock for late fee processing
 * @returns Promise<boolean> - true if lock released successfully
 */
async function releaseProcessingLock(): Promise<boolean> {
	try {
		const result = await prisma.$queryRaw<[{ pg_advisory_unlock: boolean }]>`
			SELECT pg_advisory_unlock(${LATE_FEE_PROCESSING_LOCK_ID})
		`;
		return result[0].pg_advisory_unlock;
	} catch (error) {
		logger.error("Error releasing processing lock:", error);
		return false;
	}
}

interface RepaymentLateFeeUpdate {
	repaymentId: string;
	lateFeeAmount: number;
	daysOverdue: number;
	outstandingPrincipal: number;
}

interface LoanLateFeeCalculation {
	loanId: string;
	totalAccruedFees: number;
	calculationDetails: Record<string, any>;
	gracePeriodRepayments?: number;
	totalGracePeriodFees?: number;
}

export class LateFeeProcessor {
	/**
	 * Main function to process all overdue payments and calculate late fees
	 * @param force - If true, bypass processing locks but still respect daily calculation limits
	 */
	static async processLateFees(force: boolean = false): Promise<{
		success: boolean;
		feesCalculated: number;
		totalFeeAmount: number;
		overdueRepayments: number;
		gracePeriodRepayments?: number;
		gracePeriodDays?: number;
		errorMessage?: string;
		processingTimeMs: number;
		isManualRun?: boolean;
	}> {
		const startTime = Date.now();
		let feesCalculated = 0;
		let totalFeeAmount = 0;
		let overdueRepaymentsCount = 0;
		let gracePeriodRepaymentsCount = 0;
		let gracePeriodDays = 0; // Initialize here for scope
		let errorMessage: string | undefined;

		// Prevent concurrent processing using database-level lock
		const lockAcquired = await acquireProcessingLock();
		if (!lockAcquired) {
			return {
				success: false,
				feesCalculated: 0,
				totalFeeAmount: 0,
				overdueRepayments: 0,
				gracePeriodRepayments: 0,
				gracePeriodDays: 0,
				errorMessage: "Late fee processing already in progress. Please wait for it to complete.",
				processingTimeMs: Date.now() - startTime,
				isManualRun: force,
			};
		}

		try {
			// Get grace period settings once at the start
			gracePeriodDays = await getLateFeeGraceSettings();
			logger.info(
				`Starting late fee processing... ${
					force ? "(Manual/Force mode)" : "(Automatic mode)"
				}. Grace period: ${gracePeriodDays} days`
			);

			// Check if processing has already been done today (only for non-force mode)
			if (!force) {
				const today = TimeUtils.malaysiaStartOfDay();
				const existingProcessingToday = await prisma.lateFeeProcessingLog.findFirst({
					where: {
						processedAt: {
							gte: today
						},
						status: {
							in: ['SUCCESS', 'MANUAL_SUCCESS']
						}
					},
					orderBy: {
						processedAt: 'desc'
					}
				});

				if (existingProcessingToday) {
					logger.info(`Late fee processing already completed today at ${existingProcessingToday.processedAt}. Use force mode to recalculate.`);
					return {
						success: true,
						feesCalculated: 0,
						totalFeeAmount: 0,
						overdueRepayments: 0,
						gracePeriodRepayments: 0,
						gracePeriodDays: gracePeriodDays,
						processingTimeMs: Date.now() - startTime,
						isManualRun: force,
					};
				}
			}

			// Get all overdue repayments with product configuration
			const overdueRepayments =
				await LateFeeProcessor.getOverdueRepaymentsWithProduct();
			logger.info(`Found ${overdueRepayments.length} overdue repayments`);

			const repaymentUpdates: RepaymentLateFeeUpdate[] = [];
			const loanCalculations = new Map<string, LoanLateFeeCalculation>();

			// Group repayments by loan to check for double-charge prevention per loan
			const repaymentsByLoan = new Map<string, any[]>();
			for (const repayment of overdueRepayments) {
				const loanId = repayment.loan_id;
				if (!repaymentsByLoan.has(loanId)) {
					repaymentsByLoan.set(loanId, []);
				}
				repaymentsByLoan.get(loanId)!.push(repayment);
			}

			// Process each loan's overdue repayments
			for (const [loanId, loanRepayments] of repaymentsByLoan) {
				try {
					// Check if this loan already had fees calculated today
					// ALWAYS respect daily calculation limit, even in manual mode
					let skipLoan = false;
					const existingEntry = await prisma.lateFee.findUnique({
						where: { loanId: loanId }
					});

					if (existingEntry && existingEntry.lastCalculationDate) {
						const today = TimeUtils.malaysiaStartOfDay();
						const lastCalcDate = TimeUtils.malaysiaStartOfDay(existingEntry.lastCalculationDate);
						if (lastCalcDate.getTime() === today.getTime()) {
							logger.info(`Late fees already calculated today for loan ${loanId}. Skipping to prevent double-charging (${force ? 'manual' : 'automatic'} mode).`);
							skipLoan = true;
						}
					}

					if (skipLoan) {
						continue; // Skip entire loan if already calculated today
					}

			// Initialize loan calculation entry if it doesn't exist
			if (!loanCalculations.has(loanId)) {
				loanCalculations.set(loanId, {
					loanId,
					totalAccruedFees: 0,
					calculationDetails: {},
					gracePeriodRepayments: 0,
					totalGracePeriodFees: 0
				});
			}
			
			const loanCalc = loanCalculations.get(loanId)!;

			// Process all repayments for this loan
			for (const repayment of loanRepayments) {
				try {
					// Check if this repayment is in grace period
					const dueDate = new Date(repayment.due_date);
					const totalDaysOverdue = TimeUtils.daysOverdue(dueDate);
					const isInGracePeriod = totalDaysOverdue > 0 && totalDaysOverdue <= gracePeriodDays;
					
					if (isInGracePeriod) {
						gracePeriodRepaymentsCount++;
						loanCalc.gracePeriodRepayments = (loanCalc.gracePeriodRepayments || 0) + 1;
						
						console.log(`⏰ Grace period repayment found: Loan ${loanId}, Repayment ${repayment.id}, ${totalDaysOverdue} days overdue (within ${gracePeriodDays}-day grace period)`);
						
						// Calculate what the late fee would be if not in grace period (for tracking)
						const potentialLateFee = await LateFeeProcessor.calculateRepaymentLateFees(
							repayment,
							true, // force mode to calculate even in grace period
							0 // no grace period for this calculation
						);
						if (potentialLateFee) {
							loanCalc.totalGracePeriodFees = SafeMath.add(
								loanCalc.totalGracePeriodFees || 0, 
								potentialLateFee.lateFeeAmount
							);
							console.log(`⏰ Potential grace period fee calculated: $${potentialLateFee.lateFeeAmount} for repayment ${repayment.id}`);
						}
					}

					// Calculate late fees for this repayment (respecting grace period)
					const repaymentUpdate =
						await LateFeeProcessor.calculateRepaymentLateFees(
							repayment,
							force,
							gracePeriodDays
						);
					
					if (repaymentUpdate) {
						repaymentUpdates.push(repaymentUpdate);
						totalFeeAmount = SafeMath.add(totalFeeAmount, repaymentUpdate.lateFeeAmount);
						feesCalculated++;

						loanCalc.totalAccruedFees = SafeMath.add(loanCalc.totalAccruedFees, repaymentUpdate.lateFeeAmount);
						loanCalc.calculationDetails[repayment.id] = {
							lateFeeAmount: repaymentUpdate.lateFeeAmount,
							daysOverdue: repaymentUpdate.daysOverdue,
							outstandingPrincipal: repaymentUpdate.outstandingPrincipal
						};
					}
				} catch (error) {
					logger.error(
						`Error calculating late fee for repayment ${repayment.id}:`,
						error
					);
					// Continue processing other repayments
						}
					}
				} catch (error) {
					logger.error(
						`Error processing loan ${loanId}:`,
						error
					);
					// Continue processing other loans
				}
			}

			// Save all calculations in a transaction
			// Include loans that only have grace period repayments (no actual late fees applied)
			if (repaymentUpdates.length > 0 || loanCalculations.size > 0) {
				await LateFeeProcessor.saveLateFees(repaymentUpdates, Array.from(loanCalculations.values()), force, gracePeriodDays);
				
				// Update outstanding balances for all affected loans to reflect new late fees
				logger.info(`Recalculating outstanding balances for ${loanCalculations.size} loans...`);
				for (const loanCalc of loanCalculations.values()) {
					try {
						// Use a separate transaction for each outstanding balance calculation
						await prisma.$transaction(async (tx) => {
							const { calculateOutstandingBalance } = await import("../api/wallet");
							await calculateOutstandingBalance(loanCalc.loanId, tx);
						});
						logger.info(`Updated outstanding balance for loan ${loanCalc.loanId}`);
					} catch (error) {
						logger.error(`Failed to update outstanding balance for loan ${loanCalc.loanId}:`, error);
						// Continue processing other loans - don't fail the entire operation
					}
				}
				
				logger.info(
					`Successfully updated ${repaymentUpdates.length} repayments and ${loanCalculations.size} loans with recalculated outstanding balances`
				);
			}

			overdueRepaymentsCount = overdueRepayments.length;

			// Log the processing result
			await LateFeeProcessor.logProcessingResult({
				feesCalculated,
				totalFeeAmount,
				overdueRepayments: overdueRepaymentsCount,
				status: force ? "MANUAL_SUCCESS" : "SUCCESS",
				processingTimeMs: Date.now() - startTime,
			});

			logger.info(
				`Late fee processing completed successfully. Fees calculated: ${feesCalculated}, Total amount: $${SafeMath.round(totalFeeAmount).toFixed(2)}${force ? " (Manual run)" : ""}`
			);

			return {
				success: true,
				feesCalculated,
				totalFeeAmount: SafeMath.round(totalFeeAmount),
				overdueRepayments: overdueRepaymentsCount,
				gracePeriodRepayments: gracePeriodRepaymentsCount,
				gracePeriodDays: gracePeriodDays,
				processingTimeMs: Date.now() - startTime,
				isManualRun: force,
			};
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			logger.error("Late fee processing failed:", error);

			// Log the failure
			await LateFeeProcessor.logProcessingResult({
				feesCalculated,
				totalFeeAmount,
				overdueRepayments: overdueRepaymentsCount,
				status: force ? "MANUAL_FAILED" : "FAILED",
				errorMessage,
				processingTimeMs: Date.now() - startTime,
			});

			return {
				success: false,
				feesCalculated,
				totalFeeAmount: SafeMath.round(totalFeeAmount),
				overdueRepayments: overdueRepaymentsCount,
				gracePeriodRepayments: gracePeriodRepaymentsCount,
				gracePeriodDays: gracePeriodDays,
				errorMessage,
				processingTimeMs: Date.now() - startTime,
				isManualRun: force,
			};
		} finally {
			// Release the database lock
			await releaseProcessingLock();
		}
	}

	/**
	 * Get all overdue repayments with their product configuration
	 */
	private static async getOverdueRepaymentsWithProduct() {
		// Use current timestamp to catch all payments that are currently overdue
		// instead of start-of-day which could miss payments that became due in the last hour
		const now = new Date();

		// Use raw query to get repayments with product late fee configuration
		const query = `
			SELECT 
				lr.*,
				l.id as loan_id, 
				l."outstandingBalance", 
				l.status as loan_status,
				p."lateFeeRate",
				p."lateFeeFixedAmount",
				p."lateFeeFrequencyDays"
			FROM loan_repayments lr
			JOIN loans l ON lr."loanId" = l.id
			JOIN loan_applications la ON l."applicationId" = la.id
			JOIN products p ON la."productId" = p.id
			WHERE lr.status IN ('PENDING', 'PARTIAL')
			  AND lr."dueDate" < $1
			  AND l.status IN ('ACTIVE', 'DEFAULT')
			ORDER BY l.id, lr."dueDate" ASC
		`;

		const result = await prisma.$queryRawUnsafe(query, now) as any[];
		return result;
	}

	/**
	 * Calculate late fees for a specific repayment
	 * @param repayment - The repayment data
	 * @param force - If true, bypass processing locks (daily limits still apply at loan level)
	 * @param gracePeriodDays - Grace period in days from settings
	 */
	private static async calculateRepaymentLateFees(
		repayment: any,
		force: boolean = false,
		gracePeriodDays: number = 3
	): Promise<RepaymentLateFeeUpdate | null> {
		const dueDate = new Date(repayment.dueDate);
		
		// Calculate days overdue using Malaysia timezone calculation
		const totalDaysOverdue = TimeUtils.daysOverdue(dueDate);

		if (totalDaysOverdue <= 0) {
			return null; // Not actually overdue
		}

		// Apply grace period - late fees only start after grace period expires
		const daysOverdueForFees = Math.max(0, totalDaysOverdue - gracePeriodDays);

		if (daysOverdueForFees <= 0) {
			// Still within grace period, no late fees applied
			console.log(`⏰ Repayment ${repayment.id} is ${totalDaysOverdue} days overdue but within ${gracePeriodDays}-day grace period. No late fees applied.`);
			return null;
		}

		// Convert all amounts to safe numbers with 2 decimal precision
		const totalPaid = SafeMath.toNumber(repayment.actualAmount || 0);
		const lateFeesPaid = SafeMath.toNumber(repayment.lateFeesPaid || 0);
		const principalPaid = SafeMath.toNumber(repayment.principalPaid || 0);
		const principalAmount = SafeMath.toNumber(repayment.principalAmount);
		const interestAmount = SafeMath.toNumber(repayment.interestAmount);
		
		// Outstanding principal = Original principal + interest - principal paid
		// This is the REMAINING UNPAID BALANCE, not the full original amount
		const outstandingPrincipal = SafeMath.max(0, 
			SafeMath.subtract(SafeMath.add(principalAmount, interestAmount), principalPaid)
		);

		console.log(`💡 Late fee calculation for repayment ${repayment.id}:`, {
			originalAmount: SafeMath.toNumber(repayment.amount),
			principalAmount: principalAmount,
			interestAmount: interestAmount,
			totalPaid: totalPaid,
			lateFeesPaid: lateFeesPaid,
			principalPaid: principalPaid,
			outstandingPrincipal: outstandingPrincipal,
			totalDaysOverdue: totalDaysOverdue,
			daysOverdueForFees: daysOverdueForFees,
			gracePeriod: gracePeriodDays,
			status: repayment.status,
			currentLateFeeAmount: SafeMath.toNumber(repayment.lateFeeAmount || 0)
		});

		if (outstandingPrincipal <= 0) {
			return null; // Nothing outstanding to charge late fees on
		}

		// Get product configuration - preserve precision for rates, safe conversion for amounts
		const lateFeeRate = Number(repayment.lateFeeRate); // Don't round rates - preserve full precision
		const dailyRate = lateFeeRate / 100; // Convert percentage to decimal, preserving precision
		const fixedFeeAmount = SafeMath.toNumber(repayment.lateFeeFixedAmount || 0);
		const frequencyDays = Math.max(1, Math.floor(SafeMath.toNumber(repayment.lateFeeFrequencyDays || 7)));



		// Calculate total interest fees for fee-eligible overdue days (after grace period)
		// Use the REMAINING UNPAID BALANCE, not the full principal
		// Use high precision calculation for small percentage rates like 0.022% per day
		const totalInterestFeeAmount = daysOverdueForFees > 0
			? SafeMath.lateFeeCalculation(outstandingPrincipal, dailyRate, daysOverdueForFees)
				: 0;

		// Calculate total fixed fees for completed periods (after grace period)
		const completedPeriods = Math.floor(daysOverdueForFees / frequencyDays);
		const totalFixedFeeAmount = SafeMath.multiply(completedPeriods, fixedFeeAmount);

		// Combine total fee amount (this is the total amount owed, not incremental)
		const totalFeeAmount = SafeMath.add(totalInterestFeeAmount, totalFixedFeeAmount);

		console.log(`🧮 Fee calculation details for repayment ${repayment.id}:`, {
			dailyRate: dailyRate,
			fixedFeeAmount: fixedFeeAmount,
			frequencyDays: frequencyDays,
			completedPeriods: completedPeriods,
			totalInterestFeeAmount: totalInterestFeeAmount,
			totalFixedFeeAmount: totalFixedFeeAmount,
			totalFeeAmount: totalFeeAmount,
			outstandingPrincipal: outstandingPrincipal,
			totalDaysOverdue: totalDaysOverdue,
			daysOverdueForFees: daysOverdueForFees,
			willCalculateFees: totalFeeAmount > 0 || force
		});

		// If no fees to charge, return null (unless in force mode where we want to show 0 fee calculations)
		if (totalFeeAmount <= 0 && !force) {
			return null;
		}

		return {
			repaymentId: repayment.id,
			lateFeeAmount: totalFeeAmount,
			daysOverdue: totalDaysOverdue, // Report total days overdue for audit purposes
			outstandingPrincipal: outstandingPrincipal,
		};
	}

	/**
	 * Save late fee calculations to database
	 * Updates loan_repayments with late fee amounts and creates/updates single late_fees entry per loan
	 */
	private static async saveLateFees(
		repaymentUpdates: RepaymentLateFeeUpdate[], 
		loanCalculations: LoanLateFeeCalculation[],
		isManualRun: boolean = false,
		gracePeriodDays: number = 3
	) {
		const today = TimeUtils.malaysiaStartOfDay();

		await prisma.$transaction(async (tx) => {
			// Update loan_repayments with late fee amounts
			for (const repaymentUpdate of repaymentUpdates) {
				// Check if lateFeesPaid needs initialization
				const currentRepayment = await tx.loanRepayment.findUnique({
					where: { id: repaymentUpdate.repaymentId },
					select: { lateFeesPaid: true }
				});

				const updateData: any = {
					lateFeeAmount: repaymentUpdate.lateFeeAmount,
					updatedAt: new Date()
				};

				// Initialize lateFeesPaid if null to prevent issues
				if (currentRepayment && currentRepayment.lateFeesPaid === null) {
					updateData.lateFeesPaid = 0;
				}

				await tx.loanRepayment.update({
					where: { id: repaymentUpdate.repaymentId },
					data: updateData
				});
			}

			// Create or update single late_fees entry per loan
			for (const loanCalc of loanCalculations) {
				// Check if all late fees for this loan are fully paid AND all underlying payments are complete
				const allRepayments = await tx.loanRepayment.findMany({
					where: { loanId: loanCalc.loanId },
					select: { 
						id: true,
						lateFeeAmount: true,
						lateFeesPaid: true,
						principalAmount: true,
						interestAmount: true,
						principalPaid: true,
						dueDate: true,
						status: true
					}
				});

				// Use grace period information from loan calculations (already calculated in main loop)
				const gracePeriodRepaymentsCount = loanCalc.gracePeriodRepayments || 0;
				const totalGracePeriodFees = loanCalc.totalGracePeriodFees || 0;
				
				console.log(`💾 Saving late_fees for loan ${loanCalc.loanId}: gracePeriodRepayments=${gracePeriodRepaymentsCount}, totalGracePeriodFees=${totalGracePeriodFees}, totalAccruedFees=${loanCalc.totalAccruedFees}`);

				// Calculate total outstanding late fees for this loan
				const totalOutstandingLateFees = allRepayments.reduce((total: number, repayment: any) => {
					const lateFeeAmount = SafeMath.toNumber(repayment.lateFeeAmount || 0);
					const lateFeesPaid = SafeMath.toNumber(repayment.lateFeesPaid || 0);
					return SafeMath.add(total, SafeMath.max(0, SafeMath.subtract(lateFeeAmount, lateFeesPaid)));
				}, 0);

				// Calculate total outstanding principal/interest for this loan
				const totalOutstandingPrincipal = allRepayments.reduce((total: number, repayment: any) => {
					const originalAmount = SafeMath.add(
						SafeMath.toNumber(repayment.principalAmount || 0),
						SafeMath.toNumber(repayment.interestAmount || 0)
					);
					const principalPaid = SafeMath.toNumber(repayment.principalPaid || 0);
					return SafeMath.add(total, SafeMath.max(0, SafeMath.subtract(originalAmount, principalPaid)));
				}, 0);

				// Determine status: PAID only if both late fees AND underlying payments are fully paid
				const status = (totalOutstandingLateFees <= 0 && totalOutstandingPrincipal <= 0) ? 'PAID' : 'ACTIVE';

				await tx.lateFee.upsert({
					where: { loanId: loanCalc.loanId },
					update: {
						totalAccruedFees: loanCalc.totalAccruedFees,
						lastCalculationDate: today,
						calculationDetails: loanCalc.calculationDetails,
						status: status,
						gracePeriodDays: gracePeriodDays,
						gracePeriodRepayments: gracePeriodRepaymentsCount,
						totalGracePeriodFees: totalGracePeriodFees,
						updatedAt: new Date()
					},
					create: {
						loanId: loanCalc.loanId,
						totalAccruedFees: loanCalc.totalAccruedFees,
						lastCalculationDate: today,
						calculationDetails: loanCalc.calculationDetails,
						status: status,
						gracePeriodDays: gracePeriodDays,
						gracePeriodRepayments: gracePeriodRepaymentsCount,
						totalGracePeriodFees: totalGracePeriodFees
					}
				});

				// Add audit trail entry for late fee charging
				try {
					// Get the loan application ID for audit trail
					const loan = await tx.loan.findUnique({
						where: { id: loanCalc.loanId },
						select: { applicationId: true, status: true }
					});

					if (loan && loan.applicationId && loanCalc.totalAccruedFees > 0) {
						const affectedRepaymentsCount = Object.keys(loanCalc.calculationDetails).length;
						
						// Get all days overdue, sorted from highest to lowest for better readability
						const daysOverdueArray = Object.values(loanCalc.calculationDetails)
							.map(detail => detail.daysOverdue)
							.sort((a, b) => b - a); // Sort descending (most overdue first)
						
						// Create detailed notes with specific days overdue for each repayment
						const daysOverdueList = daysOverdueArray.join(', ');
						const lateFeeNotes = `Late payment fees charged: RM ${totalOutstandingLateFees.toFixed(2)} | Days overdue: ${daysOverdueList} | Repayments affected: ${affectedRepaymentsCount}`;

						// Create audit trail entry specifically for late fee application (not status change)
						await tx.loanApplicationHistory.create({
							data: {
								applicationId: loan.applicationId,
								previousStatus: null, // No status change
								newStatus: loan.status, // Current status remains
								changedBy: "SYSTEM",
								changeReason: "Late payment fees applied",
								notes: lateFeeNotes,
								metadata: {
									eventType: "LATE_FEES_APPLIED",
									loanId: loanCalc.loanId,
									totalFeesCharged: loanCalc.totalAccruedFees,
									outstandingFees: totalOutstandingLateFees,
									gracePeriodDays: gracePeriodDays,
									calculationDate: today.toISOString(),
									repaymentDetails: loanCalc.calculationDetails,
									affectedRepayments: Object.keys(loanCalc.calculationDetails).length,
									processingMode: isManualRun ? "MANUAL" : "AUTOMATED",
									processor: isManualRun ? "ADMIN_MANUAL_TRIGGER" : "LATE_FEE_PROCESSOR_CRON",
									processedAt: new Date().toISOString(),
								}
							}
						});

						logger.info(`Added audit trail for late fee application: Loan ${loanCalc.loanId}, Outstanding: RM ${totalOutstandingLateFees.toFixed(2)}, Repayments: ${Object.keys(loanCalc.calculationDetails).length}`);
					}
				} catch (auditError) {
					logger.error(`Failed to add audit trail for late fee application on loan ${loanCalc.loanId}:`, auditError);
					// Don't fail the entire transaction if audit fails
				}
			}
		}, {
			timeout: 30000, // 30 second timeout
			isolationLevel: 'Serializable' // Prevent race conditions
		});
	}

	/**
	 * Handle payment allocation when a payment is made
	 * Priority: Late fees first, then principal (oldest repayments first)
	 * Fixed: No double database updates, proper error handling, precise calculations
	 */
	static async handlePaymentAllocation(
		loanId: string,
		paymentAmount: number,
		paymentDate: Date,
		tx?: any
	): Promise<{
		success: boolean;
		lateFeesPaid: number;
		principalPaid: number;
		totalLateFees: number;
		paymentAllocation: any[];
		remainingPayment: number;
		errorMessage?: string;
	}> {
		const prismaClient = tx || prisma;

		try {
			logger.info(
				`Handling payment allocation for loan ${loanId}: $${SafeMath.toNumber(paymentAmount).toFixed(2)}`
			);

			// Convert payment amount to safe number but preserve exact precision
			const safePaymentAmount = SafeMath.toNumber(paymentAmount);

			// Get all repayments for this loan, ordered by due date (oldest first)
			const repayments = await prismaClient.loanRepayment.findMany({
				where: { 
					loanId: loanId,
					status: { in: ['PENDING', 'PARTIAL'] }
				},
				orderBy: { dueDate: 'asc' }
			});

			if (repayments.length === 0) {
				return {
					success: true,
					lateFeesPaid: 0,
					principalPaid: 0,
					totalLateFees: 0,
					paymentAllocation: [],
					remainingPayment: safePaymentAmount,
				};
			}

			let remainingPayment = safePaymentAmount;
			let totalLateFeesPaid = 0;
			let totalPrincipalPaid = 0;
			const paymentAllocation: any[] = [];

			// Priority: Late fees first, oldest repayments first
			for (const repayment of repayments) {
				if (remainingPayment <= 0) break;

				const outstandingLateFees = SafeMath.max(0, 
					SafeMath.subtract(
						SafeMath.toNumber(repayment.lateFeeAmount), 
						SafeMath.toNumber(repayment.lateFeesPaid || 0)
					)
				);
				const outstandingPrincipal = SafeMath.max(0, 
					SafeMath.subtract(
						SafeMath.add(
							SafeMath.toNumber(repayment.principalAmount), 
							SafeMath.toNumber(repayment.interestAmount)
						),
						SafeMath.toNumber(repayment.principalPaid || 0)
					)
				);

				let lateFeePayment = 0;
				let principalPayment = 0;
				const repaymentUpdates: any = {};

				// 1. Pay late fees first
				if (outstandingLateFees > 0 && remainingPayment > 0) {
					lateFeePayment = SafeMath.min(remainingPayment, outstandingLateFees);
					remainingPayment = SafeMath.subtract(remainingPayment, lateFeePayment);
					totalLateFeesPaid = SafeMath.add(totalLateFeesPaid, lateFeePayment);

					// Prepare update for late fee payment
					repaymentUpdates.lateFeesPaid = SafeMath.add(
						SafeMath.toNumber(repayment.lateFeesPaid || 0), 
						lateFeePayment
					);
					repaymentUpdates.actualAmount = SafeMath.add(
						SafeMath.toNumber(repayment.actualAmount || 0), 
						lateFeePayment
					);
				}

				// 2. Pay principal with remaining amount
				if (outstandingPrincipal > 0 && remainingPayment > 0) {
					principalPayment = SafeMath.min(remainingPayment, outstandingPrincipal);
					remainingPayment = SafeMath.subtract(remainingPayment, principalPayment);
					totalPrincipalPaid = SafeMath.add(totalPrincipalPaid, principalPayment);

					// Prepare update for principal payment
					repaymentUpdates.principalPaid = SafeMath.add(
						SafeMath.toNumber(repayment.principalPaid || 0), 
						principalPayment
					);
					repaymentUpdates.actualAmount = SafeMath.add(
						SafeMath.toNumber(repaymentUpdates.actualAmount || repayment.actualAmount || 0), 
						principalPayment
					);

					// Determine payment status and type
					const newOutstandingPrincipal = SafeMath.subtract(outstandingPrincipal, principalPayment);
					const newOutstandingLateFees = SafeMath.subtract(outstandingLateFees, lateFeePayment);
					
					if (newOutstandingPrincipal <= 0 && newOutstandingLateFees <= 0) {
						// Fully paid - determine payment type based on actual payment vs due dates
						const paymentTypeInfo = TimeUtils.paymentType(paymentDate, new Date(repayment.dueDate));
						
						repaymentUpdates.status = 'COMPLETED';
						repaymentUpdates.paidAt = paymentDate;
						repaymentUpdates.paymentType = paymentTypeInfo.paymentType;
						repaymentUpdates.daysEarly = paymentTypeInfo.daysEarly;
						repaymentUpdates.daysLate = paymentTypeInfo.daysLate;
					} else if (SafeMath.toNumber(repaymentUpdates.actualAmount) > 0) {
						repaymentUpdates.status = 'PARTIAL';
					}
				}

				// Single database update per repayment to avoid double updates
				if (Object.keys(repaymentUpdates).length > 0) {
					repaymentUpdates.updatedAt = new Date();
					
					await prismaClient.loanRepayment.update({
						where: { id: repayment.id },
						data: repaymentUpdates
					});
				}

				// Record allocation for this repayment
				if (lateFeePayment > 0 || principalPayment > 0) {
					paymentAllocation.push({
						repaymentId: repayment.id,
						installmentNumber: repayment.installmentNumber,
						lateFeePayment: SafeMath.round(lateFeePayment),
						principalPayment: SafeMath.round(principalPayment),
						totalPayment: SafeMath.round(SafeMath.add(lateFeePayment, principalPayment)),
						outstandingLateFees: SafeMath.max(0, SafeMath.subtract(outstandingLateFees, lateFeePayment)),
						outstandingPrincipal: SafeMath.max(0, SafeMath.subtract(outstandingPrincipal, principalPayment))
					});
				}
			}

			// Handle overpayment
			if (remainingPayment > 0) {
				logger.info(`Overpayment detected: $${SafeMath.round(remainingPayment).toFixed(2)} remaining after allocation`);
				// For now, just log the overpayment. In the future, this could be credited to customer account
			}

			// Update loan-level late fees entry if late fees were paid
			if (totalLateFeesPaid > 0) {
				const lateFeeEntry = await prismaClient.lateFee.findUnique({
					where: { loanId: loanId }
				});

				if (lateFeeEntry) {
					const newTotalAccruedFees = SafeMath.max(0, 
						SafeMath.subtract(
							SafeMath.toNumber(lateFeeEntry.totalAccruedFees), 
							totalLateFeesPaid
						)
					);

									// Check if all late fees for this loan are fully paid AND all underlying payments are complete
				const allRepayments = await prismaClient.loanRepayment.findMany({
					where: { loanId: loanId },
					select: { 
						lateFeeAmount: true,
						lateFeesPaid: true,
						principalAmount: true,
						interestAmount: true,
						principalPaid: true
					}
				});

				// Calculate total outstanding late fees for this loan
				const totalOutstandingLateFees = allRepayments.reduce((total: number, repayment: any) => {
					const lateFeeAmount = SafeMath.toNumber(repayment.lateFeeAmount || 0);
					const lateFeesPaid = SafeMath.toNumber(repayment.lateFeesPaid || 0);
					return SafeMath.add(total, SafeMath.max(0, SafeMath.subtract(lateFeeAmount, lateFeesPaid)));
				}, 0);

				// Calculate total outstanding principal/interest for this loan
				const totalOutstandingPrincipal = allRepayments.reduce((total: number, repayment: any) => {
					const originalAmount = SafeMath.add(
						SafeMath.toNumber(repayment.principalAmount || 0),
						SafeMath.toNumber(repayment.interestAmount || 0)
					);
					const principalPaid = SafeMath.toNumber(repayment.principalPaid || 0);
					return SafeMath.add(total, SafeMath.max(0, SafeMath.subtract(originalAmount, principalPaid)));
				}, 0);

				// Determine status: PAID only if both late fees AND underlying payments are fully paid
				const status = (totalOutstandingLateFees <= 0 && totalOutstandingPrincipal <= 0) ? 'PAID' : 'ACTIVE';
					
					await prismaClient.lateFee.update({
						where: { loanId: loanId },
						data: {
							totalAccruedFees: newTotalAccruedFees,
							status: status,
							updatedAt: new Date()
						}
					});
				}
			}

			// Calculate total late fees for this loan
			const totalLateFees = await prismaClient.loanRepayment.aggregate({
				where: { loanId: loanId },
				_sum: { lateFeeAmount: true }
			});

			logger.info(
				`✅ Payment allocation completed: $${totalLateFeesPaid.toFixed(2)} to late fees, $${totalPrincipalPaid.toFixed(2)} to principal. Remaining: $${remainingPayment.toFixed(2)}`
			);

			return {
				success: true,
				lateFeesPaid: totalLateFeesPaid,
				principalPaid: totalPrincipalPaid,
				totalLateFees: SafeMath.toNumber(totalLateFees._sum.lateFeeAmount || 0),
				paymentAllocation,
				remainingPayment: remainingPayment,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			logger.error(
				`Error handling payment allocation for loan ${loanId}:`,
				error
			);

			return {
				success: false,
				lateFeesPaid: 0,
				principalPaid: 0,
				totalLateFees: 0,
				paymentAllocation: [],
				remainingPayment: SafeMath.toNumber(paymentAmount),
				errorMessage,
			};
		}
	}

	/**
	 * Get total amount due for a repayment including late fees
	 */
	static async getTotalAmountDue(loanRepaymentId: string): Promise<{
		originalAmount: number;
		totalLateFees: number;
		totalAmountDue: number;
		lateFeeBreakdown: any[];
		interestFeesTotal: number;
		fixedFeesTotal: number;
	}> {
		try {
			// Get repayment details with loan and product info
			const repayment = await prisma.loanRepayment.findUnique({
				where: { id: loanRepaymentId },
				include: {
					loan: {
						include: {
							application: {
								include: {
									product: true
								}
							},
							lateFee: true
						}
				}
			}
			});

			if (!repayment) {
				throw new Error(`Repayment ${loanRepaymentId} not found`);
			}

			const originalAmount = SafeMath.toNumber(repayment.amount);
			const totalLateFees = SafeMath.toNumber(repayment.lateFeeAmount || 0);
			const totalAmountDue = SafeMath.add(originalAmount, totalLateFees);

			// Calculate breakdown based on the outstanding amount and days overdue
			const dueDate = new Date(repayment.dueDate);
			const daysOverdue = TimeUtils.daysOverdue(dueDate);
			
			const product = repayment.loan.application.product;
			const dailyRate = Number(product.lateFeeRate) / 100; // Preserve full precision for rate
			const fixedFeeAmount = SafeMath.toNumber(product.lateFeeFixedAmount || 0);
			const frequencyDays = Math.max(1, Math.floor(SafeMath.toNumber(product.lateFeeFrequencyDays || 7)));

			// Calculate breakdown using REMAINING UNPAID BALANCE
			const outstandingPrincipal = SafeMath.max(0, 
				SafeMath.subtract(
					SafeMath.add(
						SafeMath.toNumber(repayment.principalAmount), 
						SafeMath.toNumber(repayment.interestAmount)
					),
					SafeMath.toNumber(repayment.principalPaid || 0)
				)
			);
			
			const interestFeesTotal = daysOverdue > 0 ? 
				SafeMath.lateFeeCalculation(outstandingPrincipal, dailyRate, daysOverdue) : 0;
			
			const completedPeriods = Math.floor(daysOverdue / frequencyDays);
			const fixedFeesTotal = SafeMath.multiply(completedPeriods, fixedFeeAmount);

			return {
				originalAmount,
				totalLateFees,
				totalAmountDue,
				lateFeeBreakdown: [],
				interestFeesTotal,
				fixedFeesTotal,
			};
		} catch (error) {
			logger.error("Error calculating total amount due:", error);
			throw error;
		}
	}

	/**
	 * Log processing result for audit trail
	 */
	private static async logProcessingResult(data: {
		feesCalculated: number;
		totalFeeAmount: number;
		overdueRepayments: number;
		status: string;
		errorMessage?: string;
		processingTimeMs: number;
	}) {
		try {
			await prisma.lateFeeProcessingLog.create({
		data: {
					feesCalculated: data.feesCalculated,
					totalFeeAmount: SafeMath.round(data.totalFeeAmount),
					overdue_repayments: data.overdueRepayments,
					status: data.status,
					errorMessage: data.errorMessage,
					processingTimeMs: data.processingTimeMs,
					metadata: {
			timestamp: new Date().toISOString(),
						processingType: data.status.includes('MANUAL') ? 'manual' : 'automatic'
					}
				}
			});
		} catch (error) {
			logger.error("Failed to log processing result:", error);
			// Don't throw here to avoid breaking the main process
		}
	}

	/**
	 * Get late fee summary for a specific repayment
	 */
	static async getLateFeesSummary(loanRepaymentId: string) {
		const repayment = await prisma.loanRepayment.findUnique({
			where: { id: loanRepaymentId },
			include: {
				loan: {
					include: {
						lateFee: true
					}
				}
			}
		});

		if (!repayment) {
			return {
				totalFees: 0,
				latestCumulativeFees: 0,
				feeEntries: 0,
				latestCalculationDate: null,
			};
		}

		return {
			totalFees: repayment.lateFeeAmount || 0,
			latestCumulativeFees: repayment.lateFeeAmount || 0,
			feeEntries: repayment.lateFeeAmount > 0 ? 1 : 0,
			latestCalculationDate: repayment.loan.lateFee?.lastCalculationDate || null,
		};
	}

	/**
	 * Get processing status for admin dashboard
	 */
	static async getProcessingStatus() {
		const latestLogQuery = `
			SELECT * FROM late_fee_processing_logs
			ORDER BY "processedAt" DESC
			LIMIT 1
		`;

		const todayStart = TimeUtils.malaysiaStartOfDay();

		const todayProcessedQuery = `
			SELECT COUNT(*) as count
			FROM late_fee_processing_logs
			WHERE "processedAt" >= $1 AND status = 'SUCCESS'
		`;

		const [latestLogResult, todayProcessedResult] = await Promise.all([
			prisma.$queryRawUnsafe(latestLogQuery) as Promise<any[]>,
			prisma.$queryRawUnsafe(todayProcessedQuery, todayStart) as Promise<
				any[]
			>,
		]);

		const latestLog = latestLogResult[0];
		const todayProcessed = Number(todayProcessedResult[0]?.count || 0);

		return {
			lastProcessed: latestLog?.processedAt,
			lastStatus: latestLog?.status,
			lastError: latestLog?.errorMessage,
			processedToday: todayProcessed > 0,
			todayProcessingCount: todayProcessed,
		};
	}
}
