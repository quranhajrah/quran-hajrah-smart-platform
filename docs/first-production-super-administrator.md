# First Production Super Administrator

There is no default administrator email or password in the application. Hostinger has no interactive production terminal for this deployment, so the first account is provisioned through a disabled-by-default post-build step.

## Required account

- Full name: `حسن محمد الزهراني`
- Email: `admin@quran-hajrah.com`
- Effective role: `super_admin` (`SUPER_ADMIN` in operator terminology)
- Status: active

The password is supplied only through Hostinger's protected environment-variable interface, hashed with bcrypt, and never printed or logged by the bootstrap.

## Exact activation steps

1. Open the Node.js application in Hostinger hPanel and select **Environment variables**.
2. Add these four temporary variables:
   - `ADMIN_BOOTSTRAP_ENABLED=true`
   - `ADMIN_EMAIL=admin@quran-hajrah.com`
   - `ADMIN_FULL_NAME=حسن محمد الزهراني`
   - `ADMIN_TEMP_PASSWORD=<a unique temporary password>`
3. Ensure `ADMIN_TEMP_PASSWORD` is at least 12 characters and contains uppercase, lowercase, number, and special characters. Do not reuse an organizational or personal password.
4. Leave `ADMIN_PASSWORD` unset; it belongs only to the separate interactive maintenance command.
5. Redeploy the current `main` branch with `npm run build:production`.
6. Confirm the build completes migration, seed, and administrator bootstrap. The only bootstrap success message identifies whether the account was created or updated; it never contains the password.
7. Verify `/health` and `/ready`, sign in over HTTPS with the temporary value, and immediately change it through the existing account password flow.

The production lifecycle is:

```text
npm run db:deploy
npm run db:seed
npm run admin:bootstrap:production
```

The bootstrap runs only when `ADMIN_BOOTSTRAP_ENABLED` is exactly `true`. If enabled with a missing or invalid identity or password value, it exits nonzero and fails the deployment.

## Exact removal steps

Immediately after login and password change:

1. Delete `ADMIN_TEMP_PASSWORD` from Hostinger.
2. Delete `ADMIN_EMAIL` and `ADMIN_FULL_NAME`.
3. Delete `ADMIN_BOOTSTRAP_ENABLED`, or change it to `false`.
4. Redeploy once.
5. Confirm the deployment succeeds without an administrator-bootstrap completion message and that the changed password still works.

Do not leave the enable flag set to `true`: a future deployment would intentionally rotate the same account's password to the still-configured temporary value.

## Idempotent behavior

If the email does not exist, the bootstrap creates an active user, hashes the temporary password with bcrypt cost 12, assigns `super_admin`, and creates a non-secret audit record.

If the email already exists, the bootstrap updates the full name, activates the account, rotates its password, adds `super_admin` without deleting other roles, revokes active refresh sessions, records the update, and does not create a duplicate.

No bootstrap log includes the temporary password, password hash, database URL, access token, refresh token, cookie, or other secret.
