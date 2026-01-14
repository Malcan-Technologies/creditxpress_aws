import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { whatsappConfig } from './config';

const prisma = new PrismaClient();

const WHATSAPP_API_URL = 'https://graph.facebook.com/v22.0';
const WHATSAPP_ACCESS_TOKEN = whatsappConfig.accessToken;
const WHATSAPP_PHONE_NUMBER_ID = whatsappConfig.phoneNumberId;
const USE_OTP_TEMPLATE = whatsappConfig.useOtpTemplate;

interface WhatsAppOTPRequest {
	to: string;
	otp: string;
}

interface WhatsAppUtilityRequest {
	to: string;
	templateName: string;
	language?: string;
	parameters: string[];
	buttonUrl?: string;
}

interface WhatsAppResponse {
	success: boolean;
	messageId?: string;
	error?: string;
}

class WhatsAppService {
	// Check if a specific WhatsApp notification type is enabled
	private async isNotificationEnabled(settingKey: string): Promise<boolean> {
		try {
			const setting = await prisma.systemSettings.findUnique({
				where: { key: settingKey }
			});
			
			if (!setting || !setting.isActive) {
				return false;
			}
			
			return JSON.parse(setting.value) === true;
		} catch (error) {
			console.error(`Error checking notification setting ${settingKey}:`, error);
			return false; // Default to disabled if there's an error
		}
	}

