import { database } from './index.js';
import { generateTemporaryPassword, provisionSuperAdministrator } from './admin-provisioning.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const fullName = process.env.ADMIN_FULL_NAME?.trim();
const configuredPassword = process.env.ADMIN_PASSWORD;

if (!email || !fullName) {
  throw new Error('ADMIN_EMAIL and ADMIN_FULL_NAME are required.');
}

const passwordWasGenerated = !configuredPassword;
const password = configuredPassword || generateTemporaryPassword();

try {
  const result = await provisionSuperAdministrator(database, {
    email,
    fullName,
    password,
  });
  console.log(
    result.outcome === 'created'
      ? 'Initial super administrator created.'
      : 'Existing user activated and granted the super_admin role.',
  );
  if (passwordWasGenerated) {
    console.log(`TEMPORARY_ADMIN_PASSWORD=${password}`);
    console.log(
      'The temporary password was shown once. Store it securely and change it after login.',
    );
  }
} finally {
  await database.$disconnect();
}
