# SSL Certificate Audit Guide

## Quick Start

```bash
cd /Users/ivan/Documents/creditxpress
bash scripts/audit-ssl-certs.sh
```

---

## What This Script Does

The SSL certificate audit script helps you:

1. ✅ **Check domain certificates** - Verify SSL certs for all public domains
2. ✅ **Audit server certificates** - List all certs on VPS and On-Prem servers
3. ✅ **Download certificates** - Retrieve specific certs for inspection
4. ✅ **Check expiry dates** - Get warnings for expiring certificates
5. ✅ **Verify TLS configuration** - Check SSL/TLS protocol support
6. ✅ **Generate audit reports** - Create timestamped documentation

---

## Usage

### Option 1: Check All Public Domains

Checks SSL certificates for:
- `creditxpress.com.my` (main site)
- `www.creditxpress.com.my` (www subdomain)
- `admin.creditxpress.com.my` (admin panel)
- `sign.creditxpress.com.my` (document signing)

```bash
bash scripts/audit-ssl-certs.sh
# Choose option 1
```

**Shows:**
- Certificate subject and issuer
- Valid from/to dates
- Days until expiration
- Subject Alternative Names (SAN)
- SHA256 fingerprint
- TLS version support
- Current cipher suite

**Downloads certificates to:** `ssl_certs_YYYYMMDD_HHMMSS/`

---

### Option 2: Audit VPS Server Certificates

Lists all SSL certificates found on the VPS:

```bash
bash scripts/audit-ssl-certs.sh
# Choose option 2
```

**Searches:**
- Let's Encrypt certificates (`/etc/letsencrypt/live/`)
- Nginx SSL certificates (`/etc/nginx/ssl/`)
- System certificates (`/etc/ssl/certs/`)
- Nginx SSL configuration

---

### Option 3: Audit On-Prem Server Certificates

Lists all SSL certificates on On-Prem server:

```bash
bash scripts/audit-ssl-certs.sh
# Choose option 3
```

**Searches:**
- Let's Encrypt certificates
- Nginx SSL certificates (for DocuSeal proxy)
- DocuSeal-specific certificates
- Nginx SSL configuration

---

### Option 4: Download Specific Certificate

Download a specific certificate from either server:

```bash
bash scripts/audit-ssl-certs.sh
# Choose option 4
# Select server (VPS or On-Prem)
# Enter certificate path
```

**Example paths:**
- `/etc/letsencrypt/live/creditxpress.com.my/fullchain.pem`
- `/etc/nginx/ssl/creditxpress.com.my.crt`
- `/etc/ssl/certs/ca-certificates.crt`

---

### Option 5: Complete Audit

Runs all checks:
- All public domains
- VPS server certificates
- On-Prem server certificates

```bash
bash scripts/audit-ssl-certs.sh
# Choose option 5
```

---

## Output Files

### Certificate Files
- **Location:** `ssl_certs_YYYYMMDD_HHMMSS/`
- **Format:** `.crt` files (PEM format)
- **Purpose:** For inspection, backup, or compliance

**View certificate details:**
```bash
openssl x509 -in ssl_certs_*/creditxpress.com.my.crt -text -noout
```

### Audit Report
- **Location:** `ssl_cert_audit_YYYYMMDD_HHMMSS.txt`
- **Contains:** Complete audit results with all findings
- **Purpose:** Documentation, compliance, review

---

## Common Certificate Locations

### VPS Server

**Let's Encrypt (Certbot):**
```
/etc/letsencrypt/live/[domain]/
├── fullchain.pem    # Certificate + chain
├── cert.pem         # Certificate only
├── chain.pem        # Chain only
└── privkey.pem      # Private key (DO NOT SHARE!)

Example:
/etc/letsencrypt/live/creditxpress.com.my/
/etc/letsencrypt/live/admin.creditxpress.com.my/
```

**Nginx:**
```
/etc/nginx/ssl/
├── [domain].crt     # Certificate
└── [domain].key     # Private key (DO NOT SHARE!)

Example:
/etc/nginx/ssl/creditxpress.com.my.crt
```

