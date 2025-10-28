"use client";

import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function RiskDisclosure() {
	return (
		<div className="min-h-screen bg-offwhite">
			<Navbar bgStyle="bg-white shadow-sm" />
			
			<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
				<Link 
					href="/"
					className="inline-flex items-center text-purple-primary hover:text-purple-700 font-semibold mb-8 transition-colors"
				>
					<MdArrowBack size={20} className="mr-2" />
					Back to Home
				</Link>

				<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 lg:p-12">
					<div className="mb-8">
						<h1 className="text-4xl lg:text-5xl font-heading font-bold text-gray-900 mb-4">
							Risk Disclosure
						</h1>
						<p className="text-sm text-gray-500 font-body">
							Last updated: 28 October 2025
						</p>
					</div>

					<div className="prose prose-lg max-w-none font-body text-gray-700">
						<div className="mb-8 p-6 bg-purple-primary/5 rounded-xl border border-purple-primary/20">
							<p className="mb-2"><strong>Operator:</strong> OPG Capital Holdings Sdn Bhd (202101043135)</p>
							<p className="mb-2"><strong>KPKT Licence:</strong> WL3337/07/01-11/020227</p>
							<p className="mb-2"><strong>Registered Address:</strong> 31-10-11, The CEO, Lebuh Nipah 5, 11950, Bayan Lepas, Penang, Malaysia</p>
							<p className="mb-2"><strong>Email:</strong> opgcapital3@gmail.com</p>
							<p><strong>Office Hours:</strong> 9:00 AM – 5:00 PM (Mon–Fri)</p>
						</div>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">1) Purpose of this Disclosure</h2>
							<p>
								Borrowing involves costs and risks. This Risk Disclosure helps you understand the key risks when applying for and 
								repaying loans through CreditXpress in Malaysia. It supplements (and does not replace) your <strong>Loan Agreement</strong>, 
								<strong>Terms of Service</strong>, <strong>Terms of Use</strong>, <strong>Privacy Notice</strong>, and <strong>PDPA Policy</strong>. 
								If there is any conflict, your <strong>Loan Agreement</strong> and legally-required disclosures prevail.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">2) Key Borrowing Risks (at a glance)</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li><strong>Affordability risk:</strong> Taking a loan that strains your budget can lead to missed payments and additional charges.</li>
								<li><strong>Interest & fee risk:</strong> You incur costs as set out in your Loan Agreement. Costs may increase if payments are late.</li>
								<li><strong>Late payment risk:</strong> Amounts in arrears attract <strong>late payment costs at 8% p.a.</strong> (see Section 3).</li>
								<li><strong>Credit profile risk:</strong> Late or missed payments may be reported to Malaysian credit reporting bodies and <strong>adversely affect your credit score/profile</strong> (see Section 4).</li>
								<li><strong>Default risk:</strong> Persistent non-payment may result in <strong>default</strong>, collection action, legal proceedings, and additional costs (see Section 5).</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">3) Late Payment Costs (8% p.a. on arrears)</h2>
							<p className="mb-4">
								If you miss a payment (in part or in full), the <strong>amount in arrears</strong> will accrue 
								<strong> late payment costs at 8% per annum</strong>, calculated <strong>daily</strong> on the overdue sum 
								<strong> until the arrears are cleared</strong>. This late charge applies only to overdue amounts, not to amounts that are not yet due.
							</p>
							<div className="bg-gray-50 p-4 rounded-lg mb-4">
								<p className="font-semibold mb-2">Daily calculation (simple interest):</p>
								<p className="font-mono text-sm">Late Cost = (8% ÷ 365) × (Days in arrears) × (Amount in arrears)</p>
							</div>
							<div className="bg-blue-50 p-4 rounded-lg">
								<p className="font-semibold mb-3">Illustrations (rounded to the nearest cent):</p>
								<ul className="space-y-2">
									<li>• Arrears <strong>RM1,000</strong> for <strong>30</strong> days → 0.08/365 × 30 × 1,000 = <strong>RM6.58</strong></li>
									<li>• Arrears <strong>RM2,500</strong> for <strong>45</strong> days → 0.08/365 × 45 × 2,500 = <strong>RM24.66</strong></li>
									<li>• Arrears <strong>RM5,000</strong> for <strong>90</strong> days → 0.08/365 × 90 × 5,000 = <strong>RM98.63</strong></li>
								</ul>
							</div>
							<p className="mt-4 text-sm italic">
								Late costs are in addition to your contracted interest/fees. Refer to your Loan Agreement for all rates, fees, and any other applicable charges.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">4) Credit Score / Profile Impact in Malaysia</h2>
							<p className="mb-4">
								Your repayment behaviour may be reported to Malaysian credit reporting and reference systems, including:
							</p>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li><strong>CTOS Data Systems</strong> (CTOS)</li>
								<li><strong>Experian Information Services (Malaysia)</strong> (formerly RAMCI)</li>
								<li><strong>CCRIS</strong> (Central Credit Reference Information System, maintained by Bank Negara Malaysia) — a credit <strong>reporting</strong> reference, not a score</li>
							</ul>
							<div className="bg-orange-50 p-4 rounded-lg">
								<p className="font-semibold mb-2">Potential impacts if you pay late or default:</p>
								<ul className="list-disc pl-6 space-y-2">
									<li>Negative records may appear in your credit reports (e.g., arrears, defaults).</li>
									<li>Your <strong>credit score (e.g., CTOS/Experian)</strong> may decline, affecting your ability to obtain credit in future or resulting in less favourable terms.</li>
									<li>Negative records may remain visible for a period permitted by applicable law and the policies of the reporting bodies.</li>
								</ul>
							</div>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">5) Default Consequences</h2>
							<p className="mb-4">
								If you <strong>fail to pay</strong> as required and do not cure your arrears:
							</p>
							<ul className="list-disc pl-6 space-y-2">
								<li>Your account may be classified as <strong>in default</strong> in accordance with your Loan Agreement.</li>
								<li>We may <strong>accelerate</strong> amounts due as allowed by law and your agreement.</li>
								<li>We may commence <strong>collection</strong> measures, including reminders, formal notices, and third-party recovery agents (subject to legal and conduct standards).</li>
								<li>You may incur <strong>additional costs</strong> reasonably incurred in recovering the debt (as permitted by law and your Loan Agreement).</li>
								<li>We may initiate <strong>legal proceedings</strong> and/or obtain <strong>judgment</strong>, which can have further legal and financial consequences.</li>
								<li>We may <strong>report</strong> adverse information to <strong>CTOS</strong>, <strong>Experian</strong>, and reflect status in <strong>CCRIS</strong>, impacting your credit profile.</li>
							</ul>
							<div className="bg-yellow-50 p-4 rounded-lg mt-4 border-l-4 border-yellow-400">
								<p className="font-semibold">
									If you are facing difficulty, contact us early at opgcapital3@gmail.com. Early engagement may help avoid 
									compounding costs and credit impact.
								</p>
							</div>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">6) Your Responsibilities</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li><strong>Borrow responsibly:</strong> Consider total cost of credit, not just the instalment amount.</li>
								<li><strong>Budget for repayments:</strong> Ensure you can meet payments on time and in full.</li>
								<li><strong>Keep details current:</strong> Notify us promptly if your contact or employment information changes.</li>
								<li><strong>Read everything:</strong> Review the Loan Agreement, disclosure statements, and this Risk Disclosure before accepting.</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">7) Early Payment / Prepayment</h2>
							<p>
								If your Loan Agreement allows <strong>early payment or full settlement</strong>, you may reduce future interest. 
								Refer to your <strong>Loan Agreement</strong> for exact treatment of interest, fees, and any applicable rebates/charges 
								on early settlement.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">8) No Financial Advice</h2>
							<p>
								This page is <strong>informational</strong> and does not constitute financial advice. If in doubt, seek independent 
								advice before borrowing.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">9) Contact & Complaints</h2>
							<p className="mb-2">
								<strong>Email:</strong> opgcapital3@gmail.com (9:00 AM – 5:00 PM, Mon–Fri)
							</p>
							<p>
								We will acknowledge and address complaints in a timely manner. If unresolved, you may seek recourse under 
								applicable Malaysian laws/regulators (including KPKT) or via the Malaysian courts.
							</p>
						</section>
					</div>
				</div>
			</div>

			<Footer />
		</div>
	);
}

