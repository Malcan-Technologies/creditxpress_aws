import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function PATCH(
	req: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const cookieStore = cookies();
		const token = cookieStore.get("token")?.value;

		if (!token) {
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}

		const body = await req.json();
		const response = await fetch(
			`${API_URL}/api/loan-applications/${params.id}/status`,
			{
				method: "PATCH",
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
		console.error("Error updating application status:", error);
		return NextResponse.json(
			{ message: "Failed to update application status" },
			{ status: 500 }
		);
	}
}
