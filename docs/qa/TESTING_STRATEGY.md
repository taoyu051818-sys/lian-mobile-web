# Testing Strategy

Date: 2026-05-08
Issue: #133
Scope: frontend testing foundation, phased verify path, automation boundaries

## Current state

The repository uses `scripts/run-smoke-with-server.js` for smoke testing, which builds the Vue frontend, starts Vite preview, and runs checks:

- Homepage HTML structure and `<title>`
- API endpoint JSON validity (`/api/feed`, `/api/map/v2/items`)

Smoke runs against the Vite preview server. The legacy static runtime was removed in PR #282.

The `verify` gate now chains static checks and smoke:

```text
npm run verify
  = npm run verify:static  (check + ops:guard + build)
  + npm run verify:smoke   (smoke with server lifecycle)
```

No unit test framework, component test runner, or E2E runner exists.

## Phased verify path

### Phase 0: Current gate (already merged)

```text
npm run verify
  ├── npm run check           (project structure, encoding)
  ├── npm run ops:guard       (runtime inventory guardrails)
  ├── npm run build           (vue-tsc --noEmit + vite build)
  └── npm run verify:smoke    (HTTP smoke, server lifecycle managed)
```

This is the baseline. All new phases add to this path without replacing it.

### Phase 1: Pure-function unit tests

**Goal**: Catch logic regressions in functions that need no browser, no DOM, no server.

**Framework**: Vitest (zero-config for Vite projects, ESM-native, fast).

**Entry point**: `npm run test:unit`

**Integration into verify**: Add `npm run test:unit` to `verify:static` or as a new `verify:unit` step before smoke.

#### First unit-test targets

Priority is based on: (a) pure function, (b) no DOM/browser dependency, (c) currently exercised only by manual testing or smoke HTTP checks, (d) directly supports active issues.

| Module | Functions | Rationale | Supports |
|---|---|---|---|
| `src/api/publish.ts` | `normalizePublishTag()`, `normalizeIdentityTag()`, `createManualLocationDraft()`, `createMapV2LocationDraft()`, `buildPublishPayload()` | Payload shape correctness; contract drift detection | #132, #113 |
| `src/utils/time.ts` | Time formatting, relative time, locale-aware display | Pure math; easy to snapshot | #118 |
| `src/api/http.ts` | Response adapter functions, error classification | API contract boundary; catches backend shape drift | #104, #113 |
| `src/config/runtime.ts` (or equivalent) | Config parsing, default injection, env validation | Pure parsing; deterministic | #119, #167 |
| `src/api/map-v2.ts` | Map response adapter, PlaceRef extraction | Contract boundary for map data | #132 |
| Feed scoring helpers | `scoreItem` weight calculations (if extracted) | Weight regression; snapshot-friendly | HIGH_RISK_AREAS |

**Non-targets for Phase 1**: Functions requiring `document`, `window`, fetch, or Vue component instances. Those move to Phase 2.

### Phase 2: Vue component interaction tests

**Goal**: Catch state-machine and interaction regressions in complex Vue components.

**Framework**: `@vue/test-utils` + Vitest + jsdom (or happy-dom).

**Entry point**: `npm run test:component`

**First targets** (in priority order):

1. **AuthPanel** — mode switch (login/register/verify-email), validation errors, cooldown timer state, submit disabled state
2. **PublishView** — image selection, tag validation, payload assembly, error/success states
3. **PostDetailPanel** — like/save/report busy states, reply form, error recovery
4. **MessagesView** — channel list rendering, reply sending, empty state
5. **UI primitives** (Button, InlineError, Sheet) — contract tests for slot/prop/emit behavior

**Non-targets for Phase 2**: Full routing, real API calls, map rendering. Those move to Phase 3.

### Phase 3: E2E / browser-path tests

**Goal**: Catch regressions in navigation, rendering, and multi-step user flows.

**Framework**: Playwright (mobile viewport support, fixture routing, multi-browser).

**Entry point**: `npm run test:e2e`

**Core paths** (in priority order):

1. Homepage loads, bottom tabs switch correctly
2. Feed card opens detail, back returns to feed with scroll position
3. Publish form validates, submits, shows success
4. Messages tab loads, reply sends
5. Map loads (or shows graceful fallback on CDN failure)
6. Auth flow: login form appears when required, session persists across navigation

**Mobile-specific paths**:
- Bottom nav visible and functional at 375px width
- Reply dock does not overlap content on keyboard open
- Publish form scrolls correctly with soft keyboard

**Fixture requirement**: E2E must not depend on a live backend. Use Playwright route interception with fixture JSON (see Fixture priorities below).

## Fixture priorities

Fixtures enable deterministic testing without a running backend. Create them in priority order:

### Priority 1: API response fixtures

These feed unit tests (Phase 1), component tests (Phase 2), and E2E (Phase 3).

| Fixture | Content | Used by |
|---|---|---|
| `tests/fixtures/feed.json` | 5-10 feed items with varied `contentType`, `actor`, `place`, `tags` | Feed rendering, scoring, adapter tests |
| `tests/fixtures/post-detail.json` | Single post with replies, structured place, `identityTag` | Detail view, PlaceSheet, reply tests |
| `tests/fixtures/auth-me.json` | Authenticated user profile | Auth state, profile, publish auth gate |
| `tests/fixtures/map-v2-items.json` | 5-10 map locations with/without `placeId` | Map adapter, PlaceRef extraction |
| `tests/fixtures/messages.json` | Channel list with 3-5 messages | MessagesView rendering |

