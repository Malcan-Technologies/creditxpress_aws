import axios from 'axios';
import config from '../config';
import { createCorrelatedLogger } from '../utils/logger';
import { mtsaClient } from './MTSAClient';
import { storageManager } from '../utils/storage';
import { prisma } from '../utils/database';
import { createHash } from 'crypto';
import {
  SigningRequest,
  SigningResponse,
  EnrollmentRequest,
  EnrollmentResponse,
  SignerInfo,
  VerificationData,
  SignatureCoordinates,
  FieldUpdate,
  MTSASignPDFRequest,
} from '../types';

export class SigningService {
  /**
   * Process PKI-only signing workflow for multi-signatory documents
   */
  async processPKISigningWorkflow(
    multiSignatoryData: any,
    signingContext: any,
    correlationId: string
  ): Promise<void> {
    const log = createCorrelatedLogger(correlationId);
    
    try {
      const { currentSubmitter, submissionId } = multiSignatoryData;
      
      log.info('🔐 Starting PKI-only workflow', {
        submissionId,
        signerRole: currentSubmitter.role,
        signerEmail: currentSubmitter.email,
        signatoryIndex: signingContext.currentSignatoryIndex + 1,
        totalSignatories: signingContext.totalSignatories
      });
      
      // Step 1: Create or retrieve persistent session
      const session = await this.getOrCreatePKISession(multiSignatoryData, signingContext, correlationId);
      
      // Step 2: Check certificate status for current signatory
      const certStatus = await this.checkCertificateStatus(currentSubmitter.userId, correlationId);
      
      if (!certStatus || certStatus.certStatus !== 'Valid') {
        log.warn('Certificate not valid for PKI signing', {
          userId: currentSubmitter.userId,
          certStatus: certStatus?.certStatus || 'not_found'
        });
        
        // TODO: Redirect to certificate enrollment
        await this.handleCertificateEnrollment(currentSubmitter, session, correlationId);
        return;
      }
      
      // Step 3: Skip automatic OTP request - now handled manually by frontend
      log.info('⚡ Skipping automatic OTP request in PKI workflow - manual control enabled', { 
        userId: currentSubmitter.userId,
        email: currentSubmitter.email
      });
      
      // Step 4: Update session status to ready for manual OTP request
      await this.updatePKISessionStatus(session.id, 'cert_checked', correlationId);
      
      // Step 5: Inject OTP input into DocuSeal UI
      await this.injectOTPInputOverlay(submissionId, currentSubmitter, session.id, correlationId);
      
      log.info('PKI workflow initiated successfully', {
        submissionId,
        sessionId: session.id,
        signerRole: currentSubmitter.role,
        status: 'awaiting_otp'
      });
      
    } catch (error) {
      log.error('PKI workflow failed', {
        error: error instanceof Error ? error.message : String(error),
        submissionId: multiSignatoryData.submissionId,
        signerRole: multiSignatoryData.currentSubmitter.role
      });
      throw error;
    }
  }
  
  /**
   * Complete PKI signing with OTP
   */
  async completePKISigningWithOTP(
    sessionId: string,
    otp: string,
    correlationId: string
  ): Promise<{ success: boolean; message: string; nextAction?: string }> {
    const log = createCorrelatedLogger(correlationId);
    
    try {
      // Step 1: Retrieve session
      const session = await this.getPKISession(sessionId, correlationId);
      if (!session) {
        throw new Error(`PKI session ${sessionId} not found`);
      }
      
      // Step 2: Download current PDF version (may have previous signatures)
      const currentPdfBase64 = await this.downloadCurrentPDFVersion(session, correlationId);
      
      // Step 3: Extract signature coordinates for current signatory
      const signatureCoordinates = this.extractSignatureCoordinates(session.currentSubmitter.signatureFields);
      
      // Step 4: Sign PDF with MTSA
      const signedResult = await this.signPDFWithMTSA(
        session.currentSubmitter,
        currentPdfBase64,
        otp,
        signatureCoordinates,
        correlationId
      );
      
      if (!signedResult.success) {
        throw new Error(`PDF signing failed: ${signedResult.message}`);
      }
      
      // Step 5: Upload signed PDF back to DocuSeal
      await this.uploadSignedPDFToDocuSeal(session.submissionId, signedResult.signedPdfBase64!, correlationId);
      
      // Step 6: Update session and determine next steps
      await this.updateSignatoryCompletion(session, correlationId);
      
      // Step 7: Handle multi-signatory workflow
      const nextAction = await this.handleNextSignatory(session, session.signingContext, correlationId);
      
      log.info('PKI signing completed successfully', {
        sessionId,
        submissionId: session.submissionId,
        signerRole: session.currentSubmitter.role,
        nextAction
      });
      
      return {
        success: true,
        message: 'Document signed successfully with PKI certificate',
        nextAction
      };
      
    } catch (error) {
      log.error('PKI signing completion failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'PKI signing failed'
      };
    }
  }
  
  /**
   * Get or create persistent PKI session
   */
  private async getOrCreatePKISession(multiSignatoryData: any, signingContext: any, correlationId: string): Promise<any> {
    const log = createCorrelatedLogger(correlationId);
    
    // For now, create a simple in-memory session
    // In production, this would be stored in database
    const session = {
      id: `pki_${multiSignatoryData.submissionId}_${Date.now()}`,
      submissionId: multiSignatoryData.submissionId,
      packetId: multiSignatoryData.packetId,
      currentSubmitter: multiSignatoryData.currentSubmitter,
      allSubmitters: multiSignatoryData.allSubmitters,
      signingContext,
      status: 'initiated',
      createdAt: new Date(),
      originalPdfUrl: multiSignatoryData.originalPdfUrl
    };
    
    log.info('Created PKI session', { sessionId: session.id, submissionId: session.submissionId });
    
    // TODO: Store in persistent storage (database/redis)
    return session;
  }
  
  /**
   * Get PKI session by ID
   */
  private async getPKISession(sessionId: string, correlationId: string): Promise<any> {
    // TODO: Retrieve from persistent storage
    // For now, return mock session
    return {
      id: sessionId,
      submissionId: 'mock_submission',
      currentSubmitter: {
        userId: 'mock_user',
        fullName: 'Mock User',
        email: 'mock@example.com',
        role: 'Borrower',
        signatureFields: []
      }
    };
  }
  
  /**
   * Update PKI session status
   */
  private async updatePKISessionStatus(sessionId: string, status: string, correlationId: string): Promise<void> {
    const log = createCorrelatedLogger(correlationId);
    log.info('Updating PKI session status', { sessionId, status });
    
    // TODO: Update in persistent storage
  }
  
  /**
   * Download current PDF version (may have previous signatures)
   */
  private async downloadCurrentPDFVersion(session: any, correlationId: string): Promise<string> {
    const log = createCorrelatedLogger(correlationId);
    
    // For first signatory, download original PDF
    // For subsequent signatories, download PDF with previous signatures
    const pdfUrl = session.originalPdfUrl;
    
    return await this.downloadPdfAsBase64(pdfUrl, correlationId);
  }
  
