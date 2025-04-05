import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	// Get the pathname of the request
	const path = request.nextUrl.pathname;

	// Check if the path starts with /dashboard
	if (path.startsWith("/dashboard")) {
		// Get the token from the cookies
		const token = request.cookies.get("token")?.value;

		// If there's no token, redirect to the login page
		if (!token) {
			// Create a URL for the login page with a redirect back to the dashboard
			const loginUrl = new URL("/login", request.url);
			loginUrl.searchParams.set("redirect", path);

			return NextResponse.redirect(loginUrl);
		}
	}

	// Continue with the request
	return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
	matcher: ["/dashboard/:path*"],
};
