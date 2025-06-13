import { NextResponse } from "next/server";
import { AdminTokenStorage } from "../../../../lib/authUtils";

export async function POST() {
	try {
		const backendUrl = process.env.NEXT_PUBLIC_API_URL;
		const token = AdminTokenStorage.getAccessToken();

		if (!token) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		console.log("Ensuring wallets for all users");
		const response = await fetch(`${backendUrl}/api/admin/ensure-wallets`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({
				message: "Failed to parse error response",
			}));
			console.error("Error ensuring wallets:", errorData);
			return NextResponse.json(
				{
					error: errorData.message || "Failed to ensure wallets",
					details: errorData,
				},
				{ status: response.status }
			);
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error ensuring wallets:", error);
		return NextResponse.json(
			{
				error: "Failed to ensure wallets",
				details:
					error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
