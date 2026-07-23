# Authentication and RBAC

## Architecture

The identity system is split into HTTP routes, security primitives, and an `IdentityStore` abstraction. Production uses `PrismaIdentityStore` with PostgreSQL. API tests inject an isolated in-memory store, so tests never connect to or mutate production data. The admin application consumes only the real HTTP API and contains no fallback or sample records.

Passwords are hashed with bcrypt. Access tokens are short-lived HS256 JWTs returned to the client and retained only in application memory. Refresh tokens are cryptographically random opaque values stored in a strict HttpOnly cookie; only a SHA-256 hash is persisted. Every refresh rotates and revokes the previous token.

## Login flow

1. The client submits email and password to `POST /api/auth/login`.
2. The API applies a dedicated login rate limit and returns the same generic error for unknown email, wrong password, and inactive users.
3. After verification, the API creates a refresh session, writes an audit entry, and returns a short-lived access token with the public user and effective permissions.
4. The browser keeps the access token in memory and sends it as a Bearer token. It never writes the token to localStorage.
5. When the application starts or the access token expires, `POST /api/auth/refresh` rotates the HttpOnly refresh cookie and returns a new access token.
6. Logout revokes the session and clears the cookie. Password changes revoke every session belonging to the user.

## Built-in roles

| Code                 | Arabic display name |
| -------------------- | ------------------- |
| `super_admin`        | مدير النظام العام   |
| `board_chair`        | رئيس مجلس الإدارة   |
| `executive_director` | المدير التنفيذي     |
| `operations_manager` | مدير العمليات       |
| `finance_manager`    | المدير المالي       |
| `education_manager`  | مدير التعليم        |
| `governance_officer` | مسؤول الحوكمة       |
| `employee`           | موظف                |
| `viewer`             | مشاهد               |

System roles are seeded idempotently. Only `super_admin` receives all permissions. The viewer role receives `dashboard.view`; future module migrations may grant narrowly scoped permissions to other roles.

## Initial permissions

- Users: `users.view`, `users.create`, `users.update`, `users.disable`, `users.assign_roles`
- Roles: `roles.view`, `roles.manage`
- Platform: `dashboard.view`, `audit.view`, `settings.manage`
- Documents: `documents.view`, `documents.create`, `documents.update`, `documents.upload`, `documents.download`, `documents.archive`, `documents.delete`, `documents.audit`, `documents.manage_access`

Permissions are rows keyed by a stable dotted code and grouped by `module`, allowing future modules to add permission records without changing authorization middleware.

Only `super_admin` receives every platform permission. Enterprise 22 grants document permissions narrowly by existing institutional role. Confidential and highly confidential documents also pass a separate role/access-rule check, so possession of `documents.view` alone does not reveal restricted records. Direct document access rules can target one user or one role, expire automatically, and separately allow view, download, or edit.

## Environment variables

Copy `.env.example` to `.env` and set values outside source control.

| Variable                  | Purpose                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | PostgreSQL connection URL                                                               |
| `JWT_ACCESS_SECRET`       | Random signing secret of at least 32 characters                                         |
| `ACCESS_TOKEN_TTL`        | Access-token lifetime such as `15m`                                                     |
| `REFRESH_TOKEN_TTL`       | Refresh-session lifetime such as `7d`                                                   |
| `JWT_REFRESH_SECRET`      | HMAC secret used to hash opaque refresh tokens                                          |
| `SESSION_SECRET`          | Independent secret combined into refresh-token hashing                                  |
| `COOKIE_SECURE`           | Must be `true` in production                                                            |
| `COOKIE_SAME_SITE`        | `lax`, `strict`, or `none`                                                              |
| `REFRESH_COOKIE_NAME`     | Refresh cookie name                                                                     |
| `BCRYPT_ROUNDS`           | Bcrypt work factor; default 12                                                          |
| `CORS_ORIGINS`            | Comma-separated allowed admin origins                                                   |
| `VITE_API_URL`            | Admin build-time API base URL                                                           |
| `ADMIN_EMAIL`             | Email used only by `create:admin`                                                       |
| `ADMIN_FULL_NAME`         | Name used only by `create:admin`                                                        |
| `ADMIN_PASSWORD`          | Optional explicit password for `create:admin`; omit it to generate a temporary password |
| `ADMIN_BOOTSTRAP_ENABLED` | Exact `true` enables the one-time Hostinger post-build bootstrap                        |
| `ADMIN_TEMP_PASSWORD`     | Temporary Hostinger bootstrap secret; never logged and removed immediately after use    |

Do not commit `.env`, credentials, generated database dumps, or backup files.

## Database and first administrator

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build -w @quran-hajrah/database
npm run create:admin
```

`create:admin` requires `ADMIN_EMAIL` and `ADMIN_FULL_NAME` and a previously seeded `super_admin` role. When `ADMIN_PASSWORD` is absent, the command generates a strong temporary password and prints it exactly once. If the email exists, it updates the name and password, activates the account, adds `super_admin` without removing other roles, revokes existing refresh sessions, and records a system audit entry. There is no default credential.

Hostinger's non-interactive path runs after migration and seed. It is disabled unless `ADMIN_BOOTSTRAP_ENABLED` equals `true` exactly and requires `ADMIN_EMAIL`, `ADMIN_FULL_NAME`, and `ADMIN_TEMP_PASSWORD`. Its password policy requires at least 12 characters with uppercase, lowercase, number, and special characters. It never logs the temporary password. Re-running it updates the same email rather than creating a duplicate; remove the bootstrap variables immediately after the first successful deployment.

## API authorization

Routes first use `requireAuth`, then `requirePermission(code)` for a specific capability. `requireAnyPermission(...codes)` is available for routes that accept several capabilities. Zod schemas are strict, so unknown fields are rejected and cannot be mass-assigned.

The final active super administrator cannot disable itself or lose its super-admin role. System role names and `isSystem` are never accepted from update payloads, and the `super_admin` permission set cannot be reduced.

## Tests

```bash
npm run test
```

The test stores are created fresh before every test and exist only in process memory. Tests cover valid and invalid login, inactive users, refresh rotation, logout revocation, authentication and permission denial, allowed access, user creation, hash omission, last-super-admin protection, document confidentiality, file upload controls, and audit creation.

## Security considerations

- Helmet headers, strict CORS allowlist, global and login-specific rate limits.
- 100 KB JSON body limit and strict Zod validation.
- Generic authentication errors and active-user verification on every authenticated request.
- HttpOnly, SameSite=Strict refresh cookie; Secure is enabled in production.
- Refresh-token hashes and password hashes never appear in response DTOs.
- No password or token logging is implemented.
- Central error handling omits stack traces in production.
- Audit records capture actor, request IP, user agent, entity, and action metadata.
