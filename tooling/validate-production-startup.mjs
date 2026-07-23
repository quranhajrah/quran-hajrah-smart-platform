import { access, readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const bootstrapSource = await readFile(new URL('../apps/api/src/start.ts', import.meta.url), 'utf8');
const scripts = packageJson.scripts ?? {};
const expectedMigration = 'npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma';
const expectedStartup = 'node apps/api/dist/start.js';

if (scripts['db:deploy'] !== expectedMigration) {
  throw new Error(`db:deploy must be exactly: ${expectedMigration}`);
}
if (scripts['start:production'] !== expectedStartup) {
  throw new Error('start:production must deploy migrations before starting the compiled API.');
}
if (scripts['deploy:production'] !== 'npm run start:production') {
  throw new Error('deploy:production must delegate to the migration-enforcing production start command.');
}
if (!packageJson.dependencies?.prisma) {
  throw new Error('Prisma CLI must remain available after a production-only dependency install.');
}

const migrationCall = bootstrapSource.indexOf('await migrate();');
const serverStart = bootstrapSource.indexOf('await startServer();');
if (
  !bootstrapSource.includes("'--schema=packages/database/prisma/schema.prisma'")
  || !bootstrapSource.includes('migrate: () => Promise<void> = runMigrations')
  || !bootstrapSource.includes("startServer: ServerStarter = () => import('./server.js')")
  || migrationCall < 0
  || serverStart < 0
  || migrationCall > serverStart
) {
  throw new Error('The production bootstrap must await the exact migration before importing the existing server.');
}
await access(new URL('../apps/api/dist/start.js', import.meta.url));

const productionCommands = [scripts['db:deploy'], scripts['start:production'], scripts['deploy:production']].join('\n');
if (/prisma\s+migrate\s+dev|prisma\s+db\s+push/.test(productionCommands)) {
  throw new Error('Unsafe development or schema-push command found in the production startup sequence.');
}

console.log('Build output confirmed: apps/api/dist/start.js exists and awaits migrate deploy through DIRECT_URL before importing server.js.');
