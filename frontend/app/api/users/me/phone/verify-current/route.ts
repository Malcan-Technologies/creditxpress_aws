import { NextResponse } from "next/server";
import { fetchWithTokenRefresh } from "@/lib/authUtils";

export async function POST(request: Request) {
	try {
		console.log(`[Verify Current Phone Route] Starting request`);

		const body = await request.json();
		const { changeToken, otp } = body;

		console.log(`[Verify Current Phone Route] Forwarding verification request`);

		// Use fetchWithTokenRefresh to include auth headers
		const data = await fetchWithTokenRefresh<any>(
			"/api/users/me/phone/verify-current",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ changeToken, otp }),
			}
		);

		console.log(`[Verify Current Phone Route] Success`);

		return NextResponse.json(data);

	} catch (error: any) {
		console.error("[Verify Current Phone Route] Error:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: error.status || 500 }
		);
	}
} 