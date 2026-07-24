# Release 23.0.0 — Enterprise 23 Executive Intelligence Platform

Release date: 2026-07-24

## Scope

This release adds institutional metrics, strategy/KPI management, operational initiatives, risk management, executive alerts, transparent health scoring, structured reports, an Arabic RTL executive dashboard, and a local structured-query assistant. It does not change the Hostinger entry file, delay server listening, add paid AI, fabricate measurements, or remove production data.

## Migration

`20260724_enterprise_23_executive_intelligence`

Production command:

```bash
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

The existing `postbuild:production` runs migration and idempotent seed before Hostinger launches `apps/api/dist/server.js`.

## Deployment

1. Confirm coordinated database/document backups and green GitHub Actions.
2. Deploy `main` through Hostinger using `npm run build:production`.
3. Confirm migration and seed in build logs.
4. Confirm `/health`, `/ready`, login, and default dashboard.
5. Verify read-only denial and authorized management.
6. Test one metric, KPI, initiative, risk, alert, and report with approved acceptance data.
7. Verify the common audit log and report approval separation.

Do not mark this release production-complete until every item in `hostinger/deployment-checklist.md` is verified on `https://app.quran-hajrah.com`.
