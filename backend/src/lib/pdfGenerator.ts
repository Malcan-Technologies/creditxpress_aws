import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger';
import DefaultLetterDocument, { DefaultLetterData } from './defaultLetterTemplate';

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const PDF_LETTERS_DIR = path.join(UPLOADS_DIR, 'default-letters');

// Create directories if they don't exist
async function ensureDirectories() {
	try {
		await fs.mkdir(UPLOADS_DIR, { recursive: true });
		await fs.mkdir(PDF_LETTERS_DIR, { recursive: true });
	} catch (error) {
		// Directory might already exist
	}
}

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
		
		const settings = await prisma.companySettings.findFirst({
			where: { isActive: true }
		});

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
		logger.error('Error fetching company settings for PDF:', error);
	}

	// Default fallback
	return {
		companyName: 'Kredit.my',
		companyAddress: 'Kuala Lumpur, Malaysia',
	};
}

/**
 * Generate PDF letter for default risk notification
 */
export async function generateDefaultRiskPDF(
	loanId: string,
	data: DefaultRiskLetterData
): Promise<string> {
	try {
		await ensureDirectories();
		
		const companySettings = await getCompanySettings();
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filename = `default-risk-${loanId}-${timestamp}.pdf`;
		const filepath = path.join(PDF_LETTERS_DIR, filename);

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

		// Write to file
		await fs.writeFile(filepath, pdfBuffer);

		logger.info(`Generated default risk PDF letter: ${filename}`);
		return `default-letters/${filename}`;

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
		await ensureDirectories();
		
		const companySettings = await getCompanySettings();
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filename = `manual-default-${loanId}-${timestamp}.pdf`;
		const filepath = path.join(PDF_LETTERS_DIR, filename);

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

		// Write to file
		await fs.writeFile(filepath, pdfBuffer);

		logger.info(`Generated manual default PDF letter: ${filename}`);
		return `default-letters/${filename}`;

	} catch (error) {
		logger.error('Error generating manual default PDF:', error);
		throw error;
	}
}

/**
 * Get PDF letter path for download
 */
export function getPDFLetterPath(filename: string): string {
	return path.join(PDF_LETTERS_DIR, filename);
}

/**
 * List all PDF letters for a loan
 */
export async function listPDFLettersForLoan(loanId: string): Promise<Array<{
	filename: string;
	path: string;
	createdAt: Date;
	size: number;
}>> {
	try {
		const files = await fs.readdir(PDF_LETTERS_DIR);
		const loanFiles = files.filter(file => file.includes(loanId) && file.endsWith('.pdf'));
		
		const fileDetails = await Promise.all(loanFiles.map(async filename => {
			const filepath = path.join(PDF_LETTERS_DIR, filename);
			const stats = await fs.stat(filepath);
			
			return {
				filename,
				path: `default-letters/${filename}`,
				createdAt: stats.birthtime,
				size: stats.size
			};
		}));

		// Sort by creation date (newest first)
		return fileDetails.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

	} catch (error) {
		logger.error('Error listing PDF letters for loan:', error);
		return [];
	}
}

/**
 * Get PDF buffer for download (similar to receipt service)
 */
export async function getPDFLetterBuffer(filename: string): Promise<Buffer> {
	try {
		const filepath = path.join(PDF_LETTERS_DIR, filename);
		return await fs.readFile(filepath);
	} catch (error) {
		logger.error('Error reading PDF letter buffer:', error);
		throw error;
	}
}