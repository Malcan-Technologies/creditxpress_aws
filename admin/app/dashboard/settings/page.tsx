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
	InformationCircleIcon,
	ChevronDownIcon,
	ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "sonner";

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
	// Signing configuration
	signUrl?: string;
	serverPublicIp?: string;
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
	const [showTriggerConfirmModal, setShowTriggerConfirmModal] = useState(false);

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
		signUrl: "",
		serverPublicIp: "",
	});
	const [companySettingsLoading, setCompanySettingsLoading] = useState(false);
	const [companySettingsSaving, setCompanySettingsSaving] = useState(false);

	// Expanded categories state for system settings
	const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

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
				console.error("No company settings found, using defaults");
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
				toast.success("Company settings saved successfully");
			} else {
				throw new Error(response.message || "Failed to save company settings");
			}
		} catch (err) {
			console.error("Error saving company settings:", err);
			const errorMessage = err instanceof Error ? err.message : "Failed to save company settings";
			setError(errorMessage);
			toast.error(errorMessage);
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
				toast.success("Bank account saved successfully!");
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
				toast.success("Bank account deleted successfully!");
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
				toast.success("Default bank account updated successfully!");
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
				
				// Expand all categories except SYSTEM by default (only on first load)
				if (expandedCategories.size === 0 && response.data) {
					const allCategories = Object.keys(response.data).filter(cat => 
						cat !== "LOAN_LIMITS" && cat !== "NOTIFICATIONS" && cat !== "SYSTEM"
					);
					setExpandedCategories(new Set(allCategories));
				}
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
				toast.success("Settings saved successfully!");
				
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
						<div className="space-y-2">
							<div className="flex flex-wrap gap-1.5">
								{reminderDays.map((day: number, index: number) => (
									<div key={index} className={`flex items-center ${colorScheme.bg} ${colorScheme.border} rounded px-2 py-1`}>
										<span className={`${colorScheme.text} text-xs font-medium`}>
											Day {day}
										</span>
										<button
											type="button"
											onClick={() => {
												const newDays = reminderDays.filter((_: number, i: number) => i !== index);
												handleSettingChange(key, newDays);
											}}
											className={`ml-1.5 ${colorScheme.button} transition-colors`}
										>
											<TrashIcon className="w-3 h-3" />
										</button>
									</div>
								))}
							</div>
							<div className="flex gap-2">
								<input
									id={inputId}
									type="number"
									placeholder={isLatePayment ? 'e.g., 3' : 'e.g., 7'}
									min={1}
									max={30}
									className={`w-20 px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 ${colorScheme.input}`}
									onKeyPress={(e) => {
										if (e.key === 'Enter') {
											addReminderDay();
										}
									}}
								/>
								<button
									type="button"
									onClick={addReminderDay}
									className={`px-2 py-1.5 ${colorScheme.addButton} text-white rounded transition-colors flex items-center text-xs`}
								>
									<PlusIcon className="w-3 h-3 mr-1" />
									Add
								</button>
							</div>
							<details className="text-[10px] text-gray-500">
								<summary className="cursor-pointer hover:text-gray-400">Instructions</summary>
								<p className="mt-1 pl-2">Days {isLatePayment ? 'after' : 'before'} due date. Example: {isLatePayment ? '3, 7, 14' : '7, 3, 1'}</p>
							</details>
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
				// Special handling for time input - display only, not editable
				if (key === "UPCOMING_PAYMENT_CHECK_TIME") {
					// Convert 24h time to 12h format for display
					const formatTime12h = (time24: string) => {
						const [hours, minutes] = time24.split(':').map(Number);
						const period = hours >= 12 ? 'PM' : 'AM';
						const hours12 = hours % 12 || 12;
						return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
					};
					return (
						<span className="text-sm text-gray-300 bg-gray-700/50 px-3 py-1.5 rounded border border-gray-600/50">
							{formatTime12h(value || "10:00")} (MYT)
						</span>
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
			<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
				{/* Left Column - Company Information Form */}
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-5">
					<div className="flex items-center justify-between mb-4">
						<div>
							<h3 className="text-base font-medium text-white">Company Information</h3>
							<p className="text-gray-400 text-xs mt-1">
								Details shown on receipts and documents
							</p>
						</div>
						<button
							onClick={saveCompanySettings}
							disabled={companySettingsSaving}
							className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
						>
							{companySettingsSaving ? "Saving..." : "Save"}
						</button>
					</div>

					<div className="space-y-4">
						{/* Company Name & Address Row */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<label className="block text-xs font-medium text-gray-400 mb-1">
									Company Name *
								</label>
								<input
									type="text"
									value={companySettings.companyName}
									onChange={(e) => setCompanySettings(prev => ({ ...prev, companyName: e.target.value }))}
									className="w-full px-2.5 py-1.5 bg-gray-800/50 border border-gray-700/30 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
									placeholder="Company name"
								/>
							</div>
							<div>
								<label className="block text-xs font-medium text-gray-400 mb-1">
									Tax Label *
								</label>
								<input
									type="text"
									value={companySettings.taxLabel}
									onChange={(e) => setCompanySettings(prev => ({ ...prev, taxLabel: e.target.value }))}
									className="w-full px-2.5 py-1.5 bg-gray-800/50 border border-gray-700/30 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
									placeholder="e.g., SST 6%"
								/>
							</div>
						</div>

						{/* Address - Full Width */}
						<div>
							<label className="block text-xs font-medium text-gray-400 mb-1">
								Company Address *
							</label>
							<input
								type="text"
								value={companySettings.companyAddress}
								onChange={(e) => setCompanySettings(prev => ({ ...prev, companyAddress: e.target.value }))}
								className="w-full px-2.5 py-1.5 bg-gray-800/50 border border-gray-700/30 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
								placeholder="Full company address"
							/>
						</div>

						{/* Registration & License Row */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<label className="block text-xs font-medium text-gray-400 mb-1">
									Registration No.
								</label>
								<input
									type="text"
									value={companySettings.companyRegNo || ""}
									onChange={(e) => setCompanySettings(prev => ({ ...prev, companyRegNo: e.target.value }))}
									className="w-full px-2.5 py-1.5 bg-gray-800/50 border border-gray-700/30 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
									placeholder="Registration number"
								/>
							</div>
							<div>
								<label className="block text-xs font-medium text-gray-400 mb-1">
									License No.
								</label>
								<input
									type="text"
									value={companySettings.licenseNo || ""}
									onChange={(e) => setCompanySettings(prev => ({ ...prev, licenseNo: e.target.value }))}
									className="w-full px-2.5 py-1.5 bg-gray-800/50 border border-gray-700/30 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
									placeholder="License number"
								/>
							</div>
						</div>

						{/* Contact Info Row */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<label className="block text-xs font-medium text-gray-400 mb-1">
									Contact Phone
								</label>
								<input
									type="text"
									value={companySettings.contactPhone || ""}
									onChange={(e) => setCompanySettings(prev => ({ ...prev, contactPhone: e.target.value }))}
									className="w-full px-2.5 py-1.5 bg-gray-800/50 border border-gray-700/30 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
									placeholder="+60123456789"
								/>
							</div>
							<div>
								<label className="block text-xs font-medium text-gray-400 mb-1">
									Contact Email
								</label>
								<input
									type="email"
									value={companySettings.contactEmail || ""}
									onChange={(e) => setCompanySettings(prev => ({ ...prev, contactEmail: e.target.value }))}
									className="w-full px-2.5 py-1.5 bg-gray-800/50 border border-gray-700/30 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
									placeholder="email@company.com"
								/>
							</div>
						</div>

						{/* Footer Note */}
						<div>
							<label className="block text-xs font-medium text-gray-400 mb-1">
								Receipt Footer Note
							</label>
							<textarea
								value={companySettings.footerNote || ""}
								onChange={(e) => setCompanySettings(prev => ({ ...prev, footerNote: e.target.value }))}
								rows={2}
								className="w-full px-2.5 py-1.5 bg-gray-800/50 border border-gray-700/30 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none"
								placeholder="Optional footer text for receipts"
							/>
						</div>

						{/* Signing Configuration Section */}
						<div className="pt-4 border-t border-gray-700/30">
							<h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
								</svg>
								Digital Signing Configuration
							</h4>
							<p className="text-xs text-gray-500 mb-3">
								These values appear in digitally signed loan agreements for attestation purposes. Do not change unless on-prem server configuration changes.
							</p>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label className="block text-xs font-medium text-gray-400 mb-1">
										Sign URL
									</label>
									<input
										type="text"
										value={companySettings.signUrl || ""}
										onChange={(e) => setCompanySettings(prev => ({ ...prev, signUrl: e.target.value }))}
										className="w-full px-2.5 py-1.5 bg-gray-800/50 border border-gray-700/30 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
										placeholder="https://sign.example.com"
									/>
									<p className="text-xs text-gray-600 mt-1">DocuSeal/signing service URL</p>
								</div>
								<div>
									<label className="block text-xs font-medium text-gray-400 mb-1">
										Server Public IP
									</label>
									<input
										type="text"
										value={companySettings.serverPublicIp || ""}
										onChange={(e) => setCompanySettings(prev => ({ ...prev, serverPublicIp: e.target.value }))}
										className="w-full px-2.5 py-1.5 bg-gray-800/50 border border-gray-700/30 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
										placeholder="210.186.80.101"
									/>
									<p className="text-xs text-gray-600 mt-1">Shown in signed documents</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Right Column - Receipt Preview */}
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-5">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-base font-medium text-white">Receipt Preview</h3>
						<span className="text-xs text-gray-500">Live preview</span>
					</div>
					
					{/* Scrollable Preview Container */}
					<div className="max-h-[600px] overflow-y-auto">
						<div className="bg-white p-4 rounded-lg text-black text-[10px] shadow-lg">
							{/* Header */}
							<div className="border-b-2 border-purple-600 pb-2 mb-2">
								<h2 className="text-sm font-bold text-purple-600">{companySettings.companyName || "Company Name"}</h2>
								<p className="text-[10px] text-gray-600">{companySettings.companyAddress || "Company Address"}</p>
								{companySettings.companyRegNo && (
									<p className="text-[10px] text-gray-600">Reg No: {companySettings.companyRegNo}</p>
								)}
								{companySettings.licenseNo && (
									<p className="text-[10px] text-gray-600">License: {companySettings.licenseNo}</p>
								)}
								<div className="flex gap-3 mt-1">
									{companySettings.contactPhone && (
										<p className="text-[10px] text-gray-600">📞 {companySettings.contactPhone}</p>
									)}
									{companySettings.contactEmail && (
										<p className="text-[10px] text-gray-600">✉️ {companySettings.contactEmail}</p>
									)}
								</div>
							</div>

							{/* Receipt Title */}
							<h3 className="text-xs font-bold text-center mb-2 text-gray-800">PAYMENT RECEIPT</h3>

							{/* Receipt Information */}
							<div className="bg-gray-50 p-2 rounded mb-2 grid grid-cols-2 gap-2">
								<div>
									<p className="text-[9px] text-gray-500">Receipt No.</p>
									<p className="text-[10px] font-bold text-gray-800">RCP-2025-001</p>
								</div>
								<div>
									<p className="text-[9px] text-gray-500">Date</p>
									<p className="text-[10px] font-bold text-gray-800">{new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
								</div>
								<div>
									<p className="text-[9px] text-gray-500">Loan ID</p>
									<p className="text-[10px] font-bold text-gray-800">cmemg7ph</p>
								</div>
								<div>
									<p className="text-[9px] text-gray-500">Installment</p>
									<p className="text-[10px] font-bold text-gray-800">3 / 12</p>
								</div>
							</div>

							{/* Customer Information */}
							<div className="mb-2">
								<h4 className="text-[10px] font-bold text-gray-700 mb-1 border-b border-gray-200 pb-0.5">Customer</h4>
								<div className="bg-gray-50 p-2 rounded space-y-0.5">
									<div className="flex">
										<span className="text-[9px] text-gray-500 w-12">Name:</span>
										<span className="text-[10px] text-gray-800">John Doe</span>
									</div>
									<div className="flex">
										<span className="text-[9px] text-gray-500 w-12">Email:</span>
										<span className="text-[10px] text-gray-800">john@example.com</span>
									</div>
									<div className="flex">
										<span className="text-[9px] text-gray-500 w-12">Phone:</span>
										<span className="text-[10px] text-gray-800">+60123456789</span>
									</div>
								</div>
							</div>

							{/* Payment Details */}
							<div className="mb-2">
								<h4 className="text-[10px] font-bold text-gray-700 mb-1 border-b border-gray-200 pb-0.5">Payment</h4>
								<div className="bg-gray-50 p-2 rounded space-y-1">
									<div className="flex justify-between">
										<span className="text-[9px] text-gray-500">Loan Payment:</span>
										<span className="text-[10px] font-medium text-gray-800">RM 950.00</span>
									</div>
									<div className="flex justify-between">
										<span className="text-[9px] text-gray-500">Late Fees:</span>
										<span className="text-[10px] font-medium text-gray-800">RM 0.00</span>
									</div>
									<div className="flex justify-between font-bold border-t border-purple-600 pt-1 mt-1">
										<span className="text-[10px] text-gray-700">Total Paid</span>
										<span className="text-[10px] text-purple-600">RM 950.00</span>
									</div>
								</div>
							</div>

							{/* Footer */}
							<div className="text-center pt-2 border-t border-gray-200">
								<p className="text-[10px] font-bold text-purple-600 mb-1">Thank you for your payment!</p>
								{companySettings.footerNote && (
									<p className="text-[9px] text-gray-600 mb-1">{companySettings.footerNote}</p>
								)}
								<p className="text-[8px] text-gray-400">Computer-generated receipt. No signature required.</p>
								{(companySettings.contactPhone || companySettings.contactEmail) && (
									<p className="text-[8px] text-gray-400 mt-0.5">
										Inquiries: {companySettings.contactPhone}{companySettings.contactPhone && companySettings.contactEmail && ' | '}{companySettings.contactEmail}
									</p>
								)}
							</div>
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

	const toggleCategory = (category: string) => {
		setExpandedCategories(prev => {
			const next = new Set(prev);
			if (next.has(category)) {
				next.delete(category);
			} else {
				next.add(category);
			}
			return next;
		});
	};

	// Helper to get main toggle key for a category
	const getMainToggleKey = (category: string): string | null => {
		switch (category) {
			case "EARLY_SETTLEMENT": return "EARLY_SETTLEMENT_ENABLED";
			case "LATE_FEES": return "ENABLE_LATE_FEE_GRACE_PERIOD";
			case "DEFAULT_PROCESSING": return "ENABLE_DEFAULT_PROCESSING";
			default: return null;
		}
	};

	// Helper function to get dynamic description for a setting based on related settings
	const getDynamicDescription = (setting: SystemSetting): string | null => {
		const { key, value } = setting;
		const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;

		// Interest & Principal Allocation Method
		if (key === "LOAN_CALCULATION_METHOD") {
			if (value === "STRAIGHT_LINE") {
				return "Each payment has equal principal + interest portions. Fair and transparent for borrowers.";
			} else if (value === "RULE_OF_78") {
				return "Early payments have higher interest, later payments have more principal. Benefits lender on early settlement.";
			}
		}

		// Payment Schedule Type
		if (key === "PAYMENT_SCHEDULE_TYPE") {
			const customDueDateSetting = Object.values(settings).flat().find(s => s.key === "CUSTOM_DUE_DATE");
			const customDueDate = customDueDateSetting?.value || 1;
			
			if (value === "CUSTOM_DATE") {
				return `All payments due on the ${customDueDate}${getOrdinalSuffix(customDueDate)} of each month`;
			} else if (value === "EXACT_MONTHLY") {
				return "Payments due on the same day each month as disbursement (e.g., disbursed 18th → due 18th)";
			}
		}

		// Custom Due Date
		if (key === "CUSTOM_DUE_DATE") {
			return `Borrowers must pay by the ${numValue}${getOrdinalSuffix(numValue)} of each month`;
		}

		// Pro-ration Cutoff Date
		if (key === "PRORATION_CUTOFF_DATE") {
			const customDueDateSetting = Object.values(settings).flat().find(s => s.key === "CUSTOM_DUE_DATE");
			const customDueDate = customDueDateSetting?.value || 1;
			return `Loans disbursed on ${numValue}${getOrdinalSuffix(numValue)} or later start repayment next month (${customDueDate}${getOrdinalSuffix(customDueDate)})`;
		}

		// Interest Discount Factor (Early Settlement)
		if (key === "EARLY_SETTLEMENT_DISCOUNT_FACTOR") {
			const percentage = Math.round(numValue * 100);
			if (percentage === 0) {
				return "No discount on remaining interest — borrower pays full interest";
			} else if (percentage === 100) {
				return "Full discount — borrower pays no remaining interest (only principal)";
			} else {
				return `${percentage}% of remaining interest is waived on early settlement`;
			}
		}

		// Lock-in Period
		if (key === "EARLY_SETTLEMENT_LOCK_IN_MONTHS") {
			if (numValue === 0) {
				return "No lock-in — borrowers can settle early immediately after disbursement";
			} else if (numValue === 1) {
				return "Early settlement allowed 1 month after disbursement";
			} else {
				return `Early settlement allowed ${numValue} months after disbursement`;
			}
		}

		// Early Settlement Fee Value - show context based on fee type
		if (key === "EARLY_SETTLEMENT_FEE_VALUE") {
			const feeTypeSetting = Object.values(settings).flat().find(s => s.key === "EARLY_SETTLEMENT_FEE_TYPE");
			const feeType = feeTypeSetting?.value;
			
			if (numValue === 0) {
				return "No early settlement fee will be charged";
			}
			
			if (feeType === "PERCENT") {
				return `${numValue}% of remaining principal charged as early settlement fee`;
			} else if (feeType === "FIXED") {
				return `Fixed fee of RM ${numValue.toFixed(2)} charged for early settlement`;
			}
		}

		// Include Late Fees in Early Settlement
		if (key === "EARLY_SETTLEMENT_INCLUDE_LATE_FEES") {
			if (value === true || value === "true") {
				return "Outstanding late fees must be paid along with settlement amount";
			} else {
				return "Late fees are waived when borrower settles early";
			}
		}

		// Rounding Mode
		if (key === "EARLY_SETTLEMENT_ROUNDING_MODE") {
			if (value === "HALF_UP") {
				return "RM 100.505 → RM 100.51 (standard rounding, rounds .5 up)";
			} else if (value === "HALF_EVEN") {
				return "RM 100.505 → RM 100.50, RM 100.515 → RM 100.52 (banker's rounding, minimizes bias)";
			}
		}

		// Late Fee Grace Days
		if (key === "LATE_FEE_GRACE_DAYS") {
			if (numValue === 0) {
				return "Late fees applied immediately on the day after due date";
			} else if (numValue === 1) {
				return "Late fees applied 1 day after the due date";
			} else {
				return `Borrower has ${numValue} days after due date before late fees apply`;
			}
		}

		// Late Fee Amount - show context based on fee type
		if (key === "LATE_FEE_AMOUNT") {
			const feeTypeSetting = Object.values(settings).flat().find(s => s.key === "LATE_FEE_TYPE");
			const feeType = feeTypeSetting?.value;
			
			if (feeType === "PERCENTAGE") {
				return `${numValue}% of the overdue installment amount`;
			} else if (feeType === "FIXED") {
				return `Fixed fee of RM ${numValue.toFixed(2)} per late payment`;
			}
		}

		// Default Risk Days
		if (key === "DEFAULT_RISK_DAYS") {
			const remedyDaysSetting = Object.values(settings).flat().find(s => s.key === "DEFAULT_REMEDY_DAYS");
			const remedyDays = typeof remedyDaysSetting?.value === 'number' ? remedyDaysSetting.value : parseFloat(remedyDaysSetting?.value) || 16;
			const totalDays = numValue + remedyDays;
			return `Initial warning sent on day ${numValue}. Loan defaults on day ${totalDays} if not remedied.`;
		}

		// Default Remedy Days
		if (key === "DEFAULT_REMEDY_DAYS") {
			const riskDaysSetting = Object.values(settings).flat().find(s => s.key === "DEFAULT_RISK_DAYS");
			const riskDays = typeof riskDaysSetting?.value === 'number' ? riskDaysSetting.value : parseFloat(riskDaysSetting?.value) || 28;
			const totalDays = riskDays + numValue;
			return `Borrower has ${numValue} days to pay after warning (day ${riskDays}). Final default on day ${totalDays}.`;
		}

		return null;
	};

	// Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
	const getOrdinalSuffix = (n: number): string => {
		const s = ["th", "st", "nd", "rd"];
		const v = n % 100;
		return s[(v - 20) % 10] || s[v] || s[0];
	};

	// Helper to render compact table input
	const renderCompactInput = (setting: SystemSetting) => {
		const { key, dataType, value, options } = setting;

		switch (dataType) {
			case "BOOLEAN":
				return (
					<label className="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							checked={value === true || value === "true"}
							onChange={(e) => handleSettingChange(key, e.target.checked)}
							className="sr-only peer"
						/>
						<div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
					</label>
				);

			case "ENUM":
				return (
					<select
						value={value}
						onChange={(e) => handleSettingChange(key, e.target.value)}
						className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[140px]"
					>
						{options && Object.entries(options).map(([optionKey, optionData]: [string, any]) => (
							<option key={optionKey} value={optionKey}>
								{optionData.label || optionKey}
							</option>
						))}
					</select>
				);

			case "NUMBER":
				return (
					<input
						type="number"
						value={value}
						onChange={(e) => handleSettingChange(key, parseFloat(e.target.value) || 0)}
						min={options?.min}
						max={options?.max}
						step={options?.step || 1}
						className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				);

			case "STRING":
				return (
					<input
						type="text"
						value={value || ""}
						onChange={(e) => handleSettingChange(key, e.target.value)}
						className="w-32 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				);

			case "JSON":
				if (Array.isArray(value)) {
					return (
						<input
							type="text"
							value={value.join(", ")}
							onChange={(e) => {
								const newValue = e.target.value.split(",").map(v => parseInt(v.trim())).filter(v => !isNaN(v));
								handleSettingChange(key, newValue);
							}}
							placeholder="e.g., 7, 3, 1"
							className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
					);
				}
				return <span className="text-gray-400 text-sm">{JSON.stringify(value)}</span>;

			default:
				return <span className="text-gray-400 text-sm">{String(value)}</span>;
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

		// Filter out LOAN_LIMITS, NOTIFICATIONS, and SYSTEM categories for loan settings tab
		const filteredSettings = Object.entries(settings).filter(([category]) => 
			category !== "LOAN_LIMITS" && category !== "NOTIFICATIONS" && category !== "SYSTEM"
		);

		return (
			<div className="space-y-4">
				{/* Compact Settings Categories */}
				{filteredSettings.map(([category, categorySettings]) => {
					const isDisabled = isCategoryDisabled(category, categorySettings);
					const isExpanded = expandedCategories.has(category);
					const mainToggleKey = getMainToggleKey(category);
					const mainToggleSetting = mainToggleKey ? categorySettings.find(s => s.key === mainToggleKey) : null;
					
					// Filter settings - remove main toggle and conditionally hide CUSTOM_DUE_DATE/PRORATION_CUTOFF_DATE
					const scheduleTypeSetting = Object.values(settings).flat().find(s => s.key === "PAYMENT_SCHEDULE_TYPE");
					const isCustomDateSchedule = scheduleTypeSetting?.value === "CUSTOM_DATE";
					
					const displaySettings = categorySettings
						.filter(s => {
							// Remove main toggle from table (shown in header)
							if (mainToggleKey && s.key === mainToggleKey) return false;
							// Hide CUSTOM_DUE_DATE and PRORATION_CUTOFF_DATE when not using custom date schedule
							if ((s.key === "CUSTOM_DUE_DATE" || s.key === "PRORATION_CUTOFF_DATE") && !isCustomDateSchedule) {
								return false;
							}
							return true;
						})
						.sort((a, b) => {
							// Define priority order for specific settings
							const priorityOrder: Record<string, number> = {
								"PAYMENT_SCHEDULE_TYPE": 1,
								"CUSTOM_DUE_DATE": 2,
								"PRORATION_CUTOFF_DATE": 3,
								"DEFAULT_RISK_DAYS": 1,
								"DEFAULT_REMEDY_DAYS": 2,
							};
							const aPriority = priorityOrder[a.key] || 100;
							const bPriority = priorityOrder[b.key] || 100;
							return aPriority - bPriority;
						});

					return (
						<div key={category} className={`bg-gradient-to-br backdrop-blur-md border rounded-xl shadow-lg overflow-hidden transition-all duration-300 ${
							isDisabled 
								? "from-gray-700/40 to-gray-800/40 border-gray-600/20 opacity-70" 
								: "from-gray-800/70 to-gray-900/70 border-gray-700/30"
						}`}>
							{/* Compact Header */}
							<div 
								className="px-4 py-3 border-b border-gray-700/30 flex items-center justify-between cursor-pointer hover:bg-gray-700/20 transition-colors"
								onClick={() => toggleCategory(category)}
							>
								<div className="flex items-center gap-3">
									<span className="text-xl">{getCategoryIcon(category)}</span>
									<div>
										<h2 className={`text-base font-semibold ${isDisabled ? "text-gray-400" : "text-white"}`}>
											{getCategoryDisplayName(category)}
										</h2>
										<p className="text-xs text-gray-500">{displaySettings.length} settings</p>
									</div>
									{isDisabled && (
										<Badge variant="secondary" className="text-[10px]">Disabled</Badge>
									)}
								</div>
								<div className="flex items-center gap-4">
									{/* Main Toggle in Header */}
									{mainToggleSetting && (
										<div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
											<span className="text-xs text-gray-400">
												{mainToggleSetting.value ? "Enabled" : "Disabled"}
											</span>
											<label className="relative inline-flex items-center cursor-pointer">
												<input
													type="checkbox"
													checked={mainToggleSetting.value}
													onChange={(e) => handleSettingChange(mainToggleSetting.key, e.target.checked)}
													className="sr-only peer"
												/>
												<div className="w-10 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
											</label>
										</div>
									)}
									{/* Expand/Collapse Icon */}
									{isExpanded ? (
										<ChevronUpIcon className="h-5 w-5 text-gray-400" />
									) : (
										<ChevronDownIcon className="h-5 w-5 text-gray-400" />
									)}
								</div>
							</div>

							{/* Expandable Table Content */}
							{isExpanded && (
								<div className={`relative ${isDisabled ? "pointer-events-none" : ""}`}>
									{isDisabled && (
										<div className="absolute inset-0 bg-gray-900/40 z-10 flex items-center justify-center">
											<span className="text-sm text-gray-400 bg-gray-800/90 px-3 py-1.5 rounded">
												Enable feature to configure
											</span>
										</div>
									)}
									
									{/* Compact Table */}
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow className="bg-gray-800/30 hover:bg-gray-800/30">
													<TableHead className="text-gray-400 text-xs font-medium py-2 px-4 w-[240px] min-w-[240px]">Setting</TableHead>
													<TableHead className="text-gray-400 text-xs font-medium py-2 px-4 hidden lg:table-cell">Description</TableHead>
													<TableHead className="text-gray-400 text-xs font-medium py-2 px-4 text-right w-[180px] min-w-[180px]">Value</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{displaySettings.map((setting) => {
												const dynamicDesc = getDynamicDescription(setting);
												return (
													<TableRow key={setting.key} className="border-gray-700/30">
														<TableCell className="py-2 px-4 w-[240px] min-w-[240px]">
															<div className="flex items-center gap-2">
																<span className="text-sm text-white font-medium">{setting.name}</span>
																<Tooltip content={setting.description} side="bottom">
																	<InformationCircleIcon className="h-4 w-4 text-gray-500 cursor-help flex-shrink-0" />
																</Tooltip>
																{setting.requiresRestart && (
																	<Badge variant="warning" className="text-[9px] px-1 py-0">Restart</Badge>
																)}
																{setting.affectsExistingLoans && (
																	<Badge variant="destructive" className="text-[9px] px-1 py-0">Affects Loans</Badge>
																)}
															</div>
														</TableCell>
														<TableCell className="py-2 px-4 hidden lg:table-cell">
															{dynamicDesc ? (
																<span className="text-xs text-blue-300 bg-blue-900/20 px-2 py-1 rounded border border-blue-700/30">
																	{dynamicDesc}
																</span>
															) : (
																<span className="text-xs text-gray-400 line-clamp-2">{setting.description}</span>
															)}
														</TableCell>
														<TableCell className="py-2 px-4 text-right w-[180px] min-w-[180px]">
															<div className="flex flex-col items-end gap-0.5">
																{renderCompactInput(setting)}
																{setting.options && setting.dataType === "NUMBER" && (
																	<span className="text-[10px] text-gray-500 whitespace-nowrap">
																		Range: {setting.options.min} - {setting.options.max}
																	</span>
																)}
															</div>
														</TableCell>
													</TableRow>
												);
											})}
											</TableBody>
										</Table>
									</div>

									{/* Special content for certain categories */}
									{category === "PAYMENT_SCHEDULE" && !isCustomDateSchedule && (
										<div className="p-4 border-t border-gray-700/30">
											<div className="bg-blue-800/10 border border-blue-700/30 rounded-lg p-3">
												<p className="text-xs text-blue-300">
													<strong>Same Day Each Month:</strong> Payments are due on the same day of each month as the loan disbursement date. 
													Switch to "Custom Date of Month" to configure a specific due date and pro-ration cutoff.
												</p>
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					);
				})}

				{/* Footer Actions */}
				<div className="flex items-center justify-between pt-4 border-t border-gray-700/30">
					<div className="text-xs text-gray-500">
						Last updated: {new Date().toLocaleString()}
					</div>
					<div className="flex space-x-3">
						<button
							onClick={forceRefresh}
							disabled={loading}
							className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
						>
							{loading ? "Loading..." : "Refresh"}
						</button>
						<button
							onClick={saveSettings}
							disabled={saving || !hasUnsavedChanges}
							className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
						>
							{saving ? "Saving..." : "Save Changes"}
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

		if (!settings || typeof settings !== 'object') {
			return (
				<div className="bg-gradient-to-br from-red-800/70 to-red-900/70 backdrop-blur-md border border-red-700/30 rounded-xl p-6 text-center">
					<BellIcon className="h-10 w-10 text-red-500 mx-auto mb-3" />
					<h3 className="text-base font-medium text-white mb-1">Settings Loading Error</h3>
					<p className="text-red-400 text-sm">Unable to load settings data. Please refresh the page.</p>
				</div>
			);
		}

		const notificationSettings = Object.entries(settings).filter(([category]) => category === "NOTIFICATIONS");

		if (notificationSettings.length === 0) {
			return (
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-6 text-center">
					<BellIcon className="h-10 w-10 text-gray-500 mx-auto mb-3" />
					<h3 className="text-base font-medium text-white mb-1">No Notification Settings</h3>
					<p className="text-gray-400 text-sm">Notification settings will be available in a future update</p>
				</div>
			);
		}

		const whatsappSettings = notificationSettings[0]?.[1]?.filter(setting => 
			(setting.key.startsWith('WHATSAPP_') && setting.key !== 'ENABLE_WHATSAPP_NOTIFICATIONS') ||
			setting.key === 'UPCOMING_PAYMENT_REMINDER_DAYS' ||
			setting.key === 'LATE_PAYMENT_REMINDER_DAYS'
		) || [];
		
		const generalSettings = notificationSettings[0]?.[1]?.filter(setting => 
			!setting.key.startsWith('WHATSAPP_') && 
			setting.key !== 'ENABLE_WHATSAPP_NOTIFICATIONS' &&
			setting.key !== 'UPCOMING_PAYMENT_REMINDER_DAYS' &&
			setting.key !== 'LATE_PAYMENT_REMINDER_DAYS' &&
			setting.key !== 'UPCOMING_PAYMENT_CHECK_TIME' // Displayed in Payment Reminders header
		) || [];

		const findSetting = (key: string) => whatsappSettings.find(s => s.key === key);

		// Group notifications by category for table display
		const notificationGroups = [
			{
				title: "Authentication & Security",
				icon: "🔐",
				items: [
					{ key: "WHATSAPP_OTP_VERIFICATION", label: "OTP Verification", description: "One-time password for login and verification", mandatory: true },
				]
			},
			{
				title: "Loan Application",
				icon: "📋",
				items: [
					{ key: "WHATSAPP_LOAN_APPLICATION_SUBMISSION", label: "Application Submitted", description: "Confirmation when application is received" },
					{ key: "WHATSAPP_ATTESTATION_COMPLETE", label: "Attestation Complete", description: "Notify when attestor verifies application" },
					{ key: "WHATSAPP_LOAN_REVISED_OFFER", label: "Revised Offer Sent", description: "Alert when loan terms are modified" },
				]
			},
			{
				title: "Loan Decision",
				icon: "✅",
				items: [
					{ key: "WHATSAPP_LOAN_APPROVAL", label: "Loan Approved", description: "Notify borrower of approval" },
					{ key: "WHATSAPP_LOAN_REJECTION", label: "Loan Rejected", description: "Notify borrower of rejection" },
					{ key: "WHATSAPP_LOAN_DISBURSEMENT", label: "Loan Disbursed", description: "Confirm funds have been transferred" },
					{ key: "WHATSAPP_LOAN_DISCHARGED", label: "Loan Discharged", description: "Confirm loan is fully paid off" },
				]
			},
			{
				title: "Document Signing",
				icon: "✍️",
				items: [
					{ key: "WHATSAPP_BORROWER_SIGNING_COMPLETE", label: "Borrower Signed", description: "Confirm borrower completed signing" },
					{ key: "WHATSAPP_ALL_PARTIES_SIGNING_COMPLETE", label: "All Parties Signed", description: "Notify when all signatories complete" },
					{ key: "WHATSAPP_STAMPING_COMPLETED", label: "Stamping Complete", description: "Confirm document stamping is done" },
				]
			},
			{
				title: "Payments",
				icon: "💳",
				items: [
					{ key: "WHATSAPP_PAYMENT_APPROVED", label: "Payment Approved", description: "Confirm payment was successful" },
					{ key: "WHATSAPP_PAYMENT_FAILED", label: "Payment Failed", description: "Alert when payment is rejected" },
				]
			},
		];

		return (
			<div className="space-y-4">
				{/* Header Card */}
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl overflow-hidden">
					<div className="p-4 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
								<svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
									<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
								</svg>
							</div>
							<div>
								<h2 className="text-base font-semibold text-white">WhatsApp Business Notifications</h2>
								<p className="text-xs text-gray-400">Configure which notifications are sent via WhatsApp</p>
							</div>
						</div>
						<div className="flex items-center gap-3">
							<a 
								href="https://developers.facebook.com/docs/whatsapp/pricing/" 
								target="_blank" 
								rel="noopener noreferrer" 
								className="text-xs text-blue-400 hover:text-blue-300 hidden sm:block"
							>
								Pricing →
							</a>
							<button
								onClick={() => setShowTriggerConfirmModal(true)}
								disabled={manualTriggerLoading}
								className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
								title="Manually trigger payment notifications"
							>
								{manualTriggerLoading ? (
									<div className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent"></div>
								) : (
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								)}
								<span className="hidden sm:inline">Run Now</span>
							</button>
						</div>
					</div>
					
					{/* Manual Trigger Result (shows after running) */}
					{manualTriggerResult && (
						<div className="px-4 pb-4">
							<div className="grid grid-cols-3 gap-3 p-3 bg-gray-800/50 rounded-lg text-center">
								<div>
									<div className="text-lg font-bold text-white">{manualTriggerResult.totalChecked}</div>
									<div className="text-[10px] text-gray-400">Checked</div>
								</div>
								<div>
									<div className="text-lg font-bold text-green-400">{manualTriggerResult.notificationsSent}</div>
									<div className="text-[10px] text-gray-400">Sent</div>
								</div>
								<div>
									<div className="text-lg font-bold text-red-400">{manualTriggerResult.errors}</div>
									<div className="text-[10px] text-gray-400">Errors</div>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Confirmation Modal */}
				{showTriggerConfirmModal && (
					<div className="fixed inset-0 z-50 flex items-center justify-center">
						<div 
							className="absolute inset-0 bg-black/60 backdrop-blur-sm"
							onClick={() => setShowTriggerConfirmModal(false)}
						/>
						<div className="relative bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
							<h3 className="text-lg font-semibold text-white mb-2">Run Payment Notifications?</h3>
							<p className="text-sm text-gray-400 mb-4">
								This will immediately send WhatsApp notifications to all customers with upcoming or late payments. 
								This action is normally scheduled to run daily at 10AM (GMT+8).
							</p>
							<div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 mb-4">
								<p className="text-xs text-amber-300">
									<strong>Note:</strong> Customers will only receive notifications if they haven't already been notified today.
								</p>
							</div>
							<div className="flex gap-3 justify-end">
								<button
									onClick={() => setShowTriggerConfirmModal(false)}
									className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={() => {
										setShowTriggerConfirmModal(false);
										triggerPaymentNotifications();
									}}
									disabled={manualTriggerLoading}
									className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
								>
									{manualTriggerLoading ? "Running..." : "Confirm & Run"}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Main Table */}
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl overflow-hidden">
					<table className="w-full">
						<thead>
							<tr className="border-b border-gray-700/50">
								<th className="text-left text-xs font-medium text-gray-400 px-4 py-3 w-[220px]">Notification Type</th>
								<th className="text-left text-xs font-medium text-gray-400 px-4 py-3 pl-6 hidden md:table-cell">Description</th>
								<th className="text-center text-xs font-medium text-gray-400 px-4 py-3 w-32">Status</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-700/30">
							{notificationGroups.map((group) => (
								<React.Fragment key={group.title}>
									{/* Group Header */}
									<tr className="bg-blue-900/20">
										<td colSpan={3} className="px-4 py-2">
											<span className="text-xs font-semibold text-blue-300 flex items-center gap-2">
												<span>{group.icon}</span>
												{group.title}
											</span>
										</td>
									</tr>
									{/* Group Items */}
									{group.items.map((item) => {
										const { key, label, description } = item;
										const mandatory = 'mandatory' in item ? item.mandatory : false;
										const setting = findSetting(key);
										// For non-mandatory items, skip if setting doesn't exist
										// For mandatory items, always show the row
										if (!setting && !mandatory) return null;
										return (
											<tr key={key} className="hover:bg-gray-800/20 transition-colors">
												<td className="px-4 py-2.5 pl-8 w-[220px]">
													<span className="text-sm text-white">{label}</span>
												</td>
												<td className="px-4 py-2.5 pl-6 hidden md:table-cell">
													<span className="text-xs text-gray-400">{description}</span>
												</td>
												<td className="px-4 py-2.5 text-center">
													{mandatory ? (
														<span className="text-xs text-gray-400">Always enabled</span>
													) : setting ? (
														<div className="inline-block">
															{renderSettingInput(setting)}
														</div>
													) : (
														<span className="text-xs text-gray-500">N/A</span>
													)}
												</td>
											</tr>
										);
									})}
								</React.Fragment>
							))}
						</tbody>
					</table>
				</div>

				{/* Payment Reminders Section */}
				<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl overflow-hidden">
					<div className="px-4 py-3 border-b border-gray-700/30 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span>📅</span>
							<h3 className="text-sm font-semibold text-white">Payment Reminders</h3>
						</div>
						<div className="flex items-center gap-2 text-xs text-gray-400">
							<span>Daily check at</span>
							<span className="text-white bg-gray-700/50 px-2 py-1 rounded">10:00 AM (MYT)</span>
						</div>
					</div>
					<table className="w-full">
						<thead>
							<tr className="border-b border-gray-700/50">
								<th className="text-left text-xs font-medium text-gray-400 px-4 py-2 w-[200px]">Type</th>
								<th className="text-left text-xs font-medium text-gray-400 px-4 py-2">Reminder Days</th>
								<th className="text-center text-xs font-medium text-gray-400 px-4 py-2 w-24">Enable</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-700/30">
							<tr className="hover:bg-gray-800/20">
								<td className="px-4 py-3">
									<div className="flex items-center gap-2">
										<span className="text-orange-400">⏰</span>
										<span className="text-sm text-white">Upcoming Payment</span>
									</div>
								</td>
								<td className="px-4 py-3">
									{findSetting("UPCOMING_PAYMENT_REMINDER_DAYS") ? (
										renderSettingInput(findSetting("UPCOMING_PAYMENT_REMINDER_DAYS")!)
									) : <span className="text-xs text-gray-500">N/A</span>}
								</td>
								<td className="px-4 py-3 text-center">
									{findSetting("WHATSAPP_UPCOMING_PAYMENT") ? renderSettingInput(findSetting("WHATSAPP_UPCOMING_PAYMENT")!) : <span className="text-xs text-gray-500">N/A</span>}
								</td>
							</tr>
							<tr className="hover:bg-gray-800/20">
								<td className="px-4 py-3">
									<div className="flex items-center gap-2">
										<span className="text-red-400">🚨</span>
										<span className="text-sm text-white">Late Payment</span>
									</div>
								</td>
								<td className="px-4 py-3">
									{findSetting("LATE_PAYMENT_REMINDER_DAYS") ? (
										renderSettingInput(findSetting("LATE_PAYMENT_REMINDER_DAYS")!)
									) : <span className="text-xs text-gray-500">N/A</span>}
								</td>
								<td className="px-4 py-3 text-center">
									{findSetting("WHATSAPP_LATE_PAYMENT") ? renderSettingInput(findSetting("WHATSAPP_LATE_PAYMENT")!) : <span className="text-xs text-gray-500">N/A</span>}
								</td>
							</tr>
						</tbody>
					</table>
				</div>

				{/* Default Risk Section */}
				{(() => {
					// Get default risk settings from the settings object
					const defaultRiskDaysSetting = Object.values(settings).flat().find(s => s.key === "DEFAULT_RISK_DAYS");
					const defaultRemedyDaysSetting = Object.values(settings).flat().find(s => s.key === "DEFAULT_REMEDY_DAYS");
					
					const riskDays = typeof defaultRiskDaysSetting?.value === 'number' 
						? defaultRiskDaysSetting.value 
						: parseInt(defaultRiskDaysSetting?.value) || 28;
					const remedyDays = typeof defaultRemedyDaysSetting?.value === 'number' 
						? defaultRemedyDaysSetting.value 
						: parseInt(defaultRemedyDaysSetting?.value) || 16;
					const totalDays = riskDays + remedyDays;
					const remedyEndDay = totalDays - 1;

					return (
						<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl overflow-hidden">
							<div className="px-4 py-3 border-b border-gray-700/30 flex items-center justify-between">
								<div className="flex items-center gap-2">
									<span>⚠️</span>
									<h3 className="text-sm font-semibold text-white">Default Risk Notifications</h3>
								</div>
								<details className="text-xs">
									<summary className="text-amber-400 cursor-pointer">View Timeline</summary>
									<div className="absolute right-4 mt-2 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-10 text-gray-400 w-64">
										<p className="mb-1"><strong className="text-amber-300">Day {riskDays}:</strong> Initial warning</p>
										<p className="mb-1"><strong className="text-orange-300">Day {riskDays + 1}-{remedyEndDay}:</strong> Remedy reminders</p>
										<p><strong className="text-red-300">Day {totalDays}:</strong> Final default notice</p>
										<p className="mt-2 text-[10px] text-gray-500 border-t border-gray-700 pt-2">
											Configure days in Loan Settings → Default Risk Processing
										</p>
									</div>
								</details>
							</div>
							<table className="w-full">
								<thead>
									<tr className="border-b border-gray-700/50">
										<th className="text-left text-xs font-medium text-gray-400 px-4 py-2 w-[180px]">Stage</th>
										<th className="text-left text-xs font-medium text-gray-400 px-4 py-2 hidden md:table-cell">Description</th>
										<th className="text-left text-xs font-medium text-gray-400 px-4 py-2">Days After Due</th>
										<th className="text-center text-xs font-medium text-gray-400 px-4 py-2 w-24">Enable</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-700/30">
									{[
										{ key: "WHATSAPP_DEFAULT_RISK", label: "Initial Warning", description: "First notice sent to borrower", day: String(riskDays), color: "text-amber-400", bgColor: "bg-amber-500/10" },
										{ key: "WHATSAPP_DEFAULT_REMINDER", label: "Remedy Reminder", description: `Reminders during ${remedyDays}-day remedy period`, day: `${riskDays + 1}-${remedyEndDay}`, color: "text-orange-400", bgColor: "bg-orange-500/10" },
										{ key: "WHATSAPP_DEFAULT_FINAL", label: "Final Notice", description: "Loan marked as defaulted", day: String(totalDays), color: "text-red-400", bgColor: "bg-red-500/10" },
									].map(({ key, label, description, day, color, bgColor }) => {
										const setting = findSetting(key);
										return (
											<tr key={key} className="hover:bg-gray-800/20">
												<td className="px-4 py-3">
													<span className="text-sm text-white">{label}</span>
												</td>
												<td className="px-4 py-3 hidden md:table-cell">
													<span className="text-xs text-gray-400">{description}</span>
												</td>
												<td className="px-4 py-3">
													<span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${color} ${bgColor}`}>
														Day {day}
													</span>
												</td>
												<td className="px-4 py-3 text-center">
													{setting ? renderSettingInput(setting) : <span className="text-xs text-gray-500">N/A</span>}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					);
				})()}


				{/* General Settings */}
				{generalSettings.length > 0 && (
					<div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl overflow-hidden">
						<div className="px-4 py-3 border-b border-gray-700/30 flex items-center gap-2">
							<span>📱</span>
							<h3 className="text-sm font-semibold text-white">General Notifications</h3>
						</div>
						<table className="w-full">
							<tbody className="divide-y divide-gray-700/30">
								{generalSettings.map((setting) => (
									<tr key={setting.key} className="hover:bg-gray-800/20">
										<td className="px-4 py-3">
											<div className="text-sm text-white">{setting.name}</div>
											<div className="text-xs text-gray-500">{setting.description}</div>
										</td>
										<td className="px-4 py-3 w-32">
											{renderSettingInput(setting)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* Footer */}
				<div className="flex items-center justify-between">
					<span className="text-xs text-gray-500">Last updated: {new Date().toLocaleString()}</span>
					<div className="flex gap-2">
						<button
							onClick={forceRefresh}
							disabled={loading}
							className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
						>
							Refresh
						</button>
						<button
							onClick={saveSettings}
							disabled={saving || !hasUnsavedChanges}
							className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
						>
							{saving ? "Saving..." : "Save Changes"}
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