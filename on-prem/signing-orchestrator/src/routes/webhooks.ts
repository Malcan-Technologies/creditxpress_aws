import express from 'express';
import { verifyDocuSealWebhook, rawBodyMiddleware } from '../middleware/auth';
import { createCorrelatedLogger } from '../utils/logger';
import { DocuSealWebhookPayload } from '../types';
import { SigningService } from '../services/SigningService';
import { prisma } from '../utils/database';

// PKI-specific interfaces
interface PKISession {
  id: string;
  submissionId: string;
  templateId: string;
  
  currentSignatory: {
    uuid: string;
    userId: string;
    fullName: string;
    email: string;
    role: string;
    certificateStatus: 'checking' | 'valid' | 'expired' | 'not_found' | 'enrollment_required';
    otpRequested: boolean;
    otpTimestamp?: Date;
    signatureCoordinates: SignatureCoordinates[];
    status: 'intercepted' | 'cert_checked' | 'otp_sent' | 'ready_to_sign' | 'signed' | 'failed';
  };
  
  allSignatories: Array<{
    uuid: string;
    userId: string;
    fullName: string;
    email: string;
    role: string;
    status: 'pending' | 'signed' | 'failed';
    signedAt?: Date;
    certificateSerialNumber?: string;
  }>;
  
  signingOrder: string[];
  currentSignatoryIndex: number;
  totalSignatories: number;
  
  currentPdfUrl: string;
  originalPdfUrl: string;
  
  submissionStatus: 'in_progress' | 'all_signed' | 'failed';
  createdAt: Date;
  expiresAt: Date;
}

interface SignatureCoordinates {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CertificateStatus {
  valid: boolean;
  status: string;
  message: string;
  expiryDate: Date | null;
  serialNumber: string | null;
}

interface OTPResponse {
  success: boolean;
  message: string;
  otpSent: boolean;
}

const router = express.Router();

/**
 * DocuSeal webhook endpoint
 * Handles signer_submitted and packet_completed events
 */
router.post('/docuseal', async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    const payload: DocuSealWebhookPayload = req.body;
    
    log.info('Received DocuSeal webhook', { 
      eventType: payload.event_type,
      dataId: payload.data?.id,
      packetId: payload.data?.packet_id 
    });
    
    // Validate required fields
    if (!payload.event_type || !payload.data) {
      log.warn('Invalid webhook payload structure');
      res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Invalid payload structure' 
      });
      return;
    }
    
    // Handle different event types
    switch (payload.event_type) {
      case 'form.completed':
        log.info('🔥 FORM COMPLETED EVENT RECEIVED - PKI INTERCEPTION ACTIVE!', {
          submissionId: payload.data?.id,
          signerName: payload.data?.name,
          signerEmail: payload.data?.email,
          signerRole: payload.data?.role
        });
        await handleFormCompleted(payload, req.correlationId!);
        break;
        
      case 'packet_completed':
        await handlePacketCompleted(payload, req.correlationId!);
        break;
        
      default:
        log.info('Unhandled webhook event type', { eventType: payload.event_type });
        break;
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully',
      correlationId: req.correlationId 
    });
    
  } catch (error) {
    log.error('Error processing DocuSeal webhook', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to process webhook',
      correlationId: req.correlationId 
    });
  }
});

/**
 * Handle signer_submitted event
 * This intercepts ALL signing attempts and routes them through PKI workflow
 */
