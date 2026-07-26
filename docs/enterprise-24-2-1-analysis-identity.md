# Enterprise 24.2.1 — Analysis Identity and Strategic Reconstruction

## Scope

This patch corrects job identity, reanalysis lifecycle clarity, and strategic-axis reconstruction. It preserves the Enterprise 24/24.1 schema, providers, storage, RBAC, review/import workflow, Hostinger entry file, and operational extraction rules. It adds no environment variable, AI call, OCR provider, or database migration.

## Verified root causes

Three independent defects could make production acceptance appear unchanged:

1. The job's `extractionVersion` was replaced during persistence by the parser/provider version, so the review record did not identify the semantic ruleset that generated it.
2. The reusable fingerprint did not have one application-owned semantic-version source. A result from an older ruleset could therefore remain eligible for reuse when other fingerprint inputs were unchanged.
3. Strategic plans used the legacy line extractor. It accepted the ordinal captured after `المحور` as the proposal title and did not apply the Enterprise 24.2 logical assembler and quality gates.

The review retry action also used the same wording as forced reanalysis even though it intentionally retained the same job ID. This made lifecycle diagnosis ambiguous; it did not by itself cause server-side caching.

## Job identity contract

- Semantic extraction version: `24.2.1`.
- `DocumentAnalysisJob.extractionVersion` and extracted-text versions store the semantic ruleset version.
- Parser/provider name and version are stored only in `providerMetadata.provider`.
- The stable fingerprint contains document ID, immutable document-version ID, checksum, sorted enabled rule IDs, and semantic extraction version.
- An unforced request may reuse only an identical current-version fingerprint.
- A forced request adds a random nonce to the current stable fingerprint and therefore creates a distinct job.
- Retrying a failed, cancelled, or OCR-required job clears its failure state and retains the same job ID.

## Review lifecycle

The document details action **إعادة التحليل** sends `POST /api/documents/:id/analyze?force=true` and navigates to the exact job ID returned by the API.

The failed-job action **إعادة المحاولة** sends `POST /api/document-analysis/jobs/:id/retry` and remains on the same job.

The review summary shows:

- job ID;
- semantic extraction version;
- job creation timestamp;
- document type.

Persisted failure details remain visible only for `FAILED` and `OCR_REQUIRED`; successful loads clear local request errors.

## Strategic-axis reconstruction

The deterministic strategic extractor now consumes the same in-memory logical lines used by the operational mapper. It supports:

- `المحور` + a separate ordinal + adjacent title;
- axis label/ordinal before a multiline title;
- a multiline title followed by the axis label/ordinal;
- an inline axis label, ordinal, and title.

The proposal retains the source page, contributing line indexes, exact bounded evidence, ordinal, and sequence number when recognized. Heading-only, number-only, and ordinal-only titles such as `الأول` through `الرابع` do not pass quality gates. No axis proposal is produced when a complete title is absent from evidence.

## Production-structure capture boundary

The page/table/job APIs are authenticated and confidentiality-aware. This implementation environment did not contain a reusable production session, a production bearer token, or the production document. Consequently:

- no production job, page, table, row, or cell was downloaded;
- no production data was modified;
- no fixture is represented as directly production-derived.

The existing sanitized operational regression fixture remains a reconstruction of the UAT-reported shape and approved acceptance values. It is not evidence that the real production layout has been captured.

When an authorized operator performs the capture, only these structures may be retained:

- normalized line boundaries and page numbers;
- table/row/cell indexes and header roles;
- blank/merged-cell placement and direction;
- generic typed placeholders preserving layout;
- non-confidential acceptance values explicitly approved for testing.

Private titles, names, narrative text, document bytes, raw extracted text, storage paths, tokens, and identifiers must be removed. Each replacement should preserve line count, cell position, value type, and merge/carry-forward behavior while substituting generic content.

## No-migration decision

No schema change is necessary. The current job already has `extractionVersion`, provider metadata is JSON, and page/line/table/row/cell references fit the existing proposal data. The correction is application logic plus seed default and UI diagnostics.

## Live acceptance

After CI and Hostinger deployment:

1. Open each source document and choose **إعادة التحليل**.
2. Confirm the new review URL has a job ID different from the prior job.
3. Confirm the review summary reports `24.2.1`, the new creation time, and correct document type.
4. Confirm the strategic plan has complete axis titles and no ordinal-only proposals.
5. Confirm the operational plan exposes the evidence-backed beneficiaries, four objectives, supported KPIs and initiatives, 530000 SAR total where present, and supported budget lines.
6. Confirm every proposal has source page/evidence and no stale error banner.
7. Approve and import one complete related set, then verify source traceability.

Local regression success is not production acceptance. Live UAT remains required.
