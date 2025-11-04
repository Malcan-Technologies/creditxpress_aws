import { useFormik } from "formik";
import * as Yup from "yup";
import { AddressInfo } from "@/types/onboarding";
import { 
	HomeIcon,
	MapPinIcon,
	BuildingOfficeIcon,
	EnvelopeIcon
} from "@heroicons/react/24/outline";

interface AddressFormProps {
	initialValues: Partial<AddressInfo>;
	onSubmit: (values: AddressInfo) => void;
	onBack: () => void;
	showBackButton: boolean;
	isLastStep: boolean;
}

const validationSchema = Yup.object({
	address1: Yup.string().required("Address line 1 is required"),
	address2: Yup.string(),
	city: Yup.string().required("City is required"),
	state: Yup.string().required("State is required"),
	postalCode: Yup.string()
		.required("Postal code is required")
		.matches(/^\d{5}$/, "Postal code must be 5 digits"),
});

export default function AddressForm({
	initialValues,
	onSubmit,
	onBack,
	showBackButton,
	isLastStep,
}: AddressFormProps) {
	const formik = useFormik<AddressInfo>({
		initialValues: {
			address1: initialValues.address1 || "",
			address2: initialValues.address2 || "",
			city: initialValues.city || "",
			state: initialValues.state || "",
			postalCode: initialValues.postalCode || "",
		},
		validationSchema,
		onSubmit: (values) => {
			onSubmit(values);
		},
	});

	// Check if mandatory fields are completed
	const isFormValid =
		formik.values.address1.trim() !== "" &&
		formik.values.city.trim() !== "" &&
		formik.values.state.trim() !== "" &&
		formik.values.postalCode.trim() !== "" &&
		!/^\d{5}$/.test(formik.values.postalCode) === false;

	return (
		<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
			<div className="p-4 sm:p-6 lg:p-8">
				{/* Header */}
				<div className="flex items-center mb-6 lg:mb-8">
					<div className="bg-purple-primary/10 rounded-xl p-3 mr-4">
						<HomeIcon className="w-6 h-6 lg:w-7 lg:h-7 text-purple-primary" />
					</div>
					<div>
						<h2 className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-1">
							Residential Address
						</h2>
						<p className="text-sm lg:text-base text-purple-primary font-semibold">
							Where do you currently live?
						</p>
					</div>
				</div>

				<form onSubmit={formik.handleSubmit} className="space-y-6">
					{/* Address Line 1 */}
					<div>
						<label htmlFor="address1" className="block text-sm lg:text-base font-medium text-gray-700 mb-2">
							Address Line 1 <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<MapPinIcon className="h-5 w-5 text-gray-400" />
							</div>
							<input
								id="address1"
								name="address1"
								type="text"
								value={formik.values.address1}
								onChange={formik.handleChange}
								onBlur={formik.handleBlur}
								placeholder="Enter your street address"
								className={`block w-full pl-10 pr-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl text-gray-900 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-transparent transition-all duration-200 text-sm lg:text-base ${
									formik.touched.address1 && formik.errors.address1
										? "border-red-300 focus:ring-red-500"
										: "border-gray-300 hover:border-gray-400"
								}`}
							/>
						</div>
						{formik.touched.address1 && formik.errors.address1 && (
							<p className="mt-2 text-sm text-red-600 font-medium">
								{formik.errors.address1}
							</p>
						)}
					</div>

					{/* Address Line 2 */}
					<div>
						<label htmlFor="address2" className="block text-sm lg:text-base font-medium text-gray-700 mb-2">
							Address Line 2 <span className="text-gray-400 font-normal">(Optional)</span>
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
							</div>
							<input
								id="address2"
								name="address2"
								type="text"
								value={formik.values.address2}
								onChange={formik.handleChange}
								onBlur={formik.handleBlur}
								placeholder="Apartment, suite, unit, etc."
								className="block w-full pl-10 pr-3 py-3 lg:py-4 border border-gray-300 rounded-xl lg:rounded-2xl text-gray-900 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-transparent hover:border-gray-400 transition-all duration-200 text-sm lg:text-base"
							/>
						</div>
					</div>

					{/* City and State Row */}
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
						{/* City */}
						<div>
							<label htmlFor="city" className="block text-sm lg:text-base font-medium text-gray-700 mb-2">
								City <span className="text-red-500">*</span>
							</label>
							<input
								id="city"
								name="city"
								type="text"
								value={formik.values.city}
								onChange={formik.handleChange}
								onBlur={formik.handleBlur}
								placeholder="Enter city"
								className={`block w-full px-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl text-gray-900 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-transparent transition-all duration-200 text-sm lg:text-base ${
									formik.touched.city && formik.errors.city
										? "border-red-300 focus:ring-red-500"
										: "border-gray-300 hover:border-gray-400"
								}`}
							/>
							{formik.touched.city && formik.errors.city && (
								<p className="mt-2 text-sm text-red-600 font-medium">
									{formik.errors.city}
								</p>
							)}
						</div>

						{/* State */}
						<div>
							<label htmlFor="state" className="block text-sm lg:text-base font-medium text-gray-700 mb-2">
								State <span className="text-red-500">*</span>
							</label>
							<select
								id="state"
								name="state"
								value={formik.values.state}
								onChange={formik.handleChange}
								onBlur={formik.handleBlur}
								className={`block w-full px-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-transparent transition-all duration-200 text-sm lg:text-base ${
									formik.touched.state && formik.errors.state
										? "border-red-300 focus:ring-red-500"
										: "border-gray-300 hover:border-gray-400"
								}`}
							>
								<option value="">Select state</option>
								<option value="Johor">Johor</option>
								<option value="Kedah">Kedah</option>
								<option value="Kelantan">Kelantan</option>
								<option value="Kuala Lumpur">Kuala Lumpur</option>
								<option value="Labuan">Labuan</option>
								<option value="Malacca">Malacca</option>
								<option value="Negeri Sembilan">Negeri Sembilan</option>
								<option value="Pahang">Pahang</option>
								<option value="Penang">Penang</option>
								<option value="Perak">Perak</option>
								<option value="Perlis">Perlis</option>
								<option value="Putrajaya">Putrajaya</option>
								<option value="Sabah">Sabah</option>
								<option value="Sarawak">Sarawak</option>
								<option value="Selangor">Selangor</option>
								<option value="Terengganu">Terengganu</option>
							</select>
							{formik.touched.state && formik.errors.state && (
								<p className="mt-2 text-sm text-red-600 font-medium">
									{formik.errors.state}
								</p>
							)}
						</div>
					</div>

					{/* Postal Code */}
					<div>
						<label htmlFor="postalCode" className="block text-sm lg:text-base font-medium text-gray-700 mb-2">
							Postal Code <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<EnvelopeIcon className="h-5 w-5 text-gray-400" />
							</div>
							<input
								id="postalCode"
								name="postalCode"
								type="text"
								value={formik.values.postalCode}
								onChange={formik.handleChange}
								onBlur={formik.handleBlur}
								placeholder="12345"
								maxLength={5}
								className={`block w-full pl-10 pr-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl text-gray-900 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-transparent transition-all duration-200 text-sm lg:text-base ${
									formik.touched.postalCode && formik.errors.postalCode
										? "border-red-300 focus:ring-red-500"
										: "border-gray-300 hover:border-gray-400"
								}`}
							/>
						</div>
						{formik.touched.postalCode && formik.errors.postalCode && (
							<p className="mt-2 text-sm text-red-600 font-medium">
								{formik.errors.postalCode}
							</p>
						)}
					</div>

					{/* Navigation buttons */}
					<div className="border-t border-gray-100 pt-6 lg:pt-8">
						<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
							{showBackButton && (
								<button
									type="button"
									onClick={onBack}
									className="w-full sm:w-auto px-6 py-3 lg:py-4 border border-gray-300 rounded-xl lg:rounded-2xl text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2 transition-all duration-200 text-sm lg:text-base"
								>
									Back
								</button>
							)}
							<button
								type="submit"
								disabled={!isFormValid}
								className={`w-full sm:w-auto px-8 py-3 lg:py-4 rounded-xl lg:rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2 transition-all duration-200 text-sm lg:text-base ${
									!isFormValid
										? "bg-gray-300 text-gray-500 cursor-not-allowed"
										: "bg-purple-primary text-white hover:bg-purple-700 shadow-lg hover:shadow-xl"
								}`}
							>
								{isLastStep ? "Complete Profile" : "Continue"}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
