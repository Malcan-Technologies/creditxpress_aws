import { Router, Response } from 'express';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { truestackService } from '../../lib/truestackService';
import { urlConfig } from '../../lib/config';

const router = Router();

// Import permissions system
import { requireAdminOrAttestor } from '../../lib/permissions';

// Admin or Attestor middleware for KYC operations
const adminOrAttestorMiddleware = requireAdminOrAttestor;

/**
 * @swagger
 * /api/admin/kyc/status:
 *   get:
 *     summary: Get admin user's CTOS KYC status
 *     tags: [Admin, KYC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC status retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to get KYC status
 */
router.get('/status', authenticateToken, adminOrAttestorMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // First check for approved sessions
    const approvedSession = await prisma.kycSession.findFirst({
      where: {
        userId,
        ctosOnboardingId: { not: null },
        ctosResult: 1 // Approved
      },
      orderBy: { createdAt: 'desc' }
    });

    if (approvedSession) {
      console.log(`Admin user ${userId} - Found approved KYC session:`, {
        sessionId: approvedSession.id,
        ctosOnboardingId: approvedSession.ctosOnboardingId,
        status: approvedSession.status
      });

      return res.json({
        success: true,
        hasKycSession: true,
        status: approvedSession.status,
        ctosStatus: approvedSession.ctosStatus,
        ctosResult: approvedSession.ctosResult,
        isAlreadyApproved: true,
        kycSessionId: approvedSession.id
      });
    }

    // Then check for pending/in-progress sessions that can be resumed
    const pendingSession = await prisma.kycSession.findFirst({
      where: {
        userId,
        ctosOnboardingUrl: { not: null }, // Must have onboarding URL to resume
        status: 'IN_PROGRESS' // Must be in progress
      },
      orderBy: { createdAt: 'desc' }
    });

    if (pendingSession) {
      console.log(`Admin user ${userId} - Found pending KYC session:`, {
        sessionId: pendingSession.id,
        ctosOnboardingId: pendingSession.ctosOnboardingId,
        status: pendingSession.status,
        ctosOnboardingUrl: pendingSession.ctosOnboardingUrl
      });

      return res.json({
        success: true,
        hasKycSession: true,
        status: pendingSession.status,
        ctosStatus: pendingSession.ctosStatus,
        ctosResult: pendingSession.ctosResult,
        isAlreadyApproved: false,
        isPending: true,
        canResume: true,
        kycSessionId: pendingSession.id,
        ctosOnboardingUrl: pendingSession.ctosOnboardingUrl
      });
    }

    // No sessions found
    console.log(`Admin user ${userId} - No KYC sessions found`);
    return res.json({
      success: true,
      hasKycSession: false,
      status: null,
      ctosStatus: 0,
      ctosResult: 2,
      isAlreadyApproved: false,
      isPending: false,
      canRetry: true
    });

  } catch (error) {
    console.error('Admin KYC status check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check KYC status'
    });
  }
});

/**
 * @swagger
 * /api/admin/kyc/start-ctos:
 *   post:
 *     summary: Start CTOS eKYC process for admin user
 *     tags: [Admin, KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentName
 *               - documentNumber
 *               - platform
 *             properties:
 *               documentName:
 *                 type: string
 *                 description: Full name as per IC
 *               documentNumber:
 *                 type: string
 *                 description: IC number
 *               platform:
 *                 type: string
 *                 description: Platform (e.g., "web")
 *               adminRequest:
 *                 type: boolean
 *                 description: Flag to indicate admin request
 *               adminUserId:
 *                 type: string
 *                 description: Admin user ID making the request
 *     responses:
 *       200:
 *         description: KYC session started successfully
 *       400:
 *         description: Invalid request parameters
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to start KYC
 */
