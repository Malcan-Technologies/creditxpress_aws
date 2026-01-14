import axios from 'axios';
import { prisma } from './prisma';
import { signingConfig } from './config';

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
  // Pre-matched data from database
  userId?: string;
  userName?: string;
  loanId?: string;
  applicationId?: string;
}

/**
 * Query KYC documents from database
 */
async function getKycDocuments(): Promise<FileMetadata[]> {
  const results: FileMetadata[] = [];

  const kycDocs = await prisma.kycDocument.findMany({
    where: {
      storageUrl: {
        not: { startsWith: 'data:' }, // Exclude inline base64 data URLs
      },
    },
    include: {
      kycSession: {
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
  });

  for (const doc of kycDocs) {
    const fileName = doc.storageUrl.split('/').pop() || doc.storageUrl;
    const fileType = fileName.includes('.') ? '.' + fileName.split('.').pop()?.toLowerCase() : '.unknown';

    results.push({
      filePath: doc.storageUrl,
      fileName,
      fileSize: 0, // Size not tracked in DB
      fileType,
      documentType: 'KYC', // Consistent with frontend filter options
      uploadedAt: doc.createdAt,
      source: 'S3', // Changed from VPS_UPLOADS to S3 since files are in S3
      userId: doc.kycSession.userId,
      userName: doc.kycSession.user?.fullName || undefined,
      applicationId: doc.kycSession.application?.id,
      metadata: {
        kycType: doc.type, // front, back, selfie
      },
    });
  }

  return results;
}

/**
 * Query user documents (loan application documents) from database
 */
async function getUserDocuments(): Promise<FileMetadata[]> {
  const results: FileMetadata[] = [];

  const userDocs = await prisma.userDocument.findMany({
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
          loan: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  for (const doc of userDocs) {
    const fileName = doc.fileUrl.split('/').pop() || doc.fileUrl;
    const fileType = fileName.includes('.') ? '.' + fileName.split('.').pop()?.toLowerCase() : '.unknown';

    results.push({
      filePath: doc.fileUrl,
      fileName,
      fileSize: 0,
      fileType,
      documentType: doc.type || 'USER_DOCUMENT',
      uploadedAt: doc.createdAt,
      source: 'S3',
      userId: doc.userId,
      userName: doc.user?.fullName || undefined,
      applicationId: doc.applicationId || undefined,
      loanId: doc.application?.loan?.id,
    });
  }

  return results;
}

/**
 * Query disbursement slips from database
 */
async function getDisbursementSlips(): Promise<FileMetadata[]> {
  const results: FileMetadata[] = [];

  const disbursements = await prisma.loanDisbursement.findMany({
    where: {
      paymentSlipUrl: { not: null },
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

  for (const disbursement of disbursements) {
    if (!disbursement.paymentSlipUrl) continue;

    const fileName = disbursement.paymentSlipUrl.split('/').pop() || disbursement.paymentSlipUrl;

    results.push({
      filePath: disbursement.paymentSlipUrl,
      fileName,
      fileSize: 0,
      fileType: '.pdf',
      documentType: 'DISBURSEMENT_SLIP',
      uploadedAt: disbursement.createdAt,
      source: 'S3',
      userId: disbursement.application.userId,
      userName: disbursement.application.user?.fullName || undefined,
      applicationId: disbursement.applicationId,
      loanId: disbursement.application.loan?.id,
    });
  }

  return results;
}

/**
 * Query PKI documents (stamp certificates, signed PDFs) from loans
 */
async function getPkiDocuments(): Promise<FileMetadata[]> {
  const results: FileMetadata[] = [];

  const loans = await prisma.loan.findMany({
    where: {
      OR: [
        { pkiStampCertificateUrl: { not: null } },
        { pkiSignedPdfUrl: { not: null } },
        { pkiStampedPdfUrl: { not: null } },
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

  for (const loan of loans) {
    // Add stamp certificate if present and not an HTTP URL (those come from orchestrator)
    if (loan.pkiStampCertificateUrl && !loan.pkiStampCertificateUrl.startsWith('http')) {
      const fileName = loan.pkiStampCertificateUrl.split('/').pop() || loan.pkiStampCertificateUrl;
      results.push({
        filePath: loan.pkiStampCertificateUrl,
        fileName,
        fileSize: 0,
        fileType: '.pdf',
        documentType: 'STAMP_CERTIFICATE',
        uploadedAt: loan.updatedAt,
        source: 'S3',
        userId: loan.userId,
        userName: loan.user?.fullName || undefined,
        applicationId: loan.applicationId,
        loanId: loan.id,
      });
    }

    // Add signed PDF if present and not an HTTP URL
    if (loan.pkiSignedPdfUrl && !loan.pkiSignedPdfUrl.startsWith('http')) {
      const fileName = loan.pkiSignedPdfUrl.split('/').pop() || loan.pkiSignedPdfUrl;
      results.push({
        filePath: loan.pkiSignedPdfUrl,
        fileName,
        fileSize: 0,
        fileType: '.pdf',
        documentType: 'SIGNED_AGREEMENT',
        uploadedAt: loan.updatedAt,
        source: 'S3',
        userId: loan.userId,
        userName: loan.user?.fullName || undefined,
        applicationId: loan.applicationId,
        loanId: loan.id,
      });
    }

    // Add stamped PDF if present and not an HTTP URL
    if (loan.pkiStampedPdfUrl && !loan.pkiStampedPdfUrl.startsWith('http')) {
      const fileName = loan.pkiStampedPdfUrl.split('/').pop() || loan.pkiStampedPdfUrl;
      results.push({
        filePath: loan.pkiStampedPdfUrl,
        fileName,
        fileSize: 0,
        fileType: '.pdf',
        documentType: 'STAMPED_AGREEMENT',
        uploadedAt: loan.updatedAt,
        source: 'S3',
        userId: loan.userId,
        userName: loan.user?.fullName || undefined,
        applicationId: loan.applicationId,
        loanId: loan.id,
      });
    }
  }

  return results;
}

/**
 * Query payment receipts from database
 */
async function getPaymentReceipts(): Promise<FileMetadata[]> {
  const results: FileMetadata[] = [];

  const receipts = await prisma.paymentReceipt.findMany({
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

  for (const receipt of receipts) {
    if (!receipt.filePath) continue;

    const fileName = receipt.filePath.split('/').pop() || receipt.filePath;

    results.push({
      filePath: receipt.filePath,
      fileName,
      fileSize: 0,
      fileType: '.pdf',
      documentType: 'PAYMENT_RECEIPT',
      uploadedAt: receipt.createdAt,
      source: 'S3',
      userId: receipt.repayment.loan.userId,
      userName: receipt.repayment.loan.user?.fullName || undefined,
      applicationId: receipt.repayment.loan.applicationId,
      loanId: receipt.repayment.loanId,
    });
  }

  return results;
}

/**
 * Fetch on-prem signed documents from signing orchestrator
 */
async function fetchOnPremDocuments(): Promise<FileMetadata[]> {
  const results: FileMetadata[] = [];
  
  if (!signingConfig.url || !signingConfig.apiKey) {
    console.warn('Signing orchestrator URL or API key not configured, skipping on-prem scan');
    return results;
  }

  try {
    // Try to fetch agreements from signing orchestrator
    let response;
    let agreements = [];
    
    try {
      response = await axios.get(`${signingConfig.url}/api/agreements`, {
        headers: {
          'X-API-Key': signingConfig.apiKey,
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
        return results;
      }
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
        const fileName = agreement.originalFileName || agreement.originalFilePath.split('/').pop();
        results.push({
          filePath: agreement.originalFilePath,
          fileName: fileName || 'unknown',
          fileSize: agreement.fileSizeBytes || 0,
          fileType: '.pdf',
          documentType: 'ORIGINAL_AGREEMENT',
          uploadedAt: new Date(agreement.createdAt),
          source: 'ONPREM',
          metadata: baseMetadata,
          userId: agreement.userId,
          loanId: agreement.loanId,
        });
      }

      // Add signed file if exists
      if (agreement.signedFilePath) {
        const fileName = agreement.signedFileName || agreement.signedFilePath.split('/').pop();
        results.push({
          filePath: agreement.signedFilePath,
          fileName: fileName || 'unknown',
          fileSize: agreement.signedFileSizeBytes || 0,
          fileType: '.pdf',
          documentType: 'SIGNED_AGREEMENT',
          uploadedAt: agreement.mtsaSignedAt ? new Date(agreement.mtsaSignedAt) : new Date(agreement.createdAt),
          source: 'ONPREM',
          metadata: baseMetadata,
          userId: agreement.userId,
          loanId: agreement.loanId,
        });
      }

      // Add stamped file if exists
      if (agreement.stampedFilePath) {
        const fileName = agreement.stampedFileName || agreement.stampedFilePath.split('/').pop();
        results.push({
          filePath: agreement.stampedFilePath,
          fileName: fileName || 'unknown',
          fileSize: agreement.stampedFileSizeBytes || 0,
          fileType: '.pdf',
          documentType: 'STAMPED_AGREEMENT',
          uploadedAt: agreement.stampedUploadedAt ? new Date(agreement.stampedUploadedAt) : new Date(agreement.updatedAt),
          source: 'ONPREM',
          metadata: baseMetadata,
          userId: agreement.userId,
          loanId: agreement.loanId,
        });
      }

      // Add certificate file if exists
      if (agreement.certificateFilePath) {
        const fileName = agreement.certificateFileName || agreement.certificateFilePath.split('/').pop();
        results.push({
          filePath: agreement.certificateFilePath,
          fileName: fileName || 'unknown',
          fileSize: agreement.certificateFileSizeBytes || 0,
          fileType: '.pdf',
          documentType: 'STAMP_CERTIFICATE',
          uploadedAt: agreement.certificateUploadedAt ? new Date(agreement.certificateUploadedAt) : new Date(agreement.updatedAt),
          source: 'ONPREM',
          metadata: baseMetadata,
          userId: agreement.userId,
          loanId: agreement.loanId,
        });
      }
    }

    console.log(`Fetched ${results.length} on-prem documents from signing orchestrator`);
  } catch (error) {
    console.warn('Error fetching on-prem documents:', error);
  }

  return results;
}

/**
 * Enrich on-prem files with user names from database
 */
async function enrichOnPremFiles(files: FileMetadata[]): Promise<FileMetadata[]> {
  for (const file of files) {
    if (!file.userName && file.userId) {
      const user = await prisma.user.findUnique({
        where: { id: file.userId },
        select: { fullName: true },
      });
      file.userName = user?.fullName || undefined;
    }

    if (!file.applicationId && file.loanId) {
      const loan = await prisma.loan.findUnique({
        where: { id: file.loanId },
        select: { applicationId: true },
      });
      file.applicationId = loan?.applicationId;
    }
  }

  return files;
}

/**
 * Scan and index all documents by querying database tables
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
    console.log('Starting document scan (database-based)...');

    // Clear existing document audit logs
    await prisma.documentAuditLog.deleteMany({});
    console.log('Cleared existing document audit logs');

    // Query all document sources from database
    const [kycDocs, userDocs, disbursementSlips, pkiDocs, receipts] = await Promise.all([
      getKycDocuments(),
      getUserDocuments(),
      getDisbursementSlips(),
      getPkiDocuments(),
      getPaymentReceipts(),
    ]);

    const vpsFiles = [...kycDocs, ...userDocs, ...disbursementSlips, ...pkiDocs, ...receipts];
    stats.vpsFiles = vpsFiles.length;
    console.log(`Found ${vpsFiles.length} documents tracked in database (S3 storage)`);

    // Fetch on-prem documents from signing orchestrator
    let onpremFiles: FileMetadata[] = [];
    try {
      onpremFiles = await fetchOnPremDocuments();
      onpremFiles = await enrichOnPremFiles(onpremFiles);
      stats.onpremFiles = onpremFiles.length;
      if (onpremFiles.length > 0) {
        console.log(`Found ${onpremFiles.length} files in on-prem storage`);
      } else {
        console.log('No on-prem files found (orchestrator may not be running)');
      }
    } catch (error) {
      console.warn(`Could not scan on-prem documents: ${error}`);
    }

    const allFiles = [...vpsFiles, ...onpremFiles];
    stats.totalScanned = allFiles.length;

    // Process and index each file
    for (const file of allFiles) {
      try {
        // Files from database queries are already matched
        const isOrphaned = !file.userId && !file.loanId;

        // Create document audit log entry
        await prisma.documentAuditLog.create({
          data: {
            filePath: file.filePath,
            fileName: file.fileName,
            fileSize: file.fileSize,
            fileType: file.fileType,
            documentType: file.documentType,
            userId: file.userId,
            userName: file.userName,
            loanId: file.loanId,
            applicationId: file.applicationId,
            uploadedAt: file.uploadedAt,
            isOrphaned,
            source: file.source,
            metadata: file.metadata || {},
          },
        });

        if (isOrphaned) {
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
