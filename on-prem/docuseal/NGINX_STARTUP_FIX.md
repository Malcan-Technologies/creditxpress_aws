# Nginx Startup Issue - Root Cause & Fix

## Problem Summary

Nginx was requiring manual restarts because it was failing to resolve the upstream `docuseal-app` container at startup. This happened when:

1. **Config file was updated** (Oct 21) but nginx wasn't reloaded
2. **Startup race condition**: Nginx tried to resolve `docuseal-app` before Docker's DNS was ready
3. **No healthcheck dependencies**: Nginx started immediately when `docuseal` container started, not when it was ready

## Root Causes

### 1. DNS Resolution Timing Issue
- Nginx resolves upstream hostnames **at startup**, not at runtime
- If the upstream container isn't registered in Docker's DNS yet, nginx fails with: `host not found in upstream "docuseal:3000"`
- Even with `depends_on`, Docker only waits for the container to **start**, not for it to be **healthy** or registered in DNS

### 2. Missing Healthchecks
- `docuseal-app` had no healthcheck configured
- Nginx's `depends_on` only waited for container start, not service readiness
- This could cause nginx to start while DocuSeal was still initializing

### 3. Config Mismatch
- Historical logs showed errors for `docuseal:3000` (old config)
- Current config uses `docuseal-app:3000`
- This indicates config changes weren't properly reloaded

## Fixes Applied

### 1. Added Docker DNS Resolver (`nginx.conf`)
```nginx
resolver 127.0.0.11 valid=10s;
```
- Uses Docker's internal DNS (`127.0.0.11`)
- Allows nginx to resolve container names dynamically
- The `valid=10s` caches DNS lookups for 10 seconds

**Note**: While this helps, the upstream block still resolves at startup. For true dynamic resolution, you'd need to use variables in proxy_pass, but the current fix combined with healthchecks should be sufficient.

### 2. Enabled Healthcheck for `docuseal-app` (`docker-compose.yml`)
```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```
- Ensures DocuSeal is actually responding before marking healthy
- Gives 60 seconds for initial startup

### 3. Updated Nginx Depends On (`docker-compose.yml`)
```yaml
depends_on:
  docuseal:
    condition: service_healthy
```
- Now waits for `docuseal` to be **healthy**, not just started
- Prevents nginx from starting before DocuSeal is ready

### 4. Added Nginx Healthcheck
```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost/ || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```
- Allows monitoring nginx health status
- Helps detect when nginx itself is having issues

### 5. Added Keepalive to Upstream
```nginx
upstream docuseal_app {
    server docuseal-app:3000;
    keepalive 32;
}
```
- Improves connection reuse and performance

## Deployment

To apply these fixes on the on-prem server:

```bash
# Copy updated files to server
scp on-prem/docuseal/nginx/nginx.conf admin-kapital@100.76.8.62:/home/admin-kapital/docuseal-onprem/nginx/
scp on-prem/docuseal/docker-compose.yml admin-kapital@100.76.8.62:/home/admin-kapital/docuseal-onprem/

# On the server, test nginx config
docker exec docuseal-nginx nginx -t

# Reload nginx (no downtime)
docker exec docuseal-nginx nginx -s reload

# Or restart if needed
docker restart docuseal-nginx
```

For full deployment with the new docker-compose changes:
```bash
cd /home/admin-kapital/docuseal-onprem
docker compose down
docker compose up -d
```

## Prevention

These changes prevent the issue by:
1. **Healthcheck dependencies** ensure proper startup order
2. **DNS resolver** provides fallback for DNS timing issues
3. **Healthchecks** allow Docker to restart unhealthy containers automatically

## Monitoring

Watch for these indicators:
- Nginx logs: `host not found in upstream` errors
- Container restart counts: `docker ps` shows high restart counts
- Health check failures: `docker inspect <container> | grep -A 10 Health`

If the issue persists, check:
1. Network connectivity between containers
2. DNS resolution: `docker exec docuseal-nginx nslookup docuseal-app`
3. DocuSeal startup time (may need to increase `start_period`)

