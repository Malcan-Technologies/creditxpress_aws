# Kapital API Documentation

Welcome to the Kapital API documentation! This guide provides comprehensive information about all available endpoints for app developers building on the Kapital platform.

## Base URL & Swagger

**Local Development:** `http://localhost:4001`
**Swagger UI:** `http://localhost:4001/api-docs`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_access_token>
```

### Token Management
- **Access Token**: Short-lived token for API calls (expires in 15 minutes)
- **Refresh Token**: Long-lived token to get new access tokens (expires in 7 days)

## Table of Contents

- [Authentication](#authentication-endpoints)
- [User Management](#user-management)
- [Loan Applications](#loan-applications)
- [Loans](#loans)
- [Products](#products)
- [Notifications](#notifications)
- [Admin Endpoints](#admin-endpoints)

---

## Authentication Endpoints

### User Login
```http
POST /api/auth/login
```

**Description**: Login with phone number and password

**Request Body**:
```json
{
  "phoneNumber": "+1234567890",
  "password": "yourpassword"
}
```

**Response**:
```json
{
  "userId": "string",
  "phoneNumber": "+1234567890",
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "isOnboardingComplete": true,
  "onboardingStep": 4
}
```

### User Registration
```http
POST /api/auth/signup
```

**Description**: Register a new user and send OTP verification

**Password Requirements (effective):**
- Minimum 8 characters
- Must include at least 1 uppercase letter
- Must include at least 1 special character (non-alphanumeric)
- Must not contain any spaces

**Request Body**:
```json
{
  "phoneNumber": "+1234567890",
  "password": "securepassword"
}
```

**Response**:
```json
{
  "message": "User created successfully, OTP sent",
  "userId": "string",
  "phoneNumber": "+1234567890",
  "otpSent": true,
  "expiresAt": "2023-12-01T10:00:00Z"
}
```

### Verify OTP
```http
POST /api/auth/verify-otp
```

**Description**: Verify OTP and complete phone number verification

**Request Body**:
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

### Resend OTP
```http
POST /api/auth/resend-otp
```

**Description**: Resend OTP verification code

**Request Body**:
```json
{
  "phoneNumber": "+1234567890"
}
```

### Refresh Token
```http
POST /api/auth/refresh
```

**Description**: Get a new access token using refresh token

**Request Body**:
```json
{
  "refreshToken": "your_refresh_token"
}
```

### Logout
```http
POST /api/auth/logout
```
🔒 **Requires Authentication**

**Description**: Logout and invalidate refresh token

### Password Reset Flow

#### 1. Initiate Password Reset
```http
POST /api/auth/forgot-password
```

**Request Body**:
```json
{
  "phoneNumber": "+1234567890"
}
```

#### 2. Verify Reset OTP
```http
POST /api/auth/verify-reset-otp
```

**Request Body**:
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

#### 3. Reset Password
```http
POST /api/auth/reset-password
```

**Request Body**:
```json
{
  "resetToken": "reset_token_from_step_2",
  "newPassword": "newpassword123"
}
```

---

## User Management

### Get Current User
```http
GET /api/users/me
```
🔒 **Requires Authentication**

**Description**: Get current user's profile information

**Response**: Returns complete user profile including personal details, employment info, bank details, etc.

### Update User Profile
```http
PUT /api/users/me
```
🔒 **Requires Authentication**

**Description**: Update current user's profile information

**Request Body** (all fields optional):
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "dateOfBirth": "1990-01-01",
  "address1": "123 Main St",
  "address2": "Apt 4B",
  "city": "Kuala Lumpur",
  "state": "Selangor",
  "postalCode": "50000",
  "employmentStatus": "EMPLOYED",
  "employerName": "Tech Corp",
  "monthlyIncome": "5000",
  "bankName": "Maybank",
  "accountNumber": "1234567890",
  "icNumber": "900101011234",
  "icType": "NRIC",
  "emergencyContactName": "Jane Doe",
  "emergencyContactPhone": "+1234567891",
  "emergencyContactRelationship": "Spouse",
  "serviceLength": "2_TO_5_YEARS"
}
```

### Change Password
```http
PUT /api/users/me/password
```
🔒 **Requires Authentication**

**Description**: Change user's password

**New Password Requirements (effective):**
- Minimum 8 characters
- Must include at least 1 uppercase letter
- Must include at least 1 special character (non-alphanumeric)
- Must not contain any spaces

