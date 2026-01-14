import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { logger } from './logger';
import DefaultLetterDocument, { DefaultLetterData } from './defaultLetterTemplate';
import { uploadToS3Organized, getS3ObjectStream, S3_FOLDERS } from './storage';

interface DefaultRiskLetterData {
	borrowerName: string;
	borrowerAddress: string;
	borrowerIcNumber?: string;
	productName: string;
	loanId: string;
	daysOverdue: number;
	outstandingAmount: number;
	totalLateFees: number;
	totalAmountDue: number;
	remedyDeadline?: Date;
}

interface CompanySettings {
	companyName: string;
	companyAddress: string;
	companyRegNo?: string;
	licenseNo?: string;
	contactPhone?: string;
	contactEmail?: string;
}

/**
 * Get company settings for letterhead
 */
async function getCompanySettings(): Promise<CompanySettings> {
	try {
		const { prisma } = await import('../../lib/prisma');
		
		const settings = await prisma.companySettings.findFirst();
		
		if (settings) {
			return {
				companyName: settings.companyName,
				companyAddress: settings.companyAddress,
				companyRegNo: settings.companyRegNo || undefined,
				licenseNo: settings.licenseNo || undefined,
				contactPhone: settings.contactPhone || undefined,
				contactEmail: settings.contactEmail || undefined,
			};
		}
	} catch (error) {
		logger.warn('Could not load company settings for PDF, using defaults');
	}

	// Default company settings
	return {
		companyName: 'Kredit Sdn Bhd',
		companyAddress: 'Level 10, Tower 1, Avenue 5, Bangsar South, 59200 Kuala Lumpur',
		companyRegNo: '12345678-X',
		licenseNo: 'WL/12345',
		contactPhone: '+60 3-1234 5678',
		contactEmail: 'info@kredit.my',
	};
}

/**
 * Generate PDF letter for automatic default risk notices
 */
export async function generateDefaultRiskLetter(
	loanId: string,
	data: DefaultRiskLetterData
): Promise<string> {
	try {
		const companySettings = await getCompanySettings();
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filename = `default-risk-${loanId}-${timestamp}.pdf`;

		// Prepare letter data for React PDF template
		const letterData: DefaultLetterData = {
			letterType: 'DEFAULT_RISK',
			letterNumber: `DR-${loanId}-${Date.now()}`,
			date: new Date().toLocaleDateString('en-MY', {
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			}),
			borrowerName: data.borrowerName,
			borrowerAddress: data.borrowerAddress,
			borrowerIcNumber: data.borrowerIcNumber,
			loanId: data.loanId,
			productName: data.productName,
			daysOverdue: data.daysOverdue,
			outstandingAmount: data.outstandingAmount,
			totalLateFees: data.totalLateFees,
			totalAmountDue: data.totalAmountDue,
			remedyDeadline: data.remedyDeadline?.toLocaleDateString('en-MY', {
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			}),
			companySettings,
		};

		// Generate PDF using React PDF
		const letterDocument = DefaultLetterDocument({ data: letterData }) as React.ReactElement;
		const pdfBuffer = await renderToBuffer(letterDocument);

		// Upload to S3 with organized folder structure
		const uploadResult = await uploadToS3Organized(
			Buffer.from(pdfBuffer),
			filename,
			'application/pdf',
			{
				folder: S3_FOLDERS.DEFAULT_LETTERS,
				subFolder: loanId.substring(0, 8), // Organize by loan ID prefix
			}
		);

		if (!uploadResult.success || !uploadResult.key) {
			throw new Error(`Failed to upload default risk letter to S3: ${uploadResult.error}`);
		}

		logger.info(`Generated and uploaded default risk PDF letter to S3: ${uploadResult.key}`);
		return uploadResult.key;

	} catch (error) {
		logger.error('Error generating default risk PDF:', error);
		throw error;
	}
}

/**
 * Generate PDF letter for manual default notice (admin use)
 */
export async function generateManualDefaultLetter(
	loanId: string,
	data: DefaultRiskLetterData
): Promise<string> {
	try {
		const companySettings = await getCompanySettings();
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filename = `manual-default-${loanId}-${timestamp}.pdf`;

		// Prepare letter data for React PDF template
		const letterData: DefaultLetterData = {
			letterType: 'MANUAL_DEFAULT',
			letterNumber: `MD-${loanId}-${Date.now()}`,
			date: new Date().toLocaleDateString('en-MY', {
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			}),
			borrowerName: data.borrowerName,
			borrowerAddress: data.borrowerAddress,
			borrowerIcNumber: data.borrowerIcNumber,
			loanId: data.loanId,
			productName: data.productName,
			daysOverdue: data.daysOverdue,
			outstandingAmount: data.outstandingAmount,
			totalLateFees: data.totalLateFees,
			totalAmountDue: data.totalAmountDue,
			companySettings,
		};

		// Generate PDF using React PDF
		const letterDocument = DefaultLetterDocument({ data: letterData }) as React.ReactElement;
		const pdfBuffer = await renderToBuffer(letterDocument);

		// Upload to S3 with organized folder structure
		const uploadResult = await uploadToS3Organized(
			Buffer.from(pdfBuffer),
			filename,
			'application/pdf',
			{
				folder: S3_FOLDERS.DEFAULT_LETTERS,
				subFolder: loanId.substring(0, 8), // Organize by loan ID prefix
			}
		);

		if (!uploadResult.success || !uploadResult.key) {
			throw new Error(`Failed to upload manual default letter to S3: ${uploadResult.error}`);
		}

		logger.info(`Generated and uploaded manual default PDF letter to S3: ${uploadResult.key}`);
		return uploadResult.key;

	} catch (error) {
		logger.error('Error generating manual default PDF:', error);
		throw error;
	}
}

/**
 * Get S3 key for a PDF letter (returns the S3 key directly)
 */
export function getPDFLetterPath(s3Key: string): string {
	return s3Key;
}

/**
 * List all PDF letters for a loan
 * NOTE: Since we now store in S3, this function queries the database for letters
 * associated with the loan instead of scanning the filesystem.
 * PDF letters are tracked through late fee records or need separate tracking.
 */
export async function listPDFLettersForLoan(_loanId: string): Promise<Array<{
	filename: string;
	path: string;
	createdAt: Date;
	size: number;
}>> {
	try {
		// Since letters are generated and referenced in late fee processing,
		// we would need to track them in a database table for proper listing.
		// For now, return empty array - letters can be accessed via late fee records.
		logger.warn('listPDFLettersForLoan: PDF letters are now stored in S3. Consider tracking them in database.');
		return [];

	} catch (error) {
		logger.error('Error listing PDF letters for loan:', error);
		return [];
	}
}

/**
 * Get PDF buffer for download from S3
 */
export async function getPDFLetterBuffer(s3Key: string): Promise<Buffer> {
	try {
		const { stream } = await getS3ObjectStream(s3Key);
		
		// Convert stream to buffer
		const chunks: Buffer[] = [];
		for await (const chunk of stream) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}
		return Buffer.concat(chunks);
	} catch (error) {
		logger.error('Error reading PDF letter buffer from S3:', error);
		throw error;
	}
}
