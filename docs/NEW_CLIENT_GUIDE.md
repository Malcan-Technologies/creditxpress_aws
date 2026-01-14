# New Client Setup Guide

This guide covers onboarding a new client using the **Forked Repository Pattern**. Each client gets their own fork with isolated infrastructure and customizable UI.

## Architecture

```
Template Repository (creditxpress_aws)
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
Client A Fork   Client B Fork
    │             │
    ▼             ▼
AWS Account A   AWS Account B
    │             │
    ▼             ▼
On-Prem A       On-Prem B
```

**Each client has:**
- Separate GitHub repository (forked)
- Separate AWS account
- Separate Cloudflare Tunnel
- Separate on-premise infrastructure
- Full UI customization capability

---

## Step 1: Fork the Repository

### Option A: GitHub Fork (Recommended for Private Repos)

```bash
# Create new repo from template
gh repo create client-name/kredit-platform \
  --template your-org/creditxpress_aws \
  --private

# Clone the new repo
git clone git@github.com:client-name/kredit-platform.git
cd kredit-platform
```

### Option B: Manual Clone

```bash
# Clone template
git clone git@github.com:your-org/creditxpress_aws.git client-platform
cd client-platform

# Remove old origin and add new
git remote remove origin
git remote add origin git@github.com:client-name/kredit-platform.git
git push -u origin main
```

---

## Step 2: Configure Client Settings

### 2.1 Update client.json

Edit `client.json` with client-specific values:

```json
{
  "client_slug": "newclient",
  "client_name": "New Client Sdn. Bhd.",
  "environment": "production",
  
  "aws": {
    "region": "ap-southeast-5",
    "account_id": "CLIENT_AWS_ACCOUNT_ID"
  },
  
  "domains": {
    "app": "app.newclient.com.my",
    "admin": "admin.newclient.com.my",
    "api": "api.newclient.com.my",
    "sign": "sign.newclient.com.my"
  },
  
  "ecr": {
    "backend": "newclient/backend",
    "frontend": "newclient/frontend",
    "admin": "newclient/admin"
  },
  
  "ecs": {
    "cluster": "newclient-cluster",
    "backend_service": "newclient-backend",
    "frontend_service": "newclient-frontend",
    "admin_service": "newclient-admin"
  },
  
  "rds": {
    "identifier": "newclient-postgres",
    "database": "newclient"
  },
  
  "s3": {
    "bucket": "newclient-prod-files"
  },
  
  "secrets_prefix": "newclient/prod",
  
  "branding": {
    "company_name": "New Client Sdn. Bhd.",
    "primary_color": "#2563eb",
    "support_email": "support@newclient.com.my"
  }
}
```

### 2.2 Update Branding (Optional)

For UI customization, update:

- `frontend/public/` - Logo, favicon, images
- `frontend/app/globals.css` - Colors, fonts
- `admin/public/` - Admin panel assets
- `BRAND_STYLE_GUIDE.md` - Document new brand guidelines

---

## Step 3: Set Up AWS Account

### 3.1 Create AWS Account

