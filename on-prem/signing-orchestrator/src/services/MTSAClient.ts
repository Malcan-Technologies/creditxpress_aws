import * as soap from 'soap';
import config from '../config';
import logger, { createCorrelatedLogger } from '../utils/logger';
import {
  MTSARequestCertificateRequest,
  MTSARequestCertificateResponse,
  MTSAGetCertInfoRequest,
  MTSAGetCertInfoResponse,
  MTSASignPDFRequest,
  MTSASignPDFResponse,
  MTSAVerifyPDFRequest,
  MTSAVerifyPDFResponse,
  MTSARequestEmailOTPRequest,
  MTSARequestEmailOTPResponse,
  MTSARequestRevokeCertRequest,
  MTSARequestRevokeCertResponse,
} from '../types';

export class MTSAClient {
  private client: soap.Client | null = null;
  private wsdlUrl: string;
  private isInitialized = false;

  constructor() {
    this.wsdlUrl = config.mtsa.env === 'prod' ? config.mtsa.wsdlProd : config.mtsa.wsdlPilot;
  }

  /**
   * Initialize SOAP client connection
   */
  async initialize(correlationId?: string): Promise<void> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    if (this.isInitialized && this.client) {
      return;
    }

    try {
      log.info('Initializing MTSA SOAP client with HTTP header authentication', { wsdlUrl: this.wsdlUrl, env: config.mtsa.env });
      
      this.client = await soap.createClientAsync(this.wsdlUrl);
      
      // Set default HTTP headers for all requests
      this.client.addHttpHeader('Username', config.mtsa.username);
      this.client.addHttpHeader('Password', config.mtsa.password);
      
      this.isInitialized = true;
      log.info('MTSA SOAP client initialized successfully with HTTP header auth');
    } catch (error) {
      log.error('Failed to initialize MTSA SOAP client', { error: error instanceof Error ? error.message : String(error) });
      throw new Error(`MTSA SOAP client initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute SOAP method with retry logic
   */
  private async executeSoapMethod<T>(
    methodName: string,
    params: any,
    correlationId?: string
  ): Promise<T> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    await this.initialize(correlationId);
    
    if (!this.client) {
      throw new Error('SOAP client not initialized');
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= config.network.retryMax; attempt++) {
      try {
        log.debug(`Executing SOAP method: ${methodName} (attempt ${attempt})`, { params: { ...params, AuthFactor: '[REDACTED]' } });
        
        // Execute SOAP method (HTTP headers are already set in initialize())
        // Try different method invocation patterns based on MTSA API
        let result;
        try {
          // Try with Async suffix first (promise-based)
          if (typeof this.client[methodName + 'Async'] === 'function') {
            const [asyncResult] = await this.client[methodName + 'Async'](params);
            result = asyncResult;
          }
          // Try standard method name with Promise wrapper
          else if (typeof this.client[methodName] === 'function') {
            result = await new Promise((resolve, reject) => {
              this.client[methodName](params, (err: any, result: any) => {
                if (err) reject(err);
                else resolve(result);
              });
            });
          }
          // Try with different casing or patterns
          else {
            // List available methods for debugging
            const methods = Object.getOwnPropertyNames(this.client).filter(prop => typeof this.client[prop] === 'function');
            log.info(`Available SOAP methods`, { methods: methods.slice(0, 20) });
            throw new Error(`Method ${methodName} not found. Available methods logged above.`);
          }
        } catch (methodError) {
          log.error(`Method invocation failed`, { methodName, error: methodError.message });
          throw methodError;
        }
        
        // Try to log available client properties for debugging
        const clientProps = Object.getOwnPropertyNames(this.client);
        log.info(`SOAP Client Properties`, { properties: clientProps.slice(0, 10) });
        
        // Try different ways to access request data
        log.info(`SOAP Request Details for ${methodName}`, {
          hasLastRequest: !!this.client.lastRequest,
          hasLastResponse: !!this.client.lastResponse,
          lastRequestLength: this.client.lastRequest?.length || 0,
          lastResponseLength: this.client.lastResponse?.length || 0
        });
        
        // Log the full SOAP request with base64 fields truncated for readability
        if (this.client.lastRequest) {
          // Truncate base64 image data for logging
          let sanitizedRequest = this.client.lastRequest;
          
          // Truncate common base64 fields
          const base64Fields = [
            'NRICFront', 'NRICBack', 'SelfieImage', 'PassportImage', 
            'pdfInBase64', 'signedPdfInBase64'
          ];
          
          base64Fields.forEach(fieldName => {
            const openTag = `<${fieldName}>`;
            const closeTag = `</${fieldName}>`;
            const regex = new RegExp(`${openTag}([^<]{100})[^<]*${closeTag}`, 'g');
            sanitizedRequest = sanitizedRequest.replace(
              regex, 
              `${openTag}$1...[TRUNCATED BASE64 DATA]${closeTag}`
            );
          });
          
          log.info(`SOAP Request Body (first 500 chars)`, { 
            request: this.client.lastRequest.substring(0, 500) 
          });
          
          // Log full sanitized request for certificate enrollment and revocation
          if (methodName === 'RequestCertificate' || methodName === 'RequestRevokeCert') {
            log.info(`Full SOAP Request for ${methodName} (Base64 truncated)`, { 
              request: sanitizedRequest 
            });
          }
        }
        
        if (this.client.lastResponse) {
          log.info(`SOAP Response Body (first 500 chars)`, { 
            response: this.client.lastResponse.substring(0, 500) 
          });
        }
        
        log.debug(`SOAP method ${methodName} completed successfully`, { 
          statusCode: result?.statusCode,
          hasResult: !!result 
        });
        
        // Check MTSA status code - if successful, break retry loop immediately
        if (result?.statusCode === '000') {
          log.debug(`MTSA returned success status code, breaking retry loop`, { statusCode: result.statusCode });
          return result;
        } else if (result?.statusCode) {
          // MTSA returned an error status code, treat as failure and retry
          log.warn(`MTSA returned error status code (attempt ${attempt}/${config.network.retryMax})`, { 
            statusCode: result.statusCode,
            statusMsg: result.statusMsg 
          });
          lastError = new Error(`MTSA error: ${result.statusCode} - ${result.statusMsg}`);
          
          if (attempt < config.network.retryMax) {
            const delay = config.network.retryBackoffMs * attempt;
            log.debug(`Retrying MTSA call in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            break; // Max attempts reached
          }
        } else {
          // No status code in response, return as-is
          return result;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log.warn(`SOAP method ${methodName} failed (attempt ${attempt}/${config.network.retryMax})`, { 
          error: lastError.message 
        });
        
        if (attempt < config.network.retryMax) {
          const delay = config.network.retryBackoffMs * attempt;
          log.debug(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    log.error(`SOAP method ${methodName} failed after ${config.network.retryMax} attempts`, { 
      error: lastError?.message 
    });
    throw lastError || new Error(`SOAP method ${methodName} failed`);
  }

  /**
   * Request email OTP for certificate enrollment or digital signing
   */
  async requestEmailOTP(
    request: MTSARequestEmailOTPRequest,
    correlationId?: string
  ): Promise<MTSARequestEmailOTPResponse> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    log.info('Requesting email OTP', { 
      userId: request.UserID, 
      otpUsage: request.OTPUsage,
      hasEmail: !!request.EmailAddress 
    });

    const result = await this.executeSoapMethod<MTSARequestEmailOTPResponse>(
      'RequestEmailOTP',
      request,
      correlationId
    );

    // Handle potential undefined result or different response structure
    if (!result) {
      log.warn('Email OTP request returned undefined result');
      return { statusCode: '9999', message: 'No response received' };
    }

    // Handle different possible response structures
    const responseData = (result as any)?.return || result;
    const statusCode = responseData?.statusCode || '9999';
    const statusMsg = responseData?.statusMsg || responseData?.message || 'Unknown response';

    log.info('Email OTP request completed', { 
      statusCode,
      message: statusMsg,
      success: statusCode === '000',
      rawResult: result
    });

    return responseData;
  }

  /**
   * Request certificate enrollment for a new user
   */
  async requestCertificate(
    request: MTSARequestCertificateRequest,
    correlationId?: string
  ): Promise<MTSARequestCertificateResponse> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    // Log request parameters with base64 data truncated
    const sanitizedRequest = { ...request };
    if (sanitizedRequest.NRICFront) {
      sanitizedRequest.NRICFront = `[BASE64 DATA - ${sanitizedRequest.NRICFront.length} chars]`;
    }
    if (sanitizedRequest.NRICBack) {
      sanitizedRequest.NRICBack = `[BASE64 DATA - ${sanitizedRequest.NRICBack.length} chars]`;
    }
    if (sanitizedRequest.SelfieImage) {
      sanitizedRequest.SelfieImage = `[BASE64 DATA - ${sanitizedRequest.SelfieImage.length} chars]`;
    }
    if (sanitizedRequest.PassportImage) {
      sanitizedRequest.PassportImage = `[BASE64 DATA - ${sanitizedRequest.PassportImage.length} chars]`;
    }
    
    log.info('Requesting certificate enrollment', { 
      userId: request.UserID, 
      userType: request.UserType,
      nationality: request.Nationality,
      hasOrganisationInfo: !!request.OrganisationInfo,
      organisationInfo: request.OrganisationInfo
    });
    
    log.info('Full certificate request parameters (Base64 truncated)', sanitizedRequest);

    const result = await this.executeSoapMethod<MTSARequestCertificateResponse>(
      'RequestCertificate',
      request,
      correlationId
    );

    log.info('Certificate enrollment completed', { 
      statusCode: result.statusCode, 
      success: result.statusCode === '000',
      hasCertSerialNo: !!result.certSerialNo 
    });

    return result;
  }

