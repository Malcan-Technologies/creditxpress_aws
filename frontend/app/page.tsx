"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
	MdArrowForward,
	MdCheck,
	MdEmail,
	MdPhone,
	MdLocationOn,
	MdExpandMore,
	MdExpandLess,
	MdSecurity,
	MdVerifiedUser,
	MdPeople,
	MdAccountBalance,
	MdBusinessCenter,
	MdPercent,
	MdHandshake,
	MdDashboard,
} from "react-icons/md";

export default function Home() {
	const [openFaq, setOpenFaq] = useState<number | null>(null);
	const [formData, setFormData] = useState({
		email: "",
		phone: "",
		message: "",
	});

	const toggleFaq = (index: number) => {
		setOpenFaq(openFaq === index ? null : index);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		// Reset form
		setFormData({ email: "", phone: "", message: "" });
		toast.success("Thank you for your message. We'll get back to you soon!");
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		});
	};

	const scrollToSection = (sectionId: string) => {
		const element = document.getElementById(sectionId);
		element?.scrollIntoView({ behavior: "smooth" });
	};

	const faqs = [
		{
			question: "Is CreditXpress a legal moneylender?",
			answer: "Yes. CreditXpress is fully licensed under the Moneylenders Act 1951. Our license is issued by the Ministry of Housing and Local Government (KPKT), which means we operate legally and are strictly regulated."
		},
		{
			question: "How do I know your service is safe?",
			answer: "We comply with KPKT regulations and the Personal Data Protection Act (PDPA). Your information and transactions are handled securely and confidentially."
		},
		{
			question: "Who is eligible to apply for a loan?",
			answer: "Malaysian citizens aged 21 to 60 with a steady income are eligible. We may request supporting documents such as your IC, payslips, or bank statements to verify eligibility."
		},
		{
			question: "What types of loans do you offer?",
			answer: "We provide personal loans and business loans tailored to different needs. All our loans come with transparent terms and fixed repayment schedules."
		},
		{
			question: "How much can I borrow?",
			answer: "The amount depends on your income, repayment capacity, and loan type. Typically, loans range from RM1,000 up to RM50,000."
		},
		{
			question: "How fast will I receive my money?",
			answer: "Once your application is approved and documents verified, funds are usually disbursed to your bank account within 24 to 48 hours."
		},
		{
			question: "Are there any hidden fees?",
			answer: "No. All fees and charges will be explained clearly in your loan agreement. We do not believe in hidden charges."
		},
		{
			question: "What happens if I miss a payment?",
			answer: "If you miss a payment, late payment interest (8% p.a) may be charged as allowed under the Moneylenders Act 1951. We encourage you to contact us early if you face difficulties, so we can work out a repayment arrangement."
		},
		{
			question: "Can I settle my loan early?",
			answer: "Yes, you can. Early settlement is always allowed, and you may even save on future interest depending on your repayment terms."
		},
		{
			question: "How do I contact you if I have questions?",
			answer: "You can reach us via email or the contact form. Our friendly support team is here to guide you through the process and answer any questions."
		}
	];

	return (
		<div className="min-h-screen bg-offwhite text-gray-700 font-body w-full">
			<Navbar bgStyle="bg-transparent" />

			{/* Hero Section */}
			<section className="min-h-screen relative flex items-center bg-gradient-to-br from-[#0A0612] via-[#1A0B2E] to-[#0A0612] w-full">
				{/* Gradient background elements */}
				<div className="absolute inset-0 overflow-hidden">
					<div className="absolute w-[500px] h-[500px] bg-[#7C3AED]/15 rounded-full blur-3xl -top-32 -left-32 animate-pulse"></div>
					<div className="absolute w-[700px] h-[700px] bg-[#7C3AED]/8 rounded-full blur-3xl top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
					<div className="absolute w-[400px] h-[400px] bg-[#7C3AED]/12 rounded-full blur-3xl -bottom-32 -right-32"></div>
				</div>

				{/* Content */}
				<div className="relative w-full px-4 sm:px-6 lg:pl-16 lg:pr-8 xl:pl-20 xl:pr-12 2xl:pl-24 2xl:pr-16 py-32">
					<div className="grid lg:grid-cols-2 gap-12 items-center">
						<div className="text-center lg:text-left">
							{/* Brand Badge */}
							<div className="inline-flex items-center px-4 py-2 bg-purple-primary/20 rounded-full mb-6 border border-purple-primary/30">
								<span className="text-sm font-semibold text-purple-300">
									Legal. Transparent. Reliable.
								</span>
							</div>
							
							<h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-heading font-bold tracking-tight mb-6 leading-tight">
								<span className="text-white drop-shadow-2xl [text-shadow:_0_4px_12px_rgb(147_51_234_/_0.8)]">
									Smart Financing, Backed by Trust and Compliance
								</span>
							</h1>
							<p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-gray-200 mb-8 lg:mb-12 font-body leading-relaxed drop-shadow-lg">
								Your Financial Support, Simplified and Secure
							</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
								<button
									onClick={() => scrollToSection('products')}
									className="bg-purple-primary text-white hover:bg-purple-700 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center"
								>
									Apply for Loan
									<MdArrowForward size={20} className="ml-2" />
								</button>
								<button
									onClick={() => scrollToSection('about')}
									className="bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 inline-flex items-center justify-center"
								>
									Learn More
								</button>
							</div>
						</div>

						{/* Hero Image */}
						<div className="relative h-[300px] sm:h-[400px] lg:h-[500px] xl:h-[600px] flex items-center justify-center">
							<div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
								<Image
									src="/hero-image.jpg"
									alt="Happy Malaysian Family - CreditXpress"
									fill
									className="object-cover"
									priority
								/>
								{/* Subtle overlay for better text contrast if needed */}
								<div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
							</div>
						</div>
					</div>
				</div>
			</section>			

			{/* How It Works Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-offwhite w-full" id="how-it-works">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 lg:mb-16">
						<div className="inline-flex items-center px-4 py-2 bg-blue-tertiary/10 rounded-full mb-4 sm:mb-6 border border-blue-tertiary/20">
							<span className="text-xs sm:text-sm font-semibold text-blue-tertiary">
								Simple Process
							</span>
						</div>
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 px-4">
							How It Works
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body px-4 max-w-none lg:max-w-4xl">
							Get your loan in 4 simple steps
						</p>
					</div>

					{/* Process Steps */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
						{/* Step 1 */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100 text-center">
							<div className="w-16 h-16 bg-purple-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
								<span className="text-2xl font-bold text-purple-primary">1</span>
											</div>
							<h3 className="text-xl lg:text-2xl font-heading font-bold mb-3 text-gray-700">
								Submit Application
											</h3>
							<p className="text-base lg:text-lg text-gray-500 font-body">
								Submit your loan application online with required documents
							</p>
									</div>

						{/* Step 2 */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100 text-center">
							<div className="w-16 h-16 bg-blue-tertiary/10 rounded-full flex items-center justify-center mx-auto mb-4">
								<span className="text-2xl font-bold text-blue-tertiary">2</span>
							</div>
							<h3 className="text-xl lg:text-2xl font-heading font-bold mb-3 text-gray-700">
								Quick Approval
							</h3>
							<p className="text-base lg:text-lg text-gray-500 font-body">
								We will approve your application in 1 business day
							</p>
									</div>

						{/* Step 3 */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100 text-center">
							<div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
								<span className="text-2xl font-bold text-green-600">3</span>
									</div>
							<h3 className="text-xl lg:text-2xl font-heading font-bold mb-3 text-gray-700">
								Sign Agreement
							</h3>
							<p className="text-base lg:text-lg text-gray-500 font-body">
								Sign the agreement online securely and conveniently
							</p>
								</div>

						{/* Step 4 */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100 text-center">
							<div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
								<span className="text-2xl font-bold text-orange-600">4</span>
									</div>
							<h3 className="text-xl lg:text-2xl font-heading font-bold mb-3 text-gray-700">
								Get Funds
							</h3>
							<p className="text-base lg:text-lg text-gray-500 font-body">
								We disburse the money in 1 business day to your account
							</p>
								</div>
							</div>
						</div>
			</section>

			{/* Why CreditXpress Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-gray-50/20 w-full" id="why-creditxpress">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 lg:mb-12">
						<div className="inline-flex items-center px-4 py-2 bg-purple-primary/10 rounded-full mb-4 sm:mb-6 border border-purple-primary/20">
							<span className="text-xs sm:text-sm font-semibold text-purple-primary">
								Why Choose Us
							</span>
									</div>
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 px-4">
							Why CreditXpress?
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body px-4 max-w-none lg:max-w-5xl">
							Trusted, transparent, and reliable financial solutions
						</p>
								</div>

					{/* Features Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mx-2 sm:mx-4 lg:mx-0">
						{/* Licensed by KPKT */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-blue-600/10 rounded-xl flex items-center justify-center mb-4">
								<MdAccountBalance size={28} className="text-blue-600" />
											</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								Licensed by KPKT
											</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								Fully licensed under the Moneylenders Act 1951 by the Ministry of Housing & Local Government
											</p>
									</div>

						{/* Transparent Rates */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-green-600/10 rounded-xl flex items-center justify-center mb-4">
								<MdPercent size={28} className="text-green-600" />
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								Transparent Rates
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								Clear and upfront interest rates with no surprises or hidden calculations
							</p>
									</div>

						{/* No Hidden Charges */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mb-4">
								<MdVerifiedUser size={28} className="text-purple-primary" />
									</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								No Hidden Charges
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								All fees and charges clearly explained in your loan agreement upfront
							</p>
						</div>

						{/* Quick Approval */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-blue-tertiary/10 rounded-xl flex items-center justify-center mb-4">
								<MdHandshake size={28} className="text-blue-tertiary" />
											</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								Quick Approval
											</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								Fast approval process with decisions made within 1 business day
							</p>
									</div>

						{/* Secure and Confidential */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-green-600/10 rounded-xl flex items-center justify-center mb-4">
								<MdSecurity size={28} className="text-green-600" />
							</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								Secure & Confidential
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								Your information is protected under PDPA with bank-level security
							</p>
									</div>

						{/* Convenient */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100">
							<div className="w-14 h-14 bg-orange-500/10 rounded-xl flex items-center justify-center mb-4">
								<MdDashboard size={28} className="text-orange-500" />
									</div>
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-3 text-gray-700">
								Convenient
							</h3>
							<p className="text-lg lg:text-xl text-gray-500 font-body">
								100% online process from application to disbursement - no branch visits required
							</p>
								</div>
									</div>
								</div>
			</section>

			{/* Products Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-offwhite w-full" id="products">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 lg:mb-16">
						<div className="inline-flex items-center px-4 py-2 bg-blue-600/10 rounded-full mb-4 sm:mb-6 border border-blue-600/20">
							<span className="text-xs sm:text-sm font-semibold text-blue-600">
								Our Products
							</span>
									</div>
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 px-4">
							Loan Products
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body px-4 max-w-none lg:max-w-4xl">
							Choose the right loan for your needs
						</p>
								</div>

					<div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
						{/* Personal Loan */}
						<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
							<div className="p-8 lg:p-12">
									<div className="flex items-center mb-6">
									<div className="w-16 h-16 lg:w-20 lg:h-20 bg-blue-600/10 rounded-xl lg:rounded-2xl flex items-center justify-center mr-4">
										<MdPeople size={32} className="text-blue-600" />
										</div>
										<div>
										<h3 className="text-2xl lg:text-3xl font-heading font-bold text-gray-700 mb-2">
											Personal Loan
											</h3>
										<p className="text-lg lg:text-xl text-blue-600 font-semibold">
											For Personal Needs
											</p>
										</div>
									</div>

								{/* Loan Details */}
								<div className="space-y-4 mb-8">
									<div className="flex items-center justify-between py-3 border-b border-gray-100">
										<span className="text-gray-600 font-medium">Loan Amount</span>
										<span className="text-xl font-bold text-gray-700">Up to RM 30,000</span>
									</div>
									<div className="flex items-center justify-between py-3 border-b border-gray-100">
										<span className="text-gray-600 font-medium">Interest Rate</span>
										<span className="text-xl font-bold text-gray-700">18% p.a.</span>
									</div>
									<div className="flex items-center justify-between py-3 border-b border-gray-100">
										<span className="text-gray-600 font-medium">Tenure</span>
										<span className="text-xl font-bold text-gray-700">6 to 24 months</span>
									</div>
								</div>

								{/* Documents Required */}
								<div className="mb-8">
									<h4 className="text-lg font-semibold text-gray-700 mb-4">Documents Required:</h4>
									<div className="grid grid-cols-2 gap-3">
										<div className="flex items-center space-x-2">
											<MdCheck size={16} className="text-green-600" />
											<span className="text-sm text-gray-600">IC</span>
										</div>
										<div className="flex items-center space-x-2">
											<MdCheck size={16} className="text-green-600" />
											<span className="text-sm text-gray-600">Payslip</span>
										</div>
										<div className="flex items-center space-x-2">
											<MdCheck size={16} className="text-green-600" />
											<span className="text-sm text-gray-600">Bank Statement</span>
										</div>
										<div className="flex items-center space-x-2">
											<MdCheck size={16} className="text-green-600" />
											<span className="text-sm text-gray-600">CTOS Report</span>
										</div>
										</div>
									</div>

									{/* CTA */}
										<Link
									href="/signup"
									className="w-full bg-blue-600 text-white hover:bg-blue-700 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center"
								>
									Apply for Personal Loan
									<MdArrowForward size={20} className="ml-2" />
										</Link>
							</div>
						</div>

						{/* Business Loan */}
						<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
							<div className="p-8 lg:p-12">
									<div className="flex items-center mb-6">
									<div className="w-16 h-16 lg:w-20 lg:h-20 bg-emerald-600/10 rounded-xl lg:rounded-2xl flex items-center justify-center mr-4">
										<MdBusinessCenter size={32} className="text-emerald-600" />
										</div>
										<div>
										<h3 className="text-2xl lg:text-3xl font-heading font-bold text-gray-700 mb-2">
											Business Loan
											</h3>
										<p className="text-lg lg:text-xl text-emerald-600 font-semibold">
											For Business Growth
											</p>
										</div>
									</div>

								{/* Loan Details */}
								<div className="space-y-4 mb-8">
									<div className="flex items-center justify-between py-3 border-b border-gray-100">
										<span className="text-gray-600 font-medium">Loan Amount</span>
										<span className="text-xl font-bold text-gray-700">Up to RM 50,000</span>
									</div>
									<div className="flex items-center justify-between py-3 border-b border-gray-100">
										<span className="text-gray-600 font-medium">Interest Rate</span>
										<span className="text-xl font-bold text-gray-700">18% p.a.</span>
									</div>
									<div className="flex items-center justify-between py-3 border-b border-gray-100">
										<span className="text-gray-600 font-medium">Tenure</span>
										<span className="text-xl font-bold text-gray-700">6 to 36 months</span>
									</div>
								</div>

								{/* Documents Required */}
								<div className="mb-8">
									<h4 className="text-lg font-semibold text-gray-700 mb-4">Documents Required:</h4>
									<div className="grid grid-cols-1 gap-3">
										<div className="flex items-center space-x-2">
											<MdCheck size={16} className="text-green-600" />
											<span className="text-sm text-gray-600">Director's IC</span>
										</div>
										<div className="flex items-center space-x-2">
											<MdCheck size={16} className="text-green-600" />
											<span className="text-sm text-gray-600">SSM Company Profile</span>
										</div>
										<div className="flex items-center space-x-2">
											<MdCheck size={16} className="text-green-600" />
											<span className="text-sm text-gray-600">Audited Financial Report</span>
										</div>
										<div className="flex items-center space-x-2">
											<MdCheck size={16} className="text-green-600" />
											<span className="text-sm text-gray-600">CTOS Report</span>
										</div>
										</div>
									</div>

									{/* CTA */}
										<Link
									href="/signup"
									className="w-full bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center"
								>
									Apply for Business Loan
									<MdArrowForward size={20} className="ml-2" />
										</Link>
									</div>
								</div>
					</div>
				</div>
			</section>

			{/* About Us Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-gray-50/20 w-full" id="about">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 lg:mb-12">
						<div className="inline-flex items-center px-4 py-2 bg-purple-primary/10 rounded-full mb-4 sm:mb-6 border border-purple-primary/20">
							<span className="text-xs sm:text-sm font-semibold text-purple-primary">
								About CreditXpress
							</span>
						</div>
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 px-4">
							About Us
						</h2>
					</div>

					<div className="max-w-4xl mx-auto">
						<div className="bg-white rounded-xl lg:rounded-2xl p-8 lg:p-12 shadow-sm border border-gray-100">
							<div className="prose prose-lg max-w-none">
								<p className="text-lg lg:text-xl text-gray-600 mb-6 font-body leading-relaxed">
									CreditXpress is proudly owned and operated by <strong>OPG Capital Holdings Sdn. Bhd.</strong>, 
									a licensed moneylender under the Moneylenders Act 1951. Our license is issued by the 
									Ministry of Housing and Local Government (KPKT), License No: WL3337/07/01-11/020227.
								</p>
								
								<p className="text-lg lg:text-xl text-gray-600 mb-6 font-body leading-relaxed">
									At CreditXpress, we believe borrowing should always be simple, transparent, and stress-free. 
									We are committed to offering clear terms without hidden fees, quick and secure approvals, 
									and a customer-friendly experience every step of the way.
								</p>
								
								<p className="text-lg lg:text-xl text-gray-600 font-body leading-relaxed">
									Our goal is to provide Malaysians with access to responsible and legal financial support 
									whenever they need it most.
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Contact Us Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-offwhite w-full" id="contact">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 lg:mb-12">
						<div className="inline-flex items-center px-4 py-2 bg-blue-tertiary/10 rounded-full mb-4 sm:mb-6 border border-blue-tertiary/20">
							<span className="text-xs sm:text-sm font-semibold text-blue-tertiary">
								Get In Touch
							</span>
						</div>
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 px-4">
							Contact Us
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body px-4 max-w-none lg:max-w-4xl">
							Have questions? We're here to help
						</p>
					</div>

					<div className="grid lg:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto">
						{/* Contact Form */}
						<div className="bg-white rounded-xl lg:rounded-2xl p-8 lg:p-12 shadow-sm border border-gray-100">
							<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-6 text-gray-700">
								Send us a Message
							</h3>
							<form onSubmit={handleSubmit} className="space-y-6">
									<div>
									<label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
										Email Address
									</label>
									<input
										type="email"
										id="email"
										name="email"
										value={formData.email}
										onChange={handleInputChange}
										required
										className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-primary focus:border-transparent transition-colors"
										placeholder="your.email@example.com"
										/>
									</div>
									<div>
									<label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
										Phone Number
									</label>
									<input
										type="tel"
										id="phone"
										name="phone"
										value={formData.phone}
										onChange={handleInputChange}
										required
										className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-primary focus:border-transparent transition-colors"
										placeholder="+60 12-345 6789"
										/>
									</div>
									<div>
									<label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
										Message
									</label>
									<textarea
										id="message"
										name="message"
										value={formData.message}
										onChange={handleInputChange}
										required
										rows={5}
										className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-primary focus:border-transparent transition-colors resize-none"
										placeholder="How can we help you?"
									/>
								</div>
								<button
									type="submit"
									className="w-full bg-purple-primary text-white hover:bg-purple-700 font-semibold text-base lg:text-lg px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
								>
									Send Message
								</button>
							</form>
							</div>

						{/* Contact Information */}
						<div className="space-y-8">
							<div className="bg-white rounded-xl lg:rounded-2xl p-8 lg:p-12 shadow-sm border border-gray-100">
								<h3 className="text-2xl lg:text-3xl font-heading font-bold mb-6 text-gray-700">
									Contact Information
							</h3>
								<div className="space-y-6">
									<div className="flex items-start space-x-4">
										<div className="w-12 h-12 bg-purple-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
											<MdEmail size={24} className="text-purple-primary" />
						</div>
										<div>
											<h4 className="text-lg font-semibold text-gray-700 mb-1">Email</h4>
											<a 
												href="mailto:opgcapital3@gmail.com"
												className="text-blue-tertiary hover:text-purple-primary transition-colors"
											>
												opgcapital3@gmail.com
											</a>
							</div>
						</div>
									<div className="flex items-start space-x-4">
										<div className="w-12 h-12 bg-blue-tertiary/10 rounded-xl flex items-center justify-center flex-shrink-0">
											<MdPhone size={24} className="text-blue-tertiary" />
							</div>
										<div>
											<h4 className="text-lg font-semibold text-gray-700 mb-1">Phone</h4>
											<a 
												href="https://wa.me/60164614919?text=I'm%20interested%20in%20CreditXpress%20lending%20products"
												target="_blank"
												rel="noopener noreferrer"
												className="text-blue-tertiary hover:text-purple-primary transition-colors"
											>
												+60 16-461 4919 (WhatsApp)
											</a>
							</div>
						</div>
									<div className="flex items-start space-x-4">
										<div className="w-12 h-12 bg-green-600/10 rounded-xl flex items-center justify-center flex-shrink-0">
											<MdLocationOn size={24} className="text-green-600" />
							</div>
										<div>
											<h4 className="text-lg font-semibold text-gray-700 mb-1">Address</h4>
											<p className="text-gray-600">
											31-10-11, The CEO, Lebuh Nipah 5, 11950, Bayan Lepas, Penang
							</p>
						</div>
							</div>
							</div>
						</div>
						</div>
					</div>
				</div>
			</section>

			{/* FAQs Section */}
			<section className="py-12 sm:py-16 lg:py-20 xl:py-24 bg-gray-50/20 w-full" id="faqs">
				<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
					<div className="text-center mb-8 lg:mb-12">
						<div className="inline-flex items-center px-4 py-2 bg-purple-primary/10 rounded-full mb-4 sm:mb-6 border border-purple-primary/20">
							<span className="text-xs sm:text-sm font-semibold text-purple-primary">
								Common Questions
							</span>
						</div>
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-gray-700 px-4">
							Frequently Asked Questions
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 mx-auto font-body px-4 max-w-none lg:max-w-4xl">
							Find answers to common questions about our services
						</p>
					</div>

					<div className="max-w-4xl mx-auto">
						<div className="space-y-4">
							{faqs.map((faq, index) => (
								<div key={index} className="bg-white rounded-xl border border-gray-100 shadow-sm">
									<button
										onClick={() => toggleFaq(index)}
										className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors rounded-xl"
									>
										<span className="text-lg font-semibold text-gray-700 pr-4">
											{faq.question}
										</span>
										{openFaq === index ? (
											<MdExpandLess size={24} className="text-purple-primary flex-shrink-0" />
										) : (
											<MdExpandMore size={24} className="text-gray-400 flex-shrink-0" />
										)}
									</button>
									{openFaq === index && (
										<div className="px-6 pb-4">
											<p className="text-gray-600 leading-relaxed">
												{faq.answer}
											</p>
								</div>
									)}
									</div>
								))}
							</div>
								</div>
									</div>
			</section>

			{/* Footer */}
			<Footer />
		</div>
	);
}