**Request Body**:
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

### Get User Documents
```http
GET /api/users/me/documents
```
🔒 **Requires Authentication**

**Description**: Get all documents uploaded by the current user

### Phone Number Change Flow

#### 1. Request Phone Change
```http
POST /api/users/me/phone/change-request
```
🔒 **Requires Authentication**

**Request Body**:
```json
{
  "newPhoneNumber": "+1234567890"
}
```

#### 2. Verify Current Phone
```http
POST /api/users/me/phone/verify-current
```
🔒 **Requires Authentication**

**Request Body**:
```json
{
  "changeToken": "token_from_step_1",
  "otp": "123456"
}
```

#### 3. Verify New Phone
```http
POST /api/users/me/phone/verify-new
```
🔒 **Requires Authentication**

**Request Body**:
```json
{
  "changeToken": "token_from_step_2",
  "otp": "123456"
}
```

---

## Loan Applications

### Create Loan Application
```http
POST /api/loan-applications
```
🔒 **Requires Authentication**

**Description**: Create a new loan application

**Request Body**:
```json
{
  "productId": "product_id",
  "amount": 10000,
  "term": 12,
  "purpose": "Business expansion"
}
```

### Get User's Loan Applications
```http
GET /api/loan-applications
```
🔒 **Requires Authentication**

**Description**: Get all loan applications for the current user

### Get Specific Loan Application
```http
GET /api/loan-applications/{id}
```
🔒 **Requires Authentication**

**Description**: Get loan application by ID or URL link

### Update Loan Application
```http
PATCH /api/loan-applications/{id}
```
🔒 **Requires Authentication**

**Description**: Update loan application details

**Request Body** (all fields optional):
```json
{
  "amount": 15000,
  "term": 18,
  "purpose": "Updated purpose",
  "acceptTerms": true,
  "paidAppFee": true
}
```

### Delete Loan Application
```http
DELETE /api/loan-applications/{id}
```
🔒 **Requires Authentication**

**Description**: Delete loan application (only incomplete applications)

### Update Application Step
```http
PATCH /api/loan-applications/{id}/step
```
🔒 **Requires Authentication**

**Description**: Update application progress step

**Request Body**:
```json
{
  "step": 2
}
```

### Update Application Status
```http
PATCH /api/loan-applications/{id}/status
```
🔒 **Requires Authentication**

**Description**: Update application status

**Request Body**:
```json
{
  "status": "PENDING"
}
```

### Respond to Fresh Offer
```http
POST /api/loan-applications/{id}/fresh-offer-response
```
🔒 **Requires Authentication**

**Description**: Respond to a fresh offer proposed by admin.

**Request Body**:
```json
{
  "action": "accept" | "reject"
}
```

**Behavior**:
- When `action` is `accept`: application terms are updated to the fresh-offer terms and status moves to `PENDING_ATTESTATION`.
- When `action` is `reject`: original terms are restored (if available) and status returns to `PENDING_APPROVAL`.

Errors are returned if the application is not in `PENDING_FRESH_OFFER` or no fresh offer exists.

### Document Management

#### Upload Documents
```http
POST /api/loan-applications/{id}/documents
```
🔒 **Requires Authentication**

**Description**: Upload documents for a loan application

**Content-Type**: `multipart/form-data`

#### Get Application Documents
```http
GET /api/loan-applications/{id}/documents
```
🔒 **Requires Authentication**

#### Get Specific Document
```http
GET /api/loan-applications/{id}/documents/{documentId}
```
🔒 **Requires Authentication**

**Response**: Binary file stream

#### Update Document Status
```http
PATCH /api/loan-applications/{id}/documents/{documentId}
```
🔒 **Requires Authentication**

**Request Body**:
```json
{
  "status": "APPROVED"
}
```

#### Delete Document
```http
DELETE /api/loan-applications/{id}/documents/{documentId}
```
🔒 **Requires Authentication**

#### Link Existing Documents
```http
POST /api/loan-applications/{id}/link-documents
```
🔒 **Requires Authentication**

**Request Body**:
```json
{
  "documentIds": ["doc1", "doc2"],
  "documentTypes": ["IC_FRONT", "IC_BACK"]
}
```

### Attestation

#### Complete Attestation
```http
POST /api/loan-applications/{id}/complete-attestation
```
🔒 **Requires Authentication**

**Description**: Complete attestation for loan application

