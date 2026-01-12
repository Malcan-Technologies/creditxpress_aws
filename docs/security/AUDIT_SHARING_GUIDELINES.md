# Audit Document Sharing Guidelines

## Overview
This guide explains what information is safe to share from audit reports and what should be kept confidential.

---

## SSL Certificate Audit Reports

### ✅ SAFE TO SHARE

The following information from SSL certificate audits is **safe to share** with auditors, compliance officers, or security assessors:

#### Public Information
- ✅ **Certificate details** (subject, issuer, dates)
- ✅ **Expiry dates and validity periods**
- ✅ **Certificate fingerprints (SHA256)**
- ✅ **Public certificates themselves** (.crt files)
- ✅ **Subject Alternative Names (SAN)**
- ✅ **Certificate serial numbers**
- ✅ **TLS protocol versions supported**
- ✅ **Cipher suites in use**
- ✅ **Certificate chain information**

**Why it's safe:** All this information is publicly accessible via browser inspection or tools like SSL Labs. Anyone can query your public HTTPS endpoints and retrieve this information.

#### Examples of Safe Content
```
Domain: kredit.my
Subject: CN=kredit.my, O=Kredit Express
Issuer: CN=Let's Encrypt Authority X3
Valid From: Oct 1 00:00:00 2024 GMT
Valid To: Dec 30 23:59:59 2024 GMT
Fingerprint: A1:B2:C3:D4:E5:F6:...
TLS 1.2: ✓ supported
TLS 1.3: ✓ supported
```

---

### ⚠️ REVIEW BEFORE SHARING

The following information should be **reviewed and potentially redacted** before sharing:

#### Internal Server Information
- ⚠️ **Internal server paths** (e.g., `/etc/letsencrypt/live/`)
- ⚠️ **Server usernames** (root, admin-kapital)
- ⚠️ **Internal IP addresses** (Tailscale IPs: 100.85.61.82, 100.76.8.62)
- ⚠️ **Nginx configuration details**
- ⚠️ **Server hostnames**
- ⚠️ **Operating system details**

**Why review:** These details reveal your internal infrastructure layout. While not directly exploitable, they could help an attacker understand your architecture.

**What to do:**
- Redact internal IPs
- Remove server paths
- Generalize server information

---

### 🔴 NEVER SHARE

The following must **NEVER be shared** under any circumstances:

#### Private Keys
- 🔴 **Private keys** (`.key` files or `privkey.pem`)
- 🔴 **Private key content or modulus**
- 🔴 **Any file containing "PRIVATE KEY"**

**Why:** Private keys are the secret half of SSL/TLS encryption. Sharing them completely compromises your security. Anyone with your private key can impersonate your servers.

**What to check:**
```bash
# NEVER share files with these names:
- privkey.pem
- *.key
- private.pem
- server.key
```

**The audit script does NOT download or include private keys** - it only retrieves public certificates.

---

## SSH Access Audit Reports

### ✅ SAFE TO SHARE (Redacted)

The following information from SSH audits can be shared **after redaction**:

#### Safe After Redaction
- ✅ Total number of authorized keys
- ✅ SSH configuration settings (with server IPs redacted)
- ✅ Security best practices compliance
- ✅ Backup procedures
- ✅ General security posture

#### Example of Properly Redacted Content
```
✓ Total authorized keys: 5
✓ Public key authentication: Enabled
✓ Password authentication: Disabled
✓ Root login: Restricted
✓ Automatic backups: Enabled
✓ Last audit: 2024-10-22
```

---

### ⚠️ REVIEW CAREFULLY

The following should be **heavily reviewed and likely redacted**:

#### Sensitive Internal Information
- ⚠️ **Specific SSH public keys**
- ⚠️ **Email addresses in key comments**
- ⚠️ **Server IP addresses**
- ⚠️ **Usernames**
- ⚠️ **Login history with IPs**
- ⚠️ **Failed login attempts** (reveals attack patterns)
- ⚠️ **Server hostnames**

**Why:** This information reveals who has access, from where, and the details of your infrastructure.

