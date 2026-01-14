# Third-Party Integrations Setup Guide

This guide covers setting up all third-party services required for the Kredit platform.

---

## Table of Contents

1. [Cloudflare](#cloudflare)
2. [Resend (Email)](#resend-email)
3. [WhatsApp Business API](#whatsapp-business-api)
4. [CTOS eKYC](#ctos-ekyc)
5. [DocuSeal](#docuseal)
6. [Database Access (DBeaver)](#database-access-dbeaver)

---

## Cloudflare

### Purpose
- DNS management
- SSL certificates (automatic)
- DDoS protection
- Tunnel for secure ingress (no public ports)

### Setup

1. **Add Domain**
   - Log in to Cloudflare Dashboard
   - Add Site → Enter domain
   - Update nameservers at registrar

2. **Create Cloud Tunnel** (for AWS services)
   - Zero Trust → Networks → Tunnels → Create
   - Name: `{client-slug}-cloud`
   - Copy token for AWS Secrets Manager:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id "{client-slug}/prod/cloudflare-tunnel-token" \
     --secret-string "YOUR_TUNNEL_TOKEN"
   ```
   - Configure routes:
     | Hostname | Service |
     |----------|---------|
     | `api.domain.com` | `http://backend.{client-slug}.local:4001` |
     | `app.domain.com` | `http://frontend.{client-slug}.local:3000` |
     | `admin.domain.com` | `http://admin.{client-slug}.local:3000` |

3. **Create On-Prem Tunnel** (for DocuSeal/MTSA)
   - Create another tunnel: `{client-slug}-onprem`
   - Install cloudflared on on-prem server
   - Configure routes:
     | Hostname | Service |
     |----------|---------|
     | `sign.domain.com` | `http://docuseal:3000` |

### Environment Variables

```env
# No env vars needed - Cloudflare handles everything via tunnel token
```

---

## Resend (Email)

### Purpose
- Transactional emails (OTP, notifications, receipts)
- Email templates

### Setup

1. **Create Resend Account**
   - Go to https://resend.com
   - Sign up and verify email

2. **Add Domain**
   - Domains → Add Domain
   - Add DNS records to Cloudflare:
     - SPF record (TXT)
     - DKIM records (TXT)
     - Return-Path (CNAME)
   - Wait for verification (usually < 1 hour)

3. **Create API Key**
   - API Keys → Create API Key
   - Full access for production
   - Save the key

4. **Store in AWS Secrets Manager**
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id "{client-slug}/prod/resend-api-key" \
     --secret-string "re_xxxxxxxxxxxxx"
   ```

### Environment Variables

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME="Kredit Platform"
```

---

## WhatsApp Business API

### Purpose
- OTP delivery via WhatsApp
- Payment reminders
- Loan status notifications

### Setup

1. **Create Meta Business Account**
   - Go to https://business.facebook.com
   - Create or use existing business account

2. **Set Up WhatsApp Business API**
   - Go to https://developers.facebook.com
   - Create App → Business → WhatsApp
   - Add WhatsApp product to app

3. **Get Phone Number**
   - WhatsApp → Getting Started
   - Add a phone number or use test number
   - Complete phone verification

4. **Create Message Templates**
   - WhatsApp → Message Templates
   - Create templates for:
     - OTP verification
     - Payment reminders
     - Loan approval notifications
   - Wait for template approval (24-48 hours)

5. **Get Access Token**
   - System Users → Create system user
   - Add assets (WhatsApp business account)
   - Generate token with `whatsapp_business_messaging` permission

6. **Store in AWS Secrets Manager**
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id "{client-slug}/prod/whatsapp-api-token" \
     --secret-string "YOUR_ACCESS_TOKEN"
   ```

### Environment Variables

```env
WHATSAPP_API_TOKEN=YOUR_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
ENABLE_WHATSAPP_NOTIFICATIONS=true
```

---

## CTOS eKYC

### Purpose
- Identity verification
- Credit scoring
- MyKad OCR and verification

### Setup

1. **Contact CTOS**
   - Email: sales@ctos.com.my
   - Request eKYC API access
   - Sign agreement and get credentials

2. **Sandbox Testing**
   - Use sandbox credentials first
   - Test all endpoints
   - Get production approval

3. **Store Credentials**
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id "{client-slug}/prod/ctos-credentials" \
     --secret-string '{
       "client_id": "YOUR_CLIENT_ID",
       "client_secret": "YOUR_CLIENT_SECRET",
       "api_key": "YOUR_API_KEY"
     }'
   ```

### Environment Variables

```env
CTOS_CLIENT_ID=YOUR_CLIENT_ID
CTOS_CLIENT_SECRET=YOUR_CLIENT_SECRET
CTOS_API_KEY=YOUR_API_KEY
CTOS_BASE_URL=https://api.ctos.com.my
CTOS_SANDBOX=false
```

---

## DocuSeal

### Purpose
- Document signing workflows
- PDF generation with signatures
- Signature capture

### Setup

DocuSeal runs on-premises for data sovereignty:

1. **Deploy On-Prem Stack**
   ```bash
   cd on-prem
   cp env.template .env
   docker compose -f docker-compose.unified.yml up -d
   ```

2. **Configure DocuSeal**
   - Access at http://localhost:3000 (or via tunnel)
   - Complete initial setup
   - Create API token: Settings → API

3. **Store API Token**
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id "{client-slug}/prod/docuseal-api-token" \
     --secret-string "YOUR_DOCUSEAL_TOKEN"
   ```

### Environment Variables

```env
DOCUSEAL_API_TOKEN=YOUR_DOCUSEAL_TOKEN
DOCUSEAL_URL=https://sign.yourdomain.com
```

---

## Database Access (DBeaver)

### Purpose
- View production data
- Debug issues
- Run queries

### Setup (AWS RDS)

1. **Get RDS Endpoint**
   ```bash
   terraform output rds_endpoint
   # Or from AWS Console: RDS → Databases → your-db
   ```

2. **Get Database Password**
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id "{client-slug}/prod/database-password" \
     --query SecretString --output text
   ```

3. **Set Up SSH Tunnel** (Required - RDS is in private subnet)

   Option A: Via Bastion Host
   - Create EC2 instance in public subnet
   - SSH tunnel through bastion:
   ```bash
   ssh -L 5432:your-rds-endpoint:5432 ec2-user@bastion-ip
   ```

   Option B: Via ECS Exec
   ```bash
   # Get task ID
   TASK_ID=$(aws ecs list-tasks --cluster your-cluster --service-name your-backend --query 'taskArns[0]' --output text)
   
   # Port forward through container
   aws ecs execute-command \
     --cluster your-cluster \
     --task $TASK_ID \
     --container backend \
     --interactive \
     --command "/bin/sh"
   
   # Then use pg tools inside container
   psql $DATABASE_URL
   ```

   Option C: Via AWS Session Manager
   ```bash
   # Install Session Manager plugin
   # https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html
   
   # Start port forwarding session
   aws ssm start-session \
     --target ecs:your-cluster_task-id_container-id \
     --document-name AWS-StartPortForwardingSessionToRemoteHost \
     --parameters '{"host":["your-rds-endpoint"],"portNumber":["5432"],"localPortNumber":["5432"]}'
   ```

4. **Configure DBeaver**

   - Connection → New Connection → PostgreSQL
   - Host: `localhost` (if tunneling) or RDS endpoint
   - Port: `5432`
   - Database: Your database name
   - Username: `postgres` (default)
   - Password: From Secrets Manager
   - SSL Mode: `require`

### DBeaver SSH Tunnel Settings

If using SSH tunnel in DBeaver:
- SSH → Use SSH Tunnel: ✓
- Host: Your bastion/jump host IP
- Port: 22
- User: ec2-user
- Auth: Private key

---

## Secrets Summary

All secrets should be stored in AWS Secrets Manager:

| Secret Path | Description |
|-------------|-------------|
| `{prefix}/jwt-secret` | JWT signing key |
| `{prefix}/jwt-refresh-secret` | Refresh token signing key |
| `{prefix}/cloudflare-tunnel-token` | Cloudflare Tunnel token |
| `{prefix}/database-password` | RDS password (auto-generated) |
| `{prefix}/database-url` | Full connection string (auto-generated) |
| `{prefix}/resend-api-key` | Resend email API key |
| `{prefix}/whatsapp-api-token` | WhatsApp Business API token |
| `{prefix}/ctos-credentials` | CTOS API credentials (JSON) |
| `{prefix}/docuseal-api-token` | DocuSeal API token |
| `{prefix}/signing-orchestrator-api-key` | On-prem signing orchestrator key |

### Generate Secrets Script

```bash
#!/bin/bash
PREFIX="your-client/prod"

# Generate JWT secrets
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/jwt-secret" \
  --secret-string "$(openssl rand -base64 32)"

aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/jwt-refresh-secret" \
  --secret-string "$(openssl rand -base64 32)"

# Generate signing orchestrator key
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/signing-orchestrator-api-key" \
  --secret-string "$(openssl rand -base64 32)"

echo "Done! Don't forget to set:"
echo "- cloudflare-tunnel-token"
echo "- resend-api-key"
echo "- whatsapp-api-token"
echo "- ctos-credentials"
echo "- docuseal-api-token"
```

---

## Testing Integrations

### Email (Resend)
```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@yourdomain.com",
    "to": "your@email.com",
    "subject": "Test",
    "text": "Test email from Resend"
  }'
```

### WhatsApp
```bash
curl -X POST "https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "60123456789",
    "type": "template",
    "template": {"name": "hello_world", "language": {"code": "en_US"}}
  }'
```

### DocuSeal
```bash
curl https://sign.yourdomain.com/api/templates \
  -H "X-Auth-Token: YOUR_API_TOKEN"
```
