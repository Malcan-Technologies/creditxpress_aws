"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Image from "next/image";
import { motion } from "framer-motion";
import {
	MdArrowDownward,
	MdBolt,
	MdShield,
	MdGroups,
	MdCheck,
	MdSpeed,
	MdTrendingUp,
	MdSecurity,
} from "react-icons/md";

export default function About() {
	return (
		<div className="min-h-screen bg-white dark:bg-white text-black dark:text-black">
			<Navbar bgStyle="bg-transparent" />

			{/* Hero Section */}
			<section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
				{/* Animated background elements */}
				<div className="absolute inset-0 overflow-hidden">
					<div className="absolute w-[800px] h-[800px] bg-purple-800/20 rounded-full blur-3xl -top-[400px] -left-[400px] animate-pulse"></div>
					<div className="absolute w-[600px] h-[600px] bg-indigo-800/20 rounded-full blur-3xl top-[20%] right-[10%] animate-pulse delay-700"></div>
					<div className="absolute w-[500px] h-[500px] bg-blue-800/20 rounded-full blur-3xl bottom-[-200px] left-[30%] animate-pulse delay-1000"></div>
				</div>

				{/* Grid pattern overlay */}
				<div
					className="absolute inset-0"
					style={{
						backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
						opacity: 0.1,
					}}
				></div>

				{/* Content */}
				<div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
					<div className="text-center max-w-4xl mx-auto">
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.8 }}
						>
							<h1 className="text-6xl md:text-8xl font-bold text-white mb-8 leading-tight">
								Financial Solutions
								<span className="block bg-gradient-to-r from-purple-300 to-indigo-300 bg-clip-text text-transparent">
									for the 21st Century
								</span>
							</h1>
						</motion.div>
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.8, delay: 0.2 }}
						>
							<p className="text-2xl md:text-3xl text-purple-200 mb-12 leading-relaxed">
								We&apos;re revolutionizing business financing in
								Malaysia through technology, transparency, and
								trust. Our mission is to empower everyone with
								accessible, fair, and innovative financial
								solutions.
							</p>
						</motion.div>
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.8, delay: 0.4 }}
							className="flex flex-col md:flex-row gap-4 justify-center"
						>
							{/* <a
								href="/apply"
								className="inline-flex items-center justify-center bg-white text-purple-900 px-8 py-4 rounded-full font-semibold hover:bg-purple-50 transition-all group"
							>
								Get Started
								<svg
									className="ml-2 w-5 h-5 transform group-hover:translate-x-1 transition-transform"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M17 8l4 4m0 0l-4 4m4-4H3"
									/>
								</svg>
							</a>
							<a
								href="#our-mission"
								className="inline-flex items-center justify-center border-2 border-white text-white px-8 py-4 rounded-full font-semibold hover:bg-white/10 transition-colors"
							>
								Learn More
							</a> */}
						</motion.div>
					</div>
				</div>

				{/* Scroll indicator */}
				<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center text-white/60">
					<span className="text-sm mb-2">Scroll to explore</span>
					<div className="animate-bounce">
						<MdArrowDownward size={24} />
					</div>
				</div>
			</section>

			{/* Mission Section */}
			<section id="our-mission" className="py-20 bg-white">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid md:grid-cols-2 gap-12 items-center">
						<div>
							<h2 className="text-4xl md:text-5xl font-bold mb-6">
								Our Mission
							</h2>
							<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto pb-6">
								At Kapital, we believe that access to capital
								should be fast, fair, and transparent.
								We&apos;re committed to empowering people and
								businesses with the financial tools they need to
								grow and succeed.
							</p>
							<div className="space-y-4">
								<div className="flex items-start gap-4">
									<div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
										<MdBolt size={24} color="#9333EA" />
									</div>
									<div>
										<h3 className="text-2xl font-semibold mb-3">
											Fast Decisions
										</h3>
										<p className="text-lg text-gray-600 dark:text-gray-600">
											Get loan decisions in as little as
											24 hours with our streamlined
											application process.
										</p>
									</div>
								</div>
								<div className="flex items-start gap-4">
									<div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
										<MdShield size={24} color="#4F46E5" />
									</div>
									<div>
										<h3 className="text-2xl font-semibold mb-3">
											Secure & Transparent
										</h3>
										<p className="text-lg text-gray-600 dark:text-gray-600">
											Bank-grade security with clear terms
											and no hidden fees.
										</p>
									</div>
								</div>
							</div>
						</div>
						<div className="relative h-[250px] md:h-[400px] rounded-2xl overflow-hidden shadow-xl">
							<Image
								src="/hero-image.jpg"
								alt="Kapital team working"
								fill
								className="object-cover"
							/>
						</div>
					</div>
				</div>
			</section>

			{/* Stats Section */}
			<section className="pb-8 bg-gradient-to-b from-white to-purple-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					{/* <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						<div className="text-center p-8 bg-white rounded-2xl shadow-sm">
							<div className="text-4xl font-bold text-purple-600 mb-2">
								RM 30M+
							</div>
							<p className="text-gray-600">Loans Disbursed</p>
						</div>
						<div className="text-center p-8 bg-white rounded-2xl shadow-sm">
							<div className="text-4xl font-bold text-indigo-600 mb-2">
								500+
							</div>
							<p className="text-gray-600">Clients Served</p>
						</div>
						<div className="text-center p-8 bg-white rounded-2xl shadow-sm">
							<div className="text-4xl font-bold text-blue-600 mb-2">
								4.9/5
							</div>
							<p className="text-gray-600">Customer Rating</p>
						</div>
					</div> */}
				</div>
			</section>

			{/* Values Section */}
			<section className="py-8 bg-purple-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-black">
							Our Values
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							The principles that guide everything we do at
							Kapital.
						</p>
					</div>
					<div className="grid md:grid-cols-2 gap-12 items-center">
						<div className="relative h-[300px] md:h-[500px]">
							<Image
								src="/values.svg"
								alt="Our company values illustration"
								fill
								className="object-contain"
								priority
							/>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
							<div className="p-6">
								<div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
									<MdGroups size={24} color="#9333EA" />
								</div>
								<h3 className="text-2xl font-semibold mb-3">
									Transparency
								</h3>
								<p className="text-lg text-gray-600 dark:text-gray-600">
									Clear communication and no hidden fees or
									terms.
								</p>
							</div>
							<div className="p-6">
								<div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
									<MdSpeed size={24} color="#4F46E5" />
								</div>
								<h3 className="text-2xl font-semibold mb-3">
									Innovation
								</h3>
								<p className="text-lg text-gray-600 dark:text-gray-600">
									Continuously improving our technology and
									processes.
								</p>
							</div>
							<div className="p-6">
								<div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
									<MdTrendingUp size={24} color="#2563EB" />
								</div>
								<h3 className="text-2xl font-semibold mb-3">
									Customer First
								</h3>
								<p className="text-lg text-gray-600 dark:text-gray-600">
									Everything we do is focused on our
									customers&apos; success.
								</p>
							</div>
							<div className="p-6">
								<div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
									<MdSecurity size={24} color="#9333EA" />
								</div>
								<h3 className="text-2xl font-semibold mb-3">
									Trust
								</h3>
								<p className="text-lg text-gray-600 dark:text-gray-600">
									Building long-term relationships based on
									reliability.
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Team Section
			<section className="py-20 bg-white">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-4xl md:text-5xl font-bold mb-6">
							Our Leadership Team
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
							Meet the experienced professionals leading
							Kapital&apos;s mission to transform business
							financing in Malaysia.
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						<div className="bg-white rounded-2xl p-6 text-center">
							<div className="relative w-32 h-32 mx-auto mb-4">
								<Image
									src="/team-1.jpg"
									alt="Team member"
									fill
									className="object-cover rounded-full"
								/>
							</div>
							<h3 className="text-2xl font-semibold mb-3">
								Sarah Chen
							</h3>
							<p className="text-xl text-purple-600 mb-4">
								Chief Executive Officer
							</p>
							<p className="text-lg text-gray-600">
								Former investment banker with 15+ years of
								experience in financial services.
							</p>
						</div>
						<div className="bg-white rounded-2xl p-6 text-center">
							<div className="relative w-32 h-32 mx-auto mb-4">
								<Image
									src="/team-2.jpg"
									alt="Team member"
									fill
									className="object-cover rounded-full"
								/>
							</div>
							<h3 className="text-2xl font-semibold mb-3">
								David Lim
							</h3>
							<p className="text-xl text-purple-600 mb-4">
								Chief Technology Officer
							</p>
							<p className="text-lg text-gray-600">
								Tech veteran with experience at leading fintech
								companies in Southeast Asia.
							</p>
						</div>
						<div className="bg-white rounded-2xl p-6 text-center">
							<div className="relative w-32 h-32 mx-auto mb-4">
								<Image
									src="/team-3.jpg"
									alt="Team member"
									fill
									className="object-cover rounded-full"
								/>
							</div>
							<h3 className="text-2xl font-semibold mb-3">
								Aisha Rahman
							</h3>
							<p className="text-xl text-purple-600 mb-4">
								Chief Risk Officer
							</p>
							<p className="text-lg text-gray-600">
								20+ years of risk management experience in
								banking and fintech.
							</p>
						</div>
					</div>
				</div>
			</section> */}

			{/* Careers Section */}
			<section className="py-20 bg-gradient-to-b from-white to-purple-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-black">
							Join Our Team
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							Be part of our mission to transform financial
							services in Malaysia. We&apos;re always looking for
							talented individuals to join our team.
						</p>
					</div>
					<div className="grid md:grid-cols-2 gap-8 items-center">
						{/* Image Section - Shown first on mobile */}
						<div className="md:order-2 relative h-[250px] md:h-[400px]">
							<Image
								src="/team.svg"
								alt="Happy team members"
								fill
								className="object-contain"
								priority
							/>
						</div>
						{/* Content Section */}
						<div className="md:order-1 bg-white rounded-2xl p-8 shadow-sm">
							<div className="flex items-start gap-4 mb-6">
								<div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
									<MdBolt size={24} color="#9333EA" />
								</div>
								<div>
									<h3 className="text-2xl font-semibold mb-3">
										Why Work With Us?
									</h3>
									<ul className="space-y-4 text-lg text-gray-600 dark:text-gray-600">
										{[
											"Competitive compensation and benefits",
											"Professional growth opportunities",
											"Flexible work arrangements",
											"Inclusive and diverse workplace",
										].map((benefit, index) => (
											<li
												key={index}
												className="flex items-center gap-2"
											>
												<MdCheck
													size={20}
													color="#9333EA"
												/>
												<span>{benefit}</span>
											</li>
										))}
									</ul>
								</div>
							</div>
							<button
								disabled
								className="inline-block w-full text-center bg-gray-300 text-gray-500 px-6 py-3 rounded-full font-semibold cursor-not-allowed"
							>
								All Positions Filled
							</button>
						</div>
					</div>
				</div>
			</section>

			{/* Features section
			<section className="py-20 bg-gradient-to-b from-white to-purple-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-4xl md:text-5xl font-bold mb-6">
							Our Features
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							Discover the key features that make us stand out.
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
						<div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-lg">
							<div className="mb-4">
								<MdBolt size={24} color="#9333EA" />
							</div>
							<h3 className="text-xl font-semibold mb-2">
								Fast & Efficient
							</h3>
							<p className="text-gray-600 dark:text-gray-400">
								Quick decisions and streamlined processes for
								your financial needs.
							</p>
						</div>
						<div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-lg">
							<div className="mb-4">
								<MdShield size={24} color="#4F46E5" />
							</div>
							<h3 className="text-xl font-semibold mb-2">
								Secure & Reliable
							</h3>
							<p className="text-gray-600 dark:text-gray-400">
								Your data and transactions are protected with
								enterprise-grade security.
							</p>
						</div>
						<div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-lg">
							<div className="mb-4">
								<MdGroups size={24} color="#9333EA" />
							</div>
							<h3 className="text-xl font-semibold mb-2">
								Expert Support
							</h3>
							<p className="text-gray-600 dark:text-gray-400">
								Our team of financial experts is here to guide
								you every step of the way.
							</p>
						</div>
						<div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-lg">
							<div className="mb-4">
								<MdSpeed size={24} color="#4F46E5" />
							</div>
							<h3 className="text-xl font-semibold mb-2">
								Real-time Analytics
							</h3>
							<p className="text-gray-600 dark:text-gray-400">
								Monitor your financial performance with advanced
								analytics tools.
							</p>
						</div>
						<div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-lg">
							<div className="mb-4">
								<MdTrendingUp size={24} color="#2563EB" />
							</div>
							<h3 className="text-xl font-semibold mb-2">
								Growth Focus
							</h3>
							<p className="text-gray-600 dark:text-gray-400">
								Solutions designed to help your business scale
								and succeed.
							</p>
						</div>
						<div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-lg">
							<div className="mb-4">
								<MdSecurity size={24} color="#9333EA" />
							</div>
							<h3 className="text-xl font-semibold mb-2">
								Compliance First
							</h3>
							<p className="text-gray-600 dark:text-gray-400">
								Stay compliant with regulatory requirements and
								industry standards.
							</p>
						</div>
					</div>
				</div>
			</section> */}

			<Footer />
		</div>
	);
}
