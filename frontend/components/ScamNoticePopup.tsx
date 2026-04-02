"use client";

import { useState, useEffect } from "react";
import {
	MdClose,
	MdWarning,
	MdBlock,
	MdGppBad,
	MdVerifiedUser,
	MdSearch,
	MdLanguage,
} from "react-icons/md";

export default function ScamNoticePopup() {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => setVisible(true), 600);
		return () => clearTimeout(timer);
	}, []);

	const handleClose = () => {
		setVisible(false);
	};

	if (!visible) return null;

	return (
		<div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
				onClick={handleClose}
			/>

			{/* Popup */}
			<div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full animate-in zoom-in-95 fade-in duration-300 overflow-hidden">
				{/* Header */}
				<div className="bg-red-600 px-7 py-6 flex items-start justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
							<MdWarning size={24} className="text-white" />
						</div>
						<div>
							<h2 className="text-lg font-heading font-bold text-white">
								Scam Alert
							</h2>
							<p className="text-red-100 text-sm mt-0.5">
								Protect yourself from fraud
							</p>
						</div>
					</div>
					<button
						onClick={handleClose}
						className="text-white/80 hover:text-white transition-colors rounded-lg p-1.5 hover:bg-white/10 flex-shrink-0"
					>
						<MdClose size={22} />
					</button>
				</div>

				{/* Body */}
				<div className="px-7 py-7 space-y-5">
					{/* Impersonation warning */}
					<div className="flex items-start gap-4">
						<div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
							<MdGppBad size={22} className="text-red-600" />
						</div>
						<div>
							<p className="text-sm font-bold text-gray-900 mb-0.5">
								Beware of impersonators
							</p>
							<p className="text-sm text-gray-600 leading-relaxed">
								Scammers may use our name or logo to deceive you. We only conduct business through our official website.
							</p>
						</div>
					</div>

					{/* Official website */}
					<div className="flex items-start gap-4">
						<div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
							<MdLanguage size={22} className="text-purple-700" />
						</div>
						<div>
							<p className="text-sm font-bold text-gray-900 mb-0.5">
								Our official website
							</p>
							<p className="text-sm text-gray-600 leading-relaxed">
								We only do business on{" "}
								<a
									href="https://creditxpress.com.my"
									className="text-purple-700 font-semibold hover:underline"
								>
									creditxpress.com.my
								</a>
							</p>
						</div>
					</div>

					{/* No upfront payments */}
					<div className="flex items-start gap-4">
						<div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
							<MdBlock size={22} className="text-orange-600" />
						</div>
						<div>
							<p className="text-sm font-bold text-gray-900 mb-0.5">
								No upfront payments
							</p>
							<p className="text-sm text-gray-600 leading-relaxed">
								We will never ask you for upfront fees, deposits, or OTP codes via phone, SMS, or WhatsApp.
							</p>
						</div>
					</div>

					{/* Verify & Report */}
					<div className="flex items-start gap-4">
						<div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
							<MdSearch size={22} className="text-blue-700" />
						</div>
						<div>
							<p className="text-sm font-bold text-gray-900 mb-0.5">
								Verify suspicious contacts
							</p>
							<p className="text-sm text-gray-600 leading-relaxed">
								Check suspicious phone numbers via PDRM Semak Mule at{" "}
								<a
									href="https://semakmule.rmp.gov.my"
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-700 font-semibold hover:underline"
								>
									semakmule.rmp.gov.my
								</a>
							</p>
						</div>
					</div>

					{/* Licensed badge */}
					<div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-3.5">
						<MdVerifiedUser size={20} className="text-green-700 flex-shrink-0" />
						<p className="text-xs text-green-900 leading-relaxed">
							CreditXpress is a licensed moneylender under the Moneylenders Act 1951 (KPKT License No: WL3337/07/01-11/020227)
						</p>
					</div>
				</div>

				{/* Footer */}
				<div className="px-7 pb-7">
					<button
						onClick={handleClose}
						className="w-full bg-purple-primary hover:bg-purple-700 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
					>
						I Understand
					</button>
				</div>
			</div>
		</div>
	);
}
