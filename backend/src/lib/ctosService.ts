import crypto from 'crypto';
import axios from 'axios';
import { ctosConfig } from './config';

interface CTOSConfig {
  apiKey: string;
  packageName: string;
  securityKey: string; // This is called "md5" in CTOS Postman
  baseUrl: string;
  webhookUrl: string;
  ciphertext: string; // This is called "set_iv" in CTOS Postman  
  cipher: string; // Encryption method
}

interface CreateTransactionRequest {
  ref_id: string;
  document_name: string;
  document_number: string;
  platform: 'Web' | 'iOS' | 'Android';
  response_url?: string;
  backend_url: string;
  callback_mode: number;
  response_mode?: number; // 0 = no queries, 1 = with queries
  document_type?: string; // 1 = NRIC, 3 = Passport
}

interface CreateTransactionResponse {
  ref_id?: string;
  onboarding_id?: string;
  onboarding_url?: string;
  expired_at?: string;
  success?: boolean;
  data?: {
    message?: string;
    name?: string;
    code?: number;
    status?: number;
    type?: string;
  };
}

interface GetStatusRequest {
  ref_id: string;
  onboarding_id: string;
  platform: 'Web' | 'iOS' | 'Android';
  mode: number;
}

interface GetStatusResponse {
  status: number; // 0: Not Opened, 1: Processing, 2: Completed, 3: Expired
  result: number; // 0: Rejected, 1: Approved, 2: Not Available
  step1?: {
    selfie_match: boolean;
    liveness: boolean;
  };
  step2?: {
    document_verification: boolean;
    ocr_front_result: any;
    ocr_back_result: any;
    front_document_image: string; // Base64
    back_document_image: string; // Base64
    face_image: string; // Base64
  };
}

interface WebhookData {
  ref_id: string;
  onboarding_id: string;
  status: number;
  result: number;
  step1?: {
    front_document_image?: string;
    back_document_image?: string;
    [key: string]: any;
  };
  step2?: {
    best_frame?: string;
    [key: string]: any;
  };
  front_document_image?: string;
  back_document_image?: string;
  face_image?: string;
}

export class CTOSService {
  private config: CTOSConfig;

  constructor() {
    // Use centralized config which handles both individual env vars and JSON credentials
    this.config = {
      apiKey: ctosConfig.apiKey,
      packageName: ctosConfig.packageName,
      securityKey: ctosConfig.securityKey,
      baseUrl: ctosConfig.baseUrl,
      webhookUrl: ctosConfig.webhookUrl,
      ciphertext: ctosConfig.ciphertext,
      cipher: ctosConfig.cipher
    };

    // Log warning if CTOS config is incomplete
    if (!this.isConfigured()) {
      console.warn('CTOS configuration incomplete - CTOS features will be disabled. Set CTOS_CREDENTIALS or individual CTOS_* env vars.');
    }
  }

  /**
   * Check if CTOS is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.packageName && this.config.securityKey && this.config.baseUrl);
  }

  /**
   * Generate SHA256 signature for CTOS API
   * Formula: base64_encode(sha256(api_key+SecurityKey+package_name+ref_id+SecurityKey+request_time))
   * Steps: 1) Create SHA256 hex hash, 2) Encode hex to base64
   */
  private generateSignature(params: {
    api_key: string;
    package_name: string;
    ref_id: string;
    request_time: string;
  }): string {
    const { api_key, package_name, ref_id, request_time } = params;
    const stringToSign = `${api_key}${this.config.securityKey}${package_name}${ref_id}${this.config.securityKey}${request_time}`;
    
    console.log('String to sign:', stringToSign);
    
    // Step 1: Create SHA256 hash as hex string
    const hexHash = crypto.createHash('sha256').update(stringToSign).digest('hex');
    console.log('SHA256 hex hash:', hexHash);
    
    // Step 2: Encode hex hash to base64
    const base64Signature = Buffer.from(hexHash).toString('base64');
    console.log('Generated signature (base64):', base64Signature);
    
    return base64Signature;
  }

  /**
   * Get the IV buffer from ciphertext config
   * Handles both plain 16-char strings and Base64-encoded values
   */
  private getIvBuffer(): Buffer {
    const ciphertext = this.config.ciphertext;
    
    // If it's exactly 16 bytes as UTF-8, use directly
    const directBuffer = Buffer.from(ciphertext, 'utf8');
    if (directBuffer.length === 16) {
      return directBuffer;
    }
    
    // Try Base64 decoding
    try {
      const decoded = Buffer.from(ciphertext, 'base64');
      if (decoded.length >= 16) {
        // Take first 16 bytes for IV
        return decoded.slice(0, 16);
      }
      // If decoded is less than 16 bytes, pad with zeros
      const padded = Buffer.alloc(16);
      decoded.copy(padded);
      console.warn(`CTOS IV decoded to ${decoded.length} bytes, padded to 16`);
      return padded;
    } catch {
      // If Base64 fails, pad the direct buffer
      const padded = Buffer.alloc(16);
      directBuffer.copy(padded, 0, 0, Math.min(directBuffer.length, 16));
      console.warn(`CTOS IV is ${directBuffer.length} bytes, padded to 16`);
      return padded;
    }
  }

