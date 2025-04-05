import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
		return NextResponse.json(data);
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
			return NextResponse.json(
				{ error: "Failed to update onboarding data" },
				{ status: response.status }
			);
		}

		const data = await response.json();
		console.log("Onboarding POST - Success response");
		return NextResponse.json(data);
	} catch (error) {
		console.error("Onboarding POST error:", error);
		return NextResponse.json(
			{ error: "Failed to update onboarding data" },
			{ status: 500 }
		);
	}
}