  /**
   * Get certificate information and status
   */
  async getCertInfo(
    request: MTSAGetCertInfoRequest,
    correlationId?: string
  ): Promise<MTSAGetCertInfoResponse> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    log.info('Getting certificate info', { userId: request.UserID });

    const result = await this.executeSoapMethod<MTSAGetCertInfoResponse>(
      'GetCertInfo',
      request,
      correlationId
    );

    // Certificate info retrieved successfully
    
    // Handle response structure - data may be in result.return or at root level
    const responseData = (result as any).return || result;
    const statusCode = responseData.statusCode || result.statusCode;
    
    log.info('Certificate info retrieved', { 
      statusCode: statusCode, 
      success: statusCode === '000',
      certStatus: responseData.certStatus
    });

    return result;
  }

  /**
   * Sign PDF document with user's certificate
   */
  async signPDF(
    request: MTSASignPDFRequest,
    correlationId?: string
  ): Promise<MTSASignPDFResponse> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    log.info('Signing PDF document', { 
      userId: request.UserID,
      hasSignatureInfo: !!request.SignatureInfo,
      visibility: request.SignatureInfo?.visibility,
      hasFieldUpdates: !!request.FieldListToUpdate 
    });

    const result = await this.executeSoapMethod<MTSASignPDFResponse>(
      'SignPDF',
      request,
      correlationId
    );

    // Handle response structure - data may be in result.return or at root level
    const responseData = (result as any).return || result;
    const parsedResult: MTSASignPDFResponse = {
      statusCode: responseData.statusCode || result.statusCode || 'UNKNOWN',
      message: responseData.statusMsg || responseData.message || result.message || 'Unknown error',
      signedPdfInBase64: responseData.signedPdfInBase64 || result.signedPdfInBase64,
      userCert: responseData.userCert || result.userCert
    };

    log.info('PDF signing completed', { 
      statusCode: parsedResult.statusCode, 
      success: parsedResult.statusCode === '000',
      hasSignedPdf: !!parsedResult.signedPdfInBase64 
    });

    return parsedResult;
  }

  /**
   * Verify PDF signature validity
   */
  async verifyPDFSignature(
    request: MTSAVerifyPDFRequest,
    correlationId?: string
  ): Promise<MTSAVerifyPDFResponse> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    log.info('Verifying PDF signature');

    const result = await this.executeSoapMethod<MTSAVerifyPDFResponse>(
      'VerifyPDFSignature',
      request,
      correlationId
    );

    log.info('PDF signature verification completed', { 
      statusCode: result.statusCode, 
      success: result.statusCode === '000',
      totalSignatures: result.totalSignatureInPdf 
    });

    return result;
  }

  /**
   * Request certificate revocation
   */
  async requestRevokeCert(
    request: MTSARequestRevokeCertRequest,
    correlationId?: string
  ): Promise<MTSARequestRevokeCertResponse> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    log.info('Requesting certificate revocation', { 
      userId: request.UserID,
      certSerialNo: request.CertSerialNo,
      revokeReason: request.RevokeReason,
      revokeBy: request.RevokeBy 
    });

    const result = await this.executeSoapMethod<MTSARequestRevokeCertResponse>(
      'RequestRevokeCert',
      request,
      correlationId
    );

    log.info('Certificate revocation completed', { 
      statusCode: result.statusCode, 
      success: result.statusCode === '000',
      revoked: result.revoked 
    });

    return result;
  }

  /**
   * Verify certificate PIN for digital signing
   * 
   * MTSA Response fields:
   * - statusCode: Status code of the request
   * - statusMsg: Status message of the request  
   * - certStatus: Certificate status (Valid or Invalid)
   * - certPinStatus: Certificate PIN status (Valid or Invalid)
   */
  async verifyCertPin(
    request: { UserID: string; CertSerialNo: string; CertPin: string },
    correlationId?: string
  ): Promise<{ statusCode: string; statusMsg: string; pinVerified: boolean; certStatus?: string; certPinStatus?: string }> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    log.info('Verifying certificate PIN', { 
      userId: request.UserID,
      hasCertPin: !!request.CertPin,
      hasCertSerialNo: !!request.CertSerialNo
    });

    const result = await this.executeSoapMethod<{ 
      statusCode: string; 
      statusMsg: string; 
      certStatus?: string;
      certPinStatus?: string;
      return?: { 
        statusCode: string; 
        statusMsg: string;
        certStatus?: string;
        certPinStatus?: string;
      } 
    }>(
      'VerifyCertPin',
      request,
      correlationId
    );

    // Handle potential undefined result or different response structure
    if (!result) {
      log.warn('VerifyCertPin returned undefined result');
      return { statusCode: '9999', statusMsg: 'No response received', pinVerified: false };
    }

    // Handle different possible response structures (data may be in result.return or at root level)
    const responseData = (result as any)?.return || result;
    const statusCode = responseData?.statusCode || '9999';
    const statusMsg = responseData?.statusMsg || 'PIN verification failed';
    const certStatus = responseData?.certStatus;
    const certPinStatus = responseData?.certPinStatus;
    
    // PIN is verified if statusCode is '000' AND certPinStatus is 'Valid'
    const pinVerified = statusCode === '000' && certPinStatus === 'Valid';

    log.info('Certificate PIN verification completed', { 
      statusCode,
      statusMsg,
      certStatus,
      certPinStatus,
      pinVerified,
      rawResult: JSON.stringify(result).slice(0, 500)
    });

    return { statusCode, statusMsg, pinVerified, certStatus, certPinStatus };
  }

  /**
   * Reset certificate PIN for internal users
   */
  async resetCertificatePin(
    request: { UserID: string; CertSerialNo: string; NewPin: string },
    correlationId?: string
  ): Promise<{ statusCode: string; statusMsg: string }> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    log.info('Resetting certificate PIN', { 
      userId: request.UserID,
      certSerialNo: request.CertSerialNo?.slice(0, 8) + '...',
      hasNewPin: !!request.NewPin 
    });

    const result = await this.executeSoapMethod<{ statusCode: string; statusMsg: string; return?: { statusCode: string; statusMsg: string } }>(
      'ResetCertificatePin',
      request,
      correlationId
    );

    // Handle response structure - data may be in result.return or at root level
    const statusCode = result.return?.statusCode || result.statusCode;
    const statusMsg = result.return?.statusMsg || result.statusMsg;

    log.info('Certificate PIN reset completed', { 
      statusCode, 
      success: statusCode === '000'
    });

    return { statusCode, statusMsg };
  }

  /**
   * Check if SOAP client is healthy and can connect
   */
  async healthCheck(correlationId?: string): Promise<boolean> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    try {
      await this.initialize(correlationId);
      
      if (!this.client) {
        return false;
      }

      // Try to describe the service to verify connection
      const description = this.client.describe();
      const hasServices = Object.keys(description).length > 0;
      
      log.debug('MTSA SOAP health check completed', { hasServices });
      return hasServices;
    } catch (error) {
      log.warn('MTSA SOAP health check failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * Close SOAP client connection
   */
  async close(): Promise<void> {
    if (this.client) {
      // SOAP client doesn't have explicit close method, just clear reference
      this.client = null;
      this.isInitialized = false;
      logger.info('MTSA SOAP client connection closed');
    }
  }
}

// Export singleton instance
export const mtsaClient = new MTSAClient();
