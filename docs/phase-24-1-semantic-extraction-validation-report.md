# Enterprise 24.1 Semantic Extraction Validation Report

Date: 2026-07-26

Version: 24.1.0

Local status: **successful**

Production acceptance: **pending deployment and live UAT**

## Root cause

Enterprise 24.0 evaluated isolated lines. It did not consistently reconstruct visually reversed Arabic word order, establish section context, map table cells by their headers, or persist relationships between objectives and adjacent fields. This allowed a heading such as “الأهداف الفرعية” to become a low-value proposal while the document body remained ungrouped.

## Delivered

- raw and normalized extracted text separation;
- conservative RTL word-order and split-glyph repair;
- institutional section detection;
- beneficiary, operational-objective, KPI, initiative, responsibility, date, budget, and budget-line rules;
- semantic table-row mapping;
- evidence and confidence quality gates;
- duplicate, heading-only, and orphan-link suppression;
- persistent proposal relationships;
- relation-aware transactional import;
- grouped Arabic review UI and document-level extraction summary;
- server-side validation of edited proposal JSON;
- versioned seed rules and additive Prisma migration.

## Migration

`20260726_enterprise_24_1_semantic_extraction`

The migration is additive. It adds `DocumentExtractedText.rawText`, `StrategicObjective.objectiveLevel`, and `ExtractionProposalRelation`. It does not reset, delete, or rewrite existing production data.

## Validation results

| Check | Result |
| --- | --- |
| Prisma validate | Passed with non-production placeholder URLs |
| Prisma generate | Passed |
| ESLint | Passed with zero warnings |
| Typecheck | Passed for all workspaces |
| API tests | 94 passed |
| Database tests | 29 passed |
| Admin tests | 8 passed |
| Portal tests | 1 passed |
| Total tests | 132 passed |
| Production build | Passed |
| API output | `apps/api/dist/server.js` present |
| Admin/portal output | Both `dist/index.html` files present |
| Production-only install | Passed, 225 production packages |
| Production smoke | Passed |
| Security filename check | Passed |
| `npm audit --omit=dev` | 0 vulnerabilities |

The first workspace-wide test invocation encountered a local Windows sandbox access error while esbuild loaded the admin and portal Vite configurations. Both frontend suites were rerun outside that filesystem restriction and passed. API and database suites passed in the workspace run.

## Production smoke coverage

The compiled server started without delaying `listen()`. The smoke test verified liveness, sanitized database-not-ready behavior, admin and portal static assets, login, Knowledge Center, Executive Intelligence, Document Intelligence, and protected API routing.

No migration or seed was executed against the production Supabase database from the local validation environment.

## Known limitations and remaining acceptance

- Image-only PDFs still require future OCR.
- Complex merged PDF tables may need reviewer correction.
- Missing values remain missing and must be supplied explicitly during review.
- Production completion requires green GitHub Actions, successful Hostinger deployment, live `/health` and `/ready`, authorized reanalysis of the operational plan, visible minimum proposal output, one approved related import, and verified source traceability.
