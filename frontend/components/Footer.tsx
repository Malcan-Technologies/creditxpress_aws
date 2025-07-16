import Link from "next/link";
import { MdArrowForward, MdShield } from "react-icons/md";
import { FaInstagram, FaFacebook, FaTiktok, FaLinkedin } from "react-icons/fa";
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
				<div className="grid grid-cols-2 md:grid-cols-4 gap-8">
					{/* Products */}
					<div>
						<h3 className="text-lg font-semibold mb-4 font-heading text-purple-400">
							Products
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									href="/pay-advance"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									PayAdvance™
								</Link>
							</li>
							<li>
								<Link
									href="/equipment-financing"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									Equipment Financing
								</Link>
							</li>
							<li>
								<Link
									href="/sme-term-loan"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									SME Term Loan
								</Link>
							</li>
							<li>
								<Link
									href="/products"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									Borrow
								</Link>
							</li>
						</ul>
					</div>

					{/* Company */}
					<div>
						<h3 className="text-lg font-semibold mb-4 font-heading text-purple-400">
							Company
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									href="/about"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									About Us
								</Link>
							</li>
							<li>
								<Link
									href="/partners"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									Partners
								</Link>
							</li>
							<li>
								<Link
									href="/careers"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									Careers
								</Link>
							</li>
							<li>
								<Link
									href="/press"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									Press
								</Link>
							</li>
						</ul>
					</div>

					{/* Resources */}
					<div>
						<h3 className="text-lg font-semibold mb-4 font-heading text-purple-400">
							Resources
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									href="/blog"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									Blog
								</Link>
							</li>
							<li>
								<Link
									href="/help"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									Help Center
								</Link>
							</li>
							<li>
								<Link
									href="/guides"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									Guides
								</Link>
							</li>
							<li>
								<Link
									href="/calculator"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									Loan Calculator
								</Link>
							</li>
						</ul>
					</div>

					{/* Legal */}
					<div>
						<h3 className="text-lg font-semibold mb-4 font-heading text-purple-400">
							Legal
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									href="/privacy"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									Privacy Policy
								</Link>
							</li>
							<li>
								<Link
									href="/terms"
									className="text-gray-300 hover:text-gray-200 transition-colors font-body"
								>
									Terms of Service
								</Link>
							</li>
						</ul>
					</div>
				</div>

				{/* Copyright */}
				<div className="mt-12 pt-8 border-t border-purple-primary/20">
					<div className="flex flex-col space-y-6">
						{/* Logo, Social Media, and SSL Badge */}
						<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
							<div className="flex flex-col sm:flex-row sm:items-center gap-6">
								<Logo size="lg" variant="black" linkTo="/" />
								
								{/* Social Media Icons */}
								<div className="flex items-center gap-4">
									<Link
										href="https://instagram.com/kapital.my"
										target="_blank"
										rel="noopener noreferrer"
										className="text-gray-400 hover:text-purple-400 transition-colors duration-200"
										aria-label="Follow us on Instagram"
									>
										<FaInstagram size={24} />
									</Link>
									<Link
										href="https://facebook.com/kapital.my"
										target="_blank"
										rel="noopener noreferrer"
										className="text-gray-400 hover:text-purple-400 transition-colors duration-200"
										aria-label="Follow us on Facebook"
									>
										<FaFacebook size={24} />
									</Link>
									<Link
										href="https://tiktok.com/@kapital.my"
										target="_blank"
										rel="noopener noreferrer"
										className="text-gray-400 hover:text-purple-400 transition-colors duration-200"
										aria-label="Follow us on TikTok"
									>
										<FaTiktok size={24} />
									</Link>
									<Link
										href="https://linkedin.com/company/kapital-my"
										target="_blank"
										rel="noopener noreferrer"
										className="text-gray-400 hover:text-purple-400 transition-colors duration-200"
										aria-label="Follow us on LinkedIn"
									>
										<FaLinkedin size={24} />
									</Link>
								</div>
							</div>

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
						<div className="text-gray-400 space-y-4 font-body">
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
								Registered in Malaysia as OPG Capital Holdings
								Sdn. Bhd.
								<br />
								<i>KPKT License: WL3337/07/01-9/020223</i>
								<br />
								<i>
									Business license number: 202101043135 (1443435-P)
								</i>
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
