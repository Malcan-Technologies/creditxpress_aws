"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import "react-phone-input-2/lib/style.css";

import {
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
	AcademicCapIcon,
	PencilIcon,
	EyeSlashIcon,
	InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { fetchWithTokenRefresh, checkAuth, TokenStorage } from "@/lib/authUtils";
import { validatePhoneNumber } from "@/lib/phoneUtils";
import EnhancedOTPVerification from "@/components/EnhancedOTPVerification";
import PhoneInput from "react-phone-input-2";
import { 
	validateICOrPassport, 
	extractDOBFromMalaysianIC, 
	formatMalaysianIC,
	getRelationshipOptions,
	validateEmergencyContactPhone 
} from "@/lib/icUtils";
import { checkProfileCompleteness } from "@/lib/profileUtils";
import * as Tooltip from "@radix-ui/react-tooltip";

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
	// Education Information
	educationLevel?: string | null;
	// Demographics
	race?: string | null;
	gender?: string | null;
	occupation?: string | null;
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

const educationLevels = [
	"Primary School",
	"Secondary School (SPM/O-Levels)",
	"Pre-University (STPM/A-Levels/Foundation)",
	"Diploma",
	"Bachelor's Degree",
	"Master's Degree",
	"Doctorate (PhD)",
	"Professional Certification",
	"Vocational Training",
	"Other",
] as const;

export default function ProfilePage() {
	const router = useRouter();
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [documents, setDocuments] = useState<UserDocument[]>([]);
	const [documentsLoading, setDocumentsLoading] = useState(true);

	// Certificate status state
	const [certificateStatus, setCertificateStatus] = useState<{
		loading: boolean;
		hasValidCert: boolean;
		certificateData?: any;
		nameMatches?: boolean;
		expectedName?: string;
	}>({
		loading: false,
		hasValidCert: false
	});

	// Password editing state
	const [isEditingPassword, setIsEditingPassword] = useState(false);
	const [passwordData, setPasswordData] = useState({
		currentPassword: "",
		newPassword: "",
		confirmPassword: ""
	});
	const [showPasswords, setShowPasswords] = useState({
		current: false,
		new: false,
		confirm: false
	});
	const [passwordLoading, setPasswordLoading] = useState(false);
	const [passwordError, setPasswordError] = useState("");

	// Phone change states
	const [isChangingPhone, setIsChangingPhone] = useState(false);
	const [phoneChangeStep, setPhoneChangeStep] = useState<'new-phone' | 'verify-new' | 'success'>('new-phone');
	const [newPhoneNumber, setNewPhoneNumber] = useState("");
	const [phoneChangeToken, setPhoneChangeToken] = useState("");
	const [phoneChangeError, setPhoneChangeError] = useState("");
	const [phoneChangeLoading, setPhoneChangeLoading] = useState(false);

	// Tooltip state
	const [openTooltip, setOpenTooltip] = useState<string | null>(null);

	const handleTooltipClick = (tooltipId: string) => {
		setOpenTooltip(openTooltip === tooltipId ? null : tooltipId);
	};


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


	const fetchCertificateStatus = async () => {
		// Only check certificate if user has IC number
		if (!profile?.icNumber) {
			return;
		}

		try {
			setCertificateStatus(prev => ({ ...prev, loading: true }));

			const certResponse = await fetchWithTokenRefresh(
				`/api/mtsa/cert-info/${profile.icNumber}?t=${Date.now()}`,
				{
					method: "GET",
					cache: "no-store",
				}
			) as any;

			const isSuccess = certResponse.success && certResponse.data?.statusCode === "000";
			const hasValidCert = isSuccess && certResponse.data?.certStatus === "Valid";

			if (hasValidCert && certResponse.data) {
				// Extract name from certificate subject DN
				const subjectDN = certResponse.data.certSubjectDN || "";
				const expectedName = subjectDN
					.split(',')
					.find((part: string) => part.trim().startsWith('CN='))
					?.replace('CN=', '')
					?.trim() || "";

				// Compare names (normalize for comparison)
				const profileName = (profile.fullName || "").toLowerCase().trim();
				const certName = expectedName.toLowerCase().trim();
				const nameMatches = profileName === certName;

				setCertificateStatus({
					loading: false,
					hasValidCert: true,
					certificateData: certResponse.data,
					nameMatches,
					expectedName
				});
			} else {
				setCertificateStatus({
					loading: false,
					hasValidCert: false
				});
			}
		} catch (error) {
			console.error("Error fetching certificate status:", error);
			setCertificateStatus({
				loading: false,
				hasValidCert: false
			});
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

	// Check certificate status when profile is loaded and has required data
	useEffect(() => {
		if (profile?.icNumber && !certificateStatus.loading) {
			fetchCertificateStatus();
		}
	}, [profile?.icNumber]);

	// Refetch profile data when the page becomes visible (e.g., after navigating back)
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden && profile) {
				// Only refetch if we already have profile data (not on initial load)
				fetchProfile();
				fetchDocuments();
				if (profile.icNumber) {
					fetchCertificateStatus();
				}
			}
		};

		const handleFocus = () => {
			if (profile) {
				// Only refetch if we already have profile data (not on initial load)
				fetchProfile();
				fetchDocuments();
				if (profile.icNumber) {
					fetchCertificateStatus();
				}
			}
		};

		// Add storage event listener for cross-tab updates
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === 'profile_updated' && e.newValue) {
				// Profile was updated in another tab/window, refetch
				fetchProfile();
				fetchDocuments();
				if (profile?.icNumber) {
					fetchCertificateStatus();
				}
				// Clear the flag
				localStorage.removeItem('profile_updated');
			}
			
			// Handle mobile profile update redirect
			if (e.key === 'mobile_profile_update' && e.newValue) {
				try {
					const updateData = JSON.parse(e.newValue);
					if (updateData.action === 'redirect_to_profile' && updateData.url) {
						// Clear the flag
						localStorage.removeItem('mobile_profile_update');
						// Redirect to profile page
						router.push(updateData.url);
					}
				} catch (error) {
					console.warn('Failed to parse mobile profile update data:', error);
				}
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



	const profileStatus = checkProfileCompleteness(profile);

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
		// Use the backend loan-applications endpoint directly for documents with applicationId
		// This endpoint streams from S3 and doesn't require cookie-based auth
		const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
		
		if (document.applicationId) {
			// For application-linked documents, use the loan-applications endpoint
			window.open(`${backendUrl}/api/loan-applications/${document.applicationId}/documents/${document.id}`, '_blank');
		} else {
			// For standalone user documents, use the user documents endpoint via Next.js proxy
			// This handles authentication through cookies
			window.open(`/api/users/me/documents/${document.id}`, '_blank');
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


	const handlePasswordChange = async (e: React.FormEvent) => {
		e.preventDefault();
		setPasswordError("");

		// Validation
		if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
			setPasswordError("All password fields are required");
			return;
		}

		// Disallow whitespace anywhere in the new password
		if (/\s/.test(passwordData.newPassword)) {
			setPasswordError("New password cannot contain spaces");
			return;
		}

		// Require at least 8 chars, 1 uppercase, 1 special character
		const hasUppercase = /[A-Z]/.test(passwordData.newPassword);
		const hasSpecial = /[^A-Za-z0-9]/.test(passwordData.newPassword);
		if (passwordData.newPassword.length < 8 || !hasUppercase || !hasSpecial) {
			setPasswordError("New password must be at least 8 characters, include 1 uppercase letter and 1 special character");
			return;
		}

		if (passwordData.newPassword !== passwordData.confirmPassword) {
			setPasswordError("New passwords do not match");
			return;
		}

		if (passwordData.currentPassword === passwordData.newPassword) {
			setPasswordError("New password must be different from current password");
			return;
		}

		try {
			setPasswordLoading(true);

			const response = await fetchWithTokenRefresh(
				"/api/users/me/password",
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						currentPassword: passwordData.currentPassword,
						newPassword: passwordData.newPassword,
					}),
				}
			);

			if (response) {
				// Success
				setIsEditingPassword(false);
				setPasswordData({
					currentPassword: "",
					newPassword: "",
					confirmPassword: ""
				});
				toast.success("Password changed successfully!");
			}
		} catch (error: any) {
			console.error("Error changing password:", error);
			setPasswordError(error.message || "Failed to change password. Please try again.");
		} finally {
			setPasswordLoading(false);
		}
	};

	const cancelPasswordEdit = () => {
		setIsEditingPassword(false);
		setPasswordData({
			currentPassword: "",
			newPassword: "",
			confirmPassword: ""
		});
		setPasswordError("");
		setShowPasswords({
			current: false,
			new: false,
			confirm: false
		});
	};

	const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
		setShowPasswords(prev => ({
			...prev,
			[field]: !prev[field]
		}));
	};

	// Phone change handlers
	const handleStartPhoneChange = () => {
		setIsChangingPhone(true);
		setPhoneChangeStep('new-phone');
		setNewPhoneNumber("");
		setPhoneChangeToken("");
		setPhoneChangeError("");
	};

	const handleCancelPhoneChange = () => {
		setIsChangingPhone(false);
		setPhoneChangeStep('new-phone');
		setNewPhoneNumber("");
		setPhoneChangeToken("");
		setPhoneChangeError("");
	};

	const handleNewPhoneSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setPhoneChangeError("");

		// Validate phone number
		const phoneValidation = validatePhoneNumber(newPhoneNumber, {
			requireMobile: false,
			allowLandline: true
		});

		if (!phoneValidation.isValid) {
			setPhoneChangeError(phoneValidation.error || "Please enter a valid phone number");
			return;
		}

		// Check if it's different from current
		if (newPhoneNumber === profile?.phoneNumber) {
			setPhoneChangeError("New phone number must be different from current");
			return;
		}

		setPhoneChangeLoading(true);

		try {
			const data = await fetchWithTokenRefresh<{ changeToken: string; newPhone: string; message: string }>("/api/users/me/phone/change-request", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ newPhoneNumber }),
			});

			setPhoneChangeToken(data.changeToken);
			setPhoneChangeStep('verify-new');
		} catch (error) {
			setPhoneChangeError(error instanceof Error ? error.message : "Failed to initiate phone change");
		} finally {
			setPhoneChangeLoading(false);
		}
	};

	const handleNewPhoneVerified = (data: any) => {
		setPhoneChangeStep('success');
		
		// Refresh profile data
		fetchProfile();
		
		toast.success("Phone number updated successfully!");
		
		// Auto-close after success
		setTimeout(() => {
			handleCancelPhoneChange();
		}, 3000);
	};

	return (
			<DashboardLayout
				userName={profile?.fullName?.split(" ")[0] || "User"}
				title="Profile"
			>
				<div className="w-full bg-offwhite min-h-screen px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
					<div className="space-y-6">
						{/* Profile Header Card */}
						<div className="bg-purple-50 rounded-xl lg:rounded-2xl shadow-sm  transition-all border border-purple-primary/20 overflow-hidden">
							<div className="p-6 lg:p-8">
								<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
									<div className="flex items-center">
										<div>
											<div className="mb-1">
												<h1 className="text-2xl lg:text-3xl font-heading font-bold text-gray-700">
													{profile?.fullName || "User Profile"}
												</h1>
											</div>
											
											{/* Phone Number Section */}
											<div className="flex items-center space-x-3 mb-3">
												<p className="text-sm lg:text-base text-purple-primary font-semibold">
													{profile?.phoneNumber}
												</p>
												<button
													onClick={handleStartPhoneChange}
													className="text-xs px-3 py-1.5 bg-purple-primary/10 hover:bg-purple-primary/20 text-purple-primary rounded-lg transition-all duration-200 font-medium border border-purple-primary/20 hover:border-purple-primary/30"
												>
													Change
												</button>
											</div>

											{/* Status Bar */}
											<div className="flex flex-wrap items-center gap-2 sm:gap-3">
												{/* Profile Completion Badge */}
												<span
													className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold font-body ${
														profileStatus.isComplete
															? "bg-green-100 text-green-700 border border-green-200"
															: "bg-amber-100 text-amber-700 border border-amber-200"
													}`}
												>
													<span
														className={`h-2 w-2 mr-1.5 rounded-full ${
															profileStatus.isComplete ? "bg-green-500" : "bg-amber-500"
														}`}
													></span>
													{profileStatus.isComplete ? "Profile Complete" : `Profile ${profileStatus.completionPercentage}% Complete`}
												</span>

												{/* Certificate Status Badge */}
												{profile?.icNumber && (
													<span
														className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold font-body ${
															certificateStatus.loading
																? "bg-gray-100 text-gray-600 border border-gray-200"
																: certificateStatus.hasValidCert
																? certificateStatus.nameMatches
																	? "bg-green-100 text-green-700 border border-green-200"
																	: "bg-amber-100 text-amber-700 border border-amber-200"
																: "bg-gray-100 text-gray-600 border border-gray-200"
														}`}
													>
														{certificateStatus.loading ? (
															<>
																<div className="animate-spin rounded-full h-2 w-2 border border-purple-primary border-t-transparent mr-1.5"></div>
																Checking...
															</>
														) : (
															<>
																<span
																	className={`h-2 w-2 mr-1.5 rounded-full ${
																		certificateStatus.hasValidCert
																			? certificateStatus.nameMatches
																				? "bg-green-500"
																				: "bg-amber-500"
																			: "bg-gray-500"
																	}`}
																></span>
																{certificateStatus.hasValidCert
																	? certificateStatus.nameMatches
																		? "Cert Ready"
																		: "Name Mismatch"
																	: "No Certificate"}
															</>
														)}
													</span>
												)}
											</div>
										</div>
									</div>
									<div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
										<div className="flex flex-col space-y-3">
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
                                        <div className="flex items-center gap-3">
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
						</div>

						{/* Personal Details Card - Full Width */}
						<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden">
							<div className="p-6 lg:p-8">
								<div className="flex items-center justify-between mb-6">
									<div className="flex items-center">
										<div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3">
											<UserCircleIcon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" />
										</div>
										<div>
											<h3 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">
												Personal Details
											</h3>
											<p className="text-sm lg:text-base text-purple-primary font-semibold">
												Basic information & contacts
											</p>
										</div>
									</div>
									
								</div>

								{/* Name Mismatch Warning */}
								{certificateStatus.hasValidCert && !certificateStatus.nameMatches && certificateStatus.expectedName && (
									<div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
										<div className="flex items-start space-x-3">
											<svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
												<path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
											</svg>
											<div className="flex-1">
												<h4 className="text-sm font-medium text-amber-800 font-body mb-1">
													Name Mismatch with Digital Certificate
												</h4>
												<p className="text-sm text-amber-700 font-body mb-2">
													Your profile name doesn't match the name on your digital certificate. This may prevent you from using digital signing features.
												</p>
												<div className="text-sm text-amber-700 font-body space-y-1">
													<div><strong>Profile Name:</strong> {profile?.fullName || "Not set"}</div>
													<div><strong>Certificate Name:</strong> {certificateStatus.expectedName}</div>
												</div>
												<p className="text-xs text-amber-600 font-body mt-2">
													Please update your profile name to match your IC exactly, or contact support if this appears to be an error.
												</p>
											</div>
										</div>
									</div>
								)}

							{/* Personal Information Display */}
							<div>
								<h4 className="text-base font-semibold text-gray-700 mb-4 font-heading">Personal Information</h4>
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
									<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
										<div className="flex items-center space-x-3">
											<IdentificationIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
											<div className="min-w-0">
												<label className="block text-sm font-medium text-gray-500 font-body">
													Full Name
												</label>
												<p className="mt-1 text-base text-gray-700 font-body truncate">
													{profile?.fullName || "Not provided"}
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
													{profile?.email || "Not provided"}
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
													{profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : "Not provided"}
												</p>
											</div>
										</div>
									</div>
									<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
										<div className="flex items-center space-x-3">
											<UserCircleIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
											<div className="min-w-0">
												<label className="block text-sm font-medium text-gray-500 font-body">
													Race
												</label>
												<p className="mt-1 text-base text-gray-700 font-body truncate">
													{profile?.race || "Not provided"}
												</p>
											</div>
										</div>
									</div>
									<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
										<div className="flex items-center space-x-3">
											<UserCircleIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
											<div className="min-w-0">
												<label className="block text-sm font-medium text-gray-500 font-body">
													Gender
												</label>
												<p className="mt-1 text-base text-gray-700 font-body truncate">
													{profile?.gender || "Not provided"}
												</p>
											</div>
										</div>
									</div>
									<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
										<div className="flex items-center space-x-3">
											<AcademicCapIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
											<div className="min-w-0">
												<label className="block text-sm font-medium text-gray-500 font-body">
													Education Level
												</label>
												<p className="mt-1 text-base text-gray-700 font-body truncate">
													{profile?.educationLevel || "Not provided"}
												</p>
											</div>
										</div>
									</div>
								</div>
							</div>

								{/* IC/Passport Display */}
								<div className="pt-6">
									<h4 className="text-base font-semibold text-gray-700 mb-4 font-heading">Digital Identity</h4>
									<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
										{/* IC/Passport Information */}
										<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
											<div className="flex items-center space-x-3">
												<IdentificationIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
												<div className="min-w-0 flex-1">
													<label className="block text-sm font-medium text-gray-500 font-body">
														IC Number
													</label>
													<div className="mt-1 space-y-1">
														{profile?.icNumber ? (
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

										{/* Digital Certificate Information */}
										<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
											<div className="flex items-center space-x-3">
												<ShieldCheckIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-1">
														<label className="block text-sm font-medium text-gray-500 font-body">
															Signing Certificate
														</label>
														<Tooltip.Provider>
															<Tooltip.Root
																open={openTooltip === "signing-certificate"}
																onOpenChange={() => handleTooltipClick("signing-certificate")}
															>
																<Tooltip.Trigger asChild>
																	<InformationCircleIcon
																		className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
																		onClick={() => handleTooltipClick("signing-certificate")}
																	/>
																</Tooltip.Trigger>
																<Tooltip.Portal>
																	<Tooltip.Content
																		className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm max-w-xs z-50"
																		sideOffset={5}
																	>
																		A digital certificate obtained after completing KYC verification. This certificate allows you to digitally sign loan agreements and other documents securely.
																		<Tooltip.Arrow className="fill-gray-800" />
																	</Tooltip.Content>
																</Tooltip.Portal>
															</Tooltip.Root>
														</Tooltip.Provider>
													</div>
													<div className="mt-1 space-y-1">
														{profile?.icNumber && certificateStatus.hasValidCert && certificateStatus.certificateData ? (
															<>
																<p className="text-base text-gray-700 font-body">
																	{certificateStatus.certificateData.certSerialNo?.slice(-8) || 'Available'}
																</p>
																<p className="text-sm text-green-600 font-body">
																	Valid until {certificateStatus.certificateData.certValidTo}
																</p>
																{!certificateStatus.nameMatches && (
																	<p className="text-xs text-amber-600 font-body">
																		Name verification required
																	</p>
																)}
															</>
														) : profile?.icNumber ? (
															certificateStatus.loading ? (
																<p className="text-base text-gray-500 font-body italic">
																	Checking certificate...
																</p>
															) : (
																<p className="text-base text-gray-500 font-body italic">
																	No certificate
																</p>
															)
														) : (
															<p className="text-base text-gray-500 font-body italic">
																IC required
															</p>
														)}
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>

								{/* Emergency Contact Display */}
								<div className="pt-6">
									<h4 className="text-base font-semibold text-gray-700 mb-4 font-heading">Emergency Contact</h4>
									<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
										<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
											<div className="flex items-center space-x-3">
												<UserCircleIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
												<div className="min-w-0">
													<label className="block text-sm font-medium text-gray-500 font-body">
														Name
													</label>
													<p className="mt-1 text-base text-gray-700 font-body truncate">
														{profile?.emergencyContactName || "Not provided"}
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
														{profile?.emergencyContactPhone || "Not provided"}
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
														{profile?.emergencyContactRelationship || "Not provided"}
													</p>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Address Card - Full Width */}
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
									
								</div>

								{/* Address Display */}
								<div className="space-y-4">
									<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
										<div className="flex items-start space-x-3">
											<MapPinIcon className="h-5 w-5 text-purple-primary flex-shrink-0 mt-0.5" />
											<div className="min-w-0 flex-1">
												<label className="block text-sm font-medium text-gray-500 font-body">
													Complete Address
												</label>
												<div className="mt-1 space-y-1">
													{profile?.address1 && (
														<p className="text-base text-gray-700 font-body">
															{profile.address1}
														</p>
													)}
													{profile?.address2 && (
														<p className="text-base text-gray-700 font-body">
															{profile.address2}
														</p>
													)}
													{(profile?.city || profile?.state || profile?.zipCode) && (
														<p className="text-base text-gray-700 font-body">
															{[profile.city, profile.state, profile.zipCode].filter(Boolean).join(", ")}
														</p>
													)}
													{!profile?.address1 && !profile?.address2 && !profile?.city && (
														<p className="text-base text-gray-500 font-body italic">
															Address not provided
														</p>
													)}
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Employment and Banking Information */}
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
										
									</div>

								{/* Employment Information Display */}
								<div className="space-y-4">
									<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
										<div className="bg-gray-50 p-4 lg:p-5 rounded-lg border border-gray-200">
											<div className="flex items-center space-x-3">
												<BriefcaseIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
												<div className="min-w-0">
													<label className="block text-sm font-medium text-gray-500 font-body">
														Occupation
													</label>
													<p className="mt-1 text-base text-gray-700 font-body truncate">
														{profile?.occupation || "Not provided"}
													</p>
												</div>
											</div>
										</div>
										<div className="bg-gray-50 p-4 lg:p-5 rounded-lg border border-gray-200">
											<div className="flex items-center space-x-3">
												<BriefcaseIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
												<div className="min-w-0">
													<label className="block text-sm font-medium text-gray-500 font-body">
														Employment Status
													</label>
													<p className="mt-1 text-base text-gray-700 font-body truncate">
														{profile?.employmentStatus || "Not provided"}
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
														{profile?.employerName || "Not provided"}
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
														{profile?.serviceLength ? `${profile.serviceLength} years` : "Not provided"}
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
														{profile?.monthlyIncome ? `RM ${Number(profile.monthlyIncome).toLocaleString()}` : "Not provided"}
													</p>
												</div>
											</div>
										</div>
									</div>
								</div>
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
										
									</div>

									{/* Banking Information Display */}
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
															{profile?.bankName || "Not provided"}
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
															{profile?.accountNumber ? "••••" + profile.accountNumber.slice(-4) : "Not provided"}
														</p>
													</div>
												</div>
											</div>
										</div>
									</div>
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
										{!isEditingPassword && (
											<button
												onClick={() => setIsEditingPassword(true)}
												className="hidden lg:flex items-center px-4 py-2 bg-purple-primary text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2 transition-all duration-200 text-sm font-medium"
											>
												<PencilIcon className="w-4 h-4 mr-2" />
												Change Password
											</button>
										)}
									</div>

									{/* Password & Security Content */}
									{!isEditingPassword ? (
										<div className="space-y-4">
											<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
												<div className="flex items-center space-x-3">
													<ShieldCheckIcon className="h-5 w-5 text-purple-primary" />
													<div>
														<label className="block text-sm font-medium text-gray-500 font-body">
															Password
														</label>
																											<p className="mt-2 text-base text-gray-900 font-body font-medium tracking-wider">
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
											{/* Mobile Change Password Button */}
											<div className="border-t border-gray-100 pt-4 lg:hidden">
												<button
													onClick={() => setIsEditingPassword(true)}
													className="w-full flex items-center justify-center px-4 py-2 bg-purple-primary text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2 transition-all duration-200 text-sm font-medium"
												>
													<PencilIcon className="w-4 h-4 mr-2" />
													Change Password
												</button>
											</div>
										</div>
									) : (
										<form onSubmit={handlePasswordChange} className="space-y-4">
											{passwordError && (
												<div className="bg-red-50 border border-red-200 rounded-lg p-3">
													<p className="text-sm text-red-700 font-body">
														{passwordError}
													</p>
												</div>
											)}
											
											{/* Current Password */}
											<div className="space-y-2">
												<label className="block text-sm font-medium text-gray-700 font-body">
													Current Password
												</label>
												<div className="relative">
													<input
														type={showPasswords.current ? "text" : "password"}
														value={passwordData.currentPassword}
														onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
														className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-purple-primary font-body text-gray-900 tracking-wide placeholder-gray-400"
														placeholder="Enter current password"
														required
													/>
													<button
														type="button"
														onClick={() => togglePasswordVisibility('current')}
														className="absolute inset-y-0 right-0 pr-3 flex items-center"
													>
														{showPasswords.current ? (
															<EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
														) : (
															<EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
														)}
													</button>
												</div>
											</div>

											{/* New Password */}
											<div className="space-y-2">
												<label className="block text-sm font-medium text-gray-700 font-body">
													New Password
												</label>
												<div className="relative">
													<input
														type={showPasswords.new ? "text" : "password"}
														value={passwordData.newPassword}
														onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
														className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-purple-primary font-body text-gray-900 tracking-wide placeholder-gray-400"
														placeholder="Enter new password (min 8 characters)"
														required
														minLength={8}
													/>
													<button
														type="button"
														onClick={() => togglePasswordVisibility('new')}
														className="absolute inset-y-0 right-0 pr-3 flex items-center"
													>
														{showPasswords.new ? (
															<EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
														) : (
															<EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
														)}
													</button>
												</div>
											</div>

											{/* Confirm New Password */}
											<div className="space-y-2">
												<label className="block text-sm font-medium text-gray-700 font-body">
													Confirm New Password
												</label>
												<div className="relative">
													<input
														type={showPasswords.confirm ? "text" : "password"}
														value={passwordData.confirmPassword}
														onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
														className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-purple-primary font-body text-gray-900 tracking-wide placeholder-gray-400"
														placeholder="Confirm new password"
														required
													/>
													<button
														type="button"
														onClick={() => togglePasswordVisibility('confirm')}
														className="absolute inset-y-0 right-0 pr-3 flex items-center"
													>
														{showPasswords.confirm ? (
															<EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
														) : (
															<EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
														)}
													</button>
												</div>
											</div>

											{/* Action Buttons */}
											<div className="flex flex-col sm:flex-row gap-3 pt-4">
												<button
													type="submit"
													disabled={passwordLoading}
													className="flex-1 sm:flex-none flex items-center justify-center px-6 py-2 bg-purple-primary text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
												>
													{passwordLoading ? (
														<>
															<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
															Changing...
														</>
													) : (
														<>
															<ShieldCheckIcon className="w-4 h-4 mr-2" />
															Change Password
														</>
													)}
												</button>
												<button
													type="button"
													onClick={cancelPasswordEdit}
													disabled={passwordLoading}
													className="flex-1 sm:flex-none px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
												>
													Cancel
												</button>
											</div>
										</form>
									)}
								</div>
							</div>


						</div>
					</div>
				</div>

				{/* Phone Change Modal */}
				{isChangingPhone && (
					<div 
						className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
						onClick={(e) => {
							if (e.target === e.currentTarget) {
								handleCancelPhoneChange();
							}
						}}
					>
						<div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-100 relative">
							{phoneChangeStep === 'new-phone' && (
								<div className="p-8">
									<div className="flex items-center justify-between mb-8">
										<div className="flex items-center space-x-3">
											<div className="w-10 h-10 bg-purple-primary/10 rounded-xl flex items-center justify-center">
												<PhoneIcon className="w-5 h-5 text-purple-primary" />
											</div>
											<h3 className="text-xl font-heading font-bold text-gray-700">
												Change Phone Number
											</h3>
										</div>
										<button
											onClick={handleCancelPhoneChange}
											className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
										>
											<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>

									<div className="space-y-6">
										<div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
											<div className="flex items-start space-x-3">
												<div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
													<PhoneIcon className="w-4 h-4 text-blue-600" />
												</div>
																							<div>
												<p className="text-sm font-medium text-blue-800 font-body mb-1">
													Current phone: {profile?.phoneNumber}
												</p>
												<p className="text-sm text-blue-700 font-body">
													You'll need to verify your new phone number to complete the change.
												</p>
											</div>
											</div>
										</div>

										<form onSubmit={handleNewPhoneSubmit} className="space-y-6">
											<div className="space-y-3">
												<label className="block text-sm font-medium text-gray-700 font-body">
													New Phone Number
												</label>
												<div className="relative">
													<PhoneInput
														country="my"
														value={newPhoneNumber}
														onChange={(value) => {
															setNewPhoneNumber(value);
															if (phoneChangeError) setPhoneChangeError("");
														}}
														inputProps={{
															required: true,
															placeholder: "12 345 6789",
														}}
														containerClass="!w-full !relative"
														inputClass="!w-full !h-12 !pl-16 !pr-4 !py-3 !text-base !font-body !bg-white !border !border-gray-300 !text-gray-900 !placeholder-gray-400 hover:!border-purple-primary focus:!border-purple-primary focus:!ring-2 focus:!ring-purple-primary/20 !transition-all !rounded-xl !outline-none"
														buttonClass="!h-12 !w-14 !border !border-gray-300 !bg-white hover:!bg-gray-50 !text-gray-700 !transition-colors !border-r-0 !rounded-l-xl !absolute !left-0 !top-0 !z-10"
														dropdownClass="!bg-white !border !border-gray-300 !text-gray-900 !shadow-2xl !rounded-xl !mt-2 !max-h-60 !overflow-y-auto !min-w-80 !z-50"
														enableSearch
														disableSearchIcon
														searchPlaceholder="Search country..."
														searchClass="!px-3 !py-2 !border-b !border-gray-200 !text-sm"
													/>
												</div>
												{phoneChangeError && (
													<div className="bg-red-50 border border-red-200 rounded-lg p-3">
														<p className="text-sm text-red-700 font-body">
															{phoneChangeError}
														</p>
													</div>
												)}
											</div>

											<div className="flex space-x-4 pt-6 border-t border-gray-100">
												<button
													type="button"
													onClick={handleCancelPhoneChange}
													className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200 text-sm font-medium"
												>
													Cancel
												</button>
												<button
													type="submit"
													disabled={phoneChangeLoading}
													className="flex-1 px-6 py-3 bg-purple-primary text-white rounded-xl hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium"
												>
													{phoneChangeLoading ? (
														<div className="flex items-center justify-center">
															<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
															Starting...
														</div>
													) : (
														"Continue"
													)}
												</button>
											</div>
										</form>
									</div>
								</div>
							)}

							{phoneChangeStep === 'verify-new' && (
								<div className="p-8">
									<div className="flex items-center justify-between mb-8">
										<div className="flex items-center space-x-3">
											<div className="w-10 h-10 bg-purple-primary/10 rounded-xl flex items-center justify-center">
												<ShieldCheckIcon className="w-5 h-5 text-purple-primary" />
											</div>
											<h3 className="text-xl font-heading font-bold text-gray-700">
												Verify New Phone
											</h3>
										</div>
										<button
											onClick={handleCancelPhoneChange}
											className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
										>
											<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>

									<div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
										<div className="flex items-start space-x-3">
											<div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
												<PhoneIcon className="w-4 h-4 text-blue-600" />
											</div>
											<div>
												<p className="text-sm font-medium text-blue-800 font-body mb-1">
													Verifying: {newPhoneNumber}
												</p>
												<p className="text-sm text-blue-700 font-body">
													Please enter the verification code sent to your new phone number.
												</p>
											</div>
										</div>
									</div>

									<EnhancedOTPVerification
										phoneNumber={newPhoneNumber}
										purpose="phone-change-new"
										changeToken={phoneChangeToken}
										onVerificationSuccess={handleNewPhoneVerified}
										onBack={() => setPhoneChangeStep('new-phone')}
									/>
								</div>
							)}

							{phoneChangeStep === 'success' && (
								<div className="p-8">
									<div className="text-center">
										<div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
											<svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
											</svg>
										</div>
										<h3 className="text-2xl font-heading font-bold text-gray-700 mb-3">
											Phone Number Updated!
										</h3>
										<p className="text-base text-gray-600 font-body mb-6">
											Your phone number has been successfully changed.
										</p>
										<div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
											<div className="flex items-center justify-center space-x-2 text-sm text-green-700 font-body">
												<div className="w-4 h-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent"></div>
												<span>Closing automatically in 3 seconds...</span>
											</div>
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				)}

			</DashboardLayout>
	);
}
