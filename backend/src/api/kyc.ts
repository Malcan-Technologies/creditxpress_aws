import { Router, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import axios from "axios";
import * as jwt from "jsonwebtoken";
import { authenticateAndVerifyPhone, authenticateKycOrAuth, AuthRequest, FileAuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();
const db: any = prisma as any;

function isLikelyPlaceholderOcr(ocr: any): boolean {
  if (!ocr) return true;
  const name = String(ocr.name || ocr.fullName || "").trim().toUpperCase();
  const ic = String(ocr.icNumber || ocr.ic_number || ocr.nric || "").trim();
  const dob = String(ocr.dateOfBirth || ocr.dob || "").trim();
  const address = String(ocr.address || ocr.address1 || ocr.addressRaw || "").trim().toUpperCase();
  if (!name || !dob || !address) return true;
  if (name === "JOHN DOE") return true;
  if (ic === "900101-14-1234") return true;
  if (dob === "1990-01-01") return true;
  if (address.includes("JALAN ABC")) return true;
  return false;
}

function isValidMalaysianNric(nric: string): boolean {
  return /^\d{6}-\d{2}-\d{4}$/.test(nric);
}

function deriveDobFromNric(nric: string): string | null {
  // YYMMDD-##-#### → return YYYY-MM-DD (assume 1900-1999 for YY >= 40 else 2000-2039 heuristic)
  if (!isValidMalaysianNric(nric)) return null;
  const [ymd] = nric.split("-");
  const yy = parseInt(ymd.slice(0, 2), 10);
  const mm = ymd.slice(2, 4);
  const dd = ymd.slice(4, 6);
  const century = yy >= 40 ? 1900 : 2000;
  const yyyy = century + yy;
  return `${yyyy}-${mm}-${dd}`;
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
    const { applicationId } = (req.body || {}) as { applicationId?: string };
    if (!req.user?.userId) return res.status(401).json({ message: "Unauthorized" });
    
    // If KYC already approved before, handle reuse
    const existingApproved = await db.kycSession.findFirst({ where: { userId: req.user.userId, status: { in: ["APPROVED"] } } });
    if (existingApproved) {
      if (applicationId) {
        // If tied to an application, advance it
        const application = await prisma.loanApplication.findUnique({ where: { id: applicationId } });
        if (application && application.userId === req.user.userId) {
          await prisma.loanApplication.update({ where: { id: applicationId }, data: { status: "PENDING_APPROVAL" } });
        }
      }
      // Return approved session
      const ttlMinutes = Number(process.env.KYC_TOKEN_TTL_MINUTES || 15);
      const kycToken = jwt.sign(
        { userId: req.user.userId, kycId: existingApproved.id },
        process.env.KYC_JWT_SECRET || (process.env.JWT_SECRET || "your-secret-key"),
        { expiresIn: `${ttlMinutes}m` }
      );
      return res.json({ reused: true, kycId: existingApproved.id, status: "APPROVED", kycToken, ttlMinutes });
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
    const session = await db.kycSession.findUnique({ where: { id: kycId } });
    if (!session) return res.status(404).json({ message: "KYC session not found" });
    if (session.userId !== req.user?.userId) return res.status(403).json({ message: "Forbidden" });

    const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] };
    const required = ["front", "back", "selfie"] as const;
    for (const key of required) {
      const file = filesMap?.[key]?.[0];
      if (!file) continue; // allow partial upload & retry
      const buffer = fs.readFileSync(file.path);
      const hash = sha256(buffer);
      const storageUrl = `/uploads/kyc/${file.filename}`;
      await db.kycDocument.create({ data: { kycId, type: key, storageUrl, hashSha256: hash } });
    }

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

    // Call Python microservices with error handling
    const ocrUrl = process.env.KYC_OCR_URL || (process.env.KYC_DOCKER === 'true' ? 'http://ocr:7001/ocr' : 'http://localhost:7001/ocr');
    const faceUrl = process.env.KYC_FACE_URL || (process.env.KYC_DOCKER === 'true' ? 'http://face:7002/face-match' : 'http://localhost:7002/face-match');
    const liveUrl = process.env.KYC_LIVENESS_URL || (process.env.KYC_DOCKER === 'true' ? 'http://liveness:7003/liveness' : 'http://localhost:7003/liveness');

    let ocrData: any = null;
    let faceMatchScore = 0;
    let livenessScore = 0;

    try {
      const ocrRes = await axios.post(ocrUrl, { frontUrl: front.storageUrl, backUrl: back.storageUrl });
      ocrData = ocrRes.data;
      // Normalize keys
      if (ocrData && typeof ocrData === 'object') {
        const normalized = {
          name: ocrData.name || ocrData.fullName || undefined,
          icNumber: ocrData.icNumber || ocrData.ic_number || ocrData.nric || undefined,
          dateOfBirth: ocrData.dateOfBirth || ocrData.dob || undefined,
          address: ocrData.address || ocrData.address1 || ocrData.addressRaw || undefined,
        };
        // If DOB missing but NRIC is valid, derive DOB
        if (!normalized.dateOfBirth && normalized.icNumber && isValidMalaysianNric(normalized.icNumber)) {
          const derived = deriveDobFromNric(normalized.icNumber);
          if (derived) normalized.dateOfBirth = derived;
        }
        // If stub/placeholder detected, fail fast so frontend asks user to retake
        if (isLikelyPlaceholderOcr({
          name: normalized.name,
          icNumber: normalized.icNumber,
          dob: normalized.dateOfBirth,
          address: normalized.address,
        })) {
          throw new Error('Placeholder OCR detected');
        }
        ocrData = normalized;
      }
    } catch (e) {
      await db.kycSession.update({ where: { id: kycId }, data: { status: "FAILED", retryCount: { increment: 1 } } });
      return res.status(400).json({ message: "Unable to read MyKad details. Please retake a clearer photo of your card.", code: "OCR_FAIL", nextStep: "retake_front" });
    }

    try {
      const faceRes = await axios.post(faceUrl, { icFrontUrl: front.storageUrl, selfieUrl: selfie.storageUrl });
      faceMatchScore = Number(faceRes.data?.score ?? 0);
    } catch (e) {
      await db.kycSession.update({ where: { id: kycId }, data: { status: "FAILED", retryCount: { increment: 1 } } });
      return res.status(400).json({ message: "Face match could not be completed. Please retake your selfie in good lighting.", code: "FACE_SERVICE_FAIL", nextStep: "retake_selfie" });
    }

    try {
      const liveRes = await axios.post(liveUrl, { selfieUrl: selfie.storageUrl });
      livenessScore = Number(liveRes.data?.score ?? 0);
    } catch (e) {
      await db.kycSession.update({ where: { id: kycId }, data: { status: "FAILED", retryCount: { increment: 1 } } });
      return res.status(400).json({ message: "Liveness check failed. Please retake your selfie without glare and keep still.", code: "LIVENESS_SERVICE_FAIL", nextStep: "retake_selfie" });
    }

    const threshold = Number(process.env.KYC_FACE_THRESHOLD || 0.75);
    const liveThreshold = Number(process.env.KYC_LIVENESS_THRESHOLD || 0.5);

    // Simple rules for status
    let finalStatus: "APPROVED" | "MANUAL_REVIEW" | "REJECTED" = "APPROVED";
    if (faceMatchScore < threshold || livenessScore < liveThreshold) {
      finalStatus = faceMatchScore < threshold && livenessScore < liveThreshold ? "REJECTED" : "MANUAL_REVIEW";
    }

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
      await db.loanApplication.update({ where: { id: session.applicationId }, data: { status: "PENDING_APPROVAL" } });
    }

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
    const session = await db.kycSession.findUnique({ where: { id: kycId } });
    if (!session) return res.status(404).json({ message: "Not found" });
    if (session.userId !== req.user?.userId) return res.status(403).json({ message: "Forbidden" });
    return res.json({
      kycId: session.id,
      status: session.status,
      ocr: session.ocrData,
      faceMatchScore: session.faceMatchScore,
      livenessScore: session.livenessScore,
      completedAt: session.completedAt
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed" });
  }
});

