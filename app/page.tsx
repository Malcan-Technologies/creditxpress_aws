"use client";

import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
	MdArrowForward,
	MdArrowDownward,
	MdCheck,
	MdBusinessCenter,
	MdAccountBalance,
} from "react-icons/md";

type BenefitType = {
	id: string;
	title: string;
	description: string;
	image: string;
	size: "large" | "small";
};

export default function Home() {
	const benefits: BenefitType[] = [
		{
			id: "one-day-approval",
			title: "One Day Approval",
			description:
				"Kick your loan into hyperdrive. Going from application to approval takes weeks for traditional lenders. We do it in a single day.",
			image: "/speed.svg",
			size: "large",
		},
		{
			id: "transparent",
			title: "Transparent Lending",
			description:
				"No hidden fees, just transparent lending. We'll never surprise you with unexpected charges.",
			image: "/transparent.svg",
			size: "small",
		},
		{
			id: "low-rates",
			title: "Low Interest Rates",
			description:
				"We offer competitive rates that help you save on interest costs.",
			image: "/interest.svg",
			size: "small",
		},
		{
			id: "modern",
			title: "Modern Lending",
			description:
				"Loans for the 21st century. We're a digital-first lender that uses technology to make the lending process more efficient and transparent.",
			image: "/modern.svg",
			size: "large",
		},
	];

	return (
		<div className="min-h-screen bg-white dark:bg-white text-black dark:text-black">
			<Navbar bgStyle="bg-transparent" />

			{/* Hero Section */}
			<header className="min-h-screen relative flex items-center bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
				{/* Decorative background elements */}
				<div className="absolute inset-0 overflow-hidden">
					<div className="absolute w-[500px] h-[500px] bg-purple-800/30 rounded-full blur-3xl -top-32 -left-32"></div>
					<div className="absolute w-[500px] h-[500px] bg-indigo-800/30 rounded-full blur-3xl top-1/2 left-1/2"></div>
					<div className="absolute w-[500px] h-[500px] bg-blue-800/30 rounded-full blur-3xl -bottom-32 -right-32"></div>
				</div>

				{/* Content */}
				<div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
					<div className="grid md:grid-cols-2 gap-12 items-center">
						<div>
							<h1 className="text-4xl sm:text-6xl md:text-8xl font-bold tracking-tight text-white mb-6">
								Smart financing for
								<span className="block bg-gradient-to-r from-purple-300 to-indigo-300 bg-clip-text text-transparent">
									every need
								</span>
							</h1>
							<p className="text-xl sm:text-2xl md:text-3xl text-purple-200 mb-8 md:mb-12">
								Get the funding you need with industry-leading
								rates and lightning-fast approval times. No
								hidden fees, just transparent lending.
							</p>
							<div className="flex gap-4">
								<Link
									href="/products"
									className="bg-white text-purple-900 px-6 sm:px-8 py-3 sm:py-4 rounded-full font-semibold hover:bg-purple-50 transition-all inline-flex items-center"
								>
									Explore Products
									<span className="ml-2">
										<MdArrowForward size={20} />
									</span>
								</Link>
								{/* <Link
									href="/rates"
									className="border-2 border-white text-white px-8 py-4 rounded-full font-semibold hover:bg-white/10 transition-colors"
								>
									View Rates
								</Link> */}
							</div>
						</div>
						<div className="relative h-[300px] md:h-[500px]">
							<Image
								src="/trip.svg"
								alt="Hero Image"
								fill
								className="object-contain"
								priority
							/>
						</div>
					</div>
				</div>
			</header>

			{/* PayAdvance Highlight Section */}
			<section className="py-12 md:py-24 bg-[#0A0612]">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
						<div>
							<div className="inline-flex items-center px-4 py-2 bg-white/5 backdrop-blur-lg rounded-full mb-4 md:mb-6">
								<span className="text-sm font-semibold text-purple-200">
									New Product
								</span>
							</div>
							<h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6 text-white">
								Introducing{" "}
								<span className="bg-gradient-to-r from-purple-300 to-indigo-300 bg-clip-text text-transparent">
									PayAdvance™
								</span>
							</h2>
							<p className="text-lg sm:text-xl md:text-2xl text-purple-200 mb-6 md:mb-8">
								Free up your business cash flow and keep
								employees happy. Fast, transparent, and
								hassle-free salary advances for your employees.
							</p>

							{/* Mobile Image */}
							<div className="block md:hidden relative h-[250px] mb-6">
								<Image
									src="/happy.svg"
									alt="PayAdvance™ - Salary Advance Solution"
									fill
									className="object-contain object-left"
									priority
								/>
							</div>

							<div className="grid grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
								<div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
									<h3 className="text-base md:text-lg font-semibold text-white mb-2">
										Hassle-free
									</h3>
									<p className="text-sm md:text-base text-purple-200">
										Quick and hassle-free salary advances
									</p>
								</div>
								<div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
									<h3 className="text-base md:text-lg font-semibold text-white mb-2">
										Low Interest
									</h3>
									<p className="text-sm md:text-base text-purple-200">
										Up to 1.5% monthly interest rate
									</p>
								</div>
							</div>
							<div className="flex gap-4">
								<Link
									href="/pay-advance"
									className="bg-white text-purple-900 px-6 sm:px-8 py-3 sm:py-4 rounded-full font-semibold hover:bg-purple-50 transition-all shadow-lg inline-flex items-center"
								>
									Learn More
									<span className="ml-2">
										<MdArrowForward size={20} />
									</span>
								</Link>
								<Link
									href="/apply"
									className="border-2 border-white text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-semibold hover:bg-white/10 transition-colors"
								>
									Apply Now
								</Link>
							</div>
						</div>
						{/* Desktop Image */}
						<div className="hidden md:block relative h-[500px]">
							<Image
								src="/happy.svg"
								alt="PayAdvance™ - Salary Advance Solution"
								fill
								className="object-contain"
								priority
							/>
						</div>
					</div>
				</div>
			</section>

			{/* Products Section */}
			<section className="py-24 bg-gradient-to-b from-white to-purple-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-4xl md:text-5xl font-bold mb-6">
							Financial Solutions for Every Need
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							Discover our range of carefully crafted financial
							products designed to support your business growth or
							personal goals
						</p>
					</div>

					<div className="grid md:grid-cols-2 gap-8">
						{/* Business Solutions */}
						<div className="group relative bg-white rounded-3xl p-8 shadow-sm hover:shadow-lg transition-all overflow-hidden">
							<div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-indigo-600/5 group-hover:from-blue-600/10 group-hover:to-indigo-600/10 transition-all"></div>
							<div className="relative">
								<div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center mb-6">
									<MdBusinessCenter
										size={24}
										color="#2563EB"
									/>
								</div>
								<h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
									Business Solutions
								</h3>
								<p className="text-lg text-gray-600 mb-6">
									Comprehensive financing solutions to help
									your business thrive, from working capital
									to expansion funding.
								</p>
								<div className="space-y-4 mb-8">
									<div className="flex items-start gap-3">
										<div className="mt-1">
											<MdCheck
												size={20}
												color="#2563EB"
											/>
										</div>
										<p className="text-gray-600">
											<span className="font-medium text-gray-900">
												Established Businesses:
											</span>{" "}
											Operating for at least 2 years with
											minimum annual revenue of RM 300,000
										</p>
									</div>
									<div className="flex items-start gap-3">
										<div className="mt-1">
											<MdCheck
												size={20}
												color="#2563EB"
											/>
										</div>
										<p className="text-gray-600">
											<span className="font-medium text-gray-900">
												SMEs & Startups:
											</span>{" "}
											Innovative financing options for
											growing businesses with strong
											potential
										</p>
									</div>
								</div>
								<Link
									href="/products"
									className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
								>
									View Business Solutions
								</Link>
							</div>
						</div>

						{/* Personal Loans */}
						<div className="group relative bg-white rounded-3xl p-8 shadow-sm hover:shadow-lg transition-all overflow-hidden">
							<div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-teal-600/5 group-hover:from-emerald-600/10 group-hover:to-teal-600/10 transition-all"></div>
							<div className="relative">
								<div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mb-6">
									<MdAccountBalance
										size={24}
										color="#059669"
									/>
								</div>
								<h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
									Personal Loans
								</h3>
								<p className="text-lg text-gray-600 mb-6">
									Flexible financing options to help you
									achieve your personal goals, from lifestyle
									needs to asset-backed solutions.
								</p>
								<div className="space-y-4 mb-8">
									<div className="flex items-start gap-3">
										<div className="mt-1">
											<MdCheck
												size={20}
												color="#059669"
											/>
										</div>
										<p className="text-gray-600">
											<span className="font-medium text-gray-900">
												Employed Individuals:
											</span>{" "}
											Minimum monthly income of RM 1,700
											with at least 6 months employment
										</p>
									</div>
									<div className="flex items-start gap-3">
										<div className="mt-1">
											<MdCheck
												size={20}
												color="#059669"
											/>
										</div>
										<p className="text-gray-600">
											<span className="font-medium text-gray-900">
												Asset Owners:
											</span>{" "}
											Special rates available for property
											or vehicle owners seeking secured
											financing
										</p>
									</div>
								</div>
								<Link
									href="/products"
									className="inline-flex items-center text-emerald-600 hover:text-emerald-700 font-medium"
								>
									View Personal Loans
								</Link>
							</div>
						</div>
					</div>

					<div className="text-center mt-12">
						<Link
							href="/products"
							className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
						>
							Explore All Products
							<span className="ml-2">
								<MdArrowForward size={20} />
							</span>
						</Link>
					</div>
				</div>
			</section>

			{/* Interactive Benefits Section */}
			<section className="py-12 bg-gradient-to-b from-purple-50 to-white">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-4xl md:text-5xl font-bold mb-6">
							Experience The{" "}
							<span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
								Kapital{" "}
							</span>
							Difference
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							Technology-driven financial solutions with a human
							touch
						</p>
					</div>

					<div className="grid gap-8">
						{benefits.map((benefit) => (
							<div
								key={benefit.id}
								className={`bg-purple-50 rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-lg transition-all ${
									benefit.size === "large"
										? "md:col-span-2"
										: ""
								}`}
							>
								<div className="flex flex-col md:flex-row gap-6 md:gap-8">
									<div className="flex-1 order-2 md:order-1">
										<h3 className="text-2xl font-bold mb-4">
											{benefit.title}
										</h3>
										<p className="text-lg text-gray-600">
											{benefit.description}
										</p>
									</div>
									<div className="relative w-full md:w-1/3 h-[150px] order-1 md:order-2">
										<Image
											src={benefit.image}
											alt={benefit.title}
											fill
											className="object-contain object-left md:object-center"
										/>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Footer */}
			<Footer />

			{/* Scroll indicator */}
			<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center text-white/60">
				<span className="text-sm mb-2">Scroll to explore</span>
				<div className="animate-bounce">
					<MdArrowDownward size={24} />
				</div>
			</div>
		</div>
	);
}
