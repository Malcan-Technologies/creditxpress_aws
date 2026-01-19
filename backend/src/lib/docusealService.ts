import axios from 'axios';
import { docusealConfig, urlConfig, companySigningConfig, serverConfig } from './config';
import { prisma } from './prisma';
// import { TimeUtils } from './precisionUtils';

interface DocuSealConfig {
  baseUrl: string;
  apiUrl: string;
  apiToken: string;
}

interface SubmitterField {
  name: string;
  default_value: string;
  readonly?: boolean;
}

interface SubmitterData {
  name: string;
  email: string;
  role: string;
  fields?: SubmitterField[];
  completed?: boolean;
  external_id?: string;
  completed_redirect_url?: string;
}

interface CreateSubmissionRequest {
  template_id: string;
  send_email?: boolean;
  submitters: SubmitterData[];
  completed_redirect_url?: string;
  expired_redirect_url?: string;
  external_id?: string;
}

interface DocuSealSubmission {
  id: string;
  template_id: string;
  status: string;
  created_at: string;
  submitters: Array<{
    id: number;
    submission_id: number;
    uuid: string;
    email: string;
    slug: string;
    name: string;
    phone: string;
    status: string;
    role: string;
    sent_at: string | null;
    opened_at: string | null;
    completed_at: string | null;
    declined_at: string | null;
    created_at: string;
    updated_at: string;
    metadata: Record<string, any>;
    preferences: Record<string, any>;
    sign_url?: string;
    embed_src?: string;
  }>;
}

class DocuSealService {
  private config: DocuSealConfig;
  private axiosInstance;

  /**
   * Convert numbers to Malaysian words (Bahasa Malaysia) including cents
   */
  private convertToMalaysianWords(num: number): string {
    if (num === 0) return 'KOSONG';
    
    const ones = ['', 'SATU', 'DUA', 'TIGA', 'EMPAT', 'LIMA', 'ENAM', 'TUJUH', 'LAPAN', 'SEMBILAN'];
    const teens = ['SEPULUH', 'SEBELAS', 'DUA BELAS', 'TIGA BELAS', 'EMPAT BELAS', 'LIMA BELAS', 'ENAM BELAS', 'TUJUH BELAS', 'LAPAN BELAS', 'SEMBILAN BELAS'];
    const tens = ['', '', 'DUA PULUH', 'TIGA PULUH', 'EMPAT PULUH', 'LIMA PULUH', 'ENAM PULUH', 'TUJUH PULUH', 'LAPAN PULUH', 'SEMBILAN PULUH'];
    
    // Split into ringgit and sen
    const ringgit = Math.floor(num);
    const sen = Math.round((num - ringgit) * 100);
    
    let result = '';
    
    // Convert ringgit part
    if (ringgit > 0) {
      result += this.convertWholeNumber(ringgit, ones, teens, tens);
      result += ' RINGGIT';
    }
    
    // Convert sen part only if there are actual cents (not 00)
    if (sen > 0 && sen < 100) {
      if (ringgit > 0) result += ' ';
      result += this.convertWholeNumber(sen, ones, teens, tens);
      result += ' SEN';
    }
    
    return result || 'KOSONG';
  }

  /**
   * Convert number to Malaysian words without currency suffix (e.g., 18 -> "LAPAN BELAS")
   */
  private convertToMalaysianWordsNoCurrency(num: number): string {
    if (num === 0) return 'KOSONG';
    
    const ones = ['', 'SATU', 'DUA', 'TIGA', 'EMPAT', 'LIMA', 'ENAM', 'TUJUH', 'LAPAN', 'SEMBILAN'];
    const teens = ['SEPULUH', 'SEBELAS', 'DUA BELAS', 'TIGA BELAS', 'EMPAT BELAS', 'LIMA BELAS', 'ENAM BELAS', 'TUJUH BELAS', 'LAPAN BELAS', 'SEMBILAN BELAS'];
    const tens = ['', '', 'DUA PULUH', 'TIGA PULUH', 'EMPAT PULUH', 'LIMA PULUH', 'ENAM PULUH', 'TUJUH PULUH', 'LAPAN PULUH', 'SEMBILAN PULUH'];
    
    // For whole numbers (like percentages), just convert the whole number
    const wholeNum = Math.round(num);
    return this.convertWholeNumber(wholeNum, ones, teens, tens) || 'KOSONG';
  }

  /**
   * Convert date to Malaysian timezone for display (UTC+8)
   */
  private toMalaysiaDateString(date: Date): string {
    // Convert UTC date to Malaysia timezone (UTC+8)
    const malaysiaTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    return malaysiaTime.toLocaleDateString('en-MY').toUpperCase();
  }

  /**
   * Get current date in Malaysian timezone for display
   */
  private getCurrentMalaysiaDate(): string {
    const now = new Date();
    return this.toMalaysiaDateString(now);
  }

  private convertWholeNumber(num: number, ones: string[], teens: string[], tens: string[]): string {
    if (num === 0) return '';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const ten = Math.floor(num / 10);
      const one = num % 10;
      return tens[ten] + (one ? ' ' + ones[one] : '');
    }
    if (num < 1000) {
      const hundred = Math.floor(num / 100);
      const remainder = num % 100;
      let result = (hundred === 1 ? 'SERATUS' : ones[hundred] + ' RATUS');
      if (remainder) result += ' ' + this.convertWholeNumber(remainder, ones, teens, tens);
      return result;
    }
    if (num < 1000000) {
      const thousand = Math.floor(num / 1000);
      const remainder = num % 1000;
      let result = (thousand === 1 ? 'SERIBU' : this.convertWholeNumber(thousand, ones, teens, tens) + ' RIBU');
      if (remainder) result += ' ' + this.convertWholeNumber(remainder, ones, teens, tens);
      return result;
    }
    
