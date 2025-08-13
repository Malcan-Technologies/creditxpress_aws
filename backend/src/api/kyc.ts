import { Router, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";

import * as jwt from "jsonwebtoken";
import { authenticateAndVerifyPhone, authenticateKycOrAuth, AuthRequest, FileAuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";

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

// Local disk storage (can be swapped for S3/MinIO integration)
const storage = (multer as any).diskStorage({
  destination: (_req: any, _file: Express.Multer.File, cb: (err: Error | null, dest: string) => void) => {
    const dir = path.join("uploads", "kyc");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req: any, file: Express.Multer.File, cb: (err: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fieldSize: 50 * 1024 * 1024 }
});

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// Start or reuse a KYC session (optionally tied to an application)
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
          await prisma.loanApplication.update({ where: { id: applicationId }, data: { status: "PENDING_APPROVAL" } });
        }
      }
      // Return approved session (existing behavior when not redoing)
      const ttlMinutes = Number(process.env.KYC_TOKEN_TTL_MINUTES || 15);
      const kycToken = jwt.sign(
        { userId: req.user.userId, kycId: existingSession.id },
        process.env.KYC_JWT_SECRET || (process.env.JWT_SECRET || "your-secret-key"),
        { expiresIn: `${ttlMinutes}m` }
      );
      return res.json({ reused: true, kycId: existingSession.id, status: "APPROVED", kycToken, ttlMinutes });
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
      const ttlMinutes = Number(process.env.KYC_TOKEN_TTL_MINUTES || 15);
      const kycToken = jwt.sign(
        { userId: req.user.userId, kycId: newSession.id },
        process.env.KYC_JWT_SECRET || (process.env.JWT_SECRET || "your-secret-key"),
        { expiresIn: `${ttlMinutes}m` }
      );
      return res.json({ reused: false, kycId: newSession.id, status: "PENDING", kycToken, ttlMinutes });
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
    const ttlMinutes = Number(process.env.KYC_TOKEN_TTL_MINUTES || 15);
    const kycToken = jwt.sign(
      { userId: req.user.userId, kycId: session.id },
      process.env.KYC_JWT_SECRET || (process.env.JWT_SECRET || "your-secret-key"),
      { expiresIn: `${ttlMinutes}m` }
    );
    return res.json({ reused: false, kycId: session.id, status: session.status, kycToken, ttlMinutes });
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
      
      const buffer = fs.readFileSync(file.path);
      const hash = sha256(buffer);
      const storageUrl = `/uploads/kyc/${file.filename}`;
      
      // Check if document of this type already exists for this KYC session
      const existingDoc = session.documents.find((doc: any) => doc.type === key);
      
      if (existingDoc) {
        console.log(`Overwriting existing ${key} image for KYC session ${kycId}`);
        
        // Delete the old file from disk to save space
        const oldFilePath = path.join(process.cwd(), existingDoc.storageUrl);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
            console.log(`Deleted old file: ${oldFilePath}`);
          } catch (deleteErr) {
            console.warn(`Failed to delete old file ${oldFilePath}:`, deleteErr);
            // Continue anyway - we'll update the database record
          }
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

    // If approved and tied to an application, update application status to PENDING_APPROVAL
    if (finalStatus === "APPROVED" && session.applicationId) {
      await db.loanApplication.update({ 
        where: { id: session.applicationId }, 
        data: { status: "PENDING_APPROVAL" } 
      });
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

// Poll status
router.get("/:kycId/status", authenticateKycOrAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { kycId } = req.params as any;
    const session = await db.kycSession.findUnique({ where: { id: kycId } });
    if (!session) return res.status(404).json({ message: "Not found" });
    if (session.userId !== req.user?.userId) return res.status(403).json({ message: "Forbidden" });
    return res.json({ status: session.status, faceMatchScore: session.faceMatchScore, livenessScore: session.livenessScore });
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
    
    // Find the most recent KYC session with documents for this user (any status)
    const session = await db.kycSession.findFirst({
      where: { 
        userId: req.user.userId
      },
      include: { documents: true },
      orderBy: { createdAt: "desc" }
    });
    
    if (!session || session.documents.length === 0) {
      const debugInfo = session 
        ? `Found session with status: ${session.status}, documents: ${session.documents.length}`
        : "No KYC sessions found";
        
      return res.status(404).json({ 
        message: "No KYC documents found", 
        debug: debugInfo 
      });
    }
    
    const front = session.documents.find((d: any) => d.type === "front");
    const back = session.documents.find((d: any) => d.type === "back");
    const selfie = session.documents.find((d: any) => d.type === "selfie");
    
    return res.json({
      kycId: session.id,
      completedAt: session.completedAt,
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
    
    // Serve the file
    const filePath = path.join(process.cwd(), document.storageUrl);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on disk" });
    }
    
    return res.sendFile(filePath);
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
      include: { documents: true }
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
      
      // Delete old files from disk
      for (const doc of oldSession.documents) {
        const oldFilePath = path.join(process.cwd(), doc.storageUrl);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
            console.log(`Deleted old file during cleanup: ${oldFilePath}`);
          } catch (deleteErr) {
            console.warn(`Failed to delete old file ${oldFilePath}:`, deleteErr);
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

    return res.json({ message: "Profile updated with KYC data", user: { id: updatedUser.id, fullName: updatedUser.fullName, icNumber: updatedUser.icNumber, dateOfBirth: updatedUser.dateOfBirth, address1: updatedUser.address1 }, kycId });
  } catch (err) {
    console.error("KYC accept error", err);
    return res.status(500).json({ message: "Failed to accept KYC results" });
  }
});

// OCR validation endpoints removed - KYC now uses simplified image upload only

// Export the helper function for use in other API files
export { userHasAllKycDocuments };

export default router;


