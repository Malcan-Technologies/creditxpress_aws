import { PrismaClient, Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export interface IUser {
	id: string;
	phoneNumber: string;
	password: string;
	refreshToken: string | null;
	createdAt: Date;
	updatedAt: Date;
	isOnboardingComplete: boolean;
	onboardingStep: number;
	comparePassword(candidatePassword: string): Promise<boolean>;
	updateOnboardingStatus(step: number, isComplete: boolean): Promise<void>;
	updateProfile(data: Prisma.UserUpdateInput): Promise<void>;
	updateRefreshToken(refreshToken: string | null): Promise<void>;
}

export class User implements IUser {
	id: string;
	phoneNumber: string;
	password: string;
	refreshToken: string | null;
	createdAt: Date;
	updatedAt: Date;
	isOnboardingComplete: boolean;
	onboardingStep: number;

	constructor(data: any) {
		this.id = data.id;
		this.phoneNumber = data.phoneNumber;
		this.password = data.password;
		this.refreshToken = data.refreshToken;
		this.createdAt = data.createdAt;
		this.updatedAt = data.updatedAt;
		this.isOnboardingComplete = data.isOnboardingComplete ?? false;
		this.onboardingStep = data.onboardingStep ?? 0;
	}

	static async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
		const user = await prisma.user.findUnique({
			where: { phoneNumber },
		});
		return user ? new User(user) : null;
	}

	static async findById(id: string): Promise<User | null> {
		const user = await prisma.user.findUnique({
			where: { id },
		});
		return user ? new User(user) : null;
	}

	static async create(data: {
		phoneNumber: string;
		password: string;
	}): Promise<User> {
		const hashedPassword = await bcrypt.hash(data.password, 10);
		const user = await prisma.user.create({
			data: {
				phoneNumber: data.phoneNumber,
				password: hashedPassword,
				isOnboardingComplete: false,
				onboardingStep: 0,
			},
		});
		return new User(user);
	}

	async comparePassword(candidatePassword: string): Promise<boolean> {
		return bcrypt.compare(candidatePassword, this.password);
	}

	async updateRefreshToken(refreshToken: string | null): Promise<void> {
		await prisma.user.update({
			where: { id: this.id },
			data: { refreshToken },
		});
		this.refreshToken = refreshToken;
	}

	async updateOnboardingStatus(
		step: number,
		isComplete: boolean
	): Promise<void> {
		const updateData: Prisma.UserUpdateInput = {
			onboardingStep: step,
			isOnboardingComplete: isComplete,
		};
		await prisma.user.update({
			where: { id: this.id },
			data: updateData,
		});
		this.onboardingStep = step;
		this.isOnboardingComplete = isComplete;
	}

	async updateProfile(data: Prisma.UserUpdateInput): Promise<void> {
		console.log("Updating profile with data:", data);

		// Update user data
		await prisma.user.update({
			where: { id: this.id },
			data,
		});

		// Get the updated user data
		const updatedUser = await prisma.user.findUnique({
			where: { id: this.id },
			select: {
				onboardingStep: true,
				isOnboardingComplete: true,
			},
		});

		if (updatedUser) {
			console.log("Updated user data:", updatedUser);

			// Update onboarding step if provided in the data
			if (typeof data.onboardingStep === "number") {
				this.onboardingStep = data.onboardingStep;
				console.log("Setting onboarding step to:", data.onboardingStep);
			} else if (data.onboardingStep !== undefined) {
				// Handle the case where onboardingStep is provided as a Prisma.IntFieldUpdateOperationsInput
				const stepUpdate =
					data.onboardingStep as Prisma.IntFieldUpdateOperationsInput;
				if (stepUpdate.set !== undefined) {
					this.onboardingStep = stepUpdate.set;
					console.log("Setting onboarding step to:", stepUpdate.set);
				}
			}

			// Check if we've completed step 3 (Employment Details)
			const isComplete = this.onboardingStep >= 3;
			console.log(
				"Checking completion - step:",
				this.onboardingStep,
				"isComplete:",
				isComplete
			);

			await this.updateOnboardingStatus(this.onboardingStep, isComplete);
		}
	}

	static async checkOnboardingCompletion(userId: string): Promise<boolean> {
		console.log(`Checking onboarding completion for user ${userId}`);

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				onboardingStep: true,
				isOnboardingComplete: true,
			},
		});

		if (!user) {
			console.log(`User ${userId} not found`);
			return false;
		}

		console.log(
			`Current onboarding step: ${user.onboardingStep}, isComplete: ${user.isOnboardingComplete}`
		);

		// Check if we have completed step 3 (Employment Details)
		if (user.onboardingStep >= 3) {
			console.log(
				`Setting isOnboardingComplete to true for step ${user.onboardingStep}`
			);

			// Update the user's onboarding status
			await prisma.user.update({
				where: { id: userId },
				data: {
					isOnboardingComplete: true,
				},
			});

			console.log(`Updated onboarding status successfully`);
			return true;
		}

		console.log(
			`Onboarding not complete yet at step ${user.onboardingStep}`
		);
		return false;
	}
}
