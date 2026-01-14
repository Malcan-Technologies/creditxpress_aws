import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { ctosB2BConfig } from './config';

interface CTOSB2BConfig {
  companyCode: string;
  accountNo: string;
  userId: string;
  clientId: string;
  ssoPassword: string;
  ssoUrl: string;      // Separate SSO base URL
  apiUrl: string;      // Enquiry API base URL
}

interface CreditReportRequest {
  icNumber: string;
  fullName: string;
}

interface CreditReportResponse {
  success: boolean;
  data?: {
    creditScore?: number;           // CTOS Score (FICO score) - ranges 300-850
    dueDiligentIndex?: string;      // DDI - e.g., "0000"
    riskGrade?: string;              // Risk grade derived from CTOS Score: A, B, C, D, E
    litigationIndex?: string;        // CTOS Litigation Index - ranges 9999 (bad) to 0000 (good)
    summaryStatus?: string;          // Summary status - e.g., "1000"
    totalOutstanding?: number;       // Total outstanding credit facilities
    activeAccounts?: number;         // Number of active credit accounts
    defaultedAccounts?: number;      // Number of defaulted accounts
    legalCases?: number;             // Number of legal cases
    bankruptcyRecords?: number;      // Bankruptcy status (0 or 1)
    [key: string]: any; // For raw response fields
  };
  rawResponse?: any;
  error?: string;
  requestId?: string; // For two-step process
}

export class CTOSB2BService {
  private config: CTOSB2BConfig;
  private privateKey: string | null = null;
  // Token management for CTOS access tokens
  private accessToken: string | null = null;
  private accessTokenExpiry: number | null = null;

  constructor() {
    this.config = {
      companyCode: ctosB2BConfig.companyCode,
      accountNo: ctosB2BConfig.accountNo,
      userId: ctosB2BConfig.userId,
      clientId: ctosB2BConfig.clientId,
      ssoPassword: ctosB2BConfig.ssoPassword,
      ssoUrl: ctosB2BConfig.ssoUrl,
      apiUrl: ctosB2BConfig.apiUrl,
    };

    // Check if mock mode is enabled
    if (ctosB2BConfig.mockMode) {
      console.log('⚠️  CTOS B2B: Running in MOCK MODE - returning test data instead of calling real API');
      // Skip validation and key loading in mock mode
      return;
    }

    // Validate required configuration
    if (!this.config.companyCode || !this.config.accountNo || !this.config.userId || 
        !this.config.clientId || !this.config.ssoPassword || !this.config.ssoUrl || !this.config.apiUrl) {
      throw new Error('Missing required CTOS B2B configuration. Please check environment variables.');
    }

    // Load private key
    this.loadPrivateKey();
  }

