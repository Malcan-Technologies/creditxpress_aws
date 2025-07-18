import axios from 'axios';

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
	async sendOTP({ to, otp }: WhatsAppOTPRequest): Promise<WhatsAppResponse> {
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
		return this.sendUtilityNotification({
			to,
			templateName: 'payment_approved',
			parameters: [fullName, paymentAmount, loanName, nextPaymentAmount, nextDueDate, completedPayments, totalPayments]
		});
	}
}

export default new WhatsAppService(); 