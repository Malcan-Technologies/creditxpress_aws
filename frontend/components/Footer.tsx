import Link from "next/link";
import { MdShield } from "react-icons/md";
import Logo from "./Logo";

export default function Footer() {
	return (
		<footer className="bg-gradient-to-b from-gray-900 to-black text-white">
			{/* CTA Section */}
			{/* <div className="border-b border-brand-primary/20">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
					<div className="text-center">
						<h2 className="text-3xl font-bold mb-4 font-heading">
							Ready to Get Started?
						</h2>
						<p className="text-gray-300 mb-8 max-w-2xl mx-auto font-body">
							Join thousands of businesses and employees who trust
							Kapital for their financial needs.
						</p>
						<Link
							href="/apply"
							className="brand-button-primary inline-flex items-center text-lg font-semibold"
						>
							Apply Now
							<span className="ml-2">
								<MdArrowForward size={20} />
							</span>
						</Link>
					</div>
				</div>
			</div> */}

			{/* Links Section */}
			<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-12">
				<div className="max-w-4xl mx-auto">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-12">
						{/* Products */}
						<div className="text-left">
							<h3 className="text-lg font-semibold mb-6 font-heading text-purple-400">
								Products
							</h3>
							<ul className="space-y-3">
								<li>
									<Link
										href="/login"
										className="text-gray-300 hover:text-purple-400 transition-colors font-body"
									>
										Loan Dashboard
									</Link>
								</li>
								<li>
									<Link
										href="/signup"
										className="text-gray-300 hover:text-purple-400 transition-colors font-body"
									>
										Sign Up
									</Link>
								</li>
							</ul>
						</div>

						{/* Legal */}
						<div className="text-left">
							<h3 className="text-lg font-semibold mb-6 font-heading text-purple-400">
								Legal
							</h3>
							<ul className="space-y-3">
								<li>
									<Link
										href="/terms-of-service"
										className="text-gray-300 hover:text-purple-400 transition-colors font-body"
									>
										Terms of Service
									</Link>
								</li>
								<li>
									<Link
										href="/terms-of-use"
										className="text-gray-300 hover:text-purple-400 transition-colors font-body"
									>
										Terms of Use
									</Link>
								</li>
								<li>
									<Link
										href="/privacy-notice"
										className="text-gray-300 hover:text-purple-400 transition-colors font-body"
									>
										Privacy Notice
									</Link>
								</li>
								<li>
									<Link
										href="/pdpa-policy"
										className="text-gray-300 hover:text-purple-400 transition-colors font-body"
									>
										PDPA Policy
									</Link>
								</li>
								<li>
									<Link
										href="/risk-disclosure"
										className="text-gray-300 hover:text-purple-400 transition-colors font-body"
									>
										Risk Disclosure
									</Link>
								</li>
							</ul>
						</div>
					</div>
				</div>

				{/* Copyright */}
				<div className="mt-12 pt-8 border-t border-purple-primary/20">
					<div className="max-w-4xl mx-auto">
						<div className="flex flex-col space-y-6">
							{/* Logo and SSL Badge */}
							<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
								<Logo size="lg" variant="black" linkTo="/" />

								<div className="inline-flex items-center gap-2 bg-emerald-400/10 backdrop-blur-lg rounded-xl p-4 border border-emerald-400/30 w-fit">
									<span className="text-emerald-400 flex-shrink-0">
										<MdShield size={20} />
									</span>
									<div className="text-sm">
										<p className="text-emerald-400 font-medium font-body">
											SSL Secured
										</p>
										<p className="text-gray-400 text-xs font-body">
											256-bit encryption
										</p>
									</div>
								</div>
							</div>

							{/* Legal Text */}
							<div className="text-gray-400 space-y-4 font-body text-left">
								<p className="text-sm">
									Licensed under Moneylenders Act 1951, KPKT license no: WL3337/07/01-11/020227
								</p>
								<p className="text-sm">
									Company registration no: 202101043135 (1443435-P)
								</p>
								<p className="text-sm">
									Business address: 31-10-11, The CEO, Lebuh Nipah 5, 11950, Bayan Lepas, Penang
								</p>
								<p className="text-sm font-semibold">
									Disclaimer: "Please borrow responsibly. Loans are subject to approval and terms."
								</p>
								<p className="text-sm pt-4">
									© {new Date().getFullYear()} OPG Capital Holdings Sdn Bhd. All Rights Reserved.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
