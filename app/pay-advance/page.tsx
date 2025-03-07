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
	Legend,
} from "recharts";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function EmployeeMicroLoan() {
	const [loanAmount, setLoanAmount] = useState(1000);
	const [loanTerm, setLoanTerm] = useState(6);
	const [monthlySalary, setMonthlySalary] = useState(1700);
	const [activeView, setActiveView] = useState<"employee" | "employer">(
		"employee"
	);

	const INTEREST_RATE = 0.015; // 1.5% per month
	const ORIGINATION_FEE_RATE = 0.03; // 3%
	const LEGAL_FEE_RATE = 0.02; // 2%

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
		const monthlyInterest = loanAmount * INTEREST_RATE; // 1.5% of initial principal
		const totalInterest = monthlyInterest * loanTerm;
		const totalRepayment = loanAmount + totalInterest;
		return totalRepayment / loanTerm;
	};

	const generateChartData = () => {
		const monthlyPayment = calculateMonthlyPayment();
		const monthlyInterest = loanAmount * INTEREST_RATE; // 1.5% of initial principal
		const data = [];
		let remainingBalance = loanAmount;

		// Start with Month 0 showing full amount
		data.push({
			month: 0,
			balance: remainingBalance,
			availableCredit: Math.max(0, monthlySalary - remainingBalance),
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
				availableCredit: Math.max(0, monthlySalary - remainingBalance),
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
					<div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
					<div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
					<div className="absolute top-40 left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
				</div>

				{/* Content */}
				<div className="relative min-h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
					<div className="h-full flex flex-col">
						<div className="flex-1 flex flex-col lg:flex-row items-center gap-12">
							{/* Left Column */}
							<div className="flex-1 text-center lg:text-left">
								<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-white dark:text-white">
									<span className="bg-gradient-to-r from-purple-300 to-indigo-300 bg-clip-text text-transparent">
										PayAdvance™
									</span>
								</h1>
								<p className="text-2xl sm:text-3xl text-purple-200 dark:text-purple-200 mb-8">
									Your Pay, Your Way
								</p>

								<div className="flex gap-4 justify-center lg:justify-start mb-8">
									<Link
										href="/apply"
										className="bg-white text-purple-900 px-4 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold hover:bg-purple-50 transition-all"
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
									Access instant salary advances with low
									interest. Manage unexpected expenses with
									confidence.
								</p>

								{/* Benefits Grid */}
								<div className="grid grid-cols-2 gap-4 mb-8 lg:mb-0">
									<div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
										<h3 className="text-base lg:text-lg font-semibold text-white dark:text-white mb-2">
											Quick Access
										</h3>
										<p className="text-sm lg:text-base text-gray-300 dark:text-gray-300">
											Apply in minutes, get approved in
											hours
										</p>
									</div>
									<div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
										<h3 className="text-base lg:text-lg font-semibold text-white dark:text-white mb-2">
											Low Interest
										</h3>
										<p className="text-sm lg:text-base text-gray-300 dark:text-gray-300">
											Only up to 1.5% monthly
										</p>
									</div>
									<div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
										<h3 className="text-base lg:text-lg font-semibold text-white dark:text-white mb-2">
											Easy Repayment
										</h3>
										<p className="text-sm lg:text-base text-gray-300 dark:text-gray-300">
											Automatically deducted from your
											salary
										</p>
									</div>
									<div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
										<h3 className="text-base lg:text-lg font-semibold text-white dark:text-white mb-2">
											Quick Processing
										</h3>
										<p className="text-sm lg:text-base text-gray-300 dark:text-gray-300">
											Approval within minutes
										</p>
									</div>
								</div>
							</div>

							{/* Right Column - Image */}
							<div className="flex-1 hidden lg:block">
								<Image
									src="/happy.svg"
									alt="PayAdvance™ Employee Micro Loan"
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
				{/* How It Works Section */}
				<div id="how-it-works" className="mb-16 scroll-mt-20">
					<div className="text-center mb-12">
						<h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-black">
							How PayAdvance™ Works
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							A simple and transparent process for both employees
							and employers
						</p>

						{/* View Switcher */}
						<div className="flex justify-center gap-4 mt-8">
							<button
								onClick={() => setActiveView("employee")}
								className={`px-8 py-3 rounded-full font-semibold transition-all ${
									activeView === "employee"
										? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
										: "bg-white text-gray-600 dark:text-gray-600 hover:bg-gray-50 border border-gray-200"
								}`}
							>
								For Employees
							</button>
							<button
								onClick={() => setActiveView("employer")}
								className={`px-8 py-3 rounded-full font-semibold transition-all ${
									activeView === "employer"
										? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg"
										: "bg-white text-gray-600 dark:text-gray-600 hover:bg-gray-50 border border-gray-200"
								}`}
							>
								For Employers
							</button>
						</div>
					</div>

					<div className="grid md:grid-cols-2 gap-12">
						{/* Process Steps */}
						<div
							className={`${
								activeView === "employee"
									? "bg-gradient-to-br from-purple-50 to-indigo-50"
									: "bg-gradient-to-br from-emerald-50 to-teal-50"
							} rounded-3xl p-8 transition-all duration-300`}
						>
							<div className="flex items-center gap-4 mb-6">
								<div
									className={`w-12 h-12 ${
										activeView === "employee"
											? "bg-purple-100"
											: "bg-emerald-100"
									} rounded-full flex items-center justify-center`}
								>
									<svg
										className={`w-6 h-6 ${
											activeView === "employee"
												? "text-purple-600"
												: "text-emerald-600"
										}`}
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										{activeView === "employee" ? (
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
											/>
										) : (
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
											/>
										)}
									</svg>
								</div>
								<h3
									className={`text-2xl font-bold ${
										activeView === "employee"
											? "text-purple-900 dark:text-purple-900"
											: "text-emerald-900 dark:text-emerald-900"
									}`}
								>
									{activeView === "employee"
										? "For Employees"
										: "For Employers"}
								</h3>
							</div>

							<div className="space-y-6">
								{activeView === "employee" ? (
									<>
										{/* Employee Steps */}
										<div className="flex items-start gap-4 group cursor-pointer hover:bg-white rounded-xl p-4 transition-all">
											<div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 transition-all">
												<span className="text-purple-600 font-semibold group-hover:text-white">
													1
												</span>
											</div>
											<div>
												<h4 className="text-lg font-semibold mb-1 text-black dark:text-black">
													Apply Through Your Employer
												</h4>
												<p className="text-gray-600 dark:text-gray-600">
													Access the loan application
													through the Kapital
													platform. Apply in minutes.
												</p>
											</div>
										</div>
										<div className="flex items-start gap-4 group cursor-pointer hover:bg-white rounded-xl p-4 transition-all">
											<div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 transition-all">
												<span className="text-purple-600 font-semibold group-hover:text-white">
													2
												</span>
											</div>
											<div>
												<h4 className="text-lg font-semibold mb-1 text-black dark:text-black">
													Quick Approval
												</h4>
												<p className="text-gray-600 dark:text-gray-600">
													Get approved within 24 hours
													with minimal documentation
													required.
												</p>
											</div>
										</div>
										<div className="flex items-start gap-4 group cursor-pointer hover:bg-white rounded-xl p-4 transition-all">
											<div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 transition-all">
												<span className="text-purple-600 font-semibold group-hover:text-white">
													3
												</span>
											</div>
											<div>
												<h4 className="text-lg font-semibold mb-1 text-black dark:text-black">
													Receive Funds
												</h4>
												<p className="text-gray-600 dark:text-gray-600">
													Funds are disbursed directly
													to your bank account within
													1-2 business days.
												</p>
											</div>
										</div>
										<div className="flex items-start gap-4 group cursor-pointer hover:bg-white rounded-xl p-4 transition-all">
											<div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 transition-all">
												<span className="text-purple-600 font-semibold group-hover:text-white">
													4
												</span>
											</div>
											<div>
												<h4 className="text-lg font-semibold mb-1 text-black dark:text-black">
													Automatic Repayment
												</h4>
												<p className="text-gray-600 dark:text-gray-600">
													Repayments are automatically
													deducted from your monthly
													salary.
												</p>
											</div>
										</div>
									</>
								) : (
									<>
										{/* Employer Steps */}
										<div className="flex items-start gap-4 group cursor-pointer hover:bg-white rounded-xl p-4 transition-all">
											<div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-all">
												<span className="text-emerald-600 font-semibold group-hover:text-white">
													1
												</span>
											</div>
											<div>
												<h4 className="text-lg font-semibold mb-1 text-black dark:text-black">
													Partner With Us
												</h4>
												<p className="text-gray-600 dark:text-gray-600">
													Simple integration with the
													Kapital platform at no cost
													to you.
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
													Employee Verification
												</h4>
												<p className="text-gray-600">
													Quick verification of
													employment status and salary
													information.
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
													Automated Deductions
												</h4>
												<p className="text-gray-600">
													Seamless integration with
													your payroll for automatic
													loan repayments.
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
													Dashboard Access
												</h4>
												<p className="text-gray-600">
													Monitor employee loans and
													repayments through our
													employer portal.
												</p>
											</div>
										</div>
									</>
								)}
							</div>
						</div>

						{/* Image Section */}
						<div className="relative rounded-3xl overflow-hidden h-[300px] md:h-[500px]">
							<Image
								src={
									activeView === "employee"
										? "/freedom.svg"
										: "/deal.svg"
								}
								alt={
									activeView === "employee"
										? "Employee using the platform"
										: "Employer dashboard"
								}
								fill
								className="object-contain"
								sizes="(max-width: 768px) 100vw, 50vw"
							/>
						</div>
					</div>

					{/* Benefits Section */}
					<div className="mt-24 mb-24">
						<div className="text-center mb-12">
							<h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-black">
								Benefits for Everyone
							</h2>
							<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
								A win-win solution for both employees and
								employers
							</p>
						</div>

						<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
							<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
								<div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-6">
									<svg
										className="w-8 h-8 text-purple-600"
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
									Zero Cost Implementation
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									Free setup and maintenance of the loan
									program, with no hidden charges or
									operational costs.
								</p>
							</div>

							<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
								<div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-6">
									<svg
										className="w-8 h-8 text-purple-600"
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
									Streamlined Administration
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									All loan applications and disbursements are
									managed automatically from the Kapital
									platform.
								</p>
							</div>

							<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
								<div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-6">
									<svg
										className="w-8 h-8 text-purple-600"
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
									Improved Cash Flow
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									Maintain better business liquidity by
									eliminating the need for company-funded
									salary advances.
								</p>
							</div>

							<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
								<div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-6">
									<svg
										className="w-8 h-8 text-purple-600"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								</div>
								<h4 className="text-xl font-semibold mb-3 text-black dark:text-black">
									Enhanced Employee Satisfaction
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									Boost workplace morale by providing
									financial support without the stress of
									traditional loans.
								</p>
							</div>
						</div>
					</div>

					{/* Terms and Calculator Section */}
					<div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-3xl p-4 sm:p-8 md:p-12">
						<div className="text-center mb-12">
							<h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-black">
								Loan Terms & Calculator
							</h2>
							<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
								Transparent terms and instant calculations to
								help you plan your loan
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
											Minimum: RM 1,000
											<br />
											Maximum: Up to 1 month&apos;s gross
											salary
										</p>
									</div>
									<div>
										<h4 className="font-semibold text-gray-700 dark:text-gray-700 mb-2">
											Interest Rate
										</h4>
										<p className="text-gray-600 dark:text-gray-600">
											1.5% per month
										</p>
									</div>
									<div>
										<h4 className="font-semibold text-gray-700 dark:text-gray-700 mb-2 flex items-center gap-2">
											Origination Fee
											<div className="relative group">
												<InformationCircleIcon className="h-4 w-4 text-gray-500 cursor-help" />
												<div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
													Covers the cost of
													processing the loan
													application, underwriting,
													and funding the loan
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
													documentation, stamp duties,
													and other regulatory
													requirements
													<div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
												</div>
											</div>
										</h4>
										<p className="text-gray-600 dark:text-gray-600">
											2% of loan amount
										</p>
									</div>
									<div>
										<h4 className="font-semibold text-gray-700 dark:text-gray-700 mb-2">
											Late Payment Fee
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
											6 or 12 months
										</p>
									</div>
									<div>
										<h4 className="font-semibold text-gray-700 dark:text-gray-700 mb-2">
											Eligibility
										</h4>
										<p className="text-gray-600 dark:text-gray-600">
											Full-time employees of partner
											companies
										</p>
									</div>
								</div>
							</div>

							{/* Calculator Section - spans 2 columns */}
							<div className="lg:col-span-2">
								<div className="space-y-8">
									<div>
										<label className="block text-lg font-medium text-gray-700 dark:text-gray-700 mb-2">
											Monthly Salary: RM{" "}
											{monthlySalary.toLocaleString()}
										</label>
										<input
											type="range"
											min="1700"
											max="20000"
											step="100"
											value={monthlySalary}
											onChange={(e) => {
												const newSalary = Number(
													e.target.value
												);
												setMonthlySalary(newSalary);
												setLoanAmount(
													Math.min(
														loanAmount,
														newSalary
													)
												);
											}}
											className="w-full h-4 rounded-lg appearance-none cursor-pointer bg-purple-200 hover:bg-purple-300"
										/>
										<div className="flex justify-between text-xs text-gray-500 dark:text-gray-500 mt-1">
											<span>RM 1,700</span>
											<span>RM 20,000</span>
										</div>
									</div>
									<div>
										<label className="block text-lg font-medium text-gray-700 dark:text-gray-700 mb-2">
											Loan Amount: RM{" "}
											{loanAmount.toLocaleString()}
										</label>
										<input
											type="range"
											min="1000"
											max={monthlySalary}
											step="100"
											value={loanAmount}
											onChange={(e) =>
												setLoanAmount(
													Number(e.target.value)
												)
											}
											className="w-full h-4 rounded-lg appearance-none cursor-pointer bg-purple-200 hover:bg-purple-300"
										/>
										<div className="flex justify-between text-xs text-gray-500 dark:text-gray-500 mt-1">
											<span>RM 1,000</span>
											<span>
												RM{" "}
												{monthlySalary.toLocaleString()}
											</span>
										</div>
									</div>
									<div>
										<label className="block text-lg font-medium text-gray-700 dark:text-gray-700 mb-2">
											Loan Term
										</label>
										<div className="flex gap-4">
											<button
												onClick={() => setLoanTerm(6)}
												className={`flex-1 py-3 rounded-lg font-medium transition-all ${
													loanTerm === 6
														? "bg-purple-600 text-white dark:bg-purple-600 dark:text-white"
														: "bg-white text-gray-600 dark:text-gray-600 hover:bg-gray-50"
												}`}
											>
												6 Months
											</button>
											<button
												onClick={() => setLoanTerm(12)}
												className={`flex-1 py-3 rounded-lg font-medium transition-all ${
													loanTerm === 12
														? "bg-purple-600 text-white dark:bg-purple-600 dark:text-white"
														: "bg-white text-gray-600 dark:text-gray-600 hover:bg-gray-50"
												}`}
											>
												12 Months
											</button>
										</div>
									</div>
								</div>
								<div className="mt-8">
									<div className="flex justify-between items-start mb-6">
										<div>
											<h3 className="text-2xl font-semibold mb-3 text-black dark:text-black">
												Monthly Payment
											</h3>
											<div className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mt-2">
												RM{" "}
												{calculateMonthlyPayment().toFixed(
													2
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
												{calculateOriginationFee().toFixed(
													2
												)}
											</span>
										</div>
										<div className="flex items-center justify-between text-sm">
											<span className="text-gray-600 dark:text-gray-600">
												Legal Fee
											</span>
											<span className="font-medium text-gray-700 dark:text-gray-700">
												RM{" "}
												{calculateLegalFee().toFixed(2)}
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
												).toFixed(2)}
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
															textAnchor:
																"middle",
														},
													}}
													tick={{ fontSize: 12 }}
													tickFormatter={(value) =>
														`${(
															value / 1000
														).toFixed(0)}k`
													}
												/>
												<Tooltip
													formatter={(
														value: number
													) => [
														`RM ${Number(
															value
														).toLocaleString()}`,
														undefined,
													]}
													labelFormatter={(label) =>
														`Month ${label}`
													}
												/>
												<Legend
													verticalAlign="top"
													height={36}
													formatter={(value) => {
														return value ===
															"balance"
															? "Outstanding Balance"
															: "Credit Limit";
													}}
												/>
												<Line
													type="monotone"
													dataKey="balance"
													stroke="#7C3AED"
													strokeWidth={2}
													name="balance"
													dot={false}
												/>
												<Line
													type="monotone"
													dataKey="availableCredit"
													stroke="#10B981"
													strokeWidth={2}
													name="Credit Limit"
													dot={false}
												/>
											</LineChart>
										</ResponsiveContainer>
									</div>
									<Link
										href="/apply"
										className="block w-full text-center bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white dark:text-white px-6 py-3 rounded-full font-semibold transition-all"
									>
										Apply Now
									</Link>
								</div>
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
								Everything you need to know about PayAdvance™
							</p>
						</div>

						<div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
							<div className="bg-purple-50 rounded-2xl p-8">
								<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
									How does PayAdvance™ work?
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									PayAdvance™ is a salary advance program that
									allows you to access a portion of your
									salary early. The amount is automatically
									repaid through salary deductions over 6 or
									12 months.
								</p>
							</div>

							<div className="bg-purple-50 rounded-2xl p-8">
								<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
									How much can I borrow?
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									You can borrow between RM 1,000 and up to
									one month&apos;s gross salary, subject to
									eligibility and approval.
								</p>
							</div>

							<div className="bg-purple-50 rounded-2xl p-8">
								<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
									What happens if I leave my job?
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									The outstanding loan amount will be deducted
									from your notice period pay. If this is
									insufficient, you&apos;ll need to arrange an
									alternative repayment plan with us.
								</p>
							</div>

							<div className="bg-purple-50 rounded-2xl p-8">
								<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
									Are there any hidden fees?
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									No hidden fees. You only pay the processing
									fee (7.5%) and monthly interest (1.5%).
								</p>
							</div>

							<div className="bg-purple-50 rounded-2xl p-8">
								<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
									Why do you charge a processing fee?{" "}
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									This is to cover the cost of loan processing
									including, but not limited to credit checks,
									stamp duty, legal fees, and other
									administrative costs.
								</p>
							</div>

							<div className="bg-purple-50 rounded-2xl p-8">
								<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
									How long does approval take?
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									Most applications are approved within 24
									hours, with funds disbursed within 1-2
									business days after approval.
								</p>
							</div>

							<div className="bg-purple-50 rounded-2xl p-8">
								<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
									Can I repay early?
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									Yes, you can make early repayments without
									any penalty to increase your credit limit.
								</p>
							</div>

							<div className="bg-purple-50 rounded-2xl p-8">
								<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
									Can I borrow more funds?
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									Yes, you can borrow more funds as your
									repayment balance decreases, up to 1 month
									gross salary in total.
								</p>
							</div>

							<div className="bg-purple-50 rounded-2xl p-8">
								<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
									Do I need to submit documents every time I
									request a pay advance?
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									No, the employer only needs to submit
									documents once. After that, you will be
									eligible for instant loan approvals and
									quick disbursements of funds.
								</p>
							</div>

							<div className="bg-purple-50 rounded-2xl p-8">
								<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
									Are you a regulated money lender?
								</h4>
								<p className="text-gray-600 dark:text-gray-600">
									Yes, the loan is powered by OPG Capital
									Holdings, a KPKT-regulated, licensed money
									lender (WL3337/07/01-9/020223).
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<Footer />
		</main>
	);
}