// Accept KYC results and update user profile
router.post("/:kycId/accept", authenticateKycOrAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { kycId } = req.params as any;
    const session = await db.kycSession.findUnique({ where: { id: kycId } });
    if (!session) return res.status(404).json({ message: "KYC session not found" });
    if (session.userId !== req.user?.userId) return res.status(403).json({ message: "Forbidden" });

    if (session.status !== "APPROVED") {
      return res.status(400).json({ message: "KYC is not approved yet" });
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
        kycStatus: true,
      }
    });

    return res.json({ message: "Profile updated with KYC data", user: { id: updatedUser.id, fullName: updatedUser.fullName, icNumber: updatedUser.icNumber, dateOfBirth: updatedUser.dateOfBirth, address1: updatedUser.address1 }, kycId });
  } catch (err) {
    console.error("KYC accept error", err);
    return res.status(500).json({ message: "Failed to accept KYC results" });
  }
});

// Step-wise validation: front (OCR readability)
router.post("/:kycId/validate/front", authenticateKycOrAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { kycId } = req.params as any;
    const session = await db.kycSession.findUnique({ where: { id: kycId }, include: { documents: true } });
    if (!session) return res.status(404).json({ message: "KYC session not found" });
    if (session.userId !== req.user?.userId) return res.status(403).json({ message: "Forbidden" });

    const front = session.documents.find((d: any) => d.type === "front");
    if (!front) return res.status(400).json({ message: "Front image missing. Please capture the front side." });

    const ocrUrl = process.env.KYC_OCR_URL || (process.env.KYC_DOCKER === 'true' ? 'http://ocr:7001/ocr' : 'http://localhost:7001/ocr');
    try {
      const ocrRes = await axios.post(ocrUrl, { frontUrl: front.storageUrl });
      let o = ocrRes.data || {};
      const normalized = {
        name: o.name || o.fullName || undefined,
        icNumber: o.icNumber || o.ic_number || o.nric || undefined,
        dateOfBirth: o.dateOfBirth || o.dob || undefined,
        address: o.address || o.address1 || o.addressRaw || undefined,
      } as any;
      if (!normalized.icNumber || !isValidMalaysianNric(normalized.icNumber)) {
        return res.status(400).json({ message: "Unable to read your IC number. Please recapture the front side.", code: "OCR_FAIL", nextStep: "retake_front" });
      }
      if (!normalized.dateOfBirth) {
        const derived = deriveDobFromNric(normalized.icNumber);
        if (derived) normalized.dateOfBirth = derived;
      }
      if (isLikelyPlaceholderOcr({ name: normalized.name, icNumber: normalized.icNumber, dob: normalized.dateOfBirth, address: normalized.address })) {
        return res.status(400).json({ message: "Front photo looks like a placeholder. Please retake with clearer lighting.", code: "OCR_PLACEHOLDER", nextStep: "retake_front" });
      }
      const merged = { ...(session.ocrData as any || {}), front: normalized };
      await db.kycSession.update({ where: { id: kycId }, data: { ocrData: merged } });
      return res.json({ ok: true, ocr: normalized });
    } catch (e) {
      return res.status(400).json({ message: "We couldn't read your card. Please retake the front photo with less glare and better focus.", code: "OCR_FAIL", nextStep: "retake_front" });
    }
  } catch (err) {
    return res.status(500).json({ message: "Validation failed" });
  }
});

