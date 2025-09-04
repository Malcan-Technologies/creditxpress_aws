import { NextRequest, NextResponse } from 'next/server';

const SIGNING_ORCHESTRATOR_URL = process.env.SIGNING_ORCHESTRATOR_URL || 'http://localhost:4010';
const SIGNING_ORCHESTRATOR_API_KEY = process.env.SIGNING_ORCHESTRATOR_API_KEY || process.env.DOCUSEAL_API_TOKEN || 'NwPkizAUEfShnc4meN1m3N38DG8ZNEyRmWPMjq8BXv8';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, usage, emailAddress } = body;

    if (!userId || !usage) {
      return NextResponse.json(
        { success: false, message: 'User ID and usage are required' },
        { status: 400 }
      );
    }

    if (!['DS', 'NU'].includes(usage)) {
      return NextResponse.json(
        { success: false, message: 'Invalid usage. Must be DS (digital signing) or NU (new enrollment)' },
        { status: 400 }
      );
    }

    if (usage === 'NU' && !emailAddress) {
      return NextResponse.json(
        { success: false, message: 'Email address is required for new enrollment' },
        { status: 400 }
      );
    }

    // Call the signing orchestrator API
    const response = await fetch(`${SIGNING_ORCHESTRATOR_URL}/otp`, {
      method: 'POST',
      headers: {
        'X-API-Key': SIGNING_ORCHESTRATOR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        usage,
        emailAddress,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return NextResponse.json(data);
    } else {
      return NextResponse.json(
        { success: false, message: data.message || 'Failed to send OTP' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error requesting OTP:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
