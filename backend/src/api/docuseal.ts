import express from 'express';
import { docusealService } from '../lib/docusealService';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import crypto from 'crypto';
import { docusealConfig, signingConfig } from '../lib/config';
import { prisma } from '../lib/prisma';

const router = express.Router();

/**
 * POST /api/docuseal/initiate-loan-signing
 * Initiate document signing for a loan
 */
router.post('/initiate-loan-signing', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { loanId } = req.body;
    const userId = req.user?.userId;

    if (!loanId) {
      return res.status(400).json({
        success: false,
        message: 'Loan ID is required'
      });
    }

    // Verify user owns this loan (for security)
    const loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        userId: userId
      }
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found or access denied'
      });
    }

    // Check if loan is in correct status for signing
    if (loan.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Loan must be approved before signing'
      });
    }

    // Initiate signing process
    const result = await docusealService.createLoanAgreementSigning(loanId);

    return res.json({
      success: true,
      message: 'Document signing initiated successfully',
      data: {
        submissionId: result.submission.id,
        signUrl: result.signUrl,
        status: result.submission.status
      }
    });

  } catch (error) {
    console.error('Failed to initiate loan signing:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate document signing',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/docuseal/initiate-application-signing
 * Initiate document signing for a loan application (before loan record exists)
 */
router.post('/initiate-application-signing', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { applicationId } = req.body;
    const userId = req.user?.userId;

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: 'Application ID is required'
      });
    }

    // Verify user owns this application (for security)
    const application = await prisma.loanApplication.findFirst({
      where: {
        id: applicationId,
        userId: userId
      },
      include: {
        user: true,
        product: true
      }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found or access denied'
      });
    }

    if (application.status !== 'PENDING_SIGNATURE') {
      return res.status(400).json({
        success: false,
        message: 'Application must be in PENDING_SIGNATURE status'
      });
    }

    // Check if there's already an existing loan/submission for this application
    const existingLoan = await prisma.loan.findFirst({
      where: {
        applicationId: applicationId
      }
    });

    // If loan exists and has a DocuSeal submission, return the existing submission info
    if (existingLoan && existingLoan.docusealSubmissionId) {
      console.log(`Found existing submission ${existingLoan.docusealSubmissionId} for application ${applicationId}`);
      
      try {
        // Try to get submission details from DocuSeal to get the correct signing URL
        const submissionResponse = await fetch(`${docusealConfig.apiUrl}/api/submissions/${existingLoan.docusealSubmissionId}`, {
          headers: {
            'Authorization': `Bearer ${docusealConfig.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (submissionResponse.ok) {
          const submissionData = await submissionResponse.json();
          const borrowerSubmitter = submissionData.submitters?.find((s: any) => s.role === 'Borrower');
          const signUrl = borrowerSubmitter?.embed_src || borrowerSubmitter?.sign_url || `${docusealConfig.baseUrl}/s/${borrowerSubmitter?.slug}`;
          
          return res.json({
            success: true,
            message: 'Document signing link retrieved (existing submission)',
            data: {
              submissionId: existingLoan.docusealSubmissionId,
              signUrl: signUrl,
              status: existingLoan.agreementStatus || 'pending'
            }
          });
        } else {
          console.warn(`Failed to fetch submission ${existingLoan.docusealSubmissionId} from DocuSeal, falling back to basic URL`);
        }
      } catch (error) {
        console.warn(`Error fetching submission ${existingLoan.docusealSubmissionId} from DocuSeal:`, error);
      }
      
      // Fallback: construct basic signing URL
      const signUrl = `${docusealConfig.baseUrl}/s/${existingLoan.docusealSubmissionId}`;
      
      return res.json({
        success: true,
        message: 'Document signing link retrieved (existing submission)',
        data: {
          submissionId: existingLoan.docusealSubmissionId,
          signUrl: signUrl,
          status: existingLoan.agreementStatus || 'pending'
        }
      });
    }

    // Create a temporary loan-like object for DocuSeal service
    const tempLoanData = {
      id: applicationId, // Use application ID as loan ID for now
      principalAmount: application.amount || 0,
      monthlyPayment: application.monthlyRepayment || 0,
      interestRate: application.interestRate || 0,
      term: application.term || 0,
      user: application.user,
      // Add other required fields with defaults
      totalAmount: application.amount || 0,
      outstandingBalance: application.amount || 0,
      nextPaymentDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      status: 'PENDING_SIGNATURE',
      disbursedAt: new Date().toISOString(),
      repayments: [] // Empty for new applications
    };

    // Use DocuSeal service to create signing request
    // Note: We'll need to modify the service to handle application data
    const result = await docusealService.createApplicationAgreementSigning(applicationId, tempLoanData);

    return res.json({
      success: true,
      message: 'Document signing initiated successfully',
      data: {
        submissionId: result.submission.id,
        signUrl: result.signUrl,
        status: result.submission.status
      }
    });

  } catch (error) {
    console.error('Failed to initiate application signing:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate document signing',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/docuseal/admin/initiate-loan-signing
 * Admin endpoint to initiate document signing for any loan
 */
router.post('/admin/initiate-loan-signing', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { loanId } = req.body;

    if (!loanId) {
      return res.status(400).json({
        success: false,
        message: 'Loan ID is required'
      });
    }

    // Initiate signing process (admin can sign any loan)
    const result = await docusealService.createLoanAgreementSigning(loanId);

    return res.json({
      success: true,
      message: 'Document signing initiated successfully by admin',
      data: {
        submissionId: result.submission.id,
        signUrl: result.signUrl,
        status: result.submission.status
      }
    });

  } catch (error) {
    console.error('Admin failed to initiate loan signing:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate document signing',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/docuseal/submission/:submissionId
 * Get submission status
 */
router.get('/submission/:submissionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { submissionId } = req.params;
    
    const submission = await docusealService.getSubmission(submissionId);
    
    return res.json({
      success: true,
      data: submission
    });

  } catch (error) {
    console.error('Failed to get submission:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get submission status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/docuseal/admin/templates
 * Admin endpoint to get all DocuSeal templates
 */
router.get('/admin/templates', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    const templates = await docusealService.getTemplates();
    
    return res.json({
      success: true,
      data: templates
    });

  } catch (error) {
    console.error('Failed to get templates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get templates',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/docuseal/webhook
 * Handle DocuSeal webhook events with PKI interception
 */
router.post('/webhook', async (req, res) => {
  try {
    // Log the complete webhook payload for debugging
    console.log('POST /api/docuseal/webhook - Body:', JSON.stringify(req.body, null, 2));
    console.log('POST /api/docuseal/webhook - Headers:', JSON.stringify(req.headers, null, 2));
    
    // Verify webhook signature (optional but recommended)
    const webhookSecret = docusealConfig.webhookSecret;
    
    if (webhookSecret) {
      const signature = req.headers['x-docuseal-signature'] as string;
      const body = JSON.stringify(req.body);
      
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');
      
      if (signature !== `sha256=${expectedSignature}`) {
        console.warn('Invalid webhook signature');
        return res.status(401).json({
          success: false,
          message: 'Invalid signature'
        });
      }
    }

    // 🔐 PKI INTEGRATION: Check if this is a signing attempt that should be intercepted
    if (req.body.event_type === 'form.completed') {
      console.log('🔐 Intercepting form.completed event for PKI workflow');
      
      // Update application status to PENDING_PKI_SIGNING
      await handleFormCompletedForPKI(req.body);
      
      // Forward to signing orchestrator for PKI processing
      await forwardToSigningOrchestrator(req.body);
      
      // Return success but don't process through standard DocuSeal flow
      return res.json({
        success: true,
        message: 'Signing intercepted for PKI processing'
      });
    } else {
      // Handle other webhook events through standard DocuSeal service
      await docusealService.handleWebhook(req.body);
    }
    
    return res.json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('Failed to process webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process webhook',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Handle form.completed event to update application and signatory status for PKI signing
 * - Updates application status to PENDING_PKI_SIGNING (borrower only)
 * - Updates loan_signatories status to PENDING_PKI_SIGNING (all signatory types: USER, COMPANY, WITNESS)
 */
async function handleFormCompletedForPKI(payload: any): Promise<void> {
  try {
    console.log('🔄 Updating application status for PKI signing', { 
      eventType: payload.event_type,
      submitterId: payload.data?.id 
    });

    // Get submitter details from DocuSeal to find the submission ID
    const submitterId = payload.data?.id;
    if (!submitterId) {
      console.warn('No submitter ID found in webhook payload');
      return;
    }

    // Get submission ID from DocuSeal API
    const submissionResponse = await fetch(`${docusealConfig.apiUrl}/api/submitters/${submitterId}`, {
      headers: {
        'X-Auth-Token': docusealConfig.apiToken,
        'Accept': 'application/json'
      }
    });

    if (!submissionResponse.ok) {
      console.error('Failed to get submitter details from DocuSeal');
      return;
    }

    const submitter = await submissionResponse.json();
    const submissionId = submitter.submission_id;
    const submitterRole = submitter.role;
    const submitterStatus = submitter.status;

    if (!submissionId) {
      console.warn('No submission ID found in submitter data', {
        submitterId,
        submitterRole,
        submitterStatus
      });
      return;
    }

    console.log('📋 Found submission ID from submitter', {
      submitterId,
      submissionId,
      role: submitterRole,
      status: submitterStatus
    });

    if (submitterStatus !== 'completed') {
      console.warn('Skipping PKI transition because DocuSeal submitter is not completed', {
        submitterId,
        submissionId,
        submitterRole,
        submitterStatus
      });
      return;
    }

    // Find the loan by DocuSeal submission ID
    const loan = await prisma.loan.findFirst({
      where: {
        docusealSubmissionId: submissionId.toString()
      },
      include: {
        application: true
      }
    });
    
    if (!loan) {
      console.warn(`No loan found for submission ID: ${submissionId}`);
      return;
    }
    
    console.log(`Found loan ${loan.id} for submission ${submissionId}, processing ${submitterRole} DocuSeal completion`);
    
    // Update the application status (only for borrower)
    if (submitterRole === 'Borrower') {
      await prisma.loanApplication.update({
        where: { id: loan.application.id },
        data: { status: 'PENDING_PKI_SIGNING' }
      });
      
      console.log(`✅ Application ${loan.application.id} status updated to PENDING_PKI_SIGNING (borrower completed DocuSeal)`, {
        submissionId,
        submitterId
      });
    } else {
      console.log(`⏭️ Skipping application status update for ${submitterRole} - only borrower signing triggers application PENDING_PKI_SIGNING`);
    }
    
    // Update loan signatory status to PENDING_PKI_SIGNING for the specific signatory type
    const signatoryTypeMap: { [key: string]: string } = {
      'Borrower': 'USER',
      'Company': 'COMPANY', 
      'Witness': 'WITNESS'
    };
    
    const signatoryType = signatoryTypeMap[submitterRole];
    if (signatoryType) {
      try {
        const updatedSignatory = await prisma.loanSignatory.updateMany({
          where: {
            loanId: loan.id,
            signatoryType: signatoryType,
            status: {
              not: 'SIGNED'
            }
          },
          data: {
            status: 'PENDING_PKI_SIGNING',
            signingUrl: null,
            signingSlug: null,
            slug: null,
            updatedAt: new Date()
          }
        });

        if (updatedSignatory.count === 0) {
          console.warn('No signatory rows moved to PENDING_PKI_SIGNING (already signed or missing row)', {
            loanId: loan.id,
            submissionId,
            submitterId,
            submitterRole,
            signatoryType
          });
        } else {
          console.log(`✅ Updated ${updatedSignatory.count} signatory record(s) to PENDING_PKI_SIGNING for ${signatoryType} (${submitterRole} completed DocuSeal)`, {
            loanId: loan.id,
            submissionId,
            clearedSigningUrl: true
          });
        }
      } catch (signatoryError) {
        console.error(`❌ Failed to update signatory status for ${signatoryType} (${submitterRole}):`, signatoryError, {
          loanId: loan.id,
          submissionId,
          submitterId
        });
        // Don't throw - continue with other processing
      }
    } else {
      console.warn(`Unknown submitter role for signatory mapping: ${submitterRole}`, {
        submitterId,
        submissionId,
        availableRoles: ['Borrower', 'Company', 'Witness']
      });
    }
    
  } catch (error) {
    console.error('Failed to update application status for PKI:', error);
    // Don't throw - we want to continue with orchestrator processing
  }
}

/**
 * Forward webhook to signing orchestrator for PKI processing
 */
async function forwardToSigningOrchestrator(payload: any): Promise<void> {
  try {
    const webhookUrl = `${signingConfig.url}/webhooks/docuseal`;
    
    console.log('Forwarding to signing orchestrator:', webhookUrl);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': signingConfig.apiKey
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Orchestrator responded with ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Orchestrator response:', result);
    
  } catch (error) {
    console.error('Failed to forward to signing orchestrator:', error);
    // Don't throw - we want to continue processing even if orchestrator fails
  }
}

/**
 * GET /api/docuseal/download/:submissionId
 * Download signed agreement document
 */
router.get('/download/:submissionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user?.userId;

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: 'Submission ID is required'
      });
    }

    // Verify user has access to this submission
    const loan = await prisma.loan.findFirst({
      where: {
        docusealSubmissionId: submissionId,
        userId: userId
      },
      include: {
        user: true
      }
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Agreement not found or access denied'
      });
    }

    // Check if agreement is signed
    if (loan.agreementStatus !== 'SIGNED') {
      return res.status(400).json({
        success: false,
        message: 'Agreement is not yet signed'
      });
    }

    // Get DocuSeal download URL instead of downloading directly
    const downloadUrl = await docusealService.getSignedDocumentDownloadUrl(submissionId);
    
    // Return the download URL so frontend can open it in a new tab
    return res.json({
      success: true,
      data: {
        downloadUrl: downloadUrl,
        loanId: loan.id,
        fileName: `loan_agreement_${loan.id.substring(0, 8)}.pdf`
      }
    });

  } catch (error) {
    console.error('Failed to download agreement:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download agreement',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/docuseal/admin/download/:submissionId
 * Admin endpoint to download any signed agreement
 */
router.get('/admin/download/:submissionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { submissionId } = req.params;

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: 'Submission ID is required'
      });
    }

    // Find loan with this submission ID (admin can access any)
    const loan = await prisma.loan.findFirst({
      where: {
        docusealSubmissionId: submissionId
      },
      include: {
        user: true
      }
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Agreement not found'
      });
    }

    // Check if agreement is signed
    if (loan.agreementStatus !== 'SIGNED') {
      return res.status(400).json({
        success: false,
        message: 'Agreement is not yet signed'
      });
    }

    // Get DocuSeal download URL instead of downloading directly
    const downloadUrl = await docusealService.getSignedDocumentDownloadUrl(submissionId);
    
    // Return the download URL so admin can open it in a new tab
    return res.json({
      success: true,
      data: {
        downloadUrl: downloadUrl,
        loanId: loan.id,
        fileName: `loan_agreement_${(loan.user.fullName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')}_${loan.id.substring(0, 8)}.pdf`
      }
    });

  } catch (error) {
    console.error('Admin failed to download agreement:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download agreement',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/docuseal/admin/webhooks
 * Get existing webhook configurations
 */
router.get('/admin/webhooks', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    const webhooks = await docusealService.getWebhooks();
    
    return res.json({
      success: true,
      data: webhooks
    });

  } catch (error) {
    console.error('Failed to get webhooks:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get webhook configurations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/docuseal/admin/configure-webhook
 * Configure webhook URL for DocuSeal
 */
router.post('/admin/configure-webhook', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { webhookUrl } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        message: 'Webhook URL is required'
      });
    }

    const result = await docusealService.configureWebhook(webhookUrl);
    
    return res.json({
      success: true,
      message: 'Webhook configured successfully',
      data: result
    });

  } catch (error) {
    console.error('Failed to configure webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to configure webhook',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/docuseal/test-connection
 * Test connection to DocuSeal server
 */
router.post('/test-connection-simple', async (_req: any, res) => {
  try {
    // Test by getting templates
    const templates = await docusealService.getTemplates();
    
    return res.json({
      success: true,
      message: 'DocuSeal connection successful',
      data: {
        templatesCount: templates.length,
        baseUrl: docusealConfig.baseUrl
      }
    });

  } catch (error) {
    console.error('DocuSeal connection test failed:', error);
    return res.status(500).json({
      success: false,
      message: 'DocuSeal connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
