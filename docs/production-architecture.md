# Production Architecture

## Decision

Enterprise 22 retains one long-running Node.js process. Express serves the API, the Institutional Knowledge Center, and both compiled React applications. This avoids unnecessary service splitting on Hostinger Cloud and keeps cookies, CORS, health checks, and deployment under one origin.

Hostinger currently supports Express applications and Node.js 20, 22, and 24 on eligible Business and Cloud plans, and can import a public GitHub repository. The application should be configured as Express or “Other” if automatic detection does not recognize the monorepo. See Hostinger's [Node.js Web App deployment guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

## Development ports

| Component | Development endpoint    |
| --------- | ----------------------- |
| API       | `http://localhost:3000` |
| Admin     | `http://localhost:5173` |
| Portal    | `http://localhost:5174` |

Development uses Vite servers for admin and portal and `tsx watch` for the API.

## Production routes

| Route              | Handler                                                         |
| ------------------ | --------------------------------------------------------------- |
| `/health`          | Node process liveness; no database query                        |
| `/ready`           | PostgreSQL connectivity; returns 503 when unavailable           |
| `/api/*`           | Express API and explicit JSON 404 fallback                      |
| `/api/documents/*` | Authenticated document metadata, files, versions, and audit API |
| `/portal`          | Permanent redirect to `/portal/`                                |
| `/portal/*`        | Portal static files and SPA fallback                            |
| `/*`               | Admin static files and SPA fallback                             |

API and health routes are registered before static handling and can never fall through to an SPA. Hashed assets receive a one-year immutable cache policy. Both `index.html` files and SPA fallbacks use `Cache-Control: no-store`.

## Build and runtime

`npm run build:production` performs Prisma generation and builds database, shared, auth, UI, API, admin, and portal outputs. The outputs are:

- `apps/api/dist`
- `apps/admin/dist`
- `apps/portal/dist`
- `packages/*/dist`

Hostinger launches `apps/api/dist/server.js` directly so Express calls `listen()` within the platform startup window. The `postbuild:production` npm lifecycle applies committed Prisma migrations through `DIRECT_URL` after the production build and before Hostinger launches the runtime; `prestart:production` applies the same guard when npm manages startup. The API runtime does not use Vite, tsx, or ts-node. Express listens on the validated `process.env.PORT` supplied by Hostinger.

Admin uses `/api` by default in production, so no server environment variable is exposed through Vite. Portal is built with `/portal/` as its asset base.

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
- `npm run db:seed` — system roles, permissions, and document categories
- `npm run db:diagnostics` — safe connectivity result without URL output
- `npm run create:admin` — idempotent first-administrator provisioning with a generated temporary password when `ADMIN_PASSWORD` is omitted

The managed Hostinger Node.js database wizard currently documents Supabase as its PostgreSQL option. Any compatible managed PostgreSQL provider may be used if it permits the required pooled and direct connections. Hostinger does not modify application database code; see the [current Node.js deployment guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

## Process behavior

Logs are newline-delimited JSON and contain request ID, method, path without query parameters, status, duration, user ID when authenticated, and resolved client IP. Request bodies, authorization headers, cookies, tokens, passwords, secrets, and connection URLs are never logged.

SIGTERM and SIGINT stop the HTTP server and disconnect Prisma. Uncaught exceptions and unhandled rejections are logged without sensitive request data and initiate shutdown.
