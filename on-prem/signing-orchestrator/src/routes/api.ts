import express from 'express';
import multer from 'multer';
import { verifyApiKey } from '../middleware/auth';
import { createCorrelatedLogger } from '../utils/logger';
import { signingService } from '../services/SigningService';
import { mtsaClient } from '../services/MTSAClient';
import { storageManager } from '../utils/storage';
import { isValidBase64 } from '../utils/crypto';
import { prisma } from '../utils/database';
import config from '../config';
import {
  SigningRequest,
  EnrollmentRequest,
  SignerInfo,
  VerificationData,
  MTSARequestRevokeCertRequest,
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
 * Verify Certificate PIN endpoint
 * POST /api/verify-cert-pin
 */
router.post('/verify-cert-pin', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { userId, certSerialNo, pin } = req.body;
    
    if (!userId || !certSerialNo || !pin) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: userId, certSerialNo, pin',
      });
      return;
    }
    
    if (!/^\d{8}$/.test(pin)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'PIN must be exactly 8 digits',
      });
      return;
    }
    
    log.info('Verifying certificate PIN', { userId });
    
    const result = await mtsaClient.verifyCertPin({
      UserID: userId,
      CertSerialNo: certSerialNo,
      CertPin: pin
    }, req.correlationId!);
    
    const statusCode = result?.statusCode || '9999';
    const statusMsg = result?.statusMsg || 'Unknown response';
    const certStatus = result?.certStatus;
    const certPinStatus = result?.certPinStatus;
    const pinVerified = result?.pinVerified || false;
    
    res.status(200).json({
      success: pinVerified,
      message: statusMsg,
      data: {
        statusCode: statusCode,
        pinVerified: pinVerified,
        certStatus: certStatus,
        certPinStatus: certPinStatus
      },
      correlationId: req.correlationId,
    });
    
  } catch (error) {
    log.error('Certificate PIN verification failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Certificate PIN verification failed',
      correlationId: req.correlationId,
    });
  }
});

/**
 * Reset Certificate PIN endpoint
 * POST /api/reset-cert-pin
 */
