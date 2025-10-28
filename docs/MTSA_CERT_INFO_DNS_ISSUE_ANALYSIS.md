# MTSA Certificate Info API DNS Issue - Root Cause Analysis

**Date:** January 26, 2025  
**Issue:** Intermittent `java.net.UnknownHostException: digitalid.msctrustgate.com` errors on mobile app  
**API Endpoint:** `GET /api/mtsa/cert-info/{userId}`  
**Status:** Under Investigation

---

## Executive Summary

The `/api/mtsa/cert-info/{userId}` API endpoint works reliably on the web frontend but experiences intermittent DNS resolution failures when called from the mobile app. The error `java.net.UnknownHostException: digitalid.msctrustgate.com` indicates that the MTSA Java application running in a Docker container cannot resolve the external MSC TrustGate Certificate Authority domain.

---

## Architecture Flow

```
Mobile App / Web Frontend
    ↓
Backend (VPS) - /api/mtsa/cert-info/:userId
    ↓
Signing Orchestrator (On-Prem) - /api/cert/:userId
    ↓
MTSA Container (Docker) - SOAP Call
    ↓
digitalid.msctrustgate.com (External CA Service) ← DNS FAILURE HERE
```

---

## Root Cause: Docker DNS Resolution Issue

### The Problem

The MTSA service is a **Java Tomcat application running inside a Docker container**. When it makes SOAP calls to MyTrustSigner's external services, it needs to resolve `digitalid.msctrustgate.com` using DNS.

**The DNS resolution fails intermittently because:**

1. **Docker's default DNS configuration may be unreliable**
   - Docker uses its own internal DNS server (127.0.0.11)
   - This DNS server sometimes fails to forward queries to external DNS servers
   - No fallback DNS servers configured

2. **Java DNS caching issues**
   - Java caches DNS lookups by default (TTL can be very long)
   - Stale DNS entries can cause failures
   - No retry logic at the Java/SOAP level

3. **Network isolation**
   - The MTSA container may have limited network access
   - No explicit DNS servers configured in docker-compose
   - Relies on Docker host's DNS, which may be flaky

4. **Timeout issues**
   - Default DNS timeout may be too short
   - External CA service may be slow to respond
   - No DNS retry attempts configured

---

## Why It Works on Web But Not Mobile

### Key Differences

| Aspect | Web Frontend | Mobile App | Impact |
|--------|-------------|------------|---------|
| **Request Pattern** | Single user browsing session | Multiple concurrent users | Mobile creates more load |
| **Retry Logic** | Browser may auto-retry | App may not retry | Web masks failures |
| **Connection Pooling** | HTTP/2 connection reuse | New connections per request | Mobile puts more stress on DNS |
| **Caching** | Browser caches responses | App may not cache | Mobile hits API more often |
| **Timing** | User-initiated, spaced out | Automated polling/sync | Mobile creates burst requests |
| **Network** | Typically stable WiFi | Mobile network (3G/4G/5G) | Mobile has variable latency |

### Hypotheses

#### 1. **Request Volume & Concurrency** (Most Likely)
- **Web:** Users manually navigate to certificate check pages, creating spaced-out requests
- **Mobile:** App may check certificate status on:
  - App launch
  - Background refresh
  - Before signing operations
  - Multiple users simultaneously

**Result:** Mobile creates bursts of concurrent requests that overwhelm the MTSA container's DNS resolution capacity.

#### 2. **Connection Behavior**
- **Web:** Browser reuses HTTP/2 connections to backend
- **Mobile:** May create new TCP connections for each API call

**Result:** Each new mobile request forces MTSA to establish a new SOAP connection, triggering fresh DNS lookups that may fail.

#### 3. **DNS Cache Timing**
- **Web:** Requests happen during "fresh" DNS cache periods
- **Mobile:** Requests may happen after DNS cache expiry, forcing new lookups that fail

**Result:** Mobile catches MTSA during DNS cache refresh windows when external DNS is slow/unreachable.

#### 4. **Network Quality**
- **Web:** Users on stable WiFi connections
- **Mobile:** Users on cellular networks with variable latency/packet loss

**Result:** Mobile network instability may cause DNS queries to timeout before completion.

#### 5. **Timeout Cascades**
- **Mobile:** Shorter timeout configured in mobile app (e.g., 10-15 seconds)
- **Web:** Longer timeout or user waits patiently

