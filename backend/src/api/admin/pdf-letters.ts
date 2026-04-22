import { Router } from "express";
import { requireAdmin } from "../../lib/permissions";
import { AuthRequest, authenticateToken } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { listPDFLettersForLoan, generateManualDefaultLetter, getPDFLetterBuffer } from "../../lib/pdfGenerator";
import { emailService } from "../../lib/emailService";
import { prisma } from "../../lib/prisma";

const router = Router();

/**
 * @swagger
 * /api/admin/loans/{loanId}/pdf-letters:
 *   get:
 *     summary: Get list of PDF letters for a loan
 *     tags: [Admin - PDF Letters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *     responses:
 *       200:
 *         description: PDF letters retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Internal server error
 */
router.get("/:loanId/pdf-letters", authenticateToken, requireAdmin, async (req, res) => {
	try {
		const { loanId } = req.params;

		// Verify loan exists
		const loan = await prisma.loan.findUnique({
			where: { id: loanId },
		});

		if (!loan) {
			return res.status(404).json({
				success: false,
				message: "Loan not found",
			});
		}

		// Get PDF letters for this loan
		const letters = await listPDFLettersForLoan(loanId);

		return res.json({
			success: true,
			data: letters,
		});
	} catch (error) {
		logger.error("Error fetching PDF letters:", error);
		return res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "Internal server error",
		});
	}
});

/**
 * @swagger
 * /api/admin/loans/{loanId}/borrower-info:
 *   get:
 *     summary: Get borrower information for PDF letter generation
 *     tags: [Admin - PDF Letters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *     responses:
 *       200:
 *         description: Borrower information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     borrowerName:
 *                       type: string
 *                     borrowerAddress:
 *                       type: string
 *                     borrowerIcNumber:
 *                       type: string
 *                     productName:
 *                       type: string
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Internal server error
 */
router.get("/:loanId/borrower-info", authenticateToken, requireAdmin, async (req, res) => {
	try {
		const { loanId } = req.params;

		// Get loan with user and product information
		const loan = await prisma.loan.findUnique({
			where: { id: loanId },
			include: {
				user: {
					select: {
						fullName: true,
						address1: true,
						address2: true,
						city: true,
						state: true,
						zipCode: true,
						country: true,
						icNumber: true,
						icType: true,
						idNumber: true,
						idType: true,
					}
				},
				application: {
					include: {
						product: {
							select: {
								name: true,
							}
						}
					}
				}
			}
		});

		if (!loan) {
			return res.status(404).json({
				success: false,
				message: "Loan not found",
			});
		}

		// Build complete address from database
		const buildCompleteAddress = (user: any) => {
			const addressParts = [
				user.address1,
				user.address2,
				user.city,
				user.zipCode && user.state ? `${user.zipCode} ${user.state}` : user.state,
				user.country
			].filter(Boolean);
			return addressParts.length > 0 ? addressParts.join(', ') : 'Address on file';
		};

		// Get IC number (prefer icNumber, fallback to idNumber)
		const icNumber = loan.user.icNumber || loan.user.idNumber || undefined;

		return res.json({
			success: true,
			data: {
				borrowerName: loan.user.fullName || 'Unknown',
				borrowerAddress: buildCompleteAddress(loan.user),
				borrowerIcNumber: icNumber,
				productName: loan.application?.product?.name || 'Loan Product',
			},
		});
	} catch (error) {
		logger.error("Error fetching borrower info:", error);
		return res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "Internal server error",
		});
	}
});

/**
 * @swagger
 * /api/admin/loans/{loanId}/generate-pdf-letter:
 *   post:
 *     summary: Generate a new PDF letter for a loan
 *     tags: [Admin - PDF Letters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               borrowerAddress:
 *                 type: string
 *                 description: Override borrower address (optional, uses database address if not provided)
 *     responses:
 *       200:
 *         description: PDF letter generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     filename:
 *                       type: string
 *                     path:
 *                       type: string
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Internal server error
 */
