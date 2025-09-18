import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Define styles for the PDF
const styles = StyleSheet.create({
	page: {
		flexDirection: 'column',
		backgroundColor: '#FFFFFF',
		padding: 30,
		fontFamily: 'Helvetica',
		fontSize: 10,
		lineHeight: 1.4,
	},
	header: {
		marginBottom: 20,
		borderBottomWidth: 2,
		borderBottomColor: '#7C3AED',
		paddingBottom: 10,
		textAlign: 'center',
	},
	companyName: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#7C3AED',
		marginBottom: 5,
	},
	companyAddress: {
		fontSize: 9,
		color: '#666666',
		marginBottom: 2,
	},
	companyInfo: {
		fontSize: 8,
		color: '#666666',
	},
	dateSection: {
		textAlign: 'right',
		marginBottom: 20,
		fontSize: 10,
	},
	addressSection: {
		marginBottom: 20,
	},
	addressText: {
		fontSize: 10,
		marginBottom: 2,
	},
	letterTitle: {
		fontSize: 14,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 5,
		color: '#1F2937',
		textTransform: 'uppercase',
	},
	letterSubtitle: {
		fontSize: 12,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 20,
		color: '#374151',
	},
	salutation: {
		fontSize: 10,
		marginBottom: 15,
	},
	paragraph: {
		fontSize: 10,
		marginBottom: 12,
		textAlign: 'justify',
	},
	sectionTitle: {
		fontSize: 10,
		fontWeight: 'bold',
		marginBottom: 8,
		marginTop: 15,
		textDecoration: 'underline',
	},
	detailsBox: {
		backgroundColor: '#F9FAFB',
		padding: 12,
		marginBottom: 15,
		borderRadius: 4,
		border: '1px solid #E5E7EB',
	},
	detailRow: {
		flexDirection: 'row',
		marginBottom: 3,
	},
	detailLabel: {
		fontSize: 9,
		color: '#6B7280',
		width: 120,
	},
	detailValue: {
		fontSize: 9,
		color: '#1F2937',
		fontWeight: 'bold',
		flex: 1,
	},
	totalAmount: {
		fontSize: 11,
		fontWeight: 'bold',
		color: '#DC2626',
		marginTop: 5,
	},
	bulletPoint: {
		fontSize: 10,
		marginBottom: 5,
		marginLeft: 10,
	},
	numberedPoint: {
		fontSize: 10,
		marginBottom: 5,
		marginLeft: 15,
	},
	warningBox: {
		backgroundColor: '#FEF3C7',
		padding: 12,
		marginVertical: 15,
		borderRadius: 4,
		border: '1px solid #F59E0B',
	},
	warningText: {
		fontSize: 10,
		color: '#92400E',
		fontWeight: 'bold',
	},
	urgentBox: {
		backgroundColor: '#FEE2E2',
		padding: 12,
		marginVertical: 15,
		borderRadius: 4,
		border: '1px solid #DC2626',
	},
	urgentText: {
		fontSize: 10,
		color: '#991B1B',
		fontWeight: 'bold',
	},
	contactInfo: {
		backgroundColor: '#EFF6FF',
		padding: 12,
		marginVertical: 15,
		borderRadius: 4,
		border: '1px solid #3B82F6',
	},
	contactText: {
		fontSize: 10,
		color: '#1E40AF',
		marginBottom: 3,
	},
	closing: {
		marginTop: 25,
		marginBottom: 15,
	},
	signature: {
		marginTop: 30,
		marginBottom: 5,
	},
	signatureLine: {
		borderBottomWidth: 1,
		borderBottomColor: '#000000',
		width: 200,
		marginBottom: 5,
	},
	signatureText: {
		fontSize: 9,
		color: '#374151',
	},
	footer: {
		marginTop: 30,
		paddingTop: 15,
		borderTopWidth: 1,
		borderTopColor: '#E5E7EB',
		textAlign: 'center',
	},
	footerText: {
		fontSize: 8,
		color: '#6B7280',
		marginBottom: 2,
	},
});

