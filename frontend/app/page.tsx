"use client";

import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import CTASection from "@/components/CTASection";
import { useState } from "react";
import {
	MdArrowForward,
	MdCheck,
	MdSecurity,
	MdSpeed,
	MdLocationOn,
	MdBusinessCenter,
	MdCreditCard,
	MdVerifiedUser,
	MdPeople,
	MdStar,
	MdPlayArrow,
	MdTrendingUp,
	MdAccountBalance,
	MdAssessment,
	MdLock,
} from "react-icons/md";

// Password Protection Component
function PasswordProtection({ onUnlock }: { onUnlock: () => void }) {
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		// Set your development password here
		const DEV_PASSWORD = "dev123"; // Change this to your preferred password

		if (password === DEV_PASSWORD) {
			onUnlock();
			setError("");
		} else {
			setError("Incorrect password");
			setPassword("");
		}
	};

	return (
		<div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
			<div className="bg-white rounded-xl p-8 w-full max-w-md shadow-xl">
				<div className="text-center mb-6">
					<div className="w-16 h-16 bg-purple-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
						<MdLock size={32} className="text-purple-primary" />
					</div>
					<h2 className="text-2xl font-heading font-bold text-gray-700 mb-2">
						Development Access
					</h2>
					<p className="text-gray-500">
						This site is currently in development mode
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label
							htmlFor="password"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Password
						</label>
						<input
							type="password"
							id="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-primary focus:border-transparent"
							placeholder="Enter development password"
							autoFocus
						/>
						{error && (
							<p className="text-red-500 text-sm mt-2">{error}</p>
						)}
					</div>

					<button
						type="submit"
						className="w-full bg-purple-primary text-white hover:bg-purple-700 font-semibold py-3 px-4 rounded-lg transition-all duration-200"
					>
						Access Site
					</button>
				</form>

				<div className="mt-6 pt-6 border-t border-gray-200">
					<p className="text-xs text-gray-500 text-center">
						Development environment - temporary access control
					</p>
				</div>
			</div>
		</div>
	);
}

