"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
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
	ReceiptPercentIcon,
	ExclamationTriangleIcon,
	VideoCameraIcon,
	ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import {
	AdminTokenStorage,
	fetchWithAdminTokenRefresh,
	checkAdminAuth,
} from "../../lib/authUtils";
import { getFilteredNavigation } from "../../lib/permissions";
import Logo from "./Logo";

interface AdminLayoutProps {
	children: React.ReactNode;
	userName?: string;
	title?: string; // Kept for backward compatibility but no longer used
	description?: string; // Kept for backward compatibility but no longer used
}

export default function AdminLayout({
	children,
	userName = "Admin",
	title = "Admin Dashboard",
	description = "Overview of your Kapital's performance",
}: AdminLayoutProps) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [loading, setLoading] = useState(true);
	const [adminName, setAdminName] = useState(userName);
	const [userRole, setUserRole] = useState<string>("");
	const [loanWorkflowOpen, setLoanWorkflowOpen] = useState(false);
	const [managementOpen, setManagementOpen] = useState(false);
	const [paymentsOpen, setPaymentsOpen] = useState(false);
	const [applicationsOpen, setApplicationsOpen] = useState(false);
	const [loansOpen, setLoansOpen] = useState(false);
	const [auditLogsOpen, setAuditLogsOpen] = useState(false);
	const [allowAutoExpand, setAllowAutoExpand] = useState(false);
	const router = useRouter();
	const pathname = usePathname();

	// Function to check if a navigation item is active
	const isActive = (href: string) => {
		if (href === "/dashboard") {
			return pathname === "/dashboard";
		}

		// Handle query parameters for filtered pages
		if (href.includes("?")) {
			const [basePath, queryString] = href.split("?");
			if (pathname === basePath) {
				// Check if current URL contains the same query parameters
				if (typeof window !== "undefined") {
					const currentParams = new URLSearchParams(
						window.location.search
					);
					const targetParams = new URLSearchParams(queryString);

					// Check if all target parameters match current parameters
					const targetEntries = Array.from(targetParams.entries());
					for (const [key, value] of targetEntries) {
						if (currentParams.get(key) !== value) {
							return false;
						}
					}
					return true;
				}
			}
			return false;
		}

		return pathname.startsWith(href);
	};

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
					if (userData.role) {
						setUserRole(userData.role);
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
	];

	// ATTESTOR-specific navigation items
	const attestorNavigationItems = [
		{ name: "Live Attestations", href: "/dashboard/live-attestations", icon: VideoCameraIcon },
		{ name: "Digital Signing", href: "/dashboard/settings/signing", icon: ShieldCheckIcon },
	];

	const paymentItems = [
		{
			name: "Payments",
			href: "/dashboard/payments",
			icon: ReceiptPercentIcon,
		},
		{
			name: "Past Disbursements",
			href: "/dashboard/disbursements",
			icon: CreditCardIcon,
		},
	
		{
			name: "Overdue Payments",
			href: "/dashboard/late-fees",
			icon: ExclamationTriangleIcon,
		},
	];

	const loanWorkflowItems = [
		{
			name: "All Applications",
			href: "/dashboard/applications",
			icon: DocumentTextIcon,
		},
		{
			name: "All Loans",
			href: "/dashboard/loans",
			icon: BanknotesIcon,
		},
		{
			name: "Live Attestations",
			href: "/dashboard/live-attestations",
			icon: VideoCameraIcon,
		},
	];

	const managementItems = [
		{
			name: "Users",
			href: "/dashboard/users",
			icon: UserGroupIcon,
		},
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
			name: "Digital Signing",
			href: "/dashboard/settings/signing",
			icon: ShieldCheckIcon,
		},
		{
			name: "Settings",
			href: "/dashboard/settings",
			icon: Cog6ToothIcon,
		},
	];

	const auditLogsItems = [
		{
			name: "Admin Access Logs",
			href: "/dashboard/audit-logs/access",
			icon: ShieldCheckIcon,
		},
		{
			name: "Document Storage Logs",
			href: "/dashboard/audit-logs/documents",
			icon: DocumentTextIcon,
		},
	];

	// Function to check if any sub-item in a dropdown is active
	const isDropdownActive = (items: any[]) => {
		return items.some((item) => {
			// Check if the main item is active
			return isActive(item.href);
		});
	};

	// Get filtered navigation based on user role
	const filteredNavigation = userRole ? getFilteredNavigation(userRole) : [];

	// Helper function to check if user can access a route based on role
	const canUserAccessRoute = (href: string) => {
		if (!userRole) return false;
		
		// For ATTESTOR role, only allow specific routes
		if (userRole === "ATTESTOR") {
			const allowedRoutes = [
				"/dashboard", // Allow main dashboard with filtered content
				"/dashboard/settings/signing", // Digital signing
				"/dashboard/live-attestations", // Live attestations
				"/dashboard/applications" // Allow limited applications access for attestation
			];
			
			// Explicitly deny payment and loan management routes
			const deniedRoutes = [
				"/dashboard/payments",
				"/dashboard/disbursements", 
				"/dashboard/late-fees",
				"/dashboard/loans",
				"/dashboard/users",
				"/dashboard/products",
				"/dashboard/notifications",
				"/dashboard/reports"
			];
			
			// Special handling for settings - deny general settings but allow signing
			if (href.startsWith("/dashboard/settings") && href !== "/dashboard/settings/signing") {
				return false;
			}
			
			// Check if route is denied first
			if (deniedRoutes.some(route => href.startsWith(route))) {
				return false;
			}
			
			// Then check if route is allowed
			return allowedRoutes.some(route => href.startsWith(route));
		}
		
		// ADMIN has access to everything
		return userRole === "ADMIN";
	};

	// Helper function to check if a section should be shown (has accessible items)
	const shouldShowSection = (items: any[]) => {
		return items.some(item => canUserAccessRoute(item.href));
	};

	// Auto-expand dropdowns based on current path (only when explicitly enabled)
	useEffect(() => {
		// Only auto-expand if explicitly allowed (e.g., when navigating through menu items)
		if (!allowAutoExpand) return;

		const isLoanPath = loanWorkflowItems.some((item) => {
			return isActive(item.href);
		});
		const isManagementPath = managementItems.some((item) =>
			isActive(item.href)
		);
		const isPaymentsPath = paymentItems.some((item) =>
			isActive(item.href)
		);
		const isAuditLogsPath = auditLogsItems.some((item) =>
			isActive(item.href)
		);

		// Check for specific applications and loans paths
		const isApplicationsPath = pathname.startsWith(
			"/dashboard/applications"
		);
		const isLoansPath = pathname.startsWith("/dashboard/loans");

		setLoanWorkflowOpen(isLoanPath);
		setManagementOpen(isManagementPath);
		setPaymentsOpen(isPaymentsPath);
		setAuditLogsOpen(isAuditLogsPath);
		setApplicationsOpen(isApplicationsPath);
		setLoansOpen(isLoansPath);

		// Reset the auto-expand flag after applying
		setAllowAutoExpand(false);
	}, [pathname, allowAutoExpand]);

	// Function to render navigation items for desktop
	const renderDesktopNavigation = () => {
		const getBaseClasses = (active: boolean) => {
			return active
				? "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 bg-blue-600/20 text-blue-200 border border-blue-500/30"
				: "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 text-gray-300 hover:bg-gray-800/50 hover:text-white";
		};

		const getIconClasses = (active: boolean) => {
			return active
				? "mr-2 h-5 w-5 flex-shrink-0 text-blue-300"
				: "mr-2 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-gray-300";
		};

		const getDropdownClasses = (active: boolean) => {
			// Only highlight dropdown if one of its child pages is currently active, not when dropdown is just open
			return active
				? "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 bg-blue-600/20 text-blue-200 border border-blue-500/30"
				: "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 text-gray-300 hover:bg-gray-800/50 hover:text-white";
		};

		const getSubItemClasses = (active: boolean) => {
			return active
				? "block px-4 py-2 text-sm text-blue-200 hover:bg-gray-800/30 rounded-md"
				: "block px-4 py-2 text-sm text-gray-400 hover:bg-gray-800/30 hover:text-gray-200 rounded-md";
		};

		return (
			<div className="hidden lg:flex lg:items-center lg:space-x-4">
				{/* Dashboard navigation item */}
				{navigation.filter(item => canUserAccessRoute(item.href)).map((item) => {
					const active = isActive(item.href);
					return (
						<Link
							key={item.name}
							href={item.href}
							className={getBaseClasses(active)}
							onClick={() => setAllowAutoExpand(true)}
						>
							<item.icon className={getIconClasses(active)} />
							{item.name}
						</Link>
					);
				})}
				
				{/* ATTESTOR-specific navigation items */}
				{userRole === "ATTESTOR" && attestorNavigationItems.filter(item => canUserAccessRoute(item.href)).map((item) => {
					const active = isActive(item.href);
					return (
						<Link
							key={item.name}
							href={item.href}
							className={getBaseClasses(active)}
							onClick={() => setAllowAutoExpand(true)}
						>
							<item.icon className={getIconClasses(active)} />
							{item.name}
						</Link>
					);
				})}

				{/* Payments Dropdown - only show if user has access to payment items */}
				{shouldShowSection(paymentItems) && (
				<div className="relative">
					<button
						onClick={() => {
							setPaymentsOpen(!paymentsOpen);
							setLoanWorkflowOpen(false);
							setManagementOpen(false);
							setAuditLogsOpen(false);
						}}
						className={getDropdownClasses(isDropdownActive(paymentItems))}
					>
						<ReceiptPercentIcon className={getIconClasses(isDropdownActive(paymentItems))} />
						Payments
						<ChevronDownIcon className="ml-1 h-4 w-4 text-gray-400" />
					</button>
					{paymentsOpen && (
						<div className="absolute left-0 z-10 mt-2 w-48 rounded-md bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5">
							<div className="py-1">
								{paymentItems.filter(item => canUserAccessRoute(item.href)).map((item) => {
									const active = isActive(item.href);
									return (
										<Link
											key={item.name}
											href={item.href}
											className={getSubItemClasses(active)}
											onClick={() => setAllowAutoExpand(true)}
										>
											<item.icon className="mr-2 h-4 w-4 inline" />
											{item.name}
										</Link>
									);
								})}
							</div>
						</div>
					)}
				</div>
				)}

				{/* Loans Dropdown - only show for ADMIN users */}
				{userRole === "ADMIN" && shouldShowSection(loanWorkflowItems) && (
				<div className="relative">
					<button
						onClick={() => {
							setLoanWorkflowOpen(!loanWorkflowOpen);
							setPaymentsOpen(false);
							setManagementOpen(false);
							setAuditLogsOpen(false);
						}}
						className={getDropdownClasses(isDropdownActive(loanWorkflowItems))}
					>
						<DocumentTextIcon className={getIconClasses(isDropdownActive(loanWorkflowItems))} />
						Loans
						<ChevronDownIcon className="ml-1 h-4 w-4 text-gray-400" />
					</button>
					{loanWorkflowOpen && (
						<div className="absolute left-0 z-10 mt-2 w-64 rounded-md bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5">
							<div className="py-1">
								{loanWorkflowItems.filter(item => canUserAccessRoute(item.href)).map((item) => {
									const active = isActive(item.href);

									return (
										<Link
											key={item.name}
											href={item.href}
											className={getSubItemClasses(active)}
											onClick={() => setAllowAutoExpand(true)}
										>
											<item.icon className="mr-2 h-4 w-4 inline" />
											{item.name}
										</Link>
									);
								})}
							</div>
						</div>
					)}
				</div>
				)}

				{/* Management Dropdown - only show for ADMIN users */}
				{userRole === "ADMIN" && shouldShowSection(managementItems) && (
				<div className="relative">
					<button
						onClick={() => {
							setManagementOpen(!managementOpen);
							setPaymentsOpen(false);
							setLoanWorkflowOpen(false);
							setAuditLogsOpen(false);
						}}
						className={getDropdownClasses(isDropdownActive(managementItems))}
					>
						<Cog6ToothIcon className={getIconClasses(isDropdownActive(managementItems))} />
						Management
						<ChevronDownIcon className="ml-1 h-4 w-4 text-gray-400" />
					</button>
					{managementOpen && (
						<div className="absolute left-0 z-10 mt-2 w-48 rounded-md bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5">
							<div className="py-1">
								{managementItems.filter(item => canUserAccessRoute(item.href)).map((item) => {
									const active = isActive(item.href);
									return (
										<Link
											key={item.name}
											href={item.href}
											className={getSubItemClasses(active)}
											onClick={() => setAllowAutoExpand(true)}
										>
											<item.icon className="mr-2 h-4 w-4 inline" />
											{item.name}
										</Link>
									);
								})}
							</div>
						</div>
					)}
				</div>
				)}

				{/* Audit Logs Dropdown - only show for ADMIN users */}
				{userRole === "ADMIN" && shouldShowSection(auditLogsItems) && (
				<div className="relative">
					<button
						onClick={() => {
							setAuditLogsOpen(!auditLogsOpen);
							setManagementOpen(false);
							setPaymentsOpen(false);
							setLoanWorkflowOpen(false);
						}}
						className={getDropdownClasses(isDropdownActive(auditLogsItems))}
					>
						<ShieldCheckIcon className={getIconClasses(isDropdownActive(auditLogsItems))} />
						Audit Logs
						<ChevronDownIcon className="ml-1 h-4 w-4 text-gray-400" />
					</button>
					{auditLogsOpen && (
						<div className="absolute left-0 z-10 mt-2 w-56 rounded-md bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5">
							<div className="py-1">
								{auditLogsItems.filter(item => canUserAccessRoute(item.href)).map((item) => {
									const active = isActive(item.href);
									return (
										<Link
											key={item.name}
											href={item.href}
											className={getSubItemClasses(active)}
											onClick={() => setAllowAutoExpand(true)}
										>
											<item.icon className="mr-2 h-4 w-4 inline" />
											{item.name}
										</Link>
									);
								})}
							</div>
						</div>
					)}
				</div>
				)}
			</div>
		);
	};

	// Function to render mobile navigation
	const renderMobileNavigation = () => {
		const getBaseClasses = (active: boolean) => {
			return active
				? "group flex items-center rounded-md px-3 py-2 text-base font-medium transition-colors duration-200 bg-blue-600/20 text-blue-200 border border-blue-500/30"
				: "group flex items-center rounded-md px-3 py-2 text-base font-medium transition-colors duration-200 text-gray-300 hover:bg-gray-800/50 hover:text-white";
		};

		const getIconClasses = (active: boolean) => {
			return active
				? "mr-3 h-6 w-6 flex-shrink-0 text-blue-300"
				: "mr-3 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-300";
		};

		const getSubItemClasses = (active: boolean) => {
			return active
				? "group flex items-center rounded-md px-3 py-2 pl-9 text-sm font-medium transition-colors duration-200 bg-blue-600/20 text-blue-200 border border-blue-500/30"
				: "group flex items-center rounded-md px-3 py-2 pl-9 text-sm font-medium transition-colors duration-200 text-gray-400 hover:bg-gray-800/30 hover:text-gray-200";
		};

		const getSubIconClasses = (active: boolean) => {
			return active
				? "mr-3 h-5 w-5 flex-shrink-0 text-blue-300"
				: "mr-3 h-5 w-5 flex-shrink-0 text-gray-500 group-hover:text-gray-400";
		};

		const getSubSubItemClasses = (active: boolean) => {
			return active
				? "group flex items-center rounded-md px-3 py-2 pl-16 text-sm transition-colors duration-200 text-blue-200 font-semibold"
				: "group flex items-center rounded-md px-3 py-2 pl-16 text-sm transition-colors duration-200 text-gray-400 hover:text-gray-200";
		};

		const getSubSubIconClasses = (active: boolean) => {
			return active
				? "mr-3 h-4 w-4 flex-shrink-0 text-blue-300"
				: "mr-3 h-4 w-4 flex-shrink-0 text-gray-500 group-hover:text-gray-400";
		};

		return (
			<div className="lg:hidden">
				<div className="space-y-1 px-2 pb-3 pt-2">
					{/* Dashboard navigation item */}
					{navigation.filter(item => canUserAccessRoute(item.href)).map((item) => {
						const active = isActive(item.href);
						return (
							<Link
								key={item.name}
								href={item.href}
								className={getBaseClasses(active)}
								onClick={() => {
									setMobileMenuOpen(false);
									setAllowAutoExpand(true);
								}}
							>
								<item.icon className={getIconClasses(active)} />
								{item.name}
							</Link>
						);
					})}
					
					{/* ATTESTOR-specific navigation items */}
					{userRole === "ATTESTOR" && attestorNavigationItems.filter(item => canUserAccessRoute(item.href)).map((item) => {
						const active = isActive(item.href);
						return (
							<Link
								key={item.name}
								href={item.href}
								className={getBaseClasses(active)}
								onClick={() => {
									setMobileMenuOpen(false);
									setAllowAutoExpand(true);
								}}
							>
								<item.icon className={getIconClasses(active)} />
								{item.name}
							</Link>
						);
					})}

					{/* Payments Section - only show if user has access */}
					{shouldShowSection(paymentItems) && (
					<div>
						<button
							onClick={() => {
								setPaymentsOpen(!paymentsOpen);
								setLoanWorkflowOpen(false);
								setManagementOpen(false);
								setAuditLogsOpen(false);
							}}
							className={getBaseClasses(isDropdownActive(paymentItems))}
						>
							<ReceiptPercentIcon className={getIconClasses(isDropdownActive(paymentItems))} />
							Payments
							{paymentsOpen ? (
								<ChevronDownIcon className="ml-auto h-5 w-5 text-gray-400" />
							) : (
								<ChevronRightIcon className="ml-auto h-5 w-5 text-gray-400" />
							)}
						</button>
						{paymentsOpen && (
							<div className="mt-1 space-y-1">
								{paymentItems.map((item) => {
									const active = isActive(item.href);
									return (
										<Link
											key={item.name}
											href={item.href}
											className={getSubItemClasses(active)}
											onClick={() => {
												setMobileMenuOpen(false);
												setAllowAutoExpand(true);
											}}
										>
											<item.icon className={getSubIconClasses(active)} />
											{item.name}
										</Link>
									);
								})}
							</div>
						)}
					</div>
					)}

					{/* Loans Section - only show for ADMIN users */}
					{userRole === "ADMIN" && shouldShowSection(loanWorkflowItems) && (
				<div>
					<button
						onClick={() => {
							setLoanWorkflowOpen(!loanWorkflowOpen);
							setPaymentsOpen(false);
							setManagementOpen(false);
							setAuditLogsOpen(false);
						}}
						className={getBaseClasses(isDropdownActive(loanWorkflowItems))}
					>
						<DocumentTextIcon className={getIconClasses(isDropdownActive(loanWorkflowItems))} />
						Loans
						{loanWorkflowOpen ? (
							<ChevronDownIcon className="ml-auto h-5 w-5 text-gray-400" />
						) : (
							<ChevronRightIcon className="ml-auto h-5 w-5 text-gray-400" />
						)}
					</button>
					{loanWorkflowOpen && (
						<div className="mt-1 space-y-1">
							{loanWorkflowItems.map((item) => {
								const active = isActive(item.href);

								return (
									<Link
										key={item.name}
										href={item.href}
										className={getSubItemClasses(active)}
										onClick={() => {
											setMobileMenuOpen(false);
											setAllowAutoExpand(true);
										}}
									>
										<item.icon className={getSubIconClasses(active)} />
										{item.name}
									</Link>
								);
							})}
						</div>
					)}
				</div>
				)}

					{/* Management Section - only show for ADMIN users */}
					{userRole === "ADMIN" && shouldShowSection(managementItems) && (
				<div>
					<button
						onClick={() => {
							setManagementOpen(!managementOpen);
							setPaymentsOpen(false);
							setLoanWorkflowOpen(false);
							setAuditLogsOpen(false);
						}}
						className={getBaseClasses(isDropdownActive(managementItems))}
					>
						<Cog6ToothIcon className={getIconClasses(isDropdownActive(managementItems))} />
						Management
						{managementOpen ? (
							<ChevronDownIcon className="ml-auto h-5 w-5 text-gray-400" />
						) : (
							<ChevronRightIcon className="ml-auto h-5 w-5 text-gray-400" />
						)}
					</button>
					{managementOpen && (
						<div className="mt-1 space-y-1">
							{managementItems.map((item) => {
								const active = isActive(item.href);
								return (
									<Link
										key={item.name}
										href={item.href}
										className={getSubItemClasses(active)}
										onClick={() => {
											setMobileMenuOpen(false);
											setAllowAutoExpand(true);
										}}
									>
										<item.icon className={getSubIconClasses(active)} />
										{item.name}
									</Link>
								);
							})}
						</div>
					)}
				</div>
				)}

					{/* Audit Logs Section - only show for ADMIN users */}
					{userRole === "ADMIN" && shouldShowSection(auditLogsItems) && (
				<div>
					<button
						onClick={() => {
							setAuditLogsOpen(!auditLogsOpen);
							setManagementOpen(false);
							setPaymentsOpen(false);
							setLoanWorkflowOpen(false);
						}}
						className={getBaseClasses(isDropdownActive(auditLogsItems))}
					>
						<ShieldCheckIcon className={getIconClasses(isDropdownActive(auditLogsItems))} />
						Audit Logs
						{auditLogsOpen ? (
							<ChevronDownIcon className="ml-auto h-5 w-5 text-gray-400" />
						) : (
							<ChevronRightIcon className="ml-auto h-5 w-5 text-gray-400" />
						)}
					</button>
					{auditLogsOpen && (
						<div className="mt-1 space-y-1">
							{auditLogsItems.map((item) => {
								const active = isActive(item.href);
								return (
									<Link
										key={item.name}
										href={item.href}
										className={getSubItemClasses(active)}
										onClick={() => {
											setMobileMenuOpen(false);
											setAllowAutoExpand(true);
										}}
									>
										<item.icon className={getSubIconClasses(active)} />
										{item.name}
									</Link>
								);
							})}
						</div>
					)}
				</div>
				)}
				</div>
			</div>
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
			{/* Top navigation bar */}
			<div className="sticky top-0 z-50 bg-gray-800/95 backdrop-blur-md border-b border-gray-700/50 shadow-xl">
				<div className="px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 items-center justify-between">
						{/* Logo and title */}
						<div className="flex items-center">
							<Logo size="md" variant="black" linkTo="/dashboard" />
							<span className="ml-2 px-2 py-1 text-xs font-semibold text-white bg-amber-600 rounded-full">
								Admin
							</span>
						</div>

						{/* Desktop navigation */}
						{renderDesktopNavigation()}

						{/* User menu and mobile menu button */}
						<div className="flex items-center space-x-4">
							{/* User info */}
							<div className="hidden md:flex items-center">
							<div className="flex-shrink-0">
									<div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center">
										<span className="text-gray-200 text-sm font-medium">
										{adminName.charAt(0)}
									</span>
								</div>
							</div>
							<div className="ml-3">
								<p className="text-sm font-medium text-gray-200">
									{adminName}
								</p>
								{userRole && (
									<p className="text-xs text-gray-400 uppercase tracking-wide">
										{userRole}
									</p>
								)}
								</div>
							</div>

							{/* Logout button */}
								<button
									onClick={handleLogout}
								className="hidden md:block text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
								>
									Logout
								</button>

							{/* Mobile menu button */}
							<button
								type="button"
								className="lg:hidden text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
								onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							>
								<span className="sr-only">Open main menu</span>
								{mobileMenuOpen ? (
									<XMarkIcon className="h-6 w-6" aria-hidden="true" />
								) : (
									<Bars3Icon className="h-6 w-6" aria-hidden="true" />
								)}
							</button>
					</div>
				</div>
			</div>

				{/* Mobile menu */}
				{mobileMenuOpen && (
					<div className="lg:hidden">
						<div className="border-t border-gray-700/30 bg-gray-800/95 backdrop-blur-md">
							{renderMobileNavigation()}
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
				)}
							</div>

			{/* Page header - removed title since it's duplicated in page content */}
			<div className="bg-gray-800/50 border-b border-gray-700/30">
				<div className="px-4 sm:px-6 lg:px-8 py-2">
					{/* Empty header for spacing consistency */}
				</div>
			</div>

			{/* Main content */}
			<main className="flex-1">
				<div className="py-8 px-6 sm:px-8 lg:px-12 xl:px-16">{children}</div>
			</main>
		</div>
	);
}
