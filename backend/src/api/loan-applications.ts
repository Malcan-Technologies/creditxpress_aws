import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {
	authenticateAndVerifyPhone,
	AuthRequest,
	FileAuthRequest,
} from "../middleware/auth";
import { nanoid } from "nanoid";
import multer from "multer";
import { RequestHandler } from "express";
import { trackApplicationStatusChange } from "./admin";
import { userHasAllKycDocuments } from "./kyc";
import { docusealService } from "../lib/docusealService";
import whatsappService from "../lib/whatsappService";
import { docusealConfig, signingConfig } from "../lib/config";
import { uploadToS3Organized, getS3ObjectStream, deleteFromS3, S3_FOLDERS } from "../lib/storage";

const router = Router();
const prisma = new PrismaClient();

// Configure multer with memory storage for S3 uploads
const upload = multer({
	storage: (multer as any).memoryStorage(),
	limits: {
		fileSize: 50 * 1024 * 1024, // 50MB in bytes
	},
});

/**
 * @swagger
 * tags:
 *   name: Loan Applications
 *   description: API endpoints for managing loan applications
 */

/**
 * @swagger
 * /api/loan-applications:
 *   post:
 *     summary: Create a new loan application
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - amount
 *               - term
 *               - purpose
 *             properties:
 *               productId:
 *                 type: string
 *                 description: ID of the selected loan product
 *               amount:
 *                 type: number
 *                 description: Loan amount requested
 *               term:
 *                 type: number
 *                 description: Loan term in months
 *               purpose:
 *                 type: string
 *                 description: Purpose of the loan
 *     responses:
 *       201:
 *         description: Loan application created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
// Create a new loan application
router.post("/", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
	try {
		const { productId, amount, term, purpose, appStep } = req.body;
		const userId = req.user!.userId;

		// Get product details to calculate fees
		const productDetails = await prisma.product.findUnique({
			where: { id: productId },
		});

		if (!productDetails) {
			return res.status(404).json({ message: "Product not found" });
		}

	// Create the loan application with optional fields
	const loanApplicationData: any = {
		userId,
		productId,
		appStep: appStep || 0,
		// Include product fees from database, not request body to prevent tampering
		interestRate: productDetails.interestRate,
		lateFee: productDetails.lateFeeRate,
	};

	// Only add optional fields if they are provided
	if (amount !== undefined) {
		loanApplicationData.amount = amount;
	}

	if (term !== undefined) {
		loanApplicationData.term = term;
	}

	if (purpose !== undefined) {
		loanApplicationData.purpose = purpose;
	}

		// Generate a unique URL link
		const urlLink = nanoid(10);
		loanApplicationData.urlLink = urlLink;

		// Create the loan application
		const loanApplication = await prisma.loanApplication.create({
			data: loanApplicationData,
		});

		return res.status(201).json(loanApplication);
	} catch (error) {
		console.error("Error creating loan application:", error);
		return res.status(500).json({ message: "Server error" });
	}
});

/**
 * @swagger
 * /api/loan-applications/{id}:
 *   get:
 *     summary: Get a loan application by ID or URL link
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID or URL link
 *     responses:
 *       200:
 *         description: Loan application retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       404:
 *         description: Loan application not found
 *       500:
 *         description: Server error
 */
// Get a loan application by ID or URL link
router.get("/:id", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const userId = req.user!.userId;

		// Check if the ID is a URL link or an application ID
		const loanApplication = await prisma.loanApplication.findFirst({
			where: {
				OR: [{ id }, { urlLink: id }],
				userId,
			},
			include: {
				product: true,
				documents: true,
				user: {
					select: {
						fullName: true,
						email: true,
						phoneNumber: true,
						employmentStatus: true,
						employerName: true,
						monthlyIncome: true,
						address1: true,
						address2: true,
						city: true,
						state: true,
						zipCode: true,
						idNumber: true,
						icNumber: true,
						icType: true,
					},
				},
			},
		});

		if (!loanApplication) {
			return res
				.status(404)
				.json({ message: "Loan application not found" });
		}

		return res.json(loanApplication);
	} catch (error) {
		console.error("Error retrieving loan application:", error);
		return res
			.status(500)
			.json({ message: "Failed to retrieve loan application" });
	}
});

/**
 * @swagger
 * /api/loan-applications:
 *   get:
 *     summary: Get all loan applications for the current user
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of loan applications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LoanApplication'
 *       500:
 *         description: Server error
 */
