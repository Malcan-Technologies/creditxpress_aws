/**
 * S3 Storage Module
 * 
 * Handles file uploads to AWS S3 and generates presigned URLs for downloads.
 * 
 * Required dependencies (add to package.json):
 *   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 * 
 * Configuration is loaded from centralized config module.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { s3Config } from "./config";

// S3 Client configuration
const s3Client = new S3Client({
  region: s3Config.region,
});

const BUCKET = s3Config.bucket;
const UPLOAD_PREFIX = s3Config.uploadPrefix;

// Check if S3 is configured
function isS3Configured(): boolean {
  return s3Config.isConfigured;
}

/**
 * S3 Folder Structure:
 * 
 * uploads/
 * ├── kyc/
 * │   └── 2025/01/
 * │       ├── front/
 * │       ├── back/
 * │       └── selfie/
 * ├── documents/
 * │   └── 2025/01/
 * │       ├── income-proof/
 * │       ├── bank-statement/
 * │       └── other/
 * ├── stamp-certificates/
 * │   └── 2025/01/
 * ├── disbursement-slips/
 * │   └── 2025/01/
 * ├── receipts/
 * │   └── 2025/01/
 * └── default-letters/
 *     └── 2025/01/
 */

// Document type categories for folder organization
export const S3_FOLDERS = {
  KYC: 'kyc',
  KYC_FRONT: 'kyc/front',
  KYC_BACK: 'kyc/back',
  KYC_SELFIE: 'kyc/selfie',
  DOCUMENTS: 'documents',
  STAMP_CERTIFICATES: 'stamp-certificates',
  DISBURSEMENT_SLIPS: 'disbursement-slips',
  RECEIPTS: 'receipts',
  DEFAULT_LETTERS: 'default-letters',
  SIGNED_AGREEMENTS: 'signed-agreements',
  STAMPED_AGREEMENTS: 'stamped-agreements',
} as const;

export type S3FolderType = typeof S3_FOLDERS[keyof typeof S3_FOLDERS];

// Generate unique filename with original name preserved for reference
function generateUniqueFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  const baseName = path.basename(originalFilename, ext)
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Sanitize filename
    .substring(0, 50); // Limit base name length
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(4).toString("hex");
  return `${timestamp}-${randomHash}-${baseName}${ext}`;
}

// Get current date folder (YYYY/MM format)
function getDateFolder(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}/${month}`;
}

// Build S3 key with proper folder structure
// Format: uploads/{category}/{YYYY}/{MM}/{filename}
function buildS3Key(filename: string, subfolder?: string): string {
  const parts = [UPLOAD_PREFIX];
  
  if (subfolder) {
    parts.push(subfolder);
  }
  
  // Add date-based subfolder for organization
  parts.push(getDateFolder());
  
  parts.push(filename);
  return parts.join("/");
}

/**
 * Build S3 key with custom organization options
 * 
 * @param filename - The filename to use
 * @param options - Organization options
 * @returns Full S3 key
 */
export function buildOrganizedS3Key(
  filename: string,
  options: {
    folder: S3FolderType;
    subFolder?: string;
    includeDate?: boolean;
    userId?: string;
  }
): string {
  const parts = [UPLOAD_PREFIX, options.folder];
  
  // Add date folder by default
  if (options.includeDate !== false) {
    parts.push(getDateFolder());
  }
  
  // Add user-specific subfolder if provided (for better organization)
  if (options.userId) {
    // Use first 8 chars of user ID for privacy
    parts.push(options.userId.substring(0, 8));
  }
  
  // Add custom subfolder if provided
  if (options.subFolder) {
    parts.push(options.subFolder);
  }
  
  parts.push(filename);
  return parts.join("/");
}

export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

export interface PresignedUrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a file buffer to S3
 * 
 * @param buffer - File buffer to upload
 * @param originalFilename - Original filename (used for extension)
 * @param contentType - MIME type of the file
 * @param subfolder - Optional subfolder within the upload prefix
 * @returns Upload result with S3 key
 */
export async function uploadToS3(
  buffer: Buffer,
  originalFilename: string,
  contentType: string,
  subfolder?: string
): Promise<UploadResult> {
  if (!isS3Configured()) {
    return {
      success: false,
      error: "S3 is not configured. Set AWS_REGION and S3_BUCKET environment variables.",
    };
  }

  try {
    const filename = generateUniqueFilename(originalFilename);
    const key = buildS3Key(filename, subfolder);

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Server-side encryption
      ServerSideEncryption: "AES256",
    });

    await s3Client.send(command);

    return {
      success: true,
      key,
      url: `s3://${BUCKET}/${key}`,
    };
  } catch (error) {
    console.error("S3 upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
}

/**
 * Upload options for organized file storage
 */
export interface OrganizedUploadOptions {
  folder: S3FolderType;
  subFolder?: string;
  userId?: string;
  includeDate?: boolean;
}

/**
 * Upload a file buffer to S3 with organized folder structure
 * 
 * @param buffer - File buffer to upload
 * @param originalFilename - Original filename (used for extension)
 * @param contentType - MIME type of the file
 * @param options - Organization options for folder structure
 * @returns Upload result with S3 key
 * 
 * @example
 * // Upload KYC front image
 * await uploadToS3Organized(buffer, 'id-front.jpg', 'image/jpeg', {
 *   folder: S3_FOLDERS.KYC_FRONT,
 *   userId: 'user123'
 * });
 * // Result: uploads/kyc/front/2025/01/user123/1234567890-abc123-id-front.jpg
 */
export async function uploadToS3Organized(
  buffer: Buffer,
  originalFilename: string,
  contentType: string,
  options: OrganizedUploadOptions
): Promise<UploadResult> {
  if (!isS3Configured()) {
    return {
      success: false,
      error: "S3 is not configured. Set AWS_REGION and S3_BUCKET environment variables.",
    };
  }

  try {
    const filename = generateUniqueFilename(originalFilename);
    const key = buildOrganizedS3Key(filename, options);

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    });

    await s3Client.send(command);

    return {
      success: true,
      key,
      url: `s3://${BUCKET}/${key}`,
    };
  } catch (error) {
    console.error("S3 upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
}

/**
 * Generate a presigned URL for downloading a file from S3
 * 
 * @param key - S3 object key
 * @param expiresInSeconds - URL expiration time (default: 1 hour)
 * @param downloadFilename - Optional filename for Content-Disposition header
 * @returns Presigned URL result
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds: number = 3600,
  downloadFilename?: string
): Promise<PresignedUrlResult> {
  if (!isS3Configured()) {
    return {
      success: false,
      error: "S3 is not configured. Set AWS_REGION and S3_BUCKET environment variables.",
    };
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ...(downloadFilename && {
        ResponseContentDisposition: `attachment; filename="${downloadFilename}"`,
      }),
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });

    return {
      success: true,
      url,
    };
  } catch (error) {
    console.error("S3 presigned URL error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown presigned URL error",
    };
  }
}

/**
 * Generate a presigned URL for uploading directly to S3 (client-side upload)
 * 
 * @param filename - Filename to upload
 * @param contentType - MIME type of the file
 * @param subfolder - Optional subfolder
 * @param expiresInSeconds - URL expiration time (default: 5 minutes)
 * @returns Presigned URL and key for PUT upload
 */
export async function getPresignedUploadUrl(
  filename: string,
  contentType: string,
  subfolder?: string,
  expiresInSeconds: number = 300
): Promise<{ success: boolean; url?: string; key?: string; error?: string }> {
  if (!isS3Configured()) {
    return {
      success: false,
      error: "S3 is not configured. Set AWS_REGION and S3_BUCKET environment variables.",
    };
  }

  try {
    const uniqueFilename = generateUniqueFilename(filename);
    const key = buildS3Key(uniqueFilename, subfolder);

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });

    return {
      success: true,
      url,
      key,
    };
  } catch (error) {
    console.error("S3 presigned upload URL error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown presigned upload URL error",
    };
  }
}

