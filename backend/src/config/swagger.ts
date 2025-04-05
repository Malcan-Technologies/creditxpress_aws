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
		},
		security: [
			{
				bearerAuth: [],
			},
		],
	},
	apis: ["./src/api/*.ts", "./app/api/**/*.ts"], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);
