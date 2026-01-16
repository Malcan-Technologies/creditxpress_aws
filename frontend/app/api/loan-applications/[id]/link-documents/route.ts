import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Force dynamic rendering since we use cookies
export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
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

		const body = await req.json();
		const { id } = params;

		const response = await fetch(
			`${API_URL}/api/loan-applications/${id}/link-documents`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(body),
			}
		);

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		console.error("Error linking documents:", error);
		return NextResponse.json(
			{ message: "Internal server error" },
			{ status: 500 }
		);
	}
} 