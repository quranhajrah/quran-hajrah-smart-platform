import { access, readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const prismaSchema = await readFile(new URL('../packages/database/prisma/schema.prisma', import.meta.url), 'utf8');
const scripts = packageJson.scripts ?? {};
const expectedMigration = 'npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma';
const expectedStartup = 'node apps/api/dist/server.js';

if (scripts['db:deploy'] !== expectedMigration) {
  throw new Error(`db:deploy must be exactly: ${expectedMigration}`);
}
if (scripts['start:production'] !== expectedStartup) {
  throw new Error('start:production must start the existing compiled server entrypoint.');
}
if (scripts['deploy:production'] !== 'npm run start:production') {
  throw new Error('deploy:production must delegate to the production start lifecycle.');
}
if (!packageJson.dependencies?.prisma) {
  throw new Error('Prisma CLI must remain available after a production-only dependency install.');
}
if (scripts['postbuild:production'] !== 'npm run db:deploy') {
  throw new Error('postbuild:production must deploy migrations before Hostinger launches server.js.');
}
if (scripts['prestart:production'] !== 'npm run db:deploy') {
  throw new Error('prestart:production must deploy migrations for npm-managed production starts.');
}
if (!/directUrl\s*=\s*env\("DIRECT_URL"\)/.test(prismaSchema)) {
  throw new Error('Prisma migrations must use DIRECT_URL.');
}
await access(new URL('../apps/api/dist/server.js', import.meta.url));

const productionCommands = [
  scripts['db:deploy'],
  scripts['postbuild:production'],
  scripts['prestart:production'],
  scripts['start:production'],
  scripts['deploy:production'],
].join('\n');
if (/prisma\s+migrate\s+dev|prisma\s+db\s+push/.test(productionCommands)) {
  throw new Error('Unsafe development or schema-push command found in the production startup sequence.');
}

console.log('Production lifecycle confirmed: migrations use DIRECT_URL before apps/api/dist/server.js starts.');
