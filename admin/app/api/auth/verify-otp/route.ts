import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export async function POST(request: Request) {
	try {
		console.log(
			`[Verify OTP Route] Starting verify OTP process with backend URL: ${BACKEND_URL}`
		);

		const body = await request.json();
		const { phoneNumber, otp } = body;

		console.log(
			`[Verify OTP Route] Forwarding verify OTP request for phone: ${phoneNumber}`
		);

		// Forward the request to the backend API
		const response = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ phoneNumber, otp }),
			cache: "no-store",
			next: { revalidate: 0 },
		});

		console.log(
			`[Verify OTP Route] Received response with status: ${response.status}`
		);

		// Get the response body
		const data = await response.json();
		console.log(
			`[Verify OTP Route] Response data:`,
			data.message
				? { message: data.message }
				: { error: data.error || "Unknown error" }
		);

		if (!response.ok) {
			return NextResponse.json(
				{ message: data.message || "Failed to verify OTP" },
				{ status: response.status }
			);
		}

		// Create response with tokens
		const jsonResponse = NextResponse.json({
			message: data.message,
			accessToken: data.accessToken,
			refreshToken: data.refreshToken,
			userId: data.userId,
			phoneNumber: data.phoneNumber,
			isOnboardingComplete: data.isOnboardingComplete,
			onboardingStep: data.onboardingStep,
		});

	// Set cookies with proper expiration (ADMIN cookies)
	// Access token - 15 minutes
	jsonResponse.cookies.set("adminToken", data.accessToken, {
		expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
		maxAge: 15 * 60, // 15 minutes in seconds
		path: "/",
	});

	// Refresh token - 90 days
	jsonResponse.cookies.set("adminRefreshToken", data.refreshToken, {
		expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
		maxAge: 90 * 24 * 60 * 60, // 90 days in seconds
		path: "/",
	});

		return jsonResponse;
	} catch (error) {
		console.error("[Verify OTP Route] Error details:", error);

		// Try to provide more specific error information
		let errorMessage = "Failed to verify OTP";
		if (error instanceof Error) {
			errorMessage = `Verify OTP error: ${error.message}`;
		}

		return NextResponse.json({ message: errorMessage }, { status: 500 });
	}
}