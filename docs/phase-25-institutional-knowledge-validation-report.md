# Enterprise 25 Institutional Knowledge Validation Report

Date: 2026-07-27
Version: `25.0.0`

## Scope

Enterprise 25 adds the institutional knowledge layer above the existing Knowledge Center. The Enterprise 24.2.1 extraction engine is frozen: no file under `apps/api/src/analysis` was changed.

## Architecture delivered

- Additive PostgreSQL models for versioned indexes, page-aware chunks, document relationships, safe query telemetry, and index configuration.
- Deterministic `local-arabic-hybrid-v1` feature embedding provider with Arabic normalization and hybrid cosine/lexical ranking.
- Indexing from current persisted analysis text or, when unavailable, the same protected `StorageProvider` and bounded parser provider used by the platform.
- Metadata-only partial indexing for unsupported or text-poor files; no fabricated text.
- Durable upload-time queue plus non-blocking background indexing, one-document indexing API, full-corpus rebuild API, and `npm run knowledge:index`.
- Confidentiality-aware search and relationships.
- Extractive answers with mandatory numbered document/version/page references.
- Provider contracts for a future approved Executive AI without external AI calls in this release.
- Arabic RTL administration workspace at `/knowledge-intelligence`.

## Migration

`20260727_enterprise_25_institutional_knowledge`

The migration is additive and contains no `DROP`, `TRUNCATE`, `DELETE`, database reset, `migrate dev`, or `db push`.

## RBAC

- `knowledge.search`
- `knowledge.ask`
- `knowledge.relations.view`
- `knowledge.index`
- `knowledge.configure`
- `knowledge.audit`

The seed remains idempotent. `super_admin` receives all permissions. Viewer and employee defaults do not receive question-answer or index-management permission. Document confidentiality is enforced independently of knowledge permission.

## API

- `GET /api/knowledge/summary`
- `POST /api/knowledge/search`
- `POST /api/knowledge/answer`
- `POST /api/knowledge/documents/:id/index`
- `POST /api/knowledge/index/rebuild`
- `GET /api/knowledge/documents/:id/relations`

## Validation results

| Check | Result |
| --- | --- |
| `npm run security:check` | Passed; no sensitive filenames detected |
| `npm run db:validate` | Passed with isolated validation URLs |
| `npm run db:generate` | Passed; Prisma Client 6.19.3 generated |
| `npm run lint` | Passed with zero warnings |
| `npm run typecheck` | Passed for all workspaces |
| `npm run test` | Passed: 158 tests across admin, API, portal, and database |
| Enterprise 25 unit tests | Passed: Arabic ranking, chunk references, mandatory citations |
| Enterprise 25 migration/RBAC tests | Passed |
| Enterprise 25 UI test | Passed |
| `npm ci --include=dev --ignore-scripts --dry-run` | Passed; lockfile is consistent |
| `npm run build:artifacts` | Passed; API, admin, portal, and all packages built |
| `npm run validate:production-startup` | Passed; `apps/api/dist/server.js` remains the entry |
| `npm run smoke:production` | Passed; liveness, sanitized readiness failure, SPAs, static assets, and protected Enterprise 25 API |
| `npm audit --omit=dev` | Passed; zero vulnerabilities |
| Frozen extraction-engine diff | Passed; no changed file under `apps/api/src/analysis` |

`npm run build:production` was not allowed to run its `postbuild:production` phase locally because that phase intentionally performs `prisma migrate deploy` and seed against the configured database. No production database credentials exist in this workspace, and no production database was contacted. The equivalent compiled artifact sequence, startup validation, and production smoke test passed.

## Security controls

- Search candidates are filtered by confidentiality level and active explicit access rules before ranking.
- Local storage paths, generated names, cookies, tokens, connection strings, and secrets are absent from API DTOs and logs.
- Query telemetry stores a SHA-256 hash, result count, status, and latency, not the raw question.
- Answering is rate-limited and produces no response text when evidence is insufficient.
- Evidence snippets are bounded and only returned to authorized users.
- Upload success is not rolled back when asynchronous indexing fails; the durable queue remains recoverable.

## Known limitations

- The local vector implementation is deterministic Arabic-aware feature search, not an LLM or neural embedding model.
- Ranking is application-side and bounded to the current institutional corpus.
- Relationship type `SHARES_TOPIC` represents evidence-term overlap only.
- Image-only and unsupported files require existing approved extracted text for content search; otherwise only metadata is indexed.
- Production corpus indexing and role-by-role UAT remain required.

## Production steps still required

1. Deploy commit through the existing Hostinger Git workflow.
2. Confirm migration and seed completed.
3. Verify `/health` and `/ready`.
4. Run `npm run knowledge:index` in the production environment using the same persistent `DOCUMENT_STORAGE_ROOT`.
5. Verify Arabic search and sourced answers across several documents.
6. Verify a viewer cannot retrieve confidential or highly confidential evidence.
7. Verify new uploads move from queued to indexed.

## Status

**Successful locally; production acceptance pending.**
