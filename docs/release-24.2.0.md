# Release 24.2.0

Title: **Enterprise 24.2 Production-Structure Semantic Assembly**

Enterprise 24.2 closes the deterministic mapping gaps observed during production UAT without changing the database schema or the production runtime.

## Delivered

- In-memory multiline and RTL label/value assembly.
- Split table-header mapping with expanded institutional aliases.
- Direction-independent table columns and merged-cell carry-forward.
- Evidence-backed operational objective, KPI, initiative, beneficiary, budget-total, and budget-line extraction.
- Page, line, table, row, cell, and merged-source references.
- Review-center stale-error cleanup.
- Sanitized production-structure regression fixture and acceptance tests.

## Deployment

Use the existing production build, migration, seed, and `apps/api/dist/server.js` entry file. There is no Enterprise 24.2 migration and no environment-variable change.

Production acceptance must not be claimed until the real operational-plan document is reanalyzed and all live acceptance criteria in the Enterprise 24.2 guide are visible.
