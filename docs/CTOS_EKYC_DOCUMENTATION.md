# CTOS e-KYC Integration Flow

## Overview
The CTOS e-KYC integration enables automated Know Your Customer (KYC) verification for loan applicants. It handles identity document verification, liveness detection, and identity matching through CTOS's third-party service.

## Architecture

### Components
- **Backend API**: `backend/src/api/kyc.ts`, `backend/src/api/ctos.ts`
- **CTOS Service**: `backend/src/lib/ctosService.ts`
- **Frontend**: `frontend/app/dashboard/applications/[id]/kyc-verification/page.tsx`
- **Database**: `KycSession` model in Prisma

### Key Entities
- **KycSession**: Tracks the lifecycle of each KYC verification attempt
- **ref_id**: Unique transaction identifier sent to CTOS (now uses `kycSession.id` instead of `userId`)
- **onboarding_id**: CTOS-provided session identifier
- **onboarding_url**: URL where users complete KYC verification

---

## Complete Flow

### 1. KYC Session Initiation

#### Frontend Action
User clicks "Start CTOS KYC Verification" button on KYC verification page.

#### Backend Processing (`POST /api/kyc/start-ctos`)

**Step 1: Pre-validation checks**
- Check if user already has an APPROVED session → reject if found
- Check for existing IN_PROGRESS session within last 24 hours:
  - Status must be `IN_PROGRESS`
  - Must have `ctosOnboardingUrl` and `ctosOnboardingId`
  - `ctosStatus` must be 0 (Not Opened) or 1 (Processing)
  - Created within last 24 hours
  - If found → return existing session details with `resumed: true`

**Step 2: Create new KYC session**
```typescript
kycSession = await db.kycSession.create({
  data: {
    userId: req.user.userId,
    status: 'IN_PROGRESS',
    applicationId: applicationId // optional
  }
});
```

**Step 3: Call CTOS API**
```typescript
ctosResponse = await ctosService.createTransaction({
  ref_id: kycSession.id, // ✅ Changed from userId to kycSession.id
  document_name: user.idType || 'NRIC',
  document_number: user.idNumber || user.icNumber,
  platform: 'Web',
  backend_url: CTOS_WEBHOOK_URL,
  callback_mode: 2 // Detailed callback
});
```

**Step 4: Update session with CTOS response**
- Store `onboarding_id`, `onboarding_url`, `expired_at`
- Update `status` to `IN_PROGRESS`
- Generate KYC token (JWT) for frontend access

**Step 5: Return response**
```json
{
  "success": true,
  "kycId": "session-id",
  "onboardingUrl": "https://ctos-url...",
  "onboardingId": "encrypted-id",
  "expiredAt": "2025-10-30T11:04:48.818Z",
  "kycToken": "jwt-token",
  "ttlMinutes": 15,
  "resumed": false
}
```

---

### 2. User Completes KYC on CTOS

#### User Flow
1. Frontend redirects user to `onboardingUrl`
2. User submits:
   - Front IC image
   - Back IC image
   - Selfie (liveness check)
3. CTOS processes:
   - Document OCR
   - Face matching
   - Liveness detection
4. CTOS sends webhook to backend

---

### 3. CTOS Webhook Processing

#### Webhook Endpoint (`POST /api/ctos/webhook`)

**Step 1: Decrypt webhook data**
```typescript
const webhookData = ctosService.processWebhookData(req.body);
// Returns: { ref_id, onboarding_id, status, result, images... }
```

**Step 2: Find KYC session by ref_id** (robust lookup)
```typescript
// Primary: Direct lookup by id (new system)
kycSession = await prisma.kycSession.findUnique({
  where: { id: webhookData.ref_id }
});

// Fallback 1: Remove OPG-Capital prefix
if (!kycSession && webhookData.ref_id.startsWith('OPG-Capital')) {
  cleanRefId = webhookData.ref_id.replace('OPG-Capital', '');
  kycSession = await prisma.kycSession.findUnique({
    where: { id: cleanRefId }
  });
}

// Fallback 2: Legacy userId lookup (backward compatibility)
if (!kycSession) {
  kycSession = await prisma.kycSession.findFirst({
    where: {
      userId: cleanRefId,
      ctosOnboardingId: webhookData.onboarding_id
    },
    orderBy: { createdAt: 'desc' }
  });
}
```

