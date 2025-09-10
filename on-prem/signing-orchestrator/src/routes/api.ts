import express from 'express';
import multer from 'multer';
import { verifyApiKey } from '../middleware/auth';
import { createCorrelatedLogger } from '../utils/logger';
import { signingService } from '../services/SigningService';
import { mtsaClient } from '../services/MTSAClient';
import { storageManager } from '../utils/storage';
import { isValidBase64 } from '../utils/crypto';
import config from '../config';
import {
  SigningRequest,
  EnrollmentRequest,
  SignerInfo,
  VerificationData,
} from '../types';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: config.storage.maxUploadMB * 1024 * 1024, // Convert MB to bytes
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

/**
 * Manual signing endpoint
 * POST /api/sign
 */
router.post('/sign', verifyApiKey, async (req, res): Promise<void> => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const {
      packetId,
      documentId,
      templateId,
      signerInfo,
      pdfUrl,
      otp,
      coordinates,
      signatureImage,
      fieldUpdates,
    }: SigningRequest = req.body;
    
    // Validate required fields
    if (!packetId || !signerInfo || !pdfUrl) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: packetId, signerInfo, pdfUrl',
      });
      return;
    }
    
    // Validate signer info
    if (!signerInfo.userId || !signerInfo.fullName || !signerInfo.emailAddress) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required signer fields: userId, fullName, emailAddress',
      });
      return;
    }
    
    log.info('Processing manual signing request', { 
      packetId, 
      signerId: signerInfo.userId 
    });
    
    const result = await signingService.processSigningWorkflow({
      packetId,
      documentId: documentId || '',
      templateId: templateId || '',
      signerInfo,
      pdfUrl,
      otp,
      coordinates,
      signatureImage,
      fieldUpdates,
    }, req.correlationId!);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          signedPdfPath: result.signedPdfPath,
          certificateInfo: result.certificateInfo,
        },
        correlationId: req.correlationId,
      });
      return;
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
        correlationId: req.correlationId,
      });
      return;
    }
    
  } catch (error) {
    log.error('Manual signing request failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Signing request failed',
      correlationId: req.correlationId,
    });
  }
});

/**
 * Certificate enrollment endpoint
 * POST /api/enroll
 */
router.post('/enroll', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const {
      signerInfo,
      verificationData,
      otp,
    }: EnrollmentRequest = req.body;
    
    // Validate required fields
    if (!signerInfo || !verificationData) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: signerInfo, verificationData',
      });
      return;
    }
    
    // Validate signer info
    if (!signerInfo.userId || !signerInfo.fullName || !signerInfo.emailAddress) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required signer fields: userId, fullName, emailAddress',
      });
      return;
    }
    
    log.info('Processing enrollment request', { signerId: signerInfo.userId });
    
    const result = await signingService.enrollUser(signerInfo, req.correlationId!);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          certificateInfo: result.certificateInfo,
        },
        correlationId: req.correlationId,
      });
      return;
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
        correlationId: req.correlationId,
      });
      return;
    }
    
  } catch (error) {
    log.error('Enrollment request failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Enrollment request failed',
      correlationId: req.correlationId,
    });
  }
});

/**
 * PDF verification endpoint
 * POST /api/verify
 */
router.post('/verify', upload.single('pdf'), verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    let pdfBase64: string;
    
    // Handle file upload or base64 data
    if (req.file) {
      pdfBase64 = req.file.buffer.toString('base64');
      log.debug('PDF uploaded via file', { size: req.file.size });
    } else if (req.body.pdfBase64) {
      if (!isValidBase64(req.body.pdfBase64)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid base64 PDF data',
        });
        return;
      }
      pdfBase64 = req.body.pdfBase64;
      log.debug('PDF provided as base64');
    } else {
      res.status(400).json({
        error: 'Bad Request',
        message: 'No PDF provided (use file upload or pdfBase64 field)',
      });
      return;
    }
    
    log.info('Processing PDF verification request');
    
    const result = await signingService.verifySignedPdf(pdfBase64, req.correlationId!);
    
    res.status(200).json({
      success: result.statusCode === '0000',
      message: result.message,
      data: {
        statusCode: result.statusCode,
        totalSignatures: result.totalSignatureInPdf,
        signatureDetails: result.signatureDetails,
      },
      correlationId: req.correlationId,
    });
    
  } catch (error) {
    log.error('PDF verification request failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'PDF verification failed',
      correlationId: req.correlationId,
    });
  }
});

