import Cookies from "js-cookie";

/**
 * Get the cookie domain from NEXT_PUBLIC_SITE_URL environment variable
 * Extracts domain and adds dot prefix for subdomain sharing
 */
function getCookieDomain(): string | undefined {
	if (typeof window === "undefined") return undefined;
	
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
	if (!siteUrl) return undefined;
	
	try {
		const url = new URL(siteUrl);
		// Add dot prefix to allow subdomain sharing (e.g., '.creditxpress.com.my')
		return `.${url.hostname}`;
	} catch (error) {
		console.warn('Failed to parse NEXT_PUBLIC_SITE_URL for cookie domain:', error);
		return undefined;
	}
}

/**
 * Utility function to detect if user is on mobile device
 */
function isMobileDevice(): boolean {
	if (typeof navigator === 'undefined') return false;
	
	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
		   (window.innerWidth <= 768);
}

/**
 * Token storage utility functions to handle both localStorage and cookies
 */
export const TokenStorage = {
	// Access token functions
	getAccessToken: (): string | null => {
		if (typeof window === "undefined") return Cookies.get("token") || null;
		return localStorage.getItem("token") || Cookies.get("token") || null;
	},

	// Note: expiresInDays=0.01 is approximately 15 minutes, matching the JWT expiration in the backend
	setAccessToken: (token: string, expiresInDays: number = 0.01): void => {
		try {
			if (typeof window !== "undefined") {
				localStorage.setItem("token", token);
				console.log(
					"[TokenStorage] Access token stored in localStorage"
				);
			}
			const cookieDomain = getCookieDomain();
			Cookies.set("token", token, { 
				expires: expiresInDays,
				...(cookieDomain && { domain: cookieDomain }),
				secure: true,
				sameSite: 'lax'
			});
			console.log("[TokenStorage] Access token stored in cookies");
		} catch (error) {
			console.error(
				"[TokenStorage] Failed to store access token:",
				error
			);
		}
	},

	removeAccessToken: (): void => {
		try {
			if (typeof window !== "undefined") {
				localStorage.removeItem("token");
			}
			const cookieDomain = getCookieDomain();
			Cookies.remove("token", cookieDomain ? { domain: cookieDomain } : {});
			console.log("[TokenStorage] Access token removed");
		} catch (error) {
			console.error(
				"[TokenStorage] Failed to remove access token:",
				error
			);
		}
	},

	// Refresh token functions
	getRefreshToken: (): string | null => {
		if (typeof window === "undefined")
			return Cookies.get("refreshToken") || null;
		return (
			localStorage.getItem("refreshToken") ||
			Cookies.get("refreshToken") ||
			null
		);
	},

	// 90 days expiration, matching the backend JWT refresh token expiration
	setRefreshToken: (token: string, expiresInDays: number = 90): void => {
		try {
			if (typeof window !== "undefined") {
				localStorage.setItem("refreshToken", token);
				console.log(
					"[TokenStorage] Refresh token stored in localStorage"
				);
			}
			const cookieDomain = getCookieDomain();
			Cookies.set("refreshToken", token, { 
				expires: expiresInDays,
				...(cookieDomain && { domain: cookieDomain }),
				secure: true,
				sameSite: 'lax'
			});
			console.log("[TokenStorage] Refresh token stored in cookies");
		} catch (error) {
			console.error(
				"[TokenStorage] Failed to store refresh token:",
				error
			);
		}
	},

	removeRefreshToken: (): void => {
		try {
			if (typeof window !== "undefined") {
				localStorage.removeItem("refreshToken");
			}
			const cookieDomain = getCookieDomain();
			Cookies.remove("refreshToken", cookieDomain ? { domain: cookieDomain } : {});
			console.log("[TokenStorage] Refresh token removed");
		} catch (error) {
			console.error(
				"[TokenStorage] Failed to remove refresh token:",
				error
			);
		}
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

	// Ensure URL is absolute - use backend URL for API calls
	const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
	const absoluteUrl = url.startsWith('/') ? `${baseUrl}${url}` : url;

	// Set up headers with authorization
	const headers = {
		...options.headers,
		Authorization: `Bearer ${accessToken}`,
		"Content-Type": "application/json",
	};

	// Make the initial request
	let response = await fetch(absoluteUrl, { ...options, headers });

	// If unauthorized, try to refresh the token and retry the request
	if (response.status === 401 || response.status === 403) {
		const newAccessToken = await refreshAccessToken();

		if (!newAccessToken) {
			throw new Error("Failed to refresh access token");
		}

		// Update headers with new access token
		headers["Authorization"] = `Bearer ${newAccessToken}`;

		// Retry the request
		response = await fetch(absoluteUrl, { ...options, headers });
	}

	if (!response.ok) {
		// Try to extract error message from response
		let errorMessage = `API request failed with status: ${response.status}`;
		
		try {
			const errorData = await response.json();
			console.log("fetchWithTokenRefresh - Error data received:", errorData);
			// Prioritize message over error object, and handle error object properly
			errorMessage = errorData.message || 
						  (typeof errorData.error === 'string' ? errorData.error : errorData.error?.details) || 
						  errorMessage;
			console.log("fetchWithTokenRefresh - Final error message:", errorMessage);
		} catch (parseError) {
			console.log("fetchWithTokenRefresh - Failed to parse error response:", parseError);
			// If we can't parse the error response, use the generic message
			// Keep the default errorMessage
		}
		throw new Error(errorMessage);
	}

	// Check for cross-device sync trigger header
	const profileUpdated = response.headers.get('X-Profile-Updated');
	if (profileUpdated === 'true') {
		console.log("fetchWithTokenRefresh - Profile updated, triggering cross-device sync");
		// Set localStorage flag to trigger cross-tab/cross-device updates
		try {
			localStorage.setItem('profile_updated', Date.now().toString());
			
			// If user is on mobile, also set a flag for web redirect
			if (isMobileDevice()) {
				localStorage.setItem('mobile_profile_update', JSON.stringify({
					timestamp: Date.now(),
					action: 'redirect_to_profile',
					url: '/dashboard/profile'
				}));
			}
		} catch (e) {
			console.warn("Failed to set profile update flags:", e);
		}
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
		const refreshToken = TokenStorage.getRefreshToken();

		// If no access token available, try to refresh using refresh token
		if (!accessToken) {
			console.log("checkAuth - No access token found, attempting refresh");
			
			if (!refreshToken) {
				console.log("checkAuth - No refresh token available, authentication failed");
				return false;
			}

			const newToken = await refreshAccessToken();
			if (!newToken) {
				console.log("checkAuth - Token refresh failed, authentication failed");
				return false;
			}
			
			console.log("checkAuth - Token refreshed successfully");
			return true;
		}

		// Verify token validity by making a request to /api/users/me
		try {
			await fetchWithTokenRefresh("/api/users/me");
			console.log("checkAuth - Token validation successful");
			return true;
		} catch (error) {
			console.log("checkAuth - Token validation failed, attempting refresh");
			// Token is invalid, try to refresh
			const newToken = await refreshAccessToken();
			if (!newToken) {
				console.log("checkAuth - Token refresh after validation failure failed");
				return false;
			}
			
			console.log("checkAuth - Token refreshed successfully after validation failure");
			return true;
		}
	} catch (error) {
		console.error("checkAuth - Unexpected error during auth check:", error);
		return false;
	}
};
