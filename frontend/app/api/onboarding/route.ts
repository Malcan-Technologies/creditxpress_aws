import { NextResponse } from "next/server";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export async function GET(request: Request) {
	try {
		const authHeader = request.headers.get("authorization");
		console.log("Onboarding GET - Auth header:", authHeader);

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			console.log("Onboarding GET - Invalid auth header format");
			return NextResponse.json(
				{ error: "Invalid authorization header" },
				{ status: 401 }
			);
		}

		// Forward the request to the backend API
		console.log("Onboarding GET - Forwarding request to backend");
		const response = await fetch(`${BACKEND_URL}/api/onboarding`, {
			headers: {
				Authorization: authHeader,
			},
		});

		if (!response.ok) {
			console.log(
				"Onboarding GET - Error response from backend:",
				response.status
			);
			return NextResponse.json(
				{ error: "Failed to fetch onboarding data" },
				{ status: response.status }
			);
		}

		const data = await response.json();
		console.log("Onboarding GET - Success response");
		const nextResponse = NextResponse.json(data);
		nextResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
		nextResponse.headers.set('Pragma', 'no-cache');
		nextResponse.headers.set('Expires', '0');
		return nextResponse;
	} catch (error) {
		console.error("Onboarding GET error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch onboarding data" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	try {
		const authHeader = request.headers.get("authorization");
		console.log("Onboarding POST - Auth header:", authHeader);

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			console.log("Onboarding POST - Invalid auth header format");
			return NextResponse.json(
				{ error: "Invalid authorization header" },
				{ status: 401 }
			);
		}

		const body = await request.json();

		// Forward the request to the backend API
		console.log("Onboarding POST - Forwarding request to backend");
		const response = await fetch(`${BACKEND_URL}/api/onboarding`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: authHeader,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			console.log(
				"Onboarding POST - Error response from backend:",
				response.status
			);
			const errorData = await response.json().catch(() => ({}));
			return NextResponse.json(
				{ error: errorData.error || "Failed to update onboarding data" },
				{ status: response.status }
			);
		}

		const data = await response.json();
		console.log("Onboarding POST - Success response");
		const nextResponse = NextResponse.json(data);
		nextResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
		nextResponse.headers.set('Pragma', 'no-cache');
		nextResponse.headers.set('Expires', '0');
		
		// Add custom header to trigger cross-device sync
		nextResponse.headers.set('X-Profile-Updated', 'true');
		
		return nextResponse;
	} catch (error) {
		console.error("Onboarding POST error:", error);
		return NextResponse.json(
			{ error: "Failed to update onboarding data" },
			{ status: 500 }
		);
	}
}
