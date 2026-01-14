# AWS Setup Guide - From Zero to Production

This guide covers setting up a new AWS deployment for the Kredit platform using **Cloudflare Tunnel** for ingress (no ALB required).

## Architecture Overview

```
Internet → Cloudflare Edge → Tunnel → ECS (Private Subnets)
                                      ├── Backend :4001
                                      ├── Frontend :3000
                                      └── Admin :3000
                              ↓
                          RDS PostgreSQL
```

**Key Benefits:**
- No load balancer costs (~$16-20/month saved)
- Zero exposed ports (all traffic through tunnel)
- Free SSL via Cloudflare
- DDoS protection included
- Works with new AWS accounts (no restrictions)

---

## Prerequisites

1. **AWS Account** with:
   - AWS CLI installed and configured
   - Billing verified (credit card on file)
   - IAM user with programmatic access

2. **Cloudflare Account** with:
   - Domain added and DNS managed by Cloudflare
   - Zero Trust dashboard access

3. **Tools Installed:**
   - Terraform >= 1.0
   - AWS CLI v2
   - Git

---

## Step 1: AWS IAM Setup

### Create Terraform IAM User

1. Go to **IAM → Users → Create User**
2. User name: `terraform-deployer`
3. Attach policies directly:
   - `AmazonECS_FullAccess`
   - `AmazonEC2ContainerRegistryFullAccess`
   - `AmazonRDSFullAccess`
   - `AmazonS3FullAccess`
   - `AmazonVPCFullAccess`
   - `SecretsManagerReadWrite`
   - `CloudWatchLogsFullAccess`
   - `AWSServiceDiscoveryFullAccess`

4. Create Access Key:
   - Security credentials tab → Create access key
   - Choose "Command Line Interface (CLI)"
   - Save the Access Key ID and Secret Access Key

### Configure AWS CLI

```bash
aws configure
# AWS Access Key ID: [paste from above]
# AWS Secret Access Key: [paste from above]
# Default region name: ap-southeast-5
# Default output format: json

# Verify
aws sts get-caller-identity
```

---

## Step 2: Configure client.json

Edit `client.json` in the repository root:

```json
{
  "client_slug": "your-client",
  "client_name": "Your Client Name",
  "environment": "production",
  
  "aws": {
    "region": "ap-southeast-5",
    "account_id": "YOUR_ACCOUNT_ID"
  },
  
  "domains": {
    "app": "app.yourdomain.com",
    "admin": "admin.yourdomain.com",
    "api": "api.yourdomain.com",
    "sign": "sign.yourdomain.com"
  },
  
  "ecr": {
    "backend": "your-client/backend",
    "frontend": "your-client/frontend",
    "admin": "your-client/admin"
  },
  
  "ecs": {
    "cluster": "your-client-cluster",
    "backend_service": "your-client-backend",
    "frontend_service": "your-client-frontend",
    "admin_service": "your-client-admin"
  },
  
  "rds": {
    "identifier": "your-client-postgres",
    "database": "your_client_db"
  },
  
  "s3": {
    "bucket": "your-client-prod-files"
  },
  
  "secrets_prefix": "your-client/prod",
  
  "branding": {
    "company_name": "Your Company Name",
    "primary_color": "#1a365d",
    "support_email": "support@yourdomain.com"
  }
}
```

Get your AWS Account ID:
```bash
aws sts get-caller-identity --query Account --output text
```

---

## Step 3: Cloudflare Setup

### 3.1 Clean Up Existing DNS Records

Before setting up the tunnel, remove any existing A records pointing to old infrastructure:

1. Go to **Cloudflare Dashboard → DNS → Records**
2. **DELETE** these record types (if they exist):

| Type | Name | Action |
|------|------|--------|
| A | `@` (root domain) | ❌ Delete |
| A | `www` | ❌ Delete |
| A | `api` | ❌ Delete |
| A | `admin` | ❌ Delete |
| A | `app` | ❌ Delete |
| NS | (pointing to non-Cloudflare nameservers) | ❌ Delete |

3. **KEEP** these records:
   - MX records (email)
   - TXT records (SPF, DKIM, DMARC, verification)

### 3.2 Create Cloudflare Tunnel

1. Go to **Cloudflare Dashboard → Zero Trust → Networks → Tunnels**
2. Click **Create a tunnel**
3. Select **Cloudflared** connector type
4. Name: `your-client-cloud` (for AWS services)
5. **Copy the tunnel token** - you'll need this for AWS Secrets Manager

### 3.3 Configure Tunnel Routes (Public Hostnames)

In the tunnel configuration, add these public hostnames:

