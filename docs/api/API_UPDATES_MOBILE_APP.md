# API Updates for Mobile App - Document Signing & Stamping Flow

**Last Updated:** January 2025  
**Target:** Mobile App Development Team

## Overview

This document outlines the API changes made to support the complete document signing and stamping workflow. The changes include new endpoints for document downloads, stamp certificate management, and enhanced status tracking throughout the loan application lifecycle.

---

## Table of Contents

1. [New Loan Application Statuses](#new-loan-application-statuses)
2. [New API Endpoints](#new-api-endpoints)
3. [Document Download Endpoints](#document-download-endpoints)
4. [Stamp Certificate Management](#stamp-certificate-management)
5. [Status Flow Changes](#status-flow-changes)
6. [User-Facing Timeline Updates](#user-facing-timeline-updates)
7. [Breaking Changes](#breaking-changes)

---

## New Loan Application Statuses

The following new statuses have been added to the loan application workflow:

| Status | Description | User Action Required |
|--------|-------------|---------------------|
| `PENDING_PKI_SIGNING` | Digital PKI signing in progress | User completes PKI signing |
| `PENDING_SIGNING_COMPANY_WITNESS` | Waiting for company and witness signatures | Admin signs on behalf of company/witness |
| `PENDING_STAMPING` | Waiting for stamp certificate upload | Admin uploads stamp certificate |
| `PENDING_DISBURSEMENT` | Ready for loan disbursement | Admin processes disbursement |

---

## New API Endpoints

### 1. Document Download Endpoints (User-Facing)

Base URL: `{API_URL}/api/loan-applications/{applicationId}/`

#### **GET** `/unsigned-agreement`
Download or view the unsigned loan agreement via DocuSeal.

**Authentication:** Required (Bearer token)

**Request:**
```http
GET /api/loan-applications/{applicationId}/unsigned-agreement
Authorization: Bearer {token}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "url": "https://sign.kredit.my/s/{docusealSlug}",
  "message": "Please open this URL to view the unsigned agreement"
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "No DocuSeal submission found for this loan"
}
```

**Usage Notes:**
- Returns a DocuSeal URL that should be opened in a browser/webview
- The URL is constructed as: `{DOCUSEAL_BASE_URL}/s/{docusealSignUrl}`
- User must own the loan application to access
- Opens the original unsigned agreement for reference

---

#### **GET** `/signed-agreement`
Download the signed loan agreement with PKI signatures.

**Authentication:** Required (Bearer token)

**Request:**
```http
GET /api/loan-applications/{applicationId}/signed-agreement
Authorization: Bearer {token}
```

**Response (Success - 200):**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="signed-agreement-{applicationId}.pdf"

[PDF Binary Data]
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "No signed agreement available for this loan. PKI signing may not be complete."
}
```

**Usage Notes:**
- Returns PDF file as binary stream
- Fetches signed document from signing orchestrator
- Only available after PKI signing is complete (`pkiSignedPdfUrl` field must exist)
- Use appropriate file download handling in mobile app

---

#### **GET** `/stamp-certificate`
Download the stamp certificate for the loan agreement.

**Authentication:** Required (Bearer token)

**Request:**
```http
GET /api/loan-applications/{applicationId}/stamp-certificate
Authorization: Bearer {token}
```

**Response (Success - 200):**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="stamp-certificate-{applicationId}.pdf"

[PDF Binary Data]
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "No stamp certificate available for this loan"
}
```

**Usage Notes:**
- Returns stamp certificate PDF as binary stream
- Only available after stamping is complete (`pkiStampCertificateUrl` field must exist)
- Typically available when status is `PENDING_DISBURSEMENT` or `ACTIVE`

---

### 2. Admin Endpoints for Document Management

Base URL: `{API_URL}/api/admin/applications/{applicationId}/`

#### **GET** `/unsigned-agreement` (Admin)
Same as user endpoint but requires admin authentication.

**Authentication:** Required (Admin Bearer token)

**Request:**
```http
GET /api/admin/applications/{applicationId}/unsigned-agreement
Authorization: Bearer {adminToken}
```

**Response:** Same as user endpoint above.

---

#### **GET** `/signed-agreement` (Admin)
Same as user endpoint but requires admin authentication.

**Authentication:** Required (Admin Bearer token)

---

#### **GET** `/stamp-certificate` (Admin)
Same as user endpoint but requires admin authentication.

**Authentication:** Required (Admin Bearer token)

---

#### **POST** `/upload-stamp-certificate` (Admin Only)
Upload the official stamp certificate for a loan agreement.

**Authentication:** Required (Admin Bearer token)

**Request:**
```http
POST /api/admin/applications/{applicationId}/upload-stamp-certificate
Authorization: Bearer {adminToken}
Content-Type: multipart/form-data

FormData:
  stampCertificate: [PDF File]
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Stamp certificate uploaded successfully",
  "data": {
    "certificateUrl": "uploads/stamp-certificates/stamp-cert-{loanId}-{timestamp}.pdf",
    "loanId": "{loanId}",
    "applicationId": "{applicationId}"
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "Application must be in PENDING_STAMPING status"
}
```

**Validation:**
- File must be PDF format
- Maximum file size: 10MB
- Application must be in `PENDING_STAMPING` status
- Only one stamp certificate can be uploaded per loan

---

#### **POST** `/confirm-stamping` (Admin Only)
Confirm that stamping is complete and move application to disbursement.

**Authentication:** Required (Admin Bearer token)

**Request:**
```http
POST /api/admin/applications/{applicationId}/confirm-stamping
Authorization: Bearer {adminToken}
Content-Type: application/json
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Stamping confirmed, application moved to PENDING_DISBURSEMENT",
  "data": {
    "applicationId": "{applicationId}",
    "newStatus": "PENDING_DISBURSEMENT",
    "stampCertificateUrl": "uploads/stamp-certificates/..."
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "Stamp certificate must be uploaded before confirming stamping"
}
```

**Validation:**
- Application must be in `PENDING_STAMPING` status
- Stamp certificate must already be uploaded (`pkiStampCertificateUrl` must exist)
- Changes status from `PENDING_STAMPING` → `PENDING_DISBURSEMENT`

---

## Document Download Endpoints

### Workflow for Mobile App

```
1. User navigates to loan details
   ↓
2. Check loan status and available documents
   ↓
3. Display download buttons based on availability:
   - Unsigned Agreement: Always available if loan exists
   - Signed Agreement: Available when pkiSignedPdfUrl != null
   - Stamp Certificate: Available when pkiStampCertificateUrl != null
   ↓
4. Handle downloads:
   - Unsigned: Open DocuSeal URL in WebView/Browser
   - Signed & Certificate: Download PDF and save/open
```

### Example Mobile Implementation (React Native)

```javascript
// Check document availability
const canDownloadUnsigned = loan.docusealSubmissionId != null;
const canDownloadSigned = loan.pkiSignedPdfUrl != null;
const canDownloadCertificate = loan.pkiStampCertificateUrl != null;

// Download Unsigned Agreement (opens in browser)
const downloadUnsigned = async () => {
  const response = await fetch(
    `${API_URL}/api/loan-applications/${applicationId}/unsigned-agreement`,
    {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    }
  );
  
  const data = await response.json();
  if (data.success) {
    // Open DocuSeal URL in browser or WebView
    Linking.openURL(data.url);
  }
};

// Download Signed Agreement (saves PDF)
const downloadSigned = async () => {
  const response = await fetch(
    `${API_URL}/api/loan-applications/${applicationId}/signed-agreement`,
    {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    }
  );
  
  if (response.ok) {
    const blob = await response.blob();
    // Save or open PDF using react-native-fs or similar
    const path = `${RNFS.DocumentDirectoryPath}/signed-agreement.pdf`;
    await RNFS.writeFile(path, blob, 'base64');
    FileViewer.open(path);
  }
};

// Download Stamp Certificate (saves PDF)
const downloadCertificate = async () => {
  const response = await fetch(
    `${API_URL}/api/loan-applications/${applicationId}/stamp-certificate`,
    {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    }
  );
  
  if (response.ok) {
    const blob = await response.blob();
    const path = `${RNFS.DocumentDirectoryPath}/stamp-certificate.pdf`;
    await RNFS.writeFile(path, blob, 'base64');
    FileViewer.open(path);
  }
};
```

---

## Stamp Certificate Management

### Admin Flow

1. **Upload Stamp Certificate**
   ```
   POST /api/admin/applications/{id}/upload-stamp-certificate
   - Upload PDF file
   - Stores in: uploads/stamp-certificates/
   - Updates loan.pkiStampCertificateUrl
   ```

2. **Confirm Stamping**
   ```
   POST /api/admin/applications/{id}/confirm-stamping
   - Validates certificate exists
   - Changes status: PENDING_STAMPING → PENDING_DISBURSEMENT
   - Logs audit trail
   ```

### Database Fields

New fields added to `Loan` model:

```prisma
model Loan {
  // ... existing fields
  
  // PKI & Stamping fields
  pkiSignedPdfUrl         String?  // Path to signed agreement from orchestrator
  pkiStampedPdfUrl        String?  // Reserved for future use
  pkiStampCertificateUrl  String?  // Path to uploaded stamp certificate
}
```

---

## Status Flow Changes

### Complete Application Flow

```
INCOMPLETE
  ↓
PENDING_APP_FEE (combined with Application Started in UI)
  ↓
PENDING_PROFILE_CONFIRMATION (combined with KYC Verification in UI)
  ↓
PENDING_KYC (shown as "KYC Verification")
  ↓
PENDING_APPROVAL (shown as "Pending Approval")
  ↓
PENDING_FRESH_OFFER (combined with Pending Approval in UI)
  ↓
PENDING_ATTESTATION
  ↓
PENDING_SIGNATURE (shown as "Document Signing")
  ↓
PENDING_PKI_SIGNING (combined with Document Signing in UI)
  ↓
PENDING_SIGNING_COMPANY_WITNESS
  ↓
PENDING_STAMPING
  ↓
PENDING_DISBURSEMENT
  ↓
ACTIVE (Loan disbursed)
```

---

## User-Facing Timeline Updates

### Simplified Timeline Steps (Mobile App UI)

The timeline has been simplified to reduce redundancy:

**Before:**
1. Application Started
2. Application Fee
3. Profile Confirmation
4. KYC Verification
5. Credit Review
6. Fresh Offer Review
7. Attestation
8. Document Signing
9. Digital PKI Signing
10. Company & Witness Signing
11. Agreement Stamping
12. Loan Disbursement
13. Loan Active

**After (Current):**
1. **Application Started** (combines INCOMPLETE + PENDING_APP_FEE)
2. **Pending Approval** (combines PENDING_APPROVAL + PENDING_FRESH_OFFER)
3. **Attestation** (PENDING_ATTESTATION)
4. **KYC Verification** (combines PENDING_PROFILE_CONFIRMATION + PENDING_KYC + PENDING_KYC_VERIFICATION + PENDING_CERTIFICATE_OTP)
5. **Document Signing** (combines PENDING_SIGNATURE + PENDING_PKI_SIGNING)
6. **Company & Witness Signing** (PENDING_SIGNING_COMPANY_WITNESS)
7. **Agreement Stamping** (PENDING_STAMPING)
8. **Loan Disbursement** (PENDING_DISBURSEMENT)
9. **Loan Active** (ACTIVE)

### Status Label Mapping

Use this mapping for displaying status labels in the mobile app:

```javascript
const getStatusLabel = (status) => {
  const labels = {
    'INCOMPLETE': 'Application Started',
    'PENDING_APP_FEE': 'Application Started',
    'PENDING_PROFILE_CONFIRMATION': 'KYC Verification',
    'PENDING_KYC': 'KYC Verification',
    'PENDING_KYC_VERIFICATION': 'KYC Verification',
    'PENDING_CERTIFICATE_OTP': 'KYC Verification',
    'PENDING_APPROVAL': 'Pending Approval',
    'PENDING_FRESH_OFFER': 'Pending Approval',
    'PENDING_ATTESTATION': 'Attestation',
    'PENDING_SIGNATURE': 'Document Signing',
    'PENDING_PKI_SIGNING': 'Document Signing',
    'PENDING_SIGNING_COMPANY_WITNESS': 'Company & Witness Signing',
    'PENDING_STAMPING': 'Agreement Stamping',
    'PENDING_DISBURSEMENT': 'Loan Disbursement',
    'ACTIVE': 'Loan Active',
  };
  return labels[status] || status;
};
```

---

## Breaking Changes

### 1. Document Download Behavior

**Before:**
- All document downloads returned PDF files directly

**After:**
- Unsigned agreement returns JSON with DocuSeal URL
- Signed agreement and stamp certificate still return PDF files

**Migration:**
```javascript
// OLD CODE (will break)
const downloadUnsigned = async () => {
  const response = await fetch(`/api/.../unsigned-agreement`);
  const blob = await response.blob(); // ❌ This will fail now
};

// NEW CODE
const downloadUnsigned = async () => {
  const response = await fetch(`/api/.../unsigned-agreement`);
  const data = await response.json(); // ✅ Get JSON
  Linking.openURL(data.url); // ✅ Open DocuSeal URL
};
```

### 2. Document Visibility Rules

**Important:** Documents are now only available in the **Loans** tab (ACTIVE loans), not in the **Applications** tab.

**Mobile App Implementation:**
```javascript
// Only show document downloads for ACTIVE loans
if (application.status === 'ACTIVE' && application.loan) {
  // Show document download buttons
  showDocumentDownloads = true;
} else {
  // Hide document downloads in applications view
  showDocumentDownloads = false;
}
```

### 3. Status Display Changes

Update your status display logic to use the new combined labels to match the web app experience.

---

## Testing Checklist for Mobile App

- [ ] Unsigned agreement opens DocuSeal URL correctly
- [ ] Signed agreement downloads and displays PDF
- [ ] Stamp certificate downloads and displays PDF
- [ ] Document buttons only show when available (check null fields)
- [ ] Document downloads only visible in Loans tab, not Applications tab
- [ ] Status labels match the simplified timeline
- [ ] Authentication headers included in all requests
- [ ] Error handling for 401/403/404 responses
- [ ] File download progress indicators
- [ ] PDF viewer integration working

---

## Environment Variables

Ensure these environment variables are configured:

```env
# Backend
DOCUSEAL_BASE_URL=https://sign.kredit.my  # Production
# or
DOCUSEAL_BASE_URL=http://localhost:3001   # Development

SIGNING_ORCHESTRATOR_URL=https://signing.kredit.my
SIGNING_ORCHESTRATOR_API_KEY=your-api-key
```

```env
# Mobile App
API_URL=https://api.kredit.my  # Production
# or
API_URL=http://localhost:4001  # Development
```

---

## Support & Questions

For questions or issues related to these API changes, contact:
- **Backend Team:** [backend@kredit.my]
- **Documentation:** `/docs` folder in repository
- **API Testing:** Use Postman collection in `/swagger`

---

## Payment Slip Management

### New Endpoints for Disbursement Payment Slips

#### **POST** `/api/admin/applications/{applicationId}/upload-disbursement-slip` (Admin Only)
Upload payment slip proof for loan disbursements.

**Authentication:** Required (Admin Bearer token)

**Request:**
```http
POST /api/admin/applications/{applicationId}/upload-disbursement-slip
Authorization: Bearer {adminToken}
Content-Type: multipart/form-data

FormData:
  paymentSlip: [PDF File]
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Payment slip uploaded successfully",
  "data": {
    "paymentSlipUrl": "/uploads/disbursement-slips/disbursement-slip-{applicationId}-{timestamp}.pdf",
    "applicationId": "{applicationId}",
    "disbursementId": "{disbursementId}"
  }
}
```

**Response (Error - 404):**
```json
{
  "success": false,
  "message": "Disbursement not found"
}
```

**Validation:**
- File must be PDF format
- Maximum file size: 10MB
- Disbursement record must exist (loan must be disbursed)
- Can replace existing payment slips

**Storage Location:** `/uploads/disbursement-slips/`

---

#### **GET** `/api/admin/disbursements/{applicationId}/payment-slip` (Admin)
Download payment slip for a specific disbursement.

**Authentication:** Required (Admin or Attestor Bearer token)

**Request:**
```http
GET /api/admin/disbursements/{applicationId}/payment-slip
Authorization: Bearer {adminToken}
```

**Response (Success - 200):**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="disbursement-slip-{applicationId}.pdf"

[PDF Binary Data]
```

**Response (Error - 404):**
```json
{
  "success": false,
  "message": "Payment slip not found"
}
```

---

#### **GET** `/api/admin/disbursements` (Admin)
Fetch all loan disbursements with details.

**Authentication:** Required (Admin Bearer token)

**Request:**
```http
GET /api/admin/disbursements
Authorization: Bearer {adminToken}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "disbursement_id",
      "applicationId": "app_id",
      "referenceNumber": "DISB-12345",
      "amount": 50000.00,
      "bankName": "Maybank",
      "bankAccountNumber": "1234567890",
      "disbursedAt": "2025-01-15T10:30:00Z",
      "disbursedBy": "admin_user_id",
      "paymentSlipUrl": "/uploads/disbursement-slips/...",
      "application": {
        "user": {
          "fullName": "John Doe",
          "email": "john@example.com",
          "phoneNumber": "+60123456789",
          "bankName": "Maybank",
          "accountNumber": "1234567890"
        },
        "product": {
          "name": "Personal Loan",
          "code": "PL-001"
        }
      }
    }
  ]
}
```

---

#### **GET** `/api/loans/{loanId}/disbursement-slip` (User)
Download payment slip for own loan disbursement.

**Authentication:** Required (User Bearer token)

**Request:**
```http
GET /api/loans/{loanId}/disbursement-slip
Authorization: Bearer {userToken}
```

**Response (Success - 200):**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="disbursement-slip-{applicationId}.pdf"

[PDF Binary Data]
```

**Response (Error - 404):**
```json
{
  "success": false,
  "message": "Payment slip not found"
}
```

**Usage Notes:**
- User can only download payment slip for their own loans
- Returns 401 if not authenticated
- Returns 404 if no payment slip has been uploaded

---

### Database Schema Updates

**LoanDisbursement Model:**
```prisma
model LoanDisbursement {
  id                String          @id @default(cuid())
  applicationId     String          @unique
  referenceNumber   String
  amount            Float
  bankName          String?
  bankAccountNumber String?
  disbursedAt       DateTime        @default(now())
  disbursedBy       String
  notes             String?
  status            String          @default("COMPLETED")
  paymentSlipUrl    String?         // NEW: Path to payment slip PDF
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  application       LoanApplication @relation(fields: [applicationId], references: [id])

  @@map("loan_disbursements")
}
```

---

### Audit Trail Integration

All payment slip uploads and replacements are tracked in the `LoanApplicationHistory` table:

**Upload Action:**
```json
{
  "previousStatus": null,
  "newStatus": "DISBURSEMENT_SLIP_UPLOADED",
  "changedBy": "admin_user_id",
  "changeReason": "Payment slip uploaded",
  "notes": "Payment slip uploaded by Admin Name. File: disbursement-slip-app123-1234567890.pdf",
  "metadata": {
    "action": "uploaded",
    "previousSlipUrl": null,
    "newSlipUrl": "/uploads/disbursement-slips/...",
    "fileName": "disbursement-slip-app123-1234567890.pdf",
    "fileSize": 245678,
    "uploadedBy": "admin_user_id",
    "uploadedByName": "Admin Name",
    "uploadedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Replace Action:**
```json
{
  "previousStatus": null,
  "newStatus": "DISBURSEMENT_SLIP_REPLACED",
  "changedBy": "admin_user_id",
  "changeReason": "Payment slip replaced",
  "notes": "Payment slip replaced by Admin Name. File: disbursement-slip-app123-1234567891.pdf",
  "metadata": {
    "action": "replaced",
    "previousSlipUrl": "/uploads/disbursement-slips/old-file.pdf",
    "newSlipUrl": "/uploads/disbursement-slips/new-file.pdf",
    "fileName": "disbursement-slip-app123-1234567891.pdf",
    "fileSize": 345678,
    "uploadedBy": "admin_user_id",
    "uploadedByName": "Admin Name",
    "uploadedAt": "2025-01-15T11:45:00.000Z"
  }
}
```

Similarly, stamp certificate uploads are also tracked:

**Stamp Certificate Upload/Replace:**
```json
{
  "previousStatus": null,
  "newStatus": "STAMP_CERTIFICATE_UPLOADED" | "STAMP_CERTIFICATE_REPLACED",
  "changedBy": "admin_user_id",
  "changeReason": "Stamp certificate uploaded" | "Stamp certificate replaced",
  "notes": "Stamp certificate uploaded/replaced by Admin Name. File: stamp-cert-loan123-1234567890.pdf",
  "metadata": {
    "action": "uploaded" | "replaced",
    "previousCertUrl": null | "/uploads/stamp-certificates/old-cert.pdf",
    "newCertUrl": "/uploads/stamp-certificates/...",
    "fileName": "stamp-cert-loan123-1234567890.pdf",
    "fileSize": 156789,
    "uploadedBy": "admin_user_id",
    "uploadedByName": "Admin Name",
    "uploadedAt": "2025-01-15T09:15:00.000Z",
    "loanId": "loan_id"
  }
}
```

---

### Mobile App Integration

**Check Payment Slip Availability:**
```javascript
const loan = await fetchLoanDetails(loanId);
const hasPaymentSlip = loan.application?.disbursement?.paymentSlipUrl != null;

if (hasPaymentSlip) {
  // Show download button
}
```

**Download Payment Slip:**
```javascript
const downloadPaymentSlip = async (loanId) => {
  try {
    const response = await fetch(
      `${API_URL}/api/loans/${loanId}/disbursement-slip`,
      {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      }
    );
    
    if (response.ok) {
      const blob = await response.blob();
      const path = `${RNFS.DocumentDirectoryPath}/payment-slip-${loanId}.pdf`;
      await RNFS.writeFile(path, blob, 'base64');
      FileViewer.open(path);
    } else {
      const error = await response.json();
      Alert.alert('Error', error.message);
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to download payment slip');
  }
};
```

**Display Disbursement Information:**
```javascript
// In loan details screen
{loan.application?.disbursement && (
  <View>
    <Text>Disbursement Information</Text>
    <Text>Reference: {loan.application.disbursement.referenceNumber}</Text>
    <Text>Amount: RM {loan.application.disbursement.amount.toFixed(2)}</Text>
    <Text>Date: {formatDate(loan.application.disbursement.disbursedAt)}</Text>
    
    {loan.application.disbursement.paymentSlipUrl && (
      <TouchableOpacity onPress={() => downloadPaymentSlip(loan.id)}>
        <Text>Download Payment Slip</Text>
      </TouchableOpacity>
    )}
  </View>
)}
```

---

### Admin Dashboard Updates

**New Dashboard Metric:**
- `disbursementsWithoutSlips`: Count of disbursed loans missing payment slips
- Displayed as a quick action card for admins

**Disbursements Tab (Admin Loans Page):**
- View all loan disbursements
- Upload/replace payment slips
- Download existing payment slips
- See disbursement details (reference number, amount, bank details, disbursed by)

---

## Changelog

### January 2025

#### Payment Slip Management (Latest)
- Added payment slip upload/replacement functionality for disbursements
- New endpoints for admin upload and user download of payment slips
- Payment slips stored in `/uploads/disbursement-slips/` subfolder
- Integrated audit trail tracking for uploads and replacements
- Added dashboard metric for missing payment slips
- Admin disbursements tab for centralized payment slip management

#### Document Signing & Stamping
- Added document download endpoints for unsigned/signed agreements and stamp certificates
- Implemented stamp certificate upload and confirmation flow
- Integrated audit trail tracking for stamp certificate uploads
- Simplified user-facing timeline (combined redundant statuses)
- Updated status label mapping
- Restricted document downloads to Loans tab only
- Added comprehensive mobile app integration guidelines

