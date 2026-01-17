interface UserProfile {
	fullName: string | null;
	email: string | null;
	phoneNumber: string;
	dateOfBirth: string | null;
	address1: string | null;
	city: string | null;
	state: string | null;
	zipCode: string | null;
	icNumber?: string | null;
	race?: string | null;
	gender?: string | null;
	occupation?: string | null;
	emergencyContactName?: string | null;
	emergencyContactPhone?: string | null;
	emergencyContactRelationship?: string | null;
	employmentStatus: string | null;
	employerName: string | null;
	monthlyIncome: string | null;
	serviceLength: string | null;
	bankName: string | null;
	accountNumber: string | null;
}

export interface ProfileCompleteness {
	isComplete: boolean;
	missing: string[];
	completionPercentage: number;
}

export function checkProfileCompleteness(profile: UserProfile | null): ProfileCompleteness {
	if (!profile) return { isComplete: false, missing: [], completionPercentage: 0 };
	
	const sections = [
		{
			name: "Personal Information",
			fields: ["fullName", "email", "phoneNumber", "dateOfBirth", "race", "gender"],
			required: true
		},
		{
			name: "Address",
			fields: ["address1", "city", "state", "zipCode"],
			required: true
		},
		{
			name: "IC/Passport",
			fields: ["icNumber"],
			required: true
		},
		{
			name: "Emergency Contact",
			fields: ["emergencyContactName", "emergencyContactPhone", "emergencyContactRelationship"],
			required: true
		},
		{
			name: "Employment",
			fields: ["employmentStatus", "monthlyIncome", "occupation"],
			required: true,
			conditionalFields: [
				{
					condition: profile.employmentStatus === "Employed" || profile.employmentStatus === "Self-Employed",
					fields: ["employerName", "serviceLength"]
				}
			]
		},
		{
			name: "Banking",
			fields: ["bankName", "accountNumber"],
			required: true
		}
	];

	const missing: string[] = [];
	let totalFields = 0;
	let completedFields = 0;

	sections.forEach(section => {
		let sectionIncomplete = false;
		
		// Check required fields
		section.fields.forEach(field => {
			totalFields++;
			const value = profile[field as keyof UserProfile];
			if (value && value.toString().trim() !== "") {
				completedFields++;
			} else {
				sectionIncomplete = true;
			}
		});

		// Check conditional fields
		if (section.conditionalFields) {
			section.conditionalFields.forEach(conditional => {
				if (conditional.condition) {
					conditional.fields.forEach(field => {
						totalFields++;
						const value = profile[field as keyof UserProfile];
						if (value && value.toString().trim() !== "") {
							completedFields++;
						} else {
							sectionIncomplete = true;
						}
					});
				}
			});
		}

		if (sectionIncomplete) {
			missing.push(section.name);
		}
	});

	const completionPercentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
	
	return {
		isComplete: missing.length === 0,
		missing,
		completionPercentage
	};
} 