### On-Prem Server

**DocuSeal/Nginx:**
```
/etc/nginx/ssl/
├── sign.creditxpress.com.my.crt
└── sign.creditxpress.com.my.key
```

**Let's Encrypt:**
```
/etc/letsencrypt/live/sign.creditxpress.com.my/
```

---

## Understanding Certificate Information

### Subject
Who the certificate is issued to:
```
CN=creditxpress.com.my, O=CreditXpress Sdn Bhd, L=Kuala Lumpur, C=MY
```

### Issuer
Who issued the certificate:
```
CN=Let's Encrypt Authority X3, O=Let's Encrypt, C=US
```

### Validity Period
```
Valid From: Oct 1 00:00:00 2024 GMT
Valid To:   Dec 30 23:59:59 2024 GMT
```

### Subject Alternative Names (SAN)
Other domains covered by this certificate:
```
DNS:creditxpress.com.my, DNS:www.creditxpress.com.my
```

### Fingerprint
Unique identifier for the certificate:
```
SHA256: A1:B2:C3:D4:E5:F6:...
```

---

## Expiry Warnings

The script will warn you:

| Days Remaining | Status | Action |
|----------------|--------|--------|
| < 0 | 🔴 **EXPIRED** | Renew immediately! |
| < 30 | 🔴 **EXPIRES SOON** | Schedule renewal |
| < 60 | 🟡 **Expiring** | Plan renewal |
| > 60 | 🟢 **Valid** | No action needed |

---

## Common Tasks

### 1. Monthly Certificate Check
```bash
cd /Users/ivan/Documents/creditxpress
bash scripts/audit-ssl-certs.sh
# Choose option 1 (check domains)
```

### 2. Pre-Renewal Verification
```bash
# Check current certificate
bash scripts/audit-ssl-certs.sh  # Option 1

# After renewal, verify new certificate
bash scripts/audit-ssl-certs.sh  # Option 1 again
```

### 3. Download Certificate for Compliance
```bash
bash scripts/audit-ssl-certs.sh
# Choose option 4
# Select server and enter path
```

### 4. Verify TLS Configuration
```bash
bash scripts/audit-ssl-certs.sh
# Choose option 1
# Check "SSL/TLS Configuration" section in output
```

### 5. Get Certificate Fingerprint
```bash
# Run audit first
bash scripts/audit-ssl-certs.sh

# Or manually
openssl x509 -in ssl_certs_*/creditxpress.com.my.crt -noout -fingerprint -sha256
```

---

## Manual Certificate Commands

### View Certificate from File
```bash
openssl x509 -in certificate.crt -text -noout
```

### Check Certificate Expiry
```bash
openssl x509 -in certificate.crt -noout -enddate
```

### Get Certificate Fingerprint
```bash
openssl x509 -in certificate.crt -noout -fingerprint -sha256
```

### View Certificate from Remote Server
```bash
echo | openssl s_client -servername creditxpress.com.my -connect creditxpress.com.my:443 2>/dev/null | openssl x509 -noout -text
```

### Check Certificate Chain
```bash
openssl s_client -showcerts -servername creditxpress.com.my -connect creditxpress.com.my:443 < /dev/null
```

### Verify Certificate Against Private Key
```bash
# Get public key from cert
openssl x509 -in certificate.crt -noout -modulus | openssl md5

# Get public key from private key (should match!)
openssl rsa -in privatekey.key -noout -modulus | openssl md5
```

---

## Certificate Renewal

### Let's Encrypt (Certbot)

**Check when certificates will renew:**
```bash
ssh root@100.85.61.82
sudo certbot certificates
```

**Manual renewal:**
```bash
ssh root@100.85.61.82
sudo certbot renew
```

**Test renewal without actually renewing:**
```bash
ssh root@100.85.61.82
sudo certbot renew --dry-run
```

