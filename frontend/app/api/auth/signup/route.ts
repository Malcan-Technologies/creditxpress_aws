import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const { phoneNumber, password } = await request.json();

		// Forward the request to the backend API
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ phoneNumber, password }),
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to create user" },
				{ status: response.status }
			);
		}

		// Return the response from the backend, including tokens and onboarding status
		return NextResponse.json({
			message: data.message,
			accessToken: data.accessToken,
			refreshToken: data.refreshToken,
			isOnboardingComplete: data.isOnboardingComplete,
			onboardingStep: data.onboardingStep,
		});
	} catch (error) {
		console.error("Signup error:", error);
		return NextResponse.json(
			{ error: "Failed to create user" },
			{ status: 500 }
		);
	}
}
