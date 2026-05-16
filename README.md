# LIAN Mobile Web

Frontend/mobile web workspace for LIAN.

This repository owns the Vue 3 + Vite frontend, design tokens, frontend assets, task-board UI, and frontend documentation. The legacy static runtime has been migrated to `taoyu051818-sys/-lian-mobile-web-legacy`. The active backend implementation direction for APIs, runtime data, authentication, uploads, image proxy, Redis state, and NodeBB integration lives in `taoyu051818-sys/lian-nest-server`, but current backend contract truth can still land in `taoyu051818-sys/lian-platform-server` when live routes or merged PRs say so. Recent Profile `/api/me/*` contract work, for example, landed there through merged PRs `#303` and `#304`, and the corresponding frontend consumer lane is tracked in `#534`.

## Runtime model

The frontend is a Vue 3 + Vite application. `npm start` runs `vite preview` on port 4301. `npm run dev` starts the Vite dev server on port 5173.

```txt
Vite preview/dev:  http://127.0.0.1:4301 (preview) / http://127.0.0.1:5173 (dev)
backend API:       http://127.0.0.1:4200
image proxy:       http://127.0.0.1:4201
```

Start the backend separately from `lian-nest-server` when smoke tests need live `/api/*` responses. Also check `lian-platform-server` whenever a frontend lane depends on the latest merged or in-flight backend contract truth rather than governance history alone.

## Toolchain baseline

- `.nvmrc` pins the repo Node baseline to `22`.
- The frontend GitHub Actions workflow reads that same file through `actions/setup-node`.
- `package-lock.json` is required, and CI installs from it with `npm ci`.

## Install dependencies

```bash
npm ci
```

Use `npm install` only when adding or updating dependencies locally.

## Start frontend

```bash
npm start
```

## Build

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
```

Or run the full frontend verification bundle:

```bash
npm run verify
```

Current meanings:

- `npm run check` validates required project files, encoding contamination, runtime exposure, and unsafe DOM sinks.
- `npm run ops:guard` checks runtime inventory guardrails.
- `npm run test` runs the Vue smoke test against `http://127.0.0.1:4301`.
- `npm run test:unit` runs vitest unit tests.
- `npm run verify:static` runs check, ops guard, and build.
- `npm run verify:smoke` runs the Vite-preview-backed smoke flow.
- `npm run verify` runs `verify:static`, unit tests, and `verify:smoke`.

## Agent documentation

Before starting implementation, read:

1. `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`
2. `docs/agent/references/TASK_BOARD_OVERRIDE_2026-05-05.md`
3. `docs/agent/references/DOC_REVIEW_FINDINGS_2026-05-05.md`
4. `docs/agent/README.md`

These files override older task-board and handoff text when they conflict with current merged PRs and code.