// Get all loan applications for the current user
router.get("/", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user!.userId;


		const loanApplications = await prisma.loanApplication.findMany({
			where: { userId },
			include: {
				product: true,
				loan: {
					select: {
						id: true,
						docusealSubmissionId: true,
						agreementStatus: true,
						agreementSignedAt: true,
						docusealSignUrl: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});

		// Calculate agreement status from signatory table for each application with a loan
		const applicationsWithCalculatedStatus = await Promise.all(
			loanApplications.map(async (app) => {
				if (app.loan?.id) {
					try {
						// Get calculated agreement status from signatory records
						const calculatedAgreementStatus = await docusealService.calculateAgreementStatus(app.loan.id);
						return {
							...app,
							loan: {
								...app.loan,
								agreementStatus: calculatedAgreementStatus, // Use calculated status instead of stored one
							},
						};
					} catch (error) {
						console.error(`Error calculating agreement status for loan ${app.loan.id}:`, error);
						// Fall back to stored status if calculation fails
						return app;
					}
				}
				return app;
			})
		);

		return res.json(applicationsWithCalculatedStatus);
	} catch (error) {
		console.error("Error retrieving loan applications:", error);
		return res.status(500).json({
			message: "Failed to retrieve loan applications",
		});
	}
});

/**
 * @swagger
 * /api/loan-applications/{id}:
 *   patch:
 *     summary: Update a loan application
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID or URL link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Updated loan amount
 *               term:
 *                 type: number
 *                 description: Updated loan term in months
 *               purpose:
 *                 type: string
 *                 description: Updated loan purpose
 *               acceptTerms:
 *                 type: boolean
 *                 description: Whether the user has accepted the terms
 *               paidAppFee:
 *                 type: boolean
 *                 description: Whether the application fee has been paid
 *     responses:
 *       200:
 *         description: Loan application updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       404:
 *         description: Loan application not found
 *       500:
 *         description: Server error
 */
// Update a loan application
router.patch("/:id", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const userId = req.user!.userId;
		const updateData = req.body;

		// Check if the application exists and belongs to the user
		const existingApplication = await prisma.loanApplication.findFirst({
			where: {
				OR: [{ id }, { urlLink: id }],
				userId,
			},
			include: {
				user: {
					select: {
						fullName: true,
					},
				},
			},
		});

		if (!existingApplication) {
			return res
				.status(404)
				.json({ message: "Loan application not found" });
		}

		// Use a transaction to update application and track status changes
		const result = await prisma.$transaction(async (prismaTransaction) => {
			// Update the loan application
			const updatedApplication = await prismaTransaction.loanApplication.update({
				where: { id: existingApplication.id },
				data: updateData,
				include: {
					user: {
						select: {
							fullName: true,
							phoneNumber: true,
						},
					},
					product: {
						select: {
							name: true,
						},
					},
				},
			});

			// Track status change if status was updated
			if (updateData.status && updateData.status !== existingApplication.status) {
				const statusChangeReason = updateData.status === "COLLATERAL_REVIEW" 
					? "Application submitted for collateral review"
					: updateData.status === "PENDING_APP_FEE"
					? "Application submitted - pending payment"
					: "Application status updated by user";

				await trackApplicationStatusChange(
					prismaTransaction,
					existingApplication.id,
					existingApplication.status,
					updateData.status,
					existingApplication.user?.fullName || "User",
					statusChangeReason,
					null,
					{
						updatedBy: "USER",
						userId: userId,
						userAction: true,
						acceptTerms: updateData.acceptTerms || false,
						appStep: updateData.appStep || null,
					}
				);
			}

			return updatedApplication;
		});

		// Send WhatsApp notification when application is submitted (status changes to PENDING_APPROVAL or COLLATERAL_REVIEW)
		if (updateData.status && 
			updateData.status !== existingApplication.status && 
			(updateData.status === "PENDING_APPROVAL" || updateData.status === "COLLATERAL_REVIEW")) {
			try {
				// Get user and product details for the notification
				const userPhoneNumber = result.user?.phoneNumber;
				const userFullName = result.user?.fullName || "Customer";
				const productName = result.product?.name || "Loan";
				const loanAmount = result.amount?.toString() || "0";

				if (userPhoneNumber) {
					// Send WhatsApp notification asynchronously (don't block the response)
					whatsappService.sendLoanApplicationSubmissionNotification({
						to: userPhoneNumber,
						fullName: userFullName,
						productName: productName,
						amount: loanAmount,
					}).catch((error) => {
						console.error("Failed to send loan application submission WhatsApp notification:", error);
					});
				}
			} catch (error) {
				console.error("Error preparing loan application submission WhatsApp notification:", error);
			}
		}

		return res.json(result);
	} catch (error) {
		console.error("Error updating loan application:", error);
		return res
			.status(500)
			.json({ message: "Failed to update loan application" });
	}
});

/**
 * @swagger
 * /api/loan-applications/{id}/step:
 *   patch:
 *     summary: Update application step
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID or URL link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - step
 *             properties:
 *               step:
 *                 type: number
 *                 description: New application step (0-4)
 *     responses:
 *       200:
 *         description: Application step updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       404:
 *         description: Loan application not found
 *       500:
 *         description: Server error
 */
// Update application step
router.patch("/:id/step", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const { step } = req.body;
		const userId = req.user!.userId;

		// Check if the application exists and belongs to the user
		const existingApplication = await prisma.loanApplication.findFirst({
			where: {
				OR: [{ id }, { urlLink: id }],
				userId,
			},
		});

		if (!existingApplication) {
			return res
				.status(404)
				.json({ message: "Loan application not found" });
		}

		// Update the application step
		const updatedApplication = await prisma.loanApplication.update({
			where: { id: existingApplication.id },
			data: { appStep: step },
		});

		return res.json(updatedApplication);
	} catch (error) {
		console.error("Error updating application step:", error);
		return res
			.status(500)
			.json({ message: "Failed to update application step" });
	}
});

/**
 * @swagger
 * /api/loan-applications/{id}/status:
 *   patch:
 *     summary: Update application status
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID or URL link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [INCOMPLETE, PENDING, APPROVED, REJECTED, DISBURSED, CLOSED]
 *                 description: New application status
 *     responses:
 *       200:
 *         description: Application status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       404:
 *         description: Loan application not found
 *       500:
 *         description: Server error
 */
// Update application status
router.patch(
	"/:id/status",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { status } = req.body;
			const userId = req.user!.userId;

			// Check if the application exists and belongs to the user
			const existingApplication = await prisma.loanApplication.findFirst({
				where: {
					OR: [{ id }, { urlLink: id }],
					userId,
				},
				include: {
					user: {
						select: {
							fullName: true,
						},
					},
				},
			});

			if (!existingApplication) {
				return res
					.status(404)
					.json({ message: "Loan application not found" });
			}

			// Use a transaction to update status and track the change
			const result = await prisma.$transaction(async (prismaTransaction) => {
				// Update the application status
				const updatedApplication = await prismaTransaction.loanApplication.update({
					where: { id: existingApplication.id },
					data: { status },
					include: {
						user: {
							select: {
								fullName: true,
							},
						},
					},
				});

				// Track the status change in audit trail
				await trackApplicationStatusChange(
					prismaTransaction,
					existingApplication.id,
					existingApplication.status,
					status,
					existingApplication.user?.fullName || "User",
					status === "WITHDRAWN" ? "Application withdrawn by user" : "Status updated by user",
					null,
					{
						updatedBy: "USER",
						userId: userId,
						userAction: true,
					}
				);

				return updatedApplication;
			});

			return res.json(result);
		} catch (error) {
			console.error("Error updating application status:", error);
			return res.status(500).json({
				message: "Failed to update application status",
			});
		}
	}
);

