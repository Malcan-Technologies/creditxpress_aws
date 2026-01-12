# AWS ECS Deployment Guide - From Zero to Production

This is the definitive guide for deploying the Kredit platform to AWS ECS for a new client. Follow these steps in order.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step 1: AWS Account Setup](#step-1-aws-account-setup)
4. [Step 2: Configure Client Settings](#step-2-configure-client-settings)
5. [Step 3: Install Required Tools](#step-3-install-required-tools)
6. [Step 4: Create IAM User for CI/CD](#step-4-create-iam-user-for-cicd)
7. [Step 5: Configure GitHub Secrets](#step-5-configure-github-secrets)
8. [Step 6: Deploy Infrastructure with Terraform](#step-6-deploy-infrastructure-with-terraform)
9. [Step 7: Configure Application Secrets](#step-7-configure-application-secrets)
10. [Step 8: Create ACM Certificate](#step-8-create-acm-certificate)
11. [Step 9: Configure Cloudflare DNS](#step-9-configure-cloudflare-dns)
12. [Step 10: Initial Deployment](#step-10-initial-deployment)
13. [Step 11: Database Setup](#step-11-database-setup)
14. [Step 12: Verify Deployment](#step-12-verify-deployment)
15. [On-Premise Setup](#on-premise-setup)
16. [Troubleshooting](#troubleshooting)
17. [Cost Optimization](#cost-optimization)
18. [Security Checklist](#security-checklist)
19. [Quick Command Reference](#quick-command-reference)

---

## Prerequisites

Before starting, ensure you have:

- [ ] AWS account created (with billing enabled)
- [ ] Domain name registered and added to Cloudflare
- [ ] GitHub repository access (forked from template)
- [ ] On-premise server with Docker installed (for DocuSeal/MTSA)
- [ ] Local machine with terminal access

---

## Architecture Overview

```
                         ┌─────────────────────────────────────┐
                         │            Cloudflare               │
                         │   DNS + Proxy/WAF + Tunnel          │
                         └─────────────────────────────────────┘
                                        │
            ┌───────────────────────────┼───────────────────────────┐
            │                           │                           │
            ▼                           ▼                           ▼
     ┌────────────┐             ┌────────────┐             ┌────────────┐
     │app.domain  │             │api.domain  │             │sign.domain │
     │admin.domain│             │            │             │ (Tunnel)   │
     └────────────┘             └────────────┘             └────────────┘
            │                           │                           │
            ▼                           ▼                           ▼
     ┌────────────────────────────────────────┐             ┌────────────┐
     │              AWS ALB                   │             │ On-Prem    │
     │         (Host-based routing)           │             │  Server    │
     └────────────────────────────────────────┘             └────────────┘
            │               │               │                     │
            ▼               ▼               ▼               ┌─────┴─────┐
     ┌────────┐      ┌────────┐      ┌────────┐            │           │
     │Frontend│      │ Admin  │      │Backend │──▶ RDS     ▼           ▼
     │  ECS   │      │  ECS   │      │  ECS   │──▶ S3   DocuSeal    MTSA
     └────────┘      └────────┘      └────────┘          Signing
                                                       Orchestrator
```

**What runs where:**
- **AWS ECS Fargate**: Frontend, Admin, Backend containers
- **AWS RDS**: PostgreSQL database
- **AWS S3**: File uploads (documents, receipts)
- **Cloudflare**: DNS, SSL, WAF, Tunnel to on-prem
- **On-Premise**: DocuSeal, Signing Orchestrator, MTSA (via Cloudflare Tunnel)

---

## Step 1: AWS Account Setup

### 1.1 Create AWS Account
If you don't have an AWS account:
1. Go to https://aws.amazon.com/
2. Click "Create an AWS Account"
3. Complete registration with payment method
4. Select your preferred region (e.g., `ap-southeast-5` for Malaysia)

### 1.2 Get Your Account ID
```bash
# After setting up AWS CLI (Step 3), run:
aws sts get-caller-identity --query Account --output text
```

Or find it in AWS Console → Top right → Account ID

---

## Step 2: Configure Client Settings

Edit `client.json` at the repository root with your client's details:

```json
{
  "client_slug": "yourclient",
  "client_name": "Your Client Name",
  "environment": "production",
  
  "aws": {
    "region": "ap-southeast-5",
    "account_id": "123456789012"
  },
  
  "domains": {
    "app": "app.yourclient.com.my",
    "admin": "admin.yourclient.com.my",
    "api": "api.yourclient.com.my",
    "sign": "sign.yourclient.com.my"
  },
  
  "ecr": {
    "backend": "yourclient/backend",
    "frontend": "yourclient/frontend",
    "admin": "yourclient/admin"
  },
  
  "ecs": {
    "cluster": "yourclient-cluster",
    "backend_service": "yourclient-backend",
    "frontend_service": "yourclient-frontend",
    "admin_service": "yourclient-admin"
  },
  
  "rds": {
    "identifier": "yourclient-postgres",
    "database": "yourclient"
  },
  
  "s3": {
    "bucket": "yourclient-prod-files"
  },
  
  "secrets_prefix": "yourclient/prod",
  
  "branding": {
    "company_name": "Your Company Sdn. Bhd.",
    "primary_color": "#1a365d",
    "support_email": "support@yourclient.com.my"
  }
}
```

**Important**: Replace all `yourclient` values with your actual client slug.

---

## Step 3: Install Required Tools

### 3.1 AWS CLI

**macOS:**
```bash
brew install awscli
```

**Linux:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

**Windows:**
Download from https://aws.amazon.com/cli/

### 3.2 Configure AWS CLI
```bash
aws configure
# Enter:
# - AWS Access Key ID: (from Step 4)
# - AWS Secret Access Key: (from Step 4)
# - Default region: ap-southeast-5
# - Default output format: json
```

### 3.3 Terraform

**macOS:**
```bash
brew install terraform
```

**Linux:**
```bash
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

### 3.4 Docker
- **macOS/Windows**: Download Docker Desktop from https://docker.com
- **Linux**: Follow https://docs.docker.com/engine/install/

### 3.5 Session Manager Plugin (for ECS Exec)
```bash
# macOS
brew install --cask session-manager-plugin

# Linux
curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o "session-manager-plugin.deb"
sudo dpkg -i session-manager-plugin.deb
```

---

## Step 4: Create IAM User for CI/CD

### 4.1 Create User via Console (Recommended)

1. Go to AWS Console → IAM → Users → Create User
2. User name: `yourclient-cicd`
3. Select "Attach policies directly"
4. Attach these policies:
   - `AmazonEC2ContainerRegistryFullAccess`
   - `AmazonECS_FullAccess`
   - `AmazonRDSFullAccess`
   - `AmazonS3FullAccess`
   - `SecretsManagerReadWrite`
   - `AmazonVPCFullAccess`
   - `ElasticLoadBalancingFullAccess`
   - `IAMFullAccess` (needed for ECS task roles)
5. Create user
6. Go to Security credentials → Create access key
7. Select "Application running outside AWS"
8. **Save the Access Key ID and Secret Access Key** (you won't see it again!)

### 4.2 Or via CLI
```bash
# Create user
aws iam create-user --user-name yourclient-cicd

# Attach policies
for policy in \
  AmazonEC2ContainerRegistryFullAccess \
  AmazonECS_FullAccess \
  AmazonRDSFullAccess \
  AmazonS3FullAccess \
  SecretsManagerReadWrite \
  AmazonVPCFullAccess \
  ElasticLoadBalancingFullAccess \
  IAMFullAccess; do
  aws iam attach-user-policy \
    --user-name yourclient-cicd \
    --policy-arn arn:aws:iam::aws:policy/$policy
done

# Create access key (SAVE THE OUTPUT!)
aws iam create-access-key --user-name yourclient-cicd
```

---

## Step 5: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | Access Key ID from Step 4 |
| `AWS_SECRET_ACCESS_KEY` | Secret Access Key from Step 4 |

---

## Step 6: Deploy Infrastructure with Terraform

### 6.1 Create Terraform Variables File

```bash
cd infra/terraform
```

Create `terraform.tfvars`:
```hcl
# Database password (use a strong password!)
db_password = "YourSecurePassword123!"

# Optional: Override defaults
# db_instance_class = "db.t4g.small"
# ecs_backend_cpu = 512
# ecs_backend_memory = 1024
```

### 6.2 Initialize Terraform
```bash
terraform init
```

### 6.3 Preview Changes
```bash
terraform plan
```

Review the output. It should create:
- 1 VPC with subnets
- 3 ECR repositories
- 1 RDS PostgreSQL instance
- 1 S3 bucket
- 1 ECS cluster with 3 services
- 1 ALB with target groups
- Security groups and IAM roles
- Secrets Manager entries

### 6.4 Apply Infrastructure
```bash
terraform apply
```

Type `yes` when prompted.

**⏱️ This takes 10-15 minutes** (RDS creation is slow).

### 6.5 Save Terraform Outputs
```bash
terraform output > ../terraform-outputs.txt
```

Important outputs:
- `alb_dns_name` - Use for Cloudflare DNS
- `rds_endpoint` - Database connection string
- `s3_bucket_name` - File storage bucket
- `ecr_backend_url` - ECR repository URLs

---

## Step 7: Configure Application Secrets

After Terraform creates the infrastructure, populate the secrets:

```bash
# Set your prefix (must match client.json)
PREFIX="yourclient/prod"
REGION="ap-southeast-5"

# Generate and store JWT secrets
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/jwt-secret" \
  --secret-string "$(openssl rand -hex 64)" \
  --region $REGION

aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/jwt-refresh-secret" \
  --secret-string "$(openssl rand -hex 64)" \
  --region $REGION

# Signing Orchestrator API Key (save this - you'll need it for on-prem!)
SIGNING_KEY=$(openssl rand -hex 32)
echo "SIGNING_ORCHESTRATOR_API_KEY: $SIGNING_KEY"
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/signing-orchestrator-api-key" \
  --secret-string "$SIGNING_KEY" \
  --region $REGION

# WhatsApp API Token (get from Meta Business)
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/whatsapp-api-token" \
  --secret-string "your-whatsapp-token" \
  --region $REGION

# Resend API Key (get from resend.com)
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/resend-api-key" \
  --secret-string "re_xxxxxxxx" \
  --region $REGION

# CTOS Credentials (get from CTOS)
aws secretsmanager put-secret-value \
  --secret-id "$PREFIX/ctos-credentials" \
  --secret-string '{"username":"xxx","password":"xxx","api_key":"xxx"}' \
  --region $REGION
```

---

## Step 8: Create ACM Certificate

### 8.1 Request Certificate
```bash
aws acm request-certificate \
  --domain-name "*.yourclient.com.my" \
  --subject-alternative-names "yourclient.com.my" \
  --validation-method DNS \
  --region ap-southeast-5
```

### 8.2 Get Validation Records
```bash
aws acm describe-certificate \
  --certificate-arn "arn:aws:acm:ap-southeast-5:ACCOUNT_ID:certificate/CERT_ID" \
  --query 'Certificate.DomainValidationOptions' \
  --region ap-southeast-5
```

### 8.3 Add DNS Records in Cloudflare
Add the CNAME records from the output to Cloudflare DNS.

### 8.4 Update Terraform with Certificate ARN
Edit `infra/terraform/main.tf`:
```hcl
module "alb" {
  # ... existing config ...
  certificate_arn = "arn:aws:acm:ap-southeast-5:ACCOUNT_ID:certificate/CERT_ID"
}
```

Then apply:
```bash
cd infra/terraform
terraform apply
```

---

## Step 9: Configure Cloudflare DNS

### 9.1 Get ALB DNS Name
```bash
terraform output alb_dns_name
# Example: yourclient-alb-123456789.ap-southeast-5.elb.amazonaws.com
```

### 9.2 Add DNS Records in Cloudflare

Go to Cloudflare Dashboard → Your Domain → DNS

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | app | `yourclient-alb-xxx.elb.amazonaws.com` | ✅ Proxied |
| CNAME | admin | `yourclient-alb-xxx.elb.amazonaws.com` | ✅ Proxied |
| CNAME | api | `yourclient-alb-xxx.elb.amazonaws.com` | ✅ Proxied |

**Note**: `sign.*` is configured via Cloudflare Tunnel (see On-Premise Setup).

### 9.3 Configure Cloudflare SSL Settings
1. Go to SSL/TLS → Overview
2. Set encryption mode to "Full (strict)"
3. Go to Edge Certificates → Always Use HTTPS: ON
4. Minimum TLS Version: TLS 1.2

---

## Step 10: Initial Deployment

### Option A: Push to GitHub (Recommended)
```bash
git add .
git commit -m "Configure for AWS deployment"
git push origin main
```

This triggers GitHub Actions to build and deploy all services.

### Option B: Manual First Deploy

If you need to deploy before GitHub Actions is ready:

```bash
# Login to ECR
aws ecr get-login-password --region ap-southeast-5 | \
  docker login --username AWS --password-stdin \
  ACCOUNT_ID.dkr.ecr.ap-southeast-5.amazonaws.com

# Build and push backend
cd backend
docker build -t ACCOUNT_ID.dkr.ecr.ap-southeast-5.amazonaws.com/yourclient/backend:latest -f Dockerfile.prod .
docker push ACCOUNT_ID.dkr.ecr.ap-southeast-5.amazonaws.com/yourclient/backend:latest

# Build and push frontend
cd ../frontend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourclient.com.my \
  --build-arg NEXT_PUBLIC_SITE_URL=https://app.yourclient.com.my \
  -t ACCOUNT_ID.dkr.ecr.ap-southeast-5.amazonaws.com/yourclient/frontend:latest .
docker push ACCOUNT_ID.dkr.ecr.ap-southeast-5.amazonaws.com/yourclient/frontend:latest

# Build and push admin
cd ../admin
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourclient.com.my \
  --build-arg NEXT_PUBLIC_SITE_URL=https://admin.yourclient.com.my \
  -t ACCOUNT_ID.dkr.ecr.ap-southeast-5.amazonaws.com/yourclient/admin:latest .
docker push ACCOUNT_ID.dkr.ecr.ap-southeast-5.amazonaws.com/yourclient/admin:latest

# Force ECS to pull new images
aws ecs update-service --cluster yourclient-cluster --service yourclient-backend --force-new-deployment
aws ecs update-service --cluster yourclient-cluster --service yourclient-frontend --force-new-deployment
aws ecs update-service --cluster yourclient-cluster --service yourclient-admin --force-new-deployment
```

---

## Step 11: Database Setup

### 11.1 Run Migrations

**Via GitHub Actions:**
1. Go to Actions → "Deploy Backend to AWS ECS"
2. Click "Run workflow"
3. Set "Force run database migrations" to `true`
4. Set "Run database seed" to `true`
5. Click "Run workflow"

**Via CLI:**
```bash
# Get running task
TASK_ID=$(aws ecs list-tasks \
  --cluster yourclient-cluster \
  --service-name yourclient-backend \
  --query 'taskArns[0]' \
  --output text \
  --region ap-southeast-5)

# Run migrations
aws ecs execute-command \
  --cluster yourclient-cluster \
  --task $TASK_ID \
  --container backend \
  --interactive \
  --command "npx prisma migrate deploy" \
  --region ap-southeast-5

# Run seed
aws ecs execute-command \
  --cluster yourclient-cluster \
  --task $TASK_ID \
  --container backend \
  --interactive \
  --command "npx prisma db seed" \
  --region ap-southeast-5
```

---

## Step 12: Verify Deployment

### 12.1 Check ECS Services
```bash
aws ecs describe-services \
  --cluster yourclient-cluster \
  --services yourclient-backend yourclient-frontend yourclient-admin \
  --query 'services[*].[serviceName,runningCount,desiredCount]' \
  --output table \
  --region ap-southeast-5
```

Expected output:
```
-----------------------------------------
|          DescribeServices             |
+---------------------+----+----+-------+
|  yourclient-backend |  1 |  1 |
|  yourclient-frontend|  1 |  1 |
|  yourclient-admin   |  1 |  1 |
+---------------------+----+----+-------+
```

### 12.2 Test Endpoints
```bash
# Health check
curl https://api.yourclient.com.my/api/health

# Frontend
curl -I https://app.yourclient.com.my

# Admin
curl -I https://admin.yourclient.com.my/login
```

### 12.3 Check Logs
```bash
# Backend logs
aws logs tail /ecs/yourclient/backend --follow --region ap-southeast-5

# Frontend logs
aws logs tail /ecs/yourclient/frontend --follow --region ap-southeast-5
```

---

## On-Premise Setup

See `docs/NEW_CLIENT_GUIDE.md` Section 5 for detailed on-premise setup including:
- DocuSeal installation
- Signing Orchestrator setup
- MTSA configuration
- Cloudflare Tunnel setup

Quick overview:

```bash
# On your on-prem server
cd on-prem

# Copy and edit environment file
cp env.template .env
nano .env  # Fill in all values

# Copy and edit cloudflared config
cp cloudflared/config.template.yml cloudflared/config.yml
nano cloudflared/config.yml  # Update with your tunnel ID and domain

# Start services
docker compose -f docker-compose.unified.yml up -d
```

---

## Troubleshooting

### ECS Tasks Not Starting

```bash
# Check task failures
aws ecs describe-tasks \
  --cluster yourclient-cluster \
  --tasks $(aws ecs list-tasks --cluster yourclient-cluster --desired-status STOPPED --query 'taskArns[0]' --output text) \
  --query 'tasks[0].stoppedReason' \
  --region ap-southeast-5
```

Common issues:
- **Image not found**: ECR image wasn't pushed
- **Secrets not found**: Secrets Manager entries missing
- **Health check failed**: App not responding on expected port

### Database Connection Issues

```bash
# Get RDS endpoint
aws rds describe-db-instances \
  --db-instance-identifier yourclient-postgres \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text \
  --region ap-southeast-5

# Test connection (from ECS task)
aws ecs execute-command \
  --cluster yourclient-cluster \
  --task $TASK_ID \
  --container backend \
  --interactive \
  --command "npx prisma db execute --stdin <<< 'SELECT 1'"
```

### ECS Exec Not Working

```bash
# Enable ECS Exec on service
aws ecs update-service \
  --cluster yourclient-cluster \
  --service yourclient-backend \
  --enable-execute-command \
  --region ap-southeast-5

# Wait for new task to start
aws ecs wait services-stable --cluster yourclient-cluster --services yourclient-backend
```

### View Container Logs

```bash
# Get log streams
aws logs describe-log-streams \
  --log-group-name /ecs/yourclient/backend \
  --order-by LastEventTime \
  --descending \
  --limit 1 \
  --region ap-southeast-5

# Get recent logs
aws logs get-log-events \
  --log-group-name /ecs/yourclient/backend \
  --log-stream-name "LOG_STREAM_NAME" \
  --limit 100 \
  --region ap-southeast-5
```

---

## Cost Optimization

### Estimated Monthly Costs (Small Deployment)

| Service | Configuration | Est. Cost |
|---------|--------------|-----------|
| ECS Fargate | 3 services × 0.5 vCPU × 1GB | ~$30 |
| RDS | db.t4g.micro, 20GB | ~$15 |
| ALB | Base + requests | ~$20 |
| S3 | 10GB storage | ~$1 |
| ECR | 3 repos | ~$1 |
| Secrets Manager | 10 secrets | ~$4 |
| CloudWatch Logs | 5GB/month | ~$3 |
| **Total** | | **~$75/month** |

### Cost Saving Tips

1. **Avoid NAT Gateway**: Use public subnets (saves ~$30/month)
2. **Right-size RDS**: Start with `db.t4g.micro`, scale up as needed
3. **Spot Instances**: Not for Fargate, but consider for batch jobs
4. **S3 Lifecycle Policies**: Move old files to cheaper storage classes
5. **Log Retention**: Set CloudWatch log retention to 30 days

---

## Security Checklist

### Before Going Live

- [ ] All secrets stored in AWS Secrets Manager (not in code)
- [ ] RDS in private subnets (no public access)
- [ ] Security groups restrict traffic appropriately
- [ ] Cloudflare proxy enabled (hides origin ALB IP)
- [ ] ACM certificate installed for HTTPS
- [ ] IAM roles follow least privilege principle
- [ ] S3 bucket blocks public access
- [ ] Database password is strong (20+ chars)
- [ ] JWT secrets are unique and randomly generated
- [ ] Signing Orchestrator API key is secure

### Ongoing

- [ ] Enable AWS CloudTrail for audit logging
- [ ] Set up CloudWatch alarms for failures
- [ ] Regular security updates to base images
- [ ] Review IAM permissions quarterly
- [ ] Rotate secrets annually

---

## Quick Command Reference

| Task | Command |
|------|---------|
| Get AWS Account ID | `aws sts get-caller-identity --query Account --output text` |
| List ECR repos | `aws ecr describe-repositories --region ap-southeast-5` |
| List ECS services | `aws ecs list-services --cluster yourclient-cluster` |
| Check service status | `aws ecs describe-services --cluster yourclient-cluster --services yourclient-backend` |
| Force new deployment | `aws ecs update-service --cluster yourclient-cluster --service yourclient-backend --force-new-deployment` |
| View RDS endpoint | `aws rds describe-db-instances --query 'DBInstances[0].Endpoint.Address'` |
| List secrets | `aws secretsmanager list-secrets --region ap-southeast-5` |
| Tail logs | `aws logs tail /ecs/yourclient/backend --follow` |
| Connect to container | `aws ecs execute-command --cluster CLUSTER --task TASK --container backend --interactive --command "/bin/sh"` |

---

## Next Steps After Deployment

1. **Create Admin User**: Run seed or use Prisma Studio to create first admin
2. **Configure Branding**: Update logos, colors in frontend/admin
3. **Set Up WhatsApp**: Configure templates in Meta Business
4. **Set Up On-Prem**: Install DocuSeal, Signing Orchestrator, MTSA
5. **Test Signing Flow**: Verify document signing works end-to-end
6. **Configure Notifications**: Set up notification templates
7. **Go Live**: Update DNS TTL, switch traffic, monitor

---

*Last updated: January 2026*
