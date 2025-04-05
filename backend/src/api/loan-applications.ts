import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { nanoid } from "nanoid";
import multer from "multer";
import path from "path";
import { Request } from "express";

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = (multer as any).diskStorage({
	destination: function (_req: any, _file: any, cb: any) {
		cb(null, "uploads/");
	},
	filename: function (_req: any, file: any, cb: any) {
		cb(null, Date.now() + path.extname(file.originalname));
	},
});

const upload = (multer as any)({ storage: storage });

// Extend AuthRequest to include files
interface DocumentUploadRequest extends AuthRequest {
	files?: any[];
}

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

		res.json(loanApplication);
	} catch (error) {
		console.error("Error retrieving loan application:", error);
		res.status(500).json({
			message: "Failed to retrieve loan application",
		});
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

		res.json(loanApplications);
	} catch (error) {
		console.error("Error retrieving loan applications:", error);
		res.status(500).json({
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

		res.json(updatedApplication);
	} catch (error) {
		console.error("Error updating loan application:", error);
		res.status(500).json({ message: "Failed to update loan application" });
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

		res.json(updatedApplication);
	} catch (error) {
		console.error("Error updating application step:", error);
		res.status(500).json({ message: "Failed to update application step" });
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

			res.json(updatedApplication);
		} catch (error) {
			console.error("Error updating application status:", error);
			res.status(500).json({
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
// Upload documents for a loan application
router.post(
	"/:id/documents",
	authenticateToken,
	upload.array("documents"),
	async (req: DocumentUploadRequest, res) => {
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

			// Create document records for uploaded files
			const documents = req.files || [];
			const documentRecords = await Promise.all(
				documents.map(async (file: any) => {
					return prisma.userDocument.create({
						data: {
							userId,
							applicationId: existingApplication.id,
							type:
								file.originalname
									.split(".")
									.pop()
									?.toUpperCase() || "UNKNOWN",
							fileUrl: `/uploads/${file.filename}`,
							status: "PENDING",
						},
					});
				})
			);

			res.json(documentRecords);
		} catch (error) {
			console.error("Error uploading documents:", error);
			res.status(500).json({ message: "Failed to upload documents" });
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

			res.json(documents);
		} catch (error) {
			console.error("Error retrieving documents:", error);
			res.status(500).json({ message: "Failed to retrieve documents" });
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

			res.json(updatedDocument);
		} catch (error) {
			console.error("Error updating document status:", error);
			res.status(500).json({
				message: "Failed to update document status",
			});
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

export default router;
