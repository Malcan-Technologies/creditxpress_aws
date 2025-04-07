import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function GET(
	request: Request,
	{ params }: { params: { id: string } }
) {
	try {
		const cookieStore = cookies();
		const token = cookieStore.get("token")?.value;

		if (!token) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const response = await fetch(`${API_URL}/api/products/${params.id}`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		if (!response.ok) {
			return NextResponse.json(
				{ error: "Failed to fetch product details" },
				{ status: response.status }
			);
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error fetching product:", error);
		return NextResponse.json(
			{ error: "Failed to fetch product details" },
			{ status: 500 }
		);
	}
}
