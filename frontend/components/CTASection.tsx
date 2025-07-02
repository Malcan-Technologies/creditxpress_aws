import Link from "next/link";
import { MdArrowForward } from "react-icons/md";

interface CTASectionProps {
	title: string;
	description: string;
	primaryButtonText: string;
	primaryButtonHref: string;
	secondaryButtonText: string;
	secondaryButtonHref: string;
	className?: string;
}

export default function CTASection({
	title,
	description,
	primaryButtonText,
	primaryButtonHref,
	secondaryButtonText,
	secondaryButtonHref,
	className = "",
}: CTASectionProps) {
	return (
		<section
			className={`py-12 sm:py-16 lg:py-20 xl:py-24 bg-offwhite w-full ${className}`}
		>
			<div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
				<div className="bg-gradient-to-br from-purple-primary via-purple-primary to-blue-tertiary rounded-xl lg:rounded-2xl p-8 sm:p-10 lg:p-12 text-center relative overflow-hidden shadow-sm hover:shadow-lg transition-all mx-2 sm:mx-4 lg:mx-0">
					<div className="absolute inset-0 bg-black/10"></div>
					<div className="relative">
						<h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 sm:mb-6 text-white px-4">
							{title}
						</h2>
						<p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 mb-8 sm:mb-10 lg:mb-12 mx-auto font-body px-4 max-w-none lg:max-w-5xl">
							{description}
						</p>
						<div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
							<Link
								href={primaryButtonHref}
								className="bg-white text-purple-primary hover:bg-gray-100 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center"
							>
								{primaryButtonText}
								<MdArrowForward
									size={18}
									className="ml-2 lg:w-5 lg:h-5"
								/>
							</Link>
							<Link
								href={secondaryButtonHref}
								className="bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20 font-semibold text-base lg:text-lg px-6 lg:px-8 py-3 lg:py-4 rounded-xl transition-all duration-200 inline-flex items-center justify-center"
							>
								{secondaryButtonText}
							</Link>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
