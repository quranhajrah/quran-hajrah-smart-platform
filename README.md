# Quran Hajrah Smart Platform

Clean TypeScript monorepo scaffold for the Quran Hajrah Smart Platform. It contains infrastructure and empty application shells only; business modules and product pages are intentionally not implemented yet.

Current release: `21.0.0` — Enterprise 21 Production Readiness.

## Structure

```text
apps/
  admin/       React + Vite administration shell
  portal/      React + Vite public portal shell
  api/         Express API shell
packages/
  shared/      Shared TypeScript utilities and types
  auth/        Authentication package placeholder
  database/    Prisma client and PostgreSQL schema
  ui/          Shared React UI package placeholder
docs/          Architecture and development notes
```

## Requirements

- Node.js 20+
- npm 10+
- Docker (optional, for PostgreSQL and the API container)

## Getting started

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD and DATABASE_URL in .env before starting the database.
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Run PostgreSQL locally with `docker compose up -d postgres`. The admin app uses port `5173`, portal uses `5174`, and API uses `3000`.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run security:check
npm run db:validate
```

## Production

```bash
npm run build:production
npm run start:production
```

Production serves admin at `/`, portal at `/portal/`, API at `/api`, liveness at `/health`, and PostgreSQL readiness at `/ready`. Configure every required environment value from `.env.example`; the production process intentionally fails when essential values are absent.

Database deployment commands:

```bash
npm run db:status
npm run db:diagnostics
npm run db:deploy
npm run db:seed
npm run create:admin
```

See `docs/production-architecture.md`, `docs/enterprise-21-production-readiness.md`, and `hostinger/README.md` before deployment.

## Identity and access management

Set the required values documented in `.env.example`, seed the system roles and permissions, then create the first administrator without a default credential:

```bash
npm run db:seed
npm run create:admin
```

The administrator command requires `ADMIN_EMAIL`, `ADMIN_FULL_NAME`, and `ADMIN_PASSWORD` in the environment and fails when any value is missing. See `docs/authentication-and-rbac.md` for the authentication flow, RBAC model, API security, and operational guidance.
