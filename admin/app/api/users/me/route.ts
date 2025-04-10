import { NextResponse } from "next/server";

export async function GET(request: Request) {
	try {
		const backendUrl = process.env.NEXT_PUBLIC_API_URL;
		const token = request.headers.get("authorization")?.split(" ")[1];

		console.log("API /users/me - Authorization token exists:", !!token);

		if (!token) {
			console.log("API /users/me - No token provided");
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		console.log(
			"API /users/me - Calling backend:",
			`${backendUrl}/api/users/me`
		);
		const response = await fetch(`${backendUrl}/api/users/me`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		console.log(
			"API /users/me - Backend response status:",
			response.status
		);
		const data = await response.json();

		if (!response.ok) {
			console.error("API /users/me - Error response:", data);
			return NextResponse.json(
				{ error: data.error || "Failed to get user profile" },
				{ status: response.status }
			);
		}

		console.log("API /users/me - User data retrieved successfully");
		return NextResponse.json(data);
	} catch (error) {
		console.error("API /users/me - Exception:", error);
		return NextResponse.json(
			{ error: "Failed to fetch user profile" },
			{ status: 500 }
		);
	}
}
