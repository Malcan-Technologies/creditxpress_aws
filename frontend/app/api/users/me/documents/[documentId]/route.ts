import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

// Force dynamic rendering since we need to access request headers
export const dynamic = 'force-dynamic';

export async function GET(
	req: NextRequest, 
	props: { params: Promise<{ documentId: string }> }
) {
	try {
		const params = await props.params;
		const { documentId } = params;

		// Try to get token from Authorization header first, then fall back to cookies
		const authHeader = req.headers.get("authorization");
		let token = authHeader?.replace("Bearer ", "");
		
		if (!token) {
			const cookieStore = await cookies();
			token = cookieStore.get("token")?.value;
		}

		if (!token) {
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}

		const response = await fetch(
			`${API_URL}/api/users/me/documents/${documentId}`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
			}
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ message: "Failed to fetch document" }));
			return NextResponse.json(errorData, { status: response.status });
		}

		// Get the content type and stream the response
		const contentType = response.headers.get("content-type") || "application/octet-stream";
		const contentDisposition = response.headers.get("content-disposition");
		
		const headers: Record<string, string> = {
			"Content-Type": contentType,
		};
		
		if (contentDisposition) {
			headers["Content-Disposition"] = contentDisposition;
		}

		// Stream the response body
		const blob = await response.blob();
		return new NextResponse(blob, {
			status: 200,
			headers,
		});
	} catch (error) {
		console.error("Error fetching user document:", error);
		return NextResponse.json(
			{ message: "Failed to fetch document" },
			{ status: 500 }
		);
	}
}
