"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import Cookies from "js-cookie";
import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
} from "@mui/material";

interface LoanApplication {
	id: string;
	status: string;
	appStep: number;
	amount: number;
	term: number;
	purpose: string;
	createdAt: string;
	updatedAt: string;
	product: {
		name: string;
		code: string;
	};
}

export default function ApplicationsTable() {
	const router = useRouter();
	const [applications, setApplications] = useState<LoanApplication[]>([]);
	const [loading, setLoading] = useState(true);
	const [userName, setUserName] = useState<string>("");
	const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
	const [selectedApplication, setSelectedApplication] =
		useState<LoanApplication | null>(null);
	const [withdrawing, setWithdrawing] = useState(false);
	const [activeFilter, setActiveFilter] = useState<string | null>(null);

	useEffect(() => {
		const checkAuth = async () => {
			try {
				let token =
					localStorage.getItem("token") || Cookies.get("token");

				if (!token) {
					router.push("/login");
					return;
				}

				// Fetch user data
				const userResponse = await fetch("/api/users/me", {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				if (!userResponse.ok) {
					router.push("/login");
					return;
				}

				const userData = await userResponse.json();
				setUserName(
					userData.firstName ||
						userData.fullName?.split(" ")[0] ||
						"Guest"
				);

				// Fetch applications
				const response = await fetch("/api/loan-applications", {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				if (!response.ok) {
					throw new Error("Failed to fetch applications");
				}

				const data = await response.json();
				setApplications(data);
			} catch (error) {
				console.error("Error:", error);
			} finally {
				setLoading(false);
			}
		};

		checkAuth();
	}, [router]);

	const getStatusColor = (status: string) => {
		switch (status) {
			case "INCOMPLETE":
				return "bg-yellow-100 text-yellow-800";
			case "PENDING_APP_FEE":
			case "PENDING_KYC":
			case "PENDING_APPROVAL":
				return "bg-blue-100 text-blue-800";
			case "APPROVED":
				return "bg-green-100 text-green-800";
			case "REJECTED":
				return "bg-red-100 text-red-800";
			case "DISBURSED":
				return "bg-purple-100 text-purple-800";
			case "WITHDRAWN":
				return "bg-gray-100 text-gray-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const getStatusLabel = (status: string) => {
		switch (status) {
			case "INCOMPLETE":
				return "Incomplete";
			case "PENDING_APP_FEE":
				return "Pending Fee";
			case "PENDING_KYC":
				return "Pending KYC";
			case "PENDING_APPROVAL":
				return "Under Review";
			case "APPROVED":
				return "Approved";
			case "REJECTED":
				return "Rejected";
			case "DISBURSED":
				return "Disbursed";
			case "WITHDRAWN":
				return "Withdrawn";
			default:
				return status;
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-MY", {
			style: "currency",
			currency: "MYR",
		}).format(amount);
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-MY", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const handleWithdrawClick = (app: LoanApplication) => {
		setSelectedApplication(app);
		setWithdrawDialogOpen(true);
	};

	const handleWithdrawConfirm = async () => {
		if (!selectedApplication) return;

		try {
			setWithdrawing(true);
			const token = localStorage.getItem("token") || Cookies.get("token");

			if (!token) {
				router.push("/login");
				return;
			}

			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${selectedApplication.id}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						status: "WITHDRAWN",
					}),
				}
			);

			if (!response.ok) {
				throw new Error("Failed to withdraw application");
			}

			// Update the local state to reflect the withdrawn status
			setApplications(
				applications.map((app) =>
					app.id === selectedApplication.id
						? { ...app, status: "WITHDRAWN" }
						: app
				)
			);

			setWithdrawDialogOpen(false);
			setSelectedApplication(null);
		} catch (error) {
			console.error("Error withdrawing application:", error);
		} finally {
			setWithdrawing(false);
		}
	};

	const handleWithdrawCancel = () => {
		setWithdrawDialogOpen(false);
		setSelectedApplication(null);
	};

	// Get unique statuses from applications
	const uniqueStatuses = Array.from(
		new Set(applications.map((app) => app.status))
	);

	// Filter applications based on active filter
	const filteredApplications = activeFilter
		? applications.filter((app) => app.status === activeFilter)
		: applications;

	return (
		<DashboardLayout userName={userName}>
			<div className="bg-white rounded-lg shadow-sm border border-gray-200">
				<div className="px-6 py-4 border-b border-gray-200">
					<h2 className="text-xl font-semibold text-gray-900">
						Loan Applications
					</h2>

					{/* Status Filters */}
					<div className="mt-4 flex flex-wrap gap-2">
						<button
							onClick={() => setActiveFilter(null)}
							className={`px-3 py-1 rounded-full text-sm font-medium ${
								activeFilter === null
									? "bg-indigo-100 text-indigo-800 border border-indigo-300"
									: "bg-gray-100 text-gray-800 hover:bg-gray-200"
							}`}
						>
							All
						</button>
						{uniqueStatuses.map((status) => (
							<button
								key={status}
								onClick={() => setActiveFilter(status)}
								className={`px-3 py-1 rounded-full text-sm font-medium ${
									activeFilter === status
										? "border border-gray-300"
										: ""
								} ${getStatusColor(status)}`}
							>
								{getStatusLabel(status)}
							</button>
						))}
					</div>
				</div>
				<div className="overflow-x-auto">
					{loading ? (
						<div className="flex justify-center items-center p-8">
							<div
								className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent align-[-0.125em]"
								role="status"
							>
								<span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
									Loading...
								</span>
							</div>
						</div>
					) : filteredApplications.length > 0 ? (
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Product
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Amount
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Term
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Purpose
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Status
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Applied On
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Action
									</th>
								</tr>
							</thead>
							<tbody className="bg-white divide-y divide-gray-200">
								{filteredApplications.map((app) => (
									<tr key={app.id}>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm font-medium text-gray-900">
												{app.product?.name ||
													"Unknown Product"}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm text-gray-900">
												{app.amount
													? formatCurrency(app.amount)
													: "-"}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm text-gray-900">
												{app.term
													? `${app.term} months`
													: "-"}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm text-gray-900">
												{app.purpose || "-"}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<span
												className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
													app.status
												)}`}
											>
												{getStatusLabel(app.status)}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm text-gray-900">
												{app.status === "INCOMPLETE"
													? "-"
													: formatDate(app.updatedAt)}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											{app.status === "INCOMPLETE" ? (
												<Link
													href={`/dashboard/apply?applicationId=${
														app.id
													}&step=${
														app.appStep
													}&productCode=${
														app.product?.code || ""
													}`}
													className="text-indigo-600 hover:text-indigo-900"
												>
													Resume
												</Link>
											) : (
												<div className="flex items-center gap-2">
													<Link
														href={`/dashboard/applications/${app.id}`}
														className="text-indigo-600 hover:text-indigo-900"
													>
														View Details
													</Link>
													{[
														"PENDING_APP_FEE",
														"PENDING_KYC",
														"PENDING_APPROVAL",
													].includes(app.status) && (
														<button
															onClick={() =>
																handleWithdrawClick(
																	app
																)
															}
															className="text-red-600 hover:text-red-900"
														>
															Withdraw
														</button>
													)}
												</div>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					) : (
						<div className="text-center py-8">
							<p className="text-gray-500">
								{activeFilter
									? `No applications with status "${getStatusLabel(
											activeFilter
									  )}" found`
									: "No applications found"}
							</p>
						</div>
					)}
				</div>

				{/* Withdraw Confirmation Dialog */}
				<Dialog
					open={withdrawDialogOpen}
					onClose={handleWithdrawCancel}
					aria-labelledby="withdraw-dialog-title"
					aria-describedby="withdraw-dialog-description"
				>
					<DialogTitle id="withdraw-dialog-title">
						Withdraw Application
					</DialogTitle>
					<DialogContent>
						<DialogContentText id="withdraw-dialog-description">
							Are you sure you want to withdraw this loan
							application? This action cannot be undone.
						</DialogContentText>
					</DialogContent>
					<DialogActions>
						<Button onClick={handleWithdrawCancel} color="primary">
							Cancel
						</Button>
						<Button
							onClick={handleWithdrawConfirm}
							color="error"
							variant="contained"
							disabled={withdrawing}
						>
							{withdrawing ? "Withdrawing..." : "Withdraw"}
						</Button>
					</DialogActions>
				</Dialog>
			</div>
		</DashboardLayout>
	);
}
