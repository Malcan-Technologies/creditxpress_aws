# DocuSeal URL Configuration Fix

## Issue Summary
Mobile app integration receiving signing URLs in format `https://sign.creditxpress.com.my/s/43` that return 404 errors when accessing `/api/docuseal/initiate-application-signing` endpoint.

## Root Cause
Mismatch between DocuSeal API endpoint (where submissions are created) and base URL (where users access signing links).

### Current Configuration Problem

```yaml
# Backend creates submissions here:
DOCUSEAL_API_URL=http://host.docker.internal:3001  # or internal IP

# But generates signing URLs pointing here:
DOCUSEAL_BASE_URL=https://sign.creditxpress.com.my
```

If these point to different DocuSeal instances, the submission slug won't exist at the external URL.

## Verification Steps

### 1. Check Your Current Environment Variables

**In Production:**
```bash
# SSH to your VPS
cd /path/to/creditxpress/backend

# Check what's actually set
docker compose -f docker-compose.prod.yml exec backend env | grep DOCUSEAL
```

You should see:
```
DOCUSEAL_BASE_URL=https://sign.creditxpress.com.my
DOCUSEAL_API_URL=https://sign.creditxpress.com.my  # Should match!
DOCUSEAL_API_TOKEN=your-token
DOCUSEAL_LOAN_AGREEMENT_TEMPLATE_ID=your-template-id
```

### 2. Verify DocuSeal Accessibility

**From within Docker container:**
```bash
docker compose -f docker-compose.prod.yml exec backend sh

# Test API access
curl -H "X-Auth-Token: $DOCUSEAL_API_TOKEN" $DOCUSEAL_API_URL/api/templates

# Test base URL access
curl $DOCUSEAL_BASE_URL/health
```

### 3. Check DocuSeal Submission Exists

After calling `initiate-application-signing`, check if the submission was created:

```bash
# Get submission ID from backend logs or response
SUBMISSION_ID=43

# Check if it exists via API
curl -H "X-Auth-Token: $DOCUSEAL_API_TOKEN" \
  https://sign.creditxpress.com.my/api/submissions/$SUBMISSION_ID

# Check if signing URL is accessible
curl https://sign.creditxpress.com.my/s/$SUBMISSION_ID
```

## Solutions

### Solution 1: Ensure Both URLs Point to Same Instance (RECOMMENDED)

**Update your environment variables:**

```bash
# In your production .env file
DOCUSEAL_BASE_URL=https://sign.creditxpress.com.my
DOCUSEAL_API_URL=https://sign.creditxpress.com.my
DOCUSEAL_API_TOKEN=your-api-token-here
```

**Then rebuild:**
```bash
cd /path/to/creditxpress/backend
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Solution 2: Use Tailscale Internal URL (If On-Prem)

If DocuSeal is on-premises and accessed via Tailscale:

```bash
# Backend should access DocuSeal via Tailscale
DOCUSEAL_API_URL=http://100.x.x.x:3001  # Tailscale IP
DOCUSEAL_BASE_URL=https://sign.creditxpress.com.my  # Public tunnel

