import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {
	authenticateToken,
	AuthRequest,
	FileAuthRequest,
} from "../middleware/auth";
import { nanoid } from "nanoid";
import multer from "multer";
import path from "path";
import fs from "fs";
import { RequestHandler } from "express";

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = (multer as any).diskStorage({
	destination: (
		_req: Request,
		_file: Express.Multer.File,
		cb: (error: Error | null, destination: string) => void
	) => {
		cb(null, "uploads/");
	},
	filename: (
		_req: Request,
		file: Express.Multer.File,
		cb: (error: Error | null, filename: string) => void
	) => {
		const ext = path.extname(file.originalname);
		cb(null, `${Date.now()}${ext}`);
	},
});

// Set max file size to 50MB
const upload = multer({
	storage,
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
router.post("/", authenticateToken, async (req: AuthRequest, res) => {
	try {
		const { productId, amount, term, purpose, appStep, product } = req.body;
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
			// Include product fees
			interestRate: product.interestRate,
			lateFee: product.lateFee,
			originationFee: product.originationFee,
			legalFee: product.legalFee,
			applicationFee: product.applicationFee,
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
router.get("/:id", authenticateToken, async (req: AuthRequest, res) => {
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
router.get("/", authenticateToken, async (req: AuthRequest, res) => {
	try {
		const userId = req.user!.userId;

		const loanApplications = await prisma.loanApplication.findMany({
			where: { userId },
			include: {
				product: true,
			},
			orderBy: { createdAt: "desc" },
		});

		return res.json(loanApplications);
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
router.patch("/:id", authenticateToken, async (req: AuthRequest, res) => {
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
		});

		if (!existingApplication) {
			return res
				.status(404)
				.json({ message: "Loan application not found" });
		}

		// Update the loan application
		const updatedApplication = await prisma.loanApplication.update({
			where: { id: existingApplication.id },
			data: updateData,
		});

		return res.json(updatedApplication);
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
router.patch("/:id/step", authenticateToken, async (req: AuthRequest, res) => {
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
	authenticateToken,
	async (req: AuthRequest, res) => {
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
			});

			if (!existingApplication) {
				return res
					.status(404)
					.json({ message: "Loan application not found" });
			}

			// Update the application status
			const updatedApplication = await prisma.loanApplication.update({
				where: { id: existingApplication.id },
				data: { status },
			});

			return res.json(updatedApplication);
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
	authenticateToken,
	upload.array("documents"),
	async (req: FileAuthRequest, res) => {
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

			// Create document records
			const documents = await Promise.all(
				files.map(async (file, index) => {
					return prisma.userDocument.create({
						data: {
							userId,
							applicationId: id,
							type: documentTypes[index],
							fileUrl: `/uploads/${file.filename}`,
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
	authenticateToken,
	async (req: AuthRequest, res) => {
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
	authenticateToken,
	async (req: AuthRequest, res) => {
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
	authenticateToken,
	async (req: AuthRequest, res) => {
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

			// Delete the document from storage and database
			const filePath = path.join(process.cwd(), document.fileUrl);

			try {
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
			} catch (err) {
				console.error("Error deleting file from storage:", err);
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

		// Get the file path
		const filePath = path.join(
			process.cwd(),
			document.fileUrl.replace(/^\//, "") // Remove leading slash if present
		);

		// Check if file exists
		if (!fs.existsSync(filePath)) {
			console.error("File not found at path:", filePath);
			return res.status(404).json({ error: "File not found" });
		}

		// Get file extension and set appropriate content type
		const fileExtension = path.extname(document.fileUrl).toLowerCase();
		let contentType = "application/octet-stream";

		switch (fileExtension) {
			case ".pdf":
				contentType = "application/pdf";
				break;
			case ".jpg":
			case ".jpeg":
				contentType = "image/jpeg";
				break;
			case ".png":
				contentType = "image/png";
				break;
			case ".doc":
			case ".docx":
				contentType =
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
				break;
			case ".xls":
			case ".xlsx":
				contentType =
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
				break;
		}

		// Set appropriate headers
		res.setHeader("Content-Type", contentType);
		res.setHeader(
			"Content-Disposition",
			`inline; filename="${path.basename(
				document.fileUrl
			)}${fileExtension}"`
		);

		// Stream the file
		const fileStream = fs.createReadStream(filePath);
		fileStream.pipe(res);

		// Handle errors
		fileStream.on("error", (error) => {
			console.error("Error streaming file:", error);
			if (!res.headersSent) {
				res.status(500).json({ error: "Error streaming file" });
			}
		});

		return res;
	} catch (error) {
		console.error("Error serving document:", error);
		if (!res.headersSent) {
			return res.status(500).json({ error: "Internal server error" });
		}
		return res;
	}
}) as RequestHandler);

export default router;
