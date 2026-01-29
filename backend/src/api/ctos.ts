import express from 'express';
import { z } from 'zod';
import { truestackService } from '../lib/truestackService';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

const router = express.Router();

/**
 * KYC Routes - Using Truestack API (backwards compatible with CTOS endpoints)
 * 
 * This file maintains the same API endpoint URLs for backwards compatibility
 * with mobile apps and existing frontend integrations.
 */

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
 * Create KYC transaction (via Truestack)
 * POST /api/ctos/create-transaction
 * 
 * Backwards compatible endpoint - previously CTOS, now Truestack
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

    // Create Truestack session
    let truestackResponse;
    try {
      truestackResponse = await truestackService.createSession({
        ref_id: kycSession.id,
        document_name: documentName,
        document_number: documentNumber,
        platform,
        redirect_url: responseUrl,
        document_type: '1', // MyKad
        metadata: {
          user_id: userId
        }
      });
    } catch (truestackError) {
      console.error('Truestack service threw error:', truestackError);
      const errorMessage = truestackError instanceof Error ? truestackError.message : 'KYC transaction failed';
      
      // Extract error details
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
          ctosData: failureData,
          completedAt: new Date()
        }
      });
      
      console.log(`Marked KYC session ${kycSession.id} as FAILED due to Truestack service error`);
      return res.status(400).json({ 
        error: `KYC Error: ${description}`,
        kycSessionId: kycSession.id,
        errorCode: errorCode
      });
    }

    // Check if Truestack transaction was successful  
    if (!truestackResponse.id || !truestackResponse.onboarding_url) {
      const errorMsg = 'KYC transaction failed - no session returned';
      const failureData = {
        rawResponse: {
          message: "Failed", 
          error_code: "400",
          description: errorMsg
        },
        requestedBy: userId,
        adminRequest: false,
        errorDetails: {
          timestamp: new Date().toISOString(),
          originalResponse: JSON.parse(JSON.stringify(truestackResponse))
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
      
      console.error('Truestack transaction failed, marked session as FAILED:', truestackResponse);
      return res.status(400).json({ 
        error: `KYC Error: ${errorMsg}`,
        details: truestackResponse
      });
    }

    // Update KYC session with Truestack data
    // Using existing CTOS field names for backwards compatibility
    await prisma.kycSession.update({
      where: { id: kycSession.id },
      data: {
        ctosOnboardingId: truestackResponse.id,
        ctosOnboardingUrl: truestackResponse.onboarding_url,
        ctosExpiredAt: truestackResponse.expires_at ? new Date(truestackResponse.expires_at) : null,
        ctosStatus: 0, // Not opened yet (pending)
        ctosData: truestackResponse as any
      }
    });

    console.log(`Created Truestack KYC session for user ${userId}, KYC session ${kycSession.id}, Truestack ID: ${truestackResponse.id}`);

    // Return response in backwards-compatible format
    return res.status(201).json({
      success: true,
      kycSessionId: kycSession.id,
      onboardingUrl: truestackResponse.onboarding_url,
      onboardingId: truestackResponse.id,
      expiredAt: truestackResponse.expires_at
    });

  } catch (error) {
    console.error('Error creating KYC transaction:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    
    // If there's a KYC session created, mark it as FAILED
    if (kycSession?.id) {
      try {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create KYC transaction';
        const failureData = {
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
            ctosData: failureData,
            completedAt: new Date()
          }
        });
        console.log(`Marked KYC session ${kycSession.id} as FAILED due to error`);
      } catch (updateError) {
        console.error('Error updating failed KYC session:', updateError);
      }
    }
    
    return res.status(500).json({ error: 'Failed to create KYC transaction' });
  }
});

