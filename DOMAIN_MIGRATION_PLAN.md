# Domain Migration Plan: kredit.my → creditxpress.com.my

## Overview
This document outlines the complete migration plan from `kredit.my` to `creditxpress.com.my` domain. The migration involves updating all domain references while maintaining the existing on-premises infrastructure.

## Architecture Summary
- **VPS Cloud Server**: IP 206.189.89.211, will move to new domain `creditxpress.com.my`
- **On-Premises Server**: Remains the same (IP: 100.76.8.62) but accessible via `sign.creditxpress.com.my`
- **Tailscale VPN**: New Tailscale network for secure communication

## Domain Mapping
| Current Domain | New Domain | Purpose |
|----------------|------------|---------|
| `kredit.my` | `creditxpress.com.my` | Main website (frontend) |
| `admin.kredit.my` | `admin.creditxpress.com.my` | Admin panel |
| `api.kredit.my` | `api.creditxpress.com.my` | API endpoints |
| `sign.kredit.my` | `sign.creditxpress.com.my` | Document signing (on-prem) |

## Files Requiring Changes

### 1. Nginx Configuration (`config/nginx.conf`)
**Changes Required:**
- Update all `server_name` directives
- Update SSL certificate paths (if using domain-specific certificates)
- Update CORS origin mappings for development

**Specific Updates:**
```nginx
# Line 20: Update server names
server_name creditxpress.com.my www.creditxpress.com.my admin.creditxpress.com.my api.creditxpress.com.my sign.creditxpress.com.my;

# Line 36: Main website server
server_name creditxpress.com.my www.creditxpress.com.my;

# Line 299: Admin subdomain
server_name admin.creditxpress.com.my;

# Line 573: API subdomain  
server_name api.creditxpress.com.my;

# Line 705: DocuSeal/Signing server
server_name sign.creditxpress.com.my;

# Lines 6, 14: Development CORS origins (if needed)
"https://dev.creditxpress.com.my"           "https://dev.creditxpress.com.my";
```

### 2. Backend Environment Variables
**Files to Update:**
- `backend/docker-compose.prod.yml`
- Backend `.env` files (production)

**Environment Variables to Change:**
```bash
# Current values that need updating:
FRONTEND_URL=https://creditxpress.com.my
ADMIN_BASE_URL=https://admin.creditxpress.com.my
CORS_ALLOWED_ORIGINS=https://creditxpress.com.my,https://admin.creditxpress.com.my
SIGNING_ORCHESTRATOR_URL=https://sign.creditxpress.com.my
DOCUSEAL_BASE_URL=https://sign.creditxpress.com.my
DOCUSEAL_API_URL=https://sign.creditxpress.com.my/api
CTOS_WEBHOOK_URL=https://api.creditxpress.com.my/api/ctos/webhook
```

### 3. Frontend Environment Variables
**Files to Update:**
- `frontend/.env.production` (if exists)
- Frontend deployment scripts

**Environment Variables:**
```bash
NEXT_PUBLIC_API_URL=https://api.creditxpress.com.my
```

### 4. Admin Environment Variables
**Files to Update:**
- `admin/.env.production` (if exists)
- Admin deployment scripts

**Environment Variables:**
```bash
NEXT_PUBLIC_API_URL=https://api.creditxpress.com.my
```

### 5. On-Premises Configuration Files
**Files to Update:**
- `on-prem/docuseal/env.production`
- `on-prem/docuseal/docuseal-production-domain.env`
- `on-prem/docuseal/DOMAIN_DEPLOYMENT_GUIDE.md`
- `on-prem/docuseal/DOCUSEAL_DEPLOYMENT_ENVIRONMENTS.md`
- `on-prem/signing-orchestrator/env.production`

**DocuSeal Environment Updates:**
```bash
DOCUSEAL_HOST=sign.creditxpress.com.my
DEFAULT_URL_HOST=sign.creditxpress.com.my
SMTP_DOMAIN=creditxpress.com.my
SMTP_FROM=noreply@creditxpress.com.my
WEBHOOK_URL=https://api.creditxpress.com.my/api/docuseal/webhook
```

**Signing Orchestrator Updates:**
```bash
DOCUSEAL_BASE_URL=http://100.76.8.62:3001
DOCUSEAL_API_URL=http://100.76.8.62:3001/api
# Note: These remain internal IPs since orchestrator communicates directly with DocuSeal container
```

### 6. Backend Source Code Files
**Files with hardcoded domain references:**
- `backend/src/lib/docusealService.ts`
- `backend/src/api/admin.ts`
- `backend/src/api/loans.ts`
- `backend/src/api/pki.ts`
- `backend/src/api/docuseal.ts`
- `backend/src/api/admin/mtsa.ts`
- `backend/src/api/loan-applications.ts`
- `backend/src/api/mtsa.ts`
- `backend/swagger/swagger.json`
- `backend/prisma/seed.ts`

**Search and Replace Required:**
- Replace `kredit.my` with `creditxpress.com.my`
- Replace `sign.kredit.my` with `sign.creditxpress.com.my`
- Replace `api.kredit.my` with `api.creditxpress.com.my`
- Replace `admin.kredit.my` with `admin.creditxpress.com.my`

### 7. Frontend Source Code Files
**Files with domain references:**
- `frontend/app/receipt/[receiptId]/page.tsx`
- `frontend/app/page.tsx`
- `frontend/app/sme-term-loan/page.tsx`
- `frontend/app/personal-loan/page.tsx`
- `frontend/app/layout.tsx`
- `frontend/app/about/page.tsx`
- `frontend/public/pki-overlay.js`

