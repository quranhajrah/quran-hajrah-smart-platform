# Enterprise 25 — Institutional Knowledge Intelligence

## Objective

Enterprise 25 turns the existing Knowledge Center into a permission-aware institutional knowledge layer. It indexes current uploaded document versions, discovers evidence-based topic relationships, searches the corpus, and answers questions only from retrieved institutional evidence.

Enterprise 24.2.1 remains frozen. No extraction rule, job lifecycle, analysis table, or review/import workflow is changed by this release.

## Architecture

```text
Knowledge Center document/version
  -> durable knowledge index record
  -> analysis text when available, otherwise protected storage read
  -> bounded page-aware chunks
  -> local Arabic-aware feature vectors and lexical terms
  -> permission filter
  -> hybrid ranking
  -> search result or extractive answer
  -> numbered source references
```

The initial provider `local-arabic-hybrid-v1` is deterministic and local. It normalizes Arabic variants, hashes word and character features into a fixed vector, and combines cosine similarity with lexical overlap. This is an operational semantic-search baseline, not a neural language model. There are no external AI, embedding, OCR, or paid service calls.

## Data

- `KnowledgeDocumentIndex`: versioned, current/previous index state and provider metadata.
- `KnowledgeChunk`: bounded evidence text, page/section, lexical terms, vector, and content hash.
- `KnowledgeDocumentRelation`: symmetric, deduplicated topic relationships between current document versions.
- `KnowledgeQueryLog`: query hash, result count, answer status, and latency; raw questions are not stored.
- `KnowledgeIndexConfiguration`: version, provider, dimensions, chunk bounds, threshold, and result limit.

Migration: `20260727_enterprise_25_institutional_knowledge`.

## APIs

- `GET /api/knowledge/summary`
- `POST /api/knowledge/search`
- `POST /api/knowledge/answer`
- `POST /api/knowledge/documents/:id/index`
- `POST /api/knowledge/index/rebuild`
- `GET /api/knowledge/documents/:id/relations`

All routes require authentication and explicit knowledge permission. Search, answers, relationships, and source links remain constrained by document confidentiality and explicit access rules.

## Source guarantees

Every answer is a set of retrieved evidence statements carrying `[n]` references. Each source includes document ID/title, document version, page and section when available, score, and a same-origin document route. If evidence does not cross the configured threshold, the service returns `INSUFFICIENT_EVIDENCE` and does not generate an answer.

The UI reminds decision makers to read the original source and context. Local storage paths, generated file names, tokens, cookies, and document contents are not logged.

## Index operations

Backfill the corpus after production migration and seed:

```bash
npm run knowledge:index
```

New document versions create queued index records after successful upload. Authorized users may explicitly index one document or rebuild all documents. A content parsing failure falls back to a metadata-only `PARTIAL` index; the failure code is stored in provider metadata without document content.

## Executive AI readiness

The application defines replaceable `KnowledgeEmbeddingProvider`, `KnowledgeAnswerComposer`, and `ExecutiveKnowledgeAssistant` contracts. A future approved Executive AI can implement those boundaries while retaining RBAC, evidence filtering, citation DTOs, query audit, and storage isolation. No generative capability is claimed in 25.0.0.

## Acceptance checklist

- Migration and seed complete without resetting data.
- Existing document versions are backfilled.
- New upload creates a queued index record.
- Arabic search returns only permitted documents.
- Every answered statement has a numbered source.
- An insufficient-evidence question returns no fabricated answer.
- Viewer cannot receive confidential/highly-confidential evidence.
- Cross-document relationships link only visible documents.
- `/health`, `/ready`, login, Enterprise 22, Enterprise 23, and Enterprise 24 remain operational.

## Known limitations

- Fixed-size PostgreSQL float arrays and application-side ranking are appropriate for the present institutional corpus, not an unbounded public corpus.
- Relationship detection is topic overlap; it does not claim causal, contradictory, or superseding meaning.
- Image-only and unsupported formats receive metadata indexing unless approved text extraction exists.
- Answers are extractive and may require a human to reconcile evidence across documents.
