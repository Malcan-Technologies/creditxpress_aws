import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
	title: "CreditXpress | Admin",
	description: "Admin dashboard for CreditXpress",
	icons: {
		icon: [
			{ url: "/favicon.svg" },
			{ url: "/favicon.svg", type: "image/svg+xml" },
		],
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className="h-full bg-gray-50">
			<body className={`h-full ${inter.className}`}>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
