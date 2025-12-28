"use client";

import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PrivacyPolicy() {
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
							Privacy Policy
						</h1>
						<p className="text-sm text-gray-500 font-body">
							Last updated: 28 December 2025
						</p>
					</div>

					<div className="prose prose-lg max-w-none font-body text-gray-700">
						<p className="mb-8">
							This Privacy Policy (&quot;Policy&quot;) describes how OPG Capital Holdings Sdn. Bhd. (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) 
							collects, uses, stores, processes, discloses, and protects personal data when you access or use the 
							CreditXpress mobile application (&quot;App&quot;) and any related services.
						</p>
						<p className="mb-4">This Policy is intended to meet the requirements of:</p>
						<ul className="list-disc pl-6 space-y-2 mb-8">
							<li>Google Play Developer Program Policies</li>
							<li>Malaysia Personal Data Protection Act 2010 (PDPA)</li>
							<li>Applicable consumer credit, money-lending, and regulatory requirements</li>
						</ul>
						<p className="mb-8">
							By downloading, accessing, or using the App, you acknowledge that you have read, understood, and agreed to this Privacy Policy.
						</p>

						{/* Section 1 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">1. Company Information & Contact Details</h2>
							<p className="mb-2"><strong>Legal Entity Name:</strong> OPG Capital Holdings Sdn. Bhd.</p>
							<p className="mb-2"><strong>Registration Number:</strong> 202101043135</p>
							<p className="mb-2"><strong>Registered Address:</strong> 31-10-11, The CEO, Lebuh Nipah 5, 11950, Bayan Lepas, Penang, Malaysia</p>
							<p className="mb-2"><strong>Country of Operation:</strong> Malaysia</p>
							<p className="mb-2"><strong>Customer Support Email:</strong> hello@creditxpress.com.my</p>
							<p className="mb-4"><strong>Privacy & Data Protection Contact:</strong> hello@creditxpress.com.my</p>
							<p>All privacy-related enquiries, requests, or complaints should be directed to the contact details above.</p>
						</section>

						{/* Section 2 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">2. Application Scope & Applicability</h2>
							<p className="mb-2">This Privacy Policy applies to:</p>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>The CreditXpress Android mobile application</li>
								<li>Services and features provided through the App</li>
								<li>Communications related to your user account or financing services</li>
							</ul>
							<p>
								This Policy does not apply to third-party websites, services, or applications that may be linked from the App. 
								We are not responsible for the privacy practices of such third parties.
							</p>
						</section>

						{/* Section 3 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">3. Principles of Data Collection</h2>
							<p className="mb-2">We adhere to the following principles:</p>
							<ul className="list-disc pl-6 space-y-2">
								<li>Personal data is collected only where necessary</li>
								<li>Data collection is limited to legal, regulatory, and operational purposes</li>
								<li>Data is processed lawfully, fairly, and transparently</li>
								<li>We do not sell personal data</li>
								<li>We do not collect data for advertising resale or profiling purposes</li>
							</ul>
						</section>

						{/* Section 4 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">4. Categories of Personal Data Collected</h2>
							
							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">4.1 Identity & Personal Information</h3>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Full legal name</li>
								<li>National identification number (NRIC) or passport number</li>
								<li>Date of birth</li>
								<li>Gender (where required for verification)</li>
								<li>Residential and correspondence address</li>
								<li>Email address</li>
								<li>Mobile phone number</li>
							</ul>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">4.2 Financial & Employment Information</h3>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Employment status and employer details</li>
								<li>Income and affordability information</li>
								<li>Bank account details (for loan disbursement and repayment)</li>
								<li>Financing application details and supporting documents</li>
							</ul>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">4.3 Identity Verification & Compliance Data</h3>
							<p className="mb-2">To comply with regulatory obligations (including eKYC and AML/CFT), we may collect:</p>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Identity document images</li>
								<li>Selfie or liveness verification images</li>
								<li>Verification results from identity verification service providers</li>
								<li>Screening results relating to fraud, sanctions, or politically exposed persons (PEP)</li>
							</ul>
							<p>This data is collected solely for compliance and risk-management purposes.</p>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">4.4 Technical, Device & Usage Data</h3>
							<p className="mb-2">When you use the App, we may automatically collect:</p>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Device type, model, and operating system</li>
								<li>App version</li>
								<li>IP address</li>
								<li>Log files and crash diagnostics</li>
								<li>App usage and interaction data</li>
							</ul>
							<p>This data is used to ensure app functionality, stability, and security.</p>
						</section>

						{/* Section 5 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">5. How We Collect Personal Data</h2>
							<p className="mb-2">Personal data is collected through:</p>
							<ul className="list-disc pl-6 space-y-2">
								<li>Information you provide directly within the App</li>
								<li>Automated technologies such as logs, SDKs, and system diagnostics</li>
								<li>Third-party service providers engaged for compliance, verification, or payment processing</li>
								<li>Lawfully permitted sources required for regulatory checks</li>
							</ul>
						</section>

						{/* Section 6 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">6. Purpose of Processing Personal Data</h2>
							<p className="mb-4">We collect and process personal data strictly for the following purposes:</p>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">6.1 Regulatory & Legal Compliance</h3>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Identity verification</li>
								<li>AML/CFT compliance</li>
								<li>Record-keeping and audit requirements</li>
								<li>Responding to lawful requests from authorities</li>
							</ul>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">6.2 Financing & Account Services</h3>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Processing financing applications</li>
								<li>Assessing creditworthiness and affordability</li>
								<li>Managing user accounts</li>
								<li>Disbursing funds and processing repayments</li>
							</ul>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">6.3 Security & Fraud Prevention</h3>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Detecting and preventing fraudulent activity</li>
								<li>Ensuring system integrity and security</li>
								<li>Monitoring suspicious or unauthorised activity</li>
							</ul>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">6.4 Operational & Support Purposes</h3>
							<ul className="list-disc pl-6 space-y-2">
								<li>Customer support and communications</li>
								<li>System maintenance and improvement</li>
								<li>Internal reporting and analytics (non-marketing)</li>
							</ul>
						</section>

						{/* Section 7 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">7. Legal Basis for Processing</h2>
							<p className="mb-2">Personal data is processed based on:</p>
							<ul className="list-disc pl-6 space-y-2">
								<li>Your consent</li>
								<li>Performance of contractual obligations</li>
								<li>Compliance with legal and regulatory requirements</li>
								<li>Legitimate interests such as fraud prevention and system security</li>
							</ul>
						</section>

						{/* Section 8 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">8. Data Sharing & Disclosure</h2>
							<p className="mb-4">We disclose personal data only where necessary, including to:</p>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">8.1 Authorised Service Providers</h3>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Identity verification providers</li>
								<li>Compliance and screening vendors</li>
								<li>Banking and payment partners</li>
								<li>IT infrastructure and hosting providers</li>
							</ul>
							<p className="mb-4">All service providers are contractually bound to protect personal data and use it only for authorised purposes.</p>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">8.2 Regulatory & Government Authorities</h3>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Regulatory bodies</li>
								<li>Law enforcement agencies</li>
								<li>Courts or tribunals, where legally required</li>
							</ul>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">8.3 Business Transactions</h3>
							<p className="mb-4">
								In the event of a merger, acquisition, restructuring, or sale of assets, personal data may be transferred 
								subject to confidentiality and legal safeguards.
							</p>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">8.4 No Sale of Personal Data</h3>
							<p>We do not sell, rent, trade, or monetise personal data.</p>
						</section>

						{/* Section 9 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">9. Data Retention Period</h2>
							<p className="mb-2">Personal data is retained only for as long as necessary to:</p>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Fulfil the purposes outlined in this Policy</li>
								<li>Comply with statutory, regulatory, and audit requirements</li>
								<li>Resolve disputes and enforce agreements</li>
							</ul>
							<p>Where retention is no longer required, data is securely deleted or anonymised.</p>
						</section>

						{/* Section 10 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">10. Account & Personal Data Deletion</h2>
							<p className="mb-2">Users may request:</p>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Account deletion</li>
								<li>Personal data deletion</li>
							</ul>
							<p className="mb-4">Account deletion is not available if there are active or outstanding loans.</p>
							<p>
								Detailed instructions and conditions are available at:<br />
								<Link href="/account-and-data-deletion" className="text-purple-primary hover:text-purple-700 font-semibold">
									👉 https://creditxpress.com.my/account-and-data-deletion
								</Link>
							</p>
						</section>

						{/* Section 11 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">11. User Rights</h2>
							<p className="mb-2">Subject to applicable laws, users may:</p>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Request access to their personal data</li>
								<li>Request correction of inaccurate or outdated data</li>
								<li>Withdraw consent (where applicable)</li>
								<li>Request deletion of personal data (subject to legal limitations)</li>
							</ul>
							<p>Requests may be submitted to <strong>hello@creditxpress.com.my</strong>.</p>
						</section>

						{/* Section 12 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">12. Data Security Measures</h2>
							<p className="mb-2">We implement reasonable administrative, technical, and physical safeguards, including:</p>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Encryption of data in transit and at rest</li>
								<li>Access controls and authentication mechanisms</li>
								<li>Role-based access restrictions</li>
								<li>Ongoing system monitoring and security reviews</li>
							</ul>
							<p>Despite these measures, no method of transmission or storage is completely secure.</p>
						</section>

						{/* Section 13 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">13. Cookies & Similar Technologies</h2>
							<p className="mb-2">The App may use cookies or similar technologies for:</p>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Essential functionality</li>
								<li>Security</li>
								<li>Performance monitoring</li>
							</ul>
							<p>These technologies are not used for third-party advertising or behavioural profiling.</p>
						</section>

						{/* Section 14 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">14. Cross-Border Data Transfers</h2>
							<p>
								Where required, personal data may be transferred outside Malaysia to trusted service providers, 
								subject to appropriate safeguards and compliance with applicable laws.
							</p>
						</section>

						{/* Section 15 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">15. Children&apos;s Privacy</h2>
							<p className="mb-2">The App is intended only for individuals 18 years of age or older.</p>
							<p>We do not knowingly collect personal data from minors.</p>
						</section>

						{/* Section 16 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">16. Changes to This Privacy Policy</h2>
							<p className="mb-2">We may update this Privacy Policy from time to time.</p>
							<p className="mb-2">Any updates will be published on this page with a revised &quot;Last Updated&quot; date.</p>
							<p>Continued use of the App constitutes acceptance of the updated Policy.</p>
						</section>

						{/* Section 17 */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">17. Governing Law</h2>
							<p>
								This Privacy Policy is governed by and construed in accordance with the laws of Malaysia.
							</p>
						</section>
					</div>
				</div>
			</div>

			<Footer />
		</div>
	);
}

