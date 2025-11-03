import express from 'express';
import { createCorrelatedLogger } from '../utils/logger';
import { mtsaClient } from '../services/MTSAClient';
import { storageManager } from '../utils/storage';
import config from '../config';
import axios from 'axios';
import { HealthCheckResult } from '../types';

const router = express.Router();

/**
 * Health check endpoint
 * GET /health
 */
router.get('/', async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    log.info('Performing health check');
    
    const healthResult = await performHealthCheck(req.correlationId!);
    
    const statusCode = healthResult.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      ...healthResult,
      correlationId: req.correlationId,
    });
    
  } catch (error) {
    log.error('Health check failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        soapConnection: false,
        diskWritable: false,
        docusealReachable: false,
      },
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
      correlationId: req.correlationId,
    });
  }
});

/**
 * Detailed health check endpoint
 * GET /health/detailed
 */
router.get('/detailed', async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    log.info('Performing detailed health check');
    
    const [
      soapHealth,
      storageHealth,
      docusealHealth,
      storageStats,
    ] = await Promise.allSettled([
      checkSoapConnection(req.correlationId!),
      checkStorageHealth(req.correlationId!),
      checkDocuSealReachability(req.correlationId!),
      storageManager.getStorageStats(req.correlationId!),
    ]);
    
    const healthResult: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        soapConnection: soapHealth.status === 'fulfilled' && soapHealth.value,
        diskWritable: storageHealth.status === 'fulfilled' && storageHealth.value,
        docusealReachable: docusealHealth.status === 'fulfilled' && docusealHealth.value,
      },
      details: {
        soap: {
          status: soapHealth.status,
          healthy: soapHealth.status === 'fulfilled' && soapHealth.value,
          error: soapHealth.status === 'rejected' ? soapHealth.reason?.message : undefined,
          wsdlUrl: config.mtsa.env === 'prod' ? config.mtsa.wsdlProd : config.mtsa.wsdlPilot,
          environment: config.mtsa.env,
        },
        storage: {
          status: storageHealth.status,
          healthy: storageHealth.status === 'fulfilled' && storageHealth.value,
          error: storageHealth.status === 'rejected' ? storageHealth.reason?.message : undefined,
          directory: config.storage.signedFilesDir,
          stats: storageStats.status === 'fulfilled' ? storageStats.value : undefined,
        },
        docuseal: {
          status: docusealHealth.status,
          healthy: docusealHealth.status === 'fulfilled' && docusealHealth.value,
          error: docusealHealth.status === 'rejected' ? docusealHealth.reason?.message : undefined,
          baseUrl: config.docuseal.baseUrl,
        },
        config: {
          appPort: config.app.port,
          nodeEnv: config.app.nodeEnv,
          mtsaEnv: config.mtsa.env,
          logLevel: config.logging.level,
        },
      },
    };
    
    // Determine overall health status
    const allChecksHealthy = Object.values(healthResult.checks).every(check => check);
    healthResult.status = allChecksHealthy ? 'healthy' : 'unhealthy';
    
    const statusCode = healthResult.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      ...healthResult,
      correlationId: req.correlationId,
    });
    
  } catch (error) {
    log.error('Detailed health check failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        soapConnection: false,
        diskWritable: false,
        docusealReachable: false,
      },
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
      correlationId: req.correlationId,
    });
  }
});

/**
 * Readiness probe endpoint (for Kubernetes)
 * GET /health/ready
 */
router.get('/ready', async (req, res) => {
  const log = createCorrelatedLogger(req.correlationId!);
  
  try {
    // Quick readiness check - just verify critical services
    const [soapReady, storageReady] = await Promise.allSettled([
      mtsaClient.healthCheck(req.correlationId!),
      storageManager.healthCheck(req.correlationId!),
    ]);
    
    const isReady = 
      soapReady.status === 'fulfilled' && soapReady.value &&
      storageReady.status === 'fulfilled' && storageReady.value;
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId,
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId,
      });
    }
    
  } catch (error) {
    log.error('Readiness check failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      correlationId: req.correlationId,
    });
  }
});