| Hostname | Service |
|----------|---------|
| `yourdomain.com` | `http://frontend.your-client.local:3000` |
| `api.yourdomain.com` | `http://backend.your-client.local:4001` |
| `admin.yourdomain.com` | `http://admin.your-client.local:3000` |

> **Note:** The `.local` DNS names use AWS Service Discovery. After Terraform runs, it will output the exact namespace to use.

> **Note:** Cloudflare Tunnel automatically creates CNAME records for each hostname pointing to your tunnel.

### 3.4 Configure WWW to Root Redirect

To redirect `www.yourdomain.com` to `yourdomain.com`:

1. Go to **Cloudflare Dashboard → Rules → Redirect Rules**
2. Click **Create rule**
3. Configure:
   - **Rule name:** `WWW to root redirect`
   - **When incoming requests match:** Custom filter expression
   - **Expression:** `(http.host eq "www.yourdomain.com")`
   - **Then:** Dynamic Redirect
   - **Status code:** 301 (Permanent)
   - **URL:** `concat("https://yourdomain.com", http.request.uri.path)`
4. Click **Deploy**
5. When prompted about DNS record, select **"Ignore and deploy rule anyway"**

### 3.5 Configure SSL/TLS Settings

1. Go to **Cloudflare Dashboard → SSL/TLS → Overview**
2. Set encryption mode to **Full** (not "Full (strict)")

3. Go to **SSL/TLS → Edge Certificates**
4. Enable these settings:
   - **Always Use HTTPS:** On
   - **Automatic HTTPS Rewrites:** On
   - **Minimum TLS Version:** TLS 1.2

### 3.6 Recommended Security Settings

1. Go to **Security → Settings**
2. Set **Security Level:** Medium or High

3. Go to **Security → Bots**
4. Enable **Bot Fight Mode** (free tier available)

### 3.7 Understanding HTTPS with Cloudflare Tunnel

Traffic flow:
```
User (HTTPS) → Cloudflare Edge → Tunnel (encrypted) → ECS (HTTP)
```

- **Cloudflare manages SSL certificates** for your domain automatically
- **The tunnel is encrypted** between Cloudflare and your `cloudflared` container
- **Internal traffic uses HTTP** within your VPC (secure, never exposed)
- **No SSL certificates needed** on your ECS containers

---

## Step 4: Run Terraform

```bash
cd infra/terraform

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply infrastructure
terraform apply
```

### What Terraform Creates:
- VPC with public/private subnets
- NAT Gateway for private subnet internet access
- RDS PostgreSQL instance
- S3 bucket for file storage
- ECR repositories for Docker images
- ECS Fargate cluster with:
  - Backend service
  - Frontend service
  - Admin service
  - Cloudflared service (tunnel connector)
- AWS Secrets Manager placeholders
- Service Discovery DNS namespace

---

## Step 5: Populate Secrets

After Terraform completes, populate the secrets in AWS Secrets Manager:

```bash
# Get secrets prefix from outputs
terraform output secrets_prefix

# Set secrets (replace with your actual values)
aws secretsmanager put-secret-value \
  --secret-id "your-client/prod/cloudflare-tunnel-token" \
  --secret-string "YOUR_TUNNEL_TOKEN_HERE"

aws secretsmanager put-secret-value \
  --secret-id "your-client/prod/jwt-secret" \
  --secret-string "$(openssl rand -base64 32)"

aws secretsmanager put-secret-value \
  --secret-id "your-client/prod/jwt-refresh-secret" \
  --secret-string "$(openssl rand -base64 32)"

# For other secrets, see docs/THIRD_PARTY_INTEGRATIONS.md
```

---

## Step 6: Verify Cloudflare Tunnel Config

After Terraform runs, verify the service discovery namespace matches your tunnel configuration:

```bash
terraform output service_discovery_namespace
# Output: your-client.local

terraform output cloudflare_tunnel_ingress
```

Ensure your Cloudflare Tunnel hostnames use the correct service endpoints:

| Hostname | Service | Port |
|----------|---------|------|
| `yourdomain.com` | `http://frontend.your-client.local` | 3000 |
| `api.yourdomain.com` | `http://backend.your-client.local` | 4001 |
| `admin.yourdomain.com` | `http://admin.your-client.local` | 3000 |

> **Important:** If you're using the root domain (e.g., `creditxpress.com.my`) instead of a subdomain like `app.`, make sure your tunnel routes to the frontend service.

---

## Step 7: Configure GitHub Actions

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

| Secret Name | Description |
|-------------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `AWS_REGION` | `ap-southeast-5` |
| `AWS_ACCOUNT_ID` | Your AWS account ID |

