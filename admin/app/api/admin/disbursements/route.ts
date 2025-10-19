import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/admin/disbursements`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch disbursements' },
      { status: 500 }
    );
  }
}