**Result:** Mobile app timeout happens before MTSA can retry DNS resolution internally.

---

## API Call Flow

### Where the API is Used

#### Frontend (Web) - Next.js App
The `/api/mtsa/cert-info/{userId}` endpoint is called from:

1. **Certificate Check Page** (`/dashboard/applications/[id]/cert-check/page.tsx`)
   - User manually clicks "Check Certificate" button
   - Single request per user action
   - User sees loading spinner and waits

2. **Profile Page** (`/dashboard/profile/page.tsx`)
   - Called when profile page loads
   - Shows certificate status badge
   - User triggered, not automatic

3. **Onboarding Flow** (`/onboarding/page.tsx`)
   - Checks certificate during registration
   - Part of step-by-step form
   - User waits for each step

4. **PKI Signing Page** (`/pki-signing/page.tsx`)
   - Verifies certificate before signing
   - Single check before OTP request
   - User-initiated signing workflow

5. **OTP Verification** (`/dashboard/applications/[id]/otp-verification/page.tsx`)
   - Determines if user needs new cert (NU) or can sign (DS)
   - Single check before OTP send

**Web Pattern:** Sequential, user-initiated, spaced-out requests

#### Mobile App - Direct Backend Calls
Based on the mobile app documentation, the mobile app likely calls:

```http
GET {API_URL}/api/mtsa/cert-info/{userId}
Authorization: Bearer {token}
```

**Possible Mobile Usage Patterns:**
- App startup/refresh (all users at once)
- Before document signing (multiple concurrent users)
- Background sync (periodic polling)
- Push notification triggers (batch requests)

**Mobile Pattern:** Concurrent, automated, burst requests

---

## Technical Details

### Error Chain

1. **Mobile App** sends request:
   ```
   GET /api/mtsa/cert-info/850101015555
   ```

2. **Backend (VPS)** forwards to Signing Orchestrator:
   ```typescript
   // backend/src/api/mtsa.ts:51
   const response = await fetch(
     `${process.env.SIGNING_ORCHESTRATOR_URL}/api/cert/${userId}`,
     { headers: { 'X-API-Key': process.env.SIGNING_ORCHESTRATOR_API_KEY } }
   );
   ```

3. **Signing Orchestrator** calls MTSA client:
   ```typescript
   // on-prem/signing-orchestrator/src/routes/api.ts:273
   const result = await mtsaClient.getCertInfo(
     { UserID: userId }, 
     req.correlationId
   );
   ```

4. **MTSA Client** makes SOAP call:
   ```typescript
   // on-prem/signing-orchestrator/src/services/MTSAClient.ts:273
   const result = await this.executeSoapMethod<MTSAGetCertInfoResponse>(
     'GetCertInfo',
     request,
     correlationId
   );
   ```

5. **SOAP Library** tries to connect to:
   ```
   https://digitalid.msctrustgate.com/...
   ```

6. **DNS Resolution Fails:**
   ```
   java.net.UnknownHostException: digitalid.msctrustgate.com
   ```

7. **Error bubbles back:**
   ```json
   {
     "success": false,
     "message": "MyTrustSigner Service returns error: HTTP transport error: java.net.UnknownHostException: digitalid.msctrustgate.com",
     "data": {
       "statusCode": "WS115"
     },
     "correlationId": "5ea7bc02e3942f91e1c03c4bcd698028"
   }
   ```

### Current Retry Logic

**Backend (VPS):**
- No retry logic in `/api/mtsa/cert-info` endpoint
- Single fetch call, returns error immediately

**Signing Orchestrator:**
- No retry at route handler level
- Delegates to MTSA client

**MTSA Client:**
```typescript
// MTSAClient.ts has retry logic!
private async executeSoapMethod<T>(methodName: string, params: any, correlationId?: string): Promise<T> {
  let lastError: Error | null = null;
  
  // Retry loop
  for (let attempt = 1; attempt <= config.network.retryMax; attempt++) {
    try {
      // Execute SOAP call
      const result = await this.client[methodName + 'Async'](params);
      
      if (result?.statusCode === '000') {
        return result; // Success - break immediately
      }
      
      // MTSA error status code - retry
      if (attempt < config.network.retryMax) {
        const delay = config.network.retryBackoffMs * attempt;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    } catch (error) {
      lastError = error;
      if (attempt < config.network.retryMax) {
        const delay = config.network.retryBackoffMs * attempt;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
```

