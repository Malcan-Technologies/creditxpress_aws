# New Client Onboarding Guide

This guide walks through the complete process of setting up a new client using the forked repository pattern.

## Overview

Each new client gets:
- A forked repository (full codebase control)
- Dedicated AWS infrastructure (complete isolation)
- Dedicated on-premise server (signing services)
- Customizable frontend (branding, colors, features)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AWS (Cloud)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Frontend   │  │   Admin     │  │   Backend   │  │   RDS       │    │
│  │  (Next.js)  │  │  (Next.js)  │  │  (Express)  │  │  (Postgres) │    │
│  │  ECS/Nginx  │  │  ECS/Nginx  │  │    ECS      │  │             │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘    │
│         │                │                │                             │
│         └────────────────┼────────────────┘                             │
│                          │                                              │
│                    ┌─────┴─────┐                                        │
│                    │    ALB    │                                        │
│                    └─────┬─────┘                                        │
└──────────────────────────┼──────────────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │ Cloudflare  │
                    │   (DNS)     │
                    └──────┬──────┘
                           │
┌──────────────────────────┼──────────────────────────────────────────────┐
│                          │         On-Prem Server                        │
├──────────────────────────┼──────────────────────────────────────────────┤
│                    ┌─────┴─────┐                                        │
│                    │ Cloudflare│                                        │
│                    │  Tunnel   │                                        │
│                    └─────┬─────┘                                        │
│         ┌────────────────┼────────────────┐                             │
│         │                │                │                             │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐                     │
│  │  DocuSeal   │  │  Signing    │  │    MTSA     │                     │
│  │  (Port 3001)│  │ Orchestrator│  │ (Port 8080) │                     │
│  │             │  │ (Port 4010) │  │  Trustgate  │                     │
│  └─────────────┘  └─────────────┘  └─────────────┘                     │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐                                      │
│  │ DocuSeal DB │  │ Agreements  │                                      │
│  │  (Postgres) │  │     DB      │                                      │
│  └─────────────┘  └─────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Time Estimate

| Phase | Duration |
|-------|----------|
| Repository Setup | 15 minutes |
| AWS Infrastructure | 30 minutes |
| On-Prem Server Setup | 45 minutes |
| DNS & SSL | 15 minutes |
| Initial Deployment | 15 minutes |
| Database Seed & Config | 10 minutes |
| **Total** | **~2.5 hours** |

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
- Linux server (Ubuntu 22.04+ recommended) with at least 4GB RAM
- SSH access to the server
- MTSA container tarball from Trustgate (stored locally on server)
- MTSA SOAP credentials from Trustgate
- Tailscale or Cloudflare Tunnel for secure access

### What Gets Deployed

| Service | Port | Purpose |
|---------|------|---------|
| DocuSeal | 3001 | Document signing UI |
| Signing Orchestrator | 4010 | PKI bridge, coordinates signing |
| MTSA | 8080 | Trustgate digital signature agent |
| DocuSeal Postgres | 5433 | DocuSeal database |
| Agreements Postgres | 5434 | Signed agreement audit trail |

### MTSA Container Image

**Important:** The MTSA Docker image is proprietary from Trustgate and is stored locally on the on-prem server. It is NOT pulled from any registry.

Workflow:
1. Trustgate provides a `.tar` file (e.g., `mtsa-pilot.tar`)
2. Transfer the tarball to the on-prem server (via SCP, USB, etc.)
3. Import it using the provided script
4. The image stays local - it's never pushed to a registry

### Option A: First-Time Setup Script (Recommended)

Use the automated first-time setup script for a new server:

```bash
# 1. Transfer MTSA tarball to server (from your local machine)
scp /path/to/mtsa-pilot.tar user@onprem-server:/tmp/

# 2. SSH to server
ssh user@onprem-server

# 3. Clone repository
cd /opt
sudo git clone git@github.com:clientorg/newclient-platform.git
cd newclient-platform/on-prem/scripts

# 4. Run first-time setup
./first-time-setup.sh --mtsa-image /tmp/mtsa-pilot.tar
```

The script will:
1. Install Docker and dependencies
2. Create directory structure
3. Import MTSA container from tarball
4. Generate environment files from `client.json`
5. Start all services (DocuSeal, Orchestrator, MTSA)
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

# 1. Import MTSA container (REQUIRED - image stored locally only)
./import-mtsa-container.sh /tmp/mtsa-pilot.tar

# Verify import
docker images | grep mtsa
# Should show: mtsa-pilot   latest   ...

