import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import {
	HomeIcon,
	WalletIcon,
	StarIcon,
	BanknotesIcon,
	DocumentTextIcon,
	ArrowPathIcon,
	Cog6ToothIcon,
	PlusIcon,
} from "@heroicons/react/24/outline";

const navigation = [
	{
		name: "Overview",
		href: "/dashboard",
		icon: <HomeIcon className="h-5 w-5" />,
	},
	{
		name: "Wallet",
		href: "/dashboard/wallet",
		icon: <WalletIcon className="h-5 w-5" />,
	},
	{
		name: "Credit Score",
		href: "/dashboard/credit-score",
		icon: <StarIcon className="h-5 w-5" />,
	},
	{
		name: "Loans",
		href: "/dashboard/loans",
		icon: <BanknotesIcon className="h-5 w-5" />,
	},
	{
		name: "Applications",
		href: "/dashboard/applications",
		icon: <DocumentTextIcon className="h-5 w-5" />,
	},
	{
		name: "Transactions",
		href: "/dashboard/transactions",
		icon: <ArrowPathIcon className="h-5 w-5" />,
	},
	{
		name: "Settings",
		href: "/dashboard/settings",
		icon: <Cog6ToothIcon className="h-5 w-5" />,
	},
];

export default function DashboardNav() {
	const pathname = usePathname();

	return (
		<div className="flex flex-col h-full bg-white border-r border-gray-200">
			<div className="p-4">
				<Logo />
			</div>

			<div className="p-4">
				<Link
					href="/dashboard/apply"
					className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
				>
					<PlusIcon className="w-5 h-5 mr-2" />
					Apply for a Loan
				</Link>
			</div>

			<nav className="flex-1 p-4 space-y-1">
				{navigation.map((item) => {
					const isActive = pathname === item.href;
					return (
						<Link
							key={item.name}
							href={item.href}
							className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
								isActive
									? "bg-indigo-50 text-indigo-600"
									: "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
							}`}
						>
							<span
								className={`mr-3 ${
									isActive
										? "text-indigo-600"
										: "text-gray-400"
								}`}
							>
								{item.icon}
							</span>
							{item.name}
						</Link>
					);
				})}
			</nav>

			<div className="p-4 border-t border-gray-200">
				<Link
					href="/settings"
					className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900"
				>
					<Cog6ToothIcon className="w-6 h-6 mr-3 text-gray-400" />
					Settings
				</Link>
			</div>
		</div>
	);
}
