import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function POST(
	req: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const cookieStore = cookies();
		const token = cookieStore.get("token")?.value;

		if (!token) {
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}

		const formData = await req.formData();
		const response = await fetch(
			`${API_URL}/api/loan-applications/${params.id}/documents`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
				},
				body: formData,
			}
		);

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		console.error("Error uploading documents:", error);
		return NextResponse.json(
			{ message: "Failed to upload documents" },
			{ status: 500 }
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const cookieStore = cookies();
		const token = cookieStore.get("token")?.value;

		if (!token) {
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}

		const response = await fetch(
			`${API_URL}/api/loan-applications/${params.id}/documents`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
			}
		);

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		console.error("Error fetching documents:", error);
		return NextResponse.json(
			{ message: "Failed to fetch documents" },
			{ status: 500 }
		);
	}
}
