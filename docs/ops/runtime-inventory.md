# LIAN frontend runtime inventory

This file is the runtime-inventory companion for frontend runtime-sensitive changes. It exists so changes to CI workflows, package scripts, frontend entrypoints, serve scripts, preview behavior, or runtime/deployment assumptions are reviewed together with the runtime contract they affect.

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

## Static rehearsal routing contract

The static rehearsal server should map `/` to `index.html`, serve frontend assets from the repository/public build context, and preserve the existing API/proxy behavior used by smoke tests. Changes to root-path handling, forwarded headers, proxy behavior, or default port assumptions are runtime-sensitive and must be described here.

## Current change note

This inventory update acknowledges the runtime-sensitive changes in PR #168:

- frontend workflows now call the clearer `npm run verify` gate;
- `package.json` separates static verification from smoke verification;
- the smoke runner owns static rehearsal server startup/shutdown;
- static rehearsal root-path handling is clarified so `/` resolves to `index.html` consistently.

The intended runtime split remains unchanged: legacy/static rehearsal stays on port 4300 and Vue canary preview stays on port 4301 unless a later runtime-inventory update says otherwise.
