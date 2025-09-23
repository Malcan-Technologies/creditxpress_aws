import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization');
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
        { status: 401 }
      );
    }

    // Forward request to backend API with cache-busting
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    const timestamp = Date.now();
    const response = await fetch(`${backendUrl}/api/admin/company-settings?_t=${timestamp}`, {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    const data = await response.json();
    
    // Return response with cache-busting headers
    return NextResponse.json(data, { 
      status: response.status,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Error in company-settings GET API route:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization');
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Forward request to backend API with cache-busting
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    const response = await fetch(`${backendUrl}/api/admin/company-settings`, {
      method: 'PUT',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    // Return response with cache-busting headers
    return NextResponse.json(data, { 
      status: response.status,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Error in company-settings PUT API route:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization');
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Forward request to backend API with cache-busting
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    const response = await fetch(`${backendUrl}/api/admin/company-settings`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    // Return response with cache-busting headers
    return NextResponse.json(data, { 
      status: response.status,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Error in company-settings POST API route:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
