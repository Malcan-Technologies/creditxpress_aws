# PM2 Process Name Conflicts - Deployment Fix

## Problem Summary

The GitHub Actions deployment script was creating PM2 processes with different names (`growkapital-frontend` and `growkapital-admin`) while existing processes (`frontend` and `admin`) were already running on the same ports. This caused:

1. **Port Conflicts**: Both sets of processes trying to bind to ports 3002 and 3003
2. **Continuous Crashes**: The new processes crashed constantly with `EADDRINUSE` errors
3. **Layout Issues**: The frontend layout was broken due to the instability
4. **Resource Waste**: Hundreds of thousands of restart attempts

### Evidence
- `growkapital-frontend`: **849,653 restarts** (crashing every second)
- `growkapital-admin`: **482 restarts** (also crashing)
- Original `frontend` and `admin` processes: Running but potentially serving stale code

## Root Cause

The deployment script had two major issues:

### 1. Inconsistent Process Naming
- **GitHub Actions**: Created `growkapital-frontend` and `growkapital-admin`
- **VPS**: Already had `frontend` and `admin` running
- **Result**: Two separate sets of processes competing for the same ports

### 2. No Cleanup Step
The deployment script didn't:
- Stop existing processes before starting new ones
- Check for port conflicts
- Remove old processes from PM2

## Solution Implemented

### Changes to `.github/workflows/deploy.yaml`

#### 1. Added Process Cleanup (Lines 232-245, 356-369)
```bash
# Stop and remove any existing frontend processes on port 3002
echo "🧹 Cleaning up existing frontend processes..."
pm2 stop frontend 2>/dev/null || true
pm2 delete frontend 2>/dev/null || true
pm2 stop growkapital-frontend 2>/dev/null || true
pm2 delete growkapital-frontend 2>/dev/null || true

# Kill any process using port 3002
EXISTING_PID=$(lsof -ti:3002 || true)
if [ ! -z "$EXISTING_PID" ]; then
  echo "Killing existing process on port 3002: $EXISTING_PID"
  kill -9 $EXISTING_PID 2>/dev/null || true
  sleep 2
fi
```

#### 2. Standardized Process Names (Lines 318-327, 463-472)
Changed from:
- `pm2 start npm --name "growkapital-frontend"`
- `pm2 start .next/standalone/server.js --name "growkapital-admin"`

To:
- `pm2 start npm --name "frontend"`
- `pm2 start npm --name "admin"`

#### 3. Updated Verification Steps (Lines 750-773)
Changed from checking `growkapital-frontend` and `growkapital-admin` to checking `frontend` and `admin`.

### Changes to Ecosystem Configs

#### `admin/ecosystem.config.js`
- Changed process name from `"growkapital-admin"` to `"admin"`
- Changed script from `".next/standalone/server.js"` to `"npm"` with args
- Updated log file names to match new process name
- Fixed API URLs to use `creditxpress.com.my` instead of `kredit.my`

#### `frontend/ecosystem.config.js` (Created)
- Created new ecosystem config for frontend
- Standardized configuration with admin
- Process name: `"frontend"`
- Proper environment variables and logging

## Benefits

1. **Zero Port Conflicts**: Cleanup step ensures no duplicate processes
2. **Consistent Naming**: Same process names across all deployments
3. **Clean Restarts**: Proper shutdown before starting new processes
4. **Better Monitoring**: Consistent log file names
5. **Fail-Fast**: Script exits with error if build fails instead of starting broken services

## Manual Fix Applied on VPS

On the production VPS, we manually:
```bash
# Stopped and deleted the duplicate processes
pm2 stop growkapital-frontend growkapital-admin
pm2 delete growkapital-frontend growkapital-admin
pm2 save

# Restarted the main processes
pm2 restart frontend admin
```

## Future Deployments

All future deployments will:
1. Clean up any existing processes (both old and new naming schemes)
2. Kill any processes using the target ports
3. Start fresh processes with consistent names
4. Verify the services are accessible

## Verification Steps

After deployment, verify:
```bash
# Check PM2 list shows only one frontend and one admin
pm2 list

# Verify processes are stable (no rapid restarts)
pm2 monit

# Check no port conflicts
lsof -i:3002
lsof -i:3003

# Test public URLs
curl -I https://creditxpress.com.my
curl -I https://admin.creditxpress.com.my/login
```

## Related Files Modified

- `.github/workflows/deploy.yaml` - Main deployment script
- `admin/ecosystem.config.js` - Admin PM2 configuration
- `frontend/ecosystem.config.js` - Frontend PM2 configuration (new)

## Date

October 19, 2025

