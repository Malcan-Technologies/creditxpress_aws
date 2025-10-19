import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const router = Router();

/**
 * Download unsigned loan agreement PDF (user-facing)
 */
router.get("/:applicationId/unsigned-agreement", authenticateToken, async (req: AuthRequest, res: Response) => {
	try {
		const { applicationId } = req.params;
		const userId = req.user!.userId;

		// Verify application exists and belongs to user
		const application = await prisma.loanApplication.findUnique({
			where: { id: applicationId },
			include: {
				loan: true
			}
		});

		if (!application) {
			return res.status(404).json({
				success: false,
				message: "Application not found"
			});
		}

		if (application.userId !== userId) {
			return res.status(403).json({
				success: false,
				message: "You don't have permission to access this application"
			});
		}

	if (!application.loan) {
		return res.status(400).json({
			success: false,
			message: "No loan associated with this application"
		});
	}

	// Check if DocuSeal sign URL exists
	if (!application.loan.docusealSignUrl) {
		return res.status(400).json({
			success: false,
			message: "No DocuSeal submission found for this loan"
		});
	}

	// Build the DocuSeal URL from environment variable and slug
	const docusealBaseUrl = process.env.DOCUSEAL_BASE_URL || 'https://sign.kredit.my';
	const docusealSlug = application.loan.docusealSignUrl;
	const docusealUrl = `${docusealBaseUrl}/s/${docusealSlug}`;
	
	console.log('🔗 Building DocuSeal URL:', {
		baseUrl: docusealBaseUrl,
		slug: docusealSlug,
		fullUrl: docusealUrl,
		envVarSet: !!process.env.DOCUSEAL_BASE_URL
	});
	
	// Return the URL for the frontend to open
	return res.json({
		success: true,
		url: docusealUrl,
		message: "Please open this URL to view the unsigned agreement"
	});

	} catch (error) {
		console.error('❌ Error downloading unsigned agreement:', error);
		return res.status(500).json({
			success: false,
			message: "Error downloading unsigned agreement",
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

/**
 * Download signed loan agreement with PKI signatures (user-facing)
 */
router.get("/:applicationId/signed-agreement", authenticateToken, async (req: AuthRequest, res: Response) => {
	try {
		const { applicationId } = req.params;
		const userId = req.user!.userId;

		// Verify application exists and belongs to user
		const application = await prisma.loanApplication.findUnique({
			where: { id: applicationId },
			include: {
				loan: true
			}
		});

		if (!application) {
			return res.status(404).json({
				success: false,
				message: "Application not found"
			});
		}

		if (application.userId !== userId) {
			return res.status(403).json({
				success: false,
				message: "You don't have permission to access this application"
			});
		}

		if (!application.loan) {
			return res.status(400).json({
				success: false,
				message: "No loan associated with this application"
			});
		}

		if (!application.loan.pkiSignedPdfUrl) {
			return res.status(400).json({
				success: false,
				message: "No signed agreement available for this loan. PKI signing may not be complete."
			});
		}

		// Get signed agreement from signing orchestrator
		const orchestratorUrl = process.env.SIGNING_ORCHESTRATOR_URL;
		const orchestratorApiKey = process.env.SIGNING_ORCHESTRATOR_API_KEY;

		if (!orchestratorUrl || !orchestratorApiKey) {
			throw new Error('Signing orchestrator configuration missing');
		}

		const response = await fetch(`${orchestratorUrl}/api/signed/${applicationId}/download`, {
			method: 'GET',
			headers: {
				'X-API-Key': orchestratorApiKey,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Orchestrator download failed: ${response.status} - ${errorText}`);
		}

		// Stream the PDF directly to the client
		const pdfBuffer = await response.arrayBuffer();
		
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `attachment; filename="signed-agreement-${applicationId.substring(0, 8)}.pdf"`);
		res.setHeader('Content-Length', pdfBuffer.byteLength);
		
		res.send(Buffer.from(pdfBuffer));
		return;

	} catch (error) {
		console.error('❌ Error downloading signed agreement:', error);
		return res.status(500).json({
			success: false,
			message: "Error downloading signed agreement",
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

/**
 * Download stamp certificate (user-facing)
 */
router.get("/:applicationId/stamp-certificate", authenticateToken, async (req: AuthRequest, res: Response) => {
	try {
		const { applicationId } = req.params;
		const userId = req.user!.userId;

		// Verify application exists and belongs to user
		const application = await prisma.loanApplication.findUnique({
			where: { id: applicationId },
			include: {
				loan: true
			}
		});

		if (!application) {
			return res.status(404).json({
				success: false,
				message: "Application not found"
			});
		}

		if (application.userId !== userId) {
			return res.status(403).json({
				success: false,
				message: "You don't have permission to access this application"
			});
		}

		if (!application.loan) {
			return res.status(400).json({
				success: false,
				message: "No loan associated with this application"
			});
		}

		if (!application.loan.pkiStampCertificateUrl) {
			console.error(`❌ No stamp certificate URL for application ${applicationId}`);
			return res.status(400).json({
				success: false,
				message: "No stamp certificate available for this loan"
			});
		}

		console.log(`📄 Stamp certificate URL: ${application.loan.pkiStampCertificateUrl}`);

		// Read the certificate file from disk
		const certificatePath = path.join(__dirname, '../../', application.loan.pkiStampCertificateUrl);
		console.log(`📁 Full certificate path: ${certificatePath}`);

		if (!fs.existsSync(certificatePath)) {
			console.error(`❌ Stamp certificate file not found at: ${certificatePath}`);
			return res.status(404).json({
				success: false,
				message: "Stamp certificate file not found on server",
				debug: {
					expectedPath: certificatePath,
					relativePath: application.loan.pkiStampCertificateUrl
				}
			});
		}

		console.log(`✅ Sending stamp certificate file: ${certificatePath}`);

		// Send the file
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `attachment; filename="stamp-certificate-${applicationId.substring(0, 8)}.pdf"`);
		
		const fileStream = fs.createReadStream(certificatePath);
		fileStream.on('error', (error) => {
			console.error('❌ Error streaming file:', error);
			if (!res.headersSent) {
				res.status(500).json({
					success: false,
					message: "Error streaming certificate file",
					error: error.message
				});
			}
		});
		fileStream.pipe(res);
		return;

	} catch (error) {
		console.error('❌ Error downloading stamp certificate:', error);
		return res.status(500).json({
			success: false,
			message: "Error downloading stamp certificate",
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

export default router;

