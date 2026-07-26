# Enterprise 24.1 — Institutional Semantic Extraction Upgrade

## Why 24.0 produced a weak proposal

The 24.0 rule layer evaluated isolated text lines. It could recognize a heading but did not reconstruct visual RTL word order, establish section context, map a table row by its headers, or connect adjacent objective, KPI, responsibility, date, beneficiary, and budget fields. A section label such as “الأهداف الفرعية” could therefore outrank its contents and become the only low-value proposal.

Enterprise 24.1 retains the extraction providers and replaces only that rule layer with a deterministic institutional mapper. It makes no AI, OCR, embedding, or external-service call.

## Processing sequence

```text
raw page text and positioned tables
→ normalized RTL reading copy
→ institutional sections
→ semantic lines and table rows
→ evidence-backed entity candidates
→ quality gates and duplicate suppression
→ parent/child proposal relationships
→ human review
→ conflict preview and transactional import
```

The source page’s raw text is never overwritten. Normalized text is stored separately.

## Arabic normalization

- NFC Unicode normalization and bidi-control removal.
- Arabic-Indic, Eastern Arabic, and Western digit matching.
- Split single-glyph Arabic word repair while preserving wider word boundaries.
- Colon-segment and word-order repair only when the result begins with a recognized institutional heading.
- Safe punctuation and whitespace normalization without altering monetary, percentage, or date values.
- Gregorian normalization only for unambiguous dates.
- Hijri values retain their calendar type and original text and are never converted silently.

## Sections and rules

The section detector recognizes association data, beneficiaries, general and sub-objectives, KPIs, work plan, responsibilities, start/end dates, budget and totals, income, expenses, risks, governance, and recommendations. A section records heading, normalized heading, page range, source lines/tables, confidence, and rule ID.

Versioned `semantic.*.v2` rules generate beneficiaries, operational objectives, KPIs, initiatives, responsibilities, dates, budget totals, budget lines, and logical table rows. Table headers assign cell roles and preserve table, row, and cell evidence. Merged or ambiguous structure lowers confidence.

## Quality gates

A proposal must have a source page, bounded evidence, a meaningful title/value, and a proposed value visible in evidence. Heading-only and numeric-only candidates, normalized duplicates, unsupported values, and orphaned relationships are rejected. Useful ambiguity is marked `NEEDS_REVIEW`.

No number, date, gender split, target, formula, baseline, or organizational match is inferred without explicit evidence. A recognized department is linked; unmatched source text remains reviewable.

## Relationships and import

`ExtractionProposalRelation` stores objective→KPI, objective→initiative, objective→beneficiary, entity→date, initiative→milestone, risk→treatment, and budget→budget-line relationships. Relationships are created only when both candidates survive quality gates.

The import engine orders parents before children and resolves relationship IDs inside the same transaction. Duplicate/conflict default is `skip`. Allowed reviewer choices remain update, create, or selected-field merge. Beneficiary counts are not live measurements unless an authorized reviewer explicitly selects `METRIC_VALUE`, a target metric, and a measurement date.

## Production acceptance

After deploying and seeding 24.1:

1. Verify `/health` and `/ready`.
2. Reanalyze “الخطة التشغيلية والموازنة لعام 2026” as an authorized user.
3. Confirm at least three evidence-backed beneficiary groups, four operational objectives, four KPIs, supported responsibilities/dates, one SAR budget total of 530000, and supported budget lines.
4. Confirm every item shows page, section, evidence, confidence, and relationships.
5. Confirm the weak heading-only proposal is absent.
6. Approve and import one complete related set after conflict preview.
7. Open the imported record’s source link and verify confidentiality enforcement.

This checklist is a UAT expectation, not production evidence. Completion may be claimed only after GitHub Actions, Hostinger deployment, live health/readiness, reanalysis, import, and source traceability are all observed.

## Known limitations

- Image-only documents remain `OCR_REQUIRED`.
- Complex merged PDF tables can require human correction.
- Arabic repair is conservative and limited to recognized institutional structures.
- Missing targets/formulas/dates remain missing until a reviewer supplies them.
- Analysis still runs in the API process after request acceptance; a restart can interrupt an active job.
