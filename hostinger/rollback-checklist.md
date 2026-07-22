# Rollback Checklist

- [ ] Record the deployed commit and database migration status before every deployment.
- [ ] Confirm a fresh PostgreSQL backup or provider snapshot exists.
- [ ] If only application code fails, select the last known-good commit/branch and use Hostinger Settings and Redeploy. GitHub-based redeployments use the selected repository source; see [Hostinger redeployment guidance](https://www.hostinger.com/support/how-to-redeploy-a-node-js-application/).
- [ ] Do not run destructive Prisma rollback SQL automatically.
- [ ] Prefer a forward-fix migration when the database remains compatible.
- [ ] Restore a database snapshot only after impact review and with the application stopped or isolated.
- [ ] After rollback, verify `/health`, `/ready`, login, refresh, logout, and protected API behavior.
- [ ] Inspect Hostinger deployment and runtime logs. Hostinger exposes centralized runtime logs in hPanel; see [runtime log guidance](https://www.hostinger.com/support/how-to-use-node-js-runtime-logs-at-hostinger/).
- [ ] Record incident timeline, restored commit, restored database point, and validation evidence outside the public repository if it contains operational details.
