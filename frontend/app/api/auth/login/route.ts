import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(request: Request) {
	try {
		console.log(
			`[Login Route] Starting login process with backend URL: ${BACKEND_URL}`
		);

		const body = await request.json();
		const { phoneNumber, password } = body;

		console.log(
			`[Login Route] Forwarding login request for phone: ${phoneNumber}`
		);

		// Forward the request to the backend API
		const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ phoneNumber, password }),
			cache: "no-store",
			next: { revalidate: 0 },
		});

		console.log(
			`[Login Route] Received response with status: ${response.status}`
		);

		// Get the response body
		const data = await response.json();
		console.log(
			`[Login Route] Response data:`,
			data.message
				? { message: data.message }
				: { error: data.error || "Unknown error" }
		);

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Invalid credentials" },
				{ status: response.status }
			);
		}

		// Create response with tokens
		const jsonResponse = NextResponse.json({
			message: data.message,
			accessToken: data.accessToken,
			refreshToken: data.refreshToken,
			isOnboardingComplete: data.isOnboardingComplete,
			onboardingStep: data.onboardingStep,
		});

		// Set cookies with proper expiration
		// Access token - 15 minutes
		jsonResponse.cookies.set("token", data.accessToken, {
			expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
			maxAge: 15 * 60, // 15 minutes in seconds
			path: "/",
		});

		// Refresh token - 90 days
		jsonResponse.cookies.set("refreshToken", data.refreshToken, {
			expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
			maxAge: 90 * 24 * 60 * 60, // 90 days in seconds
			path: "/",
		});

		return jsonResponse;
	} catch (error) {
		console.error("[Login Route] Error details:", error);

		// Try to provide more specific error information
		let errorMessage = "Failed to authenticate";
		if (error instanceof Error) {
			errorMessage = `Authentication error: ${error.message}`;
		}

		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
}
