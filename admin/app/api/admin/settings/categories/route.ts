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

		console.log("Admin Settings Categories API - forwarding to backend");

		// Add cache-busting timestamp to ensure fresh data
		const timestamp = Date.now();
		const response = await fetch(`${backendUrl}/api/settings/categories?_t=${timestamp}`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				"Cache-Control": "no-cache, no-store, must-revalidate",
				"Pragma": "no-cache",
				"Expires": "0",
			},
		});

		const data = await response.json();
		
		console.log("Backend response:", response.status, data);

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.error || "Failed to get settings categories" },
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
		console.error("Settings categories API error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch settings categories" },
			{ status: 500 }
		);
	}
}