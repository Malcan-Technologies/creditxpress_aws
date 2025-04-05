"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import {
	Box,
	Typography,
	Paper,
	Alert,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import * as Tooltip from "@radix-ui/react-tooltip";
import Cookies from "js-cookie";

interface LoanApplication {
	id: string;
	status: string;
	appStep: number;
	amount: number;
	term: number;
	purpose: string;
	createdAt: string;
	product: {
		name: string;
		code: string;
		originationFee: number;
		legalFee: number;
		applicationFee: number;
		interestRate: number;
	};
	monthlyRepayment: number;
	interestRate: number;
	legalFee: number;
	netDisbursement: number;
	documents: Array<{
		id: string;
		name: string;
		status: string;
	}>;
}

export default function ApplicationDetails({
	params,
}: {
	params: { id: string };
}) {
	const router = useRouter();
	const [application, setApplication] = useState<LoanApplication | null>(
		null
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [userName, setUserName] = useState<string>("");
	const [openTooltip, setOpenTooltip] = useState<string | null>(null);
	const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
	const [withdrawing, setWithdrawing] = useState(false);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const token =
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

				// Fetch application data
				const applicationResponse = await fetch(
					`/api/loan-applications/${params.id}`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
						},
					}
				);

				if (!applicationResponse.ok) {
					throw new Error("Failed to fetch application details");
				}

				const applicationData = await applicationResponse.json();
				setApplication(applicationData);
			} catch (err) {
				console.error("Error:", err);
				setError(
					err instanceof Error
						? err.message
						: "Failed to load application details"
				);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [params.id, router]);

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
			default:
				return status;
		}
	};

	const handleWithdrawClick = () => {
		setWithdrawDialogOpen(true);
	};

	const handleWithdrawConfirm = async () => {
		if (!application) return;

		try {
			setWithdrawing(true);
			const token = localStorage.getItem("token") || Cookies.get("token");

			if (!token) {
				router.push("/login");
				return;
			}

			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${application.id}/status`,
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
			setApplication({ ...application, status: "WITHDRAWN" });

			setWithdrawDialogOpen(false);
		} catch (error) {
			console.error("Error withdrawing application:", error);
			setError("Failed to withdraw application. Please try again.");
		} finally {
			setWithdrawing(false);
		}
	};

	const handleWithdrawCancel = () => {
		setWithdrawDialogOpen(false);
	};

	if (loading) {
		return (
			<DashboardLayout userName={userName}>
				<Box className="flex justify-center items-center p-6">
					<Typography>Loading application details...</Typography>
				</Box>
			</DashboardLayout>
		);
	}

	if (error || !application) {
		return (
			<DashboardLayout userName={userName}>
				<Box className="p-6">
					<Alert severity="error" className="mb-4">
						{error ||
							"Failed to load application details. Please try again later."}
					</Alert>
				</Box>
			</DashboardLayout>
		);
	}

	const calculateFees = () => {
		const amount = application.amount;
		const legalFee = application.legalFee;
		const netDisbursement = application.netDisbursement;
		const originationFee = amount - netDisbursement - legalFee;
		const applicationFee = Number(application.product.applicationFee) || 0;

		return {
			interestRate: application.interestRate,
			legalFee,
			netDisbursement,
			originationFee,
			applicationFee,
			totalFees: originationFee + legalFee + applicationFee,
		};
	};

	const fees = calculateFees();

	return (
		<DashboardLayout userName={userName}>
			<Box className="space-y-6">
				<div className="flex justify-between items-center">
					<div className="flex items-center gap-4">
						<Button
							variant="text"
							startIcon={<ArrowBackIcon fontSize="small" />}
							onClick={() =>
								router.push("/dashboard/applications")
							}
							className="text-gray-500 hover:text-gray-700 text-sm"
							size="small"
						>
							Back
						</Button>
						<Typography variant="h6" className="text-gray-900">
							Application Details
						</Typography>
					</div>
					<div className="flex items-center gap-4">
						<span
							className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(
								application.status
							)}`}
						>
							{getStatusLabel(application.status)}
						</span>
						{application &&
							[
								"PENDING_APP_FEE",
								"PENDING_KYC",
								"PENDING_APPROVAL",
							].includes(application.status) && (
								<Button
									variant="outlined"
									color="error"
									size="small"
									onClick={handleWithdrawClick}
								>
									Withdraw Application
								</Button>
							)}
					</div>
				</div>

				<Paper className="p-6">
					<Typography variant="h6" className="text-gray-900 mb-6">
						Loan Details
					</Typography>
					<div className="space-y-4">
						<div className="flex justify-between">
							<Typography className="text-gray-600">
								Product
							</Typography>
							<Typography className="text-gray-900 font-medium">
								{application.product.name}
							</Typography>
						</div>
						<div className="flex justify-between">
							<Typography className="text-gray-600">
								Loan Amount
							</Typography>
							<Typography className="text-gray-900 font-medium">
								{formatCurrency(application.amount)}
							</Typography>
						</div>
						<div className="flex justify-between">
							<Typography className="text-gray-600">
								Loan Purpose
							</Typography>
							<Typography className="text-gray-900 font-medium">
								{application.purpose}
							</Typography>
						</div>
						<div className="flex justify-between">
							<Typography className="text-gray-600">
								Loan Term
							</Typography>
							<Typography className="text-gray-900 font-medium">
								{application.term} months
							</Typography>
						</div>
						<div className="flex justify-between">
							<Typography className="text-gray-600">
								Interest Rate
							</Typography>
							<Typography className="text-gray-900 font-medium">
								{application.interestRate}% monthly
							</Typography>
						</div>

						<div className="pt-4 border-t border-gray-200">
							<div className="space-y-4">
								<div className="flex justify-between">
									<div className="flex items-center gap-1">
										<Typography className="text-gray-600">
											Origination Fee (
											{application.product.originationFee}
											%)
										</Typography>
										<Tooltip.Provider>
											<Tooltip.Root>
												<Tooltip.Trigger asChild>
													<InfoIcon
														className="text-gray-400 cursor-pointer"
														fontSize="small"
													/>
												</Tooltip.Trigger>
												<Tooltip.Portal>
													<Tooltip.Content className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs">
														A one-time fee charged
														by the lender for
														processing your loan
														application.
														<Tooltip.Arrow className="fill-gray-800" />
													</Tooltip.Content>
												</Tooltip.Portal>
											</Tooltip.Root>
										</Tooltip.Provider>
									</div>
									<Typography className="text-red-600">
										({formatCurrency(fees.originationFee)})
									</Typography>
								</div>

								<div className="flex justify-between">
									<div className="flex items-center gap-1">
										<Typography className="text-gray-600">
											Legal Fee (
											{application.product.legalFee}%)
										</Typography>
										<Tooltip.Provider>
											<Tooltip.Root>
												<Tooltip.Trigger asChild>
													<InfoIcon
														className="text-gray-400 cursor-pointer"
														fontSize="small"
													/>
												</Tooltip.Trigger>
												<Tooltip.Portal>
													<Tooltip.Content className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs">
														A fee charged to cover
														the legal costs
														associated with
														preparing and processing
														your loan documents.
														<Tooltip.Arrow className="fill-gray-800" />
													</Tooltip.Content>
												</Tooltip.Portal>
											</Tooltip.Root>
										</Tooltip.Provider>
									</div>
									<Typography className="text-red-600">
										({formatCurrency(fees.legalFee)})
									</Typography>
								</div>

								<div className="flex justify-between">
									<div className="flex items-center gap-1">
										<Typography className="text-gray-600">
											Application Fee (paid upfront)
										</Typography>
										<Tooltip.Provider>
											<Tooltip.Root>
												<Tooltip.Trigger asChild>
													<InfoIcon
														className="text-gray-400 cursor-pointer"
														fontSize="small"
													/>
												</Tooltip.Trigger>
												<Tooltip.Portal>
													<Tooltip.Content className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs">
														A non-refundable fee
														charged when you submit
														your loan application.
														<Tooltip.Arrow className="fill-gray-800" />
													</Tooltip.Content>
												</Tooltip.Portal>
											</Tooltip.Root>
										</Tooltip.Provider>
									</div>
									<Typography className="text-red-600">
										({formatCurrency(fees.applicationFee)})
									</Typography>
								</div>
							</div>
						</div>

						<div className="pt-4 border-t border-gray-200">
							<div className="space-y-4">
								<div className="flex justify-between">
									<div className="flex items-center gap-1">
										<Typography className="text-gray-900 font-bold">
											Net Loan Disbursement
										</Typography>
										<Tooltip.Provider>
											<Tooltip.Root>
												<Tooltip.Trigger asChild>
													<InfoIcon
														className="text-gray-400 cursor-pointer"
														fontSize="small"
													/>
												</Tooltip.Trigger>
												<Tooltip.Portal>
													<Tooltip.Content className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs">
														The actual amount you
														will receive after
														deducting all fees.
														<Tooltip.Arrow className="fill-gray-800" />
													</Tooltip.Content>
												</Tooltip.Portal>
											</Tooltip.Root>
										</Tooltip.Provider>
									</div>
									<Typography className="text-green-600 font-bold">
										{formatCurrency(fees.netDisbursement)}
									</Typography>
								</div>

								<div className="flex justify-between">
									<div className="flex items-center gap-1">
										<Typography className="text-gray-900 font-bold">
											Monthly Repayment
										</Typography>
										<Tooltip.Provider>
											<Tooltip.Root>
												<Tooltip.Trigger asChild>
													<InfoIcon
														className="text-gray-400 cursor-pointer"
														fontSize="small"
													/>
												</Tooltip.Trigger>
												<Tooltip.Portal>
													<Tooltip.Content className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs">
														The amount you need to
														pay each month,
														including principal and
														interest.
														<Tooltip.Arrow className="fill-gray-800" />
													</Tooltip.Content>
												</Tooltip.Portal>
											</Tooltip.Root>
										</Tooltip.Provider>
									</div>
									<Typography className="text-red-600 font-bold">
										(
										{formatCurrency(
											application.monthlyRepayment
										)}
										)
									</Typography>
								</div>
							</div>
						</div>
					</div>
				</Paper>

				<Paper className="p-6">
					<Typography variant="h6" className="text-gray-900 mb-4">
						Documents
					</Typography>
					<div className="space-y-2">
						{application.documents.map((doc) => (
							<div
								key={doc.id}
								className="flex justify-between items-center"
							>
								<Typography className="text-gray-600">
									{doc.name}
								</Typography>
								<Typography
									className={
										doc.status === "success"
											? "text-green-600"
											: "text-yellow-600"
									}
								>
									{doc.status === "success"
										? "Uploaded"
										: "Pending"}
								</Typography>
							</div>
						))}
					</div>
				</Paper>

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
			</Box>
		</DashboardLayout>
	);
}
