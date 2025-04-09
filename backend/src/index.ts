import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import authRoutes from "./api/auth";
import userRoutes from "./api/users";
import onboardingRoutes from "./api/onboarding";
import productRoutes from "./api/products";
import loanApplicationRoutes from "./api/loan-applications";
import adminRoutes from "./api/admin";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV !== "production";

// Middleware
app.use(
	cors({
		origin: isDevelopment
			? [
					"http://localhost:3000",
					"http://localhost:3001",
					"http://localhost:3002",
			  ]
			: ["https://growkapital.com", "https://admin.growkapital.com"],
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		exposedHeaders: ["Authorization"],
	})
);
app.use(express.json());

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
app.get("/api/health", (_req, res) => {
	res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/products", productRoutes);
app.use("/api/loan-applications", loanApplicationRoutes);
app.use("/api/admin", adminRoutes);

// Export Swagger specification to a JSON file
// Create a directory for the Swagger JSON if it doesn't exist
const swaggerDir = path.join(__dirname, "..", "swagger");
if (!fs.existsSync(swaggerDir)) {
	fs.mkdirSync(swaggerDir, { recursive: true });
}

// Write the Swagger specification to a JSON file
fs.writeFileSync(
	path.join(swaggerDir, "swagger.json"),
	JSON.stringify(swaggerSpec, null, 2)
);

// Start server
app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
	console.log(
		`API Documentation available at http://localhost:${port}/api-docs`
	);
});
