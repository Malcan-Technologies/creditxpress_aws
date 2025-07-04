import Link from "next/link";
import Image from "next/image";

interface LogoProps {
	size?: "sm" | "md" | "lg" | "xl";
	variant?: "white" | "black";
	linkTo?: string;
	className?: string;
}

const sizeClasses = {
	sm: "w-24 h-8 sm:w-28 sm:h-9", // Small - for mobile nav, compact spaces
	md: "w-32 h-10 sm:w-36 sm:h-11", // Medium - for login/signup pages
	lg: "w-36 h-11 sm:w-40 sm:h-12 md:w-44 md:h-14", // Large - for main navbar, dashboard nav
	xl: "w-44 h-14 sm:w-48 sm:h-16 md:w-52 md:h-20", // Extra large - for hero sections
};

export default function Logo({
	size = "lg",
	variant = "white",
	linkTo = "/",
	className = "",
}: LogoProps) {
	const logoSrc =
		variant === "white" ? "/logo-white-large.svg" : "/logo-black-large.svg";

	const logoElement = (
		<div className={`relative ${sizeClasses[size]} ${className}`}>
			<Image
				src={logoSrc}
				alt="Kapital"
				fill
				className="object-contain"
				priority
				quality={100}
				sizes="(max-width: 640px) 120px, (max-width: 768px) 160px, (max-width: 1024px) 180px, 200px"
			/>
		</div>
	);

	// If linkTo is provided, wrap in Link
	if (linkTo) {
		return (
			<Link href={linkTo} className="flex items-center">
				{logoElement}
			</Link>
		);
	}

	// Otherwise return just the logo
	return logoElement;
}
