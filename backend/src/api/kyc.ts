import { Router, Response } from "express";
import multer from "multer";
import crypto from "crypto";

import * as jwt from "jsonwebtoken";
import { authenticateAndVerifyPhone, authenticateKycOrAuth, AuthRequest, FileAuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { truestackService } from "../lib/truestackService";
import { kycConfig, urlConfig } from "../lib/config";
import { uploadToS3Organized, getS3ObjectStream, deleteFromS3, S3_FOLDERS } from "../lib/storage";

const router = Router();
const db: any = prisma as any;

// Placeholder detection removed per product requirement; rely on readability checks only

// NRIC validation functions removed - no longer needed without OCR validation

// Helper function to check if user has uploaded all required KYC documents (front, back, selfie)
async function userHasAllKycDocuments(userId: string): Promise<boolean> {
  try {
    // Check if user has a KYC session with all 3 document types (any status)
    const kycSession = await db.kycSession.findFirst({
      where: {
        userId
        // Removed status check - we want to find sessions with documents regardless of approval status
      },
      include: {
        documents: true
      },
      orderBy: { createdAt: 'desc' } // Get the most recent session
    });

    if (!kycSession || kycSession.documents.length === 0) {
      return false;
    }

    // Check if all 3 required document types are present
    const documentTypes = kycSession.documents.map((doc: any) => doc.type);
    const requiredTypes = ["front", "back", "selfie"];
    
    return requiredTypes.every(type => documentTypes.includes(type));
  } catch (error) {
    console.error("Error checking KYC documents:", error);
    return false;
  }
}

// Memory storage for S3 uploads
const upload = multer({
  storage: (multer as any).memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// Start KYC eKYC process (via Truestack - backwards compatible endpoint name)
router.post("/start-ctos", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
  let kycSession: any = null;
  try {
    const { applicationId, documentName, documentNumber, platform = 'Web' } = req.body;
    if (!req.user?.userId) return res.status(401).json({ message: "Unauthorized" });

    if (!documentName || !documentNumber) {
      return res.status(400).json({ message: "Document name and number are required" });
    }

    // Validate application if provided
    if (applicationId) {
      const application = await prisma.loanApplication.findUnique({ where: { id: applicationId } });
      if (!application || application.userId !== req.user.userId) {
        return res.status(404).json({ message: "Application not found" });
      }
    }

    // Check if user already has an approved KYC session
    const existingApprovedSession = await db.kycSession.findFirst({
      where: {
        OR: [
          {
            userId: req.user.userId,
            ctosOnboardingId: { not: null },
            ctosResult: 1 // Approved
          },
          {
            userId: { endsWith: req.user.userId },
            ctosOnboardingId: { not: null },
            ctosResult: 1 // Approved
          }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`User ${req.user.userId} - Checking for approved KYC sessions:`, {
      found: !!existingApprovedSession,
      sessionId: existingApprovedSession?.id,
      ctosResult: existingApprovedSession?.ctosResult,
      ctosOnboardingId: existingApprovedSession?.ctosOnboardingId
    });

    if (existingApprovedSession) {
      console.log(`User ${req.user.userId} - Prevented creating new KYC session, already has approved session: ${existingApprovedSession.id}`);
      return res.status(400).json({ 
        message: "You already have an approved KYC verification. No further verification is needed.",
        error: "User already has approved KYC session",
        existingSessionId: existingApprovedSession.id
      });
    }

    // Check for existing IN_PROGRESS session within last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingInProgressSession = await db.kycSession.findFirst({
      where: {
        OR: [
          {
            userId: req.user.userId,
            status: 'IN_PROGRESS',
            ctosOnboardingId: { not: null },
            ctosOnboardingUrl: { not: null },
            createdAt: { gte: twentyFourHoursAgo },
            OR: [
              { ctosStatus: 0 },  // Not opened
              { ctosStatus: 1 }   // Processing
            ]
          },
          {
            userId: { endsWith: req.user.userId },
            status: 'IN_PROGRESS',
            ctosOnboardingId: { not: null },
            ctosOnboardingUrl: { not: null },
            createdAt: { gte: twentyFourHoursAgo },
            OR: [
              { ctosStatus: 0 },
              { ctosStatus: 1 }
            ]
          }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingInProgressSession && existingInProgressSession.ctosOnboardingUrl) {
      console.log(`User ${req.user.userId} - Found existing in-progress session within 24 hours: ${existingInProgressSession.id}`);
      
      // Issue new token for existing session
      const kycToken = jwt.sign(
        { userId: req.user.userId, kycId: existingInProgressSession.id },
        kycConfig.jwtSecret,
        { expiresIn: `${kycConfig.tokenTtlMinutes}m` }
      );

      return res.status(200).json({
        success: true,
        kycId: existingInProgressSession.id,
        onboardingUrl: existingInProgressSession.ctosOnboardingUrl,
        onboardingId: existingInProgressSession.ctosOnboardingId,
        expiredAt: existingInProgressSession.ctosExpiredAt?.toISOString() || null,
        kycToken,
        ttlMinutes: kycConfig.tokenTtlMinutes,
        resumed: true,
        message: "Resuming existing KYC session"
      });
    }

    // Create KYC session
    kycSession = await db.kycSession.create({
      data: {
        userId: req.user.userId,
        status: 'IN_PROGRESS',
        ...(applicationId ? { applicationId } : {})
      }
    });

    try {
      // Create Truestack session
      console.log('Starting Truestack KYC session with params:', {
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
          user_id: req.user.userId,
          application_id: applicationId || ''
        }
      });

      console.log('Truestack Response received:', truestackResponse);

      // Update KYC session with Truestack data
      // Using existing CTOS field names for backwards compatibility
      let expiresAt: Date | null = null;
      try {
        if (truestackResponse.expires_at) {
          expiresAt = new Date(truestackResponse.expires_at);
          if (isNaN(expiresAt.getTime())) {
            console.warn('Invalid Truestack expiry date:', truestackResponse.expires_at);
            expiresAt = null;
          }
        }
      } catch (dateError) {
        console.warn('Error parsing Truestack expiry date:', truestackResponse.expires_at, dateError);
        expiresAt = null;
      }

      await db.kycSession.update({
        where: { id: kycSession.id },
        data: {
          ctosOnboardingId: truestackResponse.id,
          ctosOnboardingUrl: truestackResponse.onboarding_url,
          ctosExpiredAt: expiresAt,
          ctosStatus: 0, // Not opened yet (pending)
          ctosData: truestackResponse as any
        }
      });

      console.log(`Created Truestack KYC session for user ${req.user.userId}, KYC session ${kycSession.id}, Truestack ID: ${truestackResponse.id}`);

      // Issue short-lived KYC token
      const kycToken = jwt.sign(
        { userId: req.user.userId, kycId: kycSession.id },
        kycConfig.jwtSecret,
        { expiresIn: `${kycConfig.tokenTtlMinutes}m` }
      );

      return res.status(201).json({
        success: true,
        kycId: kycSession.id,
        onboardingUrl: truestackResponse.onboarding_url,
        onboardingId: truestackResponse.id,
        expiredAt: truestackResponse.expires_at,
        kycToken,
        ttlMinutes: kycConfig.tokenTtlMinutes
      });

    } catch (truestackError) {
      // Mark the KYC session as FAILED
      console.error('Truestack session creation failed:', truestackError);
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
        adminRequest: false,
        errorDetails: {
          timestamp: new Date().toISOString(),
          originalError: errorMessage
        }
      };

      await db.kycSession.update({ 
        where: { id: kycSession.id },
        data: {
          status: 'FAILED',
          ctosData: failureData,
          completedAt: new Date()
        }
      });
      
      return res.status(400).json({ 
        message: `KYC Error: ${description}`,
        error: errorMessage,
        kycSessionId: kycSession.id,
        errorCode: errorCode
      });
    }

  } catch (error) {
    console.error('Error starting KYC:', error);
    
    // Mark the KYC session as FAILED
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
          adminRequest: false,
          errorDetails: {
            timestamp: new Date().toISOString(),
            originalError: errorMessage
          }
        };

        await db.kycSession.update({ 
          where: { id: kycSession.id },
          data: {
            status: 'FAILED',
            ctosData: failureData,
            completedAt: new Date()
          }
        });
        console.log(`Marked KYC session ${kycSession.id} as FAILED`);
      } catch (updateError) {
        console.error('Error updating failed KYC session:', updateError);
        try {
          await db.kycSession.delete({ where: { id: kycSession.id } });
          console.log(`Deleted failed KYC session ${kycSession.id} after update failure`);
        } catch (deleteError) {
          console.error('Error deleting failed KYC session:', deleteError);
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

// Start or reuse a KYC session (optionally tied to an application) - Legacy endpoint
router.post("/start", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
  try {
    let { applicationId, loanId } = (req.body || {}) as { applicationId?: string, loanId?: string };
    if (!req.user?.userId) return res.status(401).json({ message: "Unauthorized" });
    // If loanId is provided, resolve its applicationId
    if (!applicationId && loanId) {
      const loan = await prisma.loan.findUnique({ where: { id: loanId } });
      if (!loan || loan.userId !== req.user.userId) {
        return res.status(404).json({ message: "Loan not found" });
      }
      applicationId = loan.applicationId;
    }
    
    // Check for existing KYC session (any status)
    const existingSession = await db.kycSession.findFirst({ 
      where: { userId: req.user.userId },
      include: { documents: true },
      orderBy: { createdAt: 'desc' }
    });
    
    // If user wants to redo KYC (indicated by query param ?redo=true), reset existing session
    const redoKyc = req.query?.redo === 'true';
    
    if (existingSession && existingSession.status === "APPROVED" && !redoKyc) {
      if (applicationId) {
        // If tied to an application, advance it
        const application = await prisma.loanApplication.findUnique({ where: { id: applicationId } });
        if (application && application.userId === req.user.userId) {
          // Don't update application status - let the new multi-step flow handle this
          console.log(`KYC reused for application ${applicationId}, letting new flow handle status`);
        }
      }
      // Return approved session (existing behavior when not redoing)
      const kycToken = jwt.sign(
        { userId: req.user.userId, kycId: existingSession.id },
        kycConfig.jwtSecret,
        { expiresIn: `${kycConfig.tokenTtlMinutes}m` }
      );
      return res.json({ reused: true, kycId: existingSession.id, status: "APPROVED", kycToken, ttlMinutes: kycConfig.tokenTtlMinutes });
    }
    
    // If redoing KYC and there's an existing session, create a NEW session instead of deleting the old one
    // This way we preserve the old documents until the new KYC is completed
    if (redoKyc && existingSession) {
      console.log(`Creating new KYC session for redo, preserving existing session ${existingSession.id}`);
      
      // Create a brand new KYC session for the redo
      const newSession = await db.kycSession.create({
        data: {
          userId: req.user.userId,
          status: "PENDING",
          ocrData: null,
          faceMatchScore: null,
          livenessScore: null,
          completedAt: null,
          retryCount: 0,
          ...(applicationId ? { applicationId } : {}),
        }
      });
      
      console.log(`Created new KYC session ${newSession.id} for redo`);
      
      // Return the new session
      const kycToken = jwt.sign(
        { userId: req.user.userId, kycId: newSession.id },
        kycConfig.jwtSecret,
        { expiresIn: `${kycConfig.tokenTtlMinutes}m` }
      );
      return res.json({ reused: false, kycId: newSession.id, status: "PENDING", kycToken, ttlMinutes: kycConfig.tokenTtlMinutes });
    }

    let session = null as any;
    if (applicationId) {
      // Validate application ownership
      const application = await prisma.loanApplication.findUnique({ where: { id: applicationId } });
      if (!application || application.userId !== req.user.userId) return res.status(404).json({ message: "Application not found" });
      // Reuse in-progress session for this application
      session = await db.kycSession.findFirst({ where: { applicationId } });
      if (!session) {
        session = await db.kycSession.create({ data: { status: "PENDING", user: { connect: { id: req.user.userId } }, application: { connect: { id: applicationId } } } });
      }
    } else {
      // Start a profile-only KYC session (no application)
      // Work-around Prisma null filter differences: fetch by user/status then filter in code
      let existing = await db.kycSession.findFirst({
        where: { userId: req.user.userId, status: { in: ["PENDING", "IN_PROGRESS"] } },
        orderBy: { createdAt: "desc" }
      });
      if (existing && existing.applicationId) existing = null;
      session = existing || await db.kycSession.create({ data: { status: "PENDING", user: { connect: { id: req.user.userId } } } });
    }

    // Issue short-lived one-time KYC token (default 15 minutes)
    const kycToken = jwt.sign(
      { userId: req.user.userId, kycId: session.id },
      kycConfig.jwtSecret,
      { expiresIn: `${kycConfig.tokenTtlMinutes}m` }
    );
    return res.json({ reused: false, kycId: session.id, status: session.status, kycToken, ttlMinutes: kycConfig.tokenTtlMinutes });
  } catch (err) {
    console.error("KYC start error", err);
    return res.status(500).json({ message: "Failed to start KYC" });
  }
});

// Upload KYC images: front, back, selfie
router.post("/:kycId/upload", authenticateKycOrAuth, upload.fields([
  { name: "front", maxCount: 1 },
  { name: "back", maxCount: 1 },
  { name: "selfie", maxCount: 1 },
]), async (req: FileAuthRequest, res: Response) => {
  try {
    const { kycId } = req.params;
    console.log(`KYC Upload - Starting upload for session ${kycId}`);
    
    const session = await db.kycSession.findUnique({ 
      where: { id: kycId },
      include: { documents: true }
    });
    if (!session) {
      console.log(`KYC Upload - Session ${kycId} not found`);
      return res.status(404).json({ message: "KYC session not found" });
    }
    if (session.userId !== req.user?.userId) {
      console.log(`KYC Upload - Forbidden access to session ${kycId} by user ${req.user?.userId}`);
      return res.status(403).json({ message: "Forbidden" });
    }
    
    console.log(`KYC Upload - Session ${kycId} found with ${session.documents.length} existing documents`);

    const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] };
    const required = ["front", "back", "selfie"] as const;
    
    for (const key of required) {
      const file = filesMap?.[key]?.[0];
      if (!file) continue; // allow partial upload & retry
      
      // Map KYC type to S3 folder
      const folderMap = {
        front: S3_FOLDERS.KYC_FRONT,
        back: S3_FOLDERS.KYC_BACK,
        selfie: S3_FOLDERS.KYC_SELFIE,
      } as const;
      
      // Upload to S3 with organized folder structure
      const uploadResult = await uploadToS3Organized(
        file.buffer,
        file.originalname,
        file.mimetype,
        {
          folder: folderMap[key],
          userId: session.userId,
        }
      );
      
      if (!uploadResult.success || !uploadResult.key) {
        console.error(`Failed to upload ${key} to S3:`, uploadResult.error);
        return res.status(500).json({ message: `Failed to upload ${key}: ${uploadResult.error}` });
      }
      
      const hash = sha256(file.buffer);
      const storageUrl = uploadResult.key; // S3 key
      
      // Check if document of this type already exists for this KYC session
      const existingDoc = session.documents.find((doc: any) => doc.type === key);
      
      if (existingDoc) {
        console.log(`Overwriting existing ${key} image for KYC session ${kycId}`);
        
        // Delete the old file from S3
        try {
          await deleteFromS3(existingDoc.storageUrl);
          console.log(`Deleted old S3 file: ${existingDoc.storageUrl}`);
        } catch (deleteErr) {
          console.warn(`Failed to delete old S3 file ${existingDoc.storageUrl}:`, deleteErr);
          // Continue anyway - we'll update the database record
        }
        
        // Update existing document record
        await db.kycDocument.update({
          where: { id: existingDoc.id },
          data: { 
            storageUrl, 
            hashSha256: hash,
            createdAt: new Date() // Update timestamp to reflect when it was overwritten
          }
        });
      } else {
        // Create new document record
        console.log(`Creating new ${key} document for KYC session ${kycId}`);
        const newDoc = await db.kycDocument.create({ 
          data: { kycId, type: key, storageUrl, hashSha256: hash } 
        });
        console.log(`Successfully created new ${key} document with ID ${newDoc.id}`);
      }
    }

    console.log(`KYC Upload - Successfully completed upload for session ${kycId}`);
    return res.json({ message: "Uploaded", kycId });
  } catch (err) {
    console.error("KYC upload error", err);
    return res.status(500).json({ message: "Upload failed" });
  }
});

// Process KYC by calling Python services
router.post("/:kycId/process", authenticateKycOrAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { kycId } = req.params;
    const session = await db.kycSession.findUnique({ where: { id: kycId }, include: { documents: true, application: true } });
    if (!session) return res.status(404).json({ message: "KYC session not found" });
    if (session.userId !== req.user?.userId) return res.status(403).json({ message: "Forbidden" });

    // Update status
    await db.kycSession.update({ where: { id: kycId }, data: { status: "IN_PROGRESS" } });

    const front = session.documents.find((d: any) => d.type === "front");
    const back = session.documents.find((d: any) => d.type === "back");
    const selfie = session.documents.find((d: any) => d.type === "selfie");
    if (!front || !back || !selfie) return res.status(400).json({ message: "Missing required images" });

    // OCR and validation disabled - automatically approve KYC with image upload
    let ocrData: any = null;
    let faceMatchScore = 1.0; // Default pass score
    let livenessScore = 1.0; // Default pass score
    
    // Skip all processing and approve automatically
    let finalStatus: "APPROVED" | "MANUAL_REVIEW" | "REJECTED" = "APPROVED";

    const updated = await db.kycSession.update({
      where: { id: kycId },
      data: {
        status: finalStatus,
        ocrData,
        faceMatchScore,
        livenessScore,
        completedAt: new Date()
      }
    });

    // Don't automatically update application status - let the new multi-step flow handle this
    if (finalStatus === "APPROVED" && session.applicationId) {
      console.log(`KYC approved for application ${session.applicationId}, letting new flow handle status`);
    }
    
    // Note: User KYC status is not automatically set to verified - this will be handled in a later verification step

    return res.json({
      kycId,
      status: updated.status,
      ocr: ocrData,
      faceMatchScore,
      livenessScore
    });
  } catch (err: any) {
    console.error("KYC process error", err);
    try {
      const { kycId } = req.params as any;
      await db.kycSession.update({ where: { id: kycId }, data: { status: "FAILED", retryCount: { increment: 1 } } });
    } catch {}
    const message = err?.message || "KYC processing failed";
    return res.status(500).json({ message, code: "PROCESSING_ERROR", nextStep: "retake_selfie" });
  }
});

// Poll KYC status and update session (via Truestack)
router.get("/:kycId/ctos-status", authenticateKycOrAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { kycId } = req.params as any;
    const session = await db.kycSession.findUnique({ where: { id: kycId } });
    if (!session) return res.status(404).json({ message: "KYC session not found" });
    if (session.userId !== req.user?.userId) return res.status(403).json({ message: "Forbidden" });

    if (!session.ctosOnboardingId) {
      return res.status(400).json({ message: "Session not initialized with KYC provider" });
    }

    try {
      console.log(`📊 KYC Status Check for session ${kycId}: current status=${session.status}, ctosStatus=${session.ctosStatus}, ctosResult=${session.ctosResult}`);
      
      // If session is already completed (webhook updated it), return DB values
      if (session.status === 'APPROVED' || session.status === 'REJECTED') {
        console.log(`✅ Session ${kycId} already completed with status=${session.status}, returning DB values`);
        
        // Set cache-busting headers to prevent 304 responses
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        return res.json({
          success: true,
          kycId,
          status: session.status,
          ctosStatus: session.ctosStatus || 2, // Mark as completed
          ctosResult: session.ctosResult || (session.status === 'APPROVED' ? 1 : 0),
          isAlreadyCompleted: true,
          completedAt: session.completedAt
        });
      }

      // Call Truestack API to refresh status
      console.log(`🔄 Session ${kycId} still pending, checking Truestack API for updates`);
      const truestackStatus = await truestackService.refreshSessionStatus(session.ctosOnboardingId);
      const normalized = truestackService.normalizeStatusResponse(truestackStatus);

      console.log(`📡 Truestack API returned: status=${normalized.status}, result=${normalized.result}`);

      // Update KYC session with latest status
      const updatedSession = await db.kycSession.update({
        where: { id: kycId },
        data: {
          ctosStatus: normalized.status,
          ctosResult: normalized.result,
          ctosData: { ...session.ctosData, ...truestackStatus },
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
          await storeKycImages(session.id, images);
        } catch (imageError) {
          console.error('Error downloading images from Truestack:', imageError);
        }
      }

      // Set cache-busting headers
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      return res.json({
        success: true,
        kycId,
        status: updatedSession.status,
        ctosStatus: normalized.status,
        ctosResult: normalized.result,
        details: normalized
      });

    } catch (truestackError) {
      console.error('Error getting KYC status:', truestackError);
      return res.status(500).json({ 
        message: 'Failed to get KYC status',
        error: truestackError instanceof Error ? truestackError.message : 'Unknown error'
      });
    }

  } catch (err) {
    console.error('Error checking KYC status:', err);
    return res.status(500).json({ message: "Failed to check status" });
  }
});

// Poll status
router.get("/:kycId/status", authenticateKycOrAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { kycId } = req.params as any;
    const session = await db.kycSession.findUnique({ where: { id: kycId } });
    if (!session) return res.status(404).json({ message: "Not found" });
    if (session.userId !== req.user?.userId) return res.status(403).json({ message: "Forbidden" });
    return res.json({ 
      status: session.status, 
      faceMatchScore: session.faceMatchScore, 
      livenessScore: session.livenessScore,
      ctosStatus: session.ctosStatus,
      ctosResult: session.ctosResult,
      ctosOnboardingUrl: session.ctosOnboardingUrl,
      ctosExpiredAt: session.ctosExpiredAt
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed" });
  }
});

// Get KYC session details (for review screen)
router.get("/:kycId/details", authenticateKycOrAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { kycId } = req.params as any;
    const session = await db.kycSession.findUnique({ 
      where: { id: kycId },
      include: { documents: true }
    });
    if (!session) return res.status(404).json({ message: "Not found" });
    if (session.userId !== req.user?.userId) return res.status(403).json({ message: "Forbidden" });
    return res.json({
      kycId: session.id,
      status: session.status,
      documents: session.documents,
      completedAt: session.completedAt
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed" });
  }
});

// Get user's KYC images for profile page
router.get("/images", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ message: "Unauthorized" });
    
    console.log(`Fetching KYC images for user: ${req.user.userId}`);
    
    // Find the most recent KYC session with documents for this user (any status)
    const session = await db.kycSession.findFirst({
      where: { 
        userId: req.user.userId
      },
      include: { documents: true },
      orderBy: { createdAt: "desc" }
    });
    
    console.log(`Found session:`, session ? `${session.id} with ${session.documents.length} documents` : 'none');
    
    let documents: any[] = [];
    let kycSessionId = session?.id || 'unknown';
    
    if (session?.documents && session.documents.length > 0) {
      // Use session documents - these come from the include and have different field structure
      documents = session.documents.map((doc: any) => ({
        id: doc.id,
        type: doc.type,
        storageUrl: doc.storageUrl || doc.filePath // Handle both field names
      }));
      console.log(`Using session documents: ${documents.length} found`);
    } else {
      // Fallback: Check kyc_documents table directly
      console.log("No documents in session, checking kyc_documents table...");
      
      const kycDocuments = await db.kycDocument.findMany({
        where: { 
          kycSession: {
            userId: req.user.userId
          }
        },
        orderBy: { createdAt: "desc" }
      });
      
      if (kycDocuments.length > 0) {
        console.log(`Found ${kycDocuments.length} documents in kyc_documents table`);
        documents = kycDocuments.map((doc: any) => ({
          id: doc.id,
          type: doc.type,
          storageUrl: doc.storageUrl
        }));
        kycSessionId = kycDocuments[0].kycId || session?.id || 'unknown';
      }
    }
    
    console.log(`Final documents:`, documents.map(d => ({ id: d.id, type: d.type, hasUrl: !!d.storageUrl })));
    
    if (documents.length === 0) {
      const debugInfo = session 
        ? `Found session ${session.id} with status: ${session.status}, but no documents`
        : "No KYC sessions found";
        
      return res.status(404).json({ 
        message: "No KYC documents found", 
        debug: debugInfo 
      });
    }
    
    const front = documents.find((d: any) => d.type === "front");
    const back = documents.find((d: any) => d.type === "back");
    const selfie = documents.find((d: any) => d.type === "selfie");
    
    console.log(`Document URLs:`, {
      front: front?.storageUrl,
      back: back?.storageUrl,
      selfie: selfie?.storageUrl
    });
    
    return res.json({
      kycId: kycSessionId,
      completedAt: session?.completedAt || null,
      images: {
        front: front ? {
          id: front.id,
          url: front.storageUrl,
          type: "IC Front"
        } : null,
        back: back ? {
          id: back.id,
          url: back.storageUrl,
          type: "IC Back"
        } : null,
        selfie: selfie ? {
          id: selfie.id,
          url: selfie.storageUrl,
          type: "Selfie"
        } : null
      }
    });
  } catch (err) {
    console.error("Error fetching KYC images:", err);
    return res.status(500).json({ message: "Failed to fetch KYC images" });
  }
});