/**
 * @swagger
 * /api/loan-applications/{id}/documents:
 *   post:
 *     summary: Upload documents for a loan application
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Documents uploaded successfully
 *       404:
 *         description: Loan application not found
 *       500:
 *         description: Server error
 */
// Document upload endpoint
router.post(
	"/:id/documents",
	authenticateAndVerifyPhone,
	upload.array("documents"),
	async (req: FileAuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const files = req.files as Express.Multer.File[];

			// Ensure user is authenticated
			if (!req.user || !req.user.userId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const userId = req.user.userId;

			// Parse documentTypes from JSON string if it's a string
			let documentTypes: string[] = [];
			if (req.body.documentTypes) {
				try {
					documentTypes =
						typeof req.body.documentTypes === "string"
							? JSON.parse(req.body.documentTypes)
							: req.body.documentTypes;
				} catch (e) {
					console.error("Error parsing documentTypes:", e);
					return res.status(400).json({
						message: "Invalid document types format",
					});
				}
			}

			// Allow empty document submissions
			if (!files || files.length === 0) {
				return res.json([]); // Return empty array for no documents
			}

			// Validate file sizes (50MB limit)
			const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
			const oversizedFiles = files.filter(
				(file) => file.size > MAX_FILE_SIZE
			);
			if (oversizedFiles.length > 0) {
				return res.status(400).json({
					message: `Some files exceed the 50MB size limit: ${oversizedFiles
						.map((f) => f.originalname)
						.join(", ")}`,
				});
			}

			// Validate document types if files are present
			if (files.length !== documentTypes.length) {
				return res.status(400).json({
					message: "Number of files and document types must match",
				});
			}

			// Check if loan application exists and belongs to user
			const loanApplication = await prisma.loanApplication.findFirst({
				where: {
					id,
					userId,
				},
			});

			if (!loanApplication) {
				return res
					.status(404)
					.json({ message: "Loan application not found" });
			}

			// Upload files to S3 and create document records
			const documents = await Promise.all(
				files.map(async (file, index) => {
					// Upload to S3 with organized folder structure
					const uploadResult = await uploadToS3Organized(
						file.buffer,
						file.originalname,
						file.mimetype,
						{
							folder: S3_FOLDERS.DOCUMENTS,
							subFolder: documentTypes[index]?.toLowerCase().replace(/\s+/g, '-') || 'other',
							userId,
						}
					);
					
					if (!uploadResult.success || !uploadResult.key) {
						throw new Error(`Failed to upload ${file.originalname}: ${uploadResult.error}`);
					}
					
					return prisma.userDocument.create({
						data: {
							userId,
							applicationId: id,
							type: documentTypes[index],
							fileUrl: uploadResult.key, // S3 key
							status: "PENDING",
						},
					});
				})
			);

			return res.json(documents);
		} catch (error) {
			console.error("Error uploading documents:", error);
			return res
				.status(500)
				.json({ message: "Error uploading documents" });
		}
	}
);

/**
 * @swagger
 * /api/loan-applications/{id}/documents:
 *   get:
 *     summary: Get documents for a loan application
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *       404:
 *         description: Loan application not found
 *       500:
 *         description: Server error
 */
// Get documents for a loan application
router.get(
	"/:id/documents",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const userId = req.user!.userId;

			// Check if the application exists and belongs to the user
			const existingApplication = await prisma.loanApplication.findFirst({
				where: {
					OR: [{ id }, { urlLink: id }],
					userId,
				},
			});

			if (!existingApplication) {
				return res
					.status(404)
					.json({ message: "Loan application not found" });
			}

			// Get all documents for the application
			const documents = await prisma.userDocument.findMany({
				where: {
					applicationId: existingApplication.id,
				},
			});

			return res.json(documents);
		} catch (error) {
			console.error("Error retrieving documents:", error);
			return res
				.status(500)
				.json({ message: "Failed to retrieve documents" });
		}
	}
);

/**
 * @swagger
 * /api/loan-applications/{id}/documents/{documentId}:
 *   patch:
 *     summary: Update a document's status
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, REJECTED]
 *     responses:
 *       200:
 *         description: Document status updated successfully
 *       404:
 *         description: Loan application or document not found
 *       500:
 *         description: Server error
 */
// Update document status
router.patch(
	"/:id/documents/:documentId",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id, documentId } = req.params;
			const { status } = req.body;
			const userId = req.user!.userId;

			// Check if the application exists and belongs to the user
			const existingApplication = await prisma.loanApplication.findFirst({
				where: {
					OR: [{ id }, { urlLink: id }],
					userId,
				},
			});

			if (!existingApplication) {
				return res
					.status(404)
					.json({ message: "Loan application not found" });
			}

			// Update the document status
			const updatedDocument = await prisma.userDocument.update({
				where: {
					id: documentId,
					applicationId: existingApplication.id,
				},
				data: { status },
			});

			return res.json(updatedDocument);
		} catch (error) {
			console.error("Error updating document status:", error);
			return res.status(500).json({
				message: "Failed to update document status",
			});
		}
	}
);

/**
 * @swagger
 * /api/loan-applications/{id}/documents/{documentId}:
 *   delete:
 *     summary: Delete a document from a loan application
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       404:
 *         description: Loan application or document not found
 *       500:
 *         description: Server error
 */
// Delete document
router.delete(
	"/:id/documents/:documentId",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id, documentId } = req.params;
			const userId = req.user!.userId;

			// Check if the application exists and belongs to the user
			const existingApplication = await prisma.loanApplication.findFirst({
				where: {
					OR: [{ id }, { urlLink: id }],
					userId,
				},
			});

			if (!existingApplication) {
				return res
					.status(404)
					.json({ message: "Loan application not found" });
			}

			// Find and delete the document
			const document = await prisma.userDocument.findFirst({
				where: {
					id: documentId,
					applicationId: existingApplication.id,
					userId,
				},
			});

			if (!document) {
				return res.status(404).json({ message: "Document not found" });
			}

			// Delete the document from S3 and database
			try {
				await deleteFromS3(document.fileUrl);
			} catch (err) {
				console.error("Error deleting file from S3:", err);
			}

			await prisma.userDocument.delete({
				where: {
					id: documentId,
				},
			});

			return res.json({ message: "Document deleted successfully" });
		} catch (error) {
			console.error("Error deleting document:", error);
			return res
				.status(500)
				.json({ message: "Failed to delete document" });
		}
	}
);

