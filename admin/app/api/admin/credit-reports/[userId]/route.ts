import { NextResponse } from "next/server";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ userId: string }> }
) {
	try {
		const { userId } = await params;
		const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace(/^Bearer\s+/i, "").trim() || authHeader?.split(" ")[1];

		if (!token) {
			console.error("Credit report request: No token provided");
			return NextResponse.json(
				{ success: false, message: "Unauthorized: No token provided" },
				{ status: 401 }
			);
		}

		if (!backendUrl) {
			console.error("Credit report request: Backend URL not configured");
			return NextResponse.json(
				{ success: false, message: "Server configuration error: Backend URL not set" },
				{ status: 500 }
			);
		}

		const backendEndpoint = `${backendUrl}/api/admin/credit-reports/${userId}`;
		console.log(`Credit report request: Forwarding to ${backendEndpoint}`);

		// Forward request to backend
		let response: Response;
		try {
			response = await fetch(backendEndpoint, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});
		} catch (fetchError) {
			console.error("Credit report request: Network error connecting to backend:", fetchError);
			return NextResponse.json(
				{
					success: false,
					message: `Failed to connect to backend: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`,
				},
				{ status: 503 }
			);
		}

		// Try to parse response as JSON
		let data: any;
		try {
			const text = await response.text();
			if (!text) {
				data = {};
			} else {
				data = JSON.parse(text);
			}
		} catch (parseError) {
			console.error("Credit report request: Failed to parse backend response:", parseError);
			return NextResponse.json(
				{
					success: false,
					message: "Invalid response from backend server",
				},
				{ status: 502 }
			);
		}

		if (!response.ok) {
			console.error(`Credit report request: Backend returned error ${response.status}:`, data);
			return NextResponse.json(
				{
					success: false,
					message: data.message || data.error || "Failed to fetch credit report",
				},
				{ status: response.status }
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error fetching credit report:", error);
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				success: false,
				message: `Failed to fetch credit report: ${errorMessage}`,
			},
			{ status: 500 }
		);
	}
}

