"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
	MdArrowForward,
	MdCheck,
	MdSecurity,
	MdSpeed,
	MdLocationOn,
	MdBusinessCenter,
	MdVerifiedUser,
	MdPeople,
	MdTrendingUp,
	MdAccountBalance,
	MdBolt,
	MdShield,
	MdGroups,
} from "react-icons/md";

export default function About() {
	useDocumentTitle("About Us");

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
							<h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-heading font-bold tracking-tight mb-6 leading-tight">
								<span className="text-white drop-shadow-2xl [text-shadow:_0_4px_12px_rgb(147_51_234_/_0.8)]">
									Hello, we're
								</span>
								<br />
								<span className="text-white drop-shadow-2xl [text-shadow:_0_4px_12px_rgb(147_51_234_/_0.8)]">
									kredit.my
								</span>
							</h1>
							<p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-gray-200 mb-8 lg:mb-12 font-body leading-relaxed drop-shadow-lg">
								We're revolutionizing business financing in
								Malaysia through technology, transparency, and
								trust. Our mission is to empower everyone with
								accessible, fair, and innovative financial
								solutions.
							</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
								<Link
									href="/signup"
									className="bg-purple-primary text-white hover:bg-purple-700 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center"
								>
									Join Us Today
									<MdArrowForward
										size={20}
										className="ml-2"
									/>
								</Link>
								<Link
									href="/contact"
									className="bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 inline-flex items-center justify-center"
								>
									Contact Us
								</Link>
							</div>
						</div>

						{/* Hero Image */}
						<div className="relative h-[300px] sm:h-[400px] lg:h-[500px] xl:h-[600px]">
							<Image
								src="/values.svg"
								alt="Our Values and Mission"
								fill
								className="object-contain"
								priority
							/>
						</div>
					</div>
				</div>
			</section>

			{/* Mission & Values Section */}
			<section className="relative py-12 sm:py-16 lg:py-20 xl:py-24 bg-offwhite w-full">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					{/* Mission Statement */}
					<div className="text-center mb-8 lg:mb-12">
						<div className="inline-flex items-center px-4 py-2 bg-purple-primary/10 rounded-full mb-6 sm:mb-8 border border-purple-primary/20">
							<span className="text-xs sm:text-sm font-semibold text-purple-primary">
								Our Mission
							</span>
						</div>
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 leading-tight px-4">
							Building the
							<br />
							<span className="text-purple-primary">
								Future of Finance
							</span>
							<br />
							in Malaysia
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body leading-relaxed px-4 max-w-none lg:max-w-5xl">
							At Kredit.my, we believe that access to capital
							should be fast, fair, and transparent. We're
							committed to empowering people and businesses with
							the financial tools they need to grow and succeed.
						</p>
					</div>

					{/* Mission Features Card */}
					<div className="bg-white rounded-xl lg:rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl border border-gray-100 relative overflow-hidden mx-2 sm:mx-4 lg:mx-0">
						{/* Background Pattern */}
						<div className="absolute inset-0 opacity-5">
							<div className="absolute w-40 h-40 bg-purple-primary rounded-full blur-3xl -top-10 -right-10"></div>
							<div className="absolute w-32 h-32 bg-blue-tertiary rounded-full blur-2xl -bottom-8 -left-8"></div>
						</div>

						<div className="relative">
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
								{/* Fast Decisions */}
								<div className="text-center group">
									<div className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-primary/10 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-purple-primary/20 transition-colors">
										<MdBolt
											size={24}
											className="text-purple-primary sm:w-7 sm:h-7"
										/>
									</div>
									<div className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-purple-primary mb-1">
										24-48 Hours
									</div>
									<div className="text-sm sm:text-base text-gray-700 font-semibold mb-2">
										Fast Decisions
									</div>
									<div className="text-sm text-gray-500">
										Get loan decisions quickly with our
										streamlined process
									</div>
								</div>

								{/* Secure & Transparent */}
								<div className="text-center group">
									<div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-tertiary/10 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-tertiary/20 transition-colors">
										<MdShield
											size={24}
											className="text-blue-tertiary sm:w-7 sm:h-7"
										/>
									</div>
									<div className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-blue-tertiary mb-1">
										100%
									</div>
									<div className="text-sm sm:text-base text-gray-700 font-semibold mb-2">
										Transparent
									</div>
									<div className="text-sm text-gray-500">
										Bank-grade security with clear terms and
										no hidden fees
									</div>
								</div>

								{/* Licensed Provider */}
								<div className="text-center group">
									<div className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-primary/10 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-purple-primary/20 transition-colors">
										<MdVerifiedUser
											size={24}
											className="text-purple-primary sm:w-7 sm:h-7"
										/>
									</div>
									<div className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-purple-primary mb-1">
										Licensed
									</div>
									<div className="text-sm sm:text-base text-gray-700 font-semibold mb-2">
										in Malaysia
									</div>
									<div className="text-sm text-gray-500">
										Fully regulated fintech provider you can
										trust
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Our Values Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-gray-50/50 w-full">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
						{/* Content */}
						<div className="order-2 lg:order-1">
							<div className="inline-flex items-center px-4 py-2 bg-blue-tertiary/10 rounded-full mb-4 sm:mb-6 border border-blue-tertiary/20">
								<span className="text-xs sm:text-sm font-semibold text-blue-tertiary">
									Our Core Values
								</span>
							</div>
							<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 text-gray-700 leading-tight">
								What Drives
								<br />
								<span className="text-purple-primary">
									Everything We Do
								</span>
							</h2>
							<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mb-8 lg:mb-12 font-body leading-relaxed">
								The principles that guide everything we do at
								Kredit.my, ensuring we deliver the best possible
								experience for our customers.
							</p>

							{/* Values List */}
							<div className="space-y-4 lg:space-y-6">
								<div className="flex items-start space-x-4">
									<div className="flex-shrink-0 w-6 h-6 bg-purple-primary/10 rounded-full flex items-center justify-center mt-1">
										<MdCheck
											size={16}
											className="text-purple-primary"
										/>
									</div>
									<div>
										<h4 className="text-lg lg:text-xl font-heading font-semibold text-gray-700 mb-1">
											Transparency First
										</h4>
										<p className="text-base lg:text-lg text-gray-500 font-body">
											Clear communication and no hidden
											fees or terms in everything we do
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
											Continuous Innovation
										</h4>
										<p className="text-base lg:text-lg text-gray-500 font-body">
											Always improving our technology and
											processes to serve you better
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
											Customer Success Focus
										</h4>
										<p className="text-base lg:text-lg text-gray-500 font-body">
											Everything we do is focused on
											helping our customers grow and
											succeed
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
											Trust & Reliability
										</h4>
										<p className="text-base lg:text-lg text-gray-500 font-body">
											Building long-term relationships
											based on consistent, reliable
											service
										</p>
									</div>
								</div>
							</div>
						</div>

						{/* Large Hero Image */}
						<div className="order-1 lg:order-2 relative">
							<div className="relative h-[300px] sm:h-[400px] lg:h-[500px] xl:h-[600px]">
								<Image
									src="/team.svg"
									alt="Our Team Values"
									fill
									className="object-contain"
									priority
								/>
							</div>

							{/* Subtle floating elements */}
							<div className="absolute -top-4 -right-4 w-16 h-16 bg-purple-primary/10 rounded-full blur-xl"></div>
							<div className="absolute -bottom-4 -left-4 w-20 h-20 bg-blue-tertiary/10 rounded-full blur-xl"></div>
						</div>
					</div>
				</div>
			</section>

			{/* Why Choose Us Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-offwhite w-full">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 lg:mb-12">
						<div className="inline-flex items-center px-4 py-2 bg-blue-tertiary/10 rounded-full mb-4 sm:mb-6 border border-blue-tertiary/20">
							<span className="text-xs sm:text-sm font-semibold text-blue-tertiary">
								Why Choose Us
							</span>
						</div>
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 px-4">
							The Kredit.my Advantage
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body px-4 max-w-none lg:max-w-5xl">
							What sets us apart in Malaysia's financial services
							landscape
						</p>
					</div>

					{/* Features Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mx-2 sm:mx-4 lg:mx-0">
						{/* Licensed & Regulated */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mb-4">
								<MdSecurity
									size={28}
									className="text-purple-primary"
								/>
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								Licensed & Regulated
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								Fully licensed fintech provider operating under
								Malaysian financial regulations
							</p>
						</div>

						{/* Technology Driven */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-blue-tertiary/10 rounded-xl flex items-center justify-center mb-4">
								<MdTrendingUp
									size={28}
									className="text-blue-tertiary"
								/>
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								Technology Driven
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								AI-powered credit decisions and real-time
								dashboard insights for better outcomes
							</p>
						</div>

						{/* Local Expertise */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mb-4">
								<MdLocationOn
									size={28}
									className="text-purple-primary"
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

						{/* Fast Processing */}
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

						{/* Comprehensive Solutions */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mb-4">
								<MdBusinessCenter
									size={28}
									className="text-purple-primary"
								/>
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								Complete Solutions
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								Loans, investments, and analytics - everything
								you need for financial success
							</p>
						</div>

						{/* Customer Support */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-blue-tertiary/10 rounded-xl flex items-center justify-center mb-4">
								<MdPeople
									size={28}
									className="text-blue-tertiary"
								/>
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								Expert Support
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								Dedicated support team to guide you through
								every step of your financial journey
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Join Our Team Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-gray-50/50 w-full">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="bg-white rounded-xl lg:rounded-2xl p-8 sm:p-10 lg:p-12 xl:p-16 relative overflow-hidden mx-2 sm:mx-4 lg:mx-0 border border-gray-200 shadow-lg">
						{/* Subtle background elements */}
						<div className="absolute inset-0 overflow-hidden">
							<div className="absolute w-[500px] h-[500px] bg-purple-primary/3 rounded-full blur-3xl -top-32 -left-32"></div>
							<div className="absolute w-[400px] h-[400px] bg-blue-tertiary/3 rounded-full blur-3xl -bottom-32 -right-32"></div>
						</div>

						<div className="relative">
							<div className="text-center mb-8 lg:mb-12">
								<div className="inline-flex items-center px-4 py-2 bg-purple-primary/10 rounded-full mb-4 sm:mb-6 border border-purple-primary/20">
									<span className="text-xs sm:text-sm font-semibold text-purple-primary">
										Careers
									</span>
								</div>
								<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 px-4">
									Join Our Mission
								</h2>
								<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body px-4 max-w-none lg:max-w-4xl">
									Be part of our mission to transform
									financial services in Malaysia. We're always
									looking for talented individuals to join our
									team.
								</p>
							</div>

							<div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
								{/* Benefits */}
								<div>
									<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-6 text-gray-700">
										Why Work With Us?
									</h3>
									<div className="space-y-4">
										{[
											"Competitive compensation and benefits",
											"Professional growth opportunities",
											"Flexible work arrangements",
											"Inclusive and diverse workplace",
											"Impact-driven work environment",
											"Cutting-edge technology stack",
										].map((benefit, index) => (
											<div
												key={index}
												className="flex items-center gap-3"
											>
												<div className="w-5 h-5 bg-purple-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
													<MdCheck
														size={14}
														className="text-purple-primary"
													/>
												</div>
												<span className="text-lg text-gray-600">
													{benefit}
												</span>
											</div>
										))}
									</div>
									<div className="mt-8">
										<button
											disabled
											className="bg-gray-200 text-gray-500 px-6 py-3 rounded-xl font-semibold cursor-not-allowed inline-flex items-center"
										>
											All Positions Currently Filled
										</button>
									</div>
								</div>

								{/* Image */}
								<div className="relative h-[300px] lg:h-[400px]">
									<Image
										src="/team.svg"
										alt="Join Our Team"
										fill
										className="object-contain"
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Call to Action Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-offwhite w-full">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 rounded-xl lg:rounded-2xl p-8 sm:p-10 lg:p-12 text-center relative overflow-hidden shadow-xl mx-2 sm:mx-4 lg:mx-0">
						<div className="absolute inset-0 bg-black/10"></div>
						<div className="relative">
							<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-white px-4">
								Ready to Experience
								<br />
								the Future of Finance?
							</h2>
							<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 mb-8 sm:mb-10 lg:mb-12 mx-auto font-body px-4 max-w-none lg:max-w-5xl">
								Join thousands of Malaysians who trust Kapital
								for their financial needs
							</p>
							<div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
								<Link
									href="/signup"
									className="bg-white text-purple-primary hover:bg-gray-100 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center"
								>
									Get Started Today
									<MdArrowForward
										size={18}
										className="ml-2 lg:w-5 lg:h-5"
									/>
								</Link>
								<Link
									href="/contact"
									className="bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 inline-flex items-center justify-center"
								>
									Contact Us
								</Link>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Footer */}
			<Footer />
		</div>
	);
}
