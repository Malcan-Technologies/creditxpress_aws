# Login Security Implementation Summary

## Overview
Implemented comprehensive login security features based on penetration testing recommendations, including rate limiting, one-time token validation, and enhanced server-side validation for both customer and admin login endpoints.

## Key Security Features

### 1. Rate Limiting
- **Window**: 5 minutes
- **Max Attempts**: 5 attempts per IP address
- **Applies to**: Both customer (`/api/auth/login`) and admin (`/api/admin/login`) endpoints
- **Response**: HTTP 429 with `retryAfter` field indicating seconds until reset

### 2. One-Time Login Token (CSRF-like Protection)
- **Expiry**: 6 minutes (5-minute rate limit + 1-minute buffer)
- **Storage**: In-memory `Map` keyed by client IP address
- **Usage**: Single-use token, deleted immediately after validation
- **Cleanup**: Automatic cleanup every 5 minutes

### 3. Enhanced Server-Side Validation
- **Phone Number**: Type check, length limit (max 20 chars), format validation
- **Password**: Type check, length limit (max 128 chars)
- **Protection**: Prevents DoS attacks via oversized inputs

### 4. Admin Access Logging
- **Trigger**: Logs created after successful OTP verification for ADMIN/ATTESTOR roles
- **Data Logged**: User ID, name, phone, role, IP address, user agent, timestamp
- **Table**: `admin_access_logs` (AdminAccessLog model)

## Implementation Details

### Backend Changes

#### New Middleware Files

**`backend/src/middleware/rateLimiter.ts`**
- Exports `loginRateLimiter` and `adminLoginRateLimiter`
- 5 attempts per 5 minutes per IP
- Custom error handler with `retryAfter` field

**`backend/src/middleware/loginToken.ts`**
- `generateLoginToken`: Middleware to create one-time tokens
- `validateLoginToken`: Middleware to validate and consume tokens
- IP-based token storage with automatic cleanup

#### Modified Backend Files

**`backend/src/app.ts`**
- Added `app.set('trust proxy', true)` for correct IP detection behind reverse proxy/nginx

**`backend/src/api/auth.ts`**
- Customer login endpoint:
  - Added `GET /api/auth/login-token` for token generation
  - Modified `POST /api/auth/login` with `loginRateLimiter` + `validateLoginToken` middleware
  - Enhanced validation for phone and password
- OTP verification endpoint:
  - Added admin access logging after successful OTP verification for ADMIN/ATTESTOR users

**`backend/src/api/admin.ts`**
- Admin login endpoint:
  - Added `GET /api/admin/login-token` for token generation
  - Modified `POST /api/admin/login` with `adminLoginRateLimiter` + `validateLoginToken` middleware
  - Enhanced validation for phone and password

### Frontend Changes

#### Customer Frontend (`frontend/app/api/auth/login/route.ts`)
- Fetches one-time token from `/api/auth/login-token` before login
- Forwards user IP via `X-Forwarded-For` header for both token generation and login
- Includes token in both request body (`loginToken`) and header (`X-Login-Token`)

#### Admin Frontend (`admin/app/api/admin/login/route.ts`)
- Fetches one-time token from `/api/admin/login-token` before login
- Forwards user IP via `X-Forwarded-For` header for both token generation and login
- Includes token in both request body (`loginToken`) and header (`X-Login-Token`)

## Token Flow

### Customer Login Flow
1. Frontend: `GET /api/auth/login-token` → Backend generates token, stores by IP
2. Frontend: `POST /api/auth/login` with token → Backend validates token, deletes it (one-time use)
3. If password correct but phone unverified → OTP sent, 403 response
4. Frontend: `POST /api/auth/verify-otp` → Backend validates OTP, returns tokens

### Admin Login Flow
1. Frontend: `GET /api/admin/login-token` → Backend generates token, stores by IP
2. Frontend: `POST /api/admin/login` with token → Backend validates token, deletes it (one-time use)
3. If password correct → OTP sent (always required for 2FA), 403 response
4. Frontend: `POST /api/auth/verify-otp` → Backend validates OTP, **logs admin access**, returns tokens

