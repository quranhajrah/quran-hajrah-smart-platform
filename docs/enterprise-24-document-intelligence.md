# Enterprise 24 — Institutional Document Intelligence

## Purpose and boundary

Enterprise 24 converts existing Knowledge Center files into structured proposals that an authorized human can inspect, edit, approve or reject, and import into Enterprise 23. It does not automatically import data and does not call an external AI or OCR service.

```text
Document version
→ explicit analysis job
→ pages, text, and tables
→ deterministic proposals with evidence
→ human review and approval
→ conflict preview and explicit resolution
→ transactional import
→ source traceability and audit
```

The Hostinger runtime remains `apps/api/dist/server.js`. Analysis processing never delays server startup.

## Supported inputs

| Input                                | Current behavior                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| PDF with embedded text               | Extracts pages with page boundaries and positioned table candidates           |
| Text-based PDF tables                | Preserves detected row and cell order where positioning is consistent         |
| DOCX                                 | Extracts text and table rows through Mammoth; page boundaries are unavailable |
| TXT                                  | UTF-8 text passthrough                                                        |
| Image-only PDF                       | `OCR_REQUIRED` with an Arabic explanation                                     |
| Encrypted/malformed/unsupported file | Safe failure; no fabricated proposal                                          |

The configured defaults limit files to 25 MiB, 500 PDF pages, 300 tables, 5,000 DOCX entries, and a bounded decompressed archive size. These limits can be changed only by `document_analysis.configure`.

## Data model

- `DocumentAnalysisJob`: immutable document-version request, fingerprint, status, provider metadata, counts, and timing.
- `DocumentPage`, `DocumentExtractedText`: page boundary and normalized text.
- `DocumentExtractedTable`, `DocumentTableCell`: ordered table structure.
- `ExtractionProposal`, `ExtractionProposalField`: proposed target and individual reviewable fields.
- `ExtractionReview`: append-only review decisions and before/after data.
- `ExtractionImportBatch`, `ExtractionImportItem`: idempotent transactional import result.
- `SourceEvidenceReference`: document, version, proposal, page, section, evidence, method, target, actor, and time.
- `DocumentAnalysisConfiguration`: bounded provider/rule configuration.
- `DocumentAnalysisAuditLog`: analysis, review, approval, import, configuration, and failure events.
- `BudgetRecord`, `BudgetLine`: isolated production budget target exposed in executive summaries.

Migration: `20260724_enterprise_24_document_intelligence`.

## Providers and deterministic extractors

`DocumentTextExtractionProvider` defines `canHandle`, `extractDocument`, `extractPages`, `extractTables`, and `getMetadata`. The registry currently includes PDF.js, Mammoth, and TXT providers.

`InstitutionalExtractionService` routes documents to strategic-plan, operational-plan, budget, governance/compliance, financial-report, policy/regulation, or generic deterministic rules. Rules examine explicit headings, Arabic labels, dates, percentages, amounts, responsibilities, beneficiaries, objective/KPI numbering, risk language, and table headers. A proposal is created only when matching evidence exists.

The future `SemanticDocumentExtractor`, `LlmStructuredExtractionProvider`, `OcrProvider`, `EmbeddingProvider`, and `RerankingProvider` contracts are placeholders only.

## API

Analysis:

- `POST /api/documents/:id/analyze`
- `GET /api/document-analysis/jobs`
- `GET /api/document-analysis/jobs/:id`
- `POST /api/document-analysis/jobs/:id/cancel`
- `POST /api/document-analysis/jobs/:id/retry`

Extraction and review:

- `GET /api/document-analysis/jobs/:id/pages`
- `GET /api/document-analysis/jobs/:id/tables`
- `GET /api/document-analysis/jobs/:id/proposals`
- `PATCH /api/document-analysis/proposals/:id`
- `POST /api/document-analysis/proposals/:id/approve`
- `POST /api/document-analysis/proposals/:id/reject`
- `POST /api/document-analysis/proposals/bulk-review`

Import, configuration, and traceability:

- `POST /api/document-analysis/jobs/:id/import-preview`
- `POST /api/document-analysis/jobs/:id/import`
- `GET /api/document-analysis/import-batches/:id`
- `GET /api/document-analysis/sources/:targetType/:targetRecordId`
- `GET/PUT /api/document-analysis/configuration`
- `GET /api/document-analysis/jobs/:id/audit`

All routes authenticate, enforce their specific permission, validate input, apply document confidentiality, and return safe errors.

## Permissions

- `document_analysis.view`
- `document_analysis.run`
- `document_analysis.review`
- `document_analysis.approve`
- `document_analysis.import`
- `document_analysis.configure`
- `document_analysis.audit`

Approval and import are intentionally separate. No client-side permission check is trusted as authorization.

## Operations

```bash
npm run db:deploy
npm run db:seed
npm run document-analysis:alerts
```

The alert command is scheduler-ready and covers failed jobs, overdue reviews, approved proposals awaiting import, and unresolved conflicts. No in-process cron is enabled.

## Known limitations

- No OCR for image-only PDF.
- No semantic or generative extraction.
- PDF tables are inferred from positioned embedded text; merged cells and complex reading order can require manual correction.
- DOCX has no reliable page boundary, so its extracted source page is page 1.
- Analysis currently runs in the existing Node.js process after the request is accepted. A Hostinger restart can interrupt an in-flight job; an operator must cancel and retry that job. A durable external worker is a future scaling option, not part of this release.
- Deterministic rules intentionally prefer missing fields over invented values.
- Production acceptance requires a real authorized document analysis and import; local fixtures cannot prove storage permissions or document-specific layout behavior in Hostinger.

## Production acceptance checklist

- GitHub Actions is green.
- Hostinger deployment succeeds.
- `/health` is `ok` and `/ready` is `ready`.
- An authorized user can start analysis.
- “الخطة التشغيلية والموازنة لعام 2026” yields only evidence-backed proposals. Verify the beneficiary groups, the four operational objectives, implementation responsibilities, dates, KPI descriptions, budget total, and budget lines only when each appears in the document evidence; absence must remain explicit rather than be filled from this checklist.
- A reviewer sees the original document, page, section, evidence, fields, destination, and conflicts.
- At least one proposal is approved and imported.
- The imported Enterprise 23 record displays “عرض المصدر”.
- A user without source-document access cannot view its analysis or source evidence.
- An image-only fixture returns `OCR_REQUIRED`.
