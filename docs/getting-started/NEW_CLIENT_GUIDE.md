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
  },
  
  "docuseal": {
    "template_id": "2",
    "template_external_id": "newclient-loan-agreement",
    "company_signing_email": "admin@newclient.com",
    "witness_email": "legal@newclient.com",
    "witness_name": "Legal Representative"
  },
  
  "onprem": {
    "enabled": true,
    "server_ip": "100.x.x.x",
    "ssh_user": "admin",
    "ssh_host": "admin@100.x.x.x",
    "base_dir": "/home/admin",
    "mtsa": {
      "env": "pilot",
      "container_image": "mtsa-pilot:1.01"
    },
    "cloudflare": {
      "tunnel_name": "newclient-onprem"
    }
  }
}
```

> **Note:** The `docuseal` and `onprem` sections are used by on-prem setup scripts. AWS deployment workflows use the `aws`, `ecr`, `ecs`, and `rds` sections.

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

The on-prem server hosts the signing infrastructure: DocuSeal, Signing Orchestrator, and MTSA.

### Prerequisites

Before starting:
- Linux server (Ubuntu 20.04+ recommended) with Docker
- SSH access to the server
- MTSA container tarball from Trustgate
- MTSA SOAP credentials from Trustgate

### Option A: First-Time Setup Script (Recommended)

Use the automated first-time setup script for a new server:

```bash
# SSH to server
ssh user@onprem-server

# Clone repository
cd /opt
sudo git clone git@github.com:clientorg/newclient-platform.git
cd newclient-platform/on-prem/scripts

# Run first-time setup
./first-time-setup.sh --mtsa-image /tmp/mtsa-container.tar
```

The script will:
1. Install Docker and dependencies
2. Create directory structure
3. Generate environment files
4. Import MTSA container
5. Start all services
6. Set up DocuSeal template (optional)
7. Configure GitHub Actions runner (optional)

### Option B: Master Setup Script

For a server with Docker already installed:

```bash
cd on-prem/scripts

# Set required secrets
export SIGNING_ORCHESTRATOR_API_KEY="<from-step-5>"
export MTSA_SOAP_USERNAME="<from-trustgate>"
export MTSA_SOAP_PASSWORD="<from-trustgate>"

# Run setup
./setup-new-client.sh
```

### Option C: Manual Setup

If you prefer manual control:

```bash
cd on-prem/scripts

# 1. Import MTSA container
./import-mtsa-container.sh /path/to/mtsa-container.tar

# 2. Generate environment files
./generate-env.sh

# 3. Start services
cd ..
docker compose -f docker-compose.unified.yml up -d

# 4. Setup DocuSeal template (after getting API token)
export DOCUSEAL_API_TOKEN="<from-docuseal-settings>"
./scripts/setup-docuseal-template.sh --update-config
```

### Verify On-Prem Services

```bash
# Check all services
./scripts/deploy-all.sh status

# Expected output:
# DocuSeal: Healthy
# Signing Orchestrator: Healthy
# MTSA: Healthy
```

### Create Cloudflare Tunnel

Use the automated setup script:

```bash
# Copy and run the setup script
./on-prem/scripts/setup-cloudflare-tunnel.sh \
  --client-name newclient \
  --domain newclient.com
```

The script will:
1. Install cloudflared
2. Authenticate with Cloudflare (opens browser)
3. Create tunnel `newclient-onprem`
4. Create DNS route for `sign.newclient.com`
5. Install and start systemd service

### Configure Cloudflare Dashboard Routes

**IMPORTANT:** After running the script, configure routes in Cloudflare Dashboard:

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Networks** → **Tunnels** → **newclient-onprem**
3. Go to **Public Hostname** tab
4. Add these routes **IN ORDER** (specific paths first, catch-all last):

| # | Path | Service |
|---|------|---------|
| 1 | `signing-health` | `http://localhost:4010/health` |
| 2 | `orchestrator/*` | `http://localhost:4010` |
| 3 | `api/signing/*` | `http://localhost:4010` |
| 4 | `MTSAPilot/*` | `http://localhost:8080` |
| 5 | `MTSA/*` | `http://localhost:8080` |
| 6 | `*` | `http://localhost:3001` |

