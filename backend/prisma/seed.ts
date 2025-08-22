import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
	// Check if users table is empty
	const userCount = await prisma.user.count();
	if (userCount === 0) {
		console.log("Creating admin user...");
		// Create admin user
		const hashedPassword = await bcrypt.hash("admin123", 10);
		await prisma.user.create({
			data: {
				phoneNumber: "+60182440976", // Example admin phone
				password: hashedPassword,
				fullName: "System Administrator",
				email: "admin@kredit.my",
				role: "ADMIN",
				isOnboardingComplete: true,
				kycStatus: true,
			},
		});
		console.log("Admin user created successfully");
	} else {
		console.log("Users table is not empty, skipping admin user creation");
	}

	// Check if products table is empty
	const productCount = await prisma.product.count();
	if (productCount === 0) {
		console.log("Creating products...");
		// Create products
		await prisma.product.createMany({
			data: [
				{
					code: "payadvance",
					name: "PayAdvance™",
					description:
						"Get up to 50% of your monthly salary in advance. Quick approval, no collateral needed.",
					minAmount: 1000,
					maxAmount: 20000,
					repaymentTerms: [6, 12], // 1 month
					interestRate: 1.5, // 2% per month
					eligibility: [
						"Malaysian citizen aged 21-60",
						"Minimum monthly income of RM2,000",
						"Employed for at least 3 months",
						"No active bankruptcy status",
					],
					lateFeeRate: 0.022, // 0.022% per day interest
					lateFeeFixedAmount: 0, // No fixed fee
					lateFeeFrequencyDays: 7, // every 7 days
					originationFee: 3, // 2% origination fee
					legalFee: 2, // No legal fee
					applicationFee: 50, // No application fee
					requiredDocuments: [
						"Valid Malaysian ID",
						"Latest 3 months payslip",
						"Latest 3 months bank statement",
						"Employment letter",
					],
					features: [
						"Get up to 50% of your salary",
						"Quick 24-hour approval",
						"No collateral required",
						"Flexible repayment options",
						"Competitive interest rates",
					],
					loanTypes: [], // Salary advance doesn't need loan types
					isActive: true,
				},
				{
					code: "equipment",
					name: "Equipment Financing™",
					description:
						"Finance your business equipment with flexible terms. Fast approval with minimal documentation.",
					minAmount: 50000,
					maxAmount: 300000,
					repaymentTerms: [6, 12, 24], // 6, 12, or 24 months
					interestRate: 1.5, // 0.8% per month
					eligibility: [
						"Registered business in Malaysia",
						"Minimum 1 year in operation",
						"Minimum monthly revenue of RM10,000",
						"No active bankruptcy status",
					],
					lateFeeRate: 0.022, // 0.022% per day interest
					lateFeeFixedAmount: 0, // No fixed fee
					lateFeeFrequencyDays: 7, // every 7 days
					originationFee: 3, // 3% origination fee
					legalFee: 2, // RM500 legal fee
					applicationFee: 50, // RM100 application fee
					requiredDocuments: [
						"Business registration (SSM)",
						"Latest 6 months bank statement",
						"Equipment quotation",
						"Directors' IDs",
					],
					features: [
						"Finance up to RM50,000",
						"Flexible repayment terms",
						"Quick approval process",
						"Competitive rates",
						"No early settlement fees",
					],
					loanTypes: [
						"Manufacturing Equipment",
						"Office Equipment",
						"Construction Equipment",
						"Medical Equipment",
						"IT Equipment",
						"Commercial Vehicle",
						"Industrial Machinery",
					],
					isActive: true,
				},
				{
					code: "sme",
					name: "SME Growth™",
					description:
						"Working capital financing for SMEs. Grow your business with flexible funding solutions.",
					minAmount: 50000,
					maxAmount: 500000,
					repaymentTerms: [12, 24, 36], // 12, 24, or 36 months
					interestRate: 1.5, // 0.7% per month
					eligibility: [
						"Registered business in Malaysia",
						"Minimum 2 years in operation",
						"Minimum annual revenue of RM300,000",
						"No active bankruptcy status",
					],
					lateFeeRate: 0.022, // 0.022% per day interest
					lateFeeFixedAmount: 0, // No fixed fee
					lateFeeFrequencyDays: 7, // every 7 days
					originationFee: 2, // 2.5% origination fee
					legalFee: 3, // RM1000 legal fee
					applicationFee: 50, // RM200 application fee
					requiredDocuments: [
						"Business registration (SSM)",
						"Latest 2 years financial statements",
						"Latest 6 months bank statements",
						"Tax returns",
						"Directors' IDs",
					],
					features: [
						"Finance up to RM200,000",
						"Flexible repayment terms",
						"Competitive interest rates",
						"Quick approval process",
						"Dedicated account manager",
					],
					loanTypes: [
						"Working Capital",
						"Business Expansion",
						"Inventory Purchase",
						"Renovation",
						"Marketing & Advertising",
						"Franchise Acquisition",
						"Debt Consolidation",
					],
					isActive: true,
				},
			],
		});
		console.log("Products created successfully");
	} else {
		console.log("Products table is not empty, skipping product creation");
	}

	// Check if system settings table is empty
	const settingsCount = await prisma.systemSettings.count();
	
	// First, handle non-notification settings
	if (settingsCount === 0) {
		console.log("Creating default system settings...");
		
		// Default system settings (non-notification)
		await prisma.systemSettings.createMany({
			data: [
				{
					key: "LOAN_CALCULATION_METHOD",
					category: "LOAN_CALCULATION",
					name: "Interest & Principal Allocation Method",
					description: "How interest and principal amounts are allocated across payment installments",
					dataType: "ENUM",
					value: JSON.stringify("STRAIGHT_LINE"),
					options: {
						STRAIGHT_LINE: {
							label: "Straight Line Method",
							description: "Equal principal and interest amounts for all scheduled payments (recommended)"
						},
						RULE_OF_78: {
							label: "Rule of 78",
							description: "Front-loaded interest allocation - more interest in early payments, less in later payments"
						}
					},
					isActive: true,
					requiresRestart: false,
					affectsExistingLoans: false,
				},
				{
					key: "PAYMENT_SCHEDULE_TYPE",
					category: "PAYMENT_SCHEDULE",
					name: "Payment Due Date Schedule",
					description: "How payment due dates are determined for loan installments",
					dataType: "ENUM",
					value: JSON.stringify("CUSTOM_DATE"),
					options: {
						CUSTOM_DATE: {
							label: "Custom Date of Month",
							description: "All payments due on a specific date each month (e.g., 1st, 15th) with configurable cutoff for pro-rating"
						},
						EXACT_MONTHLY: {
							label: "Same Day Each Month",
							description: "Payments due on the same day of each month as disbursement (e.g., disbursed 18th → due 18th each month)"
						}
					},
					isActive: true,
					requiresRestart: false,
					affectsExistingLoans: false,
				},
				{
					key: "CUSTOM_DUE_DATE",
					category: "PAYMENT_SCHEDULE",
					name: "Custom Due Date",
					description: "Which day of the month payments are due (1-31)",
					dataType: "NUMBER",
					value: JSON.stringify(1),
					options: {
						min: 1,
						max: 31,
						step: 1,
						unit: "day of month"
					},
					isActive: true,
					requiresRestart: false,
					affectsExistingLoans: false,
				},
				{
					key: "PRORATION_CUTOFF_DATE",
					category: "PAYMENT_SCHEDULE",
					name: "Pro-ration Cutoff Date",
					description: "Disbursements on or after this date get pushed to next month's cycle (1-31)",
					dataType: "NUMBER",
					value: JSON.stringify(20),
					options: {
						min: 1,
						max: 31,
						step: 1,
						unit: "day of month"
					},
					isActive: true,
					requiresRestart: false,
					affectsExistingLoans: false,
				},
				{
					key: "ENABLE_LATE_FEE_GRACE_PERIOD",
					category: "LATE_FEES",
					name: "Late Fee Grace Period",
					description: "Enable grace period before late fees are applied",
					dataType: "BOOLEAN",
					value: JSON.stringify(true),
					options: undefined,
					isActive: true,
					requiresRestart: false,
					affectsExistingLoans: false,
				},
				{
					key: "LATE_FEE_GRACE_DAYS",
					category: "LATE_FEES",
					name: "Late Fee Grace Days",
					description: "Number of days grace period before late fees are applied",
					dataType: "NUMBER",
					value: JSON.stringify(3),
					options: {
						min: 0,
						max: 30,
						step: 1,
						unit: "days"
					},
					isActive: true,
					requiresRestart: false,
					affectsExistingLoans: false,
				},
				{
					key: "MINIMUM_LOAN_AMOUNT",
					category: "LOAN_LIMITS",
					name: "Minimum Loan Amount",
					description: "Global minimum loan amount across all products",
					dataType: "NUMBER",
					value: JSON.stringify(500),
					options: {
						min: 100,
						max: 10000,
						step: 100,
						unit: "RM"
					},
					isActive: true,
					requiresRestart: false,
					affectsExistingLoans: false,
				},
				{
					key: "MAXIMUM_ACTIVE_LOANS_PER_USER",
					category: "LOAN_LIMITS",
					name: "Maximum Active Loans Per User",
					description: "Maximum number of active loans a user can have simultaneously",
					dataType: "NUMBER",
					value: JSON.stringify(3),
					options: {
						min: 1,
						max: 10,
						step: 1,
						unit: "loans"
					},
					isActive: true,
					requiresRestart: false,
					affectsExistingLoans: false,
				}
			],
		});
		
		console.log("Default system settings created successfully");
	} else {
		console.log("System settings table is not empty, skipping default settings creation");
	}

	// Always create/update notification settings (even if system settings table is not empty)
	console.log("Creating/updating notification settings...");
	
	const notificationSettings = [
		{
			key: "ENABLE_WHATSAPP_NOTIFICATIONS",
			category: "NOTIFICATIONS",
			name: "WhatsApp Notifications",
			description: "Enable automatic WhatsApp notifications for loan events",
			dataType: "BOOLEAN",
			value: JSON.stringify(true),
			options: undefined,
			isActive: true,
			requiresRestart: false,
			affectsExistingLoans: false,
		},
		{
			key: "WHATSAPP_OTP_VERIFICATION",
			category: "NOTIFICATIONS",
			name: "WhatsApp OTP Verification",
			description: "OTP verification codes sent via WhatsApp during login and signup (Always enabled for security)",
			dataType: "BOOLEAN",
			value: JSON.stringify(true),
			options: undefined,
			isActive: false, // Make it non-editable (mandatory)
			requiresRestart: false,
			affectsExistingLoans: false,
		},
		{
			key: "WHATSAPP_LOAN_APPROVAL",
			category: "NOTIFICATIONS",
			name: "WhatsApp Loan Approval",
			description: "Send WhatsApp notifications when loans are approved",
			dataType: "BOOLEAN",
			value: JSON.stringify(true),
			options: undefined,
			isActive: true,
			requiresRestart: false,
			affectsExistingLoans: false,
		},
		{
			key: "WHATSAPP_LOAN_REJECTION",
			category: "NOTIFICATIONS",
			name: "WhatsApp Loan Rejection",
			description: "Send WhatsApp notifications when loans are rejected",
			dataType: "BOOLEAN",
			value: JSON.stringify(true),
			options: undefined,
			isActive: true,
			requiresRestart: false,
			affectsExistingLoans: false,
		},
		{
			key: "WHATSAPP_LOAN_DISBURSEMENT",
			category: "NOTIFICATIONS",
			name: "WhatsApp Loan Disbursement",
			description: "Send WhatsApp notifications when loans are disbursed to users",
			dataType: "BOOLEAN",
			value: JSON.stringify(true),
			options: undefined,
			isActive: true,
			requiresRestart: false,
			affectsExistingLoans: false,
		},
		{
			key: "WHATSAPP_PAYMENT_APPROVED",
			category: "NOTIFICATIONS",
			name: "WhatsApp Payment Approved",
			description: "Send WhatsApp notifications when payments are approved and processed",
			dataType: "BOOLEAN",
			value: JSON.stringify(true),
			options: undefined,
			isActive: true,
			requiresRestart: false,
			affectsExistingLoans: false,
		},
		{
			key: "WHATSAPP_LOAN_REVISED_OFFER",
			category: "NOTIFICATIONS",
			name: "WhatsApp Revised Loan Offer",
			description: "Send WhatsApp notifications when admins provide revised loan offers to users",
			dataType: "BOOLEAN",
			value: JSON.stringify(true),
			options: undefined,
			isActive: true,
			requiresRestart: false,
			affectsExistingLoans: false,
		},
		{
			key: "WHATSAPP_PAYMENT_FAILED",
			category: "NOTIFICATIONS",
			name: "WhatsApp Payment Failed",
			description: "Send WhatsApp notifications when payment attempts fail or are unsuccessful",
			dataType: "BOOLEAN",
			value: JSON.stringify(true),
			options: undefined,
			isActive: true,
			requiresRestart: false,
			affectsExistingLoans: false,
		},
		{
			key: "WHATSAPP_LOAN_DISCHARGED",
			category: "NOTIFICATIONS",
			name: "WhatsApp Loan Discharged",
			description: "Send WhatsApp notifications when loans are fully discharged and completed",
			dataType: "BOOLEAN",
			value: JSON.stringify(true),
			options: undefined,
			isActive: true,
			requiresRestart: false,
			affectsExistingLoans: false,
		},
		{
			key: "WHATSAPP_UPCOMING_PAYMENT",
			category: "NOTIFICATIONS",
			name: "WhatsApp Upcoming Payment Reminders",
			description: "Send WhatsApp notifications to remind users about upcoming payment due dates",
			dataType: "BOOLEAN",
			value: JSON.stringify(true),
			options: undefined,
			isActive: true,
			requiresRestart: false,
			affectsExistingLoans: false,
		},
		{
			key: "UPCOMING_PAYMENT_REMINDER_DAYS",
			category: "NOTIFICATIONS",
			name: "Payment Reminder Days",
			description: "Days before payment due date to send reminders (e.g., [7, 3, 1] for 7, 3, and 1 day before)",
			dataType: "JSON",
			value: JSON.stringify([7, 3, 1]),
			options: undefined,
			isActive: true,
			requiresRestart: false,
			affectsExistingLoans: false,
		},
		{
			key: "UPCOMING_PAYMENT_CHECK_TIME",
			category: "SYSTEM",
			name: "Payment Reminder Check Time",
			description: "Daily time to check for upcoming payments and send reminders (UTC+8 timezone, 24-hour format)",
			dataType: "STRING",
			value: JSON.stringify("10:00"),
			options: undefined,
			isActive: true,
			requiresRestart: true,
			affectsExistingLoans: false,
		},
		{
			key: "WHATSAPP_LATE_PAYMENT",
			category: "NOTIFICATIONS",
			name: "Late Payment Reminders",
			description: "Send WhatsApp notifications for overdue payments",
			dataType: "BOOLEAN",
			value: JSON.stringify(true),
			options: undefined,
			isActive: true,
			requiresRestart: false,
			affectsExistingLoans: false,
		},
		{
			key: "LATE_PAYMENT_REMINDER_DAYS",
			category: "NOTIFICATIONS",
			name: "Late Payment Reminder Days",
			description: "Days after payment due date to send overdue reminders (e.g., [3, 7, 14] for 3, 7, and 14 days after)",
			dataType: "JSON",
			value: JSON.stringify([3, 7, 14]),
			options: undefined,
			isActive: true,
			requiresRestart: false,
			affectsExistingLoans: false,
		}
	];

	// Create/update each notification setting individually
	for (const setting of notificationSettings) {
		await prisma.systemSettings.upsert({
			where: { key: setting.key },
			update: {
				name: setting.name,
				description: setting.description,
				dataType: setting.dataType as any,
				value: setting.value,
				options: setting.options,
				isActive: setting.isActive,
				requiresRestart: setting.requiresRestart,
				affectsExistingLoans: setting.affectsExistingLoans,
			},
			create: setting as any
		});
	}

	console.log("Notification settings created/updated successfully");

	// Check if bank accounts table is empty
	const bankAccountsCount = await prisma.bankAccount.count();
	if (bankAccountsCount === 0) {
		console.log("Creating default bank account...");
		
		// Default bank account (from the current hardcoded values)
		await prisma.bankAccount.create({
			data: {
				bankName: "HSBC Bank Malaysia Berhad",
				accountName: "OPG Capital Holdings Sdn. Bhd.",
				accountNumber: "001866001878013",
				isActive: true,
				isDefault: true
			}
		});
		
		console.log("Default bank account created successfully");
	} else {
		console.log("Bank accounts table is not empty, skipping default bank account creation");
	}

	console.log("Seed completed successfully");
}

main()
	.catch((e) => {
		console.error("Error seeding database:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