	// Check if WhatsApp notifications are enabled globally
	private async isWhatsAppEnabled(): Promise<boolean> {
		return this.isNotificationEnabled('ENABLE_WHATSAPP_NOTIFICATIONS');
	}
	async sendOTP({ to, otp }: WhatsAppOTPRequest): Promise<WhatsAppResponse> {
		try {
			// Check if WhatsApp notifications are enabled globally
			// OTP is mandatory for security, so we only check global setting
			const isGlobalEnabled = await this.isWhatsAppEnabled();
			
			if (!isGlobalEnabled) {
				console.log('WhatsApp notifications are globally disabled');
				return {
					success: false,
					error: 'WhatsApp notifications are globally disabled'
				};
			}

			if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
				console.error('WhatsApp credentials not configured');
				return {
					success: false,
					error: 'WhatsApp service not configured'
				};
			}

			// Remove any '+' prefix from phone number for WhatsApp API
			const cleanPhoneNumber = to.replace(/^\+/, '');

			const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

			let payload;

			if (USE_OTP_TEMPLATE) {
				// Use authentication template format as per Facebook documentation
				payload = {
					messaging_product: 'whatsapp',
					recipient_type: 'individual',
					to: cleanPhoneNumber,
					type: 'template',
					template: {
						name: 'otp_verification',
						language: {
							code: 'en'
						},
						components: [
							{
								type: 'body',
								parameters: [
									{
										type: 'text',
										text: otp
									}
								]
							},
							{
								type: 'button',
								sub_type: 'url',
								index: '0',
								parameters: [
									{
										type: 'text',
										text: otp
									}
								]
							}
						]
					}
				};
			} else {
				// Fallback to hello_world template for testing
				payload = {
					messaging_product: 'whatsapp',
					recipient_type: 'individual',
					to: cleanPhoneNumber,
					type: 'template',
					template: {
						name: 'hello_world',
						language: {
							code: 'en_US'
						}
					}
				};
			}

			console.log('Sending WhatsApp OTP:', JSON.stringify(payload, null, 2));

			const response = await axios.post(url, payload, {
				headers: {
					'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
					'Content-Type': 'application/json'
				}
			});

			console.log('WhatsApp OTP API response:', response.data);

			if (response.data.messages && response.data.messages[0]) {
				return {
					success: true,
					messageId: response.data.messages[0].id
				};
			}

			return {
				success: false,
				error: 'No message ID returned'
			};

		} catch (error: any) {
			console.error('WhatsApp OTP API error:', error.response?.data || error.message);
			return {
				success: false,
				error: error.response?.data?.error?.message || error.message || 'Unknown error'
			};
		}
	}

	async sendUtilityNotification({ to, templateName, language = 'en', parameters, buttonUrl }: WhatsAppUtilityRequest): Promise<WhatsAppResponse> {
		try {
			if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
				console.error('WhatsApp credentials not configured');
				return {
					success: false,
					error: 'WhatsApp service not configured'
				};
			}

			// Remove any '+' prefix from phone number for WhatsApp API
			const cleanPhoneNumber = to.replace(/^\+/, '');

			const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

			// Build parameters array for utility template
			const templateParameters = parameters.map(param => ({
				type: 'text',
				text: param
			}));

			// Build template components
			const components = [
				{
					type: 'body',
					parameters: templateParameters
				}
			];

			// Add button component if URL is provided
			if (buttonUrl) {
				console.log(`🔗 Adding button component with URL: ${buttonUrl}`);
				(components as any).push({
					type: 'button',
					sub_type: 'url',
					index: 0,
					parameters: [
						{
							type: 'text',
							text: buttonUrl
						}
					]
				});
			} else {
				console.log(`🔗 No button URL provided for template: ${templateName}`);
			}

			const payload = {
				messaging_product: 'whatsapp',
				recipient_type: 'individual',
				to: cleanPhoneNumber,
				type: 'template',
				template: {
					name: templateName,
					language: {
						code: language
					},
					components: components
				}
			};

			console.log(`Sending WhatsApp utility notification (${templateName}):`, JSON.stringify(payload, null, 2));

			const response = await axios.post(url, payload, {
				headers: {
					'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
					'Content-Type': 'application/json'
				}
			});

			console.log('WhatsApp utility API response:', response.data);

			if (response.data.messages && response.data.messages[0]) {
				return {
					success: true,
					messageId: response.data.messages[0].id
				};
			}

			return {
				success: false,
				error: 'No message ID returned'
			};

		} catch (error: any) {
			console.error('WhatsApp utility API error:', error.response?.data || error.message);
			return {
				success: false,
				error: error.response?.data?.error?.message || error.message || 'Unknown error'
			};
		}
	}

	// Specific method for loan disbursement notifications
	async sendLoanDisbursementNotification({
		to,
		fullName,
		amount,
		productName,
		firstRepaymentDate
	}: {
		to: string;
		fullName: string;
		amount: string;
		productName: string;
		firstRepaymentDate: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp loan disbursement notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isDisbursementEnabled = await this.isNotificationEnabled('WHATSAPP_LOAN_DISBURSEMENT');
		
		if (!isGlobalEnabled || !isDisbursementEnabled) {
			console.log('WhatsApp loan disbursement notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp loan disbursement notifications are disabled'
			};
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'loan_disburse',
			parameters: [fullName, amount, productName, firstRepaymentDate]
		});
	}

	// Specific method for loan application submission notifications
	async sendLoanApplicationSubmissionNotification({
		to,
		fullName,
		productName,
		amount
	}: {
		to: string;
		fullName: string;
		productName: string;
		amount: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp loan application submission notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isSubmissionEnabled = await this.isNotificationEnabled('WHATSAPP_LOAN_APPLICATION_SUBMISSION');
		
		if (!isGlobalEnabled || !isSubmissionEnabled) {
			console.log('WhatsApp loan application submission notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp loan application submission notifications are disabled'
			};
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'loan_application_submission',
			parameters: [fullName, productName, amount]
		});
	}

	// Specific method for attestation complete notifications
	async sendAttestationCompleteNotification({
		to,
		fullName,
		productName,
		amount
	}: {
		to: string;
		fullName: string;
		productName: string;
		amount: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp attestation complete notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isAttestationCompleteEnabled = await this.isNotificationEnabled('WHATSAPP_ATTESTATION_COMPLETE');
		
		if (!isGlobalEnabled || !isAttestationCompleteEnabled) {
			console.log('WhatsApp attestation complete notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp attestation complete notifications are disabled'
			};
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'attestation_complete',
			parameters: [fullName, productName, amount]
		});
	}

	// Specific method for borrower PKI signing complete notifications
	async sendBorrowerSigningCompleteNotification({
		to,
		fullName,
		productName,
		amount,
		email
	}: {
		to: string;
		fullName: string;
		productName: string;
		amount: string;
		email: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp borrower signing complete notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isSigningCompleteEnabled = await this.isNotificationEnabled('WHATSAPP_BORROWER_SIGNING_COMPLETE');
		
		if (!isGlobalEnabled || !isSigningCompleteEnabled) {
			console.log('WhatsApp borrower signing complete notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp borrower signing complete notifications are disabled'
			};
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'complete_signing_user',
			parameters: [fullName, productName, amount, email]
		});
	}

	// Specific method for all parties PKI signing complete notifications
	async sendAllPartiesSigningCompleteNotification({
		to,
		fullName,
		productName,
		amount,
		email
	}: {
		to: string;
		fullName: string;
		productName: string;
		amount: string;
		email: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp all parties signing complete notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isAllPartiesSigningEnabled = await this.isNotificationEnabled('WHATSAPP_ALL_PARTIES_SIGNING_COMPLETE');
		
		if (!isGlobalEnabled || !isAllPartiesSigningEnabled) {
			console.log('WhatsApp all parties signing complete notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp all parties signing complete notifications are disabled'
			};
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'complete_signing_all',
			parameters: [fullName, productName, amount, email]
		});
	}

	// Specific method for stamping completed notifications
	async sendStampingCompletedNotification({
		to,
		fullName,
		productName,
		amount
	}: {
		to: string;
		fullName: string;
		productName: string;
		amount: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp stamping completed notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isStampingCompletedEnabled = await this.isNotificationEnabled('WHATSAPP_STAMPING_COMPLETED');
		
		if (!isGlobalEnabled || !isStampingCompletedEnabled) {
			console.log('WhatsApp stamping completed notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp stamping completed notifications are disabled'
			};
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'stamping_completed',
			parameters: [fullName, productName, amount]
		});
	}

	// Specific method for loan approval notifications
	async sendLoanApprovalNotification({
		to,
		fullName,
		productName,
		amount
	}: {
		to: string;
		fullName: string;
		productName: string;
		amount: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp loan approval notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isApprovalEnabled = await this.isNotificationEnabled('WHATSAPP_LOAN_APPROVAL');
		
		if (!isGlobalEnabled || !isApprovalEnabled) {
			console.log('WhatsApp loan approval notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp loan approval notifications are disabled'
			};
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'loan_approved',
			parameters: [fullName, productName, amount]
		});
	}

	// Specific method for loan rejection notifications
	async sendLoanRejectionNotification({
		to,
		fullName,
		productName
	}: {
		to: string;
		fullName: string;
		productName: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp loan rejection notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isRejectionEnabled = await this.isNotificationEnabled('WHATSAPP_LOAN_REJECTION');
		
		if (!isGlobalEnabled || !isRejectionEnabled) {
			console.log('WhatsApp loan rejection notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp loan rejection notifications are disabled'
			};
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'loan_rejected',
			parameters: [fullName, productName]
		});
	}

	// Specific method for payment approved notifications
	async sendPaymentApprovedNotification({
		to,
		fullName,
		paymentAmount,
		loanName,
		nextPaymentAmount,
		nextDueDate,
		completedPayments,
		totalPayments,
		receiptUrl
	}: {
		to: string;
		fullName: string;
		paymentAmount: string;
		loanName: string;
		nextPaymentAmount: string;
		nextDueDate: string;
		completedPayments: string;
		totalPayments: string;
		receiptUrl?: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp payment approved notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isPaymentEnabled = await this.isNotificationEnabled('WHATSAPP_PAYMENT_APPROVED');
		
		if (!isGlobalEnabled || !isPaymentEnabled) {
			console.log('WhatsApp payment approved notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp payment approved notifications are disabled'
			};
		}

		// Build parameters array (exactly 7 text parameters for the message body)
		// URL button parameter is handled separately by buttonUrl
		const parameters = [fullName, paymentAmount, loanName, nextPaymentAmount, nextDueDate, completedPayments, totalPayments];

		console.log(`🔗 WhatsApp Payment Approved Notification - Receipt URL: ${receiptUrl || 'NOT PROVIDED'}`);
		console.log(`🔗 Body parameters being sent: ${parameters.length}`, parameters);

		return this.sendUtilityNotification({
			to,
			templateName: 'payment_approved',
			parameters: parameters,
			buttonUrl: receiptUrl // Pass receipt URL as button parameter
		});
	}

	// Specific method for revised loan offer notifications
	async sendRevisedLoanOfferNotification({
		to,
		fullName
	}: {
		to: string;
		fullName: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp revised loan offer notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isRevisedOfferEnabled = await this.isNotificationEnabled('WHATSAPP_LOAN_REVISED_OFFER');
		
		if (!isGlobalEnabled || !isRevisedOfferEnabled) {
			console.log('WhatsApp revised loan offer notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp revised loan offer notifications are disabled'
			};
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'loan_revised_offer',
			parameters: [fullName]
		});
	}

	// Specific method for payment failed notifications
	async sendPaymentFailedNotification({
		to,
		fullName,
		paymentAmount,
		loanName
	}: {
		to: string;
		fullName: string;
		paymentAmount: string;
		loanName: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp payment failed notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isPaymentFailedEnabled = await this.isNotificationEnabled('WHATSAPP_PAYMENT_FAILED');
		
		if (!isGlobalEnabled || !isPaymentFailedEnabled) {
			console.log('WhatsApp payment failed notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp payment failed notifications are disabled'
			};
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'payment_failed',
			parameters: [fullName, paymentAmount, loanName]
		});
	}

	// Specific method for loan discharged notifications
	async sendLoanDischargedNotification({
		to,
		fullName,
		loanName
	}: {
		to: string;
		fullName: string;
		loanName: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp loan discharged notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isLoanDischargedEnabled = await this.isNotificationEnabled('WHATSAPP_LOAN_DISCHARGED');
		
		if (!isGlobalEnabled || !isLoanDischargedEnabled) {
			console.log('WhatsApp loan discharged notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp loan discharged notifications are disabled'
			};
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'loan_discharged',
			parameters: [fullName, loanName]
		});
	}

	// Specific method for upcoming payment notifications
	async sendUpcomingPaymentNotification({
		to,
		fullName,
		paymentAmount,
		loanName,
		daysUntilDue,
		dueDate
	}: {
		to: string;
		fullName: string;
		paymentAmount: string;
		loanName: string;
		daysUntilDue: string;
		dueDate: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp upcoming payment notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isUpcomingPaymentEnabled = await this.isNotificationEnabled('WHATSAPP_UPCOMING_PAYMENT');
		
		if (!isGlobalEnabled || !isUpcomingPaymentEnabled) {
			console.log('WhatsApp upcoming payment notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp upcoming payment notifications are disabled'
			};
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'upcoming_payment',
			parameters: [fullName, paymentAmount, loanName, daysUntilDue, dueDate]
		});
	}

	// Specific method for late payment notifications
	async sendLatePaymentNotification({
		to,
		fullName,
		paymentAmount,
		loanName
	}: {
		to: string;
		fullName: string;
		paymentAmount: string;
		loanName: string;
	}): Promise<WhatsAppResponse> {
		// Check if WhatsApp late payment notifications are enabled
		const isGlobalEnabled = await this.isWhatsAppEnabled();
		const isLatePaymentEnabled = await this.isNotificationEnabled('WHATSAPP_LATE_PAYMENT');
		
		if (!isGlobalEnabled || !isLatePaymentEnabled) {
			console.log('WhatsApp late payment notifications are disabled');
			return {
				success: false,
				error: 'WhatsApp late payment notifications are disabled'
			};
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'late_payment',
			parameters: [fullName, paymentAmount, loanName]
		});
	}
	// Early Settlement Approved Notification
	async sendEarlySettlementApproved(
		to: string,
		fullName: string,
		settlementAmount: number
	): Promise<WhatsAppResponse> {
		const isEnabled = await this.isNotificationEnabled('WHATSAPP_EARLY_SETTLEMENT_APPROVED');
		if (!isEnabled) {
			console.log('Early settlement approved WhatsApp notifications are disabled');
			return { success: false, error: 'Notifications disabled' };
		}

		const formattedAmount = `RM ${settlementAmount.toFixed(2)}`;

		return this.sendUtilityNotification({
			to,
			templateName: 'early_settlement_approved',
			parameters: [fullName, formattedAmount]
		});
	}

	// Early Settlement Rejected Notification
	async sendEarlySettlementRejected(
		to: string,
		fullName: string,
		rejectionReason: string
	): Promise<WhatsAppResponse> {
		const isEnabled = await this.isNotificationEnabled('WHATSAPP_EARLY_SETTLEMENT_REJECTED');
		if (!isEnabled) {
			console.log('Early settlement rejected WhatsApp notifications are disabled');
			return { success: false, error: 'Notifications disabled' };
		}

		return this.sendUtilityNotification({
			to,
			templateName: 'early_settlement_rejected',
			parameters: [fullName, rejectionReason]
		});
	}

	// Default Risk Notification (28 days overdue)
	async sendDefaultRiskNotification(
		to: string,
		data: {
			borrowerName: string;
			productName: string;
			daysOverdue: number;
			outstandingAmount: number;
			remedyDays: number;
		}
	): Promise<WhatsAppResponse> {
		const isEnabled = await this.isNotificationEnabled('WHATSAPP_DEFAULT_RISK');
		if (!isEnabled) {
			console.log('Default risk WhatsApp notifications are disabled');
			return { success: false, error: 'Notifications disabled' };
		}

		const formattedAmount = `RM ${data.outstandingAmount.toFixed(2)}`;
		const remedyDeadline = new Date();
		remedyDeadline.setDate(remedyDeadline.getDate() + data.remedyDays);
		const formattedDeadline = remedyDeadline.toLocaleDateString('en-MY', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

		return this.sendUtilityNotification({
			to,
			templateName: 'loan_default_risk',
			parameters: [
				data.borrowerName,
				data.productName,
				data.daysOverdue.toString(),
				formattedAmount,
				data.remedyDays.toString(),
				formattedDeadline
			]
		});
	}

	// Default Reminder Notification (during remedy period)
	async sendDefaultReminderNotification(
		to: string,
		data: {
			borrowerName: string;
			productName: string;
			outstandingAmount: number;
			daysRemaining: number;
			remedyDeadline: Date;
		}
	): Promise<WhatsAppResponse> {
		const isEnabled = await this.isNotificationEnabled('WHATSAPP_DEFAULT_REMINDER');
		if (!isEnabled) {
			console.log('Default reminder WhatsApp notifications are disabled');
			return { success: false, error: 'Notifications disabled' };
		}

		const formattedAmount = `RM ${data.outstandingAmount.toFixed(2)}`;
		const formattedDeadline = data.remedyDeadline.toLocaleDateString('en-MY', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

		return this.sendUtilityNotification({
			to,
			templateName: 'loan_default_reminder',
			parameters: [
				data.borrowerName,
				data.daysRemaining.toString(),
				formattedAmount,
				formattedDeadline
			]
		});
	}

	// Default Final Notification (loan defaulted)
	async sendDefaultFinalNotification(
		to: string,
		data: {
			borrowerName: string;
			productName: string;
			outstandingAmount: number;
		}
	): Promise<WhatsAppResponse> {
		const isEnabled = await this.isNotificationEnabled('WHATSAPP_DEFAULT_FINAL');
		if (!isEnabled) {
			console.log('Default final WhatsApp notifications are disabled');
			return { success: false, error: 'Notifications disabled' };
		}

		const formattedAmount = `RM ${data.outstandingAmount.toFixed(2)}`;

		return this.sendUtilityNotification({
			to,
			templateName: 'loan_default_final',
			parameters: [
				data.borrowerName,
				data.productName,
				formattedAmount
			]
		});
	}
}

const whatsappService = new WhatsAppService();

// Export individual functions for use in other modules
export const sendDefaultRiskMessage = (phoneNumber: string, data: {
	borrowerName: string;
	productName: string;
	daysOverdue: number;
	outstandingAmount: number;
	remedyDays: number;
}) => whatsappService.sendDefaultRiskNotification(phoneNumber, data).then(result => result.messageId || null);

export const sendDefaultReminderMessage = (phoneNumber: string, data: {
	borrowerName: string;
	productName: string;
	outstandingAmount: number;
	daysRemaining: number;
	remedyDeadline: Date;
}) => whatsappService.sendDefaultReminderNotification(phoneNumber, data).then(result => result.messageId || null);

export const sendDefaultFinalMessage = (phoneNumber: string, data: {
	borrowerName: string;
	productName: string;
	outstandingAmount: number;
}) => whatsappService.sendDefaultFinalNotification(phoneNumber, data).then(result => result.messageId || null);

export default whatsappService; 