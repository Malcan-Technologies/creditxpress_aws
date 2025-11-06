import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter for customer login endpoint
 * Allows 5 login attempts per 15 minutes per IP address
 */
export const loginRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // Limit each IP to 5 requests per windowMs
	message: 'Too many login attempts from this IP, please try again after 15 minutes',
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	skipSuccessfulRequests: false, // Count successful requests too
	skipFailedRequests: false,
	handler: (req: Request, res: Response) => {
		const rateLimitInfo = (req as any).rateLimit;
		const resetTime = rateLimitInfo?.resetTime || Date.now() + 15 * 60 * 1000;
		const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
		
		res.status(429).json({
			message: 'Too many login attempts from this IP, please try again after 15 minutes',
			retryAfter: retryAfter > 0 ? retryAfter : 0,
		});
	},
});

/**
 * Rate limiter for admin login endpoint
 * Allows 5 login attempts per 15 minutes per IP address
 * Separate instance from customer login to track independently
 */
export const adminLoginRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // Limit each IP to 5 requests per windowMs
	message: 'Too many login attempts from this IP, please try again after 15 minutes',
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	skipSuccessfulRequests: false, // Count successful requests too
	skipFailedRequests: false,
	handler: (req: Request, res: Response) => {
		const rateLimitInfo = (req as any).rateLimit;
		const resetTime = rateLimitInfo?.resetTime || Date.now() + 15 * 60 * 1000;
		const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
		
		res.status(429).json({
			error: 'Too many login attempts from this IP, please try again after 15 minutes',
			retryAfter: retryAfter > 0 ? retryAfter : 0,
		});
	},
});
