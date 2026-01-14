import { app, port } from "./app";
import { CronScheduler } from "./lib/cronScheduler";
import { urlConfig } from "./lib/config";

// Get base URL from centralized config, ensuring no trailing slash
const baseUrl = urlConfig.api.replace(/\/$/, "");

// Initialize cron scheduler
const cronScheduler = CronScheduler.getInstance();

// Start server
app.listen(port, async () => {
	console.log(`Server is running on port ${port}`);
	console.log(`API Documentation available at ${baseUrl}/api-docs`);

	// Start cron scheduler after server is ready
	await cronScheduler.start();
});

// Graceful shutdown
process.on("SIGTERM", () => {
	console.log("SIGTERM received, shutting down gracefully...");
	cronScheduler.stop();
	process.exit(0);
});

process.on("SIGINT", () => {
	console.log("SIGINT received, shutting down gracefully...");
	cronScheduler.stop();
	process.exit(0);
});
