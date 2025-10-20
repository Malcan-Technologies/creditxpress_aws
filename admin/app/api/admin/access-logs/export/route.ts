import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("adminToken")?.value || "";
    const searchParams = request.nextUrl.searchParams;

    const response = await fetch(
      `${API_URL}/api/admin/access-logs/export?${searchParams.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const data = await response.json();
      return NextResponse.json(
        { error: data.error || "Failed to export access logs" },
        { status: response.status }
      );
    }

    // Forward the CSV response
    const csv = await response.text();
    
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": response.headers.get("Content-Disposition") || "attachment; filename=access-logs.csv",
      },
    });
  } catch (error) {
    console.error("Access logs export API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

