import {
	PlayIcon,
	VideoCameraIcon,
	SparklesIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";

interface AttestationMethodModalProps {
	onClose: () => void;
	onInstantSelect: () => void;
	onLiveCallSelect: () => void;
	applicationId: string;
}

export default function AttestationMethodModal({
	onClose,
	onInstantSelect,
	onLiveCallSelect,
	applicationId,
}: AttestationMethodModalProps) {
	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
			<div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
				{/* Header */}
				<div className="p-6 sm:p-8 border-b border-gray-100">
					<div className="flex items-center justify-between">
						<div className="flex items-center">
							<div className="w-12 h-12 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3">
								<SparklesIcon className="h-6 w-6 text-purple-primary" />
							</div>
							<div>
								<h2 className="text-xl lg:text-2xl font-bold text-gray-700 font-heading">
									Choose Attestation Method
								</h2>
								<p className="text-sm lg:text-base text-gray-600 font-body">
									Select how you'd like to complete your loan attestation
								</p>
							</div>
						</div>
						<button
							onClick={onClose}
							className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-lg"
						>
							<XMarkIcon className="w-6 h-6" />
						</button>
					</div>
				</div>

				{/* Content */}
				<div className="p-6 sm:p-8">
					{/* Description */}
					{/* <div className="mb-8 p-4 bg-purple-50 rounded-xl border border-purple-200">
						<p className="text-sm lg:text-base text-purple-800 font-body">
							To proceed with your loan, please complete the attestation process. Choose your preferred method below.
						</p>
					</div> */}

					<div className="space-y-6">
						{/* Instant Attestation - Highlighted */}
						<button
							onClick={onInstantSelect}
							className="w-full border-2 border-purple-primary bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-6 hover:border-purple-600 hover:from-purple-100 hover:to-purple-200 transition-all text-left shadow-md hover:shadow-lg transform hover:scale-[1.02] relative group"
						>
							{/* Recommended Badge */}
							<div className="absolute -top-3 -right-3">
								<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-primary to-purple-600 text-white shadow-lg">
									<SparklesIcon className="h-3 w-3 mr-1" />
									Recommended
								</span>
							</div>

							<div className="flex items-center justify-between mb-6">
								<div className="flex items-center space-x-4">
									<div className="w-14 h-14 bg-gradient-to-r from-purple-primary to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
										<PlayIcon className="h-7 w-7 text-white" />
									</div>
									<div>
										<h3 className="font-bold text-gray-800 font-heading text-lg lg:text-xl mb-1">
											Instant Video Attestation
										</h3>
										<p className="text-sm lg:text-base text-purple-700 font-semibold font-body">
											Watch a short video and proceed immediately
										</p>
									</div>
								</div>
								<div className="w-8 h-8 bg-purple-primary/10 rounded-full flex items-center justify-center group-hover:bg-purple-primary/20 transition-colors">
									<svg
										className="w-4 h-4 text-purple-primary"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 5l7 7-7 7"
										/>
									</svg>
								</div>
							</div>

							{/* Details Grid */}
							<div className="bg-white/80 rounded-xl p-4 border border-purple-200/50 mb-4">
								<div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
									<div>
										<p className="text-sm text-gray-600 font-body mb-1">Duration</p>
										<p className="text-purple-700 font-semibold font-heading">~3 minutes</p>
									</div>
									<div>
										<p className="text-sm text-gray-600 font-body mb-1">Availability</p>
										<p className="text-purple-700 font-semibold font-heading">24/7 Instant</p>
									</div>
									<div>
										<p className="text-sm text-gray-600 font-body mb-1">Processing</p>
										<p className="text-purple-700 font-semibold font-heading">Immediate</p>
									</div>
									{/* <div>
										<p className="text-sm text-gray-600 font-body mb-1">Cost</p>
										<p className="text-purple-700 font-semibold font-heading">Free</p>
									</div> */}
								</div>
							</div>

							{/* Benefits */}
							<div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
								<div className="flex items-center space-x-2 mb-2">
									<div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
										<svg
											className="w-3 h-3 text-white"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clipRule="evenodd"
											/>
										</svg>
									</div>
									<span className="text-sm font-semibold text-green-800 font-body">
										Fastest Option - Complete in Minutes!
									</span>
								</div>
								<ul className="text-xs lg:text-sm text-green-700 space-y-1 ml-7 font-body">
									<li>• No scheduling required</li>
									<li>• Available anytime, anywhere</li>
									<li>• Proceed to next step immediately</li>
								</ul>
							</div>
						</button>

						{/* Live Video Call */}
						<button
							onClick={onLiveCallSelect}
							className="w-full border-2 border-gray-200 rounded-xl p-6 hover:border-blue-tertiary/50 hover:bg-blue-tertiary/5 transition-all text-left bg-white shadow-sm hover:shadow-md group"
						>
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center space-x-4">
									<div className="w-14 h-14 bg-blue-tertiary/10 rounded-xl flex items-center justify-center border border-blue-tertiary/20">
										<VideoCameraIcon className="h-7 w-7 text-blue-tertiary" />
									</div>
									<div>
										<h3 className="font-bold text-gray-700 font-heading text-lg lg:text-xl mb-1">
											Live Video Call with Lawyer
										</h3>
										<p className="text-sm lg:text-base text-blue-tertiary font-semibold font-body">
											Schedule a personal consultation
										</p>
									</div>
								</div>
								<div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-blue-tertiary/10 transition-colors">
									<svg
										className="w-4 h-4 text-gray-400 group-hover:text-blue-tertiary"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 5l7 7-7 7"
										/>
									</svg>
								</div>
							</div>

							{/* Details Grid */}
							<div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
								<div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
									<div>
										<p className="text-sm text-gray-600 font-body mb-1">Duration</p>
										<p className="text-gray-700 font-semibold font-heading">15-30 min</p>
									</div>
									<div>
										<p className="text-sm text-gray-600 font-body mb-1">Scheduling</p>
										<p className="text-gray-700 font-semibold font-heading">Business Hours</p>
									</div>
									<div>
										<p className="text-sm text-gray-600 font-body mb-1">Processing</p>
										<p className="text-gray-700 font-semibold font-heading">3 Bus. Days</p>
									</div>
									{/* <div>
										<p className="text-sm text-gray-600 font-body mb-1">Cost</p>
										<p className="text-gray-700 font-semibold font-heading">Free</p>
									</div> */}
								</div>
							</div>

							{/* Benefits */}
							<div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
								<p className="text-sm text-blue-800 font-body">
									<strong>Perfect for:</strong> Detailed questions, complex scenarios, or if you prefer personal interaction
								</p>
							</div>
						</button>
					</div>

					{/* Note */}
					
				</div>
			</div>
		</div>
	);
}
