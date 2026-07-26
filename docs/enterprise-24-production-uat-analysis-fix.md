# Enterprise 24 Production UAT Analysis Fix

Date: 2026-07-26

## Incident

The production analysis of **الخطة التشغيلية والموازنة لعام 2026** entered `FAILED` with zero persisted pages and proposals. The previous implementation intentionally replaced non-application exceptions with a generic Arabic message and logged only the error name and generic code. Consequently, the exact historical exception cannot be reconstructed from the old job record.

## Root cause

The zero-page result is consistent with failure during the atomic persistence transaction: PDF extraction and proposal generation occurred in memory, then all pages, tables, cells, and proposals were inserted sequentially inside Prisma's default interactive-transaction window. A remote Supabase connection can exceed that short default, producing Prisma `P2028` and rolling back every page. The rollback correctly prevented partial results but the generic error handling hid the failing stage and exception.

Two PDF compatibility gaps were also fixed:

- `stopAtErrors: true` rejected PDFs containing recoverable font or cross-reference defects.
- Some Arabic PDF generators expose words in visual reverse order, preventing deterministic Arabic rules from recognizing headings even when text extraction succeeds.

## Fix

- Result persistence now has explicit bounded options: `maxWait: 15000` and `timeout: 120000`.
- Persistence remains one transaction and still rolls back completely on failure.
- Every pipeline stage logs start/completion without file paths or document contents.
- Failure logs and authorized audit records contain the sanitized real exception, stage, error code, and diagnostic identifier.
- Failed jobs show a stage-specific Arabic message plus the same diagnostic identifier.
- PDF.js may recover from non-fatal defects; malformed and encrypted PDFs are still rejected safely.
- Visually reversed Arabic is repaired only after deterministic reversed-heading detection.

## Validation

- The generated operational-plan PDF fixture is public-safe and contains no association data.
- It preserves four PDF pages and yields four objective proposals plus KPI, initiative, budget, responsibility/date, and beneficiary proposals only from fixture evidence.
- Timeout classification, diagnostic redaction, Arabic messages, and bounded transaction settings have automated coverage.
- The real production document remains the required final acceptance artifact and is not committed to this public repository.

## Production acceptance

After deployment, retry the failed job. Confirm:

1. structured logs progress through `file_retrieval`, `pdf_parsing`, `text_extraction`, `proposal_generation`, and persistence;
2. pages are greater than zero;
3. proposals contain only values evidenced by the source PDF;
4. no document text appears in normal logs;
5. any failure displays its stage and diagnostic identifier, with the matching sanitized exception in the authorized audit history.
