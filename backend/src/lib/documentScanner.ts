import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { prisma } from './prisma';

interface ScanStats {
  totalScanned: number;
  matched: number;
  orphaned: number;
  vpsFiles: number;
  onpremFiles: number;
  errors: string[];
}

interface FileMetadata {
  filePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  documentType: string;
  uploadedAt: Date;
  source: string;
  metadata?: any;
}

/**
 * Recursively scan directory for files
 */
async function scanDirectory(dirPath: string, baseDir: string): Promise<FileMetadata[]> {
  const results: FileMetadata[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subResults = await scanDirectory(fullPath, baseDir);
        results.push(...subResults);
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(fullPath);
          const relativePath = path.relative(baseDir, fullPath);
          const fileName = entry.name;
          const fileType = path.extname(fileName).toLowerCase();

          // Determine document type from directory structure
          let documentType = 'UNKNOWN';
          if (relativePath.includes('kyc')) {
            documentType = 'KYC';
          } else if (relativePath.includes('disbursement-slips')) {
            documentType = 'DISBURSEMENT_SLIP';
          } else if (relativePath.includes('stamped-agreements')) {
            documentType = 'STAMPED_AGREEMENT';
          } else if (relativePath.includes('stamp-certificates')) {
            documentType = 'STAMP_CERTIFICATE';
          } else if (relativePath.includes('default-letters')) {
            documentType = 'DEFAULT_LETTER';
          } else if (relativePath.includes('receipts') || fileName.startsWith('RCP-')) {
            documentType = 'PAYMENT_RECEIPT';
          }

          results.push({
            filePath: relativePath,
            fileName,
            fileSize: stats.size,
            fileType,
            documentType,
            uploadedAt: stats.birthtime || stats.mtime,
            source: 'VPS_UPLOADS',
          });
        } catch (fileError) {
          console.error(`Error processing file ${fullPath}:`, fileError);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }

  return results;
}

/**
 * Match file to database records
 */
