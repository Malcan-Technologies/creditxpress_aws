# Authentication Documentation

## Overview

The Kredit platform uses a **custom JWT token-based authentication system** (not NextAuth). Authentication is implemented separately in both the customer frontend (`frontend`) and admin panel (`admin`), with similar patterns but separate token storage mechanisms.

---

## Authentication Architecture

### Core Components

1. **Token Storage**: Tokens stored in both `localStorage` and `cookies` for redundancy
2. **Token Refresh**: Automatic refresh mechanism before token expiration
3. **API Proxies**: Next.js API routes act as thin proxies to backend Express API
4. **Route Protection**: Middleware and client-side checks protect authenticated routes

---

## Token System

### Token Types

- **Access Token**: 
  - Lifetime: **15 minutes**
  - Stored in: `localStorage` + `cookies`
  - Used in: `Authorization: Bearer <token>` header for API requests

- **Refresh Token**: 
  - Lifetime: **90 days**
  - Stored in: `localStorage` + `cookies`
  - Used for: Obtaining new access tokens when they expire

### Token Storage Keys

**Frontend (Customer App)**:
- Access token: `token` (localStorage + cookie)
- Refresh token: `refreshToken` (localStorage + cookie)

**Admin Panel**:
- Access token: `adminToken` (localStorage + cookie)
- Refresh token: `adminRefreshToken` (localStorage + cookie)

---

## Frontend (Customer App) Authentication

### Location
`frontend/` directory

### Key Files

- **Token Storage**: `frontend/lib/authUtils.ts`
- **Login Route**: `frontend/app/api/auth/login/route.ts`
- **Refresh Route**: `frontend/app/api/auth/refresh/route.ts`
- **Middleware**: `frontend/middleware.ts`
- **Token Refresher Component**: `frontend/components/TokenRefresher.tsx`

### Authentication Flow

#### 1. Login Process

```typescript
// User submits credentials → /api/auth/login
POST /api/auth/login
Body: { phoneNumber, password }

// Next.js API route forwards to backend
Backend responds with:
{
  accessToken: "jwt_token_15min",
  refreshToken: "jwt_token_90days",
  isOnboardingComplete: boolean,
  onboardingStep: number
}

// Tokens stored in:
- localStorage.setItem("token", accessToken)
- localStorage.setItem("refreshToken", refreshToken)
- Cookies (with domain support for subdomain sharing)
```

**Implementation**: `frontend/app/api/auth/login/route.ts`

#### 2. Token Storage Utility

The `TokenStorage` object provides unified access:

```typescript
TokenStorage.getAccessToken()     // Checks localStorage, then cookies
TokenStorage.setAccessToken(token) // Stores in both
TokenStorage.getRefreshToken()
TokenStorage.setRefreshToken(token)
TokenStorage.clearTokens()        // Clears all tokens
```

**Implementation**: `frontend/lib/authUtils.ts` (lines 36-137)

#### 3. Automatic Token Refresh

**TokenRefresher Component** (`frontend/components/TokenRefresher.tsx`):
- Runs on every protected route
- Checks token expiration every **60 seconds**
- Refreshes if token expires within **5 minutes**
- Handles visibility changes (tab switching, sleep/wake)
- Handles network reconnection

**Refresh Mechanism** (`frontend/lib/authUtils.ts`):
```typescript
refreshAccessToken() {
  1. Get refreshToken from storage
  2. POST /api/auth/refresh with refreshToken
  3. Backend validates and returns new tokens
  4. Store new tokens
  5. Return new accessToken
}
```

#### 4. Authenticated API Requests

**fetchWithTokenRefresh** utility automatically handles token refresh:

```typescript
fetchWithTokenRefresh("/api/users/me")
  → Makes request with current access token
  → If 401/403: Automatically refreshes token
  → Retries request with new token
  → Returns response data
```

**Implementation**: `frontend/lib/authUtils.ts` (lines 185-267)

#### 5. Route Protection

**Middleware** (`frontend/middleware.ts`):
- Protects all `/dashboard/*` routes
- Checks for `token` or `refreshToken` cookies
- Redirects to `/login` if no tokens found
- Special handling for KYC routes with temporary tokens (`?t=<token>`)

