import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Try to get token from cookies first, then from Authorization header
    const cookieToken = request.cookies.get("adminToken")?.value || "";
    const authHeader = request.headers.get("authorization") || "";
    const headerToken = authHeader.replace("Bearer ", "");
    const token = cookieToken || headerToken;
    
    const searchParams = request.nextUrl.searchParams;

    const response = await fetch(
      `${API_URL}/api/admin/access-logs?${searchParams.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Failed to fetch access logs" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Access logs API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

