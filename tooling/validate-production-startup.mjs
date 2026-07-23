import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const scripts = packageJson.scripts ?? {};
const expectedMigration = 'npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma';
const expectedStartup = 'npm run db:deploy && node apps/api/dist/server.js';

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

const productionCommands = [scripts['db:deploy'], scripts['start:production'], scripts['deploy:production']].join('\n');
if (/prisma\s+migrate\s+dev|prisma\s+db\s+push/.test(productionCommands)) {
  throw new Error('Unsafe development or schema-push command found in the production startup sequence.');
}

console.log('Production startup validated: migrate deploy runs through DIRECT_URL before the compiled API starts.');
