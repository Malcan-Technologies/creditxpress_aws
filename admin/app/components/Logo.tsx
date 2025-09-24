import Link from "next/link";
import Image from "next/image";

interface LogoProps {
	size?: "sm" | "md" | "lg" | "xl";
	variant?: "white" | "black";
	linkTo?: string;
	className?: string;
}

const sizeClasses = {
	sm: "w-32 h-10", // Small - for mobile nav, compact spaces
	md: "w-40 h-12", // Medium - for login/signup pages
	lg: "w-52 h-16", // Large - for main navbar, dashboard nav
	xl: "w-64 h-20", // Extra large - for hero sections
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
