import { useState, useEffect } from "react";
import {
	Box,
	Button,
	Typography,
	List,
	ListItem,
	ListItemIcon,
	ListItemText,
	IconButton,
	CircularProgress,
	Alert,
} from "@mui/material";
import {
	CloudUpload as CloudUploadIcon,
	CheckCircle as CheckCircleIcon,
	Error as ErrorIcon,
	Delete as DeleteIcon,
} from "@mui/icons-material";
import { useSearchParams } from "next/navigation";
import { Product } from "@/types/product";

interface DocumentUploadFormProps {
	onSubmit: (values: { documents: File[] }) => void;
	onBack: () => void;
	selectedProduct: Product;
}

interface Document {
	id: string;
	name: string;
	type: string;
	status: "pending" | "uploading" | "success" | "error";
	file?: File;
	error?: string;
	files?: File[];
}

export default function DocumentUploadForm({
	onSubmit,
	onBack,
	selectedProduct,
}: DocumentUploadFormProps) {
	const searchParams = useSearchParams();
	const [documents, setDocuments] = useState<Document[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [productName, setProductName] = useState<string>("");
	const [existingDocuments, setExistingDocuments] = useState<
		Array<{
			id: string;
			name: string;
			status: string;
		}>
	>([]);

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				setError(null);

				// Get application ID from URL params
				const applicationId = searchParams.get("applicationId");
				if (!applicationId) {
					throw new Error("Application ID not found in URL");
				}

				// Get product code from URL params
				const productCode = searchParams.get("productCode");
				if (!productCode) {
					throw new Error("Product code not found in URL");
				}

				console.log("Fetching application data for ID:", applicationId);

				// Fetch application data to get existing documents
				const token = localStorage.getItem("token");
				const applicationResponse = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${applicationId}`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
						},
					}
				);

				if (!applicationResponse.ok) {
					throw new Error("Failed to fetch application data");
				}

				const applicationData = await applicationResponse.json();
				console.log("Application data:", applicationData);

				// Set existing documents if available
				if (
					applicationData.documents &&
					applicationData.documents.length > 0
				) {
					setExistingDocuments(applicationData.documents);
				}

				console.log(
					"Fetching product requirements for code:",
					productCode
				);

				// Fetch product details including document requirements
				const productResponse = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/products?code=${productCode}`
				);

				if (!productResponse.ok) {
					if (productResponse.status === 404) {
						throw new Error("Product not found");
					}
					throw new Error("Failed to fetch product requirements");
				}

				const products = await productResponse.json();
				console.log("Products response:", products);

				if (!products || products.length === 0) {
					throw new Error("Product not found");
				}

				// The API returns a single product object, not an array
				const productData = products;
				console.log("Selected product data:", productData);

				setProductName(productData.name);

				// Initialize documents from the API response
				const initialDocs = productData.requiredDocuments.map(
					(docName: string, index: number) => {
						// Check if this document already exists in existingDocuments
						const existingDoc = existingDocuments.find(
							(doc) => doc.name === docName
						);

						return {
							id: existingDoc?.id || `doc-${index}`,
							name: docName,
							type: "file",
							status: existingDoc ? "success" : "pending",
							files: existingDoc ? [] : undefined, // We don't have the actual files, just the metadata
						};
					}
				);

				setDocuments(initialDocs);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "An error occurred"
				);
				console.error("Error fetching data:", err);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [searchParams]);

	const handleFileChange = async (docId: string, file: File) => {
		setDocuments((prev) =>
			prev.map((doc) =>
				doc.id === docId
					? {
							...doc,
							status: "uploading",
							files: [...(doc.files || []), file],
					  }
					: doc
			)
		);

		// Simulate file upload without error handling
		await new Promise((resolve) => setTimeout(resolve, 1500));

		setDocuments((prev) =>
			prev.map((doc) =>
				doc.id === docId
					? {
							...doc,
							status: "success",
					  }
					: doc
			)
		);
	};

	const handleDelete = (docId: string, fileToDelete: File) => {
		setDocuments((prev) =>
			prev.map((doc) =>
				doc.id === docId
					? {
							...doc,
							status:
								doc.files?.length === 1 ? "pending" : "success",
							files:
								doc.files?.filter((f) => f !== fileToDelete) ||
								[],
					  }
					: doc
			)
		);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		// Allow proceeding with or without documents
		const files = documents.flatMap((doc) => doc.files || []);
		onSubmit({ documents: files });
	};

	if (loading) {
		return (
			<Box className="flex justify-center items-center min-h-[200px]">
				<CircularProgress />
			</Box>
		);
	}

	if (error) {
		return (
			<Box className="space-y-6">
				<Typography variant="h6" className="text-gray-900 mb-4">
					Upload Documents
				</Typography>
				<Alert severity="error">{error}</Alert>
				<Box className="flex justify-between pt-6">
					<Button
						type="button"
						variant="outlined"
						onClick={onBack}
						className="text-gray-700 border-gray-300 hover:bg-gray-50"
					>
						Back
					</Button>
				</Box>
			</Box>
		);
	}

	return (
		<Box component="form" onSubmit={handleSubmit} className="space-y-6">
			<Typography variant="h6" className="text-gray-900 mb-4">
				Upload Documents for {productName}
			</Typography>

			<Typography className="text-gray-600 mb-6">
				Please upload the required documents to support your
				application. You can skip this step and upload them later.
			</Typography>

			<List className="space-y-4">
				{documents.map((doc) => (
					<ListItem
						key={doc.id}
						className="bg-gray-50 rounded-lg p-4"
					>
						<ListItemIcon>
							{doc.status === "pending" && (
								<CloudUploadIcon className="text-gray-400" />
							)}
							{doc.status === "uploading" && (
								<CircularProgress size={24} />
							)}
							{doc.status === "success" && (
								<CheckCircleIcon className="text-green-600" />
							)}
							{doc.status === "error" && (
								<ErrorIcon className="text-red-600" />
							)}
						</ListItemIcon>
						<ListItemText
							primary={doc.name}
							secondary={
								doc.status === "error"
									? doc.error
									: doc.status === "uploading"
									? "Uploading..."
									: doc.status === "success" &&
									  doc.files &&
									  doc.files.length > 0
									? `${doc.files.length} file(s) uploaded`
									: "Click to upload"
							}
							className="ml-4"
						/>
						{(doc.status === "pending" ||
							(doc.status === "success" &&
								(!doc.files || doc.files.length === 0))) && (
							<Button
								component="label"
								variant="outlined"
								className="text-indigo-600 border-indigo-600 hover:bg-indigo-50"
							>
								Upload
								<input
									type="file"
									hidden
									multiple
									accept=".jpg,.jpeg,.png,.pdf"
									onChange={(e) => {
										const files = Array.from(
											e.target.files || []
										);
										if (files.length > 0) {
											// Validate file types
											const invalidFiles = files.filter(
												(file) =>
													!file.type.match(
														/^(image\/(jpeg|png)|application\/pdf)$/
													)
											);
											if (invalidFiles.length > 0) {
												setError(
													`Invalid file type. Only JPG, PNG, and PDF files are allowed.`
												);
												return;
											}
											// Handle multiple files
											files.forEach((file) => {
												handleFileChange(doc.id, file);
											});
										}
									}}
								/>
							</Button>
						)}
						{doc.status === "success" &&
							doc.files &&
							doc.files.length > 0 && (
								<Box className="flex flex-col gap-2">
									{doc.files.map((file, index) => (
										<Box
											key={index}
											className="flex items-center gap-2 bg-white p-2 rounded"
										>
											<Typography
												variant="body2"
												className="text-gray-600"
											>
												{file.name}
											</Typography>
											<IconButton
												onClick={() =>
													handleDelete(doc.id, file)
												}
												className="text-gray-400 hover:text-gray-600"
											>
												<DeleteIcon />
											</IconButton>
										</Box>
									))}
									<Button
										component="label"
										variant="outlined"
										className="text-indigo-600 border-indigo-600 hover:bg-indigo-50 mt-2"
									>
										Add More
										<input
											type="file"
											hidden
											multiple
											accept=".jpg,.jpeg,.png,.pdf"
											onChange={(e) => {
												const files = Array.from(
													e.target.files || []
												);
												if (files.length > 0) {
													// Validate file types
													const invalidFiles =
														files.filter(
															(file) =>
																!file.type.match(
																	/^(image\/(jpeg|png)|application\/pdf)$/
																)
														);
													if (
														invalidFiles.length > 0
													) {
														setError(
															`Invalid file type. Only JPG, PNG, and PDF files are allowed.`
														);
														return;
													}
													// Handle multiple files
													files.forEach((file) => {
														handleFileChange(
															doc.id,
															file
														);
													});
												}
											}}
										/>
									</Button>
								</Box>
							)}
					</ListItem>
				))}
			</List>

			<Box className="flex justify-between pt-6">
				<Button
					type="button"
					variant="outlined"
					onClick={onBack}
					className="text-gray-700 border-gray-300 hover:bg-gray-50"
				>
					Back
				</Button>
				<Button
					type="submit"
					variant="contained"
					className="bg-indigo-600 hover:bg-indigo-700 text-white"
				>
					Continue
				</Button>
			</Box>
		</Box>
	);
}
