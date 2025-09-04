import { NextRequest, NextResponse } from 'next/server';

const SIGNING_ORCHESTRATOR_URL = process.env.SIGNING_ORCHESTRATOR_URL || 'http://localhost:4010';
const SIGNING_ORCHESTRATOR_API_KEY = process.env.SIGNING_ORCHESTRATOR_API_KEY || process.env.DOCUSEAL_API_TOKEN || 'NwPkizAUEfShnc4meN1m3N38DG8ZNEyRmWPMjq8BXv8';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, otp, fullName, emailAddress, mobileNo, nationality, userType } = body;

    if (!userId || !otp) {
      return NextResponse.json(
        { success: false, message: 'User ID and OTP are required' },
        { status: 400 }
      );
    }

    // Prepare the enrollment/verification request
    const requestData = {
      signerInfo: {
        userId,
        fullName: fullName || '',
        emailAddress: emailAddress || '',
        mobileNo: mobileNo || '',
        nationality: nationality || 'MY',
        userType: userType || 1,
      },
      verificationData: {
        status: 'verified',
        datetime: new Date().toISOString(),
        verifier: 'frontend_otp_verification',
        method: 'otp_verification',
        evidence: {
          otpVerified: true,
        },
      },
      otp,
    };

    // Call the signing orchestrator API for enrollment/verification
    const response = await fetch(`${SIGNING_ORCHESTRATOR_URL}/enroll`, {
      method: 'POST',
      headers: {
        'X-API-Key': SIGNING_ORCHESTRATOR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    const data = await response.json();

    if (response.ok) {
      return NextResponse.json(data);
    } else {
      return NextResponse.json(
        { success: false, message: data.message || 'OTP verification failed' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
