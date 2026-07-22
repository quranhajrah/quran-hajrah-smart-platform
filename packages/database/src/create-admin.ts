import { hash } from 'bcryptjs';
import { database } from './index.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const fullName = process.env.ADMIN_FULL_NAME?.trim();
const password = process.env.ADMIN_PASSWORD;

if (!email || !fullName || !password) {
  throw new Error('ADMIN_EMAIL, ADMIN_FULL_NAME, and ADMIN_PASSWORD are required.');
}

if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
  throw new Error('ADMIN_PASSWORD does not meet the minimum password policy.');
}

const superAdmin = await database.role.findUnique({ where: { name: 'super_admin' } });
if (!superAdmin) throw new Error('Run npm run db:seed before creating the first administrator.');

const existing = await database.user.findUnique({ where: { email } });
if (existing) throw new Error('A user with ADMIN_EMAIL already exists.');

await database.user.create({
  data: {
    email,
    fullName,
    passwordHash: await hash(password, 12),
    roles: { create: { roleId: superAdmin.id } },
  },
});

console.log('Initial super administrator created.');
await database.$disconnect();
