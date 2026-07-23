# Quran Hajrah Smart Platform

Production TypeScript monorepo for the Quran Hajrah Smart Platform. It includes the secure identity/RBAC foundation, Hostinger production runtime, and the Institutional Knowledge Center.

Current release: `22.0.0` — Enterprise 22 Institutional Knowledge Center.

## Structure

```text
apps/
  admin/       React + Vite Arabic administration application
  portal/      React + Vite public portal
  api/         Express identity and document API
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

Hostinger may use `npm run build:production` or `npm run build:hostinger`. Hostinger launches `apps/api/dist/server.js` directly so the HTTP listener is not delayed. `postbuild:production` applies committed migrations through `DIRECT_URL` with:

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

`create:admin` requires `ADMIN_EMAIL`, `ADMIN_FULL_NAME`, and `ADMIN_PASSWORD`; no default credential exists.

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

## Documentation

- [Authentication and RBAC](docs/authentication-and-rbac.md)
- [Institutional Knowledge Center](docs/institutional-knowledge-center.md)
- [Production architecture](docs/production-architecture.md)
- [Enterprise 21 production baseline](docs/enterprise-21-production-readiness.md)
- [Hostinger deployment](hostinger/README.md)