/**
 * @swagger
 * /api/loan-applications/{id}:
 *   delete:
 *     summary: Delete a loan application (only incomplete applications)
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID or URL link
 *     responses:
 *       200:
 *         description: Loan application deleted successfully
 *       400:
 *         description: Cannot delete non-incomplete applications
 *       404:
 *         description: Loan application not found
 *       500:
 *         description: Server error
 */
// Delete a loan application (only incomplete applications)
router.delete("/:id", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const userId = req.user!.userId;

		// Check if the application exists and belongs to the user
		const existingApplication = await prisma.loanApplication.findFirst({
			where: {
				OR: [{ id }, { urlLink: id }],
				userId,
			},
			include: {
				documents: true,
			},
		});

		if (!existingApplication) {
			return res
				.status(404)
				.json({ message: "Loan application not found" });
		}

		// Only allow deletion of incomplete applications
		if (existingApplication.status !== "INCOMPLETE") {
			return res.status(400).json({
				message: "Only incomplete applications can be deleted",
			});
		}

		// Delete associated documents first
		if (existingApplication.documents.length > 0) {
			// Delete files from S3
			for (const document of existingApplication.documents) {
				try {
					await deleteFromS3(document.fileUrl);
				} catch (err) {
					console.error("Error deleting file from S3:", err);
				}
			}

			// Delete documents from database
			await prisma.userDocument.deleteMany({
				where: {
					applicationId: existingApplication.id,
				},
			});
		}

		// Delete the loan application
		await prisma.loanApplication.delete({
			where: { id: existingApplication.id },
		});

		return res.json({ message: "Loan application deleted successfully" });
	} catch (error) {
		console.error("Error deleting loan application:", error);
		return res
			.status(500)
			.json({ message: "Failed to delete loan application" });
	}
});

/**
 * @swagger
 * components:
 *   schemas:
 *     LoanApplication:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the loan application
 *         userId:
 *           type: string
 *           description: ID of the user who created the application
 *         productId:
 *           type: string
 *           description: ID of the selected loan product
 *         amount:
 *           type: number
 *           description: Loan amount requested
 *         term:
 *           type: number
 *           description: Loan term in months
 *         purpose:
 *           type: string
 *           description: Purpose of the loan
 *         monthlyRepayment:
 *           type: number
 *           description: Monthly repayment amount
 *         interestRate:
 *           type: number
 *           description: Interest rate percentage
 *         lateFee:
 *           type: number
 *           description: Late fee amount
 *         originationFee:
 *           type: number
 *           description: Origination fee amount
 *         legalFee:
 *           type: number
 *           description: Legal fee amount
 *         applicationFee:
 *           type: number
 *           description: Application fee amount
 *         netDisbursement:
 *           type: number
 *           description: Net amount to be disbursed after fees
 *         urlLink:
 *           type: string
 *           description: Unique URL link for the application
 *         status:
 *           type: string
 *           enum: [INCOMPLETE, PENDING, APPROVED, REJECTED, DISBURSED, CLOSED]
 *           description: Current status of the application
 *         appStep:
 *           type: number
 *           description: Current step in the application process (0-4)
 *         acceptTerms:
 *           type: boolean
 *           description: Whether the user has accepted the terms
 *         paidAppFee:
 *           type: boolean
 *           description: Whether the application fee has been paid
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the application was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the application was last updated
 *         product:
 *           $ref: '#/components/schemas/Product'
 *         documents:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Document'
 */

/**
 * @swagger
 * /api/loan-applications/{id}/documents/{documentId}:
 *   get:
 *     summary: Get a specific document for a loan application
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the loan application
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the document to retrieve
 *     responses:
 *       200:
 *         description: Document file stream
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: Not authorized to access this document
 *       404:
 *         description: Document or file not found
 *       500:
 *         description: Server error
 */
// Get a specific document
router.get("/:id/documents/:documentId", (async (
	req: Request,
	res: Response
) => {
	try {
		const { documentId } = req.params;

		// Get the document by its ID
		const document = await prisma.userDocument.findUnique({
			where: {
				id: documentId,
			},
		});

		if (!document) {
			return res.status(404).json({ error: "Document not found" });
		}

		// Stream file from S3
		try {
			const { stream, contentType, contentLength } = await getS3ObjectStream(document.fileUrl);
			
			// Set appropriate headers
			res.setHeader("Content-Type", contentType);
			if (contentLength) {
				res.setHeader("Content-Length", contentLength);
			}
			
			// Extract filename from S3 key for Content-Disposition
			const filename = document.fileUrl.split('/').pop() || 'document';
			res.setHeader(
				"Content-Disposition",
				`inline; filename="${filename}"`
			);

			// Stream the file
			stream.pipe(res);
			
			// Handle stream errors
			stream.on("error", (error) => {
				console.error("Error streaming file from S3:", error);
				if (!res.headersSent) {
					res.status(500).json({ error: "Error streaming file" });
				}
			});
		} catch (s3Error) {
			console.error("Error fetching from S3:", s3Error);
			return res.status(404).json({ error: "File not found in storage" });
		}

		return res;
	} catch (error) {
		console.error("Error serving document:", error);
		if (!res.headersSent) {
			return res.status(500).json({ error: "Internal server error" });
		}
		return res;
	}
}) as RequestHandler);