**What to do:**
- Replace real IPs with "XXX.XXX.XXX.XXX"
- Replace usernames with "user1", "user2"
- Replace emails with "user@[REDACTED]"
- Summarize instead of listing details

---

### 🔴 NEVER SHARE

#### Never Share These
- 🔴 **SSH private keys**
- 🔴 **Complete public keys** (can be used to track individuals)
- 🔴 **Specific Tailscale IP addresses**
- 🔴 **Complete login histories with IPs**
- 🔴 **Server credentials**

---

## How to Create Shareable Audit Reports

### For SSL Certificate Audits

**Step 1: Generate the audit**
```bash
bash scripts/audit-ssl-certs.sh
# Choose option 1 (public domains only)
```

**Step 2: Review the report**
```bash
cat ssl_cert_audit_*.txt
```

**Step 3: Create shareable version**
```bash
# Copy the report
cp ssl_cert_audit_*.txt ssl_cert_audit_SHAREABLE.txt

# Edit to remove internal details
nano ssl_cert_audit_SHAREABLE.txt
```

**What to remove/redact:**
- Internal IP addresses → Replace with "[INTERNAL]"
- Server paths → Remove or replace with "[SERVER_PATH]"
- Specific server names → Replace with "VPS" or "On-Prem"

**Step 4: What to keep**
- Certificate subjects and issuers
- Validity dates
- Expiry warnings
- TLS protocol support
- Cipher information
- Certificate fingerprints

---

### For SSH Access Audits

**Step 1: Generate summary instead of full audit**
```bash
# Instead of full audit, create a summary
cat > ssh_audit_summary.txt << 'EOF'
SSH Access Audit Summary
Date: $(date)

Total authorized users: [NUMBER]
Authentication method: Public key only
Password authentication: Disabled
Two-factor authentication: [STATUS]
Failed login monitoring: Enabled
Automatic backups: Enabled
Last access review: [DATE]

Compliance: ✓ All best practices followed
EOF
```

**Never include:**
- Actual SSH keys
- User emails or identifying info
- IP addresses
- Login timestamps
- Server hostnames

---

## Redaction Examples

### Example 1: SSL Certificate (Safe to Share)

**Original:**
```
Server: VPS (root@100.85.61.82)
Certificate: /etc/letsencrypt/live/kredit.my/fullchain.pem
Subject: CN=kredit.my, O=Kredit Express
Issuer: CN=Let's Encrypt Authority X3
Valid From: Oct 1 00:00:00 2024 GMT
Valid To: Dec 30 23:59:59 2024 GMT
Days remaining: 69 days
TLS 1.2: ✓ supported
```

**Redacted (Shareable):**
```
Certificate: kredit.my
Subject: CN=kredit.my, O=Kredit Express
Issuer: CN=Let's Encrypt Authority X3
Valid From: Oct 1 00:00:00 2024 GMT
Valid To: Dec 30 23:59:59 2024 GMT
Days remaining: 69 days
TLS 1.2: ✓ supported
```

---

### Example 2: SSH Audit (Requires Heavy Redaction)

**Original (DO NOT SHARE):**
```
Server: root@100.85.61.82
Total keys: 5

Key #1:
  Type: ssh-ed25519
  Comment: john.doe@company.com
  Fingerprint: SHA256:abc123...

Recent logins:
john.doe   pts/0    100.101.102.103  Mon Oct 21 14:32
```

**Redacted (Shareable):**
```
SSH Access Summary:
Total authorized users: 5
Authentication: Public key only
Key types: ED25519 (recommended)
Last access review: Oct 2024
Compliance: ✓ Passed
```

---

## When External Auditors Need Details

### What Auditors Typically Need

**For SSL Certificates:**
1. Certificate validity periods
2. Certificate chain verification
3. TLS protocol versions
4. Cipher suite strength
5. Certificate authority information
6. Expiry monitoring procedures

**You can provide:**
- Screenshots of SSL Labs tests (sslabs.com)
- Redacted audit reports
- Public certificate files (.crt)
- Policy documents

**Do NOT provide:**
- Private keys
- Internal server details
- Server access credentials

---

### What Auditors Should NOT Need