**Client-Side Checks**:
- Pages call `checkAuth()` before rendering
- Validates token by calling `/api/users/me`
- Auto-refreshes if token invalid

### Cookie Domain Configuration

Cookies support subdomain sharing via `NEXT_PUBLIC_SITE_URL`:
- Extracts domain and adds dot prefix (e.g., `.creditxpress.com.my`)
- Allows tokens to work across subdomains

---

## Admin Panel Authentication

### Location
`admin/` directory

### Key Files

- **Token Storage**: `admin/lib/authUtils.ts`
- **Login Route**: `admin/app/api/admin/login/route.ts`
- **Refresh Route**: `admin/app/api/admin/refresh/route.ts`
- **Token Refresher Component**: `admin/components/TokenRefresher.tsx`

### Authentication Flow

#### 1. Login Process

```typescript
// Admin submits credentials → /api/admin/login
POST /api/admin/login
Body: { phoneNumber, password }

// Next.js API route forwards to backend /api/admin/login
// Backend validates AND checks role (ADMIN or ATTESTOR)
Backend responds with:
{
  accessToken: "jwt_token_15min",
  refreshToken: "jwt_token_90days",
  role: "ADMIN" | "ATTESTOR" | "USER"
}

// Only ADMIN and ATTESTOR roles can proceed
// Tokens stored using AdminTokenStorage
```

**Implementation**: `admin/app/api/admin/login/route.ts`

#### 2. Role-Based Access

The admin login endpoint enforces role checking:

```typescript
// Backend checks user role
if (data.role !== "ADMIN" && data.role !== "ATTESTOR") {
  throw new Error("Access denied. Admin or Attestor privileges required.");
}
```

**Implementation**: `admin/app/login/page.tsx` (lines 84-86)

#### 3. Token Storage Utility

The `AdminTokenStorage` object (similar to frontend but separate):

```typescript
AdminTokenStorage.getAccessToken()     // Checks localStorage, then cookies
AdminTokenStorage.setAccessToken(token)
AdminTokenStorage.getRefreshToken()
AdminTokenStorage.setRefreshToken(token)
AdminTokenStorage.clearTokens()
```

**Implementation**: `admin/lib/authUtils.ts` (lines 6-82)

#### 4. Authenticated API Requests

**fetchWithAdminTokenRefresh** utility:

```typescript
fetchWithAdminTokenRefresh("/api/admin/me")
  → Makes request with Authorization: Bearer <adminToken>
  → Routes to backend if needed (determines full URL)
  → Auto-refreshes on 401/403
  → Returns response data
```

**Key Differences from Frontend**:
- Always includes `Authorization` header (critical for admin routes)
- Handles FormData requests (no Content-Type header in that case)
- Routes API calls to backend when appropriate

**Implementation**: `admin/lib/authUtils.ts` (lines 153-240)

#### 5. Authentication Check

**checkAdminAuth** function:

```typescript
checkAdminAuth()
  → Verifies access token exists
  → Calls /api/admin/me to validate token
  → Verifies user has ADMIN or ATTESTOR role
  → Returns true if authenticated and authorized
```

**Implementation**: `admin/lib/authUtils.ts` (lines 246-297)

---

## Backend API Integration

### Authentication Endpoints

**Customer Frontend**:
- `POST /api/auth/login` - Login with phoneNumber/password
- `POST /api/auth/refresh` - Refresh access token

**Admin Panel**:
- `POST /api/admin/login` - Admin login (requires ADMIN/ATTESTOR role)
- `POST /api/admin/refresh` - Admin token refresh

### Request Flow

```
Frontend/Admin → Next.js API Route → Backend Express API → Prisma/Postgres
```

1. **Client** calls Next.js API route (e.g., `/api/auth/login`)
2. **Next.js route** forwards request to backend Express API
3. **Backend** validates credentials, generates JWT tokens
4. **Backend** returns tokens in response
5. **Next.js route** sets cookies and returns tokens
6. **Client** stores tokens in localStorage + cookies

### Authorization Headers