### 8. Admin Source Code Files
**Files with domain references:**
- `admin/app/dashboard/payments/page.tsx`
- `admin/app/pki-signing/page.tsx`
- `admin/ecosystem.config.js`

### 9. Documentation Files
**Files to Update:**
- `README.md`
- `Agents.md`
- `DOCUSEAL_MTSA_PKI_INTEGRATION_PLAN.md`
- `on-prem/README.md`
- All documentation in `on-prem/docuseal/`
- All documentation in `on-prem/signing-orchestrator/`
- `backend/docs/DOCUSEAL_ENVIRONMENT_CONFIG.md`
- `backend/docs/CRON_MIGRATION.md`

### 10. Deployment Scripts
**Files to Update:**
- `scripts/deploy.sh`
- `scripts/deploy-nginx-only.sh`
- `scripts/update-ssl-certificate.sh`
- `scripts/fix-admin-deployment.sh`
- `scripts/fix-port-issues.sh`
- `on-prem/scripts/deploy-all.sh`
- `deploy-pki-dev.sh`

## SSL Certificate Requirements

### New Certificates Needed:
1. **Main Certificate**: `creditxpress.com.my`
   - SAN: `www.creditxpress.com.my`, `admin.creditxpress.com.my`, `api.creditxpress.com.my`
2. **Signing Certificate**: `sign.creditxpress.com.my` (for on-prem server)

### Certificate Paths to Update:
```nginx
ssl_certificate /etc/letsencrypt/live/creditxpress.com.my/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/creditxpress.com.my/privkey.pem;
ssl_trusted_certificate /etc/letsencrypt/live/creditxpress.com.my/chain.pem;
```

## Tailscale Configuration

### New Tailscale Setup:
1. Create new Tailscale account/network for `creditxpress.com.my`
2. Install Tailscale on both VPS and on-prem servers
3. Configure new IP addresses (current: `100.76.8.62`)
4. Update nginx.conf with new Tailscale IP if it changes

### Files to Update if Tailscale IP Changes:
- `config/nginx.conf` (lines 192, 423, 736, 751, 766, 781, etc.)
- `on-prem/scripts/deploy-all.sh`
- `README.md`
- `on-prem/README.md`

## Migration Steps (High Level)

### Phase 1: Preparation
1. **Backup Current System**
   - Database backup
   - Configuration files backup
   - SSL certificates backup

2. **DNS Setup**
   - Configure DNS for new domain
   - Set up subdomains (admin, api, sign)

3. **SSL Certificates**
   - Obtain new SSL certificates
   - Test certificate installation

### Phase 2: Configuration Updates
1. **Update Environment Variables**
   - Backend production environment
   - Frontend production environment
   - Admin production environment
   - On-prem environment files

2. **Update Source Code**
   - Search and replace domain references
   - Update hardcoded URLs
   - Update documentation

3. **Update Nginx Configuration**
   - Server names
   - SSL certificate paths
   - CORS origins

### Phase 3: Infrastructure Setup
1. **Tailscale Configuration**
   - Set up new Tailscale network
   - Configure both servers
   - Update IP references if needed

2. **On-Prem Server Updates**
   - Update DocuSeal configuration
   - Update Signing Orchestrator configuration
   - Test internal connectivity

### Phase 4: Deployment
1. **Deploy Updated Configuration**
   - Deploy nginx configuration
   - Deploy backend with new environment
   - Deploy frontend with new environment
   - Deploy admin with new environment

2. **Test All Services**
   - Website accessibility
   - API functionality
   - Admin panel access
   - Document signing workflow
   - On-prem connectivity

### Phase 5: Verification
1. **End-to-End Testing**
   - User registration/login
   - Loan application process
   - Document signing
   - Payment processing
   - Admin functions

2. **Monitoring Setup**
   - SSL certificate monitoring
   - Service health checks
   - Log monitoring

## Risk Mitigation

### Rollback Plan:
1. Keep old domain configuration files
2. Maintain old SSL certificates temporarily
3. DNS TTL set to low values during migration
4. Database rollback scripts ready

### Testing Strategy:
1. **Staging Environment**: Test all changes in staging first
2. **Gradual Migration**: Migrate services one by one
3. **Health Checks**: Automated monitoring during migration
4. **User Communication**: Notify users of potential downtime

## Post-Migration Tasks

1. **Update External Services**
   - WhatsApp webhook URLs
   - CTOS webhook URLs
   - Email templates with new domain
   - Third-party integrations

2. **SEO Considerations**
   - Set up 301 redirects from old domain (if needed)
   - Update sitemap
   - Update social media links

3. **Monitoring**
   - Set up alerts for new domain
   - Monitor SSL certificate expiry
   - Monitor service health

## Estimated Timeline

- **Preparation**: 1-2 days
- **Configuration Updates**: 1 day
- **Infrastructure Setup**: 1 day
- **Deployment**: 4-6 hours
- **Testing & Verification**: 1 day
- **Total**: 4-5 days

## Notes

1. **No IP Address Changes**: The on-prem server IP (100.76.8.62) remains the same, only domain access changes
2. **Tailscale IP**: May or may not change depending on new Tailscale setup
3. **Database**: No database changes required
4. **User Data**: No user data migration needed
5. **Minimal Downtime**: Most changes can be prepared offline, with only final deployment causing brief downtime

## Critical Success Factors

1. **Thorough Testing**: Test every component before production deployment
2. **Backup Strategy**: Ensure all backups are current and tested
3. **Communication**: Clear communication with users about any downtime
4. **Monitoring**: Real-time monitoring during migration
5. **Rollback Readiness**: Be prepared to rollback quickly if issues arise
