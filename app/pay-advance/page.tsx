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
		"employer"
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
								onClick={() => setActiveView("employer")}
								className={`px-8 py-3 rounded-full font-semibold transition-all ${
									activeView === "employer"
										? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
										: "bg-white text-gray-600 dark:text-gray-600 hover:bg-gray-50 border border-gray-200"
								}`}
							>
								For Employers
							</button>
							<button
								onClick={() => setActiveView("employee")}
								className={`px-8 py-3 rounded-full font-semibold transition-all ${
									activeView === "employee"
										? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg"
										: "bg-white text-gray-600 dark:text-gray-600 hover:bg-gray-50 border border-gray-200"
								}`}
							>
								For Employees
							</button>
						</div>
					</div>

					<div className="grid md:grid-cols-2 gap-12">
						{/* Process Steps */}
						<div
							className={`${
								activeView === "employer"
									? "bg-gradient-to-br from-purple-50 to-indigo-50"
									: "bg-gradient-to-br from-emerald-50 to-teal-50"
							} rounded-3xl p-8 transition-all duration-300`}
						>
							<div className="flex items-center gap-4 mb-6">
								<div
									className={`w-12 h-12 ${
										activeView === "employer"
											? "bg-purple-100"
											: "bg-emerald-100"
									} rounded-full flex items-center justify-center`}
								>
									<svg
										className={`w-6 h-6 ${
											activeView === "employer"
												? "text-purple-600"
												: "text-emerald-600"
										}`}
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										{activeView === "employer" ? (
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
											/>
										) : (
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
											/>
										)}
									</svg>
								</div>
								<h3
									className={`text-2xl font-bold ${
										activeView === "employer"
											? "text-purple-900 dark:text-purple-900"
											: "text-emerald-900 dark:text-emerald-900"
									}`}
								>
									{activeView === "employer"
										? "For Employers"
										: "For Employees"}
								</h3>
							</div>

							<div className="space-y-6">
								{activeView === "employer" ? (
									<>
										{/* Employer Steps */}
										<div className="flex items-start gap-4 group cursor-pointer hover:bg-white rounded-xl p-4 transition-all">
											<div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 transition-all">
												<span className="text-purple-600 font-semibold group-hover:text-white">
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
											<div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 transition-all">
												<span className="text-purple-600 font-semibold group-hover:text-white">
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
											<div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 transition-all">
												<span className="text-purple-600 font-semibold group-hover:text-white">
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
											<div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 transition-all">
												<span className="text-purple-600 font-semibold group-hover:text-white">
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
								) : (
									<>
										{/* Employee Steps */}
										<div className="flex items-start gap-4 group cursor-pointer hover:bg-white rounded-xl p-4 transition-all">
											<div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-all">
												<span className="text-emerald-600 font-semibold group-hover:text-white">
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
											<div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-all">
												<span className="text-emerald-600 font-semibold group-hover:text-white">
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
											<div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-all">
												<span className="text-emerald-600 font-semibold group-hover:text-white">
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
											<div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-all">
												<span className="text-emerald-600 font-semibold group-hover:text-white">
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
								)}
							</div>
						</div>

						{/* Image Section */}
						<div className="relative rounded-3xl overflow-hidden h-[300px] md:h-[500px]">
							<Image
								src={
									activeView === "employer"
										? "/freedom.svg"
										: "/deal.svg"
								}
								alt={
									activeView === "employer"
										? "Employee using the platform"
										: "Employer dashboard"
								}
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
							Benefits of PayAdvance™
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							Smart financial solutions for everyone
						</p>

						{/* View Switcher */}
						<div className="flex justify-center gap-4 mt-8">
							<button
								onClick={() => setActiveView("employer")}
								className={`px-8 py-3 rounded-full font-semibold transition-all ${
									activeView === "employer"
										? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
										: "bg-white text-gray-600 dark:text-gray-600 hover:bg-gray-50 border border-gray-200"
								}`}
							>
								For Employers
							</button>
							<button
								onClick={() => setActiveView("employee")}
								className={`px-8 py-3 rounded-full font-semibold transition-all ${
									activeView === "employee"
										? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg"
										: "bg-white text-gray-600 dark:text-gray-600 hover:bg-gray-50 border border-gray-200"
								}`}
							>
								For Employees
							</button>
						</div>
					</div>

					<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
						{activeView === "employer" ? (
							<>
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
												d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
											/>
										</svg>
									</div>
									<h4 className="text-xl font-semibold mb-3 text-black dark:text-black">
										Enhanced Employee Benefits
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										Attract and retain talent with zero-cost
										financial wellness benefits.
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
										Zero Risk & Cost
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										No financial liability or administrative
										burden for employers.
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
												d="M13 10V3L4 14h7v7l9-11h-7z"
											/>
										</svg>
									</div>
									<h4 className="text-xl font-semibold mb-3 text-black dark:text-black">
										Easy Integration
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										Seamless setup with your existing
										payroll system.
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
												d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
											/>
										</svg>
									</div>
									<h4 className="text-xl font-semibold mb-3 text-black dark:text-black">
										Increased Productivity
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										Reduce financial stress and improve
										workplace performance.
									</p>
								</div>
							</>
						) : (
							<>
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
										Quick Access to Funds
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										Get your salary advance within 24 hours
										of approval.
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
										No Collateral Required
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										Secure funding without any assets as
										security.
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
										Flexible Repayment
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										Choose between 6 or 12 months repayment
										terms.
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
										Build Credit History
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										Improve your credit score with timely
										repayments.
									</p>
								</div>
							</>
						)}
					</div>
				</div>

				{/* Terms and Calculator Section */}
				<div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-3xl p-4 sm:p-8 md:p-12">
					<div className="text-center mb-12">
						<h2 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-black">
							Loan Terms & Calculator
						</h2>
						<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
							Transparent terms and instant calculations to help
							you plan your loan
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
										6 or 12 months
									</p>
								</div>
								<div>
									<h4 className="font-semibold text-gray-700 dark:text-gray-700 mb-2">
										Eligibility
									</h4>
									<p className="text-gray-600 dark:text-gray-600">
										Full-time employees of partner companies
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
												Math.min(loanAmount, newSalary)
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
											RM {monthlySalary.toLocaleString()}
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
													return value === "balance"
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

						{/* View Switcher */}
						<div className="flex justify-center gap-4 mt-8">
							<button
								onClick={() => setActiveView("employer")}
								className={`px-8 py-3 rounded-full font-semibold transition-all ${
									activeView === "employer"
										? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
										: "bg-white text-gray-600 dark:text-gray-600 hover:bg-gray-50 border border-gray-200"
								}`}
							>
								For Employers
							</button>
							<button
								onClick={() => setActiveView("employee")}
								className={`px-8 py-3 rounded-full font-semibold transition-all ${
									activeView === "employee"
										? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg"
										: "bg-white text-gray-600 dark:text-gray-600 hover:bg-gray-50 border border-gray-200"
								}`}
							>
								For Employees
							</button>
						</div>
					</div>

					<div className="space-y-6">
						{activeView === "employer" ? (
							<div className="grid md:grid-cols-2 gap-8">
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
												d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
											/>
										</svg>
									</div>
									<h4 className="text-xl font-semibold mb-4 text-black dark:text-black">
										Company Documents
									</h4>
									<ul className="space-y-3 text-gray-600">
										<li className="flex items-center gap-2">
											<svg
												className="w-5 h-5 text-purple-600"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											<span>
												Business Registration (SSM)
											</span>
										</li>
										<li className="flex items-center gap-2">
											<svg
												className="w-5 h-5 text-purple-600"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											<span>
												Latest 6 months bank statements
											</span>
										</li>
										<li className="flex items-center gap-2">
											<svg
												className="w-5 h-5 text-purple-600"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											<span>
												Director(s) NRIC/Passport copy
											</span>
										</li>
									</ul>
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
												d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
											/>
										</svg>
									</div>
									<h4 className="text-xl font-semibold mb-4 text-black dark:text-black">
										Employee Information
									</h4>
									<ul className="space-y-3 text-gray-600">
										<li className="flex items-center gap-2">
											<svg
												className="w-5 h-5 text-purple-600"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											<span>
												Employee list with salary
												details
											</span>
										</li>
										<li className="flex items-center gap-2">
											<svg
												className="w-5 h-5 text-purple-600"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											<span>Latest EPF statement</span>
										</li>
									</ul>
								</div>
							</div>
						) : (
							<div className="grid md:grid-cols-2 gap-8">
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
										Personal Documents
									</h4>
									<ul className="space-y-3 text-gray-600">
										<li className="flex items-center gap-2">
											<svg
												className="w-5 h-5 text-emerald-600"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											<span>NRIC/Passport copy</span>
										</li>
										<li className="flex items-center gap-2">
											<svg
												className="w-5 h-5 text-emerald-600"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											<span>
												Latest 3 months payslips
											</span>
										</li>
										<li className="flex items-center gap-2">
											<svg
												className="w-5 h-5 text-emerald-600"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											<span>
												Latest 3 months bank statements
											</span>
										</li>
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
												d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
											/>
										</svg>
									</div>
									<h4 className="text-xl font-semibold mb-4 text-black dark:text-black">
										Employment Documents
									</h4>
									<ul className="space-y-3 text-gray-600">
										<li className="flex items-center gap-2">
											<svg
												className="w-5 h-5 text-emerald-600"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											<span>Employment letter</span>
										</li>
										<li className="flex items-center gap-2">
											<svg
												className="w-5 h-5 text-emerald-600"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											<span>Latest EPF statement</span>
										</li>
									</ul>
								</div>
							</div>
						)}
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
								allows you to access a portion of your salary
								early. The amount is automatically repaid
								through salary deductions over 6 or 12 months.
							</p>
						</div>

						<div className="bg-purple-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
								How much can I borrow?
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								You can borrow between RM 1,000 and up to one
								month&apos;s gross salary, subject to
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
								No hidden fees. You only pay the processing fee
								(7.5%) and monthly interest (1.5%).
							</p>
						</div>

						<div className="bg-purple-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
								Why do you charge a processing fee?{" "}
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								This is to cover the cost of loan processing
								including, but not limited to credit checks,
								stamp duty, legal fees, and other administrative
								costs.
							</p>
						</div>

						<div className="bg-purple-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
								How long does approval take?
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Most applications are approved within 24 hours,
								with funds disbursed within 1-2 business days
								after approval.
							</p>
						</div>

						<div className="bg-purple-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
								Can I repay early?
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Yes, you can make early repayments without any
								penalty to increase your credit limit.
							</p>
						</div>

						<div className="bg-purple-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
								Can I borrow more funds?
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								Yes, you can borrow more funds as your repayment
								balance decreases, up to 1 month gross salary in
								total.
							</p>
						</div>

						<div className="bg-purple-50 rounded-2xl p-8">
							<h4 className="text-xl font-semibold mb-4 text-purple-900 dark:text-purple-900">
								Do I need to submit documents every time I
								request a pay advance?
							</h4>
							<p className="text-gray-600 dark:text-gray-600">
								No, the employer only needs to submit documents
								once. After that, you will be eligible for
								instant loan approvals and quick disbursements
								of funds.
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

			<Footer />
		</main>
	);
}
