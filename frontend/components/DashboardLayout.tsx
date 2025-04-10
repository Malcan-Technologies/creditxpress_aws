import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardNav from "./DashboardNav";
import UserProfileButton from "./UserProfileButton";
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

		// Set up periodic token refresh (every 10 minutes)
		const refreshInterval = setInterval(async () => {
			const isAuthenticated = await checkAuth();
			if (!isAuthenticated) {
				// Only redirect if we're still on the dashboard
				router.push("/login");
			}
		}, 10 * 60 * 1000); // 10 minutes

		return () => clearInterval(refreshInterval);
	}, [router]);

	if (isLoading) {
		return (
			<div className="flex h-screen items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen bg-gray-50">
			{/* Mobile menu button */}
			<div className="lg:hidden fixed top-4 right-4 z-50">
				<UserProfileButton />
			</div>

			{/* Sidebar */}
			<div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
				<DashboardNav />
			</div>

			{/* Main content */}
			<div className="lg:pl-64 flex flex-col flex-1">
				{/* Top bar */}
				<div className="sticky top-0 z-10 flex-shrink-0 flex h-24 bg-white shadow">
					<div className="flex-1 px-4 flex items-center">
						<div>
							<h1 className="text-2xl font-semibold text-gray-900">
								{title}
							</h1>
							<p className="text-sm text-gray-500">
								Welcome back{" "}
								<Link
									href="/dashboard/profile"
									className="text-indigo-600 font-medium hover:text-indigo-500 transition-colors"
								>
									{userName}
								</Link>
								! Here&apos;s an overview of your account.
							</p>
						</div>
					</div>
					<div className="flex items-center space-x-4 pr-4">
						<NotificationsButton />
						<UserProfileButton />
					</div>
				</div>

				{/* Page content */}
				<main className="flex-1 overflow-y-auto p-4 lg:p-8">
					{children}
				</main>
			</div>
		</div>
	);
}
