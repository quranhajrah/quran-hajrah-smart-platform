# Enterprise 24 Review and Import Guide

## Start analysis

Open a Knowledge Center document and choose **تحليل المستند**. Analysis is explicit and is never started during upload. Reanalysis creates a distinct job for the current immutable version; the normal start action reuses the same fingerprint when an equivalent job already exists.

## Review evidence

The review center groups proposals into Arabic institutional groups: beneficiaries, operational objectives, KPIs, initiatives, responsibilities, dates, budget, risks, and other data. It also shows document-level counts and filters by decision, confidence, page, and proposal type. Selecting a proposal shows:

- originating document and version;
- page and source section;
- bounded evidence snippet;
- proposed fields and confidence;
- proposed import target;
- parent and child proposals;
- extracted page text where available.

Confidence is a rule signal, not proof. The reviewer must compare the proposal to the source.

## Decisions

- **Approve**: accept unchanged evidence-backed fields.
- **Edit and approve**: correct or complete fields while retaining the original proposal and evidence.
- **Reject**: prevent import and record the decision.
- **Bulk review**: applies one decision only to proposals in the same job.

Every decision stores reviewer, timestamp, optional comment, before/after data, and an audit event.

## Conflict preview

Preview runs before import and checks codes, titles, keys, dates, prior imports, and budget identity. Options are:

- `skip`: safe default for uncertainty;
- `update`: update the matching target;
- `create`: create a separate record;
- `merge`: update only the explicitly selected fields.

Incomplete proposals can only be skipped until an authorized reviewer supplies every required target field. The application never invents missing dates, owners, targets, or numeric values.

## Import

Import requires `document_analysis.import` and an explicit confirmation. One database transaction covers target changes, import items, source evidence, and job status. A failed target operation rolls back the complete batch. The `Idempotency-Key` prevents duplicate replay.

Supported targets are strategic objectives, KPIs, metrics, metric values, initiatives, milestones, risks, treatments, executive alerts, executive report sections, budget records, and budget lines. Proposals with target `NONE` are review information only.

Parent targets are imported before their children. A KPI or initiative receives the target ID of its approved objective relation, and a budget line receives the imported budget ID. A skipped parent leaves the dependent child incomplete unless the parent already maps to an existing target. Beneficiary groups default to `NONE`; importing one as a live metric value requires the reviewer to choose that target explicitly and provide a metric and measurement date.

## After import

Open the imported Enterprise 23 record and choose **عرض المصدر**. Verify the document title, version, page, section, evidence, extraction method, import actor, and time. Confidentiality is checked again when source references are requested.
