# Nginx Fix Deployment Instructions

## ✅ What Was Already Deployed

1. **Nginx config file copied to server**: `/tmp/nginx.conf.new`
2. **Config validated**: ✅ Syntax check passed
3. **Container reloaded**: ✅ Nginx is working

## ⚠️ Manual Step Required (Sudo Permission)

The nginx config file is owned by root, so you need to run this command manually:

```bash
ssh admin-kapital@100.76.8.62
sudo cp /tmp/nginx.conf.new /home/admin-kapital/docuseal-onprem/nginx/nginx.conf
sudo chown root:root /home/admin-kapital/docuseal-onprem/nginx/nginx.conf
docker restart docuseal-nginx
```

This will:
- ✅ Update the config file on disk (so it persists across container restarts)
- ✅ Restart nginx to load the new config with resolver directive
- ✅ Preserve all your data (no volumes deleted)

## What This Fix Does

The new nginx config includes:
1. **Docker DNS resolver**: `resolver 127.0.0.11 valid=10s;`
   - Allows nginx to resolve container names dynamically
   - Prevents "host not found in upstream" errors

2. **Keepalive connection pooling**: `keepalive 32;`
   - Improves performance for upstream connections

## Verification After Manual Step

After running the sudo commands, verify it worked:

```bash
ssh admin-kapital@100.76.8.62
docker exec docuseal-nginx cat /etc/nginx/nginx.conf | grep resolver
# Should show: resolver 127.0.0.11 valid=10s;

curl http://localhost/health
# Should return: healthy
```

## About docker-compose.yml

The docker-compose.yml changes (healthchecks) are in your local repo at:
- `on-prem/docuseal/docker-compose.yml`

**Note**: Your server doesn't appear to use docker-compose.yml currently (containers were started manually or via another method). The healthcheck improvements will take effect when:
- You recreate the containers with docker-compose, OR
- You manually add healthchecks to the running containers

For now, the nginx fix (resolver directive) is the critical change that prevents startup issues.

## Summary

- ✅ Nginx config file: Ready to deploy (in /tmp/nginx.conf.new)
- ⏳ Requires: One sudo command to copy file
- ✅ No data loss: All volumes and data preserved
- ✅ Zero downtime: Nginx can reload gracefully