# Ensure nginx is properly proxying to DocuSeal
```

**Check nginx configuration on VPS:**
```nginx
# /etc/nginx/sites-available/sign.creditxpress.com.my
server {
    listen 80;
    server_name sign.creditxpress.com.my;

    location / {
        proxy_pass http://100.x.x.x:3001;  # Tailscale IP of on-prem server
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Solution 3: Fix Network Connectivity

If DocuSeal is in the same Docker network:

```yaml
# docker-compose.prod.yml
services:
  backend:
    environment:
      - DOCUSEAL_API_URL=http://docuseal:3000  # Internal Docker network
      - DOCUSEAL_BASE_URL=https://sign.creditxpress.com.my
    networks:
      - app_network
      - docuseal_network  # Add this

  docuseal:
    image: docuseal/docuseal
    networks:
      - docuseal_network

networks:
  app_network:
  docuseal_network:
```

## Testing After Fix

### 1. Test from Backend Container

```bash
docker compose -f docker-compose.prod.yml exec backend sh

# Test API connectivity
curl -H "X-Auth-Token: $DOCUSEAL_API_TOKEN" \
  $DOCUSEAL_API_URL/api/templates

# Should return list of templates
```

### 2. Test Signing Initiation

```bash
# Call the endpoint with a valid application ID
curl -X POST https://api.creditxpress.com.my/api/docuseal/initiate-application-signing \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"applicationId": "your-app-id"}'

# Response should include:
{
  "success": true,
  "data": {
    "submissionId": "123",
    "signUrl": "https://sign.creditxpress.com.my/s/abc123",
    "status": "pending"
  }
}
```

### 3. Verify Signing URL Works

Open the returned `signUrl` in a browser - it should show the DocuSeal signing interface, not a 404.

## Code-Level Debugging

### Enable Enhanced Logging

**Add to `backend/src/lib/docusealService.ts` around line 495:**

```typescript
console.log('🔍 DocuSeal Configuration Debug:', {
  apiUrl: this.config.apiUrl,
  baseUrl: this.config.baseUrl,
  submissionId,
  borrowerSubmitter: borrowerSubmitter ? {
    email: borrowerSubmitter.email,
    slug: borrowerSubmitter.slug,
    sign_url: borrowerSubmitter.sign_url,
    embed_src: borrowerSubmitter.embed_src
  } : 'NOT_FOUND',
  generatedSignUrl: signUrl
});
```

**Check logs after calling endpoint:**
```bash
docker compose -f docker-compose.prod.yml logs -f backend | grep "🔍 DocuSeal"
```

### Verify DocuSeal Response

The issue might also be that DocuSeal isn't returning the expected response format. Check:

```typescript
// backend/src/lib/docusealService.ts:497
console.log('DocuSeal submission response:', JSON.stringify(submission, null, 2));
```

Expected response should include:
```json
{
  "submitters": [
    {
      "email": "borrower@example.com",
      "role": "Borrower",
      "slug": "abc123",
      "sign_url": "https://sign.creditxpress.com.my/s/abc123",
      "status": "pending"
    }
  ]
}
```

## Mobile App Considerations

For mobile apps, ensure the signing URL:

1. **Uses HTTPS** (required for mobile WebView)
2. **Is publicly accessible** (not behind VPN/Tailscale unless mobile app has access)
3. **Has proper CORS headers** if using embedded signing
4. **Redirects properly** after signing completes

### Mobile-Friendly URL Configuration

```bash
# Use public domain, not internal IPs
DOCUSEAL_BASE_URL=https://sign.creditxpress.com.my  # ✅ Good
DOCUSEAL_BASE_URL=http://192.168.0.100:3001        # ❌ Won't work on mobile

# API URL can be internal if backend has access
DOCUSEAL_API_URL=http://docuseal:3000               # ✅ Internal Docker
```

## Quick Fix Checklist

- [ ] Verify both `DOCUSEAL_BASE_URL` and `DOCUSEAL_API_URL` are set correctly
- [ ] Ensure both URLs point to the same DocuSeal instance
- [ ] Test API connectivity from backend container
- [ ] Verify nginx/tunnel configuration if using on-prem
- [ ] Check DocuSeal is accessible at the base URL
- [ ] Test submission creation via API
- [ ] Verify signing URL accessibility
- [ ] Restart backend after environment changes
- [ ] Test full flow: initiate → get URL → open in browser

## Expected Flow After Fix

1. Mobile app calls `/api/docuseal/initiate-application-signing`
2. Backend creates submission via `DOCUSEAL_API_URL`
3. Backend returns signing URL using `DOCUSEAL_BASE_URL` + slug
4. Mobile app opens signing URL in WebView
5. User signs document
6. DocuSeal webhook notifies backend
7. Backend updates application status

## Need Help?

If the issue persists after following these steps:

1. Provide logs from:
   - `docker compose -f docker-compose.prod.yml logs backend | grep -i docuseal`
   - DocuSeal container logs
   - nginx error logs (if applicable)

2. Share environment variable values:
   - `DOCUSEAL_BASE_URL`
   - `DOCUSEAL_API_URL`
   - Network topology (Docker/on-prem/Tailscale)

3. Test output from verification steps above

