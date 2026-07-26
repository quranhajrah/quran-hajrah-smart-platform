# Enterprise 24.2.1 Validation Report

Date: 2026-07-27

Version: 24.2.1

Migration: none

## Implementation

- Added one application-owned semantic extraction version and used it for job and extracted-text persistence.
- Isolated parser/provider versions under provider metadata.
- Added semantic-version fingerprints, explicit old-version invalidation, and unique forced-reanalysis fingerprints.
- Kept failed-job retry on the same job while making document reanalysis create and open a new job.
- Added review diagnostics for job ID, extraction version, creation time, and document type.
- Reconstructed evidence-backed strategic-axis titles across split, multiline, and reversed ordinal/title layouts.
- Rejected ordinal-only strategic-axis proposals.
- Kept Enterprise 24.2 operational logical assembly and acceptance fixture behavior unchanged.

## Production inspection boundary

The latest production job pages/tables were not inspected from this execution environment because it had no authenticated production session or bearer token. No production content or data was downloaded or modified. The existing operational fixture is explicitly labelled as a sanitized reconstruction of the reported UAT shape, not as a direct production export.

The safe transformation contract for a future authorized capture is documented in `docs/enterprise-24-2-1-analysis-identity.md`. Live operational extraction acceptance therefore remains pending.

## Commands and results

- `npm run db:validate`: the first run correctly reported missing local `DIRECT_URL`; the second run passed with non-secret loopback validation URLs and made no database connection.
- `npm run db:generate`: passed; Prisma Client 6.19.3 generated.
- `npm run lint`: passed with zero warnings.
- `npm run typecheck`: passed for every workspace.
- `npm test`: passed outside the Windows filesystem sandbox after Vite's first sandboxed attempt was denied access to its own configuration path.
  - admin: 11 tests;
  - API: 110 tests;
  - portal: 1 test;
  - database: 29 tests;
  - total: 151 tests.
- `npm run build:production`: passed from a clean development install. Local postbuild database actions were intentionally suppressed, so no migration or seed could target an unidentified database. Prisma generation, every compiled package/application, Vite assets, and production lifecycle validation passed.
- `npm ci --omit=dev`: passed using the official postinstall Prisma generation.
- `npm run smoke:production`: passed for compiled server startup, logging, health/readiness behavior, admin/portal static assets, Knowledge Center, Executive Intelligence, Document Intelligence, and protected routes.
- `npm audit --omit=dev --audit-level=high`: passed with zero production vulnerabilities.
- `npm run security:check`: passed; no sensitive filenames were detected.

The clean development install reports advisories only in omitted development tooling. Production dependency audit is zero.

## Regression coverage

- semantic version persistence;
- parser version confined to metadata;
- fingerprint invalidation across semantic versions;
- defensive refusal to reuse a legacy-version job even if its fingerprint collides;
- distinct job IDs for every forced reanalysis;
- same job ID for retry;
- forced navigation to the API-returned job ID;
- review action labels and diagnostics;
- split strategic-axis label/ordinal/title;
- multiline title;
- ordinal before or after title;
- no ordinal-only proposals;
- Enterprise 24.2 operational beneficiaries, four objectives, four KPIs, evidence-backed initiatives, 530000 SAR total, budget lines, and source references using the sanitized UAT-reported fixture.

## Remaining acceptance

- GitHub Actions must pass after push.
- Hostinger must deploy the commit.
- `/health` and `/ready` must be verified live.
- An authorized user must force-reanalyze the real strategic and operational plans.
- The review must show a new job ID, version `24.2.1`, new creation time, and correct document type.
- Full strategic-axis titles and no ordinal-only proposals must be observed.
- The real operational plan must satisfy the requested beneficiary/objective/KPI/initiative/budget evidence gates.
- One complete related proposal set must be approved/imported and its source traceability verified.

Status: **local validation successful; production inspection, deployment, and live UAT pending**.
