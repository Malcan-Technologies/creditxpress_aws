# Signing Orchestrator API Endpoints

## Authentication
All admin endpoints require API key authentication:
```
Authorization: Bearer ${SIGNING_ORCHESTRATOR_API_KEY}
```

## Core Agreement Management

### 1. Create/Initialize Agreement
```http
POST /api/agreements
Content-Type: application/json

{
  "loanId": "loan_123",
  "userId": "user_456", 
  "agreementType": "LOAN_AGREEMENT",
  "originalFile": "base64_encoded_pdf_or_file_path"
}
```

### 2. Get Agreement Status
```http
GET /api/agreements/:loanId
Response: {
  "id": "agreement_xyz",
  "loanId": "loan_123",
  "status": "MTSA_SIGNED",
  "mtsaStatus": "SIGNED",
  "signedAt": "2024-01-15T10:30:00Z",
  "files": {
    "original": "/data/original/agreement_xyz.pdf",
    "signed": "/data/signed/agreement_xyz_signed.pdf",
    "stamped": null
  }
}
```

### 3. List All Agreements (Admin)
```http
GET /api/admin/agreements?status=MTSA_SIGNED&limit=50&offset=0
Response: {
  "agreements": [...],
  "total": 150,
  "hasMore": true
}
```

## File Operations

### 4. Download Signed Agreement (Admin)
```http
GET /api/admin/agreements/:agreementId/download/signed
Response: PDF file + audit log entry
```

### 5. Upload Stamped Agreement (Admin)
```http
POST /api/admin/agreements/:agreementId/upload/stamped
Content-Type: multipart/form-data

File: stamped_agreement.pdf
Notes: "Company seal and stamp applied"
```

### 6. Get File Metadata
```http
GET /api/agreements/:agreementId/files
Response: {
  "original": {
    "path": "/data/original/...",
    "size": 1234567,
    "hash": "sha256_hash",
    "uploadedAt": "2024-01-15T09:00:00Z"
  },
  "signed": {
    "path": "/data/signed/...",
    "size": 1256789,
    "hash": "sha256_hash", 
    "signedAt": "2024-01-15T10:30:00Z"
  },
  "stamped": null
}
```

## MTSA Integration

### 7. Send to MTSA for Signing
```http
POST /api/agreements/:agreementId/mtsa/sign
{
  "signerInfo": {
    "name": "John Doe",
    "ic": "123456-78-9012",
    "phone": "+60123456789"
  }
}
```

### 8. Check MTSA Status
```http
GET /api/agreements/:agreementId/mtsa/status
Response: {
  "mtsaTransactionId": "mtsa_txn_123",
  "status": "SIGNED",
  "signedAt": "2024-01-15T10:30:00Z",
  "certificateInfo": {...}
}
```

### 9. Retrieve from MTSA
```http
POST /api/agreements/:agreementId/mtsa/retrieve
Response: {
  "success": true,
  "filePath": "/data/signed/agreement_xyz_signed.pdf",
  "fileHash": "sha256_hash"
}
```

## Admin Operations

### 10. Bulk Download (Admin)
```http
POST /api/admin/agreements/bulk-download
{
  "agreementIds": ["id1", "id2", "id3"],
  "downloadType": "signed" // signed, original, stamped
}
Response: ZIP file or download links
```

### 11. Agreement Audit Trail
```http
GET /api/admin/agreements/:agreementId/audit
Response: {
  "logs": [
    {
      "action": "MTSA_SIGNED",
      "performedBy": "system",
      "timestamp": "2024-01-15T10:30:00Z",
      "details": "Successfully signed via MTSA"
    }
  ]
}
```

### 12. Admin Dashboard Stats
```http
GET /api/admin/agreements/stats
Response: {
  "total": 500,
  "byStatus": {
    "PENDING": 10,
    "MTSA_SIGNED": 250,
    "DOWNLOADED": 200,
    "STAMPED": 150,
    "COMPLETED": 140
  },
  "recentActivity": [...]
}
```

## Webhook Integration

### 13. MTSA Callback (Internal)
```http
POST /api/webhooks/mtsa/callback
{
  "transactionId": "mtsa_txn_123",
  "status": "SIGNED",
  "signedDocument": "base64_encoded_pdf"
}
```

### 14. DocuSeal Integration
```http
POST /api/agreements/:agreementId/docuseal/sync
{
  "docusealSubmissionId": "submission_123",
  "status": "completed"
}
```

## Health & Monitoring

### 15. Health Check
```http
GET /health
Response: {
  "status": "healthy",
  "database": "connected",
  "mtsa": "reachable",
  "storage": "available"
}
```

### 16. System Status (Admin)
```http
GET /api/admin/system/status
Response: {
  "database": "healthy",
  "mtsa_connectivity": "ok",
  "disk_usage": {
    "signed": "2.5GB",
    "original": "1.8GB", 
    "stamped": "3.2GB"
  }
}
```

## Error Responses
All endpoints follow standard HTTP status codes:
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized 
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (e.g., already exists)
- `500` - Internal Server Error

Error response format:
```json
{
  "error": "AGREEMENT_NOT_FOUND",
  "message": "Agreement with loanId 'loan_123' not found",
  "timestamp": "2024-01-15T10:30:00Z"
}
```
