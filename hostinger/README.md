# Hostinger Cloud Deployment

This directory is an operator guide, not an automated deployment. It contains no production credentials.

## Application settings

- Repository: `https://github.com/quranhajrah/quran-hajrah-smart-platform`
- Branch: `main`
- Root directory: repository root (the directory containing the root `package.json`)
- Application type: Express, or “Other” if monorepo detection does not identify Express
- Node.js: 20.x
- Install: Hostinger-managed dependency installation followed by the explicit clean install in the build command
- Build: `npm run build:production` (the existing Hostinger setting is supported directly)
- Custom start command: not required or supported for this deployment
- Entry file: `apps/api/dist/server.js`
- Health path: `/health`
- Readiness path: `/ready`
- Target domain: `app.quran-hajrah.com`

Hostinger supports GitHub import for public Node.js applications and stores server build output outside `public_html`; review the [official deployment instructions](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

`build:production` runs `npm ci --include=dev` before `build:artifacts`. This installs TypeScript, declaration packages, Prisma tooling, and Vite for compilation even when Hostinger initially omits devDependencies. `build:hostinger` is an alias for the same command. Prisma CLI is also a runtime dependency because the production start command must remain migration-capable after `npm ci --omit=dev`; keep `NODE_ENV=production` for the running application.

Hostinger launches `apps/api/dist/server.js` directly so Express can call `listen()` immediately. The `postbuild:production` lifecycle runs these operations, in order, after compilation and before Hostinger starts that entry file:

1. `npm run db:deploy` applies committed migrations with `npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma`.
2. `npm run db:seed` idempotently creates system roles, permissions, document categories, Enterprise 23 metric definitions, and dashboard defaults. It does not create metric measurements.
3. `npm run admin:bootstrap:production` skips unless `ADMIN_BOOTSTRAP_ENABLED` is exactly `true`; when enabled, it creates or updates the first super administrator without logging the password.

Prisma uses the schema's `directUrl = env("DIRECT_URL")` for migrations. `prestart:production` provides the migration guard for npm-managed runtimes. Do not replace these lifecycle steps with `prisma migrate dev` or `prisma db push`.

The root `postinstall` generates Prisma Client from the monorepo schema explicitly. It does not connect to PostgreSQL; database availability is reported separately by `/ready` and never blocks `/health` or the listening socket.

Complete the environment, deployment, and rollback checklists before declaring production success.

## Enterprise 23 deployment

Migration `20260724_enterprise_23_executive_intelligence` is additive and is applied by the existing `db:deploy` lifecycle. Do not use `prisma migrate dev`, `prisma db push`, reset, or delete operations in production. After deployment:

1. Confirm `/health` returns `{"status":"ok"}` and `/ready` returns `{"status":"ready",...}`.
2. Log in and verify the default route displays the executive dashboard.
3. Verify a read-only role cannot call management endpoints.
4. Enter and verify one approved test record for a metric, KPI, initiative, risk, alert, and report using non-sensitive acceptance data.
5. Confirm each mutation appears in the common audit log, then remove or archive acceptance records under the approved retention policy.

The alert command is `npm run executive:alerts`. If a Hostinger scheduled task is configured later, use that command from the repository root with the same production environment. Run it manually once and verify idempotency before scheduling. It does not delay `server.js`, and Hostinger's entry file remains unchanged.

## One-time administrator bootstrap

In hPanel, temporarily add `ADMIN_BOOTSTRAP_ENABLED=true`, `ADMIN_EMAIL`, `ADMIN_FULL_NAME`, and `ADMIN_TEMP_PASSWORD`. The password must contain at least 12 characters including uppercase, lowercase, number, and special characters. Deploy once, verify login, and change the password immediately.

After success, remove `ADMIN_TEMP_PASSWORD`, `ADMIN_EMAIL`, and `ADMIN_FULL_NAME`, and either remove `ADMIN_BOOTSTRAP_ENABLED` or set it to `false`. Redeploy once to confirm the bootstrap is skipped. Never leave the enable flag set to `true`, because a later deployment would intentionally rotate the account password again.

## Enterprise 22 document storage

Set `DOCUMENT_STORAGE_ROOT` to a persistent Hostinger directory that is writable by the Node.js process and is not publicly served. Do not place it below an exposed static/public directory. The application creates document-specific subdirectories and opaque file names at runtime. Set `DOCUMENT_MAX_FILE_SIZE_MB` to the approved upload limit (25 by default).

The PostgreSQL backup and file-storage backup form one recovery unit. Back up both on a coordinated schedule, encrypt exports, restrict operator access, and test restoration outside production. A database restore without matching files leaves version metadata whose binaries are unavailable; a file restore without the matching database leaves unreferenced files.