**Step 3: Update session status**
```typescript
const newStatus = webhookData.status === 2 ? // Completed
  (webhookData.result === 1 ? 'APPROVED' : 'REJECTED') :
  webhookData.status === 3 ? 'FAILED' : 'IN_PROGRESS';

await prisma.kycSession.update({
  where: { id: kycSession.id },
  data: {
    status: newStatus,
    ctosStatus: webhookData.status,
    ctosResult: webhookData.result,
    ctosData: webhookData, // Store full webhook payload
    completedAt: webhookData.status === 2 ? new Date() : null
  }
});
```

**Step 4: Store images** (if provided)
- Save to `kyc_documents` table
- Link to `KycSession` via `kycSessionId`

**Step 5: Update user KYC status**
```typescript
if (newStatus === 'APPROVED') {
  await prisma.user.update({
    where: { id: kycSession.userId },
    data: { kycStatus: true }
  });
}
```

---

### 4. Frontend Polling for Status Updates

#### Polling Mechanism
Frontend polls `/api/kyc/session-status/${kycSessionId}` every 3 seconds:

```typescript
const pollDatabase = async () => {
  const statusResponse = await fetchWithTokenRefresh<{
    success: boolean;
    status: string;
    ctosResult: number;
    ctosStatus?: number;
    isCompleted: boolean;
    isApproved?: boolean;
  }>(`/api/kyc/session-status/${kycSessionId}`);

  // Check if approved (multiple conditions)
  if (statusResponse.success && 
      (statusResponse.status === 'APPROVED' || 
       statusResponse.ctosResult === 1 ||
       statusResponse.isApproved)) {
    window.location.reload(); // Refresh to show results
  }
};

// Poll every 3 seconds, timeout after 30 minutes
const interval = setInterval(pollDatabase, 3000);
setTimeout(() => clearInterval(interval), 30 * 60 * 1000);
```

---

### 5. Resume In-Progress Session

#### Check Status (`GET /api/kyc/user-ctos-status`)

Backend checks:
- Session exists and is `IN_PROGRESS`
- Has `ctosOnboardingUrl`
- `ctosStatus` is 0 or 1
- Created within last 24 hours

Returns:
```json
{
  "success": true,
  "hasKycSession": true,
  "kycSessionId": "session-id",
  "status": "IN_PROGRESS",
  "ctosStatus": 1,
  "ctosResult": null,
  "canResume": true,        // ✅ New field
  "resumeUrl": "https://...", // ✅ New field
  "canRetry": false,
  "isAlreadyApproved": false
}
```

#### Frontend Behavior
- If `canResume === true` → show "Resume KYC Verification" button
- If `canResume === false` → show "Start CTOS KYC Verification" button
- Clicking resume uses existing `resumeUrl` (no new session created)

---

## Critical Changes (Recent Updates)

### 1. ref_id Change (Duplicate Transaction Fix)

**Problem:**
- Previously used `userId` as `ref_id`
- If session expired, CTOS still had record with same `ref_id`
- New session creation failed with error 103: "Duplicate transaction found"

**Solution:**
- Changed `ref_id` from `userId` to `kycSession.id`
- Each KYC session has unique `ref_id` in CTOS
- Prevents duplicate transaction errors

**Files Changed:**
- `backend/src/api/kyc.ts` (lines 138, 150, 640, 1027, 1035, 1305, 1315)
- `backend/src/api/admin/kyc.ts` (lines 231, 243, 556, 566)
- `backend/src/api/ctos.ts` (line 55, 230)

**Webhook Compatibility:**
- Primary lookup: Direct `id` match
- Fallback: Remove "OPG-Capital" prefix
- Legacy: `userId` lookup for old sessions
- Handles multiple prefix formats

---

### 2. Session Resume Logic

**Problem:**
- Users couldn't resume expired sessions
- Frontend didn't know if session was resumable

**Solution:**
- Backend checks for existing IN_PROGRESS sessions within 24h
- Returns `canResume` and `resumeUrl` in `/user-ctos-status`
- Frontend shows resume button when applicable

**Implementation:**
```typescript
// Backend check (24h calculation)
const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
const canResume = kycSession.status === 'IN_PROGRESS' && 
                 kycSession.ctosOnboardingUrl && 
                 (ctosStatus.status === 0 || ctosStatus.status === 1) &&
                 kycSession.createdAt >= twentyFourHoursAgo;
```

---

### 3. Prevent Multiple Session Creation

**Problem:**
- Rapid button clicks created multiple sessions
- Frontend didn't disable button immediately

**Solution:**
- Added `startingKyc` state
- Button disabled immediately on click
- Prevents concurrent API calls

---

### 4. Polling Status Check

