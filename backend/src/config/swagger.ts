import swaggerJsdoc from "swagger-jsdoc";

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
				url: "http://localhost:3001",
				description: "Development server",
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
		paths: {
			"/api/admin/login": {
				post: {
					tags: ["Admin"],
					summary: "Admin login",
					description: "Login endpoint for admin users",
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/AdminLogin",
								},
							},
						},
					},
					responses: {
						200: {
							description: "Successful login",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											accessToken: { type: "string" },
											refreshToken: { type: "string" },
											role: {
												type: "string",
												example: "ADMIN",
											},
											user: {
												$ref: "#/components/schemas/User",
											},
										},
									},
								},
							},
						},
						401: { description: "Invalid credentials" },
						403: { description: "Not an admin user" },
					},
				},
			},
			"/api/admin/users": {
				get: {
					tags: ["Admin"],
					summary: "Get all users",
					description: "Get a list of all users (admin only)",
					security: [{ bearerAuth: [] }],
					responses: {
						200: {
							description: "List of users",
							content: {
								"application/json": {
									schema: {
										type: "array",
										items: {
											$ref: "#/components/schemas/User",
										},
									},
								},
							},
						},
						403: { description: "Not authorized as admin" },
					},
				},
			},
			"/api/admin/dashboard": {
				get: {
					tags: ["Admin"],
					summary: "Get dashboard statistics",
					description:
						"Get overview statistics for the admin dashboard",
					security: [{ bearerAuth: [] }],
					responses: {
						200: {
							description: "Dashboard statistics",
							content: {
								"application/json": {
									schema: {
										$ref: "#/components/schemas/DashboardStats",
									},
								},
							},
						},
						403: { description: "Not authorized as admin" },
					},
				},
			},
		},
	},
	apis: ["./src/api/*.ts", "./app/api/**/*.ts"], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);
