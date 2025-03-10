"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import {
	MdMenu,
	MdClose,
	MdKeyboardArrowDown,
	MdGroups,
	MdDirectionsCar,
	MdCreditCard,
	MdBusinessCenter,
	MdAccountBalance,
	MdApartment,
	MdShowChart,
	MdInfo,
	MdWork,
	MdArticle,
	MdHelp,
	MdPhone,
} from "react-icons/md";

type NavbarProps = {
	bgStyle?: string;
};

type ActiveMenu = "none" | "borrow" | "resources";

export default function Navbar({
	bgStyle = "bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900",
}: NavbarProps) {
	const [isScrolled, setIsScrolled] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [activeMenu, setActiveMenu] = useState<ActiveMenu>("none");
	const [activeMobileSections, setActiveMobileSections] = useState<string[]>(
		[]
	);
	const navRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
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
			if (section === "business" || section === "personal") {
				return [...new Set([...prev, "borrow", section])];
			}
			if (section === "company" || section === "resources-sub") {
				return [...new Set([...prev, "resources", section])];
			}
			return [...prev, section];
		});
	};

	return (
		<>
			<nav
				ref={navRef}
				className={`fixed w-full z-50 transition-colors duration-300 ${
					isScrolled
						? "bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900"
						: bgStyle
				} border-b border-white/10 backdrop-blur-md dark:from-purple-900 dark:via-indigo-900 dark:to-blue-900`}
			>
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between h-16 items-center">
						<div className="flex items-center">
							<Link href="/" className="relative w-32 h-8">
								<Image
									src="/logo-white-large.svg"
									alt="Kapital"
									fill
									className="object-contain"
									priority
								/>
							</Link>
						</div>
						<div className="hidden md:flex items-center justify-center flex-1 space-x-8 px-16">
							<div className="relative">
								<button
									onClick={() => handleMenuClick("borrow")}
									className="text-gray-200 hover:text-white dark:text-gray-200 dark:hover:text-white transition-colors flex items-center gap-1"
								>
									Borrow
									<div
										className={`transition-transform duration-200 ${
											activeMenu === "borrow"
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
									className="text-gray-200 hover:text-white dark:text-gray-200 dark:hover:text-white transition-colors flex items-center gap-1"
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
									className="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-gray-200 hover:border-white text-gray-200 hover:text-white transition-colors"
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
							<Link
								href="/login"
								className="text-gray-200 hover:text-white px-4 py-2 rounded-full transition-colors"
							>
								Sign in
							</Link>
							<Link
								href="/apply"
								className="font-semibold bg-white text-purple-900 px-4 py-2 rounded-full hover:bg-purple-50 transition-all"
							>
								Get started
							</Link>
						</div>

						{/* Mobile Menu Button */}
						<div className="flex md:hidden">
							<button
								onClick={() => setMobileMenuOpen(true)}
								className="text-white hover:text-gray-200"
							>
								<span className="sr-only">Open menu</span>
								<MdMenu size={24} />
							</button>
						</div>
					</div>

					{/* Mega Menu Container */}
					<div
						className={`absolute left-0 right-0 mt-1 transition-all duration-200 ${
							activeMenu === "none"
								? "opacity-0 invisible"
								: "opacity-100 visible"
						}`}
					>
						<div className="max-w-7xl mx-auto">
							<div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
								{activeMenu === "borrow" && (
									<div className="grid grid-cols-3 gap-8">
										{/* Business Solutions Column */}
										<div>
											<h3 className="text-lg font-semibold text-gray-900 mb-4">
												Business Solutions
											</h3>
											<div className="space-y-4">
												<Link
													href="/pay-advance"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-gray-50"
												>
													<div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
														<MdGroups
															size={24}
															color="#9333EA"
														/>
													</div>
													<div>
														<div className="flex items-center gap-2">
															<h4 className="text-base font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
																PayAdvance™
															</h4>
															<span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full">
																New
															</span>
														</div>
														<p className="text-sm text-gray-500">
															Instant salary
															advances for your
															employees
														</p>
													</div>
												</Link>
												<Link
													href="/equipment-financing"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-gray-50"
												>
													<div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
														<MdBusinessCenter
															size={24}
															color="#059669"
														/>
													</div>
													<div>
														<div className="flex items-center gap-2">
															<h4 className="text-base font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
																Equipment
																Financing
															</h4>
															<span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full">
																New
															</span>
														</div>
														<p className="text-sm text-gray-500">
															Finance your
															business equipment
															with flexible terms
														</p>
													</div>
												</Link>
												<Link
													href="/sme-term-loan"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-gray-50"
												>
													<div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
														<MdBusinessCenter
															size={24}
															color="#2563EB"
														/>
													</div>
													<div>
														<div className="flex items-center gap-2">
															<h4 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
																SME Term Loan
															</h4>
														</div>
														<p className="text-sm text-gray-500">
															Term loans for
															business expansion
														</p>
													</div>
												</Link>
												<Link
													href="/products"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-gray-50"
												>
													<div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
														<MdDirectionsCar
															size={24}
															color="#2563EB"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
															Auto Dealer
															Financing
														</h4>
														<p className="text-sm text-gray-500">
															Specialized
															financing for
															dealerships
														</p>
													</div>
												</Link>
												<Link
													href="/products"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-gray-50"
												>
													<div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
														<MdCreditCard
															size={24}
															color="#2563EB"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
															Business Line of
															Credit
														</h4>
														<p className="text-sm text-gray-500">
															Flexible credit for
															managing cash flow
														</p>
													</div>
												</Link>
											</div>
										</div>

										{/* Personal Solutions Column */}
										<div>
											<h3 className="text-lg font-semibold text-gray-900 mb-4">
												Personal Solutions
											</h3>
											<div className="space-y-4">
												<Link
													href="/products"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-gray-50"
												>
													<div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
														<MdAccountBalance
															size={24}
															color="#059669"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
															Lifestyle Term Loan
														</h4>
														<p className="text-sm text-gray-500">
															Quick and flexible
															personal loans
														</p>
													</div>
												</Link>
												<Link
													href="/products"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-gray-50"
												>
													<div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
														<MdApartment
															size={24}
															color="#059669"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
															Property-Backed
															Financing
														</h4>
														<p className="text-sm text-gray-500">
															Better rates with
															property collateral
														</p>
													</div>
												</Link>
												<Link
													href="/products"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-gray-50"
												>
													<div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
														<MdShowChart
															size={24}
															color="#059669"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
															Lease-to-Own
															Financing
														</h4>
														<p className="text-sm text-gray-500">
															Vehicle-backed
															financing solutions
														</p>
													</div>
												</Link>
											</div>
										</div>

										{/* CTA Column - Borrow Menu */}
										<div className="bg-gray-50 rounded-xl p-6">
											<div className="relative h-32 mb-4">
												<Image
													src="/decide.svg"
													alt="Happy customer"
													fill
													className="object-contain object-left"
												/>
											</div>
											<div className="mb-4">
												<h3 className="text-lg font-semibold text-gray-900 mb-2">
													Ready to get started?
												</h3>
												<p className="text-sm text-gray-600">
													Apply now and get approved
													within 24 hours
												</p>
											</div>
											<Link
												href="/products"
												className="inline-block text-blue-600 hover:text-blue-700 font-medium"
											>
												See all products →
											</Link>
										</div>
									</div>
								)}

								{activeMenu === "resources" && (
									<div className="grid grid-cols-3 gap-8">
										{/* Company Column */}
										<div>
											<h3 className="text-lg font-semibold text-gray-900 mb-4">
												Company
											</h3>
											<div className="space-y-4">
												<Link
													href="/about"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-gray-50"
												>
													<div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
														<MdInfo
															size={24}
															color="#4F46E5"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
															About Us
														</h4>
														<p className="text-sm text-gray-500">
															Learn more about our
															mission and values
														</p>
													</div>
												</Link>
												<Link
													href="/careers"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-gray-50"
												>
													<div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
														<MdWork
															size={24}
															color="#4F46E5"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
															Careers
														</h4>
														<p className="text-sm text-gray-500">
															Join our team and
															make an impact
														</p>
													</div>
												</Link>
											</div>
										</div>

										{/* Resources Column */}
										<div>
											<h3 className="text-lg font-semibold text-gray-900 mb-4">
												Resources
											</h3>
											<div className="space-y-4">
												<Link
													href="/blog"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-gray-50"
												>
													<div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
														<MdArticle
															size={24}
															color="#4F46E5"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
															Blog
														</h4>
														<p className="text-sm text-gray-500">
															Latest insights and
															updates
														</p>
													</div>
												</Link>
												<Link
													href="/help"
													className="group flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-gray-50"
												>
													<div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
														<MdHelp
															size={24}
															color="#4F46E5"
														/>
													</div>
													<div>
														<h4 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
															Help Center
														</h4>
														<p className="text-sm text-gray-500">
															Get answers to your
															questions
														</p>
													</div>
												</Link>
											</div>
										</div>

										{/* CTA Column - Resources Menu */}
										<div className="bg-gray-50 rounded-xl p-6">
											<div className="relative h-32 mb-4">
												<Image
													src="/help.svg"
													alt="Support"
													fill
													className="object-contain object-left"
												/>
											</div>
											<div className="mb-4">
												<h3 className="text-lg font-semibold text-gray-900 mb-2">
													Need help?
												</h3>
												<p className="text-sm text-gray-600">
													Our support team is here for
													you 24/7
												</p>
											</div>
											<Link
												href="https://wa.me/60164614919?text=I'm%20interested%20in%20Kapital%20lending%20products"
												className="inline-block text-blue-600 hover:text-blue-700 font-medium"
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
							<Link
								href="/login"
								className="flex-1 text-center text-gray-600 px-6 py-3 rounded-full border-2 border-gray-200 hover:bg-gray-50 transition-colors font-semibold"
								onClick={() => setMobileMenuOpen(false)}
							>
								Sign in
							</Link>
							<Link
								href="/apply"
								className="flex-1 text-center bg-purple-600 text-white px-6 py-3 rounded-full hover:bg-purple-700 transition-colors font-semibold"
								onClick={() => setMobileMenuOpen(false)}
							>
								Get started
							</Link>
						</div>
					</div>

					{/* Scrollable Content Area */}
					<div className="h-full overflow-y-auto pb-32">
						<div className="p-6">
							<div className="flex justify-end mb-8">
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
								{/* Borrow Section */}
								<div onClick={(e) => e.stopPropagation()}>
									<button
										onClick={() =>
											toggleMobileSection("borrow")
										}
										className="flex items-center justify-between w-full text-left text-xl font-semibold text-gray-900 py-4 border-b border-gray-100"
									>
										<span>Borrow</span>
										<MdKeyboardArrowDown
											size={24}
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
										className={`space-y-6 transition-all duration-200 overflow-hidden ${
											activeMobileSections.includes(
												"borrow"
											)
												? "max-h-[2000px] opacity-100 mt-6"
												: "max-h-0 opacity-0"
										}`}
									>
										{/* Business Solutions */}
										<div
											onClick={(e) => e.stopPropagation()}
										>
											<button
												onClick={() =>
													toggleMobileSection(
														"business"
													)
												}
												className="flex items-center justify-between w-full text-left text-lg font-semibold text-purple-900 mb-4 py-2 px-3 rounded-lg bg-purple-50"
											>
												<span>Business Solutions</span>
												<MdKeyboardArrowDown
													size={20}
													className={`transform transition-transform ${
														activeMobileSections.includes(
															"business"
														)
															? "rotate-180"
															: ""
													}`}
												/>
											</button>
											<div
												className={`space-y-4 transition-all duration-200 overflow-hidden ${
													activeMobileSections.includes(
														"business"
													)
														? "max-h-[1000px] opacity-100"
														: "max-h-0 opacity-0"
												}`}
											>
												{/* Business Solutions Links */}
												<Link
													href="/pay-advance"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
														<MdGroups
															size={20}
															color="#9333EA"
														/>
													</div>
													<div>
														<div className="flex items-center gap-2">
															<span className="font-semibold">
																PayAdvance™
															</span>
															<span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full">
																New
															</span>
														</div>
														<p className="text-sm text-gray-500">
															Instant salary
															advances
														</p>
													</div>
												</Link>
												<Link
													href="/equipment-financing"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
														<MdBusinessCenter
															size={20}
															color="#059669"
														/>
													</div>
													<div>
														<div className="flex items-center gap-2">
															<h4 className="text-base font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
																Equipment
																Financing
															</h4>
															<span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full">
																New
															</span>
														</div>
														<p className="text-sm text-gray-500">
															Finance your
															business equipment
															with flexible terms
														</p>
													</div>
												</Link>
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
														<div className="flex items-center gap-2">
															<h4 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
																SME Term Loan
															</h4>
														</div>
														<p className="text-sm text-gray-500">
															Term loans for
															business expansion
														</p>
													</div>
												</Link>
												<Link
													href="/products"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
														<MdDirectionsCar
															size={20}
															color="#2563EB"
														/>
													</div>
													<div>
														<span className="font-semibold">
															Auto Dealer
															Financing
														</span>
														<p className="text-sm text-gray-500">
															Specialized
															financing for
															dealerships
														</p>
													</div>
												</Link>
												<Link
													href="/products"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
														<MdCreditCard
															size={20}
															color="#2563EB"
														/>
													</div>
													<div>
														<span className="font-semibold">
															Business Line of
															Credit
														</span>
														<p className="text-sm text-gray-500">
															Flexible credit for
															cash flow
														</p>
													</div>
												</Link>
											</div>
										</div>

										{/* Personal Solutions */}
										<div
											onClick={(e) => e.stopPropagation()}
										>
											<button
												onClick={() =>
													toggleMobileSection(
														"personal"
													)
												}
												className="flex items-center justify-between w-full text-left text-lg font-semibold text-purple-900 mb-4 py-2 px-3 rounded-lg bg-purple-50"
											>
												<span>Personal Solutions</span>
												<MdKeyboardArrowDown
													size={20}
													className={`transform transition-transform ${
														activeMobileSections.includes(
															"personal"
														)
															? "rotate-180"
															: ""
													}`}
												/>
											</button>
											<div
												className={`space-y-4 transition-all duration-200 overflow-hidden ${
													activeMobileSections.includes(
														"personal"
													)
														? "max-h-[1000px] opacity-100"
														: "max-h-0 opacity-0"
												}`}
											>
												{/* Personal Solutions Links */}
												<Link
													href="/products"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
														<MdAccountBalance
															size={20}
															color="#059669"
														/>
													</div>
													<div>
														<span className="font-semibold">
															Lifestyle Term Loan
														</span>
														<p className="text-sm text-gray-500">
															Quick and flexible
															personal loans
														</p>
													</div>
												</Link>
												<Link
													href="/products"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
														<MdApartment
															size={20}
															color="#059669"
														/>
													</div>
													<div>
														<span className="font-semibold">
															Property-Backed
															Financing
														</span>
														<p className="text-sm text-gray-500">
															Better rates with
															property collateral
														</p>
													</div>
												</Link>
												<Link
													href="/products"
													className="flex items-center gap-4 text-gray-600 hover:text-purple-600 p-2"
													onClick={() =>
														setMobileMenuOpen(false)
													}
												>
													<div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
														<MdShowChart
															size={20}
															color="#059669"
														/>
													</div>
													<div>
														<span className="font-semibold">
															Lease-to-Own
															Financing
														</span>
														<p className="text-sm text-gray-500">
															Vehicle-backed
															financing solutions
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
												{/* Company Links */}
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
												{/* Resources Links */}
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
