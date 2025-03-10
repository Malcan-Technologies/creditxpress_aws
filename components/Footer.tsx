import Link from "next/link";
import { MdArrowForward, MdShield } from "react-icons/md";

export default function Footer() {
	return (
		<footer className="bg-[#0A0612] text-white">
			{/* CTA Section */}
			<div className="border-b border-white/10">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
					<div className="text-center">
						<h2 className="text-3xl font-bold mb-4">
							Ready to Get Started?
						</h2>
						<p className="text-gray-300 mb-8 max-w-2xl mx-auto">
							Join thousands of businesses and employees who trust
							Kapital for their financial needs.
						</p>
						<Link
							href="/apply"
							className="inline-flex items-center bg-white text-purple-900 px-6 py-3 rounded-full hover:bg-purple-50 transition-all text-lg font-semibold"
						>
							Apply Now
							<span className="ml-2">
								<MdArrowForward size={20} />
							</span>
						</Link>
					</div>
				</div>
			</div>

			{/* Links Section */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="grid grid-cols-2 md:grid-cols-4 gap-8">
					{/* Products */}
					<div>
						<h3 className="text-lg font-semibold mb-4">Products</h3>
						<ul className="space-y-3">
							<li>
								<Link
									href="/pay-advance"
									className="text-gray-300 hover:text-white"
								>
									PayAdvance™
								</Link>
							</li>
							<li>
								<Link
									href="/equipment-financing"
									className="text-gray-300 hover:text-white"
								>
									Equipment Financing
								</Link>
							</li>
							<li>
								<Link
									href="/sme-term-loan"
									className="text-gray-300 hover:text-white"
								>
									SME Term Loan
								</Link>
							</li>
							<li>
								<Link
									href="/products"
									className="text-gray-300 hover:text-white"
								>
									Borrow
								</Link>
							</li>
						</ul>
					</div>

					{/* Company */}
					<div>
						<h3 className="text-lg font-semibold mb-4">Company</h3>
						<ul className="space-y-3">
							<li>
								<Link
									href="/about"
									className="text-gray-300 hover:text-white"
								>
									About Us
								</Link>
							</li>

							<li>
								<Link
									href="/careers"
									className="text-gray-300 hover:text-white"
								>
									Careers
								</Link>
							</li>
							<li>
								<Link
									href="/press"
									className="text-gray-300 hover:text-white"
								>
									Press
								</Link>
							</li>
						</ul>
					</div>

					{/* Resources */}
					<div>
						<h3 className="text-lg font-semibold mb-4">
							Resources
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									href="/blog"
									className="text-gray-300 hover:text-white"
								>
									Blog
								</Link>
							</li>
							<li>
								<Link
									href="/help"
									className="text-gray-300 hover:text-white"
								>
									Help Center
								</Link>
							</li>
							<li>
								<Link
									href="/guides"
									className="text-gray-300 hover:text-white"
								>
									Guides
								</Link>
							</li>
							<li>
								<Link
									href="/calculator"
									className="text-gray-300 hover:text-white"
								>
									Loan Calculator
								</Link>
							</li>
						</ul>
					</div>

					{/* Legal */}
					<div>
						<h3 className="text-lg font-semibold mb-4">Legal</h3>
						<ul className="space-y-3">
							<li>
								<Link
									href="/privacy"
									className="text-gray-300 hover:text-white"
								>
									Privacy Policy
								</Link>
							</li>
							<li>
								<Link
									href="/terms"
									className="text-gray-300 hover:text-white"
								>
									Terms of Service
								</Link>
							</li>
						</ul>
					</div>
				</div>

				{/* Copyright */}
				<div className="mt-12 pt-8 border-t border-white/10">
					<div className="flex flex-col space-y-6">
						{/* SSL Badge - Shown at top on all screens */}
						<div className="flex justify-start">
							<div className="inline-flex items-center gap-2 bg-[#0F0A1F] backdrop-blur-lg rounded-xl p-4 border border-white/10 w-fit">
								<span className="text-green-400 flex-shrink-0">
									<MdShield size={20} />
								</span>
								<div className="text-sm">
									<p className="text-green-400 font-medium">
										SSL Secured
									</p>
									<p className="text-gray-400 text-xs">
										256-bit encryption
									</p>
								</div>
							</div>
						</div>

						{/* Legal Text */}
						<div className="text-gray-400 space-y-4">
							<p>
								© {new Date().getFullYear()} Kapital. All rights
								reserved.
							</p>
							<p>
								Kapital is a financial technology platform and
								is not a bank. It does not fall under the
								jurisdiction of Bank Negara Malaysia. Therefore,
								financing products of Kapital should not be
								constructed as business loan, SME loan, micro
								loan, term loan or any other loans offered by
								banks in Malaysia and it is to be deemed as an
								investment note as defined in the Guidelines on
								Recognised Markets.
							</p>
							<p>
								Lending products offered by OPG Capital Holdings
								Sdn. Bhd. (KPKT License: WL3337/07/01-9/020223).
							</p>
							<p>
								Disclaimer: All third party trademarks, product
								and company names are the property of their
								respective holders.
							</p>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
