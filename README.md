## Kredit.my — Fintech Lending Platform

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)](https://nextjs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/) [![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/) [![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)

TypeScript-first, Dockerized monorepo for consumer & SME lending. Customer site, admin dashboard, and API with WhatsApp Business notifications, token auth, and timezone-accurate finance logic.

### Features
- **Lending core**: applications, disbursements, repayments, wallets, late fees
- **Admin dashboard**: approvals, notifications, users, products, analytics
- **Notifications**: WhatsApp Business (OTP, approvals, rejections, disbursements, payments)
- **Auth**: JWT + refresh tokens; secure admin API patterns
- **Timezones**: Malaysia (UTC+8) calculations; DB timestamps in UTC
- **Frontend**: Next.js App Router, RSC-first, Shadcn UI + Tailwind

### Monorepo Structure
```
backend/   # Express API, Prisma, cron jobs, WhatsApp service
frontend/  # Customer app (Next.js)
admin/     # Admin dashboard (Next.js)
config/    # Nginx and infra config
scripts/   # Deployment & helper scripts
```

### Quick Start (Docker)
Prerequisites: Docker + Docker Compose

```bash
# From project root
# 1) Start dev stack
docker compose -f docker-compose.dev.yml up -d --build

# 2) Check Prisma migration status (prod example)
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate status | cat

# 3) Rebuild backend container if needed
docker compose -f docker-compose.dev.yml down && \
  docker compose -f docker-compose.dev.yml up -d
```

Notes
- Prisma client generation runs on container start (avoids volume override issues)
- Admin API calls must include Authorization headers (JWT with refresh tokens)
 - Daily late-fee processing cron runs at 1:00 AM MYT (UTC+8) via node-cron; see `backend/src/lib/cronScheduler.ts` (scheduling) and `backend/src/lib/lateFeeProcessor.ts` (processing)

### KYC microservices (OCR, Face, Liveness) – Dev

These run as Python FastAPI sidecars and are orchestrated by the backend compose file.

```bash
# Start backend + KYC services (from project root)
docker compose -f backend/docker-compose.dev.yml up -d --build backend ocr face liveness

# Start everything defined in backend compose (backend, postgres, KYC services)
docker compose -f backend/docker-compose.dev.yml up -d --build

# Tail logs for a specific service
docker compose -f backend/docker-compose.dev.yml logs -f backend | cat
docker compose -f backend/docker-compose.dev.yml logs -f ocr | cat
docker compose -f backend/docker-compose.dev.yml logs -f face | cat
docker compose -f backend/docker-compose.dev.yml logs -f liveness | cat

# Rebuild only one KYC service
docker compose -f backend/docker-compose.dev.yml up -d --build ocr
```

- Service ports and endpoints (dev):
  - **OCR**: `http://localhost:7001/ocr`
  - **Face**: `http://localhost:7002/face-match`
  - **Liveness**: `http://localhost:7003/liveness`
- Uploaded images are served by the backend at `http://localhost:4001/uploads/...`.
- When running these services via Docker, the backend auto-targets them if `KYC_DOCKER=true`.

Minimum backend `.env` additions for KYC:

```bash
# KYC one-time token + routing
KYC_DOCKER=true
KYC_JWT_SECRET=change-me
KYC_TOKEN_TTL_MINUTES=15

# Optional thresholds (defaults shown)
KYC_FACE_THRESHOLD=0.75
KYC_LIVENESS_THRESHOLD=0.5
```

Troubleshooting:

```bash
# Check backend health
curl -s http://localhost:4001/api/health | jq

# Verify OCR stub is reachable
curl -s -X POST http://localhost:7001/ocr -H 'Content-Type: application/json' -d '{"frontUrl":"/uploads/kyc/example.png"}' | cat
```

### Start Apps with PM2 (local)

Frontend (port 3002)
```bash
cd frontend
npm install
npm run build
pm2 start npm --name "growkapital-frontend" -- start -- --port 3002 --hostname 0.0.0.0
pm2 save
```

Admin (port 3003)
```bash
cd admin
npm install
npm run build
PORT=3003 pm2 start npm --name "growkapital-admin" -- start -- --hostname 0.0.0.0
pm2 save
```

PM2 basics
```bash
pm2 ls
pm2 restart growkapital-frontend
pm2 restart growkapital-admin
pm2 logs growkapital-frontend --lines 50 --nostream
```

### Environment Variables (essentials)
Backend (`backend/.env`):
```
DATABASE_URL=postgresql://user:pass@db:5432/kapital
JWT_SECRET=change-me
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=755314160989646
WHATSAPP_USE_OTP_TEMPLATE=true
TIMEZONE=Asia/Kuala_Lumpur
```

Frontend/Admin (`frontend/.env`, `admin/.env`):
```
NEXT_PUBLIC_API_URL=http://localhost:4001
```
Use fallback in code: `process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001"`.

### Docs & Guides
- **API guide (canonical)**: `API_DOCUMENTATION.md`
- **System docs**: `backend/docs/*`
- **Swagger**: `backend/swagger/swagger.json`
- **Brand style**: `BRAND_STYLE_GUIDE.md`

### Documentation Index
- API reference and auth flows: `API_DOCUMENTATION.md`
- Backend overview: `backend/README.md`
- Admin API details: `backend/docs/admin-api-guide.md`
- Late fee system and cron: `backend/docs/LATE_FEE_PAYMENT_HANDLING.md`
- Admin dashboard metrics: `backend/docs/ADMIN_DASHBOARD_METRICS.md`
- Payment schedule logic: `backend/docs/PAYMENT_SCHEDULE_UPDATE.md`
- Migrations: `backend/docs/MIGRATION_BEST_PRACTICES.md`, `backend/docs/MIGRATION_RECOVERY_SYSTEM.md`

### Contributing
- Keep TS strict & functional; avoid classes
- Use `fetchWithAdminTokenRefresh` for admin-protected calls
- Follow Shadcn/Tailwind + brand guide

### Deployment
- Scripts in `scripts/`
- Rebuild example:
  - `docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d`

Made with Next.js, Node.js, Prisma, and ❤️
