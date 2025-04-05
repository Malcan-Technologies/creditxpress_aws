import Link from "next/link";
import Image from "next/image";

export default function Logo() {
	return (
		<Link href="/" className="flex items-center justify-center">
			<div className="relative w-32 h-10">
				<Image
					src="/logo-black-large.svg"
					alt="Kapital Logo"
					fill
					className="object-contain"
					priority
				/>
			</div>
		</Link>
	);
}
