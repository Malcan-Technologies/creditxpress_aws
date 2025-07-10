"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";
import NotificationsButton from "./NotificationsButton";
import { TokenStorage } from "@/lib/authUtils";
import {
	HomeIcon,
	WalletIcon,
	StarIcon,
	BanknotesIcon,
	ArrowPathIcon,
	Cog6ToothIcon,
	PlusIcon,
	UserIcon,
	Bars3Icon,
	XMarkIcon,
	ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";

const navigation = [
	{
		name: "Overview",
		href: "/dashboard",
		icon: <HomeIcon className="h-5 w-5" />,
	},
	{
		name: "Wallet",
		href: "/dashboard/wallet",
		icon: <WalletIcon className="h-5 w-5" />,
	},
	{
		name: "Credit Score",
		href: "/dashboard/credit-score",
		icon: <StarIcon className="h-5 w-5" />,
	},
	{
		name: "Loans",
		href: "/dashboard/loans",
		icon: <BanknotesIcon className="h-5 w-5" />,
	},
	{
		name: "Transactions",
		href: "/dashboard/transactions",
		icon: <ArrowPathIcon className="h-5 w-5" />,
	},
	// {
	// 	name: "Settings",
	// 	href: "/dashboard/settings",
	// 	icon: <Cog6ToothIcon className="h-5 w-5" />,
	// },
];

export default function DashboardNav() {
	const pathname = usePathname();
	const router = useRouter();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const handleLogout = async () => {
		// Clear tokens using our utility
		TokenStorage.clearTokens();

		// Call logout API to invalidate refresh token on server
		try {
			await fetch("/api/auth/logout", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${TokenStorage.getAccessToken()}`,
				},
			});
		} catch (error) {
			console.error("Error during logout:", error);
		}

		// Redirect to login page
		router.push("/login");
	};

	return (
		<>
			{/* Desktop Sidebar */}
			<div className="hidden lg:flex lg:fixed lg:inset-y-0 lg:w-64 flex-col h-full bg-gray-50 border-r border-purple-primary/20 z-30">
				<div className="p-4 flex justify-center">
					<Logo size="lg" variant="white" linkTo="/dashboard" />
				</div>

				<nav className="flex-1 p-4 space-y-1">
					{navigation.map((item) => {
						const isActive = pathname === item.href;
						return (
							<Link
								key={item.name}
								href={item.href}
								className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 font-body ${
									isActive
										? "bg-purple-primary/20 text-purple-primary border border-purple-primary/30 "
										: "text-gray-700 hover:bg-purple-primary/5 hover:text-purple-primary hover:border-purple-primary/20 border border-transparent"
								}`}
							>
								<span
									className={`mr-3 transition-colors duration-200 ${
										isActive
											? "text-purple-primary"
											: "text-gray-500 group-hover:text-purple-primary"
									}`}
								>
									{item.icon}
								</span>
								{item.name}
							</Link>
						);
					})}
				</nav>

				{/* Featured Apply Button - Moved to bottom for better visual hierarchy */}
				{/* <div className="px-4 pb-4">
					<Link
						href="/dashboard/apply"
						className="group relative flex items-center w-full px-4 py-3 text-sm font-medium text-purple-primary bg-purple-primary/5 hover:bg-purple-primary/10 rounded-xl transition-all duration-200 border border-purple-primary/20 hover:border-purple-primary/30 font-body"
					>
						<PlusIcon className="w-5 h-5 mr-3 text-purple-primary group-hover:rotate-90 transition-transform duration-200" />
						<span className="font-semibold">Apply for a Loan</span>
					</Link>
				</div> */}

				<div className="p-4 border-t border-purple-primary/20 space-y-1">
					<Link
						href="/dashboard/profile"
						className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 border font-body group ${
							pathname === "/dashboard/profile"
								? "bg-purple-primary/20 text-purple-primary border-purple-primary/30"
								: "text-gray-700 hover:bg-purple-primary/5 hover:text-purple-primary border-transparent hover:border-purple-primary/20"
						}`}
					>
						<UserIcon className={`w-5 h-5 mr-3 transition-colors duration-200 ${
							pathname === "/dashboard/profile"
								? "text-purple-primary"
								: "text-gray-500 group-hover:text-purple-primary"
						}`} />
						Profile
					</Link>
					<button
						onClick={handleLogout}
						className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-700 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all duration-200 border border-transparent hover:border-red-200 font-body group"
					>
						<ArrowRightOnRectangleIcon className="w-5 h-5 mr-3 text-gray-500 group-hover:text-red-600 transition-colors duration-200" />
						Logout
					</button>
				</div>
			</div>

			{/* Mobile Top Controls - Fixed position */}
			<div className="lg:hidden fixed top-4 right-4 z-50 flex items-center space-x-4">
				<div className="w-10 h-10 flex items-center justify-center">
					<NotificationsButton />
				</div>
				<button
					onClick={() => setMobileMenuOpen(true)}
					className="w-10 h-10 flex items-center justify-center bg-white rounded-lg border border-purple-primary/20 text-gray-700 hover:text-purple-primary transition-colors"
				>
					<span className="sr-only">Open menu</span>
					<Bars3Icon className="h-6 w-6" />
				</button>
			</div>

			{/* Mobile Menu Dialog */}
			<div
				className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300 z-[100] ${
					mobileMenuOpen
						? "opacity-100"
						: "opacity-0 pointer-events-none"
				}`}
				onClick={(e) => {
					if (e.target === e.currentTarget) {
						setMobileMenuOpen(false);
					}
				}}
			>
				<div
					className={`fixed inset-y-0 left-0 w-80 bg-white transform transition-transform duration-300 overflow-y-auto z-[101] ${
						mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
					}`}
					onClick={(e) => e.stopPropagation()}
				>
					<div className="flex flex-col h-full">
						<div className="p-4 flex justify-between items-center border-b border-purple-primary/20">
							<Logo
								size="md"
								variant="white"
								linkTo="/dashboard"
							/>
							<button
								onClick={() => setMobileMenuOpen(false)}
								className="text-gray-500 hover:text-gray-700 transition-colors"
							>
								<span className="sr-only">Close menu</span>
								<XMarkIcon className="h-6 w-6" />
							</button>
						</div>

						<nav className="flex-1 p-4 space-y-1">
							{navigation.map((item) => {
								const isActive = pathname === item.href;
								return (
									<Link
										key={item.name}
										href={item.href}
										onClick={() => setMobileMenuOpen(false)}
										className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 font-body ${
											isActive
												? "bg-purple-primary/20 text-purple-primary border border-purple-primary/30 shadow-lg shadow-purple-primary/10"
												: "text-gray-700 hover:bg-purple-primary/5 hover:text-purple-primary hover:border-purple-primary/20 border border-transparent"
										}`}
									>
										<span
											className={`mr-3 transition-colors duration-200 ${
												isActive
													? "text-purple-primary"
													: "text-gray-500 group-hover:text-purple-primary"
											}`}
										>
											{item.icon}
										</span>
										{item.name}
									</Link>
								);
							})}
						</nav>

						{/* Featured Apply Button */}
						<div className="px-4 pb-4">
							<Link
								href="/dashboard/apply"
								onClick={() => setMobileMenuOpen(false)}
								className="group relative flex items-center w-full px-4 py-3 text-sm font-medium text-purple-primary bg-purple-primary/5 hover:bg-purple-primary/10 rounded-xl transition-all duration-200 border border-purple-primary/20 hover:border-purple-primary/30 font-body"
							>
								<PlusIcon className="w-5 h-5 mr-3 text-purple-primary group-hover:rotate-90 transition-transform duration-200" />
								<span className="font-semibold">
									Apply for a Loan
								</span>
							</Link>
						</div>

						<div className="p-4 border-t border-purple-primary/20 space-y-1">
							<Link
								href="/dashboard/profile"
								onClick={() => setMobileMenuOpen(false)}
								className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 border font-body group ${
									pathname === "/dashboard/profile"
										? "bg-purple-primary/20 text-purple-primary border-purple-primary/30 shadow-lg shadow-purple-primary/10"
										: "text-gray-700 hover:bg-purple-primary/5 hover:text-purple-primary border-transparent hover:border-purple-primary/20"
								}`}
							>
								<UserIcon className={`w-5 h-5 mr-3 transition-colors duration-200 ${
									pathname === "/dashboard/profile"
										? "text-purple-primary"
										: "text-gray-500 group-hover:text-purple-primary"
								}`} />
								Profile
							</Link>
							<button
								onClick={() => {
									setMobileMenuOpen(false);
									handleLogout();
								}}
								className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-700 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all duration-200 border border-transparent hover:border-red-200 font-body group"
							>
								<ArrowRightOnRectangleIcon className="w-5 h-5 mr-3 text-gray-500 group-hover:text-red-600 transition-colors duration-200" />
								Logout
							</button>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
