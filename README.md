# Quran Hajrah Smart Platform

Production TypeScript monorepo for the Quran Hajrah Smart Platform. It includes secure identity/RBAC, the Institutional Knowledge Center, and the Executive Intelligence Platform.

Current release: `23.0.0` — Enterprise 23 Executive Intelligence Platform.

## Structure

```text
apps/
  admin/       React + Vite Arabic administration application
  portal/      React + Vite public portal
  api/         Express identity, knowledge, and executive intelligence API
packages/
  shared/      Shared TypeScript utilities and types
  auth/        Authentication package
  database/    Prisma client, migrations, and PostgreSQL schema
  ui/          Shared React UI package
docs/          Architecture, operations, and module documentation
hostinger/     Production deployment and recovery checklists
```

## Requirements and local setup

- Node.js 20+
- npm 10+
- PostgreSQL, locally or through Docker

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The admin app uses port `5173`, portal uses `5174`, and API uses `3000`.

## Quality commands

```bash
npm run security:check
npm run lint
npm run typecheck
npm test
npm run db:validate
npm run db:generate
npm run build
```

## Production

```bash
npm run build:production
npm run start:production
```

Hostinger may use `npm run build:production` or `npm run build:hostinger`. Hostinger launches `apps/api/dist/server.js` directly so the HTTP listener is not delayed. `postbuild:production` applies committed migrations through `DIRECT_URL`, runs the idempotent system seed, and conditionally provisions the first administrator before Hostinger launches the entry file. The migration command remains:

```bash
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

`prestart:production` provides the same migration guard for npm-managed starts. Production serves admin at `/`, portal at `/portal/`, API at `/api`, liveness at `/health`, and PostgreSQL readiness at `/ready`.

Database commands:

```bash
npm run db:status
npm run db:diagnostics
npm run db:deploy
npm run db:seed
npm run create:admin
```

`create:admin` requires `ADMIN_EMAIL` and `ADMIN_FULL_NAME`. When `ADMIN_PASSWORD` is omitted, it generates a strong temporary password and prints it once. If the email already exists, the command activates the account, rotates its password, revokes its sessions, and adds `super_admin` without creating a duplicate.

Because Hostinger has no interactive production terminal, the one-time production bootstrap uses hPanel environment variables:

1. Set `ADMIN_BOOTSTRAP_ENABLED=true`, `ADMIN_EMAIL`, `ADMIN_FULL_NAME`, and a strong `ADMIN_TEMP_PASSWORD`.
2. Deploy once. The bootstrap creates or updates the user without logging the password.
3. Verify login and change the temporary password.
4. Remove all four bootstrap variables, or set `ADMIN_BOOTSTRAP_ENABLED=false` and remove the other three, then deploy again.

Bootstrap runs only when the enable flag is exactly `true`; missing or invalid values fail the deployment. See `docs/first-production-super-administrator.md`.

## Institutional Knowledge Center

Enterprise 22 provides the first production business module at `/documents` in admin and `/api/documents` in the API:

- Arabic RTL dashboard, search, filters, upload, details, versions, audit, archive, and restore.
- Metadata and binary-file APIs protected by the existing JWT authentication and document permissions.
- Confidentiality levels with role-aware access checks and optional per-user/per-role access rules.
- Local persistent storage behind a provider interface; responses never expose storage paths, generated names, or checksums.
- Additive migration `20260723190000_enterprise_22_knowledge_center`.
- Idempotent seed of document permissions and 16 institutional categories.
- Placeholder contracts for extraction, chunking, embeddings, semantic search, citations, and a future knowledge assistant; no AI provider is called.

Production operators must set `DOCUMENT_STORAGE_ROOT` to a persistent, non-public Hostinger directory and include that directory in encrypted backups. `DOCUMENT_MAX_FILE_SIZE_MB` defaults to 25.

## Executive Intelligence Platform

Enterprise 23 makes the Arabic RTL executive dashboard the authenticated landing page and adds:

- An institutional metric registry with measurements, targets, thresholds, history, and trends.
- Strategic objectives, KPIs, operational initiatives, milestones, progress updates, budgets, and evidence links.
- An institutional risk register with automatic scores, heat matrix, treatments, deadlines, and evidence.
- Reusable executive alert generation for expiring documents, delayed initiatives, at-risk KPIs, critical risks, overdue treatments, budget overruns, inactive users, and missing reports.
- A transparent 0–100 executive health score with configurable weights, component scores, data coverage, missing-data disclosure, and historical snapshots.
- Structured executive reports with editable stored sections, approval workflow, print view, and source references.
- A local structured-query assistant labelled “مساعد تنفيذي — إصدار البيانات المؤسسية”; it performs database queries only and does not call a generative AI provider.

The idempotent seed creates 20 metric **definitions** but never inserts uncertain association measurements. Enter the first real measurement through the protected API or administration interface. Alert generation is scheduler-ready:

```bash
npm run executive:alerts
```

The command is intentionally not scheduled by the application. Configure a Hostinger scheduler only after the operator approves its frequency and runtime environment.

## Documentation

- [Authentication and RBAC](docs/authentication-and-rbac.md)
- [Institutional Knowledge Center](docs/institutional-knowledge-center.md)
- [Enterprise 23 usage guide](docs/enterprise-23-executive-intelligence.md)
- [Executive health score methodology](docs/executive-health-score-methodology.md)
- [KPI methodology](docs/kpi-methodology.md)
- [Risk methodology](docs/risk-methodology.md)
- [Administrator guide](docs/enterprise-23-administrator-guide.md)
- [Production architecture](docs/production-architecture.md)
- [Enterprise 21 production baseline](docs/enterprise-21-production-readiness.md)
- [Backup and restore](docs/backup-and-restore.md)
- [Hostinger deployment](hostinger/README.md)
