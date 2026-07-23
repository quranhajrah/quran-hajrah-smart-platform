# Hostinger Cloud Deployment

This directory is an operator guide, not an automated deployment. It contains no production credentials.

## Application settings

- Repository: `https://github.com/quranhajrah/quran-hajrah-smart-platform`
- Branch: `main`
- Root directory: repository root (the directory containing the root `package.json`)
- Application type: Express, or “Other” if monorepo detection does not identify Express
- Node.js: 20.x
- Install: Hostinger-managed dependency installation followed by the explicit clean install in the build command
- Build: `npm run build:production` (the existing Hostinger setting is supported directly)
- Start: `npm run start:production`
- Entry file when requested: `apps/api/dist/server.js`
- Health path: `/health`
- Readiness path: `/ready`
- Target domain: `app.quran-hajrah.com`

Hostinger supports GitHub import for public Node.js applications and stores server build output outside `public_html`; review the [official deployment instructions](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

`build:production` runs `npm ci --include=dev` before `build:artifacts`. This installs TypeScript, declaration packages, Prisma tooling, and Vite for compilation even when Hostinger initially omits devDependencies. `build:hostinger` is an alias for the same command. Prisma CLI is also a runtime dependency because the production start command must remain migration-capable after `npm ci --omit=dev`; keep `NODE_ENV=production` for the running application.

`start:production` first runs `npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma`. Prisma uses the schema's `directUrl = env("DIRECT_URL")` for migration traffic, applies only committed pending migrations, and starts the compiled application only after that command succeeds. Do not replace this release step with `prisma migrate dev` or `prisma db push`. If hPanel accepts only an entry file rather than a start command, run `npm run db:deploy` from the approved deployment terminal before starting `apps/api/dist/server.js`.

The root `postinstall` generates Prisma Client from the monorepo schema explicitly. It does not connect to PostgreSQL; database availability is reported separately by `/ready` and never blocks `/health` or the listening socket.

Complete the environment, deployment, and rollback checklists before declaring production success.
