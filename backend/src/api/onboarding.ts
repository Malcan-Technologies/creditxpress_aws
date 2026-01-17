import { authenticateAndVerifyPhone, AuthRequest } from "../middleware/auth";
import { Router, Response } from "express";
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
	serviceLength: string | null;
	bankName: string | null;
	accountNumber: string | null;
	icNumber: string | null;
	icType: string | null;
	educationLevel: string | null;
	race: string | null;
	gender: string | null;
	occupation: string | null;
	emergencyContactName: string | null;
	emergencyContactPhone: string | null;
	emergencyContactRelationship: string | null;
}

router.get("/", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
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
				serviceLength: true,
				bankName: true,
				accountNumber: true,
				icNumber: true,
				icType: true,
				educationLevel: true,
				race: true,
				gender: true,
				occupation: true,
				emergencyContactName: true,
				emergencyContactPhone: true,
				emergencyContactRelationship: true,
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
			icNumber: user.icNumber,
			icType: user.icType,
			educationLevel: user.educationLevel,
			race: user.race,
			gender: user.gender,
			occupation: user.occupation,
			serviceLength: user.serviceLength,
			emergencyContactName: user.emergencyContactName,
			emergencyContactPhone: user.emergencyContactPhone,
			emergencyContactRelationship: user.emergencyContactRelationship,
		};

		return res.json(response);
	} catch (error) {
		console.error("Error fetching onboarding data:", error);
		return res.status(500).json({ error: "Internal server error" });
	}
});

router.post("/", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
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
			serviceLength,
			bankName,
			accountNumber,
		onboardingStep,
		icNumber,
		icType,
		educationLevel,
		race,
		gender,
		occupation,
		emergencyContactName,
		emergencyContactPhone,
		emergencyContactRelationship,
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
		serviceLength,
		bankName,
		accountNumber,
		onboardingStep,
		isOnboardingComplete: onboardingStep >= 4,
		icNumber,
		icType,
		educationLevel,
		race,
		gender,
		occupation,
		emergencyContactName,
		emergencyContactPhone,
		emergencyContactRelationship,
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
				serviceLength: true,
				bankName: true,
				accountNumber: true,
			icNumber: true,
			icType: true,
			educationLevel: true,
			race: true,
			gender: true,
			occupation: true,
			emergencyContactName: true,
			emergencyContactPhone: true,
			emergencyContactRelationship: true,
		},
	});

	// Convert zipCode to postalCode for frontend
	const response: UserResponse = {
		...updatedUser,
		postalCode: updatedUser.zipCode,
		zipCode: undefined,
		icNumber: updatedUser.icNumber,
		icType: updatedUser.icType,
		educationLevel: updatedUser.educationLevel,
		race: updatedUser.race,
		gender: updatedUser.gender,
		occupation: updatedUser.occupation,
		serviceLength: updatedUser.serviceLength,
		emergencyContactName: updatedUser.emergencyContactName,
		emergencyContactPhone: updatedUser.emergencyContactPhone,
		emergencyContactRelationship: updatedUser.emergencyContactRelationship,
	};

		console.log("Onboarding POST - Updated user:", response);
		return res.json(response);
	} catch (error: any) {
		console.error("Error updating onboarding data:", error);
		
		// Check for Prisma unique constraint violation (duplicate email)
		if (error?.code === 'P2002') {
			const target = error?.meta?.target;
			if (Array.isArray(target) && target.includes('email')) {
				return res.status(409).json({ 
					error: "This email address is already registered. Please use a different email address." 
				});
			}
		}
		
		return res
			.status(500)
			.json({ error: "Failed to update onboarding data" });
	}
});

export default router;
