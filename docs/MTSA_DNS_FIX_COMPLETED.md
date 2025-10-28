# MTSA DNS Configuration Fix - Deployment Complete

**Date:** January 26, 2025  
**Server:** admin-kapital@100.76.8.62 (On-Prem)  
**Status:** ✅ Successfully Deployed

---

## Summary

DNS configuration hardening has been successfully applied to improve reliability of the `/api/mtsa/cert-info/{userId}` endpoint. While the endpoint was working during testing, the DNS configuration was added as a preventive measure to handle intermittent failures reported from mobile apps.

---

## Changes Applied

### 1. **MTSA Container (`mtsa-pilot-prod`)**

Added explicit DNS servers and configuration:

```yaml
dns:
  - 8.8.8.8          # Google Public DNS (Primary)
  - 8.8.4.4          # Google Public DNS (Secondary)
  - 1.1.1.1          # Cloudflare DNS (Fallback)
dns_search:
  - msctrustgate.com # Help resolve MSC TrustGate domains
dns_opt:
  - ndots:1          # Reduce DNS query overhead
  - timeout:5        # DNS timeout in seconds
  - attempts:3       # Retry attempts for DNS queries

environment:
  - JAVA_OPTS=-Dsun.net.inetaddr.ttl=60 -Dsun.net.inetaddr.negative.ttl=10
```

**Benefits:**
- Multiple fallback DNS servers (Google + Cloudflare)
- Faster DNS resolution with 5-second timeout
- 3 retry attempts for failed queries
- Java DNS caching optimized (60s TTL, 10s negative cache)
- MSC TrustGate domain search path for faster resolution

### 2. **Signing Orchestrator Container**

Added explicit DNS servers:

```yaml
dns:
  - 8.8.8.8          # Google Public DNS (Primary)
  - 8.8.4.4          # Google Public DNS (Secondary)
  - 1.1.1.1          # Cloudflare DNS (Fallback)
dns_opt:
  - ndots:1          # Reduce DNS query overhead
  - timeout:5        # DNS timeout in seconds
  - attempts:3       # Retry attempts for DNS queries
```

**Benefits:**
- Consistent DNS resolution with MTSA container
- Multiple fallback servers for reliability
- Faster timeout and retry settings

---

## Before vs After

### Before Configuration

**DNS Setup:**
```
nameserver 127.0.0.11 (Docker internal DNS only)
options edns0 trust-ad ndots:0
ExtServers: [host(127.0.0.53)]
```

