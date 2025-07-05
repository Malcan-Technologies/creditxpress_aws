import { logger } from "./logger";
import { prisma } from "../../lib/prisma";

interface LateFeeCalculation {
	loanRepaymentId: string;
	daysOverdue: number;
	outstandingPrincipal: number;
	dailyRate: number;
	feeAmount: number;
	cumulativeFees: number;
	feeType: "INTEREST" | "FIXED" | "COMBINED";
	fixedFeeAmount?: number;
	frequencyDays?: number;
}

export class LateFeeProcessor {
	/**
	 * Main function to process all overdue payments and calculate late fees
	 * @param force - If true, bypass the daily calculation limit and recalculate fees
	 */
	static async processLateFees(force: boolean = false): Promise<{
		success: boolean;
		feesCalculated: number;
		totalFeeAmount: number;
		overdueRepayments: number;
		errorMessage?: string;
		processingTimeMs: number;
		isManualRun?: boolean;
	}> {
		const startTime = Date.now();
		let feesCalculated = 0;
		let totalFeeAmount = 0;
		let overdueRepaymentsCount = 0;
		let errorMessage: string | undefined;

		try {
			logger.info(
				`Starting late fee processing... ${
					force ? "(Manual/Force mode)" : "(Automatic mode)"
				}`
			);

			// Get all overdue repayments with product configuration
			const overdueRepayments =
				await LateFeeProcessor.getOverdueRepaymentsWithProduct();
			logger.info(`Found ${overdueRepayments.length} overdue repayments`);

			const calculations: LateFeeCalculation[] = [];

			for (const repayment of overdueRepayments) {
				try {
					// Calculate combined late fee (interest + fixed in one entry)
					const combinedCalculation =
						await LateFeeProcessor.calculateCombinedLateFee(
							repayment,
							force
						);
					if (combinedCalculation) {
						calculations.push(combinedCalculation);
						totalFeeAmount += combinedCalculation.feeAmount;
						feesCalculated++;
					}
				} catch (error) {
					logger.error(
						`Error calculating late fee for repayment ${repayment.id}:`,
						error
					);
					// Continue processing other repayments
				}
			}

			// Save all calculations in a transaction
			if (calculations.length > 0) {
				await LateFeeProcessor.saveLateFees(calculations);
				logger.info(
					`Successfully saved ${calculations.length} late fee calculations`
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
				`Late fee processing completed successfully. Fees calculated: ${feesCalculated}, Total amount: $${totalFeeAmount.toFixed(
					2
				)}${force ? " (Manual run)" : ""}`
			);

			return {
				success: true,
				feesCalculated,
				totalFeeAmount,
				overdueRepayments: overdueRepaymentsCount,
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
				totalFeeAmount,
				overdueRepayments: overdueRepaymentsCount,
				errorMessage,
				processingTimeMs: Date.now() - startTime,
				isManualRun: force,
			};
		}
	}

	/**
	 * Get all overdue repayments with their product configuration
	 */
	private static async getOverdueRepaymentsWithProduct() {
		const today = new Date();
		today.setUTCHours(0, 0, 0, 0); // Start of today

		// Use raw query to get repayments with product late fee configuration
		const query = `
			SELECT 
				lr.*,
				l.id as loan_id, 
				l."outstandingBalance", 
				l.status as loan_status,
				p."lateFeeRate",
				p."lateFeeFixedAmount",
				p."lateFeeFrequencyDays",
				COUNT(lf.id) as fee_count
			FROM loan_repayments lr
			JOIN loans l ON lr."loanId" = l.id
			JOIN loan_applications la ON l."applicationId" = la.id
			JOIN products p ON la."productId" = p.id
			LEFT JOIN late_fees lf ON lr.id = lf."loanRepaymentId" 
				AND lf."calculationDate" >= $1 
			WHERE lr.status IN ('PENDING', 'PARTIAL')
			  AND lr."dueDate" < $1
			  AND l.status = 'ACTIVE'
			GROUP BY lr.id, l.id, l."outstandingBalance", l.status, 
					 p."lateFeeRate", p."lateFeeFixedAmount", p."lateFeeFrequencyDays"
		`;

		const result = await prisma.$queryRawUnsafe(query, today);
		return result as any[];
	}

	/**
	 * Calculate combined late fee (interest + fixed) for a specific repayment
	 * Creates a single database entry with both calculations
	 * @param repayment - The repayment data
	 * @param force - If true, bypass the daily calculation limit
	 */
	private static async calculateCombinedLateFee(
		repayment: any,
		force: boolean = false
	): Promise<LateFeeCalculation | null> {
		const today = new Date();
		today.setUTCHours(0, 0, 0, 0);

		// In force mode, we always recalculate
		// In normal mode, we still calculate to ensure proper upsert behavior
		// The upsert logic in saveLateFees will handle duplicates

		// Calculate days overdue
		const dueDate = new Date(repayment.dueDate);
		dueDate.setUTCHours(0, 0, 0, 0);
		const daysOverdue = Math.floor(
			(today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
		);

		if (daysOverdue <= 0) {
			return null; // Not actually overdue
		}

		// Calculate outstanding principal (amount not yet paid)
		// For partial payments, we need to calculate based on actual amount paid
		const outstandingPrincipal = repayment.actualAmount
			? Math.max(0, repayment.amount - repayment.actualAmount)
			: repayment.amount;

		if (outstandingPrincipal <= 0) {
			return null; // Nothing outstanding
		}

		// Get product configuration
		const dailyRate = Number(repayment.lateFeeRate) / 100;
		const fixedFeeAmount = Number(repayment.lateFeeFixedAmount) || 0;
		const frequencyDays = Number(repayment.lateFeeFrequencyDays) || 7;

		// Calculate interest fees for missed days
		// Exclude current day's entries to avoid double-counting
		const existingDaysQuery = `
			SELECT COUNT(*) as days_charged
			FROM late_fees
			WHERE "loanRepaymentId" = $1
			  AND status = 'ACTIVE'
			  AND "calculationDate" < $2
		`;

		const existingDaysResult = (await prisma.$queryRawUnsafe(
			existingDaysQuery,
			repayment.id,
			today
		)) as any[];
		const daysAlreadyCharged = Number(
			existingDaysResult[0]?.days_charged || 0
		);

		// Calculate interest for missed days
		const missedInterestDays = daysOverdue - daysAlreadyCharged;
		const interestFeeAmount =
			missedInterestDays > 0
				? Math.round(
						outstandingPrincipal *
							dailyRate *
							missedInterestDays *
							100
				  ) / 100
				: 0;

		// Calculate fixed fees for completed periods
		const completedPeriods = Math.floor(daysOverdue / frequencyDays);
		// Exclude current day's entries to avoid double-counting
		const existingFixedFeesQuery = `
			SELECT COALESCE(SUM("fixedFeeAmount"), 0) as total_fixed_charged
			FROM late_fees
			WHERE "loanRepaymentId" = $1
			  AND status = 'ACTIVE'
			  AND "fixedFeeAmount" > 0
			  AND "calculationDate" < $2
		`;

		const existingFixedResult = (await prisma.$queryRawUnsafe(
			existingFixedFeesQuery,
			repayment.id,
			today
		)) as any[];
		const totalFixedAlreadyCharged = Number(
			existingFixedResult[0]?.total_fixed_charged || 0
		);
		const expectedTotalFixed = completedPeriods * fixedFeeAmount;
		const fixedFeeAmountToCharge = Math.max(
			0,
			expectedTotalFixed - totalFixedAlreadyCharged
		);

		// Combine total fee amount
		const totalFeeAmount =
			Math.round((interestFeeAmount + fixedFeeAmountToCharge) * 100) /
			100;

		// If no fees to charge, return null (unless in force mode where we want to show 0 fee calculations)
		if (totalFeeAmount <= 0 && !force) {
			return null;
		}

		// Get cumulative fees up to yesterday
		const previousFeesQuery = `
			SELECT COALESCE(SUM("feeAmount"), 0) as total_fees
			FROM late_fees
			WHERE "loanRepaymentId" = $1
			  AND status = 'ACTIVE'
			  AND "calculationDate" < $2
		`;

		const previousFeesResult = (await prisma.$queryRawUnsafe(
			previousFeesQuery,
			repayment.id,
			today
		)) as any[];
		const previousFeesTotal = previousFeesResult[0]?.total_fees || 0;
		const cumulativeFees =
			Math.round((Number(previousFeesTotal) + totalFeeAmount) * 100) /
			100;

		return {
			loanRepaymentId: repayment.id,
			daysOverdue,
			outstandingPrincipal: Math.round(outstandingPrincipal * 100) / 100,
			dailyRate,
			feeAmount: totalFeeAmount,
			cumulativeFees,
			feeType: "COMBINED" as "INTEREST" | "FIXED",
			fixedFeeAmount: fixedFeeAmount > 0 ? fixedFeeAmount : undefined,
			frequencyDays: fixedFeeAmount > 0 ? frequencyDays : undefined,
		};
	}

	/**
	 * Save late fee calculations to database using upsert logic
	 * Updates existing entries instead of creating duplicates
	 */
	private static async saveLateFees(calculations: LateFeeCalculation[]) {
		const today = new Date();
		today.setUTCHours(0, 0, 0, 0);

		await prisma.$transaction(async (tx) => {
			for (const calc of calculations) {
				// Check if an entry already exists for this repayment today
				const existingEntry = (await tx.$queryRawUnsafe(
					`
					SELECT id FROM late_fees 
					WHERE "loanRepaymentId" = $1 
					  AND "calculationDate" = $2 
					  AND "feeType" = $3
					  AND status = 'ACTIVE'
					LIMIT 1
				`,
					calc.loanRepaymentId,
					today,
					calc.feeType
				)) as any[];

				if (existingEntry.length > 0) {
					// Update existing entry
					const updateQuery = `
						UPDATE late_fees 
						SET "daysOverdue" = $1,
							"outstandingPrincipal" = $2,
							"dailyRate" = $3,
							"feeAmount" = $4,
							"cumulativeFees" = $5,
							"fixedFeeAmount" = $6,
							"frequencyDays" = $7,
							"updatedAt" = NOW()
						WHERE id = $8
					`;

					await tx.$executeRawUnsafe(
						updateQuery,
						calc.daysOverdue,
						calc.outstandingPrincipal,
						calc.dailyRate,
						calc.feeAmount,
						calc.cumulativeFees,
						calc.fixedFeeAmount || null,
						calc.frequencyDays || null,
						existingEntry[0].id
					);
				} else {
					// Insert new entry
					const insertQuery = `
						INSERT INTO late_fees (
							id, "loanRepaymentId", "calculationDate", "daysOverdue",
							"outstandingPrincipal", "dailyRate", "feeAmount", "cumulativeFees",
							"feeType", "fixedFeeAmount", "frequencyDays",
							status, "createdAt", "updatedAt"
						) VALUES (
							gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', NOW(), NOW()
						)
					`;

					await tx.$executeRawUnsafe(
						insertQuery,
						calc.loanRepaymentId,
						today,
						calc.daysOverdue,
						calc.outstandingPrincipal,
						calc.dailyRate,
						calc.feeAmount,
						calc.cumulativeFees,
						calc.feeType,
						calc.fixedFeeAmount || null,
						calc.frequencyDays || null
					);
				}
			}
		});
	}

	/**
	 * Log processing result using raw query
	 */
	private static async logProcessingResult(result: {
		feesCalculated: number;
		totalFeeAmount: number;
		overdueRepayments: number;
		status: string;
		errorMessage?: string;
		processingTimeMs: number;
	}) {
		const insertQuery = `
			INSERT INTO late_fee_processing_logs (
				id, "feesCalculated", "totalFeeAmount", "overdue_repayments",
				status, "errorMessage", "processingTimeMs", metadata, "createdAt"
			) VALUES (
				gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::jsonb, NOW()
			)
		`;

		const metadata = {
			timestamp: new Date().toISOString(),
			processingType: "enhanced_late_fee_system",
			supportsFeeTypes: ["INTEREST", "FIXED"],
		};

		await prisma.$executeRawUnsafe(
			insertQuery,
			result.feesCalculated,
			result.totalFeeAmount,
			result.overdueRepayments,
			result.status,
			result.errorMessage || null,
			result.processingTimeMs,
			metadata
		);
	}

	/**
	 * Get late fee summary for a specific repayment
	 */
	static async getLateFeesSummary(loanRepaymentId: string) {
		const query = `
			SELECT 
				COUNT(*) as fee_entries,
				COALESCE(SUM("feeAmount"), 0) as total_fees,
				MAX("cumulativeFees") as latest_cumulative_fees,
				MAX("calculationDate") as latest_calculation_date
			FROM late_fees
			WHERE "loanRepaymentId" = $1 AND status = 'ACTIVE'
		`;

		const result = (await prisma.$queryRawUnsafe(
			query,
			loanRepaymentId
		)) as any[];
		const summary = result[0];

		return {
			totalFees: Number(summary.total_fees),
			latestCumulativeFees: Number(summary.latest_cumulative_fees),
			feeEntries: Number(summary.fee_entries),
			latestCalculationDate: summary.latest_calculation_date,
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

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

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

	/**
	 * Handle late fee payment when a repayment is cleared
	 * This should be called whenever a repayment status changes to COMPLETED
	 */
	static async handleRepaymentCleared(
		loanRepaymentId: string,
		paymentAmount: number,
		paymentDate: Date,
		tx?: any
	): Promise<{
		success: boolean;
		lateFeesPaid: number;
		lateFeesWaived: number;
		totalLateFees: number;
		remainingPayment: number;
		errorMessage?: string;
	}> {
		const prismaClient = tx || prisma;

		try {
			logger.info(
				`Handling late fee payment for repayment ${loanRepaymentId}`
			);

			// Get all active late fees for this repayment
			const activeLateFees = (await prismaClient.$queryRawUnsafe(
				`
				SELECT * FROM late_fees 
				WHERE "loanRepaymentId" = $1 AND status = 'ACTIVE'
				ORDER BY "calculationDate" ASC, "feeType" ASC
			`,
				loanRepaymentId
			)) as any[];

			if (activeLateFees.length === 0) {
				return {
					success: true,
					lateFeesPaid: 0,
					lateFeesWaived: 0,
					totalLateFees: 0,
					remainingPayment: paymentAmount,
				};
			}

			// Calculate total late fees owed with proper rounding
			const totalLateFees =
				Math.round(
					activeLateFees.reduce(
						(sum, fee) => sum + fee.feeAmount,
						0
					) * 100
				) / 100;

			// Get the original repayment amount
			const repayment = await prismaClient.loanRepayment.findUnique({
				where: { id: loanRepaymentId },
			});

			if (!repayment) {
				throw new Error(`Repayment ${loanRepaymentId} not found`);
			}

			const originalAmount = Math.round(repayment.amount * 100) / 100;
			const totalAmountDue =
				Math.round((originalAmount + totalLateFees) * 100) / 100;

			let lateFeesPaid = 0;
			let lateFeesWaived = 0;
			let remainingPayment = paymentAmount;

			// Determine how to handle late fees based on payment amount
			if (paymentAmount >= totalAmountDue) {
				// Payment covers original amount + all late fees
				lateFeesPaid = totalLateFees;
				remainingPayment = paymentAmount - totalAmountDue;

				// Mark all late fees as PAID
				const updateResult = await prismaClient.$executeRawUnsafe(
					`
					UPDATE late_fees 
					SET status = 'PAID', "updatedAt" = NOW()
					WHERE "loanRepaymentId" = $1 AND status = 'ACTIVE'
				`,
					loanRepaymentId
				);

				console.log(
					`🔍 DEBUG: Updated ${updateResult} late fee records to PAID for repayment ${loanRepaymentId}`
				);

				// Verify the update worked
				const remainingActiveFees = await prismaClient.$queryRawUnsafe(
					`SELECT COUNT(*) as count FROM late_fees WHERE "loanRepaymentId" = $1 AND status = 'ACTIVE'`,
					loanRepaymentId
				);
				console.log(
					`🔍 DEBUG: Remaining ACTIVE late fees for repayment ${loanRepaymentId}:`,
					remainingActiveFees[0]
				);

				logger.info(
					`Marked ${totalLateFees.toFixed(
						2
					)} in late fees as PAID for repayment ${loanRepaymentId}`
				);
			} else if (paymentAmount > originalAmount) {
				// Payment covers original amount + partial late fees
				const lateFeePayment =
					Math.round((paymentAmount - originalAmount) * 100) / 100;
				lateFeesPaid = lateFeePayment;
				lateFeesWaived =
					Math.round((totalLateFees - lateFeePayment) * 100) / 100;
				remainingPayment = 0;

				// Mark fees as paid proportionally (oldest first)
				let remainingLateFeePayment = lateFeePayment;

				for (const fee of activeLateFees) {
					if (remainingLateFeePayment <= 0) {
						// Leave remaining fees as ACTIVE - they are still owed
						// Do not automatically waive fees
						break;
					} else if (remainingLateFeePayment >= fee.feeAmount) {
						// Fully pay this fee
						await prismaClient.$executeRawUnsafe(
							`
							UPDATE late_fees 
							SET status = 'PAID', "updatedAt" = NOW()
							WHERE id = $1
						`,
							fee.id
						);
						remainingLateFeePayment -= fee.feeAmount;
					} else {
						// Partially pay this fee (split it)
						const paidAmount =
							Math.round(remainingLateFeePayment * 100) / 100;
						const unpaidAmount =
							Math.round((fee.feeAmount - paidAmount) * 100) /
							100;

						// Mark original as paid for the paid portion
						await prismaClient.$executeRawUnsafe(
							`
							UPDATE late_fees 
							SET status = 'PAID', "feeAmount" = $2, "updatedAt" = NOW()
							WHERE id = $1
						`,
							fee.id,
							paidAmount
						);

						// Create a new record for the unpaid portion (remains ACTIVE)
						await prismaClient.$executeRawUnsafe(
							`
							INSERT INTO late_fees (
								id, "loanRepaymentId", "calculationDate", "daysOverdue",
								"outstandingPrincipal", "dailyRate", "feeAmount", "cumulativeFees",
								status, "createdAt", "updatedAt"
							) VALUES (
								gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW(), NOW()
							)
						`,
							fee.loanRepaymentId,
							fee.calculationDate,
							fee.daysOverdue,
							fee.outstandingPrincipal,
							fee.dailyRate,
							unpaidAmount,
							fee.cumulativeFees
						);

						remainingLateFeePayment = 0;
					}
				}

				// Recalculate waived amount (should be 0 since we don't auto-waive)
				lateFeesWaived = 0;

				logger.info(
					`Paid ${lateFeesPaid.toFixed(
						2
					)} in late fees for repayment ${loanRepaymentId}. Remaining unpaid late fees will continue to be owed.`
				);
			} else {
				// Payment is less than original amount - partial payment
				// Late fees continue to compound on remaining balance
				// We don't mark late fees as paid or waived
				remainingPayment = 0;

				logger.info(
					`Partial payment ${paymentAmount.toFixed(
						2
					)} < original amount ${originalAmount.toFixed(
						2
					)} for repayment ${loanRepaymentId}. Late fees (${totalLateFees.toFixed(
						2
					)}) will continue to compound on remaining balance.`
				);
			}

			// Log the late fee payment handling
			await LateFeeProcessor.logLateFeePayment(
				{
					loanRepaymentId,
					paymentAmount,
					originalAmount,
					totalLateFees,
					lateFeesPaid,
					lateFeesWaived,
					paymentDate,
				},
				prismaClient
			);

			return {
				success: true,
				lateFeesPaid,
				lateFeesWaived,
				totalLateFees,
				remainingPayment,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			logger.error(
				`Error handling late fee payment for repayment ${loanRepaymentId}:`,
				error
			);

			return {
				success: false,
				lateFeesPaid: 0,
				lateFeesWaived: 0,
				totalLateFees: 0,
				remainingPayment: paymentAmount,
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
			// Get repayment details
			const repayment = await prisma.loanRepayment.findUnique({
				where: { id: loanRepaymentId },
			});

			if (!repayment) {
				throw new Error(`Repayment ${loanRepaymentId} not found`);
			}

			// Get active late fees
			const activeLateFees = (await prisma.$queryRawUnsafe(
				`
				SELECT * FROM late_fees 
				WHERE "loanRepaymentId" = $1 AND status = 'ACTIVE'
				ORDER BY "calculationDate" ASC, "feeType" ASC
			`,
				loanRepaymentId
			)) as any[];

			const totalLateFees =
				Math.round(
					activeLateFees.reduce(
						(sum, fee) => sum + fee.feeAmount,
						0
					) * 100
				) / 100;
			const originalAmount = Math.round(repayment.amount * 100) / 100;
			const totalAmountDue =
				Math.round((originalAmount + totalLateFees) * 100) / 100;

			// Separate fees by type for breakdown
			const interestFees = activeLateFees.filter(
				(fee) => fee.feeType === "INTEREST"
			);
			const fixedFees = activeLateFees.filter(
				(fee) => fee.feeType === "FIXED"
			);

			return {
				originalAmount,
				totalLateFees,
				totalAmountDue,
				lateFeeBreakdown: activeLateFees.map((fee) => ({
					date: fee.calculationDate,
					daysOverdue: fee.daysOverdue,
					amount: Math.round(fee.feeAmount * 100) / 100,
					status: fee.status,
					feeType: fee.feeType,
					fixedFeeAmount: fee.fixedFeeAmount
						? Math.round(fee.fixedFeeAmount * 100) / 100
						: null,
					frequencyDays: fee.frequencyDays,
				})),
				interestFeesTotal:
					Math.round(
						interestFees.reduce(
							(sum, fee) => sum + fee.feeAmount,
							0
						) * 100
					) / 100,
				fixedFeesTotal:
					Math.round(
						fixedFees.reduce((sum, fee) => sum + fee.feeAmount, 0) *
							100
					) / 100,
			};
		} catch (error) {
			logger.error(
				`Error getting total amount due for repayment ${loanRepaymentId}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Log late fee payment handling
	 */
	private static async logLateFeePayment(
		data: {
			loanRepaymentId: string;
			paymentAmount: number;
			originalAmount: number;
			totalLateFees: number;
			lateFeesPaid: number;
			lateFeesWaived: number;
			paymentDate: Date;
		},
		prismaClient: any
	) {
		const insertQuery = `
			INSERT INTO late_fee_processing_logs (
				id, "processedAt", "feesCalculated", "totalFeeAmount", 
				"overdue_repayments", status, "processingTimeMs", metadata, "createdAt"
			) VALUES (
				gen_random_uuid(), NOW(), 0, $1, 1, 'PAYMENT_PROCESSED', 0, $2::jsonb, NOW()
			)
		`;

		const metadata = {
			type: "late_fee_payment",
			loanRepaymentId: data.loanRepaymentId,
			paymentAmount: data.paymentAmount,
			originalAmount: data.originalAmount,
			totalLateFees: data.totalLateFees,
			lateFeesPaid: data.lateFeesPaid,
			lateFeesWaived: data.lateFeesWaived,
			paymentDate: data.paymentDate.toISOString(),
		};

		await prismaClient.$executeRawUnsafe(
			insertQuery,
			data.lateFeesPaid,
			JSON.stringify(metadata)
		);
	}
}