export default function Home() {
	const [isUnlocked, setIsUnlocked] = useState(false);

	const scrollToSection = (sectionId: string) => {
		const element = document.getElementById(sectionId);
		element?.scrollIntoView({ behavior: "smooth" });
	};

	// Show password protection if not unlocked
	if (!isUnlocked) {
		return <PasswordProtection onUnlock={() => setIsUnlocked(true)} />;
	}

	return (
		<div className="min-h-screen bg-offwhite text-gray-700 font-body w-full">
			<Navbar bgStyle="bg-transparent" />

			{/* Hero Section */}
			<section className="min-h-screen relative flex items-center bg-gradient-to-br from-[#0A0612] via-[#1A0B2E] to-[#0A0612] w-full">
				{/* Gradient background elements */}
				<div className="absolute inset-0 overflow-hidden">
					{/* Primary purple orbs */}
					<div className="absolute w-[500px] h-[500px] bg-[#7C3AED]/15 rounded-full blur-3xl -top-32 -left-32 animate-pulse"></div>
					<div className="absolute w-[700px] h-[700px] bg-[#7C3AED]/8 rounded-full blur-3xl top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
					<div className="absolute w-[400px] h-[400px] bg-[#7C3AED]/12 rounded-full blur-3xl -bottom-32 -right-32"></div>

					{/* Additional subtle purple accents */}
					<div className="absolute w-[300px] h-[300px] bg-[#7C3AED]/6 rounded-full blur-2xl top-20 right-1/4"></div>
					<div className="absolute w-[200px] h-[200px] bg-[#7C3AED]/10 rounded-full blur-xl bottom-1/4 left-1/4"></div>

					{/* Gradient overlay for depth */}
					<div className="absolute inset-0 bg-gradient-to-t from-[#7C3AED]/5 via-transparent to-transparent"></div>
					<div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED]/3 via-transparent to-[#7C3AED]/3"></div>
				</div>

				{/* Content */}
				<div className="relative w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-32">
					<div className="grid lg:grid-cols-2 gap-12 items-center">
						<div className="text-center lg:text-left">
							<h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-heading font-bold tracking-tight mb-6 leading-tight">
								<span className="text-white drop-shadow-2xl [text-shadow:_0_4px_12px_rgb(147_51_234_/_0.8)]">
									Modern Credit for Malaysia
								</span>
							</h1>
							<p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-gray-200 mb-8 lg:mb-12 font-body leading-relaxed drop-shadow-lg">
								Fast, transparent, and responsible private
								credit solutions designed for Malaysians.
							</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
								<Link
									href="/signup"
									className="bg-purple-primary text-white hover:bg-purple-700 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center"
								>
									Get Started
									<MdArrowForward
										size={20}
										className="ml-2"
									/>
								</Link>
								<Link
									href="/about"
									className="bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 inline-flex items-center justify-center"
								>
									<MdPlayArrow size={20} className="mr-2" />
									Learn About Us
								</Link>
							</div>
						</div>

						{/* Hero Image */}
						<div className="relative h-[300px] sm:h-[400px] lg:h-[500px] xl:h-[600px]">
							<Image
								src="/load.svg"
								alt="Modern Digital Banking"
								fill
								className="object-contain"
								priority
							/>
						</div>
					</div>
				</div>
			</section>

			{/* Partners Section */}
			<section className="py-12 sm:py-16 bg-gray-50 border-b border-gray-100 w-full">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 sm:mb-12">
						<h2 className="text-xl sm:text-xl md:text-2xl font-heading font-bold text-gray-600 mb-2">
							Our Partners
						</h2>
					</div>

					{/* Scrolling partner logos */}
					<div className="relative overflow-hidden">
						<div className="flex animate-scroll space-x-16">
							{/* First set of logos */}
							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/opg.png"
									alt="OPG Capital Holdings"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/kpkt.png"
									alt="KPKT - Ministry of Housing and Local Government"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/ctos.png"
									alt="CTOS Data Systems"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/ssm_einfo.png"
									alt="SSM eInfo"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/al-kathiri.png"
									alt="Al-Kathiri Holdings"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							{/* Duplicate set for seamless loop */}
							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/opg.png"
									alt="OPG Capital Holdings"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/kpkt.png"
									alt="KPKT - Ministry of Housing and Local Government"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/ctos.png"
									alt="CTOS Data Systems"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/ssm_einfo.png"
									alt="SSM eInfo"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/al-kathiri.png"
									alt="Al-Kathiri Holdings"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							{/* Third set for extra smooth scrolling */}
							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/opg.png"
									alt="OPG Capital Holdings"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/kpkt.png"
									alt="KPKT - Ministry of Housing and Local Government"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/ctos.png"
									alt="CTOS Data Systems"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/ssm_einfo.png"
									alt="SSM eInfo"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>

							<div className="flex items-center justify-center min-w-[160px] h-16 sm:h-20 hover:scale-105 transition-all duration-300">
								<Image
									src="/logos/al-kathiri.png"
									alt="Al-Kathiri Holdings"
									width={160}
									height={80}
									className="object-contain h-full w-auto"
								/>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Products Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-offwhite w-full">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					{/* Section Header */}
					<div className="text-center mb-8 lg:mb-16">
						<div className="inline-flex items-center px-4 py-2 bg-purple-primary/10 rounded-full mb-4 sm:mb-6 border border-purple-primary/20">
							<span className="text-xs sm:text-sm font-semibold text-purple-primary">
								Our Solutions
							</span>
						</div>
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 px-4">
							Financial Solutions
							<br />
							<span className="text-purple-primary">
								Built for Malaysia
							</span>
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body px-4 max-w-none lg:max-w-4xl mb-4 lg:mb-6">
							Comprehensive financial services designed to help
							businesses and individuals thrive in Malaysia's
							dynamic economy
						</p>
						<Link
							href="/solutions"
							className="text-sm sm:text-base text-gray-500 hover:text-purple-primary font-medium transition-colors duration-200 inline-flex items-center gap-2 group"
						>
							View All Solutions
							<MdArrowForward
								size={16}
								className="group-hover:translate-x-0.5 transition-transform duration-200"
							/>
						</Link>
					</div>

					{/* Product Cards - Full Width Horizontal */}
					<div className="space-y-8 lg:space-y-12 mx-2 sm:mx-4 lg:mx-0">
						{/* Borrowing Solutions Card */}
						<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
							<div className="grid lg:grid-cols-2 gap-0">
								{/* Content Side */}
								<div className="p-8 lg:p-12 flex flex-col justify-center">
									<div className="flex items-center mb-6">
										<div className="w-16 h-16 lg:w-20 lg:h-20 bg-blue-600/10 rounded-xl lg:rounded-2xl flex items-center justify-center mr-4">
											<div className="relative h-8 w-8 lg:h-10 lg:w-10">
												<Image
													src="/business-loan.svg"
													alt="Business Loans"
													fill
													className="object-contain"
												/>
											</div>
										</div>
										<div>
											<h3 className="text-2xl lg:text-4xl font-heading font-bold text-gray-700 mb-2">
												Personal & Business Loans
											</h3>
											<p className="text-lg lg:text-xl text-blue-600 font-semibold mb-2">
												Fast • Transparent • Flexible
											</p>
											<p className="text-sm text-gray-500 font-medium">
												Powered by OPG Capital Holdings
												Sdn Bhd
											</p>
										</div>
									</div>

									<p className="text-lg lg:text-xl text-gray-600 mb-8 font-body leading-relaxed">
										Get the financing you need with our
										AI-powered lending platform. Whether
										it's personal loans for life's important
										moments or business loans for growth and
										expansion, we provide fast, transparent
										solutions designed for Malaysians.
									</p>

									{/* Features Grid */}
									<div className="grid grid-cols-2 gap-4 lg:gap-6 mb-8">
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-blue-600 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Personal: Up to RM 150,000
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-blue-600 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Business: Up to RM 500,000
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-blue-600 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												24-48 hour approval
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-blue-600 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												100% digital process
											</span>
										</div>
									</div>

									{/* CTA */}
									<div className="flex flex-col sm:flex-row gap-4">
										<Link
											href="/products"
											className="bg-blue-600 text-white hover:bg-blue-700 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center"
										>
											Apply for Loan
											<MdArrowForward
												size={20}
												className="ml-2"
											/>
										</Link>
										<Link
											href="/sme-term-loan"
											className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 inline-flex items-center justify-center"
										>
											Business Loans
										</Link>
									</div>
								</div>

								{/* Visual Side */}
								<div className="relative h-64 lg:h-auto bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
									<div className="relative h-48 w-48 lg:h-64 lg:w-64">
										<Image
											src="/business-loan.svg"
											alt="Business Loan"
											fill
											className="object-contain"
										/>
									</div>
									{/* Floating elements */}
									<div className="absolute top-8 right-8 w-16 h-16 bg-blue-600/20 rounded-full blur-xl"></div>
									<div className="absolute bottom-8 left-8 w-12 h-12 bg-blue-400/30 rounded-full blur-lg"></div>
								</div>
							</div>
						</div>

						{/* Earned Wage Access Card */}
						<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
							<div className="grid lg:grid-cols-2 gap-0">
								{/* Visual Side - Left for variety */}
								<div className="relative h-64 lg:h-auto bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center order-2 lg:order-1">
									<div className="relative h-48 w-48 lg:h-64 lg:w-64">
										<Image
											src="/camping.svg"
											alt="Earned Wage Access"
											fill
											className="object-contain"
										/>
									</div>
									{/* Floating elements */}
									<div className="absolute top-8 left-8 w-16 h-16 bg-emerald-600/20 rounded-full blur-xl"></div>
									<div className="absolute bottom-8 right-8 w-12 h-12 bg-emerald-400/30 rounded-full blur-lg"></div>
								</div>

								{/* Content Side */}
								<div className="p-8 lg:p-12 flex flex-col justify-center order-1 lg:order-2">
									<div className="flex items-center mb-6">
										<div className="w-16 h-16 lg:w-20 lg:h-20 bg-emerald-600/10 rounded-xl lg:rounded-2xl flex items-center justify-center mr-4">
											<div className="relative h-8 w-8 lg:h-10 lg:w-10">
												<Image
													src="/camping.svg"
													alt="Earned Wage Access"
													fill
													className="object-contain"
												/>
											</div>
										</div>
										<div>
											<h3 className="text-2xl lg:text-4xl font-heading font-bold text-gray-700 mb-2">
												Earned Wage Access
											</h3>
											<p className="text-lg lg:text-xl text-emerald-600 font-semibold mb-2">
												Instant • Flexible • Employee
												Benefits
											</p>
										</div>
									</div>

									<p className="text-lg lg:text-xl text-gray-600 mb-8 font-body leading-relaxed">
										Access your earned wages before payday
										with our innovative employee benefit
										solution. Help your workforce manage
										cash flow better while reducing
										financial stress and improving
										productivity.
									</p>

									{/* Features Grid */}
									<div className="grid grid-cols-2 gap-4 lg:gap-6 mb-8">
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Instant access to wages
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												No cost to employers
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Transparent low fees
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Easy payroll integration
											</span>
										</div>
									</div>

									{/* CTA */}
									<div className="flex flex-col sm:flex-row gap-4">
										<Link
											href="/pay-advance"
											className="bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center"
										>
											Get Wage Access
											<MdArrowForward
												size={20}
												className="ml-2"
											/>
										</Link>
										<Link
											href="/products"
											className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 inline-flex items-center justify-center"
										>
											For Employers
										</Link>
									</div>
								</div>
							</div>
						</div>

						{/* Investment Solutions Card */}
						<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
							<div className="grid lg:grid-cols-2 gap-0">
								{/* Content Side */}
								<div className="p-8 lg:p-12 flex flex-col justify-center">
									<div className="flex items-center mb-6">
										<div className="w-16 h-16 lg:w-20 lg:h-20 bg-gray-800/10 rounded-xl lg:rounded-2xl flex items-center justify-center mr-4">
											<div className="relative h-8 w-8 lg:h-10 lg:w-10">
												<Image
													src="/invest.svg"
													alt="Investments"
													fill
													className="object-contain"
												/>
											</div>
										</div>
										<div>
											<h3 className="text-2xl lg:text-4xl font-heading font-bold text-gray-700 mb-2">
												Private Credit Investments
											</h3>
											<p className="text-lg lg:text-xl text-gray-800 font-semibold mb-2">
												Secured • High Returns • Monthly
												Income
											</p>
											<p className="text-sm text-gray-500 font-medium">
												Powered by Al-Kathiri Koperasi
												Berhad
											</p>
										</div>
									</div>

									<p className="text-lg lg:text-xl text-gray-600 mb-8 font-body leading-relaxed">
										Access exclusive private credit
										opportunities with competitive returns.
										Our investment platform connects you
										with carefully vetted borrowers,
										offering steady monthly income with
										security-backed investments.
									</p>

									{/* Features Grid */}
									<div className="grid grid-cols-2 gap-4 lg:gap-6 mb-8">
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-gray-800 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Up to 8% annual returns
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-gray-800 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Monthly distributions
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-gray-800 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Secured investments
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-gray-800 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Minimum RM 10,000
											</span>
										</div>
									</div>

									{/* CTA */}
									<div className="flex flex-col sm:flex-row gap-4">
										<Link
											href="/products"
											className="bg-gray-800 text-white hover:bg-gray-900 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center"
										>
											Start Investing
											<MdArrowForward
												size={20}
												className="ml-2"
											/>
										</Link>
										<Link
											href="/about"
											className="bg-gray-50 text-gray-800 hover:bg-gray-100 border border-gray-200 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 inline-flex items-center justify-center"
										>
											Learn More
										</Link>
									</div>
								</div>

								{/* Visual Side */}
								<div className="relative h-64 lg:h-auto bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
									<div className="relative h-48 w-48 lg:h-64 lg:w-64">
										<Image
											src="/invest.svg"
											alt="Investment Opportunities"
											fill
											className="object-contain"
										/>
									</div>
									{/* Floating elements */}
									<div className="absolute top-8 right-8 w-16 h-16 bg-gray-800/20 rounded-full blur-xl"></div>
									<div className="absolute bottom-8 left-8 w-12 h-12 bg-gray-600/30 rounded-full blur-lg"></div>
								</div>
							</div>
						</div>

						{/* Analytics & Reports Card */}
						<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
							<div className="grid lg:grid-cols-2 gap-0">
								{/* Visual Side */}
								<div className="relative h-64 lg:h-auto bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center order-2 lg:order-1">
									<div className="relative h-48 w-48 lg:h-64 lg:w-64">
										<Image
											src="/analytics.svg"
											alt="Analytics Dashboard"
											fill
											className="object-contain"
										/>
									</div>
									{/* Floating elements */}
									<div className="absolute top-8 left-8 w-16 h-16 bg-purple-primary/20 rounded-full blur-xl"></div>
									<div className="absolute bottom-8 right-8 w-12 h-12 bg-purple-400/30 rounded-full blur-lg"></div>
								</div>

								{/* Content Side */}
								<div className="p-8 lg:p-12 flex flex-col justify-center order-1 lg:order-2">
									<div className="flex items-center mb-6">
										<div className="w-16 h-16 lg:w-20 lg:h-20 bg-purple-primary/10 rounded-xl lg:rounded-2xl flex items-center justify-center mr-4">
											<div className="relative h-8 w-8 lg:h-10 lg:w-10">
												<Image
													src="/analytics.svg"
													alt="Credit Analytics"
													fill
													className="object-contain"
												/>
											</div>
										</div>
										<div>
											<h3 className="text-2xl lg:text-4xl font-heading font-bold text-gray-700 mb-2">
												Credit Analytics
											</h3>
											<p className="text-lg lg:text-xl text-purple-primary font-semibold mb-2">
												Comprehensive • Instant •
												Verified
											</p>
											<p className="text-sm text-gray-500 font-medium">
												Powered by CTOS and SSM e-Info
											</p>
										</div>
									</div>

									<p className="text-lg lg:text-xl text-gray-600 mb-8 font-body leading-relaxed">
										Get comprehensive credit reports and
										business verification services powered
										by CTOS and SSM data. Make informed
										decisions with detailed analytics and
										real-time credit monitoring.
									</p>

									{/* Features Grid */}
									<div className="grid grid-cols-2 gap-4 lg:gap-6 mb-8">
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-purple-primary rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												CTOS credit reports
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-purple-primary rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												SSM business verification
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-purple-primary rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Real-time monitoring
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-purple-primary rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Instant delivery
											</span>
										</div>
									</div>

									{/* CTA */}
									<div className="flex flex-col sm:flex-row gap-4">
										<Link
											href="/credit-score+"
											className="bg-purple-primary text-white hover:bg-purple-700 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center"
										>
											Get Credit Report
											<MdArrowForward
												size={20}
												className="ml-2"
											/>
										</Link>
										<Link
											href="/products"
											className="bg-purple-50 text-purple-primary hover:bg-purple-100 border border-purple-200 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 inline-flex items-center justify-center"
										>
											View Samples
										</Link>
									</div>
								</div>
							</div>
						</div>

						{/* Credit Builder Card */}
						<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
							<div className="grid lg:grid-cols-2 gap-0">
								{/* Content Side */}
								<div className="p-8 lg:p-12 flex flex-col justify-center">
									<div className="flex items-center mb-6">
										<div className="w-16 h-16 lg:w-20 lg:h-20 bg-yellow-500/10 rounded-xl lg:rounded-2xl flex items-center justify-center mr-4">
											<div className="relative h-8 w-8 lg:h-10 lg:w-10">
												<Image
													src="/credit-score.svg"
													alt="Credit Builder"
													fill
													className="object-contain"
												/>
											</div>
										</div>
										<div>
											<h3 className="text-2xl lg:text-4xl font-heading font-bold text-gray-700 mb-2">
												Credit Builder
											</h3>
											<p className="text-lg lg:text-xl text-yellow-600 font-semibold mb-2">
												Build • Improve • Monitor
											</p>
										</div>
									</div>

									<p className="text-lg lg:text-xl text-gray-600 mb-8 font-body leading-relaxed">
										Build and improve your credit score with
										our zero-interest credit building
										program. Perfect for individuals and
										businesses looking to establish or
										rebuild their credit history in
										Malaysia.
									</p>

									{/* Features Grid */}
									<div className="grid grid-cols-2 gap-4 lg:gap-6 mb-8">
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Structured credit building
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Monthly progress tracking
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												CTOS score improvement
											</span>
										</div>
										<div className="flex items-center space-x-3">
											<div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
											<span className="text-base lg:text-lg text-gray-600">
												Syariah compliant
											</span>
										</div>
									</div>

									{/* CTA */}
									<div className="flex flex-col sm:flex-row gap-4">
										<Link
											href="/products"
											className="bg-yellow-500 text-white hover:bg-yellow-600 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center"
										>
											Start Building Credit
											<MdArrowForward
												size={20}
												className="ml-2"
											/>
										</Link>
										<Link
											href="/credit-score+"
											className="bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border border-yellow-200 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 inline-flex items-center justify-center"
										>
											Check Your Score
										</Link>
									</div>
								</div>

								{/* Visual Side */}
								<div className="relative h-64 lg:h-auto bg-gradient-to-br from-yellow-50 to-yellow-100 flex items-center justify-center">
									<div className="relative h-48 w-48 lg:h-64 lg:w-64">
										<Image
											src="/credit-score.svg"
											alt="Credit Building"
											fill
											className="object-contain"
										/>
									</div>
									{/* Floating elements */}
									<div className="absolute top-8 right-8 w-16 h-16 bg-yellow-500/20 rounded-full blur-xl"></div>
									<div className="absolute bottom-8 left-8 w-12 h-12 bg-yellow-400/30 rounded-full blur-lg"></div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Trust & Impact Section */}
			<section className="relative py-12 sm:py-16 lg:py-20 xl:py-24 bg-gradient-to-br from-[#0A0612] via-[#1A0B2E] to-[#0A0612] w-full">
				{/* Gradient background elements */}
				<div className="absolute inset-0 overflow-hidden">
					{/* Primary purple orbs */}
					<div className="absolute w-[500px] h-[500px] bg-[#7C3AED]/15 rounded-full blur-3xl -top-32 -left-32 animate-pulse"></div>
					<div className="absolute w-[700px] h-[700px] bg-[#7C3AED]/8 rounded-full blur-3xl top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
					<div className="absolute w-[400px] h-[400px] bg-[#7C3AED]/12 rounded-full blur-3xl -bottom-32 -right-32"></div>

					{/* Additional subtle purple accents */}
					<div className="absolute w-[300px] h-[300px] bg-[#7C3AED]/6 rounded-full blur-2xl top-20 right-1/4"></div>
					<div className="absolute w-[200px] h-[200px] bg-[#7C3AED]/10 rounded-full blur-xl bottom-1/4 left-1/4"></div>

					{/* Gradient overlay for depth */}
					<div className="absolute inset-0 bg-gradient-to-t from-[#7C3AED]/5 via-transparent to-transparent"></div>
					<div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED]/3 via-transparent to-[#7C3AED]/3"></div>
				</div>

				<div className="relative w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					{/* Trust Statement */}
					<div className="text-center mb-12 lg:mb-20">
						<div className="inline-flex items-center px-4 sm:px-6 py-2 sm:py-3 bg-green-500/20 rounded-full mb-6 sm:mb-8 border border-green-400/30">
							<MdVerifiedUser
								size={16}
								className="text-green-400 mr-2"
							/>
							<span className="text-xs sm:text-sm font-semibold text-green-400">
								Our Track Record
							</span>
						</div>
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 sm:mb-8 text-white leading-tight px-4">
							{/* <span className="text-purple-400">50 Million</span>{" "} */}
							50 Million Reasons
							<br />
							to Trust Us
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300 mx-auto font-body leading-relaxed px-4 max-w-none lg:max-w-4xl mb-8 lg:mb-12">
							We've helped thousands of Malaysian businesses &
							individuals grow with over RM 50 million in loans
							funded. Our track record speaks for itself —
							transparent, fast, and reliable financial solutions.
						</p>
					</div>

					{/* Stats Row */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 text-center">
						{/* Total Funding */}
						<div>
							<div className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-purple-400 mb-2">
								RM 50M+
							</div>
							<div className="text-lg lg:text-xl text-white font-semibold mb-1">
								Total Loans Disbursed
							</div>
							<div className="text-sm lg:text-base text-gray-400">
								Helping Malaysians grow since 2020
							</div>
						</div>

						{/* Customer Trust */}
						<div>
							<div className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-purple-400 mb-2">
								1,000+
							</div>
							<div className="text-lg lg:text-xl text-white font-semibold mb-1">
								Trusted Customers
							</div>
							<div className="text-sm lg:text-base text-gray-400">
								From startups to established SMEs across
								Malaysia
							</div>
						</div>

						{/* Success Rate */}
						<div>
							<div className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-purple-400 mb-2">
								98.5%
							</div>
							<div className="text-lg lg:text-xl text-white font-semibold mb-1">
								Success Rate
							</div>
							<div className="text-sm lg:text-base text-gray-400">
								Industry-leading approval and satisfaction rates
							</div>
						</div>

						{/* Investment Pool */}
						<div>
							<div className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-purple-400 mb-2">
								RM 10M+
							</div>
							<div className="text-lg lg:text-xl text-white font-semibold mb-1">
								Investments Facilitated
							</div>
							<div className="text-sm lg:text-base text-gray-400">
								Connecting investors with verified private
								credit opportunities
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Technology Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-offwhite w-full">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					{/* Section Header */}
					<div className="text-center mb-8 lg:mb-16">
						<div className="inline-flex items-center px-4 py-2 bg-blue-tertiary/10 rounded-full mb-4 sm:mb-6 border border-blue-tertiary/20">
							<span className="text-xs sm:text-sm font-semibold text-blue-tertiary">
								A.I. Powered Credit
							</span>
						</div>
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 px-4">
							Digital First
							<br />
							<span className="text-purple-primary">
								Experience
							</span>
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body px-4 max-w-none lg:max-w-4xl mb-4 lg:mb-6">
							Experience the future of finance with our AI-powered
							platform. From instant credit decisions to real-time
							dashboard insights, everything is designed for speed
							and transparency.
						</p>
					</div>

					<div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
						{/* Content */}
						<div className="order-2 lg:order-1 p-8 lg:p-12">
							{/* Feature List */}
							<div className="space-y-4 lg:space-y-6 mb-8 lg:mb-12">
								<div className="flex items-start space-x-4">
									<div className="flex-shrink-0 w-6 h-6 bg-purple-primary/10 rounded-full flex items-center justify-center mt-1">
										<MdCheck
											size={16}
											className="text-purple-primary"
										/>
									</div>
									<div>
										<h4 className="text-lg lg:text-xl font-heading font-semibold text-gray-700 mb-1">
											AI-Powered Credit Decisions
										</h4>
										<p className="text-base lg:text-lg text-gray-500 font-body">
											Get instant loan approvals with our
											advanced machine learning algorithms
										</p>
									</div>
								</div>
								<div className="flex items-start space-x-4">
									<div className="flex-shrink-0 w-6 h-6 bg-blue-tertiary/10 rounded-full flex items-center justify-center mt-1">
										<MdCheck
											size={16}
											className="text-blue-tertiary"
										/>
									</div>
									<div>
										<h4 className="text-lg lg:text-xl font-heading font-semibold text-gray-700 mb-1">
											Real-Time Dashboard
										</h4>
										<p className="text-base lg:text-lg text-gray-500 font-body">
											Track your loans, payments, and
											financial health in one unified
											platform
										</p>
									</div>
								</div>
								<div className="flex items-start space-x-4">
									<div className="flex-shrink-0 w-6 h-6 bg-purple-primary/10 rounded-full flex items-center justify-center mt-1">
										<MdCheck
											size={16}
											className="text-purple-primary"
										/>
									</div>
									<div>
										<h4 className="text-lg lg:text-xl font-heading font-semibold text-gray-700 mb-1">
											100% Digital Process
										</h4>
										<p className="text-base lg:text-lg text-gray-500 font-body">
											From application to disbursement,
											everything happens online in hours
										</p>
									</div>
								</div>
							</div>
						</div>

						{/* Large Hero Image */}
						<div className="order-1 lg:order-2 relative">
							<div className="relative h-[300px] sm:h-[400px] lg:h-[500px] xl:h-[600px]">
								{/* Large image - full view */}
								<div className="absolute inset-0">
									<Image
										src="/dashboard-mockup.svg"
										alt="Dashboard Mockup"
										fill
										className="object-contain"
										priority
									/>
								</div>
							</div>

							{/* Subtle floating elements */}
							<div className="absolute -top-4 -right-4 w-16 h-16 bg-purple-primary/10 rounded-full blur-xl"></div>
							<div className="absolute -bottom-4 -left-4 w-20 h-20 bg-blue-tertiary/10 rounded-full blur-xl"></div>
						</div>
					</div>
				</div>
			</section>

			{/* Why Trust Us Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-gray-50/20 w-full">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 lg:mb-12">
						<div className="inline-flex items-center px-4 py-2 bg-blue-tertiary/10 rounded-full mb-4 sm:mb-6 border border-blue-tertiary/20">
							<span className="text-xs sm:text-sm font-semibold text-blue-tertiary">
								Why Choose Us
							</span>
						</div>
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 px-4">
							The{" "}
							<span className="text-purple-primary">
								kredit.my
							</span>{" "}
							Difference
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body px-4 max-w-none lg:max-w-5xl">
							Every feature designed with transparency, speed, and
							security in mind
						</p>
					</div>

					{/* Features Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mx-2 sm:mx-4 lg:mx-0">
						{/* Transparent Lending */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mb-4">
								<MdVerifiedUser
									size={28}
									className="text-purple-primary"
								/>
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								100% Transparent
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								No hidden fees, no surprises. Every rate, term,
								and condition is clearly explained upfront
							</p>
						</div>

						{/* Lightning Fast */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-blue-tertiary/10 rounded-xl flex items-center justify-center mb-4">
								<MdSpeed
									size={28}
									className="text-blue-tertiary"
								/>
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								Lightning Fast
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								24-48 hour approval process with instant credit
								decisions and same-day disbursement
							</p>
						</div>

						{/* KPKT Money Lending License */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mb-4">
								<MdAccountBalance
									size={28}
									className="text-blue-600"
								/>
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								KPKT Licensed
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body mb-4">
								Lending products offered by OPG Capital Holdings
								Sdn. Bhd. under KPKT License
								WL3337/07/01-9/020223
							</p>
							<div className="flex items-center text-sm text-gray-500">
								<MdVerifiedUser
									size={16}
									className="text-green-600 mr-2"
								/>
								<span>
									Ministry of Housing & Local Government
								</span>
							</div>
						</div>

						{/* AI-Powered Credit */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-blue-tertiary/10 rounded-xl flex items-center justify-center mb-4">
								<MdAssessment
									size={28}
									className="text-blue-tertiary"
								/>
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								AI-Powered Credit
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								Advanced algorithms ensure fair, fast, and
								accurate loan assessments for better outcomes
							</p>
						</div>

						{/* SKM Koperasi License */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mb-4">
								<MdBusinessCenter
									size={28}
									className="text-purple-primary"
								/>
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								SKM Licensed
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body mb-4">
								Investment products offered by Koperasi
								Al-Kathiri Berhad under SKM License [License
								Number]
							</p>
							<div className="flex items-center text-sm text-gray-500">
								<MdVerifiedUser
									size={16}
									className="text-green-600 mr-2"
								/>
								<span>Suruhanjaya Koperasi Malaysia</span>
							</div>
						</div>

						{/* Local Expertise */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-green-600/10 rounded-xl flex items-center justify-center mb-4">
								<MdPeople
									size={28}
									className="text-green-600"
								/>
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								Local Expertise
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								Malaysian team with deep understanding of local
								business needs and market conditions
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Call to Action Section */}
			<CTASection
				title="Ready to get started?"
				description="Join thousands of Malaysians who trust kredit.my for their financial needs"
				primaryButtonText="Apply Now"
				primaryButtonHref="/signup"
				secondaryButtonText="Contact Us"
				secondaryButtonHref="/contact"
			/>

			{/* Footer */}
			<Footer />
		</div>
	);
}