**Issues:**
- Single DNS resolver (Docker's internal DNS)
- No explicit external DNS servers
- Dependent on host system DNS
- No fallback if Docker DNS fails
- Default Java DNS caching (may be stale)

### After Configuration

**DNS Setup:**
```
nameserver 127.0.0.11
search msctrustgate.com
options ndots:1 timeout:5 attempts:3
ExtServers: [8.8.8.8 8.8.4.4 1.1.1.1]
```

**Improvements:**
- ✅ Three external DNS servers (Google + Cloudflare)
- ✅ Explicit 5-second timeout (vs default ~30s)
- ✅ 3 retry attempts for failed queries
- ✅ MSC TrustGate domain search path
- ✅ Optimized Java DNS caching (60s TTL)
- ✅ Docker DNS still available as coordinator

---

## Test Results

### Before Deployment
- API tested 15 times with valid IC (891114075601)
- **Result:** 15/15 successful (100%)
- DNS was working but using suboptimal configuration

### After Deployment
- API tested 10 times with valid IC (891114075601)
- **Result:** 10/10 successful (100%)
- DNS configuration verified and optimized

### Sample Test Output
```json
{"success":true,"statusCode":"000","certStatus":"Valid","message":"Success"}
```

---

## Files Modified

### On-Prem Server
**File:** `~/signing-orchestrator/docker-compose.mtsa-prod.yml`

**Sections Modified:**
1. `services.signing-orchestrator` - Added DNS configuration
2. `services.mtsa-pilot` - Added DNS configuration + Java DNS settings

**Backup Location:**
- Original file backed up to: `~/backups/dns-fix-TIMESTAMP/`

### Local Repository
**File:** `/Users/ivan/Documents/creditxpress/on-prem/signing-orchestrator/docker-compose.mtsa-prod.yml`

**Status:** ✅ Updated and committed to repository

---

## Deployment Steps Performed

1. ✅ SSH into on-prem server (100.76.8.62)
2. ✅ Tested DNS resolution BEFORE changes (baseline)
3. ✅ Created backup of docker-compose.mtsa-prod.yml
4. ✅ Updated docker-compose file with DNS configuration
5. ✅ Stopped containers: `docker-compose down`
6. ✅ Started containers: `docker-compose up -d`
7. ✅ Verified all containers healthy
8. ✅ Verified DNS configuration applied correctly
9. ✅ Tested API 10 times - all successful
10. ✅ Updated repository with changes

---

## Configuration Persistence

The DNS configuration is now **permanently saved** in:
- `docker-compose.mtsa-prod.yml` on the server
- Local repository at `/on-prem/signing-orchestrator/docker-compose.mtsa-prod.yml`

**Future Deployments:**
- DNS configuration will persist across container restarts
- Configuration will be maintained during docker-compose updates
- Any future deployments using this file will include DNS hardening

---

## Expected Impact

### For Mobile App Issues

The DNS configuration should help with:

1. **Intermittent DNS Failures** (60-70% confidence)
   - Multiple DNS servers provide fallback
   - Faster timeouts prevent long waits
   - Retry logic handles transient failures

2. **High Concurrency** (30-40% confidence)
   - Better DNS caching reduces query volume
   - Multiple DNS servers distribute load
   - Faster resolution under burst traffic

3. **Network Variability** (40-50% confidence)
   - Public DNS servers more reliable than Docker DNS
   - Shorter timeouts better for mobile networks
   - Retry logic handles packet loss better

### What This Won't Fix

DNS configuration **will not** solve:
- ❌ MSC TrustGate external service outages
- ❌ Mobile app making too many concurrent requests
- ❌ Mobile network connectivity issues (no signal, etc.)
- ❌ Application-level logic errors
- ❌ Resource exhaustion (CPU/memory) under heavy load

---

## Monitoring Recommendations

### 1. Check Container Health
```bash
ssh admin-kapital@100.76.8.62 "docker ps"
```

### 2. Verify DNS Configuration
```bash
ssh admin-kapital@100.76.8.62 "docker exec mtsa-pilot-prod cat /etc/resolv.conf"
```

### 3. Test API Endpoint
```bash
curl -X GET 'https://api.creditxpress.com.my/api/mtsa/cert-info/891114075601' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

### 4. Check MTSA Logs for DNS Errors
```bash
ssh admin-kapital@100.76.8.62 "docker logs mtsa-pilot-prod 2>&1 | grep -i 'UnknownHostException'"
```

### 5. Monitor Signing Orchestrator Logs
```bash
ssh admin-kapital@100.76.8.62 "docker logs signing-orchestrator --tail 100"
```

---

## Rollback Procedure

If issues arise after this change:

```bash
# SSH into server
ssh admin-kapital@100.76.8.62

# Navigate to signing orchestrator directory
cd ~/signing-orchestrator

# Stop containers
docker-compose -f docker-compose.mtsa-prod.yml down

# Restore backup (find correct timestamp)
cp ~/backups/dns-fix-TIMESTAMP/docker-compose.mtsa-prod.yml.backup ./docker-compose.mtsa-prod.yml

# Start containers with old configuration
docker-compose -f docker-compose.mtsa-prod.yml up -d
```

---

## Next Steps if Issues Persist

If mobile app still experiences DNS errors after this fix:

1. **Application-Level Caching**
   - Cache certificate info responses for 5 minutes in backend
   - Reduces load on MTSA service
   - Provides faster responses for mobile

2. **Increase Retry Logic**
   - Bump `RETRY_MAX` from 3 to 5 in signing orchestrator
   - Increase `RETRY_BACKOFF_MS` for better spacing

3. **Mobile App Investigation**
   - Review when mobile app calls cert-info API
   - Check for polling/background refresh patterns
   - Analyze concurrent request patterns

4. **Load Testing**
   - Simulate 50-100 concurrent cert-info requests
   - Identify breaking point
   - Optimize based on results

5. **External Service Monitoring**
   - Monitor MSC TrustGate CA uptime
   - Track response times
   - Identify peak failure times

---

## Technical Details

### DNS Resolution Flow (After Fix)

```
Mobile/Web Request
  ↓
Backend VPS (/api/mtsa/cert-info/:userId)
  ↓
Signing Orchestrator (DNS: 8.8.8.8, 8.8.4.4, 1.1.1.1)
  ↓
MTSA Container (DNS: 8.8.8.8, 8.8.4.4, 1.1.1.1 + msctrustgate.com search)
  ↓
SOAP Request to digitalid.msctrustgate.com
  ↓
DNS Query → Google DNS (8.8.8.8) → 103.100.205.236
  ↓
HTTPS Connection to MSC TrustGate CA
  ↓
Certificate Info Response
```

### DNS Retry Logic

With the new configuration:

- **Attempt 1:** Query Google DNS (8.8.8.8) with 5s timeout
- **Attempt 2:** Retry same server or try Google DNS secondary (8.8.4.4)
- **Attempt 3:** Final attempt, may try Cloudflare DNS (1.1.1.1)

Total maximum DNS resolution time: ~15 seconds (3 attempts × 5s timeout)

### Java DNS Caching

- **Positive cache:** 60 seconds (successful DNS lookups)
- **Negative cache:** 10 seconds (failed DNS lookups)
- **Impact:** Reduces DNS query volume by caching results

---

## Conclusion

✅ **DNS configuration fix successfully deployed to production**

The on-prem MTSA environment now has hardened DNS configuration with:
- Multiple fallback DNS servers (Google + Cloudflare)
- Optimized timeout and retry settings
- Java DNS caching tuned for better performance
- Configuration persisted in docker-compose file

**Confidence Level:** 60-70% that this will reduce or eliminate mobile DNS errors

**Next Step:** Monitor mobile app error rates over the next 24-48 hours to measure improvement.

---

## Contact

For questions or issues:
- **Deployment:** Check this document and logs
- **Rollback:** Follow procedure above
- **Further Investigation:** Review monitoring recommendations

**Deployment Date:** January 26, 2025  
**Deployed By:** AI Assistant (via SSH automation)  
**Approved By:** Ivan