  /**
   * Get the encryption key buffer
   * Key = (ciphertext + api_key).substring(0, 32) as UTF-8 bytes
   */
  private getKeyBuffer(): Buffer {
    const fullKey = this.config.ciphertext + this.config.apiKey;
    const keyString = fullKey.substring(0, 32);
    const keyBuffer = Buffer.from(keyString, 'utf8');
    
    if (keyBuffer.length < 32) {
      // Pad with zeros if needed
      const padded = Buffer.alloc(32);
      keyBuffer.copy(padded);
      console.warn(`CTOS key is ${keyBuffer.length} bytes, padded to 32`);
      return padded;
    }
    
    return keyBuffer.slice(0, 32);
  }

  /**
   * Encrypt request body using AES-256-CBC (CTOS Method)
   * Key = (ciphertext + API_KEY).substring(0, 32)
   * IV = ciphertext (16 bytes, Base64 decoded if needed)
   */
  private encryptRequestBody(body: object): string {
    const bodyJson = JSON.stringify(body);
    
    console.log('Body to encrypt:', bodyJson);
    
    // Get properly sized key and IV
    const key = this.getKeyBuffer();
    const iv = this.getIvBuffer();
    
    console.log('Key buffer length:', key.length);
    console.log('IV buffer length:', iv.length);
    
    if (key.length !== 32) {
      throw new Error(`Invalid CTOS key length: ${key.length} bytes (expected 32). Check CTOS_CIPHERTEXT and CTOS_API_KEY configuration.`);
    }
    if (iv.length !== 16) {
      throw new Error(`Invalid CTOS IV length: ${iv.length} bytes (expected 16). Check CTOS_CIPHERTEXT configuration.`);
    }
    
    const cipher = crypto.createCipheriv(this.config.cipher, key, iv);
    let encrypted = cipher.update(bodyJson, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    console.log('Encrypted data:', encrypted.substring(0, 50) + '...');
    return encrypted;
  }

  /**
   * Decrypt AES-256-CBC encrypted response (CTOS Method)
   * Uses same key generation as encryption
   */
  private decryptResponseData(encryptedData: string): any {
    try {
      console.log('Decrypting response...');
      
      // Use same key/IV generation as encryption
      const key = this.getKeyBuffer();
      const iv = this.getIvBuffer();
      
      console.log('Key buffer length:', key.length);
      console.log('IV buffer length:', iv.length);
      
      const decipher = crypto.createDecipheriv(this.config.cipher, key, iv);
      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      console.log('Decrypted response:', decrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error(`Failed to decrypt CTOS response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new eKYC transaction
   */
  async createTransaction(params: CreateTransactionRequest): Promise<CreateTransactionResponse> {
    const requestTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
    
    // Log all config values for debugging
    console.log('=== CTOS CONFIG DEBUG ===');
    console.log('baseUrl:', this.config.baseUrl);
    console.log('webhookUrl:', this.config.webhookUrl);
    console.log('apiKey:', this.config.apiKey ? `${this.config.apiKey.substring(0, 8)}...` : 'NOT SET');
    console.log('packageName:', this.config.packageName);
    console.log('ciphertext:', this.config.ciphertext);
    console.log('cipher:', this.config.cipher);
    console.log('=== END CTOS CONFIG DEBUG ===');

    // Log incoming params
    console.log('=== CTOS TRANSACTION PARAMS ===');
    console.log('response_url:', params.response_url);
    console.log('backend_url:', params.backend_url);
    console.log('=== END PARAMS ===');

    // Validate URLs before proceeding
    const targetUrl = `${this.config.baseUrl}/v2/gateway/create-transaction`;
    console.log('Target CTOS URL:', targetUrl);
    
    try {
      new URL(targetUrl);
    } catch (urlError) {
      console.error('Invalid CTOS base URL:', this.config.baseUrl);
      throw new Error(`Invalid CTOS base URL configured: "${this.config.baseUrl}"`);
    }

    if (params.response_url) {
      try {
        new URL(params.response_url);
      } catch (urlError) {
        console.error('Invalid response_url:', params.response_url);
        throw new Error(`Invalid response_url: "${params.response_url}"`);
      }
    }

    if (params.backend_url) {
      try {
        new URL(params.backend_url);
      } catch (urlError) {
        console.error('Invalid backend_url (webhook):', params.backend_url);
        throw new Error(`Invalid backend_url (webhook): "${params.backend_url}"`);
      }
    }

    const requestBody = {
      ref_id: params.ref_id,
      document_name: params.document_name,
      document_number: params.document_number,
      platform: params.platform,
      response_url: params.response_url || '',
      backend_url: params.backend_url,
      callback_mode: params.callback_mode.toString(), // Convert to string
      response_mode: (params.response_mode || 0).toString(), // Default to 0 (no queries)
      document_type: params.document_type || '1', // Default to NRIC (1)
      signature: this.generateSignature({
        api_key: this.config.apiKey,
        package_name: this.config.packageName,
        ref_id: params.ref_id,
        request_time: requestTime
      }),
      request_time: requestTime,
      api_key: this.config.apiKey,
      package_name: this.config.packageName
    };

    console.log('=== CTOS REQUEST BODY (before encryption) ===');
    console.log(JSON.stringify(requestBody, null, 2));
    console.log('=== END REQUEST BODY ===');

    try {
      // Encrypt the request body
      const encryptedData = this.encryptRequestBody(requestBody);
      
      // Create the encrypted request payload
      const encryptedPayload = {
        data: encryptedData,
        api_key: this.config.apiKey
      };

      console.log('=== ENCRYPTED PAYLOAD ===');
      console.log(JSON.stringify(encryptedPayload, null, 2));
      console.log('=== END ENCRYPTED PAYLOAD ===');

      console.log('Making request to:', targetUrl);
      const response = await axios.post(
        targetUrl,
        encryptedPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('CTOS Create Transaction Response:', response.data);
      
      // Check if response is encrypted
      if (response.data && typeof response.data.data === 'string') {
        console.log('Response appears to be encrypted, decrypting...');
        const decryptedData = this.decryptResponseData(response.data.data);
        return decryptedData;
      }
      
      // Check if CTOS returned an error in the response
      if (response.data && !response.data.onboarding_id) {
        console.error('CTOS API returned error:', response.data);
        throw new Error(`CTOS API Error: ${response.data.message || response.data.data?.message || 'Unknown error from CTOS'}`);
      }
      
      // Also check for errors even when onboarding_id exists
      if (response.data && response.data.data) {
        const errorMsg = response.data.data.message;
        const errorCode = response.data.data.error_code;
        
        if (errorMsg === "Failed" || errorCode === "103" || errorMsg?.toLowerCase().includes("duplicate") || errorMsg?.toLowerCase().includes("error")) {
          console.error('CTOS API returned error with onboarding_id:', response.data);
          throw new Error(`CTOS API Error: ${response.data.data.description || response.data.data.message || 'CTOS transaction failed'}`);
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('CTOS Create Transaction Error:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
        
        // Extract CTOS error message if available
        const ctosError = error.response?.data;
        if (ctosError && ctosError.data?.message) {
          throw new Error(`CTOS API Error: ${ctosError.data.message}`);
        } else if (ctosError && ctosError.message) {
          throw new Error(`CTOS API Error: ${ctosError.message}`);
        }
      }
      
      // Re-throw if it's already a formatted CTOS error
      if (error instanceof Error && error.message.startsWith('CTOS API Error:')) {
        throw error;
      }
      
      throw new Error(`Failed to create CTOS transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get status of an eKYC transaction
   */
  async getStatus(params: GetStatusRequest): Promise<GetStatusResponse> {
    const requestTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
    
    const requestBody = {
      api_key: this.config.apiKey,
      package_name: this.config.packageName,
      ref_id: params.ref_id,
      onboarding_id: params.onboarding_id,
      platform: params.platform,
      mode: params.mode,
      signature: this.generateSignature({
        api_key: this.config.apiKey,
        package_name: this.config.packageName,
        ref_id: params.ref_id,
        request_time: requestTime
      }),
      request_time: requestTime
    };

    try {
      // Encrypt the request body
      const encryptedData = this.encryptRequestBody(requestBody);
      
      // Create the encrypted request payload
      const encryptedPayload = {
        data: encryptedData,
        api_key: this.config.apiKey
      };

      const response = await axios.post(
        `${this.config.baseUrl}/v2/gateway/get-status`,
        encryptedPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );

      // Check if response is encrypted
      if (response.data && typeof response.data.data === 'string') {
        const decryptedData = this.decryptResponseData(response.data.data);
        return decryptedData;
      }

      return response.data;
    } catch (error) {
      console.error('CTOS Get Status Error:', error);
      throw new Error(`Failed to get CTOS status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process webhook data from CTOS
   */
  processWebhookData(data: any): WebhookData {
    try {
      // Check if data is encrypted
      if (typeof data.data === 'string') {
        console.log('Webhook data appears to be encrypted, decrypting...');
        return this.decryptResponseData(data.data);
      }
      
      // Data is already decrypted
      return data as WebhookData;
    } catch (error) {
      console.error('Webhook processing error:', error);
      throw new Error(`Failed to process webhook data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate webhook signature (placeholder for future implementation)
   */
  validateWebhookSignature(_signature: string, _data: any): boolean {
    // TODO: Implement webhook signature validation if required by CTOS
    return true;
  }
}

// Export singleton instance
export const ctosService = new CTOSService();