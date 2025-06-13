"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PendingDisbursementRedirect() {
	const router = useRouter();

	useEffect(() => {
		// Redirect to the unified applications page with pending-disbursement filter
		router.replace("/dashboard/applications?filter=pending-disbursement");
	}, [router]);

	return (
		<div className="flex items-center justify-center min-h-screen bg-gray-900">
			<div className="text-center">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto mb-4"></div>
				<p className="text-gray-300">
					Redirecting to unified applications page...
				</p>
			</div>
		</div>
	);
}
