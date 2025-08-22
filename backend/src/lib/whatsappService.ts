import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WHATSAPP_API_URL = 'https://graph.facebook.com/v22.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const USE_OTP_TEMPLATE = process.env.WHATSAPP_USE_OTP_TEMPLATE === 'true';

interface WhatsAppOTPRequest {
	to: string;
	otp: string;
}

interface WhatsAppUtilityRequest {
	to: string;
	templateName: string;
	language?: string;
	parameters: string[];
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

	async sendUtilityNotification({ to, templateName, language = 'en', parameters }: WhatsAppUtilityRequest): Promise<WhatsAppResponse> {
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
					components: [
						{
							type: 'body',
							parameters: templateParameters
						}
					]
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
		totalPayments
	}: {
		to: string;
		fullName: string;
		paymentAmount: string;
		loanName: string;
		nextPaymentAmount: string;
		nextDueDate: string;
		completedPayments: string;
		totalPayments: string;
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

		return this.sendUtilityNotification({
			to,
			templateName: 'payment_approved',
			parameters: [fullName, paymentAmount, loanName, nextPaymentAmount, nextDueDate, completedPayments, totalPayments]
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
}

export default new WhatsAppService(); 