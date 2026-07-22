# GitHub Release Validation Report

Date: 2026-07-22  
Release: `20.2.0` — Foundation and Identity RBAC Release  
Release status: **Successful**

## Git configuration

- Official local root: `quran-hajrah-smart-platform/`
- Branch: `main`
- Remote: `https://github.com/quranhajrah/quran-hajrah-smart-platform.git`
- Release commit: `385385960bf3abeff4d1b9ce339479777b7983ee`
- Commit message: `release: foundation and identity RBAC v20.2.0`
- CI correction commit: `1ded2a258a98eadea62beaeeb97e110f3e52e2fb`

The project root did not contain a Git repository, so an independent repository was initialized with `main` as its initial branch. The MinGit official distribution was downloaded into the ignored local `.tools/` directory because Git CLI was not installed on the machine.

## Excluded files

The following are excluded by `.gitignore` and were verified as absent from the release commit:

- `.env` and environment variants other than `.env.example`.
- `node_modules/`.
- `.tools/`, including the local MinGit distribution and credential helpers.
- `dist/`, `coverage/`, logs, and TypeScript build metadata.
- Database files, SQLite files, dumps, and backups.
- Uploads, private files, secrets, credentials, certificates, and key files.
- All previous application content under `legacy/`.

Only `legacy/README.md` is included. Git's staged-file review confirmed that no other legacy file entered the commit.

## Security review

- `npm run security:check`: passed.
- Sensitive filename scan across 75 public-release candidates: passed.
- High-confidence secret pattern scan for private keys, GitHub tokens, OpenAI-style keys, and AWS access keys: passed.
- Staged Git blob secret scan: passed.
- No `.env`, database, backup, key, credential, `node_modules`, `.tools`, build output, or private legacy file was staged.

The first security check detected credential-helper and CA files inside the newly downloaded `.tools/mingit` directory. The checker was corrected to ignore the already Git-ignored local tools directory, and the complete security scan then passed.

## Release validation results

| Command | Result |
| --- | --- |
| `npm run security:check` | Passed |
| `npm run lint` | Passed, zero warnings/errors |
| `npm run typecheck` | Passed for all seven workspaces |
| `npm run test` | Passed: 4 files, 13 tests |
| `npm run build` | Passed for all seven workspaces |
| `npm run db:validate` | Passed |
| `npm run db:generate` | Passed; Prisma Client generated |

The portal build emitted only the expected Tailwind notice that the empty portal scaffold currently contains no utility classes.

## Push result

GitHub browser authentication was completed through Git Credential Manager without placing any password or token in the repository or chat. The release commit was pushed to `origin/main`, followed by the CI correction commit.

Push status: **Successful.** The local `main` branch tracks `origin/main`.

## GitHub verification and Actions

- Repository: public and visible at `https://github.com/quranhajrah/quran-hajrah-smart-platform`.
- Default branch: `main`.
- The remote release commit matched `385385960bf3abeff4d1b9ce339479777b7983ee` after the initial push.
- Initial CI run `29890438364`: failed during `npm run typecheck` because a clean runner did not have the generated `packages/database/dist` type declarations.
- Correction: the root `typecheck` command now builds `@quran-hajrah/database` before checking every workspace. This was reproduced locally after deleting the generated database output.
- Corrected CI run `29890759052`: **completed successfully** for commit `1ded2a258a98eadea62beaeeb97e110f3e52e2fb`.
- Successful run URL: `https://github.com/quranhajrah/quran-hajrah-smart-platform/actions/runs/29890759052`.

## Final decision

**Successful.** The release and CI correction were pushed to `origin/main`, the repository contents were verified through GitHub's API, and the corrected GitHub Actions workflow completed successfully.
