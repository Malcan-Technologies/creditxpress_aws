import { NextRequest, NextResponse } from "next/server";

export async function POST(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const { id } = params;
		const body = await request.json();

		// Get the authorization header from the request
		const authHeader = request.headers.get("authorization");
		if (!authHeader) {
			return NextResponse.json(
				{ message: "Authorization header missing" },
				{ status: 401 }
			);
		}

		// Forward the request to the backend
		const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001"}/api/loan-applications/${id}/fresh-offer-response`;
		
		const response = await fetch(backendUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": authHeader,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Backend response error:", errorText);
			return NextResponse.json(
				{ message: "Backend request failed", error: errorText },
				{ status: response.status }
			);
		}

		const data = await response.json();
		return NextResponse.json(data);

	} catch (error) {
		console.error("Error in fresh offer response API:", error);
		return NextResponse.json(
			{ message: "Internal server error", error: error.message },
			{ status: 500 }
		);
	}
}