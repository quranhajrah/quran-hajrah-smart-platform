# Enterprise 22 Institutional Knowledge Center

- Version: `22.0.0`
- Migration: `20260723190000_enterprise_22_knowledge_center`
- Runtime entry: `apps/api/dist/server.js`
- Admin route: `/documents`
- API namespace: `/api/documents`

This release adds the first production business module without changing the established health, readiness, authentication, cookie, proxy, or Hostinger startup architecture.

## Deployment order

1. Confirm an encrypted PostgreSQL backup and persistent document-storage backup policy.
2. Configure `DOCUMENT_STORAGE_ROOT` and `DOCUMENT_MAX_FILE_SIZE_MB` in Hostinger.
3. Build with `npm run build:production`.
4. Allow `postbuild:production` to apply the committed migration through `DIRECT_URL`.
5. Run `npm run db:seed` to add document permissions and categories.
6. Start from `apps/api/dist/server.js`.
7. Verify `/health`, `/ready`, authentication, document dashboard, upload, download, versioning, archive/restore, confidentiality denial, and audit history.

The release does not integrate an AI provider, reset data, delete files automatically, or create a default user or password.
