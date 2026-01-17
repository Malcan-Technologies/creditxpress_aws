import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchWithTokenRefresh } from "@/lib/authUtils";
import { 
	UserIcon, 
	PhoneIcon, 
	EnvelopeIcon, 
	BriefcaseIcon,
	BuildingOfficeIcon,
	CurrencyDollarIcon,
	ClockIcon,
	HomeIcon,
	MapPinIcon
} from "@heroicons/react/24/outline";

interface PersonalInfoFormProps {
	onSubmit: (values: any) => void;
	onBack: () => void;
			userData: {
		fullName: string;
		email: string;
		phoneNumber: string;
		employmentStatus: string;
		employerName?: string;
		monthlyIncome: string;
		serviceLength?: string;
		race?: string;
		gender?: string;
		occupation?: string;
		address1: string;
		address2?: string;
		city: string;
		state: string;
		postalCode: string;
		zipCode?: string;
	};
}

export default function PersonalInfoForm({
	onSubmit,
	onBack,
	userData,
}: PersonalInfoFormProps) {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [userInfo, setUserInfo] = useState(userData);

	useEffect(() => {
		const fetchUserData = async () => {
			try {
				setLoading(true);
				setError(null);

				const data = await fetchWithTokenRefresh("/api/users/me") as any;
				
				// Map the user data to match the expected format
				const mappedData = {
					fullName: data.fullName || "",
					email: data.email || "",
					phoneNumber: data.phoneNumber || "",
					employmentStatus: data.employmentStatus || "",
					employerName: data.employerName || "",
					monthlyIncome: data.monthlyIncome || "",
					serviceLength: data.serviceLength || "",
					race: data.race || "",
					gender: data.gender || "",
					occupation: data.occupation || "",
					address1: data.address1 || "",
					address2: data.address2 || "",
					city: data.city || "",
					state: data.state || "",
					postalCode: data.zipCode || data.postalCode || "",
				};

				setUserInfo(mappedData);
			} catch (err) {
				console.error("Error fetching user data:", err);
				setError("Failed to load user information. Please try again.");
			} finally {
				setLoading(false);
			}
		};

		fetchUserData();
	}, []);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit(userInfo);
	};

	const handleBack = () => {
		onBack();
	};

	if (loading) {
		return (
			<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
				<div className="p-4 sm:p-6 lg:p-8">
					<div className="flex justify-center items-center min-h-[200px]">
						<div className="flex flex-col items-center space-y-4">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary"></div>
							<p className="text-gray-700 font-body">Loading your information...</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
				<div className="p-4 sm:p-6 lg:p-8">
					<div className="flex items-center space-x-2 mb-6">
						<div className="p-2 bg-purple-primary/10 rounded-lg border border-purple-primary/20">
							<UserIcon className="h-5 w-5 text-purple-primary" />
						</div>
						<h2 className="text-lg font-heading text-purple-primary font-semibold">
							Personal Information
						</h2>
					</div>
					<div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
						<p className="text-red-600 font-body">{error}</p>
					</div>
					<div className="flex justify-between pt-6">
						<button
							type="button"
							onClick={handleBack}
							className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium font-body"
						>
							Back
						</button>
						<button
							onClick={() => window.location.reload()}
							className="px-6 py-3 bg-purple-primary text-white rounded-xl hover:bg-purple-700 transition-all duration-200 font-medium font-body"
						>
							Retry
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
			<div className="p-4 sm:p-6 lg:p-8">
				{/* Header */}
				<div className="flex items-center space-x-2 mb-6 lg:mb-8">
					<div className="p-2 bg-purple-primary/10 rounded-lg border border-purple-primary/20">
						<UserIcon className="h-5 w-5 text-purple-primary" />
					</div>
					<h2 className="text-lg lg:text-xl font-heading text-purple-primary font-semibold">
						Personal Information Verification
					</h2>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6">
					{/* Personal Details Section */}
					<div className="space-y-6">
						<div className="border-b border-gray-200 pb-4">
							<h3 className="text-base lg:text-lg font-heading font-semibold text-gray-700 mb-4">
								Personal Details
							</h3>
						</div>

						{/* Full Name */}
						<div className="bg-gray-50 rounded-xl p-4 lg:p-6">
							<div className="flex items-center space-x-3 mb-2">
								<UserIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
								<label className="text-sm lg:text-base font-medium text-gray-700 font-body">
									Full Name
								</label>
							</div>
							<p className="text-base lg:text-lg text-gray-900 font-body ml-8">
								{userInfo.fullName || "Not provided"}
							</p>
						</div>

						{/* Contact Information */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
							<div className="bg-gray-50 rounded-xl p-4 lg:p-6">
								<div className="flex items-center space-x-3 mb-2">
									<PhoneIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
									<label className="text-sm lg:text-base font-medium text-gray-700 font-body">
										Phone Number
									</label>
								</div>
								<p className="text-base lg:text-lg text-gray-900 font-body ml-8">
									{userInfo.phoneNumber || "Not provided"}
								</p>
							</div>

						<div className="bg-gray-50 rounded-xl p-4 lg:p-6">
							<div className="flex items-center space-x-3 mb-2">
								<EnvelopeIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
								<label className="text-sm lg:text-base font-medium text-gray-700 font-body">
									Email Address
								</label>
							</div>
							<p className="text-base lg:text-lg text-gray-900 font-body ml-8">
								{userInfo.email || "Not provided"}
							</p>
						</div>
					</div>

					{/* Race and Gender */}
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
						<div className="bg-gray-50 rounded-xl p-4 lg:p-6">
							<div className="flex items-center space-x-3 mb-2">
								<UserIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
								<label className="text-sm lg:text-base font-medium text-gray-700 font-body">
									Race
								</label>
							</div>
							<p className="text-base lg:text-lg text-gray-900 font-body ml-8">
								{userInfo.race || "Not provided"}
							</p>
						</div>

						<div className="bg-gray-50 rounded-xl p-4 lg:p-6">
							<div className="flex items-center space-x-3 mb-2">
								<UserIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
								<label className="text-sm lg:text-base font-medium text-gray-700 font-body">
									Gender
								</label>
							</div>
							<p className="text-base lg:text-lg text-gray-900 font-body ml-8">
								{userInfo.gender || "Not provided"}
							</p>
						</div>
					</div>
				</div>

				{/* Employment Information Section */}
					<div className="space-y-6">
						<div className="border-b border-gray-200 pb-4">
							<h3 className="text-base lg:text-lg font-heading font-semibold text-gray-700 mb-4">
								Employment Information
							</h3>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4 lg:gap-6">
							<div className="bg-gray-50 rounded-xl p-4 lg:p-6">
								<div className="flex items-center space-x-3 mb-2">
									<BriefcaseIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
									<label className="text-sm lg:text-base font-medium text-gray-700 font-body">
										Occupation
									</label>
								</div>
								<p className="text-base lg:text-lg text-gray-900 font-body ml-8">
									{userInfo.occupation || "Not provided"}
								</p>
							</div>

							<div className="bg-gray-50 rounded-xl p-4 lg:p-6">
								<div className="flex items-center space-x-3 mb-2">
									<BriefcaseIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
									<label className="text-sm lg:text-base font-medium text-gray-700 font-body">
										Employment Status
									</label>
								</div>
								<p className="text-base lg:text-lg text-gray-900 font-body ml-8">
									{userInfo.employmentStatus || "Not provided"}
								</p>
							</div>

							<div className="bg-gray-50 rounded-xl p-4 lg:p-6">
								<div className="flex items-center space-x-3 mb-2">
									<BuildingOfficeIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
									<label className="text-sm lg:text-base font-medium text-gray-700 font-body">
										Employer Name
									</label>
								</div>
								<p className="text-base lg:text-lg text-gray-900 font-body ml-8">
									{userInfo.employerName || "Not provided"}
								</p>
							</div>

							<div className="bg-gray-50 rounded-xl p-4 lg:p-6">
								<div className="flex items-center space-x-3 mb-2">
									<ClockIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
									<label className="text-sm lg:text-base font-medium text-gray-700 font-body">
										Service Length
									</label>
								</div>
								<p className="text-base lg:text-lg text-gray-900 font-body ml-8">
									{userInfo.serviceLength ? `${userInfo.serviceLength} years` : "Not provided"}
								</p>
							</div>

							<div className="bg-gray-50 rounded-xl p-4 lg:p-6">
								<div className="flex items-center space-x-3 mb-2">
									<CurrencyDollarIcon className="h-5 w-5 text-purple-primary flex-shrink-0" />
									<label className="text-sm lg:text-base font-medium text-gray-700 font-body">
										Monthly Income
									</label>
								</div>
								<p className="text-base lg:text-lg text-gray-900 font-body ml-8">
									{userInfo.monthlyIncome ? `RM ${Number(userInfo.monthlyIncome).toLocaleString()}` : "Not provided"}
								</p>
							</div>
						</div>
					</div>

					{/* Address Information Section */}
					<div className="space-y-6">
						<div className="border-b border-gray-200 pb-4">
							<h3 className="text-base lg:text-lg font-heading font-semibold text-gray-700 mb-4">
								Address Information
							</h3>
						</div>

						<div className="bg-gray-50 rounded-xl p-4 lg:p-6">
							<div className="flex items-start space-x-3 mb-2">
								<MapPinIcon className="h-5 w-5 text-purple-primary flex-shrink-0 mt-0.5" />
								<div className="flex-1">
									<label className="text-sm lg:text-base font-medium text-gray-700 font-body mb-2 block">
										Complete Address
									</label>
									<div className="ml-5 space-y-1">
										{userInfo.address1 && (
											<p className="text-base lg:text-lg text-gray-900 font-body">
												{userInfo.address1}
											</p>
										)}
										{userInfo.address2 && (
											<p className="text-base lg:text-lg text-gray-900 font-body">
												{userInfo.address2}
											</p>
										)}
										{(userInfo.city || userInfo.state || userInfo.postalCode) && (
											<p className="text-base lg:text-lg text-gray-900 font-body">
												{[userInfo.city, userInfo.state, userInfo.postalCode].filter(Boolean).join(", ")}
											</p>
										)}
										{!userInfo.address1 && !userInfo.city && (
											<p className="text-base lg:text-lg text-gray-500 font-body italic">
												Address not provided
											</p>
										)}
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Info Notice */}
					<div className="bg-blue-50 border border-blue-200 rounded-xl p-4 lg:p-6">
						<div className="flex items-start space-x-3">
							<UserIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
							<div>
								<p className="text-sm lg:text-base font-medium text-blue-800 font-body mb-1">
									Information Verification
								</p>
								<p className="text-sm lg:text-base text-blue-700 font-body">
									Please verify that the information above is accurate. If you need to update any details, 
									you can do so in your profile settings after completing this application.
								</p>
							</div>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="border-t border-gray-100 pt-6 lg:pt-8">
						<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
							<button
								type="button"
								onClick={handleBack}
								className="w-full sm:w-auto px-6 py-3 lg:py-4 border border-gray-300 rounded-xl lg:rounded-2xl text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2 transition-all duration-200 text-sm lg:text-base font-body"
							>
								Back
							</button>
							<button
								type="submit"
								className="w-full sm:w-auto px-8 py-3 lg:py-4 bg-purple-primary text-white rounded-xl lg:rounded-2xl font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl text-sm lg:text-base font-body"
							>
								Continue
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
} 