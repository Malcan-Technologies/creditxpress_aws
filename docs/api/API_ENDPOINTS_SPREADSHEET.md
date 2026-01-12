# CreditXpress API Endpoints - Spreadsheet Format

## VPS Backend APIs (api.creditxpress.com.my)

| No. | Method | API URL | API Key | Role | Environment | Testing Windows | External/Internal | Location | Remarks |
|-----|--------|---------|---------|------|-------------|-----------------|-------------------|----------|---------|
| 1 | POST | api.creditxpress.com.my/api/auth/login | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | User login with phone/password |
| 2 | POST | api.creditxpress.com.my/api/auth/register | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | User registration |
| 3 | POST | api.creditxpress.com.my/api/auth/refresh | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Refresh access token |
| 4 | POST | api.creditxpress.com.my/api/auth/logout | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | User logout |
| 5 | POST | api.creditxpress.com.my/api/auth/forgot-password | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Request password reset |
| 6 | POST | api.creditxpress.com.my/api/auth/reset-password | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Reset password with token |
| 7 | POST | api.creditxpress.com.my/api/auth/verify-phone | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Verify phone with OTP |
| 8 | POST | api.creditxpress.com.my/api/auth/resend-otp | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Resend OTP |
| 9 | GET | api.creditxpress.com.my/api/users/me | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get current user profile |
| 10 | PUT | api.creditxpress.com.my/api/users/me | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Update user profile |
| 11 | POST | api.creditxpress.com.my/api/users/change-phone | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Request phone change with OTP |
| 12 | POST | api.creditxpress.com.my/api/users/verify-phone-change | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Verify phone change with OTP |
| 13 | GET | api.creditxpress.com.my/api/onboarding/step | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get current onboarding step |
| 14 | POST | api.creditxpress.com.my/api/onboarding/personal-info | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Submit personal information |
| 15 | POST | api.creditxpress.com.my/api/onboarding/employment-info | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Submit employment information |
| 16 | POST | api.creditxpress.com.my/api/onboarding/bank-info | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Submit bank information |
| 17 | POST | api.creditxpress.com.my/api/onboarding/complete | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Complete onboarding |
| 18 | GET | api.creditxpress.com.my/api/kyc/status | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get KYC status |
| 19 | POST | api.creditxpress.com.my/api/kyc/documents | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Upload KYC documents |
| 20 | GET | api.creditxpress.com.my/api/kyc/documents | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get uploaded documents |
| 21 | POST | api.creditxpress.com.my/api/kyc/face-verification | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Submit face verification |
| 22 | POST | api.creditxpress.com.my/api/kyc/liveness-check | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Submit liveness check |
| 23 | GET | api.creditxpress.com.my/api/products | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Get all active products |
| 24 | GET | api.creditxpress.com.my/api/products?code={code} | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Get specific product by code |
| 25 | GET | api.creditxpress.com.my/api/loan-applications | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get user's loan applications |
| 26 | POST | api.creditxpress.com.my/api/loan-applications | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Create new loan application |
| 27 | GET | api.creditxpress.com.my/api/loan-applications/:id | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get specific application |
| 28 | PUT | api.creditxpress.com.my/api/loan-applications/:id | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Update application |
| 29 | POST | api.creditxpress.com.my/api/loan-applications/:id/documents | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Upload application documents |
| 30 | GET | api.creditxpress.com.my/api/loan-applications/:id/documents | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get application documents |
| 31 | POST | api.creditxpress.com.my/api/loan-applications/:id/submit | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Submit application for review |
| 32 | GET | api.creditxpress.com.my/api/loans | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get user's active loans |
| 33 | GET | api.creditxpress.com.my/api/loans/:id | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get specific loan details |
| 34 | GET | api.creditxpress.com.my/api/loans/:id/repayments | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get loan repayment schedule |
| 35 | GET | api.creditxpress.com.my/api/loans/:id/transactions | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get loan transaction history |
| 36 | GET | api.creditxpress.com.my/api/loans/:id/late-fees | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get loan late fees |
| 37 | POST | api.creditxpress.com.my/api/loans/:id/early-settlement/quote | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get early settlement quote |
| 38 | POST | api.creditxpress.com.my/api/loans/:id/early-settlement/request | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Request early settlement |
| 39 | GET | api.creditxpress.com.my/api/loans/:loanId/download-agreement | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Download loan agreement |
| 40 | GET | api.creditxpress.com.my/api/loans/:loanId/download-stamped-agreement | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Download stamped agreement |
| 41 | GET | api.creditxpress.com.my/api/loans/:loanId/download-stamp-certificate | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Download stamp certificate |
| 42 | GET | api.creditxpress.com.my/api/loans/receipt/:receiptId | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Get payment receipt |
| 43 | GET | api.creditxpress.com.my/api/loans/:loanId/receipts/:receiptId/download | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Download receipt PDF |
| 44 | GET | api.creditxpress.com.my/api/wallet | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get wallet balance and info |
| 45 | GET | api.creditxpress.com.my/api/wallet/transactions | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get wallet transaction history |
| 46 | POST | api.creditxpress.com.my/api/wallet/deposit | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Deposit funds to wallet |
| 47 | POST | api.creditxpress.com.my/api/wallet/withdraw | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Withdraw funds from wallet |
| 48 | POST | api.creditxpress.com.my/api/wallet/repay-loan | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Repay loan from wallet |
| 49 | PATCH | api.creditxpress.com.my/api/wallet/transactions/:id/process | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Process pending transaction |
| 50 | GET | api.creditxpress.com.my/api/bank-accounts | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Get supported bank accounts |
| 51 | GET | api.creditxpress.com.my/api/notifications | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get user notifications |
| 52 | PATCH | api.creditxpress.com.my/api/notifications/:id/read | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Mark notification as read |
| 53 | POST | api.creditxpress.com.my/api/notifications/mark-all-read | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Mark all notifications as read |
| 54 | GET | api.creditxpress.com.my/api/settings | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Get system settings |
| 55 | GET | api.creditxpress.com.my/api/settings/company | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Get company information |
| 56 | POST | api.creditxpress.com.my/api/ctos/ekyc | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Submit CTOS eKYC request |
| 57 | GET | api.creditxpress.com.my/api/ctos/status/:sessionId | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Get CTOS verification status |
| 58 | POST | api.creditxpress.com.my/api/docuseal/create-submission | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Create DocuSeal submission |
| 59 | GET | api.creditxpress.com.my/api/docuseal/submission/:id | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get submission status |
| 60 | POST | api.creditxpress.com.my/api/docuseal/webhook | No (HMAC) | Webhook | Production | Office Hour (9AM - 5PM) | External | N/A | DocuSeal webhook receiver |
| 61 | POST | api.creditxpress.com.my/api/mtsa/enroll | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Enroll user for digital signing |
| 62 | POST | api.creditxpress.com.my/api/mtsa/sign | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Sign document via MTSA |
| 63 | GET | api.creditxpress.com.my/api/mtsa/status/:userId | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get MTSA signing status |
| 64 | POST | api.creditxpress.com.my/api/pki/request-otp | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Request OTP for signing |
| 65 | POST | api.creditxpress.com.my/api/pki/verify-otp | Yes | User | Production | Office Hour (9AM - 5PM) | External | N/A | Verify OTP for signing |
| 66 | GET | api.creditxpress.com.my/api/pki/cert-status/:userId | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get certificate status |

