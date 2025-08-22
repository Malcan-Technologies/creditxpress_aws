import cron from "node-cron";
import { LateFeeProcessor } from "./lateFeeProcessor";
import { PaymentNotificationProcessor, UpcomingPaymentProcessor } from "./upcomingPaymentProcessor";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CronScheduler {
	private static instance: CronScheduler;
	private jobs: Map<string, cron.ScheduledTask> = new Map();

	private constructor() {}

	static getInstance(): CronScheduler {
		if (!CronScheduler.instance) {
			CronScheduler.instance = new CronScheduler();
		}
		return CronScheduler.instance;
	}

	/**
	 * Start all scheduled jobs
	 */
	async start(): Promise<void> {
		console.log(`[${new Date().toISOString()}] Starting cron scheduler...`);

		// Schedule late fee processing at 1:00 AM daily
		this.scheduleLateFeeProcessing();

		// Schedule payment notifications (both upcoming and late)
		await this.schedulePaymentNotifications();

		console.log(
			`[${new Date().toISOString()}] Cron scheduler started with ${
				this.jobs.size
			} jobs`
		);
	}

	/**
	 * Stop all scheduled jobs
	 */
	stop(): void {
		console.log(`[${new Date().toISOString()}] Stopping cron scheduler...`);

		this.jobs.forEach((job, name) => {
			job.stop();
			console.log(`[${new Date().toISOString()}] Stopped job: ${name}`);
		});

		this.jobs.clear();
		console.log(`[${new Date().toISOString()}] Cron scheduler stopped`);
	}

	/**
	 * Schedule late fee processing job
	 */
	private scheduleLateFeeProcessing(): void {
		const jobName = "late-fee-processing";

		// Schedule for 1:00 AM UTC+8 daily (17:00 UTC = 1:00 AM UTC+8)
		const job = cron.schedule(
			"0 17 * * *",
			async () => {
				console.log(
					`[${new Date().toISOString()}] Starting scheduled late fee processing...`
				);

				try {
					const result = await LateFeeProcessor.processLateFees();
					console.log(
						`[${new Date().toISOString()}] Late fee processing completed successfully:`,
						result
					);
				} catch (error) {
					console.error(
						`[${new Date().toISOString()}] Error in late fee processing:`,
						error
					);
				}
			},
			{
				scheduled: false, // Don't start immediately
				timezone: "UTC", // Use UTC timezone for consistency
			}
		);

		this.jobs.set(jobName, job);
		job.start();

		console.log(
			`[${new Date().toISOString()}] Scheduled job: ${jobName} (daily at 1:00 AM UTC+8 / 17:00 UTC)`
		);
	}

	/**
	 * Get status of all jobs
	 */
	getStatus(): { name: string; running: boolean }[] {
		const status: { name: string; running: boolean }[] = [];

		this.jobs.forEach((_job, name) => {
			status.push({
				name,
				running: true, // Job is running if it exists in the map
			});
		});

		return status;
	}

	/**
	 * Schedule upcoming payment notifications job
	 */
	private async schedulePaymentNotifications(): Promise<void> {
		const jobName = "payment-notifications";

		try {
			// Get the configured time from settings (default 10:00 AM UTC+8)
			const timeSetting = await prisma.systemSettings.findUnique({
				where: { key: 'UPCOMING_PAYMENT_CHECK_TIME' }
			});

			// Parse the time setting (format: "HH:MM" in UTC+8)
			let timeUTC8 = "10:00"; // Default
			if (timeSetting && timeSetting.value) {
				timeUTC8 = JSON.parse(timeSetting.value);
			}

			const [hours, minutes] = timeUTC8.split(':').map(Number);
			
			// Convert UTC+8 time to UTC (subtract 8 hours)
			let utcHours = hours - 8;
			if (utcHours < 0) {
				utcHours += 24;
			}

			// Create cron expression: "minute hour * * *"
			const cronExpression = `${minutes} ${utcHours} * * *`;

			const job = cron.schedule(
				cronExpression,
				async () => {
					console.log(
						`[${new Date().toISOString()}] Starting scheduled payment notification processing...`
					);

					try {
						const result = await PaymentNotificationProcessor.processAllPaymentNotifications();
						console.log(
							`[${new Date().toISOString()}] Payment notification processing completed successfully:`,
							result
						);
					} catch (error) {
						console.error(
							`[${new Date().toISOString()}] Error in payment notification processing:`,
							error
						);
					}
				},
				{
					scheduled: false, // Don't start immediately
					timezone: "UTC", // Use UTC timezone for consistency
				}
			);

			this.jobs.set(jobName, job);
			job.start();

			console.log(
				`[${new Date().toISOString()}] Scheduled job: ${jobName} (daily at ${timeUTC8} UTC+8 / ${utcHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} UTC)`
			);

		} catch (error) {
			console.error(
				`[${new Date().toISOString()}] Error scheduling payment notifications:`,
				error
			);
		}
	}

	/**
	 * Manually trigger late fee processing (for testing)
	 */
	async triggerLateFeeProcessing(): Promise<void> {
		console.log(
			`[${new Date().toISOString()}] Manually triggering late fee processing...`
		);

		try {
			const result = await LateFeeProcessor.processLateFees();
			console.log(
				`[${new Date().toISOString()}] Manual late fee processing completed successfully:`,
				result
			);
		} catch (error) {
			console.error(
				`[${new Date().toISOString()}] Error in manual late fee processing:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Manually trigger payment notification processing (both upcoming and late)
	 */
	async triggerPaymentNotifications(): Promise<any> {
		console.log(
			`[${new Date().toISOString()}] Manually triggering payment notification processing...`
		);

		try {
			const result = await PaymentNotificationProcessor.processAllPaymentNotifications();
			console.log(
				`[${new Date().toISOString()}] Manual payment notification processing completed successfully:`,
				result
			);
			return result;
		} catch (error) {
			console.error(
				`[${new Date().toISOString()}] Error in manual payment notification processing:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Manually trigger upcoming payment notification processing only (for backwards compatibility)
	 */
	async triggerUpcomingPaymentNotifications(): Promise<any> {
		console.log(
			`[${new Date().toISOString()}] Manually triggering upcoming payment notification processing...`
		);

		try {
			const result = await UpcomingPaymentProcessor.processUpcomingPayments();
			console.log(
				`[${new Date().toISOString()}] Manual upcoming payment notification processing completed successfully:`,
				result
			);
			return result;
		} catch (error) {
			console.error(
				`[${new Date().toISOString()}] Error in manual upcoming payment notification processing:`,
				error
			);
			throw error;
		}
	}
}
