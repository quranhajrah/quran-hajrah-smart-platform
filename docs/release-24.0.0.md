# Release 24.0.0

Title: **Enterprise 24 Institutional Document Intelligence Engine**

Date: 2026-07-25

## Scope

This release adds local, deterministic institutional document extraction, human review, transactional import into Enterprise 23, and source traceability. It preserves the Enterprise 21–23 production runtime, authentication, RBAC, Knowledge Center, executive platform, health/readiness endpoints, Prisma deployment flow, and Hostinger entry file.

## Migration

```bash
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
npm run db:seed
```

Migration: `20260724_enterprise_24_document_intelligence`.

The migration is additive and contains no reset, truncate, delete, or table drop.

## Deployment

Use the existing Hostinger build:

```bash
npm run build:production
```

Hostinger continues to launch:

```text
apps/api/dist/server.js
```

No OCR, AI provider, new secret, Start Command, or entry-file change is required.

## Acceptance

Local validation and CI results are recorded in `docs/phase-24-document-intelligence-validation-report.md`. Production completion remains conditional on the checklist in the Enterprise 24 guide, including an authenticated analysis of the operational plan and budget, one approved import, and visible source traceability.
