import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
	title: "Kapital Admin",
	description: "Admin dashboard for Kapital",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className="h-full bg-gray-50">
			<body className={`h-full ${inter.className}`}>{children}</body>
		</html>
	);
}
