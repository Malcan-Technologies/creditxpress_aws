interface User {
	id: string;
	phoneNumber: string;
	createdAt: string;
	updatedAt: string;
}

export async function getCurrentUser(accessToken: string): Promise<User> {
	if (!accessToken) {
		console.error("getCurrentUser - No access token provided");
		throw new Error("No access token provided");
	}

	console.log(
		"getCurrentUser - Making API call with token:",
		accessToken.substring(0, 10) + "..."
	);

	try {
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`,
			{
				headers: {
					Authorization: `Bearer ${accessToken.replace(
						/^"|"$/g,
						""
					)}`,
					"Content-Type": "application/json",
				},
			}
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			console.error("getCurrentUser - API call failed:", {
				status: response.status,
				statusText: response.statusText,
				error: errorData,
			});
			throw new Error(
				`Failed to fetch user data: ${response.statusText}`
			);
		}

		const data = await response.json();
		console.log("getCurrentUser - API call successful:", { data });
		return data;
	} catch (error) {
		console.error("getCurrentUser - Error:", error);
		throw error;
	}
}
