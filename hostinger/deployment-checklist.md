# Deployment Checklist

## Before deployment

- [ ] Confirm the latest GitHub Actions CI run on `main` is green.
- [ ] Provision a separate production PostgreSQL database and enable encrypted connections.
- [ ] Create and verify provider backups and point-in-time recovery where available.
- [ ] Enter all values from `environment-checklist.md` in hPanel.
- [ ] Run `npm run db:status` and `npm run db:diagnostics` from an approved secure environment.
- [ ] Confirm `postbuild:production` will run `db:deploy`, `db:seed`, then the conditional administrator bootstrap in that order.
- [ ] Provision and test the persistent non-public `DOCUMENT_STORAGE_ROOT`.
- [ ] For the first administrator only, add `ADMIN_BOOTSTRAP_ENABLED=true`, `ADMIN_EMAIL`, `ADMIN_FULL_NAME`, and `ADMIN_TEMP_PASSWORD` through hPanel.
- [ ] Confirm the temporary password meets the 12-character uppercase/lowercase/number/special-character policy.

## Hostinger setup

- [ ] Add a Node.js Web App in hPanel.
- [ ] Connect the official GitHub repository and select `main`.
- [ ] Select Node.js 20.x.
- [ ] Configure root and build values from `README.md`, and set the entry file to `apps/api/dist/server.js`.
- [ ] Confirm the build log shows `postbuild:production` executing migration, seed, and a safe administrator-bootstrap completion message before runtime startup.
- [ ] Confirm the build log never contains `ADMIN_TEMP_PASSWORD`.
- [ ] Deploy and inspect build/runtime logs without copying secrets.
- [ ] Connect `app.quran-hajrah.com` through the Node.js app dashboard.
- [ ] Apply required DNS records and wait for propagation.
- [ ] Confirm Hostinger installed a valid SSL certificate. Hostinger states custom-domain SSL is automatic after domain connection; see [custom domain setup](https://www.hostinger.com/support/how-to-connect-a-custom-domain-to-a-node-js-application/).

## Post-deployment

- [ ] `https://app.quran-hajrah.com/health` returns 200.
- [ ] `/ready` returns 200.
- [ ] `/` displays the admin login page.
- [ ] `/portal/` displays the portal shell.
- [ ] An unauthenticated protected API route returns 401 JSON, not HTML.
- [ ] Sign in with the initial administrator over HTTPS.
- [ ] Change the temporary administrator password immediately.
- [ ] Remove `ADMIN_TEMP_PASSWORD`, `ADMIN_EMAIL`, and `ADMIN_FULL_NAME` from hPanel.
- [ ] Remove `ADMIN_BOOTSTRAP_ENABLED` or set it to `false`, then redeploy and confirm the bootstrap is skipped.
- [ ] Confirm refresh, logout, and protected user listing.
- [ ] Confirm Secure and HttpOnly on the refresh cookie.
- [ ] Confirm runtime logs are structured and contain no credentials.
- [ ] Open the Knowledge Center, upload an approved test PDF, download it, add a version, archive it, restore it, and verify its audit history.
- [ ] Confirm binary files persist after a controlled redeploy.
- [ ] Confirm migration `20260724_enterprise_23_executive_intelligence` is applied in the build log.
- [ ] Confirm the authenticated landing route displays the Executive Dashboard without fabricated values.
- [ ] Verify server-side RBAC denial with a read-only role and allow the same action with an authorized executive role.
- [ ] Create and verify one approved acceptance metric measurement, KPI, initiative, risk, alert, and report.
- [ ] Verify report generation and approval require distinct permissions and all six acceptance actions appear in the audit log.
- [ ] If scheduling alerts, run `npm run executive:alerts` once, confirm idempotency, and only then configure the approved Hostinger schedule.

Do not mark Enterprise 23 production successful until DNS, SSL, readiness, database migration, login, dashboard, RBAC, and the six production acceptance records are verified on the real domain.
