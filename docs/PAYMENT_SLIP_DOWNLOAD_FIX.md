# Payment Slip Download Fix - Production Issue Resolution

**Date:** October 19, 2025  
**Issue:** Payment slip downloads working in dev but failing in production with 404 errors

## Problem Summary

Payment slip downloads were failing in production but working in development with the error:
```
Failed to load resource: the server responded with a status of 404 (Not Found) (payment-slip, line 0)
```

## Root Causes

### 1. **Inconsistent Path Resolution**
The payment slip download endpoint was using `process.cwd()` while the stamp certificate download (which worked) was using `__dirname`:

**Before (Broken):**
```typescript
const filePath = path.join(process.cwd(), disbursement.paymentSlipUrl);
```

**Why it failed in production:**
- In development: `process.cwd()` returns `/Users/ivan/Documents/creditxpress/backend` ✅
- In production Docker: `process.cwd()` returns `/app` but compiled code is in `/app/dist/` 
- Path resolution was inconsistent between dev and prod

**After (Fixed):**
```typescript
const filePath = path.join(__dirname, '../../', disbursement.paymentSlipUrl);
```

**Why it works:**
- `__dirname` always points to the current file's directory
- In production Docker: `__dirname` = `/app/dist/src/api/` → `../../` resolves to `/app/`
- Consistent path resolution across environments

### 2. **Missing Directories in Production**
The `/var/www/uploads/disbursement-slips/` and `/var/www/uploads/stamp-certificates/` folders didn't exist in production.

**Why they were missing:**
- Multer creates directories during **upload**, but if no uploads happened yet, folders don't exist
- The deployment script didn't pre-create these folders
- When download was attempted, the file path check failed because the parent directory didn't exist

## Changes Made

### 1. Backend API Fix (`backend/src/api/admin.ts`)

Updated the payment slip download endpoint to match the stamp certificate pattern:

```typescript
router.get(
	"/disbursements/:applicationId/payment-slip",
	authenticateToken,
	requireAdminOrAttestor as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { applicationId } = req.params;

			const disbursement = await prisma.loanDisbursement.findUnique({
				where: { applicationId },
				select: { paymentSlipUrl: true }
			});

			if (!disbursement?.paymentSlipUrl) {
				return res.status(404).json({
					success: false,
					message: 'Payment slip not found'
				});
			}

			// ✅ Use __dirname like stamp certificate to ensure correct path in Docker
			const filePath = path.join(__dirname, '../../', disbursement.paymentSlipUrl);
			console.log(`📁 Reading payment slip from: ${filePath}`);
			
			if (!fs.existsSync(filePath)) {
				console.error(`❌ Payment slip file not found at: ${filePath}`);
				return res.status(404).json({
					success: false,
					message: 'File not found on server'
				});
			}

			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', `attachment; filename="disbursement-slip-${applicationId}.pdf"`);
			
			const fileStream = fs.createReadStream(filePath);
			// ✅ Added error handling for file streaming
			fileStream.on('error', (error: Error) => {
				console.error('❌ Error streaming payment slip file:', error);
				if (!res.headersSent) {
					res.status(500).json({
						success: false,
						message: "Error streaming payment slip file",
						error: error.message
					});
				}
			});
			fileStream.pipe(res);
			return;
		} catch (error) {
			console.error('❌ Error downloading disbursement slip:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to download payment slip',
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}
);
```

**Key Improvements:**
- ✅ Changed from `process.cwd()` to `__dirname` for consistent path resolution
- ✅ Added console logging for debugging (`📁 Reading payment slip from: ...`)
- ✅ Added file stream error handling (previously missing)
- ✅ Enhanced error messages with more context

### 2. GitHub Actions Deployment Script (`.github/workflows/deploy.yaml`)

Added automatic creation of upload directories during deployment:

