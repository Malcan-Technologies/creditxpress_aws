import {
	VideoCameraIcon,
	ClockIcon,
	CalendarDaysIcon,
	PlayIcon,
	XMarkIcon,
	SparklesIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface LiveCallConfirmationModalProps {
	onClose: () => void;
	onConfirm: () => void;
	onBackToInstant: () => void;
	applicationId: string;
}

export default function LiveCallConfirmationModal({
	onClose,
	onConfirm,
	onBackToInstant,
	applicationId,
}: LiveCallConfirmationModalProps) {
	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
			<div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
				{/* Header */}
				<div className="p-6 sm:p-8 border-b border-gray-100">
					<div className="flex items-center justify-between">
						<div className="flex items-center">
							<div className="w-12 h-12 bg-blue-tertiary/10 rounded-xl flex items-center justify-center mr-3">
								<VideoCameraIcon className="h-6 w-6 text-blue-tertiary" />
							</div>
							<div>
								<h2 className="text-xl lg:text-2xl font-bold text-gray-700 font-heading">
									Confirm Live Video Call
								</h2>
								<p className="text-sm lg:text-base text-gray-600 font-body">
									Please review this important information before proceeding
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
					{/* Important Notice */}
					<div className="mb-8 p-6 bg-amber-50 rounded-xl border-2 border-amber-200">
						<div className="flex items-start space-x-4">
							<div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
								<ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
							</div>
							<div className="flex-1">
								<h3 className="text-lg font-bold text-amber-800 font-heading mb-2">
									Consider the Faster Option
								</h3>
								<p className="text-base text-amber-700 font-body leading-relaxed">
									Live video calls require scheduling and may delay your loan processing. 
									The instant video option lets you complete attestation immediately.
								</p>
							</div>
						</div>
					</div>

					{/* Comparison Cards */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
						{/* Instant Video Option - Recommended */}
						<div className="relative border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 shadow-sm">
							{/* Recommended Badge */}
							<div className="absolute -top-3 -right-3">
								<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg">
									<SparklesIcon className="h-3 w-3 mr-1" />
									Recommended
								</span>
							</div>

							<div className="flex items-center space-x-3 mb-4">
								<div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
									<PlayIcon className="h-6 w-6 text-white" />
								</div>
								<div>
									<h4 className="text-lg font-bold text-green-800 font-heading">
										Instant Video
									</h4>
									<p className="text-sm text-green-600 font-semibold font-body">
										Complete in minutes
									</p>
								</div>
							</div>

							<div className="space-y-3">
								<div className="flex items-center space-x-3">
									<div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
										<svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
										</svg>
									</div>
									<span className="text-sm text-green-700 font-body">Complete in ~3 minutes</span>
								</div>
								<div className="flex items-center space-x-3">
									<div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
										<svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
										</svg>
									</div>
									<span className="text-sm text-green-700 font-body">Available 24/7 instantly</span>
								</div>
								<div className="flex items-center space-x-3">
									<div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
										<svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
										</svg>
									</div>
									<span className="text-sm text-green-700 font-body">No scheduling required</span>
								</div>
								<div className="flex items-center space-x-3">
									<div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
										<svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
										</svg>
									</div>
									<span className="text-sm text-green-700 font-body">Proceed immediately</span>
								</div>
							</div>
						</div>

						{/* Live Video Call Option */}
						<div className="border-2 border-gray-200 bg-white rounded-xl p-6 shadow-sm">
							<div className="flex items-center space-x-3 mb-4">
								<div className="w-12 h-12 bg-blue-tertiary/10 rounded-xl flex items-center justify-center border border-blue-tertiary/20">
									<VideoCameraIcon className="h-6 w-6 text-blue-tertiary" />
								</div>
								<div>
									<h4 className="text-lg font-bold text-gray-700 font-heading">
										Live Video Call
									</h4>
									<p className="text-sm text-blue-tertiary font-semibold font-body">
										Personal consultation
									</p>
								</div>
							</div>

							<div className="space-y-3">
								<div className="flex items-center space-x-3">
									<ClockIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
									<span className="text-sm text-gray-600 font-body">3-5 business days delay</span>
								</div>
								<div className="flex items-center space-x-3">
									<CalendarDaysIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
									<span className="text-sm text-gray-600 font-body">Requires scheduling coordination</span>
								</div>
								<div className="flex items-center space-x-3">
									<ClockIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
									<span className="text-sm text-gray-600 font-body">Business hours only</span>
								</div>
								<div className="flex items-center space-x-3">
									<VideoCameraIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
									<span className="text-sm text-gray-600 font-body">15-30 minute call duration</span>
								</div>
							</div>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="space-y-4">
						{/* Recommended: Go back to instant */}
						<button
							onClick={onBackToInstant}
							className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-md hover:shadow-lg transform hover:scale-[1.02] font-heading text-base lg:text-lg inline-flex items-center justify-center group"
						>
							<SparklesIcon className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform" />
							Use Instant Video Instead
							<span className="ml-2 px-2 py-1 bg-white/20 rounded-full text-xs">Recommended</span>
						</button>

						{/* Confirm live call */}
						<button
							onClick={onConfirm}
							className="w-full bg-blue-tertiary hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-sm hover:shadow-md font-heading text-base lg:text-lg inline-flex items-center justify-center"
						>
							<VideoCameraIcon className="h-5 w-5 mr-2" />
							Continue with Live Video Call
						</button>

						{/* Cancel */}
						<button
							onClick={onClose}
							className="w-full border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 font-semibold py-3 px-6 rounded-xl transition-all font-heading text-base"
						>
							Cancel
						</button>
					</div>

					{/* Footer Note */}
					{/* <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
						<div className="flex items-start space-x-3">
							<div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
								<svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
									<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
								</svg>
							</div>
							<div>
								<p className="text-sm text-blue-800 font-body leading-relaxed">
									<span className="font-semibold">If you proceed:</span> Our legal team will contact you within 1-2 business days to schedule your video call appointment. Please keep your phone accessible.
								</p>
							</div>
						</div>
					</div> */}
				</div>
			</div>
		</div>
	);
}