// Get individual KYC image file
router.get("/images/:imageId", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ message: "Unauthorized" });
    
    const { imageId } = req.params;
    
    // Find the document and verify ownership
    const document = await db.kycDocument.findUnique({
      where: { id: imageId },
      include: { 
        kycSession: { 
          select: { userId: true, status: true } 
        } 
      }
    });
    
    if (!document) {
      return res.status(404).json({ message: "Image not found" });
    }
    
    if (document.kycSession.userId !== req.user.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    // Handle base64 data URLs (from CTOS)
    if (document.storageUrl.startsWith('data:')) {
      // Extract base64 data and send as image
      const matches = document.storageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', buffer.length);
        return res.send(buffer);
      }
      return res.status(400).json({ message: "Invalid data URL format" });
    }
    
    // Stream from S3
    try {
      const { stream, contentType, contentLength } = await getS3ObjectStream(document.storageUrl);
      res.setHeader('Content-Type', contentType);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      return stream.pipe(res);
    } catch (s3Error) {
      console.error("Error streaming from S3:", s3Error);
      return res.status(404).json({ message: "File not found in storage" });
    }
  } catch (err) {
    console.error("Error serving KYC image:", err);
    return res.status(500).json({ message: "Failed to serve image" });
  }
});

// Accept KYC results and update user profile
router.post("/:kycId/accept", authenticateKycOrAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { kycId } = req.params as any;
    const session = await db.kycSession.findUnique({ 
      where: { id: kycId },
      include: { documents: true, application: true }
    });
    if (!session) return res.status(404).json({ message: "KYC session not found" });
    if (session.userId !== req.user?.userId) return res.status(403).json({ message: "Forbidden" });

    if (session.status !== "APPROVED") {
      return res.status(400).json({ message: "KYC is not approved yet" });
    }

    // Check if there are any older KYC sessions for this user that should be cleaned up
    const olderSessions = await db.kycSession.findMany({
      where: {
        userId: req.user?.userId,
        id: { not: kycId },
        createdAt: { lt: session.createdAt }
      },
      include: { documents: true }
    });

    // Clean up older sessions and their documents
    for (const oldSession of olderSessions) {
      console.log(`Cleaning up old KYC session ${oldSession.id} after accepting new session ${kycId}`);
      
      // Delete old files from S3 (skip data URLs which are inline base64)
      for (const doc of oldSession.documents) {
        if (!doc.storageUrl.startsWith('data:')) {
          try {
            await deleteFromS3(doc.storageUrl);
            console.log(`Deleted old S3 file during cleanup: ${doc.storageUrl}`);
          } catch (deleteErr) {
            console.warn(`Failed to delete old S3 file ${doc.storageUrl}:`, deleteErr);
          }
        }
      }
      
      // Delete documents and session from database
      await db.kycDocument.deleteMany({ where: { kycId: oldSession.id } });
      await db.kycSession.delete({ where: { id: oldSession.id } });
    }

    const ocr: any = session.ocrData || {};
    // Extract fields from OCR
    const fullName: string | undefined = ocr.name || ocr.fullName;
    const icNumber: string | undefined = ocr.icNumber || ocr.ic_number || ocr.nric;
    const dob: string | undefined = ocr.dateOfBirth || ocr.dob;
    const addressRaw: string | undefined = ocr.address || ocr.address1 || ocr.addressRaw;

    // Update user profile fields (minimal safe mapping)
    const updatedUser = await db.user.update({
      where: { id: session.userId },
      data: {
        fullName: fullName ?? undefined,
        icNumber: icNumber ?? undefined,
        icType: icNumber ? "IC" : undefined,
        dateOfBirth: dob ? new Date(dob) : undefined,
        address1: addressRaw ?? undefined,
        // kycStatus: true, // Removed - KYC status will be set manually in later verification step
      }
    });

    // Check if this KYC is tied to an application in the new multi-step flow
    let applicationUpdated = false;
    if (session.application) {
      const newFlowStatuses = ["PENDING_SIGNING_OTP", "PENDING_KYC", "PENDING_PROFILE_CONFIRMATION", "PENDING_CERTIFICATE_OTP", "PENDING_SIGNING_OTP_DS", "PENDING_SIGNATURE"];
      
      if (newFlowStatuses.includes(session.application.status) || session.application.status === "PENDING_APPROVAL") {
        // Update application status to PENDING_PROFILE_CONFIRMATION for new flow
        await db.loanApplication.update({
          where: { id: session.application.id },
          data: { status: "PENDING_PROFILE_CONFIRMATION" }
        });
        applicationUpdated = true;
        console.log(`KYC accepted for application ${session.application.id} - updated status to PENDING_PROFILE_CONFIRMATION`);
      }
    }

    return res.json({ 
      message: "Profile updated with KYC data", 
      user: { 
        id: updatedUser.id, 
        fullName: updatedUser.fullName, 
        icNumber: updatedUser.icNumber, 
        dateOfBirth: updatedUser.dateOfBirth, 
        address1: updatedUser.address1 
      }, 
      kycId,
      applicationUpdated,
      applicationId: session.application?.id
    });
  } catch (err) {
    console.error("KYC accept error", err);
    return res.status(500).json({ message: "Failed to accept KYC results" });
  }
});

