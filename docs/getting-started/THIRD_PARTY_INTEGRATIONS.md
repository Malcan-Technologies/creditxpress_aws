# Third-Party Integrations Setup Guide

This guide covers all external services and APIs required for the Kredit platform to function fully.

## Table of Contents

1. [Email - Resend](#1-email---resend)
2. [WhatsApp Business API](#2-whatsapp-business-api)
3. [CTOS eKYC](#3-ctos-ekyc)
4. [DocuSeal (On-Premise)](#4-docuseal-on-premise)
5. [Cloudflare](#5-cloudflare)
6. [Database Access via DBeaver](#6-database-access-via-dbeaver)

---

## 1. Email - Resend

Resend is used for sending transactional emails (password resets, notifications, etc.).

### 1.1 Create Account

1. Go to https://resend.com
2. Sign up with your email
3. Verify your email address

### 1.2 Add Domain

1. Go to **Domains** → **Add Domain**
2. Enter your domain: `creditxpress.com.my`
3. Add the DNS records shown to Cloudflare:

| Type | Name | Value |
|------|------|-------|
| TXT | resend._domainkey | (provided by Resend) |
| TXT | @ | v=spf1 include:_spf.resend.com ~all |

4. Wait for verification (usually 5-10 minutes)

### 1.3 Create API Key

1. Go to **API Keys** → **Create API Key**
2. Name: `creditxpress-prod`
3. Permission: **Full access**
4. Copy the API key (starts with `re_`)

### 1.4 Configure in AWS

```bash
aws secretsmanager put-secret-value \
  --secret-id "creditxpress/prod/resend-api-key" \
  --secret-string "re_xxxxxxxxxxxx" \
  --region ap-southeast-5
```

### 1.5 Backend Environment Variables

The backend expects these values:
- `RESEND_API_KEY` - Your Resend API key
- `RESEND_FROM_EMAIL` - e.g., `noreply@creditxpress.com.my`

---

## 2. WhatsApp Business API

WhatsApp is used for OTP delivery and customer notifications.

### 2.1 Prerequisites

- Facebook Business Manager account
- Verified business
- Phone number for WhatsApp Business

### 2.2 Setup Meta Business

1. Go to https://business.facebook.com
2. Create or use existing Business Manager
3. Go to **Business Settings** → **WhatsApp Accounts**
4. Add a WhatsApp Business Account

### 2.3 Create WhatsApp App

1. Go to https://developers.facebook.com
2. Create App → Select **Business** → **WhatsApp**
3. Link to your Business Manager

### 2.4 Get Permanent Token

1. In Meta Developer Console → Your App → **WhatsApp** → **API Setup**
2. Generate a permanent access token (not the temporary one)
3. Note the **Phone Number ID** and **WhatsApp Business Account ID**

### 2.5 Create Message Templates

Required templates for the platform:

| Template Name | Purpose | Variables |
|---------------|---------|-----------|
| `otp_verification` | OTP delivery | `{{1}}` = OTP code |
| `loan_approved` | Loan approval notification | `{{1}}` = name, `{{2}}` = amount |
| `payment_reminder` | Payment due reminder | `{{1}}` = amount, `{{2}}` = date |
| `loan_disbursed` | Disbursement notification | `{{1}}` = amount |

### 2.6 Configure in AWS

```bash
aws secretsmanager put-secret-value \
  --secret-id "creditxpress/prod/whatsapp-api-token" \
  --secret-string "EAAxxxxxxxxxxxxxxx" \
  --region ap-southeast-5
```

### 2.7 Backend Environment Variables

```env
WHATSAPP_API_TOKEN=EAAxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
```

---

## 3. CTOS eKYC

CTOS provides identity verification and credit scoring services.

### 3.1 Contact CTOS

- Website: https://www.ctos.com.my
- Request access to their B2B eKYC API
- You'll receive:
  - API endpoint (sandbox and production)
  - Username
  - Password
  - API Key

### 3.2 Configure in AWS

```bash
aws secretsmanager put-secret-value \
  --secret-id "creditxpress/prod/ctos-credentials" \
  --secret-string '{
    "username": "your_ctos_username",
    "password": "your_ctos_password",
    "api_key": "your_ctos_api_key",
    "endpoint": "https://api.ctos.com.my/v1"
  }' \
  --region ap-southeast-5
```

### 3.3 Backend Environment Variables

```env
CTOS_USERNAME=your_username
CTOS_PASSWORD=your_password
CTOS_API_KEY=your_api_key
CTOS_API_URL=https://api.ctos.com.my/v1
```

---

## 4. DocuSeal (On-Premise)

DocuSeal handles document signing workflows. It runs on-premise.

### 4.1 Initial Setup

DocuSeal is deployed via Docker Compose on your on-premise server. See `on-prem/docker-compose.unified.yml`.

### 4.2 Get API Token

1. Access DocuSeal admin at `https://sign.creditxpress.com.my`
2. Login with admin credentials
3. Go to **API** → **Generate Token**
4. Copy the token

### 4.3 Configure in AWS

```bash
aws secretsmanager put-secret-value \
  --secret-id "creditxpress/prod/docuseal-api-token" \
  --secret-string "ds_xxxxxxxxxxxx" \
  --region ap-southeast-5
```

### 4.4 Backend Environment Variables

```env
DOCUSEAL_API_URL=https://sign.creditxpress.com.my
DOCUSEAL_API_TOKEN=ds_xxxxxxxxxxxx
```

### 4.5 Webhook Configuration

Configure DocuSeal to send webhooks to the signing orchestrator:
- Webhook URL: `http://signing-orchestrator:4010/webhooks/docuseal`
- Events: `submission.completed`, `submission.started`

---

## 5. Cloudflare

Cloudflare provides DNS, CDN, SSL, and Tunnel services.

### 5.1 Add Domain

1. Login to Cloudflare Dashboard
2. Add site: `creditxpress.com.my`
3. Update nameservers at your registrar

### 5.2 Configure DNS Records

After Terraform creates the ALB, add these records:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | app | `alb-dns-name.elb.amazonaws.com` | ✅ Proxied |
| CNAME | admin | `alb-dns-name.elb.amazonaws.com` | ✅ Proxied |
| CNAME | api | `alb-dns-name.elb.amazonaws.com` | ✅ Proxied |

### 5.3 SSL/TLS Settings

1. Go to **SSL/TLS** → **Overview**
2. Set mode to **Full (strict)**
3. Go to **Edge Certificates**:
   - Always Use HTTPS: **ON**
   - Minimum TLS Version: **TLS 1.2**
   - Automatic HTTPS Rewrites: **ON**

### 5.4 Create Cloudflare Tunnel (for on-prem)

```bash
# On your on-premise server
cloudflared tunnel create creditxpress-signing

# This creates a tunnel and gives you a tunnel ID
# Configure the tunnel in cloudflared/config.yml
```

### 5.5 Tunnel DNS Record

Add a CNAME record for the tunnel:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | sign | `<tunnel-id>.cfargotunnel.com` | ✅ Proxied |

---

## 6. Database Access via DBeaver

Connect to your production RDS database using DBeaver for data viewing and management.

### 6.1 Prerequisites

- DBeaver installed (https://dbeaver.io/download/)
- AWS CLI configured
- SSH client (for tunnel)

### 6.2 Get Database Credentials

```bash
# Get the RDS endpoint
aws rds describe-db-instances \
  --db-instance-identifier creditxpress-postgres \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text \
  --region ap-southeast-5

# Get the password from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id "creditxpress/prod/rds-password" \
  --query 'SecretString' \
  --output text \
  --region ap-southeast-5
```

### 6.3 Option A: Connect via EC2 Bastion (Recommended)

Since RDS is in a private subnet, you need a bastion host or SSM Session Manager.

**Create an EC2 Bastion (one-time setup):**

```bash
# Launch a small EC2 instance in the public subnet
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.micro \
  --key-name your-key-pair \
  --subnet-id <public-subnet-id> \
  --security-group-ids <ecs-security-group-id> \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=creditxpress-bastion}]'
```

**SSH Tunnel:**

```bash
ssh -i your-key.pem -L 5432:creditxpress-postgres.xxxxx.ap-southeast-5.rds.amazonaws.com:5432 ec2-user@bastion-public-ip
```

**DBeaver Connection:**

| Setting | Value |
|---------|-------|
| Host | `localhost` |
| Port | `5432` |
| Database | `creditxpress` |
| Username | `postgres` |
| Password | (from Secrets Manager) |

### 6.4 Option B: Connect via ECS Exec (No Bastion Needed)

Use an ECS task as a jump host:

```bash
# Get a running backend task
TASK_ID=$(aws ecs list-tasks \
  --cluster creditxpress-cluster \
  --service-name creditxpress-backend \
  --query 'taskArns[0]' \
  --output text \
  --region ap-southeast-5)

# Start port forwarding session
aws ecs execute-command \
  --cluster creditxpress-cluster \
  --task $TASK_ID \
  --container backend \
  --interactive \
  --command "sh -c 'apt-get update && apt-get install -y socat && socat TCP-LISTEN:5432,fork TCP:creditxpress-postgres.xxxxx.rds.amazonaws.com:5432'"
```

Then connect DBeaver to `localhost:5432`.

### 6.5 Option C: Temporary Public Access (Testing Only)

⚠️ **Not recommended for production** - only use for initial setup/testing.

Temporarily make RDS publicly accessible:

```bash
aws rds modify-db-instance \
  --db-instance-identifier creditxpress-postgres \
  --publicly-accessible \
  --region ap-southeast-5

# After testing, revert:
aws rds modify-db-instance \
  --db-instance-identifier creditxpress-postgres \
  --no-publicly-accessible \
  --region ap-southeast-5
```

### 6.6 DBeaver Connection Setup (Step by Step)

1. Open DBeaver
2. Click **Database** → **New Database Connection**
3. Select **PostgreSQL**
4. Fill in connection details:

| Field | Value |
|-------|-------|
| Host | `localhost` (if using tunnel) or RDS endpoint |
| Port | `5432` |
| Database | `creditxpress` |
| Username | `postgres` |
| Password | (from Secrets Manager) |

5. Click **Test Connection** to verify
6. Click **Finish**

### 6.7 Useful DBeaver Tips

- **View all tables**: Expand database → Schemas → public → Tables
- **Run queries**: Right-click database → SQL Editor → New SQL Script
- **Export data**: Right-click table → Export Data
- **Generate ERD**: Right-click schema → View Diagram

---

## Environment Variables Summary

Here's a complete list of third-party environment variables needed for the backend:

```env
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@creditxpress.com.my

# WhatsApp
WHATSAPP_API_TOKEN=EAAxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345

# CTOS
CTOS_USERNAME=your_username
CTOS_PASSWORD=your_password
CTOS_API_KEY=your_api_key
CTOS_API_URL=https://api.ctos.com.my/v1

# DocuSeal
DOCUSEAL_API_URL=https://sign.creditxpress.com.my
DOCUSEAL_API_TOKEN=ds_xxxxxxxxxxxx

# Signing Orchestrator
SIGNING_ORCHESTRATOR_URL=https://sign.creditxpress.com.my
SIGNING_ORCHESTRATOR_API_KEY=your_api_key
```

---

## Secrets Manager Quick Reference

| Secret Path | Purpose |
|-------------|---------|
| `creditxpress/prod/database-url` | PostgreSQL connection string (auto-generated) |
| `creditxpress/prod/rds-password` | RDS master password (auto-generated) |
| `creditxpress/prod/jwt-secret` | JWT signing secret |
| `creditxpress/prod/jwt-refresh-secret` | JWT refresh token secret |
| `creditxpress/prod/signing-orchestrator-api-key` | API key for on-prem signing |
| `creditxpress/prod/docuseal-api-token` | DocuSeal API token |
| `creditxpress/prod/whatsapp-api-token` | WhatsApp Business API token |
| `creditxpress/prod/resend-api-key` | Resend email API key |
| `creditxpress/prod/ctos-credentials` | CTOS eKYC credentials (JSON) |

### Populate Secrets After Terraform Apply

Run these commands to populate the secrets:

```bash
PREFIX="creditxpress/prod"
REGION="ap-southeast-5"

# JWT Secrets (auto-generate)
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/jwt-secret" \
  --secret-string "$(openssl rand -hex 64)" \
  --region $REGION

aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/jwt-refresh-secret" \
  --secret-string "$(openssl rand -hex 64)" \
  --region $REGION

# Signing Orchestrator API Key (save this for on-prem config!)
SIGNING_KEY=$(openssl rand -hex 32)
echo "🔐 SIGNING_ORCHESTRATOR_API_KEY: $SIGNING_KEY"
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/signing-orchestrator-api-key" \
  --secret-string "$SIGNING_KEY" \
  --region $REGION
```

---

## Troubleshooting

### Email not sending
1. Check Resend domain verification status
2. Verify API key is correct
3. Check backend logs for errors

### WhatsApp messages failing
1. Ensure phone number is registered
2. Check template is approved
3. Verify recipient has WhatsApp

### CTOS verification failing
1. Check API credentials
2. Verify you're using correct endpoint (sandbox vs prod)
3. Check CTOS account status

### DocuSeal not accessible
1. Verify Cloudflare Tunnel is running
2. Check Docker containers are healthy
3. Verify DNS is pointing correctly

---

*Last updated: January 2026*
