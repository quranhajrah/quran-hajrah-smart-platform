# Enterprise 23 Executive Intelligence Platform

## Purpose and boundaries

Enterprise 23 turns authenticated institutional records into a shared executive view. It does not import unknown association figures, infer missing measurements, or call a paid/generative AI service. Enterprise 22 document controls, authentication, cookies, RBAC, health/readiness, migrations, and the Hostinger `apps/api/dist/server.js` entry remain unchanged.

The Arabic administration landing page is `/`. Management pages are under `/executive/*`; protected JSON APIs are under `/api/executive/*`.

## Modules

### Institutional metrics

A metric definition stores an English key, Arabic name, description, unit, data type, frequency, responsible department, target, thresholds, source, direction, and active state. `MetricValue` stores each dated numeric or text measurement and an optional source document. Definitions and measurements are deliberately separate, so seeding a definition never creates a statistic.

Metric status is derived from its target and warning/critical thresholds. History and trend endpoints return recorded values in date order.

### Strategy and KPIs

Strategic objectives have a code, axis, baseline/target, owner, dates, weight, status, and progress. KPIs belong to an objective and have their own formula, target, unit, frequency, owner, data source, weight, status, and dated measurements.

### Operational initiatives

An initiative may link to a strategic objective and records department, owner, dates, planned budget, actual spending, progress, status, milestones, updates, risks, and evidence. Evidence links point to Enterprise 22 documents and are accepted only after the actor passes the document confidentiality check.

### Risks

The risk register stores cause, consequence, inherent likelihood/impact, existing controls, residual likelihood/impact, owner, due/review dates, objective/initiative links, treatments, and evidence. Scores are computed by the API and cannot be mass-assigned.

### Alerts

The reusable generator detects:

- documents expiring in 30 days;
- overdue or at-risk initiatives;
- at-risk or off-track KPIs;
- critical residual risks;
- overdue risk treatments;
- initiative budget overruns;
- inactive users requiring periodic review;
- a missing generated executive report for the month.

Fingerprints make generated alerts idempotent. Run `npm run executive:alerts` manually or through a future approved scheduler. The application does not run an in-process cron.

### Executive health

The score is transparent, weighted, historical, and explicit about missing data. See [Executive health score methodology](executive-health-score-methodology.md).

### Reports

Reports support draft, structured generation, approval, archive, source references, editable stored sections, and an authenticated Arabic print view. Generation and approval use distinct permissions. The HTML architecture is ready for a later PDF adapter; no PDF or AI provider is called.

### Structured executive assistant

The dashboard label is exactly “مساعد تنفيذي — إصدار البيانات المؤسسية”. Supported questions query local structured records:

- ما مؤشرات الأداء المتعثرة؟
- ما المبادرات المتأخرة؟
- ما المخاطر الحرجة؟
- ما الوثائق التي ستنتهي؟
- ما نسبة تنفيذ الخطة؟
- أعطني ملخصًا تنفيذيًا

Responses identify their sources and missing data. The endpoint is rate-limited and does not claim generative-AI capability.

## API map

All endpoints require authentication. Their second authorization layer uses the permission shown in the RBAC guide.

| Area        | Endpoints                                                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard   | `GET /api/executive/dashboard`, `GET /api/executive/health`, `GET /api/executive/alerts`, `GET /api/executive/activity`, `POST /api/executive/query`, preferences and health snapshots |
| Metrics     | list/create/read/update/delete, `POST /:id/measurements`, `GET /:id/history`, `GET /:id/trend`                                                                                         |
| Objectives  | CRUD, `GET /:id/progress`, `POST /:id/kpis`                                                                                                                                            |
| KPIs        | CRUD, summary, measurement, and trend                                                                                                                                                  |
| Initiatives | CRUD, milestones, updates, evidence, and budget summary                                                                                                                                |
| Risks       | CRUD, treatments, evidence, heat matrix, and critical list                                                                                                                             |
| Alerts      | list/create/generate, acknowledge, resolve, and dismiss                                                                                                                                |
| Reports     | CRUD, editable sections, generate, approve, archive, and authenticated print view                                                                                                      |

Every list accepts bounded pagination; relevant lists accept search, status, department, or objective filters. Zod schemas reject unknown fields, invalid enum values, invalid ranges, negative money, percentages outside 0–100, and inverted date ranges.

## Operating sequence

1. Apply the committed migration with `npm run db:deploy`.
2. Run `npm run db:seed`. This creates definitions and permission defaults but no measurements.
3. Confirm `/health`, `/ready`, login, and dashboard.
4. Enter the first approved metric measurement.
5. Create objectives before their KPIs.
6. Link initiatives to objectives where applicable.
7. Record risks and treatment owners/dates.
8. Generate alerts and a draft report.
9. Have a separately authorized user approve the generated report.
10. Verify all mutations in the common audit log.

## Known limitations

- There is no external AI, semantic executive search, automated PDF export, notification delivery, or cron scheduler in this release.
- Dashboard quality is constrained by measurement freshness and coverage.
- Source-system integration is manual; future adapters should call the same service boundaries.
- Production acceptance requires real-domain validation and approved test records; local and CI success alone are not production acceptance.
