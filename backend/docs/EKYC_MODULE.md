e-KYC Module (MyKad Verification)

Overview
- Mobile-first e-KYC for Malaysian IC (MyKad): IC front/back upload, selfie capture, OCR, face match, and liveness detection.
- Desktop flow shows QR to switch to mobile capture; desktop polls until completion.
- If a user has a previously APPROVED KYC, skip and advance the current application.

Database Models (Prisma)
- KycSession → `kyc_sessions`
  - id, userId, applicationId, status (PENDING | IN_PROGRESS | APPROVED | REJECTED | MANUAL_REVIEW | FAILED), ocrData JSON, faceMatchScore, livenessScore, retryCount, createdAt, updatedAt, completedAt
  - Relations: `user`, `application`, `documents`
- KycDocument → `kyc_documents`
  - id, kycId, type ('front' | 'back' | 'selfie'), storageUrl, hashSha256, createdAt
  - Relation: `kycSession`

Status Transitions
- PENDING → IN_PROGRESS → APPROVED | MANUAL_REVIEW | REJECTED | FAILED
- On APPROVED: the corresponding loan application is updated to `PENDING_APPROVAL`.
- On FAIL: `retryCount` increments; users can retry uploads and processing.

Backend Endpoints (Express)
- Base path: `/api/kyc`
- POST `/start`
  - Body: `{ applicationId: string }`
  - Auth: Bearer token (phone-verified)
  - Behavior:
    - If user has an existing APPROVED KYC, immediately update the provided loan application to `PENDING_APPROVAL` and return approved.
    - Else create/reuse a `KycSession` for this application and return `{ kycId, status }`.
- POST `/:kycId/upload` (multipart/form-data)
  - Fields: `front` (file), `back` (file), `selfie` (file)
  - Stores files under `/uploads/kyc`, saves SHA256 hash and URL in `kyc_documents`.
  - Partial uploads supported for retries.
- POST `/:kycId/process`
  - Calls Python services (OCR / Face / Liveness) and updates the session with scores + ocrData.
  - Applies thresholds to set final status and, if APPROVED, sets the loan application status to `PENDING_APPROVAL`.
- GET `/:kycId/status`
  - Returns `{ status, faceMatchScore, livenessScore }` for desktop polling.

Env Configuration
- `KYC_SERVICES_BASE` (default `http://localhost`) used to compose service URLs:
  - OCR: `${KYC_SERVICES_BASE}:7001/ocr`
  - Face: `${KYC_SERVICES_BASE}:7002/face-match`
  - Liveness: `${KYC_SERVICES_BASE}:7003/liveness`
- Thresholds:
  - `KYC_FACE_THRESHOLD` (default 0.75)
  - `KYC_LIVENESS_THRESHOLD` (default 0.5)
- Encryption (AES-256-CBC):
  - `KYC_AES_KEY` (32 bytes), `KYC_AES_IV` (16 bytes)

Python Sidecars (FastAPI)
- OCR service (PaddleOCR integration placeholder)
  - POST `/ocr` → `{ name, ic_number, dob, address }`
- Face match service (InsightFace/CompreFace integration placeholder)
  - POST `/face-match` → `{ score: number }`
- Liveness service (SilentFace integration placeholder)
  - POST `/liveness` → `{ score: number }`

Docker (Dev)
- Defined in `backend/docker-compose.dev.yml`:
  - Services: `backend`, `postgres`, `ocr` (7001), `face` (7002), `liveness` (7003)
  - The Python services mount `./uploads` read-only to access uploaded images.
  - Start stack:
    - `docker compose -f backend/docker-compose.dev.yml down && docker compose -f backend/docker-compose.dev.yml up -d`

Frontend Flow (Next.js)
- On application submit (`PENDING_KYC`), the app checks `/api/kyc` (proxy) if KYC is already approved:
  - If approved: skip to loans page.
  - Else: redirect to `/dashboard/kyc?applicationId=...` (desktop QR page).
- Desktop page `/dashboard/kyc`:
  - Calls `/api/kyc/start` to create/reuse session, renders QR for mobile URL `/dashboard/kyc/capture?kycId=...`.
  - Polls `GET /api/kyc/:id/status` and redirects to loans on completion (any terminal state).
- Mobile capture `/dashboard/kyc/capture`:
  - Uploads `front`, `back`, `selfie` to `POST /api/kyc/:id/upload` then calls `POST /api/kyc/:id/process`, then navigates back to loans.

Security Notes
- All KYC endpoints require Bearer token and phone verification (middleware enforced).
- Files are stored locally in dev; in production replace with S3/MinIO and store only `storageUrl`+`hashSha256` in DB.
- Serve uploads only internally for sidecars; ensure HTTPS termination in front of API in production.
- Sensitive data (e.g., IC number from OCR) should be encrypted before storage using AES-256-CBC with managed keys.

Failure & Retry Handling
- Partial uploads allowed; re-post any missing image(s).
- On processing error, session marked `FAILED` and `retryCount` increments; client can retry processing.
- Manual review outcome is represented by `MANUAL_REVIEW` status.

Example Requests
```bash
# Start session
curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"applicationId":"<APP_ID>"}' \
  ${API}/api/kyc/start

# Upload files (front/back/selfie)
curl -H "Authorization: Bearer $TOKEN" -F front=@/path/front.jpg -F back=@/path/back.jpg -F selfie=@/path/selfie.jpg \
  ${API}/api/kyc/<KYC_ID>/upload

# Process
curl -H "Authorization: Bearer $TOKEN" -X POST ${API}/api/kyc/<KYC_ID>/process

# Poll status
curl -H "Authorization: Bearer $TOKEN" ${API}/api/kyc/<KYC_ID>/status
```

Implementation Pointers
- Replace Python stubs with actual PaddleOCR, InsightFace/CompreFace, and SilentFace integrations.
- Replace local disk storage with S3/MinIO client and presigned URLs.
- Extend validation to verify NRIC: format YYMMDD-##-#### and DOB match between IC and OCR results.


