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

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(
	cors({
		origin: [
			"http://localhost:3000",
			"http://localhost:3001",
			"http://localhost:3002",
		],
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
	})
);
app.use(express.json());

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/products", productRoutes);
app.use("/api/loan-applications", loanApplicationRoutes);
app.use("/api/admin", adminRoutes);

// Start server
app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
	console.log(
		`API Documentation available at http://localhost:${port}/api-docs`
	);
});
