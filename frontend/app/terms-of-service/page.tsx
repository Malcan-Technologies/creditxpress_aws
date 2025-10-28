"use client";

import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function TermsOfService() {
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
							Terms of Service
						</h1>
						<p className="text-sm text-gray-500 font-body">
							Last updated: 28 October 2025
						</p>
					</div>

					<div className="prose prose-lg max-w-none font-body text-gray-700">
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">1. Who We Are</h2>
							<p className="mb-4">
								These Terms of Service ("Terms") govern the CreditXpress digital moneylending services ("Services"). 
								"CreditXpress", "we", "us", or "our" refers to <strong>OPG Capital Holdings Sdn Bhd (202101043135)</strong>, 
								licensed under the <strong>Ministry of Housing and Local Government (KPKT)</strong> (<strong>Licence No. WL3337/07/01-11/020227</strong>) 
								and operating under the <strong>Moneylenders Act 1951</strong> and applicable subsidiary regulations in Malaysia.
							</p>
							<p className="mb-2"><strong>Registered Address:</strong> 31-10-11, The CEO, Lebuh Nipah 5, 11950, Bayan Lepas, Penang, Malaysia.</p>
							<p><strong>Contact:</strong> opgcapital3@gmail.com (Office hours: 9:00 AM – 5:00 PM, Mon–Fri)</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">2. Acceptance of Terms</h2>
							<p>
								By creating an account, submitting a loan application, or using our Services, you agree to these Terms and our 
								<strong> Terms of Use</strong>, <strong>Privacy Notice</strong>, and <strong>PDPA Policy</strong>. 
								If you do not agree, do not use the Services.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">3. Eligibility</h2>
							<p>
								You must be at least 18 years old, legally capable of entering a contract in Malaysia, and use the Services for 
								lawful, personal purposes. You must provide accurate and up-to-date information for onboarding, <strong>e-KYC</strong>, 
								and credit assessment.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">4. Our Role</h2>
							<p>
								We operate a <strong>digital moneylending platform</strong> and may use third-party providers 
								(e.g., identity verification, credit reporting agencies, payment processors) to deliver parts of the Services.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">5. Loan Applications & Agreements</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li>Submitting an application does not guarantee approval. Approval is at our sole discretion and subject to underwriting criteria and applicable laws.</li>
								<li>If approved, your <strong>Loan Agreement</strong> and disclosures will state the <strong>principal</strong>, <strong>interest rate</strong>, <strong>fees/charges</strong>, <strong>repayment schedule</strong>, <strong>late charges</strong>, and <strong>default terms</strong> as required by KPKT.</li>
								<li>If there is any conflict, the <strong>Loan Agreement prevails</strong> for the relevant loan.</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">6. Disclosures, Fees, and Charges</h2>
							<p>
								All mandatory disclosures under the Moneylenders Act and KPKT guidelines will be provided before acceptance. 
								Interest, fees, and charges will be <strong>clearly disclosed</strong> and <strong>comply with Malaysian law</strong>. 
								You are responsible for any bank/third-party payment fees, where applicable.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">7. Repayments & Late Payment</h2>
							<p>
								You agree to repay according to your Loan Agreement. Late or missed payments may incur <strong>late charges</strong> and 
								lawful collection action. We may report non-payment or defaults to <strong>credit reporting agencies</strong> 
								(in accordance with the <strong>Credit Reporting Agencies Act 2010</strong> and the <strong>PDPA 2010</strong>).
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">8. Credit Checks & AML/CFT</h2>
							<p>
								You authorise us to conduct identity verification and <strong>credit checks</strong> with registered credit reporting 
								agencies (e.g., CTOS/Experian) and to perform <strong>AML/CFT</strong> screening under the 
								<strong> Anti-Money Laundering, Anti-Terrorism Financing and Proceeds of Unlawful Activities Act 2001 (AMLA)</strong>.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">9. Electronic Records & E-Signatures</h2>
							<p>
								You agree to receive disclosures electronically and to execute documents via <strong>electronic signatures</strong> under 
								the <strong>Electronic Commerce Act 2006</strong>. Our electronic records are <strong>prima facie</strong> evidence of transactions.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">10. Responsible Use & Borrower Obligations</h2>
							<p>
								Use loan proceeds for lawful purposes only, keep your contact/employment details current, and carefully review all 
								disclosures before acceptance.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">11. Accounts & Security</h2>
							<p>
								Keep your credentials secure. You are responsible for activities under your account. We may suspend/terminate access 
								for suspected fraud, misuse, breach of these Terms, or as required by law.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">12. Intellectual Property</h2>
							<p>
								All platform content and software are owned by or licensed to CreditXpress. You receive a limited, revocable, 
								non-transferable licence to use the Services for personal, lawful purposes.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">13. Prohibited Conduct</h2>
							<p>
								You must not: interfere with platform security; access other users' data; use bots/scrapers without consent; 
								upload unlawful/infringing content; or engage in activity that harms the platform, users, or our reputation.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">14. Service Availability</h2>
							<p>
								We strive for continuous availability but do not guarantee uninterrupted or error-free service. Maintenance and 
								events beyond our control may impact availability.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">15. Liability</h2>
							<p className="mb-2">To the maximum extent permitted by law:</p>
							<ul className="list-disc pl-6 space-y-2">
								<li>We are <strong>not liable</strong> for indirect, incidental, special, consequential, or punitive damages.</li>
								<li>Our total aggregate liability is limited to <strong>the fees paid by you to us in the 12 months</strong> prior to the event giving rise to the claim or <strong>RM1,000</strong>, whichever is higher.</li>
								<li>Nothing limits liability where prohibited by law.</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">16. Indemnity</h2>
							<p>
								You agree to indemnify and hold us harmless from claims or losses arising from your breach of these Terms, 
								misuse of the Services, or violation of law.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">17. Termination</h2>
							<p>
								We may suspend/terminate access (with notice where practicable) for breach, suspected fraud, or legal/regulatory reasons. 
								Your obligations for any outstanding loan survive termination.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">18. Complaints & Dispute Resolution</h2>
							<p>
								Complaints: <strong>opgcapital3@gmail.com</strong> (Office hours: 9:00 AM – 5:00 PM, Mon–Fri). 
								If unresolved, you may seek recourse under Malaysian law/regulators (including KPKT) or the Malaysian courts.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">19. Governing Law & Jurisdiction</h2>
							<p>
								These Terms are governed by the laws of <strong>Malaysia</strong>. You submit to the 
								<strong> exclusive jurisdiction of Malaysian courts</strong>.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">20. Changes to These Terms</h2>
							<p>
								We may update these Terms and will post the latest version with the "Last updated" date. Continued use signifies acceptance.
							</p>
						</section>
					</div>
				</div>
			</div>

			<Footer />
		</div>
	);
}

