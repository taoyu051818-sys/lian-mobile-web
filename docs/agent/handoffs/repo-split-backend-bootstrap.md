# Handoff: Repo Split Phase 1 Backend Bootstrap Prep

Date: 2026-05-04

## Summary

This handoff prepares the non-destructive Phase 1 backend repository bootstrap for LIAN.

The current GitHub connector can edit the existing repository but does not expose a create-repository operation. No `lian-platform-server` repository was found, so this cut adds a repeatable export script inside the current repo. Once an empty backend repository is created manually, the generated export directory can be copied into it and validated.

## Files changed

- `scripts/prepare-backend-repo-export.js`
- `docs/agent/handoffs/repo-split-backend-bootstrap.md`

## Behavior changed

No runtime behavior changes.

This PR only adds a script and handoff documentation. It does not change server routes, frontend code, data files, auth, publish, feed, map, NodeBB integration, or deployment behavior.

## What the export script does

Run from the current monorepo:

```bash
node scripts/prepare-backend-repo-export.js outputs/lian-platform-server-export
```

The script creates a backend bootstrap workspace containing backend-owned files such as:

- `server.js`
- `src/`
- `data/`
- `scripts/` except `scripts/smoke-frontend.js`
- `test/`
- `docs/`
- `outputs/`
- `package.json`
- `.env.example`
- `.gitignore`
- `CLAUDE.md`
- `README.md`

It also writes:

- `BACKEND_BOOTSTRAP.md`
- `repo-split-manifest.json`

## Deliberately excluded

The script excludes:

- `public/`
- `scripts/smoke-frontend.js`
- `.git/`
- `node_modules/`
- `.env`
- `.env.*`
- local auth/session/cache files such as:
  - `auth-users.json`
  - `sessions.json`
  - `email-codes.json`
  - `user-cache.json`

## Validation commands

From the current repo on this branch:

```bash
node --check scripts/prepare-backend-repo-export.js
node scripts/prepare-backend-repo-export.js outputs/lian-platform-server-export
ls outputs/lian-platform-server-export/BACKEND_BOOTSTRAP.md
ls outputs/lian-platform-server-export/repo-split-manifest.json
```

From the generated export directory:

```bash
cd outputs/lian-platform-server-export
node --check server.js
find src/server -name '*.js' -maxdepth 2 -print0 | xargs -0 -n1 node --check
npm test
npm run check
npm run test:routes
node --test test/audience-regression.test.mjs
```

## Rollback plan

Revert the PR. Since this cut only adds script/documentation files, rollback has no runtime impact.

## Risks

- The export is a bootstrap workspace, not a substitute for creating the real `lian-platform-server` repository.
- The generated export includes runtime data files that must be reviewed before pushing to a real backend repository.
- Secrets are intentionally excluded, so the generated backend workspace may require environment configuration before it can boot.
- Some current repo files may be frontend/backend mixed; this script follows the current architecture task ownership, but the generated manifest must still be reviewed.

## Next suggested task

1. Manually create the empty private backend repository `lian-platform-server`.
2. Run the export script.
3. Copy the generated export into the backend repo.
4. Run backend validation commands.
5. Start backend staging and verify `/api/*` surface against `docs/agent/contracts/api-contract.md`.
6. Only after backend staging passes, begin frontend static-only rehearsal.