**Current Config:**
```typescript
// on-prem/signing-orchestrator/src/config/index.ts
network: {
  timeoutMs: parseInt(process.env.OUTBOUND_TIMEOUT_MS || '60000', 10),  // 60 seconds
  retryBackoffMs: parseInt(process.env.RETRY_BACKOFF_MS || '2000', 10), // 2 seconds
  retryMax: parseInt(process.env.RETRY_MAX || '3', 10),                 // 3 attempts
}
```

**Total Retry Time:** 2s + 4s + 6s = 12 seconds for DNS failures

---

## Why Sometimes It Works

### Success Scenarios

1. **DNS Cache Hit**
   - Previous successful lookup cached in Java/OS
   - Subsequent requests use cached IP address
   - No external DNS query needed

2. **Network Stability**
   - External DNS resolver responding quickly
   - MSC TrustGate CA services online and responsive
   - No packet loss on network path

3. **Timing Luck**
   - Request arrives during stable network window
   - DNS server not overloaded
   - MTSA container CPU not busy

4. **Low Concurrency**
   - Single request, no competing SOAP calls
   - MTSA container has resources available
   - Docker DNS server not overwhelmed

### Failure Scenarios

1. **DNS Cache Miss**
   - First request after container restart
   - DNS TTL expired, needs fresh lookup
   - Java DNS cache cleared/stale

2. **External DNS Slow**
   - MSC TrustGate CA having issues
   - DNS resolver overloaded
   - Network path latency spike

3. **High Concurrency**
   - Multiple mobile users checking certs simultaneously
   - Docker DNS server queue full
   - MTSA container resource exhaustion

4. **Mobile Network Issues**
   - Cellular network congestion
   - Mobile carrier DNS slow
   - Request timeout before retry completes

---

## Current Docker Configuration Issues

### MTSA Container (Missing DNS Config)
```yaml
# on-prem/mtsa/docker-compose.yml - DOES NOT EXIST YET
# No explicit DNS servers configured
# No DNS options (timeout, attempts)
# Relies on Docker host DNS (unreliable)
```

### Signing Orchestrator (Missing DNS Config)
```yaml
# on-prem/signing-orchestrator/docker-compose.yml
services:
  signing-orchestrator:
    # ... other config ...
    networks:
      - mtsa-network  # Connected to MTSA
    # Missing: dns, dns_opt configuration
```

### Docker Network (Possibly Misconfigured)
```yaml
networks:
  mtsa-network:
    driver: bridge
    internal: false  # Allows outbound - good
    # Missing: DNS forwarder config
```

---

## Recommended Solutions (For Future Implementation)

### 1. Fix Docker DNS Configuration (Highest Priority)

Add explicit DNS servers to all containers:

```yaml
services:
  mtsa-pilot:
    dns:
      - 8.8.8.8      # Google DNS (Primary)
      - 8.8.4.4      # Google DNS (Secondary)
      - 1.1.1.1      # Cloudflare DNS (Fallback)
    dns_opt:
      - ndots:1      # Reduce DNS queries
      - timeout:5    # 5 second DNS timeout
      - attempts:3   # 3 DNS query attempts
```

**Impact:** Ensures reliable DNS resolution even when Docker host DNS fails.

### 2. Increase Retry Logic

**Backend Layer:**
```typescript
// backend/src/api/mtsa.ts
// Add retry wrapper around fetch call
const MAX_RETRIES = 3;
for (let i = 0; i < MAX_RETRIES; i++) {
  try {
    const response = await fetch(orchestratorUrl, ...);
    if (response.ok) return response;
  } catch (error) {
    if (i === MAX_RETRIES - 1) throw error;
    await sleep(2000 * (i + 1));
  }
}
```

**Impact:** Masks transient DNS failures by retrying at application layer.

### 3. Implement Response Caching

**Backend Layer:**
```typescript
// Cache certificate info for 5 minutes
const certCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

router.get('/cert-info/:userId', async (req, res) => {
  const cached = certCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json(cached.data);
  }
  
  // Fetch from orchestrator...
  const data = await fetchCertInfo(userId);
  certCache.set(userId, { data, timestamp: Date.now() });
  return res.json(data);
});
```

**Impact:** Reduces load on MTSA, faster responses for mobile, masks DNS failures.