/**
 * Delete a file from S3
 * 
 * @param key - S3 object key to delete
 * @returns Success status
 */
export async function deleteFromS3(key: string): Promise<{ success: boolean; error?: string }> {
  if (!isS3Configured()) {
    return {
      success: false,
      error: "S3 is not configured. Set AWS_REGION and S3_BUCKET environment variables.",
    };
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    await s3Client.send(command);

    return { success: true };
  } catch (error) {
    console.error("S3 delete error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown delete error",
    };
  }
}

/**
 * Check if a file exists in S3
 * 
 * @param key - S3 object key
 * @returns Whether the file exists
 */
export async function fileExistsInS3(key: string): Promise<boolean> {
  if (!isS3Configured()) {
    return false;
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get a readable stream from S3 for proxying file downloads
 * 
 * @param key - S3 object key
 * @returns Object containing the stream, content type, and content length
 */
export async function getS3ObjectStream(key: string): Promise<{
  stream: Readable;
  contentType: string;
  contentLength: number;
}> {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured. Set AWS_REGION and S3_BUCKET environment variables.");
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error(`No body returned for S3 object: ${key}`);
  }

  return {
    stream: response.Body as Readable,
    contentType: response.ContentType || "application/octet-stream",
    contentLength: response.ContentLength || 0,
  };
}

/**
 * Get content type based on file extension
 * 
 * @param filename - Filename or path with extension
 * @returns MIME type string
 */
export function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
    ".csv": "text/csv",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Parse an S3 URL or key to extract the key
 * Handles both s3://bucket/key and plain key formats
 * 
 * @param urlOrKey - S3 URL or key
 * @returns The S3 key
 */
export function parseS3Key(urlOrKey: string): string {
  if (urlOrKey.startsWith("s3://")) {
    // s3://bucket/key format
    const parts = urlOrKey.replace("s3://", "").split("/");
    return parts.slice(1).join("/");
  }
  return urlOrKey;
}

/**
 * Helper to determine if a fileUrl is an S3 key vs legacy local path
 * 
 * @param fileUrl - File URL or path from database
 * @returns Whether this is an S3 key
 */
export function isS3Key(fileUrl: string): boolean {
  // S3 keys start with the upload prefix or s3://
  return fileUrl.startsWith("s3://") || fileUrl.startsWith(UPLOAD_PREFIX);
}

// Multer memory storage helper for S3 uploads
// Use this instead of diskStorage when uploading to S3
export const multerMemoryStorage = {
  storage: "memory" as const,
};

// Export the S3 client for advanced usage
export { s3Client, BUCKET, UPLOAD_PREFIX };