  /**
   * Load RSA private key from environment variable
   * Supports both raw key value and base64-encoded key
   */
  private loadPrivateKey(): void {
    try {
      const privateKeyEnv = ctosB2BConfig.privateKey;

      if (!privateKeyEnv) {
        throw new Error('CTOS_B2B_PRIVATE_KEY environment variable is not set');
      }

      // Handle base64-encoded private key (common in CI/CD environments)
      let privateKeyValue = privateKeyEnv;
      
      // Try to decode if it looks like base64 (contains only base64 chars and no newlines)
      if (!privateKeyValue.includes('\n') && /^[A-Za-z0-9+/=\s]+$/.test(privateKeyValue.trim())) {
        try {
          privateKeyValue = Buffer.from(privateKeyValue.trim(), 'base64').toString('utf8');
        } catch (e) {
          // If decoding fails, use original value (might be raw key)
        }
      }

      // Replace literal \n with actual newlines (for GitHub secrets stored as single line)
      privateKeyValue = privateKeyValue.replace(/\\n/g, '\n');

      // Validate that it looks like a private key
      if (!privateKeyValue.includes('BEGIN') || !privateKeyValue.includes('PRIVATE KEY')) {
        throw new Error('CTOS_B2B_PRIVATE_KEY does not appear to be a valid RSA private key');
      }

      this.privateKey = privateKeyValue;
      console.log('CTOS B2B: Private key loaded successfully from environment variable');
    } catch (error) {
      console.error('CTOS B2B: Failed to load private key:', error);
      throw new Error(`Failed to load CTOS B2B private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate IC number format (Malaysian IC: 12 digits)
   */
  validateICNumber(icNumber: string): boolean {
    // Remove any spaces or dashes
    const cleaned = icNumber.replace(/[\s-]/g, '');
    
    // Malaysian IC should be 12 digits
    if (!/^\d{12}$/.test(cleaned)) {
      return false;
    }

    return true;
  }

  /**
   * Generate JWT token for CTOS B2B API authentication
   * Uses RS256 algorithm with the private key
   * This JWT is used to authenticate with CTOS login endpoint
   */
  private generateJWT(): string {
    if (!this.privateKey) {
      throw new Error('Private key not loaded');
    }

    const now = Math.floor(Date.now() / 1000);
    // For OAuth 2.0 JWT Bearer Token, audience should be the token endpoint URL (per CTOS spec)
    const tokenEndpoint = `${this.config.ssoUrl}/auth/realms/CTOSNET/protocol/openid-connect/token`;
    
    // Generate unique token ID for jti claim (required by CTOS spec)
    const tokenId = crypto.randomUUID();
    
    // Create JWT payload according to CTOS ENQWS v5.11.0 specification
    const payload = {
      jti: tokenId,                    // Unique token identifier (required)
      sub: this.config.clientId,      // Subject = CLIENT_ID (per CTOS spec)
      iss: this.config.clientId,      // Issuer = CLIENT_ID
      aud: tokenEndpoint,              // Audience = Full token endpoint URL
      exp: now + 300,                  // Expiry = Current time + 300 seconds (5 minutes per CTOS spec)
      iat: now,                        // Issued at = Current timestamp
    };

    try {
      const token = jwt.sign(payload, this.privateKey, {
        algorithm: 'RS256',
      });

      console.log('CTOS B2B: JWT token generated successfully');
      console.log('CTOS B2B: JWT payload:', JSON.stringify(payload, null, 2));
      return token;
    } catch (error) {
      console.error('CTOS B2B: Failed to generate JWT:', error);
      throw new Error(`Failed to generate JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 1: Login to CTOS B2B API and obtain access token
   * Exchanges JWT for an access token that can be used for API calls
   */
  private async login(): Promise<string> {
    const jwtToken = this.generateJWT();

	console.log('CTOS B2B: JWT token:', jwtToken);

	try {
		console.log('CTOS B2B: Logging in to get access token...');
		
		// Based on CTOS ENQWS v5.11.0 spec - SSO login endpoint (Keycloak OpenID Connect)
		// Using JWT client assertion for authentication
		const loginUrl = `${this.config.ssoUrl}/auth/realms/CTOSNET/protocol/openid-connect/token`;
		
		// Prepare form data for OAuth2 with JWT client assertion
		const formData = new URLSearchParams();
		formData.append('grant_type', 'password');
		formData.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
		formData.append('client_assertion', jwtToken);  // Use JWT instead of Authorization header
		formData.append('username', this.config.userId);
		formData.append('password', this.config.ssoPassword);
		
		const response = await axios.post(
		  loginUrl,
		  formData.toString(),
		  {
			headers: {
			  'Content-Type': 'application/x-www-form-urlencoded',
			  'Accept': 'application/json',
			},
			timeout: 30000,
		  }
		);
  
		// Extract access token from response (CTOS may return it in different formats)
		const accessToken = response.data.accessToken || 
						   response.data.access_token || 
						   response.data.token ||
						   response.data.data?.accessToken;
  
		// Extract expiry time (default to 300 seconds / 5 minutes if not provided)
		const expiresIn = response.data.expiresIn || 
						 response.data.expires_in || 
						 response.data.expires || 
						 300; // Default 5 minutes
  
		if (!accessToken) {
		  throw new Error('No access token returned from CTOS login endpoint');
		}
  
		// Store the access token and its expiry time
		this.accessToken = accessToken;
		this.accessTokenExpiry = Date.now() + (expiresIn * 1000);
  
		console.log(`CTOS B2B: Login successful, access token received (expires in ${expiresIn}s)`);
		return accessToken;
	  } catch (error) {
      console.error('CTOS B2B: Login failed:', error);
      
      // Clear any stored token on login failure
      this.accessToken = null;
      this.accessTokenExpiry = null;

      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        const statusCode = error.response?.status;
        
        // Log full error response for debugging
        console.error('CTOS B2B: Error response:', {
          status: statusCode,
          data: errorData,
          url: error.config?.url,
        });
        
        const errorMessage = errorData?.error_description || 
                           errorData?.message || 
                           errorData?.error || 
                           error.message || 
                           'Unknown error from CTOS B2B API';
        throw new Error(`CTOS B2B Login Error: ${errorMessage}`);
      }
      
      throw new Error(`Failed to login to CTOS B2B: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 3: Get valid access token with automatic refresh
   * Checks if current token is valid, refreshes if expired or about to expire
   */
  private async getValidAccessToken(): Promise<string> {
    // Check if we have a token and it's still valid (with 30 second buffer)
    if (this.accessToken && this.accessTokenExpiry) {
      const timeUntilExpiry = this.accessTokenExpiry - Date.now();
      if (timeUntilExpiry > 30000) { // More than 30 seconds left
        console.log(`CTOS B2B: Using existing access token (expires in ${Math.floor(timeUntilExpiry / 1000)}s)`);
        return this.accessToken;
      }
      
      console.log('CTOS B2B: Access token expired or about to expire, refreshing...');
    } else {
      console.log('CTOS B2B: No access token found, logging in...');
    }

    // Token is expired, missing, or about to expire - get a new one
    return await this.login();
  }

  /**
   * Generate mock credit report data for testing
   */
  private generateMockCreditReport(icNumber: string, fullName: string): CreditReportResponse {
    console.log('CTOS B2B: Generating mock credit report for:', { icNumber, fullName });
    
    // Generate realistic mock data based on IC number
    const icLastDigit = parseInt(icNumber.slice(-1));
    const creditScore = 600 + (icLastDigit * 10) + Math.floor(Math.random() * 50);
    const riskGrades = ['A', 'B', 'C', 'D'];
    const riskGrade = riskGrades[Math.min(Math.floor(icLastDigit / 3), 3)];
    const ddiScores = ['A', 'B', 'C', 'D'];
    const dueDiligentIndex = ddiScores[Math.min(Math.floor(icLastDigit / 3), 3)];
    
    const mockData = {
      creditScore: Math.min(creditScore, 850),
      dueDiligentIndex: dueDiligentIndex,
      riskGrade: riskGrade,
      summaryStatus: creditScore >= 700 ? 'GOOD' : creditScore >= 600 ? 'FAIR' : 'POOR',
      totalOutstanding: Math.floor(Math.random() * 50000) + 10000,
      activeAccounts: Math.floor(Math.random() * 5) + 1,
      defaultedAccounts: icLastDigit < 3 ? Math.floor(Math.random() * 2) : 0,
      legalCases: icLastDigit < 2 ? 0 : Math.floor(Math.random() * 2),
      bankruptcyRecords: icLastDigit === 0 ? 1 : 0,
    };

    const mockRawResponse = {
      ...mockData,
      reportId: `MOCK_${Date.now()}`,
      reportDate: new Date().toISOString(),
      icNumber: icNumber.replace(/[\s-]/g, ''),
      fullName: fullName,
      reportType: 'INDIVIDUAL',
      generatedAt: new Date().toISOString(),
      mock: true,
    };

    return {
      success: true,
      data: mockData,
      rawResponse: mockRawResponse,
    };
  }

  /**
   * Request credit report from CTOS B2B API (Step 1 - No charges)
   * Returns a request ID that must be confirmed in step 2
   */
  async requestCreditReport(params: CreditReportRequest): Promise<CreditReportResponse> {
    const { icNumber, fullName } = params;

    // Validate IC number
    if (!this.validateICNumber(icNumber)) {
      throw new Error('Invalid IC number format. Malaysian IC must be 12 digits.');
    }

    // Check if mock mode is enabled
	console.log('CTOS B2B: Mock mode:', ctosB2BConfig.mockMode);

    if (ctosB2BConfig.mockMode) {
      // Return mock request ID
      const mockRequestId = `MOCK_REQ_${Date.now()}`;
      console.log('CTOS B2B: Mock mode - returning request ID:', mockRequestId);
      return {
        success: true,
        requestId: mockRequestId,
        data: undefined,
        rawResponse: {
          requestId: mockRequestId,
          status: 'PENDING',
          mock: true,
        },
      };
    }

    // Get valid access token (with automatic refresh if needed)
    const token = await this.getValidAccessToken();

    try {
      const cleanedIc = icNumber.replace(/[\s-]/g, '');
      const cleanedName = fullName.trim().toUpperCase();

      console.log('CTOS B2B: Requesting credit report (Step 1 - SOAP) for:', { icNumber: cleanedIc, fullName: cleanedName });

      // Generate request ID (format: BB-{number}-{timestamp})
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '');
      const requestId = `BB-${Math.floor(Math.random() * 10000)}-${timestamp}`;

      // Build SOAP envelope with ws:request operation
      const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.proxy.xml.ctos.com.my/">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:request>
      <!--Optional:-->
      <input>
        &lt;batch output='0' no='0009' xmlns='http://ws.cmctos.com.my/ctosnet/request'&gt;
          &lt;company_code&gt;${this.config.companyCode}&lt;/company_code&gt;
          &lt;account_no&gt;${this.config.accountNo}&lt;/account_no&gt;
          &lt;user_id&gt;${this.config.userId}&lt;/user_id&gt;
          &lt;request_id&gt;${requestId}&lt;/request_id&gt;
          &lt;record_total&gt;1&lt;/record_total&gt;
          &lt;records&gt;
            &lt;type code="11"&gt;I&lt;/type&gt;
            &lt;ic_lc&gt;&lt;/ic_lc&gt;
            &lt;nic_br&gt;${cleanedIc}&lt;/nic_br&gt;
            &lt;name&gt;${cleanedName}&lt;/name&gt;
            &lt;ref_no&gt;12345&lt;/ref_no&gt;
            &lt;purpose code='200'&gt;Credit evaluation/account opening on subject/directors/shareholder with consent /due diligence on AMLA compliance&lt;/purpose&gt;
            &lt;include_ctos&gt;1&lt;/include_ctos&gt;
            &lt;include_trex&gt;1&lt;/include_trex&gt;
            &lt;include_ssm&gt;0&lt;/include_ssm&gt;
            &lt;include_ssm_retention&gt;0&lt;/include_ssm_retention&gt;
            &lt;include_ccris sum="0"&gt;1&lt;/include_ccris&gt;
            &lt;include_ccris_supp&gt;1&lt;/include_ccris_supp&gt;
            &lt;include_etr_plus&gt;2&lt;/include_etr_plus&gt;
            &lt;include_fico&gt;1&lt;/include_fico&gt;
            &lt;confirm_entity&gt;&lt;/confirm_entity&gt;
          &lt;/records&gt;
        &lt;/batch&gt;
      </input>
    </ws:request>
  </soapenv:Body>
</soapenv:Envelope>`;

      // Make SOAP API call to CTOS B2B Proxy endpoint
      const proxyUrl = `${this.config.apiUrl}/ctos_secure/Proxy`;
      
      console.log('CTOS B2B: Making SOAP request to:', proxyUrl);
      console.log('CTOS B2B: API URL from config:', this.config.apiUrl);
      
      const response = await axios.post(
        proxyUrl,
        soapBody,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/xml',
            'SOAPAction': '',
          },
          timeout: 30000,
        }
      );

      console.log('CTOS B2B: Request API SOAP response received');
      console.log('CTOS B2B: Raw SOAP response (first 500 chars):', typeof response.data === 'string' ? response.data.substring(0, 500) : JSON.stringify(response.data).substring(0, 500));

      // Parse SOAP response to extract request_id
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
      });

      const parsedResponse = parser.parse(response.data);
      
      // Extract the base64 encoded return value
      const returnValue = parsedResponse?.['S:Envelope']?.['S:Body']?.['ns2:requestResponse']?.return;
      
      if (!returnValue) {
        throw new Error('No return value in SOAP response');
      }

      // Log the base64 encoded message
      console.log('CTOS B2B: Base64 encoded return value (first 200 chars):', returnValue.substring(0, 200));
      console.log('CTOS B2B: Base64 encoded return value length:', returnValue.length);

      // Decode base64 to get XML
      const decodedXml = Buffer.from(returnValue, 'base64').toString('utf-8');
      console.log('CTOS B2B: Decoded XML (first 500 chars):', decodedXml.substring(0, 500));
      
      const decodedParsed = parser.parse(decodedXml);
      
      // Extract request_id from the decoded XML
      // The request_id should be in the enq_report id attribute or in the batch
      const reportId = decodedParsed?.report?.enq_report?.['@_id'] || 
                       decodedParsed?.enq_report?.['@_id'] ||
                       requestId; // Fallback to generated ID

      console.log('CTOS B2B: Request ID extracted:', reportId);

      return {
        success: true,
        requestId: reportId,
        rawResponse: {
          soapResponse: response.data,
          base64Encoded: returnValue,
          decodedXml: decodedXml,
          parsedXml: decodedParsed,
        },
      };
    } catch (error) {
      console.error('CTOS B2B: Request API call failed:', error);
      
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || 
                           error.response?.data?.error || 
                           error.message || 
                           'Unknown error from CTOS B2B API';
        
        return {
          success: false,
          error: `CTOS B2B API Error: ${errorMessage}`,
        };
      }