**Renew specific domain:**
```bash
ssh root@100.85.61.82
sudo certbot renew --cert-name creditxpress.com.my
```

### After Renewal

**Reload Nginx:**
```bash
ssh root@100.85.61.82
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

**Verify new certificate:**
```bash
bash scripts/audit-ssl-certs.sh  # Option 1
```

---

## Troubleshooting

### Certificate Expired
```bash
# Check certificate dates
bash scripts/audit-ssl-certs.sh

# Renew Let's Encrypt certificate
ssh root@100.85.61.82
sudo certbot renew --force-renewal --cert-name [domain]
sudo systemctl reload nginx
```

### Certificate Not Trusted
```bash
# Download and inspect certificate chain
bash scripts/audit-ssl-certs.sh  # Option 4
openssl x509 -in downloaded_cert.crt -text -noout

# Check if intermediate certificates are included
openssl s_client -showcerts -connect creditxpress.com.my:443 < /dev/null | grep -c "BEGIN CERTIFICATE"
# Should be 2 or more (server cert + intermediates)
```

### Wrong Certificate Served
```bash
# Check SNI (Server Name Indication)
openssl s_client -servername creditxpress.com.my -connect creditxpress.com.my:443 < /dev/null | openssl x509 -noout -subject

# Check nginx configuration
ssh root@100.85.61.82
sudo grep -r "ssl_certificate" /etc/nginx/sites-enabled/
```

### Certificate Mismatch Error
```bash
# Verify certificate matches private key
ssh root@100.85.61.82
sudo openssl x509 -in /etc/letsencrypt/live/creditxpress.com.my/cert.pem -noout -modulus | openssl md5
sudo openssl rsa -in /etc/letsencrypt/live/creditxpress.com.my/privkey.pem -noout -modulus | openssl md5
# MD5 hashes should match
```

---

## Security Best Practices

### DO:
- ✅ Run monthly certificate audits
- ✅ Set up automatic Let's Encrypt renewal
- ✅ Monitor expiry dates (renew 30 days before)
- ✅ Use strong TLS protocols (1.2+)
- ✅ Keep private keys secure
- ✅ Archive old certificates for compliance
- ✅ Document certificate changes

### DON'T:
- ❌ Share private keys (.key files)
- ❌ Commit certificates to git
- ❌ Let certificates expire
- ❌ Use self-signed certs in production
- ❌ Use weak ciphers or protocols
- ❌ Forget to reload services after renewal

---

## Compliance & Audit

### Creating Shareable Audit Reports

When you need to share audit reports with external auditors or compliance officers, use the redaction tool to create a safe, shareable version:

#### Option 1: Automatic Redaction (Recommended)

```bash
# 1. Generate the audit first
bash scripts/audit-ssl-certs.sh
# Choose option 1 (public domains) or option 5 (complete audit)

# 2. Create shareable version
bash scripts/redact-audit-report.sh
# Select the audit file to redact
# Review the output
```

**What gets redacted automatically:**
- ❌ Internal IP addresses (Tailscale IPs like 100.x.x.x)
- ❌ Server paths (`/etc/...`, `/opt/...`, `/var/...`)
- ❌ Usernames (root, admin-kapital)
- ❌ SSH public keys
- ❌ Email addresses

**What is preserved:**
- ✅ Certificate subjects and issuers
- ✅ Validity dates and expiry warnings
- ✅ TLS protocol support
- ✅ Certificate fingerprints
- ✅ Cipher information
- ✅ Security compliance status

#### Option 2: Manual Redaction

If you need more control:

```bash
# Generate audit
bash scripts/audit-ssl-certs.sh  # Option 1

# Create copy for manual editing
cp ssl_cert_audit_*.txt ssl_cert_audit_SHAREABLE.txt

