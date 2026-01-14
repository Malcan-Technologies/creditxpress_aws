import express from 'express';
import { z } from 'zod';
import { ctosService } from '../lib/ctosService';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';
import { ctosConfig } from '../lib/config';

const router = express.Router();

// Validation schemas
const createTransactionSchema = z.object({
  userId: z.string(),
  documentName: z.string().min(1),
  documentNumber: z.string().min(1),
  platform: z.enum(['Web', 'iOS', 'Android']).default('Web'),
  responseUrl: z.string().url().optional()
});

const getStatusSchema = z.object({
  kycSessionId: z.string()
});

/**
 * Create CTOS eKYC transaction
 * POST /api/ctos/create-transaction
 */
router.post('/create-transaction', async (req, res) => {
  let kycSession: any = null;
  let userId: string = '';
  try {
    const parsedData = createTransactionSchema.parse(req.body);
    userId = parsedData.userId;
    const { documentName, documentNumber, platform, responseUrl } = parsedData;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create KYC session
    kycSession = await prisma.kycSession.create({
      data: {
        userId,
        status: 'IN_PROGRESS'
      }
    });

    // Create CTOS transaction
    let ctosResponse;
    try {
      ctosResponse = await ctosService.createTransaction({
        ref_id: kycSession.id, // Use kycSession.id as ref_id
        document_name: documentName,
        document_number: documentNumber,
        platform,
        response_url: responseUrl,
        backend_url: ctosConfig.webhookUrl,
        callback_mode: 2 // Detailed callback
      });
    } catch (ctosError) {
      // CTOS service threw an error (no onboarding_id or other CTOS API error)
      console.error('CTOS service threw error:', ctosError);
      const errorMessage = ctosError instanceof Error ? ctosError.message : 'CTOS transaction failed';
      
      // Extract error details from CTOS error message
      let errorCode = "500";
      let description = errorMessage;
      
      if (errorMessage.includes("Duplicate transaction found") || errorMessage.includes("103")) {
        errorCode = "103";
        description = "Duplicate transaction found";
      } else if (errorMessage.includes("CTOS API Error:")) {
        description = errorMessage.replace("CTOS API Error: ", "");
      }
      
      const ctosFailureData = {
        rawResponse: {
          message: "Failed", 
          error_code: errorCode,
          description: description
        },
        requestedBy: userId,
        adminRequest: false,
        errorDetails: {
          timestamp: new Date().toISOString(),
          originalError: errorMessage
        }
      };

      await prisma.kycSession.update({ 
        where: { id: kycSession.id },
        data: {
          status: 'FAILED',
          ctosData: ctosFailureData,
          completedAt: new Date()
        }
      });
      
      console.log(`Marked KYC session ${kycSession.id} as FAILED due to CTOS service error`);
      return res.status(400).json({ 
        error: `CTOS eKYC Error: ${description}`,
        kycSessionId: kycSession.id,
        errorCode: errorCode
      });
    }

    // Check if CTOS transaction was successful  
    if (!ctosResponse.onboarding_id || !ctosResponse.onboarding_url) {
      // Mark the KYC session as FAILED and store error details instead of deleting
      const errorMsg = ctosResponse.data?.message || ctosResponse.data?.name || 'CTOS transaction failed';
      const ctosFailureData = {
        rawResponse: {
          message: "Failed", 
          error_code: ctosResponse.data?.code?.toString() || "400",
          description: errorMsg
        },
        requestedBy: userId,
        adminRequest: false,
        errorDetails: {
          timestamp: new Date().toISOString(),
          originalResponse: JSON.parse(JSON.stringify(ctosResponse))
        }
      };

      await prisma.kycSession.update({ 
        where: { id: kycSession.id },
        data: {
          status: 'FAILED',
          ctosData: ctosFailureData,
          completedAt: new Date()
        }
      });
      
      console.error('CTOS transaction failed, marked session as FAILED:', ctosResponse);
      return res.status(400).json({ 
        error: `CTOS eKYC Error: ${errorMsg}`,
        ctosResponse,
        details: ctosResponse.data
      });
    }

    // Update KYC session with CTOS data
    await prisma.kycSession.update({
      where: { id: kycSession.id },
      data: {
        ctosOnboardingId: ctosResponse.onboarding_id,
        ctosOnboardingUrl: ctosResponse.onboarding_url,
        ctosExpiredAt: ctosResponse.expired_at ? new Date(ctosResponse.expired_at) : null,
        ctosStatus: 0, // Not opened yet
        ctosData: ctosResponse as any
      }
    });

    console.log(`Created CTOS transaction for user ${userId}, KYC session ${kycSession.id}, onboarding ID: ${ctosResponse.onboarding_id}`);

    return res.status(201).json({
      success: true,
      kycSessionId: kycSession.id,
      onboardingUrl: ctosResponse.onboarding_url,
      onboardingId: ctosResponse.onboarding_id,
      expiredAt: ctosResponse.expired_at
    });

  } catch (error) {
    console.error('Error creating CTOS transaction:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    
    // If there's a KYC session created, mark it as FAILED
    if (kycSession?.id) {
      try {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create CTOS transaction';
        const ctosFailureData = {
          rawResponse: {
            message: "Failed", 
            error_code: "500",
            description: errorMessage
          },
          requestedBy: userId,
          adminRequest: false,
          errorDetails: {
            timestamp: new Date().toISOString(),
            originalError: errorMessage
          }
        };

        await prisma.kycSession.update({ 
          where: { id: kycSession.id },
          data: {
            status: 'FAILED',
            ctosData: ctosFailureData,
            completedAt: new Date()
          }
        });
        console.log(`Marked KYC session ${kycSession.id} as FAILED due to CTOS error`);
      } catch (updateError) {
        console.error('Error updating failed KYC session:', updateError);
      }
    }
    
    return res.status(500).json({ error: 'Failed to create CTOS transaction' });
  }
});

/**
 * Get CTOS eKYC status
 * POST /api/ctos/status
 */
router.post('/status', async (req, res) => {
  try {
    const { kycSessionId } = getStatusSchema.parse(req.body);

    // Get KYC session
    const kycSession = await prisma.kycSession.findUnique({
      where: { id: kycSessionId },
      include: { user: true }
    });

    if (!kycSession || !kycSession.ctosOnboardingId) {
      return res.status(404).json({ error: 'KYC session not found or not initialized with CTOS' });
    }

    // Get status from CTOS
    const ctosStatus = await ctosService.getStatus({
      ref_id: kycSession.id,
      onboarding_id: kycSession.ctosOnboardingId,
      platform: 'Web',
      mode: 2 // Detailed mode
    });

    // Update KYC session with latest status
    const updatedKycSession = await prisma.kycSession.update({
      where: { id: kycSessionId },
      data: {
        ctosStatus: ctosStatus.status,
        ctosResult: ctosStatus.result,
        ctosData: { ...(kycSession.ctosData as any), ...ctosStatus } as any,
        // Update KYC status based on CTOS result
        status: ctosStatus.status === 2 ? // Completed
          (ctosStatus.result === 1 ? 'APPROVED' : 'REJECTED') :
          ctosStatus.status === 3 ? 'FAILED' : 'IN_PROGRESS',
        completedAt: ctosStatus.status === 2 ? new Date() : null
      }
    });

    return res.json({
      success: true,
      kycSessionId,
      status: updatedKycSession.status,
      ctosStatus: ctosStatus.status,
      ctosResult: ctosStatus.result,
      details: ctosStatus
    });

  } catch (error) {
    console.error('Error getting CTOS status:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    return res.status(500).json({ error: 'Failed to get CTOS status' });
  }
});

/**
 * CTOS Webhook endpoint test
 * GET /api/ctos/webhook - for testing accessibility
 */
router.get('/webhook', async (req, res) => {
  console.log('🔔 CTOS webhook GET test accessed:', {
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    remoteAddress: req.connection?.remoteAddress || req.socket?.remoteAddress
  });
  
  return res.json({ 
    success: true, 
    message: 'CTOS webhook endpoint is accessible',
    timestamp: new Date().toISOString()
  });
});

/**
 * CTOS Webhook endpoint
 * POST /api/ctos/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('🔔 CTOS webhook received:', {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      xForwardedFor: req.headers['x-forwarded-for'],
      remoteAddress: req.connection?.remoteAddress || req.socket?.remoteAddress,
      body: typeof req.body === 'string' ? 'encrypted_data' : req.body
    });

    // Process webhook data (decrypt if necessary)
    const webhookData = ctosService.processWebhookData(req.body);
    console.log('Processed CTOS webhook data:', {
      ref_id: webhookData.ref_id,
      onboarding_id: webhookData.onboarding_id,
      status: webhookData.status,
      result: webhookData.result,
      hasImages: {
        front: !!(webhookData.front_document_image || webhookData.step1?.front_document_image),
        back: !!(webhookData.back_document_image || webhookData.step1?.back_document_image),
        selfie: !!(webhookData.face_image || webhookData.step2?.best_frame)
      }
    });

    // Find KYC session by ref_id (now kycSession.id, not userId)
    // Primary: Direct lookup by id (ref_id is now kycSession.id for new sessions)
    // Fallback: Legacy lookup by userId (for old sessions)
    let kycSession = null;
    let cleanRefId = webhookData.ref_id;

    // Primary lookup: Try direct id match (new system)
    kycSession = await prisma.kycSession.findUnique({
      where: {
        id: webhookData.ref_id
      },
      include: { user: true }
    });

    // If not found and ref_id contains OPG-Capital prefix, try without prefix (new system)
    if (!kycSession && webhookData.ref_id.startsWith('OPG-Capital')) {
      cleanRefId = webhookData.ref_id.replace('OPG-Capital', '');
      kycSession = await prisma.kycSession.findUnique({
        where: {
          id: cleanRefId
        },
        include: { user: true }
      });
    }

    // Fallback: Legacy lookup by userId (for old sessions created before this change)
    if (!kycSession) {
      console.log(`Session not found by id, trying legacy userId lookup: ${webhookData.ref_id}`);
      kycSession = await prisma.kycSession.findFirst({
        where: {
          userId: webhookData.ref_id,
          ctosOnboardingId: webhookData.onboarding_id
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' }
      });

      // Legacy: Handle OPG-Capital prefix with userId lookup
      if (!kycSession && webhookData.ref_id.startsWith('OPG-Capital')) {
        cleanRefId = webhookData.ref_id.replace('OPG-Capital', '');
        kycSession = await prisma.kycSession.findFirst({
          where: {
            userId: cleanRefId,
            ctosOnboardingId: webhookData.onboarding_id
          },
          include: { user: true },
          orderBy: { createdAt: 'desc' }
        });
      }

      // Legacy: Handle other prefix formats
      if (!kycSession && webhookData.ref_id.includes('-') && !webhookData.ref_id.startsWith('OPG-Capital')) {
        const parts = webhookData.ref_id.split('-');
        if (parts.length >= 2) {
          cleanRefId = parts.slice(-1)[0];
          kycSession = await prisma.kycSession.findFirst({
            where: {
              userId: cleanRefId,
              ctosOnboardingId: webhookData.onboarding_id
            },
            include: { user: true },
            orderBy: { createdAt: 'desc' }
          });
        }
      }

      // Legacy: Handle underscore format
      if (!kycSession && webhookData.ref_id.includes('_')) {
        cleanRefId = webhookData.ref_id.split('_').slice(-1)[0];
        kycSession = await prisma.kycSession.findFirst({
          where: {
            userId: cleanRefId,
            ctosOnboardingId: webhookData.onboarding_id
          },
          include: { user: true },
          orderBy: { createdAt: 'desc' }
        });
      }
    }
    
    console.log(`Looking for KYC session: original ref_id=${webhookData.ref_id}, cleaned ref_id=${cleanRefId}, found=${!!kycSession}, onboarding_id=${webhookData.onboarding_id}`);

    if (!kycSession) {
      console.error(`KYC session not found for original ref_id=${webhookData.ref_id}, cleaned ref_id=${cleanRefId}, onboarding ID=${webhookData.onboarding_id}`);
      return res.status(404).json({ error: 'KYC session not found' });
    }

    // Update KYC session with webhook data
    const newStatus = webhookData.status === 2 ? // Completed
      (webhookData.result === 1 ? 'APPROVED' : 'REJECTED') :
      webhookData.status === 3 ? 'FAILED' : 'IN_PROGRESS';
    
    console.log(`🔄 Webhook updating session ${kycSession.id}:`, {
      oldStatus: kycSession.status,
      newStatus,
      ctosStatus: webhookData.status,
      ctosResult: webhookData.result,
      willSetCompleted: webhookData.status === 2
    });
    
    await prisma.kycSession.update({
      where: { id: kycSession.id },
      data: {
        ctosStatus: webhookData.status,
        ctosResult: webhookData.result,
        ctosData: { ...(kycSession.ctosData as any), webhook: webhookData } as any,
        status: newStatus,
        completedAt: webhookData.status === 2 ? new Date() : null
      }
    });
    
    console.log(`✅ Webhook session update completed for ${kycSession.id} - Status: ${newStatus}`);

    // Store document images if available
    // Images can be at the top level, step1 (front/back), or step2 (selfie)
    const documentsToCreate = [];
    
    const frontImage = webhookData.front_document_image || webhookData.step1?.front_document_image;
    const backImage = webhookData.back_document_image || webhookData.step1?.back_document_image;
    const faceImage = webhookData.face_image || webhookData.step2?.best_frame;

    if (frontImage) {
      documentsToCreate.push({
        kycId: kycSession.id,
        type: 'front',
        storageUrl: `data:image/jpeg;base64,${frontImage}`,
        hashSha256: crypto.createHash('sha256').update(frontImage).digest('hex'),
        updatedAt: new Date()
      });
    }

    if (backImage) {
      documentsToCreate.push({
        kycId: kycSession.id,
        type: 'back',
        storageUrl: `data:image/jpeg;base64,${backImage}`,
        hashSha256: crypto.createHash('sha256').update(backImage).digest('hex'),
        updatedAt: new Date()
      });
    }

    if (faceImage) {
      documentsToCreate.push({
        kycId: kycSession.id,
        type: 'selfie',
        storageUrl: `data:image/jpeg;base64,${faceImage}`,
        hashSha256: crypto.createHash('sha256').update(faceImage).digest('hex'),
        updatedAt: new Date()
      });
    }

    // Create documents using upsert to prevent duplicates
    if (documentsToCreate.length > 0) {
      for (const doc of documentsToCreate) {
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
      console.log(`Stored ${documentsToCreate.length} documents for KYC session ${kycSession.id}`);
    }

    // Update user KYC status if approved
    if (webhookData.status === 2 && webhookData.result === 1) {
      await prisma.user.update({
        where: { id: kycSession.userId },
        data: { kycStatus: true }
      });
      console.log(`Updated user ${kycSession.userId} KYC status to approved`);
    }

    console.log(`Successfully processed CTOS webhook for KYC session ${kycSession.id}`);

    // Return 200 OK to acknowledge webhook
    return res.status(200).json({ success: true, received: true });

  } catch (error) {
    console.error('Error processing CTOS webhook:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * Get KYC session details
 * GET /api/ctos/session/:id
 */
router.get('/session/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const kycSession = await prisma.kycSession.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            kycStatus: true
          }
        },
        documents: true
      }
    });

    if (!kycSession) {
      return res.status(404).json({ error: 'KYC session not found' });
    }

    return res.json({
      success: true,
      kycSession: {
        id: kycSession.id,
        userId: kycSession.userId,
        status: kycSession.status,
        ctosOnboardingId: kycSession.ctosOnboardingId,
        ctosOnboardingUrl: kycSession.ctosOnboardingUrl,
        ctosStatus: kycSession.ctosStatus,
        ctosResult: kycSession.ctosResult,
        ctosExpiredAt: kycSession.ctosExpiredAt,
        createdAt: kycSession.createdAt,
        updatedAt: kycSession.updatedAt,
        completedAt: kycSession.completedAt,
        user: kycSession.user,
        documents: kycSession.documents.map(doc => ({
          id: doc.id,
          type: doc.type,
          createdAt: doc.createdAt,
          hasImage: doc.storageUrl.startsWith('data:image/')
        }))
      }
    });

  } catch (error) {
    console.error('Error getting KYC session:', error);
    return res.status(500).json({ error: 'Failed to get KYC session' });
  }
});

export default router;
