# Changelog

All notable changes to Quran Hajrah Smart Platform are documented here.

## Unreleased

## [26.1.0] - 2026-07-29

### Enterprise 26.1 Professional Executive Writing

- Replaced extractive-looking document synthesis with a professional Arabic executive-writing pipeline.
- Added distinct CEO, Board, government-correspondence, donor-proposal, meeting-minutes, executive-report, recommendation, decision, and action-plan styles.
- Added semantic theme, quantitative-anchor, and status interpretation before drafting.
- Separated supporting quotations from the original executive answer and added a direct-paragraph-copy guard.
- Expanded the Executive AI API, administration workspace, and regression coverage without changing Enterprise 25 retrieval or Enterprise 24 extraction.
- Added no schema migration, external provider, runtime secret, or Hostinger entry-file change.

## [26.0.0] - 2026-07-27

### Enterprise 26 Executive AI Assistant

- Added an isolated Arabic-first executive reasoning layer above the unchanged Enterprise 25 retrieval service.
- Added intent-aware query planning, evidence reranking, document-diversity preference, and strict source-bound synthesis.
- Added sourced executive questions, Board reports, CEO recommendations, and official-letter drafts.
- Added a hard no-evidence/no-answer rule, source links, confidentiality inheritance, rate limits, and hashed audit metadata.
- Added Executive AI RBAC defaults, an Arabic RTL administration workspace, tests, and operating documentation.
- Added no schema migration, external AI service, new secret, or change to the Enterprise 25 search implementation.

## [25.0.0] - 2026-07-27

### Enterprise 25 Institutional Knowledge Intelligence

- Added a versioned institutional knowledge index for document versions, evidence-preserving chunks, cross-document relationships, safe query telemetry, and configurable local indexing.
- Added Arabic-aware local feature embeddings and hybrid semantic/lexical ranking behind replaceable provider interfaces, without external AI calls or new secrets.
- Added confidentiality-aware search and extractive institutional answers in which every returned statement is tied to a document, version, page where available, and source link.
- Added durable upload-time indexing queues, explicit document and full-corpus indexing APIs, and the production `npm run knowledge:index` backfill command.
- Added an Arabic RTL Knowledge Intelligence workspace with index health, semantic search, sourced answers, and explicit capability limitations.
- Added knowledge RBAC defaults, additive migration `20260727_enterprise_25_institutional_knowledge`, migration safety tests, ranking/chunking/citation tests, and deployment guidance.
- Kept the Enterprise 24.2.1 document extraction engine frozen and unchanged.

## [24.2.1] - 2026-07-27

### Enterprise 24.2.1 Analysis Identity and Strategic Reconstruction

- Separated the semantic extraction version (`24.2.1`) from PDF/DOCX/TXT provider versions and retained provider identity only in provider metadata.
- Added the semantic version to the stable analysis fingerprint, invalidating reusable jobs from older semantic releases while ensuring forced reanalysis always creates a distinct job.
- Distinguished same-job **إعادة المحاولة** from new-job **إعادة التحليل**, navigated directly to the new job, and displayed job ID, extraction version, creation time, and document type in the review summary.
- Applied evidence-preserving logical assembly and quality gates to strategic plans, joining split/multiline axis labels and rejecting ordinal-only axis proposals.
- Added lifecycle, fingerprint, review-action, strategic-axis, and existing operational-plan acceptance regression coverage without a schema migration.

## [24.2.0] - 2026-07-26

### Enterprise 24.2 Production-Structure Semantic Assembly

- Added an evidence-preserving in-memory logical record assembler for multiline labels/values, RTL value-label order, and split beneficiary text.
- Expanded deterministic production table aliases, split-header reconstruction, direction-independent column mapping, and merged objective/category carry-forward.
- Added evidence-backed extraction for operational objectives, KPIs, supported initiatives, split beneficiary groups, budget totals in either order, and budget lines.
- Preserved page, line, table, row, cell, and merged-cell references inside existing proposal data without a schema migration.
- Cleared stale analysis errors after successful review-center loads and restricted failure details to `FAILED` and `OCR_REQUIRED`.
- Added a sanitized three-page/one-table regression fixture that contains no confidential association prose and verifies the production acceptance structure.

## [24.1.0] - 2026-07-26

### Enterprise 24.1 Institutional Semantic Extraction Upgrade

- Reconstructed embedded Arabic PDF text from split glyphs and reversed visual word order while retaining raw text separately from normalized text.
- Added deterministic section detection, beneficiary grouping, operational-objective, KPI, initiative, responsibility, date, budget-total, budget-line, and table-row semantic mapping.
- Added evidence-backed proposal quality gates that reject headings, numeric-only titles, duplicate normalized titles, orphaned relations, and unsupported values.
- Added persistent proposal relationships and relation-aware transactional import into Enterprise 23 without automatic beneficiary measurement imports.
- Upgraded the Arabic review center with institutional grouping, extraction summaries, relationship visibility, explicit import targets, and low-confidence counts.
- Added an additive migration, production operational-plan fixture, RTL reconstruction, semantic mapping, relation, import, UI, security, and migration tests.

### Fixed