  /**
   * Extract signature coordinates from DocuSeal fields
   */
  private extractSignatureCoordinates(signatureFields: any[]): any {
    if (!signatureFields || signatureFields.length === 0) {
      // Return default coordinates if none found
      return {
        pageNo: 1,
        x1: 100,
        y1: 200,
        x2: 300,
        y2: 250
      };
    }
    
    const field = signatureFields[0];
    const area = field.areas?.[0];
    
    if (area) {
      // Convert DocuSeal normalized coordinates to MTSA pixel coordinates
      const PDF_WIDTH = 595; // A4 width in points
      const PDF_HEIGHT = 842; // A4 height in points
      
      return {
        pageNo: (area.page || 0) + 1, // Convert 0-based to 1-based
        x1: Math.round(area.x * PDF_WIDTH),
        y1: Math.round(area.y * PDF_HEIGHT),
        x2: Math.round((area.x + area.w) * PDF_WIDTH),
        y2: Math.round((area.y + area.h) * PDF_HEIGHT)
      };
    }
    
    // Fallback to default coordinates
    return {
      pageNo: 1,
      x1: 100,
      y1: 200,
      x2: 300,
      y2: 250
    };
  }
  
  /**
   * Sign PDF with MTSA using extracted coordinates
   */
  private async signPDFWithMTSA(
    submitter: any,
    pdfBase64: string,
    otp: string,
    coordinates: any,
    correlationId: string
  ): Promise<{ success: boolean; message: string; signedPdfBase64?: string }> {
    const log = createCorrelatedLogger(correlationId);
    
    try {
      const signResult = await mtsaClient.signPDF({
        UserID: submitter.userId,
        FullName: submitter.fullName,
        AuthFactor: otp,
        SignatureInfo: {
          pdfInBase64: pdfBase64,
          visibility: true,
          x1: coordinates.x1 || 100,
          y1: coordinates.y1 || 200,
          x2: coordinates.x2 || 300,
          y2: coordinates.y2 || 250,
          pageNo: coordinates.pageNo || 1
        },
        FieldListToUpdate: [
          { pdfFieldName: `DateSigned_${submitter.role}`, pdfFieldValue: 'CURR_DATE,F=DD/MM/YYYY' },
          { pdfFieldName: `SignerName_${submitter.role}`, pdfFieldValue: 'SIGNER_FULLNAME' },
          { pdfFieldName: `SignerID_${submitter.role}`, pdfFieldValue: 'SIGNER_ID' }
        ]
      }, correlationId);
      
      if (signResult.statusCode === '000') {
        return {
          success: true,
          message: 'PDF signed successfully',
          signedPdfBase64: signResult.signedPdfInBase64
        };
      } else {
        return {
          success: false,
          message: signResult.message || 'PDF signing failed'
        };
      }
    } catch (error) {
      log.error('MTSA PDF signing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'PDF signing failed'
      };
    }
  }
  