/**
 * Certificate info endpoint
 * GET /api/cert/:userId
 */
router.get('/cert/:userId', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing userId parameter',
      });
      return;
    }
    
    log.info('Getting certificate info', { userId });
    
    const result = await mtsaClient.getCertInfo({ UserID: userId }, req.correlationId!);
    
    // Handle response structure - data may be in result.return or at root level
    const responseData = (result as any).return || result;
    const statusCode = responseData.statusCode || result.statusCode;
    const statusMsg = responseData.statusMsg || (result as any).statusMsg || (result as any).message;
    
    // Certificate check completed
    
    res.status(200).json({
      success: statusCode === '000',
      message: statusMsg,
      data: {
        statusCode: statusCode,
        certStatus: responseData.certStatus,
        certValidFrom: responseData.certValidFrom,
        certValidTo: responseData.certValidTo,
        certSerialNo: responseData.certSerialNo,
        certIssuer: responseData.certIssuer,
        certSubjectDN: responseData.certSubjectDN,
        certX509: responseData.certX509,
        // Legacy field names for backward compatibility
        validFrom: responseData.certValidFrom,
        validTo: responseData.certValidTo,
        issuer: responseData.certIssuer,
        subject: responseData.certSubjectDN,
      },
      correlationId: req.correlationId,
    });
    
  } catch (error) {
    log.error('Certificate info request failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get certificate info',
      correlationId: req.correlationId,
    });
  }
});

/**
 * Request OTP endpoint
 * POST /api/otp
 */
router.post('/otp', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { userId, usage, emailAddress } = req.body;
    
    if (!userId || !usage) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: userId, usage',
      });
      return;
    }
    
    if (!['DS', 'NU'].includes(usage)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid usage. Must be DS (digital signing) or NU (new enrollment)',
      });
      return;
    }
    
    if (usage === 'NU' && !emailAddress) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'emailAddress is required for new enrollment (NU)',
      });
      return;
    }
    
    log.info('Requesting OTP', { userId, usage });
    
    const result = await mtsaClient.requestEmailOTP({
      UserID: userId,
      OTPUsage: usage,
      EmailAddress: emailAddress,
    }, req.correlationId!);
    
    const statusCode = result.return?.statusCode || result.statusCode;
    const message = result.return?.statusMsg || result.message;
    
    res.status(200).json({
      success: statusCode === '000' || statusCode === '0000',
      message: message,
      data: {
        statusCode: statusCode,
        otpSent: result.otpSent,
      },
      correlationId: req.correlationId,
    });
    
  } catch (error) {
    log.error('OTP request failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'OTP request failed',
      correlationId: req.correlationId,
    });
  }
});

/**
 * Request Certificate endpoint
 * POST /api/certificate
 */