    // For larger numbers, use simplified approach
    return num.toLocaleString('en-MY').replace(/,/g, ' ');
  }

  constructor() {
    this.config = {
      baseUrl: docusealConfig.baseUrl,
      apiUrl: docusealConfig.apiUrl,
      apiToken: docusealConfig.apiToken
    };

    console.log('DocuSeal Service Config:', {
      baseUrl: this.config.baseUrl,
      apiUrl: this.config.apiUrl,
      hasApiToken: !!this.config.apiToken
    });

    // Require API token in production
    if (!this.config.apiToken && serverConfig.isProduction) {
      throw new Error('DOCUSEAL_API_TOKEN environment variable is required');
    }

    this.axiosInstance = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.config.apiToken
      },
      timeout: 30000
    });
  }

  /**
   * Get company settings from database
   */
  private async getCompanySettings() {
    try {
      const companySettings = await prisma.companySettings.findFirst({
        where: { isActive: true },
      });

      // Return default values if no settings found
      if (!companySettings) {
        return {
          companyName: companySigningConfig.defaultCompanyName,
          companyRegNo: 'N/A',
          licenseNo: 'N/A',
          companyAddress: companySigningConfig.defaultCompanyAddress,
          // Signing config - fall back to config values
          signUrl: docusealConfig.baseUrl,
          serverPublicIp: companySigningConfig.serverPublicIp,
        };
      }

      return {
        companyName: companySettings.companyName,
        companyRegNo: companySettings.companyRegNo || 'N/A',
        licenseNo: companySettings.licenseNo || 'N/A',
        companyAddress: companySettings.companyAddress,
        // Signing config - prefer database values, fall back to config
        signUrl: companySettings.signUrl || docusealConfig.baseUrl,
        serverPublicIp: companySettings.serverPublicIp || companySigningConfig.serverPublicIp,
      };
    } catch (error) {
      console.error('Error fetching company settings:', error);
      // Return default values on error
      return {
        companyName: companySigningConfig.defaultCompanyName,
        companyRegNo: 'N/A',
        licenseNo: 'N/A',
        companyAddress: companySigningConfig.defaultCompanyAddress,
        signUrl: docusealConfig.baseUrl,
        serverPublicIp: companySigningConfig.serverPublicIp,
      };
    }
  }

  /**
   * Create a new document submission with pre-filled data
   */
  async createSubmission(request: CreateSubmissionRequest): Promise<DocuSealSubmission> {
    try {
      console.log('Creating DocuSeal submission:', {
        template_id: request.template_id,
        external_id: request.external_id,
        submitters_count: request.submitters.length,
        company_fields: request.submitters.find(s => s.role === 'Company')?.fields
      });
      
      console.log('Full submission request:', JSON.stringify(request, null, 2));

      const response = await this.axiosInstance.post('/api/submissions', request);
      
      console.log('DocuSeal submission created successfully:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Failed to create DocuSeal submission:', error);
      
      if (axios.isAxiosError(error)) {
        throw new Error(`DocuSeal API error: ${error.response?.data?.message || error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Get submission status
   */
  async getSubmission(submissionId: string): Promise<DocuSealSubmission> {
    try {
      const response = await this.axiosInstance.get(`/api/submissions/${submissionId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get DocuSeal submission:', error);
      
      if (axios.isAxiosError(error)) {
        throw new Error(`DocuSeal API error: ${error.response?.data?.message || error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Get all templates
   */
  async getTemplates(): Promise<Array<{ id: string; name: string; created_at: string }>> {
    try {
      const response = await this.axiosInstance.get('/api/templates');
      return response.data;
    } catch (error) {
      console.error('Failed to get DocuSeal templates:', error);
      
      if (axios.isAxiosError(error)) {
        throw new Error(`DocuSeal API error: ${error.response?.data?.message || error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Create loan agreement signing request for applications (before loan record exists)
   */
  async createApplicationAgreementSigning(applicationId: string, applicationData: any): Promise<{
    submission: DocuSealSubmission;
    signUrl: string;
  }> {
    try {
      if (!applicationData.user?.email) {
        throw new Error(`Borrower email not found for application: ${applicationId}`);
      }

      // Get application data first to check for existing submission
      const existingApplication = await prisma.loanApplication.findUnique({
        where: { id: applicationId },
        include: { loan: true }
      });

      // Check if there's already a loan with a signing URL
      if (existingApplication?.loan?.docusealSignUrl) {
        const fullSignUrl = `${this.config.baseUrl}/s/${existingApplication.loan.docusealSignUrl}`;
        console.log(`Returning existing signing URL for application ${applicationId}: ${fullSignUrl}`);
        return {
          submission: { 
            id: existingApplication.loan.docusealSubmissionId || '',
            template_id: '',
            status: 'pending',
            created_at: new Date().toISOString(),
            submitters: []
          },
          signUrl: fullSignUrl
        };
      }

      // Get application data first to determine external_id
      const application = await prisma.loanApplication.findUnique({
        where: { id: applicationId },
        include: { loan: true }
      });

      // Get company settings from database
      const companySettings = await this.getCompanySettings();

      // Build company details string
      const companyDetails = [
        companySettings.companyName,
        `NO. PENDAFTARAN: ${companySettings.companyRegNo}`,
        `NO. LESEN: ${companySettings.licenseNo}`,
        companySettings.companyAddress
      ].join('\n');

      // Pre-fill fields according to DocuSeal API format
      const companyFields: SubmitterField[] = [
        {
          name: 'first_payment_date',
          default_value: application?.loan?.nextPaymentDue 
            ? this.toMalaysiaDateString(new Date(application.loan.nextPaymentDue))
            : this.toMalaysiaDateString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
          readonly: true
        },
        {
          name: 'payment_day',
          default_value: application?.loan?.nextPaymentDue 
            ? `${new Date(application.loan.nextPaymentDue.getTime() + (8 * 60 * 60 * 1000)).getUTCDate()}HB`
            : '1HB',
          readonly: true
        },
        {
          name: 'loan_term',
          default_value: `${applicationData.term}`,
          readonly: true
        },
        {
          name: 'company_details',
          default_value: companyDetails,
          readonly: true
        },
        {
          name: 'borrower_details',
          default_value: `${(applicationData.user.fullName || 'N/A').toUpperCase()}\nIC NO: ${applicationData.user.icNumber || 'N/A'}\nADDRESS: ${`${applicationData.user.address1 || ''} ${applicationData.user.address2 || ''} ${applicationData.user.city || ''} ${applicationData.user.state || ''}`.trim().toUpperCase() || 'N/A'}`,
          readonly: true
        },
        {
          name: 'principal_text',
          default_value: `${this.convertToMalaysianWordsNoCurrency(applicationData.principalAmount)}`,
          readonly: true
        },
        {
          name: 'principal_number',
          default_value: `RM ${applicationData.principalAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          readonly: true
        },
        {
          name: 'interest_text',
          default_value: `${this.convertToMalaysianWordsNoCurrency(applicationData.interestRate * 12)}`,
          readonly: true
        },
        {
          name: 'interest_number',
          default_value: `${(applicationData.interestRate * 12).toFixed(2)}`,
          readonly: true
        },
        {
          name: 'monthly_installment',
          default_value: `${this.convertToMalaysianWords(Math.round(applicationData.monthlyPayment * 100) / 100)} SAHAJA (RM ${applicationData.monthlyPayment.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
          readonly: true
        },
        {
          name: 'total_loan',
          default_value: application?.loan?.outstandingBalance 
            ? `${this.convertToMalaysianWords(Math.round(application.loan.outstandingBalance * 100) / 100)} SAHAJA (RM ${application.loan.outstandingBalance.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
            : `${this.convertToMalaysianWords(Math.round((applicationData.principalAmount * (1 + applicationData.interestRate / 100 * applicationData.term / 12)) * 100) / 100)} SAHAJA (RM ${(applicationData.principalAmount * (1 + applicationData.interestRate / 100 * applicationData.term / 12)).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
          readonly: true
        },
        {
          name: 'agreement_date',
          default_value: this.getCurrentMalaysiaDate(),
          readonly: true
        },
        {
          name: 'company_name',
          default_value: companySettings.companyName,
          readonly: true
        },
        {
          name: 'company_registration',
          default_value: companySettings.companyRegNo,
          readonly: true
        },
        {
          name: 'ip_address',
          default_value: `Digitally generated.${companySettings.serverPublicIp ? ` IP Address: ${companySettings.serverPublicIp}.` : ''} URL: ${companySettings.signUrl}`,
          readonly: true
        }
      ];

      // Note: company_signature will not be pre-filled - company must sign manually
      // company_stamp field has been removed from the document template

      // Create submission with all three parties and different redirect URLs
      const submission = await this.createSubmission({
        template_id: docusealConfig.templateId,
        send_email: true,
        external_id: application?.loan?.id ? `loan_${application.loan.id}` : `application_${applicationId}`, // Use loan ID if available, otherwise application ID
        submitters: [
          {
            name: companySettings.companyName,
            email: companySigningConfig.companyEmail,
            role: 'Company',
            fields: companyFields, // Company gets pre-filled data but must sign manually
            completed_redirect_url: `${urlConfig.admin}/pki-signing?application=${applicationId}&signatory=COMPANY`
            // Note: completed: true removed - company must sign manually
          },
          {
            name: applicationData.user.fullName || 'Borrower',
            email: applicationData.user.email,
            role: 'Borrower',
            external_id: applicationData.user.icNumber || applicationData.user.idNumber, // Include IC number for PKI identification
            fields: [
              {
                name: 'borrower_name',
                default_value: applicationData.user.fullName || 'N/A',
                readonly: true
              },
              {
                name: 'borrower_ic',
                default_value: applicationData.user.icNumber || 'N/A',
                readonly: true
              }
            ],
            completed_redirect_url: `${urlConfig.frontend}/pki-signing?application=${applicationId}&status=processing`
          },
          {
            name: companySigningConfig.witnessName,
            email: companySigningConfig.witnessEmail,
            role: 'Witness',
            completed_redirect_url: `${urlConfig.admin}/pki-signing?application=${applicationId}&signatory=WITNESS`
            // No fields array - witness signs but doesn't need pre-filled data
          }
        ],
        // Remove global redirect URL since we're using per-submitter URLs
        expired_redirect_url: `${urlConfig.frontend}/dashboard/loans?tab=applications&signed=expired`
      });

      // Store submission ID in the loan record for tracking (if loan exists)
      // For applications, we track it via the audit trail metadata

      // Extract submission ID properly - DocuSeal API returns array of submitters
      const submitters = Array.isArray(submission) ? submission : submission.submitters;
      const submissionId = Array.isArray(submission) 
        ? (submission.length > 0 ? submission[0].submission_id : null)
        : submission.id;

      // Create signatory records for tracking individual signatures
      if (application?.loan?.id && submitters && submitters.length > 0) {
        await this.createSignatoryRecords(application.loan.id, submitters);
      }

      if (application?.loan && submissionId) {
        await prisma.loan.update({
          where: { id: application.loan.id },
          data: {
            docusealSubmissionId: submissionId.toString()
            // DO NOT update agreementStatus - use signatory records instead
          }
        });
      }

      console.log(`Application agreement signing initiated for application ${applicationId}, submission ${submissionId}`);
      console.log('DocuSeal submission response:', JSON.stringify(submission, null, 2));
      
      console.log('Submitters array:', submitters);
      console.log('Submitters length:', submitters?.length);
      
      const borrowerSubmitter = submitters?.find(s => {
        console.log('Checking submitter:', { role: s.role, email: s.email });
        return s.role === 'Borrower';
      });
      
      // Store the slug instead of full URL for dynamic generation
      let signingSlug = '';
      let signUrl = '';
      if (borrowerSubmitter) {
        // Prefer slug for dynamic URL generation
        signingSlug = borrowerSubmitter.slug || '';
        signUrl = borrowerSubmitter.embed_src || borrowerSubmitter.sign_url || 
                  (signingSlug ? `${this.config.baseUrl}/s/${signingSlug}` : '');
      }
      
      if (!borrowerSubmitter || !signUrl) {
        console.error('No borrower submitter found or no signing URL available');
        console.error('Available submitters:', submitters?.map(s => ({ role: s.role, email: s.email, slug: s.slug })) || 'No submitters found');
        // Don't throw error, continue with default URL
        signUrl = `${this.config.baseUrl}/submissions/${submissionId || 'unknown'}`;
      }
      
      console.log('Borrower signing slug:', signingSlug);
      console.log('Borrower signing URL:', signUrl);

      // Store the borrower's signing slug in the loan record for backward compatibility
      if (application?.loan && signingSlug) {
        await prisma.loan.update({
          where: { id: application.loan.id },
          data: {
            docusealSignUrl: signingSlug  // Store just the slug, not full URL
          }
        });
      }

      // Add audit trail entry for signing initiation
      await prisma.loanApplicationHistory.create({
        data: {
          applicationId: applicationId,
          previousStatus: applicationData.status,
          newStatus: 'PENDING_SIGNATURE',
          changedBy: 'SYSTEM_DOCUSEAL',
          changeReason: 'Digital signing process initiated',
          notes: `Loan agreement sent for digital signing. DocuSeal Submission ID: ${submissionId || 'pending'}`,
          metadata: {
            docusealSubmissionId: submissionId ? submissionId.toString() : null,
            initiatedAt: new Date().toISOString(),
            borrowerEmail: applicationData.user.email,
            signingSlug: signingSlug,
            signingUrl: signUrl // Kept for backward compatibility
          }
        }
      });
      
      return {
        submission: Array.isArray(submission) ? { 
          id: submissionId ? submissionId.toString() : '', 
          template_id: '', 
          status: 'pending', 
          created_at: new Date().toISOString(), 
          submitters: submission 
        } : submission,
        signUrl
      };

    } catch (error) {
      console.error(`Failed to create application agreement signing for application ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Create loan agreement signing request
   */
  async createLoanAgreementSigning(loanId: string): Promise<{
    submission: DocuSealSubmission;
    signUrl: string;
  }> {
    try {
      // Get loan and borrower data from database
      const loan = await prisma.loan.findUnique({
        where: { id: loanId },
        include: {
          user: true,
          repayments: {
            orderBy: { dueDate: 'asc' }
          }
        }
      });

      if (!loan) {
        throw new Error(`Loan not found: ${loanId}`);
      }

      if (!loan.user.email) {
        throw new Error(`Borrower email not found for loan: ${loanId}`);
      }





      // Create submission
      const submission = await this.createSubmission({
        template_id: docusealConfig.templateId,
        send_email: true,
        external_id: `loan_${loanId}`, // Add external_id for API mapping
        submitters: [{
          name: loan.user.fullName || 'Borrower',
          email: loan.user.email,
          role: 'Borrower',
          fields: [
            {
              name: 'borrower_name',
              default_value: loan.user.fullName || 'N/A',
              readonly: true
            },
            {
              name: 'borrower_ic',
              default_value: loan.user.icNumber || 'N/A',
              readonly: true
            }
          ]
        }],
        completed_redirect_url: `${urlConfig.frontend}/dashboard/loans/${loanId}?signed=success`,
        expired_redirect_url: `${urlConfig.frontend}/dashboard/loans/${loanId}?signed=expired`
      });

      // Store submission ID in database for tracking
      await prisma.loan.update({
        where: { id: loanId },
        data: {
          docusealSubmissionId: submission.id
          // DO NOT update agreementStatus - use signatory records instead
        }
      });

      console.log(`Loan agreement signing initiated for loan ${loanId}, submission ${submission.id}`);

      return {
        submission,
        signUrl: submission.submitters[0]?.sign_url || ''
      };

    } catch (error) {
      console.error(`Failed to create loan agreement signing for loan ${loanId}:`, error);
      
      // Update loan status to reflect error
      // Update signatory records to FAILED status
      await prisma.loanSignatory.updateMany({
        where: { loanId: loanId, status: 'PENDING' },
        data: { status: 'FAILED' }
      }).catch(dbError => {
        console.error('Failed to update signatory status after DocuSeal error:', dbError);
      });

      throw error;
    }
  }

  /**
   * Handle DocuSeal webhook events
   */
  async handleWebhook(payload: any): Promise<void> {
    try {
      console.log('📥 Received DocuSeal webhook payload:', JSON.stringify(payload, null, 2));
      
      const { event_type, data } = payload;
      
      if (!event_type) {
        console.log('⚠️  No event_type in webhook payload');
        return;
      }
      
      if (!data) {
        console.log('⚠️  No data in webhook payload');
        return;
      }
      
      console.log('✅ Received DocuSeal webhook:', event_type, data.id || 'no id');

      switch (event_type) {
        case 'submission.completed':
          await this.handleSubmissionCompleted(data);
          break;
        case 'form.completed':
          await this.handleFormCompleted(data);
          break;
        case 'submission.expired':
          await this.handleSubmissionExpired(data);
          break;
        case 'submission.declined':
          await this.handleSubmissionDeclined(data);
          break;
        default:
          console.log('Unhandled webhook event type:', event_type);
      }
    } catch (error) {
      console.error('Failed to handle DocuSeal webhook:', error);
      throw error;
    }
  }

  private async handleFormCompleted(submissionData: any): Promise<void> {
    try {
      // Convert submission ID to string to match database schema
      const submissionId = String(submissionData.submission_id || submissionData.id);
      const role = submissionData.role;
      
      console.log(`Processing form completion for ID: ${submissionId}, role: ${role}`);
      
      // Find the loan by submission ID
      const loan = await prisma.loan.findFirst({
        where: { docusealSubmissionId: submissionId },
        include: { application: true }
      });

      if (!loan) {
        console.log(`No loan found for submission ID ${submissionId}`);
        return;
      }

      // Update signatory record for this specific signer
      await this.updateSignatoryStatus(loan.id, role, 'SIGNED', new Date(), submissionData);

      // Calculate current agreement status from signatory records (for audit trail only)
      const currentAgreementStatus = await this.calculateAgreementStatus(loan.id);

      // Create audit trail entry - DO NOT update loan table signatory fields
      const roleDisplayName = role === 'Company' ? 'Company' : role === 'Borrower' ? 'Borrower' : 'Legal representative (witness)';
      await prisma.loanApplicationHistory.create({
        data: {
          applicationId: loan.applicationId,
          previousStatus: loan.application.status,
          newStatus: 'PENDING_SIGNATURE', // Keep application in PENDING_SIGNATURE until all signatures complete
          changedBy: 'SYSTEM_DOCUSEAL',
          changeReason: `${roleDisplayName} signature completed`,
          notes: `${roleDisplayName} signature completed via DocuSeal. Submission ID: ${submissionId}. Current signature progress: ${currentAgreementStatus}`,
          metadata: {
            docusealSubmissionId: submissionId,
            signedAt: new Date().toISOString(),
            role: role,
            signatoryType: this.mapRoleToSignatoryType(role),
            currentSignatureStatus: currentAgreementStatus,
            submissionData: submissionData
          }
        }
      });

      console.log(`${roleDisplayName} signature completed for loan ${loan.id}, current signature progress: ${currentAgreementStatus}`);

    } catch (error) {
      console.error('Failed to handle form completion:', error);
      throw error;
    }
  }

  private async handleSubmissionCompleted(submissionData: any): Promise<void> {
    try {
      // Convert submission ID to string to match database schema
      const submissionId = String(submissionData.submission_id || submissionData.id);
      
      console.log(`Processing submission completion for ID: ${submissionId}`);
      
      // Check if this submission has already been processed to prevent duplicate webhook processing
      const existingLoan = await prisma.loan.findFirst({
        where: { 
          docusealSubmissionId: submissionId,
          status: 'PENDING_DISBURSEMENT' // Check if already moved to pending disbursement
        },
        include: { application: true }
      });
      
      if (existingLoan) {
        console.log(`Submission ${submissionId} already processed (status: ${existingLoan.status}), skipping duplicate webhook`);
        return;
      }
      
      // First try to find loan by submission ID
      const loan = await prisma.loan.findFirst({
        where: { docusealSubmissionId: submissionId },
        include: { application: true }
      });

      console.log(`Looking for loan with submission ID: ${submissionId}`);
      console.log(`Found loan: ${loan ? 'YES' : 'NO'}`);
      if (loan) {
        console.log(`Loan ID: ${loan.id}, Application ID: ${loan.applicationId}`);
        console.log(`Loan status: ${loan.status}, agreementStatus: ${loan.agreementStatus}`);
        console.log(`Application status: ${loan.application.status}`);
      }

      if (loan) {
        // Check if all signatures are complete using signatory records
        const currentSignatureStatus = await this.calculateAgreementStatus(loan.id);
        console.log(`Submission completed for loan ${loan.id}, current signature status: ${currentSignatureStatus}`);
        
        if (currentSignatureStatus === 'SIGNED') {
          // Get the user signatory to get the signing slug for backward compatibility
          const userSignatory = await prisma.loanSignatory.findFirst({
            where: { 
              loanId: loan.id,
              signatoryType: 'USER'
            }
          });

          // Use transaction to ensure both loan and application status are updated together
          await prisma.$transaction(async (tx) => {
            console.log(`All signatures complete - starting transaction for submission ${submissionId}, loan ${loan.id}`);
            console.log(`Current loan status: ${loan.status}`);
            console.log(`Current application status: ${loan.application.status}`);
            
            // Update loan status to PENDING_STAMPING and set legacy fields for backward compatibility
            const updatedLoan = await tx.loan.update({
              where: { id: loan.id },
              data: {
                status: 'PENDING_STAMPING', // Move to pending stamping after ALL signatures
                agreementStatus: 'SIGNED', // Set legacy field for backward compatibility
                agreementSignedAt: new Date(), // Set timestamp for backward compatibility
                docusealSignUrl: userSignatory?.slug || null // Set user slug for backward compatibility
              }
            });
            console.log(`Updated loan status to: ${updatedLoan.status}, agreementStatus: ${updatedLoan.agreementStatus}`);

            // Update loan application status to PENDING_STAMPING
            const updatedApplication = await tx.loanApplication.update({
              where: { id: loan.applicationId },
              data: {
                status: 'PENDING_STAMPING'
              }
            });
            console.log(`Updated application status to: ${updatedApplication.status}`);

            // Add audit trail entry for loan application status change
            const auditTrailEntry = await tx.loanApplicationHistory.create({
              data: {
                applicationId: loan.applicationId,
                previousStatus: loan.application.status,
                newStatus: 'PENDING_STAMPING',
                changedBy: 'SYSTEM_DOCUSEAL',
                changeReason: 'All signatures completed via DocuSeal, awaiting stamp certificate',
                notes: `All parties (Company, Borrower, and Witness) have signed the loan agreement. DocuSeal Submission ID: ${submissionId}. Status updated to PENDING_STAMPING, awaiting stamp certificate upload before disbursement.`,
                metadata: {
                  docusealSubmissionId: submissionId,
                  signedAt: new Date().toISOString(),
                  finalSignatureStatus: currentSignatureStatus,
                  submissionData: submissionData,
                  loanId: loan.id
                }
              }
            });
            
            console.log(`Created audit trail entry: ${auditTrailEntry.id} for submission ${submissionId}`);
          });
        } else {
          console.log(`Submission completed but not all signatures done yet. Current status: ${currentSignatureStatus}`);
          // Add audit trail for submission completion but not full signing
          await prisma.loanApplicationHistory.create({
            data: {
              applicationId: loan.applicationId,
              previousStatus: loan.application.status,
              newStatus: 'PENDING_SIGNATURE',
              changedBy: 'SYSTEM_DOCUSEAL',
              changeReason: 'DocuSeal submission completed',
              notes: `DocuSeal submission completed but signatures still pending. Submission ID: ${submissionId}. Current signature status: ${currentSignatureStatus}`,
              metadata: {
                docusealSubmissionId: submissionId,
                completedAt: new Date().toISOString(),
                currentSignatureStatus: currentSignatureStatus,
                submissionData: submissionData,
                loanId: loan.id
              }
            }
          });
        }

        console.log(`Loan agreement completed for loan ${loan.id}, status updated to PENDING_DISBURSEMENT with audit trail`);
      } else {
        // If no loan found, try to find application by submission ID in history
        const applicationHistory = await prisma.loanApplicationHistory.findFirst({
          where: {
                      metadata: {
            path: ['docusealSubmissionId'],
            equals: submissionId
          }
          },
          include: { application: { include: { loan: true } } }
        });

        if (applicationHistory && applicationHistory.application) {
          console.log(`Found application via history: ${applicationHistory.applicationId}`);
          console.log(`Current application status: ${applicationHistory.application.status}`);
          console.log(`Loan exists: ${!!applicationHistory.application.loan}`);
          
          // Use transaction to ensure both application and loan status are updated together
          await prisma.$transaction(async (tx) => {
            // Update application status to PENDING_DISBURSEMENT
            const updatedApplication = await tx.loanApplication.update({
              where: { id: applicationHistory.applicationId },
              data: {
                status: 'PENDING_DISBURSEMENT'
              }
            });
            console.log(`Updated application status to: ${updatedApplication.status}`);

            // If loan exists, update its status too
            if (applicationHistory.application.loan) {
              // Get the user signatory to get the signing slug for backward compatibility
              const userSignatory = await prisma.loanSignatory.findFirst({
                where: { 
                  loanId: applicationHistory.application.loan.id,
                  signatoryType: 'USER'
                }
              });

              const updatedLoan = await tx.loan.update({
                where: { id: applicationHistory.application.loan.id },
                data: {
                  status: 'PENDING_DISBURSEMENT',
                  agreementStatus: 'SIGNED', // Set legacy field for backward compatibility
                  agreementSignedAt: new Date(), // Set timestamp for backward compatibility
                  docusealSignUrl: userSignatory?.slug || null // Set user slug for backward compatibility
                }
              });
              console.log(`Updated loan status to: ${updatedLoan.status}, agreementStatus: ${updatedLoan.agreementStatus}`);
            }

            // Add audit trail entry for application signing completion
            await tx.loanApplicationHistory.create({
              data: {
                applicationId: applicationHistory.applicationId,
                previousStatus: 'PENDING_SIGNATURE',
                newStatus: 'PENDING_DISBURSEMENT',
                changedBy: 'SYSTEM_DOCUSEAL',
                changeReason: 'All signatures completed via DocuSeal, ready for disbursement',
                notes: `All parties (Company, Borrower, and Witness) have signed the loan agreement. DocuSeal Submission ID: ${submissionId}. Status updated to PENDING_DISBURSEMENT.`,
                metadata: {
                  docusealSubmissionId: submissionId,
                  signedAt: new Date().toISOString(),
                  submissionData: submissionData,
                  loanId: applicationHistory.application.loan?.id || null
                }
              }
            });
          });

          console.log(`Application agreement completed for application ${applicationHistory.applicationId}, status updated to PENDING_DISBURSEMENT with audit trail`);
        } else {
          console.error('No loan or application found for completed submission:', submissionId);
        }
      }

      // TODO: Trigger any post-signing workflows
      // - Send confirmation email
      // - Notify admin for disbursement
      // - Update frontend to show signing completion
      
    } catch (error) {
      console.error('Failed to handle submission completed:', error);
      throw error;
    }
  }

  private async handleSubmissionExpired(submissionData: any): Promise<void> {
    try {
      // Convert submission ID to string to match database schema
      const submissionId = String(submissionData.submission_id || submissionData.id);
      
      const loan = await prisma.loan.findFirst({
        where: { docusealSubmissionId: submissionId },
        include: { application: true }
      });

      if (loan) {
        // Update all signatory records to EXPIRED status
        await prisma.loanSignatory.updateMany({
          where: { loanId: loan.id, status: 'PENDING' },
          data: { status: 'EXPIRED' }
        });

        // Add audit trail entry
        await prisma.loanApplicationHistory.create({
          data: {
            applicationId: loan.applicationId,
            previousStatus: loan.application.status,
            newStatus: 'AGREEMENT_EXPIRED',
            changedBy: 'SYSTEM_DOCUSEAL',
            changeReason: 'Document signing link expired',
            notes: `Loan agreement signing expired. DocuSeal Submission ID: ${submissionId}`,
            metadata: {
              docusealSubmissionId: submissionId,
              expiredAt: new Date().toISOString(),
              submissionData: submissionData
            }
          }
        });

        console.log(`Loan agreement expired for loan ${loan.id} with audit trail`);
      }
    } catch (error) {
      console.error('Failed to handle submission expired:', error);
    }
  }

  private async handleSubmissionDeclined(submissionData: any): Promise<void> {
    try {
      // Convert submission ID to string to match database schema
      const submissionId = String(submissionData.submission_id || submissionData.id);
      
      const loan = await prisma.loan.findFirst({
        where: { docusealSubmissionId: submissionId },
        include: { application: true }
      });

      if (loan) {
        // Update all signatory records to DECLINED status
        await prisma.loanSignatory.updateMany({
          where: { loanId: loan.id, status: 'PENDING' },
          data: { status: 'DECLINED' }
        });

        // Add audit trail entry
        await prisma.loanApplicationHistory.create({
          data: {
            applicationId: loan.applicationId,
            previousStatus: loan.application.status,
            newStatus: 'AGREEMENT_DECLINED',
            changedBy: 'SYSTEM_DOCUSEAL',
            changeReason: 'Document signing declined by borrower',
            notes: `Loan agreement signing declined. DocuSeal Submission ID: ${submissionId}`,
            metadata: {
              docusealSubmissionId: submissionId,
              declinedAt: new Date().toISOString(),
              submissionData: submissionData
            }
          }
        });

        console.log(`Loan agreement declined for loan ${loan.id} with audit trail`);
      }
    } catch (error) {
      console.error('Failed to handle submission declined:', error);
    }
  }

  /**
   * Configure webhook endpoint for DocuSeal to send events
   */
  async configureWebhook(webhookUrl: string): Promise<any> {
    try {
      console.log(`Configuring DocuSeal webhook URL: ${webhookUrl}`);
      
      const response = await axios.post(
        `${this.config.apiUrl}/webhooks`,
        {
          url: webhookUrl,
          events: ['form.completed', 'submission.completed', 'submission.expired', 'submission.declined']
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`Webhook configured successfully:`, response.data);
      return response.data;

    } catch (error) {
      console.error(`Failed to configure webhook:`, error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
      }
      throw new Error(`Failed to configure webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get existing webhook configurations
   */
  async getWebhooks(): Promise<any> {
    try {
      console.log(`Getting DocuSeal webhook configurations`);
      
      const response = await axios.get(
        `${this.config.apiUrl}/webhooks`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`Webhook configurations:`, response.data);
      return response.data;

    } catch (error) {
      console.error(`Failed to get webhooks:`, error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
      }
      throw new Error(`Failed to get webhooks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download signed document PDF from DocuSeal
   */
  /**
   * Get DocuSeal download URL for signed document
   * Returns the URL that can be opened in a new tab to access DocuSeal's download interface
   */
  async getSignedDocumentDownloadUrl(submissionId: string): Promise<string> {
    try {
      console.log(`Getting download URL for submission: ${submissionId}`);
      
      // Find the loan in our database using the submission ID
      const loan = await prisma.loan.findFirst({
        where: { docusealSubmissionId: submissionId },
        include: { application: true }
      });
      
      if (!loan) {
        throw new Error(`No loan found for submission ID ${submissionId}`);
      }
      
      // Check if we have the slug stored in the legacy field for backward compatibility
      if (loan.docusealSignUrl) {
        const downloadUrl = `${this.config.baseUrl}/s/${loan.docusealSignUrl}`;
        console.log(`Using stored slug from loan table to create download URL: ${downloadUrl}`);
        return downloadUrl;
      }

      // Fall back to loan_signatories table if legacy field is not available
      const userSignatory = await prisma.loanSignatory.findFirst({
        where: { 
          loanId: loan.id,
          signatoryType: 'USER',
          status: 'SIGNED'
        }
      });

      if (userSignatory?.slug) {
        const downloadUrl = `${this.config.baseUrl}/s/${userSignatory.slug}`;
        console.log(`Using slug from loan_signatories table to create download URL: ${downloadUrl}`);
        return downloadUrl;
      }
      
      // If no slug found in either place, try to get it from DocuSeal API
      try {
        const submissionResponse = await this.axiosInstance.get(`/api/submissions/${submissionId}`);
        const submissionData = submissionResponse.data;
        
        if (submissionData && submissionData.submitters) {
          // Find any submitter with a slug (preferably the borrower)
          const submitterWithSlug = submissionData.submitters.find((s: any) => s.slug) || 
                                   submissionData.submitters[0];
          
          if (submitterWithSlug && submitterWithSlug.slug) {
            const downloadUrl = `${this.config.baseUrl}/s/${submitterWithSlug.slug}`;
            console.log(`Retrieved slug from API, created download URL: ${downloadUrl}`);
            
            // Update the loan record with the slug for future use (backward compatibility)
            await prisma.loan.update({
              where: { id: loan.id },
              data: { docusealSignUrl: submitterWithSlug.slug }
            });
            
            return downloadUrl;
          }
        }
      } catch (error) {
        console.warn(`Failed to retrieve slug from DocuSeal API:`, error);
      }
      
      throw new Error(`Unable to generate download URL for submission ${submissionId}. No slug available.`);

    } catch (error) {
      console.error(`Failed to get download URL for submission ${submissionId}:`, error);
      throw new Error(`Failed to get download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Legacy method - kept for backward compatibility but now returns download URL instead of buffer
   * @deprecated Use getSignedDocumentDownloadUrl instead
   */
  async downloadSignedDocument(_submissionId: string): Promise<Buffer> {
    // For backward compatibility, we'll throw an error directing to use the new method
    throw new Error(`Direct document download is no longer supported. Use getSignedDocumentDownloadUrl() to get the DocuSeal download interface URL instead.`);
  }

  /**
   * Create signatory records for individual signature tracking
   */
  private async createSignatoryRecords(loanId: string, submitters: any[]): Promise<void> {
    try {
      console.log(`Creating signatory records for loan ${loanId}`);
      
      for (const submitter of submitters) {
        const signatoryType = this.mapRoleToSignatoryType(submitter.role);
        const signingSlug = submitter.slug;
        const signingUrl = submitter.embed_src || submitter.sign_url || 
          (submitter.slug ? `${this.config.baseUrl}/s/${submitter.slug}` : null);

        // Check if signatory already exists
        const existingSignatory = await prisma.loanSignatory.findUnique({
          where: {
            loanId_signatoryType: {
              loanId,
              signatoryType
            }
          }
        });

        if (!existingSignatory) {
          await prisma.loanSignatory.create({
            data: {
              loanId,
              signatoryType,
              name: submitter.name,
              email: submitter.email,
              role: submitter.role,
              status: 'PENDING',
              docusealSubmitterId: submitter.id?.toString(),
              docusealUuid: submitter.uuid,
              signingUrl,
              signingSlug,
              slug: submitter.slug
            }
          });
          console.log(`Created signatory record for ${signatoryType} (${submitter.name})`);
        } else {
          // Update existing record with latest URLs and info
          await prisma.loanSignatory.update({
            where: { id: existingSignatory.id },
            data: {
              signingUrl,
              signingSlug,
              slug: submitter.slug,
              docusealSubmitterId: submitter.id?.toString(),
              docusealUuid: submitter.uuid
            }
          });
          console.log(`Updated signatory record for ${signatoryType} (${submitter.name})`);
        }
      }
    } catch (error) {
      console.error('Failed to create signatory records:', error);
      throw error;
    }
  }

  /**
   * Update signatory status when they complete signing
   */
  private async updateSignatoryStatus(
    loanId: string, 
    role: string, 
    status: string, 
    signedAt: Date, 
    _submissionData?: any
  ): Promise<void> {
    try {
      const signatoryType = this.mapRoleToSignatoryType(role);
      
      await prisma.loanSignatory.updateMany({
        where: {
          loanId,
          signatoryType
        },
        data: {
          status,
          signedAt
        }
      });
      
      console.log(`Updated signatory status for ${signatoryType} to ${status}`);
    } catch (error) {
      console.error('Failed to update signatory status:', error);
      throw error;
    }
  }

  /**
   * Map DocuSeal role to our signatory type
   */
  private mapRoleToSignatoryType(role: string): string {
    switch (role.toLowerCase()) {
      case 'borrower':
        return 'USER';
      case 'company':
        return 'COMPANY';
      case 'witness':
        return 'WITNESS';
      default:
        return 'USER'; // Default fallback
    }
  }

  /**
   * Calculate the overall agreement status based on individual signatory statuses
   */
  async calculateAgreementStatus(loanId: string): Promise<string> {
    try {
      const signatories = await prisma.loanSignatory.findMany({
        where: { loanId }
      });

      if (signatories.length === 0) {
        return 'PENDING_SIGNATURE';
      }

      const statusCounts = signatories.reduce((counts, signatory) => {
        counts[signatory.status] = (counts[signatory.status] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      // If any signature is declined or expired, mark the whole agreement as such
      if (statusCounts['DECLINED'] > 0) {
        return 'SIGNATURE_DECLINED';
      }
      if (statusCounts['EXPIRED'] > 0) {
        return 'SIGNATURE_EXPIRED';
      }

      // If all signatories have signed, mark as SIGNED
      if (statusCounts['SIGNED'] === signatories.length) {
        return 'SIGNED';
      }

      // If some have signed, show the most recent completion
      if (statusCounts['SIGNED'] > 0) {
        // Check which parties have signed to give specific status
        const signedTypes = signatories
          .filter(s => s.status === 'SIGNED')
          .map(s => s.signatoryType);
        
        if (signedTypes.includes('COMPANY') && signedTypes.includes('USER') && signedTypes.includes('WITNESS')) {
          return 'SIGNED';
        } else if (signedTypes.includes('COMPANY')) {
          return 'COMPANY_SIGNED';
        } else if (signedTypes.includes('USER')) {
          return 'BORROWER_SIGNED';
        } else if (signedTypes.includes('WITNESS')) {
          return 'WITNESS_SIGNED';
        }
      }

      // Default to pending signature
      return 'PENDING_SIGNATURE';
    } catch (error) {
      console.error('Failed to calculate agreement status:', error);
      return 'PENDING_SIGNATURE';
    }
  }

  /**
   * Get signature status for a loan
   */
  async getSignatureStatus(loanId: string): Promise<any[]> {
    try {
      const signatories = await prisma.loanSignatory.findMany({
        where: { loanId },
        orderBy: {
          signatoryType: 'asc'
        }
      });

      const signatures = signatories.map(signatory => {
        const canSign = (
          (signatory.status === 'PENDING' && (signatory.signingSlug || signatory.signingUrl)) ||
          signatory.status === 'PENDING_PKI_SIGNING'
        );
        
        console.log(`📋 Signatory ${signatory.signatoryType}: status=${signatory.status}, canSign=${canSign}, hasSigningUrl=${!!(signatory.signingSlug || signatory.signingUrl)}`);
        
        return {
          id: signatory.id,
          type: signatory.signatoryType,
          name: signatory.name,
          email: signatory.email,
          role: signatory.role,
          status: signatory.status,
          signedAt: signatory.signedAt,
          signingUrl: this.generateSigningUrl(signatory.signingSlug || signatory.signingUrl),
          canSign
        };
      });
      
      return signatures;
    } catch (error) {
      console.error('Failed to get signature status:', error);
      throw error;
    }
  }

  /**
   * Generate signing URL from slug or return existing URL
   * @param slugOrUrl - Either a DocuSeal slug or full URL
   * @returns Full signing URL
   */
  private generateSigningUrl(slugOrUrl: string | null): string | null {
    if (!slugOrUrl) return null;
    
    // If it's already a full URL, return as is
    if (slugOrUrl.startsWith('http://') || slugOrUrl.startsWith('https://')) {
      return slugOrUrl;
    }
    
    // If it's just a slug, generate the full URL using current config
    return `${this.config.baseUrl}/s/${slugOrUrl}`;
  }
}

export const docusealService = new DocuSealService();
