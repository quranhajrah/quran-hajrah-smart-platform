# Enterprise 21 Production Readiness

## Final architecture

A single Express process listens on Hostinger's `PORT`, serves `/api`, exposes liveness/readiness, and serves both React builds. Admin is at `/`; portal is at `/portal/`. Detailed routing and controls are in `production-architecture.md`.

## Commands

```bash
npm ci
npm run build:production
npm run start:production
```

The start command runs compiled JavaScript only. Production database operations are deliberately separate:

```bash
npm run db:status
npm run db:diagnostics
npm run db:deploy
npm run db:seed
npm run create:admin
```

`db:seed` is idempotent and creates system roles and permissions only. `create:admin` has no default password and fails without explicit operator environment values.

## Environment

Use `.env.example` as a name checklist only. Enter real values in Hostinger hPanel or an approved secret manager. Startup requires production database URLs, exact origins, three independent secrets, secure cookies, proxy trust, TTLs, rate limits, and a valid platform port. Error messages name missing variables but never print values.

`DATABASE_URL` should use the provider's pooled/runtime endpoint when recommended. `DIRECT_URL` must be suitable for Prisma migrations. Both must point to the same intended production database and use encrypted transport according to the provider's instructions.

## Hostinger Cloud

Use the official public GitHub repository, branch `main`, Node.js 20.x, repository root, `npm run build:production`, and `npm run start:production`. The production build command performs a clean install with devDependencies before compiling through `build:artifacts`; the exact operator steps are in `hostinger/`.

Hostinger documents GitHub import, Express support, selectable Node versions, environment variables in hPanel, custom domain connection, automatic SSL after connection, and deployment/runtime logs. Relevant official links are included in the Hostinger checklists.

## Backup and restoration

Backups belong to the PostgreSQL provider, never the Git repository. Enable automated backups and point-in-time recovery where available. Before migration, record the current commit and create a provider snapshot. Test restoration into a separate non-production database periodically and run `/ready` plus authentication smoke tests against that restored copy.

For an application-only regression, redeploy the last known-good commit. For a schema issue, prefer a forward migration. Database snapshot restoration is an incident operation requiring impact review; never improvise destructive SQL or commit database exports.

## Rollback

1. Stop or isolate new traffic if data integrity is at risk.
2. Record logs, deployed commit, and Prisma migration status.
3. Redeploy the known-good Git commit in Hostinger.
4. Restore PostgreSQL only if application rollback cannot safely use the migrated schema.
5. Verify `/health`, `/ready`, login, refresh, logout, and a protected route.
6. Document the incident outside the public repository if evidence contains operational details.

## Post-deployment validation

The production release is successful only after all checks below pass on the real domain:

- `https://app.quran-hajrah.com/health` returns 200.
- `/ready` returns 200 and production PostgreSQL migration status is current.
- `/` loads the admin login SPA.
- `/portal/` loads the portal SPA with assets under `/portal/`.
- Unknown `/api/*` routes return JSON 404 and protected routes return 401/403 as appropriate.
- Login, refresh rotation, logout, account, and users list work over HTTPS.
- Refresh cookie is Secure and HttpOnly with the intended SameSite/domain policy.
- CORS rejects an unapproved origin.
- Runtime logs contain request metadata but no secrets or credentials.
- DNS and TLS certificate are valid for `app.quran-hajrah.com`.

Until those checks are performed, status is “successful locally,” not “successful in production.”
