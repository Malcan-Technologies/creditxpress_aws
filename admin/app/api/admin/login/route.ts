import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		console.log("Admin API Route - Attempting login with:", body);

		const backendUrl = process.env.NEXT_PUBLIC_API_URL;
		console.log("Admin API Route - Backend URL:", backendUrl);

		const response = await fetch(`${backendUrl}/api/admin/login`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.error || "Failed to authenticate" },
				{ status: response.status }
			);
		}

		// Create response with tokens
		const jsonResponse = NextResponse.json(data);

		// Set cookies with proper expiration
		// Access token - 15 minutes
		jsonResponse.cookies.set("adminToken", data.accessToken, {
			expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
			maxAge: 15 * 60, // 15 minutes in seconds
			path: "/",
		});

		// Refresh token - 30 days
		jsonResponse.cookies.set("adminRefreshToken", data.refreshToken, {
			expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
			maxAge: 30 * 24 * 60 * 60, // 30 days in seconds as a fallback
			path: "/",
		});

		return jsonResponse;
	} catch (error) {
		console.log("Admin API Route - Error details:", error);
		return NextResponse.json(
			{ error: "Failed to authenticate" },
			{ status: 500 }
		);
	}
}
