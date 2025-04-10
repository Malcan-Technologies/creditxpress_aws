import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(request: Request) {
	try {
		console.log("[Refresh Token Route] Starting token refresh process");

		const body = await request.json();
		const { refreshToken } = body;

		if (!refreshToken) {
			console.log("[Refresh Token Route] No refresh token provided");
			return NextResponse.json(
				{ error: "Refresh token is required" },
				{ status: 400 }
			);
		}

		console.log(
			"[Refresh Token Route] Forwarding refresh request to backend"
		);

		// Forward the request to the backend API
		const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ refreshToken }),
			cache: "no-store",
			next: { revalidate: 0 },
		});

		console.log(
			`[Refresh Token Route] Received response with status: ${response.status}`
		);

		// Get the response body
		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to refresh token" },
				{ status: response.status }
			);
		}

		// Create response with the new tokens
		const jsonResponse = NextResponse.json({
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
		console.error("[Refresh Token Route] Error details:", error);

		let errorMessage = "Failed to refresh token";
		if (error instanceof Error) {
			errorMessage = `Refresh token error: ${error.message}`;
		}

		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
}
