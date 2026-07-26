# Release 24.1.0

Title: **Enterprise 24.1 Institutional Semantic Extraction Upgrade**

Enterprise 24.1 upgrades the existing local rule layer; it does not rebuild Enterprise 24 and does not add external AI, OCR, embeddings, or paid services.

## Delivered

- Conservative Arabic visual-order and split-glyph reconstruction with raw text preservation.
- Structured section detection and semantic table-row mapping.
- Complete beneficiary, operational-objective, KPI, initiative, responsibility, date, budget, and budget-line candidates.
- Evidence, confidence, rule IDs, quality state, duplicate suppression, and heading-only rejection.
- Persistent proposal relations and relation-aware transactional Enterprise 23 import.
- Arabic grouped review UI, document extraction summary, relationship display, and explicit import destination.
- Additive migration `20260726_enterprise_24_1_semantic_extraction`.
- Production operational-plan PDF acceptance fixture without a private production document.

## Deployment

Use the existing production flow. `postbuild:production` runs committed migrations through `DIRECT_URL`, then the idempotent seed. The Hostinger entry file remains `apps/api/dist/server.js`; analysis never delays `listen()`.

Production acceptance remains conditional on green CI, successful Hostinger deployment, live health/readiness, authorized reanalysis of the operational plan, visible minimum proposal output, an approved/imported related set, and verified source traceability.
