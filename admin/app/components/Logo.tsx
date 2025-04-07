import React from "react";
import Image from "next/image";

export default function Logo() {
	return (
		<div className="flex items-center justify-center">
			<Image
				src="/logo-black-large.svg"
				alt="Kapital Admin Logo"
				width={120}
				height={40}
				priority
			/>
		</div>
	);
}
