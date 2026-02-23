import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization');
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { applicationId, pin, signatoryType } = body;
    const normalizedSignatoryType = String(signatoryType || "").trim().toUpperCase();

    // Validate required fields
    if (!applicationId || !pin || !normalizedSignatoryType) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: applicationId, pin, signatoryType' },
        { status: 400 }
      );
    }

    if (!["COMPANY", "WITNESS"].includes(normalizedSignatoryType)) {
      return NextResponse.json(
        { success: false, message: 'Only company and witness can sign in admin portal' },
        { status: 400 }
      );
    }

    // Forward request to backend API
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    const response = await fetch(`${backendUrl}/api/admin/applications/pin-sign`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        applicationId,
        pin,
        signatoryType: normalizedSignatoryType
      }),
    });
    
    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Error in pin-sign API route:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
