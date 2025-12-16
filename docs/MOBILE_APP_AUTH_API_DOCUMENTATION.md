# Mobile App Authentication API Documentation

This document provides complete API endpoint specifications for integrating authentication flows (signup, login, forgot password) into the mobile app.

## Base URL

All endpoints should use: `{NEXT_PUBLIC_API_URL}/api/auth/` 

**Note:** The frontend Next.js API routes proxy to the backend. For direct backend access, use: `{BACKEND_URL}/api/auth/`

---

## 1. Sign Up

**Endpoint:** `POST /api/auth/signup`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "phoneNumber": "60123456789",  // E.164 format WITHOUT + symbol (country code + number, no spaces/special chars)
  "password": "YourPassword123!"  // Min 8 chars, 1 uppercase, 1 special char, no spaces
}
```

**IMPORTANT:** Phone number must be in E.164 format **without the `+` symbol**. Examples:
- ✅ Correct: `"60123456789"` (Malaysia)
- ✅ Correct: `"6598765432"` (Singapore)
- ❌ Wrong: `"+60123456789"` (has + symbol)
- ❌ Wrong: `"60 12 345 6789"` (has spaces)
- ❌ Wrong: `"012-345-6789"` (has dashes, missing country code)

**Success Response (200):**
```json
{
  "message": "Account created successfully. OTP sent to WhatsApp",
  "userId": "user-uuid",
  "phoneNumber": "60123456789",
  "otpSent": true,
  "expiresAt": "2024-01-01T12:00:00.000Z"  // OTP expiration timestamp
}
```

**Error Response (400/500):**
```json
{
  "error": "This phone number is already registered"  // or other error message
}
```

**Notes:**
- Phone number must be mobile (not landline)
- Password validation: minimum 8 characters, at least 1 uppercase letter, 1 special character, no spaces
- OTP is sent via WhatsApp automatically
- After signup, user must verify OTP before account is fully activated

---

## 2. Verify OTP (Signup)

**Endpoint:** `POST /api/auth/verify-otp`

**Request Body:**
```json
{
  "phoneNumber": "60123456789",
  "otp": "123456"  // 6-digit code
}
```

**Success Response (200):**
```json
{
  "message": "OTP verified successfully",
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "userId": "user-uuid",
  "phoneNumber": "60123456789",
  "isOnboardingComplete": false,
  "onboardingStep": 0
}
```

**Error Response (400/401/500):**
```json
{
  "message": "Invalid or expired OTP"  // or other error message
}
```

**Notes:**
- Store both `accessToken` and `refreshToken` securely
- Access token expires in 15 minutes
- Refresh token expires in 90 days
- Use `accessToken` in `Authorization: Bearer {accessToken}` header for authenticated requests

---

## 3. Resend OTP (Signup)

**Endpoint:** `POST /api/auth/resend-otp`

**Request Body:**
```json
{
  "phoneNumber": "60123456789"
}
```

**Success Response (200):**
```json
{
  "message": "OTP resent successfully",
  "otpSent": true,
  "expiresAt": "2024-01-01T12:00:00.000Z"
}
```

**Error Response (400/429/500):**
```json
{
  "message": "Please wait 60 seconds before requesting a new code"  // or other error
}
```

**Notes:**
- 60-second cooldown between resend requests
- Error message may include wait time: "wait {seconds} seconds"

---

## 4. Login

**Endpoint:** `POST /api/auth/login`

**Optional Pre-request:** `GET /api/auth/login-token` (for security token - see Additional Endpoints section)

**Request Headers (Optional but recommended):**
```
X-Forwarded-For: {client-ip-address}
X-Login-Token: {login-token-from-pre-request}  // If using login token
```

**Request Body:**
```json
{
  "phoneNumber": "60123456789",  // Can be mobile or landline for login
  "password": "YourPassword123!",
  "loginToken": "optional-login-token"  // If using login token flow
}
```

**Success Response (200):**
```json
{
  "message": "Login successful",
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "isOnboardingComplete": true,
  "onboardingStep": 5
}
```

**Phone Verification Required (403):**
```json
{
  "message": "Phone verification required",
  "requiresPhoneVerification": true,
  "phoneNumber": "60123456789",
  "userId": "user-uuid"
}
```

**Error Response (401/500):**
```json
{
  "error": "Invalid credentials"  // or other error message
}
```

**Notes:**
- If `requiresPhoneVerification: true`, proceed to OTP verification flow
- Use the returned `userId` and `phoneNumber` for OTP verification
- Login allows both mobile and landline numbers (unlike signup)

---

## 5. Verify OTP (Login - Phone Verification)

**Endpoint:** `POST /api/auth/verify-otp`

**Request Body:**
```json
{
  "phoneNumber": "60123456789",
  "otp": "123456"
}
```

**Success Response (200):**
```json
{
  "message": "Phone verified successfully",
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "userId": "user-uuid",
  "phoneNumber": "60123456789",
  "isOnboardingComplete": true,
  "onboardingStep": 5
}
```

**Error Response:** Same as signup OTP verification

**Notes:**
- Same endpoint as signup OTP verification
- Use the `userId` and `phoneNumber` from the login response

---

## 6. Forgot Password

**Endpoint:** `POST /api/auth/forgot-password`

**Request Body:**
```json
{
  "phoneNumber": "60123456789"  // Can be mobile or landline
}
```

**Success Response (200):**
```json
{
  "message": "Password reset code sent to your WhatsApp"
}
```

**Error Response (400/404/500):**
```json
{
  "error": "Phone number not found"  // or other error message
}
```

**Notes:**
- Sends OTP via WhatsApp
- User must verify OTP before resetting password

---

## 7. Verify Reset OTP

**Endpoint:** `POST /api/auth/verify-reset-otp`

**Request Body:**
```json
{
  "phoneNumber": "60123456789",
  "otp": "123456"
}
```

**Success Response (200):**
```json
{
  "message": "Reset code verified",
  "resetToken": "temporary-reset-token",
  "userId": "user-uuid"
}
```

**Error Response (400/401/500):**
```json
{
  "error": "Invalid or expired reset code"
}
```

**Notes:**
- Store `resetToken` securely (temporary, single-use)
- Use `resetToken` in the reset password request

---

## 8. Reset Password

**Endpoint:** `POST /api/auth/reset-password`

**Request Body:**
```json
{
  "resetToken": "temporary-reset-token-from-otp-verification",
  "newPassword": "NewPassword123!"  // Min 8 chars, 1 uppercase, 1 special char, no spaces
}
```

**Success Response (200):**
```json
{
  "message": "Password reset successfully"
}
```

**Error Response (400/401/500):**
```json
{
  "error": "Invalid or expired reset token"  // or "Password must be at least 8 characters..."
}
```

**Notes:**
- Same password validation rules as signup
- After successful reset, user should be redirected to login
- `resetToken` is single-use and expires

---

## Authentication Flow Summary

### Signup Flow:
1. `POST /api/auth/signup` → Get `userId`, `phoneNumber`, `expiresAt`
2. `POST /api/auth/verify-otp` → Get `accessToken`, `refreshToken`
3. Store tokens and proceed to app

### Login Flow:
1. `POST /api/auth/login` → Get tokens OR `requiresPhoneVerification: true`
2. If phone verification required:
   - `POST /api/auth/verify-otp` → Get `accessToken`, `refreshToken`
3. Store tokens and proceed to app

### Forgot Password Flow:
1. `POST /api/auth/forgot-password` → OTP sent
2. `POST /api/auth/verify-reset-otp` → Get `resetToken`
3. `POST /api/auth/reset-password` → Password reset
4. Redirect to login

---

## Additional Endpoints (Optional)

### Get Login Token (Security Enhancement)

**Endpoint:** `GET /api/auth/login-token`

**Request Headers (Optional):**
```
X-Forwarded-For: {client-ip-address}
```

**Success Response (200):**
```json
{
  "loginToken": "temporary-security-token"
}
```

**OR** Token may be returned in response header:
```
X-Login-Token: temporary-security-token
```

**Error Response (500):**
```json
{
  "error": "Failed to generate login token"
}
```

**What is this endpoint for?**

This endpoint provides an **optional security enhancement** for the login flow. It generates a temporary, single-use token that should be included in the login request to help prevent certain types of attacks (like CSRF or automated login attempts).

**How to use it (Optional):**

1. **Before login:** Call `GET /api/auth/login-token` to obtain a `loginToken`
2. **During login:** Include the `loginToken` in the login request body:
   ```json
   {
     "phoneNumber": "60123456789",
     "password": "YourPassword123!",
     "loginToken": "token-from-step-1"
   }
   ```
3. The backend validates the token before processing the login

**Important Notes:**
- This is **optional** - the login endpoint works without it
- The token is short-lived (typically expires within a few minutes)
- If you don't use this endpoint, simply omit the `loginToken` field from the login request
- The frontend web app uses this for enhanced security, but mobile apps can choose to implement it or skip it
- If the token request fails, you can still proceed with login (the backend will handle it gracefully)

**When to use it:**
- If you want additional security layers
- If you're concerned about automated attacks
- If your security requirements mandate it

**When you can skip it:**
- For simpler implementations
- If you have other security measures in place
- If you want to reduce API calls

---

## Important Notes for Mobile Developers

1. **Token Storage:** Store `accessToken` and `refreshToken` securely (Keychain on iOS, Keystore on Android)
2. **Token Refresh:** Implement refresh logic when `accessToken` expires (15 minutes)
3. **Phone Number Format:** Always use E.164 format (e.g., `60123456789`, no spaces/special chars)
4. **Password Validation:**
   - Minimum 8 characters
   - At least 1 uppercase letter
   - At least 1 special character
   - No spaces allowed
5. **OTP Handling:**
   - 6-digit numeric code
   - Auto-read from SMS/WhatsApp if possible
   - 60-second cooldown for resend
6. **Error Handling:** Check response status codes and handle errors appropriately
7. **Network Security:** Use HTTPS only
8. **Headers:** Include `Content-Type: application/json` for all requests

---

## HTTP Status Codes

All endpoints return standard HTTP status codes:
- **200 OK:** Request successful
- **400 Bad Request:** Invalid input (validation errors, missing fields)
- **401 Unauthorized:** Authentication failed (invalid credentials, expired tokens)
- **403 Forbidden:** Phone verification required (login flow)
- **404 Not Found:** Resource not found (e.g., phone number not registered)
- **429 Too Many Requests:** Rate limit exceeded (e.g., too many OTP resend requests)
- **500 Internal Server Error:** Server error

---

## Example Implementation (Pseudocode)

```javascript
// Signup Flow
async function signup(phoneNumber, password) {
  const response = await fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, password })
  });
  
  if (response.ok) {
    const data = await response.json();
    // Store userId, phoneNumber, expiresAt
    // Show OTP input screen
    return data;
  } else {
    const error = await response.json();
    throw new Error(error.error);
  }
}