### Priority 2: State/edge-case fixtures

| Fixture | Content | Used by |
|---|---|---|
| `tests/fixtures/feed-empty.json` | Empty feed array | Empty state rendering |
| `tests/fixtures/feed-error.json` | API error response | Error state, retry UI |
| `tests/fixtures/post-no-place.json` | Post with only `locationArea`, no `place` | PlaceSheet fallback path |
| `tests/fixtures/auth-unauthenticated.json` | 401 response | Login gate, redirect behavior |

### Priority 3: Contract regression fixtures

| Fixture | Content | Used by |
|---|---|---|
| `tests/fixtures/feed-legacy-actor.json` | Feed items with flat actor fields (legacy fallback) | Legacy compat tests |
| `tests/fixtures/post-legacy-location.json` | Post with legacy `locationId` only | PlaceRef migration guard |

## Manual vs. automated acceptance

### Should be automated (Phases 1-3)

| Category | Why automate | Phase |
|---|---|---|
| Payload shape / publish contract | Pure function, high regression risk | 1 |
| Validation error messages | Deterministic, snapshot-friendly | 1 |
| Time formatting / locale display | Pure function, edge cases | 1 |
| Response adapter correctness | Contract boundary, backend drift | 1 |
| Auth panel mode switching | State machine, repeatable | 2 |
| Form submit / error / busy states | Interaction logic, deterministic | 2 |
| Feed card rendering with fixture data | DOM output predictable | 2 |
| Tab navigation and back-button | Browser behavior, Playwright supports | 3 |
| Mobile viewport layout | Playwright device emulation | 3 |
| Core publish flow E2E | Happy path, fixture-backed | 3 |

### Should remain manual

| Category | Why manual | Reference |
|---|---|---|
| PWA install prompt timing | Depends on browser chrome, install state, user gesture | #109 |
| iOS Safari / Android Chrome behavioral differences | Requires real devices for edge cases | #123 |
| Share sheet / clipboard integration | OS-level UI, not programmatically controllable | #131 |
| Visual polish / animation smoothness | Subjective, device-dependent | #114 |
| Safe-area / viewport-unit edge cases on notch devices | Requires physical device testing | #130 |
| CDN failure recovery in production | Network-level, hard to simulate reliably | #152 |
| Deploy-state build marker verification | Environment-specific | #65 |
| Auth session expiry on real 30-day boundary | Time-dependent, not worth simulating | #159 |

### Manual checklist (release gate)

These items should be versioned in a release checklist doc and executed before promotion:

1. Smoke passes on the Vite preview server
2. `npm run verify` passes clean
3. Test account authenticated; profile liked/saved returns data (not 401)
4. At least one post with structured place renders PlaceSheet correctly
5. Bottom tab navigation works on 375px viewport
6. Reply dock visible and functional with soft keyboard open
7. Map loads or shows graceful fallback
8. No `[object Object]` visible in any actor/identity display

## Integration into verify gate

The recommended verify gate evolution:

```text
Phase 0 (current):
  verify:static  = check + ops:guard + build
  verify:smoke   = HTTP smoke with server

Phase 1 (add unit):
  verify:static  = check + ops:guard + build + test:unit
  verify:smoke   = HTTP smoke with server

Phase 2 (add component):
  verify:static  = check + ops:guard + build + test:unit
  verify:component = vitest run --environment jsdom
  verify:smoke   = HTTP smoke with server

Phase 3 (add E2E):
  verify:static    = check + ops:guard + build + test:unit
  verify:component = vitest run --environment jsdom
  verify:e2e       = playwright test (core paths only)
  verify:smoke     = HTTP smoke with server (remains as fast gate)
```

Smoke remains as the fastest, lowest-dependency gate even after E2E exists. It validates that the server starts and serves correct HTML/JS/API without browser overhead.

## Non-goals

This document does not authorize:

- Installing test frameworks or modifying `package.json` (implementation PRs handle that)
- Changing CI workflows or GitHub Actions configuration
- Modifying source code in `src/` or `public/`
- Adding test files to `scripts/`
- Replacing or removing the existing smoke test

## Acceptance criteria for #133 docs slice

- [x] Phased verify path defined with clear entry points per phase
- [x] Current smoke test role in main quality gate documented
- [x] First pure-function unit-test targets identified with rationale
- [x] Fixture priorities ranked by dependency and coverage value
- [x] Manual vs. automation boundary defined with reasoning
- [x] Verify gate evolution path specified
- [x] Non-goals documented

## Next implementation steps

After this docs slice merges, the implementation sequence for #133 is:

1. Install Vitest, add `npm run test:unit`, create first test for `buildPublishPayload()` (smallest possible PR)
2. Add feed/post/auth fixtures, expand unit tests to cover publish and adapter functions
3. Install `@vue/test-utils`, add `npm run test:component`, create AuthPanel tests
4. Install Playwright, add `npm run test:e2e`, create homepage + tab navigation test
5. Expand E2E to cover publish and detail flows with fixture-backed routing
