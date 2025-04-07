import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		console.log("Admin API Route - Attempting login with:", body);

		const backendUrl = process.env.NEXT_PUBLIC_API_URL;
		console.log("Admin API Route - Backend URL:", backendUrl);

		const response = await fetch(`${backendUrl}/api/admin/login`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.error || "Failed to authenticate" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.log("Admin API Route - Error details:", error);
		return NextResponse.json(
			{ error: "Failed to authenticate" },
			{ status: 500 }
		);
	}
}
