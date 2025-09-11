export interface SignerInfo {
  userId: string; // NRIC or Passport
  fullName: string;
  emailAddress: string;
  mobileNo: string;
  nationality?: string;
  userType: 1 | 2; // 1=External borrower, 2=Internal signatory
}

export interface VerificationData {
  status: string;
  datetime: string;
  verifier: string;
  method: string;
  evidence?: {
    nricFront?: string;
    nricBack?: string;
    passportImage?: string;
    selfieImage?: string;
    loaDocument?: string;
  };
}

export interface SignatureCoordinates {
  pageNo: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SignatureInfo {
  pdfInBase64: string;
  visibility: boolean;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  pageNo?: number;
  sigImageInBase64?: string;
}

export interface PdfFieldNameValue {
  pdfFieldName: string;
  pdfFieldValue: string;
}

export interface FieldUpdate {
  [key: string]: string;
}

export interface DocuSealWebhookPayload {
  event_type: string;
  data: {
    id: string;
    packet_id?: string;
    document_id?: string;
    template_id?: string;
    signer_id?: string;
    signer_name?: string;
    signer_email?: string;
    signer_nric?: string;
    signer_passport?: string;
    unsigned_pdf_url?: string;
    status?: string;
    completed_at?: string;
    [key: string]: any;
  };
}





export interface MTSAGetCertInfoRequest {
  UserID: string;
}

export interface MTSAGetCertInfoResponse {
  statusCode: string;
  message: string;
  certStatus?: string;
  certValidFrom?: string;
  certValidTo?: string;
  userCert?: string;
  certIssuer?: string;
  certSubjectDN?: string;
  certSerialNo?: string;
}

export interface MTSASignPDFRequest {
  UserID: string;
  FullName: string;
  AuthFactor: string;
  SignatureInfo: SignatureInfo;
  FieldListToUpdate?: PdfFieldNameValue[];
}

export interface MTSASignPDFResponse {
  statusCode: string;
  message: string;
  signedPdfInBase64?: string;
  userCert?: string;
}

export interface MTSAVerifyPDFRequest {
  SignedPdfInBase64: string;
}

export interface MTSAVerifyPDFResponse {
  statusCode: string;
  message: string;
  totalSignatureInPdf?: number;
  signatureDetails?: Array<{
    signerName: string;
    signedDate: string;
    isValid: boolean;
    certStatus: string;
  }>;
}

export interface MTSARequestEmailOTPRequest {
  UserID: string;
  OTPUsage: 'DS' | 'NU'; // DS=digital signing, NU=new cert enrolment
  EmailAddress?: string; // Required for NU
}

export interface MTSARequestEmailOTPResponse {
  statusCode: string;
  message: string;
  otpSent?: boolean;
  return?: {
    statusCode: string;
    statusMsg: string;
  };
}

export interface MTSAOrganisationInfo {
  orgAddress?: string;
  orgAddressCity?: string;
  orgAddressCountry?: string;
  orgAddressPostcode?: string;
  orgAddressState?: string;
  orgFaxNo?: string;
  orgName?: string;
  orgPhoneNo?: string;
  orgRegistationNo?: string;
  orgRegistrationType?: string;
  orgUserDesignation?: string;
  orgUserRegistrationNo?: string;
  orgUserRegistrationType?: string;
}

export interface MTSARequestCertificateRequest {
  UserID: string;
  FullName: string;
  EmailAddress: string;
  MobileNo: string;
  Nationality: string;
  UserType: 1 | 2 | string;
  IDType: string;
  AuthFactor: string;
  NRICFront?: string;
  NRICBack?: string;
  SelfieImage?: string;
  PassportImage?: string;
  OrganisationInfo?: MTSAOrganisationInfo;
  VerificationData: {
    verifyDatetime: string;
    verifyMethod: string;
    verifyStatus: string;
    verifyVerifier: string;
  };
}

export interface MTSARequestCertificateResponse {
  return?: {
    statusCode: string;
    statusMsg: string;
    // Certificate data (only present if successful)
    certX509?: string;
    certValidTo?: string;
    certValidFrom?: string;
    certSerialNo?: string;
    // Request tracking
    certRequestID?: string;
    certRequestStatus?: string;
    userID?: string;
  };
  // Top-level fields (alternative response format)
  statusCode?: string;
  statusMsg?: string;
  message?: string;
  certX509?: string;
  certValidTo?: string;
  certValidFrom?: string;
  certSerialNo?: string;
  certRequestID?: string;
  certRequestStatus?: string;
  userID?: string;
  // Legacy field names for backward compatibility
  validFrom?: string;
  validTo?: string;
  userCert?: string;
  certificateSerialNo?: string;
  certificateValidFrom?: string;
  certificateValidTo?: string;
}

export interface MTSARequestRevokeCertRequest {
  UserID: string;
  CertSerialNo: string;
  RevokeReason: 'keyCompromise' | 'CACompromise' | 'affiliationChanged' | 'superseded' | 'cessationOfOperation';
  RevokeBy: 'Admin' | 'Self';
  AuthFactor: string;
  IDType: 'N' | 'P';
  VerificationData: {
    verifyDatetime: string;
    verifyMethod: string;
    verifyStatus: string;
    verifyVerifier: string;
  };
  NRICFront?: string;
  NRICBack?: string;
  PassportImage?: string;
  SelfieImage?: string;
}

export interface MTSARequestRevokeCertResponse {
  statusCode: string;
  message: string;
  revoked?: boolean;
}

export interface SigningRequest {
  packetId: string;
  documentId: string;
  templateId: string;
  signerInfo: SignerInfo;
  pdfUrl: string;
  otp?: string;
  coordinates?: SignatureCoordinates;
  signatureImage?: string;
  fieldUpdates?: FieldUpdate;
}

export interface SigningResponse {
  success: boolean;
  message: string;
  signedPdfPath?: string;
  certificateInfo?: {
    serialNo: string;
    validFrom: string;
    validTo: string;
    status: string;
  };
  error?: {
    code: string;
    details: string;
  };
}

export interface EnrollmentRequest {
  signerInfo: SignerInfo;
  verificationData: VerificationData;
  otp?: string;
}

export interface EnrollmentResponse {
  success: boolean;
  message: string;
  certificateInfo?: {
    serialNo: string;
    validFrom: string;
    validTo: string;
    certificate: string;
  };
  error?: {
    code: string;
    details: string;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    soapConnection: boolean;
    diskWritable: boolean;
    docusealReachable: boolean;
  };
  details?: {
    [key: string]: any;
  };
}

export interface OrchestratorConfig {
  app: {
    port: number;
    baseUrl: string;
    nodeEnv: string;
  };
  docuseal: {
    baseUrl: string;
    webhookSecret: string;
    apiToken: string;
  };
  storage: {
    signedFilesDir: string;
    maxUploadMB: number;
  };
  mtsa: {
    env: 'pilot' | 'prod';
    wsdlPilot: string;
    wsdlProd: string;
    username: string;
    password: string;
  };
  network: {
    timeoutMs: number;
    retryBackoffMs: number;
    retryMax: number;
  };
  security: {
    corsOrigins: string[];
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  logging: {
    level: string;
    format: string;
  };
  signatureCoordinates: { [templateId: string]: SignatureCoordinates };
  notification?: {
    webhookUrl: string;
    webhookSecret: string;
  };
}
