import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET =
	process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";

export interface JwtPayload {
	userId: string;
	phoneNumber: string;
}

// Base AuthRequest without files
export interface AuthRequest extends Request {
	user?: {
		userId: string;
	};
	files?: any;
}

// AuthRequest with file uploads
export interface FileAuthRequest extends Omit<AuthRequest, "files"> {
	files?:
		| Express.Multer.File[]
		| { [fieldname: string]: Express.Multer.File[] };
}

export const authenticateToken = (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	const authHeader = req.headers["authorization"];
	const token = authHeader && authHeader.split(" ")[1];

	if (!token) {
		return res.status(401).json({ message: "Unauthorized" });
	}

	try {
		const decoded = jwt.verify(
			token,
			process.env.JWT_SECRET || "your-secret-key"
		) as { userId: string };
		req.user = { userId: decoded.userId };
		return next();
	} catch (error) {
		return res.status(403).json({ message: "Invalid token" });
	}
};

export const generateTokens = (user: { id: string; phoneNumber: string }) => {
	const accessToken = jwt.sign(
		{ userId: user.id, phoneNumber: user.phoneNumber },
		JWT_SECRET,
		{ expiresIn: "15m" }
	);

	const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, {
		expiresIn: "90d",
	});

	return { accessToken, refreshToken };
};

export const verifyRefreshToken = (
	token: string
): { userId: string } | null => {
	try {
		return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
	} catch (error) {
		return null;
	}
};
