import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { 
      userId, 
      fullName, 
      emailAddress, 
      mobileNo, 
      nationality = 'MY',
      userType = '2', // Internal user type for admin users
      idType = 'N',
      authFactor,
      nricFrontUrl,
      nricBackUrl,
      selfieImageUrl,
      verificationData
    } = body;

    if (!userId || !fullName || !emailAddress || !mobileNo || !authFactor) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: userId, fullName, emailAddress, mobileNo, authFactor' },
        { status: 400 }
      );
    }

    if (!nricFrontUrl || !nricBackUrl || !selfieImageUrl) {
      return NextResponse.json(
        { success: false, message: 'KYC images are required: nricFrontUrl, nricBackUrl, selfieImageUrl' },
        { status: 400 }
      );
    }

    console.log('Admin requesting certificate enrollment for user:', userId);

    // Forward request to backend admin MTSA API with userType = 2 for internal users
    const response = await fetch(`${BACKEND_URL}/api/admin/mtsa/request-certificate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        fullName,
        emailAddress,
        mobileNo,
        nationality,
        userType, // Will be 2 for internal users
        idType,
        authFactor,
        nricFrontUrl,
        nricBackUrl,
        selfieImageUrl,
        verificationData: {
          ...verificationData,
          requestedBy: 'admin',
          adminUserId: decoded.userId,
        },
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return NextResponse.json(data);
    } else {
      return NextResponse.json(
        { success: false, message: data.message || 'Failed to request certificate' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error requesting certificate:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
