import Cookies from "js-cookie";

/**
 * Token storage utility functions to handle both localStorage and cookies
 */
export const AdminTokenStorage = {
	// Access token functions
	getAccessToken: (): string | null => {
		return (
			localStorage.getItem("adminToken") ||
			Cookies.get("adminToken") ||
			null
		);
	},

	// 15 minutes expiration, matching the JWT expiration in the backend
	setAccessToken: (token: string, expiresInDays: number = 0.01): void => {
		localStorage.setItem("adminToken", token);
		Cookies.set("adminToken", token, { expires: expiresInDays });
	},

	removeAccessToken: (): void => {
		localStorage.removeItem("adminToken");
		Cookies.remove("adminToken");
	},

	// Refresh token functions
	getRefreshToken: (): string | null => {
		return (
			localStorage.getItem("adminRefreshToken") ||
			Cookies.get("adminRefreshToken") ||
			null
		);
	},

	// 30 days expiration, matching the backend JWT refresh token expiration
	setRefreshToken: (token: string, expiresInDays: number = 30): void => {
		localStorage.setItem("adminRefreshToken", token);
		Cookies.set("adminRefreshToken", token, { expires: expiresInDays });
	},

	removeRefreshToken: (): void => {
		localStorage.removeItem("adminRefreshToken");
		Cookies.remove("adminRefreshToken");
	},

	// Clear all tokens
	clearTokens: (): void => {
		AdminTokenStorage.removeAccessToken();
		AdminTokenStorage.removeRefreshToken();
	},
};

/**
 * Handles token refresh when access token expires
 * @returns A promise resolving to a new access token or null if refresh fails
 */
export const refreshAdminAccessToken = async (): Promise<string | null> => {
	try {
		const refreshToken = AdminTokenStorage.getRefreshToken();
		console.log(
			"refreshAdminAccessToken - Refresh token exists:",
			!!refreshToken
		);

		if (!refreshToken) {
			console.error("No refresh token available");
			return null;
		}

		console.log("refreshAdminAccessToken - Calling /api/admin/refresh");
		const response = await fetch("/api/admin/refresh", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ refreshToken }),
		});

		console.log(
			"refreshAdminAccessToken - Response status:",
			response.status
		);

		if (!response.ok) {
			console.error(
				"refreshAdminAccessToken - Error response:",
				response.status
			);
			const errorText = await response.text();
			console.error(
				"refreshAdminAccessToken - Error details:",
				errorText
			);
			throw new Error("Failed to refresh token");
		}

		const data = await response.json();
		console.log("refreshAdminAccessToken - Got new tokens:", {
			accessToken: !!data.accessToken,
			refreshToken: !!data.refreshToken,
		});

		// Store the new tokens
		AdminTokenStorage.setAccessToken(data.accessToken);
		AdminTokenStorage.setRefreshToken(data.refreshToken);

		return data.accessToken;
	} catch (error) {
		console.error("Error refreshing token:", error);
		// Clear tokens on refresh failure
		AdminTokenStorage.clearTokens();
		return null;
	}
};

/**
 * Makes an authenticated API request with automatic token refresh
 * @param url The URL to fetch
 * @param options Fetch options
 * @returns Promise with the response
 */
export const fetchWithAdminTokenRefresh = async <T>(
	url: string,
	options: RequestInit = {}
): Promise<T> => {
	// First try with existing access token
	let accessToken = AdminTokenStorage.getAccessToken();

	if (!accessToken) {
		throw new Error("No access token available");
	}

	// Set up headers with authorization
	const headers = {
		...options.headers,
		Authorization: `Bearer ${accessToken}`,
		"Content-Type": "application/json",
	};

	// Make the initial request
	let response = await fetch(url, { ...options, headers });

	// If unauthorized, try to refresh the token and retry the request
	if (response.status === 401 || response.status === 403) {
		const newAccessToken = await refreshAdminAccessToken();

		if (!newAccessToken) {
			throw new Error("Failed to refresh access token");
		}

		// Update headers with new access token
		headers["Authorization"] = `Bearer ${newAccessToken}`;

		// Retry the request
		response = await fetch(url, { ...options, headers });
	}

	if (!response.ok) {
		throw new Error(`API request failed with status: ${response.status}`);
	}

	return response.json();
};

/**
 * Checks if the admin is authenticated and refreshes token if needed
 * @returns Promise resolving to true if authenticated, false otherwise
 */
export const checkAdminAuth = async (): Promise<boolean> => {
	try {
		// Try to use current token
		const accessToken = AdminTokenStorage.getAccessToken();
		console.log("checkAdminAuth - Access token exists:", !!accessToken);

		if (!accessToken) {
			// No access token available, try to refresh
			console.log("checkAdminAuth - No access token, trying refresh");
			const newToken = await refreshAdminAccessToken();
			console.log("checkAdminAuth - Refresh result:", !!newToken);
			return !!newToken;
		}

		// Verify token validity by making a request to /api/users/me
		try {
			console.log("checkAdminAuth - Verifying token with /api/users/me");
			interface UserData {
				id: string;
				fullName?: string;
				phoneNumber?: string;
				email?: string;
				role: string;
			}

			const userData = await fetchWithAdminTokenRefresh<UserData>(
				"/api/users/me"
			);
			console.log("checkAdminAuth - User data:", userData);

			// Verify that the user has ADMIN role
			const isAdmin = userData.role === "ADMIN";
			console.log(
				"checkAdminAuth - Is admin:",
				isAdmin,
				"role:",
				userData.role
			);
			return isAdmin;
		} catch (error) {
			console.error("checkAdminAuth - User data fetch error:", error);
			// Token is invalid, try to refresh
			console.log("checkAdminAuth - Token invalid, trying refresh");
			const newToken = await refreshAdminAccessToken();
			console.log("checkAdminAuth - Refresh result:", !!newToken);
			return !!newToken;
		}
	} catch (error) {
		console.error("Auth check failed:", error);
		return false;
	}
};
