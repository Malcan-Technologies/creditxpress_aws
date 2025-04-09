import { app, port } from "./app";

// Get base URL from environment or use default, ensuring no trailing slash
const baseUrl = (process.env.BASE_URL || `http://localhost:${port}`).replace(
	/\/$/,
	""
);

// Start server
app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
	console.log(`API Documentation available at ${baseUrl}/api-docs`);
});
