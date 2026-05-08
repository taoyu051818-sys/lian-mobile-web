# Frontend Testing Foundation

Date: 2026-05-08
Issue: #133
Companion: `docs/qa/TESTING_STRATEGY.md`

This file defines the testing foundation specific to the frontend codebase. See `TESTING_STRATEGY.md` for the full phased plan, fixture priorities, and manual-vs-automated boundaries.

## Current test surface

### Smoke coverage (`scripts/smoke-frontend.js`)

| Check | What it validates | What it misses |
|---|---|---|
| Homepage HTML | `<title>`, `<main class="app-shell">`, script order | DOM content after JS execution |
| Static JS reachability | All 12 scripts return HTTP 200 | JS runtime errors, module resolution |
| API JSON validity | `/api/feed`, `/api/map/v2/items` parse as JSON | Response shape, field types, edge cases |
| Legacy syntax | `node --check` on 8 split files | Vue SFC compilation, TypeScript errors |
| CSS reachability | `/styles.css` returns 200 | Style application, responsive layout |
| Helper contract | `expectedScriptOrder` array match | Runtime global availability |

### Verify gate integration

Smoke is now part of the verify gate:

```text
npm run verify
  ├── npm run check           (structure + encoding)
  ├── npm run ops:guard       (runtime inventory)
  ├── npm run build           (vue-tsc + vite build)
  └── npm run verify:smoke    (smoke with managed server lifecycle)
```

`npm run test` and `npm run test:vue-canary` target ports 4300 and 4301 respectively for standalone smoke runs.

## First pure-function unit-test targets

These functions are testable without DOM, browser, or server dependencies.

### Publish payload builders

File: `src/api/publish.ts`

| Function | Test cases |
|---|---|
| `normalizePublishTag()` | Known tags pass through, unknown tags fallback, empty/null handling |
| `normalizeIdentityTag()` | Known identity tags, unknown tags return null/undefined, type coercion |
| `createManualLocationDraft()` | Free-text location produces `locationArea` only, no fabricated `placeId` |
| `createMapV2LocationDraft()` | Location with `placeId` produces structured draft, missing `placeId` produces fallback |
| `buildPublishPayload()` | Required fields present, optional fields omitted when absent, image array handling |

These are the highest-priority unit targets because:
- They sit at the contract boundary between frontend and backend
- They were the subject of multiple cleanup PRs (#48, #50, #53, #55, #57, #59, #61, #81, #90, #93, #96)
- A regression here silently breaks publish payloads

### Response adapters

File: `src/api/http.ts` and related adapter modules

| Function | Test cases |
|---|---|
| Feed response adapter | Valid response maps correctly, missing `actor` field degrades gracefully, legacy flat fields do not leak |
| Detail response adapter | Structured `place` preserved, `locationArea` stays as fallback text |
| Map items adapter | `placeId` extraction, location without place produces non-stable fallback |

### Time and locale formatting

File: `src/utils/time.ts`

| Function | Test cases |
|---|---|
| Relative time display | "刚刚", "X分钟前", "X小时前", date boundary |
| Absolute time formatting | Locale-correct format, timezone handling |

### Runtime config parsing

File: `src/config/runtime.ts` (or equivalent config module)

| Function | Test cases |
|---|---|
| Config validation | Required fields present, defaults injected, invalid values rejected |
| Env variable parsing | String-to-number coercion, boolean parsing, URL validation |

## Component test foundation

When Phase 2 begins, these components need interaction tests first:

### AuthPanel (`src/views/auth/AuthPanel.vue`)

- Mode switch: login -> register -> verify-email
- Validation: empty email, invalid email format, short password
- Cooldown: resend timer disables button, re-enables after expiry
- Submit: disabled during send, re-enabled on error

### PublishView (`src/views/PublishView.vue`)

- Image selection: add/remove, max count enforcement
- Tag selection: known tags from API, manual input
- Validation: required fields (title, at least one image)
- Submit: busy state, success redirect, error display

### PostDetailPanel (`src/views/detail/PostDetailPanel.vue`)

- Like/save toggle: optimistic update, rollback on error
- Reply form: busy state during send, error recovery
- Report: confirmation dialog, success feedback

### MessagesView (`src/views/MessagesView.vue`)

- Channel list: empty state, loading state
- Reply: send busy state, error display

## E2E path foundation

When Phase 3 begins, these are the minimum viable E2E paths:

| Path | Viewport | Fixture |
|---|---|---|
| Homepage loads, feed renders | 375x812 | `feed.json` |
| Tap feed card -> detail opens -> back returns to feed | 375x812 | `feed.json` + `post-detail.json` |
| Bottom tab: Feed -> Map -> Messages -> Profile | 375x812 | `feed.json` + `map-v2-items.json` + `messages.json` |
| Publish: fill form -> submit -> success | 375x812 | `auth-me.json` |
| Auth required: tap protected action -> login appears | 375x812 | `auth-unauthenticated.json` |

## Smoke test responsibilities going forward

The existing smoke test should remain as the fastest gate. Its role after Phases 1-3 land:

| Check layer | What runs | Speed | Dependency |
|---|---|---|---|
| `verify:static` | check + ops:guard + build + unit tests | ~30s | None (offline) |
| `verify:component` | Vitest component tests | ~15s | jsdom (no browser) |
| `verify:smoke` | HTTP smoke (existing) | ~10s | Running server |
| `verify:e2e` | Playwright core paths | ~60s | Server + browser |

Smoke stays as a fast, dependency-light gate that validates server startup and basic asset/API reachability. It does not compete with E2E; it complements it by running faster and catching server-level regressions that E2E might mask with fixture routing.

## Non-goals

This document does not authorize:

- Installing Vitest, Playwright, `@vue/test-utils`, or any test dependency
- Adding test files, test configuration, or fixture files
- Modifying `package.json`, `tsconfig.json`, or `vite.config.ts`
- Changing CI workflows or GitHub Actions
- Editing source files in `src/` or `public/`
