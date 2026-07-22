# Quran Hajrah Smart Platform 20.2.0

**Release title:** Foundation and Identity RBAC Release  
**Release date:** 2026-07-22

## Summary

Version 20.2.0 delivers the production-oriented project foundation and the identity and role-based access control layer. It intentionally does not include association operational modules.

## Included

- npm workspaces monorepo with TypeScript.
- React/Vite/Tailwind administration and portal shells.
- Express API with centralized validation and error handling.
- PostgreSQL and Prisma identity schema and initial migration.
- Secure login, refresh rotation, logout, current account, and password change.
- User, role, permission, and audit APIs protected by RBAC.
- Arabic RTL administration pages for login, account, users, roles, permissions, and audit history.
- Secure environment configuration, Docker assets, and GitHub Actions validation.
- Automated integration tests for authentication, authorization, user safety rules, audit logging, and the admin login flow.

## Deployment requirements

- Node.js 20 or newer.
- PostgreSQL 16 or compatible supported version.
- Required secrets supplied through the deployment environment; no default administrator credential exists.
- Run database migration and seed commands before securely creating the first administrator.

See `docs/authentication-and-rbac.md` for configuration and operational instructions.