/**
 * @swagger
 * /api/loan-applications/{id}/complete-attestation:
 *   post:
 *     summary: Complete attestation for loan application
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               attestationType:
 *                 type: string
 *                 enum: [IMMEDIATE, MEETING]
 *               attestationVideoWatched:
 *                 type: boolean
 *               attestationTermsAccepted:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Attestation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       400:
 *         description: Invalid request or application not in correct status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - not your application
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
// Complete attestation (user endpoint)
router.post(
	"/:id/complete-attestation",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const {
				attestationType,
				attestationVideoWatched,
				attestationTermsAccepted,
			} = req.body;
			const userId = req.user?.userId;

			console.log(
				`User ${userId} completing attestation for application ${id}`
			);

			// Get the application to check ownership and current status
			const application = await prisma.loanApplication.findUnique({
				where: { id },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							phoneNumber: true,
						},
					},
					product: true,
				},
			});

			if (!application) {
				return res
					.status(404)
					.json({ message: "Application not found" });
			}

			// Check ownership
			if (application.userId !== userId) {
				return res.status(403).json({ message: "Access denied" });
			}

			// Validate current status
			if (application.status !== "PENDING_ATTESTATION") {
				return res.status(400).json({
					message: `Application must be in PENDING_ATTESTATION status. Current status: ${application.status}`,
				});
			}

			// Validate attestation data
			if (attestationType === "IMMEDIATE") {
				if (!attestationVideoWatched || !attestationTermsAccepted) {
					return res.status(400).json({
						message:
							"For immediate attestation, video must be watched and terms must be accepted",
					});
				}
			} else {
				return res.status(400).json({
					message:
						"Invalid attestation type. Only IMMEDIATE attestation is available for users.",
				});
			}

			// Process the status change in a transaction to ensure loan creation
			const updatedApplication = await prisma.$transaction(async (tx) => {
							// Update the application with attestation completion
			const updated = await tx.loanApplication.update({
				where: { id },
				data: {
					status: "CERT_CHECK",
					attestationType: "IMMEDIATE",
					attestationCompleted: true,
					attestationDate: new Date(),
					attestationVideoWatched: true,
					attestationTermsAccepted: true,
				},
					include: {
						user: {
							select: {
								id: true,
								fullName: true,
								phoneNumber: true,
								email: true,
							},
						},
						product: {
							select: {
								id: true,
								name: true,
								code: true,
							},
						},
					},
				});

				// Create loan and repayment schedule when moving to PENDING_SIGNATURE
				try {
					const { createLoanOnPendingSignature } = require('../lib/loanCreationUtils');
					await createLoanOnPendingSignature(id, tx);
					console.log(`Loan and repayment schedule created for application ${id} during user attestation completion`);
				} catch (error) {
					console.error(`Failed to create loan for application ${id}:`, error);
					// Don't fail the transaction, just log the error
				}

				return updated;
			});

					// Track the status change in history
		await trackApplicationStatusChange(
			prisma,
			id,
			"PENDING_ATTESTATION",
			"CERT_CHECK",
			userId,
			"Immediate attestation completed by user",
			"Immediate attestation completed by user - proceeding to certificate check",
				{
					attestationType: "IMMEDIATE",
					attestationVideoWatched: true,
					attestationTermsAccepted: true,
					completedBy: userId,
					completedAt: new Date().toISOString(),
				}
			);

	// Send WhatsApp notification for attestation completion
	if (updatedApplication.amount && updatedApplication.user?.fullName) {
		console.log(`📱 Sending WhatsApp attestation complete notification to ${updatedApplication.user.phoneNumber}`);
		whatsappService.sendAttestationCompleteNotification({
			to: updatedApplication.user.phoneNumber,
			fullName: updatedApplication.user.fullName,
			productName: updatedApplication.product.name,
			amount: updatedApplication.amount.toFixed(2)
		}).then(result => {
			if (result.success) {
				console.log(`✅ WhatsApp attestation complete notification sent successfully for application ${id}`);
			} else {
				console.error(`❌ Failed to send WhatsApp attestation complete notification for application ${id}: ${result.error}`);
			}
		}).catch(error => {
			console.error('❌ Error sending WhatsApp attestation complete notification:', error);
		});
	} else {
		console.log(`⚠️ Skipping WhatsApp notification - missing data. Amount: ${updatedApplication.amount}, FullName: ${updatedApplication.user?.fullName}`);
	}

			console.log(
				`Attestation completed successfully for application ${id} by user ${userId}`
			);
			return res.json(updatedApplication);
		} catch (error) {
			console.error("Error completing attestation:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/loan-applications/{id}/history:
 *   get:
 *     summary: Get loan application status history for current user
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan application ID
 *     responses:
 *       200:
 *         description: Application history timeline
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 applicationId:
 *                   type: string
 *                 currentStatus:
 *                   type: string
 *                 timeline:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       applicationId:
 *                         type: string
 *                       previousStatus:
 *                         type: string
 *                       newStatus:
 *                         type: string
 *                       changedBy:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                       notes:
 *                         type: string
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
// Get application history timeline for current user
router.get("/:id/history", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const userId = req.user!.userId;
		console.log(`Fetching history for user application: ${id}`);

		// First check if the application exists and belongs to the user
		const application = await prisma.loanApplication.findFirst({
			where: {
				OR: [{ id }, { urlLink: id }],
				userId,
			},
			select: {
				id: true,
				status: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		if (!application) {
			return res.status(404).json({ message: "Application not found" });
		}

		// Get the application history
		const history = await prisma.loanApplicationHistory.findMany({
			where: { applicationId: application.id },
			orderBy: { createdAt: "desc" },
		});

		// Include the creation event as the first history entry
		const timeline = [
			...history,
			{
				id: "initial",
				applicationId: application.id,
				previousStatus: null,
				newStatus: "INCOMPLETE", // Initial status
				changedBy: "SYSTEM",
				changeReason: "Application created",
				notes: null,
				metadata: null,
				createdAt: application.createdAt,
			},
		];

		// Sort by created date, newest first
		timeline.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() -
				new Date(a.createdAt).getTime()
		);

		return res.status(200).json({
			applicationId: application.id,
			currentStatus: application.status,
			timeline,
		});
	} catch (error) {
		console.error(`Error fetching application history: ${error}`);
		return res.status(500).json({
			message: "Error fetching application history",
			error: (error as Error).message,
		});
	}
});

/**
 * @swagger
 * /api/loan-applications/{id}/request-live-call:
 *   post:
 *     summary: Request live video call attestation for loan application
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The loan application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               attestationType:
 *                 type: string
 *                 enum: [MEETING]
 *               reason:
 *                 type: string
 *                 description: Optional reason for requesting live call (e.g., "terms_rejected")
 *                 example: "terms_rejected"
 *     responses:
 *       200:
 *         description: Live call request submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       400:
 *         description: Invalid request or application not in correct status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - not your application
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
		// Request live video call attestation (user endpoint)
router.post(
	"/:id/request-live-call",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { attestationType, reason } = req.body;
			const userId = req.user?.userId;

			console.log(
				`User ${userId} requesting live call for application ${id}${reason ? ` (reason: ${reason})` : ''}`
			);

			// Get the application to check ownership and current status
			const application = await prisma.loanApplication.findUnique({
				where: { id },
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							phoneNumber: true,
						},
					},
					product: true,
				},
			});

			if (!application) {
				return res
					.status(404)
					.json({ message: "Application not found" });
			}

			// Check ownership
			if (application.userId !== userId) {
				return res.status(403).json({ message: "Access denied" });
			}

			// Validate current status
			if (application.status !== "PENDING_ATTESTATION") {
				return res.status(400).json({
					message: `Application must be in PENDING_ATTESTATION status. Current status: ${application.status}`,
				});
			}

			// Validate attestation type
			if (attestationType !== "MEETING") {
				return res.status(400).json({
					message:
						"Invalid attestation type. Only MEETING is allowed for live calls.",
				});
			}

			// Determine attestation notes based on reason
			let attestationNotes = "Live video call requested by user";
			let historyNotes = "Live video call attestation requested by user";
			
			if (reason === "terms_rejected") {
				attestationNotes = "Live video call requested after terms rejection - user needs clarification";
				historyNotes = "Live video call requested after user rejected terms - needs legal advisor consultation";
			}

			// Update the application with live call request
			const updatedApplication = await prisma.loanApplication.update({
				where: { id },
				data: {
					attestationType: "MEETING",
					attestationCompleted: false,
					attestationDate: null,
					attestationNotes: attestationNotes,
					attestationVideoWatched: false,
					attestationTermsAccepted: false,
					meetingCompletedAt: null,
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							phoneNumber: true,
							email: true,
						},
					},
					product: {
						select: {
							id: true,
							name: true,
							code: true,
						},
					},
				},
			});

			// Track the status change in history
			await trackApplicationStatusChange(
				prisma,
				id,
				"PENDING_ATTESTATION",
				"PENDING_ATTESTATION",
				userId,
				historyNotes,
				historyNotes,
				{
					attestationType: "MEETING",
					requestedBy: userId,
					requestedAt: new Date().toISOString(),
					status: "LIVE_CALL_REQUESTED",
					reason: reason || "user_request",
				}
			);

			console.log(
				`Live call request submitted successfully for application ${id} by user ${userId}`
			);
			return res.json(updatedApplication);
		} catch (error) {
			console.error("Error requesting live call:", error);
			return res.status(500).json({ message: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/loan-applications/{id}/link-documents:
 *   post:
 *     summary: Link existing documents to a loan application
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentIds
 *               - documentTypes
 *             properties:
 *               documentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of existing document IDs to link
 *               documentTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of document types corresponding to the document IDs
 *     responses:
 *       200:
 *         description: Documents linked successfully
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Loan application not found
 *       500:
 *         description: Server error
 */