If an auditor asks for these, **question why**:
- 🚫 Private SSL keys
- 🚫 SSH private keys  
- 🚫 Complete SSH public keys
- 🚫 Server passwords or credentials
- 🚫 Internal network topology
- 🚫 Unredacted server logs

**Instead offer:**
- To run specific tests they request
- To provide redacted reports
- To demonstrate compliance via screenshare
- To provide policy documentation

---

## Creating a Compliance Package

### What to Include

**1. Certificate Inventory (Safe)**
```
Domain: kredit.my
Type: Let's Encrypt (DV)
Valid: Oct 1 2024 - Dec 30 2024
TLS: 1.2, 1.3
Auto-renewal: ✓ Enabled
```

**2. Security Policies (Safe)**
- Certificate renewal procedures
- Expiry monitoring process
- Incident response plan
- Access control policies

**3. Evidence (Redacted)**
- SSL Labs test results (A+ rating)
- Certificate validity checks
- Renewal logs (dates only)
- Audit schedule compliance

---

## Quick Checklist

Before sharing any audit document, check:

- [ ] Private keys removed/not included
- [ ] Internal IP addresses redacted
- [ ] Server paths removed or generalized
- [ ] User emails/names redacted
- [ ] SSH keys removed (if SSH audit)
- [ ] Login IPs removed
- [ ] Public certificate info intact
- [ ] TLS/security config info intact
- [ ] Expiry dates included
- [ ] Compliance status clear

---

## Summary

### SSL Certificate Audits

| Information | Shareable? | Notes |
|-------------|------------|-------|
| Public certificates (.crt) | ✅ Yes | Publicly accessible anyway |
| Certificate details | ✅ Yes | Subject, issuer, dates, fingerprints |
| Expiry dates | ✅ Yes | Important for compliance |
| TLS configuration | ✅ Yes | Can be tested publicly |
| Private keys | 🔴 NEVER | Compromises security |
| Server paths | ⚠️ Redact | Remove internal details |
| Internal IPs | ⚠️ Redact | Use [INTERNAL] placeholder |

### SSH Access Audits

| Information | Shareable? | Notes |
|-------------|------------|-------|
| Total key count | ✅ Yes | General metric |
| Authentication method | ✅ Yes | Policy information |
| Actual SSH keys | 🔴 NEVER | Can track individuals |
| User emails | 🔴 NEVER | Privacy concern |
| Login IPs | 🔴 NEVER | Security risk |
| Server IPs | 🔴 NEVER | Infrastructure detail |
| Summary statistics | ✅ Yes (redacted) | High-level overview |

---

## Tools for Redaction

### Automated Redaction Script

```bash
# Create redacted version of SSL audit
sed -E 's/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[REDACTED_IP]/g' \
    ssl_cert_audit_*.txt | \
sed -E 's/\/etc\/[^ ]*/[SERVER_PATH]/g' | \
sed -E 's/(root|admin-kapital)@/[USER]@/g' \
    > ssl_cert_audit_REDACTED.txt
```

### Manual Review

Always manually review after automated redaction:
```bash
nano ssl_cert_audit_REDACTED.txt
# Check for any missed sensitive information
```

---

## Questions to Ask

**Before sharing with auditors:**
1. What specific information do they need?
2. Why do they need it?
3. How will it be stored and protected?
4. Who else will have access?
5. Will it be included in any reports?

**Red flags:**
- Requests for private keys
- Requests for complete unredacted logs
- Requests for credentials
- Vague reasons for needing data

---

## Best Practices

1. **Default to redaction** - When in doubt, redact
2. **Use summaries** - Provide high-level info instead of details
3. **Offer alternatives** - Screenshare instead of file sharing
4. **Document sharing** - Log what was shared and with whom
5. **Time-limit access** - If sharing files, set expiration
6. **Watermark documents** - Mark as "Confidential - For Audit Only"
7. **Secure transmission** - Use encrypted channels
8. **Review retention** - Understand how long auditors keep data

---

**Remember:** Public SSL certificates are already public - anyone can retrieve them from your HTTPS endpoints. Private keys and internal infrastructure details should always remain confidential.

---

**Last Updated:** October 2025  
**Review Date:** Quarterly or when sharing procedures change

