# Backup and Restore

## Enterprise 24 analysis data

Treat PostgreSQL and immutable document-version storage as one recovery unit. Enterprise 24 adds jobs, pages, extracted text/tables/cells, proposals, review decisions, import batches/items, source evidence, analysis configuration/audit, and budget records. A database snapshot without its matching document binaries cannot reproduce or display the evidence.

Enterprise 24.1 also stores raw page text separately from normalized text and adds proposal relationships. Include `DocumentExtractedText` and `ExtractionProposalRelation` in consistency checks after restore; do not regenerate normalized text or relations silently from a different rule version.

After a restore, run `npm run db:status`, verify `/ready`, open a previously imported record, and confirm its “عرض المصدر” action reaches the matching document and page reference. Never use `prisma migrate reset`, `migrate dev`, or `db push` against production.

## Recovery set

Enterprise 23 recovery requires:

1. a Supabase/PostgreSQL backup or provider snapshot;
2. the matching encrypted `DOCUMENT_STORAGE_ROOT` backup from Enterprise 22;
3. the exact Git commit and migration history;
4. protected operational notes identifying the recovery point.

Database and document storage must use coordinated recovery timestamps. Store backups outside GitHub with encryption, access control, retention, and tested deletion.

## Before deployment

- Confirm provider backup/PITR status.
- Capture a coordinated database and document-storage recovery point.
- Record the deployed commit and `prisma migrate status`.
- Confirm migration files are committed and additive.
- Do not copy production secrets or report content into release reports.

## Restore drill

1. Provision an isolated non-production PostgreSQL database and private document directory.
2. Restore both artifacts to their coordinated point.
3. Configure test-only environment variables.
4. Check `npm run db:status`; apply only committed forward migrations with `npm run db:deploy`.
5. Start compiled output and verify `/health` and `/ready`.
6. Verify login, RBAC denial/allow, Knowledge Center confidentiality/download, dashboard aggregation, one metric/KPI/initiative/risk/alert/report, and audit history.
7. Document results in protected operational storage.

Never reset, truncate, delete, run `prisma migrate dev`, or use `prisma db push` against production or a sole recovery copy. Roll forward where possible. A destructive recovery requires explicit incident authority and a verified restorable backup.
