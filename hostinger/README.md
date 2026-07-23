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
- Custom start command: not required or supported for this deployment
- Entry file: `apps/api/dist/server.js`
- Health path: `/health`
- Readiness path: `/ready`
- Target domain: `app.quran-hajrah.com`

Hostinger supports GitHub import for public Node.js applications and stores server build output outside `public_html`; review the [official deployment instructions](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

`build:production` runs `npm ci --include=dev` before `build:artifacts`. This installs TypeScript, declaration packages, Prisma tooling, and Vite for compilation even when Hostinger initially omits devDependencies. `build:hostinger` is an alias for the same command. Prisma CLI is also a runtime dependency because the production start command must remain migration-capable after `npm ci --omit=dev`; keep `NODE_ENV=production` for the running application.

Hostinger launches `apps/api/dist/server.js` directly so Express can call `listen()` immediately. The `postbuild:production` lifecycle runs `npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma` after compilation and before Hostinger starts that entry file. Prisma uses the schema's `directUrl = env("DIRECT_URL")` and applies only committed pending migrations. `prestart:production` provides the same guard for npm-managed runtimes. Do not replace these lifecycle steps with `prisma migrate dev` or `prisma db push`.

The root `postinstall` generates Prisma Client from the monorepo schema explicitly. It does not connect to PostgreSQL; database availability is reported separately by `/ready` and never blocks `/health` or the listening socket.

Complete the environment, deployment, and rollback checklists before declaring production success.
