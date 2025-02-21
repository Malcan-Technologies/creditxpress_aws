import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import { MdWhatsapp, MdPhone } from "react-icons/md";

export default function NotFound() {
	return (
		<div className="min-h-screen bg-white dark:bg-white">
			<Navbar bgStyle="bg-[#0A0612] dark:bg-[#0A0612]" />

			<main className="relative min-h-[calc(100vh-4rem)] bg-[#0A0612] dark:bg-[#0A0612] overflow-hidden">
				{/* Decorative background elements */}
				<div className="absolute inset-0">
					<div className="absolute w-[500px] h-[500px] bg-purple-800/30 rounded-full blur-3xl -top-32 -left-32 animate-pulse"></div>
					<div className="absolute w-[500px] h-[500px] bg-indigo-800/30 rounded-full blur-3xl top-1/2 left-1/2 animate-pulse delay-700"></div>
					<div className="absolute w-[500px] h-[500px] bg-blue-800/30 rounded-full blur-3xl -bottom-32 -right-32 animate-pulse delay-1000"></div>
				</div>

				{/* Content */}
				<div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
					<div className="flex flex-col items-center text-center">
						{/* 404 Image */}
						<div className="relative w-64 h-64 md:w-96 md:h-96 mb-8">
							<Image
								src="/404.svg"
								alt="404 Illustration"
								fill
								className="object-contain"
								priority
							/>
						</div>

						{/* Error Message */}
						<h1 className="text-6xl md:text-8xl font-bold text-white mb-6">
							Oops!{" "}
							<span className="bg-gradient-to-r from-purple-300 to-indigo-300 bg-clip-text text-transparent">
								404
							</span>
						</h1>

						<p className="text-2xl md:text-3xl text-purple-200 mb-8 max-w-2xl">
							We&apos;re upgrading our systems to serve you
							better. This page seems to be on a coffee break! ☕️
						</p>

						{/* Contact Information */}
						<div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10 mb-8 max-w-md">
							<h2 className="text-xl font-semibold text-white mb-4">
								Need immediate assistance?
							</h2>
							<p className="text-purple-200 mb-6">
								Our team is here to help! Reach out to us on
								WhatsApp or give us a call.
							</p>
							<div className="space-y-4">
								<a
									href="https://wa.me/60164614919?text=I'm%20interested%20in%20Kapital%20lending%20products"
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-semibold transition-all group"
								>
									<MdWhatsapp size={24} />
									Chat on WhatsApp
								</a>
								<a
									href="tel:+60164614919"
									className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-full font-semibold transition-all"
								>
									<MdPhone size={24} />
									+60 16-461 4919
								</a>
							</div>
						</div>

						{/* Navigation Links */}
						<div className="flex flex-wrap justify-center gap-4">
							<Link
								href="/"
								className="bg-white text-purple-900 px-8 py-4 rounded-full font-semibold hover:bg-purple-50 transition-all"
							>
								Back to Home
							</Link>
							<Link
								href="/products"
								className="border-2 border-white text-white px-8 py-4 rounded-full font-semibold hover:bg-white/10 transition-colors"
							>
								View Our Products
							</Link>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
