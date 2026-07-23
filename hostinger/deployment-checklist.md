# Deployment Checklist

## Before deployment

- [ ] Confirm the latest GitHub Actions CI run on `main` is green.
- [ ] Provision a separate production PostgreSQL database and enable encrypted connections.
- [ ] Create and verify provider backups and point-in-time recovery where available.
- [ ] Enter all values from `environment-checklist.md` in hPanel.
- [ ] Run `npm run db:status` and `npm run db:diagnostics` from an approved secure environment.
- [ ] Run `npm run db:deploy` against production; it executes `npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma` through `DIRECT_URL`.
- [ ] Run `npm run db:seed`; it creates roles and permissions only.
- [ ] Run `npm run create:admin` once using temporary environment values.

## Hostinger setup

- [ ] Add a Node.js Web App in hPanel.
- [ ] Connect the official GitHub repository and select `main`.
- [ ] Select Node.js 20.x.
- [ ] Configure root and build values from `README.md`, and use `npm run deploy:production` as the start command.
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
- [ ] Confirm refresh, logout, and protected user listing.
- [ ] Confirm Secure and HttpOnly on the refresh cookie.
- [ ] Confirm runtime logs are structured and contain no credentials.

Do not mark production successful until DNS, SSL, readiness, database migration, and login are all verified on the real domain.
