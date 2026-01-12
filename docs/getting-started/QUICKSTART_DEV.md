# Kredit Platform — Developer Quickstart Guide

Quick reference for getting the local development environment up and running.

## Prerequisites

- **Docker** + **Docker Compose** (for database and backend)
- **Node.js 20+**
- **pnpm** (recommended package manager)

```bash
# Install pnpm globally if not installed
npm install -g pnpm
```

---

## 1. Start the Database (PostgreSQL)

The fastest way to get Postgres running locally is via Docker Compose:

```bash
# From project root — start Postgres and backend containers
cd backend
docker compose -f docker-compose.dev.yml up -d
```

This starts:
| Service   | Port  | Description                        |
|-----------|-------|------------------------------------|
| postgres  | 5432  | PostgreSQL 16 database             |
| backend   | 4001  | Express API with hot reload        |

**Database credentials (dev):**
- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Password: `postgres`
- Database: `kapital`

---

## 2. Environment Setup

### Backend

The backend container reads from `.env` in `backend/`. Copy the example:

```bash
cd backend
cp .env.example .env
```

Minimum required variables are already set in `docker-compose.dev.yml`, but for local `pnpm dev` outside Docker:

```bash
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kapital?schema=public
JWT_SECRET=your-dev-secret
JWT_REFRESH_SECRET=your-dev-refresh-secret
PORT=4001
NODE_ENV=development
TIMEZONE=Asia/Kuala_Lumpur
```

### Frontend

```bash
cd frontend
cp .env.example .env
```

```bash
# frontend/.env
NEXT_PUBLIC_API_URL=http://localhost:4001
```

### Admin

```bash
cd admin
cp .env.example .env
```

```bash
# admin/.env
NEXT_PUBLIC_API_URL=http://localhost:4001
```

---

## 3. Install Dependencies

Run these in parallel (separate terminals) or sequentially:

```bash
# Frontend
cd frontend
pnpm install

# Admin
cd admin
pnpm install

# Backend (only needed if running outside Docker)
cd backend
pnpm install
```

---

## 4. Database Commands

### Via Docker (recommended)

```bash
# Start database + backend
docker compose -f backend/docker-compose.dev.yml up -d

# View backend logs
docker compose -f backend/docker-compose.dev.yml logs -f backend

# Stop everything
docker compose -f backend/docker-compose.dev.yml down

# Reset database (removes volume)
docker compose -f backend/docker-compose.dev.yml down -v
docker compose -f backend/docker-compose.dev.yml up -d
```

The Docker container automatically:
1. Waits for Postgres to be healthy
2. Runs `prisma generate`
3. Runs `prisma db push` (syncs schema)
4. Starts the dev server with hot reload

### Via pnpm (if running backend locally)

```bash
cd backend

# Generate Prisma client
pnpm prisma:generate

# Push schema to database (creates/updates tables)
pnpm prisma:push

# Run migrations (production-style)
pnpm prisma:migrate

# Open Prisma Studio (GUI for database)
pnpm prisma:studio

# Seed the database with sample data
pnpm prisma:seed
```

---

## 5. Start Development Servers

### Option A: Full Docker Stack (Backend + DB)

```bash
# Terminal 1 — Backend + Postgres via Docker
docker compose -f backend/docker-compose.dev.yml up -d

# Terminal 2 — Frontend
cd frontend
pnpm dev

# Terminal 3 — Admin
cd admin
pnpm dev
```

### Option B: Local Backend (pnpm)

```bash
# Terminal 1 — Postgres only
docker compose -f backend/docker-compose.dev.yml up -d postgres

# Terminal 2 — Backend
cd backend
pnpm dev

# Terminal 3 — Frontend
cd frontend
pnpm dev

# Terminal 4 — Admin
cd admin
pnpm dev
```

---

## 6. Access Points

| App        | URL                        | Description               |
|------------|----------------------------|---------------------------|
| Frontend   | http://localhost:3000      | Customer-facing app       |
| Admin      | http://localhost:3002      | Admin dashboard           |
| Backend    | http://localhost:4001      | Express API               |
| Swagger    | http://localhost:4001/api-docs | API documentation      |
| Prisma Studio | http://localhost:5555   | Database GUI (if running) |

---

## 7. Common Commands Reference

### Docker Compose

```bash
# Rebuild backend container after dependency changes
docker compose -f backend/docker-compose.dev.yml up -d --build backend

# Full rebuild (all services)
docker compose -f backend/docker-compose.dev.yml down && \
docker compose -f backend/docker-compose.dev.yml up -d --build

# Check container status
docker compose -f backend/docker-compose.dev.yml ps

# Execute command in running container
docker compose -f backend/docker-compose.dev.yml exec backend sh
```

### pnpm Scripts

```bash
# Frontend / Admin
pnpm dev          # Start dev server with Turbo
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint

# Backend
pnpm dev          # Start with ts-node-dev (hot reload)
pnpm build        # Compile TypeScript
pnpm start        # Run compiled JS
```

---

## 8. Troubleshooting

### Database Connection Issues

```bash
# Check if Postgres is running
docker compose -f backend/docker-compose.dev.yml ps postgres

# Check Postgres logs
docker compose -f backend/docker-compose.dev.yml logs postgres

# Test connection
docker compose -f backend/docker-compose.dev.yml exec postgres psql -U postgres -d kapital -c "SELECT 1"
```

### Prisma Issues

```bash
# Regenerate Prisma client
cd backend
pnpm prisma:generate

# Reset database completely
docker compose -f backend/docker-compose.dev.yml down -v
docker compose -f backend/docker-compose.dev.yml up -d
```

### Port Already in Use

```bash
# Find process using port
lsof -i :4001  # Backend
lsof -i :3000  # Frontend
lsof -i :3002  # Admin
lsof -i :5432  # Postgres

# Kill process
kill -9 <PID>
```

### Clear node_modules and Reinstall

```bash
# Using pnpm
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## 9. Project Structure

```
creditxpress_aws/
├── backend/                 # Express API + Prisma
│   ├── docker-compose.dev.yml  # Dev containers
│   ├── prisma/              # Schema + migrations
│   ├── src/                 # Source code
│   └── uploads/             # Uploaded files
├── frontend/                # Customer Next.js app (port 3000)
├── admin/                   # Admin Next.js app (port 3002)
├── on-prem/                 # On-premises signing services
├── docs/                    # Documentation
└── scripts/                 # Deployment scripts
```

---

## 10. Quick One-Liner

**Start everything from scratch:**

```bash
# Clone, install, and run
cd backend && docker compose -f docker-compose.dev.yml up -d && \
cd ../frontend && pnpm install && pnpm dev &
cd ../admin && pnpm install && pnpm dev &
```

**Or step by step:**

```bash
# 1. Start database + backend
docker compose -f backend/docker-compose.dev.yml up -d

# 2. Install frontend deps and start
cd frontend && pnpm install && pnpm dev

# 3. Install admin deps and start (new terminal)
cd admin && pnpm install && pnpm dev
```

---

## Need Help?

- **API Documentation**: Check Swagger at http://localhost:4001/api-docs
- **Database Schema**: See `backend/prisma/schema.prisma`
- **Backend Docs**: Browse `backend/docs/`
- **Project Overview**: Read `AGENTS.md` or `README.md`