// Link existing documents to a loan application
router.post(
	"/:id/link-documents",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { documentIds, documentTypes } = req.body;

			// Ensure user is authenticated
			if (!req.user || !req.user.userId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const userId = req.user.userId;

			// Validate input
			if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
				return res.status(400).json({
					message: "Document IDs are required and must be a non-empty array",
				});
			}

			if (!documentTypes || !Array.isArray(documentTypes) || documentTypes.length !== documentIds.length) {
				return res.status(400).json({
					message: "Document types must be provided and match the number of document IDs",
				});
			}

			// Check if loan application exists and belongs to user
			const loanApplication = await prisma.loanApplication.findFirst({
				where: {
					OR: [{ id }, { urlLink: id }],
					userId,
				},
			});

			if (!loanApplication) {
				return res
					.status(404)
					.json({ message: "Loan application not found" });
			}

			// Verify that all documents exist and belong to the user
			const existingDocuments = await prisma.userDocument.findMany({
				where: {
					id: { in: documentIds },
					userId,
				},
			});

			if (existingDocuments.length !== documentIds.length) {
				return res.status(400).json({
					message: "Some documents not found or do not belong to you",
				});
			}

			// Create new document records linked to this application
			const linkedDocuments = await Promise.all(
				documentIds.map(async (documentId, index) => {
					const originalDoc = existingDocuments.find(doc => doc.id === documentId);
					return prisma.userDocument.create({
						data: {
							userId,
							applicationId: loanApplication.id,
							type: documentTypes[index],
							fileUrl: originalDoc!.fileUrl,
							status: "PENDING",
						},
					});
				})
			);

			return res.json(linkedDocuments);
		} catch (error) {
			console.error("Error linking documents:", error);
			return res
				.status(500)
				.json({ message: "Error linking documents" });
		}
	}
);

/**
 * @swagger
 * /api/loan-applications/{id}/fresh-offer-response:
 *   post:
 *     summary: Respond to a fresh offer (accept or reject)
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID or URL link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [accept, reject]
 *                 description: User's response to the fresh offer
 *     responses:
 *       200:
 *         description: Fresh offer response recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoanApplication'
 *       400:
 *         description: Invalid action or application not in correct status
 *       404:
 *         description: Loan application not found
 *       500:
 *         description: Server error
 */
