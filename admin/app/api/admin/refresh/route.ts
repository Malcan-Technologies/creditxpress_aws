import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		console.log("API /admin/refresh - Started");
		const body = await request.json();
		const { refreshToken } = body;
		console.log(
			"API /admin/refresh - Refresh token exists:",
			!!refreshToken
		);

		if (!refreshToken) {
			console.log("API /admin/refresh - No refresh token provided");
			return NextResponse.json(
				{ error: "Refresh token is required" },
				{ status: 400 }
			);
		}

		const backendUrl = process.env.NEXT_PUBLIC_API_URL;
		console.log("API /admin/refresh - Backend URL:", backendUrl);

		console.log("API /admin/refresh - Calling backend refresh endpoint");
		const response = await fetch(`${backendUrl}/api/admin/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ refreshToken }),
		});

		console.log(
			"API /admin/refresh - Backend response status:",
			response.status
		);
		const data = await response.json();
		console.log("API /admin/refresh - Got response data:", {
			hasAccessToken: !!data.accessToken,
			hasRefreshToken: !!data.refreshToken,
			error: data.error,
		});

		if (!response.ok) {
			console.error("API /admin/refresh - Error response:", data.error);
			return NextResponse.json(
				{ error: data.error || "Failed to refresh token" },
				{ status: response.status }
			);
		}

		// Create response with the new tokens
		console.log("API /admin/refresh - Creating response with tokens");
		const jsonResponse = NextResponse.json({
			accessToken: data.accessToken,
			refreshToken: data.refreshToken,
		});

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

		console.log("API /admin/refresh - Cookies set, returning response");
		return jsonResponse;
	} catch (error) {
		console.error("API /admin/refresh - Exception:", error);
		return NextResponse.json(
			{ error: "Failed to refresh token" },
			{ status: 500 }
		);
	}
}