// OCR validation endpoints removed - KYC now uses simplified image upload only

// New endpoint to get user's KYC status based on CTOS data
// GET /api/kyc/user-documents - Get KYC documents for authenticated user (with latest CTOS update)
router.get('/user-documents', authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find the most recent approved KYC session
    // Need to check for sessions where userId might have a prefix (like OPG-Capital, etc.)
    let approvedSession = await db.kycSession.findFirst({
      where: {
        OR: [
          {
            userId,
            ctosResult: 1 // Approved
          },
          {
            userId: { endsWith: userId },
            ctosResult: 1 // Approved
          }
        ]
      },
      include: {
        documents: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!approvedSession) {
      return res.json({
        success: true,
        hasDocuments: false,
        documents: []
      });
    }

    // Check if we have stored images, if not fetch from Truestack
    const hasStoredImages = approvedSession.documents && approvedSession.documents.length >= 3;
    console.log(`Approved session ${approvedSession.id} has ${approvedSession.documents?.length || 0} stored images`);
    
    if (!hasStoredImages) {
      console.log(`Fetching images from Truestack for approved session ${approvedSession.id} - no stored images found`);
      try {
        // Refresh session to get image URLs
        const truestackStatus = await truestackService.refreshSessionStatus(approvedSession.ctosOnboardingId);

        console.log('Truestack response for missing images:', {
          hasImages: !!truestackStatus.images,
          frontImage: !!truestackStatus.images?.front_document,
          backImage: !!truestackStatus.images?.back_document,
          faceImage: !!truestackStatus.images?.face_image
        });

        // Download and store images if available
        if (truestackStatus.images) {
          const images = await truestackService.downloadSessionImages(truestackStatus.images);
          await storeKycImages(approvedSession.id, images);
          console.log(`Stored images from Truestack for approved session`);
        } else {
          console.log('No images found in Truestack response for approved session');
        }
      } catch (truestackError) {
        console.error('Error fetching images from Truestack for approved session:', truestackError);
        // Continue with existing documents if Truestack fetch fails
      }
    } else {
      console.log(`Skipping Truestack API call for approved session ${approvedSession.id} - already has stored images`);
    }

    // Re-fetch the session with updated documents
    approvedSession = await db.kycSession.findFirst({
      where: {
        id: approvedSession.id
      },
      include: {
        documents: true
      }
    });

    return res.json({
      success: true,
      hasDocuments: true,
      sessionId: approvedSession!.id,
      documents: approvedSession!.documents.map((doc: any) => ({
        id: doc.id,
        type: doc.type,
        storageUrl: doc.storageUrl,
        createdAt: doc.createdAt
      }))
    });

  } catch (error) {
    console.error('Error fetching user KYC documents:', error);
    return res.status(500).json({ error: 'Failed to fetch KYC documents' });
  }
});