### Verify Tunnel

```bash
# Check service status
sudo systemctl status cloudflared

# Test endpoints
curl https://sign.newclient.com/
curl https://sign.newclient.com/signing-health
curl https://sign.newclient.com/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl
```

> 📖 For detailed documentation, see [Cloudflare Tunnel Setup Guide](../../on-prem/docs/CLOUDFLARE_TUNNEL_SETUP.md)

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

## On-Prem CI/CD with GitHub Actions

For automated on-prem deployments without SSH access, set up a self-hosted GitHub runner.

### Install GitHub Actions Runner

On the on-prem server:

```bash
cd on-prem/scripts

# Follow the interactive setup
# Get runner token from: GitHub → Settings → Actions → Runners → New self-hosted runner
```

Or refer to the detailed guide: `on-prem/docs/GITHUB_RUNNER_SETUP.md`

### Add On-Prem Secrets to GitHub

In repository Settings → Secrets and variables → Actions, add:

| Secret | Description |
|--------|-------------|
| `DOCUSEAL_API_TOKEN` | DocuSeal API token |
| `SIGNING_ORCHESTRATOR_API_KEY` | API key for orchestrator |
| `MTSA_SOAP_USERNAME` | MTSA/Trustgate SOAP username |
| `MTSA_SOAP_PASSWORD` | MTSA/Trustgate SOAP password |
| `DOCUSEAL_POSTGRES_PASSWORD` | DocuSeal database password |
| `AGREEMENTS_DB_PASSWORD` | Signing orchestrator DB password |

### Trigger On-Prem Deployment

Via GitHub UI:
1. Go to Actions → "Deploy On-Prem Services"
2. Click "Run workflow"
3. Select services to deploy
4. Click "Run workflow"

Via GitHub CLI:
```bash
gh workflow run deploy-onprem.yml \
  -f deploy_docuseal=true \
  -f deploy_orchestrator=true
```

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

## On-Prem Documentation Reference

| Document | Location | Purpose |
|----------|----------|---------|
| Step-by-Step Deployment | `on-prem/docs/STEP_BY_STEP_DEPLOYMENT_GUIDE.md` | Detailed deployment walkthrough |
| GitHub Runner Setup | `on-prem/docs/GITHUB_RUNNER_SETUP.md` | Self-hosted runner installation |
| MTSA Integration | `on-prem/docs/MTSA_CONTAINER_INTEGRATION.md` | Trustgate container setup |
| Cloudflare Tunnel | `on-prem/docs/CLOUDFLARE_TUNNEL_SETUP.md` | Tunnel configuration |
| Backup System | `on-prem/docs/BACKUP_SYSTEM.md` | Backup and restore procedures |

### On-Prem Scripts Reference

| Script | Purpose |
|--------|---------|
| `first-time-setup.sh` | Initial server provisioning |
| `setup-new-client.sh` | Master orchestration script |
| `generate-env.sh` | Generate .env from client.json |
| `import-mtsa-container.sh` | Import Trustgate MTSA container |
| `setup-docuseal-template.sh` | Configure DocuSeal template |
| `export-docuseal-template.sh` | Export template for reuse |
| `deploy-all.sh` | Deploy and manage services |
| `setup-cloudflare-tunnel.sh` | Configure Cloudflare tunnel |

---

## Support Contacts

- AWS Issues: Check CloudWatch logs
- Cloudflare Issues: Check Cloudflare Dashboard
- Application Issues: Check ECS logs
- Signing Issues: Check on-prem logs with `./on-prem/scripts/deploy-all.sh logs`
