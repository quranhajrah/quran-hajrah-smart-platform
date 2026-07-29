# Quran Hajrah Smart Platform

Production TypeScript monorepo for the Quran Hajrah Smart Platform. It includes secure identity/RBAC, the Institutional Knowledge Center, the Executive Intelligence Platform, and the Institutional Document Intelligence Engine.

Current release: `26.1.0` — Professional Executive Writing.

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

## Institutional Knowledge Intelligence

Enterprise 25 adds a knowledge layer above the existing Knowledge Center without changing the frozen Enterprise 24.2.1 extraction engine:

- Versioned indexing of every current uploaded document version, using existing extracted pages when available and the same protected storage provider otherwise.
- Arabic-aware local feature embeddings combined with lexical overlap for hybrid ranking. The provider contract can later be replaced by an approved vector service without changing API consumers.
- Cross-document topic relationships derived only from shared evidence terms.
- Confidentiality-aware search under `/api/knowledge/search`.
- Extractive, evidence-bound answers under `/api/knowledge/answer`; every answer item includes a numbered document reference and page when available.
- An Arabic RTL workspace at `/knowledge-intelligence`.

This release does not call an LLM, paid AI service, OCR service, or external embedding API. Its “semantic” search is a deterministic local Arabic-aware vector/lexical implementation, and its answers quote or summarize retrieved evidence rather than inventing facts.

After the migration and seed have completed, backfill all existing uploaded documents:

```bash
npm run knowledge:index
```

New uploads are durably queued for indexing. Operators can also rebuild the index from the protected administration workspace. See [Enterprise 25 guide](docs/enterprise-25-institutional-knowledge-intelligence.md).

## Professional Executive Writing

Enterprise 26.1 upgrades the isolated Executive AI layer above the unchanged Enterprise 25 retrieval API:

- Arabic-first intent planning for vision, mission, beneficiaries, strategic objectives, and operational risks.
- Multi-query retrieval followed by executive evidence reranking with document-diversity preference.
- Professional Arabic writing for CEO briefs, Board reports, government correspondence, donor proposals, meeting minutes, executive reports, recommendations, decisions, and action plans.
- A read → understand → professionally rewrite pipeline that never places a document paragraph directly in the answer.
- Supporting quotations are returned in a separate response section, while the answer remains original executive prose.
- A hard citation invariant: the assistant returns `INSUFFICIENT_EVIDENCE` rather than answering when no authorized source is available.
- Numbered links to the source document, version, page, and section where available.
- Strict RBAC, per-user document confidentiality inherited from Enterprise 25, request rate limiting, and privacy-preserving audit metadata.
- Arabic RTL workspace at `/executive-assistant`.

The default professional writer is deterministic and local. It understands authorized evidence through themes, quantitative anchors, and status signals, then creates audience-specific Arabic prose without an external LLM or new secret. Provider interfaces still allow a separately approved model later without changing Enterprise 25 search. See the [Enterprise 26.1 guide](docs/enterprise-26-1-professional-executive-writing.md).

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
npm run document-analysis:alerts
```

The command is intentionally not scheduled by the application. Configure a Hostinger scheduler only after the operator approves its frequency and runtime environment.

## Institutional Document Intelligence

Enterprise 24.2 converts supported institutional documents into related, reviewable proposals:

```text
document → explicit analysis → pages/tables → deterministic proposals
→ human review and approval → conflict preview → transactional import
→ source evidence and audit history
```

Supported extraction is limited to PDFs with embedded text, DOCX, and TXT. Image-only PDFs are marked `OCR_REQUIRED`; this release does not call OCR, generative AI, embedding, or paid external services. No proposal is imported without an authorized human approval and import confirmation.

The deterministic semantic mapper reconstructs safely recognized RTL visual-order lines, assembles adjacent labels and values, merges split table headers, maps direction-independent columns, carries explicitly merged table values, separates beneficiary groups and operational objectives, links objectives to KPIs and initiatives, and links budgets to their lines. Raw page text remains stored separately from normalized text. Values without evidence remain missing, and low-confidence useful items are marked for review.

The admin analysis center is `/document-analysis`. The API is under `/api/document-analysis`, with explicit analysis start at `POST /api/documents/:id/analyze`. Analysis is never triggered automatically during upload.

The base migration is `20260724_enterprise_24_document_intelligence`; Enterprise 24.1 adds the non-destructive migration `20260726_enterprise_24_1_semantic_extraction`. Enterprise 24.2 and 24.2.1 require no schema migration. In 24.2.1 the review summary exposes job identity and the semantic extraction version, forced reanalysis always creates a new job, older semantic results are not reused, and strategic-axis titles are reconstructed from evidence instead of accepting ordinal-only values. The production seed adds analysis permissions, safe role defaults, versioned deterministic rule identifiers, and processing limits without seeding document-derived values. Scheduler-ready analysis alerts can be generated with:

```bash
npm run document-analysis:alerts
```

## Documentation

- [Authentication and RBAC](docs/authentication-and-rbac.md)
- [Institutional Knowledge Center](docs/institutional-knowledge-center.md)
- [Enterprise 23 usage guide](docs/enterprise-23-executive-intelligence.md)
- [Enterprise 24 analysis guide](docs/enterprise-24-document-intelligence.md)
- [Enterprise 24.1 semantic extraction guide](docs/enterprise-24-1-semantic-extraction.md)
- [Enterprise 24.2 semantic assembly guide](docs/enterprise-24-2-semantic-assembly.md)
- [Enterprise 24.2 validation report](docs/phase-24-2-validation-report.md)
- [Enterprise 24.2.1 identity and strategic reconstruction](docs/enterprise-24-2-1-analysis-identity.md)
- [Enterprise 24.2.1 validation report](docs/phase-24-2-1-validation-report.md)
- [Enterprise 25 institutional knowledge intelligence](docs/enterprise-25-institutional-knowledge-intelligence.md)
- [Enterprise 25 release notes](docs/release-25.0.0.md)
- [Enterprise 25 validation report](docs/phase-25-institutional-knowledge-validation-report.md)
- [Enterprise 26 Executive AI Assistant](docs/enterprise-26-executive-ai-assistant.md)
- [Enterprise 26 release notes](docs/release-26.0.0.md)
- [Enterprise 26 validation report](docs/phase-26-executive-ai-validation-report.md)
- [Enterprise 26.1 professional executive writing](docs/enterprise-26-1-professional-executive-writing.md)
- [Enterprise 26.1 release notes](docs/release-26.1.0.md)
- [Enterprise 26.1 validation report](docs/phase-26-1-professional-writing-validation-report.md)
- [Review and import guide](docs/enterprise-24-review-and-import.md)
- [Extraction methodology](docs/extraction-methodology.md)
- [Source traceability](docs/source-traceability.md)
- [Executive health score methodology](docs/executive-health-score-methodology.md)
- [KPI methodology](docs/kpi-methodology.md)
- [Risk methodology](docs/risk-methodology.md)
- [Administrator guide](docs/enterprise-23-administrator-guide.md)
- [Production architecture](docs/production-architecture.md)
- [Enterprise 21 production baseline](docs/enterprise-21-production-readiness.md)
- [Backup and restore](docs/backup-and-restore.md)
- [Hostinger deployment](hostinger/README.md)
