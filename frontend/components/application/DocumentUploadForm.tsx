import { useState, useEffect, useCallback } from "react";
import {
	Box,
	Button,
	Typography,
	CircularProgress,
	Alert,
	Paper,
	Grid,
	IconButton,
	List,
	ListItem,
	ListItemText,
	ListItemSecondaryAction,
	ListItemIcon,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Checkbox,
	FormControlLabel,
} from "@mui/material";

// Override Material-UI styles for light theme
const lightThemeOverrides = {
	"& .MuiTypography-root": {
		color: "#374151 !important",
		fontFamily: "Inter, sans-serif !important",
	},
	"& .MuiTypography-h6": {
		color: "#374151 !important",
		fontFamily: "Manrope, sans-serif !important",
		fontWeight: "600 !important",
	},
	"& .MuiTypography-subtitle1": {
		color: "#374151 !important",
		fontFamily: "Manrope, sans-serif !important",
		fontWeight: "600 !important",
	},
	"& .MuiTypography-body2": {
		color: "#6B7280 !important",
		fontFamily: "Inter, sans-serif !important",
	},
	"& .MuiButton-root": {
		color: "white !important",
		backgroundColor: "#7C3AED !important",
		borderRadius: "12px !important",
		padding: "12px 24px !important",
		fontWeight: "500 !important",
		fontFamily: "Inter, sans-serif !important",
		transition: "all 0.2s ease !important",
		boxShadow: "none !important",
		textTransform: "none !important",
		"&:hover": {
			backgroundColor: "#6D28D9 !important",
			boxShadow: "none !important",
		},
	},
	"& .MuiButton-outlined": {
		color: "#374151 !important",
		backgroundColor: "white !important",
		borderColor: "#D1D5DB !important",
		borderRadius: "12px !important",
		padding: "12px 24px !important",
		fontWeight: "500 !important",
		fontFamily: "Inter, sans-serif !important",
		transition: "all 0.2s ease !important",
		"&:hover": {
			backgroundColor: "#F9FAFB !important",
			borderColor: "#9CA3AF !important",
		},
	},
	"& .MuiButton-contained": {
		color: "white !important",
		backgroundColor: "#7C3AED !important",
		borderRadius: "12px !important",
		padding: "12px 24px !important",
		fontWeight: "500 !important",
		fontFamily: "Inter, sans-serif !important",
		transition: "all 0.2s ease !important",
		boxShadow: "none !important",
		"&:hover": {
			backgroundColor: "#6D28D9 !important",
			boxShadow: "none !important",
		},
	},
	"& .MuiButton-sizeSmall": {
		padding: "8px 16px !important",
		fontSize: "0.875rem !important",
	},
	"& .MuiListItem-root": {
		backgroundColor: "white !important",
		border: "1px solid #E5E7EB !important",
		borderRadius: "12px !important",
		marginBottom: "16px !important",
		boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1) !important",
	},
	"& .MuiListItemText-primary": {
		color: "#374151 !important",
		fontFamily: "Manrope, sans-serif !important",
		fontWeight: "600 !important",
	},
	"& .MuiListItemText-secondary": {
		color: "#6B7280 !important",
		fontFamily: "Inter, sans-serif !important",
	},
	"& .MuiIconButton-root": {
		color: "#6B7280 !important",
		"&:hover": {
			color: "#DC2626 !important",
			backgroundColor: "#FEF2F2 !important",
		},
	},
	"& .MuiCircularProgress-root": {
		color: "#7C3AED !important",
	},
	"& .MuiAlert-root": {
		backgroundColor: "#FEF2F2 !important",
		color: "#DC2626 !important",
		border: "1px solid #FECACA !important",
		borderRadius: "12px !important",
	},
	"& .MuiDialogTitle-root": {
		color: "#374151 !important",
		backgroundColor: "white !important",
		fontFamily: "Manrope, sans-serif !important",
		fontWeight: "600 !important",
	},
	"& .MuiDialogContent-root": {
		backgroundColor: "white !important",
		color: "#374151 !important",
		fontFamily: "Inter, sans-serif !important",
	},
	"& .MuiDialogActions-root": {
		backgroundColor: "white !important",
		padding: "24px !important",
	},
	"& .MuiDialog-paper": {
		backgroundColor: "white !important",
		border: "1px solid #E5E7EB !important",
		borderRadius: "12px !important",
		boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25) !important",
	},
	"& .MuiBackdrop-root": {
		backgroundColor: "rgba(0, 0, 0, 0.5) !important",
	},
	// Override specific classes for file upload areas
	"& .bg-gray-50": {
		backgroundColor: "#F9FAFB !important",
	},
	"& .bg-white": {
		backgroundColor: "white !important",
	},
	"& .text-gray-900": {
		color: "#374151 !important",
	},
	"& .text-gray-600": {
		color: "#6B7280 !important",
	},
	"& .text-gray-400": {
		color: "#9CA3AF !important",
	},
	"& .text-red-600": {
		color: "#DC2626 !important",
	},
	"& .text-green-600": {
		color: "#059669 !important",
	},
	"& .text-indigo-600": {
		color: "#38BDF8 !important",
	},
	"& .border-indigo-600": {
		borderColor: "#38BDF8 !important",
	},
	"& .hover\\:bg-indigo-50:hover": {
		backgroundColor: "#EFF6FF !important",
	},
	"& .bg-blue-50": {
		backgroundColor: "rgba(56, 189, 248, 0.1) !important",
	},
	"& .text-blue-700": {
		color: "#38BDF8 !important",
	},
	"& .ring-blue-700\\/10": {
		"--tw-ring-color": "rgba(56, 189, 248, 0.1) !important",
	},
};
import DeleteIcon from "@mui/icons-material/Delete";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useSearchParams, usePathname } from "next/navigation";
import { ProductType } from "@/types/product";