**Request Body**:
```json
{
  "attestationType": "IMMEDIATE",
  "attestationVideoWatched": true,
  "attestationTermsAccepted": true
}
```

#### Request Live Call
```http
POST /api/loan-applications/{id}/request-live-call
```
🔒 **Requires Authentication**

**Description**: Request live video call attestation

**Request Body**:
```json
{
  "attestationType": "MEETING",
  "reason": "terms_rejected"
}
```

### Get Application History
```http
GET /api/loan-applications/{id}/history
```
🔒 **Requires Authentication**

**Description**: Get application status history timeline

---

## Loans

### Get User's Loans
```http
GET /api/loans
```
🔒 **Requires Authentication**

**Description**: Get all loans for the current user (active, pending discharge, discharged)

**Response**:
```json
{
  "loans": [
    {
      "id": "loan_id",
      "principalAmount": 10000,
      "outstandingBalance": 8500,
      "interestRate": 12.5,
      "term": 12,
      "monthlyPayment": 920.50,
      "nextPaymentDue": "2023-12-01T00:00:00Z",
      "status": "ACTIVE",
      "disbursedAt": "2023-01-01T00:00:00Z",
      "application": {
        "product": {
          "name": "Business Loan",
          "code": "BL001"
        }
      }
    }
  ]
}
```

### Get Specific Loan
```http
GET /api/loans/{id}
```
🔒 **Requires Authentication**

**Description**: Get detailed information about a specific loan

### Get Loan Repayments
```http
GET /api/loans/{id}/repayments
```
🔒 **Requires Authentication**

**Description**: Get repayment history for a loan

**Response**:
```json
{
  "repayments": [
    {
      "id": "repayment_id",
      "amount": 920.50,
      "principalAmount": 750.00,
      "interestAmount": 170.50,
      "status": "PAID",
      "dueDate": "2023-02-01T00:00:00Z",
      "paidAt": "2023-01-30T10:30:00Z",
      "createdAt": "2023-01-01T00:00:00Z"
    }
  ]
}
```

### Get Loan Transactions
```http
GET /api/loans/{id}/transactions
```
🔒 **Requires Authentication**

**Description**: Get payment transactions from wallet for a loan

### Get Late Fees
```http
GET /api/loans/{id}/late-fees
```
🔒 **Requires Authentication**

**Description**: Get late fee information for a loan

---

## Products

### Get All Products
```http
GET /api/products
```

**Description**: Get all active loan products

**Query Parameters**:
- `code` (optional): Filter by product code

**Response**:
```json
[
  {
    "id": "product_id",
    "code": "BL001",
    "name": "Business Loan",
    "description": "Loan for business purposes",
    "minAmount": 5000,
    "maxAmount": 100000,
    "repaymentTerms": [6, 12, 18, 24],
    "interestRate": 12.5,
    "eligibility": ["Malaysian citizen", "Age 21-60"],
    "isActive": true,
    "createdAt": "2023-01-01T00:00:00Z",
    "updatedAt": "2023-01-01T00:00:00Z"
  }
]
```

### Get Product by ID
```http
GET /api/products/{id}
```

**Description**: Get specific product details

### Create Product
```http
POST /api/products
```
🔒 **Requires Authentication**

**Description**: Create a new loan product

### Update Product
```http
PATCH /api/products/{id}
```
🔒 **Requires Authentication**

**Description**: Update product details

### Delete Product
```http
DELETE /api/products/{id}
```
🔒 **Requires Authentication**

**Description**: Delete a product

---

## Notifications

### Get User Notifications
```http
GET /api/notifications
```
🔒 **Requires Authentication**

**Description**: Get user's notifications with pagination

**Query Parameters**:
- `page`: Page number
- `limit`: Items per page

### Mark Notifications as Read
```http
PATCH /api/notifications
```
🔒 **Requires Authentication**

**Description**: Mark multiple notifications as read

**Request Body**:
```json
{
  "notificationIds": ["notif1", "notif2"]
}
```

### Delete Notification
```http
DELETE /api/notifications/{id}
```
🔒 **Requires Authentication**

**Description**: Delete a specific notification

---

## Admin Endpoints

> ⚠️ **Admin Only**: All admin endpoints require admin authentication

### Authentication

#### Admin Login
```http
POST /api/admin/login
```

**Request Body**:
```json
{
  "phoneNumber": "+60123456789",
  "password": "adminpassword"
}
```

