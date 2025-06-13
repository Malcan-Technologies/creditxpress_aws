"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
	HomeIcon,
	UserGroupIcon,
	DocumentTextIcon,
	BanknotesIcon,
	ChartBarIcon,
	Cog6ToothIcon,
	Bars3Icon,
	XMarkIcon,
	ArrowPathIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	CheckCircleIcon,
	ClockIcon,
	BellIcon,
	CubeIcon,
	CreditCardIcon,
} from "@heroicons/react/24/outline";
import {
	AdminTokenStorage,
	fetchWithAdminTokenRefresh,
	checkAdminAuth,
} from "../../lib/authUtils";

interface AdminLayoutProps {
	children: React.ReactNode;
	userName?: string;
	title?: string;
	description?: string;
}

export default function AdminLayout({
	children,
	userName = "Admin",
	title = "Admin Dashboard",
	description = "Overview of your Kapital's performance",
}: AdminLayoutProps) {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [loading, setLoading] = useState(true);
	const [adminName, setAdminName] = useState(userName);
	const [loanWorkflowOpen, setLoanWorkflowOpen] = useState(false);
	const [managementOpen, setManagementOpen] = useState(false);
	const router = useRouter();

	useEffect(() => {
		// Check if user is authenticated
		const checkAuthentication = async () => {
			try {
				console.log("AdminLayout - Starting authentication check");
				const accessToken = AdminTokenStorage.getAccessToken();
				const refreshToken = AdminTokenStorage.getRefreshToken();

				console.log("AdminLayout - Tokens exist:", {
					accessToken: !!accessToken,
					refreshToken: !!refreshToken,
				});

				const isAuthenticated = await checkAdminAuth();
				console.log("AdminLayout - isAuthenticated:", isAuthenticated);

				if (!isAuthenticated) {
					console.log(
						"AdminLayout - Not authenticated, redirecting to login"
					);
					router.push("/login");
					return;
				}

				// Fetch admin user information
				try {
					console.log("AdminLayout - Fetching user data");
					const userData = await fetchWithAdminTokenRefresh<any>(
						"/api/admin/me"
					);
					console.log("AdminLayout - User data:", userData);

					if (userData.fullName) {
						setAdminName(userData.fullName);
					}
				} catch (error) {
					console.error(
						"AdminLayout - Error fetching admin info:",
						error
					);
				} finally {
					setLoading(false);
				}
			} catch (error) {
				console.error("AdminLayout - Auth check failed:", error);
				router.push("/login");
			}
		};

		checkAuthentication();
	}, [router]);

	const handleLogout = async () => {
		try {
			const refreshToken = AdminTokenStorage.getRefreshToken();

			if (refreshToken) {
				// Call the logout API
				await fetch("/api/admin/logout", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${
							AdminTokenStorage.getAccessToken() || ""
						}`,
					},
					body: JSON.stringify({ refreshToken }),
				});
			}

			// Clear tokens regardless of API response
			AdminTokenStorage.clearTokens();
			router.push("/login");
		} catch (error) {
			console.error("Logout error:", error);
			// Clear tokens even if the API call fails
			AdminTokenStorage.clearTokens();
			router.push("/login");
		}
	};

	const navigation = [
		{ name: "Dashboard", href: "/dashboard", icon: HomeIcon },
		{ name: "Active Loans", href: "/dashboard/loans", icon: BanknotesIcon },
		{
			name: "Disbursements",
			href: "/dashboard/disbursements",
			icon: CreditCardIcon,
		},
		{ name: "Users", href: "/dashboard/users", icon: UserGroupIcon },
		{ name: "Reports", href: "/dashboard/reports", icon: ChartBarIcon },
	];

	const loanWorkflowItems = [
		{
			name: "All Applications",
			href: "/dashboard/applications",
			icon: DocumentTextIcon,
		},
		{
			name: "Pending Approval",
			href: "/dashboard/applications?filter=pending-approval",
			icon: ClockIcon,
		},
		{
			name: "Pending Disbursement",
			href: "/dashboard/applications?filter=pending-disbursement",
			icon: CheckCircleIcon,
		},
		{
			name: "Workflow Overview",
			href: "/dashboard/applications/workflow",
			icon: ArrowPathIcon,
		},
	];

	const managementItems = [
		{
			name: "Products",
			href: "/dashboard/products",
			icon: CubeIcon,
		},
		{
			name: "Notifications",
			href: "/dashboard/notifications",
			icon: BellIcon,
		},
		{
			name: "Settings",
			href: "/dashboard/settings",
			icon: Cog6ToothIcon,
		},
	];

	// Function to render navigation items
	const renderNavigation = (isMobile = false) => {
		const baseClasses = isMobile
			? "group flex items-center rounded-md px-2 py-2 text-base font-medium text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors duration-200"
			: "group flex items-center rounded-md px-2 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors duration-200";

		const iconClasses = isMobile
			? "mr-4 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-300"
			: "mr-3 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-300";

		const subItemClasses = isMobile
			? "group flex items-center rounded-md px-2 py-2 pl-11 text-sm font-medium text-gray-400 hover:bg-gray-800/30 hover:text-gray-200 transition-colors duration-200"
			: "group flex items-center rounded-md px-2 py-2 pl-9 text-sm font-medium text-gray-400 hover:bg-gray-800/30 hover:text-gray-200 transition-colors duration-200";

		const subIconClasses = isMobile
			? "mr-3 h-5 w-5 flex-shrink-0 text-gray-500 group-hover:text-gray-400"
			: "mr-3 h-5 w-5 flex-shrink-0 text-gray-500 group-hover:text-gray-400";

		return (
			<>
				{navigation.map((item) => (
					<Link
						key={item.name}
						href={item.href}
						className={baseClasses}
					>
						<item.icon className={iconClasses} />
						{item.name}
					</Link>
				))}

				{/* Loan Workflow Dropdown */}
				<div>
					<button
						onClick={() => setLoanWorkflowOpen(!loanWorkflowOpen)}
						className={baseClasses}
					>
						<ArrowPathIcon className={iconClasses} />
						Loan Applications
						{loanWorkflowOpen ? (
							<ChevronDownIcon className="ml-auto h-5 w-5 text-gray-400" />
						) : (
							<ChevronRightIcon className="ml-auto h-5 w-5 text-gray-400" />
						)}
					</button>
					{loanWorkflowOpen && (
						<div className="mt-1 space-y-1">
							{loanWorkflowItems.map((item) => (
								<Link
									key={item.name}
									href={item.href}
									className={subItemClasses}
								>
									<item.icon className={subIconClasses} />
									{item.name}
								</Link>
							))}
						</div>
					)}
				</div>

				{/* Management Dropdown */}
				<div>
					<button
						onClick={() => setManagementOpen(!managementOpen)}
						className={baseClasses}
					>
						<Cog6ToothIcon className={iconClasses} />
						Management
						{managementOpen ? (
							<ChevronDownIcon className="ml-auto h-5 w-5 text-gray-400" />
						) : (
							<ChevronRightIcon className="ml-auto h-5 w-5 text-gray-400" />
						)}
					</button>
					{managementOpen && (
						<div className="mt-1 space-y-1">
							{managementItems.map((item) => (
								<Link
									key={item.name}
									href={item.href}
									className={subItemClasses}
								>
									<item.icon className={subIconClasses} />
									{item.name}
								</Link>
							))}
						</div>
					)}
				</div>
			</>
		);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-screen bg-gray-900">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-900">
			{/* Mobile sidebar */}
			<div
				className={`fixed inset-0 z-40 lg:hidden ${
					sidebarOpen ? "" : "hidden"
				}`}
			>
				<div
					className="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm"
					onClick={() => setSidebarOpen(false)}
				></div>
				<div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-gradient-to-b from-gray-800 to-gray-900 backdrop-blur-md border-r border-gray-700/30">
					<div className="flex h-16 items-center justify-between px-4">
						<div className="flex items-center">
							<Image
								src="/logo-black-large.svg"
								alt="Logo"
								width={120}
								height={40}
								className="h-8 w-auto invert"
								priority
							/>
							<span className="ml-2 px-2 py-1 text-xs font-semibold text-white bg-amber-600 rounded-full">
								Admin
							</span>
						</div>
						<button
							onClick={() => setSidebarOpen(false)}
							className="text-gray-400 hover:text-white"
						>
							<XMarkIcon className="h-6 w-6" />
						</button>
					</div>
					<div className="flex-1 overflow-y-auto">
						<nav className="px-2 py-4 space-y-1">
							{renderNavigation(true)}
						</nav>
					</div>
					<div className="border-t border-gray-700/30 p-4">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
									<span className="text-gray-200 font-medium">
										{adminName.charAt(0)}
									</span>
								</div>
							</div>
							<div className="ml-3">
								<p className="text-sm font-medium text-gray-200">
									{adminName}
								</p>
								<button
									onClick={handleLogout}
									className="text-xs font-medium text-gray-400 hover:text-gray-200"
								>
									Logout
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Desktop sidebar */}
			<div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
				<div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-gray-800 to-gray-900 backdrop-blur-md border-r border-gray-700/30">
					<div className="flex h-16 items-center px-4">
						<Image
							src="/logo-black-large.svg"
							alt="Logo"
							width={120}
							height={40}
							className="h-8 w-auto invert"
							priority
						/>
						<span className="ml-2 px-2 py-1 text-xs font-semibold text-white bg-amber-600 rounded-full">
							Admin
						</span>
					</div>
					<div className="flex-1 overflow-y-auto">
						<nav className="px-2 py-4 space-y-1">
							{renderNavigation(false)}
						</nav>
					</div>
					<div className="border-t border-gray-700/30 p-4">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
									<span className="text-gray-200 font-medium">
										{adminName.charAt(0)}
									</span>
								</div>
							</div>
							<div className="ml-3">
								<p className="text-sm font-medium text-gray-200">
									{adminName}
								</p>
								<button
									onClick={handleLogout}
									className="text-xs font-medium text-gray-400 hover:text-gray-200"
								>
									Logout
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Main content */}
			<div className="lg:pl-64">
				<div className="sticky top-0 z-10 flex h-24 flex-shrink-0 bg-gray-800/95 backdrop-blur-md border-b border-gray-700/50 shadow-xl">
					<button
						type="button"
						className="border-r border-gray-700/50 px-4 text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 lg:hidden"
						onClick={() => setSidebarOpen(true)}
					>
						<span className="sr-only">Open sidebar</span>
						<Bars3Icon className="h-6 w-6" aria-hidden="true" />
					</button>
					<div className="flex flex-1 justify-between px-4 sm:px-6 lg:px-8">
						<div className="flex items-center">
							<div>
								<h1 className="text-2xl font-bold text-white">
									{title}
								</h1>
								<p className="text-sm text-gray-400">
									{description}
								</p>
							</div>
						</div>
						<div className="ml-4 flex items-center md:ml-6">
							<div className="flex items-center space-x-4">
								<div className="flex items-center">
									<div className="flex-shrink-0">
										<div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center">
											<span className="text-gray-200 text-sm font-medium">
												{adminName.charAt(0)}
											</span>
										</div>
									</div>
									<div className="ml-3 hidden md:block">
										<p className="text-sm font-medium text-gray-200">
											{adminName}
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<main className="flex-1">
					<div className="py-6 px-4 sm:px-6 lg:px-8">{children}</div>
				</main>
			</div>
		</div>
	);
}
