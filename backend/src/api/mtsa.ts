import { Router } from 'express';
import { authenticateAndVerifyPhone, AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { signingConfig } from '../lib/config';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: MTSA
 *   description: MyTrustSigner Agent integration for digital certificates and OTP
 */

/**
 * @swagger
 * /api/mtsa/cert-info/{userId}:
 *   get:
 *     summary: Get certificate information for a user
 *     tags: [MTSA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID (IC number)
 *     responses:
 *       200:
 *         description: Certificate information retrieved successfully
 *       400:
 *         description: User ID is required
 *       500:
 *         description: Failed to get certificate information
 */
router.get('/cert-info/:userId', authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    console.log('Getting certificate info for user:', { userId });

    // Make request to signing orchestrator
    const response = await fetch(`${signingConfig.url}/api/cert/${userId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': signingConfig.apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    console.log('Certificate info response:', { 
      userId, 
      statusCode: data.data?.statusCode,
      success: data.success 
    });

    return res.json(data);
  } catch (error) {
    console.error('Error getting certificate info:', { 
      error: error instanceof Error ? error.message : String(error),
      userId: req.params.userId 
    });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get certificate information'
    });
  }
});

/**
 * @swagger
 * /api/mtsa/request-otp:
 *   post:
 *     summary: Request OTP for certificate enrollment or digital signing
 *     tags: [MTSA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - usage
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID (IC number)
 *               usage:
 *                 type: string
 *                 enum: [DS, NU]
 *                 description: DS for digital signing, NU for new enrollment
 *               emailAddress:
 *                 type: string
 *                 description: Email address (required for NU)
 *     responses:
 *       200:
 *         description: OTP request sent successfully
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Failed to request OTP
 */
router.post('/request-otp', authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, usage, emailAddress } = req.body;

    // Validate required fields
    if (!userId || !usage) {
      return res.status(400).json({
        success: false,
        message: 'User ID and usage type are required'
      });
    }

    if (!['DS', 'NU'].includes(usage)) {
      return res.status(400).json({
        success: false,
        message: 'Usage must be DS (digital signing) or NU (new enrollment)'
      });
    }

    if (usage === 'NU' && !emailAddress) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required for new enrollment (NU)'
      });
    }

    console.log('Requesting OTP for user:', { userId, usage, hasEmail: !!emailAddress });

    // Make request to signing orchestrator
    const response = await fetch(`${signingConfig.url}/api/otp`, {
      method: 'POST',
      headers: {
        'X-API-Key': signingConfig.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        usage,
        emailAddress,
      }),
    });

    const data = await response.json();
    
    console.log('OTP request response:', { 
      userId, 
      usage,
      statusCode: data.data?.statusCode,
      success: data.success 
    });

    return res.json(data);
  } catch (error) {
    console.error('Error requesting OTP:', { 
      error: error instanceof Error ? error.message : String(error),
      userId: req.body.userId,
      usage: req.body.usage 
    });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to request OTP'
    });
  }
});

/**
 * @swagger
 * /api/mtsa/verify-otp:
 *   post:
 *     summary: Verify OTP for digital signing
 *     tags: [MTSA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - otp
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID (IC number)
 *               otp:
 *                 type: string
 *                 description: 6-digit OTP code
 *     responses:
 *       200:
 *         description: OTP verification completed
 *       400:
 *         description: Invalid OTP or missing parameters
 *       500:
 *         description: Failed to verify OTP
 */
router.post('/verify-otp', authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'User ID and OTP are required'
      });
    }

    console.log('Verifying OTP for user:', { userId, otpLength: otp.length });

    // Make request to signing orchestrator
    const response = await fetch(`${signingConfig.url}/api/verify-pin`, {
      method: 'POST',
      headers: {
        'X-API-Key': signingConfig.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        otp,
      }),
    });

    const data = await response.json();
    
    console.log('OTP verification response:', { 
      userId, 
      statusCode: data.data?.statusCode,
      success: data.success,
      pinVerified: data.data?.pinVerified 
    });

    return res.json(data);
  } catch (error) {
    console.error('Error verifying OTP:', { 
      error: error instanceof Error ? error.message : String(error),
      userId: req.body.userId 
    });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
});

/**
 * @swagger
 * /api/mtsa/request-certificate:
 *   post:
 *     summary: Request digital certificate enrollment with KYC images
 *     tags: [MTSA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - fullName
 *               - emailAddress
 *               - mobileNo
 *               - authFactor
 *               - nricFrontUrl
 *               - nricBackUrl
 *               - selfieImageUrl
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID (IC number)
 *               fullName:
 *                 type: string
 *                 description: Full name
 *               emailAddress:
 *                 type: string
 *                 description: Email address
 *               mobileNo:
 *                 type: string
 *                 description: Mobile number
 *               nationality:
 *                 type: string
 *                 description: "Nationality code (default: MY)"
 *               userType:
 *                 type: string
 *                 description: "User type (default: 1)"
 *               idType:
 *                 type: string
 *                 description: ID type (N for NRIC, P for Passport)
 *               authFactor:
 *                 type: string
 *                 description: OTP code for authentication
 *               nricFrontUrl:
 *                 type: string
 *                 description: Base64 data URL of NRIC front image
 *               nricBackUrl:
 *                 type: string
 *                 description: Base64 data URL of NRIC back image
 *               selfieImageUrl:
 *                 type: string
 *                 description: Base64 data URL of selfie image
 *               verificationData:
 *                 type: object
 *                 description: Verification metadata
 *     responses:
 *       200:
 *         description: Certificate request processed successfully
 *       400:
 *         description: Invalid request parameters or missing KYC images
 *       500:
 *         description: Failed to request certificate
 */
router.post('/request-certificate', authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      userId, 
      fullName, 
      emailAddress, 
      mobileNo, 
      nationality = 'MY', 
      userType = '1', 
      idType = 'N', 
      authFactor, 
      nricFrontUrl, 
      nricBackUrl, 
      selfieImageUrl, 
      verificationData 
    } = req.body;

    // Validate required fields
    if (!userId || !fullName || !emailAddress || !authFactor) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: userId, fullName, emailAddress, authFactor'
      });
    }

    if (!nricFrontUrl || !nricBackUrl || !selfieImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'KYC images are required: nricFrontUrl, nricBackUrl, selfieImageUrl'
      });
    }

    console.log('Requesting certificate enrollment for user:', { 
      userId, 
      fullName, 
      emailAddress,
      hasNricFront: !!nricFrontUrl,
      hasNricBack: !!nricBackUrl,
      hasSelfie: !!selfieImageUrl
    });

    // Helper function to extract base64 data from data URL
    const extractBase64Data = (dataUrl: string): string => {
      if (dataUrl.startsWith('data:')) {
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex !== -1) {
          return dataUrl.substring(commaIndex + 1);
        }
      }
      // If not a data URL, assume it's already base64 data
      return dataUrl;
    };

    // Extract base64 data from URLs (remove data:image/jpeg;base64, prefix)
    const nricFrontBase64 = extractBase64Data(nricFrontUrl);
    const nricBackBase64 = extractBase64Data(nricBackUrl);
    const selfieImageBase64 = extractBase64Data(selfieImageUrl);

    console.log('Base64 data extracted:', {
      nricFrontLength: nricFrontBase64.length,
      nricBackLength: nricBackBase64.length,
      selfieLength: selfieImageBase64.length
    });

    // Make request to signing orchestrator with correct field names
    const response = await fetch(`${signingConfig.url}/api/certificate`, {
      method: 'POST',
      headers: {
        'X-API-Key': signingConfig.apiKey,
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
        nricFront: nricFrontBase64,      // Correct field name
        nricBack: nricBackBase64,        // Correct field name
        selfieImage: selfieImageBase64,  // Already correct
        verificationData
      }),
    });

    const data = await response.json();
    
    console.log('Certificate request response:', { 
      userId, 
      statusCode: data.data?.statusCode,
      success: data.success,
      message: data.message 
    });

    return res.json(data);
  } catch (error) {
    console.error('Error requesting certificate:', { 
      error: error instanceof Error ? error.message : String(error),
      userId: req.body.userId 
    });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to request certificate'
    });
  }
});

export default router;
