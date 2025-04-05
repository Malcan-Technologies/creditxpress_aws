import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(request: Request) {
	try {
		const { phoneNumber, password } = await request.json();

		// Forward the request to the backend API
		const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ phoneNumber, password }),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Invalid credentials" },
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
		console.error("Login error:", error);
		return NextResponse.json(
			{ error: "Failed to authenticate" },
			{ status: 500 }
		);
	}
}
