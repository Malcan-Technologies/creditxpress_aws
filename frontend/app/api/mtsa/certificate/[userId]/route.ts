import { NextRequest, NextResponse } from 'next/server';

const SIGNING_ORCHESTRATOR_URL = process.env.SIGNING_ORCHESTRATOR_URL || 'http://localhost:4010';
const SIGNING_ORCHESTRATOR_API_KEY = process.env.SIGNING_ORCHESTRATOR_API_KEY || process.env.DOCUSEAL_API_TOKEN || 'NwPkizAUEfShnc4meN1m3N38DG8ZNEyRmWPMjq8BXv8';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log(`Checking certificate for user: ${userId}`);
    console.log(`Signing orchestrator URL: ${SIGNING_ORCHESTRATOR_URL}`);
    console.log(`Using API key: ${SIGNING_ORCHESTRATOR_API_KEY ? 'Present' : 'Missing'}`);

    // Call the signing orchestrator API to check certificate
    const url = `${SIGNING_ORCHESTRATOR_URL}/cert/${userId}`;
    console.log(`Making request to: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': SIGNING_ORCHESTRATOR_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Response status: ${response.status}`);
    console.log(`Response ok: ${response.ok}`);
    
    const data = await response.json();
    console.log(`Certificate check response for ${userId}:`, JSON.stringify(data, null, 2));

    if (response.ok) {
      return NextResponse.json(data);
    } else {
      return NextResponse.json(
        { success: false, message: data.message || 'Failed to check certificate' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error checking certificate:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}