**Critical for Admin Routes**:
```typescript
headers: {
  "Authorization": `Bearer ${adminToken}`,
  "Content-Type": "application/json"
}
```

Admin API routes check both Authorization headers AND cookies as fallback.

---

## Automatic Token Refresh Strategies

### 1. Proactive Refresh
- **Frequency**: Check every 60 seconds
- **Trigger**: Token expires within 5 minutes
- **Location**: `TokenRefresher` component

### 2. On-Demand Refresh
- **Trigger**: API request returns 401/403
- **Action**: Automatically refresh and retry
- **Location**: `fetchWithTokenRefresh` / `fetchWithAdminTokenRefresh`

### 3. Event-Based Refresh
- **Page Visibility**: Refreshes when tab becomes visible
- **Network Reconnection**: Refreshes when online after offline
- **Location**: `TokenRefresher` component event listeners

---

## Security Considerations

### Token Expiration
- Short-lived access tokens (15 min) reduce exposure risk
- Long-lived refresh tokens (90 days) provide user convenience
- Refresh tokens can be revoked server-side

### Storage Redundancy
- Tokens in both localStorage and cookies ensure:
  - Cross-tab synchronization (localStorage)
  - SSR compatibility (cookies)
  - Cookie domain allows subdomain sharing

### Middleware Protection
- Server-side middleware checks cookies before rendering
- Client-side checks prevent unauthorized access
- KYC routes bypass auth when temporary token present

---

## Common Patterns

### Making Authenticated Requests (Frontend)

```typescript
import { fetchWithTokenRefresh } from "@/lib/authUtils";

const data = await fetchWithTokenRefresh("/api/users/me");
```

### Making Authenticated Requests (Admin)

```typescript
import { fetchWithAdminTokenRefresh } from "@/lib/authUtils";

const data = await fetchWithAdminTokenRefresh("/api/admin/me");
```

### Checking Authentication (Frontend)

```typescript
import { checkAuth } from "@/lib/authUtils";

const isAuthenticated = await checkAuth();
if (!isAuthenticated) {
  router.push("/login");
}
```

### Checking Authentication (Admin)

```typescript
import { checkAdminAuth } from "@/lib/authUtils";

const isAuthenticated = await checkAdminAuth();
if (!isAuthenticated) {
  router.push("/login");
}
```

### Manual Token Refresh

```typescript
import { refreshAccessToken } from "@/lib/authUtils"; // Frontend
import { refreshAdminAccessToken } from "@/lib/authUtils"; // Admin

const newToken = await refreshAccessToken();
```

---

## Environment Variables

### Required for Frontend/Admin

```env
NEXT_PUBLIC_API_URL=http://localhost:4001
NEXT_PUBLIC_SITE_URL=https://creditxpress.com.my  # Optional, for cookie domain
```

---

## Differences from NextAuth

1. **Custom Implementation**: Full control over token lifecycle
2. **Dual Storage**: localStorage + cookies (NextAuth uses sessions/cookies)
3. **Explicit Refresh**: Manual refresh logic vs NextAuth's automatic handling
4. **No Session Provider**: No React context providers needed
5. **Direct Backend Integration**: Calls backend directly, not through NextAuth adapters

---

## Troubleshooting

### Token Not Refreshing
- Check browser console for refresh errors
- Verify refresh token exists in storage
- Check network tab for `/api/auth/refresh` or `/api/admin/refresh` calls

### 401 Errors Despite Valid Token
- Token may have expired; check expiration time
- Verify token is being sent in Authorization header
- Check backend is validating token correctly

### Tokens Lost on Page Refresh
- Ensure cookies are set correctly (check domain, path, expiration)
- Verify localStorage is not being cleared
- Check if browser settings block cookies/localStorage

---

## Key Takeaways

1. **Not NextAuth**: Custom JWT implementation
2. **Dual Storage**: localStorage + cookies for redundancy
3. **Auto-Refresh**: Multiple strategies ensure tokens stay fresh
4. **Separate Systems**: Frontend and admin use separate token storage
5. **Role-Based**: Admin requires ADMIN/ATTESTOR role verification
6. **Middleware Protection**: Server and client-side route protection

