import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

interface UserResponse {
	id: string;
	phoneNumber: string;
	onboardingStep: number;
	isOnboardingComplete: boolean;
	fullName: string | null;
	dateOfBirth: Date | null;
	email: string | null;
	address1: string | null;
	address2: string | null;
	city: string | null;
	state: string | null;
	postalCode?: string | null;
	zipCode?: string | null;
	employmentStatus: string | null;
	employerName: string | null;
	monthlyIncome: string | null;
	bankName: string | null;
	accountNumber: string | null;
}

router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?.userId;
		if (!userId) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				phoneNumber: true,
				onboardingStep: true,
				isOnboardingComplete: true,
				fullName: true,
				dateOfBirth: true,
				email: true,
				address1: true,
				address2: true,
				city: true,
				state: true,
				zipCode: true,
				employmentStatus: true,
				employerName: true,
				monthlyIncome: true,
				bankName: true,
				accountNumber: true,
			},
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Convert zipCode to postalCode for frontend
		const response: UserResponse = {
			...user,
			postalCode: user.zipCode,
			zipCode: undefined,
		};

		return res.json(response);
	} catch (error) {
		console.error("Error fetching onboarding data:", error);
		return res.status(500).json({ error: "Internal server error" });
	}
});

router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?.userId;
		if (!userId) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		console.log("Onboarding POST - Request body:", req.body);

		// Extract only the fields we want to update
		const {
			fullName,
			dateOfBirth,
			email,
			address1,
			address2,
			city,
			state,
			postalCode,
			employmentStatus,
			employerName,
			monthlyIncome,
			bankName,
			accountNumber,
			onboardingStep,
		} = req.body;

		// Prepare the data for update
		const data: any = {
			fullName,
			email,
			address1,
			address2,
			city,
			state,
			zipCode: postalCode,
			employmentStatus,
			employerName,
			monthlyIncome,
			bankName,
			accountNumber,
			onboardingStep,
			isOnboardingComplete: onboardingStep >= 3,
		};

		// Convert date string to Date object if present
		if (dateOfBirth) {
			data.dateOfBirth = new Date(dateOfBirth);
		}

		// Remove undefined fields
		Object.keys(data).forEach(
			(key) => data[key] === undefined && delete data[key]
		);

		console.log("Onboarding POST - Processed data:", data);

		// Update user profile with onboarding data
		const updatedUser = await prisma.user.update({
			where: { id: userId },
			data,
			select: {
				id: true,
				phoneNumber: true,
				onboardingStep: true,
				isOnboardingComplete: true,
				fullName: true,
				dateOfBirth: true,
				email: true,
				address1: true,
				address2: true,
				city: true,
				state: true,
				zipCode: true,
				employmentStatus: true,
				employerName: true,
				monthlyIncome: true,
				bankName: true,
				accountNumber: true,
			},
		});

		// Convert zipCode to postalCode for frontend
		const response: UserResponse = {
			...updatedUser,
			postalCode: updatedUser.zipCode,
			zipCode: undefined,
		};

		console.log("Onboarding POST - Updated user:", response);
		return res.json(response);
	} catch (error) {
		console.error("Error updating onboarding data:", error);
		return res
			.status(500)
			.json({ error: "Failed to update onboarding data" });
	}
});

export default router;
