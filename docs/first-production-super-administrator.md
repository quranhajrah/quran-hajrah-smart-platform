# First Production Super Administrator

There is no default administrator email or password in the application.

## Required account

- Full name: `حسن محمد الزهراني`
- Email: `admin@quran-hajrah.com`
- Effective role: `super_admin` (`SUPER_ADMIN` in operator terminology)
- Status: active

The identifying values are passed at execution time and are not embedded in source code. The password is generated cryptographically at execution time and is never stored as plaintext in PostgreSQL.

## Prerequisites

1. Run from the deployed repository root in an approved interactive Hostinger terminal or SSH session after `build:production` has created `packages/database/dist/create-admin.js`.
2. Ensure `DATABASE_URL` targets the intended production database.
3. Ensure committed migrations have completed.
4. Run `npm run db:seed` so the `super_admin` role exists.
5. Do not run this command as a build, postbuild, prestart, or runtime lifecycle because its one-time password output must not enter deployment logs.

## Exact production command

```bash
ADMIN_EMAIL='admin@quran-hajrah.com' \
ADMIN_FULL_NAME='حسن محمد الزهراني' \
npm run create:admin
```

Do not set `ADMIN_PASSWORD` for this run. Successful output contains:

```text
TEMPORARY_ADMIN_PASSWORD=<generated value>
```

The value is printed exactly once. Copy it directly into an approved password manager, clear the terminal output where operationally possible, sign in over HTTPS, and immediately use the existing change-password flow.

## Idempotent behavior

If the email does not exist, the command:

- creates an active user;
- hashes the generated password with bcrypt cost 12;
- assigns the seeded `super_admin` role;
- creates a non-secret audit record.

If the email already exists, the command:

- updates the full name;
- sets `isActive` to true;
- rotates the password to the newly generated temporary value;
- adds `super_admin` without deleting other roles;
- revokes active refresh sessions;
- records the update in `AuditLog`;
- does not create a duplicate user.

The command fails without writing if the seed role is missing or the input is invalid. It never logs the password hash, database URL, access tokens, refresh tokens, or other secrets.