/**
 * Get KYC status (via Truestack)
 * POST /api/ctos/status
 * 
 * Backwards compatible endpoint
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
      return res.status(404).json({ error: 'KYC session not found or not initialized' });
    }

    // Get status from Truestack (using refresh to get latest)
    const truestackStatus = await truestackService.refreshSessionStatus(kycSession.ctosOnboardingId);
    const normalized = truestackService.normalizeStatusResponse(truestackStatus);

    // Update KYC session with latest status
    const updatedKycSession = await prisma.kycSession.update({
      where: { id: kycSessionId },
      data: {
        ctosStatus: normalized.status,
        ctosResult: normalized.result,
        ctosData: { ...(kycSession.ctosData as any), ...truestackStatus } as any,
        // Update KYC status based on result
        status: normalized.status === 2 ? // Completed
          (normalized.result === 1 ? 'APPROVED' : 'REJECTED') :
          normalized.status === 3 ? 'FAILED' : 'IN_PROGRESS',
        completedAt: normalized.status === 2 ? new Date() : null
      }
    });

    // If completed, download and store images
    if (normalized.status === 2 && truestackStatus.images) {
      try {
        const images = await truestackService.downloadSessionImages(truestackStatus.images);
        await storeSessionImages(kycSession.id, images);
      } catch (imageError) {
        console.error('Error downloading images from Truestack:', imageError);
        // Continue - images are not critical for status response
      }
    }

    return res.json({
      success: true,
      kycSessionId,
      status: updatedKycSession.status,
      ctosStatus: normalized.status,
      ctosResult: normalized.result,
      details: normalized
    });

  } catch (error) {
    console.error('Error getting KYC status:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    return res.status(500).json({ error: 'Failed to get KYC status' });
  }
});

/**
 * Webhook endpoint test
 * GET /api/ctos/webhook - for testing accessibility
 */
router.get('/webhook', async (req, res) => {
  console.log('🔔 KYC webhook GET test accessed:', {
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    remoteAddress: req.connection?.remoteAddress || req.socket?.remoteAddress
  });
  
  return res.json({ 
    success: true, 
    message: 'KYC webhook endpoint is accessible (Truestack)',
    timestamp: new Date().toISOString()
  });
});

/**
 * Truestack Webhook endpoint
 * POST /api/ctos/webhook
 * 
 * Handles Truestack webhook notifications
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('🔔 Truestack webhook received:', {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
      event: req.headers['x-truestack-event'],
      hasSignature: !!req.headers['x-webhook-signature']
    });

    // Get signature header for verification
    const signatureHeader = req.headers['x-webhook-signature'] as string | undefined;
    
    // Process webhook payload
    const webhookPayload = truestackService.processWebhookPayload(req.body, signatureHeader);
    const normalizedData = truestackService.normalizeWebhookData(webhookPayload);
    
    console.log('Processed Truestack webhook data:', {
      event: webhookPayload.event,
      session_id: webhookPayload.data.session_id,
      ref_id: normalizedData.ref_id,
      status: normalizedData.status,
      result: normalizedData.result
    });

    // Find KYC session by ref_id (stored in metadata) or session_id
    let kycSession = null;

    // Primary lookup: Try direct id match using ref_id from metadata
    kycSession = await prisma.kycSession.findUnique({
      where: { id: normalizedData.ref_id },
      include: { user: true }
    });

    // Fallback: Try finding by ctosOnboardingId (Truestack session ID)
    if (!kycSession) {
      console.log(`Session not found by ref_id, trying Truestack session ID: ${webhookPayload.data.session_id}`);
      kycSession = await prisma.kycSession.findFirst({
        where: {
          ctosOnboardingId: webhookPayload.data.session_id
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' }
      });
    }
    
    console.log(`Looking for KYC session: ref_id=${normalizedData.ref_id}, session_id=${webhookPayload.data.session_id}, found=${!!kycSession}`);

    if (!kycSession) {
      console.error(`KYC session not found for ref_id=${normalizedData.ref_id}, session_id=${webhookPayload.data.session_id}`);
      return res.status(404).json({ error: 'KYC session not found' });
    }

    // Determine new status
    const newStatus = normalizedData.status === 2 ? // Completed
      (normalizedData.result === 1 ? 'APPROVED' : 'REJECTED') :
      normalizedData.status === 3 ? 'FAILED' : 'IN_PROGRESS';
    
    console.log(`🔄 Webhook updating session ${kycSession.id}:`, {
      oldStatus: kycSession.status,
      newStatus,
      truestackStatus: normalizedData.status,
      truestackResult: normalizedData.result,
      willSetCompleted: normalizedData.status === 2
    });
    
    // Update KYC session
    await prisma.kycSession.update({
      where: { id: kycSession.id },
      data: {
        ctosStatus: normalizedData.status,
        ctosResult: normalizedData.result,
        ctosData: { ...(kycSession.ctosData as any), webhook: webhookPayload } as any,
        status: newStatus,
        completedAt: normalizedData.status === 2 ? new Date() : null
      }
    });
    
    console.log(`✅ Webhook session update completed for ${kycSession.id} - Status: ${newStatus}`);

    // Return 200 OK immediately to acknowledge webhook (best practice)
    res.status(200).json({ success: true, received: true });

    // Process images and user status update asynchronously (after response sent)
    if (normalizedData.status === 2) {
      // Use setImmediate to ensure response is sent first
      setImmediate(async () => {
        try {
          // Fetch full details to get images
          console.log(`📸 Fetching images for completed session: ${webhookPayload.data.session_id}`);
          const fullStatus = await truestackService.refreshSessionStatus(webhookPayload.data.session_id);
          
          console.log(`📸 Truestack refresh response:`, {
            hasImages: !!fullStatus.images,
            frontDocument: !!fullStatus.images?.front_document,
            backDocument: !!fullStatus.images?.back_document,
            faceImage: !!fullStatus.images?.face_image,
            bestFrame: !!fullStatus.images?.best_frame,
            imagesObject: fullStatus.images
          });
          
          if (fullStatus.images) {
            // Download images from Truestack CDN and store as base64
            console.log(`📸 Downloading images from Truestack CDN...`);
            const images = await truestackService.downloadSessionImages(fullStatus.images);
            console.log(`📸 Downloaded images:`, {
              hasFront: !!images.front_document_image,
              hasBack: !!images.back_document_image,
              hasFace: !!images.face_image,
              hasBestFrame: !!images.best_frame
            });
            await storeSessionImages(kycSession.id, images);
            console.log(`📸 Successfully stored images for session ${kycSession.id}`);
          } else {
            console.log(`⚠️ No images found in Truestack response for session ${webhookPayload.data.session_id}`);
          }
        } catch (imageError) {
          console.error('Error fetching/storing images from Truestack:', imageError);
        }

        // Update user KYC status if approved
        if (normalizedData.result === 1) {
          try {
            await prisma.user.update({
              where: { id: kycSession.userId },
              data: { kycStatus: true }
            });
            console.log(`Updated user ${kycSession.userId} KYC status to approved`);
          } catch (userUpdateError) {
            console.error('Error updating user KYC status:', userUpdateError);
          }
        }
        
        console.log(`✅ Async processing completed for webhook session ${kycSession.id}`);
      });
    }

    return; // Response already sent above

  } catch (error) {
    console.error('Error processing Truestack webhook:', error);
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

/**
 * Helper function to store session images in the database
 */
