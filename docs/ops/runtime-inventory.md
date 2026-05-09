# LIAN frontend runtime inventory

This file is the runtime-inventory companion for frontend runtime-sensitive changes. It exists so changes to CI workflows, package scripts, frontend entrypoints, serve scripts, preview behavior, or runtime/deployment assumptions are reviewed together with the runtime contract they affect.

For the operator-facing split between install, build, deploy-prepare, and startup responsibilities, read `docs/frontend/runtime-responsibility-contract.md`.

## Current frontend runtimes

| Runtime | Purpose | Default port | Entry command |
| --- | --- | ---: | --- |
| Legacy/static rehearsal | Student-facing legacy/static frontend rehearsal and fallback runtime | 4300 | `npm run serve:legacy` or the supervisor entrypoint |
| Vue canary preview | Vue canary shell preview, including the Vue Map/Explore surface | 4301 | `npm run preview:vue-canary` or the supervisor entrypoint |
| Dual runtime supervisor | Starts both legacy/static and Vue canary preview when the deployed frontend process is expected to expose both surfaces | 4300 and 4301 | `npm run start` |

The production process manager name and deploy path are intentionally not hardcoded here. They are environment-specific and should be checked on the target host before any restart, reload, or rollback operation.

## Runtime-sensitive files

The following file groups must update this inventory or explicitly document why the runtime contract is unchanged:

- `.github/workflows/*`
- `package.json`
- `index.html` and `public/index.html`
- `vite.config.ts`
- `scripts/serve-frontend-runtimes.js`
- `scripts/serve-frontend-static-rehearsal.js`
- `scripts/smoke-frontend.js`
- `scripts/validate-project-structure.js`
- `ops/*` and `docs/ops/*`

## CI and smoke ownership

The frontend quality gate is split into two visible layers:

- `verify:static`: project checks, runtime inventory guard, and build/type validation.
- `verify:smoke`: static rehearsal server lifecycle plus browser/API smoke checks.

`npm run verify` is allowed to call both layers so CI and local validation do not drift. Smoke owns the temporary static rehearsal server lifecycle during validation and should not require a developer to start that server manually.

## Install and Node version policy

Frontend CI and reproducible local setup use Node 22 with npm 10 or newer. The repository declares this through `.nvmrc` and `package.json` engines.

CI workflows must install from the lockfile with `npm ci`; `npm install` is reserved for local dependency updates that intentionally change `package-lock.json`. This keeps validation aligned with the committed dependency graph and avoids workflow drift between the frontend validation lanes.

## Static rehearsal routing contract

The static rehearsal server should map `/` to `index.html`, serve frontend assets from the repository/public build context, and preserve the existing API/proxy behavior used by smoke tests. Changes to root-path handling, forwarded headers, proxy behavior, or default port assumptions are runtime-sensitive and must be described here.

## Current change note

This inventory update acknowledges the runtime-sensitive changes in PR #168:

- frontend workflows now call the clearer `npm run verify` gate;
- `package.json` separates static verification from smoke verification;
- the smoke runner owns static rehearsal server startup/shutdown;
- static rehearsal root-path handling is clarified so `/` resolves to `index.html` consistently.

The intended runtime split remains unchanged: legacy/static rehearsal stays on port 4300 and Vue canary preview stays on port 4301 unless a later runtime-inventory update says otherwise.

## Maintenance recovery note

The maintenance recovery branch adds docs and a manual Vue canary preview helper without changing the default runtime split:

- `docs/architecture/frontend-project-structure.md` documents the current legacy/static plus Vue shell structure.
- `docs/ops/2026-05-05-bad-smell-cleanup-summary.md` records prior runtime and migration guardrail lessons.
- `scripts/preview-branch-vue-canary.sh` is a manual branch preview helper for Vue canary builds. It uses `npm ci`, `npm run build`, and `npm run preview:vue-canary` on port 4301 unless overridden by `LIAN_PREVIEW_PORT`.

These additions do not change production startup, default ports, CI workflow behavior, or the student-facing runtime entrypoint.