## Admin Panel APIs (api.creditxpress.com.my/api/admin)

| No. | Method | API URL | API Key | Role | Environment | Testing Windows | External/Internal | Location | Remarks |
|-----|--------|---------|---------|------|-------------|-----------------|-------------------|----------|---------|
| 67 | POST | api.creditxpress.com.my/api/admin/login | No | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Admin login |
| 68 | POST | api.creditxpress.com.my/api/admin/refresh | No | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Refresh admin token |
| 69 | POST | api.creditxpress.com.my/api/admin/logout | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Admin logout |
| 70 | GET | api.creditxpress.com.my/api/admin/me | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get admin profile |
| 71 | PUT | api.creditxpress.com.my/api/admin/me | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Update admin profile |
| 72 | GET | api.creditxpress.com.my/api/admin/dashboard | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get dashboard statistics |
| 73 | GET | api.creditxpress.com.my/api/admin/monthly-stats | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get monthly statistics |
| 74 | GET | api.creditxpress.com.my/api/admin/daily-stats | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get daily statistics |
| 75 | GET | api.creditxpress.com.my/api/admin/users | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get all users |
| 76 | GET | api.creditxpress.com.my/api/admin/users/:id | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get specific user |
| 77 | PUT | api.creditxpress.com.my/api/admin/users/:id | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Update user |
| 78 | DELETE | api.creditxpress.com.my/api/admin/users/:id | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Delete user |
| 79 | GET | api.creditxpress.com.my/api/admin/applications/counts | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get application counts |
| 80 | GET | api.creditxpress.com.my/api/admin/applications | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get all applications |
| 81 | GET | api.creditxpress.com.my/api/admin/applications/live-attestations | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get live attestations |
| 82 | POST | api.creditxpress.com.my/api/admin/applications/:id/complete-live-attestation | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Complete live attestation |
| 83 | GET | api.creditxpress.com.my/api/admin/applications/:id | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get specific application |
| 84 | PATCH | api.creditxpress.com.my/api/admin/applications/:id/status | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Update application status |
| 85 | POST | api.creditxpress.com.my/api/admin/applications/:id/fresh-offer | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Create fresh offer |
| 86 | POST | api.creditxpress.com.my/api/admin/applications/:id/disburse | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Disburse loan |
| 87 | POST | api.creditxpress.com.my/api/admin/applications/:id/complete-attestation | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Complete attestation |
| 88 | GET | api.creditxpress.com.my/api/admin/applications/:id/history | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get application history |
| 89 | PATCH | api.creditxpress.com.my/api/admin/documents/:id/status | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Update document status |
| 90 | GET | api.creditxpress.com.my/api/admin/loans | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get all loans |
| 91 | GET | api.creditxpress.com.my/api/admin/loans/:id | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get specific loan |
| 92 | GET | api.creditxpress.com.my/api/admin/loans/pending-discharge | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get loans pending discharge |
| 93 | POST | api.creditxpress.com.my/api/admin/loans/:id/request-discharge | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Request loan discharge |
| 94 | POST | api.creditxpress.com.my/api/admin/loans/:id/approve-discharge | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Approve loan discharge |
| 95 | POST | api.creditxpress.com.my/api/admin/loans/:id/reject-discharge | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Reject loan discharge |
| 96 | POST | api.creditxpress.com.my/api/admin/loans/sync-balances | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Sync loan balances |
| 97 | GET | api.creditxpress.com.my/api/admin/loans/:id/transactions | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get loan transactions |
| 98 | GET | api.creditxpress.com.my/api/admin/loans/:id/repayments | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get loan repayments |
| 99 | GET | api.creditxpress.com.my/api/admin/repayments/pending | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get pending repayments |
| 100 | GET | api.creditxpress.com.my/api/admin/repayments | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get all repayments |
| 101 | POST | api.creditxpress.com.my/api/admin/repayments/:id/approve | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Approve repayment |
| 102 | POST | api.creditxpress.com.my/api/admin/repayments/:id/reject | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Reject repayment |
| 103 | POST | api.creditxpress.com.my/api/admin/payments/manual | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Create manual payment |
| 104 | POST | api.creditxpress.com.my/api/admin/payments/csv-upload | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Upload payment CSV |
| 105 | POST | api.creditxpress.com.my/api/admin/payments/csv-batch-approve | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Batch approve CSV payments |
| 106 | GET | api.creditxpress.com.my/api/admin/late-fees | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get late fees |
| 107 | GET | api.creditxpress.com.my/api/admin/late-fees/status | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get late fee processing status |
| 108 | POST | api.creditxpress.com.my/api/admin/late-fees/process | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Process late fees |
| 109 | GET | api.creditxpress.com.my/api/admin/late-fees/repayment/:repaymentId | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get repayment late fees |
| 110 | GET | api.creditxpress.com.my/api/admin/late-fees/repayment/:repaymentId/total-due | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get total due amount |
| 111 | POST | api.creditxpress.com.my/api/admin/late-fees/repayment/:repaymentId/handle-payment | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Handle late fee payment |
| 112 | POST | api.creditxpress.com.my/api/admin/late-fees/repayment/:repaymentId/waive | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Waive late fees |
| 113 | GET | api.creditxpress.com.my/api/admin/late-fees/logs | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get late fee processing logs |
| 114 | DELETE | api.creditxpress.com.my/api/admin/late-fees/alerts | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Clear late fee alerts |
| 115 | GET | api.creditxpress.com.my/api/admin/notifications | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get all notifications |
| 116 | GET | api.creditxpress.com.my/api/admin/notification-templates | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get notification templates |
| 117 | POST | api.creditxpress.com.my/api/admin/notification-templates | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Create notification template |
| 118 | PUT | api.creditxpress.com.my/api/admin/notification-templates/:id | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Update notification template |
| 119 | DELETE | api.creditxpress.com.my/api/admin/notification-templates/:id | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Delete notification template |
| 120 | GET | api.creditxpress.com.my/api/admin/notification-groups | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get notification groups |
| 121 | POST | api.creditxpress.com.my/api/admin/notification-groups | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Create notification group |
| 122 | PUT | api.creditxpress.com.my/api/admin/notification-groups/:id | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Update notification group |
| 123 | DELETE | api.creditxpress.com.my/api/admin/notification-groups/:id | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Delete notification group |
| 124 | POST | api.creditxpress.com.my/api/admin/send-notification | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Send notification |
| 125 | GET | api.creditxpress.com.my/api/admin/disbursements | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get all disbursements |
| 126 | GET | api.creditxpress.com.my/api/admin/products | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get all products |
| 127 | GET | api.creditxpress.com.my/api/admin/cron/status | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get cron job status |
| 128 | POST | api.creditxpress.com.my/api/admin/cron/trigger-late-fees | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Trigger late fee processing |
| 129 | POST | api.creditxpress.com.my/api/admin/trigger-upcoming-payment-notifications | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Trigger payment notifications |
| 130 | POST | api.creditxpress.com.my/api/admin/trigger-payment-notifications | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Trigger all payment notifications |
| 131 | GET | api.creditxpress.com.my/api/admin/loans/:loanId/signatures | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get loan signatures |
| 132 | GET | api.creditxpress.com.my/api/admin/applications/:applicationId/signatures | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get application signatures |
| 133 | POST | api.creditxpress.com.my/api/admin/applications/pin-sign | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | PIN-based signing |
| 134 | GET | api.creditxpress.com.my/api/admin/loans/:loanId/download-agreement | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Download loan agreement |
| 135 | GET | api.creditxpress.com.my/api/admin/loans/:loanId/download-stamped-agreement | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Download stamped agreement |
| 136 | POST | api.creditxpress.com.my/api/admin/loans/:id/upload-stamped-agreement | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Upload stamped agreement |
| 137 | POST | api.creditxpress.com.my/api/admin/loans/:id/upload-stamp-certificate | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Upload stamp certificate |
| 138 | GET | api.creditxpress.com.my/api/admin/loans/:loanId/download-stamp-certificate | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Download stamp certificate |
| 139 | GET | api.creditxpress.com.my/api/admin/:loanId/pdf-letters | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get PDF letters for loan |
| 140 | GET | api.creditxpress.com.my/api/admin/:loanId/borrower-info | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Get borrower information |
| 141 | POST | api.creditxpress.com.my/api/admin/:loanId/generate-pdf-letter | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Generate PDF letter |
| 142 | GET | api.creditxpress.com.my/api/admin/:loanId/pdf-letters/:filename/download | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | Download PDF letter |
| 143 | GET | api.creditxpress.com.my/api/admin/health-check | Yes | Admin | Production | Office Hour (9AM - 5PM) | External | N/A | System health check |