// Respond to fresh offer (user endpoint)
router.post(
	"/:id/fresh-offer-response",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const { id } = req.params;
			const { action } = req.body;
			const userId = req.user!.userId;

			// Validate action
			if (!action || !["accept", "reject"].includes(action)) {
				return res.status(400).json({ 
					message: "Action must be either 'accept' or 'reject'" 
				});
			}

			// Check if the application exists and belongs to the user
			const existingApplication = await prisma.loanApplication.findFirst({
				where: {
					OR: [{ id }, { urlLink: id }],
					userId,
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							phoneNumber: true,
							email: true,
						},
					},
					product: {
						select: {
							id: true,
							name: true,
							code: true,
						},
					},
				},
			});

			if (!existingApplication) {
				return res.status(404).json({ 
					message: "Loan application not found" 
				});
			}

			// Check if application is in PENDING_FRESH_OFFER status
			if (existingApplication.status !== "PENDING_FRESH_OFFER") {
				return res.status(400).json({ 
					message: `Cannot respond to fresh offer. Application status: ${existingApplication.status}` 
				});
			}

			// Check if there's actually a fresh offer
			if (!existingApplication.freshOfferAmount) {
				return res.status(400).json({ 
					message: "No fresh offer found for this application" 
				});
			}

			let updatedApplication;
			let newStatus;
			let statusChangeReason;

			if (action === "accept") {
				// User accepts fresh offer - update application with fresh offer terms and proceed to PENDING_ATTESTATION
				newStatus = "PENDING_ATTESTATION";
				statusChangeReason = "User accepted fresh offer - proceed to attestation";

				updatedApplication = await prisma.loanApplication.update({
					where: { id: existingApplication.id },
					data: {
						status: newStatus,
						// Replace current terms with fresh offer terms
						amount: existingApplication.freshOfferAmount,
						term: existingApplication.freshOfferTerm,
						interestRate: existingApplication.freshOfferInterestRate,
						monthlyRepayment: existingApplication.freshOfferMonthlyRepayment,
						netDisbursement: existingApplication.freshOfferNetDisbursement,
						// Copy old fee structure
						originationFee: existingApplication.freshOfferOriginationFee,
						legalFee: existingApplication.freshOfferLegalFee,
						applicationFee: existingApplication.freshOfferApplicationFee,
						// Copy new fee structure
						stampingFee: existingApplication.freshOfferStampingFee,
						legalFeeFixed: existingApplication.freshOfferLegalFeeFixed,
						// Clear fresh offer fields since they're now accepted
						freshOfferAmount: null,
						freshOfferTerm: null,
						freshOfferInterestRate: null,
						freshOfferMonthlyRepayment: null,
						freshOfferNetDisbursement: null,
						freshOfferOriginationFee: null,
						freshOfferLegalFee: null,
						freshOfferApplicationFee: null,
						freshOfferStampingFee: null,
						freshOfferLegalFeeFixed: null,
						freshOfferNotes: null,
						freshOfferSubmittedAt: null,
						freshOfferSubmittedBy: null,
					},
					include: {
						user: {
							select: {
								id: true,
								fullName: true,
								phoneNumber: true,
								email: true,
							},
						},
						product: {
							select: {
								id: true,
								name: true,
								code: true,
							},
						},
					},
				});
			} else {
				// User rejects fresh offer - restore original terms and go back to PENDING_APPROVAL
				newStatus = "PENDING_APPROVAL";
				statusChangeReason = "User rejected fresh offer - restored original terms";

				updatedApplication = await prisma.loanApplication.update({
					where: { id: existingApplication.id },
					data: {
						status: newStatus,
						// Restore original terms if they exist
						amount: existingApplication.originalOfferAmount || existingApplication.amount,
						term: existingApplication.originalOfferTerm || existingApplication.term,
						interestRate: existingApplication.originalOfferInterestRate || existingApplication.interestRate,
						monthlyRepayment: existingApplication.originalOfferMonthlyRepayment || existingApplication.monthlyRepayment,
						netDisbursement: existingApplication.originalOfferNetDisbursement || existingApplication.netDisbursement,
						// Clear fresh offer fields
						freshOfferAmount: null,
						freshOfferTerm: null,
						freshOfferInterestRate: null,
						freshOfferMonthlyRepayment: null,
						freshOfferNetDisbursement: null,
						freshOfferNotes: null,
						freshOfferSubmittedAt: null,
						freshOfferSubmittedBy: null,
						// Clear original offer backup fields since they're restored
						originalOfferAmount: null,
						originalOfferTerm: null,
						originalOfferInterestRate: null,
						originalOfferMonthlyRepayment: null,
						originalOfferNetDisbursement: null,
					},
					include: {
						user: {
							select: {
								id: true,
								fullName: true,
								phoneNumber: true,
								email: true,
							},
						},
						product: {
							select: {
								id: true,
								name: true,
								code: true,
							},
						},
					},
				});
			}

			// Track the status change in history
			await trackApplicationStatusChange(
				prisma,
				existingApplication.id,
				"PENDING_FRESH_OFFER",
				newStatus,
				existingApplication.user?.fullName || "User",
				statusChangeReason,
				`User ${action}ed the fresh offer`,
				{
					userAction: action,
					userId: userId,
					freshOfferResponse: action,
					respondedAt: new Date().toISOString(),
					freshOfferDetails: {
						amount: existingApplication.freshOfferAmount,
						term: existingApplication.freshOfferTerm,
						interestRate: existingApplication.freshOfferInterestRate,
						monthlyRepayment: existingApplication.freshOfferMonthlyRepayment,
						netDisbursement: existingApplication.freshOfferNetDisbursement,
						notes: existingApplication.freshOfferNotes,
					},
				}
			);

			// Create notification for admin about user's response
			try {
				await prisma.notification.create({
					data: {
						userId: "ADMIN", // Special admin notification
						title: `Fresh Offer ${action === "accept" ? "Accepted" : "Rejected"}`,
						message: `${existingApplication.user.fullName} has ${action}ed the fresh offer for application ${existingApplication.id}`,
						type: "FRESH_OFFER_RESPONSE",
						priority: "HIGH",
						metadata: {
							applicationId: existingApplication.id,
							userResponse: action,
							userId: userId,
							userName: existingApplication.user.fullName,
							respondedAt: new Date().toISOString(),
							freshOfferDetails: {
								amount: existingApplication.freshOfferAmount,
								term: existingApplication.freshOfferTerm,
								interestRate: existingApplication.freshOfferInterestRate,
								monthlyRepayment: existingApplication.freshOfferMonthlyRepayment,
								netDisbursement: existingApplication.freshOfferNetDisbursement,
							},
						},
					},
				});
			} catch (notificationError) {
				console.error("Could not create admin notification:", notificationError);
			}

			console.log(`User ${userId} ${action}ed fresh offer for application ${existingApplication.id}`);
			return res.json(updatedApplication);

		} catch (error) {
			console.error("Error responding to fresh offer:", error);
			return res.status(500).json({
				message: "Failed to respond to fresh offer",
				error: error.message || "Unknown error",
			});
		}
	}
);

