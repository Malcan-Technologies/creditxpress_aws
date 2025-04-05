import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: API endpoints for managing loan products
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all active products or a specific product by code
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Product code to filter by
 *     responses:
 *       200:
 *         description: List of active products or a single product if code is provided
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.get("/", async (req, res) => {
	try {
		const { code } = req.query;

		// If code is provided, return specific product
		if (code) {
			const product = await prisma.product.findUnique({
				where: {
					code: code as string,
					isActive: true,
				},
				select: {
					id: true,
					code: true,
					name: true,
					description: true,
					minAmount: true,
					maxAmount: true,
					repaymentTerms: true,
					interestRate: true,
					eligibility: true,
					lateFee: true,
					originationFee: true,
					legalFee: true,
					applicationFee: true,
					requiredDocuments: true,
					features: true,
					loanTypes: true,
				},
			});

			if (!product) {
				return res.status(404).json({ message: "Product not found" });
			}

			return res.json({
				...product,
				// Convert fees to proper format
				originationFee: Number(product.originationFee), // Percentage
				legalFee: Number(product.legalFee), // Fixed amount
				applicationFee: Number(product.applicationFee), // Fixed amount
			});
		}

		// Otherwise return all active products
		const products = await prisma.product.findMany({
			where: {
				isActive: true,
			},
			select: {
				id: true,
				code: true,
				name: true,
				description: true,
				minAmount: true,
				maxAmount: true,
				repaymentTerms: true,
				interestRate: true,
				eligibility: true,
				lateFee: true,
				originationFee: true,
				legalFee: true,
				applicationFee: true,
				requiredDocuments: true,
				features: true,
				loanTypes: true,
			},
			orderBy: {
				createdAt: "asc",
			},
		});

		return res.json(products);
	} catch (error) {
		console.error("Error fetching products:", error);
		return res.status(500).json({ message: "Error fetching products" });
	}
});

// This endpoint is for admin use and should be protected
router.post("/", authenticateToken, async (req, res) => {
	try {
		const data = req.body;

		const product = await prisma.product.create({
			data: {
				code: data.code,
				name: data.name,
				description: data.description,
				minAmount: data.minAmount,
				maxAmount: data.maxAmount,
				repaymentTerms: data.repaymentTerms,
				interestRate: data.interestRate,
				eligibility: data.eligibility,
				lateFee: data.lateFee,
				originationFee: data.originationFee,
				legalFee: data.legalFee,
				applicationFee: data.applicationFee,
				requiredDocuments: data.requiredDocuments,
				features: data.features,
				loanTypes: data.loanTypes,
			},
		});

		return res.status(201).json(product);
	} catch (error) {
		console.error("Error creating product:", error);
		return res.status(500).json({ message: "Failed to create product" });
	}
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the product
 *         code:
 *           type: string
 *           description: Product code
 *         name:
 *           type: string
 *           description: Product name
 *         description:
 *           type: string
 *           description: Product description
 *         minAmount:
 *           type: number
 *           description: Minimum loan amount
 *         maxAmount:
 *           type: number
 *           description: Maximum loan amount
 *         repaymentTerms:
 *           type: array
 *           items:
 *             type: number
 *           description: Available repayment terms in months
 *         interestRate:
 *           type: number
 *           description: Interest rate percentage
 *         eligibility:
 *           type: array
 *           items:
 *             type: string
 *           description: Eligibility criteria
 *         isActive:
 *           type: boolean
 *           description: Whether the product is active
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the product was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the product was last updated
 *     Document:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the document
 *         loanApplicationId:
 *           type: string
 *           description: ID of the loan application this document belongs to
 *         documentType:
 *           type: string
 *           description: Type of document
 *         documentUrl:
 *           type: string
 *           description: URL to the document
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *           description: Status of the document verification
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the document was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the document was last updated
 */

export default router;
