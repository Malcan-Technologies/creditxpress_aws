"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import {
	PencilIcon,
	UserCircleIcon,
	HomeIcon,
	BriefcaseIcon,
	BanknotesIcon,
	ShieldCheckIcon,
	ClockIcon,
	CalendarIcon,
	PhoneIcon,
	EnvelopeIcon,
	MapPinIcon,
	BuildingOfficeIcon,
	CurrencyDollarIcon,
	IdentificationIcon,
	DocumentTextIcon,
	EyeIcon,
	ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { fetchWithTokenRefresh, checkAuth } from "@/lib/authUtils";
import { validatePhoneNumber } from "@/lib/phoneUtils";
import { 
	validateICOrPassport, 
	extractDOBFromMalaysianIC, 
	formatMalaysianIC,
	getRelationshipOptions,
	validateEmergencyContactPhone 
} from "@/lib/icUtils";
import { checkProfileCompleteness } from "@/lib/profileUtils";

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
	zipCode: string | null;
	employmentStatus: string | null;
	employerName: string | null;
	monthlyIncome: string | null;
	serviceLength: string | null;
	bankName: string | null;
	accountNumber: string | null;
	isOnboardingComplete: boolean;
	onboardingStep: number;
	createdAt: string;
	updatedAt: string;
	lastLoginAt: string | null;
	kycStatus: boolean;
	// IC/Passport Information
	icNumber?: string | null;
	icType?: string | null;
	// Emergency Contact Information
	emergencyContactName?: string | null;
	emergencyContactPhone?: string | null;
	emergencyContactRelationship?: string | null;
}

interface UserDocument {
	id: string;
	type: string;
	status: string;
	fileUrl: string;
	applicationId: string | null;
	createdAt: string;
	updatedAt: string;
	application?: {
		id: string;
		product: {
			name: string;
			code: string;
		};
	} | null;
}

interface CountryData {
	countryCode: string;
	dialCode: string;
	format: string;
	name: string;
}

const employmentStatuses = [
	"Employed",
	"Self-Employed",
	"Student",
	"Unemployed",
] as const;



const malaysianStates = [
	"Johor",
	"Kedah",
	"Kelantan",
	"Kuala Lumpur",
	"Labuan",
	"Malacca",
	"Negeri Sembilan",
	"Pahang",
	"Penang",
	"Perak",
	"Perlis",
	"Putrajaya",
	"Sabah",
	"Sarawak",
	"Selangor",
	"Terengganu",
] as const;

type EditingSections = "personal" | "address" | "employment" | "banking" | "ic" | "emergency" | "password" | null;

