# LIAN frontend runtime inventory

This file is the runtime-inventory companion for frontend runtime-sensitive changes. It exists so changes to CI workflows, package scripts, frontend entrypoints, serve scripts, preview behavior, or runtime/deployment assumptions are reviewed together with the runtime contract they affect.

For the operator-facing split between install, build, deploy-prepare, and startup responsibilities, read `docs/frontend/runtime-responsibility-contract.md`.

## Current frontend runtime

- Runtime: `Vue/Vite preview`
- Purpose: Vue/Vite frontend shell, including Map/Explore surface
- Default port: `4301` via `npm start`
- Entry command: `npm start`

The legacy static runtime was removed in PR #282 and migrated to https://github.com/taoyu051818-sys/-lian-mobile-web-legacy. Vue/Vite is now the sole active web runtime.

`npm run preview` remains the raw Vite preview entrypoint, but the operator-facing start contract is `npm start` so the runtime binds to port 4301 with `--strictPort`.

The production process manager name and deploy path are intentionally not hardcoded here. They are environment-specific and should be checked on the target host before any restart, reload, or rollback operation.

## Runtime-sensitive files

The following file groups must update this inventory or explicitly document why the runtime contract is unchanged:

- `.github/workflows/*`
- `package.json` — owns Node/npm policy plus the operator and CI entrypoints (`npm start`, `npm run check`, `npm run ops:guard`, `npm run verify`, `npm run ownership-doc`, `npm run check:ownership-doc`, `npm run check:dead-code`)
- `index.html`
- `vite.config.ts` — owns the `~` alias, env URL validation, dev proxy contract, and production build settings
- `scripts/validate-project-structure.js` — executable repo-shape and boundary guard behind `npm run check`; it verifies required frontend files, backend-only exclusions, and layer/barrel rules
- `ops/*` and `docs/ops/*`

## CI and smoke ownership

The frontend quality gate is split into two visible layers:

- `verify:static`: project checks, runtime inventory guard, and build/type validation.
- `verify:smoke`: Vite preview server lifecycle plus browser/API smoke checks.

`npm run verify` is allowed to call both layers so CI and local validation do not drift. Smoke owns the temporary Vite preview server lifecycle during validation and should not require a developer to start that server manually.

## Install and Node version policy

Frontend CI and reproducible local setup use Node 22 with npm 10 or newer. The repository declares this through `.nvmrc` and `package.json` engines.

CI workflows must install from the lockfile with `npm ci`; `npm install` is reserved for local dependency updates that intentionally change `package-lock.json`. This keeps validation aligned with the committed dependency graph and avoids workflow drift between the frontend validation lanes.

## Architecture cleanup follow-up (issue #578 / merged PR #577)

Merged PR `#577` changed `package.json`, `scripts/validate-project-structure.js`, and `vite.config.ts` together. Those files now form one coordinated runtime/governance surface:

- `package.json` wires the verification flow, ownership-doc regeneration/check mode, dead-code scan, stale-code tracking, and runtime inventory guard.
- `scripts/validate-project-structure.js` is not just a folder-layout check. It validates required files, JSON config shape, frontend guard script syntax, backend-only exclusions, the `src/views/` ban, UI/domain/platform boundaries, and feature-barrel imports.
- `vite.config.ts` owns the `~` path alias in addition to backend/image-proxy env validation, dev proxy targets, and source-protection build settings.

If any of those files change, update this inventory and the paired architecture ownership docs in the same branch.

## Workflow baseline note (PR #266)

This inventory update acknowledges the runtime-sensitive workflow baseline changes on PR #266:

- `.github/workflows/frontend.yml` now declares a workflow-wide `permissions: contents: read` baseline for ordinary validation work.
- The `publish-legacy-status` job is the only job in that workflow that widens permissions, and it does so only for the existing commit-status writeback path (`statuses: write` with `contents: read`).
- `actions/setup-node` now reads `.nvmrc` through `node-version-file`, so CI uses the same repo-declared Node baseline instead of duplicating `22` inside the workflow file.
- Dependency installation in the workflow remains `npm ci`, so the validation lane still runs from the committed lockfile rather than a floating dependency graph.

These workflow-baseline changes do not alter the student-facing runtime split, preview ports, or static rehearsal routing behavior. They tighten the validation contract around the existing frontend runtimes.

## Routing contract

The Vite preview server serves the built Vue app from `dist/`. Changes to root-path handling, base path configuration, proxy behavior, or default port assumptions are runtime-sensitive and must be described here.

## Runtime config accessor change note (issue #167)

This inventory update acknowledges runtime-sensitive changes for the runtime config accessor slice:

- `src/config/runtime-config.ts` is the new shared accessor module; it reads `window.LIAN_API_BASE_URL` and `window.LIAN_IMAGE_PROXY_BASE_URL` lazily on every call instead of freezing the value at module load time.
- `src/api/http.ts`, `src/api/profile.ts`, and `src/api/publish.ts` now import from the shared accessor instead of independently reading and freezing `window.LIAN_API_BASE_URL` at import time.
- `vite.config.ts` adds `parseEnvUrl` validation so a malformed `LIAN_BACKEND_BASE_URL` or `LIAN_IMAGE_PROXY_BASE_URL` is rejected at dev-server or build startup rather than silently falling back to a localhost default.
- `tests/config/runtime-config.test.ts` covers injection-order, malformed/missing env, and absolute-URL policy behavior.

The runtime contract uses Vite's built-in environment variable handling for backend and image-proxy URLs.

## Current change note (PR #282)

PR #282 removed the migrated legacy static runtime from this repository. The legacy runtime now lives in https://github.com/taoyu051818-sys/-lian-mobile-web-legacy. Vue/Vite is the sole active web runtime in this repository.

## Maintenance recovery note

The maintenance recovery branch adds docs and a manual Vue preview helper:

- `docs/architecture/frontend-project-structure.md` documents the current Vue/Vite shell structure.
- `docs/ops/2026-05-05-bad-smell-cleanup-summary.md` records prior runtime and migration guardrail lessons.

These additions do not change production startup, default ports, CI workflow behavior, or the student-facing runtime entrypoint.
