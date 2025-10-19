import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const { id } = params;
		
		// Get token from cookies
		const cookieStore = cookies();
		const token = cookieStore.get("token")?.value;
		
		if (!token) {
			return NextResponse.json(
				{ success: false, message: "No authentication token provided" },
				{ status: 401 }
			);
		}

		const response = await fetch(
			`${API_URL}/api/loan-applications/${id}/signed-agreement`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			}
		);

		if (!response.ok) {
			const data = await response.json();
			return NextResponse.json(
				data,
				{ status: response.status }
			);
		}

		// Return the PDF as a stream
		const pdfBuffer = await response.arrayBuffer();
		
		return new NextResponse(pdfBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="signed-agreement-${id.substring(0, 8)}.pdf"`,
			},
		});
	} catch (error) {
		console.error("Error downloading signed agreement:", error);
		return NextResponse.json(
			{
				success: false,
				message: "Error downloading signed agreement",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

