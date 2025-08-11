KYC Services

- Endpoints:
  - POST /api/kyc/start { applicationId }
  - POST /api/kyc/:kycId/upload multipart/form-data (front, back, selfie)
  - POST /api/kyc/:kycId/process
  - GET  /api/kyc/:kycId/status

- Python sidecars:
  - ocr service at :7001/ocr
  - face service at :7002/face-match
  - liveness service at :7003/liveness

Configure thresholds via env:
- KYC_FACE_THRESHOLD (default 0.75)
- KYC_LIVENESS_THRESHOLD (default 0.5)
- KYC_AES_KEY / KYC_AES_IV for encryption

