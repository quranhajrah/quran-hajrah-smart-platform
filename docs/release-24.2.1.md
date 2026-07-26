# Release 24.2.1

Title: **Enterprise 24.2.1 Analysis Identity and Strategic Reconstruction**

## Delivered

- One application-owned semantic extraction version, persisted as `24.2.1`.
- Parser/provider versions isolated to provider metadata.
- Version-aware stable fingerprints and unique forced-reanalysis fingerprints.
- Distinct same-job retry and new-job reanalysis actions.
- Review diagnostics for job ID, extraction version, creation time, and document type.
- Evidence-preserving full strategic-axis titles with ordinal-only rejection.
- Regression coverage for lifecycle identity, fingerprint invalidation, navigation targets, strategic reconstruction, and the existing operational acceptance fixture.

## Deployment

Use the existing build and deployment lifecycle. There is no migration, environment-variable change, or Hostinger setting change. The entry file remains:

```text
apps/api/dist/server.js
```

Production acceptance remains pending until Hostinger deploys the commit and authorized users reanalyze the real strategic and operational plans, verify the new job IDs and `24.2.1` summaries, and complete the live UAT checklist.