# 2. Generate environment files from client.json
./generate-env.sh

# 3. Start services
cd ..
docker compose -f docker-compose.unified.yml up -d

# 4. Verify all services are running
docker compose -f docker-compose.unified.yml ps

# 5. Setup DocuSeal template (after getting API token from DocuSeal UI)
export DOCUSEAL_API_TOKEN="<from-docuseal-settings>"
./scripts/setup-docuseal-template.sh --update-config
```

### Verify MTSA is Running

```bash
# Check container status
docker ps | grep mtsa

# Check WSDL endpoint (pilot environment)
curl -sf http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl | head -5

# Check WSDL endpoint (production environment)
curl -sf http://localhost:8080/MTSA/MyTrustSignerAgentWSAPv2?wsdl | head -5
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

## Step 13: Configure Company Settings

After deployment, configure the company-specific settings via the Admin Panel.

### Access Admin Panel

1. Go to `https://admin.<client-domain>/login`
2. Login with the seeded admin credentials
3. Navigate to **Settings** → **Company Settings**

### Configure Required Fields

| Field | Description | Example |
|-------|-------------|---------|
| Company Name | Legal entity name | OPG Capital Holdings Sdn. Bhd. |
| Company Address | Full registered address | 123 Jalan Example, KL |
| Company Reg No | SSM registration | 12345-X |
| License No | Money lending license | WL/2024/001 |
| Contact Phone | Support phone | +60123456789 |
| Contact Email | Support email | support@client.com |

### Configure Signing Settings

These values appear in digitally signed loan agreements:

| Field | Description | Example |
|-------|-------------|---------|
| Sign URL | DocuSeal/signing service URL | https://sign.client.com |
| Server Public IP | On-prem server's public IP | 210.186.80.101 |

**How to find the server public IP:**
```bash
# On the on-prem server
curl -4 ifconfig.me
```

### Save Settings

Click **Save** - a success toast will confirm the settings are saved.

---

## Post-Deployment Checklist

### AWS Services
- [ ] All endpoints accessible (app, admin, api)
- [ ] Admin can login
- [ ] Database migrations applied
- [ ] Admin user created
- [ ] WhatsApp notifications working
- [ ] Email notifications working
- [ ] File uploads to S3 working
- [ ] CTOS integration working

### On-Prem Services
- [ ] DocuSeal accessible at `https://sign.<domain>`
- [ ] Signing orchestrator health check passes
- [ ] MTSA container running
- [ ] Cloudflare Tunnel connected

### Admin Configuration
- [ ] Company settings configured
- [ ] Sign URL set correctly
- [ ] Server public IP set
- [ ] Bank account(s) added
- [ ] Notification settings reviewed

---

## On-Prem CI/CD with GitHub Actions

For automated on-prem deployments, set up a self-hosted GitHub Actions runner on the on-prem server.

### How It Works

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  GitHub Actions │ ◄────── │  Self-Hosted     │ ◄────── │  On-Prem Server │
│  (cloud)        │  polls  │  Runner Agent    │  runs   │  (your server)  │
└─────────────────┘         └──────────────────┘  on     └─────────────────┘
```

- The runner agent runs on your on-prem server and polls GitHub for jobs
- No inbound connections needed - only outbound HTTPS to GitHub
- Jobs run locally on the server with full Docker access

### Install GitHub Actions Runner

On the on-prem server:

```bash
# Create runner directory
mkdir -p ~/actions-runner && cd ~/actions-runner

# Download latest runner (check GitHub for current version)
curl -o actions-runner-linux-x64-2.331.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.331.0/actions-runner-linux-x64-2.331.0.tar.gz

# Extract
tar xzf ./actions-runner-linux-x64-2.331.0.tar.gz

# Get registration token from GitHub:
# Repository → Settings → Actions → Runners → New self-hosted runner
# Copy the token (expires in ~1 hour)

# Configure runner
./config.sh --url https://github.com/<org>/<repo> \
  --token <REGISTRATION_TOKEN> \
  --labels onprem,signing-server \
  --name <client>-onprem

# Install as systemd service (runs on boot)
sudo ./svc.sh install
sudo ./svc.sh start

# Verify it's running
sudo ./svc.sh status
```

### Verify Runner in GitHub

1. Go to: `https://github.com/<org>/<repo>/settings/actions/runners`
2. You should see your runner with status "Idle"

### Add On-Prem Secrets to GitHub

In repository Settings → Secrets and variables → Actions, add:

