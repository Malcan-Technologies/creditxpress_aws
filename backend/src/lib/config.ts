/**
 * Centralized Configuration Module
 * 
 * This module handles parsing of environment variables, supporting both:
 * 1. Individual env vars (for local development via .env)
 * 2. JSON-formatted credentials (for AWS ECS via Secrets Manager)
 * 
 * This makes the app portable between local Docker Compose and AWS ECS deployments.
 */

// Helper to safely parse JSON credentials
function parseJsonCredentials(envVar: string | undefined): Record<string, string> {
  if (!envVar) return {};
  try {
    return JSON.parse(envVar);
  } catch {
    console.warn(`Failed to parse JSON credentials, falling back to individual env vars`);
    return {};
  }
}

// ==============================================
// Server Configuration
// ==============================================
export const serverConfig = {
  port: Number(process.env.PORT || 4001),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
};

// ==============================================
// CORS Configuration
// ==============================================
const defaultDevOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:8080',
];

const defaultProdOrigins = [
  'https://creditxpress.com.my',
  'https://www.creditxpress.com.my',
  'https://admin.creditxpress.com.my',
  'https://api.creditxpress.com.my',
];

export const corsConfig = {
  origins: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : serverConfig.isDevelopment
      ? defaultDevOrigins
      : defaultProdOrigins,
};

// ==============================================
// URL Configuration
// ==============================================
export const urlConfig = {
  frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
  admin: process.env.ADMIN_BASE_URL || process.env.ADMIN_URL || 'http://localhost:3002',
  api: process.env.BASE_URL || 'http://localhost:4001',
  backend: process.env.BACKEND_URL || process.env.BASE_URL || 'http://localhost:4001',
};

// ==============================================
// JWT Configuration
// ==============================================
export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'your-secret-key',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
};

// ==============================================
// WhatsApp Credentials
// AWS Secret: {secrets_prefix}/whatsapp-api-token
// JSON keys: access_token, phone_number_id
// ==============================================
const whatsappCredentials = parseJsonCredentials(process.env.WHATSAPP_CREDENTIALS);

export const whatsappConfig = {
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || whatsappCredentials.access_token || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || whatsappCredentials.phone_number_id || '',
  // Default to true - only disable if explicitly set to 'false'
  useOtpTemplate: process.env.WHATSAPP_USE_OTP_TEMPLATE !== 'false' && whatsappCredentials.use_otp_template !== 'false',
};

// ==============================================
// Resend Email Credentials
// AWS Secret: {secrets_prefix}/resend-api-key
// JSON keys: api_key, from_email
// ==============================================
const resendCredentials = parseJsonCredentials(process.env.RESEND_CREDENTIALS);

export const resendConfig = {
  apiKey: process.env.RESEND_API_KEY || resendCredentials.api_key || '',
  fromEmail: process.env.RESEND_FROM_EMAIL || resendCredentials.from_email || 'noreply@creditxpress.com.my',
};

// ==============================================
// CTOS eKYC Credentials
// AWS Secret: {secrets_prefix}/ctos-credentials
// JSON keys: api_key, package_name, security_key, base_url, webhook_url, ciphertext, cipher
// ==============================================
const ctosCredentials = parseJsonCredentials(process.env.CTOS_CREDENTIALS);

export const ctosConfig = {
  apiKey: process.env.CTOS_API_KEY || ctosCredentials.api_key || '',
  packageName: process.env.CTOS_PACKAGE_NAME || ctosCredentials.package_name || '',
  securityKey: process.env.CTOS_SECURITY_KEY || ctosCredentials.security_key || '',
  baseUrl: process.env.CTOS_BASE_URL || ctosCredentials.base_url || '',
  webhookUrl: process.env.CTOS_WEBHOOK_URL || ctosCredentials.webhook_url || `${urlConfig.backend}/api/ctos/webhook`,
  ciphertext: process.env.CTOS_CIPHERTEXT || ctosCredentials.ciphertext || 'default16bytesiv',
  cipher: process.env.CTOS_CIPHER || ctosCredentials.cipher || 'aes-256-cbc',
  b2bMockMode: process.env.CTOS_B2B_MOCK_MODE === 'true',
};

// ==============================================
// KYC Configuration
// Note: Using CTOS for KYC, not Docker-based services
// ==============================================
export const kycConfig = {
  jwtSecret: process.env.KYC_JWT_SECRET || jwtConfig.secret,
  tokenTtlMinutes: Number(process.env.KYC_TOKEN_TTL_MINUTES || 15),
};

// ==============================================
// DocuSeal & Signing Orchestrator Configuration (combined)
// AWS Secret: {secrets_prefix}/docuseal-signing-config
// JSON keys: api_token, base_url, api_url, template_id, webhook_secret, orchestrator_url, orchestrator_api_key
// ==============================================
const docusealSigningCredentials = parseJsonCredentials(process.env.DOCUSEAL_SIGNING_CONFIG);

