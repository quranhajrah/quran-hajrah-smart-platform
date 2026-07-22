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

`build:production` runs `npm ci --include=dev` before `build:artifacts`. This installs TypeScript, declaration packages, Prisma tooling, and Vite for compilation even when Hostinger initially omits devDependencies. `build:hostinger` is an alias for the same command. A later production-only install can still use `npm ci --omit=dev`; keep `NODE_ENV=production` for the running application.

The root `postinstall` generates Prisma Client from the monorepo schema explicitly. It does not connect to PostgreSQL; database availability is reported separately by `/ready` and never blocks `/health` or the listening socket.

Complete the environment, deployment, and rollback checklists before declaring production success.
