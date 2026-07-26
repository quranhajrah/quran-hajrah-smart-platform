# Enterprise 24 Extraction Methodology

## Principles

1. Evidence before structure.
2. Missing data instead of fabricated data.
3. Deterministic, versioned rules before any future AI provider.
4. Immutable source version and page boundaries where technically available.
5. Human approval before import.

## Normalization

Raw extracted page text is retained separately. A normalized copy is Unicode NFC-normalized; bidi controls, non-breaking spaces, repeated horizontal whitespace, and line endings are normalized without changing numeric values, decimal separators, percentages, currency amounts, or dates. Consecutive Arabic glyphs separated by single visual-extraction spaces are joined, while wider word boundaries remain intact.

For known institutional labels only, a visually reversed colon-delimited line is reconstructed by reversing segment and word order. Normal logical-order lines are not changed. Arabic-Indic, Eastern Arabic, and Western digits are recognized for matching but evidence keeps the source form. Hijri dates are identified and preserved as Hijri; they are never silently converted to Gregorian.

## PDF

PDF.js reads embedded text page by page. Positioned items are grouped into visual rows. A table candidate requires at least two aligned columns across at least two rows. Page count and table count are bounded. Empty embedded text does not imply successful extraction.

## DOCX

Mammoth reads text and semantic table markup. Before decompression, the ZIP central directory is checked for encryption, excessive entry count, and excessive declared uncompressed size. External file access and image conversion are disabled. DOCX page boundaries are not reliable and are reported accordingly.

## TXT

TXT is decoded as UTF-8 after file-size and basic binary-content checks. It yields one logical page.

## Rules

Versioned rules first detect document sections, then map explicit Arabic headings and table headers to objectives, KPIs, initiatives, milestones, responsible departments, beneficiaries, dates, budget totals/lines, risks/treatments, governance scores, financial values, policy obligations, and reporting periods. Adjacent line fields and same-row table fields are attached to their entity. Specialized extractors limit applicable proposal types by document type.

A rule result includes proposal type, structured fields, page, section/table, evidence, confidence, extraction method, and rule identifier. Configuration can disable a document type or rule and can raise the confidence threshold.

Quality gates require a source page, bounded evidence, meaningful semantic content, and at least one field value present in evidence. Heading-only, numeric-only, duplicate normalized titles, navigation/header/footer artifacts, and orphaned relationship links are rejected. Useful ambiguous table mappings receive a confidence penalty and `NEEDS_REVIEW`; unsupported values are never fabricated.

## OCR and future providers

When embedded text is below the configured minimum, the job becomes `OCR_REQUIRED`. Enterprise 24.1 does not perform OCR. Its “semantic” mapping is deterministic local rule processing—not semantic AI. LLM structured extraction, embeddings, and reranking remain interfaces only and make no network call.
