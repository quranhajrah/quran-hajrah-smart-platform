# Legacy files

This directory contains the pre-monorepo application and its deployment assets. They were moved here during the foundation stabilization phase so the repository root contains only the new TypeScript monorepo scaffold. Nothing was deleted.

Moved items:

- `assets/`, `css/`, `js/`, and the root HTML/PWA files: previous static frontend.
- `backend/`: previous standalone Node.js backend.
- `deploy/`, root `Dockerfile`, and `start.sh`: previous deployment configuration.
- `scripts/`: previous standalone validation scripts.
- `docs/project/`: documentation tied to the previous application.
- `CHANGELOG.md`, `UPLOAD_TO_GITHUB.md`, and `VERSION`: previous release metadata and publishing notes.

These files are retained for reference only and are not part of the active npm workspaces, builds, Docker services, or CI checks.