router.post("/:loanId/generate-pdf-letter", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
	try {
		const { loanId } = req.params;
		const { borrowerAddress, sendEmail: sendEmailBody } = req.body as {
			borrowerAddress?: string;
			sendEmail?: boolean;
		};
		const wantsEmail = sendEmailBody !== false;

		// Get loan with user and product information
		const loan = await prisma.loan.findUnique({
			where: { id: loanId },
			include: {
				user: {
					select: {
						email: true,
						fullName: true,
						phoneNumber: true,
						address1: true,
						address2: true,
						city: true,
						state: true,
						zipCode: true,
						country: true,
						icNumber: true,
						icType: true,
						idNumber: true,
						idType: true,
					}
				},
				application: {
					include: {
						product: {
							select: {
								name: true,
							}
						}
					}
				},
				repayments: {
					where: {
						status: { in: ['PENDING', 'PARTIAL'] }
					}
				}
			}
		});

		if (!loan) {
			return res.status(404).json({
				success: false,
				message: "Loan not found",
			});
		}

		// Calculate outstanding amounts
		const outstandingAmount = loan.repayments.reduce((total: number, repayment: any) => {
			return total + Math.max(0, 
				(repayment.principalAmount + repayment.interestAmount) - (repayment.principalPaid || 0)
			);
		}, 0);

		const totalLateFees = loan.repayments.reduce((total: number, repayment: any) => {
			return total + Math.max(0, 
				(repayment.lateFeeAmount || 0) - (repayment.lateFeesPaid || 0)
			);
		}, 0);

		// Calculate days overdue (simplified - using the earliest overdue repayment)
		const now = new Date();
		let daysOverdue = 0;
		
		const overdueRepayments = loan.repayments.filter((r: any) => new Date(r.dueDate) < now);
		if (overdueRepayments.length > 0) {
			const earliestOverdue = overdueRepayments.sort((a: any, b: any) => 
				new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
			)[0];
			const daysDiff = Math.floor((now.getTime() - new Date(earliestOverdue.dueDate).getTime()) / (1000 * 60 * 60 * 24));
			daysOverdue = Math.max(0, daysDiff);
		}

		// Get remedy days setting from database
		const remedyDaysSetting = await prisma.systemSettings.findUnique({
			where: { key: 'DEFAULT_REMEDY_DAYS' }
		});
		const remedyDays = remedyDaysSetting ? JSON.parse(remedyDaysSetting.value) : 16;

		// Build complete address from database or use override
		const buildCompleteAddress = (user: any) => {
			const addressParts = [
				user.address1,
				user.address2,
				user.city,
				user.zipCode && user.state ? `${user.zipCode} ${user.state}` : user.state,
				user.country
			].filter(Boolean);
			return addressParts.length > 0 ? addressParts.join(', ') : 'Address on file';
		};

		const finalBorrowerAddress = borrowerAddress || buildCompleteAddress(loan.user);
		
		// Get IC number (prefer icNumber, fallback to idNumber)
		const icNumber = loan.user.icNumber || loan.user.idNumber || undefined;

		// Generate PDF letter
		const pdfPath = await generateManualDefaultLetter(loanId, {
			borrowerName: loan.user.fullName || 'Unknown',
			borrowerAddress: finalBorrowerAddress,
			borrowerIcNumber: icNumber,
			productName: loan.application?.product?.name || 'Loan Product',
			loanId: loanId,
			daysOverdue,
			outstandingAmount,
			totalLateFees,
			totalAmountDue: outstandingAmount + totalLateFees,
			remedyDeadline: new Date(Date.now() + (remedyDays * 24 * 60 * 60 * 1000)), // Use actual remedy days setting
		});

		// Log the manual PDF generation in both audit trails
		await prisma.$transaction(async (tx) => {
			// Log in loan_default_logs
			await tx.loanDefaultLog.create({
				data: {
					loanId,
					eventType: 'PDF_GENERATED',
					daysOverdue,
					outstandingAmount,
					totalLateFees,
					pdfLetterPath: pdfPath,
					processedAt: new Date(),
					metadata: {
						letterType: 'MANUAL_DEFAULT_NOTICE',
						generatedBy: req.user?.userId || 'ADMIN',
						generatedByEmail: req.user?.fullName || 'admin',
						hasCustomContent: false,
						borrowerAddressOverride: borrowerAddress ? true : false,
						finalBorrowerAddress: finalBorrowerAddress,
					}
				}
			});

			// Log in loan_application_history
			const applicationId = loan.applicationId;
			if (applicationId) {
				await tx.loanApplicationHistory.create({
					data: {
						applicationId,
						previousStatus: null, // No status change
						newStatus: loan.status, // Current status remains
						changedBy: req.user?.fullName || 'ADMIN',
						changeReason: 'Manual default notice letter generated',
						notes: `Default notice PDF letter generated manually by admin. Outstanding: RM ${outstandingAmount.toFixed(2)}, Late fees: RM ${totalLateFees.toFixed(2)}, Total due: RM ${(outstandingAmount + totalLateFees).toFixed(2)}. Days overdue: ${daysOverdue}. ${borrowerAddress ? 'Custom address used.' : 'Database address used.'}`,
						metadata: {
							eventType: 'MANUAL_PDF_GENERATED',
							loanId,
							letterType: 'MANUAL_DEFAULT_NOTICE',
							pdfLetterPath: pdfPath,
							daysOverdue,
							outstandingAmount,
							totalLateFees,
							totalAmountDue: outstandingAmount + totalLateFees,
							generatedBy: req.user?.userId || 'ADMIN',
							generatedByEmail: req.user?.fullName || 'admin',
							borrowerName: loan.user.fullName,
							borrowerIcNumber: icNumber,
							borrowerAddressUsed: finalBorrowerAddress,
							borrowerAddressOverride: borrowerAddress ? true : false,
							productName: loan.application?.product?.name,
							generatedAt: new Date().toISOString(),
						}
					}
				});
			}
		});

		let emailSent = false;
		let emailSkippedReason: string | undefined;

		if (wantsEmail && loan.user.email) {
			try {
				const pdfBuffer = await getPDFLetterBuffer(pdfPath);
				const attachmentFilename =
					pdfPath.split("/").pop() || `default-notice-${loanId}.pdf`;
				const emailResult = await emailService.sendDefaultArrearsNoticeEmail({
					to: loan.user.email,
					borrowerName: loan.user.fullName || "Valued Customer",
					loanId,
					productName: loan.application?.product?.name || "Loan Product",
					daysOverdue,
					outstandingAmount,
					totalLateFees,
					totalAmountDue: outstandingAmount + totalLateFees,
					pdfBuffer,
					attachmentFilename,
				});
				emailSent = emailResult.success;
				if (!emailResult.success) {
					emailSkippedReason = emailResult.error || "Email not sent";
					logger.warn(
						`Default/arrears notice email not sent for loan ${loanId}: ${emailSkippedReason}`
					);
				}
			} catch (emailErr) {
				emailSkippedReason =
					emailErr instanceof Error ? emailErr.message : "Email error";
				logger.warn(`Default/arrears notice email failed for loan ${loanId}:`, emailErr);
			}
		} else if (wantsEmail && !loan.user.email) {
			emailSkippedReason = "borrower_has_no_email";
		} else if (!wantsEmail) {
			emailSkippedReason = "skipped_send_email_false";
		}

		return res.json({
			success: true,
			data: {
				filename: pdfPath.split('/').pop(),
				path: pdfPath,
				emailSent,
				emailSkippedReason,
			},
			message: "PDF letter generated successfully",
		});
	} catch (error) {
		logger.error("Error generating PDF letter:", error);
		return res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "Internal server error",
		});
	}
});