The workflows in `.github/workflows/` will automatically:
- Build Docker images
- Push to ECR
- Deploy to ECS

---

## Step 8: Initial Deployment

Push code to trigger the first deployment:

```bash
git add .
git commit -m "Initial AWS deployment"
git push origin main
```

Or manually trigger via GitHub Actions:
1. Go to Actions → Deploy All
2. Select services to deploy
3. Enable "Run database migrations" for first deployment
4. Enable "Run database seed" for first deployment
5. Click "Run workflow"

---

## Step 9: Run Database Migrations

For the first deployment, run migrations:

```bash
# Find the backend task
TASK_ID=$(aws ecs list-tasks \
  --cluster your-client-cluster \
  --service-name your-client-backend \
  --query 'taskArns[0]' --output text)

# Execute migration
aws ecs execute-command \
  --cluster your-client-cluster \
  --task $TASK_ID \
  --container backend \
  --interactive \
  --command "npx prisma migrate deploy"

# Run seed (optional)
aws ecs execute-command \
  --cluster your-client-cluster \
  --task $TASK_ID \
  --container backend \
  --interactive \
  --command "npx prisma db seed"
```

---

## Verification

### Check ECS Services

```bash
# View running services
aws ecs list-services --cluster your-client-cluster

# Check service status
aws ecs describe-services \
  --cluster your-client-cluster \
  --services your-client-backend your-client-frontend your-client-admin
```

### Check Cloudflared Logs

```bash
aws logs tail /ecs/your-client/cloudflared --follow
```

### Test Endpoints

After cloudflared is running:
- https://api.yourdomain.com/api/health
- https://app.yourdomain.com
- https://admin.yourdomain.com

---

## Troubleshooting

### Services Not Starting

```bash
# Check service events
aws ecs describe-services \
  --cluster your-client-cluster \
  --services your-client-backend \
  --query 'services[0].events[:5]'

# Check task logs
aws logs tail /ecs/your-client/backend --since 10m
```

### Cloudflared Can't Connect

1. Verify tunnel token is set correctly in Secrets Manager
2. Check cloudflared logs for connection errors
3. Ensure tunnel is enabled in Cloudflare dashboard

### DNS Record Conflicts

**Error:** `An A, AAAA, or CNAME record with that host already exists`

This happens when adding tunnel routes and existing DNS records conflict:

1. Go to **Cloudflare Dashboard → DNS → Records**
2. Delete the conflicting A record for that hostname
3. Retry adding the tunnel public hostname
4. Cloudflare Tunnel will create the correct CNAME automatically

### WWW Redirect Not Working

1. Verify the redirect rule is deployed in **Rules → Redirect Rules**
2. Check that no DNS record for `www` is bypassing Cloudflare (should be proxied)
3. If prompted about DNS when creating the rule, select "Ignore and deploy rule anyway"

### 502 Bad Gateway Errors

This usually means cloudflared can't reach your ECS services:

1. Check the service discovery namespace is correct:
   ```bash
   terraform output service_discovery_namespace
   ```
2. Verify ECS services are running and healthy:
   ```bash
   aws ecs describe-services \
     --cluster your-client-cluster \
     --services your-client-backend your-client-frontend
   ```
3. Check cloudflared logs for connection errors:
   ```bash
   aws logs tail /ecs/your-client/cloudflared --since 10m
   ```
4. Ensure the port numbers in tunnel config match your services (backend: 4001, frontend/admin: 3000)

### SSL/HTTPS Issues

1. Ensure SSL mode is set to **Full** (not "Full (strict)" or "Flexible")
2. Wait up to 24 hours for Universal SSL certificate provisioning on new domains
3. Check **SSL/TLS → Edge Certificates** for certificate status

### Database Connection Issues

1. Check RDS security group allows connections from ECS security group
2. Verify DATABASE_URL secret is set correctly
3. Check backend logs for connection errors

---

## Cost Estimate (Monthly)

| Resource | Spec | Cost |
|----------|------|------|
| ECS Fargate (4 services) | 0.25 vCPU, 512MB each | ~$25-30 |
| RDS PostgreSQL | db.t4g.micro | ~$12-15 |
| S3 + Secrets Manager | Minimal usage | ~$2-5 |
| **Total** | | **~$40-50/month** |

> **Note:** This is the cost-optimized configuration with no NAT Gateway. ECS services run in public subnets with public IPs but remain secure (no inbound ports open, all traffic via Cloudflare Tunnel).

---

## Next Steps

- [Third-Party Integrations](./THIRD_PARTY_INTEGRATIONS.md) - Set up Resend, WhatsApp, CTOS
- [New Client Guide](./NEW_CLIENT_GUIDE.md) - Fork for new clients
