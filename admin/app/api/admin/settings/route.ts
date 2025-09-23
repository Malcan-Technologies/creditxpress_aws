import { NextResponse } from "next/server";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	try {
		const backendUrl = process.env.NEXT_PUBLIC_API_URL;
		const token = request.headers.get("authorization")?.split(" ")[1];
		
		if (!token) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		// Extract the path and query parameters
		const url = new URL(request.url);
		const searchParams = url.searchParams.toString();
		const targetUrl = `${backendUrl}/api/settings${searchParams ? `?${searchParams}` : ''}`;

		console.log("Admin Settings API - forwarding to backend");

		// Forward the request to the backend
		const response = await fetch(targetUrl, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.error || "Failed to get settings" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Settings API error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch settings" },
			{ status: 500 }
		);
	}
}

export async function PUT(request: Request) {
	try {
		const backendUrl = process.env.NEXT_PUBLIC_API_URL;
		const token = request.headers.get("authorization")?.split(" ")[1];
		
		if (!token) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		// Get the request body
		const body = await request.json();

		console.log("Admin Settings PUT API - forwarding to backend");

		// Forward the request to the backend with cache-busting headers
		const response = await fetch(`${backendUrl}/api/settings`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				"Cache-Control": "no-cache, no-store, must-revalidate",
				"Pragma": "no-cache",
			},
			body: JSON.stringify(body),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.error || "Failed to update settings" },
				{ status: response.status }
			);
		}

		// Return response with cache-busting headers
		return NextResponse.json(data, {
			headers: {
				"Cache-Control": "no-cache, no-store, must-revalidate",
				"Pragma": "no-cache",
				"Expires": "0",
			},
		});
	} catch (error) {
		console.error("Settings update API error:", error);
		return NextResponse.json(
			{ error: "Failed to update settings" },
			{ status: 500 }
		);
	}
}