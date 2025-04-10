import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { refreshToken } = body;

		if (!refreshToken) {
			return NextResponse.json(
				{ error: "Refresh token is required" },
				{ status: 400 }
			);
		}

		const backendUrl = process.env.NEXT_PUBLIC_API_URL;

		const response = await fetch(`${backendUrl}/api/admin/logout`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${
					request.headers.get("authorization")?.split(" ")[1] || ""
				}`,
			},
			body: JSON.stringify({ refreshToken }),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.error || "Failed to logout" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Admin logout error:", error);
		return NextResponse.json(
			{ error: "Failed to logout" },
			{ status: 500 }
		);
	}
}
