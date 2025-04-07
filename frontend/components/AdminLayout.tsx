"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
	HomeIcon,
	UserGroupIcon,
	DocumentTextIcon,
	CreditCardIcon,
	ChartBarIcon,
	Cog6ToothIcon,
	ArrowLeftOnRectangleIcon,
	Bars3Icon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import Cookies from "js-cookie";

interface AdminLayoutProps {
	children: React.ReactNode;
	userName?: string;
}

export default function AdminLayout({
	children,
	userName = "Admin",
}: AdminLayoutProps) {
	const router = useRouter();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const checkAuth = async () => {
			try {
				// Check for token in localStorage
				let token = localStorage.getItem("adminToken");

				// If not in localStorage, check cookies
				if (!token) {
					const cookieToken = Cookies.get("adminToken");
					if (cookieToken) {
						token = cookieToken;
					}
				}

				if (!token) {
					router.push("/admin/login");
					return;
				}

				const response = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
						},
					}
				);

				if (!response.ok) {
					router.push("/admin/login");
					return;
				}

				const data = await response.json();

				// Check if user is an admin
				if (data.role !== "ADMIN") {
					router.push("/admin/login");
					return;
				}
			} catch (error) {
				console.error("Auth check error:", error);
				router.push("/admin/login");
			} finally {
				setLoading(false);
			}
		};

		checkAuth();
	}, [router]);

	const handleLogout = () => {
		localStorage.removeItem("adminToken");
		Cookies.remove("adminToken");
		router.push("/admin/login");
	};

	const navigation = [
		{ name: "Dashboard", href: "/admin/dashboard", icon: HomeIcon },
		{ name: "Users", href: "/admin/users", icon: UserGroupIcon },
		{
			name: "Applications",
			href: "/admin/applications",
			icon: DocumentTextIcon,
		},
		{ name: "Loans", href: "/admin/loans", icon: CreditCardIcon },
		{ name: "Reports", href: "/admin/reports", icon: ChartBarIcon },
		{ name: "Settings", href: "/admin/settings", icon: Cog6ToothIcon },
	];

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-100">
			{/* Mobile sidebar */}
			<div
				className={`fixed inset-0 z-40 flex md:hidden ${
					sidebarOpen ? "block" : "hidden"
				}`}
			>
				<div
					className="fixed inset-0 bg-gray-600 bg-opacity-75"
					onClick={() => setSidebarOpen(false)}
				></div>
				<div className="relative flex-1 flex flex-col max-w-xs w-full bg-blue-800">
					<div className="absolute top-0 right-0 -mr-12 pt-2">
						<button
							type="button"
							className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
							onClick={() => setSidebarOpen(false)}
						>
							<span className="sr-only">Close sidebar</span>
							<XMarkIcon
								className="h-6 w-6 text-white"
								aria-hidden="true"
							/>
						</button>
					</div>
					<div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
						<div className="flex-shrink-0 flex items-center px-4">
							<Image
								src="/logo.png"
								alt="Kapital Logo"
								width={40}
								height={40}
								className="h-8 w-auto"
							/>
							<span className="ml-2 text-white font-bold text-xl">
								Admin
							</span>
						</div>
						<nav className="mt-5 px-2 space-y-1">
							{navigation.map((item) => (
								<Link
									key={item.name}
									href={item.href}
									className="group flex items-center px-2 py-2 text-base font-medium rounded-md text-white hover:bg-blue-700"
								>
									<item.icon
										className="mr-4 h-6 w-6 text-blue-200"
										aria-hidden="true"
									/>
									{item.name}
								</Link>
							))}
						</nav>
					</div>
					<div className="flex-shrink-0 flex border-t border-blue-700 p-4">
						<div className="flex items-center">
							<div>
								<p className="text-base font-medium text-white">
									{userName}
								</p>
								<button
									onClick={handleLogout}
									className="text-sm font-medium text-blue-200 hover:text-white flex items-center"
								>
									<ArrowLeftOnRectangleIcon className="h-5 w-5 mr-1" />
									Logout
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Desktop sidebar */}
			<div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
				<div className="flex-1 flex flex-col min-h-0 bg-blue-800">
					<div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
						<div className="flex items-center flex-shrink-0 px-4">
							<Image
								src="/logo.png"
								alt="Kapital Logo"
								width={40}
								height={40}
								className="h-8 w-auto"
							/>
							<span className="ml-2 text-white font-bold text-xl">
								Admin
							</span>
						</div>
						<nav className="mt-5 flex-1 px-2 space-y-1">
							{navigation.map((item) => (
								<Link
									key={item.name}
									href={item.href}
									className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-white hover:bg-blue-700"
								>
									<item.icon
										className="mr-3 h-6 w-6 text-blue-200"
										aria-hidden="true"
									/>
									{item.name}
								</Link>
							))}
						</nav>
					</div>
					<div className="flex-shrink-0 flex border-t border-blue-700 p-4">
						<div className="flex items-center">
							<div>
								<p className="text-base font-medium text-white">
									{userName}
								</p>
								<button
									onClick={handleLogout}
									className="text-sm font-medium text-blue-200 hover:text-white flex items-center"
								>
									<ArrowLeftOnRectangleIcon className="h-5 w-5 mr-1" />
									Logout
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Main content */}
			<div className="md:pl-64 flex flex-col flex-1">
				<div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-gray-100">
					<button
						type="button"
						className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
						onClick={() => setSidebarOpen(true)}
					>
						<span className="sr-only">Open sidebar</span>
						<Bars3Icon className="h-6 w-6" aria-hidden="true" />
					</button>
				</div>
				<main className="flex-1">
					<div className="py-6">
						<div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
							{children}
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}