      return {
        success: false,
        error: `Failed to request credit report: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Confirm credit report request and fetch actual report (Step 2 - Charges credits)
   */
  async confirmCreditReport(requestId: string, params: CreditReportRequest): Promise<CreditReportResponse> {
    const { icNumber, fullName } = params;

    // Validate IC number
    if (!this.validateICNumber(icNumber)) {
      throw new Error('Invalid IC number format. Malaysian IC must be 12 digits.');
    }

    // Check if mock mode is enabled
    if (ctosB2BConfig.mockMode) {
      // Return mock report data
      console.log('CTOS B2B: Mock mode - confirming request and returning mock report');
      return this.generateMockCreditReport(icNumber, fullName);
    }

    // Get valid access token (with automatic refresh if needed)
    const token = await this.getValidAccessToken();

    try {
      const cleanedIc = icNumber.replace(/[\s-]/g, '');
      const cleanedName = fullName.trim().toUpperCase();

      console.log('CTOS B2B: Confirming credit report request (Step 2 - SOAP) for requestId:', requestId);

      // Build SOAP envelope with ws:requestConfirm operation
      const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.proxy.xml.ctos.com.my/">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:requestConfirm>
      <!--Optional:-->
      <input>
        &lt;batch output='0' no='0009' xmlns='http://ws.cmctos.com.my/ctosnet/request'&gt;
          &lt;company_code&gt;${this.config.companyCode}&lt;/company_code&gt;
          &lt;account_no&gt;${this.config.accountNo}&lt;/account_no&gt;
          &lt;user_id&gt;${this.config.userId}&lt;/user_id&gt;
          &lt;request_id&gt;${requestId}&lt;/request_id&gt;
          &lt;record_total&gt;1&lt;/record_total&gt;
          &lt;records&gt;
            &lt;type code="11"&gt;I&lt;/type&gt;
            &lt;ic_lc&gt;&lt;/ic_lc&gt;
            &lt;nic_br&gt;${cleanedIc}&lt;/nic_br&gt;
            &lt;name&gt;${cleanedName}&lt;/name&gt;
            &lt;ref_no&gt;12345&lt;/ref_no&gt;
            &lt;purpose code='200'&gt;Credit evaluation/account opening on subject/directors/shareholder with consent /due diligence on AMLA compliance&lt;/purpose&gt;
            &lt;include_ctos&gt;1&lt;/include_ctos&gt;
            &lt;include_trex&gt;1&lt;/include_trex&gt;
            &lt;include_ssm&gt;0&lt;/include_ssm&gt;
            &lt;include_ssm_retention&gt;0&lt;/include_ssm_retention&gt;
            &lt;include_ccris sum="0"&gt;1&lt;/include_ccris&gt;
            &lt;include_ccris_supp&gt;1&lt;/include_ccris_supp&gt;
            &lt;include_etr_plus&gt;2&lt;/include_etr_plus&gt;
            &lt;include_fico&gt;1&lt;/include_fico&gt;
            &lt;confirm_entity&gt;&lt;/confirm_entity&gt;
          &lt;/records&gt;
        &lt;/batch&gt;
      </input>
    </ws:requestConfirm>
  </soapenv:Body>
</soapenv:Envelope>`;

      // Make SOAP API call to CTOS B2B Proxy endpoint
      const proxyUrl = `${this.config.apiUrl}/ctos_secure/Proxy`;
      
      console.log('CTOS B2B: Making SOAP confirm request to:', proxyUrl);
      
      const response = await axios.post(
        proxyUrl,
        soapBody,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/xml',
            'SOAPAction': '',
          },
          timeout: 30000,
        }
      );

      console.log('CTOS B2B: Confirm API SOAP response received');
      console.log('CTOS B2B: Raw SOAP response (first 500 chars):', typeof response.data === 'string' ? response.data.substring(0, 500) : JSON.stringify(response.data).substring(0, 500));

      // Parse SOAP response
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
      });

      const parsedResponse = parser.parse(response.data);
      
      // Extract the base64 encoded return value
      const returnValue = parsedResponse?.['S:Envelope']?.['S:Body']?.['ns2:requestConfirmResponse']?.return;
      
      if (!returnValue) {
        throw new Error('No return value in SOAP response');
      }

      // Log the base64 encoded message
      console.log('CTOS B2B: Base64 encoded return value (first 200 chars):', returnValue.substring(0, 200));
      console.log('CTOS B2B: Base64 encoded return value length:', returnValue.length);

      // Decode base64 to get XML
      const decodedXml = Buffer.from(returnValue, 'base64').toString('utf-8');
      console.log('CTOS B2B: Decoded XML (first 500 chars):', decodedXml.substring(0, 500));
      
      // Log full decoded XML for debugging (can be removed in production)
      console.log('CTOS B2B: Full decoded XML length:', decodedXml.length);
      if (decodedXml.includes('fico') || decodedXml.includes('score') || decodedXml.includes('FICO')) {
        console.log('CTOS B2B: Found FICO/score related content in XML');
        // Extract the section containing fico/score for debugging
        const ficoMatch = decodedXml.match(/<section_fico[^>]*>[\s\S]*?<\/section_fico>/i);
        if (ficoMatch) {
          console.log('CTOS B2B: Found section_fico:', ficoMatch[0].substring(0, 500));
        }
      }
      
      // Parse the decoded XML report
      const parsedData = this.parseCtosXmlReport(decodedXml);

      console.log('CTOS B2B: Parsed XML report data:', parsedData);

      return {
        success: true,
        data: parsedData,
        rawResponse: {
          soapResponse: response.data,
          base64Encoded: returnValue,
          decodedXml: decodedXml,
          parsedXml: parser.parse(decodedXml),
        },
      };
    } catch (error) {
      console.error('CTOS B2B: Confirm API call failed:', error);
      
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || 
                           error.response?.data?.error || 
                           error.message || 
                           'Unknown error from CTOS B2B API';
        
        return {
          success: false,
          error: `CTOS B2B API Error: ${errorMessage}`,
        };
      }

      return {
        success: false,
        error: `Failed to confirm credit report: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Fetch individual credit report from CTOS B2B API
   * This method now uses the two-step process internally for backward compatibility
   */
  async fetchIndividualCreditReport(params: CreditReportRequest): Promise<CreditReportResponse> {
    const { icNumber, fullName } = params;

    // Validate IC number
    if (!this.validateICNumber(icNumber)) {
      throw new Error('Invalid IC number format. Malaysian IC must be 12 digits.');
    }

    // Use two-step process internally
    console.log('CTOS B2B: Using two-step process for backward compatibility', { icNumber, fullName });
    
    // Step 1: Request
    const requestResult = await this.requestCreditReport(params);
    if (!requestResult.success || !requestResult.requestId) {
      return requestResult;
    }

    // Step 2: Confirm (with small delay to simulate real flow)
    await new Promise(resolve => setTimeout(resolve, 500));
    return await this.confirmCreditReport(requestResult.requestId, params);
  }

  /**
   * Parse CTOS XML report from decoded base64 XML string
   * Extracts key credit report fields from the XML structure
   */
  private parseCtosXmlReport(xmlString: string): any {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        parseAttributeValue: true,
        trimValues: true,
      });

      const parsed = parser.parse(xmlString);
      
      // Navigate through the XML structure: <report><enq_report id="...">...</enq_report></report>
      const enqReport = parsed?.report?.enq_report || parsed?.enq_report;
      if (!enqReport) {
        console.warn('CTOS B2B: Unexpected XML structure, enq_report not found');
        console.warn('CTOS B2B: Available keys:', Object.keys(parsed || {}));
        return {};
      }

      const parsedData: any = {};

      // Extract report ID from enq_report attribute
      parsedData.reportId = enqReport['@_id'] || enqReport.id;

      // Extract summary information: <summary><enq_sum stat="1000">...</enq_sum></summary>
      const summary = enqReport.summary;
      if (summary) {
        const enqSum = summary.enq_sum || summary;
        if (enqSum) {
          // Summary status (stat attribute) - e.g., "1000" - must be string for Prisma
          const statValue = enqSum['@_stat'] || enqSum.stat || enqSum['#text'] || '1000';
          parsedData.summaryStatus = String(statValue);
          
          // Due Diligent Index (dd_index) - e.g., "0000" - must be string for Prisma
          const ddiValue = enqSum.dd_index?.['#text'] || enqSum.dd_index || enqSum.ddIndex || '0000';
          parsedData.dueDiligentIndex = String(ddiValue);

          // Extract FICO score from fico_index element: <fico_index score="809">
          const ficoIndex = enqSum.fico_index;
          if (ficoIndex) {
            // FICO score is in the score attribute
            const ficoScore = ficoIndex['@_score'] || ficoIndex.score;
            if (ficoScore !== undefined && ficoScore !== null && ficoScore !== '') {
              const scoreValue = typeof ficoScore === 'number' ? ficoScore : parseInt(String(ficoScore), 10);
              if (!isNaN(scoreValue) && scoreValue > 0) {
                parsedData.creditScore = scoreValue;
                console.log('CTOS B2B: FICO credit score extracted from fico_index:', scoreValue);
              }
            }

            // Extract FICO factors: <fico_factor code="G6">Description</fico_factor>
            const ficoFactors: Array<{ code: string; description: string }> = [];
            const factors = Array.isArray(ficoIndex.fico_factor) 
              ? ficoIndex.fico_factor 
              : ficoIndex.fico_factor 
                ? [ficoIndex.fico_factor] 
                : [];
            
            for (const factor of factors) {
              if (factor && factor['#text'] && factor['#text'].trim()) {
                const code = factor['@_code'] || factor.code || '';
                const description = factor['#text'].trim();
                if (description) {
                  ficoFactors.push({ code, description });
                }
              }
            }
            
            if (ficoFactors.length > 0) {
              parsedData.extractedData = parsedData.extractedData || {};
              parsedData.extractedData.ficoFactors = ficoFactors;
              console.log(`CTOS B2B: Extracted ${ficoFactors.length} FICO factors`);
            }
          }
        }
      }

      // Detect if report has valid data or errors
      let hasDataError = false;
      let errorMessage = '';

      // Check 1: enq_status in enq_sum section
      if (summary) {
        const enqSum = summary.enq_sum || summary;
        if (enqSum && enqSum.enq_status) {
          const statusCode = enqSum.enq_status['@_code'] || enqSum.enq_status.code;
          const statusText = typeof enqSum.enq_status === 'string' 
            ? enqSum.enq_status 
            : enqSum.enq_status['#text'] || '';
          
          if (statusCode === '0' || statusCode === 0) {
            hasDataError = true;
            errorMessage = statusText || 'CCRIS Service Unavailable';
          }
        }
      }

      // Store error information in parsedData
      parsedData.hasDataError = hasDataError;
      parsedData.errorMessage = errorMessage;

      // Extract section summary: <enquiry><section_summary>...</section_summary></enquiry>
      // enquiry can be an array, so check both array and single object
      const enquiry = Array.isArray(enqReport.enquiry) ? enqReport.enquiry[0] : enqReport.enquiry;
      const sectionSummary = enquiry?.section_summary || enqReport.section_summary;
      
      if (sectionSummary) {
        // CTOS section
        const ctos = sectionSummary.ctos;
        if (ctos) {
          // Bankruptcy status (0 = no bankruptcy, 1 = has bankruptcy)
          const bankruptcy = ctos.bankruptcy;
          parsedData.bankruptcyRecords = bankruptcy 
            ? parseInt(bankruptcy['@_status'] || bankruptcy.status || bankruptcy['#text'] || '0', 10)
            : 0;
          
          // Legal cases total
          const legal = ctos.legal;
          parsedData.legalCases = legal
            ? parseInt(legal['@_total'] || legal.total || legal['#text'] || '0', 10)
            : 0;
        }

        // CCRIS section
        const ccris = sectionSummary.ccris;
        if (ccris) {
          // Facility information
          const facility = ccris.facility;
          if (facility) {
            parsedData.activeAccounts = facility['@_total'] !== undefined 
              ? parseInt(facility['@_total'], 10)
              : parseInt(facility.total || facility['#text'] || '0', 10);
            
            parsedData.totalOutstanding = facility['@_value'] !== undefined
              ? parseFloat(facility['@_value'])
              : parseFloat(facility.value || facility['#text'] || '0');
          }

          // Special attention (defaulted accounts)
          const specialAttention = ccris.special_attention;
          if (specialAttention) {
            parsedData.defaultedAccounts = specialAttention['@_accounts'] !== undefined
              ? parseInt(specialAttention['@_accounts'], 10)
              : parseInt(specialAttention.accounts || specialAttention['#text'] || '0', 10);
          }
        }
      }

      // Check 3: Verify sections have data
      if (enquiry && !hasDataError) {
        const allSectionsFalse = [
          'section_a', 'section_b', 'section_c', 'section_d', 
          'section_d2', 'section_d4', 'section_ccris', 'section_dcheqs',
          'section_ccris_supp', 'section_etr_plus', 'section_e'
        ].every(sectionKey => {
          const section = enquiry[sectionKey];
          if (!section) return true; // No section = no data
          const dataAttr = section['@_data'] || section.data;
          return dataAttr === 'false' || dataAttr === false;
        });
        
        if (allSectionsFalse) {
          hasDataError = true;
          errorMessage = errorMessage || 'No sections contain data';
          // Update parsedData with error information
          parsedData.hasDataError = true;
          parsedData.errorMessage = errorMessage;
        }
      }

      // Extract credit score - check additional locations if not found in summary
      // FICO score is primarily in summary.enq_sum.fico_index['@_score'] (already extracted above)
      // But also check section_fico if it exists as a fallback
      if (!parsedData.creditScore) {
        const sectionFico = enquiry?.section_fico || enqReport.section_fico;
        if (sectionFico) {
          // Try to extract FICO score from various possible fields
          const ficoScore = sectionFico.score || 
                           sectionFico.fico_score || 
                           sectionFico['@_score'] ||
                           sectionFico.value ||
                           sectionFico['#text'];
          
          if (ficoScore !== undefined && ficoScore !== null && ficoScore !== '') {
            const scoreValue = typeof ficoScore === 'number' ? ficoScore : parseInt(String(ficoScore), 10);
            if (!isNaN(scoreValue) && scoreValue > 0) {
              parsedData.creditScore = scoreValue;
              console.log('CTOS B2B: Credit score extracted from section_fico:', scoreValue);
            }
          }
        }
      }

      // Derive risk grade from CTOS Score (FICO score) - matches CTOS Score Report format
      // CTOS Score ranges from 300-850: Higher score = Lower risk
      // Based on CTOS Score Report: 740+ = Excellent, 700-739 = Good, 650-699 = Fair, 600-649 = Poor, <600 = Very Poor
      if (parsedData.creditScore !== undefined && parsedData.creditScore !== null) {
        const score = parsedData.creditScore;
        if (score >= 740) {
          parsedData.riskGrade = 'A'; // Excellent
        } else if (score >= 700) {
          parsedData.riskGrade = 'B'; // Good
        } else if (score >= 650) {
          parsedData.riskGrade = 'C'; // Fair
        } else if (score >= 600) {
          parsedData.riskGrade = 'D'; // Poor
        } else {
          parsedData.riskGrade = 'E'; // Very Poor
        }
        console.log(`CTOS B2B: Risk grade derived from CTOS Score (${score}): ${parsedData.riskGrade}`);
      } else if (parsedData.dueDiligentIndex) {
        // Fallback to DDI if CTOS Score not available
        // DDI "0000" = A, "0001-0010" = B, etc.
        const ddi = parsedData.dueDiligentIndex;
        if (ddi === '0000' || ddi === 'A') {
          parsedData.riskGrade = 'A';
        } else if (ddi === '0001' || ddi === 'B') {
          parsedData.riskGrade = 'B';
        } else if (ddi === '0010' || ddi === 'C') {
          parsedData.riskGrade = 'C';
        } else {
          parsedData.riskGrade = 'D';
        }
        console.log(`CTOS B2B: Risk grade derived from DDI (${ddi}): ${parsedData.riskGrade}`);
      }

      // Extract CTOS Litigation Index if available
      // Litigation Index ranges from 9999 (red/bad) to 0000 (green/good)
      // Check in section_d or legal sections
      const sectionD = enquiry?.section_d || enqReport.section_d;
      if (sectionD && sectionD['@_data'] === 'true') {
        // Try to find litigation index in section_d
        const litigationIndex = sectionD.litigation_index || 
                               sectionD['@_litigation_index'] ||
                               sectionD.index ||
                               sectionD['@_index'];
        if (litigationIndex !== undefined && litigationIndex !== null && litigationIndex !== '') {
          parsedData.litigationIndex = String(litigationIndex);
          console.log('CTOS B2B: Litigation Index extracted:', parsedData.litigationIndex);
        }
      }

      // Also check in CTOS section for litigation index
      if (sectionSummary?.ctos?.legal) {
        const legal = sectionSummary.ctos.legal;
        // Check if there's a litigation index field
        if (legal.index !== undefined || legal['@_index'] !== undefined) {
          const litigationIndex = legal.index || legal['@_index'];
          if (litigationIndex !== undefined && litigationIndex !== null && litigationIndex !== '') {
            parsedData.litigationIndex = String(litigationIndex);
            console.log('CTOS B2B: Litigation Index extracted from CTOS section:', parsedData.litigationIndex);
          }
        }
      }

      // Initialize extractedData object if not already created
      if (!parsedData.extractedData) {
        parsedData.extractedData = {};
      }

      // Extract Section 2: Credit Info at a Glance
      const creditInfoAtGlance: any = {};
      
      // Bankruptcy status (from section_summary.ctos.bankruptcy)
      if (sectionSummary?.ctos?.bankruptcy) {
        const bankruptcyStatus = sectionSummary.ctos.bankruptcy['@_status'] || sectionSummary.ctos.bankruptcy.status || '0';
        creditInfoAtGlance.bankruptcyStatus = bankruptcyStatus === '1' ? 'Has Bankruptcy' : 'Clean';
        creditInfoAtGlance.bankruptcyRecords = parseInt(bankruptcyStatus, 10);
      }
      
      // Active legal records - personal capacity
      if (sectionSummary?.ctos?.legal_personal_capacity) {
        const legalPersonal = sectionSummary.ctos.legal_personal_capacity;
        creditInfoAtGlance.activeLegalRecordsPersonal = {
          count: parseInt(legalPersonal['@_total'] || legalPersonal.total || '0', 10),
          value: parseFloat(legalPersonal['@_value'] || legalPersonal.value || '0'),
        };
      }
      
      // Active legal records - non-personal capacity
      if (sectionSummary?.ctos?.legal_non_personal_capacity) {
        const legalNonPersonal = sectionSummary.ctos.legal_non_personal_capacity;
        creditInfoAtGlance.activeLegalRecordsNonPersonal = {
          count: parseInt(legalNonPersonal['@_total'] || legalNonPersonal.total || '0', 10),
          value: parseFloat(legalNonPersonal['@_value'] || legalNonPersonal.value || '0'),
        };
      }
      
      // Legal records availability (from section_summary.ctos.legal)
      if (sectionSummary?.ctos?.legal) {
        const legal = sectionSummary.ctos.legal;
        const legalTotal = parseInt(legal['@_total'] || legal.total || '0', 10);
        creditInfoAtGlance.legalRecordsAvailability = legalTotal > 0 ? legalTotal : undefined;
      }
      
      // Special attention accounts (from section_summary.ccris.special_attention)
      if (sectionSummary?.ccris?.special_attention) {
        const specialAttention = sectionSummary.ccris.special_attention;
        creditInfoAtGlance.specialAttentionAccounts = parseInt(specialAttention['@_accounts'] || specialAttention.accounts || specialAttention['@_status'] || specialAttention.status || '0', 10);
      }
      
      // Dishonoured cheques availability (from section_summary.dcheqs)
      if (sectionSummary?.dcheqs) {
        const dcheqs = sectionSummary.dcheqs;
        const dcheqsEntity = parseInt(dcheqs['@_entity'] || dcheqs.entity || '0', 10);
        creditInfoAtGlance.dishonouredChequesAvailability = dcheqsEntity > 0;
      }
      
      // Outstanding credit facilities (from section_summary.ccris.facility)
      if (sectionSummary?.ccris?.facility) {
        const facility = sectionSummary.ccris.facility;
        creditInfoAtGlance.outstandingCreditFacilities = {
          count: parseInt(facility['@_total'] || facility.total || '0', 10),
          value: parseFloat(facility['@_value'] || facility.value || '0'),
        };
      }
      
      // Installment arrears in past 24 months (check from CCRIS accounts)
      // This will be determined from account positions later
      
      // Credit applications in past 12 months (from section_summary.ccris.application)
      if (sectionSummary?.ccris?.application) {
        const application = sectionSummary.ccris.application;
        creditInfoAtGlance.creditApplicationsPast12Months = {
          total: parseInt(application['@_total'] || application.total || '0', 10),
          approved: parseInt(application.approved?.['@_count'] || application.approved?.count || '0', 10),
          pending: parseInt(application.pending?.['@_count'] || application.pending?.count || '0', 10),
        };
      }
      
      // Trade referee listing availability (from section_summary.tr.trex_ref)
      if (sectionSummary?.tr?.trex_ref) {
        const trexRef = sectionSummary.tr.trex_ref;
        const positive = parseInt(trexRef['@_positive'] || trexRef.positive || '0', 10);
        const negative = parseInt(trexRef['@_negative'] || trexRef.negative || '0', 10);
        creditInfoAtGlance.tradeRefereeListingAvailability = (positive + negative) > 0;
      }
      
      if (Object.keys(creditInfoAtGlance).length > 0) {
        parsedData.extractedData.creditInfoAtGlance = creditInfoAtGlance;
        console.log('CTOS B2B: Section 2 - Credit Info at a Glance extracted');
      }

      // Extract Identity Verification (Section A)
      const sectionA = enquiry?.section_a || enqReport.section_a;
      if (sectionA && sectionA['@_data'] === 'true' && sectionA.record) {
        const record = Array.isArray(sectionA.record) ? sectionA.record[0] : sectionA.record;
        if (record) {
          const identityVerification: any = {};
          
          // Name and match status
          if (record.name) {
            identityVerification.name = typeof record.name === 'string' ? record.name : record.name['#text'] || '';
            identityVerification.nameMatch = record.name['@_match'] || record.name['@_match'] || null;
          }
          
          // IC/NIC number and match status
          if (record.nic_brno) {
            identityVerification.nicBrno = typeof record.nic_brno === 'string' ? record.nic_brno : record.nic_brno['#text'] || '';
            identityVerification.nicBrnoMatch = record.nic_brno['@_match'] || record.nic_brno['@_match'] || null;
          }
          
          // Address
          if (record.addr) {
            identityVerification.address = typeof record.addr === 'string' ? record.addr : record.addr['#text'] || '';
          }
          
          // Address breakdown
          if (record.addr_breakdown) {
            const addrBreakdown = record.addr_breakdown;
            identityVerification.addressBreakdown = {
              city: addrBreakdown.city?.['#text'] || addrBreakdown.city || '',
              state: addrBreakdown.state?.['#text'] || addrBreakdown.state || '',
              postcode: addrBreakdown.postcode?.['#text'] || addrBreakdown.postcode || '',
              country: addrBreakdown.country?.['#text'] || addrBreakdown.country || '',
            };
          }
          
          // Birth date
          if (record.birth_date) {
            identityVerification.birthDate = typeof record.birth_date === 'string' ? record.birth_date : record.birth_date['#text'] || '';
          }
          
          // Nationality
          if (record.nationality) {
            identityVerification.nationality = typeof record.nationality === 'string' ? record.nationality : record.nationality['#text'] || '';
          }
          
          // Source
          if (record.source) {
            identityVerification.source = typeof record.source === 'string' ? record.source : record.source['#text'] || '';
          }
          
          parsedData.extractedData.identityVerification = identityVerification;
          console.log('CTOS B2B: Identity verification data extracted from Section A');
        }
      }

      // Extract CCRIS Applications
      const sectionCcris = enquiry?.section_ccris || enqReport.section_ccris;
      if (sectionCcris && sectionCcris['@_data'] === 'true') {
        // Check summary.application first
        const summary = sectionCcris.summary;
        if (summary && summary.application) {
          const application = summary.application;
          parsedData.extractedData.ccrisApplications = {
            total: parseInt(application['@_total'] || application.total || '0', 10),
            approved: parseFloat(application.approved?.['#text'] || application.approved || application.approved?.['@_count'] || '0'),
            pending: parseFloat(application.pending?.['#text'] || application.pending || application.pending?.['@_count'] || '0'),
          };
          console.log('CTOS B2B: CCRIS applications extracted from summary');
        }
        // Also check applications section
        else if (sectionCcris.applications) {
          const applications = Array.isArray(sectionCcris.applications) ? sectionCcris.applications : [sectionCcris.applications];
          let total = 0;
          let approved = 0;
          let pending = 0;
          
          for (const app of applications) {
            if (app.application) {
              const appData = Array.isArray(app.application) ? app.application : [app.application];
              for (const a of appData) {
                total++;
                // Check if approved or pending based on status or date
                if (a.approved || a.status === 'approved') {
                  approved++;
                } else if (a.pending || a.status === 'pending') {
                  pending++;
                }
              }
            }
          }
          
          parsedData.extractedData.ccrisApplications = { total, approved, pending };
          console.log('CTOS B2B: CCRIS applications extracted from applications section');
        }
      }

      // Extract CCRIS Account Details
      if (sectionCcris && sectionCcris.accounts) {
        const accounts = Array.isArray(sectionCcris.accounts.account) 
          ? sectionCcris.accounts.account 
          : sectionCcris.accounts.account 
            ? [sectionCcris.accounts.account] 
            : [];
        
        const ccrisAccounts: any[] = [];
        
        for (const account of accounts) {
          const accountData: any = {};
          
          // Approval date
          if (account.approval_date) {
            accountData.approvalDate = typeof account.approval_date === 'string' 
              ? account.approval_date 
              : account.approval_date['#text'] || '';
          }
          
          // Capacity
          if (account.capacity) {
            accountData.capacity = typeof account.capacity === 'string' 
              ? account.capacity 
              : account.capacity['#text'] || '';
            accountData.capacityCode = account.capacity['@_code'] || account.capacity.code || '';
          }
          
          // Credit limit
          if (account.limit) {
            accountData.limit = parseFloat(account.limit['#text'] || account.limit || '0');
          }
          
          // Lender type
          if (account.lender_type) {
            accountData.lenderType = typeof account.lender_type === 'string'
              ? account.lender_type
              : account.lender_type['#text'] || '';
            accountData.lenderTypeCode = account.lender_type['@_code'] || account.lender_type.code || '';
          }
          
          // Extract sub-accounts
          if (account.sub_accounts && account.sub_accounts.sub_account) {
            const subAccounts = Array.isArray(account.sub_accounts.sub_account)
              ? account.sub_accounts.sub_account
              : [account.sub_accounts.sub_account];
            
            const subAccountDetails: any[] = [];
            
            for (const subAccount of subAccounts) {
              const subAccountData: any = {};
              
              // Facility type
              if (subAccount.facility) {
                subAccountData.facility = typeof subAccount.facility === 'string'
                  ? subAccount.facility
                  : subAccount.facility['#text'] || '';
                subAccountData.facilityCode = subAccount.facility['@_code'] || subAccount.facility.code || '';
              }
              
              // Repayment term
              if (subAccount.repay_term) {
                subAccountData.repayTerm = typeof subAccount.repay_term === 'string'
                  ? subAccount.repay_term
                  : subAccount.repay_term['#text'] || '';
                subAccountData.repayTermCode = subAccount.repay_term['@_code'] || subAccount.repay_term.code || '';
              }
              
              // Extract all credit positions (monthly history)
              if (subAccount.cr_positions && subAccount.cr_positions.cr_position) {
                const positions = Array.isArray(subAccount.cr_positions.cr_position)
                  ? subAccount.cr_positions.cr_position
                  : [subAccount.cr_positions.cr_position];
                
                // Extract ALL positions for monthly history
                subAccountData.positions = positions.map((pos: any) => {
                  const positionData: any = {};
                  
                  // Status
                  if (pos.status) {
                    positionData.status = typeof pos.status === 'string'
                      ? pos.status
                      : pos.status['#text'] || '';
                    positionData.statusCode = pos.status['@_code'] || pos.status.code || '';
                  }
                  
                  // Balance
                  if (pos.balance !== undefined && pos.balance !== null) {
                    positionData.balance = parseFloat(pos.balance['#text'] || pos.balance || '0');
                  }
                  
                  // Position date
                  if (pos.position_date) {
                    positionData.positionDate = typeof pos.position_date === 'string'
                      ? pos.position_date
                      : pos.position_date['#text'] || '';
                  }
                  
                  // Installment amount
                  if (pos.inst_amount !== undefined && pos.inst_amount !== null) {
                    positionData.installmentAmount = parseFloat(pos.inst_amount['#text'] || pos.inst_amount || '0');
                  }
                  
                  // Installment arrears
                  if (pos.inst_arrears !== undefined && pos.inst_arrears !== null) {
                    positionData.installmentArrears = parseFloat(pos.inst_arrears['#text'] || pos.inst_arrears || '0');
                  }
                  
                  // Monthly arrears
                  if (pos.mon_arrears !== undefined && pos.mon_arrears !== null) {
                    positionData.monthlyArrears = parseFloat(pos.mon_arrears['#text'] || pos.mon_arrears || '0');
                  }
                  
                  // Rescheduled date
                  if (pos.rescheduled_date) {
                    positionData.rescheduledDate = typeof pos.rescheduled_date === 'string'
                      ? pos.rescheduled_date
                      : pos.rescheduled_date['#text'] || '';
                  }
                  
                  // Restructured date
                  if (pos.restructured_date) {
                    positionData.restructuredDate = typeof pos.restructured_date === 'string'
                      ? pos.restructured_date
                      : pos.restructured_date['#text'] || '';
                  }
                  
                  return positionData;
                });
                
                // Get the first (latest) position for backward compatibility
                const latestPosition = positions[0];
                if (latestPosition) {
                  // Status
                  if (latestPosition.status) {
                    subAccountData.status = typeof latestPosition.status === 'string'
                      ? latestPosition.status
                      : latestPosition.status['#text'] || '';
                    subAccountData.statusCode = latestPosition.status['@_code'] || latestPosition.status.code || '';
                  }
                  
                  // Balance
                  if (latestPosition.balance !== undefined && latestPosition.balance !== null) {
                    subAccountData.balance = parseFloat(latestPosition.balance['#text'] || latestPosition.balance || '0');
                  }
                  
                  // Position date
                  if (latestPosition.position_date) {
                    subAccountData.positionDate = typeof latestPosition.position_date === 'string'
                      ? latestPosition.position_date
                      : latestPosition.position_date['#text'] || '';
                  }
                  
                  // Installment amount
                  if (latestPosition.inst_amount !== undefined && latestPosition.inst_amount !== null) {
                    subAccountData.installmentAmount = parseFloat(latestPosition.inst_amount['#text'] || latestPosition.inst_amount || '0');
                  }
                  
                  // Installment arrears
                  if (latestPosition.inst_arrears !== undefined && latestPosition.inst_arrears !== null) {
                    subAccountData.installmentArrears = parseFloat(latestPosition.inst_arrears['#text'] || latestPosition.inst_arrears || '0');
                  }
                  
                  // Monthly arrears
                  if (latestPosition.mon_arrears !== undefined && latestPosition.mon_arrears !== null) {
                    subAccountData.monthlyArrears = parseFloat(latestPosition.mon_arrears['#text'] || latestPosition.mon_arrears || '0');
                  }
                }
              }
              
              subAccountDetails.push(subAccountData);
            }
            
            accountData.subAccounts = subAccountDetails;
          }
          
          ccrisAccounts.push(accountData);
        }
        
        if (ccrisAccounts.length > 0) {
          parsedData.extractedData.ccrisAccounts = ccrisAccounts;
          console.log(`CTOS B2B: Extracted ${ccrisAccounts.length} CCRIS account(s)`);
          
          // Check for installment arrears in past 24 months for Section 2
          let hasArrearsPast24Months = false;
          const twentyFourMonthsAgo = new Date();
          twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);
          
          for (const account of ccrisAccounts) {
            if (account.subAccounts) {
              for (const subAccount of account.subAccounts) {
                if (subAccount.positionDate) {
                  // Parse position date (format: DD-MM-YYYY or YYYY-MM-DD)
                  const positionDateStr = subAccount.positionDate;
                  let positionDate: Date | null = null;
                  
                  try {
                    if (positionDateStr.includes('-')) {
                      const parts = positionDateStr.split('-');
                      if (parts.length === 3) {
                        // Try DD-MM-YYYY format
                        positionDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                      }
                    }
                  } catch (e) {
                    // Ignore parsing errors
                  }
                  
                  // Check if position date is within past 24 months and has arrears
                  if (positionDate && positionDate >= twentyFourMonthsAgo) {
                    if ((subAccount.installmentArrears && subAccount.installmentArrears > 0) ||
                        (subAccount.monthlyArrears && subAccount.monthlyArrears > 0)) {
                      hasArrearsPast24Months = true;
                      break;
                    }
                  }
                }
              }
              if (hasArrearsPast24Months) break;
            }
          }
          
          // Update creditInfoAtGlance if it exists
          if (parsedData.extractedData.creditInfoAtGlance) {
            parsedData.extractedData.creditInfoAtGlance.instalmentArrearsPast24Months = hasArrearsPast24Months;
          }
        }
      }

      // Extract Section 9: CCRIS Summary
      if (sectionCcris && sectionCcris.summary) {
        const ccrisSummary: any = {};
        const summary = sectionCcris.summary;
        
        // Credit Applications
        if (summary.application) {
          const application = summary.application;
          ccrisSummary.applications = {
            total: parseInt(application['@_total'] || application.total || '0', 10),
            approved: {
              count: parseInt(application.approved?.['@_count'] || application.approved?.count || '0', 10),
              amount: parseFloat(application.approved?.['#text'] || application.approved?.amount || '0'),
            },
            pending: {
              count: parseInt(application.pending?.['@_count'] || application.pending?.count || '0', 10),
              amount: parseFloat(application.pending?.['#text'] || application.pending?.amount || '0'),
            },
          };
        }
        
        // Liabilities Summary
        if (summary.liabilities) {
          const liabilities = summary.liabilities;
          
          // Extract borrower liabilities
          const borrower = liabilities.borrower;
          const borrowerOutstanding = parseFloat(borrower?.['@_total_limit'] || borrower?.total_limit || borrower?.['#text'] || '0');
          const borrowerTotalLimit = parseFloat(borrower?.['@_total_limit'] || borrower?.total_limit || '0');
          const borrowerFecLimit = parseFloat(borrower?.['@_fec_limit'] || borrower?.fec_limit || '0');
          
          // Extract guarantor liabilities
          const guarantor = liabilities.guarantor;
          const guarantorOutstanding = parseFloat(guarantor?.['@_total_limit'] || guarantor?.total_limit || guarantor?.['#text'] || '0');
          const guarantorTotalLimit = parseFloat(guarantor?.['@_total_limit'] || guarantor?.total_limit || '0');
          const guarantorFecLimit = parseFloat(guarantor?.['@_fec_limit'] || guarantor?.fec_limit || '0');
          
          ccrisSummary.liabilities = {
            asBorrower: {
              outstanding: borrowerOutstanding,
              totalLimit: borrowerTotalLimit,
              fecLimit: borrowerFecLimit,
            },
            asGuarantor: {
              outstanding: guarantorOutstanding,
              totalLimit: guarantorTotalLimit,
              fecLimit: guarantorFecLimit,
            },
            total: {
              outstanding: borrowerOutstanding + guarantorOutstanding,
              totalLimit: borrowerTotalLimit + guarantorTotalLimit,
              fecLimit: borrowerFecLimit + guarantorFecLimit,
            },
          };
        }
        
        // Legal Action Taken
        if (summary.legal) {
          const legal = summary.legal;
          ccrisSummary.legalActionTaken = parseInt(legal['@_status'] || legal.status || '0', 10) === 1;
        }
        
        // Special Attention Account
        if (summary.special_attention) {
          const specialAttention = summary.special_attention;
          ccrisSummary.specialAttentionAccount = parseInt(specialAttention['@_status'] || specialAttention.status || '0', 10) === 1;
        }
        
        if (Object.keys(ccrisSummary).length > 0) {
          parsedData.extractedData.ccrisSummary = ccrisSummary;
          console.log('CTOS B2B: Section 9 - CCRIS Summary extracted');
        }
      }

      // Extract Section 11: CCRIS Derivatives
      if (sectionCcris && sectionCcris.derivatives) {
        const derivatives = sectionCcris.derivatives;
        const ccrisDerivatives: any = {};
        
        // Earliest known facility
        if (derivatives.application) {
          const earliestApp = Array.isArray(derivatives.application) ? derivatives.application[0] : derivatives.application;
          if (earliestApp && earliestApp.date) {
            ccrisDerivatives.earliestFacility = {
              date: typeof earliestApp.date === 'string' ? earliestApp.date : earliestApp.date['#text'] || '',
              facilityType: typeof earliestApp.facility === 'string' 
                ? earliestApp.facility 
                : earliestApp.facility?.['#text'] || earliestApp.facility?.code || '',
            };
          }
        }
        
        // Secured facilities
        if (derivatives.facilities && derivatives.facilities.secure) {
          const secure = derivatives.facilities.secure;
          const secureTotal = parseFloat(secure['@_total'] || secure.total || '0');
          const secureOutstanding = parseFloat(secure.outstanding?.['@_limit'] || secure.outstanding?.limit || secure.outstanding?.['#text'] || '0');
          const secureAvgArrears = parseFloat(secure.outstanding?.['@_average'] || secure.outstanding?.average || '0');
          
          ccrisDerivatives.securedFacilities = {
            count: parseInt(secure['@_total'] || secure.total || '0', 10),
            totalOutstanding: secureOutstanding,
            averageInstallments: secureAvgArrears,
            percentage: secureTotal > 0 ? (secureOutstanding / secureTotal) * 100 : 0,
          };
        }
        
        // Unsecured facilities
        if (derivatives.facilities && derivatives.facilities.unsecure) {
          const unsecure = derivatives.facilities.unsecure;
          const unsecureTotal = parseFloat(unsecure['@_total'] || unsecure.total || '0');
          const unsecureOutstanding = parseFloat(unsecure.outstanding?.['@_limit'] || unsecure.outstanding?.limit || unsecure.outstanding?.['#text'] || '0');
          const unsecureAvgArrears = parseFloat(unsecure.outstanding?.['@_average'] || unsecure.outstanding?.average || '0');
          
          ccrisDerivatives.unsecuredFacilities = {
            count: parseInt(unsecure['@_total'] || unsecure.total || '0', 10),
            totalOutstanding: unsecureOutstanding,
            averageInstallments: unsecureAvgArrears,
            percentage: unsecureTotal > 0 ? (unsecureOutstanding / unsecureTotal) * 100 : 0,
          };
        }
        
        // Credit card average usage (6 months)
        if (derivatives.credit_card) {
          ccrisDerivatives.creditCardAvgUsage6Months = parseFloat(
            derivatives.credit_card['@_avg_usage_6_mths'] || 
            derivatives.credit_card.avg_usage_6_mths || 
            '0'
          );
        }
        
        // Other revolving credits average usage (6 months)
        if (derivatives.oth_revolving_credits) {
          ccrisDerivatives.otherRevolvingAvgUsage6Months = parseFloat(
            derivatives.oth_revolving_credits['@_avg_usage_6_mths'] || 
            derivatives.oth_revolving_credits.avg_usage_6_mths || 
            '0'
          );
        }
        
        // Local vs Foreign lenders
        if (derivatives.local_lenders) {
          ccrisDerivatives.localLenders = parseInt(derivatives.local_lenders['@_total'] || derivatives.local_lenders.total || '0', 10);
        }
        if (derivatives.foreign_lenders) {
          ccrisDerivatives.foreignLenders = parseInt(derivatives.foreign_lenders['@_total'] || derivatives.foreign_lenders.total || '0', 10);
        }
        
        if (Object.keys(ccrisDerivatives).length > 0) {
          parsedData.extractedData.ccrisDerivatives = ccrisDerivatives;
          console.log('CTOS B2B: Section 11 - CCRIS Derivatives extracted');
        }
      }

      // Enhance Litigation Index extraction (Section 5)
      // Calculate from legal cases and bankruptcy if not directly available
      if (!parsedData.litigationIndex && sectionSummary?.ctos) {
        const ctos = sectionSummary.ctos;
        let litigationValue = 0;
        
        // Base value from bankruptcy (bankruptcy = high risk)
        if (ctos.bankruptcy && parseInt(ctos.bankruptcy['@_status'] || ctos.bankruptcy.status || '0', 10) === 1) {
          litigationValue += 5000; // High base value for bankruptcy
        }
        
        // Add value from legal cases
        if (ctos.legal) {
          const legalTotal = parseInt(ctos.legal['@_total'] || ctos.legal.total || '0', 10);
          const legalValue = parseFloat(ctos.legal['@_value'] || ctos.legal.value || '0');
          
          // Calculate index based on number and value of legal cases
          litigationValue += (legalTotal * 100) + (legalValue / 1000);
        }
        
        // Add personal capacity legal cases
        if (ctos.legal_personal_capacity) {
          const personalTotal = parseInt(ctos.legal_personal_capacity['@_total'] || ctos.legal_personal_capacity.total || '0', 10);
          const personalValue = parseFloat(ctos.legal_personal_capacity['@_value'] || ctos.legal_personal_capacity.value || '0');
          litigationValue += (personalTotal * 50) + (personalValue / 2000);
        }
        
        // Add non-personal capacity legal cases
        if (ctos.legal_non_personal_capacity) {
          const nonPersonalTotal = parseInt(ctos.legal_non_personal_capacity['@_total'] || ctos.legal_non_personal_capacity.total || '0', 10);
          const nonPersonalValue = parseFloat(ctos.legal_non_personal_capacity['@_value'] || ctos.legal_non_personal_capacity.value || '0');
          litigationValue += (nonPersonalTotal * 50) + (nonPersonalValue / 2000);
        }
        
        // Cap at 9999
        litigationValue = Math.min(Math.round(litigationValue), 9999);
        
        if (litigationValue > 0) {
          parsedData.litigationIndex = String(litigationValue).padStart(4, '0');
          parsedData.extractedData = parsedData.extractedData || {};
          parsedData.extractedData.litigationIndex = {
            value: parsedData.litigationIndex,
            description: litigationValue === 0 
              ? 'No litigation risk' 
              : litigationValue < 100 
                ? 'Low litigation risk' 
                : litigationValue < 500 
                  ? 'Moderate litigation risk' 
                  : litigationValue < 2000 
                    ? 'High litigation risk' 
                    : 'Very high litigation risk',
          };
          console.log('CTOS B2B: Litigation Index calculated:', parsedData.litigationIndex);
        }
      } else if (parsedData.litigationIndex) {
        // Store in extractedData if already extracted
        parsedData.extractedData = parsedData.extractedData || {};
        parsedData.extractedData.litigationIndex = {
          value: parsedData.litigationIndex,
          description: parseInt(parsedData.litigationIndex, 10) === 0 
            ? 'No litigation risk' 
            : parseInt(parsedData.litigationIndex, 10) < 100 
              ? 'Low litigation risk' 
              : parseInt(parsedData.litigationIndex, 10) < 500 
                ? 'Moderate litigation risk' 
                : parseInt(parsedData.litigationIndex, 10) < 2000 
                  ? 'High litigation risk' 
                  : 'Very high litigation risk',
        };
      }

      // Log if credit score was not found (for debugging)
      if (!parsedData.creditScore) {
        console.log('CTOS B2B: Credit score not found in XML. Checking available sections...');
        console.log('CTOS B2B: Available enquiry sections:', enquiry ? Object.keys(enquiry) : 'none');
        console.log('CTOS B2B: Full parsed structure keys:', Object.keys(parsed || {}));
      }

      // Check 2: Detect empty extractedData
      const hasExtractedData = parsedData.extractedData && 
        Object.keys(parsedData.extractedData).length > 0 &&
        Object.values(parsedData.extractedData).some(val => {
          if (Array.isArray(val)) return val.length > 0;
          if (typeof val === 'object' && val !== null) return Object.keys(val).length > 0;
          return val != null;
        });

      // If no data found and no error set yet, set generic error
      if (!hasExtractedData && !parsedData.hasDataError) {
        parsedData.hasDataError = true;
        parsedData.errorMessage = parsedData.errorMessage || 'No credit data available for this IC number';
      }

      // Update error flags in parsedData
      parsedData.hasDataError = parsedData.hasDataError || false;
      parsedData.errorMessage = parsedData.errorMessage || '';

      return parsedData;
    } catch (error) {
      console.error('CTOS B2B: Failed to parse XML report:', error);
      if (error instanceof Error) {
        console.error('CTOS B2B: Parse error message:', error.message);
        console.error('CTOS B2B: Parse error stack:', error.stack);
      }
      console.error('CTOS B2B: XML string (first 1000 chars):', xmlString.substring(0, 1000));
      // Return empty object if parsing fails
      return {};
    }
  }
}

// Export singleton instance
export const ctosB2BService = new CTOSB2BService();

