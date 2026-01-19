"use client";

import { useState } from "react";
import { toast } from "sonner";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import DescriptionIcon from "@mui/icons-material/Description";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import VideoCameraIcon from "@mui/icons-material/VideoCall";
import * as Tooltip from "@radix-ui/react-tooltip";

interface LoanApplication {
	id: string;
	status: string;
	amount: number;
	term: number;
	purpose: string;
	createdAt: string;
	updatedAt: string;
	monthlyRepayment: number;
	interestRate: number;
	legalFee: number;
	netDisbursement: number;
	applicationFee?: number;
	originationFee?: number;
	stampingFee?: number;
	legalFeeFixed?: number;
	product: {
		name: string;
		code: string;
		originationFee: number;
		legalFee: number;
		applicationFee: number;
		interestRate: number;
	};
	user?: {
		fullName: string;
		email: string;
		phoneNumber: string;
		employmentStatus: string;
		employerName?: string;
		monthlyIncome?: string;
		address1: string;
		address2?: string;
		city: string;
		state: string;
		postalCode: string;
		idNumber?: string;
		icNumber?: string;
		icType?: string;
	};
}

interface AttestationFormProps {
	onSubmit: () => Promise<void>;
	onBack: () => void;
	onLiveCallSelect: () => void; // Add this new prop
	application: LoanApplication;
	calculateFees: (application: LoanApplication) => {
		interestRate: number;
		legalFee: number;
		netDisbursement: number;
		originationFee: number;
		applicationFee: number;
		stampingFee: number;
		legalFeeFixed: number;
		totalFees: number;
		isNewFeeStructure: boolean;
	};
	formatCurrency: (amount: number) => string;
}

