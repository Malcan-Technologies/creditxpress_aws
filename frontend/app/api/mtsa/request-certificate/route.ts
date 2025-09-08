import { NextRequest, NextResponse } from 'next/server';

const SIGNING_ORCHESTRATOR_URL = process.env.SIGNING_ORCHESTRATOR_URL || 'http://localhost:4010';
const SIGNING_ORCHESTRATOR_API_KEY = process.env.SIGNING_ORCHESTRATOR_API_KEY || process.env.DOCUSEAL_API_TOKEN || 'NwPkizAUEfShnc4meN1m3N38DG8ZNEyRmWPMjq8BXv8';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userId, 
      fullName, 
      emailAddress, 
      mobileNo, 
      nationality = 'MY',
      userType = '1', 
      idType = 'N',
      authFactor,
      nricFront,
      nricBack,
      selfieImage,
      nricFrontUrl,
      nricBackUrl,
      selfieImageUrl,
      passportImage,
      organisationInfo,
      verificationData
    } = body;

    if (!userId || !fullName || !emailAddress || !mobileNo || !authFactor || !verificationData) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: userId, fullName, emailAddress, mobileNo, authFactor, verificationData' },
        { status: 400 }
      );
    }

    // Helper function to convert image URL to base64
    const urlToBase64 = async (url: string): Promise<string> => {
      try {
        // Check if URL is already a base64 data URL (from CTOS)
        if (url.startsWith('data:image/')) {
          // Extract base64 part from data URL: "data:image/jpeg;base64,actualBase64Data"
          const base64Part = url.split(',')[1];
          if (!base64Part) {
            throw new Error('Invalid base64 data URL format');
          }
          console.log('Using existing base64 data from CTOS');
          return base64Part;
        }
        
        // Legacy flow: Convert file URL to base64
        console.log('Converting file URL to base64 (legacy flow)');
        // Remove leading slash and construct full path
        const imagePath = url.startsWith('/') ? url.substring(1) : url;
        // Use direct backend URL for server-side image fetching (bypasses nginx)
        const backendUrl = process.env.NODE_ENV === 'production' ? 'http://127.0.0.1:4001' : 'http://localhost:4001';
        const fullPath = `${backendUrl}/${imagePath}`;
        
        const response = await fetch(fullPath);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return base64;
      } catch (error) {
        console.error(`Error converting URL ${url} to base64:`, error);
        throw error;
      }
    };

    // Convert URLs to base64 if provided
    let finalNricFront = nricFront;
    let finalNricBack = nricBack;
    let finalSelfieImage = selfieImage;

    if (nricFrontUrl && !nricFront) {
      finalNricFront = await urlToBase64(nricFrontUrl);
    }
    
    if (nricBackUrl && !nricBack) {
      finalNricBack = await urlToBase64(nricBackUrl);
    }
    
    if (selfieImageUrl && !selfieImage) {
      finalSelfieImage = await urlToBase64(selfieImageUrl);
    }

    // Call the signing orchestrator API
    const response = await fetch(`${SIGNING_ORCHESTRATOR_URL}/certificate`, {
      method: 'POST',
      headers: {
        'X-API-Key': SIGNING_ORCHESTRATOR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        fullName,
        emailAddress,
        mobileNo,
        nationality,
        userType,
        idType,
        authFactor,
        nricFront: finalNricFront,
        nricBack: finalNricBack,
        selfieImage: finalSelfieImage,
        passportImage,
        organisationInfo,
        verificationData,
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
