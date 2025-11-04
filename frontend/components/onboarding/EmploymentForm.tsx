import { useFormik } from "formik";
import * as Yup from "yup";
import { EmploymentInfo } from "@/types/onboarding";
import { 
	BriefcaseIcon,
	BuildingOfficeIcon,
	CurrencyDollarIcon,
	ClockIcon
} from "@heroicons/react/24/outline";

interface EmploymentFormProps {
	initialValues: Partial<EmploymentInfo>;
	onSubmit: (values: EmploymentInfo) => void;
	onBack: () => void;
	showBackButton: boolean;
	isLastStep: boolean;
}

const employmentStatuses = [
	"Employed",
	"Self-Employed",
	"Student",
	"Unemployed",
] as const;

const validationSchema = Yup.object({
	employmentStatus: Yup.string()
		.oneOf(employmentStatuses)
		.required("Employment status is required"),
	employerName: Yup.string().when("employmentStatus", {
		is: (status: string) =>
			status === "Employed" || status === "Self-Employed",
		then: (schema) => schema.optional(),
		otherwise: (schema) => schema,
	}),
	serviceLength: Yup.mixed()
		.optional()
		.nullable()
		.test("is-number", "Please enter a valid number", (value) => {
			if (value === undefined || value === null || value === "") {
				return true; // Allow empty values
			}
			return !isNaN(Number(value));
		})
		.test("is-positive", "Service length cannot be negative", (value) => {
			if (value === undefined || value === null || value === "") {
				return true; // Allow empty values
			}
			return Number(value) >= 0;
		}),
	monthlyIncome: Yup.mixed()
		.optional()
		.nullable()
		.test("is-number", "Please enter a valid number", (value) => {
			if (value === undefined || value === null || value === "") {
				return true; // Allow empty values
			}
			return !isNaN(Number(value));
		})
		.test("is-positive", "Monthly income cannot be negative", (value) => {
			if (value === undefined || value === null || value === "") {
				return true; // Allow empty values
			}
			return Number(value) >= 0;
		}),
});

