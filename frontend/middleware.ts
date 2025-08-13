import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	// Get the pathname of the request
	const path = request.nextUrl.pathname;

	console.log(`[Middleware] Checking path: ${path}`);
	console.log(`[Middleware] Full URL: ${request.url}`);
	console.log(`[Middleware] Search params: ${request.nextUrl.searchParams.toString()}`);

	// Check if the path starts with /dashboard
	if (path.startsWith("/dashboard")) {
		// Special handling for KYC routes with temporary tokens
		if (path.startsWith("/dashboard/kyc/")) {
			const kycToken = request.nextUrl.searchParams.get("t");
			console.log(`[Middleware] KYC route detected for path: ${path}`);
			console.log(`[Middleware] Token check - kycToken: ${kycToken ? 'PRESENT' : 'MISSING'}`);
			console.log(`[Middleware] Full search params: ${request.nextUrl.searchParams.toString()}`);
			if (kycToken) {
				console.log(`[Middleware] ✅ KYC token found, allowing access without cookies`);
				return NextResponse.next();
			} else {
				console.log(`[Middleware] ❌ No KYC token found, continuing to regular auth check`);
			}
		}

		// Get the token from the cookies
		const token = request.cookies.get("token")?.value;
		const refreshToken = request.cookies.get("refreshToken")?.value;

		console.log(`[Middleware] Token check for ${path}:`, {
			hasToken: !!token,
			hasRefreshToken: !!refreshToken,
		});

		// If there's no token and no refresh token, redirect to the login page
		if (!token && !refreshToken) {
			console.log(`[Middleware] No tokens found, redirecting to login`);
			// Create a URL for the login page with a redirect back to the dashboard
			const loginUrl = new URL("/login", request.url);
			loginUrl.searchParams.set("redirect", path);

			return NextResponse.redirect(loginUrl);
		}

		// If we have a refresh token but no access token, let the request continue
		// The TokenRefresher component will handle the token refresh
		if (!token && refreshToken) {
			console.log(
				`[Middleware] Only refresh token found, allowing request to continue for token refresh`
			);
		}
	}

	// Continue with the request
	return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
	matcher: ["/dashboard/:path*"],
};
