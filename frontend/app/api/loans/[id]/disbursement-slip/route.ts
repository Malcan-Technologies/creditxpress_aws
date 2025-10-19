import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Call the user-facing backend endpoint directly
    const slipResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/loans/${params.id}/download-disbursement-slip`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!slipResponse.ok) {
      const errorData = await slipResponse.json();
      return NextResponse.json(
        errorData,
        { status: slipResponse.status }
      );
    }

    // Forward the PDF blob
    const blob = await slipResponse.blob();
    const headers = new Headers(slipResponse.headers);
    
    return new NextResponse(blob, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('❌ Error downloading disbursement slip:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Failed to download payment slip',
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
