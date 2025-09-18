import { logger } from "./logger";
import { SafeMath, TimeUtils } from "./precisionUtils";
import { prisma } from "../../lib/prisma";

// Lock constants for PostgreSQL advisory locks
const DEFAULT_PROCESSING_LOCK_ID = 123456790; // Unique identifier for default processing

// Helper function to get default settings from database
async function getDefaultSettings(prismaClient: any = prisma) {
	try {
		const settings = await prismaClient.systemSettings.findMany({
			where: {
				key: {
					in: [
						'ENABLE_DEFAULT_PROCESSING',
						'DEFAULT_RISK_DAYS',
						'DEFAULT_REMEDY_DAYS',
						'WHATSAPP_DEFAULT_RISK',
						'WHATSAPP_DEFAULT_REMINDER',
						'WHATSAPP_DEFAULT_FINAL'
					]
				},
				isActive: true
			}
		});

		const enableDefaultSetting = settings.find((s: any) => s.key === 'ENABLE_DEFAULT_PROCESSING');
		const riskDaysSetting = settings.find((s: any) => s.key === 'DEFAULT_RISK_DAYS');
		const remedyDaysSetting = settings.find((s: any) => s.key === 'DEFAULT_REMEDY_DAYS');
		const whatsappRiskSetting = settings.find((s: any) => s.key === 'WHATSAPP_DEFAULT_RISK');
		const whatsappReminderSetting = settings.find((s: any) => s.key === 'WHATSAPP_DEFAULT_REMINDER');
		const whatsappFinalSetting = settings.find((s: any) => s.key === 'WHATSAPP_DEFAULT_FINAL');

		return {
			isEnabled: enableDefaultSetting ? JSON.parse(enableDefaultSetting.value) : true,
			riskDays: riskDaysSetting ? JSON.parse(riskDaysSetting.value) : 28,
			remedyDays: remedyDaysSetting ? JSON.parse(remedyDaysSetting.value) : 14,
			whatsappRisk: whatsappRiskSetting ? JSON.parse(whatsappRiskSetting.value) : true,
			whatsappReminder: whatsappReminderSetting ? JSON.parse(whatsappReminderSetting.value) : true,
			whatsappFinal: whatsappFinalSetting ? JSON.parse(whatsappFinalSetting.value) : true,
		};
	} catch (error) {
		logger.error('Error fetching default settings:', error);
		// Default fallback values
		return {
			isEnabled: true,
			riskDays: 28,
			remedyDays: 14,
			whatsappRisk: true,
			whatsappReminder: true,
			whatsappFinal: true,
		};
	}
}

/**
 * Acquire a PostgreSQL advisory lock for default processing
 */
