"use client";

import { useEffect, useState } from "react";
import { TokenStorage, refreshAccessToken } from "@/lib/authUtils";
import { useRouter, usePathname } from "next/navigation";

// This component automatically refreshes the access token before it expires
export default function TokenRefresher() {
	const router = useRouter();
	const pathname = usePathname();
	const [isRefreshing, setIsRefreshing] = useState(false);

	useEffect(() => {
		// Helper to check if we're on a protected route
		const isProtectedRoute = () => {
			// Dashboard and onboarding routes are protected
			return (
				pathname?.startsWith("/dashboard") ||
				pathname?.startsWith("/onboarding")
			);
		};

		// Check if we have tokens and are on a protected route
		const accessToken = TokenStorage.getAccessToken();
		const refreshToken = TokenStorage.getRefreshToken();

		// If no tokens and on protected route, redirect to login
		if (!refreshToken && isProtectedRoute()) {
			router.push("/login");
			return;
		}

		if (!accessToken && refreshToken && isProtectedRoute()) {
			// Try to refresh the token immediately if we have refresh token but no access token
			handleTokenRefresh();
		}

		// Set up regular token refresh - check every minute
		const intervalId = setInterval(() => {
			const currentToken = TokenStorage.getAccessToken();
			if (currentToken && isProtectedRoute()) {
				// Decode the token to check its expiration time
				try {
					const payload = JSON.parse(
						atob(currentToken.split(".")[1])
					);
					const expirationTime = payload.exp * 1000; // Convert to milliseconds
					const currentTime = Date.now();

					// If token will expire in the next 5 minutes, refresh it
					if (expirationTime - currentTime < 5 * 60 * 1000) {
						console.log("Token expiring soon, refreshing...");
						handleTokenRefresh();
					}
				} catch (error) {
					console.error("Error decoding token:", error);
					// If we can't decode the token, try to refresh it anyway
					handleTokenRefresh();
				}
			}
		}, 60000); // Check every minute

		return () => clearInterval(intervalId);
	}, [pathname, router]);

	const handleTokenRefresh = async () => {
		if (isRefreshing) return; // Prevent multiple simultaneous refresh attempts

		setIsRefreshing(true);
		try {
			const refreshToken = TokenStorage.getRefreshToken();
			if (!refreshToken) {
				// No refresh token, can't refresh
				router.push("/login");
				return;
			}

			const newToken = await refreshAccessToken();
			if (!newToken) {
				// Failed to refresh, redirect to login
				router.push("/login");
			}
		} catch (error) {
			console.error("Token refresh failed:", error);
			router.push("/login");
		} finally {
			setIsRefreshing(false);
		}
	};

	// This component doesn't render anything
	return null;
}
