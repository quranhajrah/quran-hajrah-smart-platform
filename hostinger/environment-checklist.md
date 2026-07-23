# Environment Checklist

Enter values through Hostinger hPanel. Hostinger documents that deployment environment variables are not stored in the repository; see [environment variable setup](https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/).

## Required runtime values

- [ ] `NODE_ENV=production`
- [ ] `PORT` supplied by Hostinger
- [ ] `DATABASE_URL` pooled PostgreSQL application connection
- [ ] `DIRECT_URL` direct PostgreSQL migration connection
- [ ] `ADMIN_ORIGIN=https://app.quran-hajrah.com`
- [ ] `PORTAL_ORIGIN=https://app.quran-hajrah.com`
- [ ] `CORS_ORIGINS=https://app.quran-hajrah.com`
- [ ] Unique random `JWT_ACCESS_SECRET` of at least 32 characters
- [ ] Unique random `JWT_REFRESH_SECRET` of at least 32 characters
- [ ] Unique random `SESSION_SECRET` of at least 32 characters
- [ ] `COOKIE_SECURE=true`
- [ ] `COOKIE_SAME_SITE=lax`
- [ ] `COOKIE_DOMAIN` left empty for a host-only cookie unless cross-subdomain behavior is required
- [ ] `ACCESS_TOKEN_TTL=15m`
- [ ] `REFRESH_TOKEN_TTL=7d`
- [ ] `TRUST_PROXY=1` or the value confirmed for Hostinger's proxy topology
- [ ] `LOG_LEVEL=info`
- [ ] `RATE_LIMIT_WINDOW_MS=60000`
- [ ] `RATE_LIMIT_MAX=300`
- [ ] `BCRYPT_ROUNDS=12`
- [ ] `DOCUMENT_STORAGE_ROOT` points to a writable, persistent, non-public directory
- [ ] `DOCUMENT_MAX_FILE_SIZE_MB=25` or the approved operational limit

## First administrator, temporary operator environment only

- [ ] `ADMIN_EMAIL`
- [ ] `ADMIN_FULL_NAME`
- [ ] Leave `ADMIN_PASSWORD` unset to generate a temporary password, or set an approved value satisfying policy
- [ ] Run the command only in an approved interactive terminal and capture generated output securely
- [ ] Remove the administrator variables after successful creation if operationally supported

Never paste secrets into build logs, GitHub issues, source files, documentation, or chat.
