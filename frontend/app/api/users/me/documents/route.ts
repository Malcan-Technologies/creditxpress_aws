import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

// Force dynamic rendering since we need to access request headers
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
	try {
		// Extract authorization header from the request
		const authHeader = req.headers.get("authorization");
		
		if (!authHeader) {
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}

		// Pass through query parameters (e.g., status=APPROVED)
		const { searchParams } = new URL(req.url);
		const queryString = searchParams.toString();
		const url = `${API_URL}/api/users/me/documents${queryString ? `?${queryString}` : ''}`;

		const response = await fetch(url, {
			headers: {
				Authorization: authHeader,
			},
		});

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		console.error("Error fetching user documents:", error);
		return NextResponse.json(
			{ message: "Failed to fetch documents" },
			{ status: 500 }
		);
	}
} 