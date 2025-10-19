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

		// Forward the multipart form data directly to backend
		const formData = await request.formData();

		const response = await fetch(
			`${API_URL}/api/admin/applications/${id}/upload-disbursement-slip`,
			{
				method: "POST",
				headers: {
					Authorization: authHeader,
				},
				body: formData,
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
		console.error("Error uploading disbursement slip:", error);
		return NextResponse.json(
			{
				success: false,
				message: "Error uploading payment slip",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

