import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		console.log(`[Phone Change Request Route] Starting request`);

		const body = await request.json();
		const { newPhoneNumber } = body;

		// Get the Authorization header from the incoming request
		const authHeader = request.headers.get("Authorization");
		
		if (!authHeader) {
			console.error("[Phone Change Request Route] No authorization header");
			return NextResponse.json(
				{ error: "No access token available" },
				{ status: 401 }
			);
		}

		console.log(`[Phone Change Request Route] Forwarding request to backend`);

		// Forward the request to the backend with the auth header
		const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/users/me/phone/change-request`;
		
		const response = await fetch(backendUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": authHeader,
			},
			body: JSON.stringify({ newPhoneNumber }),
		});

		const data = await response.json();

		if (!response.ok) {
			console.error("[Phone Change Request Route] Backend error:", data);
			return NextResponse.json(
				{ error: data.message || "Backend error" },
				{ status: response.status }
			);
		}

		console.log(`[Phone Change Request Route] Success`);
		return NextResponse.json(data);

	} catch (error: any) {
		console.error("[Phone Change Request Route] Error:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
} 