"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import Logo from "./Logo";
import {
	MdMenu,
	MdClose,
	MdKeyboardArrowDown,
	MdGroups,
	MdBusinessCenter,
	MdAccountBalance,
	MdShowChart,
	MdInfo,
	MdWork,
	MdArticle,
	MdHelp,
	MdPhone,
	MdDashboard,
	MdCreditCard,
	MdTrendingUp,
	MdAssessment,
} from "react-icons/md";

type NavbarProps = {
	bgStyle?: string;
};

type ActiveMenu = "none" | "solutions" | "resources";

export default function Navbar({
	bgStyle = "bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900",
}: NavbarProps) {
	const [isScrolled, setIsScrolled] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [activeMenu, setActiveMenu] = useState<ActiveMenu>("none");
	const [activeMobileSections, setActiveMobileSections] = useState<string[]>(
		[]
	);
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const navRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// Check if user is logged in by checking cookies or localStorage
		const checkUserLoggedIn = () => {
			const token =
				document.cookie.includes("token=") ||
				localStorage.getItem("token");
			const refreshToken =
				document.cookie.includes("refreshToken=") ||
				localStorage.getItem("refreshToken");
			setIsLoggedIn(!!(token || refreshToken));
		};

		const handleScroll = () => {
			setIsScrolled(window.scrollY > 0);
		};

		const handleClickOutside = (event: MouseEvent) => {
			if (window.innerWidth >= 1024) {
				if (
					navRef.current &&
					!navRef.current.contains(event.target as Node)
				) {
					setActiveMenu("none");
				}
			}
		};

		checkUserLoggedIn();
		window.addEventListener("scroll", handleScroll);
		document.addEventListener("mousedown", handleClickOutside);

		return () => {
			window.removeEventListener("scroll", handleScroll);
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	const handleMenuClick = (menu: ActiveMenu) => {
		setActiveMenu(activeMenu === menu ? "none" : menu);
	};

	const toggleMobileSection = (section: string) => {
		setActiveMobileSections((prev) => {
			if (prev.includes(section)) {
				return prev.filter((s) => s !== section);
			}
			// If it's a subsection, make sure its parent is also active
			if (
				section === "borrow" ||
				section === "invest" ||
				section === "credit"
			) {
				return [...new Set([...prev, "solutions", section])];
			}
			if (section === "company" || section === "resources-sub") {
				return [...new Set([...prev, "resources", section])];
			}
			// If it's a first-level menu, expand all its submenus by default
			if (section === "solutions") {
				return [
					...new Set([
						...prev,
						"solutions",
						"borrow",
						"invest",
						"credit",
					]),
				];
			}
			if (section === "resources") {
				return [
					...new Set([
						...prev,
						"resources",
						"company",
						"resources-sub",
					]),
				];
			}
			return [...prev, section];
		});
	};

	return (
		<>
			<nav
				ref={navRef}
				className={`fixed z-50 transition-all duration-300 ${
					isScrolled
						? "top-4 left-4 right-4 bg-white/95 backdrop-blur-lg border border-gray-200 rounded-2xl shadow-lg"
						: "top-0 left-0 right-0 border-b border-white/10 backdrop-blur-md"
				} ${!isScrolled ? bgStyle : ""}`}
			>
				<div
					className={`w-full ${
						isScrolled
							? "px-6 sm:px-8 lg:px-12"
							: "px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16"
					}`}
				>
					<div className="flex justify-between h-16 items-center">
						<div className="flex items-center">
							<Logo
								size="lg"
								variant={isScrolled ? "white" : "black"}
								linkTo="/"
							/>
						</div>
						{/* Simplified navigation - no dropdown menus */}
						<div className="hidden lg:flex items-center justify-center flex-1">
							{/* Empty space for centered logo */}
						</div>
						<div className="hidden lg:flex items-center space-x-6">
							<div className="relative group">
								<a
									href="https://wa.me/60164614919?text=I'm%20interested%20in%20CreditXpress%20lending%20products"
									target="_blank"
									rel="noopener noreferrer"
									className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
										isScrolled
											? "border-gray-400 hover:border-purple-primary text-gray-700 hover:text-purple-primary"
											: "border-gray-400 hover:border-white text-gray-200 hover:text-white"
									}`}
								>
									<MdPhone size={20} />
								</a>
								<div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block">
									<div className="bg-white text-gray-900 px-4 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap">
										<div className="absolute left-1/2 -translate-x-1/2 -top-2">
											<div className="w-4 h-4 bg-white transform rotate-45"></div>
										</div>
										Click to WhatsApp us or
										<br />
										Call us at +60 16-461 4919
									</div>
								</div>
							</div>

							{isLoggedIn ? (
								<Link
									href="/dashboard"
									className="bg-purple-primary text-white hover:bg-purple-700 px-6 py-2 rounded-full transition-colors inline-flex items-center gap-2 font-semibold"
								>
									<MdDashboard size={20} />
									Go to Dashboard
								</Link>
							) : (
								<>
									<Link
										href="/login"
										className={`${
											isScrolled
												? "text-gray-700 hover:text-purple-primary"
												: "text-gray-200 hover:text-white"
										} px-4 py-2 rounded-full transition-colors font-body`}
									>
										Sign in
									</Link>
									<Link
										href="/signup"
										className="bg-purple-primary text-white hover:bg-purple-700 px-6 py-2 rounded-full transition-colors font-semibold"
									>
										Get started
									</Link>
								</>
							)}
						</div>

						{/* Mobile Menu Button */}
						<div className="flex lg:hidden">
							<button
								onClick={() => setMobileMenuOpen(true)}
								className={`${
									isScrolled
										? "text-gray-700 hover:text-purple-primary"
										: "text-white hover:text-gray-100"
								} transition-colors`}
							>
								<span className="sr-only">Open menu</span>
								<MdMenu size={24} />
							</button>
						</div>
					</div>

				</div>
			</nav>

			{/* Mobile Menu Dialog */}
			<div
				className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300 z-[100] ${
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
					className={`fixed inset-0 bg-white transform transition-transform duration-300 overflow-y-auto z-[101] ${
						mobileMenuOpen ? "translate-x-0" : "translate-x-full"
					}`}
					onClick={(e) => e.stopPropagation()}
				>
					{/* Action Buttons - Fixed at bottom */}
					<div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 z-[102]">
						<div className="flex gap-4">
							{isLoggedIn ? (
								<Link
									href="/dashboard"
									className="flex-1 text-center flex items-center justify-center gap-2 bg-purple-primary text-white px-6 py-3 rounded-full hover:bg-purple-700 transition-colors font-semibold"
									onClick={() => setMobileMenuOpen(false)}
								>
									<MdDashboard size={20} />
									Go to Dashboard
								</Link>
							) : (
								<>
									<Link
										href="/login"
										className="flex-1 text-center text-gray-600 px-6 py-3 rounded-full border-2 border-gray-200 hover:bg-gray-50 transition-colors font-semibold"
										onClick={() => setMobileMenuOpen(false)}
									>
										Sign in
									</Link>
									<Link
										href="/signup"
										className="flex-1 text-center bg-purple-primary text-white px-6 py-3 rounded-full hover:bg-purple-700 transition-colors font-semibold"
										onClick={() => setMobileMenuOpen(false)}
									>
										Get started
									</Link>
								</>
							)}
						</div>
					</div>

					{/* Scrollable Content Area */}
					<div className="h-full overflow-y-auto pb-32">
						<div className="p-6">
							<div className="flex justify-between items-center mb-8">
								<Logo size="md" variant="white" />
								<button
									onClick={() => setMobileMenuOpen(false)}
									className="text-gray-500 hover:text-gray-700"
								>
									<span className="sr-only">Close menu</span>
									<MdClose size={24} />
								</button>
							</div>

							{/* Simplified Mobile Menu - Just contact info */}
							<div className="space-y-8">
								<div className="text-center">
									<h3 className="text-xl font-semibold text-gray-900 mb-4">
										Get in Touch
									</h3>
									<a
										href="mailto:opgcapital3@gmail.com"
										className="flex items-center justify-center gap-4 text-gray-600 hover:text-purple-600 p-4 rounded-xl bg-gray-50 mb-4"
										onClick={() => setMobileMenuOpen(false)}
									>
										<div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
											<MdPhone size={20} color="#7C3AED" />
										</div>
										<div className="text-left">
											<span className="font-semibold block">Email Us</span>
											<p className="text-sm text-gray-500">opgcapital3@gmail.com</p>
										</div>
									</a>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
