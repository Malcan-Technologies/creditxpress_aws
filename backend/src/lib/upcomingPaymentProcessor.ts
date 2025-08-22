import { PrismaClient } from '@prisma/client';
import whatsappService from './whatsappService';
import { TimeUtils } from './precisionUtils';

const prisma = new PrismaClient();

export interface UpcomingPaymentProcessorResult {
	totalChecked: number;
	notificationsSent: number;
	errors: number;
	details: Array<{
		userId: string;
		loanRepaymentId: string;
		loanId: string;
		daysUntilDue: number;
		status: 'sent' | 'skipped' | 'error';
		reason?: string;
	}>;
}

export interface LatePaymentProcessorResult {
	totalChecked: number;
	notificationsSent: number;
	errors: number;
	details: Array<{
		userId: string;
		loanRepaymentId: string;
		loanId: string;
		daysOverdue: number;
		status: 'sent' | 'skipped' | 'error';
		reason?: string;
	}>;
}

export interface PaymentNotificationProcessorResult {
	totalChecked: number;
	notificationsSent: number;
	errors: number;
	upcomingPayments: {
		checked: number;
		sent: number;
		errors: number;
	};
	latePayments: {
		checked: number;
		sent: number;
		errors: number;
	};
	details: Array<{
		userId: string;
		loanRepaymentId: string;
		loanId: string;
		daysUntilDue?: number;
		daysOverdue?: number;
		notificationType: 'upcoming' | 'late';
		status: 'sent' | 'skipped' | 'error';
		reason?: string;
	}>;
}

export class PaymentNotificationProcessor {
	/**
	 * Main method to process both upcoming and late payment notifications
	 */
	static async processAllPaymentNotifications(): Promise<PaymentNotificationProcessorResult> {
		console.log(`[${new Date().toISOString()}] Starting payment notification processing...`);

		const result: PaymentNotificationProcessorResult = {
			totalChecked: 0,
			notificationsSent: 0,
			errors: 0,
			upcomingPayments: {
				checked: 0,
				sent: 0,
				errors: 0
			},
			latePayments: {
				checked: 0,
				sent: 0,
				errors: 0
			},
			details: []
		};

		try {
			// Process upcoming payments
			const upcomingResult = await this.processUpcomingPayments();
			result.upcomingPayments = {
				checked: upcomingResult.totalChecked,
				sent: upcomingResult.notificationsSent,
				errors: upcomingResult.errors
			};
			result.totalChecked += upcomingResult.totalChecked;
			result.notificationsSent += upcomingResult.notificationsSent;
			result.errors += upcomingResult.errors;
			result.details.push(...upcomingResult.details.map(detail => ({
				...detail,
				notificationType: 'upcoming' as const
			})));

			// Process late payments
			const lateResult = await this.processLatePayments();
			result.latePayments = {
				checked: lateResult.totalChecked,
				sent: lateResult.notificationsSent,
				errors: lateResult.errors
			};
			result.totalChecked += lateResult.totalChecked;
			result.notificationsSent += lateResult.notificationsSent;
			result.errors += lateResult.errors;
			result.details.push(...lateResult.details.map(detail => ({
				...detail,
				notificationType: 'late' as const
			})));

			console.log(`[${new Date().toISOString()}] Payment notification processing completed:`, {
				totalChecked: result.totalChecked,
				notificationsSent: result.notificationsSent,
				errors: result.errors,
				upcomingPayments: result.upcomingPayments,
				latePayments: result.latePayments
			});

			return result;

		} catch (error) {
			console.error(`[${new Date().toISOString()}] Error in payment notification processing:`, error);
			result.errors++;
			throw error;
		}
	}