export const docusealConfig = {
  // User-facing URL (what users see in browser)
  baseUrl: process.env.DOCUSEAL_BASE_URL || docusealSigningCredentials.base_url || 'http://localhost:3001',
  // Backend API URL (for internal API calls, may differ in Docker)
  apiUrl: process.env.DOCUSEAL_API_URL || docusealSigningCredentials.api_url || process.env.DOCUSEAL_BASE_URL || docusealSigningCredentials.base_url || 'http://host.docker.internal:3001',
  apiToken: process.env.DOCUSEAL_API_TOKEN || docusealSigningCredentials.api_token || '',
  apiKey: process.env.DOCUSEAL_API_KEY || process.env.DOCUSEAL_API_TOKEN || docusealSigningCredentials.api_token || '',
  templateId: process.env.DOCUSEAL_LOAN_AGREEMENT_TEMPLATE_ID || docusealSigningCredentials.template_id || '',
  webhookSecret: process.env.DOCUSEAL_WEBHOOK_SECRET || docusealSigningCredentials.webhook_secret || '',
};

export const signingConfig = {
  url: process.env.SIGNING_ORCHESTRATOR_URL || docusealSigningCredentials.orchestrator_url || 'http://localhost:4010',
  apiKey: process.env.SIGNING_ORCHESTRATOR_API_KEY || docusealSigningCredentials.orchestrator_api_key || '',
};

// ==============================================
// Company/Witness Signing Configuration
// Used for DocuSeal submissions with company and witness signatories
// Reads from AWS Secrets Manager JSON or individual env vars
// ==============================================
export const companySigningConfig = {
  companyEmail: process.env.COMPANY_SIGNING_EMAIL || docusealSigningCredentials.company_signing_email || 'admin@creditxpress.com.my',
  witnessName: process.env.WITNESS_NAME || docusealSigningCredentials.witness_name || 'Legal Representative',
  witnessEmail: process.env.WITNESS_EMAIL || docusealSigningCredentials.witness_email || 'legal@creditxpress.com.my',
  // Server public IP for digital signature attestation
  serverPublicIp: process.env.SERVER_PUBLIC_IP || docusealSigningCredentials.server_public_ip || '',
  // Default company name (fallback when database has no settings)
  defaultCompanyName: process.env.DEFAULT_COMPANY_NAME || docusealSigningCredentials.default_company_name || 'Kredit.my',
  // Default company address (fallback when database has no settings)
  defaultCompanyAddress: process.env.DEFAULT_COMPANY_ADDRESS || docusealSigningCredentials.default_company_address || 'Kuala Lumpur, Malaysia',
};

// ==============================================
// CTOS B2B Credit Report Configuration
// (Different from eKYC CTOS - this is for credit reports)
// AWS Secret: {secrets_prefix}/ctos-b2b-credentials
// JSON keys: company_code, account_no, user_id, client_id, sso_password, sso_url, api_url, private_key
// ==============================================
const ctosB2BCredentials = parseJsonCredentials(process.env.CTOS_B2B_CREDENTIALS);

export const ctosB2BConfig = {
  companyCode: process.env.CTOS_B2B_COMPANY_CODE || ctosB2BCredentials.company_code || '',
  accountNo: process.env.CTOS_B2B_ACCOUNT_NO || ctosB2BCredentials.account_no || '',
  userId: process.env.CTOS_B2B_USER_ID || ctosB2BCredentials.user_id || '',
  clientId: process.env.CTOS_B2B_CLIENT_ID || ctosB2BCredentials.client_id || '',
  ssoPassword: process.env.CTOS_B2B_SSO_PASSWORD || ctosB2BCredentials.sso_password || '',
  ssoUrl: process.env.CTOS_B2B_SSO_URL || ctosB2BCredentials.sso_url || 'https://uat-sso.ctos.com.my',
  apiUrl: process.env.CTOS_B2B_API_URL || ctosB2BCredentials.api_url || 'https://uat-integration.ctos.com.my',
  privateKey: process.env.CTOS_B2B_PRIVATE_KEY || ctosB2BCredentials.private_key || '',
  mockMode: process.env.CTOS_B2B_MOCK_MODE === 'true' || ctosB2BCredentials.mock_mode === 'true',
};

// ==============================================
// AWS S3 Storage Configuration
// ==============================================
export const s3Config = {
  region: process.env.AWS_REGION || 'ap-southeast-5',
  bucket: process.env.S3_BUCKET || '',
  uploadPrefix: process.env.S3_UPLOAD_PREFIX || 'uploads',
  // S3 is configured if we have a bucket
  isConfigured: Boolean(process.env.S3_BUCKET),
};

// ==============================================
// Upload Directories (for local storage fallback)
// ==============================================
export const uploadConfig = {
  baseDir: process.env.UPLOAD_DIR || 'uploads',
  kycDir: 'kyc',
  documentsDir: 'documents',
  stampCertificatesDir: 'stamp-certificates',
  disbursementSlipsDir: 'disbursement-slips',
  receiptsDir: 'receipts',
};

// ==============================================
// Logging helper for startup
// ==============================================
export function logConfigStatus(): void {
  console.log('📋 Configuration Status:');
  console.log(`  Environment: ${serverConfig.nodeEnv}`);
  console.log(`  Port: ${serverConfig.port}`);
  console.log(`  API URL: ${urlConfig.api}`);
  console.log(`  Frontend URL: ${urlConfig.frontend}`);
  console.log(`  Admin URL: ${urlConfig.admin}`);
  console.log(`  WhatsApp: ${whatsappConfig.accessToken ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  Resend Email: ${resendConfig.apiKey ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  CTOS eKYC: ${ctosConfig.apiKey ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  DocuSeal: ${docusealConfig.apiToken ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  Signing Orchestrator: ${signingConfig.apiKey ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  S3 Storage: ${s3Config.isConfigured ? `✅ ${s3Config.bucket}` : '⚠️ Using local storage'}`);
}