router.post('/certificate', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { 
      userId, 
      fullName, 
      emailAddress, 
      mobileNo, 
      nationality = 'MY',
      userType = '1', 
      idType = 'N',
      authFactor,
      nricFront,
      nricBack,
      selfieImage,
      passportImage,
      organisationInfo,
      verificationData
    } = req.body;
    
    if (!userId || !fullName || !emailAddress || !mobileNo || !authFactor || !verificationData) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: userId, fullName, emailAddress, mobileNo, authFactor, verificationData',
      });
      return;
    }
    
    // Validate verificationData structure
    const missingFields = [];
    if (!verificationData.verifyStatus) missingFields.push('verifyStatus');
    if (!verificationData.verifyDatetime) missingFields.push('verifyDatetime');
    if (!verificationData.verifyMethod) missingFields.push('verifyMethod');
    if (!verificationData.verifyVerifier) missingFields.push('verifyVerifier');
    
    if (missingFields.length > 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Missing required VerificationData fields: ${missingFields.join(', ')}`,
      });
      return;
    }
    
    log.info('Requesting certificate', { userId, userType, nationality });
    
    const result = await mtsaClient.requestCertificate({
      UserID: userId,
      FullName: fullName,
      EmailAddress: emailAddress,
      MobileNo: mobileNo,
      Nationality: nationality,
      UserType: userType,
      IDType: idType,
      AuthFactor: authFactor,
      NRICFront: nricFront,
      NRICBack: nricBack,
      SelfieImage: selfieImage,
      PassportImage: passportImage,
      OrganisationInfo: organisationInfo,
      VerificationData: {
        verifyDatetime: verificationData.verifyDatetime,
        verifyMethod: verificationData.verifyMethod,
        verifyStatus: verificationData.verifyStatus,
        verifyVerifier: verificationData.verifyVerifier,
      },
    }, req.correlationId!);
    
    const statusCode = result.return?.statusCode || result.statusCode;
    const message = result.return?.statusMsg || result.message;
    
    res.status(200).json({
      success: statusCode === '000' || statusCode === '0000',
      message: message,
      data: {
        statusCode: statusCode,
        statusMsg: message,
        // Certificate data (only present if successful)
        certX509: result.return?.certX509 || result.certX509,
        certValidTo: result.return?.certValidTo || result.certValidTo,
        certValidFrom: result.return?.certValidFrom || result.certValidFrom,
        certSerialNo: result.return?.certSerialNo || result.certSerialNo,
        // Request tracking
        certRequestID: result.return?.certRequestID || result.certRequestID,
        certRequestStatus: result.return?.certRequestStatus || result.certRequestStatus,
        userID: result.return?.userID || result.userID,
        // Legacy field names for backward compatibility
        certificateSerialNo: result.return?.certSerialNo || result.certSerialNo,
        certificateValidFrom: result.return?.certValidFrom || result.certValidFrom,
        certificateValidTo: result.return?.certValidTo || result.certValidTo,
      },
      correlationId: req.correlationId,
    });
    
  } catch (error) {
    log.error('Certificate request failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Certificate request failed',
      correlationId: req.correlationId,
    });
  }
});

/**
 * Test GetCertInfo with HTTP header authentication
 * POST /api/test-getcert
 */
router.post('/test-getcert', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { userId } = req.body;
    
    if (!userId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: userId',
      });
      return;
    }
    
    log.info('Testing GetCertInfo with HTTP header auth', { userId });
    
    const result = await mtsaClient.getCertInfo({
      UserID: userId,
    }, req.correlationId!);
    
    res.status(200).json({
      success: result.statusCode === '000',
      message: result.message,
      data: {
        statusCode: result.statusCode,
        certStatus: result.certStatus,
        validFrom: result.certValidFrom,
        validTo: result.certValidTo,
        certSerialNo: result.certSerialNo,
        issuer: result.certIssuer,
        subject: result.certSubjectDN,
      },
      correlationId: req.correlationId,
    });
    
  } catch (error) {
    log.error('GetCertInfo test failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'GetCertInfo test failed',
      correlationId: req.correlationId,
    });
  }
});

/**
 * PKI Certificate Status Check
 * GET /api/pki/cert-status/:userId
 */
router.get('/pki/cert-status/:userId', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing userId parameter',
      });
      return;
    }
    
    log.info('Checking PKI certificate status', { userId });
    
    const certInfo = await signingService.checkCertificateStatus(userId, req.correlationId!);
    
    if (certInfo) {
      res.status(200).json({
        success: true,
        message: 'Certificate status retrieved',
        data: {
          valid: certInfo.certStatus === 'Valid',
          status: certInfo.certStatus,
          validFrom: certInfo.certValidFrom,
          validTo: certInfo.certValidTo,
          serialNumber: certInfo.certSerialNo,
          daysUntilExpiry: certInfo.certValidTo ? 
            Math.ceil((new Date(certInfo.certValidTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
        },
        correlationId: req.correlationId,
      });
    } else {
      res.status(200).json({
        success: false,
        message: 'Certificate not found or invalid',
        data: {
          valid: false,
          status: 'not_found',
          requiresEnrollment: true
        },
        correlationId: req.correlationId,
      });
    }
    
  } catch (error) {
    log.error('PKI certificate status check failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Certificate status check failed',
      correlationId: req.correlationId,
    });
  }
});

/**
 * PKI OTP Request for Digital Signing
 * POST /api/pki/request-otp
 */
router.post('/pki/request-otp', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { userId, email, submissionId } = req.body;
    
    if (!userId || !email) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: userId, email',
      });
      return;
    }
    
    log.info('Requesting PKI signing OTP', { userId, submissionId });
    
    const otpRequested = await signingService.requestSigningOTP(userId, email, req.correlationId!);
    
    if (otpRequested) {
      res.status(200).json({
        success: true,
        message: 'OTP sent successfully to registered email',
        data: {
          otpSent: true,
          expiryMinutes: 10,
          submissionId
        },
        correlationId: req.correlationId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send OTP',
        error: {
          code: 'OTP_REQUEST_FAILED',
          details: 'Unable to send OTP to registered email'
        },
        correlationId: req.correlationId,
      });
    }
    
  } catch (error) {
    log.error('PKI OTP request failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'OTP request failed',
      correlationId: req.correlationId,
    });
  }
});

/**
 * PKI Complete Signing with OTP
 * POST /api/pki/complete-signing
 */
router.post('/pki/complete-signing', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { sessionId, otp } = req.body;
    
    if (!sessionId || !otp) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: sessionId, otp',
      });
      return;
    }
    
    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid OTP format. Must be 6 digits.',
      });
      return;
    }
    
    log.info('Completing PKI signing with OTP', { sessionId });
    
    const result = await signingService.completePKISigningWithOTP(sessionId, otp, req.correlationId!);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          nextAction: result.nextAction,
          signingComplete: true
        },
        correlationId: req.correlationId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        error: {
          code: 'PKI_SIGNING_FAILED',
          details: result.message
        },
        correlationId: req.correlationId,
      });
    }
    
  } catch (error) {
    log.error('PKI signing completion failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'PKI signing completion failed',
      correlationId: req.correlationId,
    });
  }
});

/**
 * PKI Session Status
 * GET /api/pki/session/:sessionId
 */
router.get('/pki/session/:sessionId', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing sessionId parameter',
      });
      return;
    }
    
    log.info('Getting PKI session status', { sessionId });
    
    // TODO: Implement session retrieval from persistent storage
    // For now, return mock data
    const session = {
      id: sessionId,
      status: 'awaiting_otp',
      submissionId: 'mock_submission',
      currentSignatory: {
        role: 'Borrower',
        email: 'borrower@example.com'
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };
    
    res.status(200).json({
      success: true,
      message: 'Session status retrieved',
      data: session,
      correlationId: req.correlationId,
    });
    
  } catch (error) {
    log.error('PKI session status check failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Session status check failed',
      correlationId: req.correlationId,
    });
  }
});

/**
 * PKI Sign PDF with OTP
 * POST /api/pki/sign-pdf
 */
router.post('/pki/sign-pdf', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { userId, otp, submissionId, applicationId, userFullName } = req.body;
    
    if (!userId || !otp || !submissionId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required parameters: userId, otp, submissionId',
        correlationId: req.correlationId,
      });
      return;
    }
    
    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid OTP format. Must be 6 digits.',
        correlationId: req.correlationId,
      });
      return;
    }
    
    log.info('Starting PKI PDF signing process', { userId, submissionId, applicationId });
    
    // Call the signing service to complete PKI signing
    const result = await signingService.signPDFWithPKI(userId, otp, submissionId, applicationId, req.correlationId!, userFullName);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
        correlationId: req.correlationId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        error: {
          code: 'PKI_PDF_SIGNING_FAILED',
          details: result.message
        },
        correlationId: req.correlationId,
      });
    }
    
  } catch (error) {
    log.error('PKI PDF signing failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'PKI PDF signing failed',
      correlationId: req.correlationId,
    });
  }
});

/**
 * List signed PDFs for a packet
 * GET /api/signed/:packetId
 */
router.get('/signed/:packetId', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { packetId } = req.params;
    
    if (!packetId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing packetId parameter',
      });
      return;
    }
    
    log.info('Listing signed PDFs', { packetId });
    
    const files = await storageManager.listSignedPdfs(packetId, req.correlationId!);
    
    // Get file stats for each file
    const fileDetails = await Promise.all(
      files.map(async (filePath) => {
        const stats = await storageManager.getFileStats(filePath);
        return {
          path: filePath,
          filename: filePath.split('/').pop(),
          size: stats?.size || 0,
          created: stats?.birthtime || null,
          modified: stats?.mtime || null,
        };
      })
    );
    
    res.status(200).json({
      success: true,
      message: 'Signed PDFs listed successfully',
      data: {
        packetId,
        files: fileDetails,
        count: fileDetails.length,
      },
      correlationId: req.correlationId,
    });
    
  } catch (error) {
    log.error('Failed to list signed PDFs', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list signed PDFs',
      correlationId: req.correlationId,
    });
  }
});

export default router;