	/**
	 * Method to process upcoming payment notifications only
	 */
	static async processUpcomingPayments(): Promise<UpcomingPaymentProcessorResult> {
		console.log(`[${new Date().toISOString()}] Starting upcoming payment processing...`);

		const result: UpcomingPaymentProcessorResult = {
			totalChecked: 0,
			notificationsSent: 0,
			errors: 0,
			details: []
		};

		try {
			// Get reminder days setting
			const reminderDaysSetting = await prisma.systemSettings.findUnique({
				where: { key: 'UPCOMING_PAYMENT_REMINDER_DAYS' }
			});

			if (!reminderDaysSetting || !reminderDaysSetting.isActive) {
				console.log('Upcoming payment reminders are disabled or not configured');
				return result;
			}

			const reminderDays: number[] = JSON.parse(reminderDaysSetting.value);
			console.log(`Checking for payments due in: ${reminderDays.join(', ')} days`);

			// Process each reminder day
			for (const days of reminderDays) {
				// Calculate target date in Malaysia timezone, then convert to UTC for database query
				const now = new Date();
				const nowMalaysia = new Date(now.getTime() + (8 * 60 * 60 * 1000));
				const todayMalaysia = new Date(nowMalaysia);
				todayMalaysia.setUTCHours(0, 0, 0, 0);
				
				const targetMalaysia = new Date(todayMalaysia);
				targetMalaysia.setDate(targetMalaysia.getDate() + days);
				
				console.log(`Processing reminders for payments due ${days} days from now (Malaysia date: ${targetMalaysia.toISOString().split('T')[0]})`);

				const processed = await this.processPaymentsForDate(targetMalaysia, days);
				
				result.totalChecked += processed.totalChecked;
				result.notificationsSent += processed.notificationsSent;
				result.errors += processed.errors;
				result.details.push(...processed.details);
			}

			console.log(`[${new Date().toISOString()}] Upcoming payment processing completed:`, {
				totalChecked: result.totalChecked,
				notificationsSent: result.notificationsSent,
				errors: result.errors
			});

			return result;

		} catch (error) {
			console.error(`[${new Date().toISOString()}] Error in upcoming payment processing:`, error);
			result.errors++;
			throw error;
		}
	}

