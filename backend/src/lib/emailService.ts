import { Resend } from 'resend';
import { prisma } from './prisma';
import { resendConfig, signingConfig } from './config';

const RESEND_API_KEY = resendConfig.apiKey;
const RESEND_FROM_EMAIL = resendConfig.fromEmail;
const SIGNING_ORCHESTRATOR_URL = signingConfig.url;
const SIGNING_ORCHESTRATOR_API_KEY = signingConfig.apiKey;

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    if (RESEND_API_KEY) {
      this.resend = new Resend(RESEND_API_KEY);
    } else {
      console.warn('⚠️ RESEND_API_KEY not configured. Email notifications will be disabled.');
    }
  }

  /**
   * Check if email service is enabled
   */
  private isEnabled(): boolean {
    return this.resend !== null && !!RESEND_API_KEY;
  }

  /**
   * Download signed PDF from signing orchestrator
   */
  private async downloadSignedPDF(applicationId: string): Promise<Buffer | null> {
    try {
      const url = `${SIGNING_ORCHESTRATOR_URL}/api/signed/${applicationId}/download`;
      
      console.log(`📥 Downloading signed PDF for application ${applicationId} from ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': SIGNING_ORCHESTRATOR_API_KEY,
        },
      });

      if (!response.ok) {
        console.error(`Failed to download signed PDF: ${response.status} ${response.statusText}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log(`✅ Downloaded signed PDF: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      console.error('Error downloading signed PDF:', error);
      return null;
    }
  }

  /**
   * Send notification when user completes their PKI signature
   */
  async sendUserSignedNotification(
    userId: string,
    loanId: string,
    applicationId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled()) {
      console.warn('Email service is disabled. Skipping user signed notification.');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      // Fetch user and loan details
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          fullName: true,
        },
      });

      if (!user || !user.email) {
        console.warn(`User ${userId} has no email address. Skipping notification.`);
        return { success: false, error: 'User email not found' };
      }

      const loan = await prisma.loan.findUnique({
        where: { id: loanId },
        select: {
          principalAmount: true,
          interestRate: true,
          term: true,
        },
      });

      if (!loan) {
        console.warn(`Loan ${loanId} not found. Skipping notification.`);
        return { success: false, error: 'Loan not found' };
      }

      // Download the signed PDF
      const pdfBuffer = await this.downloadSignedPDF(applicationId);

      // Prepare email content
      const subject = `Your Loan Agreement Signature Confirmed - ${applicationId}`;
      const userName = user.fullName || 'Valued Customer';
      
      const htmlContent = `
        <p>Dear ${userName},</p>
        
        <p>This email confirms that you have successfully completed your digital signature on your loan agreement.</p>
        
        <p><strong>Loan Details:</strong></p>
        <ul>
          <li>Application ID: ${applicationId}</li>
          <li>Loan Amount: RM ${loan.principalAmount.toFixed(2)}</li>
          <li>Interest Rate: ${loan.interestRate}%</li>
          <li>Loan Term: ${loan.term} months</li>
          <li>Status: Awaiting signatures from other parties</li>
        </ul>
        
        <p><strong>Next Steps:</strong></p>
        <p>Your loan agreement is now awaiting signatures from the company representative and witness. Once all parties have signed, you will receive another notification with the fully executed agreement.</p>
        
        ${pdfBuffer ? '<p>Please find your current signed agreement attached to this email.</p>' : ''}
        
        <p>If you have any questions, please contact our support team.</p>
        
        <p>Best regards,<br>CreditXpress Team</p>
        
        <hr>
        <p style="font-size: 12px; color: #666;">
          <em>This is an automated notification. Please do not reply to this email.</em>
        </p>
      `;

      const textContent = `
Dear ${userName},

This email confirms that you have successfully completed your digital signature on your loan agreement.

Loan Details:
- Application ID: ${applicationId}
- Loan Amount: RM ${loan.principalAmount.toFixed(2)}
- Interest Rate: ${loan.interestRate}%
- Loan Term: ${loan.term} months
- Status: Awaiting signatures from other parties

Next Steps:
Your loan agreement is now awaiting signatures from the company representative and witness. Once all parties have signed, you will receive another notification with the fully executed agreement.

${pdfBuffer ? 'Please find your current signed agreement attached to this email.' : ''}

If you have any questions, please contact our support team.

Best regards,
CreditXpress Team

---
This is an automated notification. Please do not reply to this email.
      `.trim();

      // Prepare attachments
      const attachments = pdfBuffer
        ? [
            {
              filename: `loan-agreement-${applicationId}.pdf`,
              content: pdfBuffer,
            },
          ]
        : [];

      // Send email
      console.log(`📧 Sending user signed notification to ${user.email}`);
      
      const result = await this.resend!.emails.send({
        from: RESEND_FROM_EMAIL,
        to: user.email,
        subject,
        html: htmlContent,
        text: textContent,
        attachments,
      });

      console.log(`✅ User signed notification sent successfully to ${user.email}`, result);
      return { success: true };
    } catch (error) {
      console.error('Error sending user signed notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send notification when all parties have signed the agreement
   */
  async sendAllPartiesSignedNotification(
    userId: string,
    loanId: string,
    applicationId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled()) {
      console.warn('Email service is disabled. Skipping all parties signed notification.');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      // Fetch user and loan details
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          fullName: true,
        },
      });

      if (!user || !user.email) {
        console.warn(`User ${userId} has no email address. Skipping notification.`);
        return { success: false, error: 'User email not found' };
      }

      const loan = await prisma.loan.findUnique({
        where: { id: loanId },
        select: {
          principalAmount: true,
          interestRate: true,
          term: true,
          agreementSignedAt: true,
        },
      });

      if (!loan) {
        console.warn(`Loan ${loanId} not found. Skipping notification.`);
        return { success: false, error: 'Loan not found' };
      }

      // Download the fully signed PDF
      const pdfBuffer = await this.downloadSignedPDF(applicationId);

      // Prepare email content
      const subject = `Loan Agreement Fully Executed - ${applicationId}`;
      const userName = user.fullName || 'Valued Customer';
      const signedDate = loan.agreementSignedAt
        ? new Date(loan.agreementSignedAt).toLocaleDateString('en-MY', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'Recently';

      const htmlContent = `
        <p>Dear ${userName},</p>
        
        <p>Congratulations! Your loan agreement has been fully executed with signatures from all parties.</p>
        
        <p><strong>Loan Details:</strong></p>
        <ul>
          <li>Application ID: ${applicationId}</li>
          <li>Loan Amount: RM ${loan.principalAmount.toFixed(2)}</li>
          <li>Interest Rate: ${loan.interestRate}%</li>
          <li>Loan Term: ${loan.term} months</li>
          <li>Agreement Signed: ${signedDate}</li>
          <li>Status: Pending stamping and disbursement</li>
        </ul>
        
        <p><strong>Next Steps:</strong></p>
        <p>Your fully signed loan agreement will now be processed for company stamping and final approval. Once approved, the loan amount will be disbursed to your designated bank account.</p>
        
        ${pdfBuffer ? '<p>Please find your fully executed loan agreement attached to this email for your records.</p>' : ''}
        
        <p>We will notify you once the disbursement has been completed.</p>
        
        <p>If you have any questions, please contact our support team.</p>
        
        <p>Best regards,<br>CreditXpress Team</p>
        
        <hr>
        <p style="font-size: 12px; color: #666;">
          <em>This is an automated notification. Please do not reply to this email.</em>
        </p>
      `;

      const textContent = `
Dear ${userName},

Congratulations! Your loan agreement has been fully executed with signatures from all parties.

Loan Details:
- Application ID: ${applicationId}
- Loan Amount: RM ${loan.principalAmount.toFixed(2)}
- Interest Rate: ${loan.interestRate}%
- Loan Term: ${loan.term} months
- Agreement Signed: ${signedDate}
- Status: Pending stamping and disbursement

Next Steps:
Your fully signed loan agreement will now be processed for company stamping and final approval. Once approved, the loan amount will be disbursed to your designated bank account.

${pdfBuffer ? 'Please find your fully executed loan agreement attached to this email for your records.' : ''}

We will notify you once the disbursement has been completed.

If you have any questions, please contact our support team.

Best regards,
CreditXpress Team

---
This is an automated notification. Please do not reply to this email.
      `.trim();

      // Prepare attachments
      const attachments = pdfBuffer
        ? [
            {
              filename: `loan-agreement-fully-signed-${applicationId}.pdf`,
              content: pdfBuffer,
            },
          ]
        : [];

      // Send email
      console.log(`📧 Sending all parties signed notification to ${user.email}`);
      
      const result = await this.resend!.emails.send({
        from: RESEND_FROM_EMAIL,
        to: user.email,
        subject,
        html: htmlContent,
        text: textContent,
        attachments,
      });

      console.log(`✅ All parties signed notification sent successfully to ${user.email}`, result);
      return { success: true };
    } catch (error) {
      console.error('Error sending all parties signed notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();

