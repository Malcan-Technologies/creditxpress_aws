import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export async function POST(
	request: NextRequest,
	props: { params: Promise<{ id: string }> }
) {
	const params = await props.params;
	try {
		const { id } = params;

		const authHeader = request.headers.get("authorization");
		if (!authHeader) {
			return NextResponse.json(
				{ success: false, message: "No authorization token provided" },
				{ status: 401 }
			);
		}

		const response = await fetch(
			`${API_URL}/api/admin/applications/${id}/reconcile-signing-status`,
			{
				method: "POST",
				headers: {
					Authorization: authHeader,
					"Content-Type": "application/json",
				},
			}
		);

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		console.error("Error reconciling signing status:", error);
		return NextResponse.json(
			{
				success: false,
				message: "Error reconciling signing status",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