#### Admin Refresh Token
```http
POST /api/admin/refresh
```

#### Admin Logout
```http
POST /api/admin/logout
```

#### Get Admin Profile
```http
GET /api/admin/me
```

### Dashboard & Analytics

#### Get Dashboard Stats
```http
GET /api/admin/dashboard
```

**Description**: Get overall dashboard statistics

#### Get Monthly Stats
```http
GET /api/admin/monthly-stats
```

**Description**: Get monthly statistics for charts

#### Get Daily Stats
```http
GET /api/admin/daily-stats
```

**Description**: Get daily statistics for the last 30 days

### User Management

#### Get All Users
```http
GET /api/admin/users
```

**Query Parameters**:
- `limit`: Number of users to return

#### Get Specific User
```http
GET /api/admin/users/{id}
```

#### Update User
```http
PUT /api/admin/users/{id}
```

**Request Body**:
```json
{
  "fullName": "Updated Name",
  "email": "updated@email.com",
  "phoneNumber": "+1234567890",
  "role": "USER"
}
```

#### Delete User
```http
DELETE /api/admin/users/{id}
```

### Application Management

#### Get Application Counts
```http
GET /api/admin/applications/counts
```

**Description**: Get counts by application status

#### Get All Applications
```http
GET /api/admin/applications
```

#### Get Specific Application
```http
GET /api/admin/applications/{id}
```

#### Update Application Status
```http
PATCH /api/admin/applications/{id}/status
```

**Request Body**:
```json
{
  "status": "APPROVED"
}
```

#### Get Application History
```http
GET /api/admin/applications/{id}/history
```

#### Disburse Loan
```http
POST /api/admin/applications/{id}/disburse
```

**Request Body**:
```json
{
  "notes": "Disbursement notes"
}
```

### Live Attestations

#### Get Live Attestation Requests
```http
GET /api/admin/applications/live-attestations
```

#### Complete Live Attestation
```http
POST /api/admin/applications/{id}/complete-live-attestation
```

**Request Body**:
```json
{
  "notes": "Call completed successfully",
  "meetingCompletedAt": "2023-12-01T10:00:00Z"
}
```

#### Complete Attestation (General)
```http
POST /api/admin/applications/{id}/complete-attestation
```

**Request Body**:
```json
{
  "attestationType": "IMMEDIATE",
  "attestationNotes": "Approved",
  "attestationVideoWatched": true,
  "attestationTermsAccepted": true,
  "meetingCompletedAt": "2023-12-01T10:00:00Z"
}
```

### Document Management

#### Update Document Status
```http
PATCH /api/admin/documents/{id}/status
```

**Request Body**:
```json
{
  "status": "APPROVED"
}
```

### Loan Management

#### Get All Loans
```http
GET /api/admin/loans
```

#### Get Specific Loan
```http
GET /api/admin/loans/{id}
```

#### Get Loan Repayments
```http
GET /api/admin/loans/{id}/repayments
```

#### Get Loan Transactions
```http
GET /api/admin/loans/{id}/transactions
```

#### Sync Loan Balances
```http
POST /api/admin/loans/sync-balances
```

**Description**: Recalculate outstanding balances for all loans

### Loan Discharge Management

#### Get Pending Discharge Requests
```http
GET /api/admin/loans/pending-discharge
```

#### Request Loan Discharge
```http
POST /api/admin/loans/{id}/request-discharge
```

**Request Body**:
```json
{
  "reason": "Loan fully paid"
}
```

#### Approve Discharge
```http
POST /api/admin/loans/{id}/approve-discharge
```

#### Reject Discharge
```http
POST /api/admin/loans/{id}/reject-discharge
```

**Request Body**:
```json
{
  "reason": "Outstanding balance remaining"
}
```

### Payment Management

#### Get Pending Repayments
```http
GET /api/admin/repayments/pending
```

#### Get All Repayments
```http
GET /api/admin/repayments
```

**Query Parameters**:
- `status`: Filter by status (PENDING, APPROVED, REJECTED, all)
- `limit`: Maximum results to return

#### Approve Repayment
```http
POST /api/admin/repayments/{id}/approve
```

**Request Body**:
```json
{
  "notes": "Payment verified and approved"
}
```

#### Reject Repayment
```http
POST /api/admin/repayments/{id}/reject
```

**Request Body**:
```json
{
  "reason": "Invalid payment proof",
  "notes": "Additional notes"
}
```

