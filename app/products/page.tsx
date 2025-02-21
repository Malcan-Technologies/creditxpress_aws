"use client";

import React, { useState } from "react";
import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
	MdGroups,
	MdDirectionsCar,
	MdCreditCard,
	MdBusinessCenter,
	MdAccountBalance,
	MdApartment,
	MdShowChart,
} from "react-icons/md";

type ProductType = {
	id: string;
	title: string;
	description: string;
	features: string[];
	maxAmount?: string;
	icon: ReactNode;
};

type ProductCategory = {
	title: string;
	description: string;
	types: ProductType[];
};

type ProductsType = {
	business: ProductCategory;
	personal: ProductCategory;
};

export default function Products() {
	const [activeProduct, setActiveProduct] = useState<"business" | "personal">(
		"business"
	);

	const products: ProductsType = {
		business: {
			title: "Business Solutions",
			description:
				"Comprehensive financing solutions to help your business grow",
			types: [
				{
					id: "employee",
					title: "PayAdvance™",
					description:
						"Access instant salary advances with low interest, empowering you to manage unexpected expenses with confidence",
					features: [
						"Payroll deduction",
						"No cost to employer",
						"No collateral required",
						"Low interest rates",
					],
					maxAmount: "Up to 1 month gross salary",
					icon: <MdGroups size={24} />,
				},
				{
					id: "auto",
					title: "Auto Dealer Financing",
					description:
						"Specialized financing for auto dealerships with flexible terms and competitive rates",
					features: [
						"Inventory financing",
						"Flexible terms",
						"Competitive rates",
					],
					maxAmount: "Up to RM 1,000,000",
					icon: <MdDirectionsCar size={24} />,
				},
				{
					id: "loc",
					title: "Business Line of Credit",
					description:
						"Flexible business line of credit for managing cash flow and unexpected expenses",
					features: [
						"Revolving credit",
						"Pay interest only on what you use",
						"Quick access to funds",
						"Competitive rates",
					],
					maxAmount: "Up to RM 500,000",
					icon: <MdCreditCard size={24} />,
				},
				{
					id: "business",
					title: "Business Term Loan",
					description:
						"Term loans for business expansion, equipment, or working capital",
					features: [
						"Fixed monthly payments",
						"Competitive rates",
						"Terms up to 5 years",
					],
					maxAmount: "Up to RM 2,000,000",
					icon: <MdBusinessCenter size={24} />,
				},
			],
		},
		personal: {
			title: "Personal Loans",
			description:
				"Flexible personal financing options to meet your needs",
			types: [
				{
					id: "personal",
					title: "Lifestyle Term Loan",
					description:
						"Quick and flexible personal loans for your various financial needs",
					features: [
						"Fast approval process",
						"Terms up to 2 years",
						"Up to 1.5% monthly interest rate",
					],
					maxAmount: "Up to RM 50,000",
					icon: <MdAccountBalance size={24} />,
				},
				{
					id: "property",
					title: "Property-Backed Financing",
					description:
						"Secure better rates using your property as collateral",
					features: [
						"Interest rate up to 1.0% per month",
						"Loan amount up to 80% of property value",
						"Terms up to 2 years",
					],
					maxAmount: "Up to 80% of property value",
					icon: <MdApartment size={24} />,
				},
				{
					id: "lease",
					title: "Lease-to-Own Financing",
					description:
						"Use your vehicle as collateral for better loan terms",
					features: [
						"Interest rate up to 1.0% per month",
						"Loan amount up to 70% of vehicle value",
						"Terms up to 2 years",
					],
					maxAmount: "Up to 70% of vehicle value",
					icon: <MdShowChart size={24} />,
				},
			],
		},
	};

	return (
		<main className="min-h-screen bg-white dark:bg-white">
			<Navbar />

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
				<div className="text-center mb-16">
					<h1 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-black">
						Financial Solutions for Every Need
					</h1>
					<p className="text-xl md:text-2xl text-gray-600 dark:text-gray-600 max-w-3xl mx-auto">
						Choose from our range of carefully crafted financial
						products designed to support your business or lifestyle
					</p>
				</div>

				<div className="flex justify-center gap-4 mb-12">
					{Object.entries(products).map(([key, value]) => (
						<button
							key={key}
							onClick={() =>
								setActiveProduct(key as "business" | "personal")
							}
							className={`px-8 py-3 rounded-full font-semibold transition-all ${
								activeProduct === key
									? key === "business"
										? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
										: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg"
									: "bg-white text-gray-600 hover:bg-gray-50"
							}`}
						>
							{value.title}
						</button>
					))}
				</div>

				<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
					{products[activeProduct].types.map((product) => (
						<div
							key={product.id}
							className={`rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all flex flex-col h-full backdrop-blur-lg ${
								product.id !== "employee" ? "opacity-60" : ""
							} ${
								activeProduct === "business"
									? "bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-blue-500/10 hover:from-blue-500/20 hover:via-indigo-500/20 hover:to-blue-500/20 border border-blue-200/20"
									: "bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-emerald-500/10 hover:from-emerald-500/20 hover:via-teal-500/20 hover:to-emerald-500/20 border border-emerald-200/20"
							}`}
						>
							<div className="flex-1">
								<div className="flex items-center gap-4 mb-6">
									<div
										className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-lg ${
											activeProduct === "business"
												? "bg-blue-100/90 text-blue-600"
												: "bg-emerald-100/90 text-emerald-600"
										}`}
									>
										{product.icon}
									</div>
									<div>
										<h3 className="text-xl font-semibold text-black dark:text-black mb-1">
											{product.title}
										</h3>
										<span
											className={`text-sm px-2 py-1 rounded-full backdrop-blur-lg ${
												activeProduct === "business"
													? "bg-blue-100/90 text-blue-700"
													: "bg-emerald-100/90 text-emerald-700"
											}`}
										>
											{product.maxAmount}
										</span>
									</div>
								</div>

								<p className="text-gray-700 dark:text-gray-700 mb-6">
									{product.description}
								</p>

								<div className="space-y-3">
									{product.features.map((feature, index) => (
										<div
											key={index}
											className="flex items-center gap-2 text-gray-700"
										>
											<svg
												className={`w-5 h-5 ${
													activeProduct === "business"
														? "text-blue-600"
														: "text-emerald-600"
												}`}
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											<span>{feature}</span>
										</div>
									))}
								</div>
							</div>

							<div className="mt-8">
								{product.id === "employee" ? (
									<div className="flex gap-4">
										<a
											href="/apply"
											className={`flex-1 text-center text-white px-6 py-3 rounded-full font-semibold transition-all shadow-lg ${
												activeProduct === "business"
													? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
													: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
											}`}
										>
											Apply Now
										</a>
										<a
											href="/pay-advance"
											className={`flex-1 text-center px-6 py-3 rounded-full font-semibold transition-all border-2 ${
												activeProduct === "business"
													? "border-blue-600 text-blue-700 hover:bg-blue-50"
													: "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
											}`}
										>
											Learn More
										</a>
									</div>
								) : (
									<div className="w-full text-center text-gray-500 px-6 py-3 rounded-full font-semibold bg-gray-100/80 backdrop-blur-lg">
										Coming Soon
									</div>
								)}
							</div>
						</div>
					))}
				</div>
			</div>

			<Footer />
		</main>
	);
}
