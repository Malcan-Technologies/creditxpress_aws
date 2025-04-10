import Cookies from "js-cookie";

/**
 * Token storage utility functions to handle both localStorage and cookies
 */
export const TokenStorage = {
	// Access token functions
	getAccessToken: (): string | null => {
		return localStorage.getItem("token") || Cookies.get("token") || null;
	},

	// Note: expiresInDays=0.01 is approximately 15 minutes, matching the JWT expiration in the backend
	setAccessToken: (token: string, expiresInDays: number = 0.01): void => {
		localStorage.setItem("token", token);
		Cookies.set("token", token, { expires: expiresInDays });
	},

	removeAccessToken: (): void => {
		localStorage.removeItem("token");
		Cookies.remove("token");
	},

	// Refresh token functions
	getRefreshToken: (): string | null => {
		return (
			localStorage.getItem("refreshToken") ||
			Cookies.get("refreshToken") ||
			null
		);
	},

	// 90 days expiration, matching the backend JWT refresh token expiration
	setRefreshToken: (token: string, expiresInDays: number = 90): void => {
		localStorage.setItem("refreshToken", token);
		Cookies.set("refreshToken", token, { expires: expiresInDays });
	},

	removeRefreshToken: (): void => {
		localStorage.removeItem("refreshToken");
		Cookies.remove("refreshToken");
	},

	// Clear all tokens
	clearTokens: (): void => {
		TokenStorage.removeAccessToken();
		TokenStorage.removeRefreshToken();
	},
};

/**
 * Handles token refresh when access token expires
 * @returns A promise resolving to a new access token or null if refresh fails
 */
export const refreshAccessToken = async (): Promise<string | null> => {
	try {
		const refreshToken = TokenStorage.getRefreshToken();

		if (!refreshToken) {
			console.error("No refresh token available");
			return null;
		}

		const response = await fetch("/api/auth/refresh", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ refreshToken }),
		});

		if (!response.ok) {
			throw new Error("Failed to refresh token");
		}

		const data = await response.json();

		// Store the new tokens
		TokenStorage.setAccessToken(data.accessToken);
		TokenStorage.setRefreshToken(data.refreshToken);

		return data.accessToken;
	} catch (error) {
		console.error("Error refreshing token:", error);
		// Clear tokens on refresh failure
		TokenStorage.clearTokens();
		return null;
	}
};

/**
 * Makes an authenticated API request with automatic token refresh
 * @param url The URL to fetch
 * @param options Fetch options
 * @returns Promise with the response
 */
export const fetchWithTokenRefresh = async <T>(
	url: string,
	options: RequestInit = {}
): Promise<T> => {
	// First try with existing access token
	let accessToken = TokenStorage.getAccessToken();

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
		const newAccessToken = await refreshAccessToken();

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
 * Checks if the user is authenticated and refreshes token if needed
 * @returns Promise resolving to true if authenticated, false otherwise
 */
export const checkAuth = async (): Promise<boolean> => {
	try {
		// Try to use current token
		const accessToken = TokenStorage.getAccessToken();

		if (!accessToken) {
			// No access token available, try to refresh
			const newToken = await refreshAccessToken();
			return !!newToken;
		}

		// Verify token validity by making a request to /api/users/me
		try {
			await fetchWithTokenRefresh("/api/users/me");
			return true;
		} catch (error) {
			// Token is invalid, try to refresh
			const newToken = await refreshAccessToken();
			return !!newToken;
		}
	} catch (error) {
		console.error("Auth check failed:", error);
		return false;
	}
};
