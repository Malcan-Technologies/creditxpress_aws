import { NextResponse } from "next/server";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function POST(
	request: Request,
	{ params }: { params: { id: string } }
) {
	try {
		const { id } = params;
		const backendUrl =
			process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";
		const token = request.headers.get("authorization")?.split(" ")[1];

		console.log(
			`Admin API Disburse: Processing disbursement for application ${id}`
		);
		console.log(`Disburse Backend URL: ${backendUrl}`);
		console.log(`Disburse Token available: ${!!token}`);

		if (!token) {
			console.log("Admin API Disburse: No token provided");
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		// Get the request body for the disbursement details
		const body = await request.json();
		console.log(`Admin API Disburse: Request body:`, body);

		// Validate required fields
		if (!body.referenceNumber) {
			console.log("Admin API Disburse: Missing referenceNumber");
			return NextResponse.json(
				{ error: "Reference number is required" },
				{ status: 400 }
			);
		}

		// Prepare the payload for disbursement
		const payload = {
			referenceNumber: body.referenceNumber,
			notes: body.notes || "",
		};

		console.log(
			`Admin API Disburse: Disbursing application ${id} with reference ${body.referenceNumber}`
		);
		console.log(
			`Disburse API URL: ${backendUrl}/api/admin/applications/${id}/disburse`
		);
		console.log("Admin API Disburse: Request payload:", payload);

		// Process the disbursement via the backend API
		const response = await fetch(
			`${backendUrl}/api/admin/applications/${id}/disburse`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			}
		);

		console.log(
			`Admin API Disburse: Backend response status: ${response.status}`
		);

		if (!response.ok) {
			let errorData;
			try {
				errorData = await response.json();
			} catch (parseError) {
				console.error("Failed to parse error response:", parseError);
				errorData = { message: "Failed to parse error response" };
			}

			console.error("Backend API disbursement error:", errorData);

			// Handle specific error cases
			let errorMessage =
				errorData.message ||
				errorData.error ||
				"Failed to process disbursement";
			if (errorMessage.includes("already been disbursed")) {
				errorMessage =
					"This loan has already been disbursed. Please check the application status.";
			}

			return NextResponse.json(
				{
					error: errorMessage,
					details: errorData,
				},
				{ status: response.status }
			);
		}

		const data = await response.json();
		console.log("Admin API Disburse: Successful response:", data);

		// After successful disbursement, create a history entry
		try {
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

			// Create history entry for disbursement
			const historyPayload = {
				applicationId: id,
				previousStatus: "PENDING_DISBURSEMENT",
				newStatus: "DISBURSED", // Assumes this is the status after disbursement
				changedBy: adminUser.fullName,
				changedById: adminUser.id,
				notes:
					body.notes ||
					`Loan disbursed with reference: ${body.referenceNumber}`,
			};

			console.log("Creating disbursement history entry:", historyPayload);

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
					"Failed to create disbursement history entry, but disbursement was processed successfully"
				);
			} else {
				console.log("Successfully created disbursement history entry");
			}
		} catch (historyError) {
			// Don't fail the whole request if history creation fails
			console.error(
				"Error creating disbursement history entry:",
				historyError
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error processing disbursement:", error);
		return NextResponse.json(
			{
				error: "Failed to process disbursement",
				details:
					error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
