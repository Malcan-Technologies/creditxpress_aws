import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function POST(req: NextRequest) {
	try {
		const cookieStore = await cookies();
		const token = cookieStore.get("token")?.value;

		if (!token) {
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}

		const body = await req.json();
		const response = await fetch(`${API_URL}/api/loan-applications`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(body),
		});

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		console.error("Error creating loan application:", error);
		return NextResponse.json(
			{ message: "Failed to create loan application" },
			{ status: 500 }
		);
	}
}

export async function GET(req: NextRequest) {
	try {
		const cookieStore = await cookies();
		const token = cookieStore.get("token")?.value;

		if (!token) {
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}

		const response = await fetch(`${API_URL}/api/loan-applications`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		console.error("Error fetching loan applications:", error);
		return NextResponse.json(
			{ message: "Failed to fetch loan applications" },
			{ status: 500 }
		);
	}
}
