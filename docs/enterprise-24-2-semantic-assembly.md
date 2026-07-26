# Enterprise 24.2 — Production-Structure Semantic Assembly

## Scope

Enterprise 24.2 changes only the deterministic mapping layer and the analysis review presentation. It preserves the Enterprise 24/24.1 database model, APIs, RBAC, storage provider, import workflow, Hostinger entry file, and migration lifecycle. It does not call AI, OCR, embeddings, or an external extraction service.

## Production gap and structural inspection

The production UAT result proved that retrieval, PDF parsing, Arabic text extraction, and table persistence worked, but the mapper emitted only two beneficiary groups. The remaining entities were missed because the rule layer expected one complete label/value per line and at least two recognizable table headers in an early row. Split headers, visually reversed columns, blank merged cells, and adjacent values therefore lost their logical relationships.

The protected production page/table endpoints require an authenticated document-analysis session. No reusable authorized session was available in the implementation environment, so no production data was downloaded or modified. Instead, the accepted UAT shape (three pages, one table, split RTL labels, merged cells, and the explicitly approved acceptance numbers) is represented by a sanitized structural fixture. It contains generic test titles and no confidential document prose.

## Logical record assembler

The assembler runs in memory after raw extraction:

```text
stored raw page text and table cells
→ normalized semantic lines
→ adjacent label/value assembly
→ split-header and table-role assembly
→ deterministic proposals
→ existing quality gates, review, and import
```

It supports:

- multiline labels followed by values;
- value/title followed by an RTL label;
- numbers separated from beneficiary group text;
- budget totals in label-before-value or value-before-label order;
- vertically and horizontally split table headers;
- physical table columns in either direction;
- carry-forward for merged objective, category, and responsibility cells;
- page/line and page/table/row/cell references, including the originating row of carried cells.

Raw extracted text is never rewritten. Joined text is an in-memory matching copy; evidence retains the source fragments.

## Expanded deterministic mappings

Header aliases now cover operational objectives, achievement/performance indicators, work plans and executive actions, responsible parties, target groups, proposed/estimated amounts, and common expenditure-category labels. Supported rows generate objectives, KPIs, initiatives, budget lines, responsibilities, dates, and beneficiaries only when the relevant cell or adjacent line contains evidence.

No missing target, formula, date, department, initiative, or amount is fabricated. Ambiguous one-field rows receive a confidence penalty and remain subject to the existing confidence threshold and human review.

## Review-center behavior

A successful load clears any prior local request error. Job failure metadata is displayed only while the job status is `FAILED` or `OCR_REQUIRED`. Starting a retry clears persisted failure metadata, and successful extraction replaces provider metadata through the existing finalization path.

## Migration decision

No migration is required. Logical records are temporary, and source references fit in the existing proposal JSON/field structure. Persisted page, table, row, and cell records from Enterprise 24 remain unchanged.

## Acceptance procedure

After CI and Hostinger deployment:

1. Verify `/health` and `/ready`.
2. Reanalyze “الخطة التشغيلية والموازنة لعام 2026” with `document_analysis.run`.
3. Confirm three beneficiary groups, four operational objectives, four supported KPIs, evidence-supported initiatives, the evidence-backed 530000 SAR total, and supported budget lines.
4. Confirm every proposal shows source page and evidence and table proposals expose table/row/cell references.
5. Confirm the summary counts match the proposal groups and no stale error banner appears.
6. Review and import one complete related set, then verify source traceability.

Local regression coverage is not production acceptance. Production completion remains pending until these live observations succeed.

## Known limitations

- Image-only PDFs still require a future OCR provider.
- A table whose extraction loses all cell boundaries cannot be reconstructed deterministically.
- Ambiguous horizontal header fragments may require reviewer correction.
- Analysis still runs after request acceptance in the API process and can be interrupted by a process restart.
