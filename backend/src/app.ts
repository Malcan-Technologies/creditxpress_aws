import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec, baseUrl } from "./config/swagger";
import authRoutes from "./api/auth";
import userRoutes from "./api/users";
import onboardingRoutes from "./api/onboarding";
import productRoutes from "./api/products";
import loanApplicationRoutes from "./api/loan-applications";
import loanRoutes from "./api/loans";
import adminRoutes from "./api/admin";
import walletRoutes from "./api/wallet";
import notificationsRoutes from "./api/notifications";
import settingsRoutes from "./api/settings";
import kycRoutes from "./api/kyc";
import bankAccountsRoutes from "./api/bank-accounts";
import fs from "fs";
import path from "path";
import prisma from "../lib/prisma";

dotenv.config();

const app = express();
const port = process.env.PORT || 4001;

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV !== "production";

// Get CORS origins from environment variable or use defaults
const corsOrigins = process.env.CORS_ORIGIN
	? process.env.CORS_ORIGIN.split(",")
	: isDevelopment
	? [
			"http://localhost:3000",
			"http://localhost:3001",
			"http://localhost:3002",
	  ]
	: ["https://kredit.my", "https://admin.kredit.my", "https://api.kredit.my"];

// Middleware
app.use(
	cors({
		origin: corsOrigins,
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Cache-Control",
            "Pragma",
            "Expires",
            "If-Modified-Since",
            "If-None-Match",
            "X-KYC-TOKEN",
            "x-kyc-token",
        ],
		exposedHeaders: ["Authorization"],
	})
);
// Skip JSON parsing for file upload routes
app.use((req, res, next) => {
	if (req.path.includes('/csv-upload')) {
		return next();
	}
	express.json({ limit: "50mb" })(req, res, next);
});
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Log all requests in development mode
if (isDevelopment) {
	app.use((req, _res, next) => {
		console.log(`${req.method} ${req.path} - Body:`, req.body);
		next();
	});
}

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint
app.get("/api/health", async (_req, res) => {
	try {
		// Check database connectivity
		await prisma.$queryRaw`SELECT 1`;

		res.status(200).json({
			status: "ok",
			timestamp: new Date().toISOString(),
			database: "connected",
		});
	} catch (error) {
		console.error("Health check failed:", error);
		res.status(500).json({
			status: "error",
			timestamp: new Date().toISOString(),
			database: "disconnected",
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/products", productRoutes);
app.use("/api/loan-applications", loanApplicationRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/bank-accounts", bankAccountsRoutes);

// Serve static files from the uploads directory
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Export Swagger specification to a JSON file
// Create a directory for the Swagger JSON if it doesn't exist
const swaggerDir = path.join(__dirname, "..", "swagger");
if (!fs.existsSync(swaggerDir)) {
	fs.mkdirSync(swaggerDir, { recursive: true });
}

// Update the server URL based on the environment
(swaggerSpec as any).servers = [
	{
		url: baseUrl,
		description:
			process.env.NODE_ENV === "production"
				? "Production server"
				: "Local development server",
	},
];

// Write the Swagger specification to a JSON file
fs.writeFileSync(
	path.join(swaggerDir, "swagger.json"),
	JSON.stringify(swaggerSpec, null, 2)
);

export { app, port };