# Edit to remove sensitive info
nano ssl_cert_audit_SHAREABLE.txt
```

**Manual redaction checklist:**
- [ ] Replace Tailscale IPs with `[INTERNAL_IP]`
- [ ] Remove server paths or replace with `[SERVER_PATH]`
- [ ] Replace usernames with `[USER]`
- [ ] Ensure no SSH keys are present
- [ ] Remove email addresses
- [ ] Keep all certificate details intact

### Full vs Shareable Versions

#### Full Version (Internal Use Only)
**Filename:** `ssl_cert_audit_YYYYMMDD_HHMMSS.txt`

**Contains:**
- Complete server paths
- Internal IP addresses
- Usernames
- Detailed nginx configuration
- System information
- All certificate locations

**Use for:**
- Internal documentation
- Troubleshooting
- System administration
- Historical records

**Storage:** `docs/ssl-audits/` (not in git)

#### Shareable Version (External Use)
**Filename:** `ssl_cert_audit_YYYYMMDD_HHMMSS_SHAREABLE.txt`

**Contains:**
- Certificate public information
- Validity periods
- TLS configuration (without paths)
- Expiry warnings
- Compliance status
- Redaction notice header

**Use for:**
- External auditors
- Compliance reports
- Third-party reviews
- Stakeholder reports

**Storage:** Can be shared securely via encrypted channels

### Example Comparison

**Full Version (Internal):**
```
Server: VPS (root@100.85.61.82)
Certificate: /etc/letsencrypt/live/creditxpress.com.my/fullchain.pem
Subject: CN=creditxpress.com.my
Issuer: Let's Encrypt
Valid: 2024-10-01 to 2024-12-30 (69 days remaining)
TLS 1.2: ✓ supported
```

**Shareable Version (External):**
```
Certificate: creditxpress.com.my
Subject: CN=creditxpress.com.my
Issuer: Let's Encrypt
Valid: 2024-10-01 to 2024-12-30 (69 days remaining)
TLS 1.2: ✓ supported
```

### What to Archive

```bash
# After running audit
mkdir -p docs/ssl-audits/

# Archive full version (internal)
mv ssl_cert_audit_*.txt docs/ssl-audits/
mv ssl_certs_* docs/ssl-audits/

# If you created a shareable version
mv ssl_cert_audit_*_SHAREABLE.txt docs/ssl-audits/
```

### Information Safe to Share

The **public SSL certificate information** is already publicly accessible, so it's safe to share:

✅ **Safe to Share:**
- Certificate subjects (CN, O, L, C)
- Issuer information
- Validity dates (start/end)
- Expiry warnings
- Subject Alternative Names (SAN)
- Certificate fingerprints (SHA256)
- TLS protocol versions supported
- Cipher suites
- Certificate serial numbers
- Public certificates themselves (.crt files)

❌ **Never Share:**
- Private keys (.key files, privkey.pem)
- Internal server IP addresses
- Server paths and directory structures
- System usernames
- SSH keys
- Internal network topology

🔒 **For More Details:**
See `docs/AUDIT_SHARING_GUIDELINES.md` for comprehensive information about what to share and redact.

### Regular Audit Schedule
- **Monthly:** Run certificate audit (option 1)
- **Before Renewal:** Check current cert details
- **After Renewal:** Verify new cert installed  
- **Quarterly:** Review all certificates, create shareable report for compliance
- **Audit Requests:** Use redaction tool to create shareable version

---

## Quick Reference Commands

```bash
# === GENERATE AUDITS ===

# Run full audit (internal use)
bash scripts/audit-ssl-certs.sh  # Option 5

# Check public domains only (suitable for external sharing)
bash scripts/audit-ssl-certs.sh  # Option 1

# === CREATE SHAREABLE VERSION ===

# Automatic redaction (recommended)
bash scripts/redact-audit-report.sh

# Manual redaction
cp ssl_cert_audit_*.txt ssl_cert_audit_SHAREABLE.txt
nano ssl_cert_audit_SHAREABLE.txt  # Remove sensitive info

# === CERTIFICATE CHECKS ===

# Check specific domain
echo | openssl s_client -servername creditxpress.com.my -connect creditxpress.com.my:443 2>/dev/null | openssl x509 -noout -dates

