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
} from "@heroicons/react/24/outline";
import Cookies from "js-cookie";

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
	const router = useRouter();

	useEffect(() => {
		// Check if user is authenticated
		const token =
			localStorage.getItem("adminToken") || Cookies.get("adminToken");
		if (!token) {
			router.push("/admin/login");
		} else {
			// Fetch admin user information
			const fetchAdminInfo = async () => {
				try {
					const response = await fetch(
						`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`,
						{
							headers: {
								Authorization: `Bearer ${token}`,
							},
						}
					);

					if (response.ok) {
						const userData = await response.json();
						if (userData.fullName) {
							setAdminName(userData.fullName);
						}
					}
				} catch (error) {
					console.error("Error fetching admin info:", error);
				} finally {
					setLoading(false);
				}
			};

			fetchAdminInfo();
		}
	}, [router]);

	const handleLogout = () => {
		localStorage.removeItem("adminToken");
		Cookies.remove("adminToken");
		router.push("/login");
	};

	const navigation = [
		{ name: "Dashboard", href: "/dashboard", icon: HomeIcon },
		{ name: "Users", href: "/dashboard/users", icon: UserGroupIcon },
		{
			name: "Applications",
			href: "/dashboard/applications",
			icon: DocumentTextIcon,
		},
		{ name: "Loans", href: "/dashboard/loans", icon: BanknotesIcon },
		{ name: "Reports", href: "/dashboard/reports", icon: ChartBarIcon },
		{ name: "Settings", href: "/dashboard/settings", icon: Cog6ToothIcon },
		{ name: "Products", href: "/dashboard/products", icon: Cog6ToothIcon },
	];

	if (loading) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-100">
			{/* Mobile sidebar */}
			<div
				className={`fixed inset-0 z-40 lg:hidden ${
					sidebarOpen ? "" : "hidden"
				}`}
			>
				<div
					className="fixed inset-0 bg-gray-600 bg-opacity-75"
					onClick={() => setSidebarOpen(false)}
				></div>
				<div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
					<div className="flex h-16 items-center justify-between px-4">
						<div className="flex items-center">
							<Image
								src="/logo-black-large.svg"
								alt="Logo"
								width={120}
								height={40}
								className="h-8 w-auto"
								priority
							/>
							<span className="ml-2 px-2 py-1 text-xs font-semibold text-white bg-purple-600 rounded-full">
								Admin
							</span>
						</div>
						<button
							onClick={() => setSidebarOpen(false)}
							className="text-gray-500 hover:text-gray-700"
						>
							<XMarkIcon className="h-6 w-6" />
						</button>
					</div>
					<div className="flex-1 overflow-y-auto">
						<nav className="px-2 py-4">
							{navigation.map((item) => (
								<Link
									key={item.name}
									href={item.href}
									className="group flex items-center rounded-md px-2 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
								>
									<item.icon className="mr-4 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-500" />
									{item.name}
								</Link>
							))}
						</nav>
					</div>
					<div className="border-t border-gray-200 p-4">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
									<span className="text-gray-600 font-medium">
										{adminName.charAt(0)}
									</span>
								</div>
							</div>
							<div className="ml-3">
								<p className="text-sm font-medium text-gray-700">
									{adminName}
								</p>
								<button
									onClick={handleLogout}
									className="text-xs font-medium text-gray-500 hover:text-gray-700"
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
				<div className="flex min-h-0 flex-1 flex-col border-r border-gray-200 bg-white">
					<div className="flex h-16 items-center px-4">
						<Image
							src="/logo-black-large.svg"
							alt="Logo"
							width={120}
							height={40}
							className="h-8 w-auto"
							priority
						/>
						<span className="ml-2 px-2 py-1 text-xs font-semibold text-white bg-amber-600 rounded-full">
							Admin
						</span>
					</div>
					<div className="flex-1 overflow-y-auto">
						<nav className="px-2 py-4">
							{navigation.map((item) => (
								<Link
									key={item.name}
									href={item.href}
									className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
								>
									<item.icon className="mr-3 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-500" />
									{item.name}
								</Link>
							))}
						</nav>
					</div>
					<div className="border-t border-gray-200 p-4">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
									<span className="text-gray-600 font-medium">
										{adminName.charAt(0)}
									</span>
								</div>
							</div>
							<div className="ml-3">
								<p className="text-sm font-medium text-gray-700">
									{adminName}
								</p>
								<button
									onClick={handleLogout}
									className="text-xs font-medium text-gray-500 hover:text-gray-700"
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
				<div className="sticky top-0 z-10 flex h-24 flex-shrink-0 bg-white shadow">
					<button
						type="button"
						className="border-r border-gray-200 px-4 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 lg:hidden"
						onClick={() => setSidebarOpen(true)}
					>
						<span className="sr-only">Open sidebar</span>
						<Bars3Icon className="h-6 w-6" />
					</button>
					<div className="flex flex-1 justify-between px-4">
						<div className="flex flex-1 items-center">
							<div>
								<h1 className="text-2xl font-semibold text-gray-900">
									{title}
								</h1>
								<p className="text-sm text-gray-500">
									{description}
								</p>
							</div>
						</div>
					</div>
				</div>
				<main className="py-6">
					<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
						{children}
					</div>
				</main>
			</div>
		</div>
	);
}
