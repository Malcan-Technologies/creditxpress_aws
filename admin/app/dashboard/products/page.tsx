"use client";

import { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import { useRouter } from "next/navigation";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";

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
	lateFee: number;
	originationFee: number;
	legalFee: number;
	applicationFee: number;
	requiredDocuments: string[];
	features: string[];
	loanTypes: string[];
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

interface ProductFormData extends Omit<Product, "repaymentTerms"> {
	repaymentTerms: string[];
}

export default function AdminProductsPage() {
	const router = useRouter();
	const [products, setProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [editingProduct, setEditingProduct] = useState<Product | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [formData, setFormData] = useState<Partial<ProductFormData>>({});

	useEffect(() => {
		fetchProducts();
	}, []);

	const fetchProducts = async () => {
		try {
			setLoading(true);
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
		});
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
			repaymentTerms: [3, 6, 12].map(String),
			interestRate: 0,
			eligibility: [],
			lateFee: 0,
			originationFee: 0,
			legalFee: 0,
			applicationFee: 0,
			requiredDocuments: [],
			features: [],
			loanTypes: [],
			isActive: true,
		});
		setIsModalOpen(true);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			// Convert repayment terms to numbers before submitting
			const submissionData = {
				...formData,
				repaymentTerms:
					formData.repaymentTerms
						?.map((term) => {
							const num = parseInt(term.trim());
							return isNaN(num) ? null : num;
						})
						.filter((num): num is number => num !== null) || [],
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
			fetchProducts();
		} catch (err) {
			console.error("Error saving product:", err);
			setError("Failed to save product. Please try again later.");
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this product?")) {
			return;
		}

		try {
			const backendUrl = process.env.NEXT_PUBLIC_API_URL;
			// Use fetchWithAdminTokenRefresh for deletion
			await fetchWithAdminTokenRefresh(
				`${backendUrl}/api/products/${id}`,
				{
					method: "DELETE",
				}
			);

			fetchProducts();
		} catch (err) {
			console.error("Error deleting product:", err);
			setError("Failed to delete product. Please try again later.");
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-MY", {
			style: "currency",
			currency: "MYR",
		}).format(amount);
	};

	const formatPercentage = (value: number) => {
		return `${value.toFixed(2)}%`;
	};

	return (
		<AdminLayout
			title="Products Management"
			description="Manage loan products and their configurations"
		>
			<div className="container mx-auto px-4 py-8">
				<div className="flex justify-between items-center mb-6">
					<h1 className="text-2xl font-bold text-white">
						Products Management
					</h1>
					<button
						onClick={handleCreate}
						className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
					>
						Add New Product
					</button>
				</div>

				{error && (
					<div className="bg-red-700/30 border border-red-600/30 text-red-300 px-4 py-3 rounded mb-4">
						{error}
					</div>
				)}

				{loading ? (
					<div className="flex justify-center items-center h-64">
						<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
					</div>
				) : (
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
						<table className="min-w-full divide-y divide-gray-700/30">
							<thead className="bg-gray-800/50">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
										Code
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
										Name
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
										Amount Range
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
										Interest Rate
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
								{products.length === 0 ? (
									<tr>
										<td
											colSpan={6}
											className="px-6 py-4 text-center text-gray-400"
										>
											No products found
										</td>
									</tr>
								) : (
									products.map((product) => (
										<tr
											key={product.id}
											className="hover:bg-gray-800/30 transition-colors"
										>
											<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
												{product.code}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
												{product.name}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
												{formatCurrency(
													product.minAmount
												)}{" "}
												-{" "}
												{formatCurrency(
													product.maxAmount
												)}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
												{formatPercentage(
													product.interestRate
												)}
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<span
													className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
														product.isActive
															? "bg-green-500/20 text-green-300 border border-green-400/20"
															: "bg-red-500/20 text-red-300 border border-red-400/20"
													}`}
												>
													{product.isActive
														? "Active"
														: "Inactive"}
												</span>
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
												<button
													onClick={() =>
														handleEdit(product)
													}
													className="text-blue-400 hover:text-blue-300 mr-4 transition-colors"
												>
													Edit
												</button>
												<button
													onClick={() =>
														handleDelete(product.id)
													}
													className="text-red-400 hover:text-red-300 transition-colors"
												>
													Delete
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}

				{/* Product Form Modal */}
				{isModalOpen && (
					<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
						<div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/30 rounded-xl shadow-xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
							<div className="flex justify-between items-center mb-6">
								<h2 className="text-xl font-bold text-white">
									{editingProduct
										? "Edit Product"
										: "Create New Product"}
								</h2>
								<button
									onClick={() => setIsModalOpen(false)}
									className="text-gray-400 hover:text-white transition-colors"
								>
									<svg
										className="w-6 h-6"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											d="M6 18L18 6M6 6l12 12"
										></path>
									</svg>
								</button>
							</div>

							<form onSubmit={handleSubmit} className="space-y-6">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Product Code
										</label>
										<input
											type="text"
											value={formData.code || ""}
											onChange={(e) =>
												setFormData({
													...formData,
													code: e.target.value,
												})
											}
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Product Name
										</label>
										<input
											type="text"
											value={formData.name || ""}
											onChange={(e) =>
												setFormData({
													...formData,
													name: e.target.value,
												})
											}
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
										/>
									</div>
									<div className="md:col-span-2">
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Description
										</label>
										<textarea
											value={formData.description || ""}
											onChange={(e) =>
												setFormData({
													...formData,
													description: e.target.value,
												})
											}
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
											rows={3}
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Minimum Amount (MYR)
										</label>
										<input
											type="number"
											value={formData.minAmount || 0}
											onChange={(e) =>
												setFormData({
													...formData,
													minAmount: parseFloat(
														e.target.value
													),
												})
											}
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Maximum Amount (MYR)
										</label>
										<input
											type="number"
											value={formData.maxAmount || 0}
											onChange={(e) =>
												setFormData({
													...formData,
													maxAmount: parseFloat(
														e.target.value
													),
												})
											}
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Interest Rate (% per month)
										</label>
										<input
											type="number"
											step="0.01"
											value={formData.interestRate || 0}
											onChange={(e) =>
												setFormData({
													...formData,
													interestRate: parseFloat(
														e.target.value
													),
												})
											}
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Late Fee (% per month)
										</label>
										<input
											type="number"
											step="0.01"
											value={formData.lateFee || 0}
											onChange={(e) =>
												setFormData({
													...formData,
													lateFee: parseFloat(
														e.target.value
													),
												})
											}
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Origination Fee (%)
										</label>
										<input
											type="number"
											step="0.01"
											value={formData.originationFee || 0}
											onChange={(e) =>
												setFormData({
													...formData,
													originationFee: parseFloat(
														e.target.value
													),
												})
											}
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Legal Fee (%)
										</label>
										<input
											type="number"
											value={formData.legalFee || 0}
											onChange={(e) =>
												setFormData({
													...formData,
													legalFee: parseFloat(
														e.target.value
													),
												})
											}
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Application Fee (MYR)
										</label>
										<input
											type="number"
											value={formData.applicationFee || 0}
											onChange={(e) =>
												setFormData({
													...formData,
													applicationFee: parseFloat(
														e.target.value
													),
												})
											}
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Status
										</label>
										<select
											value={
												formData.isActive
													? "true"
													: "false"
											}
											onChange={(e) =>
												setFormData({
													...formData,
													isActive:
														e.target.value ===
														"true",
												})
											}
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
										>
											<option value="true">Active</option>
											<option value="false">
												Inactive
											</option>
										</select>
									</div>
									<div className="md:col-span-2">
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Repayment Terms (months, one per
											line)
										</label>
										<textarea
											value={
												formData.repaymentTerms?.join(
													"\n"
												) || ""
											}
											onChange={(e) => {
												const lines =
													e.target.value.split("\n");
												setFormData((prev) => ({
													...prev,
													repaymentTerms: lines,
												}));
											}}
											placeholder="3&#10;6&#10;12"
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
											rows={4}
										/>
									</div>
									<div className="md:col-span-2">
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Eligibility Criteria (one per line)
										</label>
										<textarea
											value={
												formData.eligibility?.join(
													"\n"
												) || ""
											}
											onChange={(e) => {
												const lines =
													e.target.value.split("\n");
												setFormData({
													...formData,
													eligibility: lines,
												});
											}}
											placeholder="Minimum age: 21 years&#10;Minimum income: RM 2,000&#10;Employment: At least 6 months"
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
											rows={4}
										/>
									</div>
									<div className="md:col-span-2">
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Required Documents (one per line)
										</label>
										<textarea
											value={
												formData.requiredDocuments?.join(
													"\n"
												) || ""
											}
											onChange={(e) => {
												const lines =
													e.target.value.split("\n");
												setFormData({
													...formData,
													requiredDocuments: lines,
												});
											}}
											placeholder="IC&#10;Latest 3 months bank statements&#10;Latest 3 months payslips"
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
											rows={4}
										/>
									</div>
									<div className="md:col-span-2">
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Product Features (one per line)
										</label>
										<textarea
											value={
												formData.features?.join("\n") ||
												""
											}
											onChange={(e) => {
												const lines =
													e.target.value.split("\n");
												setFormData({
													...formData,
													features: lines,
												});
											}}
											placeholder="Fast approval within 24 hours&#10;No hidden fees&#10;Flexible repayment terms"
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
											rows={4}
										/>
									</div>
									<div className="md:col-span-2">
										<label className="block text-sm font-medium text-gray-300 mb-1">
											Loan Types (one per line)
										</label>
										<textarea
											value={
												formData.loanTypes?.join(
													"\n"
												) || ""
											}
											onChange={(e) => {
												const lines =
													e.target.value.split("\n");
												setFormData({
													...formData,
													loanTypes: lines,
												});
											}}
											placeholder="Personal Loan&#10;Business Loan&#10;Education Loan"
											className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
											rows={4}
										/>
									</div>
								</div>

								<div className="flex justify-end space-x-4 mt-6">
									<button
										type="button"
										onClick={() => setIsModalOpen(false)}
										className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
									>
										Cancel
									</button>
									<button
										type="submit"
										className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
									>
										{editingProduct
											? "Update Product"
											: "Create Product"}
									</button>
								</div>
							</form>
						</div>
					</div>
				)}
			</div>
		</AdminLayout>
	);
}
