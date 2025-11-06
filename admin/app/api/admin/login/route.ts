import { NextResponse } from "next/server";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		console.log("Admin API Route - Attempting login with:", body);

		console.log("Admin API Route - Backend URL:", BACKEND_URL);

		// Fetch login token first
		let loginToken: string | null = null;
		try {
			const tokenResponse = await fetch(`${BACKEND_URL}/api/admin/login-token`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (tokenResponse.ok) {
				const tokenData = await tokenResponse.json();
				loginToken = tokenData.loginToken || tokenResponse.headers.get("X-Login-Token");
			} else {
				console.warn("Admin API Route - Failed to fetch login token, proceeding without token");
			}
		} catch (tokenError) {
			console.error("Admin API Route - Error fetching login token:", tokenError);
			// Continue without token - backend will reject if required
		}

		// Forward User-Agent and IP from original request for audit logging
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		
		// Forward User-Agent from browser
		const userAgent = request.headers.get("user-agent");
		if (userAgent) {
			headers["User-Agent"] = userAgent;
		}
		
		// Forward X-Forwarded-For or use direct IP
		const forwardedFor = request.headers.get("x-forwarded-for");
		const realIp = request.headers.get("x-real-ip");
		
		if (forwardedFor) {
			headers["X-Forwarded-For"] = forwardedFor;
		} else if (realIp) {
			headers["X-Forwarded-For"] = realIp;
		}

		// Include login token in headers if available
		if (loginToken) {
			headers["X-Login-Token"] = loginToken;
		}

		// Include login token in body as well
		const loginBody: { phoneNumber: string; password: string; loginToken?: string } = {
			...body,
		};
		if (loginToken) {
			loginBody.loginToken = loginToken;
		}

		const response = await fetch(`${BACKEND_URL}/api/admin/login`, {
			method: "POST",
			headers,
			body: JSON.stringify(loginBody),
		});

	const data = await response.json();

	if (!response.ok) {
		// If it's an OTP requirement (403 with requiresPhoneVerification), forward full response
		if (response.status === 403 && data.requiresPhoneVerification) {
			return NextResponse.json(data, { status: response.status });
		}
		
		// For other errors, return error message
		return NextResponse.json(
			{ error: data.error || data.message || "Failed to authenticate" },
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

		// Refresh token - 90 days
		jsonResponse.cookies.set("adminRefreshToken", data.refreshToken, {
			expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
			maxAge: 90 * 24 * 60 * 60, // 90 days in seconds as a fallback
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
