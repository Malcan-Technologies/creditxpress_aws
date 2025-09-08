import { Request, Response, NextFunction } from 'express';
import { verifyHmacSignature, generateCorrelationId } from '../utils/crypto';
import { createCorrelatedLogger } from '../utils/logger';

// Extend Request type to include correlation ID and raw body
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      rawBody?: Buffer;
    }
  }
}

/**
 * Middleware to add correlation ID to all requests
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.correlationId = req.headers['x-correlation-id'] as string || generateCorrelationId();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}

/**
 * Middleware to capture raw body for HMAC verification
 */
export function rawBodyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const chunks: Buffer[] = [];
  
  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });
  
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });
  
  req.on('error', (error) => {
    const log = createCorrelatedLogger(req.correlationId || 'unknown');
    log.error('Error reading request body', { error: error.message });
    res.status(400).json({ error: 'Bad Request', message: 'Error reading request body' });
  });
}

/**
 * Middleware to verify HMAC signature for DocuSeal webhooks
 */
export function verifyDocuSealWebhook(req: Request, res: Response, next: NextFunction): void | Response {
  const log = createCorrelatedLogger(req.correlationId || 'unknown');
  
  try {
    const signature = req.headers['x-docuseal-signature'] as string;
    
    if (!signature) {
      log.warn('Missing DocuSeal signature header');
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Missing signature header' 
      });
    }
    
    if (!req.rawBody) {
      log.warn('Missing raw body for signature verification');
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Missing request body' 
      });
    }
    
    const payload = req.rawBody.toString('utf8');
    const isValid = verifyHmacSignature(payload, signature);
    
    if (!isValid) {
      log.warn('Invalid DocuSeal webhook signature', { 
        signaturePrefix: signature.substring(0, 10) + '...' 
      });
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid signature' 
      });
    }
    
    log.debug('DocuSeal webhook signature verified successfully');
    next();
  } catch (error) {
    log.error('Error verifying DocuSeal webhook signature', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Signature verification failed' 
    });
  }
}

/**
 * Middleware for basic API key authentication (optional routes)
 */
export function verifyApiKey(req: Request, res: Response, next: NextFunction): void | Response {
  const log = createCorrelatedLogger(req.correlationId || 'unknown');
  
  const apiKey = req.headers['x-api-key'] as string || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    log.warn('Missing API key');
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Missing API key' 
    });
  }
  
  // In production, validate against the proper API key
  const expectedApiKey = process.env.SIGNING_ORCHESTRATOR_API_KEY || process.env.DOCUSEAL_API_TOKEN;
  
  if (process.env.NODE_ENV === 'production' && expectedApiKey && apiKey !== expectedApiKey) {
    log.warn('Invalid API key', { keyPrefix: apiKey.substring(0, 8) + '...' });
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid API key' 
    });
  }
  
  log.debug('API key verified successfully');
  next();
}

/**
 * Error handling middleware
 */
export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  const log = createCorrelatedLogger(req.correlationId || 'unknown');
  
  log.error('Unhandled error in request', { 
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method 
  });
  
  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? error.message : 'An unexpected error occurred',
    correlationId: req.correlationId,
    ...(isDevelopment && { stack: error.stack }),
  });
}
