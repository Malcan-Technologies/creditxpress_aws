import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
	const phoneNumber = "60182440976";
	const password = "admin123"; // Change this to a secure password

	// Check if admin user already exists
	const existingUser = await prisma.user.findUnique({
		where: { phoneNumber },
	});

	if (existingUser) {
		console.log("Admin user already exists");
		return;
	}

	// Hash the password
	const hashedPassword = await bcrypt.hash(password, 10);

	// Create admin user
	const adminUser = await prisma.user.create({
		data: {
			phoneNumber,
			password: hashedPassword,
			role: "ADMIN",
			fullName: "Admin User",
			isOnboardingComplete: true,
			kycStatus: true,
		},
	});

	console.log("Admin user created:", adminUser);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
