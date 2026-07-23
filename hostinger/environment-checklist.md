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

## First administrator, one deployment only

- [ ] Set `ADMIN_BOOTSTRAP_ENABLED=true` exactly; all other values skip the bootstrap.
- [ ] Set `ADMIN_EMAIL` to the intended production administrator address.
- [ ] Set `ADMIN_FULL_NAME` to the intended production administrator name.
- [ ] Set `ADMIN_TEMP_PASSWORD` to a unique value of at least 12 characters containing uppercase, lowercase, number, and special characters.
- [ ] Deploy once and verify that the safe bootstrap completion message appears without a password.
- [ ] Sign in over HTTPS and immediately change the temporary password.
- [ ] Remove `ADMIN_TEMP_PASSWORD`, `ADMIN_EMAIL`, and `ADMIN_FULL_NAME`.
- [ ] Remove `ADMIN_BOOTSTRAP_ENABLED` or change it to `false`, then redeploy to verify the bootstrap is skipped.

Never paste secrets into build logs, GitHub issues, source files, documentation, or chat.
