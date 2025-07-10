import { NextResponse } from "next/server";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export async function PUT(request: Request) {
	try {
		const authHeader = request.headers.get("authorization");
		console.log("Users/me/password PUT - Auth header:", authHeader);

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			console.log("Users/me/password PUT - Invalid auth header format");
			return NextResponse.json(
				{ error: "Invalid authorization header" },
				{ status: 401 }
			);
		}

		// Get the request body
		const body = await request.json();
		console.log("Users/me/password PUT - Request body received");

		// Forward the request to the backend API
		console.log(
			"Users/me/password PUT - Forwarding request to backend:",
			`${BACKEND_URL}/api/users/me/password`
		);
		const response = await fetch(`${BACKEND_URL}/api/users/me/password`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: authHeader,
			},
			body: JSON.stringify(body),
		});

		console.log("Users/me/password PUT - Backend response:", {
			status: response.status,
			ok: response.ok,
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const errorMessage = errorData.error || errorData.message || "Failed to change password";
			return NextResponse.json(
				{ error: errorMessage },
				{ status: response.status }
			);
		}

		const data = await response.json();
		console.log("Users/me/password PUT - Backend data:", data);

		// Return the success response
		console.log("Users/me/password PUT - Successful response");
		return NextResponse.json(data);
	} catch (error) {
		console.error("Users/me/password PUT error:", error);
		return NextResponse.json(
			{ error: "Failed to change password" },
			{ status: 500 }
		);
	}
} 