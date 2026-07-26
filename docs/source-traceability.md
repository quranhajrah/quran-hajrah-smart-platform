# Enterprise 24 Source Traceability

Every imported record is linked through `SourceEvidenceReference` to:

- `sourceDocumentId`;
- `sourceDocumentVersionId`;
- `sourceProposalId`;
- target type and target record;
- source page and section;
- bounded source evidence;
- extraction method;
- proposal parent/child relationship where applicable;
- import timestamp and importing user.

The source proposal retains its rule identifier, confidence, original structured proposal, human-edited data, reviews, and import items. This creates an auditable chain from a current Enterprise 23 record back to the immutable Knowledge Center version.

The protected endpoint is:

```text
GET /api/document-analysis/sources/:targetType/:targetRecordId
```

The server loads each source document and reapplies its confidentiality rules. References to inaccessible documents are omitted rather than disclosed. The admin UI exposes **عرض المصدر** only for returned references and links to the Knowledge Center document with the page hint when available.

Backups must include both PostgreSQL and matching document binaries. Restore testing must verify at least one imported record all the way back to its source version and evidence.