/**
 * @swagger
 * /api/loan-applications/{id}/kyc-status:
 *   get:
 *     summary: Check KYC requirements for a loan application
 *     tags: [Loan Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan application ID
 *     responses:
 *       200:
 *         description: KYC status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requiresKyc:
 *                   type: boolean
 *                   description: Whether KYC is required
 *                 hasDocuments:
 *                   type: boolean
 *                   description: Whether user has uploaded all KYC documents
 *                 isKycVerified:
 *                   type: boolean
 *                   description: Whether user is KYC verified
 *                 canProceed:
 *                   type: boolean
 *                   description: Whether application can proceed to approval
 *                 nextStep:
 *                   type: string
 *                   description: Next step for the application
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
router.get("/:id/kyc-status", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const userId = req.user!.userId;

		// Get the application and user details
		const application = await prisma.loanApplication.findFirst({
			where: {
				OR: [{ id }, { urlLink: id }],
				userId,
			},
			include: {
				user: {
					select: {
						kycStatus: true,
					},
				},
			},
		});

		if (!application) {
			return res.status(404).json({ message: "Application not found" });
		}

		// Check if user has uploaded all required KYC documents
		const hasDocuments = await userHasAllKycDocuments(userId);
		
		// Check if user is KYC verified
		const isKycVerified = application.user.kycStatus || false;
		
		// Determine if KYC is required - if user doesn't have documents AND is not verified
		const requiresKyc = !hasDocuments && !isKycVerified;
		
		// Can proceed if user has documents OR is verified
		const canProceed = hasDocuments || isKycVerified;
		
		// Determine next step
		let nextStep = "unknown";
		if (requiresKyc) {
			nextStep = "kyc_documents";
		} else if (canProceed) {
			nextStep = "pending_approval";
		}

		return res.json({
			requiresKyc,
			hasDocuments,
			isKycVerified,
			canProceed,
			nextStep,
		});
	} catch (error) {
		console.error("Error checking KYC status:", error);
		return res.status(500).json({ message: "Server error" });
	}
});

/**
 * GET /api/loan-applications/:applicationId/signing-url
 * Get signing URL for loan application (user-facing)
 */
router.get("/:applicationId/signing-url", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user!.userId;

        // Verify the application belongs to the authenticated user
        const application = await prisma.loanApplication.findFirst({
            where: { 
                id: applicationId,
                userId: userId
            }
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Find the loan associated with this application
        const loan = await prisma.loan.findFirst({
            where: { applicationId: applicationId }
        });

        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'No loan found for this application'
            });
        }

        // Get the user's signing URL from loan_signatories table
        const userSignatory = await prisma.loanSignatory.findFirst({
            where: { 
                loanId: loan.id,
                signatoryType: 'USER',
                status: 'PENDING'
            }
        });

        if (!userSignatory?.signingUrl) {
            return res.status(400).json({
                success: false,
                message: 'No signing URL available for this application'
            });
        }

        return res.json({
            success: true,
            data: {
                signingUrl: userSignatory.signingSlug
                    ? `${docusealConfig.baseUrl}/s/${userSignatory.signingSlug}`
                    : userSignatory.signingUrl,
                applicationId,
                loanId: loan.id
            }
        });

    } catch (error: any) {
        console.error('Error getting signing URL:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * GET /api/loan-applications/:loanId/agreement-download
 * Get download URL for signed loan agreement (user-facing)
 */
router.get("/:loanId/agreement-download", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
    try {
        const { loanId } = req.params;
        const userId = req.user!.userId;

        // Verify the loan belongs to the authenticated user
        const loan = await prisma.loan.findFirst({
            where: { 
                id: loanId,
                userId: userId
            }
        });

        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }

        // Check if the agreement is signed
        const { docusealService } = await import('../lib/docusealService');
        const agreementStatus = await docusealService.calculateAgreementStatus(loanId);

        if (agreementStatus !== 'SIGNED') {
            return res.status(400).json({
                success: false,
                message: 'Agreement is not yet fully signed'
            });
        }

        // Get download URL from DocuSeal service
        if (!loan.docusealSubmissionId) {
            return res.status(400).json({
                success: false,
                message: 'No DocuSeal submission found for this loan'
            });
        }

        const downloadUrl = await docusealService.getSignedDocumentDownloadUrl(loan.docusealSubmissionId);

        return res.json({
            success: true,
            data: {
                downloadUrl,
                loanId
            }
        });

    } catch (error: any) {
        console.error('Error getting agreement download URL:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * GET /api/loan-applications/:loanId/pki-pdf
 * Download PKI signed PDF directly (for PKI signing flow)
 */
router.get("/:loanId/pki-pdf", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { loanId } = req.params;
        const userId = req.user!.userId;

        // Verify the loan belongs to the authenticated user
        const loan = await prisma.loan.findFirst({
            where: { 
                id: loanId,
                userId: userId
            },
            select: {
                id: true,
                applicationId: true
            }
        });

        if (!loan) {
            res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
            return;
        }

        // Proxy request to signing orchestrator
        const signedPdfUrl = `${signingConfig.url}/api/signed/${loan.applicationId}/download`;

        console.log('Proxying PKI PDF request to:', signedPdfUrl);

        const response = await fetch(signedPdfUrl, {
            method: 'GET',
            headers: {
                'X-API-Key': signingConfig.apiKey
            }
        });

        if (!response.ok) {
            console.error('Signing orchestrator responded with error:', response.status, response.statusText);
            res.status(response.status).json({
                success: false,
                message: 'Signed PDF not available'
            });
            return;
        }

        // Get the PDF buffer from the orchestrator
        const pdfBuffer = await response.arrayBuffer();
        
        // Set headers for PDF response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="loan-agreement-${loanId}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.byteLength);
        
        // Send the PDF buffer
        res.send(Buffer.from(pdfBuffer));

    } catch (error: any) {
        console.error('Error downloading PKI signed PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to download signed PDF'
        });
    }
});

export default router;
