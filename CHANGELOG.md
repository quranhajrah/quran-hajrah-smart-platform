# Changelog

All notable changes to Quran Hajrah Smart Platform are documented here.

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
