"use client";

import { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import { useRouter } from "next/navigation";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";
import { toast } from "sonner";
import {
	PlusIcon,
	MagnifyingGlassIcon,
	PencilIcon,
	XMarkIcon,
	CubeIcon,
	ArrowPathIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";

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
	lateFeeRate: number;
	lateFeeFixedAmount: number;
	lateFeeFrequencyDays: number;
	originationFee: number;
	legalFee: number;
	applicationFee: number;
	stampingFee: number;
	legalFeeFixed: number;
	legalFeeType: 'PERCENTAGE' | 'FIXED';
	legalFeeValue: number;
	requiredDocuments: string[];
	features: string[];
	loanTypes: string[];
	isActive: boolean;
	collateralRequired: boolean;
	createdAt: string;
	updatedAt: string;
}

interface ProductFormData extends Omit<Product, "repaymentTerms"> {
	repaymentTerms: string[];
}

// Helper function to generate product code from name (camelCase)
function generateProductCode(name: string): string {
	if (!name.trim()) return "";
	return name
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, '') // Remove special chars
		.split(/\s+/)
		.filter(word => word.length > 0)
		.map((word, index) => 
			index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
		)
		.join('');
}

export default function AdminProductsPage() {
	const router = useRouter();
	const [products, setProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [refreshing, setRefreshing] = useState(false);
	const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
	const [editingProduct, setEditingProduct] = useState<Product | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [formData, setFormData] = useState<Partial<ProductFormData>>({});
	const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState(false);
	const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
	const [repaymentTermsInput, setRepaymentTermsInput] = useState("");

	useEffect(() => {
		fetchProducts();
	}, []);

	const fetchProducts = async () => {
		try {
			setLoading(true);
			setError(null);
			// Fetch products directly from backend
			const backendUrl = process.env.NEXT_PUBLIC_API_URL;
			const data = await fetchWithAdminTokenRefresh<Product[]>(
				`${backendUrl}/api/products`
			);
			setProducts(data);
		} catch (err) {
			console.error("Error fetching products:", err);
			setError("Failed to load products. Please try again later.");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	const handleRefresh = async () => {
		setRefreshing(true);
		try {
			await fetchProducts();
			toast.success("Products refreshed successfully");
		} catch (error) {
			console.error("Error refreshing products:", error);
			toast.error("Failed to refresh products");
		}
	};

	const handleEdit = (product: Product) => {
		setEditingProduct(product);
		setFormData({
			...product,
			repaymentTerms: [...product.repaymentTerms].map(String),
			eligibility: [...product.eligibility],
			requiredDocuments: [...product.requiredDocuments],
			features: [...product.features],
			loanTypes: [...product.loanTypes],
			legalFeeType: product.legalFeeType || 'FIXED',
			legalFeeValue: product.legalFeeValue ?? product.legalFeeFixed ?? 0,
		});
		setRepaymentTermsInput(product.repaymentTerms.join(", "));
		setIsCodeManuallyEdited(true); // Existing products have their own codes
		setShowAdditionalDetails(false);
		setIsModalOpen(true);
	};

	const handleCreate = () => {
		setEditingProduct(null);
		setFormData({
			code: "",
			name: "",
			description: "",
			minAmount: 0,
			maxAmount: 0,
			repaymentTerms: ["3", "6", "12"],
			interestRate: 1.5,
			eligibility: [],
			lateFeeRate: 0.022,
			lateFeeFixedAmount: 0,
			lateFeeFrequencyDays: 7,
			originationFee: 0,
			legalFee: 0,
			applicationFee: 0,
			stampingFee: 0.5,
			legalFeeFixed: 0,
			legalFeeType: 'FIXED',
			legalFeeValue: 0,
			requiredDocuments: [],
			features: [],
			loanTypes: [],
			isActive: true,
			collateralRequired: false,
		});
		setRepaymentTermsInput("3, 6, 12");
		setIsCodeManuallyEdited(false);
		setShowAdditionalDetails(false);
		setIsModalOpen(true);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null); // Clear previous errors
		
		try {
			// Validate required fields
			const validationErrors: string[] = [];

			if (!formData.code?.trim()) {
				validationErrors.push("Product Code is required");
			}
			if (!formData.name?.trim()) {
				validationErrors.push("Product Name is required");
			}
			if (!formData.description?.trim()) {
				validationErrors.push("Description is required");
			}
			if (formData.minAmount === undefined || formData.minAmount === null || formData.minAmount < 0) {
				validationErrors.push("Minimum Amount must be a valid positive number");
			}
			if (formData.maxAmount === undefined || formData.maxAmount === null || formData.maxAmount <= 0) {
				validationErrors.push("Maximum Amount must be greater than 0");
			}
			if (formData.minAmount !== undefined && formData.maxAmount !== undefined && formData.minAmount > formData.maxAmount) {
				validationErrors.push("Minimum Amount cannot be greater than Maximum Amount");
			}
			if (formData.interestRate === undefined || formData.interestRate === null || formData.interestRate < 0) {
				validationErrors.push("Interest Rate must be a valid positive number or 0");
			}
			if (formData.lateFeeRate === undefined || formData.lateFeeRate === null || formData.lateFeeRate < 0) {
				validationErrors.push("Late Fee Rate must be a valid positive number or 0");
			}
			if (formData.lateFeeFixedAmount === undefined || formData.lateFeeFixedAmount === null || formData.lateFeeFixedAmount < 0) {
				validationErrors.push("Fixed Late Fee Amount must be a valid positive number or 0");
			}
			if (formData.lateFeeFrequencyDays === undefined || formData.lateFeeFrequencyDays === null || formData.lateFeeFrequencyDays <= 0) {
				validationErrors.push("Fixed Fee Frequency must be greater than 0");
			}
			if (formData.stampingFee === undefined || formData.stampingFee === null || formData.stampingFee < 0) {
				validationErrors.push("Stamping Fee must be a valid positive number or 0");
			}
			if (formData.legalFeeValue === undefined || formData.legalFeeValue === null || formData.legalFeeValue < 0) {
				validationErrors.push("Legal Fee Value must be a valid positive number or 0");
			}
			
			// Validate repayment terms - parse from raw input string
			const validTerms = repaymentTermsInput
				.split(",")
				.map((term) => {
					const num = parseInt(term.trim());
					return isNaN(num) ? null : num;
				})
				.filter((num): num is number => num !== null && num > 0);
			
			if (validTerms.length === 0) {
				validationErrors.push("At least one valid Repayment Term is required (positive numbers only)");
			}

			// Check for duplicate product code
			const existingProduct = products.find(
				p => p.code.toLowerCase() === formData.code?.toLowerCase() && p.id !== editingProduct?.id
			);
			if (existingProduct) {
				validationErrors.push("A product with this code already exists");
			}

			// If there are validation errors, show them and stop submission
			if (validationErrors.length > 0) {
				setError(validationErrors.join(" • "));
				return;
			}

			// Convert repayment terms to numbers and handle undefined numeric values
			// Filter and trim array fields on submit (not during editing to allow newlines)
			const cleanArrayField = (arr: string[] | undefined) => 
				(arr || []).map(s => s.trim()).filter(s => s !== "");

			const submissionData = {
				...formData,
				// Convert undefined to 0 for numeric fields
				minAmount: formData.minAmount ?? 0,
				maxAmount: formData.maxAmount ?? 0,
				interestRate: formData.interestRate ?? 0,
				lateFeeRate: formData.lateFeeRate ?? 0,
				lateFeeFixedAmount: formData.lateFeeFixedAmount ?? 0,
				lateFeeFrequencyDays: formData.lateFeeFrequencyDays ?? 7,
				originationFee: 0, // Deprecated - set to 0
				legalFee: 0, // Deprecated - set to 0
				applicationFee: 0, // Deprecated - set to 0
				stampingFee: formData.stampingFee ?? 0,
				legalFeeFixed: formData.legalFeeType === 'FIXED' ? (formData.legalFeeValue ?? 0) : 0, // Backward compat
				legalFeeType: formData.legalFeeType ?? 'FIXED',
				legalFeeValue: formData.legalFeeValue ?? 0,
				repaymentTerms: validTerms,
				// Clean array fields on submit
				eligibility: cleanArrayField(formData.eligibility),
				requiredDocuments: cleanArrayField(formData.requiredDocuments),
				features: cleanArrayField(formData.features),
				loanTypes: cleanArrayField(formData.loanTypes),
			};

			const backendUrl = process.env.NEXT_PUBLIC_API_URL;
			const url = editingProduct
				? `${backendUrl}/api/products/${editingProduct.id}`
				: `${backendUrl}/api/products`;

			const method = editingProduct ? "PATCH" : "POST";

			// Use fetchWithAdminTokenRefresh for submission
			await fetchWithAdminTokenRefresh(url, {
				method,
				body: JSON.stringify(submissionData),
			});

			setIsModalOpen(false);
			toast.success(editingProduct ? "Product updated successfully" : "Product created successfully");
			fetchProducts();
		} catch (err) {
			console.error("Error saving product:", err);
			setError("Failed to save product. Please try again later.");
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
			return;
		}

		try {
			setError(null);
			const backendUrl = process.env.NEXT_PUBLIC_API_URL;
			// Use fetchWithAdminTokenRefresh for deletion
			await fetchWithAdminTokenRefresh(
				`${backendUrl}/api/products/${id}`,
				{
					method: "DELETE",
				}
			);

			toast.success("Product deleted successfully");
			fetchProducts();
		} catch (err: any) {
			console.error("Error deleting product:", err);
			
			// Handle foreign key constraint errors (409 status)
			if (err?.status === 409 || err?.message?.includes('foreign key') || err?.message?.includes('constraint') || err?.message?.includes('loan applications')) {
				setError(err?.message || "Cannot delete this product because it has existing loan applications. Please remove all associated loan applications first.");
			} else {
				setError(err?.message || "Failed to delete product. Please try again later.");
			}
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-MY", {
			style: "currency",
			currency: "MYR",
		}).format(amount);
	};

	const formatCurrencyCompact = (amount: number) => {
		return new Intl.NumberFormat("en-MY", {
			style: "currency",
			currency: "MYR",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	const formatPercentage = (value: number) => {
		return `${value.toFixed(2)}%`;
	};

	// Prevent non-numeric input in number fields
	const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, allowDecimal: boolean = true) => {
		// Allow: backspace, delete, tab, escape, enter
		if (
			e.key === 'Backspace' ||
			e.key === 'Delete' ||
			e.key === 'Tab' ||
			e.key === 'Escape' ||
			e.key === 'Enter' ||
			e.key === 'ArrowLeft' ||
			e.key === 'ArrowRight' ||
			e.key === 'ArrowUp' ||
			e.key === 'ArrowDown' ||
			e.key === 'Home' ||
			e.key === 'End'
		) {
			return; // Let it happen
		}

		// Allow Ctrl/Cmd + A, C, V, X (Select All, Copy, Paste, Cut)
		if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'c' || e.key === 'v' || e.key === 'x')) {
			return;
		}

		// Allow decimal point only if allowDecimal is true and only one decimal point
		if (allowDecimal && e.key === '.') {
			const input = e.currentTarget;
			if (input.value.includes('.')) {
				e.preventDefault(); // Already has a decimal point
			}
			return;
		}

		// Allow minus sign only at the start for negative numbers
		if (e.key === '-') {
			const input = e.currentTarget;
			if (input.selectionStart === 0 && !input.value.includes('-')) {
				return;
			}
			e.preventDefault();
			return;
		}

		// Prevent if not a number (0-9)
		if (!/^[0-9]$/.test(e.key)) {
			e.preventDefault();
		}
	};

	// Filter products based on search and status
	const filteredProducts = products.filter((product) => {
		const searchTerm = search.toLowerCase();
		const matchesSearch = (
			product.name.toLowerCase().includes(searchTerm) ||
			product.code.toLowerCase().includes(searchTerm) ||
			product.description.toLowerCase().includes(searchTerm)
		);
		
		const matchesStatus = 
			statusFilter === "ALL" ||
			(statusFilter === "ACTIVE" && product.isActive) ||
			(statusFilter === "INACTIVE" && !product.isActive);
		
		return matchesSearch && matchesStatus;
	});

	// Calculate filter counts
	const filterCounts = {
		ALL: products.length,
		ACTIVE: products.filter(p => p.isActive).length,
		INACTIVE: products.filter(p => !p.isActive).length,
	};

	if (loading) {
		return (
			<AdminLayout
				title="Products"
				description="Manage loan products and their configurations"
			>
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
				</div>
			</AdminLayout>
		);
	}

	return (
		<AdminLayout
			title="Products"
			description="Manage loan products and their configurations"
		>
			{/* Error Message */}
			{error && (
				<div className="mb-6 bg-red-700/30 border border-red-600/30 text-red-300 px-4 py-3 rounded-lg flex items-center justify-between">
					<span>{error}</span>
					<button onClick={() => setError(null)}>
						<XMarkIcon className="h-5 w-5" />
					</button>
				</div>
			)}

			{/* Main Content */}
			<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
				{/* Header */}
				<div className="px-6 py-4 border-b border-gray-700/30">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between">
						<div className="flex items-center mb-4 md:mb-0">
							<CubeIcon className="h-8 w-8 text-blue-400 mr-3" />
							<div>
								<h2 className="text-xl font-semibold text-white">
									Products Management
								</h2>
								<p className="text-gray-400 text-sm">
									{filteredProducts.length} product
									{filteredProducts.length !== 1 ? "s" : ""}{" "}
									found
								</p>
							</div>
						</div>
						<div className="flex space-x-3">
							<button
								onClick={handleCreate}
								className="flex items-center px-4 py-2 bg-green-500/20 text-green-200 rounded-lg border border-green-400/20 hover:bg-green-500/30 transition-colors"
							>
								<PlusIcon className="h-5 w-5 mr-2" />
								Add Product
							</button>
							<button
								onClick={handleRefresh}
								disabled={refreshing}
								className="flex items-center px-4 py-2 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors"
							>
								<ArrowPathIcon className={`h-5 w-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
								Refresh
							</button>
						</div>
					</div>

				</div>

			{/* Search Bar */}
			<div className="mb-4 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
				<div className="relative">
					<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
					</div>
					<input
						type="text"
						className="block w-full pl-10 pr-10 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
						placeholder="Search by name, code, or description"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					{search && (
						<button
							onClick={() => setSearch("")}
							className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300 transition-colors"
							title="Clear search"
						>
							<XMarkIcon className="h-4 w-4" />
						</button>
					)}
				</div>
			</div>

			{/* Filter Buttons */}
			<div className="mb-6 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
				<div className="flex flex-wrap gap-2">
					<button
						onClick={() => setStatusFilter("ALL")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "ALL"
								? "bg-blue-500/30 text-blue-100 border-blue-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						All ({filterCounts.ALL})
					</button>
					<button
						onClick={() => setStatusFilter("ACTIVE")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "ACTIVE"
								? "bg-green-500/30 text-green-100 border-green-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Active ({filterCounts.ACTIVE})
					</button>
					<button
						onClick={() => setStatusFilter("INACTIVE")}
						className={`px-4 py-2 rounded-lg border transition-colors ${
							statusFilter === "INACTIVE"
								? "bg-red-500/30 text-red-100 border-red-400/30"
								: "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
						}`}
					>
						Inactive ({filterCounts.INACTIVE})
					</button>
				</div>
			</div>

			{/* Products Table */}
			<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
				{/* Table Content */}
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-700/30">
						<thead className="bg-gray-800/50">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Name
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Amount Range
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Repayment Terms
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Interest Rate
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Fees
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Late Fees
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Collateral
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Status
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="bg-gray-800/20 divide-y divide-gray-700/30">
							{filteredProducts.length === 0 ? (
								<tr>
									<td
										colSpan={9}
										className="px-6 py-12 text-center text-gray-400"
									>
										{search ? (
											<div>
												<MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
												<p className="text-lg font-medium mb-2">No products found</p>
												<p className="text-sm">Try adjusting your search criteria</p>
											</div>
										) : (
											<div>
												<CubeIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
												<p className="text-lg font-medium mb-2">No products available</p>
												<p className="text-sm">Create your first product to get started</p>
											</div>
										)}
									</td>
								</tr>
							) : (
								filteredProducts.map((product) => (
									<tr
										key={product.id}
										className="hover:bg-gray-800/30 transition-colors"
									>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
											<div className="font-medium text-white">{product.name}</div>
											<div className="text-xs text-gray-400">{product.code}</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-green-400">
											{formatCurrencyCompact(product.minAmount)} - {formatCurrencyCompact(product.maxAmount)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
											{product.repaymentTerms && product.repaymentTerms.length > 0 
												? product.repaymentTerms.sort((a, b) => a - b).join(', ') + ' months'
												: 'Not specified'
											}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
											{formatPercentage(product.interestRate)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
											<div className="text-xs">
												{(() => {
													const fees = [];
													const legalValue = product.legalFeeValue ?? product.legalFeeFixed ?? 0;
													if (legalValue > 0) {
														if (product.legalFeeType === 'PERCENTAGE') {
															fees.push(`${legalValue}% (Legal)`);
														} else {
															fees.push(`RM ${legalValue} (Legal)`);
														}
													}
													if (product.stampingFee > 0) {
														fees.push(`${product.stampingFee}% (Stamping)`);
													}
													return fees.length > 0 ? fees.join(' + ') : 'No fees';
												})()}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
											<div className="text-xs">
												{(() => {
													const lateFees = [];
													if (product.lateFeeRate > 0) {
														lateFees.push(`${product.lateFeeRate}% daily`);
													}
													if (product.lateFeeFixedAmount > 0) {
														lateFees.push(`RM ${product.lateFeeFixedAmount} every ${product.lateFeeFrequencyDays} days`);
													}
													return lateFees.length > 0 ? lateFees.join(' + ') : 'No late fees';
												})()}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
											{product.collateralRequired ? (
												<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-400/30">
													Required
												</span>
											) : (
												<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-300 border border-gray-400/30">
													Not Required
												</span>
											)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
											{product.isActive ? (
												<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-300 border border-green-400/30">
													Active
												</span>
											) : (
												<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-400/30">
													Inactive
												</span>
											)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
											<div className="flex items-center space-x-2">
												<button
													onClick={() => handleEdit(product)}
													className="text-blue-400 hover:text-blue-300 transition-colors"
													title="Edit product"
												>
													<PencilIcon className="h-4 w-4" />
												</button>
												<button
													onClick={() => handleDelete(product.id)}
													className="text-red-400 hover:text-red-300 transition-colors"
													title="Delete product"
												>
													<TrashIcon className="h-4 w-4" />
												</button>
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>

		{/* Modal */}
			{isModalOpen && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-gray-800 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
						<div className="flex justify-between items-center mb-6">
							<h3 className="text-xl font-semibold text-white">
								{editingProduct ? "Edit Product" : "Create New Product"}
							</h3>
							<button
								onClick={() => {
									setIsModalOpen(false);
									setError(null);
								}}
								className="text-gray-400 hover:text-white transition-colors"
							>
								<XMarkIcon className="h-6 w-6" />
							</button>
						</div>

						{/* Validation Error Display */}
						{error && (
							<div className="mb-6 bg-red-700/30 border border-red-600/30 text-red-300 px-4 py-3 rounded-lg">
								<div className="flex items-start">
									<XMarkIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
									<div className="flex-1">
										<p className="font-medium mb-1">Please fix the following errors:</p>
										<p className="text-sm">{error}</p>
									</div>
									<button onClick={() => setError(null)} className="ml-2">
										<XMarkIcon className="h-4 w-4" />
									</button>
								</div>
							</div>
						)}

						<form onSubmit={handleSubmit} className="space-y-6">
							{/* SECTION: Basic Information */}
							<div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
								<h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
									Basic Information
								</h4>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Product Name <span className="text-red-400">*</span>
										</label>
										<input
											type="text"
											value={formData.name || ""}
											onChange={(e) => {
												const newName = e.target.value;
												setFormData({
													...formData,
													name: newName,
													// Auto-generate code if not manually edited
													code: isCodeManuallyEdited ? formData.code : generateProductCode(newName),
												});
											}}
											placeholder="e.g., Personal Loan"
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Product Code <span className="text-red-400">*</span>
										</label>
										<div className="flex gap-2">
											<input
												type="text"
												value={formData.code || ""}
												onChange={(e) => {
													setFormData({
														...formData,
														code: e.target.value,
													});
												}}
												disabled={!isCodeManuallyEdited}
												placeholder="Auto-generated from name"
												className={`flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${!isCodeManuallyEdited ? 'bg-gray-600/50 text-gray-300' : ''}`}
											/>
											<button
												type="button"
												onClick={() => {
													if (isCodeManuallyEdited) {
														// Reset to auto-generated
														setFormData({
															...formData,
															code: generateProductCode(formData.name || ""),
														});
													}
													setIsCodeManuallyEdited(!isCodeManuallyEdited);
												}}
												className="px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-gray-300 hover:bg-gray-500 hover:text-white transition-colors text-sm"
											>
												{isCodeManuallyEdited ? "Auto" : "Edit"}
											</button>
										</div>
									</div>
									<div className="md:col-span-2">
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Description <span className="text-red-400">*</span>
										</label>
										<textarea
											value={formData.description || ""}
											onChange={(e) =>
												setFormData({
													...formData,
													description: e.target.value,
												})
											}
											onKeyDown={(e) => {
												if (e.key === 'Enter') {
													e.stopPropagation();
												}
											}}
											placeholder="Describe the loan product..."
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
											rows={3}
										/>
									</div>
									{/* Status Toggle */}
									<div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
										<div>
											<span className="text-sm font-medium text-gray-300">Product Status</span>
											<p className="text-xs text-gray-400">Enable to make this product available to users</p>
										</div>
										<label className="relative inline-flex items-center cursor-pointer">
											<input
												type="checkbox"
												checked={formData.isActive ?? true}
												onChange={(e) =>
													setFormData({
														...formData,
														isActive: e.target.checked,
													})
												}
												className="sr-only peer"
											/>
											<div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
											<span className="ms-3 text-sm font-medium text-gray-300">
												{formData.isActive ? 'Active' : 'Inactive'}
											</span>
										</label>
									</div>
									{/* Collateral Toggle */}
									<div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
										<div>
											<span className="text-sm font-medium text-gray-300">Collateral Required</span>
											<p className="text-xs text-gray-400">Require collateral for this loan product</p>
										</div>
										<label className="relative inline-flex items-center cursor-pointer">
											<input
												type="checkbox"
												checked={formData.collateralRequired ?? false}
												onChange={(e) =>
													setFormData({
														...formData,
														collateralRequired: e.target.checked,
													})
												}
												className="sr-only peer"
											/>
											<div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
											<span className="ms-3 text-sm font-medium text-gray-300">
												{formData.collateralRequired ? 'Required' : 'Not Required'}
											</span>
										</label>
									</div>
								</div>
							</div>

							{/* SECTION: Loan Parameters */}
							<div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
								<h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
									Loan Parameters
								</h4>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Minimum Amount (MYR) <span className="text-red-400">*</span>
										</label>
										<input
											type="number"
											value={formData.minAmount ?? ""}
											onChange={(e) =>
												setFormData({
													...formData,
													minAmount: e.target.value === "" ? undefined : parseFloat(e.target.value),
												})
											}
											onKeyDown={(e) => handleNumericKeyDown(e, true)}
											placeholder="1000"
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Maximum Amount (MYR) <span className="text-red-400">*</span>
										</label>
										<input
											type="number"
											value={formData.maxAmount ?? ""}
											onChange={(e) =>
												setFormData({
													...formData,
													maxAmount: e.target.value === "" ? undefined : parseFloat(e.target.value),
												})
											}
											onKeyDown={(e) => handleNumericKeyDown(e, true)}
											placeholder="50000"
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Interest Rate (% per month) <span className="text-red-400">*</span>
										</label>
										<input
											type="number"
											step="0.01"
											value={formData.interestRate ?? ""}
											onChange={(e) =>
												setFormData({
													...formData,
													interestRate: e.target.value === "" ? undefined : parseFloat(e.target.value),
												})
											}
											onKeyDown={(e) => handleNumericKeyDown(e, true)}
											placeholder="1.5"
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Repayment Terms (months) <span className="text-red-400">*</span>
										</label>
										<input
											type="text"
											value={repaymentTermsInput}
											onChange={(e) => setRepaymentTermsInput(e.target.value)}
											placeholder="3, 6, 12, 24"
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
										<p className="text-xs text-gray-400 mt-1">Comma-separated values (e.g., 3, 6, 12, 24)</p>
									</div>
								</div>
							</div>

							{/* SECTION: Disbursement Fees */}
							<div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
								<h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
									Disbursement Fees
								</h4>
								<div className="space-y-4">
									{/* Legal Fee Type Selection */}
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-2">
											Legal Fee Type
										</label>
										<div className="flex gap-4">
											<label className="flex items-center cursor-pointer">
												<input
													type="radio"
													name="legalFeeType"
													value="PERCENTAGE"
													checked={formData.legalFeeType === 'PERCENTAGE'}
													onChange={() =>
														setFormData({
															...formData,
															legalFeeType: 'PERCENTAGE',
														})
													}
													className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500"
												/>
												<span className="ms-2 text-sm text-gray-300">Percentage of Loan</span>
											</label>
											<label className="flex items-center cursor-pointer">
												<input
													type="radio"
													name="legalFeeType"
													value="FIXED"
													checked={formData.legalFeeType === 'FIXED'}
													onChange={() =>
														setFormData({
															...formData,
															legalFeeType: 'FIXED',
														})
													}
													className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500"
												/>
												<span className="ms-2 text-sm text-gray-300">Fixed Amount</span>
											</label>
										</div>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-gray-300 mb-1">
												Legal Fee Value {formData.legalFeeType === 'PERCENTAGE' ? '(%)' : '(MYR)'} <span className="text-red-400">*</span>
											</label>
											<input
												type="number"
												step="0.01"
												value={formData.legalFeeValue ?? ""}
												onChange={(e) =>
													setFormData({
														...formData,
														legalFeeValue: e.target.value === "" ? undefined : parseFloat(e.target.value),
													})
												}
												onKeyDown={(e) => handleNumericKeyDown(e, true)}
												placeholder={formData.legalFeeType === 'PERCENTAGE' ? "e.g., 1.5" : "e.g., 500"}
												className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-300 mb-1">
												Stamping Fee (%) <span className="text-red-400">*</span>
											</label>
											<input
												type="number"
												step="0.01"
												value={formData.stampingFee ?? ""}
												onChange={(e) =>
													setFormData({
														...formData,
														stampingFee: e.target.value === "" ? undefined : parseFloat(e.target.value),
													})
												}
												onKeyDown={(e) => handleNumericKeyDown(e, true)}
												placeholder="0.5"
												className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
											/>
											<p className="text-xs text-gray-400 mt-1">Always calculated as percentage of loan amount</p>
										</div>
									</div>
								</div>
							</div>

							{/* SECTION: Late Payment Fees */}
							<div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
								<h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
									Late Payment Fees
								</h4>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Late Fee Rate (% per day)
										</label>
										<input
											type="number"
											step="0.001"
											value={formData.lateFeeRate ?? ""}
											onChange={(e) =>
												setFormData({
													...formData,
													lateFeeRate: e.target.value === "" ? undefined : parseFloat(e.target.value),
												})
											}
											onKeyDown={(e) => handleNumericKeyDown(e, true)}
											placeholder="0.1"
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Fixed Late Fee (MYR)
										</label>
										<input
											type="number"
											step="0.01"
											value={formData.lateFeeFixedAmount ?? ""}
											onChange={(e) =>
												setFormData({
													...formData,
													lateFeeFixedAmount: e.target.value === "" ? undefined : parseFloat(e.target.value),
												})
											}
											onKeyDown={(e) => handleNumericKeyDown(e, true)}
											placeholder="250"
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Fixed Fee Frequency (days)
										</label>
										<input
											type="number"
											value={formData.lateFeeFrequencyDays ?? ""}
											onChange={(e) =>
												setFormData({
													...formData,
													lateFeeFrequencyDays: e.target.value === "" ? undefined : parseInt(e.target.value),
												})
											}
											onKeyDown={(e) => handleNumericKeyDown(e, false)}
											placeholder="7"
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
								</div>
							</div>

							{/* SECTION: Additional Details (Collapsible) */}
							<div className="bg-gray-700/30 rounded-lg border border-gray-600/30">
								<button
									type="button"
									onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
									className="w-full px-4 py-3 flex items-center justify-between text-left"
								>
									<h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
										Additional Details
									</h4>
									<svg
										className={`w-5 h-5 text-gray-400 transition-transform ${showAdditionalDetails ? 'rotate-180' : ''}`}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
									</svg>
								</button>
								{showAdditionalDetails && (
									<div className="px-4 pb-4 space-y-4">
										<div>
											<label className="block text-sm font-medium text-gray-300 mb-1">
												Eligibility Criteria (one per line)
											</label>
											<textarea
												value={formData.eligibility?.join("\n") || ""}
												onChange={(e) => {
													// Keep raw lines while editing, filter on submit
													const lines = e.target.value.split("\n");
													setFormData({
														...formData,
														eligibility: lines,
													});
												}}
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														e.stopPropagation();
													}
												}}
												placeholder="Minimum age: 21 years&#10;Minimum income: RM 2,000&#10;Employment: At least 6 months"
												className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
												rows={3}
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-300 mb-1">
												Required Documents (one per line)
											</label>
											<textarea
												value={formData.requiredDocuments?.join("\n") || ""}
												onChange={(e) => {
													// Keep raw lines while editing, filter on submit
													const lines = e.target.value.split("\n");
													setFormData({
														...formData,
														requiredDocuments: lines,
													});
												}}
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														e.stopPropagation();
													}
												}}
												placeholder="IC&#10;Latest 3 months bank statements&#10;Latest 3 months payslips"
												className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
												rows={3}
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-300 mb-1">
												Product Features (one per line)
											</label>
											<textarea
												value={formData.features?.join("\n") || ""}
												onChange={(e) => {
													// Keep raw lines while editing, filter on submit
													const lines = e.target.value.split("\n");
													setFormData({
														...formData,
														features: lines,
													});
												}}
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														e.stopPropagation();
													}
												}}
												placeholder="Fast approval within 24 hours&#10;No hidden fees&#10;Flexible repayment terms"
												className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
												rows={3}
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-300 mb-1">
												Loan Types / Purposes (one per line)
											</label>
											<textarea
												value={formData.loanTypes?.join("\n") || ""}
												onChange={(e) => {
													// Keep raw lines while editing, filter on submit
													const lines = e.target.value.split("\n");
													setFormData({
														...formData,
														loanTypes: lines,
													});
												}}
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														e.stopPropagation();
													}
												}}
												placeholder="Personal Loan&#10;Business Loan&#10;Education Loan"
												className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
												rows={3}
											/>
										</div>
									</div>
								)}
							</div>

							{/* Form Actions */}
							<div className="flex justify-end space-x-4 pt-4 border-t border-gray-700">
								<button
									type="button"
									onClick={() => {
										setIsModalOpen(false);
										setError(null);
									}}
									className="px-6 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
								>
									Cancel
								</button>
								<button
									type="submit"
									className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
								>
									{editingProduct ? "Update Product" : "Create Product"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</AdminLayout>
	);
}
