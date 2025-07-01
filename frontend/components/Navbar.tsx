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
			if (window.innerWidth >= 768) {
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
						<div className="hidden md:flex items-center justify-center flex-1 space-x-8 px-16">
							<div className="relative">
								<button
									onClick={() => handleMenuClick("solutions")}
									className={`${
										isScrolled
											? "text-gray-700 hover:text-purple-primary"
											: "text-gray-200 hover:text-white"
									} transition-colors flex items-center gap-1 font-body`}
								>
									Solutions
									<div
										className={`transition-transform duration-200 ${
											activeMenu === "solutions"
												? "rotate-180"
												: ""
										}`}
									>
										<MdKeyboardArrowDown size={16} />
									</div>
								</button>
							</div>
							<div className="relative">
								<button
									onClick={() => handleMenuClick("resources")}
									className={`${
										isScrolled
											? "text-gray-700 hover:text-purple-primary"
											: "text-gray-200 hover:text-white"
									} transition-colors flex items-center gap-1 font-body`}
								>
									Resources
									<div
										className={`transition-transform duration-200 ${
											activeMenu === "resources"
												? "rotate-180"
												: ""
										}`}
									>
										<MdKeyboardArrowDown size={16} />
									</div>
								</button>
							</div>
						</div>
						<div className="hidden md:flex items-center space-x-6">
							<div className="relative group">
								<a
									href="https://wa.me/60164614919?text=I'm%20interested%20in%20Kapital%20lending%20products"
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
						<div className="flex md:hidden">
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

					{/* Mega Menu Container */}
					<div
						className={`absolute transition-all duration-200 ${
							isScrolled
								? "left-0 right-0 mt-1"
								: "left-0 right-0 mt-1"
						} ${
							activeMenu === "none"
								? "opacity-0 invisible"
								: "opacity-100 visible"
						}`}
					>
						<div
							className={`w-full ${
								isScrolled
									? "px-0"
									: "px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16"
							}`}
						>
							<div
								className={`bg-white rounded-2xl shadow-xl p-6 lg:p-8 border border-gray-200 ${
									isScrolled ? "mx-0" : "mx-2 sm:mx-4 lg:mx-0"
								}`}
							>
								{activeMenu === "solutions" && (
									<div className="grid grid-cols-3 gap-8">
										{/* Borrow Solutions Column */}
										<div>
											<h3 className="text-lg font-semibold text-gray-700 mb-4 font-heading">
												Borrow
											</h3>
											<div className="space-y-4">
												<Link
													href="/sme-term-loan"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-blue-50"
												>
													<div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center flex-shrink-0 border border-blue-600/20">
														<MdBusinessCenter
															size={24}
															color="#2563EB"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-700 group-hover:text-blue-600 transition-colors font-heading">
															SME Term Loan
														</h4>
														<p className="text-sm text-gray-500 font-body">
															Term loans for
															business expansion
														</p>
													</div>
												</Link>
												<Link
													href="/personal-loan"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-blue-50"
												>
													<div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center flex-shrink-0 border border-blue-600/20">
														<MdAccountBalance
															size={24}
															color="#2563EB"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-700 group-hover:text-blue-600 transition-colors font-heading">
															Personal Loan
														</h4>
														<p className="text-sm text-gray-500 font-body">
															Fast financing for
															personal needs
														</p>
													</div>
												</Link>
												<Link
													href="/pay-advance"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-emerald-50"
												>
													<div className="w-12 h-12 rounded-xl bg-emerald-600/10 flex items-center justify-center flex-shrink-0 border border-emerald-600/20">
														<MdGroups
															size={24}
															color="#059669"
														/>
													</div>
													<div>
														<div className="flex items-center gap-2">
															<h4 className="text-base font-semibold text-gray-700 group-hover:text-emerald-600 transition-colors font-heading">
																PayAdvance
															</h4>
															<span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full border border-emerald-600/30">
																New
															</span>
														</div>
														<p className="text-sm text-gray-500 font-body">
															Earned wage access &
															salary advances
														</p>
													</div>
												</Link>
											</div>
										</div>

										{/* Invest Solutions Column */}
										<div>
											<h3 className="text-lg font-semibold text-gray-700 mb-4 font-heading">
												Invest
											</h3>
											<div className="space-y-4">
												<Link
													href="/products"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-gray-50"
												>
													<div className="w-12 h-12 rounded-xl bg-gray-800/10 flex items-center justify-center flex-shrink-0 border border-gray-800/20">
														<MdTrendingUp
															size={24}
															color="#1F2937"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-700 group-hover:text-gray-800 transition-colors font-heading">
															Private Credit
															Investments
														</h4>
														<p className="text-sm text-gray-500 font-body">
															Up to 8% annual
															returns with monthly
															distributions
														</p>
													</div>
												</Link>
											</div>
										</div>

										{/* Credit Solutions Column */}
										<div>
											<h3 className="text-lg font-semibold text-gray-700 mb-4 font-heading">
												Credit
											</h3>
											<div className="space-y-4">
												<Link
													href="/credit-score+"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-purple-50"
												>
													<div className="w-12 h-12 rounded-xl bg-purple-primary/10 flex items-center justify-center flex-shrink-0 border border-purple-primary/20">
														<MdAssessment
															size={24}
															color="#7C3AED"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-700 group-hover:text-purple-primary transition-colors font-heading">
															Credit Analytics
														</h4>
														<p className="text-sm text-gray-500 font-body">
															CTOS reports and
															business
															verification
														</p>
													</div>
												</Link>
												<Link
													href="/products"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-yellow-50"
												>
													<div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0 border border-yellow-500/20">
														<MdCreditCard
															size={24}
															color="#EAB308"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-700 group-hover:text-yellow-600 transition-colors font-heading">
															Credit Score+
														</h4>
														<p className="text-sm text-gray-500 font-body">
															Build and improve
															your credit score
														</p>
													</div>
												</Link>
											</div>
										</div>
									</div>
								)}

								{activeMenu === "resources" && (
									<div className="grid grid-cols-3 gap-8">
										{/* Company Column */}
										<div>
											<h3 className="text-lg font-semibold text-gray-700 mb-4 font-heading">
												Company
											</h3>
											<div className="space-y-4">
												<Link
													href="/about"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-white"
												>
													<div className="w-12 h-12 rounded-xl bg-purple-primary/10 flex items-center justify-center flex-shrink-0 border border-purple-primary/20">
														<MdInfo
															size={24}
															color="#7C3AED"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-700 group-hover:text-purple-primary transition-colors font-heading">
															About Us
														</h4>
														<p className="text-sm text-gray-500 font-body">
															Learn more about our
															mission and values
														</p>
													</div>
												</Link>
												<Link
													href="/careers"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-white"
												>
													<div className="w-12 h-12 rounded-xl bg-blue-tertiary/10 flex items-center justify-center flex-shrink-0 border border-blue-tertiary/20">
														<MdWork
															size={24}
															color="#38BDF8"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-700 group-hover:text-blue-tertiary transition-colors font-heading">
															Careers
														</h4>
														<p className="text-sm text-gray-500 font-body">
															Join our team and
															make an impact
														</p>
													</div>
												</Link>
											</div>
										</div>

										{/* Resources Column */}
										<div>
											<h3 className="text-lg font-semibold text-gray-700 mb-4 font-heading">
												Resources
											</h3>
											<div className="space-y-4">
												<Link
													href="/blog"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-white"
												>
													<div className="w-12 h-12 rounded-xl bg-blue-tertiary/10 flex items-center justify-center flex-shrink-0 border border-blue-tertiary/20">
														<MdArticle
															size={24}
															color="#38BDF8"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-700 group-hover:text-blue-tertiary transition-colors font-heading">
															Blog
														</h4>
														<p className="text-sm text-gray-500 font-body">
															Latest insights and
															updates
														</p>
													</div>
												</Link>
												<Link
													href="/help"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-white"
												>
													<div className="w-12 h-12 rounded-xl bg-purple-primary/10 flex items-center justify-center flex-shrink-0 border border-purple-primary/20">
														<MdHelp
															size={24}
															color="#7C3AED"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-700 group-hover:text-purple-primary transition-colors font-heading">
															Help Center
														</h4>
														<p className="text-sm text-gray-500 font-body">
															Get answers to your
															questions
														</p>
													</div>
												</Link>
											</div>
										</div>

										{/* CTA Column - Resources Menu */}
										<div className="bg-white rounded-xl p-6 border border-gray-100">
											<div className="relative h-32 mb-4">
												<Image
													src="/help.svg"
													alt="Support"
													fill
													className="object-contain object-left"
												/>
											</div>
											<div className="mb-4">
												<h3 className="text-lg font-semibold text-gray-700 mb-2 font-heading">
													Need help?
												</h3>
												<p className="text-sm text-gray-500 font-body">
													Our support team is here for
													you 24/7
												</p>
											</div>
											<Link
												href="https://wa.me/60164614919?text=I'm%20interested%20in%20Kapital%20lending%20products"
												className="inline-block text-blue-tertiary hover:text-purple-primary font-medium transition-colors font-body"
											>
												Contact our support team →
											</Link>
										</div>
									</div>
								)}
							</div>
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

							{/* Mobile Menu Links */}
							<div className="space-y-8">
								{/* Solutions Section */}
								<div onClick={(e) => e.stopPropagation()}>
									<button
										onClick={() =>
											toggleMobileSection("solutions")
										}
										className="flex items-center justify-between w-full text-left text-xl font-semibold text-gray-900 py-4 border-b border-gray-100"
									>
										<span>Solutions</span>
										<MdKeyboardArrowDown
											size={24}
											className={`transform transition-transform ${
												activeMobileSections.includes(
													"solutions"
												)
													? "rotate-180"
													: ""
											}`}
										/>
									</button>
									<div
										className={`space-y-6 transition-all duration-200 overflow-hidden ${
											activeMobileSections.includes(
												"solutions"
											)
												? "max-h-[2000px] opacity-100 mt-6"
												: "max-h-0 opacity-0"
										}`}
									>
										{/* Borrow Solutions */}
										<div
											onClick={(e) => e.stopPropagation()}
										>
											<button
												onClick={() =>
													toggleMobileSection(
														"borrow"
													)
												}
												className="flex items-center justify-between w-full text-left text-lg font-semibold text-purple-900 mb-4 py-2 px-3 rounded-lg bg-purple-50"
											>
												<span>Borrow</span>
												<MdKeyboardArrowDown
													size={20}
													className={`transform transition-transform ${
														activeMobileSections.includes(
															"borrow"
														)
															? "rotate-180"
															: ""
													}`}
												/>
											</button>
											<div
												className={`space-y-4 transition-all duration-200 overflow-hidden ${
													activeMobileSections.includes(
														"borrow"
													)
														? "max-h-[1000px] opacity-100"
														: "max-h-0 opacity-0"
												}`}
											>
												<Link
													href="/sme-term-loan"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
														<MdBusinessCenter
															size={20}
															color="#2563EB"
														/>
													</div>
													<div>
														<span className="font-semibold">
															SME Term Loan
														</span>
														<p className="text-sm text-gray-500">
															Term loans for
															business expansion
														</p>
													</div>
												</Link>
												<Link
													href="/personal-loan"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
														<MdAccountBalance
															size={20}
															color="#2563EB"
														/>
													</div>
													<div>
														<span className="font-semibold">
															Personal Loan
														</span>
														<p className="text-sm text-gray-500">
															Fast financing for
															personal needs
														</p>
													</div>
												</Link>
												<Link
													href="/pay-advance"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
														<MdGroups
															size={20}
															color="#059669"
														/>
													</div>
													<div>
														<div className="flex items-center gap-2">
															<span className="font-semibold">
																PayAdvance
															</span>
															<span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full">
																New
															</span>
														</div>
														<p className="text-sm text-gray-500">
															Earned wage access &
															salary advances
														</p>
													</div>
												</Link>
											</div>
										</div>

										{/* Invest Solutions */}
										<div
											onClick={(e) => e.stopPropagation()}
										>
											<button
												onClick={() =>
													toggleMobileSection(
														"invest"
													)
												}
												className="flex items-center justify-between w-full text-left text-lg font-semibold text-purple-900 mb-4 py-2 px-3 rounded-lg bg-purple-50"
											>
												<span>Invest</span>
												<MdKeyboardArrowDown
													size={20}
													className={`transform transition-transform ${
														activeMobileSections.includes(
															"invest"
														)
															? "rotate-180"
															: ""
													}`}
												/>
											</button>
											<div
												className={`space-y-4 transition-all duration-200 overflow-hidden ${
													activeMobileSections.includes(
														"invest"
													)
														? "max-h-[1000px] opacity-100"
														: "max-h-0 opacity-0"
												}`}
											>
												<Link
													href="/products"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
														<MdTrendingUp
															size={20}
															color="#374151"
														/>
													</div>
													<div>
														<span className="font-semibold">
															Private Credit
															Investments
														</span>
														<p className="text-sm text-gray-500">
															8-12% annual returns
														</p>
													</div>
												</Link>
											</div>
										</div>

										{/* Credit Solutions */}
										<div
											onClick={(e) => e.stopPropagation()}
										>
											<button
												onClick={() =>
													toggleMobileSection(
														"credit"
													)
												}
												className="flex items-center justify-between w-full text-left text-lg font-semibold text-purple-900 mb-4 py-2 px-3 rounded-lg bg-purple-50"
											>
												<span>Credit</span>
												<MdKeyboardArrowDown
													size={20}
													className={`transform transition-transform ${
														activeMobileSections.includes(
															"credit"
														)
															? "rotate-180"
															: ""
													}`}
												/>
											</button>
											<div
												className={`space-y-4 transition-all duration-200 overflow-hidden ${
													activeMobileSections.includes(
														"credit"
													)
														? "max-h-[1000px] opacity-100"
														: "max-h-0 opacity-0"
												}`}
											>
												<Link
													href="/credit-score+"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
														<MdAssessment
															size={20}
															color="#7C3AED"
														/>
													</div>
													<div>
														<span className="font-semibold">
															Credit Analytics
														</span>
														<p className="text-sm text-gray-500">
															CTOS reports and
															verification
														</p>
													</div>
												</Link>
												<Link
													href="/products"
													className="flex items-center gap-4 text-gray-600 hover:text-yellow-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
														<MdCreditCard
															size={20}
															color="#EAB308"
														/>
													</div>
													<div>
														<span className="font-semibold">
															Credit Score+
														</span>
														<p className="text-sm text-gray-500">
															Build and improve
															credit score
														</p>
													</div>
												</Link>
											</div>
										</div>
									</div>
								</div>

								{/* Resources Section */}
								<div onClick={(e) => e.stopPropagation()}>
									<button
										onClick={() =>
											toggleMobileSection("resources")
										}
										className="flex items-center justify-between w-full text-left text-xl font-semibold text-gray-900 py-4 border-b border-gray-100"
									>
										<span>Resources</span>
										<MdKeyboardArrowDown
											size={24}
											className={`transform transition-transform ${
												activeMobileSections.includes(
													"resources"
												)
													? "rotate-180"
													: ""
											}`}
										/>
									</button>
									<div
										className={`space-y-6 transition-all duration-200 overflow-hidden ${
											activeMobileSections.includes(
												"resources"
											)
												? "max-h-[2000px] opacity-100 mt-6"
												: "max-h-0 opacity-0"
										}`}
									>
										{/* Company */}
										<div
											onClick={(e) => e.stopPropagation()}
										>
											<button
												onClick={() =>
													toggleMobileSection(
														"company"
													)
												}
												className="flex items-center justify-between w-full text-left text-lg font-semibold text-purple-900 mb-4 py-2 px-3 rounded-lg bg-purple-50"
											>
												<span>Company</span>
												<MdKeyboardArrowDown
													size={20}
													className={`transform transition-transform ${
														activeMobileSections.includes(
															"company"
														)
															? "rotate-180"
															: ""
													}`}
												/>
											</button>
											<div
												className={`space-y-4 transition-all duration-200 overflow-hidden ${
													activeMobileSections.includes(
														"company"
													)
														? "max-h-[1000px] opacity-100"
														: "max-h-0 opacity-0"
												}`}
											>
												<Link
													href="/about"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
														<MdInfo
															size={20}
															color="#4F46E5"
														/>
													</div>
													<div>
														<span className="font-semibold">
															About Us
														</span>
														<p className="text-sm text-gray-500">
															Learn about our
															mission
														</p>
													</div>
												</Link>
												<Link
													href="/careers"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
														<MdWork
															size={20}
															color="#4F46E5"
														/>
													</div>
													<div>
														<span className="font-semibold">
															Careers
														</span>
														<p className="text-sm text-gray-500">
															Join our team and
															make an impact
														</p>
													</div>
												</Link>
											</div>
										</div>

										{/* Resources */}
										<div
											onClick={(e) => e.stopPropagation()}
										>
											<button
												onClick={() =>
													toggleMobileSection(
														"resources-sub"
													)
												}
												className="flex items-center justify-between w-full text-left text-lg font-semibold text-purple-900 mb-4 py-2 px-3 rounded-lg bg-purple-50"
											>
												<span>Resources</span>
												<MdKeyboardArrowDown
													size={20}
													className={`transform transition-transform ${
														activeMobileSections.includes(
															"resources-sub"
														)
															? "rotate-180"
															: ""
													}`}
												/>
											</button>
											<div
												className={`space-y-4 transition-all duration-200 overflow-hidden ${
													activeMobileSections.includes(
														"resources-sub"
													)
														? "max-h-[1000px] opacity-100"
														: "max-h-0 opacity-0"
												}`}
											>
												<Link
													href="/blog"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
														<MdArticle
															size={20}
															color="#4F46E5"
														/>
													</div>
													<div>
														<span className="font-semibold">
															Blog
														</span>
														<p className="text-sm text-gray-500">
															Latest insights and
															updates
														</p>
													</div>
												</Link>
												<Link
													href="/help"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
														<MdHelp
															size={20}
															color="#4F46E5"
														/>
													</div>
													<div>
														<span className="font-semibold">
															Help Center
														</span>
														<p className="text-sm text-gray-500">
															Get answers to your
															questions
														</p>
													</div>
												</Link>
											</div>
										</div>
									</div>
								</div>

								{/* Contact Section */}
								<div onClick={(e) => e.stopPropagation()}>
									<button
										onClick={() =>
											toggleMobileSection("contact")
										}
										className="flex items-center justify-between w-full text-left text-xl font-semibold text-gray-900 py-4 border-b border-gray-100"
									>
										<span>Contact</span>
										<MdKeyboardArrowDown
											size={24}
											className={`transform transition-transform ${
												activeMobileSections.includes(
													"contact"
												)
													? "rotate-180"
													: ""
											}`}
										/>
									</button>
									<div
										className={`space-y-4 transition-all duration-200 overflow-hidden ${
											activeMobileSections.includes(
												"contact"
											)
												? "max-h-[1000px] opacity-100 mt-6"
												: "max-h-0 opacity-0"
										}`}
									>
										<a
											href="https://wa.me/60164614919?text=I'm%20interested%20in%20Kapital%20lending%20products"
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
											onClick={() =>
												setMobileMenuOpen(false)
											}
										>
											<div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
												<MdPhone
													size={20}
													color="#059669"
												/>
											</div>
											<div>
												<span className="font-semibold">
													Click to WhatsApp us
												</span>
												<p className="text-sm text-gray-500">
													Or call +60 16-461 4919
												</p>
											</div>
										</a>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
