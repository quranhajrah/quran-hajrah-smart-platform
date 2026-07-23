# Changelog

All notable changes to Quran Hajrah Smart Platform are documented here.

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
