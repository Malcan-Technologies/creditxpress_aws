import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;

    // Get loan to find applicationId
    const loanResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/loans/${params.id}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!loanResponse.ok) {
      return NextResponse.json(
        { message: 'Loan not found' },
        { status: 404 }
      );
    }

    const loan = await loanResponse.json();

    // Download disbursement slip
    const slipResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/admin/disbursements/${loan.applicationId}/payment-slip`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!slipResponse.ok) {
      return NextResponse.json(
        { message: 'Payment slip not found' },
        { status: 404 }
      );
    }

    const blob = await slipResponse.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="disbursement-slip.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to download payment slip' },
      { status: 500 }
    );
  }
}

