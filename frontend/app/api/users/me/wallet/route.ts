import { NextRequest, NextResponse } from "next/server";
import { TokenStorage } from "@/lib/authUtils";

export async function GET(request: NextRequest) {
	try {
		const backendUrl = process.env.NEXT_PUBLIC_API_URL;
		const token = TokenStorage.getAccessToken();

		if (!token) {
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}

		console.log("Fetching user wallet");
		const response = await fetch(`${backendUrl}/api/users/me/wallet`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({
				message: "Failed to parse error response",
			}));
			console.error("Error fetching wallet:", errorData);
			return NextResponse.json(
				{
					message: errorData.message || "Failed to fetch wallet",
					details: errorData,
				},
				{ status: response.status }
			);
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error fetching wallet:", error);
		return NextResponse.json(
			{
				message: "Failed to fetch wallet",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
