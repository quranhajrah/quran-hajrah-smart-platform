# Production Architecture

## Decision

Enterprise 23 retains one long-running Node.js process. Express serves identity/RBAC, the Institutional Knowledge Center, Executive Intelligence, and both compiled React applications. This avoids unnecessary service splitting on Hostinger Cloud and keeps cookies, CORS, health checks, and deployment under one origin.

Hostinger currently supports Express applications and Node.js 20, 22, and 24 on eligible Business and Cloud plans, and can import a public GitHub repository. The application should be configured as Express or “Other” if automatic detection does not recognize the monorepo. See Hostinger's [Node.js Web App deployment guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

## Development ports

| Component | Development endpoint    |
| --------- | ----------------------- |
| API       | `http://localhost:3000` |
| Admin     | `http://localhost:5173` |
| Portal    | `http://localhost:5174` |

Development uses Vite servers for admin and portal and `tsx watch` for the API.

## Production routes

| Route              | Handler                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `/health`          | Node process liveness; no database query                                                                |
| `/ready`           | PostgreSQL connectivity; returns 503 when unavailable                                                   |
| `/api/*`           | Express API and explicit JSON 404 fallback                                                              |
| `/api/documents/*` | Authenticated document metadata, files, versions, and audit API                                         |
| `/api/executive/*` | Authenticated metrics, strategy, KPI, initiative, risk, alert, health, report, and structured-query API |
| `/portal`          | Permanent redirect to `/portal/`                                                                        |
| `/portal/*`        | Portal static files and SPA fallback                                                                    |
| `/*`               | Admin static files and SPA fallback                                                                     |

API and health routes are registered before static handling and can never fall through to an SPA. Hashed assets receive a one-year immutable cache policy. Both `index.html` files and SPA fallbacks use `Cache-Control: no-store`.

## Build and runtime

`npm run build:production` performs Prisma generation and builds database, shared, auth, UI, API, admin, and portal outputs. The outputs are:

- `apps/api/dist`
- `apps/admin/dist`
- `apps/portal/dist`
- `packages/*/dist`

Hostinger launches `apps/api/dist/server.js` directly so Express calls `listen()` within the platform startup window. The `postbuild:production` npm lifecycle applies committed Prisma migrations through `DIRECT_URL`, runs the idempotent system seed, and invokes the disabled-by-default administrator bootstrap after the production build and before Hostinger launches the runtime. The bootstrap imports Prisma only when `ADMIN_BOOTSTRAP_ENABLED` is exactly `true`, and it never logs its temporary password. `prestart:production` applies the migration guard when npm manages startup. The API runtime does not use Vite, tsx, or ts-node. Express listens on the validated `process.env.PORT` supplied by Hostinger.

Admin uses `/api` by default in production, so no server environment variable is exposed through Vite. Portal is built with `/portal/` as its asset base.

## Executive Intelligence

Enterprise 23 uses the same API process and PostgreSQL connection pool. The executive routes depend on three existing abstractions:

- `IdentityStore` supplies the authenticated actor, effective permissions, users, and the common `AuditLog`.
- `DocumentStore` supplies confidentiality-filtered document summaries and validates evidence links before they are stored.
- `ExecutiveStore` isolates aggregation and persistence from HTTP validation and business calculations.

The default admin route `/` is the executive dashboard. `/executive/*` routes are React SPA paths and therefore never conflict with `/api/executive/*`. Visualizations use HTML/CSS bars and a heat grid, adding no charting runtime dependency or bundle weight.

Metric definitions, targets, and measurements are separate records. The seed creates definitions only. Dashboard association values remain `null` until an authorized user records a measurement. The health score normalizes only available components and always returns coverage and missing components beside the score.

`npm run executive:alerts` runs the compiled reusable alert generator. It is safe to invoke from a future Hostinger scheduler, but no in-process cron is used and server startup remains immediate. The Hostinger entry file remains `apps/api/dist/server.js`.

## Institutional Knowledge Center

Document metadata, versions, tags, access rules, and audit history are stored in PostgreSQL. Binary files are handled through the `StorageProvider` contract. Enterprise 22 uses `LocalStorageProvider`; `DOCUMENT_STORAGE_ROOT` must point to a persistent directory outside the public web root. The database stores only relative provider paths. API DTOs omit storage paths, generated names, and checksums.

The upload route accepts a bounded binary body after authentication. It validates MIME type, extension, and file signature, generates an opaque name, enforces root containment, and writes with private file permissions. If database persistence fails, the newly written file is removed. Archive and delete operations are logical and do not erase version binaries automatically.

Confidentiality authorization is evaluated in addition to RBAC. Public and internal documents follow `documents.view`; confidential documents require an approved management/governance role or an active access rule; highly confidential documents are limited to the system administrator, board chair, executive director, or an explicit active access rule.

## Proxy, CORS, and cookies

`TRUST_PROXY` is mandatory in production so Express uses the forwarded protocol and client IP. CORS accepts only exact HTTP(S) origins from `CORS_ORIGINS`; wildcard origins are rejected while credentials are enabled.

Refresh cookies are HttpOnly, Secure in production, configurable as SameSite Lax/Strict/None, and optionally scoped with `COOKIE_DOMAIN`. Access tokens remain in browser memory.

## PostgreSQL and Prisma

`DATABASE_URL` is the application connection string, while `DIRECT_URL` is the direct migration connection. `/ready` performs `SELECT 1` without returning connection details. Commands:

- `npm run db:deploy` — `npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma`
- `npm run db:status` — `prisma migrate status`
- `npm run db:seed` — system roles, permissions, document categories, executive metric definitions, and dashboard defaults
- `npm run executive:alerts` — idempotent structured alert generation for a scheduler
- `npm run db:diagnostics` — safe connectivity result without URL output
- `npm run admin:bootstrap:production` — non-interactive, opt-in Hostinger administrator provisioning
- `npm run create:admin` — idempotent first-administrator provisioning with a generated temporary password when `ADMIN_PASSWORD` is omitted

The managed Hostinger Node.js database wizard currently documents Supabase as its PostgreSQL option. Any compatible managed PostgreSQL provider may be used if it permits the required pooled and direct connections. Hostinger does not modify application database code; see the [current Node.js deployment guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

## Process behavior

Logs are newline-delimited JSON and contain request ID, method, path without query parameters, status, duration, user ID when authenticated, and resolved client IP. Request bodies, authorization headers, cookies, tokens, passwords, secrets, and connection URLs are never logged.

SIGTERM and SIGINT stop the HTTP server and disconnect Prisma. Uncaught exceptions and unhandled rejections are logged without sensitive request data and initiate shutdown.
