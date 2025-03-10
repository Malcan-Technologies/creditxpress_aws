"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from "recharts";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function EquipmentFinancing() {
	const [loanAmount, setLoanAmount] = useState(50000);
	const [loanTerm, setLoanTerm] = useState(12);
	const [equipmentCost, setEquipmentCost] = useState(100000);

	const INTEREST_RATE = 0.01; // 1% per month
	const ORIGINATION_FEE_RATE = 0.03; // 3%
	const LEGAL_FEE_RATE = 0.02; // 2%
	const MAX_FINANCING_PERCENTAGE = 0.6; // 60% of equipment cost
	const MAX_LOAN_AMOUNT = 500000; // Maximum loan amount cap

	const handleEquipmentCostChange = (newCost: number) => {
		setEquipmentCost(newCost);
		// Adjust loan amount if it exceeds the maximum allowed
		const maxByPercentage = newCost * MAX_FINANCING_PERCENTAGE;
		const maxLoanAmount = Math.min(maxByPercentage, MAX_LOAN_AMOUNT);
		if (loanAmount > maxLoanAmount) {
			setLoanAmount(Math.floor(maxLoanAmount));
		}
	};

	const calculateOriginationFee = () => {
		return loanAmount * ORIGINATION_FEE_RATE;
	};

	const calculateLegalFee = () => {
		return loanAmount * LEGAL_FEE_RATE;
	};

	const calculateTotalFees = () => {
		return calculateOriginationFee() + calculateLegalFee();
	};

	const calculateMonthlyPayment = () => {
		const monthlyInterest = loanAmount * INTEREST_RATE; // 1% of initial principal
		const totalInterest = monthlyInterest * loanTerm;
		const totalRepayment = loanAmount + totalInterest;
		return totalRepayment / loanTerm;
	};

	const generateChartData = () => {
		const monthlyPayment = calculateMonthlyPayment();
		const monthlyInterest = loanAmount * INTEREST_RATE;
		const data = [];
		let remainingBalance = loanAmount;

		// Start with Month 0 showing full amount
		data.push({
			month: 0,
			balance: remainingBalance,
		});

		// Generate data for months 1 through loanTerm with equal payments
		for (let month = 1; month <= loanTerm; month++) {
			// Add fixed interest and subtract payment
			remainingBalance =
				remainingBalance + monthlyInterest - monthlyPayment;
			remainingBalance = Math.max(0, remainingBalance);

			data.push({
				month,
				balance: remainingBalance,
			});
		}
		return data;
	};

	return (
		<main className="min-h-screen bg-white dark:bg-white">
			<Navbar bgStyle="bg-[#0A0612] dark:bg-[#0A0612]" />

			{/* Hero Section */}
			<section className="relative min-h-screen bg-[#0A0612] dark:bg-[#0A0612] pt-16">
				{/* Decorative Elements */}
				<div className="absolute inset-0 overflow-hidden">
					<div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
					<div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
					<div className="absolute top-40 left-40 w-80 h-80 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
				</div>

				{/* Content */}
				<div className="relative min-h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
					<div className="h-full flex flex-col">
						<div className="flex-1 flex flex-col lg:flex-row items-center gap-12">
							{/* Left Column */}
							<div className="flex-1 text-center lg:text-left">
								<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-white dark:text-white">
									<span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
										Equipment Financing
									</span>
								</h1>
								<p className="text-2xl sm:text-3xl text-emerald-200 dark:text-emerald-200 mb-8">
									Grow Your Business with Smart Financing
								</p>

								<div className="flex gap-4 justify-center lg:justify-start mb-8">
									<Link
										href="/apply"
										className="bg-white text-emerald-900 px-4 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold hover:bg-emerald-50 transition-all"
									>
										Apply Now
									</Link>
									<Link
										href="#how-it-works"
										className="border-2 border-white text-white px-4 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold hover:bg-white/10 transition-colors flex items-center"
									>
										How It Works
										<svg
											className="ml-2 w-4 h-4 sm:w-5 sm:h-5"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 9l-7 7-7-7"
											/>
										</svg>
									</Link>
								</div>

								<p className="text-2xl text-gray-300 dark:text-gray-300 mb-8 max-w-2xl mx-auto lg:mx-0">
									Finance your business equipment with
									flexible terms and competitive rates.
								</p>

								{/* Benefits Grid */}
								<div className="grid grid-cols-2 gap-4 mb-8 lg:mb-0">
									<div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
										<h3 className="text-base lg:text-lg font-semibold text-white dark:text-white mb-2">
											Fast Approval
										</h3>
										<p className="text-sm lg:text-base text-gray-300 dark:text-gray-300">
											Get approved within 3 business days
										</p>
									</div>
									<div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
										<h3 className="text-base lg:text-lg font-semibold text-white dark:text-white mb-2">
											Flexible Terms
										</h3>
										<p className="text-sm lg:text-base text-gray-300 dark:text-gray-300">
											6 to 24 months repayment options
										</p>
									</div>
									<div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
										<h3 className="text-base lg:text-lg font-semibold text-white dark:text-white mb-2">
											High Limits
										</h3>
										<p className="text-sm lg:text-base text-gray-300 dark:text-gray-300">
											Up to RM 500,000 financing available
										</p>
									</div>
									<div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
										<h3 className="text-base lg:text-lg font-semibold text-white dark:text-white mb-2">
											Competitive Rates
										</h3>
										<p className="text-sm lg:text-base text-gray-300 dark:text-gray-300">
											As low as 1% monthly interest
										</p>
									</div>
								</div>
							</div>

							{/* Right Column - Image */}
							<div className="flex-1 hidden lg:block">
								<Image
									src="/equipment.svg"
									alt="Equipment Financing"
									width={600}
									height={600}
									className="object-contain"
								/>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Main Content */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
				{/* Equipment Types Section */}
				<div className="mb-16">
					<div className="text-center mb-12">
						<h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-black">
							Equipment We Finance
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							From medical equipment to industrial machinery, we
							finance a wide range of business equipment
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
						{/* Medical & Dental */}
						<div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 transition-all hover:shadow-lg">
							<h3 className="text-xl font-semibold mb-4 text-emerald-800">
								Medical & Dental Equipment
							</h3>
							<ul className="space-y-2 text-gray-600">
								<li>• Dental Chairs & Units</li>
								<li>• X-Ray Machines</li>
								<li>• Diagnostic Equipment</li>
								<li>• Sterilization Equipment</li>
								<li>• Medical Imaging Systems</li>
							</ul>
						</div>

						{/* Manufacturing */}
						<div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 transition-all hover:shadow-lg">
							<h3 className="text-xl font-semibold mb-4 text-emerald-800">
								Manufacturing Equipment
							</h3>
							<ul className="space-y-2 text-gray-600">
								<li>• CNC Machines</li>
								<li>• 3D Printers</li>
								<li>• Production Line Equipment</li>
								<li>• Industrial Robots</li>
								<li>• Packaging Machines</li>
							</ul>
						</div>

						{/* Optical */}
						<div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 transition-all hover:shadow-lg">
							<h3 className="text-xl font-semibold mb-4 text-emerald-800">
								Optical Equipment
							</h3>
							<ul className="space-y-2 text-gray-600">
								<li>• Eye Testing Equipment</li>
								<li>• Lens Edging Machines</li>
								<li>• Auto Refractors</li>
								<li>• Slit Lamps</li>
								<li>• Optical Dispensing Tools</li>
							</ul>
						</div>

						{/* Beauty & Wellness */}
						<div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 transition-all hover:shadow-lg">
							<h3 className="text-xl font-semibold mb-4 text-emerald-800">
								Beauty & Wellness Equipment
							</h3>
							<ul className="space-y-2 text-gray-600">
								<li>• Laser Treatment Machines</li>
								<li>• Facial Treatment Equipment</li>
								<li>• Hair Removal Systems</li>
								<li>• Body Contouring Devices</li>
								<li>• Spa & Massage Equipment</li>
							</ul>
						</div>

						{/* Office & IT */}
						<div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 transition-all hover:shadow-lg">
							<h3 className="text-xl font-semibold mb-4 text-emerald-800">
								Office & IT Equipment
							</h3>
							<ul className="space-y-2 text-gray-600">
								<li>• Computer Systems</li>
								<li>• Servers & Networking</li>
								<li>• Printing Equipment</li>
								<li>• Video Conferencing Systems</li>
								<li>• Office Automation Tools</li>
							</ul>
						</div>

						{/* And More */}
						<div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-6 transition-all hover:shadow-lg">
							<h3 className="text-xl font-semibold mb-4 text-gray-800">
								And More
							</h3>
							<p className="text-gray-600 mb-4">
								These are just examples of equipment we commonly
								finance. Contact us to discuss your specific
								equipment needs - we&apos;re flexible and open
								to financing various types of business
								equipment.
							</p>
							<Link
								href="/apply"
								className="inline-block text-gray-600 hover:text-gray-700 font-semibold"
							>
								Discuss Your Requirements →
							</Link>
						</div>
					</div>
				</div>

				{/* How It Works Section */}
				<div id="how-it-works" className="mb-16 scroll-mt-20">
					<div className="text-center mb-12">
						<h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-black">
							How Equipment Financing Works
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							A simple and transparent process to finance your
							business equipment
						</p>
					</div>

					<div className="grid md:grid-cols-2 gap-12">
						{/* Process Steps */}
						<div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 transition-all duration-300">
							<div className="space-y-6">
								<div className="flex items-start gap-4 group cursor-pointer hover:bg-white rounded-xl p-4 transition-all">
									<div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-all">
										<span className="text-emerald-600 font-semibold group-hover:text-white">
											1
										</span>
									</div>
									<div>
										<h4 className="text-lg font-semibold mb-1 text-black dark:text-black">
											Submit Application
										</h4>
										<p className="text-gray-600 dark:text-gray-600">
											Complete our simple online
											application with your business
											details and equipment requirements.
										</p>
									</div>
								</div>

								<div className="flex items-start gap-4 group cursor-pointer hover:bg-white rounded-xl p-4 transition-all">
									<div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-all">
										<span className="text-emerald-600 font-semibold group-hover:text-white">
											2
										</span>
									</div>
									<div>
										<h4 className="text-lg font-semibold mb-1 text-black dark:text-black">
											Quick Assessment
										</h4>
										<p className="text-gray-600 dark:text-gray-600">
											We review your application and
											business financials within 3
											business days.
										</p>
									</div>
								</div>

								<div className="flex items-start gap-4 group cursor-pointer hover:bg-white rounded-xl p-4 transition-all">
									<div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-all">
										<span className="text-emerald-600 font-semibold group-hover:text-white">
											3
										</span>
									</div>
									<div>
										<h4 className="text-lg font-semibold mb-1 text-black dark:text-black">
											Equipment Purchase
										</h4>
										<p className="text-gray-600 dark:text-gray-600">
											Once approved, we finance the
											equipment purchase directly with
											your chosen supplier.
										</p>
									</div>
								</div>

								<div className="flex items-start gap-4 group cursor-pointer hover:bg-white rounded-xl p-4 transition-all">
									<div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-all">
										<span className="text-emerald-600 font-semibold group-hover:text-white">
											4
										</span>
									</div>
									<div>
										<h4 className="text-lg font-semibold mb-1 text-black dark:text-black">
											Easy Repayment
										</h4>
										<p className="text-gray-600 dark:text-gray-600">
											Make fixed monthly payments through
											automated bank transfers.
										</p>
									</div>
								</div>
							</div>
						</div>

						{/* Image Section */}
						<div className="relative rounded-3xl overflow-hidden h-[300px] md:h-[500px]">
							<Image
								src="/business.svg"
								alt="Equipment Financing Process"
								fill
								className="object-contain"
								sizes="(max-width: 768px) 100vw, 50vw"
							/>
						</div>
					</div>
				</div>

				{/* Benefits Section */}
				<div className="mt-24 mb-24">
					<div className="text-center mb-12">
						<h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-black">
							Benefits for SMEs
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							Smart financing solutions for your business growth
						</p>
					</div>

					<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
						<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
							<div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
								<svg
									className="w-8 h-8 text-emerald-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</div>
							<h4 className="text-xl font-semibold mb-3 text-black dark:text-black">
								Preserve Working Capital
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Keep your cash flow healthy by spreading
								equipment costs over time.
							</p>
						</div>

						<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
							<div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
								<svg
									className="w-8 h-8 text-emerald-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M13 10V3L4 14h7v7l9-11h-7z"
									/>
								</svg>
							</div>
							<h4 className="text-xl font-semibold mb-3 text-black dark:text-black">
								Quick Deployment
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Get your equipment quickly and start generating
								revenue immediately.
							</p>
						</div>

						<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
							<div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
								<svg
									className="w-8 h-8 text-emerald-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
									/>
								</svg>
							</div>
							<h4 className="text-xl font-semibold mb-3 text-black dark:text-black">
								Tax Benefits
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Potential tax advantages through equipment
								depreciation and interest deductions.
							</p>
						</div>

						<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
							<div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
								<svg
									className="w-8 h-8 text-emerald-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
									/>
								</svg>
							</div>
							<h4 className="text-xl font-semibold mb-3 text-black dark:text-black">
								Scalable Growth
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Expand your business capacity without large
								upfront investments.
							</p>
						</div>
					</div>
				</div>

				{/* Terms and Calculator Section */}
				<div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-4 sm:p-8 md:p-12">
					<div className="text-center mb-12">
						<h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-black">
							Loan Terms & Calculator
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							Calculate your monthly payments and see our
							transparent terms
						</p>
					</div>

					<div className="grid lg:grid-cols-3 gap-12">
						{/* Terms Section */}
						<div className="bg-white rounded-2xl p-8 shadow-lg">
							<h3 className="text-2xl font-bold mb-6 text-black dark:text-black">
								Terms and Details
							</h3>
							<div className="space-y-6">
								<div>
									<h4 className="font-semibold text-gray-700 dark:text-gray-700 mb-2">
										Loan Amount
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										Maximum: RM 500,000
									</p>
									<p className="text-gray-600 dark:text-gray-600 mt-1">
										Up to 60% of equipment value
									</p>
								</div>
								<div>
									<h4 className="font-semibold text-gray-700 dark:text-gray-700 mb-2">
										Interest Rate
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										1% per month
									</p>
								</div>

								<div>
									<h4 className="font-semibold text-gray-700 dark:text-gray-700 mb-2 flex items-center gap-2">
										Origination Fee
										<div className="relative group">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 cursor-help" />
											<div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
												Covers the cost of processing
												the loan application,
												underwriting, and funding the
												loan
												<div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
											</div>
										</div>
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										3% of loan amount
									</p>
								</div>
								<div>
									<h4 className="font-semibold text-gray-700 dark:text-gray-700 mb-2 flex items-center gap-2">
										Legal Fees
										<div className="relative group">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 cursor-help" />
											<div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
												Covers the cost of legal
												documentation, stamp duties, and
												other regulatory requirements
												<div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
											</div>
										</div>
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										2% of loan amount
									</p>
								</div>
								<div>
									<h4 className="font-semibold text-gray-700 dark:text-gray-700 mb-2 flex items-center gap-2">
										Late Payment Fee
										<div className="relative group">
											<InformationCircleIcon className="h-4 w-4 text-gray-500 cursor-help" />
											<div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
												Additional interest charged on
												overdue amount
												<div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
											</div>
										</div>
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										0.5% per day on amount in arrears
									</p>
								</div>
								<div>
									<h4 className="font-semibold text-gray-700 dark:text-gray-700 mb-2">
										Repayment Terms
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										6, 12, 18, or 24 months
									</p>
								</div>
								<div>
									<h4 className="font-semibold text-gray-700 dark:text-gray-700 mb-2">
										Eligibility
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										Registered businesses with minimum 1
										year of operation
									</p>
								</div>
							</div>
						</div>

						{/* Calculator Section - spans 2 columns */}
						<div className="lg:col-span-2">
							<div className="space-y-8">
								<div>
									<label className="block text-lg font-medium text-gray-700 dark:text-gray-700 mb-2">
										Equipment Cost: RM{" "}
										{equipmentCost.toLocaleString()}
									</label>
									<input
										type="range"
										min="20000"
										max="1000000"
										step="10000"
										value={equipmentCost}
										onChange={(e) =>
											handleEquipmentCostChange(
												Number(e.target.value)
											)
										}
										className="w-full h-4 rounded-lg appearance-none cursor-pointer bg-emerald-200 hover:bg-emerald-300"
									/>
									<div className="flex justify-between text-xs text-gray-500 dark:text-gray-500 mt-1">
										<span>RM 20,000</span>
										<span>RM 1,000,000</span>
									</div>
								</div>
								<div>
									<label className="block text-lg font-medium text-gray-700 dark:text-gray-700 mb-2">
										Loan Amount: RM{" "}
										{loanAmount.toLocaleString()}
										<span className="text-sm text-gray-500 ml-2">
											(Max: RM{" "}
											{Math.min(
												equipmentCost *
													MAX_FINANCING_PERCENTAGE,
												MAX_LOAN_AMOUNT
											).toLocaleString()}{" "}
											- 60% of equipment cost, capped at
											RM 500,000)
										</span>
									</label>
									<input
										type="range"
										min="10000"
										max={Math.min(
											equipmentCost *
												MAX_FINANCING_PERCENTAGE,
											MAX_LOAN_AMOUNT
										)}
										step="1000"
										value={loanAmount}
										onChange={(e) =>
											setLoanAmount(
												Number(e.target.value)
											)
										}
										className="w-full h-4 rounded-lg appearance-none cursor-pointer bg-emerald-200 hover:bg-emerald-300"
									/>
									<div className="flex justify-between text-xs text-gray-500 dark:text-gray-500 mt-1">
										<span>RM 10,000</span>
										<span>
											RM{" "}
											{Math.min(
												equipmentCost *
													MAX_FINANCING_PERCENTAGE,
												MAX_LOAN_AMOUNT
											).toLocaleString()}
										</span>
									</div>
								</div>
								<div>
									<label className="block text-lg font-medium text-gray-700 dark:text-gray-700 mb-2">
										Loan Term
									</label>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
										{[6, 12, 18, 24].map((term) => (
											<button
												key={term}
												onClick={() =>
													setLoanTerm(term)
												}
												className={`py-3 rounded-lg font-medium transition-all ${
													loanTerm === term
														? "bg-emerald-600 text-white"
														: "bg-white text-gray-600 hover:bg-gray-50"
												}`}
											>
												{term} Months
											</button>
										))}
									</div>
								</div>
							</div>
							<div className="mt-8">
								<div className="flex justify-between items-start mb-6">
									<div>
										<h3 className="text-2xl font-semibold mb-3 text-black dark:text-black">
											Monthly Payment
										</h3>
										<div className="text-5xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mt-2">
											RM{" "}
											{calculateMonthlyPayment().toLocaleString(
												undefined,
												{
													minimumFractionDigits: 2,
													maximumFractionDigits: 2,
												}
											)}
										</div>
									</div>
								</div>
								<div className="space-y-4 mb-8">
									<div className="flex items-center justify-between text-sm">
										<span className="text-gray-600 dark:text-gray-600">
											Origination Fee
										</span>
										<span className="font-medium text-gray-700 dark:text-gray-700">
											RM{" "}
											{calculateOriginationFee().toLocaleString(
												undefined,
												{
													minimumFractionDigits: 2,
													maximumFractionDigits: 2,
												}
											)}
										</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-gray-600 dark:text-gray-600">
											Legal Fee
										</span>
										<span className="font-medium text-gray-700 dark:text-gray-700">
											RM{" "}
											{calculateLegalFee().toLocaleString(
												undefined,
												{
													minimumFractionDigits: 2,
													maximumFractionDigits: 2,
												}
											)}
										</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-gray-600 dark:text-gray-600">
											Net Disbursement
										</span>
										<span className="font-medium text-gray-700 dark:text-gray-700">
											RM{" "}
											{(
												loanAmount -
												calculateTotalFees()
											).toLocaleString(undefined, {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2,
											})}
										</span>
									</div>
								</div>
								<div className="h-48 mb-8">
									<ResponsiveContainer
										width="100%"
										height="100%"
									>
										<LineChart
											data={generateChartData()}
											margin={{
												top: 5,
												right: 5,
												bottom: 5,
												left: 5,
											}}
										>
											<CartesianGrid
												strokeDasharray="3 3"
												stroke="#E5E7EB"
											/>
											<XAxis
												dataKey="month"
												label={{
													value: "Months",
													position: "bottom",
													style: {
														fill: "#000000",
														fontWeight: "500",
													},
												}}
												tick={{
													fontSize: 12,
													fill: "#000000",
												}}
											/>
											<YAxis
												label={{
													value: "Amount (RM)",
													angle: -90,
													position: "insideLeft",
													style: {
														textAnchor: "middle",
													},
												}}
												tick={{ fontSize: 12 }}
												tickFormatter={(value) =>
													`${(value / 1000).toFixed(
														0
													)}k`
												}
											/>
											<Tooltip
												formatter={(value: number) => [
													`RM ${Number(
														value
													).toLocaleString()}`,
													"Balance",
												]}
												labelFormatter={(label) =>
													`Month ${label}`
												}
											/>
											<Line
												type="monotone"
												dataKey="balance"
												stroke="#059669"
												strokeWidth={2}
												dot={false}
											/>
										</LineChart>
									</ResponsiveContainer>
								</div>
								<Link
									href="/apply"
									className="block w-full text-center bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-6 py-3 rounded-full font-semibold transition-all"
								>
									Apply Now
								</Link>
							</div>
						</div>
					</div>
				</div>

				{/* Required Documents Section */}
				<div className="mt-24 mb-24">
					<div className="text-center mb-12">
						<h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-black">
							Required Documents
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							Please prepare these documents to speed up your
							application process
						</p>
					</div>

					<div className="grid md:grid-cols-3 gap-8">
						<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
							<div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
								<svg
									className="w-8 h-8 text-emerald-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
									/>
								</svg>
							</div>
							<h4 className="text-xl font-semibold mb-4 text-black dark:text-black">
								Identity Documents
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Copy of all Director(s) NRIC/Passport
							</p>
						</div>

						<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
							<div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
								<svg
									className="w-8 h-8 text-emerald-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
									/>
								</svg>
							</div>
							<h4 className="text-xl font-semibold mb-4 text-black dark:text-black">
								Company Information
							</h4>
							<ul className="text-gray-600 dark:text-gray-600 space-y-2">
								<li>• Form 9</li>
								<li>• Business Registration (SSM)</li>
							</ul>
						</div>

						<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
							<div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
								<svg
									className="w-8 h-8 text-emerald-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
									/>
								</svg>
							</div>
							<h4 className="text-xl font-semibold mb-4 text-black dark:text-black">
								Bank Statements
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Latest 3 months bank statements
							</p>
						</div>

						<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
							<div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
								<svg
									className="w-8 h-8 text-emerald-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
							</div>
							<h4 className="text-xl font-semibold mb-4 text-black dark:text-black">
								Financial Statements
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Latest Audited Accounts & Management Accounts
							</p>
						</div>

						<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
							<div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
								<svg
									className="w-8 h-8 text-emerald-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
							</div>
							<h4 className="text-xl font-semibold mb-4 text-black dark:text-black">
								Equipment Documentation
							</h4>
							<ul className="text-gray-600 dark:text-gray-600 space-y-2">
								<li>• Equipment Quotation, or</li>
								<li>• Purchase Order (PO), or</li>
								<li>• Supplier Invoice</li>
							</ul>
						</div>
					</div>
				</div>

				{/* FAQ Section */}
				<div className="mt-24 bg-white rounded-3xl p-4 sm:p-8 md:p-12">
					<div className="text-center mb-12">
						<h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-black">
							Frequently Asked Questions
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							Everything you need to know about Equipment
							Financing
						</p>
					</div>

					<div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
						<div className="bg-emerald-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-emerald-900 dark:text-emerald-900">
								What types of equipment can I finance?
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								We finance a wide range of business equipment
								including machinery, vehicles, office equipment,
								and technology infrastructure.
							</p>
						</div>

						<div className="bg-emerald-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-emerald-900 dark:text-emerald-900">
								How much can I borrow?
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								You can finance up to RM 500,000 worth of
								equipment, subject to business qualification and
								equipment valuation.
							</p>
						</div>

						<div className="bg-emerald-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-emerald-900 dark:text-emerald-900">
								What documents do I need?
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Required documents include business
								registration, financial statements, bank
								statements, and equipment quotation from
								supplier.
							</p>
						</div>

						<div className="bg-emerald-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-emerald-900 dark:text-emerald-900">
								How long is the approval process?
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Most applications are approved within 3 business
								days, with funding disbursed directly to
								suppliers within 1-2 days after approval.
							</p>
						</div>

						<div className="bg-emerald-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-emerald-900 dark:text-emerald-900">
								What happens to the equipment if I default?
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								The equipment serves as collateral for the loan.
								In case of default, we may repossess the
								equipment after proper notice and process.
							</p>
						</div>

						<div className="bg-emerald-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-emerald-900 dark:text-emerald-900">
								Can I pay off the loan early?
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Yes, you can make early repayments without any
								penalty. This can help reduce your total
								interest costs.
							</p>
						</div>

						<div className="bg-emerald-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-emerald-900 dark:text-emerald-900">
								Is the equipment insured?
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Yes, equipment must be insured throughout the
								financing period. We can help arrange insurance
								if needed.
							</p>
						</div>

						<div className="bg-emerald-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-emerald-900 dark:text-emerald-900">
								What happens at the end of the term?
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Once all payments are completed, you own the
								equipment outright. We&apos;ll release all liens
								and provide necessary documentation.
							</p>
						</div>
					</div>
				</div>
			</div>

			<Footer />
		</main>
	);
}
