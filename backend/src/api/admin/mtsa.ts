import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { signingConfig } from '../../lib/config';
import { getS3ObjectStream } from '../../lib/storage';

const router = Router();

/** Convert KYC image URL/key to base64 (data:, S3 key, or HTTP URL). */
async function imageUrlOrKeyToBase64(urlOrKey: string): Promise<string> {
  if (urlOrKey.startsWith('data:image/') || urlOrKey.startsWith('data:')) {
    const commaIndex = urlOrKey.indexOf(',');
    if (commaIndex !== -1) return urlOrKey.substring(commaIndex + 1);
  }
  if (/^[A-Za-z0-9+/=]+$/.test(urlOrKey) && urlOrKey.length > 100) {
    return urlOrKey; // Already raw base64
  }
  if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
    const response = await fetch(urlOrKey);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    return Buffer.from(await response.arrayBuffer()).toString('base64');
  }
  const { stream } = await getS3ObjectStream(urlOrKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('base64');
}

/** Normalize UserID per MTSA spec: 12-digit NRIC without dashes/spaces */
function normalizeUserId(userId: string): string {
  return String(userId || '').replace(/[\s-]/g, '');
}

// Import permissions system
import { requireAdminOrAttestor } from '../../lib/permissions';

// Admin or Attestor middleware for MTSA operations
const adminOrAttestorMiddleware = requireAdminOrAttestor;

/**
 * @swagger
 * /api/admin/mtsa/cert-info/{userId}:
 *   get:
 *     summary: Get certificate information for a user (admin only)
 *     tags: [Admin, MTSA]
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
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to get certificate information
 */
router.get('/cert-info/:userId', authenticateToken, adminOrAttestorMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const normalizedUserId = normalizeUserId(userId);
    console.log('Admin getting certificate info for user:', { userId: normalizedUserId, adminUserId: req.user?.userId });

    // Make request to signing orchestrator
    const response = await fetch(`${signingConfig.url}/api/cert/${normalizedUserId}`, {
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
 * /api/admin/mtsa/verify-cert-pin:
 *   post:
 *     summary: Verify certificate PIN (admin only)
 *     tags: [Admin, MTSA]
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
 *               - certSerialNo
 *               - certPin
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID (IC number)
 *               certSerialNo:
 *                 type: string
 *                 description: Certificate serial number
 *               certPin:
 *                 type: string
 *                 description: 8-digit certificate PIN
 *     responses:
 *       200:
 *         description: PIN verification processed successfully
 *       400:
 *         description: Invalid request parameters
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to verify PIN
 */
router.post('/verify-cert-pin', authenticateToken, adminOrAttestorMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, certSerialNo, certPin } = req.body;
    
    if (!userId || !certSerialNo || !certPin) {
      return res.status(400).json({
        success: false,
        message: 'User ID, certificate serial number, and PIN are required'
      });
    }

    if (!/^\d{8}$/.test(certPin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 8 digits'
      });
    }

    console.log('Admin verifying certificate PIN for user:', { 
      userId, 
      certSerialNo: certSerialNo.slice(0, 8) + '...', // Partial log for security
      adminUserId: req.user?.userId 
    });

    // Make request to signing orchestrator
    const response = await fetch(`${signingConfig.url}/api/verify-cert-pin`, {
      method: 'POST',
      headers: {
        'X-API-Key': signingConfig.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        certSerialNo,
        pin: certPin
      }),
    });

    const data = await response.json();
    
    console.log('PIN verification response:', { 
      userId, 
      success: data.success,
      statusCode: data.data?.statusCode,
      pinVerified: data.data?.pinVerified
    });

    return res.json(data);
  } catch (error) {
    console.error('Error verifying certificate PIN:', { 
      error: error instanceof Error ? error.message : String(error),
      userId: req.body.userId 
    });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to verify certificate PIN'
    });
  }
});

/**
 * @swagger
 * /api/admin/mtsa/reset-cert-pin:
 *   post:
 *     summary: Reset certificate PIN (admin only)
 *     tags: [Admin, MTSA]
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
 *               - certSerialNo
 *               - newPin
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID (IC number)
 *               certSerialNo:
 *                 type: string
 *                 description: Certificate serial number
 *               newPin:
 *                 type: string
 *                 description: New 8-digit PIN
 *     responses:
 *       200:
 *         description: PIN reset processed successfully
 *       400:
 *         description: Invalid request parameters
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to reset PIN
 */