async function matchFileToDatabase(file: FileMetadata): Promise<{
  userId?: string;
  userName?: string;
  loanId?: string;
  applicationId?: string;
  isOrphaned: boolean;
}> {
  // Try to match via UserDocument
  const userDoc = await prisma.userDocument.findFirst({
    where: {
      fileUrl: {
        contains: file.fileName,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
        },
      },
      application: {
        select: {
          id: true,
        },
      },
    },
  });

  if (userDoc) {
    return {
      userId: userDoc.userId,
      userName: userDoc.user.fullName || undefined,
      loanId: undefined,
      applicationId: userDoc.applicationId || undefined,
      isOrphaned: false,
    };
  }

  // Try to match via LoanDisbursement (disbursement slips)
  const disbursement = await prisma.loanDisbursement.findFirst({
    where: {
      paymentSlipUrl: {
        contains: file.fileName,
      },
    },
    include: {
      application: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
          loan: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (disbursement) {
    return {
      userId: disbursement.application.userId,
      userName: disbursement.application.user.fullName || undefined,
      loanId: disbursement.application.loan?.id,
      applicationId: disbursement.applicationId,
      isOrphaned: false,
    };
  }

  // Try to match via Loan PKI fields
  const loan = await prisma.loan.findFirst({
    where: {
      OR: [
        { pkiSignedPdfUrl: { contains: file.fileName } },
        { pkiStampedPdfUrl: { contains: file.fileName } },
        { pkiStampCertificateUrl: { contains: file.fileName } },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
        },
      },
      application: {
        select: {
          id: true,
        },
      },
    },
  });

  if (loan) {
    return {
      userId: loan.userId,
      userName: loan.user.fullName || undefined,
      loanId: loan.id,
      applicationId: loan.applicationId,
      isOrphaned: false,
    };
  }

  // Try to match via PaymentReceipt (payment receipts)
  const receipt = await prisma.paymentReceipt.findFirst({
    where: {
      OR: [
        { filePath: { contains: file.fileName } },
        { receiptNumber: { contains: file.fileName.replace('.pdf', '') } },
      ],
    },
    include: {
      repayment: {
        include: {
          loan: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
              application: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (receipt) {
    return {
      userId: receipt.repayment.loan.userId,
      userName: receipt.repayment.loan.user.fullName || undefined,
      loanId: receipt.repayment.loanId,
      applicationId: receipt.repayment.loan.applicationId,
      isOrphaned: false,
    };
  }

  // No match found
  return {
    isOrphaned: true,
  };
}

/**
 * Fetch on-prem signed documents from signing orchestrator
 */
async function fetchOnPremDocuments(): Promise<FileMetadata[]> {
  const results: FileMetadata[] = [];
  
  const orchestratorUrl = process.env.SIGNING_ORCHESTRATOR_URL;
  const apiKey = process.env.SIGNING_ORCHESTRATOR_API_KEY;

  if (!orchestratorUrl || !apiKey) {
    console.warn('Signing orchestrator URL or API key not configured, skipping on-prem scan');
    return results;
  }

  try {
    // Try to fetch agreements from signing orchestrator
    // Try /api/agreements first, fallback to /api/admin/agreements
    let response;
    let agreements = [];
    
    try {
      response = await axios.get(`${orchestratorUrl}/api/agreements`, {
        headers: {
          'X-API-Key': apiKey,
        },
        params: {
          limit: 1000,
        },
        timeout: 30000,
      });
      agreements = response.data.agreements || response.data || [];
    } catch (primaryError: any) {
      // Endpoint might not exist - this is okay for development
      if (primaryError.response?.status === 404) {
        console.log('Signing orchestrator API endpoint not available (404). This is normal if orchestrator is not running.');
        return results; // Return empty results, don't throw error
      }
      // For other errors, log but don't fail
      console.warn('Could not fetch on-prem documents:', primaryError.message);
      return results;
    }

    for (const agreement of agreements) {
      const baseMetadata = {
        loanId: agreement.loanId,
        userId: agreement.userId,
        agreementId: agreement.id,
        agreementType: agreement.agreementType,
        mtsaStatus: agreement.mtsaStatus,
      };

      // Add original file
      if (agreement.originalFilePath) {
        results.push({
          filePath: agreement.originalFilePath,
          fileName: agreement.originalFileName || path.basename(agreement.originalFilePath),
          fileSize: agreement.fileSizeBytes || 0,
          fileType: '.pdf',
          documentType: 'ORIGINAL_AGREEMENT',
          uploadedAt: new Date(agreement.createdAt),
          source: 'ONPREM',
          metadata: baseMetadata,
        });
      }

      // Add signed file if exists
      if (agreement.signedFilePath) {
        results.push({
          filePath: agreement.signedFilePath,
          fileName: agreement.signedFileName || path.basename(agreement.signedFilePath),
          fileSize: agreement.signedFileSizeBytes || 0,
          fileType: '.pdf',
          documentType: 'SIGNED_AGREEMENT',
          uploadedAt: agreement.mtsaSignedAt ? new Date(agreement.mtsaSignedAt) : new Date(agreement.createdAt),
          source: 'ONPREM',
          metadata: baseMetadata,
        });
      }

      // Add stamped file if exists
      if (agreement.stampedFilePath) {
        results.push({
          filePath: agreement.stampedFilePath,
          fileName: agreement.stampedFileName || path.basename(agreement.stampedFilePath),
          fileSize: agreement.stampedFileSizeBytes || 0,
          fileType: '.pdf',
          documentType: 'STAMPED_AGREEMENT',
          uploadedAt: agreement.stampedUploadedAt ? new Date(agreement.stampedUploadedAt) : new Date(agreement.updatedAt),
          source: 'ONPREM',
          metadata: baseMetadata,
        });
      }

      // Add certificate file if exists
      if (agreement.certificateFilePath) {
        results.push({
          filePath: agreement.certificateFilePath,
          fileName: agreement.certificateFileName || path.basename(agreement.certificateFilePath),
          fileSize: agreement.certificateFileSizeBytes || 0,
          fileType: '.pdf',
          documentType: 'STAMP_CERTIFICATE',
          uploadedAt: agreement.certificateUploadedAt ? new Date(agreement.certificateUploadedAt) : new Date(agreement.updatedAt),
          source: 'ONPREM',
          metadata: baseMetadata,
        });
      }
    }

    console.log(`Fetched ${results.length} on-prem documents from signing orchestrator`);
  } catch (error) {
    // Log but don't throw - on-prem scanning is optional
    console.warn('Error fetching on-prem documents:', error);
  }

  return results;
}

/**
 * Match on-prem file to loan via loanId and userId from orchestrator metadata
 */
async function matchOnPremFile(metadata: any): Promise<{
  userId?: string;
  userName?: string;
  loanId?: string;
  applicationId?: string;
  isOrphaned: boolean;
}> {
  try {
    const { loanId, userId } = metadata;

    // Try to match by loanId first
    if (loanId) {
      const loan = await prisma.loan.findUnique({
        where: { id: loanId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
          application: {
            select: {
              id: true,
            },
          },
        },
      });

      if (loan) {
        return {
          userId: loan.userId,
          userName: loan.user.fullName || undefined,
          loanId: loan.id,
          applicationId: loan.applicationId,
          isOrphaned: false,
        };
      }
    }

    // If loan not found by ID, try to match by userId and get their most recent loan
    // This handles cases where loan was deleted but we still want to attribute docs to the user
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
        },
      });

      if (user) {
        // Find the most recent loan for this user
        const recentLoan = await prisma.loan.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          include: {
            application: {
              select: {
                id: true,
              },
            },
          },
        });

        return {
          userId: user.id,
          userName: user.fullName || undefined,
          loanId: recentLoan?.id,
          applicationId: recentLoan?.applicationId,
          isOrphaned: !recentLoan, // Only orphaned if user has no loans at all
        };
      }
    }
  } catch (error) {
    console.error(`Error matching on-prem file:`, error);
  }

  return {
    isOrphaned: true,
  };
}