- Moved the production document-storage fallback out of replaceable deployment directories into the application user's persistent home, rejected relative production roots, and added cross-release upload/retrieve/analyze/delete coverage.
- Added stage-aware production diagnostics for document retrieval, PDF parsing, text extraction, proposal generation, page persistence, and finalization without logging document contents.
- Prevented large multi-page analysis results from exceeding Prisma's default interactive-transaction window while preserving atomic rollback.
- Allowed PDF.js to recover from non-fatal structural defects and repaired visually reversed Arabic institutional headings only when safely detected.
- Added a generated operational-plan PDF integration fixture covering page extraction and evidence-backed proposal generation without committing private association documents.

## [24.0.0] - 2026-07-25

### Enterprise 24 Institutional Document Intelligence Engine

- Added an additive document-analysis schema for jobs, pages, text, tables, cells, proposals, fields, reviews, imports, source evidence, configuration, audit, and budget records.
- Added bounded PDF embedded-text, DOCX, and TXT extraction behind a provider abstraction, with PDF page boundaries, ordered table cells, malformed/encrypted-file handling, and DOCX decompression-bomb protection.
- Added deterministic Arabic institutional rules and specialized strategic-plan, operational-plan, budget, governance, financial-report, and policy extractors without external AI or OCR calls.
- Added explicit, confidentiality-aware analysis APIs, review and approval workflows, conflict preview, transactional idempotent import, and source traceability.
- Added the Arabic RTL analysis and review center, Knowledge Center actions, executive dashboard summaries, and source links on imported executive records.
- Added narrowly scoped RBAC permissions, safe role defaults, scheduler-ready analysis alerts, and an idempotent default analysis configuration.
- Added provider, rule, API, RBAC, confidentiality, rate-limit, atomic-import, source-traceability, and migration-compatibility tests.
- Removed the affected React Router production dependency after a newly published advisory and replaced it with a bounded same-origin SPA router covered by navigation and external-target tests.

### Fixed

- Guaranteed the sixteen Knowledge Center categories and eight owning departments through an additive migration and the idempotent production seed.
- Added protected category, owning-department, and combined document lookup endpoints.
- Prevented the upload form from rendering empty required selectors and separated lookup loading from dashboard-summary loading.
- Replaced generic Zod failures with safe Arabic field-level validation details and aligned the document form's keyword, tag, optional-field, and date payload rules with the API.

## [23.0.0] - 2026-07-24

### Enterprise 23 Executive Intelligence Platform

- Added a production executive data model for institutional metrics, strategy, KPIs, initiatives, milestones, risks, treatments, alerts, dashboard preferences, health snapshots, and reports.
- Added an additive Prisma migration and idempotent seed for executive permissions, 20 metric definitions without fabricated measurements, health-score weights, and default dashboard preferences.
- Added authenticated, validated, paginated, audited, and server-side RBAC-protected executive APIs.
- Added transparent KPI, initiative, budget, risk, and executive-health calculations with explicit missing-data behavior.
- Added structured alert generation and a scheduler-ready command without introducing a runtime cron dependency.
- Added structured Arabic executive queries backed only by local database queries and no external AI calls.
- Made the Arabic RTL executive dashboard the default authenticated landing page and added responsive management interfaces and dependency-free charts.
- Added unit, API, authorization, security, migration-compatibility, report-workflow, and UI validation coverage.

## [22.0.0] - 2026-07-23

### Enterprise 22 Institutional Knowledge Center

- Added production document, category, version, tag, access-rule, and audit models with a committed additive Prisma migration.
- Added protected metadata, upload, search, filter, download, version, archive, restore, soft-delete, dashboard, and audit APIs.
- Added local/Hostinger storage behind a provider interface with path containment, opaque names, type/signature checks, and size limits.
- Added confidentiality-aware authorization and nine narrowly scoped document permissions.
- Added the Arabic RTL executive document dashboard, upload workflow, advanced filters, details, version history, and audit history.
- Added idempotent seed data for 16 institutional categories and future AI contracts without external calls.
- Added API, authorization, upload-security, storage-boundary, and interface validation coverage.
- Made first-super-administrator provisioning idempotent and production-safe, with a one-time generated password, session revocation, and audit logging.
- Added a disabled-by-default Hostinger post-build administrator bootstrap that never logs its temporary password and can be removed after one deployment.

## [21.0.0] - 2026-07-22

### Enterprise 21 Production Readiness

- Added a unified production build and compiled-only start command.
- Added single-process serving for the admin and portal SPAs through Express.
- Added PostgreSQL readiness checks, deployment/status commands, and safe diagnostics.
- Added strict production environment validation, proxy-aware secure cookies, and CORS allowlisting.
- Added structured request logging, request IDs, process error handlers, and graceful shutdown.
- Added production security headers, cache controls, and explicit API/static routing boundaries.
- Added Hostinger Cloud environment, deployment, and rollback operator checklists.
- Added production integration tests and a GitHub Actions production verification job.

## [20.2.0] - 2026-07-22

### Foundation and Identity RBAC Release

- Established the Node.js and TypeScript monorepo foundation.
- Added React and Vite administration and portal applications.
- Added the Express API, PostgreSQL, Prisma, Docker, and CI foundations.
- Added secure authentication with short-lived access tokens and rotating refresh sessions.
- Added users, roles, permissions, RBAC middleware, and audit logging.
- Added the Arabic RTL administration interface for identity management.
- Added database migrations, system-role and permission seed data, and secure initial administrator creation.
- Added automated lint, type, test, build, Prisma, dependency, and sensitive-file validation.
