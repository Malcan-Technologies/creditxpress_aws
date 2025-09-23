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
	BuildingOfficeIcon,
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
	isMissing?: boolean; // Flag to indicate placeholder settings
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

interface CompanySettings {
	id?: string;
	companyName: string;
	companyAddress: string;
	companyRegNo?: string;
	licenseNo?: string;
	contactPhone?: string;
	contactEmail?: string;
	footerNote?: string;
	taxLabel: string;
	companyLogo?: string;
	isActive?: boolean;
	createdAt?: string;
	updatedAt?: string;
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

	// Manual trigger state
	const [manualTriggerLoading, setManualTriggerLoading] = useState(false);
	const [manualTriggerResult, setManualTriggerResult] = useState<any>(null);

	// Company settings state
	const [companySettings, setCompanySettings] = useState<CompanySettings>({
		companyName: "Kredit.my",
		companyAddress: "Kuala Lumpur, Malaysia",
		companyRegNo: "",
		licenseNo: "",
		contactPhone: "",
		contactEmail: "",
		footerNote: "",
		taxLabel: "SST 6%",
		companyLogo: "",
	});
	const [companySettingsLoading, setCompanySettingsLoading] = useState(false);
	const [companySettingsSaving, setCompanySettingsSaving] = useState(false);

	// Load data on component mount and tab change
	useEffect(() => {
		if (activeTab === "system") {
			loadSettings();
		} else if (activeTab === "bank-accounts") {
			loadBankAccounts();
		} else if (activeTab === "company-settings") {
			loadCompanySettings();
		}
	}, [activeTab]);

	// Force refresh function to clear all cached data
	const forceRefresh = async () => {
		// Clear local state first
		setSettings({});
		setPendingChanges([]);
		setHasUnsavedChanges(false);
		setError(null);
		
		// Reload current tab data
		if (activeTab === "system") {
			await loadSettings();
		} else if (activeTab === "notifications") {
			await loadSettings(); // Notifications are part of the main settings
		} else if (activeTab === "bank-accounts") {
			await loadBankAccounts();
		} else if (activeTab === "company-settings") {
			await loadCompanySettings();
		}
	};