# List Let's Encrypt certs on VPS
ssh root@100.85.61.82 'sudo certbot certificates'

# Check nginx SSL config
ssh root@100.85.61.82 'sudo grep -r "ssl_certificate" /etc/nginx/sites-enabled/'

# === CERTIFICATE MANAGEMENT ===

# Renew all Let's Encrypt certs
ssh root@100.85.61.82 'sudo certbot renew && sudo systemctl reload nginx'

# Download specific certificate
bash scripts/audit-ssl-certs.sh  # Option 4

# === ARCHIVING ===

# Archive full audit (internal)
mkdir -p docs/ssl-audits/
mv ssl_cert_audit_*.txt docs/ssl-audits/

# Archive shareable version (external)
mv ssl_cert_audit_*_SHAREABLE.txt docs/ssl-audits/
```

---

## Common Workflows

### Workflow 1: Monthly Internal Audit
```bash
# 1. Generate full audit
cd /Users/ivan/Documents/creditxpress
bash scripts/audit-ssl-certs.sh  # Option 5

# 2. Review the report
cat ssl_cert_audit_*.txt

# 3. Check for expiring certificates (< 30 days)
grep -i "expires\|expiring\|expired" ssl_cert_audit_*.txt

# 4. Archive the report
mkdir -p docs/ssl-audits/
mv ssl_cert_audit_*.txt docs/ssl-audits/
mv ssl_certs_* docs/ssl-audits/
```

### Workflow 2: External Compliance Request
```bash
# 1. Generate audit (public domains only for cleaner output)
bash scripts/audit-ssl-certs.sh  # Option 1

# 2. Create shareable version
bash scripts/redact-audit-report.sh
# Select the audit file
# Review the redacted output

# 3. Manually verify (optional)
cat ssl_cert_audit_*_SHAREABLE.txt
# Check no internal IPs or paths are visible

# 4. Share securely
# Send via encrypted email or secure file transfer
```

### Workflow 3: Pre-Renewal Verification
```bash
# 1. Check current certificates
bash scripts/audit-ssl-certs.sh  # Option 1

# 2. Note expiry dates
grep "Valid To" ssl_cert_audit_*.txt

# 3. Renew certificates
ssh root@100.85.61.82 'sudo certbot renew'

# 4. Verify renewal
bash scripts/audit-ssl-certs.sh  # Option 1
# Compare new expiry dates
```

### Workflow 4: Incident Response - Certificate Compromise
```bash
# 1. Generate immediate audit
bash scripts/audit-ssl-certs.sh  # Option 5

# 2. Check what certificates exist
ssh root@100.85.61.82 'sudo certbot certificates'

# 3. Revoke compromised certificate
ssh root@100.85.61.82 'sudo certbot revoke --cert-name creditxpress.com.my'

# 4. Request new certificate
ssh root@100.85.61.82 'sudo certbot certonly --nginx -d creditxpress.com.my -d www.creditxpress.com.my'

# 5. Verify new certificate
bash scripts/audit-ssl-certs.sh  # Option 1

# 6. Document incident
echo "$(date): Certificate compromised and renewed - details..." >> docs/ssl_cert_incident_log.txt
```

---

## Support

- **Script issues?** Check the audit report for error messages
- **Certificate problems?** See Troubleshooting section above
- **Renewal issues?** Check Certbot logs: `ssh root@100.85.61.82 'sudo tail -100 /var/log/letsencrypt/letsencrypt.log'`
- **Sharing guidance?** See `docs/AUDIT_SHARING_GUIDELINES.md`

---

## Related Documentation

- **Audit Sharing Guidelines:** `docs/AUDIT_SHARING_GUIDELINES.md` - Complete guide on what to share/redact
- **Redaction Tool:** `scripts/redact-audit-report.sh` - Automatic report redaction
- **SSH Access Management:** `SSH_MANAGEMENT_INDEX.md` - Related security management

---

**Last Updated:** October 2025  
**Script Version:** 1.0  
**Maintained By:** System Administrator

