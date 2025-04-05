import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { RequiredDocument } from "@prisma/client";

export async function GET(
	request: Request,
	{ params }: { params: { id: string } }
) {
	try {
		const product = await prisma.product.findUnique({
			where: {
				id: params.id,
			},
			select: {
				id: true,
				name: true,
				description: true,
				minAmount: true,
				maxAmount: true,
				interestRate: true,
				repaymentTerms: true,
				loanTypes: true,
				requiredDocuments: true,
			},
		});

		if (!product) {
			return NextResponse.json(
				{ error: "Product not found" },
				{ status: 404 }
			);
		}

		// Transform the data to match the expected format
		const response = {
			name: product.name,
			requiredDocuments: product.requiredDocuments.map(
				(doc: RequiredDocument) => ({
					id: doc.id,
					name: doc.name,
					type: doc.type,
				})
			),
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error("Error fetching product:", error);
		return NextResponse.json(
			{ error: "Failed to fetch product details" },
			{ status: 500 }
		);
	}
}
