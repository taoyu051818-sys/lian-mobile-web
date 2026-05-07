# Frontend verification runtime

## Purpose

The frontend verification gate must catch regressions in static structure, build output, and smoke behavior before code merges.

The project splits verification into two layers:

| Layer | Script | What it checks |
| --- | --- | --- |
| Static guards + build | `npm run verify:static` | Repo structure, encoding, ops guard, Vite build |
| Smoke | `npm run verify:smoke` | Static rehearsal server reachability, HTML contract, JS syntax, API probe |

`npm run verify` runs both layers sequentially.

## Smoke server lifecycle

`verify:smoke` delegates to `scripts/run-smoke-with-server.js`, which owns the static rehearsal server lifecycle explicitly:

1. Starts `scripts/serve-frontend-static-rehearsal.js` on port `4300`.
2. Polls until the server is reachable (15 s timeout).
3. Runs `scripts/smoke-frontend.js` against the live server.
4. Stops the server regardless of test outcome.

This removes the need for a separate `npm run serve:legacy` step in CI.

## CI workflow contract

The `Frontend Validation` workflow (`frontend.yml`) calls `npm run verify` as a single step. The workflow also runs `scripts/test-static-proxy-forwarded-headers.js` as a separate regression check.

## Port contract

- Static rehearsal server uses port `4300` (configurable via `--port` or `FRONTEND_PORT` env).
- Vue canary uses port `4301` (see `docs/ops/vue-canary-runtime.md`).

## Operational rule

Any PR that changes the verification scripts, smoke runner, static rehearsal server, or CI workflow steps must update this document or another runtime inventory artifact in the same PR.
