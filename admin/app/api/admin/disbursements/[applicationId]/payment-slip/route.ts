import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { applicationId: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/admin/disbursements/${params.applicationId}/payment-slip`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: 'Payment slip not found' },
        { status: 404 }
      );
    }

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="disbursement-slip-${params.applicationId}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to download payment slip' },
      { status: 500 }
    );
  }
}

