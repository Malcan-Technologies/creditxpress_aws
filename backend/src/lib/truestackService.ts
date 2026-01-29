import crypto from 'crypto';
import axios from 'axios';
import { truestackConfig } from './config';

/**
 * Truestack KYC Service
 * 
 * Replaces CTOS eKYC with Truestack's simpler REST API.
 * Uses Bearer token authentication instead of encrypted payloads.
 */

// Status mapping from Truestack string values to numeric codes (matching CTOS format for backwards compatibility)
export const STATUS_MAP: Record<string, number> = {
  'pending': 0,     // Not opened
  'processing': 1,  // In progress
  'completed': 2,   // Done
  'expired': 3      // Expired
};

// Result mapping from Truestack string values to numeric codes
export const RESULT_MAP: Record<string, number> = {
  'approved': 1,
  'rejected': 0
};

// Interfaces for API requests/responses
export interface CreateSessionRequest {
  ref_id: string;
  document_name: string;
  document_number: string;
  platform: 'Web' | 'iOS' | 'Android';
  redirect_url?: string;
  document_type?: '1' | '2'; // 1 = MyKad, 2 = Passport
  metadata?: Record<string, string>;
}

export interface CreateSessionResponse {
  id: string;
  onboarding_url: string;
  expires_at: string;
  status: string;
}

export interface SessionStatusResponse {
  id: string;
  status: string; // 'pending' | 'processing' | 'completed' | 'expired'
  result?: string; // 'approved' | 'rejected' | null
  document_name?: string;
  document_number?: string;
  document_type?: string;
  metadata?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  ocr_result?: {
    name?: string;
    id_number?: string;
    address?: string;
  };
  documents?: {
    front_document?: string;
    back_document?: string;
    face_image?: string;
    best_frame?: string;
  };
}

export interface RefreshSessionResponse {
  id: string;
  ref_id?: string;
  status: string;
  result?: string;
  reject_message?: string | null;
  refreshed: boolean;
  document?: {
    full_name?: string;
    id_number?: string;
    id_number_back?: string;
    address?: string;
    gender?: string;
  };
  verification?: {
    document_valid?: boolean;
    name_match?: boolean;
    id_match?: boolean;
    front_back_match?: boolean;
    landmark_valid?: boolean;
    face_match?: boolean;
    face_match_score?: number;
    liveness_passed?: boolean;
  };
  images?: {
    front_document?: string;
    back_document?: string;
    face_image?: string;
    best_frame?: string;
  };
}

export interface WebhookPayload {
  event: string; // 'kyc.session.completed' | 'kyc.session.expired'
  timestamp: string;
  data: {
    session_id: string;
    ref_id?: string;
    status: string;
    result?: string;
    document_name?: string;
    document_number?: string;
    ocr_data?: {
      name?: string;
      ic_number?: string;
      address?: string;
      gender?: string;
      nationality?: string;
      date_of_birth?: string;
    };
    face_match_score?: number;
    liveness_score?: number;
    metadata?: Record<string, string>;
  };
}

// Normalized response format (matching existing CTOS response structure for backwards compatibility)
export interface NormalizedStatusResponse {
  status: number; // 0: Not Opened, 1: Processing, 2: Completed, 3: Expired
  result: number; // 0: Rejected, 1: Approved, 2: Not Available
  reject_message?: string | null;
  step1?: {
    selfie_match?: boolean;
    liveness?: boolean;
    front_document_image?: string;
    back_document_image?: string;
  };
  step2?: {
    document_verification?: boolean;
    ocr_front_result?: any;
    ocr_back_result?: any;
    face_image?: string;
    best_frame?: string;
  };
  // Raw Truestack data
  raw?: RefreshSessionResponse;
}

export class TruestackService {
  private apiKey: string;
  private baseUrl: string;
  private webhookUrl: string;