export default function ProfilePage() {
	const router = useRouter();
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [editingSection, setEditingSection] = useState<EditingSections>(null);
	const [formData, setFormData] = useState<Partial<UserProfile>>({});
	const [phoneNumber, setPhoneNumber] = useState("");
	const [phoneError, setPhoneError] = useState<string | null>(null);
	const [passwordData, setPasswordData] = useState({
		currentPassword: "",
		newPassword: "",
		confirmPassword: "",
	});
	const [passwordError, setPasswordError] = useState("");
	const [icError, setIcError] = useState("");
	const [emergencyError, setEmergencyError] = useState("");
	const [documents, setDocuments] = useState<UserDocument[]>([]);
	const [documentsLoading, setDocumentsLoading] = useState(true);

	// Example placeholders for different countries
	const placeholders: { [key: string]: string } = {
		my: "1234 5678", // Malaysia
		sg: "8123 4567", // Singapore
		id: "812 345 678", // Indonesia
		th: "81 234 5678", // Thailand
	};

	const [placeholder, setPlaceholder] = useState(placeholders["my"]);

	const fetchDocuments = async () => {
		try {
			setDocumentsLoading(true);
			const data = await fetchWithTokenRefresh<UserDocument[]>(
				`/api/users/me/documents?t=${Date.now()}`
			);
			
			// Deduplicate documents based on fileUrl (same document used in multiple applications)
			const uniqueDocuments = data ? data.reduce((acc: UserDocument[], current) => {
				const existingIndex = acc.findIndex(doc => doc.fileUrl === current.fileUrl);
				if (existingIndex === -1) {
					// New unique document
					acc.push(current);
				} else {
					// Keep the most recent one (latest createdAt)
					if (new Date(current.createdAt) > new Date(acc[existingIndex].createdAt)) {
						acc[existingIndex] = current;
					}
				}
				return acc;
			}, []) : [];
			
			setDocuments(uniqueDocuments);
		} catch (error) {
			console.error("Error fetching documents:", error);
			setDocuments([]);
		} finally {
			setDocumentsLoading(false);
		}
	};

	const fetchProfile = async () => {
			try {
				// Check authentication using our utility
				const isAuthenticated = await checkAuth();

				if (!isAuthenticated) {
					router.push("/login");
					return;
				}

							// Fetch profile data using our token refresh utility
			// Add cache-busting parameter and headers to ensure fresh data
			const data = await fetchWithTokenRefresh<UserProfile>(
				`/api/users/me?t=${Date.now()}`,
				{
					headers: {
						'Cache-Control': 'no-cache, no-store, must-revalidate',
						'Pragma': 'no-cache',
						'Expires': '0'
					}
				}
			);

				if (data.dateOfBirth) {
					data.dateOfBirth = new Date(data.dateOfBirth)
						.toISOString()
						.split("T")[0];
				}
				setProfile(data);
				setFormData(data);
				// Initialize phone number state
				setPhoneNumber(data.phoneNumber || "");
				
				// Load documents
				fetchDocuments();
			} catch (error) {
				console.error("Error fetching profile:", error);
				router.push("/login");
			} finally {
				setLoading(false);
			}
		};

	useEffect(() => {
		fetchProfile();
	}, [router]);

	// Refetch profile data when the page becomes visible (e.g., after navigating back)
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden && profile) {
				// Only refetch if we already have profile data (not on initial load)
				fetchProfile();
				fetchDocuments();
			}
		};

		const handleFocus = () => {
			if (profile) {
				// Only refetch if we already have profile data (not on initial load)
				fetchProfile();
				fetchDocuments();
			}
		};

		// Add storage event listener for cross-tab updates
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === 'profile_updated' && e.newValue) {
				// Profile was updated in another tab/window, refetch
				fetchProfile();
				fetchDocuments();
				// Clear the flag
				localStorage.removeItem('profile_updated');
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('focus', handleFocus);
		window.addEventListener('storage', handleStorageChange);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('focus', handleFocus);
			window.removeEventListener('storage', handleStorageChange);
		};
	}, [profile]);

	const handlePhoneChange = (value: string, data: CountryData) => {
		setPhoneNumber(value);
		setPlaceholder(placeholders[data.countryCode] || "1234 5678");
		
		// Update form data with the new phone number
		setFormData((prev) => ({
			...prev,
			phoneNumber: value,
		}));
		
		// Clear phone error when user starts typing
		if (phoneError) {
			setPhoneError(null);
		}
	};

	const handleEdit = (section: EditingSections) => {
		setEditingSection(section);
		// Initialize phone number when editing personal section
		if (section === "personal" && profile) {
			setPhoneNumber(profile.phoneNumber || "");
		}
	};

	const handleCancel = () => {
		setEditingSection(null);
		setFormData(profile || {});
		// Reset phone number to original profile value
		setPhoneNumber(profile?.phoneNumber || "");
		setPhoneError(null);
		// Reset password form when canceling
		setPasswordData({
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		});
		setPasswordError("");
		setIcError("");
		setEmergencyError("");
	};

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target;
		
		// Handle employment status changes
		if (name === "employmentStatus") {
			if (value === "Student" || value === "Unemployed") {
				// Clear employer name and service length for student/unemployed
				setFormData((prev) => ({
					...prev,
					[name]: value,
					employerName: "",
					serviceLength: "",
				}));
			} else {
				setFormData((prev) => ({
					...prev,
					[name]: value,
				}));
			}
		} else {
			setFormData((prev) => ({
				...prev,
				[name]: value,
			}));
		}
		
		// Clear errors when user starts typing
		if (name === "icNumber" && icError) {
			setIcError("");
		}
		if (name.startsWith("emergencyContact") && emergencyError) {
			setEmergencyError("");
		}
	};

	const handleIcNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { value } = e.target;
		
		// Update IC number
		setFormData((prev) => ({
			...prev,
			icNumber: value,
		}));
		
		// Clear error when user starts typing
		if (icError) {
			setIcError("");
		}
		
		// Validate IC/Passport and extract DOB if it's a Malaysian IC
		if (value.trim()) {
			const validation = validateICOrPassport(value);
			
			if (validation.isValid) {
				// Update IC type
				setFormData((prev) => ({
					...prev,
					icType: validation.type,
				}));
				
				// Extract DOB if it's a Malaysian IC
				if (validation.type === 'IC' && validation.extractedDOB) {
					const dobString = validation.extractedDOB.toISOString().split('T')[0];
					setFormData((prev) => ({
						...prev,
						dateOfBirth: dobString,
					}));
				}
			}
		} else {
			// Clear IC type if IC number is empty
			setFormData((prev) => ({
				...prev,
				icType: null,
			}));
		}
	};

	const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setPasswordData((prev) => ({
			...prev,
			[name]: value,
		}));
		// Clear error when user starts typing
		if (passwordError) {
			setPasswordError("");
		}
	};

	const handlePasswordSave = async () => {
		if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
			setPasswordError("All password fields are required");
			return;
		}

		if (passwordData.newPassword !== passwordData.confirmPassword) {
			setPasswordError("New passwords do not match");
			return;
		}

		if (passwordData.newPassword.length < 8) {
			setPasswordError("New password must be at least 8 characters long");
			return;
		}

		setSaving(true);
		try {
			await fetchWithTokenRefresh("/api/users/me/password", {
				method: "PUT",
				body: JSON.stringify({
					currentPassword: passwordData.currentPassword,
					newPassword: passwordData.newPassword,
				}),
			});

			// Reset form and close editing
			setPasswordData({
				currentPassword: "",
				newPassword: "",
				confirmPassword: "",
			});
			setEditingSection(null);
			setPasswordError("");
			
			// Show success message (you can implement a toast notification here)
			alert("Password changed successfully!");
		} catch (error: any) {
			console.error("Error changing password:", error);
			setPasswordError(error.message || "Failed to change password");
		} finally {
			setSaving(false);
		}
	};

	const handleSave = async () => {
		if (!profile) return;

		// Validate phone number if editing personal section
		if (editingSection === "personal") {
			const phoneValidation = validatePhoneNumber(phoneNumber, {
				requireMobile: false, // Allow both mobile and landline for profile update
				allowLandline: true
			});

			if (!phoneValidation.isValid) {
				setPhoneError(phoneValidation.error || "Please enter a valid phone number");
				return;
			}
		}

		// Validate IC number if editing IC section
		if (editingSection === "ic") {
			if (formData.icNumber && formData.icNumber.trim()) {
				const icValidation = validateICOrPassport(formData.icNumber);
				if (!icValidation.isValid) {
					setIcError(icValidation.error || "Please enter a valid IC/Passport number");
					return;
				}
			}
		}

		// Validate emergency contact if editing emergency section
		if (editingSection === "emergency") {
			if (formData.emergencyContactName && formData.emergencyContactPhone && formData.emergencyContactRelationship) {
				// Validate emergency contact phone
				if (!validateEmergencyContactPhone(formData.emergencyContactPhone)) {
					setEmergencyError("Please enter a valid emergency contact phone number");
					return;
				}
			} else if (formData.emergencyContactName || formData.emergencyContactPhone || formData.emergencyContactRelationship) {
				// If any emergency contact field is filled, all must be filled
				setEmergencyError("All emergency contact fields are required");
				return;
			}
		}

		setSaving(true);
		try {
			const dataToSend = { ...formData };

			// Use the phoneNumber state for personal section
			if (editingSection === "personal") {
				dataToSend.phoneNumber = phoneNumber;
			}

			if (dataToSend.dateOfBirth) {
				// Keep the date as is since it's already in YYYY-MM-DD format
				// The API will handle the conversion to UTC
			}

			const response = await fetchWithTokenRefresh("/api/users/me", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(dataToSend),
			});

			// Since fetchWithTokenRefresh returns the parsed data directly on success,
			// we need to handle errors differently
			if (response && typeof response === 'object' && 'message' in response) {
				// This is an error response
				const errorData = response as { message: string };
				
				// Handle specific error cases
				if (errorData.message?.includes("already registered")) {
					setPhoneError("This phone number is already registered to another account. Please use a different number.");
					return;
				} else {
					throw new Error(errorData.message || "Failed to update profile");
				}
			}

			// If we get here, the response is the updated user data
			const updatedUser = response as UserProfile;
			
			if (updatedUser.dateOfBirth) {
				updatedUser.dateOfBirth = new Date(updatedUser.dateOfBirth)
					.toISOString()
					.split("T")[0];
			}
			
			setProfile(updatedUser);
			setEditingSection(null);
			// Reset phone number to updated profile value
			setPhoneNumber(updatedUser.phoneNumber || "");
			setPhoneError(null);
		} catch (error) {
			console.error("Error updating profile:", error);
			
			// Check if this is a phone number duplicate error
			if (error instanceof Error && error.message.includes("already registered")) {
				setPhoneError("This phone number is already registered to another account. Please use a different number.");
			} else {
				// For other errors, just log them - the user will see the form didn't save
				console.error("Profile update failed:", error instanceof Error ? error.message : "Unknown error");
			}
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<DashboardLayout
				userName={profile?.fullName?.split(" ")[0] || "User"}
				title="Profile"
			>
				<div className="flex items-center justify-center h-full">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary"></div>
				</div>
			</DashboardLayout>
		);
	}

	if (!profile) {
		return (
			<DashboardLayout userName="User" title="Profile">
				<div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
					<p className="text-gray-700 font-body">
						Failed to load profile information.
					</p>
				</div>
			</DashboardLayout>
		);
	}

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		// Format in Malaysia timezone (GMT+8)
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			timeZone: "Asia/Kuala_Lumpur",
		});
	};

	const formatDateTime = (dateString: string) => {
		const date = new Date(dateString);
		// Format in Malaysia timezone (GMT+8)
		return date.toLocaleString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
			timeZone: "Asia/Kuala_Lumpur",
		}) + " (GMT+8)";
	};

	const profileStatus = checkProfileCompleteness(profile);

	const getDocumentStatusBadge = (status: string) => {
		switch (status) {
			case "PENDING":
				return (
					<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
						Pending Review
					</span>
				);
			case "APPROVED":
				return (
					<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
						Approved
					</span>
				);
			case "REJECTED":
				return (
					<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
						Rejected
					</span>
				);
			default:
				return (
					<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
						{status}
					</span>
				);
		}
	};

	const formatDocumentDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			timeZone: "Asia/Kuala_Lumpur",
		});
	};

	const getFileExtension = (fileUrl: string) => {
		return fileUrl.split('.').pop()?.toUpperCase() || 'FILE';
	};

	const handleDocumentView = (document: UserDocument) => {
		if (document.applicationId) {
			// For application documents, use the existing document viewing endpoint
			const viewUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/loan-applications/${document.applicationId}/documents/${document.id}`;
			window.open(viewUrl, '_blank');
		} else {
			// For standalone documents (if any)
			window.open(document.fileUrl, '_blank');
		}
	};

	const renderBadge = (status: boolean, label: string) => (
		<span
			className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium font-body ${
				status
					? "bg-green-100 text-green-700 border border-green-200"
					: "bg-amber-100 text-amber-700 border border-amber-200"
			}`}
		>
			<span
				className={`h-2 w-2 mr-1.5 rounded-full ${
					status ? "bg-green-500" : "bg-amber-500"
				}`}
			></span>
			{label}
		</span>
	);

	const renderEditButton = (section: EditingSections) => (
		<button
			onClick={() => handleEdit(section)}
			className="text-purple-primary hover:text-blue-tertiary flex items-center text-sm font-medium bg-purple-primary/5 px-3 py-1.5 rounded-lg hover:bg-purple-primary/10 transition-all duration-300 border border-purple-primary/20 font-body"
		>
			<PencilIcon className="h-4 w-4 mr-1" />
			Edit
		</button>
	);

	const renderSaveButtons = () => (
		<div className="flex justify-end space-x-3 mt-6">
			<button
				onClick={handleCancel}
				className="px-6 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors font-body"
				disabled={saving}
			>
				Cancel
			</button>
			<button
				onClick={handleSave}
				className="px-6 py-3 text-sm font-medium text-white bg-purple-primary hover:bg-purple-600 rounded-lg transition-colors shadow-sm font-body"
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
	) => {
		// Special handling for IC number
		if (name === "icNumber") {
			return (
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
						{label}
					</label>
					<input
						type="text"
						name="icNumber"
						value={String(formData.icNumber || "")}
						onChange={handleIcNumberChange}
						placeholder="Enter IC number (e.g., 820720073808) or Passport number"
						className="block w-full h-12 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary transition-colors font-body text-gray-700"
					/>
					{formData.icType && (
						<p className="mt-1 text-sm text-blue-600 font-body">
							{formData.icType === 'IC' ? 'Malaysian IC detected' : 'Passport number detected'}
							{formData.icType === 'IC' && formData.dateOfBirth && (
								<span> - Date of birth extracted automatically</span>
							)}
						</p>
					)}
					{icError && (
						<p className="mt-1 text-sm text-red-600 font-body">
							{icError}
						</p>
					)}
				</div>
			);
		}
		
		// Special handling for phone number
		if (name === "phoneNumber") {
			return (
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
						{label}
					</label>
					<div className="phone-input-wrapper">
						<PhoneInput
							country="my"
							value={phoneNumber}
							onChange={(value, data: CountryData) => {
								handlePhoneChange(value, data);
							}}
							inputProps={{
								id: "phoneNumber",
								name: "phoneNumber",
								required: true,
								placeholder: placeholder,
							}}
							containerClass="!w-full"
							inputClass="!w-full !h-12 !pl-20 !pr-4 !py-3 !text-base !font-body !bg-white !border !border-gray-200 !text-gray-700 !placeholder-gray-400 hover:!border-gray-400 focus:!ring-2 focus:!ring-purple-primary/20 focus:!border-purple-primary !transition-colors !rounded-lg"
							buttonClass="!h-12 !w-16 !border !border-gray-200 !bg-white hover:!bg-gray-50 !text-gray-700 !transition-colors !border-r-0 !rounded-l-lg"
							dropdownClass="!bg-white !border-gray-200 !text-gray-700 !shadow-xl !rounded-lg !mt-1 !max-h-60 !overflow-y-auto !min-w-72"
							searchClass="!bg-white !border-gray-200 !text-gray-700 !placeholder-gray-400"
							enableSearch
							disableSearchIcon
							searchPlaceholder="Search country..."
						/>
						{phoneError && (
							<p className="mt-1 text-sm text-red-600 font-body">
								{phoneError}
							</p>
						)}
					</div>
				</div>
			);
		}

		return (
			<div>
				<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
					{label}
				</label>
				{options ? (
					<select
						name={name}
						value={String(formData[name] || "")}
						onChange={handleInputChange}
						className="block w-full h-12 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary transition-colors font-body text-gray-700"
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
						className="block w-full h-12 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary transition-colors font-body text-gray-700"
					/>
				)}
			</div>
		);
	};

	return (
		<>
			<style jsx global>{`
				/* Remove all shadows and focus styles from phone input */
				.react-tel-input *,
				.react-tel-input *:before,
				.react-tel-input *:after,
				.react-tel-input .flag-dropdown,
				.react-tel-input .form-control,
				.react-tel-input .selected-flag {
					outline: none !important;
					box-shadow: none !important;
					-webkit-box-shadow: none !important;
					-moz-box-shadow: none !important;
				}
				.react-tel-input .flag-dropdown:focus,
				.react-tel-input .form-control:focus,
				.react-tel-input .selected-flag:focus,
				.react-tel-input .flag-dropdown:hover,
				.react-tel-input .form-control:hover,
				.react-tel-input .selected-flag:hover,
				.react-tel-input .flag-dropdown:active,
				.react-tel-input .form-control:active,
				.react-tel-input .selected-flag:active {
					outline: none !important;
					box-shadow: none !important;
					-webkit-box-shadow: none !important;
					-moz-box-shadow: none !important;
				}

				/* Style the container wrapper */
				.phone-input-wrapper {
					position: relative;
				}
				.phone-input-wrapper:focus-within {
					box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
					border-radius: 0.5rem;
				}
				.phone-input-wrapper:focus-within
					.react-tel-input
					.flag-dropdown,
				.phone-input-wrapper:focus-within
					.react-tel-input
					.form-control {
					border-color: #7c3aed !important;
				}

				/* Remove all border radius from phone input */
				.react-tel-input,
				.react-tel-input > div {
					border-radius: 0.5rem !important;
				}

				.react-tel-input .flag-dropdown {
					background-color: white !important;
					border-color: rgb(229, 231, 235) !important;
				}
				.react-tel-input .flag-dropdown:hover {
					background-color: rgb(249, 250, 251) !important;
				}
				.react-tel-input .selected-flag {
					background-color: transparent !important;
					width: 100% !important;
					height: 100% !important;
					display: flex !important;
					align-items: center !important;
					justify-content: center !important;
					padding: 0 !important;
					border: none !important;
				}
				.react-tel-input .selected-flag:hover {
					background-color: transparent !important;
				}
				.react-tel-input .country-list .country:hover {
					background-color: rgba(124, 58, 237, 0.1) !important;
					color: #7c3aed !important;
				}
				.react-tel-input .country-list .country.highlight {
					background-color: rgba(124, 58, 237, 0.2) !important;
					color: #7c3aed !important;
				}
			`}</style>
			<DashboardLayout
				userName={profile.fullName?.split(" ")[0] || "User"}
				title="Profile"
			>
				<div className="w-full bg-offwhite min-h-screen px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
					<div className="space-y-6">
						{/* Profile Header Card */}
						<div className="bg-purple-50 rounded-xl lg:rounded-2xl shadow-sm  transition-all border border-purple-primary/20 overflow-hidden">
							<div className="p-6 lg:p-8">
								<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
									<div className="flex items-center">
										<div className="w-16 h-16 lg:w-20 lg:h-20 bg-purple-primary/10 rounded-xl lg:rounded-2xl flex items-center justify-center mr-4 border border-purple-primary/20">
											<UserCircleIcon className="h-10 w-10 lg:h-12 lg:w-12 text-purple-primary" />
										</div>
										<div>
											<h1 className="text-2xl lg:text-3xl font-heading font-bold text-gray-700 mb-1">
												{profile.fullName || "User Profile"}
											</h1>
											<p className="text-sm lg:text-base text-purple-primary font-semibold">
												{profile.phoneNumber}
											</p>
										</div>
									</div>
									<div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
										<div className="flex flex-col space-y-3">
											<div className="flex items-center space-x-3">
												{renderBadge(profile.kycStatus, profile.kycStatus ? "KYC Verified" : "KYC Pending")}
												{renderBadge(profileStatus.isComplete, profileStatus.isComplete ? "Profile Complete" : `Profile ${profileStatus.completionPercentage}% Complete`)}
											</div>
											{!profileStatus.isComplete && profileStatus.missing.length > 0 && (
												<div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
													<p className="text-sm font-medium text-amber-800 font-body mb-1">
														Missing Information:
													</p>
													<p className="text-sm text-amber-700 font-body">
														{profileStatus.missing.join(", ")}
													</p>
												</div>
											)}
										</div>
										<button
											onClick={() => router.push('/onboarding?step=0')}
											className="flex items-center px-4 py-2 bg-purple-primary text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2 transition-all duration-200 text-sm font-medium"
										>
											<UserCircleIcon className="w-4 h-4 mr-2" />
											{profileStatus.isComplete ? "Update Profile" : "Complete Profile"}
										</button>
									</div>
								</div>
							</div>
						</div>

						{/* Main Profile Grid */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{/* Personal Information Card */}
							<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
								<div className="p-6 lg:p-8">
									<div className="flex items-center justify-between mb-6">
										<div className="flex items-center">
											<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3">
												<UserCircleIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
											</div>
											<div>
												<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
													Personal Information
												</h3>
												<p className="text-sm lg:text-base text-purple-primary font-semibold">
													Basic details
												</p>
											</div>
										</div>
										{editingSection !== "personal" && renderEditButton("personal")}
									</div>

									{editingSection === "personal" ? (
										<div className="space-y-6">
											<div className="grid grid-cols-1 gap-4">
												{renderInput("fullName", "Full Name")}
												{renderInput("email", "Email", "email")}
												{renderInput("phoneNumber", "Phone Number", "tel")}
												{renderInput("dateOfBirth", "Date of Birth", "date")}
											</div>
											{renderSaveButtons()}
										</div>
									) : (
										<div className="space-y-4">
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
												<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
													<div className="flex items-center space-x-3">
														<IdentificationIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
														<div className="min-w-0">
															<label className="block text-sm font-medium text-gray-500 font-body">
																Full Name
															</label>
															<p className="mt-1 text-base text-gray-700 font-body truncate">
																{profile.fullName || "Not provided"}
															</p>
														</div>
													</div>
												</div>
												<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
													<div className="flex items-center space-x-3">
														<EnvelopeIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
														<div className="min-w-0">
															<label className="block text-sm font-medium text-gray-500 font-body">
																Email
															</label>
															<p className="mt-1 text-base text-gray-700 font-body truncate">
																{profile.email || "Not provided"}
															</p>
														</div>
													</div>
												</div>
												<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
													<div className="flex items-center space-x-3">
														<PhoneIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
														<div className="min-w-0">
															<label className="block text-sm font-medium text-gray-500 font-body">
																Phone Number
															</label>
															<p className="mt-1 text-base text-gray-700 font-body truncate">
																{profile.phoneNumber}
															</p>
														</div>
													</div>
												</div>
												<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
													<div className="flex items-center space-x-3">
														<CalendarIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
														<div className="min-w-0">
															<label className="block text-sm font-medium text-gray-500 font-body">
																Date of Birth
															</label>
															<p className="mt-1 text-base text-gray-700 font-body truncate">
																{profile.dateOfBirth ? formatDate(profile.dateOfBirth) : "Not provided"}
															</p>
														</div>
													</div>
												</div>
											</div>
										</div>
									)}
								</div>
							</div>

							{/* Address Card */}
							<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
								<div className="p-6 lg:p-8">
									<div className="flex items-center justify-between mb-6">
										<div className="flex items-center">
											<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3">
												<HomeIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
											</div>
											<div>
												<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
													Address
												</h3>
												<p className="text-sm lg:text-base text-purple-primary font-semibold">
													Residential address
												</p>
											</div>
										</div>
										{editingSection !== "address" && renderEditButton("address")}
									</div>

									{editingSection === "address" ? (
										<div className="space-y-6">
											<div className="grid grid-cols-1 gap-4">
												{renderInput("address1", "Address Line 1")}
												{renderInput("address2", "Address Line 2")}
												<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
													{renderInput("city", "City")}
													{renderInput("state", "State", "text", malaysianStates)}
													{renderInput("zipCode", "Postal Code")}
												</div>
											</div>
											{renderSaveButtons()}
										</div>
									) : (
										<div className="space-y-4">
											<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
												<div className="flex items-start space-x-3">
													<MapPinIcon className="h-5 w-5 text-purple-primary flex-shrink-0 mt-0.5" />
													<div className="min-w-0 flex-1">
														<label className="block text-sm font-medium text-gray-500 font-body">
															Complete Address
														</label>
														<div className="mt-1 space-y-1">
															{profile.address1 && (
																<p className="text-base text-gray-700 font-body">
																	{profile.address1}
																</p>
															)}
															{profile.address2 && (
																<p className="text-base text-gray-700 font-body">
																	{profile.address2}
																</p>
															)}
															{(profile.city || profile.state || profile.zipCode) && (
																<p className="text-base text-gray-700 font-body">
																	{[profile.city, profile.state, profile.zipCode].filter(Boolean).join(", ")}
																</p>
															)}
															{!profile.address1 && !profile.address2 && !profile.city && (
																<p className="text-base text-gray-500 font-body italic">
																	Address not provided
																</p>
															)}
														</div>
													</div>
												</div>
											</div>
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Second Row */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{/* IC/Passport Information Card */}
							<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
								<div className="p-6 lg:p-8">
									<div className="flex items-center justify-between mb-6">
										<div className="flex items-center">
											<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3">
												<IdentificationIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
											</div>
											<div>
												<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
													IC/Passport Information
												</h3>
												<p className="text-sm lg:text-base text-purple-primary font-semibold">
													Identity verification
												</p>
											</div>
										</div>
										{editingSection !== "ic" && renderEditButton("ic")}
									</div>

									{editingSection === "ic" ? (
										<div className="space-y-6">
											<div className="grid grid-cols-1 gap-4">
												{renderInput("icNumber", "IC/Passport Number")}
											</div>
											{renderSaveButtons()}
										</div>
									) : (
										<div className="space-y-4">
											<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
												<div className="flex items-center space-x-3">
													<IdentificationIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
													<div className="min-w-0 flex-1">
														<label className="block text-sm font-medium text-gray-500 font-body">
															IC/Passport Number
														</label>
														<div className="mt-1 space-y-1">
															{profile.icNumber ? (
																<>
																	<p className="text-base text-gray-700 font-body">
																		{profile.icType === 'IC' ? formatMalaysianIC(profile.icNumber) : profile.icNumber}
																	</p>
																	<p className="text-sm text-blue-600 font-body">
																		{profile.icType === 'IC' ? 'Malaysian IC' : 'Passport'}
																	</p>
																</>
															) : (
																<p className="text-base text-gray-500 font-body italic">
																	Not provided
																</p>
															)}
														</div>
													</div>
												</div>
											</div>
										</div>
									)}
								</div>
							</div>

							{/* Emergency Contact Card */}
							<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
								<div className="p-6 lg:p-8">
									<div className="flex items-center justify-between mb-6">
										<div className="flex items-center">
											<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3">
												<PhoneIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
											</div>
											<div>
												<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
													Emergency Contact
												</h3>
												<p className="text-sm lg:text-base text-purple-primary font-semibold">
													Emergency contact details
												</p>
											</div>
										</div>
										{editingSection !== "emergency" && renderEditButton("emergency")}
									</div>

									{editingSection === "emergency" ? (
										<div className="space-y-6">
											{emergencyError && (
												<div className="bg-red-50 border border-red-200 rounded-lg p-4">
													<p className="text-sm text-red-700 font-body">{emergencyError}</p>
												</div>
											)}
											<div className="grid grid-cols-1 gap-4">
												{renderInput("emergencyContactName", "Full Name")}
												{renderInput("emergencyContactPhone", "Phone Number", "tel")}
												{renderInput("emergencyContactRelationship", "Relationship", "text", getRelationshipOptions())}
											</div>
											{renderSaveButtons()}
										</div>
									) : (
										<div className="space-y-4">
											<div className="grid grid-cols-1 gap-4">
												<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
													<div className="flex items-center space-x-3">
														<UserCircleIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
														<div className="min-w-0">
															<label className="block text-sm font-medium text-gray-500 font-body">
																Name
															</label>
															<p className="mt-1 text-base text-gray-700 font-body truncate">
																{profile.emergencyContactName || "Not provided"}
															</p>
														</div>
													</div>
												</div>
												<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
													<div className="flex items-center space-x-3">
														<PhoneIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
														<div className="min-w-0">
															<label className="block text-sm font-medium text-gray-500 font-body">
																Phone Number
															</label>
															<p className="mt-1 text-base text-gray-700 font-body truncate">
																{profile.emergencyContactPhone || "Not provided"}
															</p>
														</div>
													</div>
												</div>
												<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
													<div className="flex items-center space-x-3">
														<UserCircleIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
														<div className="min-w-0">
															<label className="block text-sm font-medium text-gray-500 font-body">
																Relationship
															</label>
															<p className="mt-1 text-base text-gray-700 font-body truncate">
																{profile.emergencyContactRelationship || "Not provided"}
															</p>
														</div>
													</div>
												</div>
											</div>
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Third Row */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{/* Employment Information Card */}
							<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
								<div className="p-6 lg:p-8">
									<div className="flex items-center justify-between mb-6">
										<div className="flex items-center">
											<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3">
												<BriefcaseIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
											</div>
											<div>
												<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
													Employment Information
												</h3>
												<p className="text-sm lg:text-base text-purple-primary font-semibold">
													Work & income details
												</p>
											</div>
										</div>
										{editingSection !== "employment" && renderEditButton("employment")}
									</div>

									{editingSection === "employment" ? (
										<div className="space-y-6">
											<div className="grid grid-cols-1 gap-4">
												{renderInput("employmentStatus", "Employment Status", "text", employmentStatuses)}
												{formData.employmentStatus && 
													formData.employmentStatus !== "Student" && 
													formData.employmentStatus !== "Unemployed" && (
													<>
														{renderInput("employerName", "Employer Name")}
														{renderInput("serviceLength", "Years at Current Company", "number")}
													</>
												)}
												{renderInput("monthlyIncome", "Monthly Income (RM)", "number")}
											</div>
											{renderSaveButtons()}
										</div>
									) : (
										<div className="space-y-4">
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
												<div className="bg-gray-50 p-4 lg:p-5 rounded-lg border border-gray-200">
													<div className="flex items-center space-x-3">
														<BriefcaseIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
														<div className="min-w-0">
															<label className="block text-sm font-medium text-gray-500 font-body">
																Employment Status
															</label>
															<p className="mt-1 text-base text-gray-700 font-body truncate">
																{profile.employmentStatus || "Not provided"}
															</p>
														</div>
													</div>
												</div>
												<div className="bg-gray-50 p-4 lg:p-5 rounded-lg border border-gray-200">
													<div className="flex items-center space-x-3">
														<BuildingOfficeIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
														<div className="min-w-0">
															<label className="block text-sm font-medium text-gray-500 font-body">
																Employer Name
															</label>
															<p className="mt-1 text-base text-gray-700 font-body truncate">
																{profile.employerName || "Not provided"}
															</p>
														</div>
													</div>
												</div>
												<div className="bg-gray-50 p-4 lg:p-5 rounded-lg border border-gray-200">
													<div className="flex items-center space-x-3">
														<ClockIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
														<div className="min-w-0">
															<label className="block text-sm font-medium text-gray-500 font-body">
																Service Length
															</label>
															<p className="mt-1 text-base text-gray-700 font-body truncate">
																{profile.serviceLength ? `${profile.serviceLength} years` : "Not provided"}
															</p>
														</div>
													</div>
												</div>
												<div className="bg-gray-50 p-4 lg:p-5 rounded-lg border border-gray-200">
													<div className="flex items-center space-x-3">
														<CurrencyDollarIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
														<div className="min-w-0">
															<label className="block text-sm font-medium text-gray-500 font-body">
																Monthly Income
															</label>
															<p className="mt-1 text-base text-gray-700 font-body truncate">
																{profile.monthlyIncome ? `RM ${Number(profile.monthlyIncome).toLocaleString()}` : "Not provided"}
															</p>
														</div>
													</div>
												</div>
											</div>
										</div>
									)}
								</div>
							</div>

							{/* Banking Information Card */}
							<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
								<div className="p-6 lg:p-8">
									<div className="flex items-center justify-between mb-6">
										<div className="flex items-center">
											<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3">
												<BanknotesIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
											</div>
											<div>
												<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
													Banking Information
												</h3>
												<p className="text-sm lg:text-base text-purple-primary font-semibold">
													Bank account details
												</p>
											</div>
										</div>
										{editingSection !== "banking" && renderEditButton("banking")}
									</div>

									{editingSection === "banking" ? (
										<div className="space-y-6">
											<div className="grid grid-cols-1 gap-4">
												{renderInput("bankName", "Bank Name")}
												{renderInput("accountNumber", "Account Number")}
											</div>
											{renderSaveButtons()}
										</div>
									) : (
										<div className="space-y-4">
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
												<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
													<div className="flex items-center space-x-3">
														<BanknotesIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
														<div className="min-w-0">
															<label className="block text-sm font-medium text-gray-500 font-body">
																Bank Name
															</label>
															<p className="mt-1 text-base text-gray-700 font-body truncate">
																{profile.bankName || "Not provided"}
															</p>
														</div>
													</div>
												</div>
												<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
													<div className="flex items-center space-x-3">
														<ShieldCheckIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
														<div className="min-w-0">
															<label className="block text-sm font-medium text-gray-500 font-body">
																Account Number
															</label>
															<p className="mt-1 text-base text-gray-700 font-body truncate">
																{profile.accountNumber ? "••••" + profile.accountNumber.slice(-4) : "Not provided"}
															</p>
														</div>
													</div>
												</div>
											</div>
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Full Width Cards */}
						<div className="grid grid-cols-1 gap-6">
							{/* Uploaded Documents Card */}
							<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
								<div className="p-6 lg:p-8">
									<div className="flex items-center justify-between mb-6">
										<div className="flex items-center">
											<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3">
												<DocumentTextIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
											</div>
											<div>
												<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
													Uploaded Documents
												</h3>
												<p className="text-sm lg:text-base text-purple-primary font-semibold">
													Your uploaded documents
												</p>
											</div>
										</div>
										<div className="flex items-center space-x-2">
											<span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium font-body bg-blue-100 text-blue-800 border border-blue-200">
												{documents.length} document{documents.length !== 1 ? 's' : ''}
											</span>
										</div>
									</div>

									{documentsLoading ? (
										<div className="flex items-center justify-center py-8">
											<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-primary"></div>
											<span className="ml-3 text-gray-600 font-body">Loading documents...</span>
										</div>
									) : documents.length > 0 ? (
										<div className="space-y-4">
											{documents.map((document) => (
												<div
													key={document.id}
													className="bg-gray-50 p-4 lg:p-5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
												>
													<div className="flex items-center justify-between">
														<div className="flex items-center space-x-4 min-w-0 flex-1">
															<div className="flex-shrink-0">
																<div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
																	<DocumentTextIcon className="h-5 w-5 text-blue-600" />
																</div>
															</div>
															<div className="min-w-0 flex-1">
																<div className="flex items-center space-x-3 mb-1">
																	<h4 className="text-sm lg:text-base font-semibold text-gray-700 font-body truncate">
																		{document.type}
																	</h4>
																	{getDocumentStatusBadge(document.status)}
																</div>
																<div className="flex items-center space-x-4 text-sm text-gray-500 font-body">
																	<span>
																		{getFileExtension(document.fileUrl)} file
																	</span>
																	<span>
																		Uploaded {formatDocumentDate(document.createdAt)}
																	</span>
																</div>
															</div>
														</div>
														<div className="flex items-center space-x-2 ml-4">
															<button
																onClick={() => handleDocumentView(document)}
																className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200 hover:border-blue-300"
															>
																<EyeIcon className="h-4 w-4 mr-1" />
																View
															</button>
														</div>
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="text-center py-8">
											<div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
												<DocumentTextIcon className="h-8 w-8 text-gray-400" />
											</div>
											<h4 className="text-lg font-semibold text-gray-700 font-heading mb-2">
												No Documents Yet
											</h4>
											<p className="text-gray-500 font-body mb-4">
												You haven't uploaded any documents yet. Documents are uploaded during various processes like loan applications.
											</p>
											<button
												onClick={() => router.push('/dashboard/apply')}
												className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-primary hover:bg-purple-600 rounded-lg transition-colors"
											>
												Start Application
											</button>
										</div>
									)}
								</div>
							</div>

							{/* Password & Security Card */}
							<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
								<div className="p-6 lg:p-8">
									<div className="flex items-center justify-between mb-6">
										<div className="flex items-center">
											<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3">
												<ShieldCheckIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
											</div>
											<div>
												<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
													Password & Security
												</h3>
												<p className="text-sm lg:text-base text-purple-primary font-semibold">
													Account security settings
												</p>
											</div>
										</div>
										{editingSection !== "password" && renderEditButton("password")}
									</div>

									{editingSection === "password" ? (
										<div className="space-y-6">
											{passwordError && (
												<div className="bg-red-50 border border-red-200 rounded-lg p-4">
													<p className="text-sm text-red-700 font-body">{passwordError}</p>
												</div>
											)}
											<div className="space-y-4">
												<div>
													<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
														Current Password
													</label>
													<input
														type="password"
														name="currentPassword"
														value={passwordData.currentPassword}
														onChange={handlePasswordChange}
														className="block w-full h-12 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary transition-colors font-body text-gray-700"
														placeholder="Enter your current password"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
														New Password
													</label>
													<input
														type="password"
														name="newPassword"
														value={passwordData.newPassword}
														onChange={handlePasswordChange}
														className="block w-full h-12 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary transition-colors font-body text-gray-700"
														placeholder="Enter your new password"
													/>
													<p className="mt-1 text-sm text-gray-500 font-body">
														Password must be at least 8 characters long
													</p>
												</div>
												<div>
													<label className="block text-sm font-medium text-gray-700 mb-2 font-body">
														Confirm New Password
													</label>
													<input
														type="password"
														name="confirmPassword"
														value={passwordData.confirmPassword}
														onChange={handlePasswordChange}
														className="block w-full h-12 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary transition-colors font-body text-gray-700"
														placeholder="Confirm your new password"
													/>
												</div>
											</div>
											<div className="flex justify-end space-x-3">
												<button
													onClick={handleCancel}
													className="px-6 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors font-body"
													disabled={saving}
												>
													Cancel
												</button>
												<button
													onClick={handlePasswordSave}
													className="px-6 py-3 text-sm font-medium text-white bg-purple-primary hover:bg-purple-600 rounded-lg transition-colors shadow-sm font-body"
													disabled={saving}
												>
													{saving ? "Changing Password..." : "Change Password"}
												</button>
											</div>
										</div>
									) : (
										<div className="space-y-4">
											<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
												<div className="flex items-center space-x-3">
													<ShieldCheckIcon className="h-5 w-5 text-purple-primary" />
													<div>
														<label className="block text-sm font-medium text-gray-500 font-body">
															Password
														</label>
														<p className="mt-2 text-base text-gray-700 font-body">
															••••••••••••
														</p>
													</div>
												</div>
											</div>
											<div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
												<div className="flex items-start space-x-3">
													<ShieldCheckIcon className="h-5 w-5 text-blue-600 mt-0.5" />
													<div>
														<p className="text-sm font-medium text-blue-800 font-body">
															Security Tip
														</p>
														<p className="mt-1 text-sm text-blue-700 font-body">
															Use a strong password with at least 8 characters. Consider using a mix of letters, numbers, and symbols.
														</p>
													</div>
												</div>
											</div>
										</div>
									)}
								</div>
							</div>

							{/* Account Information Card */}
							<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
								<div className="p-6 lg:p-8">
									<div className="flex items-center justify-between mb-6">
										<div className="flex items-center">
											<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3">
												<ClockIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
											</div>
											<div>
												<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
													Account Information
												</h3>
												<p className="text-sm lg:text-base text-purple-primary font-semibold">
													Account timeline & status
												</p>
											</div>
										</div>
									</div>

									<div className="space-y-6">
										<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
											<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
												<div className="flex items-center space-x-3">
													<CalendarIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
													<div className="min-w-0">
														<label className="block text-sm font-medium text-gray-500 font-body">
															Member Since
														</label>
														<p className="mt-1 text-base text-gray-700 font-body truncate">
															{formatDate(profile.createdAt)}
														</p>
													</div>
												</div>
											</div>
											<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
												<div className="flex items-center space-x-3">
													<ClockIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
													<div className="min-w-0">
														<label className="block text-sm font-medium text-gray-500 font-body">
															Last Updated
														</label>
														<p className="mt-1 text-base text-gray-700 font-body truncate">
															{formatDateTime(profile.updatedAt)}
														</p>
													</div>
												</div>
											</div>
											<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
												<div className="flex items-center space-x-3">
													<ClockIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
													<div className="min-w-0">
														<label className="block text-sm font-medium text-gray-500 font-body">
															Last Login
														</label>
														<p className="mt-1 text-base text-gray-700 font-body truncate">
															{profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : "Not available"}
														</p>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</DashboardLayout>
		</>
	);
}