// Verify OTP
async function verifyOTP(phoneNumber, otp) {
  const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, otp })
  });
  
  if (response.ok) {
    const data = await response.json();
    // Store accessToken and refreshToken securely
    await secureStorage.set('accessToken', data.accessToken);
    await secureStorage.set('refreshToken', data.refreshToken);
    return data;
  } else {
    const error = await response.json();
    throw new Error(error.message);
  }
}

// Login Flow
async function login(phoneNumber, password) {
  // Optional: Get login token first
  let loginToken = null;
  try {
    const tokenResponse = await fetch(`${API_URL}/api/auth/login-token`, {
      method: 'GET',
      headers: { 'X-Forwarded-For': getClientIP() }
    });
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      loginToken = tokenData.loginToken;
    }
  } catch (e) {
    // Continue without token
  }
  
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Forwarded-For': getClientIP()
    },
    body: JSON.stringify({ 
      phoneNumber, 
      password,
      ...(loginToken && { loginToken })
    })
  });
  
  if (response.status === 403) {
    const data = await response.json();
    if (data.requiresPhoneVerification) {
      // Show OTP verification screen
      return { requiresVerification: true, ...data };
    }
  }
  
  if (response.ok) {
    const data = await response.json();
    // Store tokens
    await secureStorage.set('accessToken', data.accessToken);
    await secureStorage.set('refreshToken', data.refreshToken);
    return data;
  } else {
    const error = await response.json();
    throw new Error(error.error);
  }
}
```

---

## Support

For questions or issues, contact the development team or refer to the backend API documentation.

