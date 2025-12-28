"use client";

import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function AccountAndDataDeletion() {
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
							Account & Personal Data Deletion
						</h1>
						<p className="text-sm text-gray-500 font-body">
							Last updated: 28 December 2025
						</p>
					</div>

					<div className="prose prose-lg max-w-none font-body text-gray-700">
						<p className="mb-8">
							CreditXpress ("we", "our", "us") respects your right to request deletion of your account and 
							personal data in accordance with applicable laws and regulatory requirements.
						</p>
						<p className="mb-8">
							This page explains:
						</p>
						<ul className="list-disc pl-6 space-y-2 mb-8">
							<li>How to request account deletion</li>
							<li>How to request personal data deletion</li>
							<li>Applicable conditions and limitations</li>
						</ul>

						{/* SECTION 1: ACCOUNT DELETION */}
						<section className="mb-10">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
								SECTION 1: ACCOUNT DELETION
							</h2>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">
								Eligibility for Account Deletion
							</h3>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Account deletion requests can only be processed if there are no active, outstanding, or overdue loans linked to the account.</li>
								<li>Accounts with active financing obligations cannot be deleted until all obligations have been fully settled.</li>
								<li>This restriction exists to comply with contractual, legal, and regulatory requirements.</li>
							</ul>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">
								How to Request Account Deletion
							</h3>
							<p className="mb-4">
								CreditXpress does not currently provide an in-app account deletion feature. 
								Account deletion requests are handled via email.
							</p>
							<p className="font-semibold mb-2">Steps:</p>
							<ol className="list-decimal pl-6 space-y-2 mb-4">
								<li>
									Send an email from your registered email address to:<br />
									<strong>📧 hello@creditxpress.com.my</strong>
								</li>
								<li>
									Use the subject line:<br />
									<strong>Account Deletion Request</strong>
								</li>
								<li>
									Include the following information:
									<ul className="list-disc pl-6 mt-2 space-y-1">
										<li>Full name</li>
										<li>Registered mobile number</li>
										<li>Registered email address</li>
									</ul>
								</li>
							</ol>
							<p className="mb-4">
								We may contact you to verify your identity before processing the request.
							</p>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">
								What Happens After Account Deletion
							</h3>
							<p className="mb-2">Once eligibility is confirmed and verification is completed:</p>
							<ul className="list-disc pl-6 space-y-2">
								<li>Your user account will be deactivated</li>
								<li>Login access to the app will be permanently disabled</li>
							</ul>
						</section>

						{/* SECTION 2: PERSONAL DATA DELETION */}
						<section className="mb-10">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
								SECTION 2: PERSONAL DATA DELETION
							</h2>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">
								Eligibility for Personal Data Deletion
							</h3>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Personal data deletion requests may be submitted regardless of account status, subject to legal and regulatory retention requirements.</li>
								<li>Where an account has active or past loans, certain personal data cannot be deleted immediately and must be retained as required by law.</li>
							</ul>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">
								How to Request Personal Data Deletion
							</h3>
							<p className="mb-4">
								Requests for personal data deletion are handled via email.
							</p>
							<p className="font-semibold mb-2">Steps:</p>
							<ol className="list-decimal pl-6 space-y-2 mb-4">
								<li>
									Send an email from your registered email address to:<br />
									<strong>📧 hello@creditxpress.com.my</strong>
								</li>
								<li>
									Use the subject line:<br />
									<strong>Personal Data Deletion Request</strong>
								</li>
								<li>
									Include:
									<ul className="list-disc pl-6 mt-2 space-y-1">
										<li>Full name</li>
										<li>Registered mobile number</li>
										<li>Registered email address</li>
										<li>Description of the data you wish to delete (if applicable)</li>
									</ul>
								</li>
							</ol>
							<p className="mb-4">
								We may contact you to verify your identity before processing the request.
							</p>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">
								Data That Will Be Deleted or Anonymised
							</h3>
							<p className="mb-2">Subject to eligibility and legal limits, we will delete or anonymise:</p>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>User profile information</li>
								<li>Contact details</li>
								<li>App usage and activity data</li>
							</ul>

							<h3 className="text-xl font-heading font-semibold text-gray-900 mt-6 mb-3">
								Data That Will Be Retained
							</h3>
							<p className="mb-2">The following data may be retained where required by law or regulatory obligations:</p>
							<ul className="list-disc pl-6 space-y-2 mb-4">
								<li>Loan and financing agreements</li>
								<li>Transaction and repayment records</li>
								<li>Compliance, audit, and dispute records</li>
							</ul>
							<p>Retained data will be securely stored and access-restricted.</p>
						</section>

						{/* Processing Time */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">Processing Time</h2>
							<p>
								Account and personal data deletion requests are processed within <strong>30 calendar days</strong> from successful verification.
							</p>
						</section>

						{/* Important Notes */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">Important Notes</h2>
							<ul className="list-disc pl-6 space-y-2">
								<li>Account deletion is not available for accounts with active or outstanding loans</li>
								<li>Certain personal data cannot be deleted immediately due to legal requirements</li>
								<li>Deletion may affect access to historical records</li>
							</ul>
						</section>

						{/* Contact */}
						<section className="mb-8">
							<h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">Contact</h2>
							<p>
								For questions regarding account or personal data deletion, contact:<br />
								<strong>📧 hello@creditxpress.com.my</strong>
							</p>
						</section>
					</div>
				</div>
			</div>

			<Footer />
		</div>
	);
}

