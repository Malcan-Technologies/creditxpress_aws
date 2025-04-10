import { NextResponse } from "next/server";

export async function GET(request: Request) {
	try {
		const backendUrl = process.env.NEXT_PUBLIC_API_URL;
		const token = request.headers.get("authorization")?.split(" ")[1];

		if (!token) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const response = await fetch(`${backendUrl}/api/admin/dashboard`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.error || "Failed to get dashboard stats" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Admin dashboard error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch dashboard statistics" },
			{ status: 500 }
		);
	}
}
