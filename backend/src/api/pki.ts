import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { emailService } from '../lib/emailService';
import whatsappService from '../lib/whatsappService';
import { signingConfig } from '../lib/config';

const router = express.Router();

/**
 * POST /api/pki/check-certificate
 * Check PKI certificate status for a user
 */
router.post('/check-certificate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId, submissionId } = req.body;
    const requestUserId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // For security, users can only check their own certificates
    // Admin users could potentially check others (implement admin check if needed)
    if (userId !== requestUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: can only check own certificate'
      });
    }

    console.log('Checking PKI certificate status:', { userId, submissionId });

    // Forward request to signing orchestrator
    const response = await fetch(`${signingConfig.url}/api/pki/cert-status/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': signingConfig.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Orchestrator responded with ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    return res.json({
      success: result.success,
      message: result.message,
      data: result.data
    });

  } catch (error) {
    console.error('Failed to check PKI certificate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check certificate status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/pki/request-otp
 * Request OTP for PKI signing
 */
router.post('/request-otp', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId, email, submissionId } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        success: false,
        message: 'User ID and email are required'
      });
    }

    // Note: Authentication is already handled by authenticateToken middleware
    // The orchestrator will validate the OTP request

    console.log('Requesting PKI OTP:', { userId, email, submissionId });

    // Forward request to signing orchestrator
    const response = await fetch(`${signingConfig.url}/api/pki/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': signingConfig.apiKey
      },
      body: JSON.stringify({ userId, email, submissionId })
    });

    if (!response.ok) {
      throw new Error(`Orchestrator responded with ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    return res.json({
      success: result.success,
      message: result.message,
      data: result.data
    });

  } catch (error) {
    console.error('Failed to request PKI OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to request OTP',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/pki/complete-signing
 * Complete PKI signing with OTP
 */
router.post('/complete-signing', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId, otp } = req.body;

    if (!sessionId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and OTP are required'
      });
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP format. Must be 6 digits.'
      });
    }

    console.log('Completing PKI signing:', { sessionId });

    // Forward request to signing orchestrator
    const response = await fetch(`${signingConfig.url}/api/pki/complete-signing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': signingConfig.apiKey
      },
      body: JSON.stringify({ sessionId, otp })
    });

    if (!response.ok) {
      throw new Error(`Orchestrator responded with ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    return res.json({
      success: result.success,
      message: result.message,
      data: result.data
    });

  } catch (error) {
    console.error('Failed to complete PKI signing:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete PKI signing',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/pki/sign-pdf
 * Sign PDF with PKI using OTP
 */
router.post('/sign-pdf', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId, otp, submissionId, applicationId } = req.body;
    const requestUserId = req.user?.userId;

    if (!userId || !otp || !submissionId) {
      return res.status(400).json({
        success: false,
        message: 'User ID, OTP, and submission ID are required'
      });
    }

    // Security check - verify the IC number belongs to the authenticated user
    const user = await prisma.user.findUnique({
      where: { id: requestUserId },
      select: { icNumber: true, idNumber: true, fullName: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userIcNumber = user.icNumber || user.idNumber;
    if (userId !== userIcNumber) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: can only sign with own account'
      });
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP format. Must be 6 digits.'
      });
    }

    // Get the loan and DocuSeal submission ID
    const loan = await prisma.loan.findUnique({
      where: { applicationId },
      select: {
        id: true,
        docusealSubmissionId: true,
        signatories: {
          where: { signatoryType: 'USER' },
          select: {
            docusealSubmitterId: true,
            status: true
          }
        }
      }
    });

    if (!loan || !loan.docusealSubmissionId) {
      return res.status(404).json({
        success: false,
        message: 'Loan or DocuSeal submission not found'
      });
    }

    const userSignatory = loan.signatories[0];
    if (!userSignatory) {
      return res.status(404).json({
        success: false,
        message: 'User signatory not found for this loan'
      });
    }

    console.log('Signing PDF with PKI:', { 
      userId, 
      applicationId, 
      actualSubmissionId: loan.docusealSubmissionId,
      submitterId: userSignatory.docusealSubmitterId 
    });

    // Forward request to signing orchestrator with correct DocuSeal IDs
    const response = await fetch(`${signingConfig.url}/api/pki/sign-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': signingConfig.apiKey
      },
      body: JSON.stringify({ 
        userId, // IC number for MTSA
        vpsUserId: requestUserId, // Actual VPS user ID for database
        otp, 
        submissionId: loan.docusealSubmissionId, // Use actual DocuSeal submission ID (192)
        applicationId,
        docusealSubmitterId: userSignatory.docusealSubmitterId, // Include submitter ID (569)
        userFullName: user.fullName // Include user's full name from database
      })
    });

    const result = await response.json();

    // If orchestrator returned an error, forward it to the frontend
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'PKI signing failed',
        error: result.error || 'Unknown error from orchestrator'
      });
    }

    // Update VPS database after successful PKI signing
    if (result.success) {
      try {
        // Update loan signatory status to SIGNED
        await prisma.loanSignatory.updateMany({
          where: {
            loanId: loan.id,
            signatoryType: 'USER'
          },
          data: {
            status: 'SIGNED',
            signedAt: new Date()
          }
        });

        // Update loan application status to PENDING_SIGNING_COMPANY_WITNESS
        await prisma.loanApplication.updateMany({
          where: {
            id: applicationId
          },
          data: {
            status: 'PENDING_SIGNING_COMPANY_WITNESS'
          }
        });

        // Add audit trail entry for PKI signing completion
        try {
          await prisma.loanApplicationHistory.create({
            data: {
              applicationId: applicationId,
              previousStatus: 'PENDING_PKI_SIGNING',
              newStatus: 'PENDING_SIGNING_COMPANY_WITNESS',
              changedBy: 'USER_PKI_SIGNING',
              changeReason: 'Borrower completed PKI signing',
              notes: `Borrower completed PKI digital signing for loan agreement. Status updated to await company and witness signatures.`,
              metadata: {
                loanId: loan.id,
                userId: requestUserId,
                signedAt: new Date().toISOString(),
                signatoryType: 'USER',
                pkiSigningMethod: 'user_certificate_otp',
                docusealSubmissionId: loan.docusealSubmissionId
              }
            }
          });
          console.log('✅ Audit trail entry created for USER PKI signing completion');
        } catch (auditError) {
          console.error('❌ Failed to create audit trail entry for PKI signing:', auditError);
          // Don't fail the main operation for audit trail issues
        }

        console.log(`VPS database updated after PKI signing: loan ${loan.id}, application ${applicationId}`);

        // Fetch full application data for notifications
        const fullApplication = await prisma.loanApplication.findUnique({
          where: { id: applicationId },
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
                phoneNumber: true
              }
            },
            product: {
              select: {
                name: true
              }
            }
          }
        });

        // Send email notification to user
        try {
          console.log(`📧 Sending email notification to user after PKI signing`);
          const emailResult = await emailService.sendUserSignedNotification(
            requestUserId!,
            loan.id,
            applicationId
          );
          if (emailResult.success) {
            console.log('✅ Email notification sent successfully to user');
          } else {
            console.warn(`⚠️ Failed to send email notification: ${emailResult.error}`);
          }
        } catch (emailError) {
          console.error('❌ Error sending email notification:', emailError);
          // Don't fail the signing process if email fails
        }

        // Send WhatsApp notification to user
        if (fullApplication && fullApplication.amount) {
          whatsappService.sendBorrowerSigningCompleteNotification({
            to: fullApplication.user.phoneNumber,
            fullName: fullApplication.user.fullName || 'Valued Customer',
            productName: fullApplication.product.name,
            amount: fullApplication.amount.toFixed(2),
            email: fullApplication.user.email || 'your registered email'
          }).then((result: { success: boolean; error?: string }) => {
            if (!result.success) {
              console.error(`Failed to send WhatsApp borrower signing complete notification for application ${applicationId}: ${result.error}`);
            }
          });
        }
      } catch (dbError) {
        console.error('Failed to update VPS database after PKI signing:', dbError);
        // Don't fail the signing process if VPS database update fails
      }
    }

    return res.json({
      success: result.success,
      message: result.message,
      data: result.data
    });

  } catch (error) {
    console.error('Failed to sign PDF with PKI:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sign PDF',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/pki/session/:sessionId
 * Get PKI session status
 */
router.get('/session/:sessionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    console.log('Getting PKI session status:', { sessionId });

    // Forward request to signing orchestrator
    const response = await fetch(`${signingConfig.url}/api/pki/session/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': signingConfig.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Orchestrator responded with ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    return res.json({
      success: result.success,
      message: result.message,
      data: result.data
    });

  } catch (error) {
    console.error('Failed to get PKI session status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get session status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
