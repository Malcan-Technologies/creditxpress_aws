"use client";

import React from "react";
import TokenRefresher from "@/components/TokenRefresher";

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<>
			<TokenRefresher />
			{children}
		</>
	);
}
