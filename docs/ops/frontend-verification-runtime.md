# Frontend verification runtime

## Purpose

The frontend verification gate must catch regressions in static structure, build output, and smoke behavior before code merges.

The project splits verification into two layers:

| Layer | Script | What it checks |
| --- | --- | --- |
| Static guards + build | `npm run verify:static` | Repo structure, encoding, ops guard, Vite build |
| Smoke | `npm run verify:smoke` | Vite preview server reachability, HTML contract, JS syntax, API probe |

`npm run verify` runs both layers sequentially.

## Smoke server lifecycle

`verify:smoke` delegates to `scripts/run-smoke-with-server.js`, which owns the Vite preview server lifecycle explicitly:

1. Builds the Vue frontend with `npm run build`.
2. Starts Vite preview on port `4173` (configurable via `--port`).
3. Polls until the server is reachable (30 s timeout).
4. Runs the smoke command against the live server.
5. Stops the server regardless of test outcome.

The legacy static runtime was removed in PR #282. The legacy smoke script `scripts/smoke-frontend.js` and static rehearsal server `scripts/serve-frontend-static-rehearsal.js` no longer exist in this repository.

## CI workflow contract

The `Frontend Validation` workflow (`frontend.yml`) calls `npm run verify` as a single step.

## Port contract

- Vite preview uses port `4173` by default (configurable via `--port`).

## Operational rule

Any PR that changes the verification scripts, smoke runner, or CI workflow steps must update this document or another runtime inventory artifact in the same PR.