/**
 * Scan and index all documents
 */
export async function scanAndIndexDocuments(): Promise<ScanStats> {
  const stats: ScanStats = {
    totalScanned: 0,
    matched: 0,
    orphaned: 0,
    vpsFiles: 0,
    onpremFiles: 0,
    errors: [],
  };

  try {
    console.log('Starting document scan...');

    // Clear existing document audit logs
    await prisma.documentAuditLog.deleteMany({});
    console.log('Cleared existing document audit logs');

    // Scan VPS uploads folder
    const uploadsDir = path.join(process.cwd(), 'uploads');
    console.log(`Scanning VPS uploads directory: ${uploadsDir}`);

    let vpsFiles: FileMetadata[] = [];
    try {
      vpsFiles = await scanDirectory(uploadsDir, uploadsDir);
      stats.vpsFiles = vpsFiles.length;
      console.log(`Found ${vpsFiles.length} files in VPS uploads`);
    } catch (error) {
      const errorMsg = `Error scanning VPS uploads: ${error}`;
      console.error(errorMsg);
      stats.errors.push(errorMsg);
    }

    // Scan receipts folder
    const receiptsDir = path.join(process.cwd(), 'receipts');
    console.log(`Scanning receipts directory: ${receiptsDir}`);

    try {
      const receiptFiles = await scanDirectory(receiptsDir, receiptsDir);
      vpsFiles.push(...receiptFiles);
      stats.vpsFiles = vpsFiles.length;
      console.log(`Found ${receiptFiles.length} files in receipts directory`);
    } catch (error) {
      const errorMsg = `Error scanning receipts: ${error}`;
      console.error(errorMsg);
      stats.errors.push(errorMsg);
    }

    // Fetch on-prem documents
    let onpremFiles: FileMetadata[] = [];
    try {
      onpremFiles = await fetchOnPremDocuments();
      stats.onpremFiles = onpremFiles.length;
      if (onpremFiles.length > 0) {
        console.log(`Found ${onpremFiles.length} files in on-prem storage`);
      } else {
        console.log('No on-prem files found (orchestrator may not be running)');
      }
    } catch (error) {
      // This shouldn't happen now as fetchOnPremDocuments handles errors gracefully
      console.warn(`Could not scan on-prem documents: ${error}`);
      // Don't add to errors array - on-prem is optional
    }

    const allFiles = [...vpsFiles, ...onpremFiles];
    stats.totalScanned = allFiles.length;

    // Process and index each file
    for (const file of allFiles) {
      try {
        let matchResult;

        if (file.source === 'ONPREM') {
          // For on-prem files, use the metadata from the orchestrator's agreement
          if (file.metadata) {
            // Pass full metadata which includes loanId and userId
            matchResult = await matchOnPremFile(file.metadata);
          } else {
            // Fallback: try to extract loanId from file path/name
            const loanIdMatch = file.filePath.match(/loan[_-]([a-zA-Z0-9]+)/i);
            if (loanIdMatch) {
              matchResult = await matchOnPremFile({ loanId: loanIdMatch[1] });
            } else {
              matchResult = { isOrphaned: true };
            }
          }
        } else {
          // For VPS files, use standard matching logic
          matchResult = await matchFileToDatabase(file);
        }

        // Create document audit log entry
        await prisma.documentAuditLog.create({
          data: {
            filePath: file.filePath,
            fileName: file.fileName,
            fileSize: file.fileSize,
            fileType: file.fileType,
            documentType: file.documentType,
            userId: matchResult.userId,
            userName: matchResult.userName,
            loanId: matchResult.loanId,
            applicationId: matchResult.applicationId,
            uploadedAt: file.uploadedAt,
            isOrphaned: matchResult.isOrphaned,
            source: file.source,
            metadata: file.metadata || {},
          },
        });

        if (matchResult.isOrphaned) {
          stats.orphaned++;
        } else {
          stats.matched++;
        }
      } catch (error) {
        const errorMsg = `Error indexing file ${file.fileName}: ${error}`;
        console.error(errorMsg);
        stats.errors.push(errorMsg);
      }
    }

    console.log('Document scan completed:', stats);
    return stats;
  } catch (error) {
    console.error('Fatal error during document scan:', error);
    stats.errors.push(`Fatal error: ${error}`);
    return stats;
  }
}