**Problem:**
- Frontend only checked `status === 'APPROVED'`
- Some cases needed `ctosResult === 1` check

**Solution:**
- Check multiple conditions:
  - `status === 'APPROVED'`
  - `ctosResult === 1`
  - `isApproved === true`

---

### 5. ctosData Field in Select Clause

**Problem:**
- `/user-ctos-status` catch block didn't include `ctosData` in select
- Cached rejection messages weren't returned

**Solution:**
- Added `ctosData: true` to Prisma select clause (line 1297 in `kyc.ts`)

---

## CTOS Status Codes

### ctosStatus (Session Status)
- `0`: Not Opened
- `1`: Processing
- `2`: Completed
- `3`: Expired/Failed

### ctosResult (Verification Result)
- `0`: Rejected
- `1`: Approved
- `2`: Not Available

### Internal Status Mapping
```typescript
// Status mapping from CTOS to internal
status: ctosStatus === 2 ? 
  (ctosResult === 1 ? 'APPROVED' : 'REJECTED') :
  ctosStatus === 3 ? 'FAILED' : 'IN_PROGRESS'
```

---

## API Endpoints

### Customer Endpoints

1. **Start KYC** - `POST /api/kyc/start-ctos`
   - Creates new session or returns existing
   - Returns `onboardingUrl`

2. **Check Status** - `GET /api/kyc/user-ctos-status`
   - Returns current session status
   - Includes `canResume` and `resumeUrl`

3. **Session Status** - `GET /api/kyc/session-status/:kycSessionId`
   - Polling endpoint
   - Returns `status`, `ctosResult`, `isApproved`

### Admin Endpoints

1. **Admin Start KYC** - `POST /api/admin/kyc/start-ctos/:userId`
   - Similar to customer endpoint
   - Admin-initiated KYC

### CTOS Integration Endpoints

1. **Webhook** - `POST /api/ctos/webhook`
   - Receives CTOS completion updates
   - Updates session status

2. **Get Status** - `POST /api/ctos/get-status`
   - Manually fetch CTOS status
   - Uses `ref_id` and `onboarding_id`

---

## Security Considerations

1. **Encryption**
   - All CTOS requests encrypted with AES-256-CBC
   - Key: `(IV + API_KEY).substring(0, 32)`
   - IV: Base64 decoded ciphertext (16 bytes)

2. **Signature Generation**
   - SHA256 hash of: `api_key + SecurityKey + package_name + ref_id + SecurityKey + request_time`
   - Base64 encoded

3. **KYC Token**
   - JWT token with 15-minute expiry
   - Contains `userId` and `kycId`
   - Required for frontend KYC access

---

## Error Handling

### Common Errors

1. **Error 103: Duplicate Transaction**
   - Cause: CTOS already has transaction with same `ref_id`
   - Fix: Use `kycSession.id` instead of `userId`
   - Recovery: Resume existing session if within 24h

2. **Session Not Found (Webhook)**
   - Cause: `ref_id` lookup fails
   - Fix: Robust lookup with multiple fallbacks

3. **CTOS API Failures**
   - Backend catches and marks session as `FAILED`
   - Stores error details in `ctosData`
   - Frontend shows error message

---

## Database Schema

### KycSession Model
```prisma
model KycSession {
  id                String   @id @default(cuid())
  userId            String
  status            KycStatus // IN_PROGRESS, APPROVED, REJECTED, FAILED
  ctosOnboardingId  String?
  ctosOnboardingUrl String?
  ctosStatus        Int?     // 0-3 (CTOS status code)
  ctosResult        Int?     // 0-2 (CTOS result code)
  ctosExpiredAt     DateTime?
  ctosData          Json?    // Full CTOS webhook payload
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  completedAt       DateTime?
  applicationId     String?
}
```

---

## Testing Checklist

- [ ] New session creation works
- [ ] Resume session within 24h works
- [ ] Webhook updates session correctly
- [ ] Frontend polling detects approval
- [ ] Multiple button clicks prevented
- [ ] Duplicate transaction error resolved
- [ ] Legacy sessions still work (backward compatibility)
- [ ] Images stored correctly
- [ ] User KYC status updated on approval

---

## Future Improvements

1. Webhook signature validation (if CTOS provides)
2. Retry mechanism for failed webhooks
3. Admin dashboard for KYC session monitoring
4. Analytics for KYC success/failure rates
5. Automated retry for expired sessions (if applicable)

---

**Last Updated:** 2025-10-29  
**Version:** 2.0 (Post ref_id migration)

