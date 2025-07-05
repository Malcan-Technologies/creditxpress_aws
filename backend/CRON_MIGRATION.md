# Cron System Migration

## Overview

We have migrated from system cron to `node-cron` for better reliability and simplicity in Docker environments.

## What Changed

### ✅ Before (System Cron)
- Complex shell scripts: `setup-cron.sh`, `setup-production-cron.sh`
- Docker container cron daemon setup
- External cron job management
- Shell escaping issues
- ts-node dependencies in production

### ✅ After (Node Cron)
- Built-in `node-cron` scheduler
- Runs within the application process
- Simple TypeScript/JavaScript
- No external dependencies
- Easy to test and debug

## New Architecture

### Cron Scheduler Service
- **File**: `src/lib/cronScheduler.ts`
- **Purpose**: Manages all scheduled jobs using node-cron
- **Pattern**: Singleton for application-wide access

### Integration
- **File**: `src/index.ts`
- **Startup**: Cron scheduler starts with the application
- **Shutdown**: Graceful cleanup on application termination

### Admin Endpoints
- **GET** `/api/admin/cron/status` - Check cron job status
- **POST** `/api/admin/cron/trigger-late-fees` - Manually trigger late fee processing

## Removed Files

The following files have been deleted as they are no longer needed:
- `backend/scripts/setup-cron.sh`
- `backend/scripts/setup-production-cron.sh`

## Updated Files

### Docker Files
- `backend/Dockerfile.prod` - Removed cron daemon setup
- `backend/Dockerfile.dev` - Removed cron daemon setup

### Deployment
- `.github/workflows/deploy.yaml` - Removed cron setup steps

### Scripts
- `backend/scripts/process-late-fees.js` - Updated to use compiled JS instead of ts-node

## Benefits

1. **Reliability**: No more shell escaping issues or missing cron jobs
2. **Simplicity**: Cron logic is part of the application code
3. **Testability**: Easy to test cron jobs in development
4. **Monitoring**: Built-in admin endpoints for status checking
5. **Docker-friendly**: Works perfectly in containerized environments
6. **Graceful shutdown**: Proper cleanup when application stops

## Testing

### Development
```bash
# Start the application - cron scheduler starts automatically
npm run dev

# Check cron status
curl http://localhost:4001/api/admin/cron/status

# Manually trigger late fee processing
curl -X POST http://localhost:4001/api/admin/cron/trigger-late-fees
```

### Production
```bash
# Check cron status
curl https://api.kredit.my/api/admin/cron/status

# Manually trigger late fee processing
curl -X POST https://api.kredit.my/api/admin/cron/trigger-late-fees
```

## Schedule

Late fee processing runs daily at **1:00 AM UTC+8 (Malaysia time)** automatically.
- **Local time**: 1:00 AM UTC+8 
- **UTC time**: 17:00 UTC (5:00 PM UTC)

## Monitoring

Check the application logs for cron-related messages:
```bash
# Development
docker compose -f docker-compose.dev.yml logs backend | grep cron

# Production  
docker compose -f docker-compose.prod.yml logs backend | grep cron
``` 