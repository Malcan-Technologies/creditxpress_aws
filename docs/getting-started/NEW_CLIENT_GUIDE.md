# New Client Onboarding Guide

This guide walks through the complete process of setting up a new client using the forked repository pattern.

## Overview

Each new client gets:
- A forked repository (full codebase control)
- Dedicated AWS infrastructure (complete isolation)
- Dedicated on-premise server (signing services)
- Customizable frontend (branding, colors, features)

## Time Estimate

| Phase | Duration |
|-------|----------|
| Repository Setup | 15 minutes |
| AWS Infrastructure | 30 minutes |
| On-Prem Setup | 30 minutes |
| DNS & SSL | 15 minutes |
| Initial Deployment | 15 minutes |
| Database Seed | 5 minutes |
| **Total** | **~2 hours** |

---

## Step 1: Fork the Template Repository

### Option A: GitHub UI

1. Go to the template repository on GitHub
2. Click "Fork"
3. Select the client's organization
4. Name it: `<client>-platform`

### Option B: GitHub CLI

```bash
gh repo fork yourorg/creditxpress-template \
  --org clientorg \
  --fork-name newclient-platform
```

### Clone the Fork

```bash
git clone git@github.com:clientorg/newclient-platform.git
cd newclient-platform
```

---

## Step 2: Configure Client Settings

### Edit client.json

```bash
vim client.json
```

Replace all values with client-specific settings:

```json
{
  "client_slug": "newclient",
  "client_name": "New Client Company",
  "environment": "production",
  
  "aws": {
    "region": "ap-southeast-1",
    "account_id": "123456789012"
  },
  
  "domains": {
    "app": "app.newclient.com",
    "admin": "admin.newclient.com",
    "api": "api.newclient.com",
    "sign": "sign.newclient.com"
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
    "company_name": "New Client Company",
    "primary_color": "#2563eb",
    "support_email": "support@newclient.com"
  }
}
```

---

## Step 3: Customize Frontend (Optional)

### Replace Branding Assets

```bash
# Logo
cp ~/client-assets/logo.svg frontend/public/branding/logo.svg

# Favicon
cp ~/client-assets/favicon.ico frontend/public/favicon.ico
cp ~/client-assets/favicon.ico admin/public/favicon.ico
```

### Customize Colors

Edit `frontend/tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        // ... customize based on client brand
        600: '#2563eb',
        700: '#1d4ed8',
      }
    }
  }
}
```

### Modify Components

For significant UI changes, edit components in:
- `frontend/components/`
- `frontend/app/`
- `admin/app/components/`

---

## Step 4: Create AWS Infrastructure

### Set AWS Credentials

```bash
export AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
export AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export AWS_DEFAULT_REGION=ap-southeast-1
```

### Run Terraform

```bash
cd infra/terraform

# Initialize
terraform init

# Preview changes
terraform plan

# Create resources
terraform apply -auto-approve
```

### Save Terraform Output

```bash
terraform output -json > deployment-info.json
```

---

## Step 5: Configure AWS Secrets

```bash
PREFIX="newclient/prod"

# JWT Secret
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/jwt-secret" \
  --secret-string "$(openssl rand -hex 64)"

# Signing Orchestrator API Key
SIGNING_KEY=$(openssl rand -hex 32)
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/signing-orchestrator-api-key" \
  --secret-string "$SIGNING_KEY"

# Save signing key for on-prem setup
echo "SIGNING_ORCHESTRATOR_API_KEY=$SIGNING_KEY" >> ~/newclient-secrets.txt

# Resend API Key (from Resend dashboard)
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/resend-api-key" \
  --secret-string "re_xxxxx"

# WhatsApp API Token (from Meta Business)
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/whatsapp-api-token" \
  --secret-string "EAAG..."

# CTOS Credentials (from CTOS)
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/ctos-credentials" \
  --secret-string '{"username":"xxx","password":"xxx"}'
```

---

## Step 6: Add GitHub Secrets

In the forked repository settings:

1. Go to Settings → Secrets and variables → Actions
2. Add repository secrets:

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM access key for this client |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |

---

## Step 7: Setup On-Prem Server

### SSH to On-Prem Server

```bash
ssh user@onprem-server
```

### Clone Repository

```bash
cd /opt
sudo git clone git@github.com:clientorg/newclient-platform.git
cd newclient-platform/on-prem
```

### Configure Environment

```bash
cp env.template .env
vim .env
```

Fill in all values, especially:
- `CLIENT_SLUG=newclient`
- `SIGN_DOMAIN=sign.newclient.com`
- `SIGNING_ORCHESTRATOR_API_KEY=` (from step 5)
- `MTSA_SOAP_USERNAME=` (from MyTrustSigner)
- `MTSA_SOAP_PASSWORD=`

