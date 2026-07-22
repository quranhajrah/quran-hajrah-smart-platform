import path from 'node:path';
import { spawnSync } from 'node:child_process';

const prismaCli = path.resolve('node_modules/prisma/build/index.js');
const schema = path.resolve('packages/database/prisma/schema.prisma');
const attempts = 3;

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const result = spawnSync(process.execPath, [prismaCli, 'generate', '--schema', schema], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status === 0) process.exit(0);
  if (result.error) console.error(`Prisma generation attempt ${attempt} failed: ${result.error.message}`);
  if (attempt < attempts) {
    console.error(`Retrying Prisma generation (${attempt + 1}/${attempts}) after a transient failure.`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }
}

console.error(`Prisma generation failed after ${attempts} attempts.`);
process.exit(1);
