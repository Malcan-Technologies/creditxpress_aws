import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export async function GET(req: NextRequest) {
	try {
		const cookieStore = cookies();
		const token = cookieStore.get("token")?.value;

		if (!token) {
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}

		const response = await fetch(`${API_URL}/api/users/me/documents`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		console.error("Error fetching user documents:", error);
		return NextResponse.json(
			{ message: "Failed to fetch documents" },
			{ status: 500 }
		);
	}
} 