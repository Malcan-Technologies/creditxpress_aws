# Mobile App Login Security Integration

## Quick Summary

Login now requires a **one-time token** before each login attempt. This prevents replay attacks and enforces rate limiting.

---

## Required Changes

### 1. Fetch Token Before Login

**New Endpoint:**
```
GET /api/auth/login-token
```

**Response:**
```json
{
  "loginToken": "hex_string_64_chars",
  "message": "Login token generated successfully"
}
```

### 2. Include Token in Login Request

**Login Endpoint (updated):**
```
POST /api/auth/login
```

**Request Body:**
```json
{
  "phoneNumber": "+60123456789",
  "password": "userpassword",
  "loginToken": "token_from_step_1"
}
```

**Alternative:** Include token in header `X-Login-Token`

---

## Error Responses

| Status | Error | Action |
|--------|-------|--------|
| **403** | `Missing login token` | Fetch new token and retry |
| **403** | `Invalid or expired login token` | Fetch new token and retry |
| **429** | `Too many login attempts` | Wait 5 minutes. Response includes `retryAfter` (seconds) |
| **400** | Input validation errors | Check phone/password format |

**Rate Limit:** 5 attempts per 5 minutes per IP (both successful and failed attempts count)

---

## Implementation Flow

```
1. GET /api/auth/login-token → Get token
2. POST /api/auth/login + token → Login
3. If 403 (token error) → Fetch new token and retry once
4. If 429 (rate limit) → Show countdown, disable login
```

---

## Important Notes

- ✅ Token is **one-time use** - fetch new token for each login attempt
- ✅ Token expires after **6 minutes**
- ✅ Rate limit: **5 attempts per 5 minutes** per IP
- ⚠️ Token fetch failure = login will fail (backend rejects without token)

---

## Example Code

```typescript
// Step 1: Get token
const tokenRes = await fetch(`${API_URL}/api/auth/login-token`);
const { loginToken } = await tokenRes.json();

// Step 2: Login with token
const loginRes = await fetch(`${API_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber,
    password,
    loginToken  // Required
  })
});

// Handle errors
if (loginRes.status === 403) {
  // Token issue - retry with new token
}
if (loginRes.status === 429) {
  // Rate limited - show countdown
}
```