// Step-wise validation: back (OCR both sides)
router.post("/:kycId/validate/back", authenticateKycOrAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { kycId } = req.params as any;
    const session = await db.kycSession.findUnique({ where: { id: kycId }, include: { documents: true } });
    if (!session) return res.status(404).json({ message: "KYC session not found" });
    if (session.userId !== req.user?.userId) return res.status(403).json({ message: "Forbidden" });

    const front = session.documents.find((d: any) => d.type === "front");
    const back = session.documents.find((d: any) => d.type === "back");
    if (!front || !back) return res.status(400).json({ message: "Both front and back images are required." });

    const ocrUrl = process.env.KYC_OCR_URL || (process.env.KYC_DOCKER === 'true' ? 'http://ocr:7001/ocr' : 'http://localhost:7001/ocr');
    try {
      const ocrRes = await axios.post(ocrUrl, { frontUrl: front.storageUrl, backUrl: back.storageUrl });
      let o = ocrRes.data || {};
      const normalized = {
        name: o.name || o.fullName || undefined,
        icNumber: o.icNumber || o.ic_number || o.nric || undefined,
        dateOfBirth: o.dateOfBirth || o.dob || undefined,
        address: o.address || o.address1 || o.addressRaw || undefined,
      } as any;
      if (!normalized.icNumber || !isValidMalaysianNric(normalized.icNumber)) {
        return res.status(400).json({ message: "Unable to read your IC number from back. Please recapture the back side.", code: "OCR_FAIL", nextStep: "retake_back" });
      }
      // Compare against front OCR if available
      const frontIc = (session.ocrData as any)?.front?.icNumber as string | undefined;
      if (frontIc && frontIc !== normalized.icNumber) {
        return res.status(400).json({ message: "IC numbers on front and back do not match.", code: "IC_MISMATCH", nextStep: "retake_front" });
      }
      if (!normalized.dateOfBirth) {
        const derived = deriveDobFromNric(normalized.icNumber);
        if (derived) normalized.dateOfBirth = derived;
      }
      if (isLikelyPlaceholderOcr({ name: normalized.name, icNumber: normalized.icNumber, dob: normalized.dateOfBirth, address: normalized.address })) {
        return res.status(400).json({ message: "Back photo looks like a placeholder. Please retake with clearer lighting.", code: "OCR_PLACEHOLDER", nextStep: "retake_back" });
      }
      const merged = { ...(session.ocrData as any || {}), back: normalized };
      await db.kycSession.update({ where: { id: kycId }, data: { ocrData: merged } });
      return res.json({ ok: true, ocr: normalized });
    } catch (e) {
      return res.status(400).json({ message: "We couldn't read the back side. Please retake the back photo with better lighting.", code: "OCR_FAIL", nextStep: "retake_back" });
    }
  } catch (err) {
    return res.status(500).json({ message: "Validation failed" });
  }
});

