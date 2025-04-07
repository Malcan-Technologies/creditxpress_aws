import express from "express";
import cors from "cors";

const app = express();

// Debug middleware to log requests
app.use((req, res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
	console.log("Origin:", req.headers.origin);
	console.log("Headers:", req.headers);
	next();
});

// Configure CORS
const corsOptions = {
	origin: true, // Allow all origins for now to debug
	credentials: true,
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "Origin", "Accept"],
	exposedHeaders: ["Content-Range", "X-Content-Range"],
	maxAge: 86400, // Cache preflight request for 24 hours
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions));

app.use(express.json());

export default app;