export interface DefaultLetterData {
	letterType: 'DEFAULT_RISK' | 'MANUAL_DEFAULT';
	letterNumber: string;
	date: string;
	borrowerName: string;
	borrowerAddress: string;
	borrowerIcNumber?: string;
	loanId: string;
	productName: string;
	daysOverdue: number;
	outstandingAmount: number;
	totalLateFees: number;
	totalAmountDue: number;
	remedyDeadline?: string;
	companySettings: {
		companyName: string;
		companyAddress: string;
		companyRegNo?: string;
		licenseNo?: string;
		contactPhone?: string;
		contactEmail?: string;
	};
}

interface DefaultLetterDocumentProps {
	data: DefaultLetterData;
}

const DefaultLetterDocument = ({ data }: DefaultLetterDocumentProps) => {
	const renderDefaultRiskContent = () => (
		<>
			<Text style={styles.salutation}>Dear {data.borrowerName},</Text>

			<Text style={styles.paragraph}>
				We are writing to inform you that your loan account is currently in default risk status due to overdue payments. 
				This letter serves as formal notice that immediate action is required to prevent your loan from being classified as defaulted.
			</Text>

			<Text style={styles.sectionTitle}>LOAN DETAILS</Text>
			<View style={styles.detailsBox}>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Product:</Text>
					<Text style={styles.detailValue}>{data.productName}</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Loan ID:</Text>
					<Text style={styles.detailValue}>{data.loanId}</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Days Overdue:</Text>
					<Text style={styles.detailValue}>{data.daysOverdue} days</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Outstanding Principal & Interest:</Text>
					<Text style={styles.detailValue}>RM {data.outstandingAmount.toFixed(2)}</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Outstanding Late Fees:</Text>
					<Text style={styles.detailValue}>RM {data.totalLateFees.toFixed(2)}</Text>
				</View>
				<View style={[styles.detailRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' }]}>
					<Text style={styles.detailLabel}>TOTAL AMOUNT DUE:</Text>
					<Text style={[styles.detailValue, styles.totalAmount]}>RM {data.totalAmountDue.toFixed(2)}</Text>
				</View>
			</View>

			{data.remedyDeadline && (
				<>
					<Text style={styles.sectionTitle}>REMEDY PERIOD</Text>
					<View style={styles.warningBox}>
						<Text style={styles.warningText}>
							You have until {data.remedyDeadline} to settle the outstanding amount to avoid your loan being classified as defaulted.
						</Text>
					</View>
				</>
			)}

			<Text style={styles.sectionTitle}>CONSEQUENCES OF DEFAULT</Text>
			<Text style={styles.bulletPoint}>• Your loan will be classified as defaulted</Text>
			<Text style={styles.bulletPoint}>• Additional recovery costs may be imposed</Text>
			<Text style={styles.bulletPoint}>• Your credit rating may be affected</Text>
			<Text style={styles.bulletPoint}>• Legal action may be commenced</Text>
			<Text style={styles.bulletPoint}>• Additional interest and charges may continue to accrue</Text>

			<Text style={styles.sectionTitle}>IMMEDIATE ACTION REQUIRED</Text>
			<View style={styles.urgentBox}>
				<Text style={styles.urgentText}>To avoid default classification, you must:</Text>
			</View>
			<Text style={styles.numberedPoint}>1. Pay the full outstanding amount immediately, OR</Text>
			<Text style={styles.numberedPoint}>2. Contact us immediately to discuss payment arrangements</Text>

			<Text style={styles.sectionTitle}>PAYMENT METHODS</Text>
			<Text style={styles.bulletPoint}>• Online banking transfer</Text>
			<Text style={styles.bulletPoint}>• Cash deposit at authorized agents</Text>
			<Text style={styles.bulletPoint}>• Contact our customer service for assistance</Text>

			{(data.companySettings.contactPhone || data.companySettings.contactEmail) && (
				<>
					<Text style={styles.sectionTitle}>CONTACT INFORMATION</Text>
					<View style={styles.contactInfo}>
						<Text style={styles.contactText}>For immediate assistance, please contact us:</Text>
						{data.companySettings.contactPhone && (
							<Text style={styles.contactText}>Phone: {data.companySettings.contactPhone}</Text>
						)}
						{data.companySettings.contactEmail && (
							<Text style={styles.contactText}>Email: {data.companySettings.contactEmail}</Text>
						)}
					</View>
				</>
			)}

			<Text style={styles.paragraph}>
				This notice is served upon you in accordance with the terms and conditions of your loan agreement. 
				Failure to take immediate action may result in the commencement of legal proceedings against you.
			</Text>
		</>
	);

	const renderManualDefaultContent = () => (
		<>
			<Text style={styles.salutation}>Dear {data.borrowerName},</Text>

			<Text style={styles.paragraph}>
				We are writing to inform you that your loan account is currently in default risk status due to overdue payments. This letter serves as formal notice that immediate action is required to prevent your loan from being classified as defaulted.
			</Text>

			<Text style={styles.sectionTitle}>LOAN ACCOUNT DETAILS</Text>
			<View style={styles.detailsBox}>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Product:</Text>
					<Text style={styles.detailValue}>{data.productName}</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Loan Account ID:</Text>
					<Text style={styles.detailValue}>{data.loanId}</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Days Overdue:</Text>
					<Text style={styles.detailValue}>{data.daysOverdue} days</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Outstanding Principal & Interest:</Text>
					<Text style={styles.detailValue}>RM {data.outstandingAmount.toFixed(2)}</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Late Fees Assessed:</Text>
					<Text style={styles.detailValue}>RM {data.totalLateFees.toFixed(2)}</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Total Amount Due:</Text>
					<Text style={[styles.detailValue, styles.totalAmount]}>RM {data.totalAmountDue.toFixed(2)}</Text>
				</View>
			</View>

			<Text style={styles.sectionTitle}>IMMEDIATE ACTION REQUIRED</Text>
			<Text style={styles.paragraph}>
				To avoid further consequences and prevent your loan from being classified as defaulted, you must take one of the following actions:
			</Text>
			<Text style={styles.bulletPoint}>
				• Pay the full outstanding amount of RM {data.totalAmountDue.toFixed(2)} immediately; OR
			</Text>
			<Text style={styles.bulletPoint}>
				• Contact our office immediately to arrange a payment plan or discuss alternative arrangements
			</Text>

			<Text style={styles.sectionTitle}>REMEDY PERIOD</Text>
			<View style={styles.warningBox}>
				<Text style={styles.warningText}>
					You have 16 days from the date of this letter to remedy this default situation.
					{data.remedyDeadline && ` The deadline is ${data.remedyDeadline}.`}
				</Text>
				<Text style={[styles.warningText, { marginTop: 8 }]}>
					Failure to take action by this date may result in your loan being classified as defaulted.
				</Text>
			</View>

			<Text style={styles.sectionTitle}>CONSEQUENCES OF DEFAULT</Text>
			<Text style={styles.paragraph}>
				If you fail to remedy this situation within the specified timeframe, the following consequences may apply:
			</Text>
			<Text style={styles.bulletPoint}>
				• Your loan will be classified as defaulted
			</Text>
			<Text style={styles.bulletPoint}>
				• Additional late fees and penalties may be imposed
			</Text>
			<Text style={styles.bulletPoint}>
				• Your credit rating may be adversely affected
			</Text>
			<Text style={styles.bulletPoint}>
				• We may commence legal action to recover the outstanding amount
			</Text>
			<Text style={styles.bulletPoint}>
				• Your information may be reported to credit bureaus and debt collection agencies
			</Text>

			<Text style={styles.sectionTitle}>CONTACT INFORMATION</Text>
			<Text style={styles.paragraph}>
				We encourage you to contact us immediately to discuss your options. Our team is available to work with you to find a suitable solution.
			</Text>
			
			{data.companySettings.contactPhone && (
				<Text style={styles.bulletPoint}>
					• Phone: {data.companySettings.contactPhone}
				</Text>
			)}
			{data.companySettings.contactEmail && (
				<Text style={styles.bulletPoint}>
					• Email: {data.companySettings.contactEmail}
				</Text>
			)}
			<Text style={styles.bulletPoint}>
				• Office Hours: Monday to Friday, 9:00 AM to 6:00 PM
			</Text>

			<Text style={styles.paragraph}>
				Please treat this matter with the utmost urgency. We are committed to working with you to resolve this situation, but prompt action on your part is essential.
			</Text>

		</>
	);

	return (
		<Document>
			<Page size="A4" style={styles.page}>
				{/* Header */}
				<View style={styles.header}>
					<Text style={styles.companyName}>{data.companySettings.companyName}</Text>
					<Text style={styles.companyAddress}>{data.companySettings.companyAddress}</Text>
					{(data.companySettings.companyRegNo || data.companySettings.licenseNo) && (
						<Text style={styles.companyInfo}>
							{data.companySettings.companyRegNo && `Registration No: ${data.companySettings.companyRegNo}`}
							{data.companySettings.companyRegNo && data.companySettings.licenseNo && ' | '}
							{data.companySettings.licenseNo && `License No: ${data.companySettings.licenseNo}`}
						</Text>
					)}
					{(data.companySettings.contactPhone || data.companySettings.contactEmail) && (
						<Text style={styles.companyInfo}>
							{data.companySettings.contactPhone && `Tel: ${data.companySettings.contactPhone}`}
							{data.companySettings.contactPhone && data.companySettings.contactEmail && ' | '}
							{data.companySettings.contactEmail && `Email: ${data.companySettings.contactEmail}`}
						</Text>
					)}
				</View>

				{/* Date */}
				<View style={styles.dateSection}>
					<Text>Date: {data.date}</Text>
					<Text>Letter No: {data.letterNumber}</Text>
				</View>

				{/* Borrower Address */}
				<View style={styles.addressSection}>
					<Text style={styles.addressText}>{data.borrowerName}</Text>
					{data.borrowerIcNumber && (
						<Text style={styles.addressText}>IC No: {data.borrowerIcNumber}</Text>
					)}
					<Text style={styles.addressText}>{data.borrowerAddress}</Text>
				</View>

				{/* Subject */}
				<Text style={styles.letterTitle}>
					{data.letterType === 'DEFAULT_RISK' 
						? 'NOTICE OF DEFAULT RISK - IMMEDIATE ACTION REQUIRED'
						: 'NOTICE OF DEFAULT - IMMEDIATE ACTION REQUIRED'
					}
				</Text>
				<Text style={styles.letterSubtitle}>Loan Reference: {data.loanId}</Text>

				{/* Content */}
				{data.letterType === 'DEFAULT_RISK' ? renderDefaultRiskContent() : renderManualDefaultContent()}

				{/* Closing */}
				<View style={styles.closing}>
					<Text style={styles.paragraph}>Yours faithfully,</Text>
				</View>

				{/* Signature */}
				<View style={styles.signature}>
					<View style={styles.signatureLine}></View>
					<Text style={styles.signatureText}>Authorized Signatory</Text>
					<Text style={styles.signatureText}>{data.companySettings.companyName}</Text>
				</View>

				{/* Footer */}
				<View style={styles.footer}>
					<Text style={styles.footerText}>
						Generated on: {new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}
					</Text>
				</View>
			</Page>
		</Document>
	);
};

export default DefaultLetterDocument;