## IP Detection Strategy

### Production Environment
- Express configured with `trust proxy: true`
- Reads `X-Forwarded-For` header set by nginx reverse proxy
- Frontend Next.js API routes forward user IP to backend

### Why IP Forwarding is Critical
- Without IP forwarding, backend sees Next.js server IP (not user IP)
- Token stored with Next.js IP, validation fails because user IP doesn't match
- Both token generation and login requests must use the same IP

## Rate Limiting Behavior

### Normal Usage
- User can attempt login 5 times in 5 minutes
- After 5 failed attempts, user is blocked for 5 minutes
- Error response includes `retryAfter` field (seconds until reset)

### Token Expiry Alignment
- Token expires after 6 minutes (rate limit window + 1 min buffer)
- If rate limited, user must wait 5 minutes before getting a new token
- Old tokens cleaned up automatically, reducing memory usage

## Security Benefits

1. **Brute Force Protection**: Rate limiting prevents automated password guessing
2. **Replay Attack Prevention**: One-time tokens prevent request replay
3. **DoS Prevention**: Input length validation prevents resource exhaustion
4. **Audit Trail**: Admin access logs provide forensic evidence
5. **2FA for Admins**: All admin logins require OTP verification (already existed)

## Testing Checklist

- [x] Customer login with valid credentials
- [x] Customer login with invalid credentials (rate limit after 5 attempts)
- [x] Admin login with valid credentials → OTP verification
- [x] Admin login with invalid credentials (rate limit after 5 attempts)
- [x] Verify admin access log created after OTP verification
- [x] Verify IP detection works correctly in production (behind nginx)
- [x] Verify token expiry after 6 minutes
- [x] Verify rate limit reset after 5 minutes

## Mobile Integration

Mobile apps must fetch the login token before each login attempt:

1. **Request Token**: `GET /api/auth/login-token` or `GET /api/admin/login-token`
2. **Extract Token**: Read from response body `loginToken` field or `X-Login-Token` header
3. **Submit Login**: Include token in login request body as `loginToken` field
4. **Handle Errors**:
   - HTTP 403: Missing/invalid/expired token → Fetch new token and retry
   - HTTP 429: Rate limited → Wait for `retryAfter` seconds

See `docs/MOBILE_LOGIN_SECURITY_INTEGRATION.md` for detailed mobile integration guide.

## Configuration

### Environment Variables
- `TZ=Asia/Kuala_Lumpur` (backend timezone)
- No additional environment variables required for this feature

### Production Deployment
1. Backend: Docker container rebuild required
2. Frontend/Admin: Next.js rebuild and restart required
3. Nginx: No changes required (already forwarding `X-Forwarded-For`)

## Maintenance

### In-Memory Token Storage
- Tokens stored in `Map<string, TokenStore>` (IP → token)
- Automatic cleanup every 5 minutes
- No database persistence required
- Memory usage: Negligible (~64 bytes per token)

### Monitoring
- Monitor rate limit errors (HTTP 429) for abuse patterns
- Monitor admin access logs for suspicious login activity
- Check backend logs for IP detection issues

## Future Enhancements (Optional)

1. **Persistent Token Storage**: Move to Redis for multi-instance deployments
2. **IP Whitelisting**: Bypass rate limiting for trusted IPs
3. **Adaptive Rate Limiting**: Increase limits based on reputation scores
4. **Failed Login Alerts**: Notify admins of repeated failed attempts
5. **Account Lockout**: Temporary account suspension after X failed attempts

## Related Documentation

- `docs/MOBILE_LOGIN_SECURITY_INTEGRATION.md` - Mobile integration guide
- `backend/src/middleware/rateLimiter.ts` - Rate limiter implementation
- `backend/src/middleware/loginToken.ts` - Token validation implementation
- `backend/src/lib/accessLogger.ts` - Admin access logging implementation

