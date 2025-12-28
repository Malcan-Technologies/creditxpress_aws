"use client";

import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PrivacyNotice() {
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
							Privacy Notice
						</h1>
						<p className="text-sm text-gray-500 font-body">
							Last updated: 28 October 2025
						</p>
					</div>

					<div className="prose prose-lg max-w-none font-body text-gray-700">
						<p className="mb-8">
							This Privacy Notice explains how CreditXpress processes personal data in Malaysia under the 
							<strong> Personal Data Protection Act 2010 (PDPA)</strong> and other applicable laws 
							(e.g., <strong>AMLA 2001</strong>, <strong>Moneylenders Act 1951</strong>, <strong>Credit Reporting Agencies Act 2010</strong>).
						</p>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">1. Data Controller & Contact</h2>
							<p className="mb-2"><strong>OPG Capital Holdings Sdn Bhd (202101043135)</strong></p>
							<p className="mb-2"><strong>Registered Address:</strong> 31-10-11, The CEO, Lebuh Nipah 5, 11950, Bayan Lepas, Penang, Malaysia</p>
							<p><strong>Email:</strong> hello@creditxpress.com.my (Office hours: 9:00 AM – 5:00 PM, Mon–Fri)</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">2. What Data We Collect</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li><strong>Identification & KYC:</strong> name, NRIC/Passport, DOB, address, contact details, selfies/liveness data, biometric checks (where permitted), occupation, employer.</li>
								<li><strong>Financial & Credit:</strong> income, bank details (masked where possible), repayment history, credit reports/scores from registered credit reporting agencies (e.g., CTOS/Experian), lawful public data sources.</li>
								<li><strong>Transaction & Usage:</strong> loan applications, approvals, repayments, device data, IP address, cookies, analytics, support interactions.</li>
								<li><strong>Sensitive Data:</strong> processed only where required/permitted by law (e.g., AML/CFT screening).</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">3. How We Collect Data</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li>Directly from you (forms, e-KYC, communications);</li>
								<li>Automatically via cookies/SDKs;</li>
								<li>From third parties (credit bureaus, identity verification providers, payment providers) with your consent or as permitted by law.</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">4. Why We Process Your Data (Purposes)</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li><strong>Provide Services:</strong> onboarding, identity verification, underwriting, loan servicing, collections.</li>
								<li><strong>Compliance:</strong> AML/CFT screening, sanctions checks, regulatory reporting, KPKT obligations.</li>
								<li><strong>Operations:</strong> fraud prevention, security, troubleshooting, analytics, service improvement.</li>
								<li><strong>Communications:</strong> service notices, repayment reminders, regulatory updates.</li>
								<li><strong>Marketing (optional):</strong> with your consent; you may opt out at any time.</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">5. Legal Bases (PDPA Principles)</h2>
							<p>
								We process personal data in line with PDPA principles of <strong>Notice & Choice</strong>, <strong>Disclosure</strong>, 
								<strong>Security</strong>, <strong>Retention</strong>, <strong>Data Integrity</strong>, and <strong>Access & Correction</strong>. 
								Where consent is required, we will obtain it. Certain processing is necessary for contract performance, legal obligations, 
								or our legitimate interests (e.g., fraud prevention).
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">6. Disclosures (Who We Share With)</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li><strong>Service providers</strong> (KYC/AML, hosting, payments, messaging) under confidentiality and PDPA obligations;</li>
								<li><strong>Credit reporting agencies</strong> (e.g., CTOS/Experian) for credit checks and reporting;</li>
								<li><strong>Regulators and law enforcement</strong> (e.g., KPKT) where legally required;</li>
								<li><strong>Advisers and auditors</strong> for compliance/governance;</li>
								<li><strong>Successors</strong> in a corporate transaction, as permitted by law.</li>
							</ul>
							<p className="mt-4">We do <strong>not</strong> sell personal data.</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">7. Cross-Border Transfers</h2>
							<p>
								Where data is transferred outside Malaysia, we use appropriate safeguards to ensure a PDPA-compliant level of protection 
								(e.g., contractual clauses).
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">8. Data Security</h2>
							<p>
								We apply administrative, technical, and physical safeguards proportionate to the sensitivity of the data, including 
								encryption in transit, access controls, and monitoring. No method is 100% secure; we continually improve protections.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">9. Retention</h2>
							<p>
								We retain data as required by law (Moneylenders Act, AMLA) and for legitimate business needs (records, audits). 
								Data is securely disposed of when no longer required.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">10. Account Closure and Personal Data Deletion</h2>
							<p className="mb-4">
								You may request the closure of your CreditXpress account and/or the deletion of your personal data, 
								subject to applicable laws and regulatory requirements.
							</p>
							<p className="mb-4">
								Account closure is not available for accounts with active or outstanding loan obligations.
							</p>
							<p className="mb-4">
								Details on eligibility, procedures, and data retention are set out in:
							</p>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>
									<strong>Account & Personal Data Deletion:</strong><br />
									<a href="https://creditxpress.com.my/account-and-data-deletion" className="text-purple-primary hover:text-purple-700">
										https://creditxpress.com.my/account-and-data-deletion
									</a>
								</li>
								<li>
									<strong>Privacy Policy:</strong><br />
									<a href="https://creditxpress.com.my/privacy-policy" className="text-purple-primary hover:text-purple-700">
										https://creditxpress.com.my/privacy-policy
									</a>
								</li>
							</ul>
							<p>
								Requests may be submitted via the channels specified in the links above.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">11. Cookies & Tracking</h2>
							<p>
								We use cookies for session management, analytics, security, and—if you consent—marketing. You can manage cookies in 
								your browser. Some features may not function without essential cookies.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">12. Children&apos;s Data</h2>
							<p>
								Our Services are not intended for individuals under 18. We do not knowingly collect such data.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">13. Updates</h2>
							<p>
								We may update this Notice and will post the revised version with a new &quot;Last updated&quot; date.
							</p>
						</section>
					</div>
				</div>
			</div>

			<Footer />
		</div>
	);
}