router.get('/user-ctos-status', authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find the best KYC session for this user (prioritize approved, then most recent)
    // Need to check for sessions where userId might have a prefix (like OPG-Capital, etc.)
    let kycSession = await db.kycSession.findFirst({
      where: {
        OR: [
          {
            userId,
            ctosOnboardingId: { not: null },
            ctosResult: 1 // Approved
          },
          {
            userId: { endsWith: userId },
            ctosOnboardingId: { not: null },
            ctosResult: 1 // Approved
          }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`User ${userId} - Found approved KYC session:`, {
      found: !!kycSession,
      sessionId: kycSession?.id,
      ctosOnboardingId: kycSession?.ctosOnboardingId,
      ctosResult: kycSession?.ctosResult,
      status: kycSession?.status,
      sessionUserId: kycSession?.userId
    });

    // Additional debug: Let's see what sessions exist for this user (with any prefix)
    const allSessions = await db.kycSession.findMany({
      where: {
        OR: [
          { userId },
          { userId: { endsWith: userId } }
        ]
      },
      select: {
        id: true,
        userId: true,
        ctosResult: true,
        ctosStatus: true,
        status: true,
        ctosOnboardingId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`User ${userId} - All sessions found:`, allSessions.map((s: any) => ({
      id: s.id,
      userId: s.userId,
      ctosResult: s.ctosResult,
      ctosStatus: s.ctosStatus,
      status: s.status,
      hasCtosOnboardingId: !!s.ctosOnboardingId,
      createdAt: s.createdAt
    })));

    // If no approved session found, get the most recent session with CTOS data
    if (!kycSession) {
      kycSession = await db.kycSession.findFirst({
        where: {
          OR: [
            {
              userId,
              ctosOnboardingId: { not: null }
            },
            {
              userId: { endsWith: userId },
              ctosOnboardingId: { not: null }
            }
          ]
        },
        select: {
          id: true,
          userId: true,
          status: true,
          ctosStatus: true,
          ctosResult: true,
          ctosOnboardingId: true,
          ctosOnboardingUrl: true,
          ctosExpiredAt: true,
          createdAt: true,
          completedAt: true,
          ctosData: true
        },
        orderBy: { createdAt: 'desc' }
      });

      console.log(`User ${userId} - Found most recent KYC session:`, {
        found: !!kycSession,
        sessionId: kycSession?.id,
        ctosOnboardingId: kycSession?.ctosOnboardingId,
        ctosResult: kycSession?.ctosResult,
        status: kycSession?.status
      });
    }

    if (!kycSession || !kycSession.ctosOnboardingId) {
      return res.json({
        success: true,
        hasKycSession: false,
        status: 'no_kyc_session',
        ctosStatus: null,
        ctosResult: null
      });
    }

    // Check if session is already approved and has images stored
    if (kycSession.ctosResult === 1) {
      // Check if we have stored images for this approved session
      const storedImages = await db.kycDocument.findMany({
        where: { kycId: kycSession.id }
      });
      
      if (storedImages.length >= 3) {
        console.log(`User ${userId} - Session already approved with ${storedImages.length} stored images, returning without API call`);
        
        // Make sure session status is updated to APPROVED if it's not already
        if (kycSession.status !== 'APPROVED') {
          console.log(`Updating session ${kycSession.id} status from ${kycSession.status} to APPROVED`);
          await db.kycSession.update({
            where: { id: kycSession.id },
            data: {
              status: 'APPROVED',
              completedAt: kycSession.completedAt || new Date()
            }
          });
        }
        
        // Set cache-busting headers to prevent 304 responses
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        return res.json({
          success: true,
          hasKycSession: true,
          status: 'approved',
          kycStatus: 'APPROVED',
          isAlreadyApproved: true,
          ctosStatus: kycSession.ctosStatus,
          ctosResult: kycSession.ctosResult,
          kycId: kycSession.id,
          completedAt: kycSession.completedAt || new Date()
        });
      } else {
        console.log(`User ${userId} - Session approved but only ${storedImages.length} images stored, fetching from Truestack`);
        // Continue to Truestack API call to fetch missing images
      }
    }

    // Call Truestack API to get latest status
    try {
      console.log(`🔍 Truestack Status Check - User: ${userId}, Session: ${kycSession.id}, OnboardingId: ${kycSession.ctosOnboardingId}`);
      
      const truestackStatus = await truestackService.refreshSessionStatus(kycSession.ctosOnboardingId);
      const normalized = truestackService.normalizeStatusResponse(truestackStatus);
      
      console.log(`✅ Truestack Response:`, { status: normalized.status, result: normalized.result });

      // Update our session with the latest status
      await db.kycSession.update({
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
          await storeKycImages(kycSession.id, images);
          console.log(`Stored/updated images for KYC session ${kycSession.id}`);
        } catch (imageError) {
          console.error('Error downloading images from Truestack:', imageError);
        }
      } else {
        console.log('No images found in Truestack response');
      }

      // Update user KYC status if approved
      if (normalized.status === 2 && normalized.result === 1) {
        await db.user.update({
          where: { id: kycSession.userId },
          data: { kycStatus: true }
        });
      }

      // Check if session is in progress and can be resumed
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const canResume = kycSession.status === 'IN_PROGRESS' && 
                       kycSession.ctosOnboardingUrl && 
                       (normalized.status === 0 || normalized.status === 1) &&
                       kycSession.createdAt >= twentyFourHoursAgo;

      return res.json({
        success: true,
        hasKycSession: true,
        kycSessionId: kycSession.id,
        status: kycSession.status,
        ctosStatus: normalized.status,
        ctosResult: normalized.result,
        ctosData: normalized,
        canRetry: normalized.result === 0 || normalized.result === 2,
        rejectMessage: normalized.result === 0 ? normalized.reject_message : null,
        isAlreadyApproved: normalized.result === 1 || kycSession.ctosResult === 1,
        canResume: canResume,
        resumeUrl: canResume ? kycSession.ctosOnboardingUrl : null
      });
    } catch (truestackError) {
      console.error('Error fetching Truestack status:', truestackError);
      
      // Return the last known status from our database
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const canResume = kycSession.status === 'IN_PROGRESS' && 
                       kycSession.ctosOnboardingUrl && 
                       (kycSession.ctosStatus === 0 || kycSession.ctosStatus === 1) &&
                       kycSession.createdAt >= twentyFourHoursAgo;

      return res.json({
        success: true,
        hasKycSession: true,
        kycSessionId: kycSession.id,
        status: kycSession.status,
        ctosStatus: kycSession.ctosStatus,
        ctosResult: kycSession.ctosResult,
        ctosData: kycSession.ctosData,
        canRetry: kycSession.ctosResult === 0 || kycSession.ctosResult === 2,
        rejectMessage: kycSession.ctosResult === 0 ? (kycSession.ctosData as any)?.reject_message : null,
        isAlreadyApproved: kycSession.ctosResult === 1,
        canResume: canResume,
        resumeUrl: canResume ? kycSession.ctosOnboardingUrl : null,
        error: 'Could not fetch latest status from KYC provider, showing cached data'
      });
    }
  } catch (error) {
    console.error('Error fetching user KYC status:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch user KYC status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export the helper function for use in other API files
export { userHasAllKycDocuments };

/**
 * Helper function to store KYC images from Truestack in the database
 */
async function storeKycImages(
  kycSessionId: string, 
  images: {
    front_document_image?: string;
    back_document_image?: string;
    face_image?: string;
    best_frame?: string;
  }
): Promise<void> {
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
      await db.kycDocument.upsert({
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

// Lightweight endpoint for database polling - only checks local database status
router.get('/session-status/:kycSessionId', authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
  try {
    const { kycSessionId } = req.params;
    
    // Simple database query - no external API calls
    const session = await db.kycSession.findUnique({
      where: { id: kycSessionId },
      select: {
        id: true,
        status: true,
        ctosResult: true,
        ctosStatus: true,
        completedAt: true,
        userId: true
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Verify this session belongs to the authenticated user
    if (session.userId !== req.user?.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Set cache-busting headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.json({
      success: true,
      status: session.status,
      ctosResult: session.ctosResult,
      ctosStatus: session.ctosStatus,
      isApproved: session.status === 'APPROVED',
      isCompleted: session.status === 'APPROVED' || session.status === 'REJECTED',
      completedAt: session.completedAt
    });

  } catch (err) {
    console.error('Error checking session status:', err);
    return res.status(500).json({ success: false, message: 'Failed to check status' });
  }
});

export default router;