router.post('/reset-cert-pin', authenticateToken, adminOrAttestorMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, certSerialNo, newPin } = req.body;
    
    if (!userId || !certSerialNo || !newPin) {
      return res.status(400).json({
        success: false,
        message: 'User ID, certificate serial number, and new PIN are required'
      });
    }

    if (!/^\d{8}$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        message: 'New PIN must be exactly 8 digits'
      });
    }

    console.log('Admin resetting certificate PIN for user:', { 
      userId, 
      certSerialNo: certSerialNo.slice(0, 8) + '...', // Partial log for security
      adminUserId: req.user?.userId 
    });

    // Make request to signing orchestrator
    const response = await fetch(`${signingConfig.url}/api/reset-cert-pin`, {
      method: 'POST',
      headers: {
        'X-API-Key': signingConfig.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        certSerialNo,
        newPin
      }),
    });

    const data = await response.json();
    
    console.log('PIN reset response:', { 
      userId, 
      success: data.success,
      statusCode: data.data?.statusCode
    });

    return res.json(data);
  } catch (error) {
    console.error('Error resetting certificate PIN:', { 
      error: error instanceof Error ? error.message : String(error),
      userId: req.body.userId 
    });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to reset certificate PIN'
    });
  }
});

/**
 * @swagger
 * /api/admin/mtsa/request-otp:
 *   post:
 *     summary: Request OTP for certificate enrollment (admin only)
 *     tags: [Admin, MTSA]
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
 *               - emailAddress
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID (IC number)
 *               usage:
 *                 type: string
 *                 enum: [NU, DS]
 *                 description: OTP usage type (NU for new user, DS for digital signing)
 *               emailAddress:
 *                 type: string
 *                 description: Email address to send OTP to
 *     responses:
 *       200:
 *         description: OTP request processed successfully
 *       400:
 *         description: Invalid request parameters
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to request OTP
 */
router.post('/request-otp', authenticateToken, adminOrAttestorMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, usage, emailAddress } = req.body;
    
    if (!userId || !usage || !emailAddress) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: userId, usage, emailAddress'
      });
    }

    const normalizedUserId = normalizeUserId(userId);
    console.log('Admin requesting OTP for user:', { 
      userId: normalizedUserId, 
      usage, 
      emailAddress,
      adminUserId: req.user?.userId 
    });

    // Make request to signing orchestrator
    const response = await fetch(`${signingConfig.url}/api/otp`, {
      method: 'POST',
      headers: {
        'X-API-Key': signingConfig.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: normalizedUserId,
        usage,
        emailAddress,
        requestedBy: 'admin',
        adminUserId: req.user?.userId
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
      userId: req.body.userId 
    });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to request OTP'
    });
  }
});

/**
 * @swagger
 * /api/admin/mtsa/request-certificate:
 *   post:
 *     summary: Request digital certificate enrollment (admin only)
 *     tags: [Admin, MTSA]
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
 *                 description: Nationality code (default: MY)
 *               userType:
 *                 type: string
 *                 description: User type (default: 2 for internal users)
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
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to request certificate
 */
