import { Router, RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router();

interface ProductInput {
	code: string;
	name: string;
	description: string;
	minAmount: number;
	maxAmount: number;
	repaymentTerms: number[];
	interestRate: number;
	eligibility: string[];
	lateFee: number;
	originationFee: number;
	legalFee: number;
	applicationFee: number;
	requiredDocuments: string[];
	features: string[];
	loanTypes: string[];
	isActive?: boolean;
}

// interface Product extends ProductInput {
// 	id: string;
// 	createdAt: Date;
// 	updatedAt: Date;
// }

interface GetProductsQuery {
	code?: string;
}

interface ProductParams {
	id: string;
}

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
const getProducts: RequestHandler<{}, any, any, GetProductsQuery> = async (
	req,
	res
) => {
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
					isActive: true,
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

		// Otherwise return all products
		const products = await prisma.product.findMany({
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
				isActive: true,
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
};

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductInput'
 *     responses:
 *       201:
 *         description: Product created successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
const createProduct: RequestHandler<{}, any, ProductInput> = async (
	req,
	res
) => {
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
				isActive: data.isActive !== undefined ? data.isActive : true,
			},
		});

		return res.status(201).json(product);
	} catch (error) {
		console.error("Error creating product:", error);
		return res.status(500).json({ message: "Failed to create product" });
	}
};

/**
 * @swagger
 * /api/products/{id}:
 *   patch:
 *     summary: Update a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductInput'
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
const updateProduct: RequestHandler<ProductParams, any, ProductInput> = async (
	req,
	res
) => {
	try {
		const { id } = req.params;
		const data = req.body;

		// Check if product exists
		const existingProduct = await prisma.product.findUnique({
			where: { id },
		});

		if (!existingProduct) {
			return res.status(404).json({ message: "Product not found" });
		}

		// Update product
		const updatedProduct = await prisma.product.update({
			where: { id },
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
				isActive: data.isActive,
			},
		});

		return res.json(updatedProduct);
	} catch (error) {
		console.error("Error updating product:", error);
		return res.status(500).json({ message: "Failed to update product" });
	}
};

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
const deleteProduct: RequestHandler<ProductParams> = async (req, res) => {
	try {
		const { id } = req.params;

		// Check if product exists
		const existingProduct = await prisma.product.findUnique({
			where: { id },
		});

		if (!existingProduct) {
			return res.status(404).json({ message: "Product not found" });
		}

		// Delete product
		await prisma.product.delete({
			where: { id },
		});

		return res.json({ message: "Product deleted successfully" });
	} catch (error) {
		console.error("Error deleting product:", error);
		return res.status(500).json({ message: "Failed to delete product" });
	}
};

router.get("/", getProducts);
router.post("/", authenticateToken, createProduct as unknown as RequestHandler);
router.patch(
	"/:id",
	authenticateToken,
	updateProduct as unknown as RequestHandler
);
router.delete(
	"/:id",
	authenticateToken,
	deleteProduct as unknown as RequestHandler
);

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
 *     ProductInput:
 *       type: object
 *       properties:
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
 *         lateFee:
 *           type: number
 *           description: Late payment fee percentage
 *         originationFee:
 *           type: number
 *           description: Origination fee percentage
 *         legalFee:
 *           type: number
 *           description: Legal fee amount
 *         applicationFee:
 *           type: number
 *           description: Application fee amount
 *         requiredDocuments:
 *           type: array
 *           items:
 *             type: string
 *           description: Required document types
 *         features:
 *           type: array
 *           items:
 *             type: string
 *           description: Product features
 *         loanTypes:
 *           type: array
 *           items:
 *             type: string
 *           description: Available loan purpose types
 *         isActive:
 *           type: boolean
 *           description: Whether the product is active
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
