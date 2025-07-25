import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export async function POST(request: Request) {
	try {
		console.log(`[Forgot Password Route] Starting request with backend URL: ${BACKEND_URL}`);

		const body = await request.json();
		const { phoneNumber } = body;

		console.log(`[Forgot Password Route] Forwarding request for phone: ${phoneNumber}`);

		// Forward the request to the backend API
		const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ phoneNumber }),
			cache: "no-store",
			next: { revalidate: 0 },
		});

		console.log(`[Forgot Password Route] Received response with status: ${response.status}`);

		// Get the response body
		const data = await response.json();
		console.log(`[Forgot Password Route] Response data:`, data.message ? { message: data.message } : { error: data.error || "Unknown error" });

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to send reset code" },
				{ status: response.status }
			);
		}

		// Return success response
		return NextResponse.json({
			message: data.message,
		});

	} catch (error) {
		console.error("[Forgot Password Route] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
} 