  constructor() {
    this.apiKey = truestackConfig.apiKey;
    this.baseUrl = truestackConfig.baseUrl;
    this.webhookUrl = truestackConfig.webhookUrl;

    if (!this.isConfigured()) {
      console.warn('Truestack configuration incomplete - KYC features will be disabled. Set TRUESTACK_API_KEY env var or TRUESTACK_CREDENTIALS secret.');
    }
  }

  /**
   * Check if Truestack is properly configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.baseUrl);
  }

  /**
   * Get authorization headers for API requests
   */
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Create a new KYC verification session
   */
  async createSession(params: CreateSessionRequest): Promise<CreateSessionResponse> {
    console.log('=== TRUESTACK CREATE SESSION ===');
    console.log('baseUrl:', this.baseUrl);
    console.log('webhookUrl:', this.webhookUrl);
    console.log('apiKey:', this.apiKey ? `${this.apiKey.substring(0, 12)}...` : 'NOT SET');
    console.log('params:', {
      document_name: params.document_name,
      document_number: params.document_number ? `${params.document_number.substring(0, 6)}...` : 'NOT SET',
      platform: params.platform,
      redirect_url: params.redirect_url
    });

    const requestBody = {
      document_name: params.document_name,
      document_number: params.document_number,
      webhook_url: this.webhookUrl,
      redirect_url: params.redirect_url,
      document_type: params.document_type || '1', // Default to MyKad
      platform: params.platform,
      metadata: {
        ref_id: params.ref_id,
        ...params.metadata
      }
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/kyc/sessions`,
        requestBody,
        {
          headers: this.getHeaders(),
          timeout: 30000
        }
      );

      console.log('Truestack Create Session Response:', response.data);
      return response.data;

    } catch (error) {
      console.error('Truestack Create Session Error:', error);
      
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
        
        const errorData = error.response?.data;
        if (errorData?.message) {
          throw new Error(`Truestack API Error: ${errorData.message}`);
        }
        if (errorData?.error) {
          throw new Error(`Truestack API Error: ${errorData.error}`);
        }
      }
      
      throw new Error(`Failed to create Truestack session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current status of a KYC session
   */
  async getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v1/kyc/sessions/${sessionId}`,
        {
          headers: this.getHeaders(),
          timeout: 30000
        }
      );

      console.log('Truestack Get Session Status Response:', response.data);
      return response.data;

    } catch (error) {
      console.error('Truestack Get Session Status Error:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('Truestack session not found');
        }
        console.error('Response data:', error.response?.data);
      }
      
      throw new Error(`Failed to get Truestack session status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh session status - fetches latest from Truestack's verification system
   * Use this when webhooks are delayed or to verify current status
   */
  async refreshSessionStatus(sessionId: string): Promise<RefreshSessionResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/kyc/sessions/${sessionId}`,
        {}, // Empty body for refresh
        {
          headers: this.getHeaders(),
          timeout: 30000
        }
      );

      console.log('Truestack Refresh Session Status Response:', response.data);
      return response.data;

    } catch (error) {
      console.error('Truestack Refresh Session Status Error:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('Truestack session not found');
        }
        console.error('Response data:', error.response?.data);
      }
      
      throw new Error(`Failed to refresh Truestack session status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Normalize Truestack response to match existing CTOS format for backwards compatibility
   */
  normalizeStatusResponse(response: RefreshSessionResponse): NormalizedStatusResponse {
    const statusNum = STATUS_MAP[response.status] ?? 0;
    let resultNum = 2; // Default: Not Available
    
    if (response.result) {
      resultNum = RESULT_MAP[response.result] ?? 2;
    }

    return {
      status: statusNum,
      result: resultNum,
      reject_message: response.reject_message,
      step1: {
        selfie_match: response.verification?.face_match,
        liveness: response.verification?.liveness_passed,
        front_document_image: response.images?.front_document,
        back_document_image: response.images?.back_document
      },
      step2: {
        document_verification: response.verification?.document_valid,
        ocr_front_result: response.document,
        ocr_back_result: null,
        face_image: response.images?.face_image,
        best_frame: response.images?.best_frame
      },
      raw: response
    };
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', this.apiKey)
        .update(payload)
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }

  /**
   * Process webhook payload from Truestack
   */
  processWebhookPayload(body: any, signatureHeader?: string): WebhookPayload {
    // Verify signature if provided
    if (signatureHeader) {
      const payload = JSON.stringify(body);
      if (!this.verifyWebhookSignature(payload, signatureHeader)) {
        console.warn('Truestack webhook signature verification failed');
        // Continue processing but log the warning
        // In production, you may want to reject invalid signatures
      }
    }

    return body as WebhookPayload;
  }

  /**
   * Download image from Truestack CDN URL and convert to base64 data URL
   * This maintains compatibility with existing code that expects base64 data URLs
   */
  async downloadAndStoreImage(imageUrl: string): Promise<string> {
    try {
      console.log(`Downloading image from Truestack: ${imageUrl.substring(0, 50)}...`);
      
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'Accept': 'image/*'
        }
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const base64 = buffer.toString('base64');
      
      console.log(`Downloaded image: ${buffer.length} bytes, type: ${contentType}`);
      
      return `data:${contentType};base64,${base64}`;

    } catch (error) {
      console.error('Failed to download image from Truestack:', error);
      throw new Error(`Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download all images from a session response and convert to base64
   * Returns an object with base64 data URLs for each image type
   */
  async downloadSessionImages(images: RefreshSessionResponse['images']): Promise<{
    front_document_image?: string;
    back_document_image?: string;
    face_image?: string;
    best_frame?: string;
  }> {
    const result: {
      front_document_image?: string;
      back_document_image?: string;
      face_image?: string;
      best_frame?: string;
    } = {};

    const downloadTasks: Promise<void>[] = [];

    if (images?.front_document) {
      downloadTasks.push(
        this.downloadAndStoreImage(images.front_document)
          .then(base64 => { result.front_document_image = base64; })
          .catch(err => console.error('Failed to download front document:', err))
      );
    }

    if (images?.back_document) {
      downloadTasks.push(
        this.downloadAndStoreImage(images.back_document)
          .then(base64 => { result.back_document_image = base64; })
          .catch(err => console.error('Failed to download back document:', err))
      );
    }

    if (images?.face_image) {
      downloadTasks.push(
        this.downloadAndStoreImage(images.face_image)
          .then(base64 => { result.face_image = base64; })
          .catch(err => console.error('Failed to download face image:', err))
      );
    }

    if (images?.best_frame) {
      downloadTasks.push(
        this.downloadAndStoreImage(images.best_frame)
          .then(base64 => { result.best_frame = base64; })
          .catch(err => console.error('Failed to download best frame:', err))
      );
    }

    // Download all images in parallel
    await Promise.all(downloadTasks);

    return result;
  }

  /**
   * Map Truestack webhook data to normalized format matching existing CTOS webhook handling
   */
  normalizeWebhookData(webhook: WebhookPayload): {
    ref_id: string;
    onboarding_id: string;
    status: number;
    result: number;
    ocr_data?: any;
    face_match_score?: number;
    liveness_score?: number;
  } {
    const statusNum = STATUS_MAP[webhook.data.status] ?? 0;
    let resultNum = 2; // Default: Not Available
    
    if (webhook.data.result) {
      resultNum = RESULT_MAP[webhook.data.result] ?? 2;
    }

    return {
      ref_id: webhook.data.metadata?.ref_id || webhook.data.session_id,
      onboarding_id: webhook.data.session_id,
      status: statusNum,
      result: resultNum,
      ocr_data: webhook.data.ocr_data,
      face_match_score: webhook.data.face_match_score,
      liveness_score: webhook.data.liveness_score
    };
  }
}

// Export singleton instance
export const truestackService = new TruestackService();