### Start Services

```bash
docker compose -f docker-compose.unified.yml up -d
```

### Create Cloudflare Tunnel

```bash
# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create newclient-signing

# Save the tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep newclient-signing | awk '{print $1}')

# Route DNS
cloudflared tunnel route dns $TUNNEL_ID sign.newclient.com

# Configure tunnel
cp cloudflared/config.template.yml cloudflared/config.yml
sed -i "s/<tunnel-id>/$TUNNEL_ID/g" cloudflared/config.yml
sed -i "s/CLIENT_DOMAIN/newclient.com/g" cloudflared/config.yml

# Run tunnel
cloudflared tunnel run newclient-signing
```

### Run as Systemd Service

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

---

## Step 8: Configure Cloudflare DNS

In Cloudflare Dashboard for the domain:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | app | alb-xxx.elb.amazonaws.com | ✅ |
| CNAME | admin | alb-xxx.elb.amazonaws.com | ✅ |
| CNAME | api | alb-xxx.elb.amazonaws.com | ✅ |

The `sign.*` subdomain is automatically configured by Cloudflare Tunnel.

---

## Step 9: Request SSL Certificate

In AWS Certificate Manager:

```bash
aws acm request-certificate \
  --domain-name "*.newclient.com" \
  --validation-method DNS \
  --region ap-southeast-1
```

Add the DNS validation records to Cloudflare, then update Terraform.

---

## Step 10: Deploy Application

### Push to Main (Triggers CI/CD)

```bash
git add .
git commit -m "Configure for new client: newclient"
git push origin main
```

### Or Manual Deploy

```bash
# From GitHub Actions: Run "Deploy All Services" workflow
```

---

## Step 11: Seed Database

```bash
# Get task ID
TASK_ID=$(aws ecs list-tasks --cluster newclient-cluster --service-name newclient-backend --query 'taskArns[0]' --output text)

# Run migrations
aws ecs execute-command \
  --cluster newclient-cluster \
  --task $TASK_ID \
  --container backend \
  --interactive \
  --command "npx prisma migrate deploy"

# Run seed
aws ecs execute-command \
  --cluster newclient-cluster \
  --task $TASK_ID \
  --container backend \
  --interactive \
  --command "npx prisma db seed"
```

---

## Step 12: Verify Deployment

### Test Endpoints

```bash
# API Health
curl https://api.newclient.com/api/health

# Frontend
curl -I https://app.newclient.com

# Admin
curl -I https://admin.newclient.com/login

# Signing
curl https://sign.newclient.com/health
```

### Create Admin User

```bash
aws ecs execute-command \
  --cluster newclient-cluster \
  --task $TASK_ID \
  --container backend \
  --interactive \
  --command "npx prisma db seed"
```

Default admin credentials are set in the seed script.

---

## Post-Deployment Checklist

- [ ] All endpoints accessible
- [ ] Admin can login
- [ ] DocuSeal is accessible at sign.*/s/
- [ ] Signing orchestrator health check passes
- [ ] Database migrations applied
- [ ] Admin user created
- [ ] WhatsApp notifications working
- [ ] Email notifications working
- [ ] File uploads to S3 working
- [ ] CTOS integration working
- [ ] MTSA signing working

---

## Syncing Upstream Changes

When the template repository has updates:

```bash
# Add upstream remote (one-time)
git remote add upstream git@github.com:yourorg/creditxpress-template.git

# Fetch and merge
git fetch upstream
git merge upstream/main

# Resolve any conflicts
# Usually in:
# - client.json (keep client values)
# - frontend branding files (keep client customizations)

git add .
git commit -m "Sync upstream changes"
git push origin main
```

---

## Troubleshooting

### ECS Service Not Starting

```bash
# Check service events
aws ecs describe-services --cluster newclient-cluster --services newclient-backend

# Check logs
aws logs tail /ecs/newclient/backend --follow
```

### Cloudflare Tunnel Not Working

```bash
# Check tunnel status
cloudflared tunnel list

# Check tunnel logs
journalctl -u cloudflared -f
```

### Database Connection Issues

```bash
# Verify secret exists
aws secretsmanager get-secret-value --secret-id newclient/prod/database-url

# Check RDS security group allows ECS
```

---

## Support Contacts

- AWS Issues: Check CloudWatch logs
- Cloudflare Issues: Check Cloudflare Dashboard
- Application Issues: Check ECS logs
- Signing Issues: Check on-prem logs in `/opt/newclient-platform/on-prem/`
