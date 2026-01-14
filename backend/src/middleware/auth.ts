import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { jwtConfig, kycConfig } from "../lib/config";

const JWT_SECRET = jwtConfig.secret;
const JWT_REFRESH_SECRET = jwtConfig.refreshSecret;

export interface JwtPayload {
	userId: string;
	phoneNumber: string;
}

// Base AuthRequest without files
export interface AuthRequest extends Request {
	user?: {
		userId: string;
		role?: string;
		fullName?: string;
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
		const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
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
		{ expiresIn: "72h" }
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

/**
 * Middleware that requires phone verification
 * Use this for protected routes that require verified phone numbers
 */
export const requirePhoneVerification = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		if (!req.user?.userId) {
			return res.status(401).json({ 
				message: "Unauthorized",
				requiresLogin: true 
			});
		}

		// Check if user's phone is verified
		const user = await prisma.user.findUnique({
			where: { id: req.user.userId },
			select: { 
				phoneVerified: true, 
				phoneNumber: true 
			}
		});

		if (!user) {
			return res.status(401).json({ 
				message: "User not found" 
			});
		}

		if (!user.phoneVerified) {
			return res.status(403).json({ 
				message: "Phone number verification required. Please verify your phone number to access this feature.",
				requiresPhoneVerification: true,
				phoneNumber: user.phoneNumber
			});
		}

		return next();
	} catch (error) {
		console.error("Phone verification check error:", error);
		return res.status(500).json({ 
			message: "Internal server error" 
		});
	}
};

/**
 * Combined middleware that authenticates token AND requires phone verification
 * Use this for most protected routes
 */
export const authenticateAndVerifyPhone = [
	authenticateToken,
	requirePhoneVerification
];

// KYC token support: accept either standard Authorization or signed one-time KYC token
export const authenticateKycOrAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Try standard bearer first
  const authHeader = req.headers["authorization"];
  const token = authHeader && (authHeader as string).split(" ")[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      req.user = { userId: decoded.userId };
      return next();
    } catch {}
  }

  // Then allow one-time KYC token via query `t` or header `x-kyc-token`
  const kycToken = (req.query?.t as string) || (req.headers["x-kyc-token"] as string);
  if (!kycToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(kycToken, kycConfig.jwtSecret) as { userId: string; kycId: string; };
    // If route contains :kycId param, ensure it matches token
    const paramKycId = (req.params as any)?.kycId;
    if (paramKycId && decoded.kycId !== paramKycId) {
      return res.status(403).json({ message: "KYC token does not match session" });
    }
    req.user = { userId: decoded.userId };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired KYC token" });
  }
};
