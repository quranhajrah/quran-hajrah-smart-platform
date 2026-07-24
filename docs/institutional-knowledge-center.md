# Institutional Knowledge Center

## Purpose

Enterprise 22 is the first production business module in Quran Hajrah Smart Platform. It manages institutional documents, versions, classifications, access controls, and audit evidence while reusing the existing authentication and RBAC foundation.

The admin interface is Arabic-first and RTL at `/documents`. The API is under `/api`; it has no anonymous document routes and contains no sample or fallback data.

## Data model

| Table | Purpose |
| --- | --- |
| `Document` | Searchable current metadata and current-file reference |
| `DocumentCategory` | Ordered institutional classification seeded by the platform |
| `OwningDepartment` | Ordered owning-department lookup seeded by the platform |
| `DocumentVersion` | Immutable metadata for every uploaded binary version |
| `DocumentTag` | Normalized reusable document tag |
| `DocumentTagAssignment` | Many-to-many document/tag relation |
| `DocumentAccessRule` | Expiring user- or role-specific view/download/edit grant |
| `DocumentAuditLog` | Append-only business audit trail |

Documents are soft deleted with `deletedAt`; versions and audit records remain. Archive is also logical. Storage paths and generated names are internal and never appear in public DTOs.

Migration: `20260723190000_enterprise_22_knowledge_center`.

## Initial categories

The idempotent seed creates:

1. الخطط الاستراتيجية
2. الخطط التشغيلية
3. الموازنات
4. اللوائح والسياسات
5. الحوكمة والامتثال
6. التقارير
7. محاضر الاجتماعات
8. الخطابات
9. العقود
10. البرامج والمبادرات
11. الشؤون التعليمية
12. الشؤون المالية
13. الموارد البشرية
14. الإعلام
15. الأوقاف
16. ملفات أخرى

The owning-department lookup contains:

1. الإدارة التنفيذية
2. الشؤون التعليمية
3. الشؤون المالية
4. تنمية الموارد
5. الحوكمة
6. الإعلام
7. الموارد البشرية
8. مجلس الإدارة

Run `npm run db:seed` after deployment. It creates no user, administrator, password, or document.

## API

All routes require a valid Bearer access token.

| Method | Route | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/document-categories` | `documents.view` | Active categories |
| `GET` | `/api/owning-departments` | `documents.view` | Active owning departments |
| `GET` | `/api/document-lookups` | `documents.view` | Categories and owning departments for forms |
| `GET` | `/api/documents/dashboard` | `documents.view` | Executive counters and recent uploads |
| `GET` | `/api/documents` | `documents.view` | Paginated search and filters |
| `POST` | `/api/documents` | `documents.create` | Create strict metadata |
| `GET` | `/api/documents/:id` | `documents.view` | Details and view audit |
| `PATCH` | `/api/documents/:id` | `documents.update` | Update allowlisted metadata |
| `PUT` | `/api/documents/:id/file` | `documents.upload` | Initial binary upload |
| `POST` | `/api/documents/:id/versions` | `documents.upload` | New immutable version |
| `GET` | `/api/documents/:id/download` | `documents.download` | Private streamed download |
| `GET` | `/api/documents/:id/versions` | `documents.view` | Version history |
| `GET` | `/api/documents/:id/audit` | `documents.audit` | Document audit history |
| `POST` | `/api/documents/:id/archive` | `documents.archive` | Logical archive |
| `POST` | `/api/documents/:id/restore` | `documents.archive` | Restore to active state |
| `DELETE` | `/api/documents/:id` | `documents.delete` | Soft delete |

List filters: `page`, `pageSize`, `search`, `categoryId`, `documentType`, `status`, `owningDepartment`, `confidentialityLevel`, `dateFrom`, `dateTo`, and `archived`.

The required categories and owning departments are committed reference data. Migration `20260724_fix_knowledge_center_lookups` inserts or repairs them safely, and `npm run db:seed` upserts the same values on every production build. The admin upload form loads `/api/document-lookups` before enabling upload and never renders empty required selectors.

Binary upload uses the actual MIME type in `Content-Type` and a URI-encoded original name in `X-File-Name`. New versions may include `X-Version-Notes`. JSON and binaries are intentionally separate so metadata remains strictly validated and file bodies receive an independent size limit.

## Authorization and confidentiality

RBAC determines whether a user may invoke an operation. Confidentiality then restricts which specific record that user may see:

- `PUBLIC`, `INTERNAL`: available to authenticated users with the relevant document permission.
- `CONFIDENTIAL`: additionally requires `super_admin`, `board_chair`, `executive_director`, `operations_manager`, `governance_officer`, or an active access rule.
- `HIGHLY_CONFIDENTIAL`: additionally requires `super_admin`, `board_chair`, `executive_director`, or an active access rule.

Unauthorized restricted records return the same 404 response as missing records to avoid disclosing their existence.

## File security

- Allowed extensions: PDF, Word, Excel, PowerPoint, PNG, JPEG, TXT, and CSV.
- MIME type and extension must agree.
- PDF, Office, PNG, JPEG, text, and CSV content signatures are verified.
- Empty files, traversal names, absolute paths, null bytes, disallowed types, and oversized bodies are rejected.
- Generated file names are random UUIDs with only an allowlisted extension.
- The local provider resolves every operation beneath its configured root and writes new files with private permissions.
- Files use `Cache-Control: private, no-store`; local paths, generated names, and checksums are omitted from responses and logs.
- Document content, authorization headers, cookies, tokens, and request bodies are not logged.

## Storage provider

`StorageProvider` exposes:

- `save`
- `read`
- `delete`
- `exists`
- `generateSafeName`

Enterprise 22 instantiates `LocalStorageProvider`. A future Supabase Storage or S3 adapter can implement the same contract without changing routes or business services.

Environment:

```text
DOCUMENT_STORAGE_ROOT=
DOCUMENT_MAX_FILE_SIZE_MB=25
```

In production, choose a persistent, writable, non-public directory. Do not use the repository, `apps/admin/dist`, `apps/portal/dist`, or any web-served directory.

## Audit

The module records metadata creation, upload, view, download, update, version upload, archive, restore, and soft deletion. Audit rows include actor, document/version, timestamp, request IP, user agent, and non-sensitive operational metadata. They never contain file contents or internal storage paths.

## AI readiness

`documents/ai.ts` defines provider-neutral interfaces for text extraction, chunking, embeddings, semantic search, source citations, and a knowledge assistant. No implementation is instantiated and no paid or external AI request occurs in Enterprise 22.

## Backup and restore

PostgreSQL metadata and `DOCUMENT_STORAGE_ROOT` are one recovery set:

1. Record application commit and Prisma migration state.
2. Take a PostgreSQL snapshot/export and an encrypted file backup in the same maintenance window.
3. Restore both into an isolated environment.
4. Run `prisma migrate status`, `/ready`, login, document listing, a controlled download, and checksum reconciliation.
5. Promote a restored environment only after authorization and audit history are verified.

Never commit backups, document files, database exports, or operational evidence. Prefer forward migrations; never run `prisma migrate dev`, `db push`, a reset, or destructive rollback against production.

## Validation

```bash
npm run security:check
npm run lint
npm run typecheck
npm test
npm run db:validate
npm run db:generate
npm run build:production
npm run smoke:production
```
