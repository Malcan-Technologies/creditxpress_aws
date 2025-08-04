"use client";

import React, { useState, useEffect } from "react";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";
import AdminLayout from "../../components/AdminLayout";
import {
	CogIcon,
	BanknotesIcon,
	BellIcon,
	PlusIcon,
	TrashIcon,
	PencilIcon,
	StarIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";

interface SystemSetting {
	id: string;
	key: string;
	category: string;
	name: string;
	description: string;
	dataType: string;
	value: any;
	options?: any;
	isActive: boolean;
	requiresRestart: boolean;
	affectsExistingLoans: boolean;
	lastChangedBy?: string;
	lastChangedAt?: string;
}

interface SettingsData {
	[category: string]: SystemSetting[];
}

interface SettingUpdate {
	key: string;
	value: any;
}

interface BankAccount {
	id?: string;
	bankName: string;
	accountName: string;
	accountNumber: string;
	isActive: boolean;
	isDefault?: boolean;
	createdAt?: string;
	updatedAt?: string;
}

interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	message: string;
}

function SettingsPageContent() {
	// Tab state
	const [activeTab, setActiveTab] = useState("system");
	
	// System settings state
	const [settings, setSettings] = useState<SettingsData>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pendingChanges, setPendingChanges] = useState<SettingUpdate[]>([]);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	
	// Bank accounts state
	const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
	const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
	const [showAddBankAccount, setShowAddBankAccount] = useState(false);
	const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
	const [newBankAccount, setNewBankAccount] = useState<BankAccount>({
		bankName: "",
		accountName: "",
		accountNumber: "",
		isActive: true,
		isDefault: false,
	});

	// Load data on component mount and tab change
	useEffect(() => {
		if (activeTab === "system") {
			loadSettings();
		} else if (activeTab === "bank-accounts") {
			loadBankAccounts();
		}
	}, [activeTab]);

	// Load bank accounts
	const loadBankAccounts = async () => {
		try {
			setBankAccountsLoading(true);
			setError(null);

			const backendUrl = process.env.NEXT_PUBLIC_API_URL;
			const response = await fetchWithAdminTokenRefresh(`${backendUrl}/api/bank-accounts`, {
				method: "GET",
			}) as ApiResponse<BankAccount[]>;

			if (response.success) {
				setBankAccounts(response.data || []);
			} else {
				throw new Error(response.message || "Failed to load bank accounts");
			}
		} catch (err) {
			console.error("Error loading bank accounts:", err);
			setError(err instanceof Error ? err.message : "Failed to load bank accounts");
			setBankAccounts([]); // Set empty array on error
		} finally {
			setBankAccountsLoading(false);
		}
	};

	// Save bank account
	const saveBankAccount = async (bankAccount: BankAccount) => {
		try {
			setSaving(true);
			setError(null);

			const backendUrl = process.env.NEXT_PUBLIC_API_URL;
			const url = bankAccount.id 
				? `${backendUrl}/api/bank-accounts/${bankAccount.id}`
				: `${backendUrl}/api/bank-accounts`;
			
			const method = bankAccount.id ? "PUT" : "POST";

			const response = await fetchWithAdminTokenRefresh(url, {
				method,
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(bankAccount),
			}) as ApiResponse<BankAccount>;

			if (response.success) {
				await loadBankAccounts();
				setShowAddBankAccount(false);
				setEditingBankAccount(null);
				setNewBankAccount({
					bankName: "",
					accountName: "",
					accountNumber: "",
					isActive: true,
					isDefault: false,
				});
				alert("Bank account saved successfully!");
			} else {
				throw new Error(response.message || "Failed to save bank account");
			}
		} catch (err) {
			console.error("Error saving bank account:", err);
			setError(err instanceof Error ? err.message : "Failed to save bank account");
		} finally {
			setSaving(false);
		}
	};

	// Delete bank account
	const deleteBankAccount = async (id: string) => {
		if (!confirm("Are you sure you want to delete this bank account?")) {
			return;
		}

		try {
			setSaving(true);
			setError(null);

			const backendUrl = process.env.NEXT_PUBLIC_API_URL;
			const response = await fetchWithAdminTokenRefresh(`${backendUrl}/api/bank-accounts/${id}`, {
				method: "DELETE",
			}) as ApiResponse;

			if (response.success) {
				await loadBankAccounts();
				alert("Bank account deleted successfully!");
			} else {
				throw new Error(response.message || "Failed to delete bank account");
			}
		} catch (err) {
			console.error("Error deleting bank account:", err);
			setError(err instanceof Error ? err.message : "Failed to delete bank account");
		} finally {
			setSaving(false);
		}
	};

	// Set bank account as default
	const setAsDefault = async (id: string) => {
		try {
			setSaving(true);
			setError(null);

			const backendUrl = process.env.NEXT_PUBLIC_API_URL;
			const response = await fetchWithAdminTokenRefresh(`${backendUrl}/api/bank-accounts/${id}/set-default`, {
				method: "POST",
			}) as ApiResponse<BankAccount>;

			if (response.success) {
				await loadBankAccounts();
				alert("Default bank account updated successfully!");
			} else {
				throw new Error(response.message || "Failed to set default bank account");
			}
		} catch (err) {
			console.error("Error setting default bank account:", err);
			setError(err instanceof Error ? err.message : "Failed to set default bank account");
		} finally {
			setSaving(false);
		}
	};

	const loadSettings = async () => {
		try {
			setLoading(true);
			setError(null);

			// Fetch settings directly from backend like the products page
			const backendUrl = process.env.NEXT_PUBLIC_API_URL;
			const response = await fetchWithAdminTokenRefresh(`${backendUrl}/api/settings/categories`, {
				method: "GET",
			}) as ApiResponse<SettingsData>;

			if (response.success) {
				setSettings(response.data || {});
			} else {
				throw new Error(response.message || "Failed to load settings");
			}
		} catch (err) {
			console.error("Error loading settings:", err);
			setError(err instanceof Error ? err.message : "Failed to load settings");
		} finally {
			setLoading(false);
		}
	};

	const handleSettingChange = (key: string, value: any) => {
		// Update the local settings display
		const updatedSettings = { ...settings };
		for (const category in updatedSettings) {
			const settingIndex = updatedSettings[category].findIndex(s => s.key === key);
			if (settingIndex !== -1) {
				updatedSettings[category][settingIndex].value = value;
				break;
			}
		}
		setSettings(updatedSettings);

		// Track pending changes
		const existingChangeIndex = pendingChanges.findIndex(change => change.key === key);
		if (existingChangeIndex !== -1) {
			// Update existing change
			const updatedChanges = [...pendingChanges];
			updatedChanges[existingChangeIndex].value = value;
			setPendingChanges(updatedChanges);
		} else {
			// Add new change
			setPendingChanges([...pendingChanges, { key, value }]);
		}

		setHasUnsavedChanges(true);
	};

	const saveSettings = async () => {
		if (pendingChanges.length === 0) return;

		try {
			setSaving(true);
			setError(null);

			// Save settings directly to backend like the products page
			const backendUrl = process.env.NEXT_PUBLIC_API_URL;
			const response = await fetchWithAdminTokenRefresh(`${backendUrl}/api/settings`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					settings: pendingChanges,
				}),
			}) as ApiResponse;

			if (response.success) {
				setPendingChanges([]);
				setHasUnsavedChanges(false);
				
				// Show success message
				alert("Settings saved successfully!");
				
				// Reload settings to get latest data
				await loadSettings();
			} else {
				throw new Error(response.message || "Failed to save settings");
			}
		} catch (err) {
			console.error("Error saving settings:", err);
			setError(err instanceof Error ? err.message : "Failed to save settings");
		} finally {
			setSaving(false);
		}
	};

	const discardChanges = () => {
		setPendingChanges([]);
		setHasUnsavedChanges(false);
		loadSettings(); // Reload original settings
	};

	const renderSettingInput = (setting: SystemSetting) => {
		const { key, dataType, value, options } = setting;

		// Check if this setting should be conditionally displayed
		const shouldShowSetting = () => {
			// Show custom date and cutoff settings only when CUSTOM_DATE is selected
			if (key === "CUSTOM_DUE_DATE" || key === "PRORATION_CUTOFF_DATE") {
				const scheduleTypeSetting = Object.values(settings).flat().find(s => s.key === "PAYMENT_SCHEDULE_TYPE");
				return scheduleTypeSetting?.value === "CUSTOM_DATE";
			}
			return true;
		};

		if (!shouldShowSetting()) {
			return (
				<div className="text-sm text-gray-500 italic">
					Only applies when "Custom Date of Month" is selected
				</div>
			);
		}

		switch (dataType) {
			case "ENUM":
				return (
					<div className="space-y-2">
						<select
							value={value}
							onChange={(e) => handleSettingChange(key, e.target.value)}
							className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						>
							{options && Object.entries(options).map(([optionKey, optionData]: [string, any]) => (
								<option key={optionKey} value={optionKey}>
									{optionData.label}
								</option>
							))}
						</select>
						{/* Show description of selected option */}
						{options && options[value] && (
							<div className="text-xs text-blue-300 bg-blue-900/20 p-2 rounded border border-blue-700/30">
								<strong>Current:</strong> {options[value].description}
							</div>
						)}
					</div>
				);

			case "BOOLEAN":
				return (
					<label className="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							checked={value}
							onChange={(e) => handleSettingChange(key, e.target.checked)}
							className="sr-only peer"
						/>
						<div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-400 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
						<span className="ml-3 text-sm font-medium text-gray-300">
							{value ? "Enabled" : "Disabled"}
						</span>
					</label>
				);

			case "NUMBER":
				return (
					<div className="space-y-2">
						<input
							type="number"
							value={value}
							onChange={(e) => handleSettingChange(key, parseFloat(e.target.value))}
							min={options?.min}
							max={options?.max}
							step={options?.step || 1}
							className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
						{/* Show example for specific settings */}
						{key === "CUSTOM_DUE_DATE" && (
							<div className="text-xs text-green-300 bg-green-900/20 p-2 rounded border border-green-700/30">
								<strong>Example:</strong> Setting to "1" means all payments due on 1st of each month, "15" means 15th of each month
							</div>
						)}
						{key === "PRORATION_CUTOFF_DATE" && (
							<div className="text-xs text-yellow-300 bg-yellow-900/20 p-2 rounded border border-yellow-700/30">
								<strong>Example:</strong> Setting to "20" means loans disbursed on 20th or later get pushed to next month's payment cycle
							</div>
						)}
					</div>
				);

			case "STRING":
			default:
				return (
					<input
						type="text"
						value={value}
						onChange={(e) => handleSettingChange(key, e.target.value)}
						className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
				);
		}
	};

	const getCategoryIcon = (category: string) => {
		switch (category) {
			case "LOAN_CALCULATION":
				return "🧮";
			case "PAYMENT_SCHEDULE":
				return "📅";
			case "LATE_FEES":
				return "⏰";
			case "NOTIFICATIONS":
				return "📱";
			case "LOAN_LIMITS":
				return "📊";
			default:
				return "⚙️";
		}
	};

	const getCategoryDisplayName = (category: string) => {
		switch (category) {
			case "LOAN_CALCULATION":
				return "Interest & Principal Allocation";
			case "PAYMENT_SCHEDULE":
				return "Payment Due Date Schedule";
			case "LATE_FEES":
				return "Late Fee Settings";
			case "NOTIFICATIONS":
				return "Notification Settings";
			default:
				return category.split("_").map(word => 
					word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
				).join(" ");
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			</div>
		);
	}

	// Tab configuration
	const tabs = [
		{
			id: "system",
			label: "Loan Settings",
			icon: CogIcon,
			description: "Configure loan calculations, payment schedules, and late fee settings",
		},
		{
			id: "bank-accounts",
			label: "Bank Accounts",
			icon: BanknotesIcon,
			description: "Manage company bank accounts for payments and transfers",
		},
		{
			id: "notifications",
			label: "Notifications",
			icon: BellIcon,
			description: "Configure notification settings and preferences",
		},
	];

	const renderTabContent = () => {
		switch (activeTab) {
			case "system":
				return renderSystemSettings();
			case "bank-accounts":
				return renderBankAccounts();
			case "notifications":
				return renderNotifications();
			default:
				return renderSystemSettings();
		}
	};

	const renderSystemSettings = () => {
		if (loading) {
			return (
				<div className="flex items-center justify-center min-h-[400px]">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
				</div>
			);
		}

		// Filter out LOAN_LIMITS and NOTIFICATIONS categories for loan settings tab
		const filteredSettings = Object.entries(settings).filter(([category]) => 
			category !== "LOAN_LIMITS" && category !== "NOTIFICATIONS"
		);

		return (
			<div className="space-y-6">
				{/* Settings Categories */}
				<div className="space-y-4">
					{filteredSettings.map(([category, categorySettings]) => (
						<div key={category} className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
							<div className="px-6 py-4 border-b border-gray-700/30">
								<h2 className="text-lg font-semibold text-white flex items-center">
									<span className="mr-2 text-2xl">{getCategoryIcon(category)}</span>
									{getCategoryDisplayName(category)}
								</h2>
								{/* Add subtitle explanations for specific categories */}
								{category === "LOAN_CALCULATION" && (
									<p className="text-sm text-gray-400 mt-2 leading-relaxed">
										Controls how the total loan amount (principal + interest) is split across each payment installment. 
										This affects the <span className="text-blue-300 font-medium">principalAmount</span> and <span className="text-blue-300 font-medium">interestAmount</span> columns in the database.
									</p>
								)}
								{category === "PAYMENT_SCHEDULE" && (
									<p className="text-sm text-gray-400 mt-2 leading-relaxed">
										Determines when loan payments are due each month. This controls the actual due dates that appear 
										on payment schedules and affects pro-ration calculations for first payments.
									</p>
								)}
							</div>

							<div className="p-6 space-y-6">
								{/* Special handling for Payment Schedule category to group related settings */}
								{category === "PAYMENT_SCHEDULE" ? (
									<div className="space-y-8">
										{/* Main payment schedule type */}
										{categorySettings.filter(s => s.key === "PAYMENT_SCHEDULE_TYPE").map((setting) => (
											<div key={setting.key} className="border-b border-gray-700/30 pb-6">
												<div className="flex items-start justify-between">
													<div className="flex-1 min-w-0 mr-6">
														<div className="flex items-center space-x-2 mb-2">
															<h3 className="text-base font-medium text-white">
																{setting.name}
															</h3>
															{setting.requiresRestart && (
																<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-400/30">
																	Requires Restart
																</span>
															)}
															{setting.affectsExistingLoans && (
																<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300 border border-red-400/30">
																	Affects Existing Loans
																</span>
															)}
														</div>
														<p className="text-sm text-gray-300 mb-3">
															{setting.description}
														</p>
														{setting.options && setting.dataType === "ENUM" && (
															<div className="text-xs text-gray-400">
																<strong>Available Options:</strong>
																<ul className="mt-2 space-y-2">
																	{Object.entries(setting.options).map(([key, option]: [string, any]) => (
																		<li key={key} className="ml-2 p-2 bg-gray-800/50 rounded border-l-2 border-gray-600">
																			<strong className="text-gray-200">{option.label}:</strong>
																			<div className="text-gray-400 mt-1">{option.description}</div>
																		</li>
																	))}
																</ul>
															</div>
														)}
													</div>
													<div className="flex-shrink-0 w-64">
														{renderSettingInput(setting)}
													</div>
												</div>
											</div>
										))}
										
										{/* Custom date configuration (conditional) */}
										<div className="bg-gray-800/30 border border-gray-600/30 rounded-lg p-4">
											<h4 className="text-sm font-semibold text-white mb-3 flex items-center">
												⚙️ Custom Date Configuration
												<span className="ml-2 text-xs text-gray-400 font-normal">(Only applies to Custom Date of Month)</span>
											</h4>
											<div className="grid md:grid-cols-2 gap-6">
												{categorySettings.filter(s => s.key === "CUSTOM_DUE_DATE" || s.key === "PRORATION_CUTOFF_DATE").map((setting) => (
													<div key={setting.key}>
														<div className="flex items-center space-x-2 mb-2">
															<h5 className="text-sm font-medium text-white">
																{setting.name}
															</h5>
														</div>
														<p className="text-xs text-gray-400 mb-3">
															{setting.description}
														</p>
														<div className="w-full">
															{renderSettingInput(setting)}
															{setting.options && setting.dataType === "NUMBER" && (
																<div className="mt-1 text-xs text-gray-500">
																	Range: {setting.options.min} - {setting.options.max} {setting.options.unit}
																</div>
															)}
														</div>
													</div>
												))}
											</div>
										</div>
									</div>
								) : category === "LATE_FEES" ? (
									/* Special handling for Late Fee category to ensure enabled setting comes first */
									<div className="space-y-6">
										{/* First show the enable/disable toggle */}
										{categorySettings.filter(s => s.key === "ENABLE_LATE_FEE_GRACE_PERIOD").map((setting) => (
											<div key={setting.key} className="border-b border-gray-700/30 pb-6">
												<div className="flex items-start justify-between">
													<div className="flex-1 min-w-0 mr-6">
														<div className="flex items-center space-x-2 mb-2">
															<h3 className="text-base font-medium text-white">
																{setting.name}
															</h3>
															{setting.requiresRestart && (
																<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-400/30">
																	Requires Restart
																</span>
															)}
															{setting.affectsExistingLoans && (
																<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300 border border-red-400/30">
																	Affects Existing Loans
																</span>
															)}
														</div>
														<p className="text-sm text-gray-300 mb-3">
															{setting.description}
														</p>
													</div>
													<div className="flex-shrink-0 w-64">
														{renderSettingInput(setting)}
													</div>
												</div>
											</div>
										))}
										
										{/* Then show other late fee settings */}
										{categorySettings.filter(s => s.key !== "ENABLE_LATE_FEE_GRACE_PERIOD").map((setting) => (
											<div key={setting.key} className="border-b border-gray-700/30 last:border-b-0 pb-6 last:pb-0">
												<div className="flex items-start justify-between">
													<div className="flex-1 min-w-0 mr-6">
														<div className="flex items-center space-x-2 mb-2">
															<h3 className="text-base font-medium text-white">
																{setting.name}
															</h3>
															{setting.requiresRestart && (
																<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-400/30">
																	Requires Restart
																</span>
															)}
															{setting.affectsExistingLoans && (
																<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300 border border-red-400/30">
																	Affects Existing Loans
																</span>
															)}
														</div>
														<p className="text-sm text-gray-300 mb-3">
															{setting.description}
														</p>
													</div>
													<div className="flex-shrink-0 w-64">
														{renderSettingInput(setting)}
														{setting.options && setting.dataType === "NUMBER" && (
															<div className="mt-1 text-xs text-gray-400">
																Range: {setting.options.min} - {setting.options.max} {setting.options.unit}
															</div>
														)}
													</div>
												</div>
											</div>
										))}
									</div>
								) : (
									/* Standard layout for other categories */
									categorySettings.map((setting) => (
										<div key={setting.key} className="border-b border-gray-700/30 last:border-b-0 pb-6 last:pb-0">
											<div className="flex items-start justify-between">
												<div className="flex-1 min-w-0 mr-6">
													<div className="flex items-center space-x-2 mb-2">
														<h3 className="text-base font-medium text-white">
															{setting.name}
														</h3>
														{setting.requiresRestart && (
															<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-400/30">
																Requires Restart
															</span>
														)}
														{setting.affectsExistingLoans && (
															<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300 border border-red-400/30">
																Affects Existing Loans
															</span>
														)}
													</div>
													<p className="text-sm text-gray-300 mb-3">
														{setting.description}
													</p>
													{setting.options && setting.dataType === "ENUM" && (
														<div className="text-xs text-gray-400">
															<strong>Available Options:</strong>
															<ul className="mt-2 space-y-2">
																{Object.entries(setting.options).map(([key, option]: [string, any]) => (
																	<li key={key} className="ml-2 p-2 bg-gray-800/50 rounded border-l-2 border-gray-600">
																		<strong className="text-gray-200">{option.label}:</strong>
																		<div className="text-gray-400 mt-1">{option.description}</div>
																	</li>
																))}
															</ul>
														</div>
													)}
												</div>
												<div className="flex-shrink-0 w-64">
													{renderSettingInput(setting)}
													{setting.options && setting.dataType === "NUMBER" && (
														<div className="mt-1 text-xs text-gray-400">
															Range: {setting.options.min} - {setting.options.max} {setting.options.unit}
														</div>
													)}
												</div>
											</div>
										</div>
									))
								)}
							</div>
						</div>
					))}
				</div>

				{/* Footer Actions */}
				<div className="flex items-center justify-between">
					<div className="text-sm text-gray-400">
						Last updated: {new Date().toLocaleString()}
					</div>
					<div className="flex space-x-3">
						<button
							onClick={loadSettings}
							disabled={loading}
							className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
						>
							{loading ? "Loading..." : "Refresh"}
						</button>
						<button
							onClick={saveSettings}
							disabled={saving || !hasUnsavedChanges}
							className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-md font-medium transition-colors"
						>
							{saving ? "Saving..." : "Save All Changes"}
						</button>
					</div>
				</div>
			</div>
		);
	};

	const renderBankAccounts = () => {
		return (
			<div className="space-y-6">
				{/* Header with Add Button */}
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-lg font-semibold text-white">Bank Accounts</h3>
						<p className="text-sm text-gray-400">Manage company bank accounts for payments and transfers</p>
					</div>
					<button
						onClick={() => setShowAddBankAccount(true)}
						className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
					>
						<PlusIcon className="h-5 w-5 mr-2" />
						Add Bank Account
					</button>
				</div>

				{/* Bank Accounts List */}
				{bankAccountsLoading ? (
					<div className="flex items-center justify-center min-h-[200px]">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
					</div>
				) : (
					<div className="grid gap-4">
						{bankAccounts.length === 0 ? (
							<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-8 text-center">
								<BanknotesIcon className="h-12 w-12 text-gray-500 mx-auto mb-4" />
								<h3 className="text-lg font-medium text-white mb-2">No Bank Accounts</h3>
								<p className="text-gray-400 mb-4">Add your first bank account to get started</p>
								<button
									onClick={() => setShowAddBankAccount(true)}
									className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
								>
									Add Bank Account
								</button>
							</div>
						) : (
							bankAccounts.map((account) => (
								<div key={account.id} className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center space-x-3 mb-2">
												<h4 className="text-lg font-medium text-white flex items-center">
													{account.bankName}
													{account.isDefault && (
														<StarIconSolid className="h-5 w-5 text-yellow-400 ml-2" title="Default Account" />
													)}
												</h4>
												<span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
													account.isActive 
														? "bg-green-500/20 text-green-300 border border-green-400/30"
														: "bg-red-500/20 text-red-300 border border-red-400/30"
												}`}>
													{account.isActive ? "Active" : "Inactive"}
												</span>
												{account.isDefault && (
													<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-400/30">
														Default
													</span>
												)}
											</div>
											<p className="text-gray-300 mb-1">Account Name: {account.accountName}</p>
											<p className="text-gray-400 text-sm">Account Number: {account.accountNumber}</p>
										</div>
										<div className="flex space-x-2">
											{!account.isDefault && account.isActive && (
												<button
													onClick={() => account.id && setAsDefault(account.id)}
													disabled={saving}
													className="p-2 text-gray-400 hover:text-yellow-400 transition-colors disabled:opacity-50"
													title="Set as Default"
												>
													<StarIcon className="h-5 w-5" />
												</button>
											)}
											<button
												onClick={() => {
													setEditingBankAccount(account);
													setNewBankAccount(account);
													setShowAddBankAccount(true);
												}}
												className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
												title="Edit"
											>
												<PencilIcon className="h-5 w-5" />
											</button>
											<button
												onClick={() => account.id && deleteBankAccount(account.id)}
												className="p-2 text-gray-400 hover:text-red-400 transition-colors"
												title="Delete"
											>
												<TrashIcon className="h-5 w-5" />
											</button>
										</div>
									</div>
								</div>
							))
						)}
					</div>
				)}

				{/* Add/Edit Bank Account Form */}
				{showAddBankAccount && (
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-6">
						<h4 className="text-lg font-medium text-white mb-4">
							{editingBankAccount ? "Edit Bank Account" : "Add New Bank Account"}
						</h4>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-1">
									Bank Name
								</label>
								<input
									type="text"
									value={newBankAccount.bankName}
									onChange={(e) => setNewBankAccount({ ...newBankAccount, bankName: e.target.value })}
									className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="e.g., Maybank, CIMB, Public Bank"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-1">
									Account Name
								</label>
								<input
									type="text"
									value={newBankAccount.accountName}
									onChange={(e) => setNewBankAccount({ ...newBankAccount, accountName: e.target.value })}
									className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="Account holder name"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-1">
									Account Number
								</label>
								<input
									type="text"
									value={newBankAccount.accountNumber}
									onChange={(e) => setNewBankAccount({ ...newBankAccount, accountNumber: e.target.value })}
									className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="Account number"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-1">
									Status
								</label>
								<select
									value={newBankAccount.isActive ? "true" : "false"}
									onChange={(e) => setNewBankAccount({ ...newBankAccount, isActive: e.target.value === "true" })}
									className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								>
									<option value="true">Active</option>
									<option value="false">Inactive</option>
								</select>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-1">
									Default Account
								</label>
								<label className="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										checked={newBankAccount.isDefault || false}
										onChange={(e) => setNewBankAccount({ ...newBankAccount, isDefault: e.target.checked })}
										className="sr-only peer"
									/>
									<div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-400 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
									<span className="ml-3 text-sm font-medium text-gray-300">
										{newBankAccount.isDefault ? "Set as default" : "Not default"}
									</span>
								</label>
							</div>
						</div>
						<div className="flex space-x-3">
							<button
								onClick={() => {
									setShowAddBankAccount(false);
									setEditingBankAccount(null);
									setNewBankAccount({
										bankName: "",
										accountName: "",
										accountNumber: "",
										isActive: true,
										isDefault: false,
									});
								}}
								className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-md font-medium transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={() => saveBankAccount(newBankAccount)}
								disabled={saving || !newBankAccount.bankName || !newBankAccount.accountName || !newBankAccount.accountNumber}
								className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium transition-colors"
							>
								{saving ? "Saving..." : editingBankAccount ? "Update Account" : "Add Account"}
							</button>
						</div>
					</div>
				)}
			</div>
		);
	};

	const renderNotifications = () => {
		if (loading) {
			return (
				<div className="flex items-center justify-center min-h-[400px]">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
				</div>
			);
		}

		// Filter to show only NOTIFICATIONS category
		const notificationSettings = Object.entries(settings).filter(([category]) => 
			category === "NOTIFICATIONS"
		);

		if (notificationSettings.length === 0) {
			return (
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-8 text-center">
					<BellIcon className="h-12 w-12 text-gray-500 mx-auto mb-4" />
					<h3 className="text-lg font-medium text-white mb-2">No Notification Settings</h3>
					<p className="text-gray-400">Notification settings will be available in a future update</p>
				</div>
			);
		}

		return (
			<div className="space-y-6">
				{/* Notification Settings */}
				<div className="space-y-4">
					{notificationSettings.map(([category, categorySettings]) => (
						<div key={category} className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
							<div className="px-6 py-4 border-b border-gray-700/30">
								<h2 className="text-lg font-semibold text-white flex items-center">
									<span className="mr-2 text-2xl">{getCategoryIcon(category)}</span>
									{getCategoryDisplayName(category)}
								</h2>
							</div>

							<div className="p-6 space-y-6">
								{categorySettings.map((setting) => (
									<div key={setting.key} className="border-b border-gray-700/30 last:border-b-0 pb-6 last:pb-0">
										<div className="flex items-start justify-between">
											<div className="flex-1 min-w-0 mr-6">
												<div className="flex items-center space-x-2 mb-2">
													<h3 className="text-base font-medium text-white">
														{setting.name}
													</h3>
													{setting.requiresRestart && (
														<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-400/30">
															Requires Restart
														</span>
													)}
													{setting.affectsExistingLoans && (
														<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300 border border-red-400/30">
															Affects Existing Loans
														</span>
													)}
												</div>
												<p className="text-sm text-gray-300 mb-3">
													{setting.description}
												</p>
												{setting.options && setting.dataType === "ENUM" && (
													<div className="text-xs text-gray-400">
														<strong>Options:</strong>
														<ul className="mt-1 space-y-1">
															{Object.entries(setting.options).map(([key, option]: [string, any]) => (
																<li key={key} className="ml-2">
																	• <strong>{option.label}:</strong> {option.description}
																</li>
															))}
														</ul>
													</div>
												)}
											</div>
											<div className="flex-shrink-0 w-64">
												{renderSettingInput(setting)}
												{setting.options && setting.dataType === "NUMBER" && (
													<div className="mt-1 text-xs text-gray-400">
														Range: {setting.options.min} - {setting.options.max} {setting.options.unit}
													</div>
												)}
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					))}
				</div>

				{/* Footer Actions for Notifications */}
				<div className="flex items-center justify-between">
					<div className="text-sm text-gray-400">
						Last updated: {new Date().toLocaleString()}
					</div>
					<div className="flex space-x-3">
						<button
							onClick={loadSettings}
							disabled={loading}
							className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
						>
							{loading ? "Loading..." : "Refresh"}
						</button>
						<button
							onClick={saveSettings}
							disabled={saving || !hasUnsavedChanges}
							className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-md font-medium transition-colors"
						>
							{saving ? "Saving..." : "Save All Changes"}
						</button>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
				<p className="text-gray-300">
					Configure system settings, manage bank accounts, and customize notification preferences.
				</p>
			</div>

			{/* Tabs */}
			<div className="border-b border-gray-700/30">
				<nav className="-mb-px flex space-x-8">
					{tabs.map((tab) => {
						const Icon = tab.icon;
						const isActive = activeTab === tab.id;
						return (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
									isActive
										? "border-blue-500 text-blue-400"
										: "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600"
								}`}
							>
								<Icon className={`mr-2 h-5 w-5 ${
									isActive ? "text-blue-400" : "text-gray-500 group-hover:text-gray-400"
								}`} />
								{tab.label}
							</button>
						);
					})}
				</nav>
			</div>

			{/* Error Message */}
			{error && (
				<div className="bg-red-700/30 border border-red-600/30 text-red-300 px-4 py-3 rounded-lg">
					<div className="flex">
						<div className="flex-shrink-0">
							<svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
								<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
							</svg>
						</div>
						<div className="ml-3">
							<h3 className="text-sm font-medium text-red-300">Error</h3>
							<div className="mt-2 text-sm text-red-200">{error}</div>
						</div>
					</div>
				</div>
			)}

			{/* Unsaved Changes Banner - Only show for system settings */}
			{hasUnsavedChanges && activeTab === "system" && (
				<div className="bg-yellow-700/30 border border-yellow-600/30 text-yellow-300 px-4 py-3 rounded-lg">
					<div className="flex items-center justify-between">
						<div className="flex">
							<div className="flex-shrink-0">
								<svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
									<path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
								</svg>
							</div>
							<div className="ml-3">
								<h3 className="text-sm font-medium text-yellow-300">You have unsaved changes</h3>
								<div className="mt-2 text-sm text-yellow-200">
									{pendingChanges.length} setting{pendingChanges.length !== 1 ? "s" : ""} modified. 
									Changes will only take effect after saving.
								</div>
							</div>
						</div>
						<div className="flex space-x-2">
							<button
								onClick={discardChanges}
								className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-md text-sm font-medium transition-colors"
							>
								Discard
							</button>
							<button
								onClick={saveSettings}
								disabled={saving}
								className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
							>
								{saving ? "Saving..." : "Save Changes"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Tab Content */}
			{renderTabContent()}
		</div>
	);
}

export default function SettingsPage() {
	return (
		<AdminLayout>
			<SettingsPageContent />
		</AdminLayout>
	);
}