| Secret | Description | Where to Get It |
|--------|-------------|-----------------|
| `DOCUSEAL_API_TOKEN` | DocuSeal API token | DocuSeal UI → Settings → API |
| `SIGNING_ORCHESTRATOR_API_KEY` | API key for orchestrator | Generated during setup |
| `MTSA_SOAP_USERNAME` | MTSA/Trustgate username | From Trustgate |
| `MTSA_SOAP_PASSWORD` | MTSA/Trustgate password | From Trustgate |
| `DOCUSEAL_POSTGRES_PASSWORD` | DocuSeal database password | Your choice |
| `AGREEMENTS_DB_PASSWORD` | Orchestrator DB password | Your choice |

### Trigger On-Prem Deployment

**Via GitHub UI (Recommended):**
1. Go to Actions → "Deploy On-Prem Services"
2. Click "Run workflow"
3. Select branch (usually `main`)
4. Choose what to deploy:
   - `deploy_docuseal` - Deploy DocuSeal
   - `deploy_orchestrator` - Deploy Signing Orchestrator
   - `deploy_mtsa` - Deploy MTSA
   - `generate_env` - Regenerate environment files
5. Click "Run workflow"

**Via GitHub CLI:**
```bash
gh workflow run deploy-onprem.yml \
  -f deploy_docuseal=true \
  -f deploy_orchestrator=true \
  -f deploy_mtsa=true
```

### Safety Features

The on-prem workflow includes:
- **Manual trigger only** - never runs automatically
- **Pre-deployment backup** - databases and volumes backed up before changes
- **Selective deployment** - only deploy what you choose
- **Health checks** - verifies services after deployment

### Runner vs AWS Workflows

| Workflow | Runner Type | Trigger |
|----------|-------------|---------|
| Deploy Backend | `ubuntu-latest` (GitHub-hosted) | Push to main |
| Deploy Frontend | `ubuntu-latest` (GitHub-hosted) | Push to main |
| Deploy Admin | `ubuntu-latest` (GitHub-hosted) | Push to main |
| **Deploy On-Prem** | `[self-hosted, onprem]` | Manual only |

Both runner types work side-by-side without conflict.

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

## Quick Reference

### Key URLs After Deployment

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | `https://app.<domain>` | Customer-facing app |
| Admin | `https://admin.<domain>` | Admin dashboard |
| API | `https://api.<domain>` | Backend API |
| DocuSeal | `https://sign.<domain>` | Document signing |
| Orchestrator | `https://sign.<domain>/orchestrator` | Signing API |

### Key Commands

```bash
# AWS - Check ECS service status
aws ecs describe-services --cluster <client>-cluster --services <client>-backend

# AWS - View backend logs
aws logs tail /ecs/<client>/backend --follow

# On-Prem - Check all service status
./on-prem/scripts/deploy-all.sh status

# On-Prem - View logs
./on-prem/scripts/deploy-all.sh logs

# On-Prem - Restart services
cd on-prem && docker compose -f docker-compose.unified.yml restart

# GitHub Runner - Check status
sudo systemctl status actions.runner.*
```

### Configuration Files

| File | Purpose |
|------|---------|
| `client.json` | Client-specific configuration |
| `on-prem/.env.docuseal` | DocuSeal environment |
| `on-prem/.env.orchestrator` | Signing Orchestrator environment |
| `backend/.env` | Backend local dev environment |
| `frontend/.env` | Frontend local dev environment |

### Secrets Location

| Secret Type | Location |
|-------------|----------|
| AWS Secrets | AWS Secrets Manager (`<client>/prod/*`) |
| GitHub Secrets | Repository → Settings → Secrets → Actions |
| On-Prem Secrets | `.env.*` files on server |

---

## Support & Troubleshooting

### AWS Issues
- Check CloudWatch logs: `/ecs/<client>/*`
- Check ECS service events in AWS Console
- Verify secrets exist in Secrets Manager

### On-Prem Issues
- Check container logs: `docker logs <container-name>`
- Check Cloudflare Tunnel: `sudo systemctl status cloudflared`
- Verify MTSA image exists: `docker images | grep mtsa`

### Signing Issues
- Check orchestrator health: `curl https://sign.<domain>/orchestrator/health`
- Check MTSA WSDL: `curl http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl`
- Review agreement logs in orchestrator database

### GitHub Runner Issues
- Check runner status: `sudo ./svc.sh status` (from actions-runner dir)
- View runner logs: `journalctl -u actions.runner.* -f`
- Re-register if needed: `./config.sh remove` then reconfigure
