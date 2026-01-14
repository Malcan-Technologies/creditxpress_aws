import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { docusealConfig, signingConfig } from "../lib/config";
import { getS3ObjectStream } from "../lib/storage";

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

	// Build the DocuSeal URL from centralized config and slug
	const docusealSlug = application.loan.docusealSignUrl;
	const docusealUrl = `${docusealConfig.baseUrl}/s/${docusealSlug}`;
	
	console.log('🔗 Building DocuSeal URL:', {
		baseUrl: docusealConfig.baseUrl,
		slug: docusealSlug,
		fullUrl: docusealUrl
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
		if (!signingConfig.url || !signingConfig.apiKey) {
			throw new Error('Signing orchestrator configuration missing');
		}

		const response = await fetch(`${signingConfig.url}/api/signed/${applicationId}/download`, {
			method: 'GET',
			headers: {
				'X-API-Key': signingConfig.apiKey,
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

		// Stream from S3
		try {
			console.log(`📁 Streaming stamp certificate from S3: ${application.loan.pkiStampCertificateUrl}`);
			const { stream, contentType, contentLength } = await getS3ObjectStream(application.loan.pkiStampCertificateUrl);

			res.setHeader('Content-Type', contentType || 'application/pdf');
			res.setHeader('Content-Disposition', `attachment; filename="stamp-certificate-${applicationId.substring(0, 8)}.pdf"`);
			if (contentLength) {
				res.setHeader('Content-Length', contentLength);
			}

			stream.on('error', (error) => {
				console.error('❌ Error streaming file from S3:', error);
				if (!res.headersSent) {
					res.status(500).json({
						success: false,
						message: "Error streaming certificate file",
						error: error.message
					});
				}
			});
			stream.pipe(res);
			return;
		} catch (s3Error) {
			console.error(`❌ Stamp certificate not found in S3: ${application.loan.pkiStampCertificateUrl}`, s3Error);
			return res.status(404).json({
				success: false,
				message: "Stamp certificate file not found in storage"
			});
		}

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