router.post('/start-ctos', authenticateToken, adminOrAttestorMiddleware, async (req: AuthRequest, res: Response) => {
  let kycSession: any = null;
  
  try {
    const { documentName, documentNumber, platform = 'Web' } = req.body;

    if (!documentName || !documentNumber) {
      return res.status(400).json({
        success: false,
        message: 'Document name and number are required'
      });
    }

    console.log('Admin starting KYC for:', { 
      documentName, 
      documentNumber, 
      platform,
      adminUserId: req.user?.userId
    });

    // Check if admin user already has approved KYC session
    const existingApprovedSession = await prisma.kycSession.findFirst({
      where: {
        userId: req.user?.userId,
        ctosOnboardingId: { not: null },
        ctosResult: 1 // Approved
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Admin user ${req.user?.userId} - Checking for approved KYC sessions:`, {
      found: !!existingApprovedSession,
      sessionId: existingApprovedSession?.id,
      ctosResult: existingApprovedSession?.ctosResult,
      ctosOnboardingId: existingApprovedSession?.ctosOnboardingId
    });

    if (existingApprovedSession) {
      console.log(`Admin user ${req.user?.userId} - Prevented creating new KYC session, already has approved session: ${existingApprovedSession.id}`);
      return res.status(400).json({ 
        success: false,
        message: "You already have an approved KYC verification. No further verification is needed.",
        error: "Admin user already has approved KYC session",
        existingSessionId: existingApprovedSession.id
      });
    }

    // Create KYC session for admin user
    kycSession = await prisma.kycSession.create({
      data: {
        userId: req.user?.userId!,
        status: 'IN_PROGRESS',
        ctosData: {
          adminRequest: true,
          requestedBy: req.user?.userId
        }
      }
    });

    try {
      // Create Truestack session
      console.log('Starting Truestack KYC for admin with params:', {
        ref_id: kycSession.id,
        document_name: documentName,
        document_number: documentNumber,
        platform
      });

      // Build completion URL from centralized config  
      const completionUrl = `${urlConfig.api}/kyc-complete`;

      const truestackResponse = await truestackService.createSession({
        ref_id: kycSession.id,
        document_name: documentName,
        document_number: documentNumber,
        platform,
        redirect_url: completionUrl,
        document_type: '1', // MyKad
        metadata: {
          user_id: req.user?.userId || '',
          admin_request: 'true'
        }
      });

      console.log('Truestack Response received for admin:', truestackResponse);

      // Update KYC session with Truestack data
      let expiresAt: Date | null = null;
      try {
        if (truestackResponse.expires_at) {
          expiresAt = new Date(truestackResponse.expires_at);
          if (isNaN(expiresAt.getTime())) {
            console.warn('Invalid Truestack expires_at date:', truestackResponse.expires_at);
            expiresAt = null;
          }
        }
      } catch (parseError) {
        console.error('Error parsing Truestack expires_at:', parseError);
        expiresAt = null;
      }

      const updatedSession = await prisma.kycSession.update({
        where: { id: kycSession.id },
        data: {
          ctosOnboardingId: truestackResponse.id,
          ctosOnboardingUrl: truestackResponse.onboarding_url,
          ctosStatus: 0, // Not opened yet (pending)
          ctosExpiredAt: expiresAt,
          ctosData: {
            ...kycSession.ctosData,
            rawResponse: truestackResponse
          }
        }
      });

      console.log('Admin KYC session updated:', {
        kycId: updatedSession.id,
        ctosOnboardingId: updatedSession.ctosOnboardingId,
        hasOnboardingUrl: !!updatedSession.ctosOnboardingUrl
      });

      return res.status(201).json({
        success: true,
        kycId: updatedSession.id,
        onboardingUrl: updatedSession.ctosOnboardingUrl,
        onboardingId: updatedSession.ctosOnboardingId,
        expiredAt: truestackResponse.expires_at,
        message: "KYC session started successfully. Complete the verification using the provided URL."
      });

    } catch (truestackError: any) {
      console.error('Truestack Integration Error for admin:', truestackError);
      const errorMessage = truestackError instanceof Error ? truestackError.message : 'Failed to create KYC session';
      
      let errorCode = "500";
      let description = errorMessage;
      
      if (errorMessage.includes("Truestack API Error:")) {
        description = errorMessage.replace("Truestack API Error: ", "");
      }
      
      const failureData = {
        rawResponse: {
          message: "Failed", 
          error_code: errorCode,
          description: description
        },
        requestedBy: req.user?.userId,
        adminRequest: true,
        errorDetails: {
          timestamp: new Date().toISOString(),
          originalError: errorMessage
        }
      };

      if (kycSession) {
        await prisma.kycSession.update({ 
          where: { id: kycSession.id },
          data: {
            status: 'FAILED',
            ctosData: failureData,
            completedAt: new Date()
          }
        });
      }
      
      return res.status(400).json({ 
        message: `KYC Error: ${description}`,
        error: errorMessage,
        kycSessionId: kycSession?.id,
        errorCode: errorCode
      });
    }
  } catch (error) {
    console.error('Admin KYC start error:', error);
    
    if (kycSession?.id) {
      try {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start KYC process';
        const failureData = {
          rawResponse: {
            message: "Failed", 
            error_code: "500",
            description: errorMessage
          },
          requestedBy: req.user?.userId,
          adminRequest: true,
          errorDetails: {
            timestamp: new Date().toISOString(),
            originalError: errorMessage
          }
        };

        await prisma.kycSession.update({ 
          where: { id: kycSession.id },
          data: {
            status: 'FAILED',
            ctosData: failureData,
            completedAt: new Date()
          }
        });
        console.log(`Marked admin KYC session ${kycSession.id} as FAILED`);
      } catch (updateError) {
        console.error('Error updating failed admin KYC session:', updateError);
        try {
          await prisma.kycSession.delete({ where: { id: kycSession.id } });
          console.log(`Deleted failed admin KYC session ${kycSession.id} after update failure`);
        } catch (deleteError) {
          console.error('Error deleting failed admin KYC session:', deleteError);
        }
      }
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to start KYC process';
    return res.status(500).json({ 
      message: 'Failed to create KYC session',
      error: errorMessage
    });
  }
});

/**
 * @swagger
 * /api/admin/kyc/admin-ctos-status:
 *   get:
 *     summary: Get admin user's CTOS KYC status and update database (like user-ctos-status)
 *     tags: [Admin, KYC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC status retrieved and database updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to get KYC status
 */
router.get('/admin-ctos-status', authenticateToken, adminOrAttestorMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    console.log(`🔍 Admin CTOS Status Check - User: ${userId}`);

    // Find the most recent KYC session for this admin user
    const kycSession = await prisma.kycSession.findFirst({
      where: {
        userId,
        ctosOnboardingId: { not: null } // Must have CTOS session
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!kycSession) {
      console.log(`❌ No KYC session found for admin user ${userId}`);
      return res.json({
        success: true,
        hasKycSession: false,
        status: null,
        ctosStatus: 0,
        ctosResult: 2,
        isAlreadyApproved: false,
        canRetry: true
      });
    }

    console.log(`📊 Found admin KYC session ${kycSession.id}: status=${kycSession.status}, ctosStatus=${kycSession.ctosStatus}, ctosResult=${kycSession.ctosResult}`);

    // If already approved, return existing data
    if (kycSession.status === 'APPROVED') {
      console.log(`✅ Admin session ${kycSession.id} already approved`);
      return res.json({
        success: true,
        hasKycSession: true,
        status: kycSession.status,
        ctosStatus: kycSession.ctosStatus,
        ctosResult: kycSession.ctosResult,
        isAlreadyApproved: true,
        kycSessionId: kycSession.id
      });
    }

    // Check if documents already exist in database (webhook might have processed them)
    const existingDocuments = await prisma.kycDocument.findMany({
      where: { kycId: kycSession.id },
      select: { type: true, id: true }
    });

    const hasAllDocuments = ['front', 'back', 'selfie'].every(type =>
      existingDocuments.some(doc => doc.type === type)
    );

    if (hasAllDocuments && kycSession.ctosResult === 1) {
      console.log(`✅ Admin session ${kycSession.id} has all documents and is approved`);
      // Update session status if it's not already marked as approved
      if (kycSession.status !== 'APPROVED') {
        await prisma.kycSession.update({
          where: { id: kycSession.id },
          data: { status: 'APPROVED', completedAt: new Date() }
        });
      }
      return res.json({
        success: true,
        hasKycSession: true,
        status: 'APPROVED',
        ctosStatus: kycSession.ctosStatus,
        ctosResult: kycSession.ctosResult,
        isAlreadyApproved: true,
        kycSessionId: kycSession.id
      });
    }

    // Call Truestack API to get latest status
    try {
      if (!kycSession.ctosOnboardingId) {
        throw new Error('No KYC onboarding ID found');
      }
      
      console.log(`🔍 Calling Truestack API for admin session ${kycSession.id}`);
      
      const truestackStatus = await truestackService.refreshSessionStatus(kycSession.ctosOnboardingId);
      const normalized = truestackService.normalizeStatusResponse(truestackStatus);

      console.log(`✅ Truestack Response for admin:`, { status: normalized.status, result: normalized.result });

      // Update our session with the latest status
      await prisma.kycSession.update({
        where: { id: kycSession.id },
        data: {
          ctosStatus: normalized.status,
          ctosResult: normalized.result,
          ctosData: truestackStatus as any,
          status: normalized.status === 2 ? // Completed
            (normalized.result === 1 ? 'APPROVED' : 'REJECTED') :
            normalized.status === 3 ? 'FAILED' : 'IN_PROGRESS',
          completedAt: normalized.status === 2 ? new Date() : null
        }
      });

      // Download and store images if available
      if (truestackStatus.images) {
        try {
          const images = await truestackService.downloadSessionImages(truestackStatus.images);
          const documentsToUpsert = [];

          if (images.front_document_image) {
            documentsToUpsert.push({
              kycId: kycSession.id,
              type: 'front',
              storageUrl: images.front_document_image,
              hashSha256: crypto.createHash('sha256').update(images.front_document_image).digest('hex'),
              updatedAt: new Date()
            });
          }

          if (images.back_document_image) {
            documentsToUpsert.push({
              kycId: kycSession.id,
              type: 'back', 
              storageUrl: images.back_document_image,
              hashSha256: crypto.createHash('sha256').update(images.back_document_image).digest('hex'),
              updatedAt: new Date()
            });
          }

          const selfieImage = images.face_image || images.best_frame;
          if (selfieImage) {
            documentsToUpsert.push({
              kycId: kycSession.id,
              type: 'selfie',
              storageUrl: selfieImage,
              hashSha256: crypto.createHash('sha256').update(selfieImage).digest('hex'),
              updatedAt: new Date()
            });
          }

          // Upsert documents to prevent duplicates
          if (documentsToUpsert.length > 0) {
            for (const doc of documentsToUpsert) {
              await prisma.kycDocument.upsert({
                where: {
                  kycId_type: {
                    kycId: doc.kycId,
                    type: doc.type
                  }
                },
                update: {
                  storageUrl: doc.storageUrl,
                  hashSha256: doc.hashSha256,
                  updatedAt: new Date()
                },
                create: doc
              });
            }
            console.log(`📄 Stored ${documentsToUpsert.length} documents for admin KYC session ${kycSession.id}`);
          }
        } catch (imageError) {
          console.error('Error downloading images from Truestack for admin:', imageError);
        }
      }

      // Update admin user KYC status if approved
      if (normalized.status === 2 && normalized.result === 1) {
        await prisma.user.update({
          where: { id: userId },
          data: { kycStatus: true }
        });
        console.log(`✅ Updated admin user ${userId} KYC status to approved`);
      }

      const finalStatus = normalized.status === 2 ? 
        (normalized.result === 1 ? 'APPROVED' : 'REJECTED') :
        normalized.status === 3 ? 'FAILED' : 'IN_PROGRESS';

      return res.json({
        success: true,
        hasKycSession: true,
        status: finalStatus,
        ctosStatus: normalized.status,
        ctosResult: normalized.result,
        isAlreadyApproved: finalStatus === 'APPROVED',
        kycSessionId: kycSession.id
      });

    } catch (truestackError) {
      console.error('Truestack API error for admin:', truestackError);
      // Return current database status on error
      return res.json({
        success: true,
        hasKycSession: true,
        status: kycSession.status,
        ctosStatus: kycSession.ctosStatus,
        ctosResult: kycSession.ctosResult,
        isAlreadyApproved: kycSession.status === 'APPROVED',
        kycSessionId: kycSession.id,
        error: 'Failed to get latest status from KYC provider, showing database status'
      });
    }

  } catch (error) {
    console.error('Admin CTOS status check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check KYC status'
    });
  }
});

/**
 * @swagger
 * /api/admin/kyc/{kycId}/status:
 *   get:
 *     summary: Get KYC session status (admin only)
 *     tags: [Admin, KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kycId
 *         required: true
 *         schema:
 *           type: string
 *         description: KYC session ID
 *     responses:
 *       200:
 *         description: KYC status retrieved successfully
 *       404:
 *         description: KYC session not found
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to get KYC status
 */
router.get('/:kycId/status', authenticateToken, adminOrAttestorMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { kycId } = req.params;

    if (!kycId) {
      return res.status(400).json({
        success: false,
        message: 'KYC ID is required'
      });
    }

    console.log('Admin getting KYC status:', { 
      kycId, 
      adminUserId: req.user?.userId 
    });

    // Get KYC session - only allow admin to access their own sessions
    const kycSession = await prisma.kycSession.findFirst({
      where: { 
        id: kycId,
        userId: req.user?.userId // Ensure admin can only access their own KYC
      },
      include: {
        documents: {
          select: {
            id: true,
            type: true,
            storageUrl: true,
            createdAt: true
          }
        }
      }
    });

    if (!kycSession) {
      return res.status(404).json({
        success: false,
        message: 'KYC session not found'
      });
    }

    return res.json({
      success: true,
      id: kycSession.id,
      status: kycSession.status,
      ctosStatus: kycSession.ctosStatus,
      ctosResult: kycSession.ctosResult,
      ctosOnboardingUrl: kycSession.ctosOnboardingUrl,
      completedAt: kycSession.completedAt,
      documents: kycSession.documents,
      createdAt: kycSession.createdAt,
      updatedAt: kycSession.updatedAt
    });

  } catch (error) {
    console.error('Error getting admin KYC status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get KYC status'
    });
  }
});

/**
 * @swagger
 * /api/admin/kyc/images:
 *   get:
 *     summary: Get KYC images for admin user
 *     tags: [Admin, KYC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC images retrieved successfully
 *       404:
 *         description: No KYC images found
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to get KYC images
 */
router.get('/images', authenticateToken, adminOrAttestorMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    console.log('Admin getting KYC images for user:', req.user?.userId);

    // Get the most recent approved KYC session for admin user
    const kycSession = await prisma.kycSession.findFirst({
      where: {
        userId: req.user?.userId,
        status: 'APPROVED'
      },
      include: {
        documents: {
          select: {
            id: true,
            type: true,
            storageUrl: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!kycSession || !kycSession.documents || kycSession.documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No KYC documents found. Please complete KYC verification first.'
      });
    }

    // Organize documents by type
    const front = kycSession.documents.find(doc => doc.type === 'front');
    const back = kycSession.documents.find(doc => doc.type === 'back');
    const selfie = kycSession.documents.find(doc => doc.type === 'selfie');

    console.log('Admin KYC images found:', {
      sessionId: kycSession.id,
      hasFront: !!front,
      hasBack: !!back,
      hasSelfie: !!selfie,
      totalDocuments: kycSession.documents.length
    });

    return res.json({
      success: true,
      sessionId: kycSession.id,
      images: {
        front: front ? {
          id: front.id,
          url: front.storageUrl,
          createdAt: front.createdAt
        } : null,
        back: back ? {
          id: back.id,
          url: back.storageUrl,
          createdAt: back.createdAt
        } : null,
        selfie: selfie ? {
          id: selfie.id,
          url: selfie.storageUrl,
          createdAt: selfie.createdAt
        } : null
      }
    });

  } catch (error) {
    console.error('Error getting admin KYC images:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get KYC images'
    });
  }
});

export default router;
