import { NextResponse } from "next/server";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function POST(
	request: Request,
	{ params }: { params: { id: string } }
) {
	// Handle status update with POST method
	return handleStatusUpdate(request, params);
}

export async function PATCH(
	request: Request,
	{ params }: { params: { id: string } }
) {
	// Handle status update with PATCH method
	return handleStatusUpdate(request, params);
}

// Shared function to handle status updates for both POST and PATCH
async function handleStatusUpdate(request: Request, params: { id: string }) {
	try {
		const { id } = params;
		const backendUrl =
			process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";
		const token = request.headers.get("authorization")?.split(" ")[1];

		console.log(
			`Admin API Status: Processing status update for application ${id}`
		);
		console.log(`Status Backend URL: ${backendUrl}`);
		console.log(`Status Token available: ${!!token}`);

		if (!token) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		// Get the request body for the status update
		const body = await request.json();
		console.log(`Admin API Status: Request body:`, body);

		// Map frontend status names to backend status names if needed
		let backendStatus = body.status;
		// No mapping needed now since we're using the same status names

		// Prepare the payload
		const payload = {
			status: backendStatus,
			notes: body.notes || "",
		};

		// Add referenceNumber to payload if provided (for disbursement)
		if (body.referenceNumber) {
			// @ts-ignore
			payload.referenceNumber = body.referenceNumber;
		}

		console.log(
			`Admin API Status: Updating application ${id} to status ${backendStatus}`
		);
		console.log(
			`Status API URL: ${backendUrl}/api/admin/applications/${id}/status`
		);
		console.log("Admin API Status: Request payload:", payload);

		// Update the application status via the backend API
		const response = await fetch(
			`${backendUrl}/api/admin/applications/${id}/status`,
			{
				method: "PATCH", // Use PATCH for partial updates
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			}
		);

		console.log(
			`Admin API Status: Backend response status: ${response.status}`
		);

		if (!response.ok) {
			let errorData;
			try {
				errorData = await response.json();
			} catch (parseError) {
				console.error("Failed to parse error response:", parseError);
				errorData = { message: "Failed to parse error response" };
			}

			console.error("Backend API status error:", errorData);
			return NextResponse.json(
				{
					error:
						errorData.message ||
						errorData.error ||
						"Failed to update application status",
					details: errorData,
				},
				{ status: response.status }
			);
		}

		const data = await response.json();
		console.log("Admin API Status: Successful response:", data);

		// After updating the status, create a history entry
		try {
			// First, get the current application data to know the previous status
			const appResponse = await fetch(
				`${backendUrl}/api/admin/applications/${id}`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
				}
			);

			if (appResponse.ok) {
				// Get admin user info for attribution
				const adminResponse = await fetch(
					`${backendUrl}/api/admin/users/me`,
					{
						method: "GET",
						headers: {
							Authorization: `Bearer ${token}`,
							"Content-Type": "application/json",
						},
					}
				);

				let adminUser = { id: "unknown", fullName: "Admin User" };
				if (adminResponse.ok) {
					adminUser = await adminResponse.json();
				}

				// Create history entry
				const historyPayload = {
					applicationId: id,
					previousStatus: data.previousStatus || null, // The backend should return the previous status
					newStatus: backendStatus,
					changedBy: adminUser.fullName,
					changedById: adminUser.id,
					notes: body.notes || `Status updated to ${backendStatus}`,
				};

				console.log("Creating history entry:", historyPayload);

				// Call API to create history entry
				const historyResponse = await fetch(
					`${backendUrl}/api/admin/applications/${id}/history`,
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${token}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify(historyPayload),
					}
				);

				if (!historyResponse.ok) {
					console.warn(
						"Failed to create history entry, but status was updated successfully"
					);
				} else {
					console.log("Successfully created history entry");
				}
			}
		} catch (historyError) {
			// Don't fail the whole request if history creation fails
			console.error("Error creating history entry:", historyError);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error updating application status:", error);
		return NextResponse.json(
			{
				error: "Failed to update application status",
				details:
					error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
