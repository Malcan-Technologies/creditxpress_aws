import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export async function GET(
  request: NextRequest,
  { params }: { params: { kycId: string } }
) {
  try {
    // Verify admin token
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    
    if (!decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    const { kycId } = params;

    if (!kycId) {
      return NextResponse.json(
        { success: false, message: 'KYC ID is required' },
        { status: 400 }
      );
    }

    console.log('Admin checking KYC status for session:', kycId);

    // Forward request to backend admin KYC API
    const response = await fetch(`${BACKEND_URL}/api/admin/kyc/${kycId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      return NextResponse.json({
        success: true,
        data: {
          id: kycId,
          status: data.status,
          ctosStatus: data.ctosStatus,
          ctosResult: data.ctosResult,
          ctosOnboardingUrl: data.ctosOnboardingUrl,
        }
      });
    } else {
      return NextResponse.json(
        { success: false, message: data.message || 'Failed to get KYC status' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error getting admin KYC status:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
