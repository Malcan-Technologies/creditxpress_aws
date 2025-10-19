import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ id: string }> }
) {
	try {
		const params = await context.params;
		const { id } = params;
		
		// Get token from cookies
		const cookieStore = await cookies();
		const token = cookieStore.get("token")?.value;
		
		console.log('🔐 Unsigned agreement request:', {
			applicationId: id,
			hasToken: !!token,
			tokenPreview: token ? `${token.substring(0, 20)}...` : 'none'
		});
		
		if (!token) {
			console.error('❌ No authentication token found in cookies');
			return NextResponse.json(
				{ success: false, message: "No authentication token provided" },
				{ status: 401 }
			);
		}

		const backendUrl = `${API_URL}/api/loan-applications/${id}/unsigned-agreement`;
		console.log('📡 Calling backend:', backendUrl);

		const response = await fetch(backendUrl, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		console.log('📥 Backend response status:', response.status);

		if (!response.ok) {
			const data = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
			console.error('❌ Backend error:', data);
			return NextResponse.json(
				data,
				{ status: response.status }
			);
		}

		// Backend returns JSON with DocuSeal URL, not PDF
		const data = await response.json();
		console.log('✅ Success, returning URL:', data.url);
		
		return NextResponse.json(data, {
			status: 200,
		});
	} catch (error) {
		console.error("Error downloading unsigned agreement:", error);
		return NextResponse.json(
			{
				success: false,
				message: "Error downloading unsigned agreement",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

