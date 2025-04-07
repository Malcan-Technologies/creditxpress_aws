import { useState, useEffect } from "react";
import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useSearchParams } from "next/navigation";
import Cookies from "js-cookie";

interface Product {
	id: string;
	code: string;
	name: string;
	description: string;
	minAmount: number;
	maxAmount: number;
	repaymentTerms: number[];
	interestRate: number;
	eligibility: string[];
	features: string[];
	lateFee: number;
	originationFee: number;
	legalFee: number;
	applicationFee: number;
	isActive: boolean;
}

interface ProductSelectionFormProps {
	products: Product[];
	onSubmit: (values: { productId: string }) => void;
	onProductSelect: (productId: string | null) => void;
	onProductPreview: (productId: string | null) => void;
	showBackButton?: boolean;
	selectedProduct: Product | null;
}

export default function ProductSelectionForm({
	products,
	onSubmit,
	onProductSelect,
	onProductPreview,
	showBackButton = true,
	selectedProduct,
}: ProductSelectionFormProps) {
	const searchParams = useSearchParams();
	const [selected, setSelected] = useState<string>(selectedProduct?.id || "");
	const [error, setError] = useState<string>("");
	const [loading, setLoading] = useState(false);

	// Filter to only show active products
	const activeProducts = products.filter((product) => product.isActive);

	useEffect(() => {
		setSelected(selectedProduct?.id || "");
	}, [selectedProduct]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selected) {
			setError("Please select a product");
			return;
		}

		try {
			setLoading(true);
			setError("");

			// Get application ID from URL params
			const applicationId = searchParams.get("applicationId");
			const productCode = searchParams.get("productCode");

			if (!selectedProduct) {
				throw new Error("No product selected");
			}

			const token = localStorage.getItem("token") || Cookies.get("token");
			if (!token) {
				throw new Error("No authentication token found");
			}

			// If we're in an existing flow, update the application
			if (applicationId) {
				console.log("Updating existing application:", applicationId);

				const response = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}`,
					{
						method: "PATCH",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${token}`,
						},
						body: JSON.stringify({
							productId: selected,
							appStep: 1,
							interestRate: selectedProduct.interestRate,
							lateFee: selectedProduct.lateFee,
							originationFee: selectedProduct.originationFee,
							legalFee: selectedProduct.legalFee,
							applicationFee: selectedProduct.applicationFee,
							status: "INCOMPLETE",
						}),
					}
				);

				if (!response.ok) {
					const errorData = await response.json().catch(() => null);
					console.error("Error response:", errorData);
					throw new Error(
						errorData?.message ||
							`Failed to update application: ${response.status} ${response.statusText}`
					);
				}

				const data = await response.json();
				console.log("Application updated:", data);

				// Call the onSubmit handler with the updated application
				onSubmit({ productId: selected });
			} else {
				// For new applications, just call the onSubmit handler
				onSubmit({ productId: selected });
			}
		} catch (err) {
			console.error("Error submitting form:", err);
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setLoading(false);
		}
	};

	const handleSelect = (productId: string) => {
		setSelected(productId);
		onProductSelect(productId);
		onProductPreview(productId);
	};

	return (
		<Box component="form" onSubmit={handleSubmit} sx={{ width: "100%" }}>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: "repeat(2, 1fr)",
					gap: 2,
					mb: 3,
				}}
			>
				{activeProducts.map((product) => (
					<Card
						key={product.id}
						sx={{
							cursor: "pointer",
							border:
								selected === product.id
									? "2px solid #1976d2"
									: "none",
							"&:hover": {
								border: "2px solid #1976d2",
							},
						}}
						onClick={() => handleSelect(product.id)}
					>
						<CardContent>
							<Box
								sx={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									mb: 2,
								}}
							>
								<Typography variant="h6" component="div">
									{product.name}
								</Typography>
								{selected === product.id && (
									<CheckCircleIcon color="primary" />
								)}
							</Box>
							<Typography
								variant="body2"
								color="text.secondary"
								sx={{ mb: 2 }}
							>
								{product.description}
							</Typography>
							<Typography variant="body2">
								Loan Amount: $
								{product.minAmount.toLocaleString()} - $
								{product.maxAmount.toLocaleString()}
							</Typography>
							<Typography variant="body2">
								Interest Rate: {product.interestRate}% per month
							</Typography>
						</CardContent>
					</Card>
				))}
			</Box>
			{error && (
				<Typography color="error" sx={{ mb: 2 }}>
					{error}
				</Typography>
			)}
			<Box sx={{ display: "flex", justifyContent: "flex-end" }}>
				<Button
					type="submit"
					variant="contained"
					disabled={!selected || loading}
				>
					{loading ? "Processing..." : "Continue"}
				</Button>
			</Box>
		</Box>
	);
}
