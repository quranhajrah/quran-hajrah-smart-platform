# Rollback Checklist

- [ ] Record the deployed commit and database migration status before every deployment.
- [ ] Confirm a fresh PostgreSQL backup or provider snapshot exists.
- [ ] Confirm a coordinated encrypted backup of `DOCUMENT_STORAGE_ROOT` exists and record its recovery point.
- [ ] If only application code fails, select the last known-good commit/branch and use Hostinger Settings and Redeploy. GitHub-based redeployments use the selected repository source; see [Hostinger redeployment guidance](https://www.hostinger.com/support/how-to-redeploy-a-node-js-application/).
- [ ] Do not run destructive Prisma rollback SQL automatically.
- [ ] Prefer a forward-fix migration when the database remains compatible.
- [ ] Restore a database snapshot only after impact review and with the application stopped or isolated.
- [ ] Restore document metadata and binary storage from compatible recovery points; never overwrite newer files without an incident-approved reconciliation plan.
- [ ] After rollback, verify `/health`, `/ready`, login, refresh, logout, protected API behavior, document listing, and a controlled file download.
- [ ] Inspect Hostinger deployment and runtime logs. Hostinger exposes centralized runtime logs in hPanel; see [runtime log guidance](https://www.hostinger.com/support/how-to-use-node-js-runtime-logs-at-hostinger/).
- [ ] Record incident timeline, restored commit, restored database point, and validation evidence outside the public repository if it contains operational details.
