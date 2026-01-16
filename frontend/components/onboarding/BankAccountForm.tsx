import { useFormik } from "formik";
import * as Yup from "yup";
import { BankInfo } from "@/types/onboarding";
import { 
	BanknotesIcon,
	CreditCardIcon
} from "@heroicons/react/24/outline";

interface BankAccountFormProps {
	initialValues: Partial<BankInfo>;
	onSubmit: (values: BankInfo) => void;
	onBack: () => void;
	onSkip: () => void;
	showBackButton: boolean;
	isLastStep: boolean;
}

const banks = [
	"Maybank",
	"CIMB Bank",
	"Public Bank",
	"RHB Bank",
	"Hong Leong Bank",
	"AmBank",
	"Bank Islam",
	"OCBC Bank",
	"UOB Bank",
	"Standard Chartered",
] as const;

const validationSchema = Yup.object({
	bankName: Yup.string().required("Please select your bank"),
	accountNumber: Yup.string()
		.required("Account number is required")
		.matches(
			/^\d{10,16}$/,
			"Account number must be between 10 and 16 digits"
		),
});

export default function BankAccountForm({
	initialValues,
	onSubmit,
	onBack,
	onSkip,
	showBackButton,
	isLastStep,
}: BankAccountFormProps) {
	const formik = useFormik<BankInfo>({
		initialValues: {
			bankName: initialValues.bankName || "",
			accountNumber: initialValues.accountNumber || "",
		},
		validationSchema,
		onSubmit: (values) => {
			onSubmit(values);
		},
	});

	return (
		<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
			<div className="p-4 sm:p-6 lg:p-8">
				{/* Header */}
				<div className="flex items-center mb-6 lg:mb-8">
					<div className="bg-purple-primary/10 rounded-xl p-3 mr-4">
						<BanknotesIcon className="w-6 h-6 lg:w-7 lg:h-7 text-purple-primary" />
					</div>
					<div>
						<h2 className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-1">
							Bank Account Details
						</h2>
						<p className="text-sm lg:text-base text-purple-primary font-semibold">
							Link your account for loan disbursements
						</p>
					</div>
				</div>

				<form onSubmit={formik.handleSubmit} className="space-y-6">
					{/* Bank Selection */}
					<div>
						<label htmlFor="bankName" className="block text-sm lg:text-base font-medium text-gray-700 mb-2">
							Select Bank <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
								<BanknotesIcon className="h-5 w-5 text-gray-400" />
							</div>
							<select
								id="bankName"
								name="bankName"
								value={formik.values.bankName}
								onChange={formik.handleChange}
								onBlur={formik.handleBlur}
								className={`block w-full pl-11 pr-10 py-3 lg:py-4 border rounded-xl lg:rounded-2xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-transparent transition-all duration-200 text-sm lg:text-base appearance-none ${
									formik.touched.bankName && formik.errors.bankName
										? "border-red-300 focus:ring-red-500"
										: "border-gray-300 hover:border-gray-400"
								}`}
							>
								<option value="">Choose your bank</option>
								{banks.map((bank) => (
									<option key={bank} value={bank}>
										{bank}
									</option>
								))}
							</select>
							{/* Custom dropdown arrow */}
							<div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
								<svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
									<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
								</svg>
							</div>
						</div>
						{formik.touched.bankName && formik.errors.bankName && (
							<p className="mt-2 text-sm text-red-600 font-medium">
								{formik.errors.bankName}
							</p>
						)}
					</div>

					{/* Account Number */}
					<div>
						<label htmlFor="accountNumber" className="block text-sm lg:text-base font-medium text-gray-700 mb-2">
							Account Number <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<CreditCardIcon className="h-5 w-5 text-gray-400" />
							</div>
							<input
								id="accountNumber"
								name="accountNumber"
								type="text"
								value={formik.values.accountNumber}
								onChange={formik.handleChange}
								onBlur={formik.handleBlur}
								placeholder="Enter your account number"
								className={`block w-full pl-10 pr-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl text-gray-900 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-transparent transition-all duration-200 text-sm lg:text-base ${
									formik.touched.accountNumber && formik.errors.accountNumber
										? "border-red-300 focus:ring-red-500"
										: "border-gray-300 hover:border-gray-400"
								}`}
							/>
						</div>
						{formik.touched.accountNumber && formik.errors.accountNumber && (
							<p className="mt-2 text-sm text-red-600 font-medium">
								{formik.errors.accountNumber}
							</p>
						)}
						<p className="mt-2 text-sm text-gray-500">
							Must be between 10 and 16 digits
						</p>
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
								disabled={!formik.isValid}
								className={`w-full sm:flex-1 px-8 py-3 lg:py-4 rounded-xl lg:rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-primary focus:ring-offset-2 transition-all duration-200 text-sm lg:text-base ${
									!formik.isValid
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
