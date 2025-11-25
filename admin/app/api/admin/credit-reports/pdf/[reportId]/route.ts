import { NextResponse } from "next/server";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ reportId: string }> }
) {
	try {
		const { reportId } = await params;
		const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace(/^Bearer\s+/i, "").trim() || authHeader?.split(" ")[1];

		if (!token) {
			console.error("PDF request: No token provided");
			return NextResponse.json(
				{ success: false, message: "Unauthorized: No token provided" },
				{ status: 401 }
			);
		}

		if (!backendUrl) {
			console.error("PDF request: Backend URL not configured");
			return NextResponse.json(
				{ success: false, message: "Server configuration error: Backend URL not set" },
				{ status: 500 }
			);
		}

		const backendEndpoint = `${backendUrl}/api/admin/credit-reports/${reportId}/pdf`;
		console.log(`PDF request: Forwarding to ${backendEndpoint}`);

		// Forward request to backend
		let response: Response;
		try {
			response = await fetch(backendEndpoint, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
		} catch (fetchError) {
			console.error("PDF request: Network error connecting to backend:", fetchError);
			return NextResponse.json(
				{
					success: false,
					message: `Failed to connect to backend: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`,
				},
				{ status: 503 }
			);
		}

		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			return NextResponse.json(
				{
					success: false,
					message: data.message || "Failed to fetch PDF",
				},
				{ status: response.status }
			);
		}

		// Get PDF buffer from backend
		const pdfBuffer = await response.arrayBuffer();

		// Get filename from Content-Disposition header or use default
		const contentDisposition = response.headers.get("Content-Disposition");
		let filename = "credit-report.pdf";
		if (contentDisposition) {
			const filenameMatch = contentDisposition.match(/filename="(.+)"/);
			if (filenameMatch) {
				filename = filenameMatch[1];
			}
		}

		// Return PDF with proper headers
		return new NextResponse(pdfBuffer, {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${filename}"`,
			},
		});
	} catch (error) {
		console.error("Error fetching PDF:", error);
		return NextResponse.json(
			{
				success: false,
				message: "Failed to fetch PDF",
			},
			{ status: 500 }
		);
	}
}

