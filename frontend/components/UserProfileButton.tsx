import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TokenStorage } from "@/lib/authUtils";

export default function UserProfileButton() {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const router = useRouter();

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		}

		document.addEventListener("mousedown", handleClickOutside);
		return () =>
			document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleLogout = async () => {
		// Clear tokens using our utility
		TokenStorage.clearTokens();

		// Call logout API to invalidate refresh token on server
		try {
			await fetch("/api/auth/logout", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${TokenStorage.getAccessToken()}`,
				},
			});
		} catch (error) {
			console.error("Error during logout:", error);
		}

		// Redirect to login page
		router.push("/login");
	};

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
			>
				<svg
					className="w-6 h-6"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
					/>
				</svg>
			</button>

			{isOpen && (
				<div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
					<Link
						href="/dashboard/profile"
						className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
						onClick={() => setIsOpen(false)}
					>
						Profile
					</Link>
					<button
						onClick={handleLogout}
						className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
					>
						Logout
					</button>
				</div>
			)}
		</div>
	);
}