```yaml
# Ensure receipts and uploads directories exist with proper permissions
echo "📁 Setting up receipts and uploads directories..."
docker compose -f docker-compose.prod.yml exec backend mkdir -p receipts
docker compose -f docker-compose.prod.yml exec backend chmod 777 receipts
docker compose -f docker-compose.prod.yml exec backend mkdir -p uploads/default-letters
docker compose -f docker-compose.prod.yml exec backend chmod 777 uploads/default-letters
docker compose -f docker-compose.prod.yml exec backend mkdir -p uploads/disbursement-slips  # ✅ NEW
docker compose -f docker-compose.prod.yml exec backend chmod 777 uploads/disbursement-slips  # ✅ NEW
docker compose -f docker-compose.prod.yml exec backend mkdir -p uploads/stamp-certificates  # ✅ NEW
docker compose -f docker-compose.prod.yml exec backend chmod 777 uploads/stamp-certificates  # ✅ NEW
```

### 3. Immediate Production Fix

Manually created the directories on the production server:

```bash
# Create disbursement-slips folder
docker compose -f docker-compose.prod.yml exec backend mkdir -p /app/uploads/disbursement-slips
docker compose -f docker-compose.prod.yml exec backend chmod 777 /app/uploads/disbursement-slips

# Create stamp-certificates folder
docker compose -f docker-compose.prod.yml exec backend mkdir -p /app/uploads/stamp-certificates
docker compose -f docker-compose.prod.yml exec backend chmod 777 /app/uploads/stamp-certificates

# Restart backend to apply code changes
docker compose -f docker-compose.prod.yml restart backend
```

**Verification:**
```bash
$ ls -la /var/www/uploads/ | grep -E 'disbursement|stamp'
drwxrwxrwx 2 root root   4096 Oct 19 11:12 disbursement-slips ✅
drwxrwxrwx 2 root root   4096 Oct 19 11:13 stamp-certificates ✅
```

## Why It Worked in Dev But Not Prod

| Aspect | Development | Production (Docker) | Issue |
|--------|-------------|---------------------|-------|
| **Path Resolution** | `process.cwd()` = `/Users/.../backend` | `process.cwd()` = `/app` (wrong) | ❌ Inconsistent |
| **Compiled Code Location** | Source files in `src/` | Compiled to `dist/src/` | ❌ Different structure |
| **Folder Existence** | Created during first upload | May not exist if no uploads yet | ❌ Missing folders |
| **Volume Mounting** | `./uploads:/app/uploads` | `/var/www/uploads:/app/uploads` | ℹ️ Different host paths |

## Testing Checklist

- [x] Payment slip upload in admin panel
- [x] Payment slip download in admin panel (disbursements tab)
- [x] Payment slip download in admin panel (loan details)
- [x] Payment slip download in user dashboard
- [x] Payment slip replacement in admin panel
- [x] Stamp certificate upload and download (verify still working)
- [x] Audit trail logging for uploads/replacements
- [x] Folders created automatically on deployment

## Files Changed

1. `backend/src/api/admin.ts` - Fixed path resolution and added error handling
2. `.github/workflows/deploy.yaml` - Added directory creation to deployment script
3. Production server - Manually created directories and restarted backend

## Prevention for Future

1. **Always use `__dirname` for Docker-deployed applications** when resolving file paths relative to source code
2. **Pre-create all upload directories** in deployment scripts, don't rely on runtime creation
3. **Test file uploads/downloads in production** environment before releasing to users
4. **Use consistent patterns** across similar endpoints (stamp certificate pattern should be template for all file downloads)

## Related Documentation

- [API_UPDATES_MOBILE_APP.md](./API_UPDATES_MOBILE_APP.md) - API documentation including payment slip endpoints
- [Backend Docker Setup](../backend/docker-compose.prod.yml) - Production Docker configuration
- [Deployment Workflow](../.github/workflows/deploy.yaml) - GitHub Actions deployment script

---

**Status:** ✅ **RESOLVED**  
**Production Impact:** Minimal - Issue fixed within hours of detection  
**User Impact:** None - Feature was newly deployed, no existing users affected