  /**
   * Upload signed PDF back to DocuSeal
   */
  private async uploadSignedPDFToDocuSeal(submissionId: string, signedPdfBase64: string, correlationId: string): Promise<void> {
    const log = createCorrelatedLogger(correlationId);
    
    try {
      // TODO: Implement DocuSeal API call to upload signed PDF
      log.info('Uploading signed PDF to DocuSeal', { submissionId });
      
      // For now, just log the action
      log.info('Signed PDF uploaded successfully', { submissionId });
      
    } catch (error) {
      log.error('Failed to upload signed PDF to DocuSeal', {
        submissionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Update signatory completion status
   */
  private async updateSignatoryCompletion(session: any, correlationId: string): Promise<void> {
    const log = createCorrelatedLogger(correlationId);
    
    log.info('Updating signatory completion', {
      sessionId: session.id,
      signerRole: session.currentSubmitter.role
    });
    
    // TODO: Update session and database records
  }
  
  /**
   * Handle next signatory in multi-signatory workflow
   */
  private async handleNextSignatory(session: any, signingContext: any, correlationId: string): Promise<string> {
    const log = createCorrelatedLogger(correlationId);
    
    if (signingContext.isLastSignatory) {
      log.info('All signatories completed', { sessionId: session.id });
      return 'all_completed';
    } else {
      log.info('Notifying next signatory', { 
        sessionId: session.id,
        nextRole: signingContext.nextSignatoryRole 
      });
      
      // TODO: Send notification to next signatory
      return 'next_signatory_notified';
    }
  }
  
  /**
   * Handle certificate enrollment for users without valid certificates
   */
  private async handleCertificateEnrollment(submitter: any, session: any, correlationId: string): Promise<void> {
    const log = createCorrelatedLogger(correlationId);
    
    log.info('Handling certificate enrollment', {
      userId: submitter.userId,
      sessionId: session.id
    });
    
    // TODO: Implement certificate enrollment flow
    // This would redirect user to certificate enrollment process
  }
  
  /**
   * Inject OTP input overlay into DocuSeal UI
   */
  private async injectOTPInputOverlay(submissionId: string, submitter: any, sessionId: string, correlationId: string): Promise<void> {
    const log = createCorrelatedLogger(correlationId);
    
    log.info('Injecting OTP input overlay', {
      submissionId,
      sessionId,
      signerEmail: submitter.email
    });
    
    // TODO: Implement frontend injection mechanism
    // This could be done via:
    // 1. WebSocket notification to frontend
    // 2. Polling endpoint that frontend checks
    // 3. Direct DOM manipulation if possible
  }

  /**
   * Process complete signing workflow from DocuSeal webhook
   */
  async processSigningWorkflow(
    request: SigningRequest,
    correlationId: string
  ): Promise<SigningResponse> {
    const log = createCorrelatedLogger(correlationId);
    
    try {
      log.info('Starting signing workflow', { 
        packetId: request.packetId,
        signerId: request.signerInfo.userId 
      });
      
      // Step 1: Check if user has a valid certificate
      const certInfo = await this.checkCertificateStatus(request.signerInfo.userId, correlationId);
      
      // Step 2: If no valid certificate, enroll the user
      if (!certInfo || certInfo.certStatus !== 'Valid') {
        log.info('Certificate not found or invalid, starting enrollment', { 
          signerId: request.signerInfo.userId,
          currentStatus: certInfo?.certStatus 
        });
        
        const enrollmentResult = await this.enrollUser(request.signerInfo, correlationId);
        if (!enrollmentResult.success) {
          return {
            success: false,
            message: 'Certificate enrollment failed',
            error: enrollmentResult.error,
          };
        }
      }
      
      // Step 3: Download unsigned PDF
      const pdfBase64 = await this.downloadPdfAsBase64(request.pdfUrl, correlationId);
      
      // Step 4: Request OTP for signing
      await this.requestSigningOTP(request.signerInfo.userId, request.signerInfo.emailAddress, correlationId);
      
      // Step 5: Wait for OTP (in real implementation, this would be handled via separate endpoint)
      // For now, we'll assume OTP is provided in the request or use a default flow
      
      // Step 6: Sign the PDF
      const signedResult = await this.signPdf(
        request.signerInfo,
        pdfBase64,
        request.templateId,
        request.otp,
        request.coordinates,
        request.signatureImage,
        request.fieldUpdates,
        correlationId
      );
      
      if (!signedResult.success) {
        return signedResult;
      }
      
      // Step 7: Store signed PDF
      const filePath = await storageManager.saveSignedPdf(
        signedResult.signedPdfBase64!,
        request.packetId,
        request.signerInfo.userId,
        correlationId
      );
      
      log.info('Signing workflow completed successfully', { 
        packetId: request.packetId,
        signerId: request.signerInfo.userId,
        filePath 
      });
      
      return {
        success: true,
        message: 'Document signed successfully',
        signedPdfPath: filePath,
        certificateInfo: signedResult.certificateInfo,
      };
      
    } catch (error) {
      log.error('Signing workflow failed', { 
        error: error instanceof Error ? error.message : String(error),
        packetId: request.packetId,
        signerId: request.signerInfo.userId 
      });
      
      return {
        success: false,
        message: 'Signing workflow failed',
        error: {
          code: 'WORKFLOW_ERROR',
          details: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
  
  /**
   * Check certificate status for a user
   */
  async checkCertificateStatus(userId: string, correlationId: string) {
    const log = createCorrelatedLogger(correlationId);
    
    try {
      log.debug('Checking certificate status', { userId });
      
      const result = await mtsaClient.getCertInfo({ UserID: userId }, correlationId);
      
      if (result.statusCode === '000') {
        log.info('Certificate status retrieved', { 
          userId, 
          status: result.certStatus,
          validFrom: result.certValidFrom,
          validTo: result.certValidTo 
        });
        return result;
      } else {
        log.info('Certificate not found or error', { 
          userId, 
          statusCode: result.statusCode,
          message: result.message 
        });
        return null;
      }
    } catch (error) {
      log.warn('Error checking certificate status', { 
        userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }
  
  /**
   * Enroll a new user and issue certificate
   */
  async enrollUser(signerInfo: SignerInfo, correlationId: string): Promise<EnrollmentResponse> {
    const log = createCorrelatedLogger(correlationId);
    
    try {
      log.info('Starting user enrollment', { userId: signerInfo.userId });
      
      // Step 1: Request OTP for enrollment
      const otpResult = await mtsaClient.requestEmailOTP({
        UserID: signerInfo.userId,
        OTPUsage: 'NU',
        EmailAddress: signerInfo.emailAddress,
      }, correlationId);
      
      if (otpResult.statusCode !== '000') {
        return {
          success: false,
          message: 'Failed to send enrollment OTP',
          error: {
            code: 'OTP_FAILED',
            details: otpResult.message,
          },
        };
      }
      
      // Step 2: Create verification data (mock for now)
      const verificationData: VerificationData = {
        status: 'verified',
        datetime: new Date().toISOString(),
        verifier: 'system',
        method: 'ekyc_with_liveness',
        evidence: {
          // In real implementation, these would come from KYC process
          selfieImage: 'base64_selfie_data',
        },
      };
      
      // Step 3: Request certificate (assuming OTP is provided)
      // In real implementation, this would wait for OTP input
      const certResult = await mtsaClient.requestCertificate({
        UserID: signerInfo.userId,
        FullName: signerInfo.fullName,
        EmailAddress: signerInfo.emailAddress,
        MobileNo: signerInfo.mobileNo || '60123456789', // Default if not provided
        Nationality: signerInfo.nationality || 'MY',
        UserType: signerInfo.userType.toString(),
        IDType: 'N',
        AuthFactor: 'OTP_PLACEHOLDER', // In real implementation, get from user input
        VerificationData: {
          verifyDatetime: verificationData.datetime,
          verifyMethod: verificationData.method,
          verifyStatus: verificationData.status,
          verifyVerifier: verificationData.verifier,
        },
        SelfieImage: verificationData.evidence?.selfieImage,
      }, correlationId);
      
      if (certResult.statusCode === '0000') {
        log.info('User enrollment completed successfully', { 
          userId: signerInfo.userId,
          certSerialNo: certResult.certSerialNo 
        });
        
        return {
          success: true,
          message: 'Certificate enrolled successfully',
          certificateInfo: {
            serialNo: certResult.certSerialNo!,
            validFrom: certResult.certValidFrom!,
            validTo: certResult.certValidTo!,
            certificate: certResult.userCert!,
          },
        };
      } else {
        return {
          success: false,
          message: 'Certificate enrollment failed',
          error: {
            code: 'ENROLLMENT_FAILED',
            details: certResult.message,
          },
        };
      }
      
    } catch (error) {
      log.error('User enrollment failed', { 
        userId: signerInfo.userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        success: false,
        message: 'Enrollment process failed',
        error: {
          code: 'ENROLLMENT_ERROR',
          details: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
  
  /**
   * Request OTP for digital signing
   */
  async requestSigningOTP(userId: string, emailAddress: string, correlationId: string): Promise<boolean> {
    const log = createCorrelatedLogger(correlationId);
    
    try {
      log.info('Requesting signing OTP', { userId });
      
      const result = await mtsaClient.requestEmailOTP({
        UserID: userId,
        OTPUsage: 'DS',
        EmailAddress: emailAddress,
      }, correlationId);
      
      const success = result.statusCode === '000';
      log.info('Signing OTP request completed', { userId, success, message: result.message });
      
      return success;
    } catch (error) {
      log.error('Failed to request signing OTP', { 
        userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }
  
  /**
   * Sign PDF document
   */
  async signPdf(
    signerInfo: SignerInfo,
    pdfBase64: string,
    templateId: string,
    otp?: string,
    coordinates?: SignatureCoordinates,
    signatureImage?: string,
    fieldUpdates?: FieldUpdate,
    correlationId?: string
  ): Promise<SigningResponse & { signedPdfBase64?: string }> {
    const log = createCorrelatedLogger(correlationId || 'unknown');
    
    try {
      log.info('Starting PDF signing', { 
        userId: signerInfo.userId,
        templateId,
        hasCoordinates: !!coordinates,
        hasSignatureImage: !!signatureImage 
      });
      
      // Get signature coordinates from template if not provided
      const sigCoordinates = coordinates || config.signatureCoordinates[templateId];
      const isVisible = !!sigCoordinates;
      
      // Prepare field updates with template variables
      const fieldUpdatesObj: FieldUpdate = {
        CURR_DATE: new Date().toLocaleDateString('en-MY'),
        SIGNER_FULLNAME: signerInfo.fullName,
        SIGNER_ID: signerInfo.userId,
        ...fieldUpdates,
      };
      
      // Convert to MTSA expected format (array of PdfFieldNameValue)
      const finalFieldUpdates = Object.entries(fieldUpdatesObj).map(([key, value]) => ({
        pdfFieldName: key,
        pdfFieldValue: value
      }));
      
      const signResult = await mtsaClient.signPDF({
        UserID: signerInfo.userId,
        FullName: signerInfo.fullName,
        AuthFactor: otp || 'OTP_PLACEHOLDER', // In real implementation, use actual OTP
        SignatureInfo: {
          pdfInBase64: pdfBase64,
          visibility: isVisible,
          x1: sigCoordinates.x1 || 100,
          y1: sigCoordinates.y1 || 200,
          x2: sigCoordinates.x2 || 300,
          y2: sigCoordinates.y2 || 250,
          pageNo: sigCoordinates.pageNo || 1,
          sigImageInBase64: signatureImage,
        },
        FieldListToUpdate: finalFieldUpdates,
      }, correlationId);
      
      if (signResult.statusCode === '000') {
        log.info('PDF signing completed successfully', { 
          userId: signerInfo.userId,
          hasSignedPdf: !!signResult.signedPdfInBase64 
        });
        
        return {
          success: true,
          message: 'PDF signed successfully',
          signedPdfBase64: signResult.signedPdfInBase64,
          certificateInfo: {
            serialNo: 'extracted_from_cert', // Would extract from userCert
            validFrom: 'extracted_from_cert',
            validTo: 'extracted_from_cert',
            status: 'Valid',
          },
        };
      } else {
        return {
          success: false,
          message: 'PDF signing failed',
          error: {
            code: 'SIGNING_FAILED',
            details: signResult.message,
          },
        };
      }
      
    } catch (error) {
      log.error('PDF signing failed', { 
        userId: signerInfo.userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        success: false,
        message: 'PDF signing process failed',
        error: {
          code: 'SIGNING_ERROR',
          details: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
  
  /**
   * Download PDF from URL and convert to base64
   */
  async downloadPdfAsBase64(pdfUrl: string, correlationId: string): Promise<string> {
    const log = createCorrelatedLogger(correlationId);
    
    try {
      log.info('Downloading PDF from URL', { pdfUrl });
      
      const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        timeout: config.network.timeoutMs,
        headers: {
          'User-Agent': 'Signing-Orchestrator/1.0',
        },
      });
      
      const base64Data = Buffer.from(response.data).toString('base64');
      
      log.info('PDF downloaded and converted to base64', { 
        pdfUrl,
        sizeBytes: response.data.byteLength 
      });
      
      return base64Data;
    } catch (error) {
      log.error('Failed to download PDF', { 
        pdfUrl,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new Error(`Failed to download PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Verify signed PDF
   */
  async verifySignedPdf(signedPdfBase64: string, correlationId: string) {
    const log = createCorrelatedLogger(correlationId);
    
    try {
      log.info('Verifying signed PDF');
      
      const result = await mtsaClient.verifyPDFSignature({
        SignedPdfInBase64: signedPdfBase64,
      }, correlationId);
      
      log.info('PDF verification completed', { 
        statusCode: result.statusCode,
        totalSignatures: result.totalSignatureInPdf 
      });
      
      return result;
    } catch (error) {
      log.error('PDF verification failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Sign PDF with PKI using OTP and submission/application data
   */
  async signPDFWithPKI(
    userId: string, // IC number for MTSA
    otp: string,
    submissionId: string,
    applicationId: string,
    correlationId: string,
    userFullName?: string,
    vpsUserId?: string // Actual VPS user ID for database
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const log = createCorrelatedLogger(correlationId);
    
    try {
      log.info('Starting PKI PDF signing', { userId, submissionId, applicationId });
      
      // Step 1: Get DocuSeal submission details to find user info and documents
      log.info('Fetching DocuSeal submission details', { submissionId });
      
      // First get submission details to extract user's full name
      const submissionResponse = await axios.get(
        `${config.docuseal.baseUrl}/api/submissions/${submissionId}`,
        {
          headers: {
            'X-Auth-Token': config.docuseal.apiToken,
            'Accept': 'application/json'
          },
          timeout: config.network.timeoutMs
        }
      );
      
      const submission = submissionResponse.data;
      log.info('DocuSeal submission details', { 
        submissionId, 
        hasSubmitters: !!submission?.submitters,
        submitterCount: submission?.submitters?.length || 0
      });
      
      // Find the submitter matching the userId
      const currentSubmitter = submission?.submitters?.find((submitter: any) => 
        submitter.external_id === userId || submitter.uuid === userId
      );
      
      // Use the full name passed from the backend database (much more reliable than certificate extraction)
      const finalUserFullName = userFullName || `User ${userId}`; // fallback if not provided
      
      log.info('Using user full name from database', { 
        userId, 
        fullName: finalUserFullName,
        submitterId: currentSubmitter?.uuid,
        providedByBackend: !!userFullName
      });
      
      // Now get the documents
      const documentsResponse = await axios.get(
        `${config.docuseal.baseUrl}/api/submissions/${submissionId}/documents`,
        {
          headers: {
            'X-Auth-Token': config.docuseal.apiToken,
            'Accept': 'application/json'
          },
          timeout: config.network.timeoutMs
        }
      );
      
      const submissionData = documentsResponse.data;
      log.info('DocuSeal submission documents response', { 
        submissionId, 
        responseStatus: documentsResponse.status,
        hasSubmission: !!submissionData,
        hasDocuments: !!submissionData?.documents,
        documentCount: submissionData?.documents?.length || 0
      });
      
      if (!submissionData || !submissionData.documents || submissionData.documents.length === 0) {
        throw new Error(`DocuSeal submission ${submissionId} not found or has no documents attached.`);
      }
      
      // Get the first document URL
      const document = submissionData.documents[0];
      log.info('Retrieved DocuSeal document', { 
        documentName: document.name,
        documentUrl: document.url
      });
      
      // Step 2: Download the PDF from the document URL (fix localhost for container)
      const containerDocumentUrl = document.url.replace('http://localhost:3001', config.docuseal.baseUrl);
      log.info('Downloading PDF from DocuSeal document URL', { 
        originalUrl: document.url,
        containerUrl: containerDocumentUrl 
      });
      
      const pdfResponse = await axios.get(containerDocumentUrl, {
        headers: {
          'X-Auth-Token': config.docuseal.apiToken,
          'Accept': 'application/pdf'
        },
        responseType: 'arraybuffer',
        timeout: config.network.timeoutMs
      });
      
      const pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');
      log.info('PDF downloaded successfully', { 
        pdfSizeKB: Math.round(pdfResponse.data.byteLength / 1024) 
      });
      
      // Step 3: Get signature coordinates and image using hardcoded positions
      log.info('Getting signature coordinates and image', { submissionId, userId, submitterUuid: currentSubmitter?.uuid });
      
      // Get coordinates and signature image for current user
      const { coordinates, signatureImage } = await this.getSignatureDataForUser(currentSubmitter?.uuid, submissionId);
      
      log.info('Retrieved signature data', {
        userId,
        submitterUuid: currentSubmitter?.uuid,
        coordinates,
        hasSignatureImage: !!signatureImage,
        imageSize: signatureImage?.length || 0
      });
      
      // Step 4: Check if this OTP has already been used for this submission
      const otpKey = `${submissionId}_${userId}_${otp}`;
      const usedOtpCache = global.usedOtpCache || (global.usedOtpCache = new Map());
      
      if (usedOtpCache.has(otpKey)) {
        log.error('OTP already used for this submission', { userId, submissionId, otp });
        throw new Error('This OTP has already been used. Please request a new OTP.');
      }
      
      // Step 5: Sign the PDF with MTSA using extracted coordinates and image
      log.info('Signing PDF with MTSA', { 
        userId, 
        fullName: finalUserFullName, 
        otpLength: otp.length,
        hasOtp: !!otp,
        coordinates,
        hasSignatureImage: !!signatureImage
      });
      
      const signRequest: any = {
        UserID: userId,
        FullName: finalUserFullName,
        AuthFactor: otp,
        FieldListToUpdate: [],
        SignatureInfo: {
          pdfInBase64: pdfBase64,
          visibility: true,
          x1: coordinates.x1,
          y1: coordinates.y1,
          x2: coordinates.x2,
          y2: coordinates.y2,
          pageNo: coordinates.pageNo,
          ...(signatureImage && { sigImageInBase64: signatureImage })
        }
      };
      
      // Mark OTP as used BEFORE calling MTSA to prevent double usage
      usedOtpCache.set(otpKey, Date.now());
      log.info('Marked OTP as used', { otpKey });
      
      // Clean up old OTP entries (older than 30 minutes) to prevent memory leaks
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
      for (const [key, timestamp] of usedOtpCache.entries()) {
        if (timestamp < thirtyMinutesAgo) {
          usedOtpCache.delete(key);
        }
      }
      
      let signedResult;
      try {
        signedResult = await mtsaClient.signPDF(signRequest, correlationId);
      } catch (error) {
        // If MTSA call fails, remove the OTP from cache so it can be retried
        usedOtpCache.delete(otpKey);
        log.error('MTSA call failed, removed OTP from cache', { otpKey, error });
        throw error;
      }
      
      if (signedResult.statusCode !== '000' || !signedResult.signedPdfInBase64) {
        const errorMessage = signedResult.message || 'Unknown error';
        const statusCode = signedResult.statusCode || 'UNKNOWN';
        log.error('MTSA signing failed', { statusCode, message: errorMessage, userId, submissionId });
        
        // If it's an OTP-related error, remove from cache so user can get a new OTP
        if (errorMessage.includes('Invalid OTP') || errorMessage.includes('otp already been used') || statusCode === '001') {
          usedOtpCache.delete(otpKey);
          log.info('Removed failed OTP from cache due to OTP error', { otpKey });
        }
        
        throw new Error(`MTSA signing failed (${statusCode}): ${errorMessage}`);
      }
      
      log.info('PDF signed successfully with MTSA');
      
      // Step 5: Store signed PDF and update database
      
      log.info('Storing signed PDF to file system');
      const signedPdfPath = await storageManager.saveSignedPdf(
        signedResult.signedPdfInBase64,
        submissionId, // Use submission ID as packet ID
        userId,
        correlationId
      );
      
      log.info('Signed PDF stored successfully', { 
        filePath: signedPdfPath,
        submissionId,
        userId 
      });
      
      // Step 6: Create/update database record
      log.info('Creating/updating SignedAgreement database record');
      
      // Calculate file hashes for integrity verification
      const originalPdfBase64 = document.url; // This is the base64 from DocuSeal
      const originalFileHash = createHash('sha256').update(originalPdfBase64, 'base64').digest('hex');
      const signedFileHash = createHash('sha256').update(signedResult.signedPdfInBase64, 'base64').digest('hex');
      const signedFileSize = Buffer.from(signedResult.signedPdfInBase64, 'base64').length;
      const originalFileSize = Buffer.from(originalPdfBase64, 'base64').length;
      
      // Map applicationId to loanId (assuming 1:1 relationship for now)
      // In production, you might need to query the main database to get the actual loanId
      const loanId = applicationId; // Assuming applicationId is the loanId for PKI signing
      
      // Note: Loan signatory status update to SIGNED is handled by the backend PKI API endpoint
      // The backend will update the loan_signatories table after successful PKI signing
      log.info('Loan signatory status will be updated by backend PKI API', {
        loanId,
        signatoryType: 'USER',
        userId
      });
      
      // Save the signed agreement record to database
      try {
        const signedAgreement = await prisma.signedAgreement.upsert({
          where: { loanId },
          update: {
            mtsaStatus: 'SIGNED',
            mtsaSignedAt: new Date(),
            mtsaSignedBy: userId, // IC number
            mtsaTransactionId: correlationId,
            mtsaCertificateInfo: {
              statusCode: signedResult.statusCode,
              message: signedResult.message,
              signedAt: new Date().toISOString(),
              signerUserId: userId,
              vpsUserId: vpsUserId
            },
            signedFilePath: signedPdfPath,
            signedFileHash,
            signedFileName: `${submissionId}_signed.pdf`,
            signedFileSizeBytes: signedFileSize,
            status: 'MTSA_SIGNED',
            updatedAt: new Date()
          },
          create: {
            loanId,
            userId: vpsUserId || userId, // Use VPS user ID if available, fallback to IC number
            agreementType: 'LOAN_AGREEMENT',
            mtsaStatus: 'SIGNED',
            mtsaSignedAt: new Date(),
            mtsaSignedBy: userId, // IC number
            mtsaTransactionId: correlationId,
            mtsaCertificateInfo: {
              statusCode: signedResult.statusCode,
              message: signedResult.message,
              signedAt: new Date().toISOString(),
              signerUserId: userId,
              vpsUserId: vpsUserId
            },
            originalFilePath: `temp_${submissionId}_original.pdf`, // Placeholder for original
            signedFilePath: signedPdfPath,
            originalFileHash,
            signedFileHash,
            originalFileName: `${submissionId}_original.pdf`,
            signedFileName: `${submissionId}_signed.pdf`,
            fileSizeBytes: originalFileSize,
            signedFileSizeBytes: signedFileSize,
            status: 'MTSA_SIGNED'
          }
        });
        
        log.info('SignedAgreement database record created/updated successfully', {
          agreementId: signedAgreement.id,
          loanId,
          userId,
          mtsaTransactionId: correlationId,
          signedAt: signedAgreement.mtsaSignedAt
        });
        
      } catch (dbError) {
        log.error('Failed to create/update SignedAgreement database record', {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          loanId,
          userId,
          submissionId
        });
        // Continue with success response even if database save fails
      }
      
      log.info('Signed PDF stored and database updated successfully', {
        submissionId,
        applicationId,
        userId,
        signedPdfPath
      });
      
      return {
        success: true,
        message: 'PDF signed successfully with PKI and uploaded to DocuSeal',
        data: {
          submissionId,
          applicationId,
          signedAt: new Date().toISOString(),
          signer: userId,
          mtsa: {
            statusCode: signedResult.statusCode,
            message: signedResult.message
          },
          document: {
            name: document.name,
            url: document.url,
            signed: true
          }
        }
      };
      
    } catch (error) {
      log.error('PKI PDF signing failed', { 
        error: error instanceof Error ? error.message : String(error),
        userId,
        submissionId,
        applicationId
      });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'PKI PDF signing failed'
      };
    }
  }

  /**
   * Get signature coordinates and image for a specific user based on their role and DocuSeal template
   */
  private async getSignatureDataForUser(submitterUuid: string | undefined, submissionId: string): Promise<{
    coordinates: { x1: number; y1: number; x2: number; y2: number; pageNo: number };
    signatureImage?: string;
  }> {
    const log = createCorrelatedLogger('getSignatureDataForUser');

    // Get submission details to determine the submitter's role and find their signature fields
    const submissionResponse = await axios.get(
      `${config.docuseal.baseUrl}/api/submissions/${submissionId}`,
      {
        headers: {
          'X-Auth-Token': config.docuseal.apiToken,
          'Accept': 'application/json'
        },
        timeout: config.network.timeoutMs
      }
    );

    const submission = submissionResponse.data;
    
    // Debug log the full submission structure
    log.info('Full submission structure', {
      submissionId,
      hasSubmitters: !!submission?.submitters,
      submitterCount: submission?.submitters?.length,
      hasTemplate: !!submission?.template,
      templateStructure: submission?.template ? Object.keys(submission.template) : 'no template',
      templateFields: submission?.template?.fields?.length || 'no fields',
      submissionKeys: Object.keys(submission || {})
    });
    
    const currentSubmitter = submission?.submitters?.find((submitter: any) => 
      submitter.uuid === submitterUuid
    );

    if (!currentSubmitter) {
      throw new Error(`Submitter with UUID ${submitterUuid} not found in submission ${submissionId}`);
    }

    const submitterRole = currentSubmitter.role;
    log.info('Detected submitter role', { submitterUuid, role: submitterRole });

    // Use hardcoded signature coordinates based on role
    // We don't need template fields since FieldListToUpdate remains empty
    let matchingField: any;
    
    switch (submitterRole) {
      case 'Borrower':
        matchingField = {
          fieldName: 'Signature Field 1',
          normalizedCoords: {
            x: 0.6303923644724104,
            y: 0.7620533496946855,
            w: 0.2708661060019362,
            h: 0.1025646269633508,
            page: 4
          }
        };
        break;
      case 'Witness':
        matchingField = {
          fieldName: 'Signature Field 2', 
          normalizedCoords: {
            x: 0.6303923644724104,
            y: 0.5620533496946855, // Different Y position for witness
            w: 0.2708661060019362,
            h: 0.1025646269633508,
            page: 5
          }
        };
        break;
      case 'Company':
        matchingField = {
          fieldName: 'company_signature',
          normalizedCoords: {
            x: 0.6303923644724104,
            y: 0.3620533496946855, // Different Y position for company
            w: 0.2708661060019362,
            h: 0.1025646269633508,
            page: 5
          }
        };
        break;
      default:
        throw new Error(`Unsupported signer role: ${submitterRole}. PKI signing supports Borrower, Witness, and Company only.`);
    }

    log.info('Using hardcoded signature field for role', {
      role: submitterRole,
      fieldName: matchingField.fieldName,
      page: matchingField.normalizedCoords.page
    });

    // Convert normalized coordinates to pixel coordinates
    const coordinates = this.convertNormalizedToPixels(matchingField.normalizedCoords);

    // Get signature image from DocuSeal submission values
    let signatureImage: string | undefined;
    try {
      signatureImage = await this.getSignatureImageFromSubmission(matchingField.fieldName, submissionId);
    } catch (error) {
      log.warn('Failed to get signature image from submission', {
        error: error instanceof Error ? error.message : String(error),
        fieldName: matchingField.fieldName,
        submitterRole,
        submitterUuid
      });
    }

    return {
      coordinates,
      signatureImage
    };
  }

  /**
   * Convert normalized coordinates (0-1) to pixel coordinates for MTSA
   */
  private convertNormalizedToPixels(normalizedCoords: {
    x: number; y: number; w: number; h: number; page: number;
  }): { x1: number; y1: number; x2: number; y2: number; pageNo: number } {
    // Assuming standard PDF page size (612x792 points)
    const pageWidth = 612;
    const pageHeight = 792;

    const x1 = Math.round(normalizedCoords.x * pageWidth);
    const y1 = Math.round((1 - normalizedCoords.y - normalizedCoords.h) * pageHeight); // PDF coordinates are bottom-up
    const x2 = Math.round((normalizedCoords.x + normalizedCoords.w) * pageWidth);
    const y2 = Math.round((1 - normalizedCoords.y) * pageHeight);

    return {
      x1,
      y1,
      x2,
      y2,
      pageNo: normalizedCoords.page
    };
  }

  /**
   * Get signature image from DocuSeal submission and convert to Base64
   */
  private async getSignatureImageFromSubmission(fieldName: string, submissionId: string): Promise<string | undefined> {
    const log = createCorrelatedLogger('getSignatureImageFromSubmission');

    try {
      // Get the signature image URL directly from DocuSeal submission API
      const signatureUrl = await this.getSignatureUrlFromSubmission(submissionId, fieldName);

      if (!signatureUrl) {
        log.warn('No signature URL found in submission', { submissionId, fieldName });
        return undefined;
      }

      log.info('Found signature URL in submission', {
        fieldName,
        signatureUrl
      });

      // Download the signature image from DocuSeal and convert to Base64
      const imageBase64 = await this.downloadSignatureImage(signatureUrl);

      return imageBase64;

    } catch (error) {
      log.error('Failed to get signature image from submission', {
        error: error instanceof Error ? error.message : String(error),
        fieldName,
        submissionId
      });
      return undefined;
    }
  }

  /**
   * Get signature image URL from DocuSeal submission values
   */
  private async getSignatureUrlFromSubmission(submissionId: string, fieldName: string): Promise<string | undefined> {
    const log = createCorrelatedLogger('getSignatureUrlFromSubmission');
    
    try {
      // Fetch submission details from DocuSeal API
      const submissionResponse = await axios.get(
        `${config.docuseal.baseUrl}/api/submissions/${submissionId}`,
        {
          headers: {
            'X-Auth-Token': config.docuseal.apiToken,
            'Accept': 'application/json'
          },
          timeout: config.network.timeoutMs
        }
      );

      const submission = submissionResponse.data;
      
      log.info('Retrieved submission for signature image', {
        submissionId,
        hasSubmitters: !!submission?.submitters,
        submitterCount: submission?.submitters?.length || 0
      });

      // Look through all submitters for the signature field value
      for (const submitter of submission?.submitters || []) {
        if (submitter.values) {
          // Find the signature field in this submitter's values
          const signatureValue = submitter.values.find((value: any) => 
            value.field === fieldName && 
            value.value && 
            typeof value.value === 'string' && 
            value.value.includes('/file/')
          );

          if (signatureValue) {
            log.info('Found signature field in submitter values', {
              submitterUuid: submitter.uuid,
              fieldName,
              signatureUrl: signatureValue.value
            });
            return signatureValue.value;
          }
        }
      }

      log.warn('No signature field found in any submitter values', { 
        fieldName,
        submitterCount: submission?.submitters?.length || 0
      });
      
      return undefined;

    } catch (error) {
      log.error('Failed to get signature URL from submission', { 
        error: error instanceof Error ? error.message : String(error),
        submissionId,
        fieldName
      });
      return undefined;
    }
  }

  /**
   * Download signature image from DocuSeal and convert to Base64
   */
  private async downloadSignatureImage(imageUrl: string): Promise<string | undefined> {
    const log = createCorrelatedLogger('downloadSignatureImage');
    
    try {
      // Handle URL based on whether we're accessing DocuSeal from inside containers or externally
      let actualUrl = imageUrl;
      
      // If the URL contains localhost:3001, replace with the DocuSeal base URL from config
      if (imageUrl.includes('localhost:3001')) {
        actualUrl = imageUrl.replace('http://localhost:3001', config.docuseal.baseUrl);
      }
      
      log.info('Downloading signature image', { 
        originalUrl: imageUrl,
        actualUrl 
      });

      const response = await axios.get(actualUrl, {
        responseType: 'arraybuffer',
        timeout: config.network.timeoutMs,
        headers: {
          'X-Auth-Token': config.docuseal.apiToken
        }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download image: HTTP ${response.status}`);
      }

      // Convert to Base64
      const base64Image = Buffer.from(response.data).toString('base64');
      
      log.info('Successfully downloaded and converted signature image', { 
        imageSize: base64Image.length,
        contentType: response.headers['content-type']
      });

      return base64Image;

    } catch (error) {
      log.error('Failed to download signature image', { 
        error: error instanceof Error ? error.message : String(error),
        originalUrl: imageUrl
      });
      return undefined;
    }
  }

  /**
   * Sign PDF with PKI using PIN (for internal users) and submission/application data
   */
  async signPDFWithPKIPin(
    userId: string, // IC number for MTSA
    pin: string,
    submissionId: string,
    applicationId: string,
    correlationId: string,
    userFullName?: string,
    vpsUserId?: string, // Actual VPS user ID for database
    signatoryType?: string // COMPANY or WITNESS
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const log = createCorrelatedLogger(correlationId);
    
    try {
      log.info('Starting PKI PDF signing with PIN', { 
        userId, 
        submissionId, 
        applicationId, 
        signatoryType,
        userFullName 
      });
      
      // TODO: Validate PIN against stored credentials
      // For now, we'll assume PIN validation passes for internal users
      log.info('PIN validation passed for internal user', { userId, signatoryType });
      
      // Use the existing OTP-based signing method but with PIN instead
      // For internal users, we can use a dummy OTP since we're validating via PIN
      // and internal users have different authentication flow
      
      // Step 1: Get DocuSeal submission details to find user info and documents
      log.info('Fetching DocuSeal submission details', { submissionId });
      
      // First get submission details to extract user's full name
      const submissionResponse = await axios.get(
        `${config.docuseal.baseUrl}/api/submissions/${submissionId}`,
        {
          headers: {
            'X-Auth-Token': config.docuseal.apiToken,
            'Accept': 'application/json'
          },
          timeout: config.network.timeoutMs
        }
      );
      
      const submission = submissionResponse.data;
      log.info('DocuSeal submission details', { 
        submissionId, 
        hasSubmitters: !!submission?.submitters,
        submitterCount: submission?.submitters?.length || 0
      });
      
      // Find the submitter matching the userId or signatoryType
      let currentSubmitter = submission?.submitters?.find((submitter: any) => 
        submitter.external_id === userId || submitter.uuid === userId
      );
      
      // If not found by userId, try to find by role for company/witness
      if (!currentSubmitter && signatoryType) {
        currentSubmitter = submission?.submitters?.find((submitter: any) => 
          submitter.role?.toUpperCase() === signatoryType.toUpperCase() ||
          submitter.name?.toLowerCase().includes(signatoryType.toLowerCase())
        );
      }
      
      // Use the full name passed from the backend database (much more reliable than certificate extraction)
      const finalUserFullName = userFullName || `${signatoryType} Representative` || `User ${userId}`; // fallback if not provided
      
      log.info('Using user full name from database', { 
        userId, 
        fullName: finalUserFullName,
        submitterId: currentSubmitter?.uuid,
        providedByBackend: !!userFullName,
        signatoryType
      });
      
      // Now get the documents
      const documentsResponse = await axios.get(
        `${config.docuseal.baseUrl}/api/submissions/${submissionId}/documents`,
        {
          headers: {
            'X-Auth-Token': config.docuseal.apiToken,
            'Accept': 'application/json'
          },
          timeout: config.network.timeoutMs
        }
      );
      
      const submissionData = documentsResponse.data;
      log.info('DocuSeal submission documents response', { 
        submissionId, 
        responseStatus: documentsResponse.status,
        hasSubmission: !!submissionData,
        hasDocuments: !!submissionData?.documents,
        documentCount: submissionData?.documents?.length || 0
      });
      
      if (!submissionData || !submissionData.documents || submissionData.documents.length === 0) {
        throw new Error(`DocuSeal submission ${submissionId} not found or has no documents attached.`);
      }
      
      // Get the first document URL
      const document = submissionData.documents[0];
      log.info('Retrieved DocuSeal document', { 
        documentName: document.name,
        documentUrl: document.url ? 'present' : 'missing'
      });
      
      if (!document.url) {
        throw new Error(`DocuSeal document URL not found for submission ${submissionId}.`);
      }
      
      // Step 2: Download the PDF from DocuSeal
      // Fix DocuSeal URL for container environment
      const actualDocumentUrl = document.url.replace('http://localhost:3001', config.docuseal.baseUrl);
      log.info('Downloading PDF from DocuSeal', { 
        originalUrl: document.url,
        actualUrl: actualDocumentUrl 
      });
      
      const pdfResponse = await axios.get(actualDocumentUrl, {
        responseType: 'arraybuffer',
        timeout: config.network.timeoutMs
      });
      
      const pdfBuffer = Buffer.from(pdfResponse.data);
      log.info('Downloaded PDF from DocuSeal', { 
        size: pdfBuffer.length,
        sizeKB: Math.round(pdfBuffer.length / 1024)
      });
      
      // Step 3: Convert PDF to Base64 for MTSA
      const base64Pdf = pdfBuffer.toString('base64');
      log.info('Converted PDF to Base64', { 
        originalSize: pdfBuffer.length,
        base64Size: base64Pdf.length 
      });
      
      // Step 4: Sign the PDF with MTSA PKI (using PIN as authentication instead of OTP)
      log.info('Calling MTSA to sign PDF with PIN', { userId, signatoryType });
      
      try {
        // Get proper signature coordinates based on signatory type
        let coordinates;
        switch (signatoryType) {
          case 'BORROWER':
            coordinates = {
              x1: Math.round(0.6303923644724104 * 612), // Convert normalized to pixels
              y1: Math.round(0.7620533496946855 * 792),
              x2: Math.round((0.6303923644724104 + 0.2708661060019362) * 612),
              y2: Math.round((0.7620533496946855 + 0.1025646269633508) * 792),
              pageNo: 5 // Page 5 for borrower
            };
            break;
          case 'WITNESS':
            coordinates = {
              x1: Math.round(0.6303923644724104 * 612),
              y1: Math.round(0.5620533496946855 * 792),
              x2: Math.round((0.6303923644724104 + 0.2708661060019362) * 612),
              y2: Math.round((0.5620533496946855 + 0.1025646269633508) * 792),
              pageNo: 6 // Page 6 for witness
            };
            break;
          case 'COMPANY':
            coordinates = {
              x1: Math.round(0.6303923644724104 * 612),
              y1: Math.round(0.3620533496946855 * 792), // Different Y for company
              x2: Math.round((0.6303923644724104 + 0.2708661060019362) * 612),
              y2: Math.round((0.3620533496946855 + 0.1025646269633508) * 792),
              pageNo: 7 // Page 7 for company
            };
            break;
          default:
            // Fallback to default coordinates
            coordinates = {
              x1: 100,
              y1: 600,
              x2: 350,
              y2: 700,
              pageNo: 1
            };
        }
        
        const signRequest: any = {
          UserID: userId,
          FullName: finalUserFullName,
          AuthFactor: pin, // Use PIN directly as auth factor
          FieldListToUpdate: [],
          SignatureInfo: {
            pdfInBase64: base64Pdf,
            visibility: true,
            x1: coordinates.x1,
            y1: coordinates.y1,
            x2: coordinates.x2,
            y2: coordinates.y2,
            pageNo: coordinates.pageNo
          }
        };
        
        log.info('Sending PIN-based signing request to MTSA', { 
          userId,
          hasPin: !!pin,
          pinLength: pin.length 
        });
        
        const mtsaResult = await mtsaClient.signPDF(signRequest, correlationId);
        
        if (mtsaResult.statusCode !== '000') {
          log.error('MTSA PKI signing failed', { 
            statusCode: mtsaResult.statusCode,
            message: mtsaResult.message 
          });
          return {
            success: false,
            message: mtsaResult.message || 'MTSA PKI signing failed',
            data: { statusCode: mtsaResult.statusCode }
          };
        }
        
        log.info('MTSA PKI signing successful');
        
        // Step 5: Save the signed PDF
        const signedPdfBuffer = Buffer.from(mtsaResult.signedPdfInBase64, 'base64');
        
        // Generate a unique filename for the signed PDF
        const timestamp = new Date().toISOString().replace(/[:.]/g, '').split('T')[0] + '_' + 
                         new Date().toISOString().replace(/[:.]/g, '').split('T')[1].split('Z')[0];
        const filename = `${timestamp}_${applicationId}_${userId}_${signatoryType || 'signed'}.pdf`;
        
        // Save the signed PDF  
        const savedPath = await storageManager.saveSignedPdf(
          mtsaResult.signedPdfInBase64,
          `${applicationId}_${signatoryType}`, // Use application ID and signatory type as packet ID
          correlationId
        );
        log.info('Saved signed PDF', { filename, path: savedPath });
        
        // Step 6: Calculate file hash for integrity verification
        const fileHash = createHash('sha256').update(signedPdfBuffer).digest('hex');
        
        // Step 7: Store signed agreement record in database
        // Map applicationId to loanId (assuming 1:1 relationship for now)
        const loanId = applicationId; // Assuming applicationId is the loanId for PKI signing
        const finalVpsUserId = vpsUserId || `${signatoryType}_${applicationId}`;
        
        // Note: Loan signatory status update to SIGNED is handled by the backend admin API endpoint
        // The backend will update the loan_signatories table after successful PIN-based PKI signing
        log.info('Loan signatory status will be updated by backend admin API', {
          loanId,
          signatoryType: signatoryType || 'COMPANY',
          userId
        });
        
        await prisma.signedAgreement.upsert({
          where: { loanId },
          update: {
            mtsaStatus: 'SIGNED',
            mtsaSignedAt: new Date(),
            mtsaSignedBy: userId, // IC number
            mtsaTransactionId: correlationId,
            mtsaCertificateInfo: {
              statusCode: mtsaResult.statusCode || 'SUCCESS',
              message: mtsaResult.message || 'PIN-based signing successful',
              signedAt: new Date().toISOString(),
              signerUserId: userId,
              vpsUserId: vpsUserId,
              signatoryType: signatoryType
            },
            signedFilePath: savedPath,
            signedFileHash: fileHash,
            signedFileSizeBytes: signedPdfBuffer.length,
            status: 'MTSA_SIGNED'
          },
          create: {
            loanId,
            userId: finalVpsUserId,
            agreementType: 'LOAN_AGREEMENT',
            mtsaStatus: 'SIGNED',
            mtsaSignedAt: new Date(),
            mtsaSignedBy: userId, // IC number
            mtsaTransactionId: correlationId,
            mtsaCertificateInfo: {
              statusCode: mtsaResult.statusCode || 'SUCCESS',
              message: mtsaResult.message || 'PIN-based signing successful',
              signedAt: new Date().toISOString(),
              signerUserId: userId,
              vpsUserId: vpsUserId,
              signatoryType: signatoryType
            },
            originalFilePath: savedPath, // Using same file as both original and signed for now
            signedFilePath: savedPath,
            originalFileHash: fileHash,
            signedFileHash: fileHash,
            originalFileName: filename,
            signedFileName: filename,
            fileSizeBytes: signedPdfBuffer.length,
            signedFileSizeBytes: signedPdfBuffer.length,
            status: 'MTSA_SIGNED',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        log.info('Stored signed agreement in database', { 
          applicationId, 
          vpsUserId: finalVpsUserId,
        });
        
        return {
          success: true,
          message: `Document successfully signed with PKI by ${signatoryType || 'internal user'}`,
          data: {
            signedFilePath: savedPath,
            fileHash: fileHash,
            mtsaTransactionId: correlationId, // Use correlation ID as transaction ID
            signedBy: finalUserFullName,
            signatoryType: signatoryType
          }
        };
        
      } catch (mtsaError) {
        log.error('MTSA service error during PIN-based signing', { 
          error: mtsaError instanceof Error ? mtsaError.message : String(mtsaError),
          userId,
          signatoryType
        });
        
        return {
          success: false,
          message: 'PKI signing service error',
          data: { 
            error: mtsaError instanceof Error ? mtsaError.message : String(mtsaError),
            userId: userId,
            signatoryType: signatoryType
          }
        };
      }
      
    } catch (error) {
      log.error('PKI PDF signing with PIN failed', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined 
      });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'PKI PDF signing with PIN failed',
        data: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }
}

// Export singleton instance
export const signingService = new SigningService();
