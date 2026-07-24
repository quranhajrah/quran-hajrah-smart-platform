# Enterprise 23 Administrator Guide

## Initial setup

Run committed production operations in this order:

```bash
npm run db:deploy
npm run db:seed
```

Migration name: `20260724_enterprise_23_executive_intelligence`.

The seed is idempotent. It adds permissions, metric definitions, health weights, and dashboard defaults; it does not create measurements, users, or role assignments.

## Permission administration

Keep least privilege:

- View roles receive `.view` permissions only.
- Data owners receive the matching `.manage` or `.measure` permission.
- `dashboard.configure`, `alerts.manage`, and `reports.approve` are privileged.
- Do not combine report preparation and approval unless governance policy explicitly allows it.
- Executive permissions never bypass document confidentiality.

The seed grants executive-management defaults to `board_chair` and `executive_director`, and read-only executive access to `viewer`. It does not add those roles to users.

## Data administration

- Register metrics before measurements and objectives before KPIs.
- Do not enter estimates as actual measurements. Use notes and an approved source.
- Resolve duplicate codes/keys through governance rather than deleting production records.
- Use soft deletion endpoints where offered.
- Review risk treatment and alert queues regularly.
- Generate a health snapshot only when the current coverage is understood.

## Alerts

Run:

```bash
npm run executive:alerts
```

The command uses compiled production code, the current production database environment, and idempotent fingerprints. It prints only a count. Configure a scheduler after one supervised run; do not add cron work to server startup.

## Reports

1. Create a draft with `reports.create`.
2. Generate structured sections from current authorized platform data.
3. Review and edit stored sections through approved interfaces/APIs.
4. Approve with `reports.approve`.
5. Use the authenticated print view.
6. Archive only an approved report.

Generated report content is not written to request logs. Audit metadata records workflow actions without copying report content.

## Acceptance and incident response

Follow `hostinger/deployment-checklist.md`. If a new release affects calculations, preserve the commit, migration state, weights, and affected measurements. Restore only into an isolated environment first. Never use `prisma migrate dev`, `prisma db push`, or a reset against production.
