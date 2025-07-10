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
