# Enterprise 24 Extraction Methodology

## Principles

1. Evidence before structure.
2. Missing data instead of fabricated data.
3. Deterministic, versioned rules before any future AI provider.
4. Immutable source version and page boundaries where technically available.
5. Human approval before import.

## Normalization

Text is Unicode NFC-normalized. Non-breaking spaces, repeated horizontal whitespace, and line endings are normalized without changing numeric characters, decimal separators, percentages, currency amounts, or dates. Evidence snippets are bounded and retain the matching source phrase.

## PDF

PDF.js reads embedded text page by page. Positioned items are grouped into visual rows. A table candidate requires at least two aligned columns across at least two rows. Page count and table count are bounded. Empty embedded text does not imply successful extraction.

## DOCX

Mammoth reads text and semantic table markup. Before decompression, the ZIP central directory is checked for encryption, excessive entry count, and excessive declared uncompressed size. External file access and image conversion are disabled. DOCX page boundaries are not reliable and are reported accordingly.

## TXT

TXT is decoded as UTF-8 after file-size and basic binary-content checks. It yields one logical page.

## Rules

Versioned rules detect explicit Arabic headings and fields for objectives, axes, KPIs, initiatives, milestones, responsible departments, beneficiaries, dates, budget totals/lines, risks/treatments, governance scores, financial values, policy obligations, and reporting periods. Specialized extractors limit applicable proposal types by document type.

A rule result includes proposal type, structured fields, page, section/table, evidence, confidence, extraction method, and rule identifier. Configuration can disable a document type or rule and can raise the confidence threshold.

## OCR and future providers

When embedded text is below the configured minimum, the job becomes `OCR_REQUIRED`. Enterprise 24 does not perform OCR. Semantic extraction, LLM structured extraction, embeddings, and reranking are interfaces only and make no network call.
