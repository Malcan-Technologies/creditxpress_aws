"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardNav from "./DashboardNav";
import NotificationsButton from "./NotificationsButton";
import Link from "next/link";
import { checkAuth, fetchWithTokenRefresh } from "@/lib/authUtils";

export default function DashboardLayout({
	children,
	title = "Dashboard",
	userName = "User",
}: {
	children: React.ReactNode;
	title?: string;
	userName?: string;
}) {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		// Verify authentication on component mount
		const verifyAuth = async () => {
			try {
				setIsLoading(true);
				const isAuthenticated = await checkAuth();

				if (!isAuthenticated) {
					// Redirect to login if not authenticated or token refresh fails
					router.push("/login");
					return;
				}

				setIsLoading(false);
			} catch (error) {
				console.error("Auth verification error:", error);
				router.push("/login");
			}
		};

		verifyAuth();

		// Add storage event listener for cross-device mobile updates
		const handleStorageChange = (e: StorageEvent) => {
			// Handle mobile profile update redirect
			if (e.key === 'mobile_profile_update' && e.newValue) {
				try {
					const updateData = JSON.parse(e.newValue);
					if (updateData.action === 'redirect_to_profile' && updateData.url) {
						// Clear the flag
						localStorage.removeItem('mobile_profile_update');
						// Redirect to profile page
						router.push(updateData.url);
					}
				} catch (error) {
					console.warn('DashboardLayout: Failed to parse mobile profile update data:', error);
				}
			}
		};

		// Set up periodic token refresh (every 10 minutes)
		const refreshInterval = setInterval(async () => {
			const isAuthenticated = await checkAuth();
			if (!isAuthenticated) {
				// Only redirect if we're still on the dashboard
				router.push("/login");
			}
		}, 10 * 60 * 1000); // 10 minutes

		// Add storage event listener
		window.addEventListener('storage', handleStorageChange);

		return () => {
			clearInterval(refreshInterval);
			window.removeEventListener('storage', handleStorageChange);
		};
	}, [router]);

	// Update document title when title prop changes
	useEffect(() => {
		if (typeof document !== "undefined") {
			document.title = `${title} | CreditXpress`;
		}
	}, [title]);

	if (isLoading) {
		return (
			<div className="flex h-screen items-center justify-center bg-offwhite">
				<div className="text-center">
					<div className="w-16 h-16 border-4 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
					<p className="mt-4 text-gray-700 font-body">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen bg-offwhite">
			{/* Navigation - includes both desktop sidebar and mobile menu */}
			<DashboardNav />

			{/* Desktop Sidebar Space */}
			<div className="hidden lg:block lg:w-64 lg:flex-shrink-0">
				{/* This div creates space for the fixed sidebar on desktop */}
			</div>

			{/* Main content */}
			<div className="flex flex-col flex-1">
				{/* Top bar - Desktop only */}
				<div className="hidden lg:flex sticky top-0 z-10 flex-shrink-0 h-24 bg-gray-50/95 backdrop-blur-md border-b border-gray-200">
					<div className="flex-1 px-4 flex items-center">
						<div>
							<h1 className="text-2xl font-heading text-gray-700">
								{title}
							</h1>
							<p className="text-sm text-gray-500 font-body">
								Welcome back{" "}
								<Link
									href="/dashboard/profile"
									className="text-purple-primary font-medium hover:text-blue-tertiary transition-colors"
								>
									{userName}
								</Link>
								! Here&apos;s an overview of your account.
							</p>
						</div>
					</div>
					<div className="flex items-center space-x-4 pr-4">
						<NotificationsButton />
					</div>
				</div>

				{/* Mobile Top bar - simplified, no user controls to avoid conflict with hamburger menu */}
				<div className="lg:hidden sticky top-0 z-10 flex-shrink-0 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-3 pr-24">
					<div>
						<h1 className="text-xl font-heading text-purple-primary">
							{title}
						</h1>
						<p className="text-sm text-gray-500 font-body">
							Welcome back{" "}
							<Link
								href="/dashboard/profile"
								className="text-purple-primary font-medium hover:text-blue-tertiary transition-colors"
							>
								{userName}
							</Link>
						</p>
					</div>
				</div>

				{/* Page content */}
				<main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-offwhite">
					{children}
				</main>
			</div>
		</div>
	);
}