export default function AttestationForm({
	onSubmit,
	onBack,
	onLiveCallSelect, // Add this parameter
	application,
	calculateFees,
	formatCurrency,
}: AttestationFormProps) {
	const [videoWatched, setVideoWatched] = useState(false);
	const [termsAccepted, setTermsAccepted] = useState(false);
	const [termsRejected, setTermsRejected] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [videoStarted, setVideoStarted] = useState(false);
	const [openTooltip, setOpenTooltip] = useState<string | null>(null);

	const fees = calculateFees(application);

	const handleVideoStart = () => {
		setVideoStarted(true);
	};

	const handleVideoComplete = () => {
		setVideoWatched(true);
	};

	const handleTooltipClick = (tooltipId: string) => {
		setOpenTooltip(openTooltip === tooltipId ? null : tooltipId);
	};

	const handleTermsChange = (accepted: boolean) => {
		if (accepted) {
			setTermsAccepted(true);
			setTermsRejected(false);
		} else {
			setTermsAccepted(false);
			setTermsRejected(true);
		}
	};

	const handleRejectAndScheduleCall = async () => {
		try {
			setLoading(true);
			setError(null);

			// Make the same API call as in the loans page for requesting live call
			const response = await fetch(`/api/loan-applications/${application.id}/request-live-call`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					attestationType: "MEETING",
					reason: "terms_rejected",
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to request live call");
			}

			// Success - notify user and trigger callback
			toast.success(
				"Live video call request submitted! Our legal team will contact you within 1-2 business days to schedule your appointment."
			);
			
			// Trigger the callback to handle navigation/modal closure
			onLiveCallSelect();
		} catch (error) {
			console.error("Error requesting live call:", error);
			setError("Failed to submit live call request. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async () => {
		if (!videoWatched || !termsAccepted) {
			setError(
				"Please watch the video and accept the loan terms to continue."
			);
			return;
		}

		setLoading(true);
		setError(null);

		try {
			await onSubmit();
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to complete attestation"
			);
		} finally {
			setLoading(false);
		}
	};

	const currentStep = !videoWatched ? 1 : !termsAccepted ? 2 : 3;

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="text-center mb-8">
				<h1 className="text-2xl lg:text-3xl font-heading font-bold text-gray-700 mb-2">
					Loan Terms Attestation
				</h1>
				<p className="text-base lg:text-lg text-gray-600 font-body">
					Please review your loan terms and confirm your understanding
				</p>
			</div>

			{/* Progress Steps */}
			<div className="mb-6">
				<div className="flex items-center justify-center mb-6">
					<div className="flex items-center space-x-4 md:space-x-8">
						{/* Step 1 */}
						<div className="flex items-center">
							<div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
								currentStep >= 1 
									? 'bg-purple-primary text-white' 
									: 'bg-gray-200 text-gray-500'
							}`}>
								{videoWatched ? <CheckCircleIcon className="w-5 h-5" /> : '1'}
							</div>
							<span className="ml-2 text-sm font-medium text-gray-700 hidden sm:block">
								Watch Video
							</span>
						</div>
						
						{/* Connector */}
						<div className={`h-1 w-8 md:w-16 rounded ${
							currentStep >= 2 ? 'bg-purple-primary' : 'bg-gray-200'
						}`}></div>

						{/* Step 2 */}
						<div className="flex items-center">
							<div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
								currentStep >= 2 
									? 'bg-purple-primary text-white' 
									: 'bg-gray-200 text-gray-500'
							}`}>
								{termsAccepted ? <CheckCircleIcon className="w-5 h-5" /> : '2'}
							</div>
							<span className="ml-2 text-sm font-medium text-gray-700 hidden sm:block">
								Accept Terms
							</span>
						</div>

						{/* Connector */}
						<div className={`h-1 w-8 md:w-16 rounded ${
							currentStep >= 3 ? 'bg-purple-primary' : 'bg-gray-200'
						}`}></div>

						{/* Step 3 */}
						<div className="flex items-center">
							<div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
								currentStep >= 3 
									? 'bg-purple-primary text-white' 
									: 'bg-gray-200 text-gray-500'
							}`}>
								3
							</div>
							<span className="ml-2 text-sm font-medium text-gray-700 hidden sm:block">
								Complete
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Loan Details Card */}
			<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
				<div className="p-4 sm:p-6 lg:p-8">
					{/* Header */}
					<div className="flex items-center mb-6">
						<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
							<DescriptionIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
						</div>
						<div className="min-w-0">
							<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
								Loan Agreement Details
							</h3>
							<p className="text-sm lg:text-base text-purple-primary font-semibold">
								{application.product.name}
							</p>
						</div>
					</div>

					{/* Key Loan Information */}
					<div className="space-y-6">
						<div className="space-y-4">
							<div className="flex justify-between">
								<span className="text-gray-600 font-body">Product</span>
								<span className="text-gray-900 font-medium font-body">{application.product.name}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-600 font-body">Loan Amount</span>
								<span className="text-gray-900 font-medium font-body">{formatCurrency(application.amount)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-600 font-body">Loan Term</span>
								<span className="text-gray-900 font-medium font-body">{application.term} months</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-600 font-body">Interest Rate</span>
								<span className="text-gray-900 font-medium font-body">{application.product.interestRate}% monthly</span>
							</div>
						</div>

					{/* Fee Breakdown */}
					<div className="pt-4 border-t border-gray-200">
						<div className="space-y-4">
							{fees.isNewFeeStructure ? (
								<>
									{/* New Fee Structure */}
									<div className="flex justify-between">
										<div className="flex items-center gap-1">
											<span className="text-gray-600 font-body">Legal Fee</span>
											<Tooltip.Provider>
												<Tooltip.Root
													open={openTooltip === "legalFixed"}
													onOpenChange={() => handleTooltipClick("legalFixed")}
												>
													<Tooltip.Trigger asChild>
														<InfoIcon
															className="text-gray-400 cursor-pointer"
															fontSize="small"
															onClick={() => handleTooltipClick("legalFixed")}
														/>
													</Tooltip.Trigger>
													<Tooltip.Portal>
														<Tooltip.Content
															className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs"
															sideOffset={5}
														>
															A fixed fee paid to lawyers to cover legal costs for attestation and processing your loan documents.
															<Tooltip.Arrow className="fill-gray-800" />
														</Tooltip.Content>
													</Tooltip.Portal>
												</Tooltip.Root>
											</Tooltip.Provider>
										</div>
										<span className="text-red-600 font-body">({formatCurrency(fees.legalFeeFixed)})</span>
									</div>
									<div className="flex justify-between">
										<div className="flex items-center gap-1">
											<span className="text-gray-600 font-body">Stamping Fee</span>
											<Tooltip.Provider>
												<Tooltip.Root
													open={openTooltip === "stamping"}
													onOpenChange={() => handleTooltipClick("stamping")}
												>
													<Tooltip.Trigger asChild>
														<InfoIcon
															className="text-gray-400 cursor-pointer"
															fontSize="small"
															onClick={() => handleTooltipClick("stamping")}
														/>
													</Tooltip.Trigger>
													<Tooltip.Portal>
														<Tooltip.Content
															className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs"
															sideOffset={5}
														>
															A fee paid to LHDN for stamping and certifying your loan agreement documents.
															<Tooltip.Arrow className="fill-gray-800" />
														</Tooltip.Content>
													</Tooltip.Portal>
												</Tooltip.Root>
											</Tooltip.Provider>
										</div>
										<span className="text-red-600 font-body">({formatCurrency(fees.stampingFee)})</span>
									</div>
								</>
							) : (
								<>
									{/* Old Fee Structure - for backward compatibility */}
									{fees.originationFee > 0 && (
										<div className="flex justify-between">
											<div className="flex items-center gap-1">
												<span className="text-gray-600 font-body">Origination Fee</span>
											</div>
											<span className="text-red-600 font-body">({formatCurrency(fees.originationFee)})</span>
										</div>
									)}
									{fees.legalFee > 0 && (
										<div className="flex justify-between">
											<div className="flex items-center gap-1">
												<span className="text-gray-600 font-body">Legal Fee</span>
											</div>
											<span className="text-red-600 font-body">({formatCurrency(fees.legalFee)})</span>
										</div>
									)}
									{fees.applicationFee > 0 && (
										<div className="flex justify-between">
											<div className="flex items-center gap-1">
												<span className="text-gray-600 font-body">Application Fee</span>
											</div>
											<span className="text-red-600 font-body">({formatCurrency(fees.applicationFee)})</span>
										</div>
									)}
								</>
							)}
						</div>
					</div>

						{/* Highlighted Values */}
						<div className="pt-4 border-t border-gray-200">
							<div className="space-y-4">
								{/* Net Loan Disbursement - Highlighted */}
								<div className="bg-blue-tertiary/5 rounded-xl p-4 border border-blue-tertiary/20">
									<div className="flex justify-between items-center">
										<div className="flex items-center gap-1">
											<span className="text-blue-tertiary font-normal text-lg font-body">
												Net Loan Disbursement
											</span>
											<Tooltip.Provider>
												<Tooltip.Root
													open={openTooltip === "disbursement"}
													onOpenChange={() => handleTooltipClick("disbursement")}
												>
													<Tooltip.Trigger asChild>
														<InfoIcon
															className="text-gray-400 cursor-pointer"
															fontSize="small"
															onClick={() => handleTooltipClick("disbursement")}
														/>
													</Tooltip.Trigger>
												<Tooltip.Portal>
													<Tooltip.Content
														className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs"
														sideOffset={5}
													>
														The actual amount you will receive after deducting legal and stamping fees from your loan amount.
														<Tooltip.Arrow className="fill-gray-800" />
													</Tooltip.Content>
												</Tooltip.Portal>
												</Tooltip.Root>
											</Tooltip.Provider>
										</div>
										<span className="text-blue-tertiary font-normal text-xl font-heading">
											{formatCurrency(fees.netDisbursement)}
										</span>
									</div>
								</div>

								{/* Monthly Repayment - Highlighted */}
								<div className="bg-purple-primary/5 rounded-xl p-4 border border-purple-primary/20">
									<div className="flex justify-between items-center">
										<div className="flex items-center gap-1">
											<span className="text-purple-primary font-normal text-lg font-body">
												Monthly Repayment
											</span>
											<Tooltip.Provider>
												<Tooltip.Root
													open={openTooltip === "repayment"}
													onOpenChange={() => handleTooltipClick("repayment")}
												>
													<Tooltip.Trigger asChild>
														<InfoIcon
															className="text-gray-400 cursor-pointer"
															fontSize="small"
															onClick={() => handleTooltipClick("repayment")}
														/>
													</Tooltip.Trigger>
													<Tooltip.Portal>
														<Tooltip.Content
															className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs"
															sideOffset={5}
														>
															The amount you need to pay each month, which includes both principal and interest.
															<Tooltip.Arrow className="fill-gray-800" />
														</Tooltip.Content>
													</Tooltip.Portal>
												</Tooltip.Root>
											</Tooltip.Provider>
										</div>
										<span className="text-purple-primary font-normal text-xl font-heading">
											{formatCurrency(application.monthlyRepayment)}
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Borrower Information */}
					{application.user && (
						<>
							<div className="border-t border-gray-100 my-6"></div>
							<div className="space-y-4">
								<h4 className="text-lg font-heading font-semibold text-gray-700">
									Borrower Information
								</h4>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div className="space-y-4">
										<div className="flex justify-between">
											<span className="text-gray-600 font-body">Full Name</span>
											<span className="text-gray-900 font-medium font-body">
												{application.user.fullName}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-gray-600 font-body">Email</span>
											<span className="text-gray-900 font-medium font-body">
												{application.user.email}
											</span>
										</div>
									</div>
									<div className="space-y-4">
										<div className="flex justify-between">
											<span className="text-gray-600 font-body">Phone</span>
											<span className="text-gray-900 font-medium font-body">
												{application.user.phoneNumber}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-gray-600 font-body">Employment</span>
											<span className="text-gray-900 font-medium font-body">
												{application.user.employmentStatus}
											</span>
										</div>
									</div>
								</div>
							</div>
						</>
					)}
				</div>
			</div>

			{/* Video Section */}
			<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
				<div className="p-4 sm:p-6 lg:p-8">
					{/* Header */}
					<div className="flex items-center justify-between mb-6">
						<div className="flex items-center">
							<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
								<VideoLibraryIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
							</div>
							<div className="min-w-0">
								<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
									Loan Terms Video
								</h3>
								<p className="text-sm lg:text-base text-purple-primary font-semibold">
									Step 1: Watch the explanation video
								</p>
							</div>
						</div>
						{videoWatched && (
							<div className="flex items-center bg-green-50 px-3 py-2 rounded-lg border border-green-200">
								<CheckCircleIcon className="text-green-600 mr-2 w-5 h-5" />
								<span className="text-sm font-semibold text-green-700">Completed</span>
							</div>
						)}
					</div>

					{/* Video Info */}
					<div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
						<div className="flex items-start">
							<InfoIcon className="text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
							<div>
								<p className="text-sm text-blue-800 font-body">
									<strong>Important:</strong> This video explains your loan terms, repayment schedule, and your rights and obligations as a borrower. Please watch it completely before proceeding.
								</p>
							</div>
						</div>
					</div>

					{/* Video Player */}
					<div className="bg-gray-50 rounded-xl overflow-hidden mb-6">
						{!videoStarted ? (
							<div className="aspect-video flex items-center justify-center p-8">
								<div className="text-center">
									{/* <div className="w-20 h-20 bg-purple-primary rounded-full flex items-center justify-center mx-auto mb-4">
										<PlayArrowIcon className="text-white" style={{ fontSize: 32 }} />
									</div> */}
									<h4 className="text-lg font-heading font-semibold text-gray-700 mb-2">
										Ready to Watch?
									</h4>
									<p className="text-gray-600 font-body mb-6 max-w-md">
										This video explains your loan terms, repayment schedule, and your rights as a borrower.
									</p>
									<button
										onClick={handleVideoStart}
										className="bg-purple-primary text-white px-8 py-4 rounded-xl hover:bg-purple-700 transition-colors font-body inline-flex items-center gap-3 text-lg font-semibold"
									>
										<PlayArrowIcon className="w-6 h-6" />
										Start Video
									</button>
								</div>
							</div>
						) : (
							<div className="relative">
								{!videoWatched ? (
									<div className="space-y-4">
										<div className="relative aspect-video">
											<video
												className="w-full h-full object-cover"
												controls
												autoPlay
												onEnded={handleVideoComplete}
												controlsList="nodownload"
											>
												<source
													src="/videos/attestation.mp4"
													type="video/mp4"
												/>
												Your browser does not support the video tag.
											</video>
											<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4">
												<p className="text-white font-body text-sm">
													Please watch the complete video to continue
												</p>
											</div>
										</div>
									</div>
								) : (
									<div className="aspect-video flex items-center justify-center p-8">
										<div className="text-center">
											<div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
												<CheckCircleIcon className="text-white" style={{ fontSize: 32 }} />
											</div>
											<h4 className="text-lg font-heading font-semibold text-green-600 mb-2">
												Video Completed!
											</h4>
											<p className="text-gray-600 font-body mb-4">
												You can now proceed to accept the terms below
											</p>
											<button
												onClick={() => {
													setVideoWatched(false);
													setVideoStarted(false);
												}}
												className="text-gray-500 hover:text-gray-700 text-sm font-body underline transition-colors"
											>
												Watch video again
											</button>
										</div>
									</div>
								)}
							</div>
						)}
					</div>

					
				</div>
			</div>

			{/* Terms Acceptance */}
			<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
				<div className="p-4 sm:p-6 lg:p-8">
					{/* Header */}
					<div className="flex items-center justify-between mb-6">
						<div className="flex items-center">
							<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
								<VerifiedUserIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
							</div>
							<div className="min-w-0">
								<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
									Terms and Conditions
								</h3>
								<p className="text-sm lg:text-base text-purple-primary font-semibold">
									Step 2: Accept or reject the loan agreement
								</p>
							</div>
						</div>
						{termsAccepted && (
							<div className="flex items-center bg-green-50 px-3 py-2 rounded-lg border border-green-200">
								<CheckCircleIcon className="text-green-600 mr-2 w-5 h-5" />
								<span className="text-sm font-semibold text-green-700">Accepted</span>
							</div>
						)}
						{termsRejected && (
							<div className="flex items-center bg-red-50 px-3 py-2 rounded-lg border border-red-200">
								<svg className="text-red-600 mr-2 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
									<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
								</svg>
								<span className="text-sm font-semibold text-red-700">Rejected</span>
							</div>
						)}
					</div>

					{/* Terms Options */}
					<div className="bg-gray-50 rounded-xl p-6 border border-gray-200 space-y-6">
						{/* Accept Terms */}
						<label className="inline-flex items-start cursor-pointer group">
							<div className="relative flex items-center justify-center mt-1 mr-4">
								<input
									type="radio"
									name="terms"
									checked={termsAccepted}
									onChange={() => handleTermsChange(true)}
									disabled={!videoWatched}
									className="sr-only"
								/>
								<div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
									!videoWatched 
										? 'border-gray-300 bg-gray-100 cursor-not-allowed' 
										: termsAccepted 
											? 'border-purple-primary bg-purple-primary' 
											: 'border-gray-300 bg-white group-hover:border-purple-primary'
								}`}>
									{termsAccepted && (
										<div className="w-2 h-2 rounded-full bg-white"></div>
									)}
								</div>
							</div>
							<span className="font-body text-gray-700 leading-relaxed">
								<strong>I accept the terms and conditions.</strong> I confirm that I have watched the loan terms video and understand my rights and obligations under this loan agreement.
							</span>
						</label>

						{/* Reject Terms */}
						<label className="inline-flex items-start cursor-pointer group">
							<div className="relative flex items-center justify-center mt-1 mr-4">
								<input
									type="radio"
									name="terms"
									checked={termsRejected}
									onChange={() => handleTermsChange(false)}
									disabled={!videoWatched}
									className="sr-only"
								/>
								<div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
									!videoWatched 
										? 'border-gray-300 bg-gray-100 cursor-not-allowed' 
										: termsRejected 
											? 'border-purple-primary bg-purple-primary' 
											: 'border-gray-300 bg-white group-hover:border-purple-primary'
								}`}>
									{termsRejected && (
										<div className="w-2 h-2 rounded-full bg-white"></div>
									)}
								</div>
							</div>
							<span className="font-body text-gray-700 leading-relaxed">
								<strong>I need more clarification.</strong> I would like to speak with a legal advisor about these terms before proceeding.
							</span>
						</label>

						{!videoWatched && (
							<p className="text-sm text-gray-500 font-body">
								Please watch the video first to enable these options
							</p>
						)}

						{/* Rejection Notice */}
						{termsRejected && (
							<div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
								<div className="flex items-start">
									<InfoIcon className="text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
									<div className="w-full">
										<p className="text-sm text-amber-800 font-body mb-4">
											<strong>No problem!</strong> We understand you may need additional clarification. We'll connect you with a legal advisor for a personal consultation.
										</p>
										<div className="flex flex-col sm:flex-row gap-3">
											<button
												onClick={handleRejectAndScheduleCall}
												className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-xl transition-all font-body font-semibold inline-flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
											>
												<VideoCameraIcon className="w-5 h-5" />
												Schedule Live Call
											</button>
											<button
												onClick={() => handleTermsChange(true)}
												className="bg-white hover:bg-gray-50 text-amber-700 border-2 border-amber-300 hover:border-amber-400 px-6 py-3 rounded-xl transition-all font-body font-medium inline-flex items-center justify-center gap-2"
											>
												<CheckCircleIcon className="w-5 h-5" />
												Accept Terms
											</button>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Error Display */}
			{error && (
				<div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
					<div className="flex items-center">
						<div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
							<InfoIcon className="text-red-600 w-5 h-5" />
						</div>
						<p className="text-red-700 font-body font-medium">{error}</p>
					</div>
				</div>
			)}

			{/* Navigation Buttons */}
			<div className="flex flex-col sm:flex-row justify-between gap-4 pt-6">
				<button
					onClick={onBack}
					disabled={loading}
					className="bg-white text-gray-700 border-2 border-gray-300 px-8 py-4 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors font-body font-semibold disabled:opacity-50 disabled:cursor-not-allowed order-2 sm:order-1"
				>
					Back to Previous Step
				</button>

				<button
					onClick={handleSubmit}
					disabled={!videoWatched || !termsAccepted || loading}
					className="bg-purple-primary text-white px-8 py-4 rounded-xl hover:bg-purple-700 transition-colors font-body font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center justify-center gap-3 order-1 sm:order-2"
				>
					{loading ? (
						<>
							<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
							Processing Attestation...
						</>
					) : (
						<>
							<CheckCircleIcon className="w-5 h-5" />
							Complete Attestation
						</>
					)}
				</button>
			</div>
		</div>
	);
}