/**
 * Liveness probe endpoint (for Kubernetes)
 * GET /health/live
 */
router.get('/live', (req, res) => {
  // Simple liveness check - just return OK if the process is running
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    correlationId: req.correlationId,
  });
});

/**
 * Perform comprehensive health check
 */
async function performHealthCheck(correlationId: string): Promise<HealthCheckResult> {
  const log = createCorrelatedLogger(correlationId);
  
  const [soapCheck, storageCheck, docusealCheck] = await Promise.allSettled([
    checkSoapConnection(correlationId),
    checkStorageHealth(correlationId),
    checkDocuSealReachability(correlationId),
  ]);
  
  const checks = {
    soapConnection: soapCheck.status === 'fulfilled' && soapCheck.value,
    diskWritable: storageCheck.status === 'fulfilled' && storageCheck.value,
    docusealReachable: docusealCheck.status === 'fulfilled' && docusealCheck.value,
  };
  
  const allHealthy = Object.values(checks).every(check => check);
  
  const result: HealthCheckResult = {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
    details: {
      soapError: soapCheck.status === 'rejected' ? soapCheck.reason?.message : undefined,
      storageError: storageCheck.status === 'rejected' ? storageCheck.reason?.message : undefined,
      docusealError: docusealCheck.status === 'rejected' ? docusealCheck.reason?.message : undefined,
    },
  };
  
  log.info('Health check completed', { 
    status: result.status,
    checks: result.checks 
  });
  
  return result;
}

/**
 * Check SOAP connection health
 */
async function checkSoapConnection(correlationId: string): Promise<boolean> {
  const log = createCorrelatedLogger(correlationId);
  
  try {
    const isHealthy = await mtsaClient.healthCheck(correlationId);
    log.debug('SOAP connection health check', { healthy: isHealthy });
    return isHealthy;
  } catch (error) {
    log.warn('SOAP connection health check failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

/**
 * Check storage health
 */
async function checkStorageHealth(correlationId: string): Promise<boolean> {
  const log = createCorrelatedLogger(correlationId);
  
  try {
    const isHealthy = await storageManager.healthCheck(correlationId);
    log.debug('Storage health check', { healthy: isHealthy });
    return isHealthy;
  } catch (error) {
    log.warn('Storage health check failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

/**
 * Check DocuSeal reachability
 */
async function checkDocuSealReachability(correlationId: string): Promise<boolean> {
  const log = createCorrelatedLogger(correlationId);
  
  try {
    // Use shorter timeout and connection reuse for faster health checks
    const response = await axios.get(`${config.docuseal.baseUrl}/api/templates`, {
      timeout: 3000,  // Reduced from 5s to 3s for faster failure detection
      headers: {
        'X-Auth-Token': config.docuseal.apiToken,
        'Connection': 'keep-alive'  // Reuse connections
      },
      validateStatus: (status) => status < 500, // Accept any status < 500 as reachable
      // Use keep-alive for connection pooling (only if baseUrl is http, not https)
      ...(config.docuseal.baseUrl.startsWith('http://') ? {
        httpAgent: new (require('http').Agent)({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: 5 })
      } : {}),
    });
    
    const isReachable = response.status < 500;
    log.debug('DocuSeal reachability check', { 
      healthy: isReachable,
      status: response.status 
    });
    
    return isReachable;
  } catch (error) {
    // Only log as warning if it's not a timeout - timeouts are expected occasionally
    const isTimeout = error instanceof Error && (
      error.message.includes('timeout') || 
      error.message.includes('ETIMEDOUT') ||
      error.code === 'ECONNABORTED'
    );
    
    if (!isTimeout) {
      log.warn('DocuSeal reachability check failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    } else {
      log.debug('DocuSeal reachability check timed out (non-critical)', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
    return false;
  }
}

export default router;