1. Create new AWS account (or use client's existing account)
2. Enable MFA on root user
3. Create IAM user for Terraform (see AWS_SETUP_GUIDE.md)

### 3.2 Run Terraform

```bash
cd infra/terraform

# Initialize
terraform init

# Plan
terraform plan

# Apply
terraform apply
```

### 3.3 Configure Secrets

```bash
# Generate and set secrets
aws secretsmanager put-secret-value \
  --secret-id "newclient/prod/cloudflare-tunnel-token" \
  --secret-string "TUNNEL_TOKEN_HERE"

aws secretsmanager put-secret-value \
  --secret-id "newclient/prod/jwt-secret" \
  --secret-string "$(openssl rand -base64 32)"

aws secretsmanager put-secret-value \
  --secret-id "newclient/prod/jwt-refresh-secret" \
  --secret-string "$(openssl rand -base64 32)"

# See THIRD_PARTY_INTEGRATIONS.md for other secrets
```

---

## Step 4: Set Up Cloudflare

### 4.1 Add Domain to Cloudflare

1. Add client domain to Cloudflare
2. Update nameservers at registrar
3. Wait for DNS propagation

### 4.2 Create Tunnel for Cloud Services

1. Go to Zero Trust → Networks → Tunnels
2. Create tunnel: `newclient-cloud`
3. Copy token for AWS Secrets Manager
4. Configure routes:

| Hostname | Service |
|----------|---------|
| `api.newclient.com.my` | `http://backend.newclient.local:4001` |
| `app.newclient.com.my` | `http://frontend.newclient.local:3000` |
| `admin.newclient.com.my` | `http://admin.newclient.local:3000` |

### 4.3 Create Tunnel for On-Prem Services

1. Create tunnel: `newclient-onprem`
2. Configure routes:

| Hostname | Service |
|----------|---------|
| `sign.newclient.com.my` | `http://docuseal:3000` |

---

## Step 5: Set Up On-Premises Infrastructure

### 5.1 Prepare On-Prem Server

Requirements:
- Ubuntu 22.04 or later
- Docker + Docker Compose
- Tailscale (optional, for remote access)
- 8GB RAM minimum

### 5.2 Deploy On-Prem Stack

```bash
# Clone repository on on-prem server
git clone git@github.com:client-name/kredit-platform.git
cd kredit-platform/on-prem

# Copy environment template
cp env.template .env

# Edit .env with client values
nano .env

# Start services
docker compose -f docker-compose.unified.yml up -d
```

### 5.3 Install Cloudflared

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Authenticate
cloudflared tunnel login

# Connect to tunnel
cloudflared service install TUNNEL_TOKEN_HERE
```

---

## Step 6: Configure GitHub Actions

Add these secrets to the GitHub repository:

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | From IAM user |
| `AWS_SECRET_ACCESS_KEY` | From IAM user |
| `AWS_REGION` | `ap-southeast-5` |
| `AWS_ACCOUNT_ID` | Client's AWS account ID |

---

## Step 7: Initial Deployment

### 7.1 Push to Trigger Deployment

```bash
git add .
git commit -m "Configure for newclient"
git push origin main
```

### 7.2 Run Database Migrations

```bash
# Via GitHub Actions
# Go to Actions → Deploy All → Run workflow
# Enable "Run database migrations" and "Run database seed"

# Or via ECS Exec
TASK_ID=$(aws ecs list-tasks --cluster newclient-cluster --service-name newclient-backend --query 'taskArns[0]' --output text)

aws ecs execute-command \
  --cluster newclient-cluster \
  --task $TASK_ID \
  --container backend \
  --interactive \
  --command "npx prisma migrate deploy && npx prisma db seed"
```

---

## Step 8: Verify Deployment

### Check Services

```bash
# ECS services
aws ecs describe-services \
  --cluster newclient-cluster \
  --services newclient-backend newclient-frontend newclient-admin

# Logs
aws logs tail /ecs/newclient/backend --follow
```

### Test Endpoints

- https://api.newclient.com.my/api/health
- https://app.newclient.com.my
- https://admin.newclient.com.my
- https://sign.newclient.com.my (on-prem)

---

## Keeping Client Up to Date

### Sync from Template

When the template repository has updates:

```bash
# Add template as upstream
git remote add upstream git@github.com:your-org/creditxpress_aws.git

# Fetch updates
git fetch upstream

# Merge updates (review carefully!)
git merge upstream/main

# Resolve any conflicts
# Push to client repo
git push origin main
```

### Client-Specific Changes

Keep client customizations in:
- `client.json` - Infrastructure config
- `frontend/public/` - Branding assets
- `frontend/app/globals.css` - Custom styles
- `BRAND_STYLE_GUIDE.md` - Brand documentation

Avoid modifying core business logic unless necessary, as this makes syncing harder.

---

## Checklist

- [ ] Repository forked and configured
- [ ] client.json updated with client values
- [ ] AWS account created and IAM configured
- [ ] Terraform applied successfully
- [ ] AWS Secrets Manager populated
- [ ] Cloudflare domain configured
- [ ] Cloudflare Tunnel (cloud) created and connected
- [ ] Cloudflare Tunnel (on-prem) created and connected
- [ ] On-prem server provisioned and stack deployed
- [ ] GitHub Actions secrets configured
- [ ] Database migrated and seeded
- [ ] All endpoints verified working
- [ ] Third-party integrations configured (Resend, WhatsApp, CTOS)