	/**
	 * Process payments for a specific due date (Malaysia timezone)
	 */
	private static async processPaymentsForDate(
		targetMalaysiaDate: Date,
		configuredDays: number
	): Promise<UpcomingPaymentProcessorResult> {
		const result: UpcomingPaymentProcessorResult = {
			totalChecked: 0,
			notificationsSent: 0,
			errors: 0,
			details: []
		};

		// Convert Malaysia date to UTC for database query
		// Search for the entire UTC day that corresponds to the target Malaysia date
		const targetMalaysiaDateOnly = targetMalaysiaDate.toISOString().split('T')[0]; // e.g., "2025-08-23"
		
		const startOfDayUTC = new Date(targetMalaysiaDateOnly + 'T00:00:00.000Z');
		const endOfDayUTC = new Date(targetMalaysiaDateOnly + 'T23:59:59.999Z');

		console.log(`Looking for payments due between ${startOfDayUTC.toISOString()} and ${endOfDayUTC.toISOString()} (UTC)`);

		// Find all loan repayments due on this specific date that have outstanding balance
		const loanRepayments = await prisma.loanRepayment.findMany({
			where: {
				dueDate: {
					gte: startOfDayUTC,
					lte: endOfDayUTC
				},
				status: {
					in: ['PENDING', 'PARTIAL'] // Include both unpaid and partially paid
				},
				// Ensure the loan is active
				loan: {
					status: {
						in: ['ACTIVE', 'DISBURSED']
					}
				}
			},
			include: {
				loan: {
					include: {
						user: {
							select: {
								id: true,
								fullName: true,
								phoneNumber: true,
								email: true
							}
						},
						application: {
							include: {
								product: {
									select: {
										name: true
									}
								}
							}
						}
					}
				}
			}
		});

		console.log(`Found ${loanRepayments.length} pending payments due on Malaysia date ${targetMalaysiaDate.toISOString().split('T')[0]}`);

		for (const repayment of loanRepayments) {
			result.totalChecked++;

			try {
				console.log(`Processing payment due ${repayment.dueDate.toISOString()} for ${configuredDays} days reminder (Status: ${repayment.status}, Scheduled: ${repayment.scheduledAmount || repayment.amount}, Actual: ${repayment.actualAmount || 0})`);

				// Check if we already sent a notification for this payment and day combination
				const existingNotification = await this.checkExistingNotification(
					repayment.id,
					configuredDays
				);

				if (existingNotification) {
					result.details.push({
						userId: repayment.loan.user.id,
						loanRepaymentId: repayment.id,
						loanId: repayment.loanId,
						daysUntilDue: configuredDays,
						status: 'skipped',
						reason: 'Notification already sent for this reminder period'
					});
					continue;
				}

				// Calculate outstanding amount (for partial payments)
				const outstandingAmount = (repayment.scheduledAmount || repayment.amount) - (repayment.actualAmount || 0);
				
				// Only send notification if there's an outstanding balance
				if (outstandingAmount <= 0) {
					console.log(`Skipping payment ${repayment.id} - fully paid (outstanding: ${outstandingAmount})`);
					continue;
				}

				// Send WhatsApp notification if user has phone number
				if (repayment.loan.user.phoneNumber && repayment.loan.user.fullName) {
					const dueDateFormatted = this.formatDate(repayment.dueDate);
					const paymentAmount = outstandingAmount.toFixed(2); // Use outstanding amount, not full amount

					const whatsappResult = await whatsappService.sendUpcomingPaymentNotification({
						to: repayment.loan.user.phoneNumber,
						fullName: repayment.loan.user.fullName,
						paymentAmount: paymentAmount,
						loanName: repayment.loan.application.product.name,
						daysUntilDue: configuredDays.toString(),
						dueDate: dueDateFormatted
					});

					if (whatsappResult.success) {
						// Record that we sent this notification
						await this.recordNotificationSent(repayment.id, configuredDays, whatsappResult.messageId);
						
						result.notificationsSent++;
						result.details.push({
							userId: repayment.loan.user.id,
							loanRepaymentId: repayment.id,
							loanId: repayment.loanId,
							daysUntilDue: configuredDays,
							status: 'sent'
						});

						console.log(`✅ Sent upcoming payment notification to ${repayment.loan.user.fullName} for outstanding amount RM ${outstandingAmount.toFixed(2)} due in ${configuredDays} days`);
					} else {
						result.errors++;
						result.details.push({
							userId: repayment.loan.user.id,
							loanRepaymentId: repayment.id,
							loanId: repayment.loanId,
							daysUntilDue: configuredDays,
							status: 'error',
							reason: whatsappResult.error
						});

						console.error(`❌ Failed to send upcoming payment notification: ${whatsappResult.error}`);
					}
				} else {
					result.details.push({
						userId: repayment.loan.user.id,
						loanRepaymentId: repayment.id,
						loanId: repayment.loanId,
						daysUntilDue: configuredDays,
						status: 'skipped',
						reason: 'User has no phone number or full name'
					});
				}

			} catch (error) {
				console.error(`Error processing loan repayment ${repayment.id}:`, error);
				result.errors++;
				result.details.push({
					userId: repayment.loan.user.id,
					loanRepaymentId: repayment.id,
					loanId: repayment.loanId,
					daysUntilDue: configuredDays,
					status: 'error',
					reason: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return result;
	}

	/**
	 * Check if we already sent a notification for this payment and reminder period
	 */
	private static async checkExistingNotification(
		loanRepaymentId: string,
		daysUntilDue: number
	): Promise<boolean> {
		// Create a unique key for this notification
		const notificationKey = `upcoming_payment_${loanRepaymentId}_${daysUntilDue}days`;
		
		// Check if we have a record of sending this notification today
		const today = TimeUtils.malaysiaStartOfDay();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		const existingRecord = await prisma.notificationLog.findFirst({
			where: {
				notificationKey,
				createdAt: {
					gte: today,
					lt: tomorrow
				}
			}
		});

		return !!existingRecord;
	}

	/**
	 * Record that we sent a notification
	 */
	private static async recordNotificationSent(
		loanRepaymentId: string,
		daysUntilDue: number,
		messageId?: string
	): Promise<void> {
		const notificationKey = `upcoming_payment_${loanRepaymentId}_${daysUntilDue}days`;

		await prisma.notificationLog.create({
			data: {
				notificationKey,
				messageId: messageId || '',
				status: 'SENT',
				notificationType: 'UPCOMING_PAYMENT',
				metadata: {
					loanRepaymentId,
					daysUntilDue,
					sentAt: new Date().toISOString()
				}
			}
		});
	}

	/**
	 * Method to process late payment notifications only
	 */
	static async processLatePayments(): Promise<LatePaymentProcessorResult> {
		console.log(`[${new Date().toISOString()}] Starting late payment processing...`);

		const result: LatePaymentProcessorResult = {
			totalChecked: 0,
			notificationsSent: 0,
			errors: 0,
			details: []
		};

		try {
			// Get late payment reminder days setting
			const reminderDaysSetting = await prisma.systemSettings.findUnique({
				where: { key: 'LATE_PAYMENT_REMINDER_DAYS' }
			});

			if (!reminderDaysSetting || !reminderDaysSetting.isActive) {
				console.log('Late payment reminders are disabled or not configured');
				return result;
			}

			const reminderDays: number[] = JSON.parse(reminderDaysSetting.value);
			console.log(`Checking for payments overdue by: ${reminderDays.join(', ')} days`);

			// Process each reminder day
			for (const days of reminderDays) {
				// Calculate past date in Malaysia timezone, then convert to UTC for database query
				const now = new Date();
				const nowMalaysia = new Date(now.getTime() + (8 * 60 * 60 * 1000));
				const todayMalaysia = new Date(nowMalaysia);
				todayMalaysia.setUTCHours(0, 0, 0, 0);
				
				const targetMalaysia = new Date(todayMalaysia);
				targetMalaysia.setDate(targetMalaysia.getDate() - days); // Subtract days for overdue
				
				console.log(`Processing late payment reminders for payments due ${days} days ago (Malaysia date: ${targetMalaysia.toISOString().split('T')[0]})`);

				const processed = await this.processLatePaymentsForDate(targetMalaysia, days);
				
				result.totalChecked += processed.totalChecked;
				result.notificationsSent += processed.notificationsSent;
				result.errors += processed.errors;
				result.details.push(...processed.details);
			}

			console.log(`[${new Date().toISOString()}] Late payment processing completed:`, {
				totalChecked: result.totalChecked,
				notificationsSent: result.notificationsSent,
				errors: result.errors
			});

			return result;

		} catch (error) {
			console.error(`[${new Date().toISOString()}] Error in late payment processing:`, error);
			result.errors++;
			throw error;
		}
	}

	/**
	 * Process late payments for a specific overdue date (Malaysia timezone)
	 */
	private static async processLatePaymentsForDate(
		targetMalaysiaDate: Date,
		configuredDays: number
	): Promise<LatePaymentProcessorResult> {
		const result: LatePaymentProcessorResult = {
			totalChecked: 0,
			notificationsSent: 0,
			errors: 0,
			details: []
		};

		// Convert Malaysia date to UTC for database query
		const targetMalaysiaDateOnly = targetMalaysiaDate.toISOString().split('T')[0]; // e.g., "2025-08-19"
		
		const startOfDayUTC = new Date(targetMalaysiaDateOnly + 'T00:00:00.000Z');
		const endOfDayUTC = new Date(targetMalaysiaDateOnly + 'T23:59:59.999Z');

		console.log(`Looking for late payments due between ${startOfDayUTC.toISOString()} and ${endOfDayUTC.toISOString()} (UTC)`);

		// Find all loan repayments due on this past date that still have outstanding balance
		const loanRepayments = await prisma.loanRepayment.findMany({
			where: {
				dueDate: {
					gte: startOfDayUTC,
					lte: endOfDayUTC
				},
				status: {
					in: ['PENDING', 'PARTIAL'] // Include both unpaid and partially paid
				},
				// Ensure the loan is active
				loan: {
					status: {
						in: ['ACTIVE', 'DISBURSED']
					}
				}
			},
			include: {
				loan: {
					include: {
						user: {
							select: {
								id: true,
								fullName: true,
								phoneNumber: true,
								email: true
							}
						},
						application: {
							include: {
								product: {
									select: {
										name: true
									}
								}
							}
						}
					}
				}
			}
		});

		console.log(`Found ${loanRepayments.length} overdue payments due on Malaysia date ${targetMalaysiaDate.toISOString().split('T')[0]}`);

		for (const repayment of loanRepayments) {
			result.totalChecked++;

			try {
				console.log(`Processing late payment due ${repayment.dueDate.toISOString()} for ${configuredDays} days overdue reminder (Status: ${repayment.status}, Scheduled: ${repayment.scheduledAmount || repayment.amount}, Actual: ${repayment.actualAmount || 0}, Late Fee: ${repayment.lateFeeAmount || 0}, Late Fee Paid: ${repayment.lateFeesPaid || 0})`);

				// Check if we already sent a notification for this payment and day combination
				const existingNotification = await this.checkExistingLateNotification(
					repayment.id,
					configuredDays
				);

				if (existingNotification) {
					result.details.push({
						userId: repayment.loan.user.id,
						loanRepaymentId: repayment.id,
						loanId: repayment.loanId,
						daysOverdue: configuredDays,
						status: 'skipped',
						reason: 'Late notification already sent for this reminder period'
					});
					continue;
				}

				// Calculate outstanding amount: scheduledAmount + lateFeeAmount - lateFeesPaid - actualAmount
				const scheduledAmount = repayment.scheduledAmount || repayment.amount;
				const lateFeeAmount = repayment.lateFeeAmount || 0;
				const lateFeesPaid = repayment.lateFeesPaid || 0;
				const actualAmount = repayment.actualAmount || 0;
				
				const outstandingAmount = scheduledAmount + lateFeeAmount - lateFeesPaid - actualAmount;
				
				// Only send notification if there's an outstanding balance
				if (outstandingAmount <= 0) {
					console.log(`Skipping late payment ${repayment.id} - fully paid (outstanding: ${outstandingAmount})`);
					continue;
				}

				// Send WhatsApp notification if user has phone number
				if (repayment.loan.user.phoneNumber && repayment.loan.user.fullName) {
					const paymentAmount = outstandingAmount.toFixed(2);

					const whatsappResult = await whatsappService.sendLatePaymentNotification({
						to: repayment.loan.user.phoneNumber,
						fullName: repayment.loan.user.fullName,
						paymentAmount: paymentAmount,
						loanName: repayment.loan.application.product.name
					});

					if (whatsappResult.success) {
						// Record that we sent this notification
						await this.recordLateNotificationSent(repayment.id, configuredDays, whatsappResult.messageId);
						
						result.notificationsSent++;
						result.details.push({
							userId: repayment.loan.user.id,
							loanRepaymentId: repayment.id,
							loanId: repayment.loanId,
							daysOverdue: configuredDays,
							status: 'sent'
						});

						console.log(`✅ Sent late payment notification to ${repayment.loan.user.fullName} for outstanding amount RM ${outstandingAmount.toFixed(2)} overdue by ${configuredDays} days`);
					} else {
						result.errors++;
						result.details.push({
							userId: repayment.loan.user.id,
							loanRepaymentId: repayment.id,
							loanId: repayment.loanId,
							daysOverdue: configuredDays,
							status: 'error',
							reason: whatsappResult.error
						});

						console.error(`❌ Failed to send late payment notification: ${whatsappResult.error}`);
					}
				} else {
					result.details.push({
						userId: repayment.loan.user.id,
						loanRepaymentId: repayment.id,
						loanId: repayment.loanId,
						daysOverdue: configuredDays,
						status: 'skipped',
						reason: 'User has no phone number or full name'
					});
				}

			} catch (error) {
				console.error(`Error processing late loan repayment ${repayment.id}:`, error);
				result.errors++;
				result.details.push({
					userId: repayment.loan.user.id,
					loanRepaymentId: repayment.id,
					loanId: repayment.loanId,
					daysOverdue: configuredDays,
					status: 'error',
					reason: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return result;
	}

	/**
	 * Check if we already sent a late notification for this payment and reminder period
	 */
	private static async checkExistingLateNotification(
		loanRepaymentId: string,
		daysOverdue: number
	): Promise<boolean> {
		// Create a unique key for this notification
		const notificationKey = `late_payment_${loanRepaymentId}_${daysOverdue}days`;
		
		// Check if we have a record of sending this notification today
		const today = TimeUtils.malaysiaStartOfDay();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		const existingRecord = await prisma.notificationLog.findFirst({
			where: {
				notificationKey,
				createdAt: {
					gte: today,
					lt: tomorrow
				}
			}
		});

		return !!existingRecord;
	}

	/**
	 * Record that we sent a late payment notification
	 */
	private static async recordLateNotificationSent(
		loanRepaymentId: string,
		daysOverdue: number,
		messageId?: string
	): Promise<void> {
		const notificationKey = `late_payment_${loanRepaymentId}_${daysOverdue}days`;

		await prisma.notificationLog.create({
			data: {
				notificationKey,
				messageId: messageId || '',
				status: 'SENT',
				notificationType: 'LATE_PAYMENT',
				metadata: {
					loanRepaymentId,
					daysOverdue,
					sentAt: new Date().toISOString()
				}
			}
		});
	}

	/**
	 * Format date for display (DD/MM/YYYY)
	 */
	private static formatDate(date: Date): string {
		// Convert to Malaysia timezone for display
		const malaysiaDate = new Date(date.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
		const day = malaysiaDate.getUTCDate().toString().padStart(2, '0');
		const month = (malaysiaDate.getUTCMonth() + 1).toString().padStart(2, '0');
		const year = malaysiaDate.getUTCFullYear();
		
		return `${day}/${month}/${year}`;
	}
}