/**
 * @swagger
 * /api/admin/loans/{loanId}/pdf-letters/{letterId}/download:
 *   get:
 *     summary: Download a PDF letter by loan default log id
 *     tags: [Admin - PDF Letters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *       - in: path
 *         name: letterId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan default log id (from Generated Letters list)
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: File not found
 *       500:
 *         description: Internal server error
 */
router.get("/:loanId/pdf-letters/:letterId/download", authenticateToken, requireAdmin, async (req, res) => {
	try {
		const { loanId, letterId } = req.params;

		const log = await prisma.loanDefaultLog.findFirst({
			where: {
				id: letterId,
				loanId,
				eventType: "PDF_GENERATED",
				pdfLetterPath: { not: null },
			},
		});

		if (!log?.pdfLetterPath) {
			return res.status(404).json({
				success: false,
				message: "PDF letter not found",
			});
		}

		const s3Key = log.pdfLetterPath;
		const downloadName = s3Key.split("/").pop() || "letter.pdf";
		const buffer = await getPDFLetterBuffer(s3Key);

		res.setHeader("Content-Type", "application/pdf");
		res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
		return res.send(buffer);
	} catch (error) {
		logger.error("Error downloading PDF letter:", error);
		if (error instanceof Error && error.message.includes("ENOENT")) {
			return res.status(404).json({
				success: false,
				message: "File not found",
			});
		}
		return res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "Internal server error",
		});
	}
});

export default router;
