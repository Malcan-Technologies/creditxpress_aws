# Health Check Unreachable Error Fix

## Problem Summary

Occasional "unreachable" errors for health checks were occurring due to:

1. **Timeout too short**: Backend health check had 5s timeout, but orchestrator needs time for:
   - Tailscale network latency (50-200ms)
   - Internal DocuSeal reachability check (can take 3-5s)
   - Response travel back through Tailscale

2. **Nested health checks**: The signing orchestrator's health endpoint checks DocuSeal internally, so the total time can exceed 5s

3. **No connection reuse**: Each health check creates new TCP connections, adding latency

4. **Network variance**: Tailscale latency can vary, causing occasional timeouts

## Fixes Applied

### 1. Backend Health Check Timeout (`backend/src/api/admin.ts`)
- **Changed**: `timeout: 5000` → `timeout: 10000` (10 seconds)
- **Reason**: Allows sufficient time for Tailscale + internal DocuSeal check

### 2. Signing Orchestrator DocuSeal Check (`on-prem/signing-orchestrator/src/routes/health.ts`)
- **Changed**: `timeout: 5000` → `timeout: 3000` (3 seconds)
- **Added**: Connection keep-alive for HTTP requests
- **Improved**: Timeout error handling (debug logs instead of warnings for expected timeouts)

### 3. Nginx Proxy Timeouts (`config/nginx.conf`)
- **Optimized**: Reduced proxy timeouts to match expected response times
- **Changed**: 
  - `proxy_connect_timeout: 30s` → `15s`
  - `proxy_read_timeout: 30s` → `12s`
  - `proxy_send_timeout: 30s` → `12s`
- **Added**: Disabled buffering for faster response (`proxy_buffering off`)

## Expected Behavior After Fix

1. **Health checks should complete in 3-8 seconds** (instead of occasionally timing out)
2. **Connection reuse** reduces latency for subsequent checks
3. **Less noisy logs** - timeout errors are expected occasionally and won't spam warnings

## Monitoring

Watch for:
- Health check response times (should be < 8s consistently)
- Occasional timeouts are normal, but should be < 5% of checks
- Check orchestrator logs for DocuSeal reachability issues

## Deployment

The backend changes need to be deployed. The orchestrator changes need to be deployed to the on-prem server.

To deploy orchestrator changes:
```bash
cd on-prem/signing-orchestrator
./deploy-auto.sh
```

Or manually:
```bash
# On on-prem server
cd ~/signing-orchestrator
docker compose down
docker compose up -d --build
```

