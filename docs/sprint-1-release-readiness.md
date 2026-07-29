# Sprint 1 Executive Experience — Release Readiness

## Scope and included commits

This document covers production stabilization for the Sprint 1 executive experience only. It does
not introduce Sprint 2 modules, change the platform architecture, or declare a new product version.

- Sprint 1A — Executive Foundation and Home Dashboard:
  `bcffe4fb9a8f96be20f30ecc673cfe2b62564804`
- Sprint 1B — Executive Command Center and Today at the Association:
  `4dd468366f7687b3d4a93180b339c3cce0f32cf6`
- Sprint 1C — Executive Leadership Dashboard and Smart Experience:
  `1507c3cb0e2def96dfd15a7ac0a16560bc7255da`
- Sprint 1D — focused stabilization commit using the approved subject:
  `fix(admin): stabilize Sprint 1 executive production experience`

The pre-existing Enterprise 26.1 working-tree changes were intentionally left unmodified, unstaged,
and outside the Sprint 1D commit.

## Completed executive surfaces

- Authenticated professional RTL shell with desktop, tablet, and mobile navigation.
- Home Dashboard with governed aggregate data, provenance, freshness, coverage, and explicit missing
  values.
- Today at the Association with daily priorities, alerts, activities, evidence, and controlled
  executive brief generation.
- Executive Command Center with governed alert actions, risk matrix, exception handling, evidence,
  and user-initiated recommendations and writing.
- Executive Leadership Dashboard with nine governed sections covering institutional health,
  objectives and KPIs, initiatives, risks, Quran impact, compliance, reports, metrics, and CEO
  summary.
- Executive Smart Bar with permission-filtered navigation, structured queries, institutional
  knowledge, and professional executive writing.
- Governed source-record navigation with optional Enterprise 24 evidence and measurement history.

## Supported permissions

The executive shell and its APIs continue to enforce the existing server-side permission model.
Relevant permissions include:

- Executive visibility: `dashboard.view`, `metrics.view`, `strategy.view`, `kpi.view`,
  `initiatives.view`, `risks.view`, `alerts.view`, and `reports.view`.
- Governed mutations: `alerts.manage`, existing entity management permissions, report permissions,
  and `dashboard.configure` for snapshot/configuration operations.
- Structured intelligence: `executive.query`, plus the underlying domain permissions required by
  each structured scope.
- Knowledge and evidence: `documents.view`, `document_analysis.view`, `knowledge.search`, and
  `knowledge.ask`.
- Executive writing: `executive_ai.use`, `executive_ai.reports`,
  `executive_ai.recommendations`, and `executive_ai.letters`.
- Confidential activity identity: `audit.view`.

Client-side hiding is not treated as authorization. Protected routes and API operations continue to
check permissions server-side.

## Data-source and interpretation limitations

- Dashboard and leadership values are bound to the existing Enterprise 22–26 aggregate and domain
  APIs. Missing institutional data is displayed as unavailable and is not coerced to zero.
- Source badges and freshness timestamps identify the API or institutional record used by each
  surface. Evidence remains subject to document confidentiality and analysis permissions.
- The risk time series groups records by their creation month while showing their current status
  and score. It is not a historical status-change series; the interface now states this explicitly.
- Optional Enterprise 24 evidence or metric history can fail independently without hiding an
  otherwise authorized source record.
- Executive AI and institutional knowledge requests are initiated explicitly by the user. The
  interface does not run those services automatically on page load or Smart Bar open.
- Validation was performed while the preserved, pre-existing Enterprise 26.1 changes remained in
  the working tree, as required. Those changes must be resolved through their own approved release
  process before a production release candidate is assembled.

## Stabilization defects corrected

- Prevented in-flight structured-query, knowledge, capability, and writing responses from restoring
  protected Smart Bar state after close, mode change, unmount, or logout.
- Added a modal focus trap, Escape handling, invocation-focus restoration, and focus-timer cleanup.
- Preserved governed registry `status`, `objectiveId`, search, and page query state; applied
  entity-specific status choices and made objective filtering visible and removable.
- Broadcast authorization failures across executive data loaders so dashboard and insight caches are
  cleared together.
- Kept valid source records visible when optional evidence or history requests fail.
- Prevented a blank Home Dashboard when recent documents omit category, type, version, or update
  fields.
- Corrected ambiguous Arabic KPI, initiative, report status, and report-type labels.
- Corrected the risk-series label and explanation to match the API's actual grouping semantics.
- Raised desktop executive controls to the 44 px touch-target minimum.
- Replaced clipped mobile Smart Bar mode scrolling with a two-column responsive mode grid.
- Corrected the active Smart Bar secondary-text contrast to meet WCAG 2.1 AA.

## Validation evidence

### Automated validation

- Admin: 8 files and 50 tests passed.
- API: 22 files and 136 tests passed with one worker.
- Database package: 7 files and 31 tests passed from the package working directory.
- Portal: 1 file and 1 test passed.
- Total: 38 test files and 218 tests passed.
- TypeScript passed for admin, API (application and test configurations), portal, database
  (application and test configurations), shared, auth, and UI.
- Repository-wide ESLint passed with zero warnings.
- Sensitive-file check passed.
- Prisma schema validation and Prisma Client generation passed with Prisma 6.19.3.
- Production lifecycle validation passed.

