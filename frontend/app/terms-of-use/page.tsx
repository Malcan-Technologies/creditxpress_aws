"use client";

import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function TermsOfUse() {
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
							Terms of Use
						</h1>
						<p className="text-sm text-gray-500 font-body">
							Last updated: 28 October 2025
						</p>
					</div>

					<div className="prose prose-lg max-w-none font-body text-gray-700">
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">1. Scope</h2>
							<p>
								These Terms of Use govern your access to <strong>creditxpress.com.my</strong> and our app interfaces (the "Site"). 
								For borrowing and account activities, refer to the <strong>Terms of Service</strong>.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">2. Acceptable Use</h2>
							<p>
								Use the Site lawfully and responsibly. Do not compromise security, attempt unauthorised access, scrape or replicate 
								content without consent, or upload unlawful/infringing content.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">3. Accounts</h2>
							<p>
								You are responsible for your credentials and all activities under your account. Notify us promptly of unauthorised access.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">4. Content & IP</h2>
							<p>
								The Site and its contents are owned by or licensed to CreditXpress. You are granted a limited, non-exclusive licence 
								to access for personal, non-commercial use.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">5. Third-Party Links & Tools</h2>
							<p>
								Third-party links/integrations (e.g., payment gateways, e-KYC, credit agencies) are provided for convenience. 
								We are not responsible for their content, availability, or policies.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">6. Cookies & Analytics</h2>
							<p>
								We use cookies and similar technologies for performance, security, and analytics. See our <strong>Privacy Notice</strong> for 
								details and choices.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">7. No Financial Advice</h2>
							<p>
								Site content is <strong>general information</strong> only and not financial advice. Review your Loan Agreement and 
								assess suitability independently.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">8. Disclaimer & Limitation of Liability</h2>
							<p>
								The Site is provided "as is" and "as available." We do not warrant error-free or uninterrupted operation. 
								To the extent permitted by law, we exclude liability for indirect or consequential loss (see <strong>Terms of Service</strong> for 
								service-level terms).
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">9. Suspension/Termination</h2>
							<p>
								We may suspend or terminate access for security, legal, or policy reasons, or for breach of these Terms of Use.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">10. Governing Law</h2>
							<p>
								Malaysian law governs these Terms of Use. Disputes are subject to Malaysian courts.
							</p>
						</section>

						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">11. Contact</h2>
							<p>
								<strong>opgcapital3@gmail.com</strong> (Office hours: 9:00 AM – 5:00 PM, Mon–Fri)
							</p>
						</section>
					</div>
				</div>
			</div>

			<Footer />
		</div>
	);
}

