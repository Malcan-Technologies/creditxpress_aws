import express from 'express';
import { z } from 'zod';
import { ctosService } from '../lib/ctosService';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

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
  try {
    const { userId, documentName, documentNumber, platform, responseUrl } = createTransactionSchema.parse(req.body);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create KYC session
    const kycSession = await prisma.kycSession.create({
      data: {
        userId,
        status: 'IN_PROGRESS'
      }
    });

    // Create CTOS transaction
    const ctosResponse = await ctosService.createTransaction({
      ref_id: userId, // Use user UUID as ref_id
      document_name: documentName,
      document_number: documentNumber,
      platform,
      response_url: responseUrl,
      backend_url: process.env.CTOS_WEBHOOK_URL || `${process.env.BACKEND_URL || 'http://localhost:4001'}/api/ctos/webhook`,
      callback_mode: 2 // Detailed callback
    });

    // Check if CTOS transaction was successful
    if (!ctosResponse.onboarding_id || !ctosResponse.onboarding_url) {
      // Clean up the KYC session if CTOS failed
      await prisma.kycSession.delete({ where: { id: kycSession.id } });
      
      const errorMsg = ctosResponse.data?.message || ctosResponse.data?.name || 'CTOS transaction failed';
      console.error('CTOS transaction failed:', ctosResponse);
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
      ref_id: kycSession.userId,
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
 * CTOS Webhook endpoint
 * POST /api/ctos/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('Received CTOS webhook:', {
      headers: req.headers,
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
        selfie: !!(webhookData.face_image || webhookData.step1?.face_image)
      }
    });

    // Find KYC session by ref_id (user ID) and onboarding_id
      // CTOS may add a prefix to ref_id, so we need to handle both cases
      let kycSession = null;
      let cleanUserId = webhookData.ref_id;

      // First, try with the original ref_id and onboarding_id
      kycSession = await prisma.kycSession.findFirst({
        where: {
          userId: webhookData.ref_id,
          ctosOnboardingId: webhookData.onboarding_id
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' } // Get the most recent if multiple exist
      });

      // If not found and ref_id contains a hyphen, try removing potential prefix
      if (!kycSession && webhookData.ref_id.includes('-')) {
        // Handle OPG-Capital prefix specifically
        if (webhookData.ref_id.startsWith('OPG-Capital')) {
          cleanUserId = webhookData.ref_id.replace('OPG-Capital', '');
        } else {
          // Extract the part after the last hyphen (assuming format: PREFIX-actualUserId)
          const parts = webhookData.ref_id.split('-');
          if (parts.length >= 2) {
            cleanUserId = parts.slice(-1)[0]; // Get the last part
          }
        }

        kycSession = await prisma.kycSession.findFirst({
          where: {
            userId: cleanUserId,
            ctosOnboardingId: webhookData.onboarding_id
          },
          include: { user: true },
          orderBy: { createdAt: 'desc' }
        });

        // If still not found, try removing everything before the first underscore (format: PREFIX_actualUserId)
        if (!kycSession && webhookData.ref_id.includes('_')) {
          cleanUserId = webhookData.ref_id.split('_').slice(-1)[0];

          kycSession = await prisma.kycSession.findFirst({
            where: {
              userId: cleanUserId,
              ctosOnboardingId: webhookData.onboarding_id
            },
            include: { user: true },
            orderBy: { createdAt: 'desc' }
          });
        }
      }
    
    console.log(`Looking for KYC session: original ref_id=${webhookData.ref_id}, final userId=${cleanUserId}, found=${!!kycSession}, onboarding_id=${webhookData.onboarding_id}`);

    if (!kycSession) {
      console.error(`KYC session not found for original ref_id=${webhookData.ref_id}, cleaned userId=${cleanUserId}, onboarding ID=${webhookData.onboarding_id}`);
      return res.status(404).json({ error: 'KYC session not found' });
    }

    // Update KYC session with webhook data
    await prisma.kycSession.update({
      where: { id: kycSession.id },
      data: {
        ctosStatus: webhookData.status,
        ctosResult: webhookData.result,
        ctosData: { ...(kycSession.ctosData as any), webhook: webhookData } as any,
        status: webhookData.status === 2 ? // Completed
          (webhookData.result === 1 ? 'APPROVED' : 'REJECTED') :
          webhookData.status === 3 ? 'FAILED' : 'IN_PROGRESS',
        completedAt: webhookData.status === 2 ? new Date() : null
      }
    });

    // Store document images if available
    // Images can be at the top level or nested in step1 object
    const documentsToCreate = [];
    
    const frontImage = webhookData.front_document_image || webhookData.step1?.front_document_image;
    const backImage = webhookData.back_document_image || webhookData.step1?.back_document_image;
    const faceImage = webhookData.face_image || webhookData.step1?.face_image;

    if (frontImage) {
      documentsToCreate.push({
        kycId: kycSession.id,
        type: 'front',
        storageUrl: `data:image/jpeg;base64,${frontImage}`,
        hashSha256: crypto.createHash('sha256').update(frontImage).digest('hex')
      });
    }

    if (backImage) {
      documentsToCreate.push({
        kycId: kycSession.id,
        type: 'back',
        storageUrl: `data:image/jpeg;base64,${backImage}`,
        hashSha256: crypto.createHash('sha256').update(backImage).digest('hex')
      });
    }

    if (faceImage) {
      documentsToCreate.push({
        kycId: kycSession.id,
        type: 'selfie',
        storageUrl: `data:image/jpeg;base64,${faceImage}`,
        hashSha256: crypto.createHash('sha256').update(faceImage).digest('hex')
      });
    }

    // Create documents in batch
    if (documentsToCreate.length > 0) {
      await prisma.kycDocument.createMany({
        data: documentsToCreate
      });
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
