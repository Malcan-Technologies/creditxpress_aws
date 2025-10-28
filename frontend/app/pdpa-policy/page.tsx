"use client";

import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PdpaPolicy() {
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
							PDPA Policy
						</h1>
						<p className="text-sm text-gray-500 font-body">
							Last updated: 28 October 2025
						</p>
					</div>

					<div className="prose prose-lg max-w-none font-body text-gray-700">
						<p className="mb-8">
							This PDPA Policy describes how CreditXpress implements governance and controls to comply with the 
							<strong> Personal Data Protection Act 2010 (PDPA)</strong>.
						</p>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">1. Governance & Accountability</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li>Management-level responsibility for data protection and compliance oversight.</li>
								<li>Role-appropriate PDPA training for staff.</li>
								<li>Policies, procedures, and records of processing activities maintained and reviewed.</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">2. Notice & Choice</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li>Clear <strong>Privacy Notices</strong> at points of data collection explaining purposes, categories, and disclosures.</li>
								<li>Explicit consent where required, with records of consent and mechanisms for <strong>withdrawal</strong> and <strong>marketing opt-out</strong>.</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">3. Purpose Limitation</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li>Data collected only for specified, lawful purposes related to onboarding, underwriting, servicing, compliance, and platform operations.</li>
								<li>Further processing for compatible purposes (e.g., fraud prevention, security improvements) is assessed and documented.</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">4. Data Minimisation & Accuracy</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li>Collect only what is necessary.</li>
								<li>Maintain accuracy via user self-service updates and verification with trusted sources.</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">5. Security Safeguards</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li>Layered controls: access management, encryption in transit, network hardening, logging/monitoring, backup and recovery, vendor due diligence.</li>
								<li>Security incidents handled under an incident response process, with notifications where required by law.</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">6. Retention & Disposal</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li>Retention periods set with reference to legal requirements (Moneylenders Act, AMLA) and business needs.</li>
								<li>Secure disposal methods for both physical and electronic records.</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">7. Data Subject Rights</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li>Processes for <strong>access</strong>/<strong>correction</strong> requests within statutory timelines;</li>
								<li>Consent withdrawal and marketing opt-out;</li>
								<li>Identity verification and secure response delivery.</li>
							</ul>
							<p className="mt-4">
								Requests: <strong>opgcapital3@gmail.com</strong> (Office hours: 9:00 AM – 5:00 PM, Mon–Fri)
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">8. Third Parties & Cross-Border Transfers</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li>Vendor due diligence and PDPA-compliant contracts.</li>
								<li>Cross-border transfers safeguarded to ensure PDPA-comparable protection.</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">9. Credit Reporting & AML/CFT</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li>Credit assessment/reporting and AML/CFT screening conducted under the <strong>Credit Reporting Agencies Act 2010</strong> and <strong>AMLA 2001</strong>.</li>
								<li>Adverse information may be reported to credit reporting agencies as permitted by law and the Loan Agreement.</li>
							</ul>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">10. Governance Reviews</h2>
							<p>
								Periodic reviews and audits; updates to reflect regulatory changes or guidance from Malaysian authorities (including KPKT).
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">11. Contact & Complaints</h2>
							<p>
								Questions or complaints: <strong>opgcapital3@gmail.com</strong>. If unresolved, you may seek recourse under 
								Malaysian law and with relevant authorities.
							</p>
						</section>
					</div>
				</div>
			</div>

			<Footer />
		</div>
	);
}

