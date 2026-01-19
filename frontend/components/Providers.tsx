"use client";

import React from "react";
import TokenRefresher from "@/components/TokenRefresher";
import { Toaster } from "@/components/ui/sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<>
			<TokenRefresher />
			{children}
			<Toaster richColors />
		</>
	);
}