// Step-wise validation: selfie (face match + liveness)
router.post("/:kycId/validate/selfie", authenticateKycOrAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { kycId } = req.params as any;
    const session = await db.kycSession.findUnique({ where: { id: kycId }, include: { documents: true } });
    if (!session) return res.status(404).json({ message: "KYC session not found" });
    if (session.userId !== req.user?.userId) return res.status(403).json({ message: "Forbidden" });

    const front = session.documents.find((d: any) => d.type === "front");
    const selfie = session.documents.find((d: any) => d.type === "selfie");
    if (!front || !selfie) return res.status(400).json({ message: "Front and selfie images are required." });

    const faceUrl = process.env.KYC_FACE_URL || (process.env.KYC_DOCKER === 'true' ? 'http://face:7002/face-match' : 'http://localhost:7002/face-match');
    const liveUrl = process.env.KYC_LIVENESS_URL || (process.env.KYC_DOCKER === 'true' ? 'http://liveness:7003/liveness' : 'http://localhost:7003/liveness');
    const threshold = Number(process.env.KYC_FACE_THRESHOLD || 0.75);
    const liveThreshold = Number(process.env.KYC_LIVENESS_THRESHOLD || 0.5);
    try {
      const faceRes = await axios.post(faceUrl, { icFrontUrl: front.storageUrl, selfieUrl: selfie.storageUrl });
      const liveRes = await axios.post(liveUrl, { selfieUrl: selfie.storageUrl });
      const faceMatchScore = Number(faceRes.data?.score ?? 0);
      const livenessScore = Number(liveRes.data?.score ?? 0);
      if (faceMatchScore < threshold) return res.status(400).json({ message: "Face did not match the card. Please retake your selfie in good lighting.", nextStep: "retake_selfie" });
      if (livenessScore < liveThreshold) return res.status(400).json({ message: "Liveness check failed. Please retake your selfie without glare and keep still.", nextStep: "retake_selfie" });
      return res.json({ ok: true });
    } catch {
      return res.status(400).json({ message: "Selfie validation failed. Please retake your selfie.", nextStep: "retake_selfie" });
    }
  } catch (err) {
    return res.status(500).json({ message: "Validation failed" });
  }
});

export default router;