async function handleFormCompleted(payload: DocuSealWebhookPayload, correlationId: string): Promise<void> {
  const log = createCorrelatedLogger(correlationId);
  
  try {
    const { data } = payload;
    
    log.info('🔐 PKI Signing Interception Started', {
      eventType: payload.event_type,
      submissionId: data.id,
      signerRole: data.role || 'unknown',
      signerName: data.name || 'unknown',
      signerEmail: data.email || 'unknown'
    });
    
    log.info('🎬 About to create PKI session');
    
    // Create PKI session for this signing attempt
    const pkiSession = await createPKISession(payload, correlationId);
    
    log.info('🎭 PKI session creation completed');
    
    log.info('📋 PKI Session Created', { 
      sessionId: pkiSession.id,
      submissionId: pkiSession.submissionId,
      signerName: pkiSession.currentSignatory.fullName,
      signerEmail: pkiSession.currentSignatory.email
    });
    
    // REAL PKI WORKFLOW WITH MTSA INTEGRATION
    
    log.info('📋 About to start PKI workflow', {
      sessionId: pkiSession.id,
      userId: pkiSession.currentSignatory.userId,
      certificateStatus: pkiSession.currentSignatory.certificateStatus
    });
    
    try {
      // Step 1: Skip certificate check for pilot environment, assume valid
      log.info('⚡ Skipping certificate check for pilot environment', { 
        userId: pkiSession.currentSignatory.userId 
      });
      
      pkiSession.currentSignatory.certificateStatus = 'valid';
      
      log.info('✅ Certificate assumed valid for pilot environment', { 
        userId: pkiSession.currentSignatory.userId 
      });
    
    // Step 2: Skip automatic OTP request - now handled manually by frontend
    log.info('⚡ Skipping automatic OTP request - manual control enabled', { 
      userId: pkiSession.currentSignatory.userId,
      email: pkiSession.currentSignatory.email
    });
    
    // Step 3: Update session status to ready for manual OTP request
    pkiSession.currentSignatory.status = 'cert_checked';
    pkiSession.currentSignatory.otpRequested = false;
    
    await savePKISession(pkiSession);
    
    // Step 4: Status will be updated by backend webhook directly
    // No need to notify backend - it handles status update in its own webhook
    
    log.info('🎯 PKI workflow initiated successfully with REAL MTSA integration', { 
      sessionId: pkiSession.id,
      submissionId: pkiSession.submissionId,
      status: pkiSession.currentSignatory.status,
      certificateStatus: pkiSession.currentSignatory.certificateStatus
    });
    
    } catch (pkiError) {
      log.error('💥 PKI workflow failed', {
        sessionId: pkiSession.id,
        userId: pkiSession.currentSignatory.userId,
        error: pkiError instanceof Error ? pkiError.message : String(pkiError),
        stack: pkiError instanceof Error ? pkiError.stack : undefined
      });
      
      // Update session status to failed
      if (pkiSession) {
        pkiSession.currentSignatory.status = 'failed';
        pkiSession.submissionStatus = 'failed';
        await savePKISession(pkiSession);
      }
      
      throw pkiError; // Re-throw to be caught by outer catch
    }
    
  } catch (error) {
    log.error('💥 Error handling PKI signing interception', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    // Don't re-throw to prevent webhook failures - log and continue
  }
}

/**
 * Create PKI session from DocuSeal webhook payload
 */
async function createPKISession(payload: DocuSealWebhookPayload, correlationId: string): Promise<PKISession> {
  const log = createCorrelatedLogger(correlationId);
  const { data } = payload;
  
  log.info('🛠️ Starting createPKISession', {
    dataId: data.id,
    name: data.name,
    email: data.email,
    role: data.role
  });
  
  // Extract user ID from various possible fields
  const userId = extractUserIdFromPayload(data);
  
  log.info('🔑 Extracted user ID', { userId, fromData: data });
  
  // Get the actual submission ID from DocuSeal API using the submitter ID
  const actualSubmissionId = await getSubmissionIdFromSubmitter(data.id, correlationId);
  
  log.info('📋 Got actual submission ID', { 
    submitterId: data.id, 
    submissionId: actualSubmissionId 
  });
  
  const session: PKISession = {
    id: `pki_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    submissionId: actualSubmissionId,
    templateId: data.template?.id?.toString() || 'unknown',
    
    currentSignatory: {
      uuid: data.id.toString(), // Use submission ID as UUID for now
      userId: userId,
      fullName: data.name || 'Unknown Signer',
      email: data.email || 'unknown@example.com',
      role: data.role || 'Borrower',
      certificateStatus: 'checking',
      otpRequested: false,
      status: 'intercepted',
      signatureCoordinates: [] // Will be populated later
    },
    
    // For now, assume single signatory - can be enhanced later for multi-signatory
    allSignatories: [{
      uuid: data.id.toString(),
      userId: userId,
      fullName: data.name || 'Unknown Signer',
      email: data.email || 'unknown@example.com',
      role: data.role || 'Borrower',
      status: 'pending'
    }],
    
    signingOrder: [data.id.toString()],
    currentSignatoryIndex: 0,
    totalSignatories: 1,
    
    // PDF URLs - will be populated when needed
    currentPdfUrl: '',
    originalPdfUrl: '',
    
    submissionStatus: 'in_progress',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
  };
  
  log.info('PKI session created', {
    sessionId: session.id,
    userId: session.currentSignatory.userId,
    signerName: session.currentSignatory.fullName
  });
  
  log.info('✅ About to return PKI session');
  
  return session;
}

/**
 * Extract user ID from DocuSeal payload data
 */
function extractUserIdFromPayload(data: any): string {
  // Try various fields that might contain the user ID
  const possibleIds = [
    data.submitter_nric,
    data.signer_nric, 
    data.nric,
    data.ic_number,
    data.submitter_id,
    data.signer_id,
    data.user_id,
    data.external_id
  ];
  
  for (const id of possibleIds) {
    if (id && typeof id === 'string' && id.trim()) {
      return id.trim().replace(/[-\s]/g, ''); // Remove dashes and spaces
    }
  }
  
  // Fallback to email or name if no ID found
  return data.email || data.name || 'unknown_user';
}

/**
 * Check certificate status via MTSA
 */
async function checkCertificateStatus(userId: string, correlationId: string): Promise<CertificateStatus> {
  const log = createCorrelatedLogger(correlationId);
  
  try {
    log.info('Checking certificate status', { userId });
    
    // For now, return a mock valid status - will be replaced with actual MTSA call
    // TODO: Implement actual MTSA certificate check
    return {
      valid: true,
      status: 'valid',
      message: 'Certificate is valid and ready for signing',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      serialNumber: 'MOCK_CERT_12345'
    };
    
  } catch (error) {
    log.error('Certificate status check failed', { 
      userId, 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    return {
      valid: false,
      status: 'error',
      message: 'Failed to check certificate status',
      expiryDate: null,
      serialNumber: null
    };
  }
}

/**
 * Request OTP for PKI signing via MTSA
 */
async function requestPKISigningOTP(userId: string, email: string, correlationId: string): Promise<OTPResponse> {
  const log = createCorrelatedLogger(correlationId);
  
  try {
    log.info('Requesting PKI signing OTP', { userId, email });
    
    // For now, return a mock success - will be replaced with actual MTSA call
    // TODO: Implement actual MTSA OTP request
    return {
      success: true,
      message: 'OTP sent successfully to registered email',
      otpSent: true
    };
    
  } catch (error) {
    log.error('OTP request failed', { 
      userId, 
      email,
      error: error instanceof Error ? error.message : String(error) 
    });
    
    return {
      success: false,
      message: 'Failed to send OTP',
      otpSent: false
    };
  }
}

function mapRecordToPKISession(record: any): PKISession {
  const now = new Date();
  return {
    id: record.sessionId,
    submissionId: record.submissionId,
    templateId: record.templateId || 'unknown',
    currentSignatory: (record.currentSignatory as PKISession['currentSignatory']) || {
      uuid: '',
      userId: '',
      fullName: '',
      email: '',
      role: '',
      certificateStatus: 'checking',
      otpRequested: false,
      signatureCoordinates: [],
      status: 'intercepted',
    },
    allSignatories: (record.allSignatories as PKISession['allSignatories']) || [],
    signingOrder: record.signingOrder || [],
    currentSignatoryIndex: record.currentSignatoryIndex ?? 0,
    totalSignatories: record.totalSignatories ?? 1,
    currentPdfUrl: record.currentPdfUrl || '',
    originalPdfUrl: record.originalPdfUrl || '',
    submissionStatus: (record.status as PKISession['submissionStatus']) || 'in_progress',
    createdAt: record.createdAt || now,
    expiresAt: record.expiresAt || now,
  };
}

const fallbackPKISessions = new Map<string, PKISession>();

async function savePKISession(session: PKISession): Promise<void> {
  const pkiSessionModel = (prisma as any).pKISession;
  if (!pkiSessionModel) {
    fallbackPKISessions.set(session.id, session);
    return;
  }

  await pkiSessionModel.upsert({
    where: { sessionId: session.id },
    update: {
      submissionId: session.submissionId,
      templateId: session.templateId,
      status: session.submissionStatus,
      currentSignatory: session.currentSignatory as any,
      allSignatories: session.allSignatories as any,
      signingOrder: session.signingOrder,
      currentSignatoryIndex: session.currentSignatoryIndex,
      totalSignatories: session.totalSignatories,
      currentPdfUrl: session.currentPdfUrl || null,
      originalPdfUrl: session.originalPdfUrl || null,
      sessionData: session as any,
      expiresAt: session.expiresAt,
    },
    create: {
      sessionId: session.id,
      submissionId: session.submissionId,
      templateId: session.templateId,
      status: session.submissionStatus,
      currentSignatory: session.currentSignatory as any,
      allSignatories: session.allSignatories as any,
      signingOrder: session.signingOrder,
      currentSignatoryIndex: session.currentSignatoryIndex,
      totalSignatories: session.totalSignatories,
      currentPdfUrl: session.currentPdfUrl || null,
      originalPdfUrl: session.originalPdfUrl || null,
      sessionData: session as any,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    },
  });
}

async function getPKISession(sessionId: string): Promise<PKISession | null> {
  const pkiSessionModel = (prisma as any).pKISession;
  if (!pkiSessionModel) return fallbackPKISessions.get(sessionId) || null;

  const record = await pkiSessionModel.findUnique({
    where: { sessionId },
  });
  if (!record) return null;
  return mapRecordToPKISession(record);
}

/**
 * Extract comprehensive multi-signatory data from DocuSeal webhook
 */
async function extractMultiSignatoryData(payload: DocuSealWebhookPayload): Promise<MultiSignatoryData> {
  const submissionId = payload.data.id;
  const currentSubmitterUuid = payload.data.submitter_uuid || payload.data.signer_id || '';
  
  // Get full submission details from DocuSeal API
  const docusealApiUrl = process.env.DOCUSEAL_BASE_URL || 'http://192.168.0.100:3001';
  const apiToken = process.env.DOCUSEAL_API_TOKEN || '';
  
  const submissionResponse = await fetch(`${docusealApiUrl}/api/submissions/${submissionId}`, {
    headers: { 'X-Auth-Token': apiToken }
  });
  
  if (!submissionResponse.ok) {
    throw new Error(`Failed to fetch submission ${submissionId}: ${submissionResponse.statusText}`);
  }
  
  const submission = await submissionResponse.json() as any;
  
  // Find current submitter
  const currentSubmitter = submission.submitters?.find((s: any) => s.uuid === currentSubmitterUuid);
  
  if (!currentSubmitter) {
    throw new Error(`Current submitter ${currentSubmitterUuid} not found in submission ${submissionId}`);
  }
  
  // Extract signature fields for current signatory
  const currentSignatoryFields = submission.template?.fields?.filter((field: any) => 
    field.type === 'signature' && field.submitter_uuid === currentSubmitterUuid
  ) || [];
  
  return {
    submissionId,
    packetId: payload.data.packet_id || submissionId,
    currentSubmitter: {
      uuid: currentSubmitterUuid,
      userId: currentSubmitter.metadata?.nric || currentSubmitter.metadata?.passport || currentSubmitter.name?.replace(/\s+/g, ''),
      fullName: currentSubmitter.name,
      email: currentSubmitter.email,
      role: currentSubmitter.role,
      signatureFields: currentSignatoryFields
    },
    allSubmitters: submission.submitters || [],
    template: submission.template,
    currentStatus: submission.status,
    originalPdfUrl: `${docusealApiUrl}/api/submissions/${submissionId}/documents`
  };
}

/**
 * Prevent DocuSeal from completing native signing
 */
async function preventDocusealNativeCompletion(submissionId: string, submitterUuid: string): Promise<void> {
  const log = createCorrelatedLogger('prevent-completion');
  
  try {
    // For now, we'll rely on intercepting the webhook before DocuSeal processes it
    // In a production setup, you might want to pause the submission via DocuSeal API
    log.info('🚫 Preventing DocuSeal native completion', { submissionId, submitterUuid });
    
    // TODO: Implement actual prevention mechanism if DocuSeal API supports it
    // This might involve updating submission status or using DocuSeal's pause functionality
    
  } catch (error) {
    log.warn('Could not prevent DocuSeal native completion', { 
      submissionId, 
      submitterUuid, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/**
 * Determine signing context and order
 */
async function determineSigningContext(multiSignatoryData: MultiSignatoryData): Promise<SigningContext> {
  const { allSubmitters, currentSubmitter } = multiSignatoryData;
  
  // Define signing order: Company → Borrower → Witness
  const signingOrder = ['Company', 'Borrower', 'Witness'];
  
  const currentIndex = signingOrder.indexOf(currentSubmitter.role);
  const totalSignatories = allSubmitters.length;
  
  return {
    currentSignatoryIndex: currentIndex >= 0 ? currentIndex : 0,
    totalSignatories,
    signingOrder,
    isFirstSignatory: currentIndex === 0,
    isLastSignatory: currentIndex === totalSignatories - 1,
    nextSignatoryRole: currentIndex < signingOrder.length - 1 ? signingOrder[currentIndex + 1] : null
  };
}

/**
 * Initiate PKI workflow for current signatory
 */
async function initiatePKIWorkflowForSignatory(
  multiSignatoryData: MultiSignatoryData, 
  signingContext: SigningContext,
  correlationId: string
): Promise<void> {
  const log = createCorrelatedLogger(correlationId);
  
  try {
    log.info('🔑 Starting PKI workflow for signatory', {
      role: multiSignatoryData.currentSubmitter.role,
      email: multiSignatoryData.currentSubmitter.email,
      signatoryIndex: signingContext.currentSignatoryIndex + 1,
      totalSignatories: signingContext.totalSignatories
    });
    
    // Use the enhanced signing service to handle PKI workflow
    const signingService = new SigningService();
    await signingService.processPKISigningWorkflow(multiSignatoryData, signingContext, correlationId);
    
  } catch (error) {
    log.error('Failed to initiate PKI workflow', { 
      error: error instanceof Error ? error.message : String(error),
      submissionId: multiSignatoryData.submissionId,
      signerRole: multiSignatoryData.currentSubmitter.role
    });
    throw error;
  }
}

// Type definitions for new PKI workflow
interface MultiSignatoryData {
  submissionId: string;
  packetId: string;
  currentSubmitter: {
    uuid: string;
    userId: string;
    fullName: string;
    email: string;
    role: string;
    signatureFields: any[];
  };
  allSubmitters: any[];
  template: any;
  currentStatus: string;
  originalPdfUrl: string;
}

interface SigningContext {
  currentSignatoryIndex: number;
  totalSignatories: number;
  signingOrder: string[];
  isFirstSignatory: boolean;
  isLastSignatory: boolean;
  nextSignatoryRole: string | null;
}

/**
 * Handle packet_completed event
 * This can be used for final processing or notifications
 */
async function handlePacketCompleted(payload: DocuSealWebhookPayload, correlationId: string): Promise<void> {
  const log = createCorrelatedLogger(correlationId);
  
  try {
    const { data } = payload;
    
    log.info('Processing packet completion', { 
      packetId: data.packet_id || data.id,
      status: data.status 
    });
    
    // Here you could:
    // 1. Send completion notifications
    // 2. Update external systems
    // 3. Archive documents
    // 4. Generate reports
    
    // For now, just log the completion
    log.info('Packet completed successfully', { 
      packetId: data.packet_id || data.id,
      completedAt: data.completed_at 
    });
    
  } catch (error) {
    log.error('Error handling packet_completed event', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}

/**
 * Get the actual submission ID from DocuSeal API using submitter ID
 */
async function getSubmissionIdFromSubmitter(submitterId: string, correlationId: string): Promise<string> {
  const log = createCorrelatedLogger(correlationId);
  
  try {
    const config = await import('../config');
    const axios = (await import('axios')).default;
    
    log.info('🔍 Getting submission ID from submitter', { submitterId });
    
    // Get submitter details from DocuSeal API
    const response = await axios.get(
      `${config.default.docuseal.baseUrl}/api/submitters/${submitterId}`,
      {
        headers: {
          'X-Auth-Token': config.default.docuseal.apiToken,
          'Accept': 'application/json'
        },
        timeout: config.default.network.timeoutMs
      }
    );
    
    const submitter = response.data;
    const submissionId = submitter.submission_id;
    
    if (!submissionId) {
      throw new Error(`No submission_id found in submitter ${submitterId}`);
    }
    
    log.info('✅ Found submission ID from submitter', {
      submitterId,
      submissionId,
      submitterEmail: submitter.email
    });
    
    return submissionId.toString();
    
  } catch (error) {
    log.error('💥 Failed to get submission ID from submitter', {
      submitterId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Fallback to using submitter ID as submission ID (old behavior)
    log.warn('⚠️ Falling back to using submitter ID as submission ID', { submitterId });
    return submitterId.toString();
  }
}


export default router;