### 4. Add Health Monitoring

**Signing Orchestrator:**
```typescript
// Add DNS health check to /health endpoint
healthcheck: {
  dns: await checkDNSResolution('digitalid.msctrustgate.com'),
  mtsa: await mtsaClient.healthCheck()
}
```

**Impact:** Early detection of DNS issues before they affect users.

### 5. Graceful Degradation

**Mobile App:**
```javascript
// Show cached cert status with warning
if (error.message.includes('UnknownHostException')) {
  showCachedCertStatus(); // Use last known status
  showWarning('Certificate check temporarily unavailable. Using cached status.');
}
```

**Impact:** Better user experience during DNS outages.

---

## Monitoring & Debugging

### Check DNS Resolution Manually

```bash
# SSH into MTSA container
docker exec -it mtsa-pilot-dev bash

# Test DNS resolution
nslookup digitalid.msctrustgate.com
# or
dig digitalid.msctrustgate.com

# Check DNS servers used by container
cat /etc/resolv.conf
```

### Check MTSA Logs

```bash
# View MTSA Tomcat logs
docker logs mtsa-pilot-dev --tail 100 -f

# Look for DNS errors
docker logs mtsa-pilot-dev 2>&1 | grep -i "UnknownHostException"
```

### Check Signing Orchestrator Logs

```bash
# View orchestrator logs
docker logs signing-orchestrator --tail 100 -f

# Filter for certificate info errors
docker logs signing-orchestrator 2>&1 | grep -i "cert-info"
```

### Monitor Request Patterns

```bash
# Check for concurrent requests (load issue)
docker logs signing-orchestrator 2>&1 | grep "Getting certificate info" | tail -50

# Check correlation IDs for retry attempts
docker logs signing-orchestrator 2>&1 | grep "correlationId: 5ea7bc02"
```

---

## Questions to Answer

1. **Is the mobile app making more requests than expected?**
   - Check backend logs for request frequency
   - Look for polling/background refresh patterns
   - Compare mobile vs web request volumes

2. **Are requests clustered in time?**
   - Analyze request timestamps
   - Look for burst patterns (many users at once)
   - Check for retry storms (mobile retrying too fast)

3. **Does it correlate with external factors?**
   - Time of day (peak usage hours)
   - Specific mobile network carriers
   - Geographic regions (DNS routing)

4. **What's the current DNS configuration?**
   - Check `/etc/resolv.conf` in MTSA container
   - Verify Docker host DNS servers
   - Test external DNS reachability

5. **Are there resource constraints?**
   - MTSA container CPU/memory usage
   - Docker host resources
   - Network bandwidth

---

## Next Steps (Investigation Phase)

1. **Collect Data (No Code Changes)**
   - ✅ Document API usage patterns (web vs mobile)
   - ⬜ Enable detailed logging in signing orchestrator
   - ⬜ Monitor DNS resolution from MTSA container
   - ⬜ Compare request volumes (web vs mobile)
   - ⬜ Check for concurrent request spikes

2. **Test Hypotheses**
   - ⬜ Manual DNS testing from MTSA container
   - ⬜ Simulate concurrent requests (load test)
   - ⬜ Check DNS cache behavior
   - ⬜ Test with explicit DNS servers temporarily

3. **Gather Mobile App Details**
   - ⬜ When does mobile app call cert-info API?
   - ⬜ What's the mobile app timeout value?
   - ⬜ Does mobile app retry failed requests?
   - ⬜ How many concurrent users typically?

4. **Make Informed Decision**
   - Based on data, choose solution(s) from recommendations
   - Implement in staging first
   - Monitor impact before production

---

## Conclusion

The root cause is **intermittent DNS resolution failure** in the MTSA Docker container when trying to reach `digitalid.msctrustgate.com`. This affects mobile more than web because:

1. Mobile creates **burst/concurrent requests** (overwhelming DNS)
2. Mobile may **poll/refresh** more frequently
3. Mobile **network quality** varies (causing timeouts)
4. Mobile **timeout values** may be shorter

The issue is **infrastructure-level** (Docker DNS), not application-level, which is why the code works sometimes. The fix requires **Docker configuration changes** (DNS servers) and possibly **application-level workarounds** (caching, retries).

**No code fixes implemented yet** - awaiting your decision on which solutions to implement based on this analysis.

