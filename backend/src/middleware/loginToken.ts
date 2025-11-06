import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

interface TokenStore {
	token: string;
	expiresAt: number;
}

// In-memory store for login tokens
// Key: IP address, Value: TokenStore
const tokenStore = new Map<string, TokenStore>();

// Token configuration
const TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get client IP address from request, handling proxies/load balancers
 */
function getClientIp(req: Request): string {
	const forwarded = req.headers['x-forwarded-for'];
	if (typeof forwarded === 'string') {
		return forwarded.split(',')[0].trim();
	}
	return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Clean up expired tokens from the store
 */
function cleanupExpiredTokens(): void {
	const now = Date.now();
	for (const [key, value] of tokenStore.entries()) {
		if (value.expiresAt < now) {
			tokenStore.delete(key);
		}
	}
}

// Start periodic cleanup of expired tokens
setInterval(cleanupExpiredTokens, CLEANUP_INTERVAL_MS);

/**
 * Middleware to generate a one-time login token
 * Token is stored in memory keyed by IP address
 */
export function generateLoginToken(req: Request, res: Response, next: NextFunction) {
	try {
		const clientIp = getClientIp(req);
		
		// Generate cryptographically secure random token (32 bytes = 64 hex characters)
		const token = crypto.randomBytes(32).toString('hex');
		const expiresAt = Date.now() + TOKEN_EXPIRY_MS;

		// Store token
		tokenStore.set(clientIp, { token, expiresAt });

		// Send token in response header for frontend to use
		res.setHeader('X-Login-Token', token);
		
		// Also include in response body for convenience
		res.locals.loginToken = token;
		
		next();
	} catch (error) {
		console.error('Error generating login token:', error);
		res.status(500).json({ 
			message: 'Failed to generate login token. Please try again.' 
		});
		return;
	}
}

/**
 * Middleware to validate one-time login token
 * Token must be provided in request body as 'loginToken' or header as 'X-Login-Token'
 * Token is deleted after use (one-time use)
 */
export function validateLoginToken(req: Request, res: Response, next: NextFunction) {
	try {
		const clientIp = getClientIp(req);
		
		// Get token from body or header
		const providedToken = req.body.loginToken || req.headers['x-login-token'];
		
		if (!providedToken) {
			res.status(403).json({ 
				message: 'Missing login token. Please refresh the page and try again.' 
			});
			return;
		}

		// Get stored token for this IP
		const stored = tokenStore.get(clientIp);
		
		if (!stored) {
			res.status(403).json({ 
				message: 'Invalid or expired login token. Please refresh the page.' 
			});
			return;
		}

		// Check if token has expired
		if (stored.expiresAt < Date.now()) {
			tokenStore.delete(clientIp);
			res.status(403).json({ 
				message: 'Login token expired. Please refresh the page.' 
			});
			return;
		}

		// Validate token matches
		if (stored.token !== providedToken) {
			res.status(403).json({ 
				message: 'Invalid login token.' 
			});
			return;
		}

		// Token is valid - delete it (one-time use)
		tokenStore.delete(clientIp);
		
		next();
	} catch (error) {
		console.error('Error validating login token:', error);
		res.status(500).json({ 
			message: 'Error validating login token.' 
		});
		return;
	}
}

