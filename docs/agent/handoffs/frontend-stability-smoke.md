# Handoff: frontend-stability-smoke

Date: 2026-05-02

> **Superseded by PR #282.** The legacy static runtime and `scripts/smoke-frontend.js` described here were removed in PR #282. Smoke testing now uses `scripts/run-smoke-with-server.js` with Vite preview. This handoff is retained as historical context only.

## Summary

Added `scripts/smoke-frontend.js` — a browserless HTTP smoke test for the split frontend.

## Files changed

| File | Change |
|---|---|
| `scripts/smoke-frontend.js` | New. 21 checks: homepage HTML, static JS reachable, API endpoints JSON valid, frontend syntax, CSS reachable. |

## Behavior

The script takes an optional base URL argument (default `http://localhost:4100`):

```bash
node scripts/smoke-frontend.js [URL]
```

Checks performed:

1. **Homepage HTML** — `<title>` exists, `<main class="app-shell">` exists, map-v2.js and split scripts referenced
2. **Static JS** — all 9 scripts return HTTP 200
3. **API** — `/api/feed` and `/api/map/v2/items` return valid JSON
4. **Syntax** — all 8 split frontend files pass `node --check`
5. **CSS** — `/styles.css` returns HTTP 200

Exits non-zero if any check fails.

## Validation

```bash
node --check scripts/smoke-frontend.js
node scripts/smoke-frontend.js http://localhost:4100
```

Result: 21 passed, 0 failed.

## What was intentionally not done

- No Playwright/browser tests (task doc notes this as a risk, not a requirement)
- No changes to frontend files — all split files already pass syntax checks
- No encoding corruption detected in index.html

## Risks

- HTTP-only smoke test cannot catch runtime JS errors or broken event handlers
- Requires a running server to execute

## Rollback

Delete `scripts/smoke-frontend.js`.

## Next suggested task

Workstream C: AI Publish Polish (`docs/agent/tasks/ai-publish-polish.md`)