## Signing Orchestrator APIs (sign.creditxpress.com.my)

| No. | Method | API URL | API Key | Role | Environment | Testing Windows | External/Internal | Location | Remarks |
|-----|--------|---------|---------|------|-------------|-----------------|-------------------|----------|---------|
| 144 | GET | sign.creditxpress.com.my/health | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Basic health check |
| 145 | GET | sign.creditxpress.com.my/health/detailed | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Detailed health check |
| 146 | GET | sign.creditxpress.com.my/health/ready | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Kubernetes readiness probe |
| 147 | GET | sign.creditxpress.com.my/health/live | No | Public | Production | Office Hour (9AM - 5PM) | External | N/A | Kubernetes liveness probe |
| 148 | POST | sign.creditxpress.com.my/webhooks/docuseal | No (HMAC) | Webhook | Production | Office Hour (9AM - 5PM) | External | N/A | DocuSeal webhook receiver |
| 149 | POST | sign.creditxpress.com.my/api/sign | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Manual document signing |
| 150 | POST | sign.creditxpress.com.my/api/enroll | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Certificate enrollment |
| 151 | POST | sign.creditxpress.com.my/api/verify | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Verify signed PDF |
| 152 | GET | sign.creditxpress.com.my/api/cert/:userId | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Get certificate info |
| 153 | POST | sign.creditxpress.com.my/api/otp | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Request OTP |
| 154 | POST | sign.creditxpress.com.my/api/verify-cert-pin | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Verify certificate PIN |
| 155 | POST | sign.creditxpress.com.my/api/certificate | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Get certificate details |
| 156 | POST | sign.creditxpress.com.my/api/revoke | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Revoke certificate |
| 157 | POST | sign.creditxpress.com.my/api/test-getcert | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Test certificate retrieval |
| 158 | GET | sign.creditxpress.com.my/api/pki/cert-status/:userId | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Get certificate status |
| 159 | POST | sign.creditxpress.com.my/api/pki/request-otp | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Request OTP for PKI |
| 160 | POST | sign.creditxpress.com.my/api/pki/complete-signing | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Complete signing process |
| 161 | GET | sign.creditxpress.com.my/api/pki/session/:sessionId | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Get signing session |
| 162 | POST | sign.creditxpress.com.my/api/pki/sign-pdf | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Sign PDF document |
| 163 | POST | sign.creditxpress.com.my/api/pki/sign-pdf-pin | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Sign PDF with PIN |
| 164 | GET | sign.creditxpress.com.my/api/signed/:packetId | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | List signed PDFs |
| 165 | GET | sign.creditxpress.com.my/api/signed/:applicationId/download | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Download signed PDF |
| 166 | POST | sign.creditxpress.com.my/api/admin/agreements/:applicationId/upload/stamped | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Upload stamped agreement |
| 167 | POST | sign.creditxpress.com.my/api/admin/agreements/:applicationId/upload/certificate | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Upload certificate |
| 168 | GET | sign.creditxpress.com.my/api/admin/agreements/:applicationId/download/certificate | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Download certificate |
| 169 | GET | sign.creditxpress.com.my/api/admin/agreements/:applicationId/download/stamped | SIGNING_ORCHESTRATOR_API_KEY | API Key | Production | Office Hour (9AM - 5PM) | External | N/A | Download stamped agreement |

## Summary

**Total Endpoints:** 169
- **VPS Backend (User):** 66 endpoints
- **VPS Backend (Admin):** 77 endpoints  
- **Signing Orchestrator:** 26 endpoints

**API Key Requirements:**
- **SIGNING_ORCHESTRATOR_API_KEY:** Used for all signing orchestrator `/api/*` endpoints (25 endpoints)
- **DOCUSEAL_API_TOKEN:** Used internally by backend for DocuSeal integration
- **JWT Bearer Tokens:** Used for user/admin authentication on VPS backend
- **HMAC Signatures:** Used for webhook verification

**Authentication Types:**
- **Public:** No authentication required (18 endpoints)
- **User:** JWT token required (48 endpoints)
- **Admin:** JWT token with admin role required (77 endpoints)
- **API Key:** SIGNING_ORCHESTRATOR_API_KEY required (25 endpoints)
- **Webhook:** HMAC signature verification (1 endpoint)