	// Load bank accounts
	const loadBankAccounts = async () => {
		try {
			setBankAccountsLoading(true);
			setError(null);

			const backendUrl = process.env.NEXT_PUBLIC_API_URL;
			const response = await fetchWithAdminTokenRefresh(`/api/admin/bank-accounts`, {
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

	// Load company settings
	const loadCompanySettings = async () => {
		try {
			setCompanySettingsLoading(true);
			setError(null);

			const backendUrl = process.env.NEXT_PUBLIC_API_URL;
			const response = await fetchWithAdminTokenRefresh(`/api/admin/company-settings`, {
				method: "GET",
			}) as ApiResponse<CompanySettings>;

			if (response.success && response.data) {
				setCompanySettings(response.data);
			} else {
				// If no settings exist, keep default values
				console.log("No company settings found, using defaults");
			}
		} catch (err) {
			console.error("Error loading company settings:", err);
			setError(err instanceof Error ? err.message : "Failed to load company settings");
		} finally {
			setCompanySettingsLoading(false);
		}
	};

	// Save company settings
	const saveCompanySettings = async () => {
		try {
			setCompanySettingsSaving(true);
			setError(null);

			const backendUrl = process.env.NEXT_PUBLIC_API_URL;
			const response = await fetchWithAdminTokenRefresh(`/api/admin/company-settings`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(companySettings),
			}) as ApiResponse<CompanySettings>;

			if (response.success) {
				if (response.data) {
					setCompanySettings(response.data);
				}
				// Show success message (you might want to add a success state)
				console.log("Company settings saved successfully");
			} else {
				throw new Error(response.message || "Failed to save company settings");
			}
		} catch (err) {
			console.error("Error saving company settings:", err);
			setError(err instanceof Error ? err.message : "Failed to save company settings");
		} finally {
			setCompanySettingsSaving(false);
		}
	};

	// Save bank account
	const saveBankAccount = async (bankAccount: BankAccount) => {
		try {
			setSaving(true);
			setError(null);

			const url = bankAccount.id 
				? `/api/admin/bank-accounts/${bankAccount.id}`
				: `/api/admin/bank-accounts`;
			
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
			const response = await fetchWithAdminTokenRefresh(`/api/admin/bank-accounts/${id}`, {
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
			const response = await fetchWithAdminTokenRefresh(`/api/admin/bank-accounts/${id}/set-default`, {
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

			// Add cache-busting timestamp to ensure fresh data
			const timestamp = Date.now();
			const response = await fetchWithAdminTokenRefresh(`/api/admin/settings/categories?_t=${timestamp}`, {
				method: "GET",
				headers: {
					"Cache-Control": "no-cache, no-store, must-revalidate",
					"Pragma": "no-cache",
					"Expires": "0",
				},
			}) as ApiResponse<SettingsData>;

			if (response.success) {
				setSettings(response.data || {});
				console.log("Settings loaded successfully:", response.data);
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
			const response = await fetchWithAdminTokenRefresh(`/api/admin/settings`, {
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
				
				// Force reload settings to get latest data
				await forceRefresh();
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

	const discardChanges = async () => {
		setPendingChanges([]);
		setHasUnsavedChanges(false);
		await forceRefresh(); // Force reload original settings
	};

	// Manual trigger for payment notifications (both upcoming and late)
	const triggerPaymentNotifications = async () => {
		try {
			setManualTriggerLoading(true);
			setManualTriggerResult(null);
			setError(null);

			// fetchWithAdminTokenRefresh already returns parsed JSON, not Response object
			const result = await fetchWithAdminTokenRefresh("/api/admin/trigger-payment-notifications", {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			}) as ApiResponse;

			if (result.success) {
				setManualTriggerResult(result.data);
				console.log('Manual trigger successful:', result.data);
			} else {
				throw new Error(result.message || "Failed to trigger notifications");
			}
		} catch (err) {
			console.error("Error triggering notifications:", err);
			setError(err instanceof Error ? err.message : "Failed to trigger notifications");
		} finally {
			setManualTriggerLoading(false);
		}
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

			case "JSON":
				// Special handling for reminder days array
				if (key === "UPCOMING_PAYMENT_REMINDER_DAYS" || key === "LATE_PAYMENT_REMINDER_DAYS") {
					const reminderDays = Array.isArray(value) ? value : [];
					const inputId = `reminder-days-input-${key}`;
					const isLatePayment = key === "LATE_PAYMENT_REMINDER_DAYS";
					const colorScheme = isLatePayment ? {
						bg: "bg-red-800/30",
						border: "border-red-700/50",
						text: "text-red-300",
						button: "text-red-400 hover:text-red-200",
						input: "focus:ring-red-500 focus:border-red-500",
						addButton: "bg-red-600 hover:bg-red-700",
						instructions: "text-red-300 bg-red-900/20 border-red-700/30"
					} : {
						bg: "bg-orange-800/30",
						border: "border-orange-700/50", 
						text: "text-orange-300",
						button: "text-orange-400 hover:text-orange-200",
						input: "focus:ring-orange-500 focus:border-orange-500",
						addButton: "bg-orange-600 hover:bg-orange-700",
						instructions: "text-orange-300 bg-orange-900/20 border-orange-700/30"
					};
					
					const addReminderDay = () => {
						const input = document.getElementById(inputId) as HTMLInputElement;
						if (input) {
							const newDay = parseInt(input.value);
							if (newDay && newDay > 0 && newDay <= 30 && !reminderDays.includes(newDay)) {
								const newDays = [...reminderDays, newDay].sort((a, b) => b - a);
								handleSettingChange(key, newDays);
								input.value = '';
							}
						}
					};
					
					return (
						<div className="space-y-3">
							<div className="flex flex-wrap gap-2">
								{reminderDays.map((day: number, index: number) => (
									<div key={index} className={`flex items-center ${colorScheme.bg} ${colorScheme.border} rounded-md px-3 py-1`}>
										<span className={`${colorScheme.text} text-sm font-medium`}>
											{day} day{day !== 1 ? 's' : ''} {isLatePayment ? 'after' : 'before'}
										</span>
										<button
											type="button"
											onClick={() => {
												const newDays = reminderDays.filter((_: number, i: number) => i !== index);
												handleSettingChange(key, newDays);
											}}
											className={`ml-2 ${colorScheme.button} transition-colors`}
										>
											<TrashIcon className="w-4 h-4" />
										</button>
									</div>
								))}
							</div>
							<div className="flex gap-2">
								<input
									id={inputId}
									type="number"
									placeholder={`Days (e.g., ${isLatePayment ? '3' : '7'})`}
									min={1}
									max={30}
									className={`flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${colorScheme.input}`}
									onKeyPress={(e) => {
										if (e.key === 'Enter') {
											addReminderDay();
										}
									}}
								/>
								<button
									type="button"
									onClick={addReminderDay}
									className={`px-4 py-2 ${colorScheme.addButton} text-white rounded-md transition-colors flex items-center`}
								>
									<PlusIcon className="w-4 h-4" />
								</button>
							</div>
							<div className={`text-xs ${colorScheme.instructions} p-2 rounded border`}>
								<strong>Instructions:</strong> Enter number of days {isLatePayment ? 'after' : 'before'} payment due date to send reminder. Press Enter or click + to add. Example: {isLatePayment ? '3, 7, 14 for reminders 3, 7, and 14 days after due date' : '7, 3, 1 for reminders 7, 3, and 1 day before due date'}.
							</div>
						</div>
					);
				}
				// Default JSON handling (raw text)
				return (
					<textarea
						value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
						onChange={(e) => {
							try {
								const parsed = JSON.parse(e.target.value);
								handleSettingChange(key, parsed);
							} catch {
								// Invalid JSON, store as string for now
								handleSettingChange(key, e.target.value);
							}
						}}
						rows={3}
						className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
					/>
				);

			case "STRING":
				// Special handling for time input
				if (key === "UPCOMING_PAYMENT_CHECK_TIME") {
					return (
						<div className="space-y-2">
							<input
								type="time"
								value={value}
								onChange={(e) => handleSettingChange(key, e.target.value)}
								className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
							<div className="text-xs text-blue-300 bg-blue-900/20 p-2 rounded border border-blue-700/30">
								<strong>Timezone:</strong> UTC+8 (Malaysia time). Current setting: {value} will run daily at {value} Malaysian time. Requires restart to take effect.
							</div>
						</div>
					);
				}
				// Default string handling
				return (
					<input
						type="text"
						value={value}
						onChange={(e) => handleSettingChange(key, e.target.value)}
						className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
				);

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
			case "EARLY_SETTLEMENT":
				return "💰";
			case "DEFAULT_PROCESSING":
				return "⚠️";
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
			case "EARLY_SETTLEMENT":
				return "Early Settlement Settings";
			case "DEFAULT_PROCESSING":
				return "Default Risk Processing";
			default:
				return category.split("_").map(word => 
					word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
				).join(" ");
		}
	};

	// Helper function to check if a category is disabled
	const isCategoryDisabled = (category: string, categorySettings: SystemSetting[]) => {
		switch (category) {
			case "EARLY_SETTLEMENT":
				const earlySettlementSetting = categorySettings.find(s => s.key === "EARLY_SETTLEMENT_ENABLED");
				return earlySettlementSetting ? !earlySettlementSetting.value : true;
			case "LATE_FEES":
				const lateFeeSetting = categorySettings.find(s => s.key === "ENABLE_LATE_FEE_GRACE_PERIOD");
				return lateFeeSetting ? !lateFeeSetting.value : true;
			case "DEFAULT_PROCESSING":
				const defaultProcessingSetting = categorySettings.find(s => s.key === "ENABLE_DEFAULT_PROCESSING");
				return defaultProcessingSetting ? !defaultProcessingSetting.value : true;
			default:
				return false;
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
			id: "company-settings",
			label: "Company Settings",
			icon: BuildingOfficeIcon,
			description: "Configure company information for receipts and loan documents",
		},
		{
			id: "notifications",
			label: "Notifications",
			icon: BellIcon,
			description: "Configure notification settings and preferences",
		},
	];

	// Render company settings
	const renderCompanySettings = () => {
		if (companySettingsLoading) {
			return (
				<div className="flex items-center justify-center min-h-[400px]">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
				</div>
			);
		}

		return (
			<div className="space-y-6">
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-6">
					<div className="flex items-center justify-between mb-6">
						<div>
							<h3 className="text-lg font-medium text-white mb-2">Company Information</h3>
							<p className="text-gray-400 text-sm">
								Configure company details that will appear on payment receipts and loan documents.
							</p>
						</div>
						<button
							onClick={saveCompanySettings}
							disabled={companySettingsSaving}
							className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
						>
							{companySettingsSaving ? "Saving..." : "Save Settings"}
						</button>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* Company Name */}
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">
								Company Name *
							</label>
							<input
								type="text"
								value={companySettings.companyName}
								onChange={(e) => setCompanySettings(prev => ({ ...prev, companyName: e.target.value }))}
								className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
								placeholder="Enter company name"
							/>
						</div>

						{/* Company Address */}
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">
								Company Address *
							</label>
							<input
								type="text"
								value={companySettings.companyAddress}
								onChange={(e) => setCompanySettings(prev => ({ ...prev, companyAddress: e.target.value }))}
								className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
								placeholder="Enter company address"
							/>
						</div>

						{/* Registration Number */}
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">
								Registration Number
							</label>
							<input
								type="text"
								value={companySettings.companyRegNo || ""}
								onChange={(e) => setCompanySettings(prev => ({ ...prev, companyRegNo: e.target.value }))}
								className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
								placeholder="Enter registration number"
							/>
						</div>

						{/* License Number */}
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">
								License Number
							</label>
							<input
								type="text"
								value={companySettings.licenseNo || ""}
								onChange={(e) => setCompanySettings(prev => ({ ...prev, licenseNo: e.target.value }))}
								className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
								placeholder="Enter license number"
							/>
						</div>

						{/* Contact Phone */}
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">
								Contact Phone
							</label>
							<input
								type="text"
								value={companySettings.contactPhone || ""}
								onChange={(e) => setCompanySettings(prev => ({ ...prev, contactPhone: e.target.value }))}
								className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
								placeholder="Enter contact phone"
							/>
						</div>

						{/* Contact Email */}
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">
								Contact Email
							</label>
							<input
								type="email"
								value={companySettings.contactEmail || ""}
								onChange={(e) => setCompanySettings(prev => ({ ...prev, contactEmail: e.target.value }))}
								className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
								placeholder="Enter contact email"
							/>
						</div>

						{/* Tax Label */}
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">
								Tax Label *
							</label>
							<input
								type="text"
								value={companySettings.taxLabel}
								onChange={(e) => setCompanySettings(prev => ({ ...prev, taxLabel: e.target.value }))}
								className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
								placeholder="e.g., SST 6%, GST 6%"
							/>
						</div>
					</div>

					{/* Footer Note */}
					<div className="mt-6">
						<label className="block text-sm font-medium text-gray-300 mb-2">
							Receipt Footer Note
						</label>
						<textarea
							value={companySettings.footerNote || ""}
							onChange={(e) => setCompanySettings(prev => ({ ...prev, footerNote: e.target.value }))}
							rows={3}
							className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none"
							placeholder="Enter footer note that will appear on receipts (optional)"
						/>
					</div>


				</div>

				{/* Preview Section */}
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-6">
					<h3 className="text-lg font-medium text-white mb-4">Receipt Preview</h3>
					<div className="bg-white p-5 rounded-lg text-black max-w-md text-xs">
						{/* Header */}
						<div className="border-b border-purple-600 pb-2 mb-3 flex items-center">
							<div className="flex-1">
								<h2 className="text-lg font-bold text-purple-600">{companySettings.companyName}</h2>
								<p className="text-xs text-gray-600">{companySettings.companyAddress}</p>
								{companySettings.companyRegNo && (
									<p className="text-xs text-gray-600">Registration No: {companySettings.companyRegNo}</p>
								)}
								{companySettings.licenseNo && (
									<p className="text-xs text-gray-600">License No: {companySettings.licenseNo}</p>
								)}
								{companySettings.contactPhone && (
									<p className="text-xs text-gray-600">Phone: {companySettings.contactPhone}</p>
								)}
								{companySettings.contactEmail && (
									<p className="text-xs text-gray-600">Email: {companySettings.contactEmail}</p>
								)}
							</div>
						</div>

						{/* Receipt Title */}
						<h3 className="text-base font-bold text-center mb-3 text-gray-800">PAYMENT RECEIPT</h3>

						{/* Receipt Information */}
						<div className="bg-gray-50 p-2 rounded mb-3 flex justify-between">
							<div className="flex-1">
								<p className="text-xs text-gray-600 mb-1">Receipt Number</p>
								<p className="text-xs font-bold text-gray-800 mb-2">RCP-2025-001</p>
								<p className="text-xs text-gray-600 mb-1">Receipt Date</p>
								<p className="text-xs font-bold text-gray-800">{new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
							</div>
							<div className="flex-1">
								<p className="text-xs text-gray-600 mb-1">Loan ID</p>
								<p className="text-xs font-bold text-gray-800">cmemg7ph</p>
							</div>
						</div>

						{/* Customer Information */}
						<div className="mb-4">
							<h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-1">Customer Information</h4>
							<div className="bg-gray-50 p-3 rounded">
								<div className="flex mb-1">
									<span className="text-xs text-gray-600 w-16">Name:</span>
									<span className="text-xs text-gray-800 flex-1">John Doe</span>
								</div>
								<div className="flex mb-1">
									<span className="text-xs text-gray-600 w-16">Email:</span>
									<span className="text-xs text-gray-800 flex-1">john@example.com</span>
								</div>
								<div className="flex">
									<span className="text-xs text-gray-600 w-16">Phone:</span>
									<span className="text-xs text-gray-800 flex-1">+60123456789</span>
								</div>
							</div>
						</div>

						{/* Payment Details */}
						<div className="mb-4">
							<h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-1">Payment Details</h4>
							<div className="bg-gray-50 p-3 rounded">
								<div className="flex justify-between mb-2">
									<span className="text-xs text-gray-600">Installment 3 / 12</span>
									<span className="text-xs font-bold text-gray-800">Due: 15 January 2025</span>
								</div>
								<div className="flex justify-between mb-2">
									<span className="text-xs text-gray-600">Payment Method:</span>
									<span className="text-xs font-bold text-gray-800">Online Payment</span>
								</div>
								<div className="flex justify-between mb-2">
									<span className="text-xs text-gray-600">Reference:</span>
									<span className="text-xs font-bold text-gray-800">TXN123456</span>
								</div>

								{/* Payment Breakdown */}
								<div className="flex justify-between mb-2">
									<span className="text-xs text-gray-600">Loan Payment:</span>
									<span className="text-xs font-bold text-gray-800">RM 950.00</span>
								</div>
								<div className="flex justify-between mb-2">
									<span className="text-xs text-gray-600">Late Fees:</span>
									<span className="text-xs font-bold text-gray-800">RM 0.00</span>
								</div>

								<div className="flex justify-between font-bold border-t border-purple-600 pt-1 mt-2">
									<span className="text-xs text-gray-700">Total Amount Paid</span>
									<span className="text-xs text-gray-800">RM 950.00</span>
								</div>

								{/* Transaction Timestamps - More subtle with extra spacing */}
								<div className="flex justify-between mb-1 mt-4">
									<span className="text-xs text-gray-400">Payment Date:</span>
									<span className="text-xs text-gray-500">{new Date().toLocaleString('en-MY', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kuala_Lumpur' })}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-xs text-gray-400">Payment Processed:</span>
									<span className="text-xs text-gray-500">{new Date().toLocaleString('en-MY', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kuala_Lumpur' })}</span>
								</div>
							</div>
						</div>

						{/* Footer */}
						<div className="text-center pt-3 border-t border-gray-200">
							<p className="text-xs font-bold text-purple-600 mb-2">Thank you for your payment!</p>
							{companySettings.footerNote && (
								<p className="text-xs text-gray-600 mb-2">{companySettings.footerNote}</p>
							)}
							<p className="text-xs text-gray-500">This is a computer-generated receipt and does not require a signature.</p>
							{(companySettings.contactPhone || companySettings.contactEmail) && (
								<p className="text-xs text-gray-500 mt-1">
									For inquiries, please contact us at{' '}
									{companySettings.contactPhone && `${companySettings.contactPhone}`}
									{companySettings.contactPhone && companySettings.contactEmail && ' or '}
									{companySettings.contactEmail && `${companySettings.contactEmail}`}
								</p>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	};

	const renderTabContent = () => {
		switch (activeTab) {
			case "system":
				return renderSystemSettings();
			case "bank-accounts":
				return renderBankAccounts();
			case "company-settings":
				return renderCompanySettings();
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
					{filteredSettings.map(([category, categorySettings]) => {
						const isDisabled = isCategoryDisabled(category, categorySettings);
						return (
						<div key={category} className={`bg-gradient-to-br backdrop-blur-md border rounded-xl shadow-lg overflow-hidden transition-all duration-300 ${
							isDisabled 
								? "from-gray-700/40 to-gray-800/40 border-gray-600/20 opacity-60" 
								: "from-gray-800/70 to-gray-900/70 border-gray-700/30"
						}`}>
							<div className="px-6 py-4 border-b border-gray-700/30">
								<h2 className={`text-lg font-semibold flex items-center ${
									isDisabled ? "text-gray-400" : "text-white"
								}`}>
									<span className="mr-2 text-2xl">{getCategoryIcon(category)}</span>
									{getCategoryDisplayName(category)}
									{isDisabled && (
										<span className="ml-2 text-xs bg-gray-600/50 text-gray-400 px-2 py-1 rounded-full">
											Disabled
										</span>
									)}
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
								{category === "EARLY_SETTLEMENT" && (
									<div className="flex items-center justify-between mt-2">
										<p className={`text-sm leading-relaxed ${
											isDisabled ? "text-gray-500" : "text-gray-400"
										}`}>
											Configure early settlement options for borrowers. Controls eligibility, lock-in periods, 
											discount factors, fees, and calculation methods for early loan discharge requests.
										</p>
										{/* Main Enable Toggle */}
										{(() => {
											const mainToggleSetting = categorySettings.find(s => s.key === "EARLY_SETTLEMENT_ENABLED");
											if (!mainToggleSetting) return null;
											
											return (
												<div className="flex items-center space-x-3 ml-6">
													<span className="text-sm font-medium text-gray-300">Enable Feature</span>
													<label className="relative inline-flex items-center cursor-pointer">
														<input
															type="checkbox"
															checked={mainToggleSetting.value}
															onChange={(e) => handleSettingChange(mainToggleSetting.key, e.target.checked)}
															className="sr-only peer"
														/>
														<div className="w-12 h-7 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-400 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600 shadow-lg"></div>
													</label>
												</div>
											);
										})()}
									</div>
								)}
								{category === "LATE_FEES" && (
									<div className="flex items-center justify-between mt-2">
										<p className={`text-sm leading-relaxed ${
											isDisabled ? "text-gray-500" : "text-gray-400"
										}`}>
											Configure late fee calculations and grace periods for overdue payments. Controls when and how late fees are applied to loan repayments.
										</p>
										{/* Main Enable Toggle */}
										{(() => {
											const mainToggleSetting = categorySettings.find(s => s.key === "ENABLE_LATE_FEE_GRACE_PERIOD");
											if (!mainToggleSetting) return null;
											
											return (
												<div className="flex items-center space-x-3 ml-6">
													<span className="text-sm font-medium text-gray-300">Enable Late Fees</span>
													<label className="relative inline-flex items-center cursor-pointer">
														<input
															type="checkbox"
															checked={mainToggleSetting.value}
															onChange={(e) => handleSettingChange(mainToggleSetting.key, e.target.checked)}
															className="sr-only peer"
														/>
														<div className="w-12 h-7 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-400 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600 shadow-lg"></div>
													</label>
												</div>
											);
										})()}
									</div>
								)}
								{category === "DEFAULT_PROCESSING" && (
									<div className="flex items-center justify-between mt-2">
										<p className={`text-sm leading-relaxed ${
											isDisabled ? "text-gray-500" : "text-gray-400"
										}`}>
											Configure automatic default risk processing and notifications. Controls when loans are flagged as default risk and the remedy period workflow.
										</p>
										{/* Main Enable Toggle */}
										{(() => {
											const mainToggleSetting = categorySettings.find(s => s.key === "ENABLE_DEFAULT_PROCESSING");
											if (!mainToggleSetting) return null;
											
											return (
												<div className="flex items-center space-x-3 ml-6">
													<span className="text-sm font-medium text-gray-300">Enable Default Processing</span>
													<label className="relative inline-flex items-center cursor-pointer">
														<input
															type="checkbox"
															checked={mainToggleSetting.value}
															onChange={(e) => handleSettingChange(mainToggleSetting.key, e.target.checked)}
															className="sr-only peer"
														/>
														<div className="w-12 h-7 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-400 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-600 shadow-lg"></div>
													</label>
												</div>
											);
										})()}
									</div>
								)}
							</div>

							<div className={`p-6 space-y-6 relative ${isDisabled ? "pointer-events-none" : ""}`}>
								{isDisabled && (
									<div className="absolute inset-0 bg-gray-900/20 rounded-lg flex items-center justify-center">
										<div className="bg-gray-800/80 text-gray-400 px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-sm">
											Enable feature to configure settings
										</div>
									</div>
								)}
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
										{(() => {
											const scheduleTypeSetting = Object.values(settings).flat().find(s => s.key === "PAYMENT_SCHEDULE_TYPE");
											const isCustomDate = scheduleTypeSetting?.value === "CUSTOM_DATE";
											
											if (isCustomDate) {
												return (
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
												);
											} else {
												return (
													<div className="bg-blue-800/20 border border-blue-700/30 rounded-lg p-4">
														<h4 className="text-sm font-semibold text-white mb-3 flex items-center">
															ℹ️ Same Day Each Month Configuration
														</h4>
														<div className="text-sm text-blue-300">
															When "Same Day Each Month" is selected, all payments are due on the same day of each month as the loan disbursement date (in Malaysia timezone). 
															<br /><br />
															<strong>Example:</strong> If a loan is disbursed on January 15th, all payments will be due on the 15th of each subsequent month.
															<br /><br />
															No additional configuration is needed - the system automatically uses the disbursement day for all payment schedules.
														</div>
													</div>
												);
											}
										})()}
									</div>
								) : category === "LATE_FEES" ? (
									/* Late Fees - exclude main toggle from regular settings */
									categorySettings.filter(s => s.key !== "ENABLE_LATE_FEE_GRACE_PERIOD").map((setting) => (
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
										))
								) : category === "EARLY_SETTLEMENT" ? (
									/* Early Settlement - exclude main toggle from regular settings */
									categorySettings.filter(s => s.key !== "EARLY_SETTLEMENT_ENABLED").map((setting) => (
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
								) : category === "DEFAULT_PROCESSING" ? (
									/* Default Processing - exclude main toggle from regular settings */
									categorySettings.filter(s => s.key !== "ENABLE_DEFAULT_PROCESSING").map((setting) => (
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
									))
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
						);
					})}
				</div>

				{/* Footer Actions */}
				<div className="flex items-center justify-between">
					<div className="text-sm text-gray-400">
						Last updated: {new Date().toLocaleString()}
					</div>
					<div className="flex space-x-3">
						<button
							onClick={forceRefresh}
							disabled={loading}
							className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
						>
							{loading ? "Loading..." : "Force Refresh"}
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

		// Defensive check to ensure settings is properly initialized
		if (!settings || typeof settings !== 'object') {
			return (
				<div className="bg-gradient-to-br from-red-800/70 to-red-900/70 backdrop-blur-md border border-red-700/30 rounded-xl p-8 text-center">
					<BellIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
					<h3 className="text-lg font-medium text-white mb-2">Settings Loading Error</h3>
					<p className="text-red-400">Unable to load settings data. Please refresh the page.</p>
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

		// Separate WhatsApp settings from general notification settings
		const whatsappSettings = notificationSettings[0]?.[1]?.filter(setting => 
			setting.key.startsWith('WHATSAPP_') || 
			setting.key === 'ENABLE_WHATSAPP_NOTIFICATIONS' ||
			setting.key === 'UPCOMING_PAYMENT_REMINDER_DAYS' ||
			setting.key === 'LATE_PAYMENT_REMINDER_DAYS' ||
			setting.key === 'UPCOMING_PAYMENT_CHECK_TIME'
		) || [];
		
		const generalSettings = notificationSettings[0]?.[1]?.filter(setting => 
			!setting.key.startsWith('WHATSAPP_') && 
			setting.key !== 'ENABLE_WHATSAPP_NOTIFICATIONS' &&
			setting.key !== 'UPCOMING_PAYMENT_REMINDER_DAYS' &&
			setting.key !== 'LATE_PAYMENT_REMINDER_DAYS' &&
			setting.key !== 'UPCOMING_PAYMENT_CHECK_TIME'
		) || [];

		// Check if WhatsApp notifications are enabled
		const whatsappEnabled = whatsappSettings.find(s => s.key === 'ENABLE_WHATSAPP_NOTIFICATIONS')?.value || false;

		// Helper function to find a setting or return a placeholder
		const findSettingOrPlaceholder = (key: string, name: string, description: string) => {
			const setting = whatsappSettings.find(s => s.key === key);
			if (setting) return setting;
			
			// Return a placeholder setting when the actual setting is missing
			return {
				id: `placeholder-${key}`,
				key,
				category: 'NOTIFICATIONS',
				name,
				description,
				dataType: 'BOOLEAN',
				value: false,
				isActive: false,
				requiresRestart: false,
				affectsExistingLoans: false,
				isMissing: true // Flag to indicate this is a placeholder
			};
		};

		return (
			<div className="space-y-6">
				{/* WhatsApp Notifications Card - Always show, but disable content when turned off */}
				{(whatsappSettings.length > 0 || notificationSettings.length > 0) && (
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
						<div className="px-6 py-4 border-b border-gray-700/30">
							<div className="flex items-center">
								<div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center mr-4">
									<svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
										<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
									</svg>
								</div>
								<div>
									<h2 className="text-lg font-semibold text-white flex items-center">
										WhatsApp Notifications
										{!whatsappEnabled && (
											<span className="ml-3 text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-400/30">
												DISABLED
											</span>
										)}
									</h2>
									<p className={`text-sm mt-1 ${whatsappEnabled ? 'text-green-300' : 'text-gray-400'}`}>
										{whatsappEnabled 
											? 'Configure WhatsApp Business API notifications for loan and payment events'
											: 'WhatsApp notifications are currently disabled. Enable the master toggle below to configure individual notification types.'
										}
									</p>
								</div>
							</div>

							<div className={`p-6 space-y-6 relative ${!whatsappEnabled ? 'opacity-60' : ''}`}>
							{/* Disabled overlay */}
							{!whatsappEnabled && whatsappSettings.length === 0 && (
								<div className="absolute inset-0 bg-gray-900/40 rounded-lg flex items-center justify-center z-10">
									<div className="bg-gray-800/90 text-gray-300 px-6 py-4 rounded-lg text-center backdrop-blur-sm">
										<h3 className="text-lg font-medium mb-2">WhatsApp Notifications Disabled</h3>
										<p className="text-sm text-gray-400">Enable WhatsApp notifications to configure individual notification types</p>
									</div>
								</div>
							)}
							
							{/* Master toggle first - Always show even if other settings are missing */}
							{whatsappSettings.filter(s => s.key === "ENABLE_WHATSAPP_NOTIFICATIONS").length > 0 ? (
								whatsappSettings.filter(s => s.key === "ENABLE_WHATSAPP_NOTIFICATIONS").map((setting) => (
								<div key={setting.key} className="border-b border-green-700/30 pb-6">
										<div className="flex items-start justify-between">
											<div className="flex-1 min-w-0 mr-6">
												<div className="flex items-center space-x-2 mb-2">
													<h3 className="text-base font-medium text-white">
													🔧 {setting.name}
													</h3>
											</div>
											<p className="text-sm text-gray-300 mb-3">
												{setting.description}
											</p>
											<div className="text-xs text-blue-300 bg-blue-900/20 p-3 rounded border border-blue-700/30">
												<strong>💰 WhatsApp Pricing Information:</strong><br/>
												WhatsApp Business Platform charges per message delivered. <strong>Authentication templates</strong> (like OTP) and <strong>utility templates</strong> (loan/payment notifications) have lower rates than marketing messages. 
												<br/><br/>
												<strong>Cost-saving tips:</strong>
												<ul className="list-disc list-inside mt-2 space-y-1">
													<li>Utility templates sent within customer service windows are <strong>free</strong></li>
													<li>Volume discounts available for high-volume senders</li>
													<li>Authentication templates have preferential rates</li>
												</ul>
												<br/>
												📋 <a href="https://developers.facebook.com/docs/whatsapp/pricing/" target="_blank" rel="noopener noreferrer" className="text-blue-200 hover:text-blue-100 underline font-medium">
													View Meta's official rate card and pricing details →
												</a>
											</div>
										</div>
										<div className="flex-shrink-0 w-64">
											{renderSettingInput(setting)}
										</div>
									</div>
								</div>
							))
							) : (
								/* Fallback when ENABLE_WHATSAPP_NOTIFICATIONS setting is missing */
								<div className="border-b border-green-700/30 pb-6">
									<div className="flex items-start justify-between">
										<div className="flex-1 min-w-0 mr-6">
											<div className="flex items-center space-x-2 mb-2">
												<h3 className="text-base font-medium text-white">
													🔧 Enable WhatsApp Notifications
												</h3>
											</div>
											<p className="text-sm text-gray-300 mb-3">
												Master toggle to enable or disable all WhatsApp Business API notifications
											</p>
											<div className="text-xs text-red-300 bg-red-900/20 p-3 rounded border border-red-700/30">
												<strong>⚠️ Setting Not Found:</strong><br/>
												The ENABLE_WHATSAPP_NOTIFICATIONS setting is missing from the database. Please contact your system administrator to add this setting.
											</div>
										</div>
										<div className="flex-shrink-0 w-64">
											<div className="text-sm text-gray-500 italic">
												Setting not available
											</div>
										</div>
									</div>
								</div>
							)}
							
							{/* Individual notification types - Show when enabled or when master toggle exists */}
							<div className={`grid md:grid-cols-2 gap-6 ${!whatsappEnabled ? 'pointer-events-none' : ''}`}>
								{whatsappSettings.filter(s => 
									s.key !== "ENABLE_WHATSAPP_NOTIFICATIONS" && 
									s.key !== "UPCOMING_PAYMENT_REMINDER_DAYS" && 
									s.key !== "UPCOMING_PAYMENT_CHECK_TIME" &&
									s.key !== "LATE_PAYMENT_REMINDER_DAYS" &&
									s.key !== "WHATSAPP_UPCOMING_PAYMENT" &&
									s.key !== "WHATSAPP_LATE_PAYMENT" &&
									s.key !== "WHATSAPP_DEFAULT_RISK" &&
									s.key !== "WHATSAPP_DEFAULT_REMINDER" &&
									s.key !== "WHATSAPP_DEFAULT_FINAL"
								).map((setting) => {
									const isMandatory = setting.key === "WHATSAPP_OTP_VERIFICATION";
									const getNotificationIcon = (key: string) => {
										switch (key) {
											case "WHATSAPP_OTP_VERIFICATION": return "🔐";
											case "WHATSAPP_LOAN_APPROVAL": return "✅";
											case "WHATSAPP_LOAN_REJECTION": return "❌";
											case "WHATSAPP_LOAN_DISBURSEMENT": return "💰";
											case "WHATSAPP_LOAN_DISCHARGED": return "🏆";
											case "WHATSAPP_LOAN_REVISED_OFFER": return "🔄";
											case "WHATSAPP_PAYMENT_APPROVED": return "💳";
											case "WHATSAPP_PAYMENT_FAILED": return "⚠️";
											case "WHATSAPP_UPCOMING_PAYMENT": return "⏰";
											case "WHATSAPP_LATE_PAYMENT": return "🚨";
											case "WHATSAPP_DEFAULT_RISK": return "⚠️";
											case "WHATSAPP_DEFAULT_REMINDER": return "📢";
											case "WHATSAPP_DEFAULT_FINAL": return "🚨";
											default: return "📱";
										}
									};

									const getNotificationColorClasses = (key: string) => {
										switch (key) {
											case "WHATSAPP_OTP_VERIFICATION": return "bg-blue-800/20 border-blue-700/30";
											case "WHATSAPP_LOAN_APPROVAL": return "bg-green-800/20 border-green-700/30";
											case "WHATSAPP_LOAN_REJECTION": return "bg-red-800/20 border-red-700/30";
											case "WHATSAPP_LOAN_DISBURSEMENT": return "bg-yellow-800/20 border-yellow-700/30";
											case "WHATSAPP_LOAN_DISCHARGED": return "bg-green-800/20 border-green-700/30";
											case "WHATSAPP_LOAN_REVISED_OFFER": return "bg-indigo-800/20 border-indigo-700/30";
											case "WHATSAPP_PAYMENT_APPROVED": return "bg-purple-800/20 border-purple-700/30";
											case "WHATSAPP_PAYMENT_FAILED": return "bg-red-800/20 border-red-700/30";
											case "WHATSAPP_UPCOMING_PAYMENT": return "bg-orange-800/20 border-orange-700/30";
											case "WHATSAPP_LATE_PAYMENT": return "bg-red-800/20 border-red-700/30";
											case "WHATSAPP_DEFAULT_RISK": return "bg-amber-800/20 border-amber-700/30";
											case "WHATSAPP_DEFAULT_REMINDER": return "bg-orange-800/20 border-orange-700/30";
											case "WHATSAPP_DEFAULT_FINAL": return "bg-red-800/20 border-red-700/30";
											default: return "bg-gray-800/20 border-gray-700/30";
										}
									};

									const colorClasses = getNotificationColorClasses(setting.key);
									
									return (
										<div key={setting.key} className={`${colorClasses} rounded-lg p-4 ${isMandatory ? 'border-2 border-orange-500/50' : ''}`}>
											<div className="flex items-start justify-between mb-3">
												<div className="flex-1 min-w-0">
													<div className="flex items-center space-x-2 mb-2">
														<span className="text-lg">{getNotificationIcon(setting.key)}</span>
														<h4 className="text-sm font-medium text-white">
															{setting.name.replace('WhatsApp ', '')}
															{isMandatory && (
																<span className="ml-2 text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded border border-orange-400/30">
																	REQUIRED
														</span>
													)}
														</h4>
													</div>
													<p className="text-xs text-gray-400">
														{setting.description}
													</p>
													{isMandatory && (
														<div className="text-xs text-orange-300 bg-orange-900/20 p-2 rounded border border-orange-700/30 mt-2">
															<strong>Security Requirement:</strong> OTP verification cannot be disabled as it's essential for account security and fraud prevention.
														</div>
													)}
												</div>
											</div>
											<div className="w-full">
												{isMandatory ? (
													<div className="space-y-2">
														{/* Greyed out toggle to show it's non-editable */}
														<label className="relative inline-flex items-center cursor-not-allowed opacity-60">
															<input
																type="checkbox"
																checked={true}
																disabled={true}
																className="sr-only peer"
															/>
															<div className="w-11 h-6 bg-gray-500 rounded-full peer peer-checked:bg-green-500 cursor-not-allowed">
																<div className="absolute top-[2px] left-[22px] bg-white border border-gray-400 rounded-full h-5 w-5 transition-all"></div>
															</div>
															<span className="ml-3 text-sm font-medium text-gray-400">
																Always Enabled
														</span>
														</label>
														{/* Status indicator */}
														<div className="flex items-center space-x-2 text-xs text-green-300">
															<div className="w-2 h-2 bg-green-400 rounded-full"></div>
															<span>Security requirement - cannot be disabled</span>
														</div>
													</div>
												) : (
													renderSettingInput(setting)
													)}
												</div>
										</div>
									);
								})}
							</div>

														{/* Payment Reminder Configuration Cards */}
							<div className={`grid lg:grid-cols-2 gap-6 ${!whatsappEnabled ? 'pointer-events-none' : ''}`}>
								{/* Upcoming Payment Configuration - Always show */}
								<div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-6">
									<div className="flex items-center mb-6">
										<div className="w-12 h-12 bg-orange-600/20 rounded-xl flex items-center justify-center mr-4">
											<span className="text-2xl">⏰</span>
										</div>
										<div>
											<h3 className="text-lg font-semibold text-white">Upcoming Payment Reminders</h3>
											<p className="text-sm text-orange-300 mt-1">Reminders before payment due date</p>
										</div>
									</div>

									{/* Main Toggle - Always show */}
									{(() => {
										const setting = findSettingOrPlaceholder(
											"WHATSAPP_UPCOMING_PAYMENT",
											"WhatsApp Upcoming Payment Reminders",
											"Send WhatsApp reminders before payment due dates"
										);
										return (
											<div key={setting.key} className="bg-orange-800/20 border border-orange-700/30 rounded-lg p-4 mb-4">
												<div className="flex items-center space-x-2 mb-3">
													<span className="text-lg">⏰</span>
													<h4 className="text-sm font-medium text-white">
														Enable Reminders
														{setting.isMissing && (
															<span className="ml-2 text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-400/30">
																MISSING
															</span>
														)}
													</h4>
												</div>
												<p className="text-xs text-gray-400 mb-4">
													{setting.description}
												</p>
												<div className="w-full">
													{setting.isMissing ? (
														<div className="text-sm text-gray-500 italic">
															Setting not available in database
														</div>
													) : (
														renderSettingInput(setting)
													)}
												</div>
											</div>
										);
									})()}

									{/* Upcoming Payment Reminder Days - Always show */}
									{(() => {
										const setting = findSettingOrPlaceholder(
											"UPCOMING_PAYMENT_REMINDER_DAYS",
											"Upcoming Payment Reminder Days",
											"Days before payment due date to send reminders"
										);
										return (
											<div key={setting.key} className="bg-orange-800/20 border border-orange-700/30 rounded-lg p-4 mb-4">
												<div className="flex items-center space-x-2 mb-3">
													<span className="text-lg">📅</span>
													<h4 className="text-sm font-medium text-white">
														Reminder Days
														{setting.isMissing && (
															<span className="ml-2 text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-400/30">
																MISSING
															</span>
														)}
													</h4>
												</div>
												<p className="text-xs text-gray-400 mb-4">
													{setting.description}
												</p>
												<div className="w-full">
													{setting.isMissing ? (
														<div className="text-sm text-gray-500 italic">
															Setting not available in database
														</div>
													) : (
														renderSettingInput(setting)
													)}
												</div>
											</div>
										);
									})()}

									{/* Example Configuration */}
									<div className="text-xs text-orange-300 bg-orange-900/20 p-3 rounded border border-orange-700/30">
										<strong>📋 Example:</strong><br/>
										"Hi John, this is a reminder that your payment of RM 1000 for your PayAdvance loan is due in 3 days. Please ensure payment is made before 28/8/2025 to avoid late charges."
									</div>
								</div>

								{/* Late Payment Configuration - Always show */}
								<div className="bg-red-900/20 border border-red-700/30 rounded-xl p-6">
									<div className="flex items-center mb-6">
										<div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center mr-4">
											<span className="text-2xl">🚨</span>
										</div>
										<div>
											<h3 className="text-lg font-semibold text-white">Late Payment Reminders</h3>
											<p className="text-sm text-red-300 mt-1">Reminders after payment due date</p>
										</div>
									</div>

									{/* Main Toggle - Always show */}
									{(() => {
										const setting = findSettingOrPlaceholder(
											"WHATSAPP_LATE_PAYMENT",
											"WhatsApp Late Payment Reminders",
											"Send WhatsApp reminders after payment due dates"
										);
										return (
											<div key={setting.key} className="bg-red-800/20 border border-red-700/30 rounded-lg p-4 mb-4">
												<div className="flex items-center space-x-2 mb-3">
													<span className="text-lg">🚨</span>
													<h4 className="text-sm font-medium text-white">
														Enable Late Reminders
														{setting.isMissing && (
															<span className="ml-2 text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-400/30">
																MISSING
															</span>
														)}
													</h4>
												</div>
												<p className="text-xs text-gray-400 mb-4">
													{setting.description}
												</p>
												<div className="w-full">
													{setting.isMissing ? (
														<div className="text-sm text-gray-500 italic">
															Setting not available in database
														</div>
													) : (
														renderSettingInput(setting)
													)}
												</div>
											</div>
										);
									})()}

									{/* Late Payment Reminder Days - Always show */}
									{(() => {
										const setting = findSettingOrPlaceholder(
											"LATE_PAYMENT_REMINDER_DAYS",
											"Late Payment Reminder Days",
											"Days after payment due date to send reminders"
										);
										return (
											<div key={setting.key} className="bg-red-800/20 border border-red-700/30 rounded-lg p-4 mb-4">
												<div className="flex items-center space-x-2 mb-3">
													<span className="text-lg">📅</span>
													<h4 className="text-sm font-medium text-white">
														Reminder Days
														{setting.isMissing && (
															<span className="ml-2 text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-400/30">
																MISSING
															</span>
														)}
													</h4>
												</div>
												<p className="text-xs text-gray-400 mb-4">
													{setting.description}
												</p>
												<div className="w-full">
													{setting.isMissing ? (
														<div className="text-sm text-gray-500 italic">
															Setting not available in database
														</div>
													) : (
														renderSettingInput(setting)
													)}
												</div>
											</div>
										);
									})()}

									{/* Example Configuration */}
									<div className="text-xs text-red-300 bg-red-900/20 p-3 rounded border border-red-700/30">
										<strong>📋 Example:</strong><br/>
										"Hi John, your loan payment of RM 1050 for PayAdvance is past due."<br/>
										<span className="text-xs text-gray-400">Amount includes late fees and outstanding balance</span>
									</div>
								</div>
							</div>

							{/* Default Risk Notifications Configuration - Always show */}
							<div className={`bg-gradient-to-br from-amber-900/20 to-red-900/20 border border-amber-700/30 rounded-xl p-6 ${!whatsappEnabled ? 'pointer-events-none' : ''}`}>
								<div className="flex items-center mb-6">
									<div className="w-12 h-12 bg-amber-600/20 rounded-xl flex items-center justify-center mr-4">
										<span className="text-2xl">⚠️</span>
									</div>
									<div>
										<h3 className="text-lg font-semibold text-white">Default Risk Notifications</h3>
										<p className="text-sm text-amber-300 mt-1">Automated notifications for loan default risk management</p>
									</div>
								</div>

								<div className="grid lg:grid-cols-3 gap-6">
									{/* Default Risk Warning (28 days) - Always show */}
									{(() => {
										const setting = findSettingOrPlaceholder(
											"WHATSAPP_DEFAULT_RISK",
											"WhatsApp Default Risk Warning",
											"Sent when loan is 28 days overdue (default risk flagged)"
										);
										return (
											<div key={setting.key} className="bg-amber-800/20 border border-amber-700/30 rounded-lg p-4">
												<div className="flex items-center space-x-2 mb-3">
													<span className="text-lg">⚠️</span>
													<h4 className="text-sm font-medium text-white">
														Initial Warning
														{setting.isMissing && (
															<span className="ml-2 bg-red-500/20 text-red-300 px-1 py-0.5 rounded text-xs">
																MISSING
															</span>
														)}
													</h4>
												</div>
												<p className="text-xs text-amber-300 mb-4">
													{setting.description}
												</p>
												<div className="w-full">
													{setting.isMissing ? (
														<div className="text-xs text-gray-500 italic">
															Setting not available
														</div>
													) : (
														renderSettingInput(setting)
													)}
												</div>
											</div>
										);
									})()}

									{/* Default Reminder (during 14-day remedy period) - Always show */}
									{(() => {
										const setting = findSettingOrPlaceholder(
											"WHATSAPP_DEFAULT_REMINDER",
											"WhatsApp Default Remedy Reminders",
											"Periodic reminders during 14-day remedy period"
										);
										return (
											<div key={setting.key} className="bg-orange-800/20 border border-orange-700/30 rounded-lg p-4">
												<div className="flex items-center space-x-2 mb-3">
													<span className="text-lg">📢</span>
													<h4 className="text-sm font-medium text-white">
														Remedy Reminders
														{setting.isMissing && (
															<span className="ml-2 bg-red-500/20 text-red-300 px-1 py-0.5 rounded text-xs">
																MISSING
															</span>
														)}
													</h4>
												</div>
												<p className="text-xs text-orange-300 mb-4">
													{setting.description}
												</p>
												<div className="w-full">
													{setting.isMissing ? (
														<div className="text-xs text-gray-500 italic">
															Setting not available
														</div>
													) : (
														renderSettingInput(setting)
													)}
												</div>
											</div>
										);
									})()}

									{/* Final Default Notice - Always show */}
									{(() => {
										const setting = findSettingOrPlaceholder(
											"WHATSAPP_DEFAULT_FINAL",
											"WhatsApp Final Default Notice",
											"Sent when loan officially defaults (44 days overdue)"
										);
										return (
											<div key={setting.key} className="bg-red-800/20 border border-red-700/30 rounded-lg p-4">
												<div className="flex items-center space-x-2 mb-3">
													<span className="text-lg">🚨</span>
													<h4 className="text-sm font-medium text-white">
														Final Notice
														{setting.isMissing && (
															<span className="ml-2 bg-red-500/20 text-red-300 px-1 py-0.5 rounded text-xs">
																MISSING
															</span>
														)}
													</h4>
												</div>
												<p className="text-xs text-red-300 mb-4">
													{setting.description}
												</p>
												<div className="w-full">
													{setting.isMissing ? (
														<div className="text-xs text-gray-500 italic">
															Setting not available
														</div>
													) : (
														renderSettingInput(setting)
													)}
												</div>
											</div>
										);
									})()}
								</div>

									{/* Default Process Information */}
									<div className="mt-6 text-xs text-amber-300 bg-amber-900/20 p-4 rounded border border-amber-700/30">
										<strong>📋 Default Process Timeline:</strong><br/>
										<div className="mt-2 space-y-1">
											<div><strong>Day 28:</strong> Loan flagged as "potential default" → Initial warning sent + PDF letter generated</div>
											<div><strong>Day 29-43:</strong> 16-day remedy period → Periodic reminders sent (includes 2 days for registered post delivery)</div>
											<div><strong>Day 44:</strong> If not cleared → Loan status changed to "DEFAULT" → Final notice sent</div>
											<div><strong>Recovery:</strong> When payments clear outstanding amounts → Loan returns to "ACTIVE"</div>
										</div>
									</div>
								</div>
							</div>

							{/* Manual Trigger Section */}
							{(whatsappSettings.some(s => s.key === "WHATSAPP_UPCOMING_PAYMENT") || whatsappSettings.some(s => s.key === "WHATSAPP_LATE_PAYMENT")) && (
								<div className={`bg-gradient-to-r from-orange-900/20 to-red-900/20 border border-orange-700/30 rounded-xl p-6 ${!whatsappEnabled ? 'pointer-events-none' : ''}`}>
									<div className="flex items-center mb-6">
										<div className="w-12 h-12 bg-gradient-to-r from-orange-600/20 to-red-600/20 rounded-xl flex items-center justify-center mr-4">
											<span className="text-2xl">🚀</span>
										</div>
										<div>
											<h3 className="text-lg font-semibold text-white">Manual Trigger</h3>
											<p className="text-sm text-gray-400">Run payment notifications immediately</p>
										</div>
									</div>

									{/* Manual Trigger Section */}
									<div className="bg-gradient-to-r from-orange-800/10 to-red-800/10 border border-orange-600/30 rounded-lg p-4">
										<div className="flex items-center justify-between mb-4">
											<div>
												<h4 className="text-sm font-semibold text-white flex items-center">
													<span className="mr-2 text-lg">🚀</span>
													Manual Trigger
												</h4>
												<p className="text-xs text-gray-400 mt-1">
													Run both upcoming and late payment notifications immediately without waiting for the scheduled trigger at 10AM (GMT+8) daily
												</p>
											</div>
											<button
												onClick={triggerPaymentNotifications}
												disabled={manualTriggerLoading}
												className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center space-x-2"
											>
												{manualTriggerLoading ? (
													<>
														<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
														<span>Processing...</span>
													</>
												) : (
													<>
														<span className="text-lg">▶️</span>
														<span>Trigger Now</span>
													</>
												)}
											</button>
										</div>

										{/* Result Display */}
										{manualTriggerResult && (
											<div className="mt-4 p-3 bg-green-900/20 border border-green-700/30 rounded text-xs">
												<div className="flex items-center mb-2">
													<span className="text-green-400 mr-2">✅</span>
													<strong className="text-green-300">Processing Complete</strong>
													<span className="ml-auto text-gray-400">
														{new Date(manualTriggerResult.processedAt).toLocaleString()}
													</span>
												</div>

												{/* Overall Summary */}
												<div className="grid grid-cols-3 gap-4 text-center mb-4">
													<div>
														<div className="text-lg font-bold text-white">{manualTriggerResult.totalChecked}</div>
														<div className="text-gray-400">Total Checked</div>
													</div>
													<div>
														<div className="text-lg font-bold text-green-400">{manualTriggerResult.notificationsSent}</div>
														<div className="text-gray-400">Total Sent</div>
													</div>
													<div>
														<div className="text-lg font-bold text-red-400">{manualTriggerResult.errors}</div>
														<div className="text-gray-400">Total Errors</div>
													</div>
												</div>

												{/* Breakdown by Type */}
												{(manualTriggerResult.upcomingPayments || manualTriggerResult.latePayments) && (
													<div className="grid grid-cols-2 gap-4 text-center border-t border-green-700/30 pt-3">
														<div className="bg-orange-900/20 border border-orange-700/30 rounded p-2">
															<div className="text-orange-300 font-semibold mb-1">⏰ Upcoming</div>
															<div className="text-xs space-y-1">
																<div>Checked: <span className="text-white">{manualTriggerResult.upcomingPayments?.checked || 0}</span></div>
																<div>Sent: <span className="text-green-400">{manualTriggerResult.upcomingPayments?.sent || 0}</span></div>
																<div>Errors: <span className="text-red-400">{manualTriggerResult.upcomingPayments?.errors || 0}</span></div>
															</div>
														</div>
														<div className="bg-red-900/20 border border-red-700/30 rounded p-2">
															<div className="text-red-300 font-semibold mb-1">🚨 Late</div>
															<div className="text-xs space-y-1">
																<div>Checked: <span className="text-white">{manualTriggerResult.latePayments?.checked || 0}</span></div>
																<div>Sent: <span className="text-green-400">{manualTriggerResult.latePayments?.sent || 0}</span></div>
																<div>Errors: <span className="text-red-400">{manualTriggerResult.latePayments?.errors || 0}</span></div>
															</div>
														</div>
													</div>
												)}
												{manualTriggerResult.details && manualTriggerResult.details.length > 0 && (
													<div className="mt-3 pt-3 border-t border-green-700/30">
														<strong className="text-green-300 text-xs">Details:</strong>
														<div className="mt-2 max-h-32 overflow-y-auto space-y-1">
															{manualTriggerResult.details.slice(0, 10).map((detail: any, index: number) => (
																<div key={index} className="text-xs flex items-center justify-between">
																	<span className="text-gray-300">User {detail.userId.slice(-8)}</span>
																	<span className={`px-2 py-0.5 rounded text-xs ${
																		detail.status === 'sent' ? 'bg-green-600/30 text-green-300' :
																		detail.status === 'error' ? 'bg-red-600/30 text-red-300' :
																		'bg-yellow-600/30 text-yellow-300'
																	}`}>
																		{detail.status}
																	</span>
																</div>
															))}
															{manualTriggerResult.details.length > 10 && (
																<div className="text-xs text-gray-400 text-center pt-2">
																	... and {manualTriggerResult.details.length - 10} more
																</div>
															)}
														</div>
													</div>
												)}
											</div>
										)}
									</div>
								</div>
							)}
						</div>
					</div>
				)}

				{/* General Notification Settings (if any) */}
				{generalSettings.length > 0 && (
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
						<div className="px-6 py-4 border-b border-gray-700/30">
							<h2 className="text-lg font-semibold text-white flex items-center">
								<span className="mr-2 text-2xl">📱</span>
								General Notifications
							</h2>
						</div>

						<div className="p-6 space-y-6">
							{generalSettings.map((setting) => (
								<div key={setting.key} className="border-b border-gray-700/30 last:border-b-0 pb-6 last:pb-0">
									<div className="flex items-start justify-between">
										<div className="flex-1 min-w-0 mr-6">
											<div className="flex items-center space-x-2 mb-2">
												<h3 className="text-base font-medium text-white">
													{setting.name}
												</h3>
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
				</div>
					</div>
				)}

				{/* Footer Actions for Notifications */}
				<div className="flex items-center justify-between">
					<div className="text-sm text-gray-400">
						Last updated: {new Date().toLocaleString()}
					</div>
					<div className="flex space-x-3">
						<button
							onClick={forceRefresh}
							disabled={loading}
							className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
						>
							{loading ? "Loading..." : "Force Refresh"}
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