async function storeSessionImages(
  kycSessionId: string, 
  images: {
    front_document_image?: string;
    back_document_image?: string;
    face_image?: string;
    best_frame?: string;
  }
): Promise<void> {
  console.log(`📁 storeSessionImages called for session ${kycSessionId}:`, {
    hasFront: !!images.front_document_image,
    hasBack: !!images.back_document_image,
    hasFace: !!images.face_image,
    hasBestFrame: !!images.best_frame,
    frontLength: images.front_document_image?.length,
    backLength: images.back_document_image?.length,
    faceLength: images.face_image?.length,
    bestFrameLength: images.best_frame?.length
  });
  
  const documentsToCreate = [];

  if (images.front_document_image) {
    documentsToCreate.push({
      kycId: kycSessionId,
      type: 'front',
      storageUrl: images.front_document_image,
      hashSha256: crypto.createHash('sha256').update(images.front_document_image).digest('hex'),
      updatedAt: new Date()
    });
  }

  if (images.back_document_image) {
    documentsToCreate.push({
      kycId: kycSessionId,
      type: 'back',
      storageUrl: images.back_document_image,
      hashSha256: crypto.createHash('sha256').update(images.back_document_image).digest('hex'),
      updatedAt: new Date()
    });
  }

  // Use face_image or best_frame for selfie
  const selfieImage = images.face_image || images.best_frame;
  if (selfieImage) {
    documentsToCreate.push({
      kycId: kycSessionId,
      type: 'selfie',
      storageUrl: selfieImage,
      hashSha256: crypto.createHash('sha256').update(selfieImage).digest('hex'),
      updatedAt: new Date()
    });
  }

  // Upsert documents to prevent duplicates
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
    console.log(`Stored ${documentsToCreate.length} documents for KYC session ${kycSessionId}`);
  }
}

export default router;
