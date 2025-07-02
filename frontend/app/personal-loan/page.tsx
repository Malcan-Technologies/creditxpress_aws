"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useDocumentTitle } from "@/hooks/use-document-title";
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
import CTASection from "@/components/CTASection";
import {
	MdArrowForward,
	MdCheck,
	MdSecurity,
	MdSpeed,
	MdTrendingUp,
	MdAccountBalance,
	MdVerifiedUser,
	MdPeople,
	MdPlayArrow,
	MdHome,
	MdDirectionsCar,
	MdSchool,
	MdPhone,
} from "react-icons/md";

export default function PersonalLoan() {
	useDocumentTitle("Personal Loan");

	const [loanAmount, setLoanAmount] = useState(50000);
	const [loanTerm, setLoanTerm] = useState(12);
	const [isCollateralized, setIsCollateralized] = useState(false);

	const COLLATERALIZED_INTEREST_RATE = 0.01; // 1.0% per month
	const UNCOLLATERALIZED_INTEREST_RATE = 0.015; // 1.5% per month
	const ORIGINATION_FEE_RATE = 0.03; // 3%
	const LEGAL_FEE_RATE = 0.02; // 2%
	const MAX_LOAN_AMOUNT = 150000; // Maximum loan amount cap for personal loans

	const getCurrentInterestRate = () => {
		return isCollateralized
			? COLLATERALIZED_INTEREST_RATE
			: UNCOLLATERALIZED_INTEREST_RATE;
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
		const monthlyInterest = loanAmount * getCurrentInterestRate();
		const totalInterest = monthlyInterest * loanTerm;
		const totalRepayment = loanAmount + totalInterest;
		return totalRepayment / loanTerm;
	};

	const generateChartData = () => {
		const monthlyPayment = calculateMonthlyPayment();
		const monthlyInterest = loanAmount * getCurrentInterestRate();
		const data = [];
		let remainingBalance = loanAmount;

		data.push({
			month: 0,
			balance: remainingBalance,
		});

		for (let month = 1; month <= loanTerm; month++) {
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
		<div className="min-h-screen bg-offwhite text-gray-700 font-body w-full">
			<Navbar bgStyle="bg-transparent" />

			{/* Hero Section */}
			<section className="min-h-screen relative flex items-center bg-gradient-to-br from-slate-900 via-[#1E3A8A] to-gray-900 w-full">
				{/* Gradient background elements */}
				<div className="absolute inset-0 overflow-hidden">
					{/* Primary blue orbs */}
					<div className="absolute w-[500px] h-[500px] bg-[#38BDF8]/15 rounded-full blur-3xl -top-32 -left-32 animate-pulse"></div>
					<div className="absolute w-[700px] h-[700px] bg-[#38BDF8]/8 rounded-full blur-3xl top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
					<div className="absolute w-[400px] h-[400px] bg-[#38BDF8]/12 rounded-full blur-3xl -bottom-32 -right-32"></div>

					{/* Additional subtle blue accents */}
					<div className="absolute w-[300px] h-[300px] bg-[#38BDF8]/6 rounded-full blur-2xl top-20 right-1/4"></div>
					<div className="absolute w-[200px] h-[200px] bg-[#38BDF8]/10 rounded-full blur-xl bottom-1/4 left-1/4"></div>

					{/* Gradient overlay for depth */}
					<div className="absolute inset-0 bg-gradient-to-t from-[#38BDF8]/5 via-transparent to-transparent"></div>
					<div className="absolute inset-0 bg-gradient-to-r from-[#38BDF8]/3 via-transparent to-[#38BDF8]/3"></div>
				</div>

				{/* Content */}
				<div className="relative w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-32">
					<div className="grid lg:grid-cols-2 gap-12 items-center">
						{/* Left Column */}
						<div className="text-center lg:text-left">
							<h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-heading font-bold tracking-tight mb-6 leading-tight">
								<span className="text-white drop-shadow-2xl [text-shadow:_0_4px_12px_rgb(59_130_246_/_0.8)]">
									Personal Loan
								</span>
							</h1>
							<p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-blue-400 mb-8 lg:mb-12 font-body leading-relaxed">
								Fast, Flexible Financing for Life's Important
								Moments
							</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8 lg:mb-12">
								<Link
									href="/apply"
									className="bg-blue-600 text-white hover:bg-blue-700 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center"
								>
									Apply Now
									<MdArrowForward
										size={20}
										className="ml-2"
									/>
								</Link>
								<Link
									href="#how-it-works"
									className="bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 inline-flex items-center justify-center"
								>
									<MdPlayArrow size={20} className="mr-2" />
									How It Works
								</Link>
							</div>

							<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300 mb-8 lg:mb-12 font-body leading-relaxed">
								Get up to RM 150,000 for personal needs with
								competitive rates and flexible terms
							</p>

							{/* Benefits Grid */}
							<div className="grid grid-cols-2 gap-4 mb-8 lg:mb-0">
								<div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
									<h3 className="text-base lg:text-lg font-heading font-semibold text-white mb-2">
										Quick Approval
									</h3>
									<p className="text-sm lg:text-base text-gray-300 font-body">
										Get approved within 24 hours
									</p>
								</div>
								<div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
									<h3 className="text-base lg:text-lg font-heading font-semibold text-white mb-2">
										Flexible Terms
									</h3>
									<p className="text-sm lg:text-base text-gray-300 font-body">
										6 to 24 months repayment options
									</p>
								</div>
								<div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
									<h3 className="text-base lg:text-lg font-heading font-semibold text-white mb-2">
										No Collateral
									</h3>
									<p className="text-sm lg:text-base text-gray-300 font-body">
										Unsecured personal financing
									</p>
								</div>
								<div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
									<h3 className="text-base lg:text-lg font-heading font-semibold text-white mb-2">
										Competitive Rates
									</h3>
									<p className="text-sm lg:text-base text-gray-300 font-body">
										From 1.0% monthly (collateralized)
									</p>
								</div>
							</div>
						</div>

						{/* Hero Image */}
						<div className="relative h-[300px] sm:h-[400px] lg:h-[500px] xl:h-[600px]">
							<Image
								src="/wishes.svg"
								alt="Personal Loan"
								fill
								className="object-contain"
								priority
							/>
						</div>
					</div>
				</div>
			</section>

			{/* How It Works Section */}
			<section
				id="how-it-works"
				className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-offwhite w-full scroll-mt-20"
			>
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 lg:mb-12">
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 leading-tight">
							How Personal Loan Works
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body leading-relaxed max-w-none lg:max-w-5xl">
							A simple and transparent process to get the funds
							you need
						</p>
					</div>

					<div className="grid md:grid-cols-2 gap-12">
						{/* Process Steps */}
						<div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
							<div className="space-y-6">
								<div className="flex items-start gap-4 group cursor-pointer hover:bg-blue-600/5 rounded-xl p-4 transition-all">
									<div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-all border border-blue-600/30">
										<span className="text-blue-600 font-semibold group-hover:text-white">
											1
										</span>
									</div>
									<div>
										<h4 className="text-lg font-heading font-semibold mb-1 text-gray-700">
											Submit Application
										</h4>
										<p className="text-gray-500 font-body">
											Complete our simple online
											application with your personal
											details and required documents.
										</p>
									</div>
								</div>

								<div className="flex items-start gap-4 group cursor-pointer hover:bg-blue-600/5 rounded-xl p-4 transition-all">
									<div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-all border border-blue-600/30">
										<span className="text-blue-600 font-semibold group-hover:text-white">
											2
										</span>
									</div>
									<div>
										<h4 className="text-lg font-heading font-semibold mb-1 text-gray-700">
											Quick Assessment
										</h4>
										<p className="text-gray-500 font-body">
											We review your application and
											personal financials within 24 hours.
										</p>
									</div>
								</div>

								<div className="flex items-start gap-4 group cursor-pointer hover:bg-blue-600/5 rounded-xl p-4 transition-all">
									<div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-all border border-blue-600/30">
										<span className="text-blue-600 font-semibold group-hover:text-white">
											3
										</span>
									</div>
									<div>
										<h4 className="text-lg font-heading font-semibold mb-1 text-gray-700">
											Loan Approval
										</h4>
										<p className="text-gray-500 font-body">
											Upon approval, we'll prepare the
											loan agreement for your review and
											signature.
										</p>
									</div>
								</div>

								<div className="flex items-start gap-4 group cursor-pointer hover:bg-blue-600/5 rounded-xl p-4 transition-all">
									<div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-all border border-blue-600/30">
										<span className="text-blue-600 font-semibold group-hover:text-white">
											4
										</span>
									</div>
									<div>
										<h4 className="text-lg font-heading font-semibold mb-1 text-gray-700">
											Fast Disbursement
										</h4>
										<p className="text-gray-500 font-body">
											Receive funds in your account within
											24 hours after signing.
										</p>
									</div>
								</div>
							</div>
						</div>

						{/* Image Section - macOS Browser Mockup */}
						<div className="relative h-[300px] md:h-[500px]">
							{/* Browser Window */}
							<div className="bg-white rounded-xl border border-gray-200 shadow-lg h-full flex flex-col">
								{/* Browser Header */}
								<div className="bg-gray-100 rounded-t-xl px-4 py-3 border-b border-gray-200 flex items-center gap-2">
									{/* Traffic Light Buttons */}
									<div className="flex items-center gap-2">
										<div className="w-3 h-3 bg-red-500 rounded-full"></div>
										<div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
										<div className="w-3 h-3 bg-green-500 rounded-full"></div>
									</div>

									{/* Address Bar */}
									<div className="flex-1 mx-4">
										<div className="bg-white rounded-md px-3 py-1 text-sm text-gray-500 border border-gray-300 font-mono">
											https://kredit.my/dashboard/apply
										</div>
									</div>

									{/* Browser Controls */}
									<div className="flex items-center gap-1">
										<div className="w-6 h-6 bg-gray-200 rounded-md flex items-center justify-center">
											<svg
												className="w-3 h-3 text-gray-500"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
												/>
											</svg>
										</div>
									</div>
								</div>

								{/* Browser Content */}
								<div className="flex-1 relative overflow-hidden bg-gray-50 rounded-b-xl">
									<Image
										src="/apply-screenshot.png"
										alt="Personal Loan Application Process"
										fill
										className="object-cover rounded-b-xl"
										sizes="(max-width: 768px) 100vw, 50vw"
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* What You Can Use It For Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-offwhite w-full">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 lg:mb-12">
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 leading-tight">
							What You Can Use It For
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body leading-relaxed max-w-none lg:max-w-5xl">
							Flexible financing for all your personal needs
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mx-2 sm:mx-4 lg:mx-0">
						{/* Home Improvement */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mb-4">
								<svg
									className="w-7 h-7 text-blue-600"
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
							<h3 className="text-xl lg:text-2xl font-heading font-bold mb-3 text-gray-700">
								Home Improvement
							</h3>
							<p className="text-lg text-gray-500 font-body">
								Renovate your home, upgrade appliances, or
								enhance your living space
							</p>
						</div>

						{/* Education */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mb-4">
								<svg
									className="w-7 h-7 text-blue-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 14l9-5-9-5-9 5 9 5z"
									/>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
									/>
								</svg>
							</div>
							<h3 className="text-xl lg:text-2xl font-heading font-bold mb-3 text-gray-700">
								Education
							</h3>
							<p className="text-lg text-gray-500 font-body">
								Fund your studies, courses, or your children's
								educational expenses
							</p>
						</div>

						{/* Medical Expenses */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mb-4">
								<svg
									className="w-7 h-7 text-blue-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
									/>
								</svg>
							</div>
							<h3 className="text-xl lg:text-2xl font-heading font-bold mb-3 text-gray-700">
								Medical Expenses
							</h3>
							<p className="text-lg text-gray-500 font-body">
								Cover medical treatments, procedures, or
								health-related costs
							</p>
						</div>

						{/* Vehicle Purchase */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mb-4">
								<svg
									className="w-7 h-7 text-blue-600"
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
							<h3 className="text-xl lg:text-2xl font-heading font-bold mb-3 text-gray-700">
								Vehicle Purchase
							</h3>
							<p className="text-lg text-gray-500 font-body">
								Buy a car, motorcycle, or make a down payment
								for your vehicle
							</p>
						</div>

						{/* Debt Consolidation */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mb-4">
								<svg
									className="w-7 h-7 text-blue-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
									/>
								</svg>
							</div>
							<h3 className="text-xl lg:text-2xl font-heading font-bold mb-3 text-gray-700">
								Debt Consolidation
							</h3>
							<p className="text-lg text-gray-500 font-body">
								Combine multiple debts into one manageable
								monthly payment
							</p>
						</div>

						{/* Emergency Expenses */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mb-4">
								<svg
									className="w-7 h-7 text-blue-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
							</div>
							<h3 className="text-xl lg:text-2xl font-heading font-bold mb-3 text-gray-700">
								Emergency Expenses
							</h3>
							<p className="text-lg text-gray-500 font-body">
								Handle unexpected expenses or urgent financial
								needs quickly
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Loan Terms & Calculator Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-offwhite w-full">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="bg-blue-50 rounded-xl lg:rounded-2xl p-8 sm:p-10 lg:p-12 xl:p-16 relative overflow-hidden shadow-lg border border-blue-100">
						<div className="text-center mb-8 lg:mb-12">
							<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 leading-tight">
								Loan Terms & Calculator
							</h2>
							<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body leading-relaxed max-w-none lg:max-w-5xl">
								Calculate your monthly payments and see our
								transparent terms
							</p>
						</div>

						<div className="grid lg:grid-cols-3 gap-12">
							{/* Terms Section */}
							<div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
								<h3 className="text-2xl font-heading font-bold mb-6 text-gray-700">
									Terms and Details
								</h3>
								<div className="space-y-6">
									<div>
										<h4 className="font-semibold text-blue-600 mb-2 font-body">
											Loan Amount
										</h4>
										<p className="text-gray-500 font-body">
											RM 5,000 - RM 150,000
										</p>
									</div>
									<div>
										<h4 className="font-semibold text-blue-600 mb-2 font-body">
											Interest Rate
										</h4>
										<p className="text-gray-500 font-body">
											1.0% monthly (collateralized)
											<br />
											1.5% monthly (uncollateralized)
										</p>
									</div>

									<div>
										<h4 className="font-semibold text-blue-600 mb-2 flex items-center gap-2 font-body">
											Origination Fee
											<div className="relative group">
												<InformationCircleIcon className="h-4 w-4 text-gray-500 cursor-help" />
												<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
													One-time fee for processing
												</div>
											</div>
										</h4>
										<p className="text-gray-500 font-body">
											3.0% of loan amount
										</p>
									</div>
									<div>
										<h4 className="font-semibold text-blue-600 mb-2 font-body">
											Legal Fee
										</h4>
										<p className="text-gray-500 font-body">
											2.0% of loan amount
										</p>
									</div>
									<div>
										<h4 className="font-semibold text-blue-600 mb-2 font-body">
											Repayment Term
										</h4>
										<p className="text-gray-500 font-body">
											6 to 24 months
										</p>
									</div>
									<div>
										<h4 className="font-semibold text-blue-600 mb-2 font-body">
											Eligibility
										</h4>
										<p className="text-gray-500 font-body">
											Minimum monthly income of RM 3,000
											with stable employment
										</p>
									</div>
								</div>
							</div>

							{/* Calculator Section - spans 2 columns */}
							<div className="lg:col-span-2 lg:flex lg:flex-col">
								<div className="space-y-8">
									{/* Loan Type Selection */}
									<div>
										<label className="block text-lg font-medium text-blue-600 mb-4 font-body">
											Loan Type
										</label>
										<div className="grid grid-cols-2 gap-4">
											<button
												onClick={() =>
													setIsCollateralized(false)
												}
												className={`p-4 rounded-xl border-2 transition-all ${
													!isCollateralized
														? "border-blue-600 bg-blue-50 text-blue-800"
														: "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
												}`}
											>
												<div className="text-center">
													<h4 className="font-semibold font-heading mb-1">
														Uncollateralized
													</h4>
													<p className="text-sm font-body">
														1.5% monthly interest
													</p>
												</div>
											</button>
											<button
												onClick={() =>
													setIsCollateralized(true)
												}
												className={`p-4 rounded-xl border-2 transition-all ${
													isCollateralized
														? "border-blue-600 bg-blue-50 text-blue-800"
														: "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
												}`}
											>
												<div className="text-center">
													<h4 className="font-semibold font-heading mb-1">
														Collateralized
													</h4>
													<p className="text-sm font-body">
														1.0% monthly interest
													</p>
												</div>
											</button>
										</div>
									</div>

									<div>
										<label className="block text-lg font-medium text-blue-600 mb-2 font-body">
											Loan Amount: RM{" "}
											{loanAmount.toLocaleString()}
										</label>
										<div className="relative">
											<input
												type="range"
												min="5000"
												max={MAX_LOAN_AMOUNT}
												step="5000"
												value={loanAmount}
												onChange={(e) =>
													setLoanAmount(
														Number(e.target.value)
													)
												}
												className="w-full h-3 rounded-lg appearance-none cursor-pointer range-slider"
												style={{
													background: `linear-gradient(to right, #2563EB 0%, #2563EB ${
														((loanAmount - 5000) /
															(MAX_LOAN_AMOUNT -
																5000)) *
														100
													}%, #E5E7EB ${
														((loanAmount - 5000) /
															(MAX_LOAN_AMOUNT -
																5000)) *
														100
													}%, #E5E7EB 100%)`,
												}}
											/>
											<style jsx>{`
												.range-slider::-webkit-slider-thumb {
													appearance: none;
													height: 24px;
													width: 24px;
													border-radius: 50%;
													background: #2563eb;
													cursor: pointer;
													border: 3px solid #ffffff;
													box-shadow: 0 2px 8px
														rgba(0, 0, 0, 0.25);
												}
												.range-slider::-moz-range-thumb {
													height: 24px;
													width: 24px;
													border-radius: 50%;
													background: #2563eb;
													cursor: pointer;
													border: 3px solid #ffffff;
													box-shadow: 0 2px 8px
														rgba(0, 0, 0, 0.25);
												}
												.range-slider::-webkit-slider-track {
													height: 12px;
													border-radius: 6px;
													background: transparent;
												}
												.range-slider::-moz-range-track {
													height: 12px;
													border-radius: 6px;
													background: transparent;
													border: none;
												}
												.range-slider:focus {
													outline: none;
												}
												.range-slider:focus::-webkit-slider-thumb {
													box-shadow: 0 0 0 3px
														rgba(37, 99, 235, 0.2);
												}
											`}</style>
										</div>
										<div className="flex justify-between text-xs text-gray-500 mt-1 font-body">
											<span>RM 5,000</span>
											<span>
												RM{" "}
												{MAX_LOAN_AMOUNT.toLocaleString()}
											</span>
										</div>
									</div>
									<div>
										<label className="block text-lg font-medium text-blue-600 mb-2 font-body">
											Loan Term
										</label>
										<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
											{[6, 12, 18, 24].map((term) => (
												<button
													key={term}
													onClick={() =>
														setLoanTerm(term)
													}
													className={`py-3 rounded-lg font-medium transition-all font-body ${
														loanTerm === term
															? "bg-blue-600 text-white shadow-lg"
															: "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
													}`}
												>
													{term} Months
												</button>
											))}
										</div>
									</div>
								</div>
								<div className="mt-8 lg:flex-1 lg:flex lg:flex-col">
									<div className="flex justify-between items-start mb-6">
										<div>
											<h3 className="text-2xl font-heading font-semibold mb-3 text-gray-700">
												Monthly Payment
											</h3>
											<div className="text-5xl font-heading font-bold text-blue-600 mt-2">
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
											<span className="text-gray-500 font-body">
												Origination Fee
											</span>
											<span className="font-medium text-blue-600 font-body">
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
											<span className="text-gray-500 font-body">
												Legal Fee
											</span>
											<span className="font-medium text-blue-600 font-body">
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
											<span className="text-gray-500 font-body">
												Net Disbursement
											</span>
											<span className="font-medium text-blue-600 font-body">
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
									<div className="h-64 lg:flex-1 lg:min-h-64 bg-gray-50 rounded-xl p-4 border border-gray-200">
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
															fill: "#6B7280",
															fontWeight: "500",
														},
													}}
													tick={{
														fontSize: 12,
														fill: "#6B7280",
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
															fill: "#6B7280",
														},
													}}
													tick={{
														fontSize: 12,
														fill: "#6B7280",
													}}
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
														"Balance",
													]}
													labelFormatter={(label) =>
														`Month ${label}`
													}
													contentStyle={{
														backgroundColor:
															"#FFFFFF",
														border: "1px solid #E5E7EB",
														borderRadius: "8px",
														color: "#374151",
													}}
												/>
												<Line
													type="monotone"
													dataKey="balance"
													stroke="#2563EB"
													strokeWidth={2}
													dot={false}
												/>
											</LineChart>
										</ResponsiveContainer>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Required Documents Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-gray-50/20 w-full">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 lg:mb-12">
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 leading-tight">
							Required Documents
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body leading-relaxed max-w-none lg:max-w-5xl">
							Please prepare these documents to speed up your
							application process
						</p>
					</div>

					<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
						<div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all border border-gray-200">
							<div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mb-6 border border-blue-600/20">
								<svg
									className="w-8 h-8 text-blue-600"
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
							<h4 className="text-xl font-heading font-semibold mb-4 text-gray-700">
								Identity Documents
							</h4>
							<p className="text-gray-500 font-body">
								Copy of NRIC (front and back)
							</p>
						</div>

						<div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all border border-gray-200">
							<div className="w-16 h-16 bg-blue-tertiary/10 rounded-full flex items-center justify-center mb-6 border border-blue-tertiary/20">
								<svg
									className="w-8 h-8 text-blue-tertiary"
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
							<h4 className="text-xl font-heading font-semibold mb-4 text-gray-700">
								Bank Statements
							</h4>
							<p className="text-gray-500 font-body">
								Latest 3 months bank statements
							</p>
						</div>

						<div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all border border-gray-200">
							<div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mb-6 border border-blue-600/20">
								<svg
									className="w-8 h-8 text-blue-600"
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
							<h4 className="text-xl font-heading font-semibold mb-4 text-gray-700">
								Income Documents
							</h4>
							<p className="text-gray-500 font-body">
								Latest 3 months payslips or EPF statement
							</p>
						</div>

						<div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all border border-gray-200">
							<div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mb-6 border border-blue-600/20">
								<svg
									className="w-8 h-8 text-blue-600"
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
							<h4 className="text-xl font-heading font-semibold mb-4 text-gray-700">
								Employment Letter
							</h4>
							<p className="text-gray-500 font-body">
								Employment confirmation letter from employer
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* FAQ Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-offwhite w-full">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 lg:mb-12">
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 leading-tight">
							Frequently Asked Questions
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body leading-relaxed max-w-none lg:max-w-5xl">
							Everything you need to know about Personal Loans
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 lg:gap-8 w-full">
						<div className="bg-blue-600/5 rounded-2xl p-4 md:p-6 lg:p-8 border border-blue-600/10 w-full">
							<h4 className="text-base md:text-lg lg:text-xl xl:text-2xl font-heading font-semibold mb-2 md:mb-3 lg:mb-4 text-blue-600 leading-tight">
								What is the maximum loan amount?
							</h4>
							<p className="text-sm md:text-base lg:text-lg text-gray-500 font-body leading-relaxed">
								You can borrow up to RM 150,000 depending on
								your income and credit profile.
							</p>
						</div>

						<div className="bg-blue-600/5 rounded-2xl p-4 md:p-6 lg:p-8 border border-blue-600/10 w-full">
							<h4 className="text-base md:text-lg lg:text-xl xl:text-2xl font-heading font-semibold mb-2 md:mb-3 lg:mb-4 text-blue-600 leading-tight">
								How long does approval take?
							</h4>
							<p className="text-sm md:text-base lg:text-lg text-gray-500 font-body leading-relaxed">
								Most applications are approved within 24 hours
								of submission with complete documentation.
							</p>
						</div>

						<div className="bg-blue-600/5 rounded-2xl p-4 md:p-6 lg:p-8 border border-blue-600/10 w-full">
							<h4 className="text-base md:text-lg lg:text-xl xl:text-2xl font-heading font-semibold mb-2 md:mb-3 lg:mb-4 text-blue-600 leading-tight">
								What documents do I need?
							</h4>
							<p className="text-sm md:text-base lg:text-lg text-gray-500 font-body leading-relaxed">
								You'll need your IC, latest 3 months' payslips,
								bank statements, and EPF statement.
							</p>
						</div>

						<div className="bg-blue-600/5 rounded-2xl p-4 md:p-6 lg:p-8 border border-blue-600/10 w-full">
							<h4 className="text-base md:text-lg lg:text-xl xl:text-2xl font-heading font-semibold mb-2 md:mb-3 lg:mb-4 text-blue-600 leading-tight">
								Can I repay early?
							</h4>
							<p className="text-sm md:text-base lg:text-lg text-gray-500 font-body leading-relaxed">
								Yes, you can make early repayments without
								penalty charges to reduce your total interest
								cost.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Benefits Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 w-full">
				<div className="px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 lg:mb-12">
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-900 mb-4">
							Why Choose{" "}
							<span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
								Our Personal Loans
							</span>
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 font-body">
							Designed to meet your personal financial needs
						</p>
					</div>

					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
						<div className="bg-white rounded-2xl p-6 lg:p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
							<div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
								<MdSpeed size={24} color="#2563EB" />
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold text-gray-900 mb-4">
								Fast Processing
							</h3>
							<p className="text-lg lg:text-xl text-gray-600 font-body">
								Quick approval process with minimal
								documentation required for your convenience
							</p>
						</div>

						<div className="bg-white rounded-2xl p-6 lg:p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
							<div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
								<MdSecurity size={24} color="#2563EB" />
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold text-gray-900 mb-4">
								Secure & Reliable
							</h3>
							<p className="text-lg lg:text-xl text-gray-600 font-body">
								Bank-level security with full regulatory
								compliance for your peace of mind
							</p>
						</div>

						<div className="bg-white rounded-2xl p-6 lg:p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
							<div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
								<MdTrendingUp size={24} color="#2563EB" />
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold text-gray-900 mb-4">
								Flexible Terms
							</h3>
							<p className="text-lg lg:text-xl text-gray-600 font-body">
								Choose repayment terms that fit your budget and
								financial situation
							</p>
						</div>

						<div className="bg-white rounded-2xl p-6 lg:p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
							<div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
								<MdAccountBalance size={24} color="#2563EB" />
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold text-gray-900 mb-4">
								No Hidden Fees
							</h3>
							<p className="text-lg lg:text-xl text-gray-600 font-body">
								Transparent pricing with all fees clearly
								disclosed upfront
							</p>
						</div>

						<div className="bg-white rounded-2xl p-6 lg:p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
							<div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
								<MdVerifiedUser size={24} color="#2563EB" />
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold text-gray-900 mb-4">
								Licensed Lender
							</h3>
							<p className="text-lg lg:text-xl text-gray-600 font-body">
								Fully licensed by KPKT with proper regulatory
								oversight and consumer protection
							</p>
						</div>

						<div className="bg-white rounded-2xl p-6 lg:p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
							<div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
								<MdPeople size={24} color="#2563EB" />
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold text-gray-900 mb-4">
								Personal Support
							</h3>
							<p className="text-lg lg:text-xl text-gray-600 font-body">
								Dedicated customer support team to help you
								throughout the loan process
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Final CTA Section */}
			<CTASection
				title="Ready to Get Started?"
				description="Apply for your personal loan today and get the funds you need"
				primaryButtonText="Apply Now"
				primaryButtonHref="/apply"
				secondaryButtonText="Contact Us"
				secondaryButtonHref="https://wa.me/60164614919?text=I'm%20interested%20in%20a%20personal%20loan"
			/>

			<Footer />
		</div>
	);
}