#### Create Manual Payment
```http
POST /api/admin/payments/manual
```

**Request Body**:
```json
{
  "loanId": "loan_id",
  "amount": 920.50,
  "paymentMethod": "bank_transfer",
  "reference": "TXN123456",
  "notes": "Manual payment entry",
  "paymentDate": "2023-12-01"
}
```

### Disbursement Management

#### Get All Disbursements
```http
GET /api/admin/disbursements
```

**Query Parameters**:
- `limit`: Number of results
- `offset`: Number to skip
- `status`: Filter by status

### Notification Management

#### Get All Notifications
```http
GET /api/admin/notifications
```

**Query Parameters**:
- `page`: Page number
- `limit`: Items per page
- `type`: Filter by type (SYSTEM, MARKETING)
- `priority`: Filter by priority (LOW, MEDIUM, HIGH)
- `isRead`: Filter by read status

#### Send Notification
```http
POST /api/admin/send-notification
```

**Request Body**:
```json
{
  "title": "Important Update",
  "message": "Your application has been approved",
  "type": "SYSTEM",
  "priority": "HIGH",
  "recipientType": "all",
  "link": "/dashboard/applications",
  "expiresAt": "2023-12-31T23:59:59Z"
}
```

### Notification Templates

#### Get Templates
```http
GET /api/admin/notification-templates
```

#### Create Template
```http
POST /api/admin/notification-templates
```

**Request Body**:
```json
{
  "code": "LOAN_APPROVED",
  "title": "Loan Approved",
  "message": "Your loan application has been approved",
  "type": "SYSTEM"
}
```

#### Update Template
```http
PUT /api/admin/notification-templates/{id}
```

#### Delete Template
```http
DELETE /api/admin/notification-templates/{id}
```

### Notification Groups

#### Get Groups
```http
GET /api/admin/notification-groups
```

#### Create Group
```http
POST /api/admin/notification-groups
```

**Request Body**:
```json
{
  "name": "Active Borrowers",
  "description": "Users with active loans",
  "filters": {
    "hasActiveLoan": true
  }
}
```

#### Update Group
```http
PUT /api/admin/notification-groups/{id}
```

#### Delete Group
```http
DELETE /api/admin/notification-groups/{id}
```

### System Management

#### Ensure Wallets
```http
POST /api/admin/ensure-wallets
```

**Description**: Create wallets for all users who don't have one

### Late Fees (Admin)

All endpoints require admin role. See `backend/src/api/admin/late-fees.ts`.

- GET `/api/admin/late-fees` — repayments with assessed late fees
- GET `/api/admin/late-fees/status` — latest processing status + alerts
- POST `/api/admin/late-fees/process` — manual processing (force mode)
- GET `/api/admin/late-fees/repayment/{repaymentId}` — fee summary
- GET `/api/admin/late-fees/repayment/{repaymentId}/total-due` — original + fees
- POST `/api/admin/late-fees/repayment/{repaymentId}/handle-payment` — allocate payment
- POST `/api/admin/late-fees/repayment/{repaymentId}/waive` — manual waive
- GET `/api/admin/late-fees/logs?limit=10` — recent logs

Scheduling: Daily late-fee processing cron at 1:00 AM MYT (UTC+8) via node-cron. See `backend/src/lib/cronScheduler.ts` and `backend/src/lib/lateFeeProcessor.ts`.

---

## Response Codes

### Success Codes
- `200 OK`: Request successful
- `201 Created`: Resource created successfully

### Client Error Codes
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded

### Server Error Codes
- `500 Internal Server Error`: Server error

---

## Rate Limiting

The API implements rate limiting to prevent abuse. If you exceed the rate limit, you'll receive a `429 Too Many Requests` response.

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details"
}
```

---

## Development Notes

1. **Authentication**: Always include the `Authorization` header with Bearer token for protected endpoints
2. **Content-Type**: Use `application/json` for JSON requests, `multipart/form-data` for file uploads
3. **Date Format**: All dates are in ISO 8601 format (`YYYY-MM-DDTHH:mm:ssZ`)
4. **Pagination**: Use `page` and `limit` query parameters where supported
5. **File Uploads**: Documents are uploaded using multipart/form-data
6. **Environment**: Configure base URL based on your environment (development/production)

---

## Support

For technical support or questions about the API, please contact the development team or refer to the internal documentation. 