import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET =
	process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";

export interface JwtPayload {
	userId: string;
	phoneNumber: string;
}

export interface AuthRequest extends Request {
	user?: JwtPayload;
}

export const authenticateToken = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	const authHeader = req.headers["authorization"];
	const token = authHeader && authHeader.split(" ")[1];

	if (!token) {
		res.status(401).json({ message: "Authentication token required" });
		return;
	}

	try {
		const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
		req.user = decoded;
		next();
	} catch (error) {
		res.status(403).json({ message: "Invalid or expired token" });
	}
};

export const generateTokens = (user: { id: string; phoneNumber: string }) => {
	const accessToken = jwt.sign(
		{ userId: user.id, phoneNumber: user.phoneNumber },
		JWT_SECRET,
		{ expiresIn: "15m" }
	);

	const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, {
		expiresIn: "7d",
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