export default function EmploymentForm({
	initialValues,
	onSubmit,
	onBack,
	showBackButton,
	isLastStep,
}: EmploymentFormProps) {
	const formik = useFormik<EmploymentInfo>({
		initialValues: {
			employmentStatus: initialValues.employmentStatus || "",
			employerName: initialValues.employerName || "",
			monthlyIncome: initialValues.monthlyIncome || "",
			serviceLength: initialValues.serviceLength || "",
		},
		validationSchema,
		onSubmit: (values) => {
			// Format the values before submission
			const formattedValues = {
				...values,
				// Keep monthly income as a string, but ensure it's properly formatted
				monthlyIncome: values.monthlyIncome
					? String(values.monthlyIncome)
					: "",
				// Keep service length as a string, but ensure it's properly formatted
				serviceLength: values.serviceLength
					? String(values.serviceLength)
					: "",
			};
			
			// Clear employer name and service length for student/unemployed
			if (values.employmentStatus === "Student" || values.employmentStatus === "Unemployed") {
				formattedValues.employerName = "";
				formattedValues.serviceLength = "";
			}
			
			onSubmit(formattedValues);
		},
	});

	const handleEmploymentStatusChange = (status: string) => {
		formik.setFieldValue("employmentStatus", status);
		
		// Clear employer name and service length for student/unemployed
		if (status === "Student" || status === "Unemployed") {
			formik.setFieldValue("employerName", "");
			formik.setFieldValue("serviceLength", "");
		}
	};

	const showEmployerField =
		formik.values.employmentStatus === "Employed" ||
		formik.values.employmentStatus === "Self-Employed";

	// Check if mandatory fields are completed
	const isFormValid = formik.values.employmentStatus !== "";

	return (
		<div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
			<div className="p-4 sm:p-6 lg:p-8">
				{/* Header */}
				<div className="flex items-center mb-6 lg:mb-8">
					<div className="bg-purple-primary/10 rounded-xl p-3 mr-4">
						<BriefcaseIcon className="w-6 h-6 lg:w-7 lg:h-7 text-purple-primary" />
					</div>
					<div>
						<h2 className="text-xl lg:text-2xl font-heading font-bold text-gray-700 mb-1">
							Employment Details
						</h2>
						<p className="text-sm lg:text-base text-purple-primary font-semibold">
							Tell us about your work situation
						</p>
					</div>
				</div>

				<form onSubmit={formik.handleSubmit} className="space-y-6">
					{/* Employment Status */}
					<div>
						<label className="block text-sm lg:text-base font-medium text-gray-700 mb-4">
							Employment Status <span className="text-red-500">*</span>
						</label>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							{employmentStatuses.map((status) => (
								<label
									key={status}
									className={`relative flex items-center p-4 border rounded-xl lg:rounded-2xl cursor-pointer transition-all duration-200 ${
										formik.values.employmentStatus === status
											? "border-purple-primary bg-purple-primary/5 shadow-md"
											: "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
									}`}
								>
									<input
										type="radio"
										name="employmentStatus"
										value={status}
										checked={formik.values.employmentStatus === status}
										onChange={() => handleEmploymentStatusChange(status)}
										className="sr-only"
									/>
									<div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center transition-all duration-200 ${
										formik.values.employmentStatus === status
											? "border-purple-primary bg-purple-primary"
											: "border-gray-300"
									}`}>
										{formik.values.employmentStatus === status && (
											<div className="w-2 h-2 rounded-full bg-white"></div>
										)}
									</div>
									<span className={`font-medium text-sm lg:text-base ${
										formik.values.employmentStatus === status
											? "text-purple-primary"
											: "text-gray-700"
									}`}>
										{status}
									</span>
								</label>
							))}
						</div>
						{formik.touched.employmentStatus && formik.errors.employmentStatus && (
							<p className="mt-2 text-sm text-red-600 font-medium">
								{formik.errors.employmentStatus}
							</p>
						)}
					</div>

					{/* Employer Name - Show only for Employed/Self-Employed */}
					{showEmployerField && (
						<div>
							<label htmlFor="employerName" className="block text-sm lg:text-base font-medium text-gray-700 mb-2">
								Employer Name <span className="text-gray-400 font-normal">(Optional)</span>
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
								</div>
								<input
									id="employerName"
									name="employerName"
									type="text"
									value={formik.values.employerName}
									onChange={formik.handleChange}
									onBlur={formik.handleBlur}
									placeholder="Enter your employer or company name"
									className={`block w-full pl-10 pr-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl text-gray-900 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-transparent transition-all duration-200 text-sm lg:text-base ${
										formik.touched.employerName && formik.errors.employerName
											? "border-red-300 focus:ring-red-500"
											: "border-gray-300 hover:border-gray-400"
									}`}
								/>
							</div>
							{formik.touched.employerName && formik.errors.employerName && (
								<p className="mt-2 text-sm text-red-600 font-medium">
									{formik.errors.employerName}
								</p>
							)}
						</div>
					)}

					{/* Service Length - Show only for Employed/Self-Employed */}
					{showEmployerField && (
						<div>
							<label htmlFor="serviceLength" className="block text-sm lg:text-base font-medium text-gray-700 mb-2">
								Years at Current Company <span className="text-gray-400 font-normal">(Optional)</span>
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<ClockIcon className="h-5 w-5 text-gray-400" />
								</div>
								<input
									id="serviceLength"
									name="serviceLength"
									type="number"
									min="0"
									step="0.1"
									value={formik.values.serviceLength}
									onChange={formik.handleChange}
									onBlur={formik.handleBlur}
									placeholder="0.5"
									className={`block w-full pl-10 pr-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl text-gray-900 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-transparent transition-all duration-200 text-sm lg:text-base ${
										formik.touched.serviceLength && formik.errors.serviceLength
											? "border-red-300 focus:ring-red-500"
											: "border-gray-300 hover:border-gray-400"
									}`}
								/>
							</div>
							{formik.touched.serviceLength && formik.errors.serviceLength && (
								<p className="mt-2 text-sm text-red-600 font-medium">
									{formik.errors.serviceLength}
								</p>
							)}
							<p className="mt-2 text-sm text-gray-500">
								Length of time you've been working at your current company
							</p>
						</div>
					)}

					{/* Monthly Income */}
					<div>
						<label htmlFor="monthlyIncome" className="block text-sm lg:text-base font-medium text-gray-700 mb-2">
							Monthly Income <span className="text-gray-400 font-normal">(Optional)</span>
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
							</div>
							<div className="absolute inset-y-0 left-10 flex items-center pointer-events-none">
								<span className="text-gray-500 text-sm lg:text-base">RM</span>
							</div>
							<input
								id="monthlyIncome"
								name="monthlyIncome"
								type="number"
								min="0"
								step="0.01"
								value={formik.values.monthlyIncome}
								onChange={formik.handleChange}
								onBlur={formik.handleBlur}
								placeholder="0.00"
								className={`block w-full pl-16 pr-3 py-3 lg:py-4 border rounded-xl lg:rounded-2xl text-gray-900 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-transparent transition-all duration-200 text-sm lg:text-base ${
									formik.touched.monthlyIncome && formik.errors.monthlyIncome
										? "border-red-300 focus:ring-red-500"
										: "border-gray-300 hover:border-gray-400"
								}`}
							/>
						</div>
						{formik.touched.monthlyIncome && formik.errors.monthlyIncome && (
							<p className="mt-2 text-sm text-red-600 font-medium">
								{formik.errors.monthlyIncome}
							</p>
						)}
						<p className="mt-2 text-sm text-gray-500">
							This information helps us provide better loan options for you
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