The first concurrent run is retained as diagnostic evidence: admin passed 50/50, while five API
tests timed out under resource contention and the database tests were invoked from the repository
root rather than their package working directory. The API rerun with one worker passed 136/136, and
the database package rerun from its correct working directory passed 31/31. No test was weakened or
skipped.

### Formatting

- All 27 Sprint 1 files included in the formatting check conform to Prettier.
- The repository-wide check continues to identify exactly 45 pre-existing formatting files outside
  Sprint 1. They were not mass-formatted.

### Production build and performance

- Database, shared, auth, UI, API, admin, and portal builds passed.
- Admin production assets:
  - HTML: 0.38 kB (0.27 kB gzip)
  - CSS: 87.21 kB (17.34 kB gzip)
  - JavaScript: 442.32 kB (121.85 kB gzip)
- Portal production assets:
  - HTML: 0.39 kB (0.28 kB gzip)
  - CSS: 4.77 kB (1.40 kB gzip)
  - JavaScript: 194.53 kB (60.82 kB gzip)
- The admin build currently emits one application JavaScript chunk; route-level chunking is not
  present.
- Automated tests confirm one Home Dashboard aggregate request, protected request deduplication,
  user-initiated AI/knowledge calls, and on-demand loading of heavy risk/trend data.
- Vite reports the existing empty Tailwind `content` configuration warning for admin and portal.
  The Sprint 1 visual journey rendered correctly, but this configuration should be confirmed before
  changing or relying on Tailwind-generated utility styles.
- Lighthouse is not installed and no Lighthouse executable is available in the validation
  environment. No Lighthouse score is claimed.

### Interactive journey, RTL, and accessibility

The verified browser journey was:

`Login → Home → Today → Command Center → Leadership → source record → governed alert action →
Smart Bar structured query → knowledge answer → executive writing → logout`

The journey completed without a dead route, placeholder, or post-fix blank screen. Source,
freshness, limitations, explicit missing values, useful back navigation, and protected-state cleanup
were observed.

At 360, 390, 768, 1024, 1440, and 1920 px, the audited executive page remained RTL with no
page-level horizontal overflow. No visible actionable target outside data tables was smaller than
44×44 px after correction. Keyboard navigation, visible focus, Ctrl/Cmd+K, Escape, focus trapping,
risk-matrix keyboard controls, semantic headings, accessible labels, numeric chart alternatives,
non-color status text, and reduced-motion styles were verified through browser checks, source
inspection, and automated tests. A computed Smart Bar text sample checked 40 visible text nodes with
no WCAG AA failures after correction; the minimum measured contrast ratio was 4.57:1.

## Known issues and release constraints

- Exactly 45 legacy repository formatting files remain.
- The empty Tailwind `content` warning remains and is outside Sprint 1 stabilization scope.
- No Lighthouse score is available.
- The pre-existing Enterprise 26.1 modified and untracked files remain unresolved and outside this
  release-readiness commit.
- CI, a real production database migration, external storage, reverse proxy/TLS, and production
  environment integrations were not executed during local validation.

## Deployment prerequisites

1. Resolve Enterprise 26.1 through its own approved commit/release decision without combining it
   into Sprint 1D.
2. Push the intended commit sequence and require a green GitHub Actions run for the exact production
   candidate SHA.
3. Confirm production `DATABASE_URL` and migration-specific `DIRECT_URL`, authentication secrets,
   CORS/origin settings, durable document storage, and administrator bootstrap inputs.
4. Take and verify a database and document-storage backup.
5. Run the existing production lifecycle: migration deploy, system seed, conditional administrator
   bootstrap, then the compiled API server.
6. Publish the built admin and portal assets through the approved reverse proxy with TLS and SPA
   fallback routing.
7. Do not create a production tag until the release owner approves the final candidate.

## Rollback plan

- Preserve the database and document-storage backup taken immediately before deployment.
- For an application-only failure, redeploy the last known approved application artifact or revert
  the focused Sprint 1D commit. The pre-stabilization Sprint 1 head is
  `1507c3cb0e2def96dfd15a7ac0a16560bc7255da`.
- Do not run destructive schema rollback commands. If a migration has run, use an approved forward
  corrective migration and restore data only from the verified backup when formally authorized.
- Re-run health, login, RBAC, and executive smoke checks after rollback.

## Post-deployment smoke-test checklist

- Confirm liveness, readiness, database, and storage health checks.
- Log in as a CEO-authorized user and as a restricted viewer.
- Verify Home, Today, Command Center, and Leadership routes, source badges, freshness, and missing
  values.
- Open an authorized source record and return without losing the intended registry filter.
- Perform an alert acknowledgment with `alerts.manage`; verify denial without that permission.
- Confirm actor identity is hidden without `audit.view`.
- Run one structured query and verify underlying domain permission enforcement.
- Run one knowledge answer and one executive-writing request; verify separated sources, quotations,
  limits, and no automatic request on open.
- Log out during or after Smart Bar work and verify protected results and caches are cleared.
- Check 360 px and desktop RTL layouts, keyboard focus, Escape, and Ctrl/Cmd+K.
- Review API/client logs for secrets, confidential content, unhandled errors, and repeated requests.
