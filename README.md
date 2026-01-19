# Kredit Platform — Fintech Lending Platform

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/) [![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/) [![AWS](https://img.shields.io/badge/AWS-ECS%20Fargate-FF9900?logo=amazon-aws)](https://aws.amazon.com/ecs/) [![Cloudflare](https://img.shields.io/badge/Cloudflare-Tunnel-F38020?logo=cloudflare)](https://www.cloudflare.com/)

TypeScript-first lending platform for Malaysia. Consumer/SME loans, KYC, digital signing (PKI), repayments, and notifications.

---

## Quick Start (Local Development)

### Prerequisites
- Docker + Docker Compose
- Node.js 20+
- pnpm (`npm install -g pnpm`)

### 1. Start Database & Backend

```bash
docker compose -f backend/docker-compose.dev.yml up -d
```

This starts PostgreSQL (port 5432) and the backend API (port 4001) with hot reload.

### 2. Start Frontend Apps

```bash
# Terminal 1 - Customer app
cd frontend && pnpm install && pnpm dev

# Terminal 2 - Admin dashboard
cd admin && pnpm install && pnpm dev
```

### 3. Access

| App | URL |
|-----|-----|
| Frontend | http://localhost:3000 |
| Admin | http://localhost:3002 |
| API | http://localhost:4001 |
| Swagger | http://localhost:4001/api-docs |

📖 **Full guide**: [`docs/QUICKSTART_DEV.md`](docs/QUICKSTART_DEV.md)

---

## Architecture

```
                         ┌─────────────────────────┐
                         │       Cloudflare        │
                         │   DNS + WAF + Tunnel    │
                         └───────────┬─────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
   app.domain                  api.domain                  sign.domain
  admin.domain                                           (via Tunnel)
         │                           │                           │
         ▼                           ▼                           ▼
┌────────────────────────────────────────────┐    ┌──────────────────────┐
│              AWS (Cloud)                   │    │   On-Prem Server     │
├────────────────────────────────────────────┤    ├──────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │  ┌────────────────┐  │
│  │ Frontend │ │  Admin   │ │ Backend  │   │    │  │    DocuSeal    │  │
│  │   ECS    │ │   ECS    │ │   ECS    │   │    │  │   (Port 3001)  │  │
│  └──────────┘ └──────────┘ └────┬─────┘   │    │  └────────────────┘  │
│                                 │         │    │  ┌────────────────┐  │
│                          ┌──────┴──────┐  │    │  │   Orchestrator │  │
│                          │ RDS + S3    │  │    │  │   (Port 4010)  │  │
│                          └─────────────┘  │    │  └────────────────┘  │
└────────────────────────────────────────────┘    │  ┌────────────────┐  │
                                                  │  │     MTSA       │  │
                                                  │  │   (Port 8080)  │  │
                                                  │  └────────────────┘  │
                                                  └──────────────────────┘
```

| Component | Stack | Purpose |
|-----------|-------|---------|
| **Frontend** | Next.js + AWS ECS | Customer-facing app |
| **Admin** | Next.js + AWS ECS | Admin dashboard |
| **Backend** | Express + AWS ECS | API + business logic |
| **Database** | PostgreSQL (RDS) | Primary data store |
| **DocuSeal** | On-prem Docker | Document signing UI |
| **Orchestrator** | On-prem Docker | PKI signing bridge |
| **MTSA** | On-prem Docker | Trustgate digital signatures |
| **Cloudflare** | DNS + Tunnel | Routes traffic, secures on-prem |

---

## Project Structure

```
├── backend/              # Express API + Prisma ORM
├── frontend/             # Customer Next.js app (port 3000)
├── admin/                # Admin Next.js app (port 3002)
├── on-prem/              # On-premise signing services
│   ├── scripts/          # Setup & deployment scripts
│   ├── docs/             # On-prem documentation
│   └── docker-compose.unified.yml
├── infra/                # Terraform for AWS
├── docs/                 # Platform documentation
├── .github/workflows/    # CI/CD pipelines
└── client.json           # Client-specific configuration
```

---

## Documentation

| Guide | Description |
|-------|-------------|
| [`docs/getting-started/QUICKSTART_DEV.md`](docs/getting-started/QUICKSTART_DEV.md) | Local development setup |
| [`docs/getting-started/NEW_CLIENT_GUIDE.md`](docs/getting-started/NEW_CLIENT_GUIDE.md) | Full client onboarding (AWS + On-Prem) |
| [`docs/getting-started/THIRD_PARTY_INTEGRATIONS.md`](docs/getting-started/THIRD_PARTY_INTEGRATIONS.md) | External services (CTOS, WhatsApp, etc.) |
| [`on-prem/docs/GITHUB_RUNNER_SETUP.md`](on-prem/docs/GITHUB_RUNNER_SETUP.md) | On-prem CI/CD with GitHub Actions |
| [`on-prem/docs/CLOUDFLARE_TUNNEL_SETUP.md`](on-prem/docs/CLOUDFLARE_TUNNEL_SETUP.md) | Cloudflare Tunnel configuration |
| [`on-prem/docs/MTSA_CONTAINER_INTEGRATION.md`](on-prem/docs/MTSA_CONTAINER_INTEGRATION.md) | Trustgate MTSA setup |

---

## Key Features

- **Lending**: Applications, offers, disbursements, repayments, wallets, late fees
- **KYC**: CTOS eKYC integration, document verification, face matching
- **Digital Signing**: DocuSeal + MTSA PKI signatures (legally binding)
- **Notifications**: WhatsApp Business API + Email (Resend)
- **Admin**: Dashboard, approvals, attestation, settings, user management

## Third-Party Services

| Service | Purpose |
|---------|---------|
| **AWS** | ECS Fargate, RDS, S3, Secrets Manager |
| **Cloudflare** | DNS, WAF, Tunnel (on-prem access) |
| **CTOS** | eKYC, credit reports |
| **WhatsApp Business** | OTP, notifications |
| **DocuSeal** | Document templates, e-signatures |
| **Trustgate MTSA** | PKI digital signatures |
| **Resend** | Email notifications |

---

## Environment Setup

### Backend (`backend/.env`)
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kapital
JWT_SECRET=your-secret
```

### Frontend/Admin (`.env`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:4001
```

---

## Common Commands

```bash
# Rebuild backend container
docker compose -f backend/docker-compose.dev.yml up -d --build backend

# Full restart
docker compose -f backend/docker-compose.dev.yml down && \
docker compose -f backend/docker-compose.dev.yml up -d

# Database reset
docker compose -f backend/docker-compose.dev.yml down -v && \
docker compose -f backend/docker-compose.dev.yml up -d

# Prisma Studio (DB GUI)
cd backend && pnpm prisma:studio

# View logs
docker compose -f backend/docker-compose.dev.yml logs -f backend
```

---

## Production Deployment

### AWS (Cloud Services)

```bash
git push origin main  # Triggers CI/CD for backend, frontend, admin
```

### On-Prem (Signing Services)

Via GitHub Actions UI:
1. Go to **Actions** → **Deploy On-Prem Services**
2. Click **Run workflow** → Select services → **Run**

Or via CLI:
```bash
gh workflow run deploy-onprem.yml -f deploy_orchestrator=true
```

> **Note:** On-prem requires a self-hosted GitHub runner. See [`on-prem/docs/GITHUB_RUNNER_SETUP.md`](on-prem/docs/GITHUB_RUNNER_SETUP.md)

---

## Contributing

- TypeScript strict mode, functional patterns
- Use `fetchWithAdminTokenRefresh` for admin API calls
- Follow Shadcn/Tailwind + brand guide
- Use pnpm for package management

---

## Configuration

All client-specific settings are in `client.json`:

```json
{
  "client_slug": "clientname",
  "domains": {
    "app": "app.client.com",
    "admin": "admin.client.com",
    "api": "api.client.com",
    "sign": "sign.client.com"
  },
  "onprem": {
    "enabled": true,
    "mtsa": { "container_image": "mtsa-pilot:latest" }
  }
}
```

Additional settings (Sign URL, Server IP, Company info) are configured via **Admin Panel → Settings**.

---

Made with Next.js, Express, Prisma, and TypeScript