interface DocumentUploadFormProps {
	onSubmit?: (values: { documents: File[]; documentTypes: string[] }) => void;
	onBack?: () => void;
	selectedProduct?: ProductType;
	applicationId?: string;
	productCode?: string;
	onSuccess?: () => void;
	existingDocuments?: Array<{
		id: string;
		name: string;
		type: string;
		status: string;
	}>;
}

interface UploadedFile {
	name: string;
	file?: File;
	url?: string;
	id?: string;
}

interface Document {
	id: string;
	name: string;
	type: string;
	status: "pending" | "uploading" | "success" | "error";
	file?: File;
	error?: string;
	files?: UploadedFile[];
	documentType?: string;
	fileUrl?: string;
}

interface PreviousDocument {
	id: string;
	type: string;
	status: string;
	fileUrl: string;
	createdAt: string;
	applicationId: string | null;
	name?: string;
}

export default function DocumentUploadForm({
	onSubmit,
	onBack,
	selectedProduct,
	applicationId,
	productCode,
	onSuccess,
	existingDocuments,
}: DocumentUploadFormProps) {
	const searchParams = useSearchParams();
	const pathname = usePathname();
	const [documents, setDocuments] = useState<Document[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [productName, setProductName] = useState<string>("");
	const [showConfirmDialog, setShowConfirmDialog] = useState(false);
	const [confirmDialogType, setConfirmDialogType] = useState<
		"none" | "incomplete"
	>("none");
	const [previousDocuments, setPreviousDocuments] = useState<PreviousDocument[]>([]);
	const [showPreviousDocsDialog, setShowPreviousDocsDialog] = useState(false);
	const [selectedDocType, setSelectedDocType] = useState<string>("");
	const [selectedPreviousDocs, setSelectedPreviousDocs] = useState<string[]>([]);
	const [previewFile, setPreviewFile] = useState<PreviousDocument | null>(null);
	const [showPreviewDialog, setShowPreviewDialog] = useState(false);

	const getApplicationId = useCallback(() => {
		// First try the prop
		if (applicationId) return applicationId;

		// Then try URL path
		const pathParts = pathname.split("/");
		const idIndex = pathParts.indexOf("applications") + 1;
		if (idIndex > 0 && idIndex < pathParts.length) {
			return pathParts[idIndex];
		}

		// Finally try URL params
		return searchParams.get("applicationId") || undefined;
	}, [applicationId, pathname, searchParams]);

	const getProductCode = useCallback(() => {
		// First try the productCode prop
		if (productCode) {
			console.log("Using productCode prop:", productCode);
			return productCode;
		}

		// Then try the selectedProduct prop
		if (selectedProduct?.code) {
			console.log("Using selectedProduct code:", selectedProduct.code);
			return selectedProduct.code;
		}

		// Then try URL params
		const urlProductCode = searchParams.get("productCode");
		if (urlProductCode) {
			console.log("Using URL productCode param:", urlProductCode);
			return urlProductCode;
		}

		console.log("No product code found in any source");
		return null;
	}, [searchParams, selectedProduct, productCode]);

	const fetchPreviousDocuments = async () => {
		try {
			const response = await fetch("/api/users/me/documents", {
				headers: {
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
			});

			if (response.ok) {
				const docs = await response.json();
				setPreviousDocuments(docs || []);
			}
		} catch (error) {
			console.error("Error fetching previous documents:", error);
		}
	};

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				setError(null);

				const currentApplicationId = getApplicationId();
				console.log("Current application ID:", currentApplicationId);

				if (!currentApplicationId) {
					throw new Error(
						"Application ID is required. Please ensure you're accessing this page with a valid application ID."
					);
				}

				const productCode = getProductCode();
				console.log("Product code for API call:", productCode);

				if (!productCode) {
					throw new Error(
						"Product code is required. Please ensure a product is selected or provided in the URL."
					);
				}

				// Fetch product details, existing documents, and previous documents in parallel
				const productUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/products?code=${productCode}`;
				console.log("Fetching product from URL:", productUrl);

				const [productResponse, documentsResponse, previousDocsResponse] = await Promise.all([
					fetch(productUrl, {
						headers: {
							Authorization: `Bearer ${localStorage.getItem(
								"token"
							)}`,
						},
					}),
					fetch(
						`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${currentApplicationId}/documents`,
						{
							headers: {
								Authorization: `Bearer ${localStorage.getItem(
									"token"
								)}`,
							},
						}
					),
					fetch("/api/users/me/documents", {
						headers: {
							Authorization: `Bearer ${localStorage.getItem("token")}`,
						},
					}),
				]);

				if (!productResponse.ok) {
					console.error("Product API error:", {
						status: productResponse.status,
						statusText: productResponse.statusText,
					});
					throw new Error(
						productResponse.status === 404
							? "Product not found. Please ensure you're using a valid product code."
							: "Failed to fetch product requirements. Please try again later."
					);
				}

				if (!documentsResponse.ok) {
					console.error("Documents API error:", {
						status: documentsResponse.status,
						statusText: documentsResponse.statusText,
					});
					throw new Error(
						"Failed to fetch existing documents. Please try again later."
					);
				}

				const products = await productResponse.json();
				console.log("Products API response:", products);

				const existingDocuments = await documentsResponse.json();
				console.log("Documents API response:", existingDocuments);

				// Handle previous documents
				if (previousDocsResponse.ok) {
					const previousDocs = await previousDocsResponse.json();
					setPreviousDocuments(previousDocs || []);
				}

				// Handle both array and single object responses
				const productData = Array.isArray(products)
					? products[0]
					: products;

				if (!productData || typeof productData !== "object") {
					throw new Error(
						"Invalid product data received. Please try again later."
					);
				}

				if (!productData.name || !productData.requiredDocuments) {
					throw new Error(
						"Product data is incomplete. Please try again later."
					);
				}

				setProductName(productData.name);

				// Create a map of existing documents by type
				const documentsByType = (existingDocuments || []).reduce(
					(acc: { [key: string]: any[] }, doc: any) => {
						if (!acc[doc.type]) {
							acc[doc.type] = [];
						}
						acc[doc.type].push(doc);
						return acc;
					},
					{}
				);

				// Initialize documents array with required document types and existing files
				const initialDocs = productData.requiredDocuments.map(
					(docName: string, index: number) => {
						const existingDocs = documentsByType[docName] || [];
						return {
							id: `doc-${index}`,
							name: docName,
							type: "file",
							status:
								existingDocs.length > 0 ? "success" : "pending",
							files: existingDocs.map((doc: any) => ({
								name:
									doc.fileUrl?.split("/").pop() ||
									doc.name ||
									"Unknown file",
								url: doc.fileUrl,
								id: doc.id,
							})),
							documentType: docName,
						};
					}
				);

				setDocuments(initialDocs);
			} catch (err) {
				setError(
					err instanceof Error
						? err.message
						: "An unexpected error occurred. Please try again later."
				);
				console.error("Error fetching data:", err);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [getApplicationId, getProductCode]);

	const handleFileChange = async (docId: string, file: File) => {
		// Check file size (50MB limit)
		const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
		if (file.size > MAX_FILE_SIZE) {
			setDocuments((prev) =>
				prev.map((doc) =>
					doc.id === docId
						? {
								...doc,
								status: "error",
								error: `File "${file.name}" exceeds the 50MB size limit.`,
						  }
						: doc
				)
			);
			return;
		}

		// Create a new uploaded file object
		const newFile: UploadedFile = {
			name: file.name,
			file: file,
		};

		setDocuments((prev) =>
			prev.map((doc) =>
				doc.id === docId
					? {
							...doc,
							status: "uploading",
							error: undefined,
							files: [...(doc.files || []), newFile],
							documentType: doc.name,
					  }
					: doc
			)
		);

		try {
			// Get application ID from props, URL path, or URL params
			let currentApplicationId: string | undefined = applicationId;

			if (!currentApplicationId) {
				// Try to get from URL path (e.g., /dashboard/applications/[id])
				const pathParts = pathname.split("/");
				const idIndex = pathParts.indexOf("applications") + 1;
				if (idIndex > 0 && idIndex < pathParts.length) {
					currentApplicationId = pathParts[idIndex];
				}
			}

			// Fall back to URL params if still not found
			if (!currentApplicationId) {
				const urlParamId = searchParams.get("applicationId");
				if (urlParamId) {
					currentApplicationId = urlParamId;
				}
			}

			if (!currentApplicationId) {
				throw new Error("Application ID not found");
			}

			// Create FormData and append file
			const formData = new FormData();
			formData.append("documents", file);
			formData.append(
				"documentTypes",
				JSON.stringify([documents.find((d) => d.id === docId)?.name])
			);

			// Upload the file
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${currentApplicationId}/documents`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${localStorage.getItem(
							"token"
						)}`,
					},
					body: formData,
				}
			);

			if (!response.ok) {
				throw new Error("Failed to upload file");
			}

			const uploadedDocs = await response.json();
			const uploadedDoc = uploadedDocs[0];

			// Update the document state with the uploaded file info
			setDocuments((prev) =>
				prev.map((doc) =>
					doc.id === docId
						? {
								...doc,
								status: "success",
								files: [
									...(doc.files || []).slice(0, -1),
									{
										name: file.name,
										url: uploadedDoc.fileUrl,
										id: uploadedDoc.id,
									},
								],
						  }
						: doc
				)
			);
		} catch (err) {
			console.error("Error uploading file:", err);
			setError(
				err instanceof Error ? err.message : "Failed to upload file"
			);
			// Revert the document state on error
			setDocuments((prev) =>
				prev.map((doc) =>
					doc.id === docId
						? {
								...doc,
								status:
									doc.files && doc.files.length > 1
										? "success"
										: "pending",
								files: (doc.files || []).slice(0, -1),
						  }
						: doc
				)
			);
		}
	};

	const handleDelete = async (docId: string, fileToDelete: UploadedFile) => {
		// Set the document to a loading state during deletion
		setDocuments((prev) =>
			prev.map((doc) =>
				doc.id === docId
					? {
							...doc,
							status: "uploading",
					  }
					: doc
			)
		);

		try {
			// Get application ID from props, URL path, or URL params
			let currentApplicationId: string | undefined = applicationId;

			if (!currentApplicationId) {
				// Try to get from URL path (e.g., /dashboard/applications/[id])
				const pathParts = pathname.split("/");
				const idIndex = pathParts.indexOf("applications") + 1;
				if (idIndex > 0 && idIndex < pathParts.length) {
					currentApplicationId = pathParts[idIndex];
				}
			}

			// Fall back to URL params if still not found
			if (!currentApplicationId) {
				const urlParamId = searchParams.get("applicationId");
				if (urlParamId) {
					currentApplicationId = urlParamId;
				}
			}

			if (!currentApplicationId) {
				throw new Error("Application ID not found");
			}

			// If the file has an ID (existing file), delete it from the server
			if (fileToDelete.id) {
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${currentApplicationId}/documents/${fileToDelete.id}`,
					{
						method: "DELETE",
						headers: {
							Authorization: `Bearer ${localStorage.getItem(
								"token"
							)}`,
						},
					}
				);

				if (!response.ok) {
					throw new Error("Failed to delete file");
				}
			}

			// Update local state
			setDocuments((prev) =>
				prev.map((doc) =>
					doc.id === docId
						? {
								...doc,
								status:
									doc.files && doc.files.length === 1
										? "pending"
										: "success",
								error: undefined,
								files:
									doc.files?.filter(
										(f) =>
											f.id !== fileToDelete.id &&
											f !== fileToDelete
									) || [],
						  }
						: doc
				)
			);
		} catch (err) {
			console.error("Error deleting file:", err);
			// Update the document state to show the error
			setDocuments((prev) =>
				prev.map((doc) =>
					doc.id === docId
						? {
								...doc,
								status: "error",
								error: "Failed to delete file. Please try again.",
						  }
						: doc
				)
			);
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		// Check document upload status
		const hasAnyDocuments = documents.some(
			(doc) => doc.files && doc.files.length > 0
		);
		const hasAllDocuments = documents.every(
			(doc) => doc.files && doc.files.length > 0
		);

		if (!hasAnyDocuments) {
			setConfirmDialogType("none");
			setShowConfirmDialog(true);
			return;
		}

		if (!hasAllDocuments) {
			setConfirmDialogType("incomplete");
			setShowConfirmDialog(true);
			return;
		}

		submitDocuments();
	};

	const submitDocuments = () => {
		// Collect files and their types
		const files: File[] = [];
		const documentTypes: string[] = [];

		documents.forEach((doc) => {
			if (doc.files) {
				doc.files.forEach((uploadedFile) => {
					if (uploadedFile.file) {
						files.push(uploadedFile.file);
						documentTypes.push(doc.name);
					}
				});
			}
		});

		if (onSubmit) {
			onSubmit({ documents: files, documentTypes });
		}

		if (onSuccess) {
			onSuccess();
		}
	};

	const handleLinkPreviousDocuments = async () => {
		if (selectedPreviousDocs.length === 0) {
			return;
		}

		try {
			const currentApplicationId = getApplicationId();
			if (!currentApplicationId) {
				throw new Error("Application ID not found");
			}

			// Set status to uploading for the current document type
			setDocuments((prev) =>
				prev.map((doc) =>
					doc.name === selectedDocType
						? { ...doc, status: "uploading" }
						: doc
				)
			);

			const response = await fetch(
				`/api/loan-applications/${currentApplicationId}/link-documents`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
					body: JSON.stringify({
						documentIds: selectedPreviousDocs,
						documentTypes: Array(selectedPreviousDocs.length).fill(selectedDocType),
					}),
				}
			);

			if (!response.ok) {
				throw new Error("Failed to link documents");
			}

			const linkedDocs = await response.json();

			// Update the document state with linked files
			setDocuments((prev) =>
				prev.map((doc) =>
					doc.name === selectedDocType
						? {
								...doc,
								status: "success",
								files: linkedDocs.map((linkedDoc: any) => ({
									name: linkedDoc.fileUrl?.split("/").pop() || "Linked document",
									url: linkedDoc.fileUrl,
									id: linkedDoc.id,
								})),
						  }
						: doc
				)
			);

			// Close dialog and reset selections
			setShowPreviousDocsDialog(false);
			setSelectedPreviousDocs([]);
			setSelectedDocType("");
		} catch (error) {
			console.error("Error linking documents:", error);
			// Reset document status on error
			setDocuments((prev) =>
				prev.map((doc) =>
					doc.name === selectedDocType
						? { ...doc, status: "error", error: "Failed to link documents" }
						: doc
				)
			);
		}
	};

	const handleSelectPreviousDoc = (docId: string) => {
		setSelectedPreviousDocs((prev) =>
			prev.includes(docId)
				? prev.filter((id) => id !== docId)
				: [...prev, docId]
		);
	};

	const handlePreviewDocument = (doc: PreviousDocument) => {
		setPreviewFile(doc);
		setShowPreviewDialog(true);
	};

	const getFileExtension = (url: string) => {
		return url.split('.').pop()?.toLowerCase() || '';
	};

	const isImageFile = (url: string) => {
		const ext = getFileExtension(url);
		return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
	};

	const isPDFFile = (url: string) => {
		const ext = getFileExtension(url);
		return ext === 'pdf';
	};

	const openPreviousDocsDialog = (docType: string) => {
		setSelectedDocType(docType);
		setSelectedPreviousDocs([]);
		setShowPreviousDocsDialog(true);
	};

	const handleBack = () => {
		const currentStep = parseInt(searchParams.get("step") || "1", 10);
		const newStep = Math.max(currentStep - 1, 1);
		const newUrl = new URL(window.location.href);
		newUrl.searchParams.set("step", newStep.toString());
		window.location.href = newUrl.toString();
	};

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[200px]">
				<div className="flex flex-col items-center space-y-4">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary"></div>
					<p className="text-gray-700 font-body">
						Loading documents...
					</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="space-y-6">
				<h2 className="text-xl font-semibold text-gray-700 mb-4 font-heading">
					Upload Documents
				</h2>
				<div className="bg-red-50 border border-red-200 rounded-xl p-4">
					<p className="text-red-600 font-body">{error}</p>
				</div>
				<div className="flex justify-between pt-6">
					<button
						type="button"
						onClick={handleBack}
						className="px-6 py-2 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors font-body"
					>
						Back
					</button>
				</div>
			</div>
		);
	}

	return (
		<Box
			component="form"
			onSubmit={handleSubmit}
			className="space-y-6"
			sx={lightThemeOverrides}
		>
			<div className="flex items-center gap-3 mb-4">
				<Typography variant="h6" className="text-gray-900">
					Document Upload - {productName}
				</Typography>
				<span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
					Optional
				</span>
			</div>

			<Typography className="text-gray-600 mb-6">
				You can upload your documents now or later. Providing documents
				at this stage will help us process your application faster. All
				documents must be in JPG, PNG, or PDF format and must not exceed
				50MB in size.
			</Typography>

			<List className="space-y-4">
				{documents.map((doc) => (
					<ListItem
						key={doc.id}
						className="bg-gray-50 rounded-lg p-4 flex items-start"
						sx={{ gap: 2 }}
					>
						<ListItemIcon sx={{ minWidth: 40 }}>
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
						<Box sx={{ flex: 1, minWidth: 0 }}>
							<Typography
								variant="subtitle1"
								className="text-gray-900"
							>
								{doc.name}
							</Typography>
							{doc.error ? (
								<Typography
									variant="body2"
									className="text-red-600 mt-1"
								>
									{doc.error}
								</Typography>
							) : (
								<Typography
									variant="body2"
									className="text-gray-600 mt-1"
								>
									{doc.status === "uploading"
										? "Uploading..."
										: doc.files && doc.files.length > 0
										? `${doc.files.length} file(s) uploaded`
										: "Click to upload (max 50MB)"}
								</Typography>
							)}
							{doc.files && doc.files.length > 0 && (
								<Box className="mt-3 space-y-2">
									{doc.files.map((file, index) => (
										<Box
											key={index}
											className="flex items-center bg-white p-2 rounded"
										>
											<div className="flex-1 flex items-center min-w-0 mr-2">
												<div className="truncate">
													<Typography
														variant="body2"
														className="text-gray-600"
													>
														{file.name}
													</Typography>
												</div>
												{file.url && (
													<a
														href={`${
															process.env
																.NEXT_PUBLIC_API_URL
														}/api/loan-applications/${getApplicationId()}/documents/${
															file.id
														}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-indigo-600 hover:text-indigo-500 text-sm ml-2 flex-shrink-0"
													>
														View
													</a>
												)}
											</div>
											<IconButton
												onClick={() =>
													handleDelete(doc.id, file)
												}
												disabled={
													doc.status === "uploading"
												}
												size="small"
												className="text-gray-400 hover:text-gray-600"
											>
												<DeleteIcon fontSize="small" />
											</IconButton>
										</Box>
									))}
								</Box>
							)}
						</Box>
						<Box
							sx={{ width: 180, flexShrink: 0 }}
							className="ml-4 space-y-2"
						>
							{/* Show upload and link buttons only if no files and not uploading */}
							{!doc.files?.length &&
								doc.status !== "uploading" && (
									<>
										<Button
											component="label"
											variant="outlined"
											fullWidth
											size="small"
											className="text-indigo-600 border-indigo-600 hover:bg-indigo-50"
										>
											Upload New
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
															setDocuments((prev) =>
																prev.map((d) =>
																	d.id === doc.id
																		? {
																				...d,
																				status: "error",
																				error: "Invalid file type. Only JPG, PNG, and PDF files are allowed.",
																		  }
																		: d
																)
															);
															return;
														}
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
										{previousDocuments.length > 0 && (
											<Button
												variant="outlined"
												fullWidth
												size="small"
												startIcon={<AttachFileIcon />}
												className="text-green-600 border-green-600 hover:bg-green-50"
												onClick={() => openPreviousDocsDialog(doc.name)}
											>
												Use Previous
											</Button>
										)}
									</>
								)}
							{/* Add More and Use Previous buttons when files exist */}
							{doc.files &&
								doc.files.length > 0 &&
								doc.status !== "uploading" && (
									<>
										<Button
											component="label"
											variant="outlined"
											fullWidth
											size="small"
											className="text-indigo-600 border-indigo-600 hover:bg-indigo-50"
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
															setDocuments((prev) =>
																prev.map((d) =>
																	d.id === doc.id
																		? {
																				...d,
																				status: "error",
																				error: "Invalid file type. Only JPG, PNG, and PDF files are allowed.",
																		  }
																		: d
																)
															);
															return;
														}
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
										{previousDocuments.length > 0 && (
											<Button
												variant="outlined"
												fullWidth
												size="small"
												startIcon={<AttachFileIcon />}
												className="text-green-600 border-green-600 hover:bg-green-50"
												onClick={() => openPreviousDocsDialog(doc.name)}
											>
												Use Previous
											</Button>
										)}
									</>
								)}
						</Box>
					</ListItem>
				))}
			</List>

			<Box className="flex justify-between pt-6">
				<Button
					type="button"
					variant="outlined"
					onClick={handleBack}
					className="text-gray-700 border-gray-300 hover:bg-gray-50"
				>
					Back
				</Button>
				<Button
					type="submit"
					variant="contained"
					className="bg-indigo-600 hover:bg-indigo-700 text-white"
				>
					{documents.some((doc) => doc.files && doc.files.length > 0)
						? "Continue"
						: "Continue Without Uploading"}
				</Button>
			</Box>

			<Dialog
				open={showConfirmDialog}
				onClose={() => setShowConfirmDialog(false)}
				maxWidth="sm"
				fullWidth
				sx={{
					"& .MuiDialog-paper": {
						backgroundColor: "white",
						border: "1px solid #E5E7EB",
						borderRadius: "12px",
						boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
					},
					"& .MuiBackdrop-root": {
						backgroundColor: "rgba(0, 0, 0, 0.5)",
					},
					"& .MuiDialogTitle-root": {
						color: "#374151",
						backgroundColor: "white",
						fontFamily: "Manrope, sans-serif",
						fontWeight: "600",
					},
					"& .MuiDialogContent-root": {
						backgroundColor: "white",
						color: "#374151",
						fontFamily: "Inter, sans-serif",
					},
					"& .MuiDialogActions-root": {
						backgroundColor: "white",
						padding: "24px",
					},
					"& .MuiTypography-root": {
						color: "#374151",
					},
					"& .MuiButton-outlined": {
						color: "#374151",
						backgroundColor: "white",
						borderColor: "#D1D5DB",
						"&:hover": {
							backgroundColor: "#F9FAFB",
							borderColor: "#9CA3AF",
						},
					},
					"& .MuiButton-contained": {
						color: "white",
						backgroundColor: "#7C3AED",
						"&:hover": {
							backgroundColor: "#6D28D9",
							boxShadow: "none",
						},
					},
				}}
			>
				<DialogTitle>
					{confirmDialogType === "none"
						? "Continue Without Documents?"
						: "Continue With Incomplete Documents?"}
				</DialogTitle>
				<DialogContent>
					<Typography>
						{confirmDialogType === "none"
							? "While document upload is optional, providing complete documentation at this stage will help us process your application faster. You can always upload documents later."
							: "You haven't uploaded all the requested documents. While you can continue with incomplete documentation, providing all documents at this stage will help us process your application faster. You can always upload the remaining documents later."}
					</Typography>
					{confirmDialogType === "incomplete" && (
						<Box className="mt-4">
							<Typography variant="subtitle2" className="mb-2">
								Missing Documents:
							</Typography>
							<ul className="list-disc pl-5">
								{documents
									.filter(
										(doc) =>
											!doc.files || doc.files.length === 0
									)
									.map((doc) => (
										<li key={doc.id} className="text-sm">
											{doc.name}
										</li>
									))}
							</ul>
						</Box>
					)}
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => setShowConfirmDialog(false)}
						variant="outlined"
					>
						Go Back
					</Button>
					<Button
						onClick={() => {
							setShowConfirmDialog(false);
							submitDocuments();
						}}
						variant="contained"
					>
						{confirmDialogType === "none"
							? "Continue Without Documents"
							: "Continue With Incomplete Documents"}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Previous Documents Selection Dialog */}
			<Dialog
				open={showPreviousDocsDialog}
				onClose={() => setShowPreviousDocsDialog(false)}
				maxWidth="md"
				fullWidth
				sx={{
					"& .MuiDialog-paper": {
						backgroundColor: "white",
						border: "1px solid #E5E7EB",
						borderRadius: "12px",
						boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
					},
					"& .MuiBackdrop-root": {
						backgroundColor: "rgba(0, 0, 0, 0.5)",
					},
					"& .MuiDialogTitle-root": {
						color: "#374151",
						backgroundColor: "white",
						fontFamily: "Manrope, sans-serif",
						fontWeight: "600",
					},
					"& .MuiDialogContent-root": {
						backgroundColor: "white",
						color: "#374151",
						fontFamily: "Inter, sans-serif",
					},
					"& .MuiDialogActions-root": {
						backgroundColor: "white",
						padding: "24px",
					},
					"& .MuiTypography-root": {
						color: "#374151",
					},
					"& .MuiButton-outlined": {
						color: "#374151",
						backgroundColor: "white",
						borderColor: "#D1D5DB",
						"&:hover": {
							backgroundColor: "#F9FAFB",
							borderColor: "#9CA3AF",
						},
					},
					"& .MuiButton-contained": {
						color: "white",
						backgroundColor: "#7C3AED",
						"&:hover": {
							backgroundColor: "#6D28D9",
							boxShadow: "none",
						},
					},
				}}
			>
				<DialogTitle>
					Select Previous Documents for {selectedDocType}
				</DialogTitle>
				<DialogContent>
					<Typography className="mb-4">
						Select documents from your previous uploads to use for this document type.
					</Typography>
					{previousDocuments.length === 0 ? (
						<Typography>No previous documents found.</Typography>
					) : (
						<List>
							{previousDocuments
								.filter(doc => !doc.applicationId || doc.applicationId !== getApplicationId())
								.map((doc) => (
									<ListItem
										key={doc.id}
										className="bg-gray-50 rounded-lg mb-2"
									>
										<FormControlLabel
											control={
												<Checkbox
													checked={selectedPreviousDocs.includes(doc.id)}
													onChange={() => handleSelectPreviousDoc(doc.id)}
													color="primary"
												/>
											}
											label={
												<Box className="flex-1">
													<Typography variant="subtitle2">
														{doc.type}
													</Typography>
													<Typography variant="body2" className="text-gray-600">
														{doc.fileUrl?.split("/").pop() || "Document"}
													</Typography>
													<Typography variant="caption" className="text-gray-500">
														Uploaded: {new Date(doc.createdAt).toLocaleDateString()}
													</Typography>
												</Box>
											}
											className="flex-1"
										/>
										<IconButton
											onClick={() => handlePreviewDocument(doc)}
											className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
											size="small"
										>
											<VisibilityIcon fontSize="small" />
										</IconButton>
									</ListItem>
								))}
						</List>
					)}
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => setShowPreviousDocsDialog(false)}
						variant="outlined"
					>
						Cancel
					</Button>
					<Button
						onClick={handleLinkPreviousDocuments}
						variant="contained"
						disabled={selectedPreviousDocs.length === 0}
					>
						Link Selected Documents ({selectedPreviousDocs.length})
					</Button>
				</DialogActions>
			</Dialog>

			{/* Document Preview Dialog */}
			<Dialog
				open={showPreviewDialog}
				onClose={() => setShowPreviewDialog(false)}
				maxWidth="lg"
				fullWidth
				sx={{
					"& .MuiDialog-paper": {
						backgroundColor: "white",
						border: "1px solid #E5E7EB",
						borderRadius: "12px",
						boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
						maxHeight: "90vh",
					},
					"& .MuiBackdrop-root": {
						backgroundColor: "rgba(0, 0, 0, 0.8)",
					},
					"& .MuiDialogTitle-root": {
						color: "#374151",
						backgroundColor: "white",
						fontFamily: "Manrope, sans-serif",
						fontWeight: "600",
						borderBottom: "1px solid #E5E7EB",
					},
					"& .MuiDialogContent-root": {
						backgroundColor: "white",
						color: "#374151",
						fontFamily: "Inter, sans-serif",
						padding: "0",
					},
					"& .MuiDialogActions-root": {
						backgroundColor: "white",
						padding: "16px 24px",
						borderTop: "1px solid #E5E7EB",
					},
				}}
			>
				<DialogTitle>
					Document Preview - {previewFile?.type}
				</DialogTitle>
				<DialogContent>
					{previewFile && (
						<Box className="min-h-96 flex items-center justify-center p-4">
							{isImageFile(previewFile.fileUrl) ? (
								<img
									src={`${process.env.NEXT_PUBLIC_API_URL}${previewFile.fileUrl}`}
									alt="Document preview"
									style={{
										maxWidth: "100%",
										maxHeight: "70vh",
										objectFit: "contain",
									}}
									onError={(e) => {
										console.error("Failed to load image preview");
										e.currentTarget.style.display = "none";
										e.currentTarget.parentElement!.innerHTML = `
											<div class="text-center text-gray-500 p-8">
												<p>Preview not available</p>
												<p class="text-sm">Unable to load image preview</p>
											</div>
										`;
									}}
								/>
							) : isPDFFile(previewFile.fileUrl) ? (
								<iframe
									src={`${process.env.NEXT_PUBLIC_API_URL}${previewFile.fileUrl}`}
									width="100%"
									height="600px"
									style={{ border: "none" }}
									title="PDF preview"
									onError={() => {
										console.error("Failed to load PDF preview");
									}}
								/>
							) : (
								<Box className="text-center text-gray-500 p-8">
									<Typography variant="h6" className="mb-2">
										Preview not available
									</Typography>
									<Typography variant="body2" className="mb-4">
										This file type cannot be previewed directly.
									</Typography>
									<Button
										variant="outlined"
										onClick={() => {
											window.open(
												`${process.env.NEXT_PUBLIC_API_URL}${previewFile.fileUrl}`,
												"_blank"
											);
										}}
									>
										Download File
									</Button>
								</Box>
							)}
						</Box>
					)}
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => setShowPreviewDialog(false)}
						variant="outlined"
					>
						Close Preview
					</Button>
					{previewFile && (
						<Button
							onClick={() => {
								window.open(
									`${process.env.NEXT_PUBLIC_API_URL}${previewFile.fileUrl}`,
									"_blank"
								);
							}}
							variant="contained"
						>
							Open in New Tab
						</Button>
					)}
				</DialogActions>
			</Dialog>
		</Box>
	);
}
