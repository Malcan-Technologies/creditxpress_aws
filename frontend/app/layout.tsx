import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: {
		template: "%s | CreditXpress",
		default: "CreditXpress - Modern credit for Malaysia",
	},
	description:
		"Get the funding you need with industry-leading rates and lightning-fast approval times. Business loans, personal loans, and salary advance solutions in Malaysia.",
	keywords: [
		"business loans",
		"personal loans",
		"salary advance",
		"financing",
		"malaysia",
		"fintech",
	],
	metadataBase: new URL("https://creditxpress.com.my"),
	openGraph: {
		title: "CreditXpress - Modern credit for Malaysia",
		description:
			"Get the funding you need with industry-leading rates and lightning-fast approval times.",
		url: "https://creditxpress.com.my",
		siteName: "CreditXpress",
		images: [
			{
				url: "/og-image.jpg",
				width: 1200,
				height: 630,
				alt: "CreditXpress - Smart Financing Solutions",
			},
		],
		locale: "en_MY",
		type: "website",
	},
	icons: {
		icon: [
			{ url: "/favicon.svg" },
			{ url: "/icon.svg", type: "image/svg+xml" },
			{ url: "/icon-192.png", sizes: "192x192", type: "image/png" },
			{ url: "/icon-512.png", sizes: "512x512", type: "image/png" },
		],
		apple: [
			{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
		],
		other: [
			{
				rel: "mask-icon",
				url: "/safari-pinned-tab.svg",
				color: "#4F46E5",
			},
		],
	},
	manifest: "/site.webmanifest",
	twitter: {
		card: "summary_large_image",
		title: "CreditXpress - Smart Financing Solutions for Every Need",
		description:
			"Get the funding you need with industry-leading rates and lightning-fast approval times.",
		images: ["/og-image.jpg"],
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
	verification: {
		google: "your-google-site-verification",
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body className={`${inter.className} min-h-screen`}>
				<Providers>
					<div className="w-full min-h-screen">{children}</div>
				</Providers>
			</body>
		</html>
	);
}