router.post('/reset-cert-pin', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { userId, certSerialNo, newPin } = req.body;
    
    if (!userId || !certSerialNo || !newPin) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: userId, certSerialNo, newPin',
      });
      return;
    }
    
    if (!/^\d{8}$/.test(newPin)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'New PIN must be exactly 8 digits',
      });
      return;
    }
    
    log.info('Resetting certificate PIN', { userId, certSerialNo: certSerialNo.slice(0, 8) + '...' });
    
    const result = await mtsaClient.resetCertificatePin({
      UserID: userId,
      CertSerialNo: certSerialNo,
      NewPin: newPin
    }, req.correlationId!);
    
    const statusCode = result?.statusCode || '9999';
    const statusMsg = result?.statusMsg || 'Unknown response';
    const success = statusCode === '000';
    
    res.status(200).json({
      success: success,
      message: statusMsg,
      data: {
        statusCode: statusCode,
        pinReset: success
      },
      correlationId: req.correlationId,
    });
    
  } catch (error) {
    log.error('Certificate PIN reset failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Certificate PIN reset failed',
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
 * Revoke Certificate endpoint
 * POST /api/revoke
 */
router.post('/revoke', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { 
      userId, 
      certSerialNo, 
      revokeReason, 
      revokeBy = 'Self', 
      authFactor,
      idType = 'N',
      nricFront,
      nricBack,
      passportImage,
      verificationData
    } = req.body;
    
    if (!userId || !certSerialNo || !revokeReason || !authFactor || !verificationData) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: userId, certSerialNo, revokeReason, authFactor, verificationData',
      });
      return;
    }
    
    // Validate revoke reason
    const validRevokeReasons = ['keyCompromise', 'CACompromise', 'affiliationChanged', 'superseded', 'cessationOfOperation'];
    if (!validRevokeReasons.includes(revokeReason)) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Invalid revokeReason. Valid values: ${validRevokeReasons.join(', ')}`,
      });
      return;
    }
    
    // Validate revokeBy
    if (!['Admin', 'Self'].includes(revokeBy)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid revokeBy value. Valid values: Admin, Self',
      });
      return;
    }
    
    // Validate idType and required images
    if (idType === 'N' && (!nricFront || !nricBack)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'NRIC front and back images are required when idType is N',
      });
      return;
    }
    
    if (idType === 'P' && !passportImage) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Passport image is required when idType is P',
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
    
    log.info('Revoking certificate', { 
      userId, 
      certSerialNo, 
      revokeReason, 
      revokeBy, 
      idType,
      hasNricFront: idType === 'N' && !!nricFront,
      hasNricBack: idType === 'N' && !!nricBack,
      hasPassport: idType === 'P' && !!passportImage,
      nricFrontLength: nricFront?.length || 0,
      nricBackLength: nricBack?.length || 0
    });
    
    // Prepare request for MTSA
    const revokeRequest: MTSARequestRevokeCertRequest = {
      UserID: userId,
      CertSerialNo: certSerialNo,
      RevokeReason: revokeReason,
      RevokeBy: revokeBy,
      AuthFactor: authFactor,
      IDType: idType,
      VerificationData: {
        verifyStatus: verificationData.verifyStatus,
        verifyDatetime: verificationData.verifyDatetime,
        verifyVerifier: verificationData.verifyVerifier,
        verifyMethod: verificationData.verifyMethod,
      },
    };
    
    // Add appropriate images based on idType
    if (idType === 'N') {
      revokeRequest.NRICFront = nricFront;
      revokeRequest.NRICBack = nricBack;
    } else if (idType === 'P') {
      revokeRequest.PassportImage = passportImage;
    }
    
    const result = await mtsaClient.requestRevokeCert(revokeRequest, req.correlationId!);
    
    // Handle response structure
    const responseData = (result as any).return || result;
    const statusCode = responseData.statusCode || result.statusCode;
    const statusMsg = responseData.statusMsg || (result as any).statusMsg || (result as any).message;
    
    log.info('Certificate revocation completed', { 
      userId, 
      certSerialNo, 
      statusCode,
      success: statusCode === '000' 
    });
    
    if (statusCode === '000') {
      res.status(200).json({
        success: true,
        message: statusMsg || 'Certificate revoked successfully',
        data: {
          statusCode: statusCode,
          revoked: true,
          revokeReason,
          revokeBy,
          revokedAt: new Date().toISOString(),
        },
        correlationId: req.correlationId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: statusMsg || 'Certificate revocation failed',
        data: {
          statusCode: statusCode,
          revoked: false,
        },
        correlationId: req.correlationId,
      });
    }
    
  } catch (error) {
    log.error('Certificate revocation request failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Certificate revocation request failed',
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
    const { userId, otp, submissionId, applicationId, userFullName, vpsUserId } = req.body;
    
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
    const result = await signingService.signPDFWithPKI(userId, otp, submissionId, applicationId, req.correlationId!, userFullName, vpsUserId);
    
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
 * Upload stamped agreement
 * POST /api/admin/agreements/:applicationId/upload/stamped
 */
router.post('/admin/agreements/:applicationId/upload/stamped', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { applicationId } = req.params;
    const originalFilename = req.get('X-Original-Filename') || 'stamped-agreement.pdf';
    const uploadedBy = req.get('X-Uploaded-By') || 'Unknown Admin';
    const notes = req.get('X-Notes');
    
    if (!applicationId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Application ID is required',
        correlationId: req.correlationId,
      });
      return;
    }
    
    // Check if we have PDF data
    if (!req.body || req.body.length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'No PDF data provided',
        correlationId: req.correlationId,
      });
      return;
    }
    
    const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    
    log.info('Processing stamped agreement upload', { 
      applicationId, 
      uploadedBy,
      fileSize: fileBuffer.length,
      originalName: originalFilename
    });
    
    // Check if agreement exists in database
    const existingAgreement = await prisma.signedAgreement.findUnique({
      where: { loanId: applicationId }
    });
    
    if (!existingAgreement) {
      res.status(404).json({
        error: 'Not Found',
        message: 'No signed agreement found for this application',
        correlationId: req.correlationId,
      });
      return;
    }
    
    // Generate stamped file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const stampedFileName = `stamped_${applicationId}_${timestamp}.pdf`;
    const stampedFilePath = `/data/stamped/${stampedFileName}`;
    
    // Save the stamped PDF file
    await storageManager.saveStampedPdf(
      fileBuffer.toString('base64'),
      applicationId,
      stampedFileName,
      req.correlationId
    );
    
    // Update database with stamped file info
    const updatedAgreement = await prisma.signedAgreement.update({
      where: { loanId: applicationId },
      data: {
        stampedFilePath: stampedFilePath,
        stampedFileName: stampedFileName,
        stampedFileHash: require('crypto').createHash('sha256').update(fileBuffer).digest('hex'),
        stampedFileSizeBytes: fileBuffer.length,
        updatedAt: new Date()
      }
    });
    
    // Create upload audit record
    await prisma.agreementUpload.create({
      data: {
        agreementId: existingAgreement.id,
        uploadedBy: uploadedBy,
        uploadType: 'STAMPED',
        originalFileName: originalFilename,
        fileSize: fileBuffer.length,
        fileHash: require('crypto').createHash('sha256').update(fileBuffer).digest('hex'),
        notes: notes || null,
        ipAddress: req.ip
      }
    });
    
    // Create audit log entry
    await prisma.agreementAuditLog.create({
      data: {
        agreementId: existingAgreement.id,
        action: 'UPLOADED',
        performedBy: uploadedBy,
        details: `Stamped agreement uploaded: ${originalFilename}`,
        metadata: {
          uploadType: 'STAMPED',
          fileName: stampedFileName,
          fileSize: fileBuffer.length,
          originalName: originalFilename,
          notes: notes || null
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    log.info('Stamped agreement uploaded successfully', {
      applicationId,
      stampedFilePath,
      uploadedBy
    });
    
    res.status(200).json({
      success: true,
      message: 'Stamped agreement uploaded successfully',
      data: {
        applicationId,
        stampedFilePath,
        fileName: stampedFileName,
        uploadedAt: new Date().toISOString(),
        uploadedBy: uploadedBy
      },
      correlationId: req.correlationId,
    });
    
  } catch (error) {
    log.error('Stamped agreement upload failed', { 
      error: error instanceof Error ? error.message : String(error),
      applicationId: req.params.applicationId
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to upload stamped agreement',
      correlationId: req.correlationId,
    });
  }
});

/**
 * Upload stamp certificate
 * POST /api/admin/agreements/:applicationId/upload/certificate
 */
router.post('/admin/agreements/:applicationId/upload/certificate', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { applicationId } = req.params;
    const originalFilename = req.get('X-Original-Filename') || 'stamp-certificate.pdf';
    const uploadedBy = req.get('X-Uploaded-By') || 'Unknown Admin';
    const notes = req.get('X-Notes');
    
    if (!applicationId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Application ID is required',
        correlationId: req.correlationId,
      });
      return;
    }
    
    // Check if we have PDF data
    if (!req.body || req.body.length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'No PDF data provided',
        correlationId: req.correlationId,
      });
      return;
    }
    
    const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    
    log.info('Processing certificate upload', { 
      applicationId, 
      uploadedBy,
      fileSize: fileBuffer.length,
      originalName: originalFilename
    });
    
    // Check if agreement exists in database
    const existingAgreement = await prisma.signedAgreement.findUnique({
      where: { loanId: applicationId }
    });
    
    if (!existingAgreement) {
      res.status(404).json({
        error: 'Not Found',
        message: 'No signed agreement found for this application',
        correlationId: req.correlationId,
      });
      return;
    }
    
    if (existingAgreement.certificateFilePath) {
      try {
        const deleted = await storageManager.deleteFile(existingAgreement.certificateFilePath, req.correlationId);

        if (deleted) {
          log.info('Deleted existing certificate before upload', {
            applicationId,
            filePath: existingAgreement.certificateFilePath
          });
        }
      } catch (deleteError) {
        log.warn('Failed to delete existing certificate file', {
          applicationId,
          filePath: existingAgreement.certificateFilePath,
          error: deleteError instanceof Error ? deleteError.message : String(deleteError)
        });
      }
    }

    // Generate certificate file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const certificateFileName = `certificate_${applicationId}_${timestamp}.pdf`;
    const certificateFilePath = `/data/stamped/${certificateFileName}`;
    
    // Save the certificate PDF file
    await storageManager.saveStampedPdf(
      fileBuffer.toString('base64'),
      applicationId,
      certificateFileName,
      req.correlationId
    );
    
    // Update database with certificate file info
    const updatedAgreement = await prisma.signedAgreement.update({
      where: { loanId: applicationId },
      data: {
        certificateFilePath: certificateFilePath,
        certificateFileName: certificateFileName,
        certificateFileHash: require('crypto').createHash('sha256').update(fileBuffer).digest('hex'),
        certificateFileSizeBytes: fileBuffer.length,
        certificateUploadedBy: uploadedBy,
        certificateUploadedAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Create upload audit record
    await prisma.agreementUpload.create({
      data: {
        agreementId: existingAgreement.id,
        uploadedBy: uploadedBy,
        uploadType: 'CERTIFICATE',
        originalFileName: originalFilename,
        fileSize: fileBuffer.length,
        fileHash: require('crypto').createHash('sha256').update(fileBuffer).digest('hex'),
        notes: notes || null,
        ipAddress: req.ip
      }
    });
    
    // Create audit log entry
    await prisma.agreementAuditLog.create({
      data: {
        agreementId: existingAgreement.id,
        action: 'UPLOADED',
        performedBy: uploadedBy,
        details: `Certificate uploaded: ${originalFilename}`,
        metadata: {
          uploadType: 'CERTIFICATE',
          fileName: certificateFileName,
          fileSize: fileBuffer.length,
          originalName: originalFilename,
          notes: notes || null
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    log.info('Certificate uploaded successfully', {
      applicationId,
      certificateFilePath,
      uploadedBy
    });
    
    res.status(200).json({
      success: true,
      message: 'Certificate uploaded successfully',
      data: {
        applicationId,
        certificateFileName,
        certificateFilePath,
        fileSize: fileBuffer.length,
        uploadedBy,
        uploadedAt: new Date().toISOString()
      },
      correlationId: req.correlationId,
    });
  } catch (error) {
    log.error('Certificate upload failed', { 
      error: error instanceof Error ? error.message : String(error),
      applicationId: req.params.applicationId
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to upload certificate',
      correlationId: req.correlationId,
    });
  }
});

/**
 * Download stamp certificate
 * GET /api/admin/agreements/:applicationId/download/certificate
 */
router.get('/admin/agreements/:applicationId/download/certificate', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { applicationId } = req.params;
    
    log.info('Processing certificate download', { applicationId });
    
    // Find the agreement in database
    const agreement = await prisma.signedAgreement.findUnique({
      where: { loanId: applicationId }
    });
    
    if (!agreement || !agreement.certificateFilePath) {
      res.status(404).json({
        error: 'Not Found',
        message: 'No certificate found for this application',
        correlationId: req.correlationId,
      });
      return;
    }
    
    // Check if file exists
    const fileExists = await storageManager.fileExists(agreement.certificateFilePath);
    if (!fileExists) {
      log.error('Certificate file not found on disk', { 
        applicationId, 
        filePath: agreement.certificateFilePath 
      });
      
      res.status(404).json({
        error: 'Not Found',
        message: 'Certificate file not found on disk',
        correlationId: req.correlationId,
      });
      return;
    }
    
    // Read and serve the file
    const fileBuffer = await storageManager.readFile(agreement.certificateFilePath);
    
    // Create download audit record
    await prisma.agreementDownload.create({
      data: {
        agreementId: agreement.id,
        downloadedBy: 'Admin User', // Could be enhanced to get actual user
        downloadType: 'CERTIFICATE',
        ipAddress: req.ip
      }
    });
    
    // Create audit log entry
    await prisma.agreementAuditLog.create({
      data: {
        agreementId: agreement.id,
        action: 'DOWNLOADED',
        performedBy: 'Admin User',
        details: `Certificate downloaded: ${agreement.certificateFileName}`,
        metadata: {
          downloadType: 'CERTIFICATE',
          fileName: agreement.certificateFileName,
          fileSize: agreement.certificateFileSizeBytes
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    log.info('Certificate downloaded successfully', {
      applicationId,
      fileName: agreement.certificateFileName
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${agreement.certificateFileName || `certificate_${applicationId}.pdf`}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    
    // Send the file
    res.send(fileBuffer);
    
  } catch (error) {
    log.error('Certificate download failed', { 
      error: error instanceof Error ? error.message : String(error),
      applicationId: req.params.applicationId
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to download certificate',
      correlationId: req.correlationId,
    });
  }
});

/**
 * Download stamped agreement
 * GET /api/admin/agreements/:applicationId/download/stamped
 */
router.get('/admin/agreements/:applicationId/download/stamped', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { applicationId } = req.params;
    
    log.info('Processing stamped agreement download', { applicationId });
    
    // Find the agreement in database
    const agreement = await prisma.signedAgreement.findUnique({
      where: { loanId: applicationId }
    });
    
    if (!agreement || !agreement.stampedFilePath) {
      res.status(404).json({
        error: 'Not Found',
        message: 'No stamped agreement found for this application',
        correlationId: req.correlationId,
      });
      return;
    }
    
    // Check if file exists
    const fileExists = await storageManager.fileExists(agreement.stampedFilePath);
    if (!fileExists) {
      log.error('Stamped file not found on disk', { 
        applicationId, 
        filePath: agreement.stampedFilePath 
      });
      
      res.status(404).json({
        error: 'Not Found',
        message: 'Stamped agreement file not found on disk',
        correlationId: req.correlationId,
      });
      return;
    }
    
    // Read and serve the file
    const fileBuffer = await storageManager.readFile(agreement.stampedFilePath);
    
    // Create download audit record
    await prisma.agreementDownload.create({
      data: {
        agreementId: agreement.id,
        downloadedBy: 'Admin User', // Could be enhanced to get actual user
        downloadType: 'STAMPED',
        ipAddress: req.ip
      }
    });
    
    // Create audit log entry
    await prisma.agreementAuditLog.create({
      data: {
        agreementId: agreement.id,
        action: 'DOWNLOADED',
        performedBy: 'Admin User',
        details: `Stamped agreement downloaded: ${agreement.stampedFileName}`,
        metadata: {
          downloadType: 'STAMPED',
          fileName: agreement.stampedFileName,
          fileSize: agreement.stampedFileSizeBytes
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    log.info('Stamped agreement downloaded successfully', {
      applicationId,
      fileName: agreement.stampedFileName
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${agreement.stampedFileName || `stamped_${applicationId}.pdf`}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    
    // Send the file
    res.send(fileBuffer);
    
  } catch (error) {
    log.error('Stamped agreement download failed', { 
      error: error instanceof Error ? error.message : String(error),
      applicationId: req.params.applicationId
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to download stamped agreement',
      correlationId: req.correlationId,
    });
  }
});

/**
 * PKI Sign PDF with PIN (for internal users)
 * POST /api/pki/sign-pdf-pin
 */
router.post('/pki/sign-pdf-pin', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { userId, pin, submissionId, applicationId, userFullName, vpsUserId, signatoryType } = req.body;
    
    if (!userId || !pin || !submissionId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required parameters: userId, pin, submissionId',
        correlationId: req.correlationId,
      });
      return;
    }
    
    // Validate PIN format (8 digits)
    if (!/^\d{8}$/.test(pin)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid PIN format. Must be 8 digits.',
        correlationId: req.correlationId,
      });
      return;
    }
    
    log.info('Starting PKI PDF signing process with PIN', { 
      userId, 
      submissionId, 
      applicationId, 
      signatoryType,
      userFullName
    });
    
    // Call the signing service with PIN instead of OTP
    // For PIN-based signing, we'll use a modified version that accepts PIN
    const result = await signingService.signPDFWithPKIPin(
      userId, 
      pin, 
      submissionId, 
      applicationId, 
      req.correlationId!, 
      userFullName, 
      vpsUserId,
      signatoryType
    );
    
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
        correlationId: req.correlationId,
      });
    }
    
  } catch (error) {
    log.error('PKI PDF signing with PIN failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'PKI PDF signing with PIN failed',
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

/**
 * Download signed PDF directly
 * GET /api/signed/:applicationId/download
 */
router.get('/signed/:applicationId/download', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const { applicationId } = req.params;
    
    if (!applicationId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing applicationId parameter',
      });
      return;
    }
    
    log.info('Downloading signed PDF', { applicationId });
    
    // Query database to find the signed agreement
    const signedAgreement = await prisma.signedAgreement.findFirst({
      where: { loanId: applicationId }
    });
    
    if (!signedAgreement || !signedAgreement.signedFilePath) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Signed PDF not found for this application',
      });
      return;
    }
    
    // Check if file exists
    const fileExists = await storageManager.fileExists(signedAgreement.signedFilePath);
    if (!fileExists) {
      log.error('Signed PDF file not found on disk', { 
        filePath: signedAgreement.signedFilePath,
        applicationId 
      });
      res.status(404).json({
        error: 'Not Found',
        message: 'Signed PDF file not found on disk',
      });
      return;
    }
    
    // Read the file and serve it
    const fileBuffer = await storageManager.readFile(signedAgreement.signedFilePath);
    
    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${signedAgreement.signedFileName || 'signed-agreement.pdf'}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    
    log.info('Serving signed PDF', { 
      applicationId,
      fileName: signedAgreement.signedFileName,
      fileSize: fileBuffer.length 
    });
    
    res.send(fileBuffer);
    
  } catch (error) {
    log.error('Failed to download signed PDF', { 
      error: error instanceof Error ? error.message : String(error),
      applicationId: req.params.applicationId
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to download signed PDF',
      correlationId: req.correlationId,
    });
  }
});

/**
 * List all agreements (Admin)
 * GET /api/agreements
 */
router.get('/agreements', verifyApiKey, async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const limit = parseInt(req.query.limit as string) || 1000;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;
    
    log.info('Fetching agreements list', { limit, offset, status });
    
    // Build where clause
    const where: any = {};
    if (status) {
      where.status = status;
    }
    
    // Fetch agreements with file metadata
    const agreements = await prisma.signedAgreement.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        loanId: true,
        userId: true,
        agreementType: true,
        status: true,
        mtsaStatus: true,
        mtsaSignedAt: true,
        originalFilePath: true,
        signedFilePath: true,
        stampedFilePath: true,
        certificateFilePath: true,
        originalFileName: true,
        signedFileName: true,
        stampedFileName: true,
        certificateFileName: true,
        fileSizeBytes: true,
        signedFileSizeBytes: true,
        stampedFileSizeBytes: true,
        certificateFileSizeBytes: true,
        stampedUploadedAt: true,
        certificateUploadedAt: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });
    
    const total = await prisma.signedAgreement.count({ where });
    
    res.status(200).json({
      success: true,
      agreements,
      total,
      limit,
      offset,
      hasMore: offset + agreements.length < total,
      correlationId: req.correlationId,
    });
    
  } catch (error) {
    log.error('Failed to fetch agreements', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch agreements',
      correlationId: req.correlationId,
    });
  }
});

export default router;
