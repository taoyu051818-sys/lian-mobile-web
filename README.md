# LIAN Mobile Web

Frontend/mobile web workspace for LIAN.

This repository owns the frontend runtime lanes, Vue canary migration, static rehearsal server, frontend assets, task-board UI, and frontend documentation. Backend APIs, runtime data, authentication, uploads, image proxy, Redis state, and NodeBB integration live in the backend server repository: `taoyu051818-sys/lian-platform-server`.

## Current runtime model

The current merged code runs two frontend lanes during migration:

| Lane | Port | Purpose |
|---|---:|---|
| legacy/static rehearsal | 4300 | Stable compatibility lane and default frontend smoke target. |
| Vue canary | 4301 | Vue 3 + Vite migration lane for Feed, Detail, Profile, Messages, Auth, Publish, Map V2, and Profile Editor parity. |

`npm start` starts both lanes through `scripts/serve-frontend-runtimes.js`.

Do not treat older docs that describe a single `npm run dev` / Vite 5173 workflow as the current operational entry. `npm run dev` is still a Vite development helper, but the project runtime entry for current review is the dual-lane supervisor.

## Install dependencies

```bash
npm install
```

## Start both frontend lanes

```bash
npm start
```

Expected local lanes:

```txt
legacy/static rehearsal: http://127.0.0.1:4300
Vue canary:              http://127.0.0.1:4301
backend API:             http://127.0.0.1:4200
image proxy:             http://127.0.0.1:4201
```

Start the backend separately from `lian-platform-server` when smoke tests need live `/api/*` responses.

## Vue canary helpers

```bash
npm run dev:vue-canary
npm run preview:vue-canary
npm run test:vue-canary
```

The Vue canary port is fixed at 4301.

## Legacy/static rehearsal helper

```bash
npm run serve:legacy
```

The legacy/static rehearsal port defaults to 4300.

## Build Vue entry

```bash
npm run build
```

This runs `vue-tsc --noEmit` and `vite build`.

## Validate

```bash
npm run check
npm run ops:guard
npm run build
npm run test
npm run test:vue-canary
```

Or run the frontend verification bundle:

```bash
npm run verify
```

Current meanings:

- `npm run check` validates required project files and encoding contamination.
- `npm run ops:guard` checks runtime inventory guardrails.
- `npm run test` runs the smoke test against `http://127.0.0.1:4300`.
- `npm run test:vue-canary` runs the smoke test against `http://127.0.0.1:4301`.
- `npm run verify` runs check, ops guard, and build.

## Agent documentation

Before starting implementation, read:

1. `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`
2. `docs/agent/references/TASK_BOARD_OVERRIDE_2026-05-05.md`
3. `docs/agent/references/DOC_REVIEW_FINDINGS_2026-05-05.md`
4. `docs/agent/README.md`

These files override older task-board and handoff text when they conflict with current merged PRs and code.
