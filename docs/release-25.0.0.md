# Enterprise 25 Institutional Knowledge Intelligence

Version: `25.0.0`

This release establishes the first production architecture for Executive AI: a protected institutional corpus, Arabic-aware hybrid retrieval, document relationships, extractive sourced answers, and provider-neutral interfaces. It adds no external AI service and no secret.

Production deployment uses the existing build/start lifecycle and `apps/api/dist/server.js`. Apply migration `20260727_enterprise_25_institutional_knowledge`, run the idempotent seed, then backfill existing documents with `npm run knowledge:index`.

Production acceptance remains pending until Hostinger deploys the release, `/health` and `/ready` pass, the corpus is backfilled, and sourced search/answer behavior is verified with multiple confidentiality roles.
