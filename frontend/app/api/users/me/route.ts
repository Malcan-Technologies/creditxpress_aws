import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET(request: Request) {
	try {
		const authHeader = request.headers.get("authorization");
		console.log("Users/me - Auth header:", authHeader);

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			console.log("Users/me - Invalid auth header format");
			return NextResponse.json(
				{ error: "Invalid authorization header" },
				{ status: 401 }
			);
		}

		// Forward the request to the backend API
		console.log(
			"Users/me - Forwarding request to backend:",
			`${BACKEND_URL}/api/users/me`
		);
		const response = await fetch(`${BACKEND_URL}/api/users/me`, {
			headers: {
				Authorization: authHeader,
			},
		});

		console.log("Users/me - Backend response:", {
			status: response.status,
			ok: response.ok,
		});

		if (!response.ok) {
			console.log("Users/me - Error response from backend");
			return NextResponse.json(
				{ error: "Authentication failed" },
				{ status: response.status }
			);
		}

		const data = await response.json();
		console.log("Users/me - Backend data:", data);

		// Return the user data
		console.log("Users/me - Successful response");
		return NextResponse.json(data);
	} catch (error) {
		console.error("Users/me error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch user data" },
			{ status: 500 }
		);
	}
}

export async function PUT(request: Request) {
	try {
		const authHeader = request.headers.get("authorization");
		console.log("Users/me PUT - Auth header:", authHeader);

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			console.log("Users/me PUT - Invalid auth header format");
			return NextResponse.json(
				{ error: "Invalid authorization header" },
				{ status: 401 }
			);
		}

		// Get the request body
		const body = await request.json();
		console.log("Users/me PUT - Request body:", body);

		// Forward the request to the backend API
		console.log(
			"Users/me PUT - Forwarding request to backend:",
			`${BACKEND_URL}/api/users/me`
		);
		const response = await fetch(`${BACKEND_URL}/api/users/me`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: authHeader,
			},
			body: JSON.stringify(body),
		});

		console.log("Users/me PUT - Backend response:", {
			status: response.status,
			ok: response.ok,
		});

		if (!response.ok) {
			console.log("Users/me PUT - Error response from backend");
			return NextResponse.json(
				{ error: "Failed to update user data" },
				{ status: response.status }
			);
		}

		const data = await response.json();
		console.log("Users/me PUT - Backend data:", data);

		// Return the updated user data
		console.log("Users/me PUT - Successful response");
		return NextResponse.json(data);
	} catch (error) {
		console.error("Users/me PUT error:", error);
		return NextResponse.json(
			{ error: "Failed to update user data" },
			{ status: 500 }
		);
	}
}
