import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; letterId: string }> }
) {
  const params = await props.params;
  try {
    const token = request.headers.get('authorization');
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
        { status: 401 }
      );
    }

    const { id: loanId, letterId } = params;

    if (!loanId || !letterId) {
      return NextResponse.json(
        { success: false, message: 'Loan ID and letter id are required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    const response = await fetch(`${backendUrl}/api/admin/loans/${loanId}/pdf-letters/${letterId}/download`, {
      method: 'GET',
      headers: {
        'Authorization': token,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to download PDF letter' }));
      return NextResponse.json(
        { success: false, message: errorData.message || 'Failed to download PDF letter' },
        { status: response.status }
      );
    }

    const pdfBuffer = await response.arrayBuffer();
    const fromBackend = response.headers.get('Content-Disposition');
    const contentDisposition = fromBackend || `attachment; filename="letter.pdf"`;
    
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition,
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('Error in download PDF letters API route:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
