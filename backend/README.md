# Backend (API & Services)

TypeScript Express API with Prisma (PostgreSQL), JWT auth + refresh tokens, OTP via WhatsApp, scheduled late-fee processing, and Swagger docs.

## Run (Docker)
```bash
# From repo root
docker compose -f docker-compose.dev.yml up -d --build
# Rebuild backend container
docker compose -f docker-compose.dev.yml down && docker compose -f docker-compose.dev.yml up -d
```

- Base URL: `http://localhost:4001`
- Swagger UI: `http://localhost:4001/api-docs`
- Static uploads: `/uploads/*`

## Environment
Create `.env` here with at least:
```ini
PORT=4001
DATABASE_URL=postgresql://kapital:kapital123@localhost:5432/kapital
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:3002
BASE_URL=http://localhost:4001
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me-refresh
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=755314160989646
WHATSAPP_USE_OTP_TEMPLATE=true
TIMEZONE=Asia/Kuala_Lumpur
```
Notes
- Prisma client generation runs on container start (avoids volume override).
- Dates stored in UTC; business logic uses Malaysia timezone (UTC+8).

## Auth
- Bearer JWT in `Authorization`
- Access token (15m) + refresh token (90d)
- Phone verification via WhatsApp OTP
- Admin routes require `role = ADMIN`
- Password policy (signup and password change): min 8 chars, at least 1 uppercase, at least 1 special character, and no spaces. Existing passwords unaffected; policy enforced on new signups and changes.

## Scheduling (Cron)
- Daily late-fee processing at 1:00 AM MYT (UTC+8) via node-cron
- Scheduler: `src/lib/cronScheduler.ts`
- Processor: `src/lib/lateFeeProcessor.ts`

## Key Routes (src/api)
- `auth.ts`: login, signup, OTP, refresh, reset
- `users.ts`: profile, docs, phone change
- `products.ts`: list/one (query by code)
- `loan-applications.ts`: CRUD, docs, attestation, history, fresh-offer response (accept → PENDING_ATTESTATION; reject → PENDING_APPROVAL)
- `loans.ts`: loans, details, repayments, transactions, late-fees
- `wallet.ts`: wallet, transactions, deposit/withdraw, repay-loan
- `notifications.ts`: list/mark/delete
- `settings.ts`: system settings (admin)
- `bank-accounts.ts`: payout accounts (default + admin CRUD)
- `admin/late-fees.ts`: status, process, waive, logs
- `admin.ts`: applications, documents, etc.

## Migrations
- Prisma schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/*`
- Check production status:
```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate status | cat
```

## WhatsApp
- Graph v22; service: `src/lib/whatsappService.ts`
- OTP template (`WHATSAPP_USE_OTP_TEMPLATE=true`) and utility templates (loan/payment events)

## Docs
- Admin API: `docs/admin-api-guide.md`
- Late fees: `docs/LATE_FEE_PAYMENT_HANDLING.md`
- Metrics: `docs/ADMIN_DASHBOARD_METRICS.md`
- Payment schedule: `docs/PAYMENT_SCHEDULE_UPDATE.md`
- Migrations: `docs/MIGRATION_BEST_PRACTICES.md`, `docs/MIGRATION_RECOVERY_SYSTEM.md`
