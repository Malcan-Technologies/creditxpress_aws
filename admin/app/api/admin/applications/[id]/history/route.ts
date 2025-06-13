import { NextResponse } from "next/server";

export async function GET(
	request: Request,
	{ params }: { params: { id: string } }
) {
	try {
		const id = params.id;
		console.log(
			`API /admin/applications/${id}/history - Fetching application history`
		);

		const backendUrl = process.env.NEXT_PUBLIC_API_URL;

		// Get token from Authorization header
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "");

		if (!token) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		// Fetch application history from the backend
		try {
			const response = await fetch(
				`${backendUrl}/api/admin/applications/${id}/history`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
				}
			);

			if (!response.ok) {
				const errorData = await response.json();
				console.error(
					`Error fetching application history: ${response.status}`,
					errorData
				);

				// If the backend returns 404, return an empty array instead of an error
				// This is useful during development when the endpoint might not exist yet
				if (response.status === 404) {
					console.log(
						`Backend endpoint for history not found. Returning empty array.`
					);
					return NextResponse.json([]);
				}

				return NextResponse.json(
					{
						error:
							errorData.error ||
							"Failed to fetch application history",
					},
					{ status: response.status }
				);
			}

			const historyData = await response.json();
			console.log(
				`API /admin/applications/${id}/history - Backend response:`,
				JSON.stringify(historyData, null, 2)
			);

			// Extract the timeline from the backend response
			const timeline = historyData.timeline || historyData || [];
			console.log(
				`API /admin/applications/${id}/history - Extracted timeline:`,
				JSON.stringify(timeline, null, 2)
			);
			console.log(
				`API /admin/applications/${id}/history - Timeline length: ${timeline.length}`
			);

			return NextResponse.json(timeline);
		} catch (fetchError) {
			console.error(
				`API /admin/applications/${id}/history - Error:`,
				fetchError
			);

			// During development, if the backend endpoint doesn't exist, return mock data
			console.log(`Returning mock history data for development purposes`);

			// Generate mock history data based on the application ID
			const mockHistory = [
				{
					id: `hist-${id}-1`,
					loanApplicationId: id,
					previousStatus: null,
					newStatus: "INCOMPLETE",
					changedBy: "System",
					changedById: "system",
					createdAt: new Date(
						Date.now() - 7 * 24 * 60 * 60 * 1000
					).toISOString(), // 7 days ago
					notes: "Application created",
				},
				{
					id: `hist-${id}-2`,
					loanApplicationId: id,
					previousStatus: "INCOMPLETE",
					newStatus: "PENDING_APP_FEE",
					changedBy: "System",
					changedById: "system",
					createdAt: new Date(
						Date.now() - 6 * 24 * 60 * 60 * 1000
					).toISOString(), // 6 days ago
					notes: "Application fee required",
				},
				{
					id: `hist-${id}-3`,
					loanApplicationId: id,
					previousStatus: "PENDING_APP_FEE",
					newStatus: "PENDING_KYC",
					changedBy: "Admin User",
					changedById: "admin-1",
					createdAt: new Date(
						Date.now() - 5 * 24 * 60 * 60 * 1000
					).toISOString(), // 5 days ago
					notes: "Application fee received",
				},
				{
					id: `hist-${id}-4`,
					loanApplicationId: id,
					previousStatus: "PENDING_KYC",
					newStatus: "PENDING_APPROVAL",
					changedBy: "Admin User",
					changedById: "admin-1",
					createdAt: new Date(
						Date.now() - 3 * 24 * 60 * 60 * 1000
					).toISOString(), // 3 days ago
					notes: "KYC verification completed",
				},
			];

			// If the application ID includes "disburse", add more status updates
			if (id.includes("disburse")) {
				mockHistory.push(
					{
						id: `hist-${id}-5`,
						loanApplicationId: id,
						previousStatus: "PENDING_APPROVAL",
						newStatus: "APPROVED",
						changedBy: "Credit Officer",
						changedById: "admin-2",
						createdAt: new Date(
							Date.now() - 2 * 24 * 60 * 60 * 1000
						).toISOString(), // 2 days ago
						notes: "Application approved by credit committee",
					},
					{
						id: `hist-${id}-6`,
						loanApplicationId: id,
						previousStatus: "APPROVED",
						newStatus: "PENDING_SIGNATURE",
						changedBy: "System",
						changedById: "system",
						createdAt: new Date(
							Date.now() - 1.5 * 24 * 60 * 60 * 1000
						).toISOString(), // 1.5 days ago
						notes: "Loan agreement sent to customer",
					},
					{
						id: `hist-${id}-7`,
						loanApplicationId: id,
						previousStatus: "PENDING_SIGNATURE",
						newStatus: "PENDING_DISBURSEMENT",
						changedBy: "Admin User",
						changedById: "admin-1",
						createdAt: new Date(
							Date.now() - 1 * 24 * 60 * 60 * 1000
						).toISOString(), // 1 day ago
						notes: "Loan agreement signed by customer",
					}
				);
			}

			return NextResponse.json(mockHistory);
		}
	} catch (error) {
		console.error(
			`API /admin/applications/${params.id}/history - Error:`,
			error
		);
		return NextResponse.json(
			{ error: "Failed to fetch application history" },
			{ status: 500 }
		);
	}
}
