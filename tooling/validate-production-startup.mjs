import { access, readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const prismaSchema = await readFile(
  new URL('../packages/database/prisma/schema.prisma', import.meta.url),
  'utf8',
);
const scripts = packageJson.scripts ?? {};
const expectedMigration =
  'npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma';
const expectedStartup = 'node apps/api/dist/server.js';
const expectedAdminProvisioning = 'node packages/database/dist/create-admin.js';
const expectedProductionBootstrap = 'node packages/database/dist/bootstrap-admin.js';
const expectedPostbuild =
  'npm run db:deploy && npm run db:seed && npm run admin:bootstrap:production';

if (scripts['db:deploy'] !== expectedMigration) {
  throw new Error(`db:deploy must be exactly: ${expectedMigration}`);
}
if (scripts['start:production'] !== expectedStartup) {
  throw new Error('start:production must start the existing compiled server entrypoint.');
}
if (scripts['create:admin'] !== expectedAdminProvisioning) {
  throw new Error('create:admin must use the compiled production-safe provisioning entrypoint.');
}
if (scripts['deploy:production'] !== 'npm run start:production') {
  throw new Error('deploy:production must delegate to the production start lifecycle.');
}
if (!packageJson.dependencies?.prisma) {
  throw new Error('Prisma CLI must remain available after a production-only dependency install.');
}
if (scripts['postbuild:production'] !== expectedPostbuild) {
  throw new Error(
    'postbuild:production must deploy migrations, seed system data, and conditionally bootstrap the administrator before Hostinger launches server.js.',
  );
}
if (scripts['admin:bootstrap:production'] !== expectedProductionBootstrap) {
  throw new Error('The production administrator bootstrap must use its compiled entrypoint.');
}
if (scripts['prestart:production'] !== 'npm run db:deploy') {
  throw new Error('prestart:production must deploy migrations for npm-managed production starts.');
}
if (!/directUrl\s*=\s*env\("DIRECT_URL"\)/.test(prismaSchema)) {
  throw new Error('Prisma migrations must use DIRECT_URL.');
}
await access(new URL('../apps/api/dist/server.js', import.meta.url));
await access(new URL('../apps/api/dist/executive/generate-alerts.js', import.meta.url));
await access(new URL('../packages/database/dist/create-admin.js', import.meta.url));
await access(new URL('../packages/database/dist/admin-provisioning.js', import.meta.url));
await access(new URL('../packages/database/dist/admin-bootstrap.js', import.meta.url));
await access(new URL('../packages/database/dist/bootstrap-admin.js', import.meta.url));

const productionCommands = [
  scripts['db:deploy'],
  scripts['postbuild:production'],
  scripts['prestart:production'],
  scripts['start:production'],
  scripts['deploy:production'],
].join('\n');
if (/prisma\s+migrate\s+dev|prisma\s+db\s+push/.test(productionCommands)) {
  throw new Error(
    'Unsafe development or schema-push command found in the production startup sequence.',
  );
}

console.log(
  'Production lifecycle confirmed: DIRECT_URL migrations, system seed, and conditional administrator bootstrap run before apps/api/dist/server.js starts.',
);
