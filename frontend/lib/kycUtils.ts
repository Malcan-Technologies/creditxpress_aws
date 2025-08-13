import { fetchWithTokenRefresh } from "./authUtils";

export interface KycImages {
	kycId: string;
	completedAt: string;
	images: {
		front?: {
			id: string;
			url: string;
			type: string;
		} | null;
		back?: {
			id: string;
			url: string;
			type: string;
		} | null;
		selfie?: {
			id: string;
			url: string;
			type: string;
		} | null;
	};
}

/**
 * Fetch user's KYC verification images
 */
export async function fetchKycImages(): Promise<KycImages | null> {
	try {
		console.log("kycUtils - Fetching KYC images...");
		const data = await fetchWithTokenRefresh<KycImages>(
			`/api/kyc/images?t=${Date.now()}`
		);
		console.log("kycUtils - KYC images response:", data);
		return data;
	} catch (error) {
		console.error("kycUtils - Error fetching KYC images:", error);
		return null;
	}
}

/**
 * Get the URL for a KYC image
 * @param imageId - The ID of the KYC image
 * @returns The URL to view the image
 */
export function getKycImageUrl(imageId: string): string {
	const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";
	return `${baseUrl}/api/kyc/images/${imageId}`;
}

/**
 * Open a KYC image in a new tab
 * @param imageId - The ID of the KYC image
 */
export function viewKycImage(imageId: string): void {
	const url = getKycImageUrl(imageId);
	window.open(url, "_blank");
}
