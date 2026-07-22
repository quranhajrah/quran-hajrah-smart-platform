# Hostinger Cloud Deployment

This directory is an operator guide, not an automated deployment. It contains no production credentials.

## Application settings

- Repository: `https://github.com/quranhajrah/quran-hajrah-smart-platform`
- Branch: `main`
- Root directory: repository root (the directory containing the root `package.json`)
- Application type: Express, or “Other” if monorepo detection does not identify Express
- Node.js: 20.x
- Install: Hostinger-managed dependency installation; the root `.npmrc` keeps devDependencies available during the build stage
- Build: `npm run build:hostinger`
- Start: `npm run start:production`
- Entry file when requested: `apps/api/dist/server.js`
- Health path: `/health`
- Readiness path: `/ready`
- Target domain: `app.quran-hajrah.com`

Hostinger supports GitHub import for public Node.js applications and stores server build output outside `public_html`; review the [official deployment instructions](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

`build:hostinger` runs `npm ci --include=dev` before the production build. This installs TypeScript, declaration packages, Prisma tooling, and Vite only for compilation; it does not move them into runtime dependencies. Keep `NODE_ENV=production` for the running application.

Complete the environment, deployment, and rollback checklists before declaring production success.
