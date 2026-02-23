import { redirect } from "next/navigation";

interface PKISigningEntryPageProps {
	searchParams?: Promise<{
		application?: string;
		signatory?: string;
	}>;
}

export default async function PKISigningEntryPage({
	searchParams,
}: PKISigningEntryPageProps) {
	const resolvedSearchParams = await searchParams;
	const applicationId = resolvedSearchParams?.application?.trim();
	const signatoryType = resolvedSearchParams?.signatory?.trim().toUpperCase();
	const isSupportedSignatory =
		signatoryType === "COMPANY" || signatoryType === "WITNESS";

	if (!applicationId || !isSupportedSignatory) {
		redirect("/dashboard/applications?tab=signatures");
	}

	redirect(
		`/pki-signing?application=${encodeURIComponent(
			applicationId
		)}&signatory=${encodeURIComponent(signatoryType)}`
	);
}
