"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Cookies from "js-cookie";
import { PencilIcon } from "@heroicons/react/24/outline";

interface UserProfile {
	id: string;
	phoneNumber: string;
	fullName: string | null;
	email: string | null;
	dateOfBirth: string | null;
	address1: string | null;
	address2: string | null;
	city: string | null;
	state: string | null;
	postalCode: string | null;
	employmentStatus: string | null;
	employerName: string | null;
	monthlyIncome: string | null;
	bankName: string | null;
	accountNumber: string | null;
	isOnboardingComplete: boolean;
	onboardingStep: number;
	createdAt: string;
	updatedAt: string;
	lastLoginAt: string | null;
	kycStatus: boolean;
}

const employmentStatuses = [
	"Employed",
	"Self-Employed",
	"Student",
	"Unemployed",
] as const;

const incomeRanges = [
	"Below RM2,000",
	"RM2,000 - RM4,000",
	"RM4,001 - RM6,000",
	"RM6,001 - RM8,000",
	"RM8,001 - RM10,000",
	"Above RM10,000",
] as const;

type EditingSections = "personal" | "address" | "employment" | "banking" | null;

export default function ProfilePage() {
	const router = useRouter();
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [editingSection, setEditingSection] = useState<EditingSections>(null);
	const [formData, setFormData] = useState<Partial<UserProfile>>({});

	useEffect(() => {
		const fetchProfile = async () => {
			try {
				const token =
					localStorage.getItem("token") || Cookies.get("token");

				if (!token) {
					router.push("/login");
					return;
				}

				const response = await fetch("/api/users/me", {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				if (!response.ok) {
					throw new Error("Failed to fetch profile");
				}

				const data = await response.json();
				if (data.dateOfBirth) {
					data.dateOfBirth = new Date(data.dateOfBirth)
						.toISOString()
						.split("T")[0];
				}
				setProfile(data);
				setFormData(data);
			} catch (error) {
				console.error("Error fetching profile:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchProfile();
	}, [router]);

	const handleEdit = (section: EditingSections) => {
		setEditingSection(section);
	};

	const handleCancel = () => {
		setEditingSection(null);
		setFormData(profile || {});
	};

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleSave = async () => {
		if (!profile) return;

		setSaving(true);
		try {
			const token = localStorage.getItem("token") || Cookies.get("token");

			const dataToSend = { ...formData };

			if (dataToSend.dateOfBirth) {
				// Keep the date as is since it's already in YYYY-MM-DD format
				// The API will handle the conversion to UTC
			}

			const response = await fetch("/api/users/me", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(dataToSend),
			});

			if (!response.ok) {
				throw new Error(
					`Failed to update profile: ${response.status} ${response.statusText}`
				);
			}

			const updatedData = await response.json();
			if (updatedData.dateOfBirth) {
				updatedData.dateOfBirth = new Date(updatedData.dateOfBirth)
					.toISOString()
					.split("T")[0];
			}
			setProfile(updatedData);
			setEditingSection(null);
		} catch (error) {
			console.error("Error updating profile:", error);
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<DashboardLayout title="Profile">
				<div className="flex items-center justify-center h-full">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
				</div>
			</DashboardLayout>
		);
	}

	if (!profile) {
		return (
			<DashboardLayout title="Profile">
				<div className="bg-white shadow rounded-lg p-6">
					<p className="text-gray-500">
						Failed to load profile information.
					</p>
				</div>
			</DashboardLayout>
		);
	}

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		// Convert to GMT+8
		const gmt8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);

		return gmt8Date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	const formatDateTime = (dateString: string) => {
		const date = new Date(dateString);
		// Convert to GMT+8
		const gmt8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);

		return (
			gmt8Date.toLocaleString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
				timeZone: "UTC",
			}) + " GMT+8"
		);
	};

	const renderBadge = (status: boolean, label: string) => (
		<span
			className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
				status
					? "bg-green-100 text-green-800"
					: "bg-yellow-100 text-yellow-800"
			}`}
		>
			<span
				className={`h-2 w-2 mr-1.5 rounded-full ${
					status ? "bg-green-400" : "bg-yellow-400"
				}`}
			></span>
			{label}
		</span>
	);

	const renderEditButton = (section: EditingSections) => (
		<button
			onClick={() => handleEdit(section)}
			className="text-indigo-600 hover:text-indigo-500 flex items-center text-sm font-medium"
		>
			<PencilIcon className="h-4 w-4 mr-1" />
			Edit
		</button>
	);

	const renderSaveButtons = () => (
		<div className="flex justify-end space-x-3 mt-4">
			<button
				onClick={handleCancel}
				className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
				disabled={saving}
			>
				Cancel
			</button>
			<button
				onClick={handleSave}
				className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
				disabled={saving}
			>
				{saving ? "Saving..." : "Save Changes"}
			</button>
		</div>
	);

	const renderInput = (
		name: keyof UserProfile,
		label: string,
		type: string = "text",
		options?: readonly string[]
	) => (
		<div>
			<label className="block text-sm font-medium text-gray-500">
				{label}
			</label>
			{options ? (
				<select
					name={name}
					value={String(formData[name] || "")}
					onChange={handleInputChange}
					className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				>
					<option value="">Select {label}</option>
					{options.map((option) => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</select>
			) : (
				<input
					type={type}
					name={name}
					value={String(formData[name] || "")}
					onChange={handleInputChange}
					className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				/>
			)}
		</div>
	);

	return (
		<DashboardLayout
			title="Profile"
			userName={profile.fullName?.split(" ")[0] || "User"}
		>
			<div className="space-y-6">
				{/* Personal Information */}
				<div className="bg-white shadow rounded-lg">
					<div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
						<h2 className="text-lg font-medium text-gray-900">
							Personal Information
						</h2>
						{editingSection !== "personal" &&
							renderEditButton("personal")}
					</div>
					<div className="px-6 py-4 space-y-4">
						{editingSection === "personal" ? (
							<div className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									{renderInput("fullName", "Full Name")}
									{renderInput("email", "Email", "email")}
									{renderInput(
										"phoneNumber",
										"Phone Number",
										"tel"
									)}
									{renderInput(
										"dateOfBirth",
										"Date of Birth",
										"date"
									)}
								</div>
								{renderSaveButtons()}
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-gray-500">
										Full Name
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.fullName || "Not provided"}
									</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-500">
										Email
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.email || "Not provided"}
									</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-500">
										Phone Number
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.phoneNumber}
									</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-500">
										Date of Birth
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.dateOfBirth
											? formatDate(profile.dateOfBirth)
											: "Not provided"}
									</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Address */}
				<div className="bg-white shadow rounded-lg">
					<div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
						<h2 className="text-lg font-medium text-gray-900">
							Address
						</h2>
						{editingSection !== "address" &&
							renderEditButton("address")}
					</div>
					<div className="px-6 py-4 space-y-4">
						{editingSection === "address" ? (
							<div className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="md:col-span-2">
										{renderInput(
											"address1",
											"Address Line 1"
										)}
									</div>
									<div className="md:col-span-2">
										{renderInput(
											"address2",
											"Address Line 2"
										)}
									</div>
									{renderInput("city", "City")}
									{renderInput("state", "State")}
									{renderInput("postalCode", "Postal Code")}
								</div>
								{renderSaveButtons()}
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="md:col-span-2">
									<label className="block text-sm font-medium text-gray-500">
										Address Line 1
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.address1 || "Not provided"}
									</p>
								</div>
								<div className="md:col-span-2">
									<label className="block text-sm font-medium text-gray-500">
										Address Line 2
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.address2 || "Not provided"}
									</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-500">
										City
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.city || "Not provided"}
									</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-500">
										State
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.state || "Not provided"}
									</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-500">
										Postal Code
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.postalCode || "Not provided"}
									</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Employment */}
				<div className="bg-white shadow rounded-lg">
					<div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
						<h2 className="text-lg font-medium text-gray-900">
							Employment Information
						</h2>
						{editingSection !== "employment" &&
							renderEditButton("employment")}
					</div>
					<div className="px-6 py-4 space-y-4">
						{editingSection === "employment" ? (
							<div className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									{renderInput(
										"employmentStatus",
										"Employment Status",
										"text",
										employmentStatuses
									)}
									{formData.employmentStatus &&
										formData.employmentStatus !==
											"Student" &&
										formData.employmentStatus !==
											"Unemployed" && (
											<>
												{renderInput(
													"employerName",
													"Employer Name"
												)}
											</>
										)}
									{renderInput(
										"monthlyIncome",
										"Monthly Income",
										"text",
										incomeRanges
									)}
								</div>
								{renderSaveButtons()}
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-gray-500">
										Employment Status
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.employmentStatus ||
											"Not provided"}
									</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-500">
										Employer Name
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.employerName || "Not provided"}
									</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-500">
										Monthly Income
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.monthlyIncome ||
											"Not provided"}
									</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Banking Information */}
				<div className="bg-white shadow rounded-lg">
					<div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
						<h2 className="text-lg font-medium text-gray-900">
							Banking Information
						</h2>
						{editingSection !== "banking" &&
							renderEditButton("banking")}
					</div>
					<div className="px-6 py-4 space-y-4">
						{editingSection === "banking" ? (
							<div className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									{renderInput("bankName", "Bank Name")}
									{renderInput(
										"accountNumber",
										"Account Number"
									)}
								</div>
								{renderSaveButtons()}
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-gray-500">
										Bank Name
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.bankName || "Not provided"}
									</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-500">
										Account Number
									</label>
									<p className="mt-1 text-sm text-gray-900">
										{profile.accountNumber
											? "••••" +
											  profile.accountNumber.slice(-4)
											: "Not provided"}
									</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Account Information */}
				<div className="bg-white shadow rounded-lg">
					<div className="px-6 py-4 border-b border-gray-200">
						<h2 className="text-lg font-medium text-gray-900">
							Account Information
						</h2>
					</div>
					<div className="px-6 py-4 space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-500">
									Member Since
								</label>
								<p className="mt-1 text-sm text-gray-900">
									{formatDate(profile.createdAt)}
								</p>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-500">
									Last Updated
								</label>
								<p className="mt-1 text-sm text-gray-900">
									{formatDate(profile.updatedAt)}
								</p>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-500">
									Last Login
								</label>
								<p className="mt-1 text-sm text-gray-900">
									{profile.lastLoginAt
										? formatDateTime(profile.lastLoginAt)
										: "Not available"}
								</p>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-500">
									Onboarding Status
								</label>
								<div className="mt-1">
									{renderBadge(
										profile.isOnboardingComplete,
										profile.isOnboardingComplete
											? "Complete"
											: `In Progress (Step ${profile.onboardingStep}/4)`
									)}
								</div>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-500">
									KYC Status
								</label>
								<div className="mt-1">
									{renderBadge(
										profile.kycStatus,
										profile.kycStatus
											? "Verified"
											: "Not Verified"
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
}