async function acquireDefaultProcessingLock(): Promise<boolean> {
	try {
		const result = await prisma.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
			SELECT pg_try_advisory_lock(${DEFAULT_PROCESSING_LOCK_ID})
		`;
		return result[0].pg_try_advisory_lock;
	} catch (error) {
		logger.error("Error acquiring default processing lock:", error);
		return false;
	}
}

/**
 * Release the PostgreSQL advisory lock for default processing
 */
async function releaseDefaultProcessingLock(): Promise<boolean> {
	try {
		const result = await prisma.$queryRaw<[{ pg_advisory_unlock: boolean }]>`
			SELECT pg_advisory_unlock(${DEFAULT_PROCESSING_LOCK_ID})
		`;
		return result[0].pg_advisory_unlock;
	} catch (error) {
		logger.error("Error releasing default processing lock:", error);
		return false;
	}
}

// interface DefaultRiskLoan {
// 	loanId: string;
// 	userId: string;
// 	daysOverdue: number;
// 	outstandingAmount: number;
// 	totalLateFees: number;
// 	userFullName: string;
// 	userPhoneNumber: string;
// 	productName: string;
// }

interface DefaultProcessingResult {
	success: boolean;
	riskLoansProcessed: number;
	remedyLoansProcessed: number;
	defaultedLoans: number;
	recoveredLoans: number;
	whatsappMessagesSent: number;
	pdfLettersGenerated: number;
	errorMessage?: string;
	processingTimeMs: number;
	isManualRun?: boolean;
}

export class DefaultProcessor {
	/**
	 * Main function to process all default-related activities
	 * @param force - If true, bypass processing locks but still respect daily calculation limits
	 */
	static async processDefaults(force: boolean = false): Promise<DefaultProcessingResult> {
		const startTime = Date.now();
		let riskLoansProcessed = 0;
		let remedyLoansProcessed = 0;
		let defaultedLoans = 0;
		let recoveredLoans = 0;
		let whatsappMessagesSent = 0;
		let pdfLettersGenerated = 0;
		let errorMessage: string | undefined;

		// Prevent concurrent processing using database-level lock
		const lockAcquired = await acquireDefaultProcessingLock();
		if (!lockAcquired) {
			return {
				success: false,
				riskLoansProcessed: 0,
				remedyLoansProcessed: 0,
				defaultedLoans: 0,
				recoveredLoans: 0,
				whatsappMessagesSent: 0,
				pdfLettersGenerated: 0,
				errorMessage: "Default processing already in progress. Please wait for it to complete.",
				processingTimeMs: Date.now() - startTime,
				isManualRun: force,
			};
		}

		try {
			// Get default settings
			const settings = await getDefaultSettings();
			
			if (!settings.isEnabled) {
				logger.info("Default processing is disabled in system settings");
				return {
					success: true,
					riskLoansProcessed: 0,
					remedyLoansProcessed: 0,
					defaultedLoans: 0,
					recoveredLoans: 0,
					whatsappMessagesSent: 0,
					pdfLettersGenerated: 0,
					processingTimeMs: Date.now() - startTime,
					isManualRun: force,
				};
			}

			logger.info(
				`Starting default processing... ${
					force ? "(Manual/Force mode)" : "(Automatic mode)"
				}. Risk threshold: ${settings.riskDays} days, Remedy period: ${settings.remedyDays} days`
			);

			// Check daily limits for different types of processing (only for non-force mode)
			const today = TimeUtils.malaysiaStartOfDay();
			let skipRiskFlagging = false;
			let skipDefaultTransition = false;
			let skipRecoveryCheck = false;

			if (!force) {
				// Check if risk flagging already happened today
				const riskFlaggingToday = await prisma.loanDefaultLog.findFirst({
					where: {
						processedAt: { gte: today },
						eventType: 'RISK_FLAGGED'
					}
				});
				skipRiskFlagging = !!riskFlaggingToday;

				// Check if default transition already happened today
				const defaultTransitionToday = await prisma.loanDefaultLog.findFirst({
					where: {
						processedAt: { gte: today },
						eventType: 'DEFAULTED'
					}
				});
				skipDefaultTransition = !!defaultTransitionToday;

				// Check if recovery processing already happened today
				const recoveryToday = await prisma.loanDefaultLog.findFirst({
					where: {
						processedAt: { gte: today },
						eventType: 'RECOVERED'
					}
				});
				skipRecoveryCheck = !!recoveryToday;

				if (skipRiskFlagging && skipDefaultTransition && skipRecoveryCheck) {
					logger.info(`All default processing types already completed today. Use force mode to recalculate.`);
					return {
						success: true,
						riskLoansProcessed: 0,
						remedyLoansProcessed: 0,
						defaultedLoans: 0,
						recoveredLoans: 0,
						whatsappMessagesSent: 0,
						pdfLettersGenerated: 0,
						processingTimeMs: Date.now() - startTime,
						isManualRun: force,
					};
				}
			}

			// Step 1: Check for loans that should be flagged as default risk (28 days overdue)
			if (!skipRiskFlagging || force) {
				const riskResults = await DefaultProcessor.processDefaultRisk(settings);
				riskLoansProcessed = riskResults.processed;
				whatsappMessagesSent += riskResults.whatsappSent;
				pdfLettersGenerated += riskResults.pdfGenerated;
			} else {
				logger.info("Skipping risk flagging - already processed today");
			}

			// Step 2: Process loans in remedy period (send reminders)
			const remedyResults = await DefaultProcessor.processRemedyPeriod(settings);
			remedyLoansProcessed = remedyResults.processed;
			whatsappMessagesSent += remedyResults.whatsappSent;

			// Step 3: Check for loans that should be defaulted (44 days overdue with 16-day remedy period)
			if (!skipDefaultTransition || force) {
				const defaultResults = await DefaultProcessor.processDefaultTransition(settings);
				defaultedLoans = defaultResults.processed;
				whatsappMessagesSent += defaultResults.whatsappSent;
			} else {
				logger.info("Skipping default transition - already processed today");
			}

			// Step 4: Check for loans that should be recovered from default
			if (!skipRecoveryCheck || force) {
				const recoveryResults = await DefaultProcessor.processDefaultRecovery();
				recoveredLoans = recoveryResults.processed;
			} else {
				logger.info("Skipping recovery check - already processed today");
			}

			logger.info(
				`Default processing completed successfully. Risk: ${riskLoansProcessed}, Remedy: ${remedyLoansProcessed}, Defaulted: ${defaultedLoans}, Recovered: ${recoveredLoans}, WhatsApp: ${whatsappMessagesSent}, PDFs: ${pdfLettersGenerated}${force ? " (Manual run)" : ""}`
			);

			return {
				success: true,
				riskLoansProcessed,
				remedyLoansProcessed,
				defaultedLoans,
				recoveredLoans,
				whatsappMessagesSent,
				pdfLettersGenerated,
				processingTimeMs: Date.now() - startTime,
				isManualRun: force,
			};
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "Unknown error";
			logger.error("Default processing failed:", error);

			return {
				success: false,
				riskLoansProcessed,
				remedyLoansProcessed,
				defaultedLoans,
				recoveredLoans,
				whatsappMessagesSent,
				pdfLettersGenerated,
				errorMessage,
				processingTimeMs: Date.now() - startTime,
				isManualRun: force,
			};
		} finally {
			// Release the database lock
			await releaseDefaultProcessingLock();
		}
	}

	/**
	 * Process loans that should be flagged as default risk (28 days overdue)
	 */
	private static async processDefaultRisk(settings: any): Promise<{
		processed: number;
		whatsappSent: number;
		pdfGenerated: number;
	}> {
		// Use current timestamp to avoid missing loans that became overdue in the last hour
		const now = new Date();
		const riskThreshold = new Date(now.getTime() - (settings.riskDays * 24 * 60 * 60 * 1000));

		// Get loans that are 28+ days overdue but not yet flagged as default risk
		const query = `
			SELECT DISTINCT
				l.id as loan_id,
				l."userId",
				l."defaultRiskFlaggedAt",
				u."fullName" as user_full_name,
				u."phoneNumber" as user_phone_number,
				p.name as product_name,
				MIN(lr."dueDate") as earliest_due_date,
				SUM(CASE WHEN lr.status IN ('PENDING', 'PARTIAL') 
					THEN (lr."principalAmount" + lr."interestAmount" - lr."principalPaid") 
					ELSE 0 END) as outstanding_amount,
				SUM(CASE WHEN lr.status IN ('PENDING', 'PARTIAL') 
					THEN (lr."lateFeeAmount" - lr."lateFeesPaid") 
					ELSE 0 END) as total_late_fees
			FROM loans l
			JOIN users u ON l."userId" = u.id
			JOIN loan_applications la ON l."applicationId" = la.id
			JOIN products p ON la."productId" = p.id
			JOIN loan_repayments lr ON l.id = lr."loanId"
			WHERE l.status = 'ACTIVE'
			  AND lr.status IN ('PENDING', 'PARTIAL')
			  AND lr."dueDate" < $1
			  AND l."defaultRiskFlaggedAt" IS NULL
			GROUP BY l.id, l."userId", l."defaultRiskFlaggedAt", u."fullName", u."phoneNumber", p.name
			HAVING MIN(lr."dueDate") < $1
		`;

		const riskLoans = await prisma.$queryRawUnsafe(query, riskThreshold) as any[];
		
		let processed = 0;
		let whatsappSent = 0;
		let pdfGenerated = 0;

		for (const loan of riskLoans) {
			try {
				const daysOverdue = TimeUtils.daysOverdue(new Date(loan.earliest_due_date));
				
				if (daysOverdue >= settings.riskDays) {
					await DefaultProcessor.flagLoanAsDefaultRisk(
						loan.loan_id,
						daysOverdue,
						SafeMath.toNumber(loan.outstanding_amount),
						SafeMath.toNumber(loan.total_late_fees),
						{
							userId: loan.userId,
							userFullName: loan.user_full_name,
							userPhoneNumber: loan.user_phone_number,
							productName: loan.product_name,
						},
						settings
					);
					
					processed++;
					
					// PDF generation removed - only manual generation via admin interface
				}
			} catch (error) {
				logger.error(`Error processing default risk for loan ${loan.loan_id}:`, error);
			}
		}

		return { processed, whatsappSent, pdfGenerated };
	}

	/**
	 * Process loans in remedy period (send reminders)
	 */
	private static async processRemedyPeriod(settings: any): Promise<{
		processed: number;
		whatsappSent: number;
	}> {
		// Use current timestamp instead of start-of-day to avoid timing issues
		// when cron runs at 01:00 MYT but start-of-day returns 00:00 MYT
		const now = new Date();

		// Get loans that are in remedy period (flagged but not yet defaulted)
		const remedyLoans = await prisma.loan.findMany({
			where: {
				status: 'ACTIVE',
				defaultRiskFlaggedAt: { not: null },
				defaultedAt: null,
			},
			include: {
				user: {
					select: {
						id: true,
						fullName: true,
						phoneNumber: true,
					}
				},
				application: {
					include: {
						product: {
							select: {
								name: true,
							}
						}
					}
				},
				repayments: {
					where: {
						status: { in: ['PENDING', 'PARTIAL'] }
					},
					orderBy: {
						dueDate: 'asc'
					}
				}
			}
		});

		let processed = 0;
		let whatsappSent = 0;

		for (const loan of remedyLoans) {
			try {
				const flaggedDate = loan.defaultRiskFlaggedAt!;
				const daysSinceFlagged = Math.floor((now.getTime() - flaggedDate.getTime()) / (24 * 60 * 60 * 1000));
				const remedyDeadline = new Date(flaggedDate.getTime() + (settings.remedyDays * 24 * 60 * 60 * 1000));
				
				// Calculate outstanding amounts
				const outstandingAmount = loan.repayments.reduce((total, repayment) => {
					return total + SafeMath.max(0, 
						SafeMath.subtract(
							SafeMath.add(repayment.principalAmount, repayment.interestAmount),
							repayment.principalPaid
						)
					);
				}, 0);

				const totalLateFees = loan.repayments.reduce((total, repayment) => {
					return total + SafeMath.max(0, 
						SafeMath.subtract(repayment.lateFeeAmount, repayment.lateFeesPaid)
					);
				}, 0);

				// Send reminders at specific intervals (e.g., day 7 and day 12 of remedy period)
				const shouldSendReminder = (daysSinceFlagged === 7 || daysSinceFlagged === 12) && 
					loan.defaultNoticesSent < 3; // Limit to 3 total notices

				if (shouldSendReminder && settings.whatsappReminder) {
					const daysRemaining = Math.max(0, settings.remedyDays - daysSinceFlagged);
					
					await DefaultProcessor.sendDefaultReminder(
						loan.id,
						loan.user.phoneNumber,
						{
							userFullName: loan.user.fullName || 'Customer',
							productName: loan.application.product.name,
							outstandingAmount,
							totalLateFees,
							daysRemaining,
							remedyDeadline,
						}
					);

					// Update notice count
					await prisma.loan.update({
						where: { id: loan.id },
						data: {
							defaultNoticesSent: loan.defaultNoticesSent + 1,
						}
					});

					// WhatsApp notifications are sent later at 10 AM, not during processing
				}

				processed++;
			} catch (error) {
				logger.error(`Error processing remedy period for loan ${loan.id}:`, error);
			}
		}

		return { processed, whatsappSent };
	}

	/**
	 * Process loans that should be defaulted (28 + remedy days overdue)
	 */
	private static async processDefaultTransition(settings: any): Promise<{
		processed: number;
		whatsappSent: number;
	}> {
		// Use current timestamp to avoid missing loans that should be defaulted in the last hour
		const now = new Date();
		const defaultThreshold = new Date(now.getTime() - ((settings.riskDays + settings.remedyDays) * 24 * 60 * 60 * 1000));

		// Get loans that should be defaulted:
		// 1. Have overdue payments past the total default threshold (28 + 16 = 44 days)
		// 2. Are not already defaulted
		const query = `
			SELECT DISTINCT
				l.id as loan_id,
				l."userId",
				l."defaultRiskFlaggedAt",
				u."fullName" as user_full_name,
				u."phoneNumber" as user_phone_number,
				p.name as product_name,
				MIN(lr."dueDate") as earliest_due_date,
				SUM(CASE WHEN lr.status IN ('PENDING', 'PARTIAL') 
					THEN (lr."principalAmount" + lr."interestAmount" - lr."principalPaid") 
					ELSE 0 END) as outstanding_amount,
				SUM(CASE WHEN lr.status IN ('PENDING', 'PARTIAL') 
					THEN (lr."lateFeeAmount" - lr."lateFeesPaid") 
					ELSE 0 END) as total_late_fees
			FROM loans l
			JOIN users u ON l."userId" = u.id
			JOIN loan_applications la ON l."applicationId" = la.id
			JOIN products p ON la."productId" = p.id
			JOIN loan_repayments lr ON l.id = lr."loanId"
			WHERE l.status = 'ACTIVE'
			  AND lr.status IN ('PENDING', 'PARTIAL')
			  AND lr."dueDate" < $1
			  AND l."defaultedAt" IS NULL
			GROUP BY l.id, l."userId", l."defaultRiskFlaggedAt", u."fullName", u."phoneNumber", p.name
			HAVING MIN(lr."dueDate") < $1
		`;

		const loansToDefaultRaw = await prisma.$queryRawUnsafe(query, defaultThreshold) as any[];

		logger.info(`Default transition query found ${loansToDefaultRaw.length} loans to check`);
		loansToDefaultRaw.forEach((loan: any) => {
			logger.info(`Loan ${loan.loan_id}: earliest due ${loan.earliest_due_date}, flagged at ${loan.defaultRiskFlaggedAt}`);
		});

		// Convert to the format expected by the rest of the method
		const loansToDefault = (await Promise.all(loansToDefaultRaw.map(async (loan: any) => {
			const fullLoan = await prisma.loan.findUnique({
				where: { id: loan.loan_id },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							phoneNumber: true,
						}
					},
					application: {
						include: {
							product: {
								select: {
									name: true,
								}
							}
						}
					},
					repayments: {
						where: {
							status: { in: ['PENDING', 'PARTIAL'] }
						}
					}
				}
			});
			return fullLoan;
		}))).filter(loan => loan !== null);

		let processed = 0;
		let whatsappSent = 0;

		for (const loan of loansToDefault) {
			try {
				// Calculate days overdue from earliest due date
				const earliestDueDate = Math.min(...loan.repayments.map(r => new Date(r.dueDate).getTime()));
				const daysOverdue = Math.floor((now.getTime() - earliestDueDate) / (24 * 60 * 60 * 1000));
				
				// For loans that were never flagged, check if they should be directly defaulted
				if (!loan.defaultRiskFlaggedAt) {
					// If loan is past the total default threshold (28 + 16 = 44 days), default it directly
					if (daysOverdue >= (settings.riskDays + settings.remedyDays)) {
						// Calculate outstanding amounts
						const outstandingAmount = loan.repayments.reduce((total, repayment) => {
							return total + SafeMath.max(0, 
								SafeMath.subtract(
									SafeMath.add(repayment.principalAmount, repayment.interestAmount),
									repayment.principalPaid
								)
							);
						}, 0);

						const totalLateFees = loan.repayments.reduce((total, repayment) => {
							return total + SafeMath.max(0, 
								SafeMath.subtract(repayment.lateFeeAmount, repayment.lateFeesPaid)
							);
						}, 0);

						// Only default if there are still outstanding amounts
						if (outstandingAmount > 0 || totalLateFees > 0) {
							// Default the loan directly (this will also set defaultRiskFlaggedAt and defaultedAt)
							await DefaultProcessor.defaultLoan(
								loan.id,
								outstandingAmount,
								totalLateFees,
								{
									userFullName: loan.user.fullName,
									userPhoneNumber: loan.user.phoneNumber,
									productName: loan.application.product.name,
								},
								settings
							);

							processed++;
							logger.info(`Loan ${loan.id} directly defaulted (${daysOverdue} days overdue)`);
						}
					} else {
						// Flag as default risk first (normal 28-day process)
						const outstandingAmount = loan.repayments.reduce((total, repayment) => {
							return total + SafeMath.max(0, 
								SafeMath.subtract(
									SafeMath.add(repayment.principalAmount, repayment.interestAmount),
									repayment.principalPaid
								)
							);
						}, 0);

						const totalLateFees = loan.repayments.reduce((total, repayment) => {
							return total + SafeMath.max(0, 
								SafeMath.subtract(repayment.lateFeeAmount, repayment.lateFeesPaid)
							);
						}, 0);

						await DefaultProcessor.flagLoanAsDefaultRisk(
							loan.id,
							daysOverdue,
							outstandingAmount,
							totalLateFees,
							{
								userFullName: loan.user.fullName,
								userPhoneNumber: loan.user.phoneNumber,
								productName: loan.application.product.name,
							},
							settings
						);

						// Update the loan object to reflect the flagging
						loan.defaultRiskFlaggedAt = new Date();
					}
					
					// Skip the remedy period check since we handled it above
					continue;
				}

				const flaggedDate = loan.defaultRiskFlaggedAt!;
				const remedyDeadline = new Date(flaggedDate.getTime() + (settings.remedyDays * 24 * 60 * 60 * 1000));
				
				// Check if remedy period has expired for previously flagged loans
				// OR if the loan is way past the total default threshold (handles manually edited cases)
				const totalDefaultThreshold = settings.riskDays + settings.remedyDays; // 44 days
				if (now >= remedyDeadline || daysOverdue >= totalDefaultThreshold) {
					// Calculate final outstanding amounts
					const outstandingAmount = loan.repayments.reduce((total, repayment) => {
						return total + SafeMath.max(0, 
							SafeMath.subtract(
								SafeMath.add(repayment.principalAmount, repayment.interestAmount),
								repayment.principalPaid
							)
						);
					}, 0);

					const totalLateFees = loan.repayments.reduce((total, repayment) => {
						return total + SafeMath.max(0, 
							SafeMath.subtract(repayment.lateFeeAmount, repayment.lateFeesPaid)
						);
					}, 0);

					// Only default if there are still outstanding amounts
					if (outstandingAmount > 0 || totalLateFees > 0) {
						await DefaultProcessor.defaultLoan(
							loan.id,
							outstandingAmount,
							totalLateFees,
							{
								userId: loan.user.id,
								userFullName: loan.user.fullName || 'Customer',
								userPhoneNumber: loan.user.phoneNumber,
								productName: loan.application.product.name,
							},
							settings
						);

						processed++;
						
						// WhatsApp notifications are sent later at 10 AM, not during processing
					}
				}
			} catch (error) {
				logger.error(`Error processing default transition for loan ${loan.id}:`, error);
			}
		}

		return { processed, whatsappSent };
	}

	/**
	 * Process loans that should be recovered from default
	 */
	private static async processDefaultRecovery(): Promise<{
		processed: number;
	}> {
		// Get loans that are currently defaulted
		const defaultedLoans = await prisma.loan.findMany({
			where: {
				status: 'DEFAULT',
				defaultedAt: { not: null },
			},
			include: {
				repayments: {
					where: {
						status: { in: ['PENDING', 'PARTIAL'] }
					}
				}
			}
		});

		let processed = 0;

		for (const loan of defaultedLoans) {
			try {
				// Calculate current outstanding amounts
				const outstandingAmount = loan.repayments.reduce((total, repayment) => {
					return total + SafeMath.max(0, 
						SafeMath.subtract(
							SafeMath.add(repayment.principalAmount, repayment.interestAmount),
							repayment.principalPaid
						)
					);
				}, 0);

				const totalLateFees = loan.repayments.reduce((total, repayment) => {
					return total + SafeMath.max(0, 
						SafeMath.subtract(repayment.lateFeeAmount, repayment.lateFeesPaid)
					);
				}, 0);

				// If all amounts are cleared, recover the loan
				if (outstandingAmount <= 0 && totalLateFees <= 0) {
					await DefaultProcessor.recoverLoanFromDefault(loan.id);
					processed++;
				}
			} catch (error) {
				logger.error(`Error processing default recovery for loan ${loan.id}:`, error);
			}
		}

		return { processed };
	}

	/**
	 * Flag a loan as default risk and send notifications
	 */
	private static async flagLoanAsDefaultRisk(
		loanId: string,
		daysOverdue: number,
		outstandingAmount: number,
		totalLateFees: number,
		userInfo: any,
		settings: any
	): Promise<void> {
		const now = new Date();

		await prisma.$transaction(async (tx) => {
			// Update loan status
			await tx.loan.update({
				where: { id: loanId },
				data: {
					defaultRiskFlaggedAt: now,
					defaultNoticesSent: 0, // Reset counter
					updatedAt: now,
				}
			});

			// PDF letter generation removed - only manual generation via admin interface
			const pdfPath = null;

			// WhatsApp notification will be sent later at 10 AM by the payment notification cron
			// This ensures notifications are sent at a user-friendly time
			let whatsappMessageId = null;

			// Log the event
			await tx.loanDefaultLog.create({
				data: {
					loanId,
					eventType: 'RISK_FLAGGED',
					daysOverdue,
					outstandingAmount,
					totalLateFees,
					noticeType: 'INITIAL_WARNING',
					whatsappMessageId,
					pdfLetterPath: pdfPath,
					processedAt: now,
					metadata: {
						userInfo,
						settings: {
							riskDays: settings.riskDays,
							remedyDays: settings.remedyDays,
						}
					}
				}
			});

			// Add audit trail entry
			const loan = await tx.loan.findUnique({
				where: { id: loanId },
				select: { applicationId: true }
			});

			if (loan?.applicationId) {
				await tx.loanApplicationHistory.create({
					data: {
						applicationId: loan.applicationId,
						previousStatus: null,
						newStatus: 'ACTIVE',
						changedBy: 'SYSTEM',
						changeReason: 'Loan flagged as default risk',
						notes: `Loan flagged as potential default after ${daysOverdue} days overdue. Outstanding: RM ${outstandingAmount.toFixed(2)}, Late fees: RM ${totalLateFees.toFixed(2)}. ${settings.remedyDays}-day remedy period started.`,
						metadata: {
							eventType: 'DEFAULT_RISK_FLAGGED',
							loanId,
							daysOverdue,
							outstandingAmount,
							totalLateFees,
							remedyDeadline: new Date(now.getTime() + (settings.remedyDays * 24 * 60 * 60 * 1000)).toISOString(),
							whatsappSent: !!whatsappMessageId,
							pdfGenerated: false,
							processedAt: now.toISOString(),
						}
					}
				});
			}
		});

		logger.info(`Flagged loan ${loanId} as default risk: ${daysOverdue} days overdue, RM ${outstandingAmount.toFixed(2)} outstanding`);
	}

	/**
	 * Send default risk WhatsApp notification
	 */
	private static async sendDefaultRiskNotification(
		phoneNumber: string,
		data: {
			userFullName: string;
			productName: string;
			daysOverdue: number;
			outstandingAmount: number;
			totalLateFees: number;
			remedyDays: number;
		}
	): Promise<string | null> {
		try {
			const { sendDefaultRiskMessage } = await import("./whatsappService");
			
			const messageId = await sendDefaultRiskMessage(phoneNumber, {
				borrowerName: data.userFullName,
				productName: data.productName,
				daysOverdue: data.daysOverdue,
				outstandingAmount: data.outstandingAmount + data.totalLateFees,
				remedyDays: data.remedyDays,
			});

			return messageId;
		} catch (error) {
			logger.error('Error sending default risk WhatsApp notification:', error);
			return null;
		}
	}

	/**
	 * Send default final WhatsApp notification
	 */
	private static async sendDefaultFinalNotification(
		phoneNumber: string,
		data: {
			userFullName: string;
			productName: string;
			outstandingAmount: number;
		}
	): Promise<string | null> {
		try {
			const { sendDefaultFinalMessage } = await import("./whatsappService");
			
			const messageId = await sendDefaultFinalMessage(phoneNumber, {
				borrowerName: data.userFullName,
				productName: data.productName,
				outstandingAmount: data.outstandingAmount,
			});

			return messageId;
		} catch (error) {
			logger.error('Error sending default final WhatsApp notification:', error);
			return null;
		}
	}

	/**
	 * Send default reminder WhatsApp notification
	 */
	private static async sendDefaultReminder(
		loanId: string,
		phoneNumber: string,
		data: {
			userFullName: string;
			productName: string;
			outstandingAmount: number;
			totalLateFees: number;
			daysRemaining: number;
			remedyDeadline: Date;
		}
	): Promise<void> {
		try {
			const { sendDefaultReminderMessage } = await import("./whatsappService");
			
			const messageId = await sendDefaultReminderMessage(phoneNumber, {
				borrowerName: data.userFullName,
				productName: data.productName,
				outstandingAmount: data.outstandingAmount + data.totalLateFees,
				daysRemaining: data.daysRemaining,
				remedyDeadline: data.remedyDeadline,
			});

			// Log the reminder
			await prisma.loanDefaultLog.create({
				data: {
					loanId,
					eventType: 'NOTICE_SENT',
					daysOverdue: 0, // Will be calculated from earliest due date
					outstandingAmount: data.outstandingAmount,
					totalLateFees: data.totalLateFees,
					noticeType: 'REMINDER',
					whatsappMessageId: messageId,
					processedAt: new Date(),
					metadata: {
						daysRemaining: data.daysRemaining,
						remedyDeadline: data.remedyDeadline.toISOString(),
					}
				}
			});

		} catch (error) {
			logger.error('Error sending default reminder WhatsApp notification:', error);
		}
	}

	/**
	 * Default a loan (move to DEFAULT status)
	 */
	private static async defaultLoan(
		loanId: string,
		outstandingAmount: number,
		totalLateFees: number,
		userInfo: any,
		settings: any
	): Promise<void> {
		const now = new Date();

		await prisma.$transaction(async (tx) => {
			// Update loan status to DEFAULT
			// For loans that are directly defaulted, also set defaultRiskFlaggedAt if not already set
			const currentLoan = await tx.loan.findUnique({
				where: { id: loanId },
				select: { defaultRiskFlaggedAt: true }
			});

			await tx.loan.update({
				where: { id: loanId },
				data: {
					status: 'DEFAULT',
					defaultRiskFlaggedAt: currentLoan?.defaultRiskFlaggedAt || now, // Set if not already set
					defaultedAt: now,
					updatedAt: now,
				}
			});

			// WhatsApp final notification will be sent later at 10 AM by the payment notification cron
			// This ensures notifications are sent at a user-friendly time
			let whatsappMessageId = null;

			// Log the event
			await tx.loanDefaultLog.create({
				data: {
					loanId,
					eventType: 'DEFAULTED',
					daysOverdue: settings.riskDays + settings.remedyDays, // Total days
					outstandingAmount,
					totalLateFees,
					noticeType: 'FINAL_NOTICE',
					whatsappMessageId,
					processedAt: now,
					metadata: {
						userInfo,
						finalAmountDue: outstandingAmount + totalLateFees,
					}
				}
			});

			// Add audit trail entry
			const loan = await tx.loan.findUnique({
				where: { id: loanId },
				select: { applicationId: true }
			});

			if (loan?.applicationId) {
				await tx.loanApplicationHistory.create({
					data: {
						applicationId: loan.applicationId,
						previousStatus: 'ACTIVE',
						newStatus: 'DEFAULT',
						changedBy: 'SYSTEM',
						changeReason: 'Loan defaulted after remedy period expired',
						notes: `Loan defaulted after ${settings.riskDays + settings.remedyDays} days total. Final outstanding: RM ${(outstandingAmount + totalLateFees).toFixed(2)}. Remedy period expired without payment.`,
						metadata: {
							eventType: 'LOAN_DEFAULTED',
							loanId,
							totalDaysOverdue: settings.riskDays + settings.remedyDays,
							finalOutstandingAmount: outstandingAmount,
							finalLateFees: totalLateFees,
							totalAmountDue: outstandingAmount + totalLateFees,
							whatsappSent: !!whatsappMessageId,
							processedAt: now.toISOString(),
						}
					}
				});
			}
		});

		logger.info(`Defaulted loan ${loanId}: RM ${(outstandingAmount + totalLateFees).toFixed(2)} total outstanding`);
	}

	/**
	 * Recover a loan from default status
	 */
	private static async recoverLoanFromDefault(loanId: string): Promise<void> {
		const now = new Date();

		await prisma.$transaction(async (tx) => {
			// Update loan status back to ACTIVE
			await tx.loan.update({
				where: { id: loanId },
				data: {
					status: 'ACTIVE',
					defaultRiskFlaggedAt: null, // Clear default tracking
					defaultNoticesSent: 0,
					defaultedAt: null,
					updatedAt: now,
				}
			});

			// Log the recovery
			await tx.loanDefaultLog.create({
				data: {
					loanId,
					eventType: 'RECOVERED',
					daysOverdue: 0,
					outstandingAmount: 0,
					totalLateFees: 0,
					processedAt: now,
					metadata: {
						recoveredAt: now.toISOString(),
						reason: 'All outstanding amounts cleared',
					}
				}
			});

			// Add audit trail entry
			const loan = await tx.loan.findUnique({
				where: { id: loanId },
				select: { applicationId: true }
			});

			if (loan?.applicationId) {
				await tx.loanApplicationHistory.create({
					data: {
						applicationId: loan.applicationId,
						previousStatus: 'DEFAULT',
						newStatus: 'ACTIVE',
						changedBy: 'SYSTEM',
						changeReason: 'Loan recovered from default',
						notes: `Loan recovered from default status. All outstanding amounts and late fees have been cleared.`,
						metadata: {
							eventType: 'LOAN_RECOVERED',
							loanId,
							recoveredAt: now.toISOString(),
							processedAt: now.toISOString(),
						}
					}
				});
			}
		});

		logger.info(`Recovered loan ${loanId} from default status`);
	}


	/**
	 * Get default processing status for admin dashboard
	 */
	static async getDefaultProcessingStatus() {
		const latestLogQuery = `
			SELECT * FROM loan_default_logs
			ORDER BY "processedAt" DESC
			LIMIT 1
		`;

		const todayStart = TimeUtils.malaysiaStartOfDay();

		const todayProcessedQuery = `
			SELECT COUNT(*) as count
			FROM loan_default_logs
			WHERE "processedAt" >= $1 AND "eventType" IN ('RISK_FLAGGED', 'DEFAULTED', 'RECOVERED')
		`;

		const currentDefaultsQuery = `
			SELECT COUNT(*) as count
			FROM loans
			WHERE status = 'DEFAULT'
		`;

		const riskLoansQuery = `
			SELECT COUNT(*) as count
			FROM loans
			WHERE "defaultRiskFlaggedAt" IS NOT NULL AND "defaultedAt" IS NULL AND status = 'ACTIVE'
		`;

		const [latestLogResult, todayProcessedResult, currentDefaultsResult, riskLoansResult] = await Promise.all([
			prisma.$queryRawUnsafe(latestLogQuery) as Promise<any[]>,
			prisma.$queryRawUnsafe(todayProcessedQuery, todayStart) as Promise<any[]>,
			prisma.$queryRawUnsafe(currentDefaultsQuery) as Promise<any[]>,
			prisma.$queryRawUnsafe(riskLoansQuery) as Promise<any[]>,
		]);

		const latestLog = latestLogResult[0];
		const todayProcessed = Number(todayProcessedResult[0]?.count || 0);
		const currentDefaults = Number(currentDefaultsResult[0]?.count || 0);
		const riskLoans = Number(riskLoansResult[0]?.count || 0);

		return {
			lastProcessed: latestLog?.processedAt,
			lastEventType: latestLog?.eventType,
			processedToday: todayProcessed > 0,
			todayProcessingCount: todayProcessed,
			currentDefaults,
			riskLoans,
		};
	}

	/**
	 * Process default notifications only (no calculations)
	 * This runs at 10 AM to send notifications for loans that were flagged/defaulted at 1 AM
	 */
	static async processDefaultNotifications(): Promise<{
		riskNotificationsSent: number;
		reminderNotificationsSent: number;
		finalNotificationsSent: number;
		errors: number;
	}> {
		const result = {
			riskNotificationsSent: 0,
			reminderNotificationsSent: 0,
			finalNotificationsSent: 0,
			errors: 0
		};

		try {
			const settings = await getDefaultSettings();
			
			if (!settings.isEnabled) {
				logger.info("Default processing is disabled in system settings");
				return result;
			}

			const today = TimeUtils.malaysiaStartOfDay();
			const yesterday = new Date(today.getTime() - (24 * 60 * 60 * 1000));

			// Find loans that were flagged as default risk yesterday but haven't received notifications yet
			const riskFlaggedLoans = await prisma.loan.findMany({
				where: {
					defaultRiskFlaggedAt: {
						gte: yesterday,
						lt: today
					},
					// Check if risk notification was already sent
					defaultLogs: {
						none: {
							eventType: 'RISK_FLAGGED',
							whatsappMessageId: { not: null },
							processedAt: { gte: yesterday }
						}
					}
				},
				include: {
					user: {
						select: {
							fullName: true,
							phoneNumber: true
						}
					},
					application: {
						include: {
							product: {
								select: { name: true }
							}
						}
					},
					repayments: {
						where: {
							status: { in: ['PENDING', 'PARTIAL'] }
						}
					}
				}
			});

			// Send risk notifications
			for (const loan of riskFlaggedLoans) {
				if (settings.whatsappRisk && loan.user.phoneNumber) {
					try {
						const outstandingAmount = loan.repayments.reduce((total, repayment) => {
							return total + SafeMath.max(0, 
								SafeMath.subtract(
									SafeMath.add(repayment.principalAmount, repayment.interestAmount),
									repayment.principalPaid
								)
							);
						}, 0);

						const totalLateFees = loan.repayments.reduce((total, repayment) => {
							return total + SafeMath.max(0, 
								SafeMath.subtract(repayment.lateFeeAmount, repayment.lateFeesPaid)
							);
						}, 0);

						const whatsappMessageId = await DefaultProcessor.sendDefaultRiskNotification(
							loan.user.phoneNumber,
							{
								userFullName: loan.user.fullName || 'Unknown',
								productName: loan.application.product.name,
								daysOverdue: settings.riskDays,
								outstandingAmount,
								totalLateFees,
								remedyDays: settings.remedyDays,
							}
						);

						if (whatsappMessageId) {
							// Update the existing log with WhatsApp message ID
							await prisma.loanDefaultLog.updateMany({
								where: {
									loanId: loan.id,
									eventType: 'RISK_FLAGGED',
									processedAt: { gte: yesterday },
									whatsappMessageId: null
								},
								data: {
									whatsappMessageId
								}
							});

							result.riskNotificationsSent++;
						}
					} catch (error) {
						logger.error(`Error sending risk notification for loan ${loan.id}:`, error);
						result.errors++;
					}
				}
			}

			// Find loans that were defaulted yesterday but haven't received final notifications yet
			const defaultedLoans = await prisma.loan.findMany({
				where: {
					defaultedAt: {
						gte: yesterday,
						lt: today
					},
					// Check if final default notification was already sent
					defaultLogs: {
						none: {
							eventType: 'DEFAULTED',
							whatsappMessageId: { not: null },
							processedAt: { gte: yesterday }
						}
					}
				},
				include: {
					user: {
						select: {
							fullName: true,
							phoneNumber: true
						}
					},
					application: {
						include: {
							product: {
								select: { name: true }
							}
						}
					},
					repayments: {
						where: {
							status: { in: ['PENDING', 'PARTIAL'] }
						}
					}
				}
			});

			// Send final default notifications
			for (const loan of defaultedLoans) {
				if (settings.whatsappFinal && loan.user.phoneNumber) {
					try {
						const outstandingAmount = loan.repayments.reduce((total, repayment) => {
							return total + SafeMath.max(0, 
								SafeMath.subtract(
									SafeMath.add(repayment.principalAmount, repayment.interestAmount),
									repayment.principalPaid
								)
							);
						}, 0);

						const totalLateFees = loan.repayments.reduce((total, repayment) => {
							return total + SafeMath.max(0, 
								SafeMath.subtract(repayment.lateFeeAmount, repayment.lateFeesPaid)
							);
						}, 0);

						const whatsappMessageId = await DefaultProcessor.sendDefaultFinalNotification(
							loan.user.phoneNumber,
							{
								userFullName: loan.user.fullName || 'Unknown',
								productName: loan.application.product.name,
								outstandingAmount: outstandingAmount + totalLateFees,
							}
						);

						if (whatsappMessageId) {
							// Update the existing log with WhatsApp message ID
							await prisma.loanDefaultLog.updateMany({
								where: {
									loanId: loan.id,
									eventType: 'DEFAULTED',
									processedAt: { gte: yesterday },
									whatsappMessageId: null
								},
								data: {
									whatsappMessageId
								}
							});

							result.finalNotificationsSent++;
						}
					} catch (error) {
						logger.error(`Error sending final default notification for loan ${loan.id}:`, error);
						result.errors++;
					}
				}
			}

			logger.info(`Default notifications processed: ${result.riskNotificationsSent} risk notifications sent, ${result.finalNotificationsSent} final notifications sent`);

		} catch (error) {
			logger.error('Error in default notification processing:', error);
			result.errors++;
		}

		return result;
	}
}
