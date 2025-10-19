import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export async function POST(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const { id } = params;
		
		// Get authorization header
		const authHeader = request.headers.get("authorization");
		if (!authHeader) {
			return NextResponse.json(
				{ success: false, message: "No authorization token provided" },
				{ status: 401 }
			);
		}

		const response = await fetch(
			`${API_URL}/api/admin/applications/${id}/confirm-stamping`,
			{
				method: "POST",
				headers: {
					Authorization: authHeader,
					"Content-Type": "application/json",
				},
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				data,
				{ status: response.status }
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error confirming stamping:", error);
		return NextResponse.json(
			{
				success: false,
				message: "Error confirming stamping",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

