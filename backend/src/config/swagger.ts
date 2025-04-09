import swaggerJsdoc from "swagger-jsdoc";
import path from "path";

// Get base URL from environment or use the port-based localhost as fallback
const port = process.env.PORT || 3001;
export const baseUrl = (
	process.env.BASE_URL || `http://localhost:${port}`
).replace(/\/$/, "");

const options = {
	definition: {
		openapi: "3.0.0",
		info: {
			title: "Kapital API Documentation",
			version: "1.0.0",
			description: "API documentation for Kapital backend services",
		},
		servers: [
			{
				url: baseUrl,
				description:
					process.env.NODE_ENV === "production"
						? "Production server"
						: "Local development server",
			},
		],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
				},
			},
			schemas: {
				AdminLogin: {
					type: "object",
					required: ["phoneNumber", "password"],
					properties: {
						phoneNumber: {
							type: "string",
							example: "+60123456789",
						},
						password: {
							type: "string",
							example: "password123",
						},
					},
				},
				User: {
					type: "object",
					properties: {
						id: { type: "string" },
						fullName: { type: "string" },
						email: { type: "string" },
						phoneNumber: { type: "string" },
						role: { type: "string" },
						createdAt: { type: "string", format: "date-time" },
					},
				},
				DashboardStats: {
					type: "object",
					properties: {
						totalUsers: { type: "number" },
						totalApplications: { type: "number" },
						totalLoans: { type: "number" },
						totalLoanAmount: { type: "number" },
						recentApplications: {
							type: "array",
							items: {
								type: "object",
								properties: {
									id: { type: "string" },
									status: { type: "string" },
									createdAt: {
										type: "string",
										format: "date-time",
									},
									user: {
										type: "object",
										properties: {
											fullName: { type: "string" },
											email: { type: "string" },
										},
									},
								},
							},
						},
					},
				},
			},
		},
		security: [
			{
				bearerAuth: [],
			},
		],
	},
	apis: [
		path.resolve(__dirname, "../api/*.ts"),
		path.resolve(__dirname, "../api/*.js"),
	], // Include both .ts and .js files to work in both dev and production
};

export const swaggerSpec = swaggerJsdoc(options);