router.post('/request-certificate', authenticateToken, adminOrAttestorMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      userId, 
      fullName, 
      emailAddress, 
      mobileNo, 
      nationality = 'MY', 
      userType = '2', // Default to internal user type for admin requests
      idType = 'N', 
      authFactor, 
      nricFrontUrl, 
      nricBackUrl, 
      selfieImageUrl,
      organisationInfo,
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

    // Validate organisation info for internal users (userType = 2)
    if (userType === '2' && !organisationInfo) {
      return res.status(400).json({
        success: false,
        message: 'Organisation information is required for internal users'
      });
    }

    const normalizedUserId = normalizeUserId(userId);
    console.log('Admin requesting certificate enrollment for user:', { 
      userId: normalizedUserId, 
      fullName, 
      emailAddress,
      userType,
      hasNricFront: !!nricFrontUrl,
      hasNricBack: !!nricBackUrl,
      hasSelfie: !!selfieImageUrl,
      adminUserId: req.user?.userId,
      verificationData
    });

    // Convert KYC image URLs/keys to base64 (handles data:, S3 keys, HTTP URLs)
    const [nricFrontBase64, nricBackBase64, selfieImageBase64] = await Promise.all([
      imageUrlOrKeyToBase64(nricFrontUrl),
      imageUrlOrKeyToBase64(nricBackUrl),
      imageUrlOrKeyToBase64(selfieImageUrl),
    ]);

    console.log('Base64 data extracted:', {
      nricFrontLength: nricFrontBase64.length,
      nricBackLength: nricBackBase64.length,
      selfieLength: selfieImageBase64.length
    });

    // Make request to signing orchestrator with userType = 2 for internal users
    const response = await fetch(`${signingConfig.url}/api/certificate`, {
      method: 'POST',
      headers: {
        'X-API-Key': signingConfig.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: normalizedUserId,
        fullName,
        emailAddress,
        mobileNo,
        nationality,
        userType, // Will be 2 for internal users
        idType,
        authFactor,
        nricFront: nricFrontBase64,
        nricBack: nricBackBase64,
        selfieImage: selfieImageBase64,
        ...(organisationInfo && { organisationInfo }), // Include organisation info for internal users
        verificationData: {
          ...verificationData,
          requestedBy: 'admin',
          adminUserId: req.user?.userId
        }
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

/**
 * @swagger
 * /api/admin/mtsa/revoke-certificate:
 *   post:
 *     summary: Revoke digital certificate (admin only)
 *     tags: [Admin, MTSA]
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
 *               - certSerialNo
 *               - revokeReason
 *               - revokeBy
 *               - authFactor
 *               - idType
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID (IC number)
 *               certSerialNo:
 *                 type: string
 *                 description: Certificate serial number
 *               revokeReason:
 *                 type: string
 *                 enum: [keyCompromise, CACompromise, affiliationChanged, superseded, cessationOfOperation]
 *                 description: Reason for certificate revocation
 *               revokeBy:
 *                 type: string
 *                 enum: [Admin, Self]
 *                 description: Who requested the revocation
 *               authFactor:
 *                 type: string
 *                 description: Email OTP code for authentication
 *               idType:
 *                 type: string
 *                 enum: [N, P]
 *                 description: Identity type (N for NRIC, P for Passport)
 *               nricFrontUrl:
 *                 type: string
 *                 description: Base64 data URL of NRIC front image (required if idType = N)
 *               nricBackUrl:
 *                 type: string
 *                 description: Base64 data URL of NRIC back image (required if idType = N)
 *               passportImageUrl:
 *                 type: string
 *                 description: Base64 data URL of passport image (required if idType = P)
 *     responses:
 *       200:
 *         description: Certificate revocation processed successfully
 *       400:
 *         description: Invalid request parameters or missing required images
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to revoke certificate
 */
router.post('/revoke-certificate', authenticateToken, adminOrAttestorMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      userId, 
      certSerialNo, 
      revokeReason, 
      revokeBy = 'Self', 
      authFactor, 
      idType = 'N', 
      nricFrontUrl, 
      nricBackUrl, 
      passportImageUrl 
    } = req.body;

    // Validate required fields
    if (!userId || !certSerialNo || !revokeReason || !authFactor) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: userId, certSerialNo, revokeReason, authFactor'
      });
    }

    // Validate revoke reason
    const validRevokeReasons = ['keyCompromise', 'CACompromise', 'affiliationChanged', 'superseded', 'cessationOfOperation'];
    if (!validRevokeReasons.includes(revokeReason)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid revoke reason. Valid values: ' + validRevokeReasons.join(', ')
      });
    }

    // Validate revokeBy
    if (!['Admin', 'Self'].includes(revokeBy)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid revokeBy value. Valid values: Admin, Self'
      });
    }

    // Validate idType and required images
    if (idType === 'N' && (!nricFrontUrl || !nricBackUrl)) {
      return res.status(400).json({
        success: false,
        message: 'NRIC front and back images are required when idType is N'
      });
    }

    if (idType === 'P' && !passportImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Passport image is required when idType is P'
      });
    }

    const normalizedUserId = normalizeUserId(userId);
    console.log('Admin revoking certificate for user:', { 
      userId: normalizedUserId, 
      certSerialNo, 
      revokeReason, 
      revokeBy, 
      idType,
      adminUserId: req.user?.userId 
    });

    // Prepare revocation data
    const revocationData: any = {
      userId: normalizedUserId,
      certSerialNo,
      revokeReason,
      revokeBy,
      authFactor,
      idType,
      verificationData: {
        verifyStatus: 'Approved',
        verifyDatetime: new Date().toISOString().replace('T', ' ').substring(0, 19), // Format: yyyy-MM-dd HH:mm:ss
        verifyVerifier: 'CTOS',
        verifyMethod: 'e-KYC'
      },
      requestedBy: 'admin',
      adminUserId: req.user?.userId
    };

    // Add appropriate images based on idType (convert URLs/keys to base64)
    if (idType === 'N') {
      [revocationData.nricFront, revocationData.nricBack] = await Promise.all([
        imageUrlOrKeyToBase64(nricFrontUrl!),
        imageUrlOrKeyToBase64(nricBackUrl!),
      ]);
    } else if (idType === 'P') {
      revocationData.passportImage = await imageUrlOrKeyToBase64(passportImageUrl!);
    }

    console.log('Revocation data prepared:', {
      userId: normalizedUserId,
      certSerialNo,
      revokeReason,
      revokeBy,
      idType,
      hasNricFront: idType === 'N' && !!revocationData.nricFront,
      hasNricBack: idType === 'N' && !!revocationData.nricBack,
      hasPassport: idType === 'P' && !!revocationData.passportImage,
      adminUserId: req.user?.userId
    });

    // Make request to signing orchestrator
    const response = await fetch(`${signingConfig.url}/api/revoke`, {
      method: 'POST',
      headers: {
        'X-API-Key': signingConfig.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(revocationData),
    });

    const data = await response.json();
    
    console.log('Certificate revocation response:', { 
      userId: normalizedUserId, 
      certSerialNo,
      statusCode: data.data?.statusCode,
      success: data.success,
      message: data.message 
    });

    return res.json(data);
  } catch (error) {
    console.error('Error revoking certificate:', { 
      error: error instanceof Error ? error.message : String(error),
      userId: req.body.userId,
      certSerialNo: req.body.certSerialNo 
    });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to revoke certificate'
    });
  }
});

export default router;
